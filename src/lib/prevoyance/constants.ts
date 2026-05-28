// ─── Constantes module Prévoyance ──────────────────────────────────────

import type { StatutPro } from "../../types/patrimoine";

// Coefficients brut → net APPROXIMATIFS par statut, pour estimer le
// revenu de référence mensuel d'un salarié / assimilé salarié quand
// le net imposable n'est pas saisi.
//
// ⚠️ Approximations indicatives (charges salariales moyennes). À
// affiner — cf. docs/ROADMAP_PREVOYANCE.md (idéalement un calcul réel
// par tranches de cotisations).
//
// Les TNS ne figurent PAS dans cette table : leur revenu de référence
// est le BÉNÉFICE professionnel (assiette IR : CA − charges), pas un
// brut affecté d'un coefficient. Cf. mapping.ts (buildEntreePerso).
export const COEF_BRUT_NET: Partial<Record<StatutPro, number>> = {
  salarie_non_cadre: 0.78,
  salarie_cadre: 0.75,
  fonctionnaire: 0.82,
  president_sas: 0.75, // assimilé salarié
  eurl_unique: 0.75,   // assimilé salarié
};

// Coefficient par défaut si statut salarié non répertorié.
const COEF_DEFAUT = 0.78;

export function coefBrutNet(statut: StatutPro | ""): number {
  return COEF_BRUT_NET[statut as StatutPro] ?? COEF_DEFAUT;
}

export const STATUTS_TNS: StatutPro[] = [
  "tns_liberal", "tns_commercant", "tns_artisan", "gerant_majoritaire",
];
export const STATUTS_SALARIE: StatutPro[] = [
  "salarie_non_cadre", "salarie_cadre", "president_sas", "eurl_unique", "fonctionnaire",
];

// Avertissement affiché (UI + PDF) quand le revenu de référence d'un
// micro-entrepreneur est calé sur le CA encaissé (cf. décision A).
export const WARNING_MICRO_TNS =
  "⚠ Micro-entreprise : la projection utilise votre chiffre d'affaires encaissé comme revenu de référence (et non le bénéfice après abattement forfaitaire), car l'abattement ne reflète pas vos charges réelles. Vérifiez que ce montant correspond bien à votre revenu d'activité réel avant de présenter la simulation.";
