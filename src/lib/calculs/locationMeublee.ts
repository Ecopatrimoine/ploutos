// ─── Location meublee (LMNP/LMP) — moteur pur BIC ───────────────────────────
//
// Fonctions PURES : elles prennent des nombres/primitives et renvoient des
// objets, sans lire Property ni data (le branchement dans computeIR est fait
// ailleurs, avec les defauts conservateurs). Aucun import depuis ir.ts : le
// module est en amont dans le graphe (ir.ts importe ce module, pas l'inverse).
//
// Sources (millesime, articles CGI, BOFiP) : src/data/location-meublee.json.

import ref from "../../data/location-meublee.json";

export type SousTypeMeuble = "longue_duree" | "tourisme_classe" | "tourisme_non_classe";
export type RegimeMeuble = "micro" | "reel";

// ── Micro-BIC (art. 50-0 CGI) ───────────────────────────────────────────────
// longue_duree + tourisme_classe + chambres d'hotes -> regime residuel (seuil
// 83600, abattement 50 %). tourisme_non_classe -> seuil 15000, abattement 30 %.
// abattement = max(recettes * taux, 305) borne a hauteur des recettes.
// eligible = recettes <= seuil du sous-type (comparaison <=, art. 50-0).
export function computeMicroBicMeuble(recettes: number, sousType: SousTypeMeuble) {
  const cfg = sousType === "tourisme_non_classe" ? ref.microBic.tourismeNonClasse : ref.microBic.residuel;
  const r = Math.max(0, recettes);
  const abattement = Math.min(Math.max(r * cfg.abattement, ref.microBic.plancherAbattement), r);
  const base = Math.max(0, r - abattement);
  const eligible = recettes <= cfg.seuil;
  return { eligible, abattement, base };
}

// ── Regime reel ─────────────────────────────────────────────────────────────
// Art. 39 C CGI : l'amortissement deductible ne peut creer ni aggraver un
// deficit -> amortDeductible = min(dotation, max(recettes - charges, 0)).
// Art. 156 I-1 ter CGI : un deficit BIC non professionnel ne remonte JAMAIS au
// revenu global -> baseFoyer = max(resultat, 0). Le deficit reportable et
// l'amortissement reporte (ard) sont exposes pour affichage SEUL.
export function computeReelMeuble(recettes: number, charges: number, dotationAmort: number) {
  const dot = Math.max(0, dotationAmort);
  const baseAvantAmort = Math.max(0, recettes - charges);
  const amortDeductible = Math.min(dot, baseAvantAmort);
  const resultat = recettes - charges - amortDeductible;
  const baseFoyer = Math.max(0, resultat);
  const deficitReportable = Math.max(0, -resultat);
  const ard = dot - amortDeductible; // amortissement reporte (art. 39 C)
  return { resultat, amortDeductible, ard, baseFoyer, deficitReportable };
}

// ── Amortissement par composants (auto, overrides optionnels) ────────────────
// Repartit le prix hors terrain sur la grille du referentiel (part / duree par
// composant), plus le mobilier amorti lineairement sur dureeMobilier. Renvoie
// le detail par composant et les totaux immobilier / mobilier / total.
//
// overrides (Lot 1bis, modal Detail) : ajustement PARTIEL par composant (part
// et/ou duree). part en FRACTION comme la grille, duree en annees entieres.
// Champ absent => valeur du referentiel. Parametre optionnel : appel sans
// overrides = comportement historique strict (retrocompat totale). La somme des
// parts (sommeParts) est exposee pour la garde UI (doit valoir 1,00) ; le moteur
// ne normalise PAS : il calcule chaque dotation = baseBati * part / duree.
export type AmortComposantOverride = { part?: number; duree?: number };
export type AmortOverrides = Partial<Record<string, AmortComposantOverride>>;

export function amortissementAuto(prixBien: number, partTerrain: number, valeurMobilier: number, overrides?: AmortOverrides) {
  const partTerrainBornee = Math.min(1, Math.max(0, partTerrain));
  const baseBati = Math.max(0, prixBien) * (1 - partTerrainBornee);
  const detail = ref.amortissement.grille.map((c) => {
    const ov = overrides?.[c.composant];
    const part = ov?.part != null ? Math.max(0, ov.part) : c.part;
    const duree = ov?.duree != null ? Math.max(1, Math.floor(ov.duree)) : c.duree;
    const ajuste = (ov?.part != null && ov.part !== c.part) || (ov?.duree != null && ov.duree !== c.duree);
    return {
      composant: c.composant,
      part, duree, partDefaut: c.part, dureeDefaut: c.duree, ajuste,
      dotation: duree > 0 ? (baseBati * part) / duree : 0,
    };
  });
  const immobilier = detail.reduce((s, d) => s + d.dotation, 0);
  const mobilier = ref.amortissement.dureeMobilier > 0
    ? Math.max(0, valeurMobilier) / ref.amortissement.dureeMobilier
    : 0;
  const sommeParts = detail.reduce((s, d) => s + d.part, 0);
  return { detail, immobilier, mobilier, total: immobilier + mobilier, sommeParts, baseBati };
}

// ── Detection LMP (art. 155 IV-2 CGI) ───────────────────────────────────────
// Double condition STRICTE : recettes meublees du foyer > 23000 EUR ET
// superieures aux autres revenus d'activite du foyer (comparaison a l'excedent,
// > strict aux deux bornes). Le calcul de revenusActiviteFoyer est fait par un
// helper de collecte cote ir.ts (collecteRevenusActiviteFoyer), au plus pres
// des resolveurs de revenus existants.
export function detectLmp(recettesMeubleesFoyer: number, revenusActiviteFoyer: number): boolean {
  return recettesMeubleesFoyer > ref.lmp.seuilRecettes && recettesMeubleesFoyer > revenusActiviteFoyer;
}
