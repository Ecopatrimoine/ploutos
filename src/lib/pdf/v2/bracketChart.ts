// ─── Graphe générique « barème par tranche » en SVG inline (PDF) ───────────
//
// PUR AFFICHAGE : prend un FilledBracket[] DÉJÀ calculé par le moteur fiscal
// (computeTaxFromBrackets) — aucun calcul, aucun barème en dur ici. Rend un
// histogramme, une barre par tranche :
//   - hauteur de barre = assiette logée dans la tranche (`filled`), échelle sur
//     le plus grand `filled` ;
//   - COULEUR (C2) = palette CATÉGORIELLE or/bleu de l'écran (t.paletteBareme = CHART_COLORS,
//     BracketFillChart), cyclée par RANG de tranche i (jamais selon le remplissage) →
//     l'écran fait foi ; en N&B, les valeurs affichées (taux/impôt/borne) désambiguïsent
//     deux teintes voisines devenues proches en gris ;
//   - tranche à filled=0 = trait fin au pied, MÊME teinte catégorielle en opacité réduite
//     (visible, pas trompeur) ;
//   - label au-dessus = impôt de la tranche (`tax`) via euro() ; rien si tax=0 ;
//   - tranche active (la DERNIÈRE à filled>0) marquée par un CONTOUR or + un badge
//     chevron sous la colonne — JAMAIS par une couleur de fill différente : l'info
//     "active" reste non chromatique (daltonien-safe) ;
//   - sous chaque barre : le taux (`label`) + la borne (from–to) au format `formatBorne`
//     ("M" millions par défaut → IFI ; "euro" euros entiers → IR, bornes par part).
//
// Recharts ne tourne pas dans le pipeline string → SVG fait main (même patron
// que prevoyanceChart.ts / le bar chart de pageHypos). Couleurs via Tokens
// UNIQUEMENT (rampe incluse — aucun hex ici). Générique → réutilisable IFI et IR.

import type { FilledBracket } from "../../../types/patrimoine";
import { type Tokens } from "./tokens";
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

// Borne en euros entiers (séparateur de milliers via euro()) : « ≤ 28 797 € »,
// « 11 600 € – 29 579 € », « ≥ 181 917 € ». Pour l'IR, dont les bornes PAR PART sont en
// dizaines de milliers d'euros (et non en millions). Même garde-fou to ≤ from (tranche
// supérieure du moteur, `to` ramené à la base) → « ≥ from ».
function borneEuro(from: number, to: number): string {
  if (!Number.isFinite(to) || to <= from) return `≥ ${euro(from)}`;
  if (from === 0) return `≤ ${euro(to)}`;
  return `${euro(from)} – ${euro(to)}`;
}

export function renderBracketChartSVG(
  brackets: FilledBracket[],
  t: Tokens,
  // referenceValue : si fourni, la tranche active = celle qui CONTIENT cette valeur
  //   (ex. quotient IR → tranche marginale TMI) ; sinon = dernière tranche remplie (IFI).
  // badgeActif : texte du badge sur la tranche active (ex. "TMI") ; si absent → chevron (IFI).
  // formatBorne : format de la ligne de bornes sous chaque barre — "M" (millions, défaut, IFI)
  //   ou "euro" (euros entiers, IR : bornes par part en dizaines de k€).
  // annotation : bandeau optionnel au-dessus du graphe (ex. plafonnement QF actif) ;
  //   absent ⇒ rien émis (rendu byte-identique pour IFI et l'IR non plafonné).
  opts: { hauteur?: number; referenceValue?: number; badgeActif?: string; formatBorne?: "M" | "euro"; annotation?: string } = {},
): string {
  const n = brackets.length;
  if (n === 0) return "";

  const W = 720;
  const H = opts.hauteur ?? 230;
  const padL = 20;
  const padR = 20;
  const padT = 24;   // place pour le label montant au-dessus des barres
  // IR (formatBorne "euro") : +1 ligne « X € logés » + badge descendu ; IFI ("M") inchangé.
  const padB = opts.formatBorne === "euro" ? 58 : 46;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / n;
  const barW = Math.min(70, slot * 0.56);

  const maxFilled = Math.max(...brackets.map(b => b.filled), 1);
  // Tranche active : par référence (tranche contenant referenceValue, ex. quotient IR/TMI)
  // ou, à défaut, dernière tranche portant une assiette logée (IFI).
  let activeIdx = -1;
  if (opts.referenceValue !== undefined) {
    const rv = opts.referenceValue;
    const idx = brackets.findIndex(b => rv <= b.to);
    activeIdx = idx >= 0 ? idx : brackets.length - 1;
  } else {
    brackets.forEach((b, i) => { if (b.filled > 0) activeIdx = i; });
  }

  const yBase = padT + innerH;
  const yOf = (val: number) => yBase - (val / maxFilled) * innerH;

  const corps = brackets.map((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const x = cx - barW / 2;
    const isActive = i === activeIdx;
    const isEmpty = b.filled <= 0;

    // C2 — palette CATÉGORIELLE or/bleu de l'écran (t.paletteBareme = CHART_COLORS), cyclée
    // par RANG de tranche i (jamais selon le remplissage), comme BracketFillChart.
    const fill = t.paletteBareme[i % t.paletteBareme.length];
    const bordure = t.paletteBaremeBordure[i % t.paletteBaremeBordure.length];
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
      // Badge tranche active sous la colonne : cue de forme + position, redondant avec le
      // contour, indépendant de toute couleur de fill (daltonien-safe). Texte si badgeActif
      // fourni (ex. "TMI" pour l'IR), sinon chevron (IFI). data-active-badge dans les 2 cas.
      if (isActive) {
        const by = yBase + (opts.formatBorne === "euro" ? 44 : 31);
        if (opts.badgeActif) {
          const txt = opts.badgeActif;
          const w = txt.length * 5.4 + 12;
          badge = `<g data-active-badge>`
            + `<rect x="${(cx - w / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${w.toFixed(1)}" height="12" rx="6" fill="${t.or}" />`
            + `<text x="${cx.toFixed(1)}" y="${(by + 8.8).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${t.navy}" font-family="Lato,sans-serif">${txt}</text>`
            + `</g>`;
        } else {
          badge = `<path data-active-badge d="M ${(cx - 4).toFixed(1)} ${(by + 4).toFixed(1)} L ${cx.toFixed(1)} ${by.toFixed(1)} L ${(cx + 4).toFixed(1)} ${(by + 4).toFixed(1)} Z" fill="${t.or}" />`;
        }
      }
    }

    // Label montant (impôt de la tranche) — rien si tax=0. En IR, l'unité de sens
    // « d'impôt » est portée par l'étiquette elle-même (pas seulement la légende).
    const impotSuffix = opts.formatBorne === "euro" ? " d'impôt" : "";
    const labelMontant = b.tax > 0
      ? `<text data-bar-amount x="${cx.toFixed(1)}" y="${(yOf(b.filled) - 5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.navy}" font-family="Lato,sans-serif">${euro(b.tax)}${impotSuffix}</text>`
      : "";

    // Sous l'axe : taux (label moteur) + borne (en M€ par défaut, ou en euros si formatBorne="euro").
    const borneTxt = opts.formatBorne === "euro" ? borneEuro(b.from, b.to) : borneM(b.from, b.to);
    const labelTaux = `<text x="${cx.toFixed(1)}" y="${(yBase + 14).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${isActive ? t.navy : t.texteFaible}" font-family="Lato,sans-serif">${b.label}</text>`;
    const labelBorne = `<text x="${cx.toFixed(1)}" y="${(yBase + 26).toFixed(1)}" text-anchor="middle" font-size="8" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">${borneTxt}</text>`;
    // IR uniquement : assiette PAR PART logée dans la tranche, sous les bornes (rien si vide).
    const labelLoges = (opts.formatBorne === "euro" && b.filled > 0)
      ? `<text data-bar-loges x="${cx.toFixed(1)}" y="${(yBase + 37).toFixed(1)}" text-anchor="middle" font-size="8" fill="${t.texteFaibleClair}" font-family="Lato,sans-serif">${euro(b.filled)} logés</text>`
      : "";

    return barre + badge + labelMontant + labelTaux + labelBorne + labelLoges;
  }).join("");

  const axe = `<line x1="${padL}" y1="${yBase.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${t.bordureMoyenne}" stroke-width="0.5" />`;

  // Bandeau d'annotation (ex. « Plafonnement du quotient familial actif… ») — émis
  // UNIQUEMENT si fourni, sinon chaîne vide (sortie byte-identique à l'existant).
  const annotationHtml = opts.annotation
    ? `<div class="lt" data-chart-annotation style="font-size:9px;font-weight:700;color:${t.or};margin:0 0 8px 0;line-height:1.3">${opts.annotation}</div>`
    : "";

  return `
    <div data-bracket-chart style="margin-top:12px;border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px 8px">
      ${annotationHtml}<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bareme par tranche : assiette logee et impot par tranche">
        ${axe}
        ${corps}
      </svg>
    </div>
  `;
}
