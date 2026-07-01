// ─── Exposition aux marches financiers ────────────────────────────────
// Repartit la valeur des placements entre une part SECURISEE (fonds euros,
// livrets, comptes) et une part DYNAMIQUE (exposee aux marches). La part UC
// saisie (ucRatio, en %) pondere les enveloppes mixtes fonds euros / UC :
// AV en unites de compte, contrat de capitalisation ET PER / Madelin.
//
// Correction du bug : les PER / Madelin tombaient dans le cas par defaut
// (else) et etaient comptes 100 % dynamiques, leur ucRatio saisi etant
// ignore. Ils sont desormais ponderes par ucRatio, au meme titre que les
// AV UC. Corrige aussi le bug secondaire "vide vs 0" : une part UC saisie a
// "0" est respectee (100 % securise) au lieu d'etre ecrasee par le defaut.

import type { Placement } from "../../types/patrimoine";
import { n, isAV, isPERType, isCashPlacement, isUCorCapi } from "./utils";

export type ExpositionMarche = {
  securise: number;
  dynamique: number;
  total: number;
  securisePct: number;
  dynamiquePct: number;
};

// Part UC effective d'un placement, en %. Une valeur SAISIE (meme "0") est
// respectee ; seul un champ vide ou non numerique retombe sur le defaut du
// type. On evite volontairement `n(brut) || defaut`, qui avale le "0" saisi.
function ucEffectif(brut: string, defaut: number): number {
  const estRenseigne = typeof brut === "string" && brut.trim() !== "" && !Number.isNaN(Number(brut));
  return estRenseigne ? Math.min(100, Math.max(0, Number(brut))) : defaut;
}

export function computeExpositionMarche(placements: Placement[]): ExpositionMarche {
  let securise = 0;
  let dynamique = 0;
  for (const p of placements) {
    const val = n(p.value);
    if (isCashPlacement(p.type)) {
      securise += val;                                    // livrets, comptes -> 100 % securise
    } else if (isAV(p.type) && !isUCorCapi(p.type)) {
      securise += val;                                    // AV fonds euros -> 100 % securise
    } else if (isUCorCapi(p.type)) {
      const defaut = isAV(p.type) ? 100 : 0;              // AV UC vide -> 100, contrat capi vide -> 0
      const uc = ucEffectif(p.ucRatio, defaut);
      dynamique += val * uc / 100;
      securise += val * (100 - uc) / 100;
    } else if (isPERType(p.type)) {
      const uc = ucEffectif(p.ucRatio, 0);                // PER / Madelin : vide -> 0 % UC (CORRECTIF)
      dynamique += val * uc / 100;
      securise += val * (100 - uc) / 100;
    } else {
      dynamique += val;                                   // PEA, CTO, actions, OPCVM... -> 100 % dynamique
    }
  }
  const total = securise + dynamique;
  const securisePct = total > 0 ? Math.round(securise / total * 100) : 0;
  const dynamiquePct = total > 0 ? 100 - securisePct : 0;
  return { securise, dynamique, total, securisePct, dynamiquePct };
}
