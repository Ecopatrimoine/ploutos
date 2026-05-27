// ─── Contexte d'évaluation des règles (Lot 6) ───────────────────────────
//
// Fonction pure qui assemble, à partir du payload Ploutos et d'un
// ProjectionResult, les données dont les règles ont besoin pour
// produire des constats : dettes immobilières, présence d'enfants
// mineurs, conjoint à charge.
//
// Conventions de mapping (vérifiées dans le code existant) :
//   - dettesImmobilieres : somme des capitaux restants dus de TOUS les
//     crédits associés aux biens. Priorité aux multi-crédits
//     (properties[].loans[].capitalRemaining résolu via
//     resolveOneLoan) ; fallback sur l'ancien champ
//     properties[].loanCapitalRemaining si pas de loans[].
//   - enfantsMineurs : data.childrenData filtré sur âge < 18 ans ET
//     rattaché au foyer fiscal.
//   - conjointACharge : couple (marié/pacs/cohab) ET P2 sans revenu
//     professionnel significatif (salary2 + pensions2 + revenuTNS_P2
//     strictement à zéro).

import type { PatrimonialData } from "../../types/patrimoine";
import type { ContexteRegle, EntreePerso, ProjectionResult } from "./types";
import { getAgeFromBirthDate, n } from "../calculs/utils";
import { resolveOneLoan } from "../calculs/credit";

export function calcDettesImmobilieres(data: PatrimonialData): number {
  const properties = data.properties ?? [];
  let total = 0;
  for (const p of properties) {
    if (!p.loanEnabled) continue;
    if (Array.isArray(p.loans) && p.loans.length > 0) {
      for (const loan of p.loans) {
        const resolved = resolveOneLoan(loan);
        total += Math.max(0, resolved.capital);
      }
    } else {
      // legacy : un seul crédit, champs à plat sur la property
      const cap = n(p.loanCapitalRemaining);
      if (Number.isFinite(cap)) total += Math.max(0, cap);
    }
  }
  return total;
}

export function calcEnfantsMineurs(data: PatrimonialData): number {
  const children = data.childrenData ?? [];
  return children.filter((c) => {
    if (!c.rattached) return false;
    if (!c.birthDate) return false;
    const age = getAgeFromBirthDate(c.birthDate);
    return Number.isFinite(age) && age >= 0 && age < 18;
  }).length;
}

export function calcConjointACharge(data: PatrimonialData): boolean {
  const couple =
    data.coupleStatus === "married" ||
    data.coupleStatus === "pacs" ||
    data.coupleStatus === "cohab";
  if (!couple) return false;
  const salary2 = n(data.salary2);
  const pensions2 = n(data.pensions2 ?? "0");
  const tnsP2 = n(data.ca2);
  const baP2 = n(data.baRevenue2);
  // Conjoint à charge = P2 sans aucun revenu professionnel ou pension.
  return salary2 === 0 && pensions2 === 0 && tnsP2 === 0 && baP2 === 0;
}

export function buildContexteRegle(
  data: PatrimonialData,
  entree: EntreePerso,
  projection: ProjectionResult
): ContexteRegle {
  return {
    entree,
    projection,
    dettesImmobilieres: calcDettesImmobilieres(data),
    conjointACharge: calcConjointACharge(data),
    enfantsMineurs: calcEnfantsMineurs(data),
  };
}
