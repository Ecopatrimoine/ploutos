// LOT 10c (addendum A4) — échelle de temps COMPRESSÉE par paliers pour la frise.
// Les premières semaines/mois d'un arrêt portent l'essentiel de l'information mais
// sont écrasées sur un axe linéaire (0→retraite ≈ 7300 j). On applique une échelle
// linéaire PAR MORCEAUX : chaque segment de jours contribue à la coordonnée
// compressée avec un rapport fixe décroissant. Fonction PURE et testée.
import type { ProjectionResult, SerieEmpilee } from "../prevoyance/types";
import { formatDureeArret } from "../calculs/utils";

// Segments { jusqu'à finJour : rapport }. Constantes nommées, ajustables sans code.
export const SEGMENTS_ECHELLE_TEMPS: { finJour: number; rapport: number }[] = [
  { finJour: 14, rapport: 1 },        // 0 → 14 j : plein détail
  { finJour: 30, rapport: 0.5 },      // 14 j → 1 mois
  { finJour: 180, rapport: 0.1 },     // 1 → 6 mois
  { finJour: 1095, rapport: 0.01 },   // 6 mois → 3 ans
  { finJour: Number.POSITIVE_INFINITY, rapport: 0.002 }, // au-delà (invalidité → retraite)
];

// jour → coordonnée compressée (monotone croissante, compress(0) = 0).
export function compress(jour: number): number {
  const j = Math.max(0, jour);
  let x = 0;
  let start = 0;
  for (const seg of SEGMENTS_ECHELLE_TEMPS) {
    if (j <= start) break;
    x += (Math.min(j, seg.finJour) - start) * seg.rapport;
    if (j <= seg.finJour) break;
    start = seg.finJour;
  }
  return x;
}

// Les 9 étages de la frise : leurs changements = les vrais points de rupture.
const SERIE_KEYS: (keyof SerieEmpilee)[] = [
  "salaire", "maintienEmployeur", "ijObligatoire", "ijComplementaireCollective",
  "ijComplementaireIndividuelle", "pensionInvalObligatoire", "renteInvalCollective",
  "renteInvalIndividuelle", "renteInvalEnfants",
];

// L'unité « année » de la frise = 365 j (projection.ts : bascule 1095 = 3×365,
// finProjection = (ageRetraite−age)×365). Le « mois » d'étiquetage = 30 j (paliers
// 30/60/90/120/180). Autres jours (547, 912, J91…) restent en « J{n} ».
const AN_JOURS = 365;

// C2 (correctif 2) — libellé EXACT, jamais arrondi :
//   < 61 j → « J47 » · multiple exact de 365 → « 1 an » · multiple exact de 30 →
//   « 3 mois » · sinon « J105 ». La conversion complète va au tooltip.
export function labelExact(jour: number): string {
  if (jour <= 0) return "J0";
  if (jour < 61) return `J${jour}`;
  if (jour % AN_JOURS === 0) { const n = jour / AN_JOURS; return n === 1 ? "1 an" : `${n} ans`; }
  if (jour % 30 === 0) return `${jour / 30} mois`;
  return `J${jour}`;
}

// Double lecture pour le tooltip : « J547 · 18 mois ».
export function labelTooltipTemps(jour: number): string {
  const court = labelExact(jour);
  const long = formatDureeArret(jour);
  return court === long || jour < 61 ? `J${jour} · ${long}` : `${court} · J${jour}`;
}

export type NiveauTick = 1 | 2;
export type TickTemps = { jour: number; x: number; label: string; niveau: NiveauTick; ligne: 0 | 1 };

const GAP_STAGGER = 0.03; // < 3 % de la largeur -> alterner les libellés sur 2 lignes
const GAP_EFFACE_N2 = 0.04; // graduation de repère effacée à < 4 % d'un jalon niveau 1

// Jalons de l'axe :
//   NIVEAU 1 — CHAQUE rupture de la frise (tout étage, tout payeur) + retraite, LIBELLÉE
//     au jour exact. Aucune rupture muette. Anti-collision = décalage vertical (2 lignes),
//     jamais suppression.
//   NIVEAU 2 — graduations de repère (1 mois·6 mois·2 ans ; 5·10·15 ans en vue retraite),
//     discrètes, effacées près d'un jalon niveau 1.
export function buildTicksTemps(projection: ProjectionResult, maxJour: number): TickTemps[] {
  const { axe, series } = projection;
  const retraite = projection.finProjectionJour || 0;
  const r = (v: number) => Math.round(v);
  const maxX = compress(maxJour) || 1;

  // Niveau 1 : tout jour d'axe où AU MOINS un étage change de valeur, + la retraite.
  const l1Jours = new Set<number>();
  for (let i = 1; i < axe.length; i++) {
    if (axe[i].jour > maxJour) break;
    if (SERIE_KEYS.some((k) => r(series[k][i]) !== r(series[k][i - 1]))) l1Jours.add(axe[i].jour);
  }
  if (retraite > 0 && retraite <= maxJour) l1Jours.add(retraite);

  const niveau1: TickTemps[] = [...l1Jours].sort((a, b) => a - b)
    .map((j) => ({ jour: j, x: compress(j), label: labelExact(j), niveau: 1 as const, ligne: 0 as 0 | 1 }));
  // Anti-collision : alterne la ligne quand deux ticks sont trop proches (garde les deux).
  let lastX = -Infinity;
  let ligne: 0 | 1 = 0;
  for (const t of niveau1) {
    ligne = t.x - lastX < maxX * GAP_STAGGER ? (ligne === 0 ? 1 : 0) : 0;
    t.ligne = ligne;
    lastX = t.x;
  }

  // Niveau 2 : repères fixes selon la vue, effacés près d'un jalon niveau 1.
  const reperes = maxJour <= 1200 ? [30, 180, 730] : [1825, 3650, 5475];
  const niveau2: TickTemps[] = reperes
    .filter((j) => j > 0 && j <= maxJour)
    .filter((j) => !niveau1.some((t) => Math.abs(compress(j) - t.x) < maxX * GAP_EFFACE_N2))
    // Repères = graduations sémantiques -> libellé durée (« 1 mois »), pas « J30 ».
    .map((j) => ({ jour: j, x: compress(j), label: formatDureeArret(j), niveau: 2 as const, ligne: 0 as 0 | 1 }));

  return [...niveau1, ...niveau2].sort((a, b) => a.x - b.x);
}
