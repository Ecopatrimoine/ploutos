// ─── Lot 6 — Capacité à subir des pertes, dérivée du patrimoine ─────────────
//
// Distincte de la TOLÉRANCE au risque (questions d'attitude, qui produisent
// le profil prudent/équilibré/dynamique/offensif). Ici on regarde la
// SITUATION FINANCIÈRE : coussin liquide rapporté aux revenus mensuels, plus
// deux pénalités structurelles (endettement élevé, revenu unique du couple).
//
// 🔴 Tous les seuils sont CENTRALISÉS dans CAPACITE_PERTE_SEUILS — aucun
// numérique magique en ligne. Changer la politique du cabinet = changer une
// constante, jamais plonger dans le code.

import { isCashPlacement } from "../calculs/utils";
import type { PatrimonialData } from "../../types/patrimoine";

export type NiveauCapacitePerte = "faible" | "modérée" | "moyenne" | "élevée";

export const CAPACITE_PERTE_SEUILS = {
  /** Sous ce seuil de mois de revenu en cash → capacité faible. */
  ratioFaible:   6,
  /** Sous ce seuil → modérée. */
  ratioModerée: 12,
  /** Sous ce seuil → moyenne. Au-delà → élevée. */
  ratioMoyenne: 24,
  /** Endettement total / patrimoine total au-delà duquel on rétrograde d'un cran. */
  endettementMax: 0.40,
} as const;

const NIVEAUX_ORDONNES: NiveauCapacitePerte[] = ["faible", "modérée", "moyenne", "élevée"];

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function downgrade(niveau: NiveauCapacitePerte): NiveauCapacitePerte {
  const i = NIVEAUX_ORDONNES.indexOf(niveau);
  return NIVEAUX_ORDONNES[Math.max(0, i - 1)];
}

export type CapacitePerte = {
  niveau: NiveauCapacitePerte;
  /** Coussin liquide exprimé en mois de revenu agrégé. Borné à 999. */
  ratioMois: number;
  /** Endettement total / patrimoine total ∈ [0, 1+]. */
  endettementRatio: number;
  /** Lignes explicatives pour l'écran (chaque pénalité ajoute une ligne). */
  justification: string[];
};

export function computeCapacitePerte(data: PatrimonialData): CapacitePerte {
  // 1. Coussin liquide = somme des placements de type cash (livrets, fonds
  //    €, comptes courants…) — défini par isCashPlacement (lib/calculs/utils).
  const coussinLiquide = (data.placements || [])
    .filter(p => p && p.type && isCashPlacement(p.type))
    .reduce((s, p) => s + num(p.value), 0);

  // 2. Revenu annuel agrégé : salaires + pensions + BIC. On ne déduit pas
  //    chargesReelles* (périmètre fiscal BIC, pas train de vie du foyer).
  const revenuAnnuel =
    num(data.salary1) + num(data.salary2) +
    num(data.pensions) + num(data.pensions1) + num(data.pensions2) +
    num(data.ca1) + num(data.ca2);
  const revenuMensuel = revenuAnnuel / 12;

  // 3. Ratio coussin / revenu mensuel, borné pour les cas extrêmes.
  const ratioMois = revenuMensuel > 0
    ? Math.min(999, coussinLiquide / revenuMensuel)
    : (coussinLiquide > 0 ? 999 : 0);

  // 4. Endettement total = capital restant dû (loans + otherLoans + legacy
  //    loanAmount sur les biens sans multi-crédits).
  const endettementBiens = (data.properties || []).reduce((s, p) => {
    const fromLoans = Array.isArray(p?.loans)
      ? p.loans.reduce((ss: number, l: any) => ss + num(l?.capitalRemaining || l?.amount), 0)
      : 0;
    const legacy = num((p as any)?.loanCapitalRemaining || (p as any)?.loanAmount);
    return s + (fromLoans > 0 ? fromLoans : legacy);
  }, 0);
  const endettementAutres = (data.otherLoans || []).reduce((s: number, l: any) =>
    s + num(l?.capitalRemaining || l?.amount), 0);
  const endettementTotal = endettementBiens + endettementAutres;

  const patrimoineImmo      = (data.properties  || []).reduce((s, p) => s + num(p?.value), 0);
  const patrimoineFinancier = (data.placements  || []).reduce((s, p) => s + num(p?.value), 0);
  const patrimoineTotal     = patrimoineImmo + patrimoineFinancier;

  const endettementRatio = patrimoineTotal > 0 ? endettementTotal / patrimoineTotal : 0;

  // 5. Niveau de base d'après le coussin liquide.
  let niveau: NiveauCapacitePerte =
    ratioMois < CAPACITE_PERTE_SEUILS.ratioFaible   ? "faible"  :
    ratioMois < CAPACITE_PERTE_SEUILS.ratioModerée ? "modérée" :
    ratioMois < CAPACITE_PERTE_SEUILS.ratioMoyenne ? "moyenne" : "élevée";

  const justification: string[] = [
    `Coussin liquide ≈ ${Math.round(ratioMois)} mois de revenus`,
  ];

  // 6. Pénalité endettement > seuil → un cran de moins.
  if (endettementRatio > CAPACITE_PERTE_SEUILS.endettementMax) {
    justification.push(`Endettement élevé (${Math.round(endettementRatio * 100)} % du patrimoine total) — rétrogradation d'un cran`);
    niveau = downgrade(niveau);
  }

  // 7. Pénalité revenu unique : couple avec un seul revenu actif.
  const revenuP1 = num(data.salary1) + num(data.pensions1) + num(data.ca1);
  const revenuP2 = num(data.salary2) + num(data.pensions2) + num(data.ca2);
  const couple = !!(data.person2FirstName || data.person2LastName);
  if (couple && (revenuP1 === 0 || revenuP2 === 0) && (revenuP1 + revenuP2) > 0) {
    justification.push("Revenu unique du couple — rétrogradation d'un cran");
    niveau = downgrade(niveau);
  }

  return { niveau, ratioMois, endettementRatio, justification };
}
