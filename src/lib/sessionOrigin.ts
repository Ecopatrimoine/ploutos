// Origine d'une session Supabase — helpers PURS pour distinguer une session
// issue d'un lien de recuperation (recovery) d'une session normale.
//
// Aucune dependance : `atob` natif (navigateur + Node >= 16). On ne verifie
// JAMAIS la signature du JWT : le token vient de notre propre `getSession`, on
// lit seulement un claim de confiance (`amr`). Aucun lien avec le moteur fiscal.

export type JwtPayload = Record<string, unknown>;

/**
 * Decode le payload (segment du milieu) d'un JWT `header.payload.signature`,
 * encode en base64url -> JSON.
 *
 * Retourne `null` si le token est absent, n'a pas exactement trois segments,
 * si le segment payload est vide/mal forme, ou si le JSON est invalide.
 */
export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const segment = parts[1];
  if (!segment) return null;

  try {
    // base64url -> base64 : '-' -> '+', '_' -> '/', puis padding a un multiple de 4.
    let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const mod = b64.length % 4;
    if (mod === 1) return null; // longueur base64 impossible
    if (mod === 2) b64 += "==";
    else if (mod === 3) b64 += "=";

    const json = atob(b64);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * `true` si la session portee par ce token provient d'un lien de recuperation :
 * le claim `amr` (Authentication Methods References) contient une entree dont
 * `method === "recovery"`.
 *
 * Robuste au token absent/malforme (retourne alors `false`) et a un `amr`
 * absent ou non-tableau.
 */
export function isRecoverySession(token: string | null | undefined): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  const amr = (payload as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;

  return amr.some(
    (entry) =>
      entry != null &&
      typeof entry === "object" &&
      (entry as { method?: unknown }).method === "recovery",
  );
}
