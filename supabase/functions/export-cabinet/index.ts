// supabase/functions/export-cabinet/index.ts
//
// Export intégral des données d'un cabinet (chantier C2 du cycle de vie —
// spec Argos docs/SPEC_CYCLE_VIE_DONNEES.md, décision D1 : propriétaire Ploutos).
// Assemble une archive ZIP (export.json + documents/ + MANIFESTE.txt), la dépose
// dans le bucket privé "exports" et renvoie une URL signée valable 7 jours.
//
// Sécurité (C2, 12/07/2026) — double consommateur (spec D1) :
//   - Chemin CGP : Authorization: Bearer -> auth.getUser ; le cgp_user_id est
//     TOUJOURS celui du JWT, jamais lu du body (anti-IDOR, patron
//     create-portal-session).
//   - Chemin Argos interne (export de grâce C3) : en-tête x-argos-internal-key
//     comparée à ARGOS_INTERNAL_KEY ; cgp_user_id lu du body dans ce seul cas.
//     La clé n'est JAMAIS journalisée ni renvoyée.
//   - Aucun des deux -> 401. Erreurs internes -> 500 générique, détail en
//     console.error uniquement (jamais de contenu de données dans les logs).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

// Client service_role : valide le JWT (getUser), lit toutes les tables (bypass
// RLS) et le Storage. La session n'est jamais persistée côté fonction.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ARGOS_INTERNAL_KEY = Deno.env.get("ARGOS_INTERNAL_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-argos-internal-key",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Tables « données du cabinet », chacune filtrée par sa colonne de propriété.
// Colonnes vérifiées dans le code propriétaire Ploutos/Kleios (recon R1).
const TABLE_SPECS: { name: string; column: string }[] = [
  { name: "clients",                        column: "user_id" },
  { name: "cabinet_settings",               column: "user_id" },
  { name: "crm_contacts",                   column: "user_id" },
  { name: "portal_messages",                column: "cgp_user_id" },
  { name: "portal_questionnaire_responses", column: "cgp_user_id" },
  { name: "portal_invitations",             column: "cgp_user_id" },
  { name: "portal_access",                  column: "cgp_user_id" },
  { name: "commission_contrats",            column: "user_id" },
  { name: "commission_lines",               column: "user_id" },
  { name: "commission_taux_cabinet",        column: "user_id" },
];

const DOCUMENTS_BUCKET = "documents";
const EXPORTS_BUCKET = "exports";
const SIGNED_URL_TTL = 604800; // 7 jours en secondes

// Liste récursive de tous les fichiers sous un préfixe du bucket documents.
// Un dossier est renvoyé sans id (id falsy) ; un fichier a un id. Pagination /100.
async function listAllDocuments(prefix: string): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      if (item.name === ".emptyFolderPlaceholder") continue;
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) {
        const nested = await listAllDocuments(path);
        out.push(...nested);
      } else {
        out.push(path);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    // ── Double authentification (spec D1) ────────────────────────────────────
    let cgpUserId: string;
    const internalKey = req.headers.get("x-argos-internal-key") ?? "";

    if (ARGOS_INTERNAL_KEY !== "" && internalKey === ARGOS_INTERNAL_KEY) {
      // Chemin Argos interne : cgp_user_id vient du body (export de grâce C3).
      const body = await req.json().catch(() => ({}));
      const fromBody =
        typeof body?.cgp_user_id === "string" ? body.cgp_user_id.trim() : "";
      if (!fromBody) return json({ error: "cgp_user_id requis" }, 400);
      cgpUserId = fromBody;
    } else {
      // Chemin CGP : cgp_user_id = utilisateur du JWT, jamais du body.
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ error: "Non authentifié" }, 401);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return json({ error: "Session invalide" }, 401);
      cgpUserId = user.id;
    }

    // ── Collecte des tables (filtrées ; chaque table peut être vide) ──────────
    const tables: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    let totalRows = 0;

    for (const spec of TABLE_SPECS) {
      const { data, error } = await supabase
        .from(spec.name)
        .select("*")
        .eq(spec.column, cgpUserId);
      if (error) throw new Error(`collecte ${spec.name}: ${error.message}`);
      const rows = data ?? [];
      tables[spec.name] = rows;
      counts[spec.name] = rows.length;
      totalRows += rows.length;
    }

    // commission_baremes : table de RÉFÉRENCE globale (barèmes assureurs), sans
    // colonne de cabinet — collectée telle quelle (actif = true) et étiquetée
    // comme référence dans le manifeste (ce ne sont pas des données du cabinet).
    {
      const { data, error } = await supabase
        .from("commission_baremes")
        .select("*")
        .eq("actif", true);
      if (error) throw new Error(`collecte commission_baremes: ${error.message}`);
      const rows = data ?? [];
      tables["commission_baremes"] = rows;
      counts["commission_baremes (reference globale)"] = rows.length;
      totalRows += rows.length;
    }

    // ── Documents du bucket "documents" sous <cgpUserId>/ ─────────────────────
    const docPaths = await listAllDocuments(cgpUserId);
    const entries: Record<string, Uint8Array> = {};
    let documentsBytes = 0;

    for (const fullPath of docPaths) {
      const { data: blob, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(fullPath);
      if (error || !blob) throw new Error(`download ${fullPath}: ${error?.message ?? "vide"}`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      documentsBytes += bytes.length;
      // Arborescence préservée sous documents/ (préfixe cabinet retiré).
      const rel = fullPath.startsWith(`${cgpUserId}/`)
        ? fullPath.slice(cgpUserId.length + 1)
        : fullPath;
      entries[`documents/${rel}`] = bytes;
    }

    // ── Fichiers d'index de l'archive ────────────────────────────────────────
    const exportedAt = new Date().toISOString();

    const exportJson = { exported_at: exportedAt, cgp_user_id: cgpUserId, tables };
    entries["export.json"] = strToU8(JSON.stringify(exportJson, null, 2));

    const manifestLines = [
      "EXPORT CABINET — ecosysteme Ploutos/Kleios",
      `Date d'export         : ${exportedAt}`,
      `Cabinet (cgp_user_id) : ${cgpUserId}`,
      "",
      "Lignes par table :",
      ...Object.entries(counts).map(([t, n]) => `  - ${t} : ${n}`),
      "",
      `Documents : ${docPaths.length} fichier(s), ${documentsBytes} octets (${humanSize(documentsBytes)})`,
    ];
    entries["MANIFESTE.txt"] = strToU8(manifestLines.join("\n") + "\n");

    // ── Archive ZIP (assemblage en mémoire — V1) ─────────────────────────────
    const zipData = zipSync(entries, { level: 6 });

    // ── Dépôt dans "exports" + URL signée 7 jours ────────────────────────────
    const stamp = exportedAt.replace(/:/g, "-"); // clé Storage sûre (pas de ':')
    const zipPath = `${cgpUserId}/export_${stamp}.zip`;

    const { error: upErr } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .upload(zipPath, zipData, { contentType: "application/zip", upsert: false });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(zipPath, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) throw new Error(`signed url: ${signErr?.message ?? "vide"}`);

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString();

    return json({
      url: signed.signedUrl,
      path: zipPath,
      expires_at: expiresAt,
      sizes: { tables: totalRows, documents_count: docPaths.length },
    });
  } catch (err) {
    console.error("[export-cabinet]", err instanceof Error ? err.message : err);
    return json({ error: "Export échoué" }, 500);
  }
});
