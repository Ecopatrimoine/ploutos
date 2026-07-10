// ─── Graphique de projection prévoyance en SVG inline (LOT 11 — cohérence écran↔PDF) ──
//
// Le pipeline Pack PDF v2 génère du HTML string (pas de DOM React monté) :
// Recharts ne peut pas y tourner. On reproduit donc EN SVG STATIQUE le MÊME graphe que
// l'écran (ProjectionChart) : une AIRE EMPILÉE EN ESCALIER (stepAfter), pas un histogramme.
//
//   - couches = cumuls des 9 étages ETAGES (lib/presentation/payeurs), ordre écran,
//   - x = compress(jour) (lib/presentation/echelleTemps) sur la largeur utile,
//   - marches stepAfter : palier horizontal jusqu'au jour suivant puis marche verticale,
//   - couleurs = PAYEUR_COLORS (collective bleu-gris / individuelle terracotta — séparation
//     color-blind safe qui fait foi), opacité par étage (comme l'écran),
//   - ticks = buildTicksTemps (fonction de PRODUCTION, réutilisée telle quelle), avec
//     anti-collision RECALIBRÉE en POINTS sur la largeur réelle du chart PDF,
//   - ligne de revenu de référence conservée.
//
// Zéro moteur, zéro réimplémentation locale : tout vient des libs de présentation.

import type { ProjectionResult } from "../../prevoyance/types";
import { ETAGES, PAYEURS, PAYEUR_COLORS, couleurEtage } from "../../presentation/payeurs";
import { compress, axeTemps } from "../../presentation/echelleTemps";
import type { Tokens } from "./tokens";

// ─── Géométrie, en POINTS (pt) ──────────────────────────────────────────────
// Le chart s'imprime sur la largeur utile du corps A4 : 210 mm − 2 × 38 px de padding
// (.pdf-contrat, cf. engine/contrat.ts) ≈ 538 pt. On règle le viewBox à cette largeur en pt
// → 1 unité SVG = 1 pt une fois rendu à width:100%. L'anti-collision des ticks s'exprime
// alors DIRECTEMENT en pt (SEUIL_TICK_PT), sans passer par les % relatifs de l'écran.
const W = 538;
const H = 210;
const PAD_L = 34;   // colonne des libellés d'axe Y (« 3,5 k€ »)
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 34;   // deux lignes de ticks possibles
const INNER_W = W - PAD_L - PAD_R; // 492
const INNER_H = H - PAD_T - PAD_B; // 164

// Deux ticks niveau 1 distants de moins de ce seuil (en pt) → on alterne leur libellé sur
// deux lignes (jamais de suppression). Calibré pour un libellé court (« J47 », « 3 ans »).
const SEUIL_TICK_PT = 26;
const DECALAGE_LIGNE_PT = 11;

// La page PDF est statique : on rend la MÊME fenêtre que la vue écran par défaut
// (arrêt 0 → bascule invalidité, 3 ans). Constante unique consommée partout ci-dessous
// pour que la fenêtre du rendu et celle de la liste de preuve ne divergent jamais.
const VUE_COMPLETE_PDF = false;

export type PointGeom = { x: number; y: number };

// ── Géométrie PURE d'une couche en escalier ─────────────────────────────────
// Polygone fermé d'une aire empilée en marches stepAfter : la frontière HAUTE (topPx)
// parcourue de gauche à droite, puis la frontière BASSE (bottomPx) parcourue en sens
// inverse. stepAfter = la valeur du point i tient jusqu'à x[i+1] (palier horizontal),
// puis marche verticale. xs / topPx / bottomPx sont déjà en coordonnées SVG (pt), alignés.
export function stepAreaPoints(xs: number[], topPx: number[], bottomPx: number[]): PointGeom[] {
  const n = xs.length;
  const frontiere = (vals: number[]): PointGeom[] => {
    const pts: PointGeom[] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0) pts.push({ x: xs[i], y: vals[i - 1] }); // palier horizontal jusqu'à xs[i]
      pts.push({ x: xs[i], y: vals[i] });                 // marche verticale au point xs[i]
    }
    return pts;
  };
  return [...frontiere(topPx), ...frontiere(bottomPx).reverse()];
}

function pathD(pts: PointGeom[]): string {
  if (pts.length === 0) return "";
  return (
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ") + " Z"
  );
}

// ── Ticks positionnés en pt (fonction de PREUVE, testée) ────────────────────
export type TickPdf = { jour: number; label: string; niveau: 1 | 2; xPt: number; ligne: 0 | 1 };

// buildTicksTemps (via axeTemps) fournit jour · libellé · niveau · x compressé — RÉUTILISÉ
// tel quel. On ne recalcule ici QUE la position en pt et le décalage anti-collision, à la
// largeur réelle du chart PDF. C'est cette liste qui est collée dans le rapport (preuve).
export function ticksPdf(projection: ProjectionResult): TickPdf[] {
  const { maxX, ticks } = axeTemps(projection, VUE_COMPLETE_PDF);
  const denomX = maxX || 1;
  const positions: TickPdf[] = ticks.map((t) => ({
    jour: t.jour,
    label: t.label,
    niveau: t.niveau,
    xPt: PAD_L + (t.x / denomX) * INNER_W,
    ligne: 0,
  }));
  // Anti-collision en pt sur les seuls jalons niveau 1 (les ruptures libellées) : alterne la
  // ligne quand deux voisins sont trop proches, en gardant TOUJOURS les deux.
  let lastX = -Infinity;
  let ligne: 0 | 1 = 0;
  for (const p of positions) {
    if (p.niveau !== 1) continue;
    ligne = p.xPt - lastX < SEUIL_TICK_PT ? (ligne === 0 ? 1 : 0) : 0;
    p.ligne = ligne;
    lastX = p.xPt;
  }
  return positions;
}

// ── Formats ─────────────────────────────────────────────────────────────────
export function euroCompactFr(v: number): string {
  if (v >= 1000) {
    const oneDec = (Math.round((v / 1000) * 10) / 10).toFixed(1); // "3.0" | "3.5"
    const s = oneDec.endsWith(".0") ? oneDec.slice(0, -2) : oneDec.replace(".", ",");
    return `${s} k€`;
  }
  return `${Math.round(v)} €`;
}

function euroPleinFr(v: number): string {
  return `${Math.round(v).toLocaleString("fr-FR")} €`;
}

// PAYEUR_COLORS porte deux surcharges de thème via var(--cab-navy / --cab-gold). Le PDF n'a
// pas ces variables CSS : on résout la surcharge sur les tokens du thème (navy / or), en
// laissant intactes les couleurs fixes color-blind safe (collective #A9B8D4, individuelle
// #B5806B, maintien #5B7FB0, référence #888780). La table de couleurs reste l'unique source.
function resoudreCouleur(raw: string, t: Tokens): string {
  return raw
    .replace(/var\(--cab-navy,[^)]*\)/, t.navy)
    .replace(/var\(--cab-gold,[^)]*\)/, t.or);
}

function totalEtages(series: ProjectionResult["series"], i: number): number {
  let s = 0;
  for (const e of ETAGES) s += series[e.serieKey][i] || 0;
  return s;
}

export function renderProjectionSVG(projection: ProjectionResult, t: Tokens): string {
  const series = projection.series;
  const ref = projection.revenuReferenceMensuel;

  // Fenêtre = vue 3 ans (MÊME axeTemps que l'écran et que ticksPdf).
  const { maxJour, maxX } = axeTemps(projection, VUE_COMPLETE_PDF);
  const denomX = maxX || 1;
  const idx: number[] = [];
  for (let i = 0; i < projection.axe.length; i++) if (projection.axe[i].jour <= maxJour) idx.push(i);

  const xs = idx.map((i) => PAD_L + (compress(projection.axe[i].jour) / denomX) * INNER_W);
  const maxTotal = Math.max(ref, ...idx.map((i) => totalEtages(series, i)), 1);
  const yOf = (val: number) => PAD_T + INNER_H - (val / maxTotal) * INNER_H;

  // Couches empilées : cumul point-à-point dans l'ordre écran (bas → haut).
  const cumul = idx.map(() => 0);
  const couches: string[] = [];
  for (const e of ETAGES) {
    const bottom = cumul.slice();
    let maxVal = 0;
    idx.forEach((i, k) => {
      const v = series[e.serieKey][i] || 0;
      cumul[k] += v;
      if (cumul[k] - bottom[k] > maxVal) maxVal = cumul[k] - bottom[k];
    });
    if (maxVal <= 0) continue; // étage absent sur la fenêtre → pas de couche (salaire, rente enfants…)
    const topPx = cumul.map((v) => yOf(v));
    const bottomPx = bottom.map((v) => yOf(v));
    const pts = stepAreaPoints(xs, topPx, bottomPx);
    couches.push(
      `<path d="${pathD(pts)}" fill="${resoudreCouleur(couleurEtage(e), t)}" fill-opacity="${e.opacity}" stroke="none" />`
    );
  }

  // Ticks positionnés en pt + anti-collision recalibrée.
  const ticks = ticksPdf(projection);
  const baseYTick = PAD_T + INNER_H;
  const ticksSvg = ticks
    .map((tk) => {
      const niveau2 = tk.niveau === 2;
      const y = baseYTick + 12 + (tk.ligne === 1 ? DECALAGE_LIGNE_PT : 0);
      const couleur = niveau2 ? t.texteFaibleClair : t.texteFaible;
      const style = niveau2 ? ' font-style="italic"' : "";
      const size = niveau2 ? 7.5 : 8.5;
      const graduation =
        `<line x1="${tk.xPt.toFixed(1)}" y1="${(baseYTick).toFixed(1)}" x2="${tk.xPt.toFixed(1)}" y2="${(baseYTick + 3).toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />`;
      return (
        graduation +
        `<text x="${tk.xPt.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${size}"${style} fill="${couleur}" font-family="Lato,sans-serif">${tk.label}</text>`
      );
    })
    .join("");

  // Ligne de revenu de référence (conservée) — couleur neutre de la palette de présentation.
  const yRef = yOf(ref);
  const couleurRef = PAYEUR_COLORS.reference;
  const ligneRef = ref > 0
    ? `
    <line x1="${PAD_L}" y1="${yRef.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${yRef.toFixed(1)}"
      stroke="${couleurRef}" stroke-width="1" stroke-dasharray="4 3" />
    <text x="${(W - PAD_R).toFixed(1)}" y="${(yRef - 4).toFixed(1)}" text-anchor="end" font-size="8.5"
      fill="${couleurRef}" font-family="Lato,sans-serif">Revenu de réf. ${euroPleinFr(ref)}</text>`
    : "";

  // Axe Y léger : 0 et le maximum, + cadre bas/gauche.
  const axeY = `
    <text x="${(PAD_L - 5).toFixed(1)}" y="${(baseYTick).toFixed(1)}" text-anchor="end" font-size="7.5" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">0</text>
    <text x="${(PAD_L - 5).toFixed(1)}" y="${(PAD_T + 7).toFixed(1)}" text-anchor="end" font-size="7.5" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">${euroCompactFr(maxTotal)}</text>
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${baseYTick.toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />
    <line x1="${PAD_L}" y1="${baseYTick.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${baseYTick.toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />
  `;

  // Légende = libellés des PAYEURS (familles présentes sur la fenêtre), couleur pleine.
  const famillePresente = new Map<string, boolean>();
  for (const p of PAYEURS) {
    const present = p.etages.some((k) => idx.some((i) => (series[k][i] || 0) > 0));
    famillePresente.set(p.famille, present);
  }
  const legende = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-family:'Lato',sans-serif;font-size:9.5px;color:${t.texteFaible}">
      ${PAYEURS.filter((p) => famillePresente.get(p.famille)).map((p) => legendeItem(resoudreCouleur(p.color, t), p.label)).join("")}
    </div>
  `;

  return `
    <div style="margin-top:6px">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Projection des revenus de remplacement (aire empilée en escalier)">
        ${axeY}
        ${couches.join("")}
        ${ligneRef}
        ${ticksSvg}
      </svg>
      ${legende}
    </div>
  `;
}

function legendeItem(color: string, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block"></span>${label}</span>`;
}
