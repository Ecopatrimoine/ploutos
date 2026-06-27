// ─── Graphe générique « barème par tranche » en SVG inline (PDF) ───────────
//
// PUR AFFICHAGE : prend un FilledBracket[] DÉJÀ calculé par le moteur fiscal
// (computeTaxFromBrackets) — aucun calcul, aucun barème en dur ici. Rend un
// histogramme, une barre par tranche :
//   - hauteur de barre = assiette logée dans la tranche (`filled`), échelle sur
//     le plus grand `filled` ;
//   - COULEUR = rampe de sévérité crème → rouge échantillonnée sur le RANG ABSOLU
//     de la tranche (t.rampeBareme[i/(n-1)]) → la dernière tranche est toujours le
//     rouge profond, que n=5 (IR) ou 6 (IFI), indépendamment du remplissage ;
//   - tranche à filled=0 = trait fin au pied, MÊME teinte de rampe en opacité réduite
//     (visible, pas trompeur) ;
//   - label au-dessus = impôt de la tranche (`tax`) via euro() ; rien si tax=0 ;
//   - tranche active (la DERNIÈRE à filled>0) marquée par un CONTOUR or + un badge
//     chevron sous la colonne — JAMAIS par une couleur de fill différente : l'info
//     "active" reste non chromatique (daltonien-safe) ;
//   - sous chaque barre : le taux (`label`) + la borne (from–to en M€).
//
// Recharts ne tourne pas dans le pipeline string → SVG fait main (même patron
// que prevoyanceChart.ts / le bar chart de pageHypos). Couleurs via Tokens
// UNIQUEMENT (rampe incluse — aucun hex ici). Générique → réutilisable IFI et IR.

import type { FilledBracket } from "../../../types/patrimoine";
import { echantillonnerRampe, type Tokens } from "./tokens";
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

    // Couleur de rampe au RANG ABSOLU i parmi n (jamais selon le remplissage).
    const fill = echantillonnerRampe(t.rampeBareme, i, n);
    const bordure = echantillonnerRampe(t.rampeBaremeBordure, i, n);
    const activeAttr = isActive ? ` data-bar-active="true"` : "";

    let barre: string;
    let badge = "";
    if (isEmpty) {
      // Tranche non atteinte : MÊME teinte de rampe, trait fin + opacité réduite (pas trompeur).
      barre = `<rect data-bar="empty" data-bar-index="${i}" data-bar-color="${fill}"${activeAttr} x="${x.toFixed(1)}" y="${(yBase - 3).toFixed(1)}" width="${barW.toFixed(1)}" height="3" rx="1.5" fill="${fill}" fill-opacity="0.4" />`;
    } else {
      const y = yOf(b.filled);
      const h = yBase - y;
      // Active : fill INCHANGÉ (= couleur de rampe), contour or + badge en plus.
      const stroke = isActive ? t.or : bordure;
      const strokeW = isActive ? 1.6 : 0.75;
      barre = `<rect data-bar="filled" data-bar-index="${i}" data-bar-color="${fill}"${activeAttr} x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />`;
      // Badge chevron or sous la colonne active : cue de forme + position, redondant
      // avec le contour, indépendant de toute couleur de fill (daltonien-safe).
      if (isActive) {
        const by = yBase + 31;
        badge = `<path data-active-badge d="M ${(cx - 4).toFixed(1)} ${(by + 4).toFixed(1)} L ${cx.toFixed(1)} ${by.toFixed(1)} L ${(cx + 4).toFixed(1)} ${(by + 4).toFixed(1)} Z" fill="${t.or}" />`;
      }
    }

    // Label montant (impôt de la tranche) — rien si tax=0.
    const labelMontant = b.tax > 0
      ? `<text data-bar-amount x="${cx.toFixed(1)}" y="${(yOf(b.filled) - 5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.navy}" font-family="Lato,sans-serif">${euro(b.tax)}</text>`
      : "";

    // Sous l'axe : taux (label moteur) + borne en M€.
    const labelTaux = `<text x="${cx.toFixed(1)}" y="${(yBase + 14).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${isActive ? t.navy : t.texteFaible}" font-family="Lato,sans-serif">${b.label}</text>`;
    const labelBorne = `<text x="${cx.toFixed(1)}" y="${(yBase + 26).toFixed(1)}" text-anchor="middle" font-size="8" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">${borneM(b.from, b.to)}</text>`;

    return barre + badge + labelMontant + labelTaux + labelBorne;
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
