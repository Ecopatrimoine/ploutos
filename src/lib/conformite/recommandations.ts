// ─── Lot 7 — Modèle « recommandation / plan d'action » ─────────────────────
//
// Structure de données par dossier client, persistée dans le payload Supabase
// (clé `recommandations` du ClientPayload). Conçue comme PRÉREQUIS de la
// déclaration d'adéquation (Lot 8) qui en construira une matrice
// « besoin → réponse ». On NE construit PAS cette matrice ici.
//
// Conformité :
// - Chaque recommandation se rattache à une DIMENSION DU PROFIL (risque, ESG,
//   capacité de perte, besoin exprimé) — c'est la justification conformité.
// - On raisonne BESOIN / GARANTIE, JAMAIS de produit ni d'assureur nommé.
//   Aucun champ de produit dans le modèle pour empêcher toute dérive.

export type DimensionRecommandation =
  | "risque"        // tolérance au risque (issue des Q1–Q6 du questionnaire)
  | "esg"           // préférences en matière de durabilité (Q7 ESG)
  | "capacitePerte" // capacité financière à subir des pertes
  | "besoin";       // besoin client exprimé (santé, prévoyance, retraite, épargne…)

export type Recommandation = {
  /** Identifiant unique (crypto.randomUUID() côté UI). */
  id: string;
  /** Libellé court de la recommandation (raisonnée garantie/besoin, jamais produit). */
  libelle: string;
  /** Justification rattachée à la dimension — alimente la matrice du Lot 8. */
  justification: string;
  /** Dimension de profil sur laquelle s'appuie la justification. */
  dimension: DimensionRecommandation;
  /** Référence optionnelle vers une clé de besoin (mission.besoin*) — préparée
   *  pour la matrice « besoin → réponse » de la déclaration d'adéquation. */
  besoinKey?: string;
};

export const DIMENSIONS_LABEL: Record<DimensionRecommandation, string> = {
  risque:        "Tolérance au risque",
  esg:           "Préférences en matière de durabilité (ESG)",
  capacitePerte: "Capacité à subir des pertes",
  besoin:        "Besoin exprimé",
};

export const DIMENSIONS_ORDER: ReadonlyArray<DimensionRecommandation> =
  ["besoin", "risque", "esg", "capacitePerte"];

/**
 * Lot 8c — table partagée des libellés humains des 14 besoins du
 * formulaire mission (mission.besoinSante/Prev/Retraite/Epargne_*). Permet
 * d'afficher « Lié au besoin : Prévoyance — Arrêt de travail / invalidité »
 * dans la fiche DDA (8c) puis dans la matrice besoin↔réponse (8d).
 * Centralisée ici pour rester source unique.
 */
export const BESOIN_LIBELLES: Record<string, string> = {
  // Santé
  besoinSante_depenses: "Santé — Dépenses non remboursées",
  besoinSante_hospit:   "Santé — Hospitalisation",
  besoinSante_depasse:  "Santé — Dépassements d'honoraires",
  besoinSante_surcompl: "Santé — Sur-complémentaire",
  // Prévoyance
  besoinPrev_arret:    "Prévoyance — Arrêt de travail / invalidité",
  besoinPrev_deces:    "Prévoyance — Décès",
  besoinPrev_fraisGen: "Prévoyance — Frais généraux pro",
  // Retraite
  besoinRetraite_capital:    "Retraite — Capital retraite",
  besoinRetraite_rente:      "Retraite — Rente complémentaire",
  besoinRetraite_moderniser: "Retraite — Optimiser l'épargne retraite existante",
  // Épargne & investissement
  besoinEpargne_valoriser:   "Épargne — Valoriser un capital",
  besoinEpargne_transmettre: "Épargne — Préparer la transmission",
  besoinEpargne_completer:   "Épargne — Compléter les revenus",
  besoinEpargne_projet:      "Épargne — Financer un projet",
};

/** Libellé humain d'un besoin (besoinKey) ou la clé brute si inconnue. */
export function besoinLabel(key: string | null | undefined): string {
  if (!key) return "";
  return BESOIN_LIBELLES[key] || key;
}

/**
 * Vrai si la recommandation est complète (libellé et justification non vides).
 * Les recos incomplètes ne sont pas rendues dans le PDF (filtrage en amont).
 */
export function isRecommandationComplete(r: Recommandation | null | undefined): boolean {
  if (!r) return false;
  return typeof r.libelle === "string" && r.libelle.trim().length > 0
      && typeof r.justification === "string" && r.justification.trim().length > 0;
}

/**
 * Regroupe les recommandations par dimension dans l'ordre DIMENSIONS_ORDER.
 * Les recos sans dimension valide sont ignorées. Réservé à la matrice Lot 8 et
 * au rendu PDF section par section.
 */
export function groupRecommandationsByDimension(
  recos: ReadonlyArray<Recommandation>,
): Record<DimensionRecommandation, Recommandation[]> {
  const out: Record<DimensionRecommandation, Recommandation[]> = {
    risque: [], esg: [], capacitePerte: [], besoin: [],
  };
  for (const r of recos || []) {
    if (r && r.dimension && Object.prototype.hasOwnProperty.call(out, r.dimension)) {
      out[r.dimension].push(r);
    }
  }
  return out;
}

/** Liste des recos complètes uniquement, dans leur ordre d'origine. */
export function filterComplete(recos: ReadonlyArray<Recommandation>): Recommandation[] {
  return (recos || []).filter(isRecommandationComplete);
}
