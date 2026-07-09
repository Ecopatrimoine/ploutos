// Lot 9 — garde-fous & états vides des onglets d'analyse (barrières douces).
// Fonctions PURES (testables) : conditions d'activation des empty states (C1)
// + logique d'alerte de rattachement fiscal (C3). AUCUN impact sur les calculs.
import type { PatrimonialData } from "../types/patrimoine";

// ── C1 — prédicats d'état vide ────────────────────────────────────────────────

// IFI vide : aucun bien immobilier dans l'assiette.
export function ifiEstVide(ifi: { lines?: unknown[] }): boolean {
  return (ifi.lines?.length ?? 0) === 0;
}

// IR vide : aucun revenu saisi (brut ET net global nuls). Conservateur : un
// dossier avec le moindre revenu (salaire, foncier brut, placement, pension via
// le net global) N'EST PAS considéré vide.
export function irEstVide(ir: {
  salaries?: number; foncierBrut?: number; taxablePlacements?: number; revenuNetGlobal?: number;
}): boolean {
  return (ir.salaries || 0) <= 0
    && (ir.foncierBrut || 0) <= 0
    && (ir.taxablePlacements || 0) <= 0
    && (ir.revenuNetGlobal || 0) <= 0;
}

// Succession vide : aucun patrimoine à transmettre (ni bien, ni placement).
export function successionEstVide(data: Pick<PatrimonialData, "properties" | "placements">): boolean {
  return (data.properties?.length ?? 0) === 0 && (data.placements?.length ?? 0) === 0;
}

// ── C3 — alerte de rattachement fiscal inhabituel (art. 6-3° et 196 B CGI) ─────

export const ALERTE_RATTACHEMENT_21 =
  "Rattachement inhabituel : au-delà de 21 ans, le rattachement suppose la poursuite d'études (jusqu'à 25 ans) ou une situation d'infirmité — art. 6-3° et 196 B CGI.";
export const ALERTE_RATTACHEMENT_25 =
  "Rattachement inhabituel : au-delà de 25 ans, le rattachement au foyer fiscal n'est admis que pour un enfant en situation d'infirmité (art. 196 B CGI). Vérifiez ce rattachement — art. 6-3° et 196 B CGI.";

// Retourne le message d'alerte (base ou renforcé) ou null. `age` est calculé par
// l'appelant (depuis la date de naissance). Règles :
//  - enfant non rattaché, ou handicap coché, ou âge inconnu -> aucune alerte ;
//  - > 25 ans (hors infirmité) -> alerte renforcée ;
//  - 21 < âge <= 25 ET non scolarisé -> alerte de base ;
//  - sinon (<= 21, ou en études entre 21 et 25) -> aucune alerte.
export function alerteRattachementEnfant(
  child: { rattached?: boolean; handicap?: boolean; schoolLevel?: string },
  age: number | null,
): string | null {
  const rattache = child.rattached !== false;
  if (!rattache || child.handicap || age === null) return null;
  if (age > 25) return ALERTE_RATTACHEMENT_25;
  if (age > 21 && !child.schoolLevel) return ALERTE_RATTACHEMENT_21;
  return null;
}
