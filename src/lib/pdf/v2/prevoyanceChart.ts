// ─── Graphique de projection prévoyance en SVG inline (Lot 9) ──────────
//
// Le pipeline Pack PDF v2 génère du HTML string (pas de DOM React monté) :
// Recharts ne peut donc pas y tourner. On génère ici un SVG statique
// d'histogramme empilé à partir d'un ProjectionResult, sur le même
// principe que le bar chart SVG de pageHypos.
//
// Pour rester lisible à l'impression, les étages du moteur sont
// regroupés en catégories :
//   - Salaire d'activité (mi-temps thérapeutique / guérison ; sinon nul, masqué)  (vert)
//   - Maintien employeur            (navy)
//   - Régime obligatoire (IJ + pension invalidité)   (gris-bleu)
//   - Couverture collective (IJ + rente invalidité)  (or pâle)
//   - Couverture individuelle (IJ + rente invalidité) (or)
// + une ligne pointillée = revenu de référence.

import type { ProjectionResult } from "../../prevoyance/types";
import type { Tokens } from "./tokens";

// Jalons affichés (sous-ensemble lisible de l'axe complet).
const JALONS_SVG = [0, 7, 30, 90, 180, 365, 730, 1095];

function labelJour(jour: number): string {
  if (jour === 0) return "J0";
  if (jour < 30) return `J${jour}`;
  if (jour < 365) return `${Math.round(jour / 30)}m`;
  if (jour === 1095) return "Inval.";
  return `${(jour / 365).toFixed(0)}a`;
}

type Cat = { salaire: number; maintien: number; obligatoire: number; collective: number; individuelle: number };

function categoriesAtIdx(s: ProjectionResult["series"], i: number): Cat {
  return {
    salaire: s.salaire[i],
    maintien: s.maintienEmployeur[i],
    obligatoire: s.ijObligatoire[i] + s.pensionInvalObligatoire[i],
    collective: s.ijComplementaireCollective[i] + s.renteInvalCollective[i],
    individuelle: s.ijComplementaireIndividuelle[i] + s.renteInvalIndividuelle[i],
  };
}

function totalCat(c: Cat): number {
  return c.salaire + c.maintien + c.obligatoire + c.collective + c.individuelle;
}

function euroCompact(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(".0", "")}k`;
  return `${Math.round(v)}`;
}

export function renderProjectionSVG(projection: ProjectionResult, t: Tokens): string {
  // Sélection des points présents dans l'axe.
  const points = JALONS_SVG
    .map((j) => {
      // Pour la phase invalidité (1095), prend le point ≥ 1095.
      const idx =
        j === 1095
          ? projection.axe.findIndex((p) => p.jour >= 1095)
          : projection.axe.findIndex((p) => p.jour === j);
      return idx >= 0 ? { jour: j, cat: categoriesAtIdx(projection.series, idx) } : null;
    })
    .filter(Boolean) as Array<{ jour: number; cat: Cat }>;

  const ref = projection.revenuReferenceMensuel;
  const hasSalaire = points.some((p) => p.cat.salaire > 0);
  const maxTotal = Math.max(ref, ...points.map((p) => totalCat(p.cat)), 1);

  // Géométrie SVG.
  const W = 720;
  const H = 280;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = points.length;
  const slot = innerW / n;
  const barW = Math.min(46, slot * 0.62);

  const couleurs = {
    salaire: "#4E8C6A",
    maintien: t.navy,
    obligatoire: t.sectionGrisBleu,
    collective: t.kpiOrPale,
    individuelle: t.or,
  };

  const yOf = (val: number) => padT + innerH - (val / maxTotal) * innerH;

  // Barres empilées.
  const barres = points
    .map((p, i) => {
      const cx = padL + slot * i + slot / 2;
      const x = cx - barW / 2;
      let yCursor = padT + innerH;
      const segs: string[] = [];
      const ordre: Array<keyof Cat> = ["salaire", "maintien", "obligatoire", "collective", "individuelle"];
      for (const key of ordre) {
        const val = p.cat[key];
        if (val <= 0) continue;
        const h = (val / maxTotal) * innerH;
        yCursor -= h;
        segs.push(
          `<rect x="${x.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${couleurs[key]}" />`
        );
      }
      const total = totalCat(p.cat);
      const labelTotal =
        total > 0
          ? `<text x="${cx.toFixed(1)}" y="${(yOf(total) - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="${t.texteFaible}" font-family="Lato,sans-serif">${euroCompact(total)}</text>`
          : "";
      const labelX = `<text x="${cx.toFixed(1)}" y="${(H - 14).toFixed(1)}" text-anchor="middle" font-size="9" fill="${t.texteFaible}" font-family="Lato,sans-serif">${labelJour(p.jour)}</text>`;
      return segs.join("") + labelTotal + labelX;
    })
    .join("");

  // Ligne de référence (revenu).
  const yRef = yOf(ref);
  const ligneRef = `
    <line x1="${padL}" y1="${yRef.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yRef.toFixed(1)}"
      stroke="${t.navy}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6" />
    <text x="${(W - padR).toFixed(1)}" y="${(yRef - 4).toFixed(1)}" text-anchor="end" font-size="9"
      fill="${t.navy}" font-family="Lato,sans-serif">Revenu de réf. ${euroCompact(ref)} €</text>
  `;

  // Axe Y léger : 0 et max.
  const axeY = `
    <text x="${(padL - 6).toFixed(1)}" y="${(padT + innerH).toFixed(1)}" text-anchor="end" font-size="8" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">0</text>
    <text x="${(padL - 6).toFixed(1)}" y="${(padT + 8).toFixed(1)}" text-anchor="end" font-size="8" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">${euroCompact(maxTotal)} €</text>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${(padT + innerH).toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />
    <line x1="${padL}" y1="${(padT + innerH).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />
  `;

  // Légende des 4 catégories.
  const legende = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-family:'Lato',sans-serif;font-size:9.5px;color:${t.texteFaible}">
      ${hasSalaire ? legendeItem(couleurs.salaire, "Salaire (activité)") : ""}
      ${legendeItem(couleurs.maintien, "Maintien employeur")}
      ${legendeItem(couleurs.obligatoire, "Régime obligatoire")}
      ${legendeItem(couleurs.collective, "Couverture collective")}
      ${legendeItem(couleurs.individuelle, "Couverture individuelle")}
    </div>
  `;

  return `
    <div style="margin-top:6px">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Projection des revenus de remplacement">
        ${axeY}
        ${barres}
        ${ligneRef}
      </svg>
      ${legende}
    </div>
  `;
}

function legendeItem(color: string, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block"></span>${label}</span>`;
}
