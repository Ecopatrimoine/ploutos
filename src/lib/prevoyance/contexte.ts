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

/**
 * Détermine si P2 est "à charge" de P1 au sens du conseil
 * patrimonial (besoin de protection en cas de décès de P1).
 *
 * RÈGLE : conjoint = personne en couple (marié/PACS/cohab) ET
 * dont les revenus propres sont inférieurs à 50 % de ceux de P1.
 *
 * ⚠️ CHOIX DE MODÉLISATION PATRIMONIALE (EcoPatrimoine), PAS une
 * définition légale. Aucune définition réglementaire de « conjoint
 * à charge » ne correspond à la dépendance économique en cas de
 * décès : la notion Sécurité sociale a disparu avec la PUMa (2016,
 * tout majeur affilié à titre personnel), et les définitions
 * fiscales / mutuelle visent d'autres usages (rattachement au foyer,
 * remboursement de frais de santé). Le seul seuil chiffré officiel
 * (revenus < 10 % PASS) concerne les ENFANTS, pas les conjoints.
 * Ce seuil de 50 % traduit l'idée qu'un conjoint disposant de moins
 * de la moitié des revenus de l'autre ne pourrait pas maintenir son
 * niveau de vie sans lui. NON OPPOSABLE, à dire d'expert.
 *
 * REVENUS PRIS EN COMPTE : salaire + pensions + CA TNS +
 * revenus fonciers/agricoles. Revenus financiers passifs
 * (placements) volontairement exclus — ils restent disponibles
 * pour P2 après décès, ils n'ont pas à entrer dans le calcul.
 *
 * LIMITES CONNUES : seuil unique, pas de modulation selon nombre
 * d'enfants ni selon le coût de la vie locale. À affiner si
 * besoin pratique remonté (cf. docs/ROADMAP_PREVOYANCE.md).
 */
export function calcConjointACharge(data: PatrimonialData): boolean {
  const couple =
    data.coupleStatus === "married" ||
    data.coupleStatus === "pacs" ||
    data.coupleStatus === "cohab";
  if (!couple) return false;
  const revenuP1 = calcRevenuMensuel(data, "p1");
  const revenuP2 = calcRevenuMensuel(data, "p2");
  if (revenuP1 <= 0) return false; // pas de référence pour comparer
  return revenuP2 < 0.5 * revenuP1;
}

// Calcule le revenu mensuel d'une personne pour le test "conjoint
// à charge" : salaire + pensions + CA TNS + revenus agricoles,
// divisé par 12. Les revenus financiers passifs (placements) sont
// volontairement exclus — ils restent disponibles après décès.
export function calcRevenuMensuel(
  data: PatrimonialData,
  which: "p1" | "p2"
): number {
  const salary = which === "p1" ? data.salary1 : data.salary2;
  const pensions =
    which === "p1" ? (data.pensions1 ?? data.pensions ?? "0") : (data.pensions2 ?? "0");
  const ca = which === "p1" ? data.ca1 : data.ca2;
  const ba = which === "p1" ? data.baRevenue1 : data.baRevenue2;
  const total = n(salary) + n(pensions) + n(ca) + n(ba);
  return total / 12;
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
    revenuP1Mensuel: calcRevenuMensuel(data, "p1"),
    revenuP2Mensuel: calcRevenuMensuel(data, "p2"),
  };
}
