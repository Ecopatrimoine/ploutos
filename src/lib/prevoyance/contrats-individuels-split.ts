// ─── Util pur — partition / recomposition de contratsIndividuels (Lot A1) ────
//
// data.prevoyance.{p}.contratsIndividuels est UN SEUL tableau
// PayloadContratIndividuel[]. Le module Prévoyance (Lot A) l'édite depuis
// PLUSIEURS vues distinctes : bloc « Incapacité et invalidité » (ij + invalidité)
// et sous-bloc « Rentes de survivants » (deces_rente_*). Cet util range les
// contrats en 3 catégories et recompose le tableau complet après édition d'UNE
// seule catégorie, SANS perte, SANS doublon, dans un ordre STABLE et prévisible.
//
// Fonctions PURES et déterministes : aucune dépendance UI, aucun calcul métier,
// aucune mutation des entrées.

import type { PayloadContratIndividuel } from "../../types/patrimoine";

export type CategorieContratIndividuel = "incapacite" | "survivants" | "legacy";

// Ordre de catégories FIXE servant à recomposer le tableau global (cf.
// mergeContratsIndividuels). Toute recomposition suit cet ordre.
const ORDRE_CATEGORIES: readonly CategorieContratIndividuel[] = [
  "incapacite",
  "survivants",
  "legacy",
] as const;

// Catégorise un type de contrat individuel.
//   "ij" | "invalidite"                     -> "incapacite"
//   "deces_rente_conj" | "deces_rente_educ" -> "survivants"
//   tout le reste (ptia, dependance, gav, deces_capital, inconnu) -> "legacy"
// Paramètre `type: string` (et non l'union créable) pour TOLÉRER les valeurs
// HISTORIQUES retirées de l'union (ex. "deces_capital") et toute valeur inconnue
// chargée du stockage → rangées en "legacy" plutôt que de lever.
export function categorieDeType(type: string): CategorieContratIndividuel {
  switch (type) {
    case "ij":
    case "invalidite":
      return "incapacite";
    case "deces_rente_conj":
    case "deces_rente_educ":
      return "survivants";
    default:
      return "legacy";
  }
}

export type ContratsIndividuelsParCategorie = {
  incapacite: PayloadContratIndividuel[];
  survivants: PayloadContratIndividuel[];
  legacy: PayloadContratIndividuel[];
};

// Partitionne un tableau de contrats en 3 catégories, en PRÉSERVANT l'ordre
// d'origine DANS chaque catégorie. Une catégorie sans contrat -> []. N'altère
// pas le tableau d'entrée (les objets contrat sont repris par référence).
export function splitContratsIndividuels(
  contrats: PayloadContratIndividuel[]
): ContratsIndividuelsParCategorie {
  const result: ContratsIndividuelsParCategorie = {
    incapacite: [],
    survivants: [],
    legacy: [],
  };
  for (const c of contrats ?? []) {
    result[categorieDeType(c.type)].push(c);
  }
  return result;
}

// Recompose le tableau global après édition d'UNE catégorie.
//
// RÈGLE D'ORDRE — ordre de catégories FIXE : incapacite -> survivants -> legacy.
// On part de split(tousActuels) ; on remplace UNIQUEMENT la catégorie `categorie`
// par `nouveauSousEnsemble` ; les 2 autres catégories conservent leur contenu
// actuel (ordre interne préservé) ; puis on concatène les 3 catégories dans
// l'ordre fixe ci-dessus.
//
// Conséquences :
//   - Sans perte ni doublon : chaque contrat des catégories non touchées est
//     repris une et une seule fois ; la catégorie touchée vaut exactement
//     `nouveauSousEnsemble`.
//   - Normalisation unique : merge réordonne le tableau selon l'ordre fixe. Sur
//     un `tousActuels` DÉJÀ trié par catégorie (incapacite, survivants, legacy),
//     merge(x, cat, split(x)[cat]) === x à l'identique (idempotent). Sur un x
//     entremêlé, merge le réordonne UNE fois ; un 2e merge est alors stable.
//   - Pur : ni `tousActuels` ni `nouveauSousEnsemble` ne sont mutés (nouveau
//     tableau retourné ; objets contrat partagés par référence).
export function mergeContratsIndividuels(
  tousActuels: PayloadContratIndividuel[],
  categorie: CategorieContratIndividuel,
  nouveauSousEnsemble: PayloadContratIndividuel[]
): PayloadContratIndividuel[] {
  const parCategorie = splitContratsIndividuels(tousActuels);
  parCategorie[categorie] = nouveauSousEnsemble;
  return ORDRE_CATEGORIES.flatMap((cat) => parCategorie[cat]);
}
