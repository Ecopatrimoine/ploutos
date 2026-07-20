import { SUPABASE_FUNCTIONS_URL } from "./supabase";

// Validation du domaine email au signup, deleguee a l'Edge Function
// validate-signup-email. Appel NU : aucun header Authorization (l'EF est
// deployee en --no-verify-jwt). Content-Type json uniquement.
//
// Politique FAIL-OPEN : seul un refus EXPLICITE de l'EF (allowed:false) bloque
// l'inscription. Toute erreur reseau, timeout, reponse non-2xx ou corps illisible
// renvoie { allowed: true }. Un 401 accidentel (EF deployee sans le flag) tombe
// donc dans le fail-open, comportement voulu.

export type SignupValidationReason = "blocked_domain" | "no_mx";

export type SignupValidationResult = {
  allowed: boolean;
  reason?: SignupValidationReason;
};

const REQUEST_TIMEOUT_MS = 5000;

export async function validateSignupEmail(email: string): Promise<SignupValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/validate-signup-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    if (!res.ok) return { allowed: true }; // non-2xx -> FAIL-OPEN
    const data = await res.json().catch(() => null);
    if (!data || typeof data.allowed !== "boolean") return { allowed: true };
    return { allowed: data.allowed, reason: data.reason };
  } catch {
    // Reseau / timeout / abort -> FAIL-OPEN.
    return { allowed: true };
  } finally {
    clearTimeout(timeout);
  }
}
