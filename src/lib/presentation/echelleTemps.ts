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

// Les 3 étages du RÉGIME OBLIGATOIRE (socle) : leurs changements = les vrais jalons.
const ETAGES_OBLIGATOIRE: (keyof SerieEmpilee)[] = ["ijObligatoire", "pensionInvalObligatoire", "renteInvalEnfants"];
const obligAtIdx = (s: SerieEmpilee, i: number) => ETAGES_OBLIGATOIRE.reduce((t, k) => t + (s[k][i] || 0), 0);

// Ruptures des AUTRES étages (encoche mineure, sans libellé — détail au tooltip).
const RUPTURES_MINEURES = new Set(["fin_maintien_100", "fin_maintien_6666", "debut_tpt", "fin_tpt"]);

export type TickTemps = { jour: number; x: number; label: string; major: boolean };

// Libellé de tick : les petits jours (carence, relais) restent en « J{n} » — sinon
// formatDureeArret les écrase en « 0 mois » et la carence devient illisible (A4-bis).
function labelTick(jour: number): string {
  if (jour <= 0) return "J0";
  if (jour < 30) return `J${jour}`;
  return formatDureeArret(jour);
}

// Jalons de l'axe : MAJEURS (régime obligatoire : carence / changements de taux IJ /
// bascule invalidité / retraite) avec libellé ; MINEURS (autres ruptures) sans libellé.
// Anti-collision : deux ticks à moins de minGap (unités compressées, proxy ~28px) →
// on ne garde que le plus significatif ; priorité aux majeurs.
export function buildTicksTemps(projection: ProjectionResult, maxJour: number, minGap = 2.5): TickTemps[] {
  const { axe, series } = projection;
  const bascule = projection.basculeInvaliditeJour || 0;
  const retraite = projection.finProjectionJour || 0;

  // Jalons majeurs = jours où le socle obligatoire change de valeur, + bascule + retraite.
  const majorJours = new Set<number>();
  const r = (v: number) => Math.round(v);
  for (let i = 1; i < axe.length; i++) {
    if (axe[i].jour > maxJour) break;
    if (r(obligAtIdx(series, i)) !== r(obligAtIdx(series, i - 1))) majorJours.add(axe[i].jour);
  }
  if (bascule > 0 && bascule <= maxJour) majorJours.add(bascule);
  if (retraite > 0 && retraite <= maxJour) majorJours.add(retraite);

  const minorJours = new Set<number>();
  for (const rc of projection.rupturesCles) {
    if (rc.jour <= maxJour && RUPTURES_MINEURES.has(rc.type) && !majorJours.has(rc.jour)) minorJours.add(rc.jour);
  }

  // Assemble, trie par coordonnée compressée, applique l'anti-collision (majeurs prioritaires).
  const all: TickTemps[] = [
    ...[...majorJours].map((j) => ({ jour: j, x: compress(j), label: labelTick(j), major: true })),
    ...[...minorJours].map((j) => ({ jour: j, x: compress(j), label: "", major: false })),
  ].sort((a, b) => a.x - b.x);

  const kept: TickTemps[] = [];
  for (const t of all) {
    const last = kept[kept.length - 1];
    if (!last || t.x - last.x >= minGap) { kept.push(t); continue; }
    // Collision : un majeur évince un mineur déjà gardé ; sinon on ignore le nouveau.
    if (t.major && !last.major) kept[kept.length - 1] = t;
  }
  return kept;
}
