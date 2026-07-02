// ─── Identifiant stable ────────────────────────────────────────────────────
// Générateur d'identifiant unique, isolé dans son propre module pour être
// injectable / mockable dans les tests (les migrations acceptent une fabrique
// d'id en paramètre ; le défaut est newId). Basé sur crypto.randomUUID(), avec
// un repli défensif si WebCrypto est indisponible dans l'environnement.
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
