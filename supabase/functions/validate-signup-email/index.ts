// supabase/functions/validate-signup-email/index.ts
//
// Validation legere du domaine email AVANT supabase.auth.signUp. Appelee sans
// JWT (deploiement --no-verify-jwt, protocole de deploy de David).
//
// Politique FAIL-OPEN : seul un refus EXPLICITE bloque le signup —
//   1) domaine present dans public.blocked_email_domains (jetables au seed), ou
//   2) reponse DNS explicite sans enregistrement MX.
// Toute erreur technique (timeout DNS, DNS injoignable, erreur base) laisse
// passer (allowed: true). Le clic de confirmation email reste le juge final.
//
// Contrat : POST { email: string } -> { allowed: boolean,
//   reason?: 'blocked_domain' | 'no_mx' }. Aucune ecriture en base, aucun secret
// nouveau (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injectes par la plateforme).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// Client service_role : lit blocked_email_domains en contournant la RLS (aucune
// policy publique sur cette table). Aucune session persistee.
const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const MX_TIMEOUT_MS = 3000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Methode non autorisee" }, 405);

  // ── Normalisation ────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const raw = typeof body?.email === "string" ? body.email : "";
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  const domain = at >= 0 ? email.slice(at + 1) : "";

  // Email malforme -> refus (traite comme domaine invalide).
  const malformed =
    at <= 0 ||                       // pas de '@' ou partie locale vide
    !domain ||                       // domaine vide
    !domain.includes(".") ||         // pas de point (TLD absent)
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    /\s/.test(email);                // espace dans l'adresse
  if (malformed) return json({ allowed: false, reason: "blocked_domain" });

  // ── Check 1 : domaine explicitement bloque en base ───────────────────────
  try {
    const { data, error } = await supabase
      .from("blocked_email_domains")
      .select("domain")
      .eq("domain", domain)
      .maybeSingle();
    if (error) {
      // Erreur base = technique -> FAIL-OPEN sur ce check (on n'affirme pas le
      // blocage), on poursuit avec le check MX.
      console.error("[validate-signup-email] lookup fail-open:", error.message);
    } else if (data) {
      return json({ allowed: false, reason: "blocked_domain" });
    }
  } catch (err) {
    console.error("[validate-signup-email] lookup threw fail-open:", err instanceof Error ? err.message : err);
  }

  // ── Check 2 : enregistrements MX (timeout court, FAIL-OPEN) ───────────────
  try {
    const records = await Promise.race([
      Deno.resolveDns(domain, "MX"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dns_timeout")), MX_TIMEOUT_MS),
      ),
    ]);
    // Reponse DNS explicite mais vide -> pas de MX.
    if (!records || (Array.isArray(records) && records.length === 0)) {
      return json({ allowed: false, reason: "no_mx" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message === "dns_timeout";
    // Refus DNS EXPLICITE (aucun enregistrement) : NotFound ou message connu.
    const isNoRecords =
      (Deno.errors && err instanceof Deno.errors.NotFound) ||
      /no records|not be found|nxdomain|no such host/i.test(message);
    if (isNoRecords && !isTimeout) {
      return json({ allowed: false, reason: "no_mx" });
    }
    // Timeout ou toute autre erreur technique -> FAIL-OPEN (on laisse passer).
    console.error("[validate-signup-email] MX check fail-open:", message);
    return json({ allowed: true });
  }

  return json({ allowed: true });
});
