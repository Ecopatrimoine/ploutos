// LOT 10c — couche de PRÉSENTATION prévoyance perso (ZÉRO moteur). Toutes les
// dérivations ci-dessous sont des RÉDUCTIONS sur la frise déjà calculée
// (ProjectionResult.axe + series), jamais un recalcul du modèle. Réconciliées à
// l'euro avec le graphe (mêmes séries). Testé sur fixtures de frise.
import type { ProjectionResult, SerieEmpilee, Constat, ConstatSeverite } from "../prevoyance/types";
import { formatDureeArret } from "../calculs/utils";
import { PAYEURS, type PayeurFamille } from "./payeurs";

// Les 9 étages qui composent la couverture totale à un instant donné.
const SERIE_KEYS: (keyof SerieEmpilee)[] = [
  "salaire", "maintienEmployeur", "ijObligatoire", "ijComplementaireCollective",
  "ijComplementaireIndividuelle", "pensionInvalObligatoire", "renteInvalCollective",
  "renteInvalIndividuelle", "renteInvalEnfants",
];

export const SEUILS_DEFAUT = { cible: 0.9, seuilCritique: 0.5 } as const;

// Seuils réglables par dossier (fractions 0-1). Défauts sûrs pour les dossiers
// existants (aucune migration). Source : data.prevoyance.{cibleCouverture,seuilCritique}.
export function resolveSeuilsPrevoyance(data: any): { cible: number; seuilCritique: number } {
  const p = data?.prevoyance ?? {};
  const cible = typeof p.cibleCouverture === "number" && p.cibleCouverture > 0 ? p.cibleCouverture : SEUILS_DEFAUT.cible;
  const seuilCritique = typeof p.seuilCritique === "number" && p.seuilCritique > 0 ? p.seuilCritique : SEUILS_DEFAUT.seuilCritique;
  return { cible, seuilCritique };
}

// Couverture totale (tous payeurs) à l'index i de l'axe — même somme que le graphe
// et TableauJalons.totalAtIdx (source de vérité de la « couverture »).
export function couvertureAtIdx(series: SerieEmpilee, i: number): number {
  let t = 0;
  for (const k of SERIE_KEYS) t += series[k][i] || 0;
  return t;
}

// Libellé RDV d'un jalon (jour depuis J0). Miroir de TableauJalons.libelleJour.
export function libelleJalon(jour: number): string {
  if (jour === 0) return "J0 (début arrêt)";
  if (jour < 30) return `J${jour}`;
  if (jour < 365) return `${Math.round(jour / 30)} mois`;
  if (jour === 1095) return "3 ans (invalidité)";
  return formatDureeArret(jour);
}

// Libellé « Nᵉ mois d'arrêt » pour la date critique (RDV lisible).
export function libelleMoisArret(jour: number): string {
  if (jour <= 0) return "dès le 1er jour";
  if (jour < 30) return `J${jour}`;
  if (jour >= 365) return formatDureeArret(jour); // « 3 ans », « 18 mois »
  const mois = Math.round(jour / 30);
  return mois <= 1 ? "1er mois d'arrêt" : `${mois}e mois d'arrêt`;
}

// ── Besoin de couverture minimum ────────────────────────────────────────────
// besoin = max(0, cible% × revenu réf − couverture au palier durable).
// Palier durable = couverture du dernier segment de la 1re année d'arrêt (le niveau
// sur lequel la personne « atterrit »). durableMois = mois où ce palier commence.
export type BesoinCouverture = {
  revenuRef: number;
  cible: number;            // fraction
  cibleMontant: number;     // cible × revenuRef
  couvertureDurable: number;
  couvertureDurablePct: number; // fraction
  besoin: number;           // €/mois, ≥ 0
  durableJour: number;      // jour de début du palier durable
  durableMois: number;      // mois correspondant
};

export function buildBesoinCouverture(projection: ProjectionResult, cible: number): BesoinCouverture {
  const { axe, series } = projection;
  const revenuRef = projection.revenuReferenceMensuel || 0;
  // Dernier point de l'axe dans la 1re année (jour ≤ 365).
  let durableIdx = 0;
  for (let i = 0; i < axe.length; i++) if (axe[i].jour <= 365) durableIdx = i;
  const durableValue = couvertureAtIdx(series, durableIdx);
  // Début du plateau contigu contenant durableIdx (là où la personne atterrit).
  let startIdx = durableIdx;
  const r = (x: number) => Math.round(x);
  while (startIdx > 0 && r(couvertureAtIdx(series, startIdx - 1)) === r(durableValue)) startIdx--;
  const durableJour = axe[startIdx]?.jour ?? 0;
  const cibleMontant = cible * revenuRef;
  const besoin = Math.max(0, cibleMontant - durableValue);
  return {
    revenuRef,
    cible,
    cibleMontant,
    couvertureDurable: durableValue,
    couvertureDurablePct: revenuRef > 0 ? durableValue / revenuRef : 0,
    besoin,
    durableJour,
    durableMois: Math.max(1, Math.round(durableJour / 30)),
  };
}

// ── Bornes d'un palier plat de la frise ─────────────────────────────────────
// Un palier = segment contigu où la couverture totale est constante (à l'euro).
// Sert à exprimer un constat « du Nᵉ au Mᵉ mois » plutôt qu'« à un point » (A3).
export function bornesPalier(projection: ProjectionResult, jour: number): { startJour: number; endJour: number; total: number } | null {
  const { axe, series } = projection;
  const idx = axe.findIndex((p) => p.jour === jour);
  if (idx < 0) return null;
  const r = (x: number) => Math.round(x);
  const total = couvertureAtIdx(series, idx);
  let start = idx;
  let end = idx;
  while (start > 0 && r(couvertureAtIdx(series, start - 1)) === r(total)) start--;
  while (end < axe.length - 1 && r(couvertureAtIdx(series, end + 1)) === r(total)) end++;
  return { startJour: axe[start].jour, endJour: axe[end].jour, total };
}

// ── Date critique ───────────────────────────────────────────────────────────
// Premier jalon (point d'axe) où la couverture totale passe SOUS le seuil critique.
export type DateCritique =
  | { statut: "jamais"; seuil: number }
  | { statut: "des_le_debut"; seuil: number; pct: number }
  | { statut: "retraite"; seuil: number; jour: number }
  | { statut: "critique"; seuil: number; jour: number; mois: number; date: string; pct: number; libelle: string };

export function buildDateCritique(projection: ProjectionResult, seuil: number): DateCritique {
  const { axe, series } = projection;
  const revenuRef = projection.revenuReferenceMensuel || 0;
  const bascule = projection.basculeInvaliditeJour || 0;
  if (revenuRef <= 0 || axe.length === 0) return { statut: "jamais", seuil };
  const pctAt = (i: number) => couvertureAtIdx(series, i) / revenuRef;
  // Premier FRANCHISSEMENT DESCENDANT : couverture < seuil alors qu'elle était ≥ seuil
  // au point précédent. La carence initiale (J0 souvent à 0 %) n'est PAS un
  // franchissement — c'est l'état de départ, pas une bascule sous le seuil.
  for (let i = 1; i < axe.length; i++) {
    if (pctAt(i) < seuil && pctAt(i - 1) >= seuil) {
      // A2 (addendum) : un franchissement APRÈS la bascule invalidité (J1095) survient
      // pendant la phase invalidité, où le plateau est plat jusqu'au passage retraite
      // (coupure de la pension d'invalidité à 62 ans, projection.ts). Cette chute-là est
      // l'événement RETRAITE, pas un trou de couverture de la vie active -> carte verte.
      if (axe[i].jour > bascule) return { statut: "retraite", seuil, jour: axe[i].jour };
      return {
        statut: "critique", seuil,
        jour: axe[i].jour, mois: Math.round(axe[i].jour / 30), date: axe[i].date,
        pct: pctAt(i), libelle: libelleMoisArret(axe[i].jour),
      };
    }
  }
  // Aucun franchissement descendant : soit toujours sous le seuil, soit jamais.
  const toujoursSous = axe.every((_, i) => pctAt(i) < seuil);
  if (toujoursSous) return { statut: "des_le_debut", seuil, pct: pctAt(0) };
  return { statut: "jamais", seuil };
}

// ── Tableau € : payeur × jalon ──────────────────────────────────────────────
// Lignes = payeurs (familles agrégées), colonnes = jalons, cellules = €/mois.
// MÊMES données que le graphe -> Σ cellules d'un jalon = couverture totale (testé).
const JALONS_TABLEAU = [0, 3, 7, 30, 90, 180, 365, 1095];

export type TableauEuroCol = { jour: number; label: string };
export type TableauEuroRow = { famille: PayeurFamille; label: string; color: string; cells: number[] };
export type TableauEuro = {
  cols: TableauEuroCol[];
  rows: TableauEuroRow[];   // payeurs présents (au moins une cellule > 0)
  totals: number[];         // total par jalon
  pcts: number[];           // % du revenu de référence par jalon
};

export function buildTableauEuro(projection: ProjectionResult): TableauEuro {
  const { axe, series } = projection;
  const ref = projection.revenuReferenceMensuel || 0;
  const idxByJalon = JALONS_TABLEAU
    .map((j) => ({ jour: j, idx: axe.findIndex((p) => p.jour === j) }))
    .filter((x) => x.idx >= 0);
  const cols: TableauEuroCol[] = idxByJalon.map((x) => ({ jour: x.jour, label: libelleJalon(x.jour) }));
  const rowsAll: TableauEuroRow[] = PAYEURS.map((p) => ({
    famille: p.famille,
    label: p.label,
    color: p.color,
    cells: idxByJalon.map((x) => Math.round(p.etages.reduce((s, k) => s + (series[k][x.idx] || 0), 0))),
  }));
  const rows = rowsAll.filter((r) => r.cells.some((c) => c > 0));
  const totals = idxByJalon.map((x) => Math.round(couvertureAtIdx(series, x.idx)));
  const pcts = totals.map((t) => (ref > 0 ? Math.round((t / ref) * 100) : 0));
  return { cols, rows, totals, pcts };
}

// ── Vigilance (constats compressés) ─────────────────────────────────────────
const ORDRE_SEVERITE: Record<ConstatSeverite, number> = { non_conformite: 0, alerte: 1, attention: 2, info: 3 };

export type VigilanceRow = {
  id: string;
  severite: ConstatSeverite;
  axe: Constat["axe"];
  titre: string;
  montant?: number;
  montantLibelle?: string;
};

// Toutes les vigilances, triées par sévérité décroissante (une ligne par constat).
export function buildVigilance(constats: Constat[]): VigilanceRow[] {
  return [...constats]
    .sort((a, b) => ORDRE_SEVERITE[a.severite] - ORDRE_SEVERITE[b.severite])
    .map((c) => ({
      id: c.id,
      severite: c.severite,
      axe: c.axe,
      titre: c.titre,
      montant: c.impactChiffre?.montant,
      montantLibelle: c.impactChiffre?.libelle,
    }));
}

// Acte 1 « Points de vigilance » = pires risques : sévérité ≥ alerte, PLUS TOUJOURS
// les constats d'invalidité (le pire risque reste visible quel que soit le scénario).
export function pireRisques(rows: VigilanceRow[]): VigilanceRow[] {
  return rows.filter((r) => r.severite === "non_conformite" || r.severite === "alerte" || r.axe === "invalidite");
}
