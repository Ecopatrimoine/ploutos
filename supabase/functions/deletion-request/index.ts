// supabase/functions/deletion-request/index.ts
//
// Pipeline de DEMANDE d'effacement (chantier C3, lot b — spec Argos cycle de
// vie des donnees). Ce lot NE PURGE RIEN : il cree la demande, remet l'export
// de grace (export COMPLET du cabinet pour les deux scopes, decision D1), et
// fait entrer la demande en grace 30 jours. La purge (status 'purge') est un
// lot ulterieur (cron retention) — aucune suppression de donnees ici.
//
// Securite (C3-b, 12/07/2026) :
//   - JWT OBLIGATOIRE : Authorization: Bearer -> auth.getUser. Pas de chemin
//     ARGOS_INTERNAL_KEY dans ce lot (origin 'retention_auto' viendra avec le
//     cron). cgp_user_id = TOUJOURS l'utilisateur du JWT, jamais lu du body
//     (anti-IDOR, patron create-portal-session / export-cabinet).
//   - Toutes les ecritures passent par le client service_role (RLS : aucune
//     ecriture client possible sur les 3 tables du cycle de vie).
//   - Aucun contenu de donnees clients dans les logs : console.error = message
//     court ; data_lifecycle_log before/after = metadonnees d'etat uniquement.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// Client service_role : valide le JWT (getUser) et ecrit les 3 tables (bypass
// RLS). La session n'est jamais persistee cote fonction.
const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Statuts « actifs » : une demande dans l'un d'eux bloque une nouvelle demande
// sur le meme perimetre, et est la seule annulable.
const ACTIVE_STATUSES: string[] = ["demande", "export_remis", "grace"];
const GRACE_DAYS = 30;

// Journalise une transition dans data_lifecycle_log. `before`/`after` ne portent
// QUE des metadonnees d'etat (statut, horodatages, scope) — jamais de donnees
// clients. Best-effort : une erreur de log ne casse pas la demande.
async function logLifecycle(
  requestId: string | null,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const { error } = await supabase.from("data_lifecycle_log").insert({
    request_id: requestId,
    actor: "cgp",
    action,
    before,
    after,
  });
  if (error) console.error("[deletion-request] log", action, error.message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Methode non autorisee" }, 405);

  try {
    // ── Authentification JWT obligatoire ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Non authentifie" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Session invalide" }, 401);
    const cgpUserId = user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "create") return await handleCreate(cgpUserId, body, authHeader);
    if (action === "cancel") return await handleCancel(cgpUserId, body);
    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    console.error("[deletion-request]", err instanceof Error ? err.message : err);
    return json({ error: "Demande echouee" }, 500);
  }
});

// ─── action "create" ─────────────────────────────────────────────────────────
async function handleCreate(
  cgpUserId: string,
  body: Record<string, unknown>,
  authHeader: string,
): Promise<Response> {
  const scope = body?.scope === "cabinet" || body?.scope === "dossier" ? body.scope : "";
  if (!scope) return json({ error: "scope requis ('cabinet' ou 'dossier')" }, 400);

  const targetClientId =
    typeof body?.targetClientId === "string" && body.targetClientId.trim()
      ? body.targetClientId.trim()
      : null;
  const targetContactId =
    typeof body?.targetContactId === "string" && body.targetContactId.trim()
      ? body.targetContactId.trim()
      : null;

  // a) Validation scope dossier : target obligatoire + propriete verifiee.
  if (scope === "dossier") {
    if (!targetClientId) {
      return json({ error: "targetClientId requis pour un effacement de dossier" }, 400);
    }
    const { data: owned, error: ownErr } = await supabase
      .from("clients")
      .select("id")
      .eq("id", targetClientId)
      .eq("user_id", cgpUserId)
      .maybeSingle();
    if (ownErr) throw new Error(`verif propriete: ${ownErr.message}`);
    if (!owned) return json({ error: "Dossier introuvable" }, 404);
  }

  // a) Refus (409) si une demande active existe deja pour le meme perimetre
  // (meme scope cabinet, ou meme target_client_id).
  {
    let q = supabase
      .from("deletion_requests")
      .select("id")
      .eq("cgp_user_id", cgpUserId)
      .in("status", ACTIVE_STATUSES);
    q = scope === "cabinet" ? q.eq("scope", "cabinet") : q.eq("target_client_id", targetClientId);
    const { data: existing, error: exErr } = await q.limit(1);
    if (exErr) throw new Error(`verif demande active: ${exErr.message}`);
    if (existing && existing.length > 0) {
      return json({ error: "Une demande d'effacement est deja en cours pour ce perimetre" }, 409);
    }
  }

  // b) INSERT deletion_requests (origin 'cgp', status 'demande') + log.
  const { data: inserted, error: insErr } = await supabase
    .from("deletion_requests")
    .insert({
      cgp_user_id: cgpUserId,
      scope,
      origin: "cgp",
      target_client_id: scope === "dossier" ? targetClientId : null,
      target_contact_id: scope === "dossier" ? targetContactId : null,
      status: "demande",
    })
    .select("*")
    .single();
  if (insErr || !inserted) throw new Error(`insert demande: ${insErr?.message ?? "vide"}`);

  const requestId = inserted.id as string;
  await logLifecycle(requestId, "request_created", null, { status: "demande", scope });

  // c) Export de grace = export COMPLET du cabinet (decision D1). Appel interne
  // a export-cabinet en transmettant l'Authorization du CGP (meme JWT, meme
  // user). Les deux scopes recoivent le meme export complet.
  let exportUrl: string | null = null;
  let exportPath: string | null = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/export-cabinet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({} as { url?: string; path?: string; error?: string }));
    if (!res.ok || !data?.url) {
      throw new Error(`export-cabinet ${res.status}: ${data?.error ?? "sans url"}`);
    }
    exportUrl = data.url;
    exportPath = typeof data.path === "string" ? data.path : null;
  } catch (e) {
    // Echec de l'export -> la demande RESTE en 'demande' (le CGP reessaiera).
    console.error("[deletion-request] export de grace echoue:", e instanceof Error ? e.message : e);
    await logLifecycle(requestId, "export_failed", { status: "demande" }, { status: "demande" });
    return json(
      { error: "L'export de grace a echoue. La demande reste en attente, reessayez plus tard." },
      502,
    );
  }

  // c) Succes -> export_remis (export_path + export_delivered_at) + log ...
  const deliveredAt = new Date().toISOString();
  const { error: updDeliv } = await supabase
    .from("deletion_requests")
    .update({ status: "export_remis", export_delivered_at: deliveredAt, export_path: exportPath })
    .eq("id", requestId);
  if (updDeliv) throw new Error(`maj export_remis: ${updDeliv.message}`);
  await logLifecycle(
    requestId,
    "export_delivered",
    { status: "demande" },
    { status: "export_remis", export_delivered_at: deliveredAt },
  );

  // c) ... puis immediatement grace (grace_ends_at = export_delivered_at + 30 j).
  const graceEndsAt = new Date(Date.parse(deliveredAt) + GRACE_DAYS * 86_400_000).toISOString();
  const { data: finalRow, error: updGrace } = await supabase
    .from("deletion_requests")
    .update({ status: "grace", grace_ends_at: graceEndsAt })
    .eq("id", requestId)
    .select("*")
    .single();
  if (updGrace || !finalRow) throw new Error(`maj grace: ${updGrace?.message ?? "vide"}`);
  await logLifecycle(
    requestId,
    "grace_started",
    { status: "export_remis" },
    { status: "grace", grace_ends_at: graceEndsAt },
  );

  // d) Reponse 200 : demande complete + url signee de l'export.
  return json({
    id: finalRow.id,
    scope: finalRow.scope,
    status: finalRow.status,
    grace_ends_at: finalRow.grace_ends_at,
    export_url: exportUrl,
  });
}

// ─── action "cancel" ─────────────────────────────────────────────────────────
async function handleCancel(
  cgpUserId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) return json({ error: "requestId requis" }, 400);

  // Propriete (cgp_user_id = user du JWT) verifiee des la lecture — une demande
  // d'un autre CGP est « introuvable » (pas de fuite d'existence).
  const { data: reqRow, error: readErr } = await supabase
    .from("deletion_requests")
    .select("id, status, grace_ends_at")
    .eq("id", requestId)
    .eq("cgp_user_id", cgpUserId)
    .maybeSingle();
  if (readErr) throw new Error(`lecture demande: ${readErr.message}`);
  if (!reqRow) return json({ error: "Demande introuvable" }, 404);

  const status = reqRow.status as string;
  const graceEndsAt = reqRow.grace_ends_at as string | null;
  const graceInFuture = !graceEndsAt || Date.parse(graceEndsAt) > Date.now();
  if (!ACTIVE_STATUSES.includes(status) || !graceInFuture) {
    return json({ error: "Cette demande n'est plus annulable" }, 409);
  }

  const cancelledAt = new Date().toISOString();
  // Le garde-fou .in(status) rejoue la condition d'etat cote UPDATE : si une
  // course a change le statut entre la lecture et l'ecriture, 0 ligne -> 409.
  const { data: updated, error: updErr } = await supabase
    .from("deletion_requests")
    .update({ status: "annule", cancelled_at: cancelledAt })
    .eq("id", requestId)
    .eq("cgp_user_id", cgpUserId)
    .in("status", ACTIVE_STATUSES)
    .select("*")
    .maybeSingle();
  if (updErr) throw new Error(`maj annule: ${updErr.message}`);
  if (!updated) return json({ error: "Cette demande n'est plus annulable" }, 409);

  await logLifecycle(
    requestId,
    "request_cancelled",
    { status },
    { status: "annule", cancelled_at: cancelledAt },
  );

  return json({ id: updated.id, status: updated.status, cancelled_at: updated.cancelled_at });
}
