// ─── Graphe générique « barème par tranche » en SVG inline (PDF) ───────────
//
// PUR AFFICHAGE : prend un FilledBracket[] DÉJÀ calculé par le moteur fiscal
// (computeTaxFromBrackets) — aucun calcul, aucun barème en dur ici. Rend un
// histogramme, une barre par tranche :
//   - hauteur de barre = assiette logée dans la tranche (`filled`), échelle sur
//     le plus grand `filled` ;
//   - tranche à filled=0 = trait fin au pied (visible, pas trompeur) ;
//   - label au-dessus = impôt de la tranche (`tax`) via euro() ; rien si tax=0 ;
//   - tranche active (la DERNIÈRE à filled>0) mise en avant (teinte navy +
//     contour or) ;
//   - sous chaque barre : le taux (`label`) + la borne (from–to en M€).
//
// Recharts ne tourne pas dans le pipeline string → SVG fait main (même patron
// que prevoyanceChart.ts / le bar chart de pageHypos). Couleurs via Tokens
// UNIQUEMENT. Signature générique (FilledBracket[]) → réutilisable IFI et IR.

import type { FilledBracket } from "../../../types/patrimoine";
import type { Tokens } from "./tokens";
import { euro } from "./primitives";

// Borne en millions d'euros, format FR compact (« ≤ 0,8 M », « 1,3–2,57 M », « ≥ 10 M »).
function borneM(from: number, to: number): string {
  const m = (v: number) => {
    const x = v / 1_000_000;
    return (Number.isInteger(x) ? `${x}` : x.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")).replace(".", ",");
  };
  // La tranche « supérieure » du moteur arrive avec son `to` ramené à l'assiette
  // (computeTaxFromBrackets borne l'infini sur la base) → to ≤ from : on rend « ≥ from ».
  if (!Number.isFinite(to) || to <= from) return `≥ ${m(from)} M`;
  if (from === 0) return `≤ ${m(to)} M`;
  return `${m(from)}–${m(to)} M`;
}

export function renderBracketChartSVG(brackets: FilledBracket[], t: Tokens, opts: { hauteur?: number } = {}): string {
  const n = brackets.length;
  if (n === 0) return "";

  const W = 720;
  const H = opts.hauteur ?? 230;
  const padL = 20;
  const padR = 20;
  const padT = 24;   // place pour le label montant au-dessus des barres
  const padB = 46;   // place pour taux + borne (2 lignes) sous l'axe
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / n;
  const barW = Math.min(70, slot * 0.56);

  const maxFilled = Math.max(...brackets.map(b => b.filled), 1);
  // Tranche active = dernière tranche portant une assiette logée.
  let activeIdx = -1;
  brackets.forEach((b, i) => { if (b.filled > 0) activeIdx = i; });

  const yBase = padT + innerH;
  const yOf = (val: number) => yBase - (val / maxFilled) * innerH;

  const corps = brackets.map((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const x = cx - barW / 2;
    const isActive = i === activeIdx;
    const isEmpty = b.filled <= 0;

    let barre: string;
    if (isEmpty) {
      // Trait fin au pied : la tranche existe mais n'est pas atteinte (pas trompeur).
      barre = `<rect data-bar="empty" x="${x.toFixed(1)}" y="${(yBase - 2).toFixed(1)}" width="${barW.toFixed(1)}" height="2" fill="${t.bordureMoyenne}" />`;
    } else {
      const y = yOf(b.filled);
      const h = yBase - y;
      const remplissage = isActive ? t.navy : t.sectionGrisBleu;
      const contour = isActive ? ` stroke="${t.or}" stroke-width="1.5"` : "";
      barre = `<rect data-bar="filled" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${remplissage}"${contour} />`;
    }

    // Label montant (impôt de la tranche) — rien si tax=0.
    const labelMontant = b.tax > 0
      ? `<text data-bar-amount x="${cx.toFixed(1)}" y="${(yOf(b.filled) - 5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.navy}" font-family="Lato,sans-serif">${euro(b.tax)}</text>`
      : "";

    // Sous l'axe : taux (label moteur) + borne en M€.
    const labelTaux = `<text x="${cx.toFixed(1)}" y="${(yBase + 14).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${isActive ? t.navy : t.texteFaible}" font-family="Lato,sans-serif">${b.label}</text>`;
    const labelBorne = `<text x="${cx.toFixed(1)}" y="${(yBase + 26).toFixed(1)}" text-anchor="middle" font-size="8" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">${borneM(b.from, b.to)}</text>`;

    return barre + labelMontant + labelTaux + labelBorne;
  }).join("");

  const axe = `<line x1="${padL}" y1="${yBase.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />`;

  return `
    <div data-bracket-chart style="margin-top:12px;border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px 8px">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bareme par tranche : assiette logee et impot par tranche">
        ${axe}
        ${corps}
      </svg>
    </div>
  `;
}
