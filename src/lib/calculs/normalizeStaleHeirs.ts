// ─── Neutralisation d'un cache stale de heirs de devolution legale (Lot F1) ───
//
// PROBLEME (F0, cause prouvee) : des heirs de devolution legale PERSISTES dans
// successionData.heirs par l'ancien code (syncCollectedHeirs -> buildCollectedHeirs
// AVANT Lot B) portent priorDonations "0" (-> MODE MANUEL, registre de donations
// ignore) ET n'ont PAS de childId (-> aucun match du rappel). L'assemblage de
// computeSuccession privilegie successionData.heirs quand il est non vide, court-
// circuitant les builders corriges.
//
// FIX NON DESTRUCTIF : au point d'appel (App.tsx), on neutralise ce cache POUR LE
// CALCUL uniquement -> heirs:[] -> computeSuccession reconstruit via
// buildCollectedHeirs (childId + defaut ""). Le dossier persiste n'est PAS reecrit
// (on renvoie une copie). Un cache FRAIS (enfants avec childId) est conserve tel quel.
//
// Detection : un cache legal legitime pose childId sur chaque enfant (buildCollectedHeirs,
// depuis Lot B). Un enfant SANS childId trahit donc un cache anterieur (stale).
export function stripStaleLegalHeirs<T extends { heirs?: unknown }>(sd: T): T {
  const heirs = Array.isArray((sd as { heirs?: unknown }).heirs) ? (sd as { heirs: any[] }).heirs : [];
  const stale = heirs.length > 0 && heirs.some((h: any) => h?.relation === "enfant" && !h?.childId);
  return stale ? { ...sd, heirs: [] } : sd;
}
