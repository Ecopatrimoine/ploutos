// ─── Helpers UI du mi-temps thérapeutique (TPT) ───────────────────────
//
// Fonctions pures partagées par l'UI (BlocTpt) et les tests. Le moteur
// (projection.ts) ne dépend pas de ce fichier : il reçoit un TptConfig
// déjà construit (jours depuis J0). Cf. SPEC_ALD_TPT §5.

import type { TptConfig } from "../../types/patrimoine";

export function defaultTpt(): TptConfig {
  return {
    actif: false,
    debutJour: 90,
    finJour: 365,
    pctTempsTravaille: 0.5,
    apresTpt: "guerison",
  };
}

// Validation de saisie (SPEC §5.6) : debutJour < finJour, debutJour ≥
// carence, pourcentage entre 20 % et 100 %. Renvoie le 1er message
// d'erreur, ou null si la configuration est valide.
export function tptInputError(
  debutJour: number,
  finJour: number,
  pctTempsTravaille: number,
  carenceJours: number
): string | null {
  if (!Number.isFinite(debutJour) || !Number.isFinite(finJour)) {
    return "Début et fin doivent être des nombres de jours valides.";
  }
  if (finJour <= debutJour) {
    return "La fin du mi-temps doit être postérieure à son début.";
  }
  if (debutJour < carenceJours) {
    return `Le mi-temps ne peut pas débuter avant la fin de la carence (${carenceJours} j).`;
  }
  if (pctTempsTravaille < 0.2 || pctTempsTravaille > 1) {
    return "Le temps travaillé doit être compris entre 20 % et 100 %.";
  }
  return null;
}
