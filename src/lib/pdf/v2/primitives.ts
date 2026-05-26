// ─── Lot 9 — Primitives PDF v2 (charte refonte) ──────────────────────────
//
// Fonctions pures qui prennent des tokens + des données et retournent du HTML.
// Aucune couleur en dur : tout est piloté par les tokens (cf. tokens.ts).
//
// Reproduit fidèlement les éléments visuels des maquettes
// revue-preview/pdf/refonte_pdf_*.html — c'est la source de vérité visuelle.

import { FONTS_HTML_LINKS, type Tokens } from "./tokens";

// ─── CSS commun (classes utilitaires partagées) ──────────────────────────
// Reproduit les classes .ser/.lt/.eb/.sct/.kpi/.klbl/.kval/.foot/.th/.td
// de la maquette IFI. À paramétrer par les tokens via styles inline pour
// les couleurs ; ici seulement les propriétés non-couleur (typo, layout).
export function cssCommun(t: Tokens): string {
  return `
  @page { size: A4; margin: 0; }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#fff;}
  body{font-family:'Lato',system-ui,sans-serif;color:${t.texte};}
  .ser{font-family:'Fraunces',Georgia,serif;}
  .lt{font-family:'Lato',system-ui,sans-serif;}
  .eb{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${t.eyebrowOr};}
  .sct{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${t.sectionGrisBleu};border-left:3px solid ${t.or};padding-left:9px;}
  .kpi{border-radius:9px;padding:11px 9px;display:flex;flex-direction:column;}
  .klbl{font-family:'Lato',sans-serif;font-size:9px;letter-spacing:.04em;text-transform:uppercase;min-height:24px;line-height:1.25;}
  .kval{font-family:'Lato',sans-serif;font-weight:700;font-size:15px;margin-top:5px;line-height:1;}
  .foot{font-family:'Lato',sans-serif;font-size:9.5px;color:${t.texteFaibleClair};margin-top:6px;line-height:1.4;}
  .th{font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:${t.thOr};padding:7px 8px;font-weight:700;}
  .td{font-family:'Lato',sans-serif;font-size:10px;color:${t.texte};padding:8px 8px;}
  `.trim();
}

// ─── SVG inline pour les icônes (pas de dépendance Tabler/CDN) ──────────
export const icones = {
  circleCheck: (color: string, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`,
};

// ─── Helpers de formatage ────────────────────────────────────────────────
export function euro(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n.replace(/\s/g, "").replace(",", ".")) : (n || 0);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
}

// ─── header : eyebrow doré + titre Fraunces + colonne droite + filet or ─
export function header(t: Tokens, opts: {
  eyebrow: string;
  titre: string;
  droiteHaut?: string;    // ex: nom du client
  droiteBas?: string;     // ex: date
}): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div class="eb">${opts.eyebrow}</div>
        <div class="ser" style="font-size:21px;font-weight:600;color:${t.navy};margin-top:5px">${opts.titre}</div>
      </div>
      <div class="lt" style="font-size:11px;color:${t.texteFaible};text-align:right">${opts.droiteHaut || ""}${opts.droiteBas ? `<br>${opts.droiteBas}` : ""}</div>
    </div>
    <div style="height:2px;background:${t.or};margin-top:12px;opacity:.9"></div>
  `;
}

// ─── bandeKPI : grille de N KPI (1 navy + N-1 cernés possibles) ─────────
export type KpiItem = {
  label: string;
  value: string;
  /** "main" = fond navy/or pâle ; "normal" = cerné texte navy ; "success" = cerné texte vert */
  type?: "main" | "normal" | "success";
};

export type BandeKpiOpts = {
  /** "compact" (par défaut, page IFI) ou "large" (page IR : padding + font + grille pondérée). */
  taille?: "compact" | "large";
  /** Surcharge grid-template-columns. Par défaut : repeat(N, 1fr) en compact,
   *  ou "1.25fr 1fr 1fr ..." en large (KPI principal plus large). */
  template?: string;
};

export function bandeKPI(t: Tokens, kpis: KpiItem[], opts: BandeKpiOpts = {}): string {
  const taille = opts.taille || "compact";
  const isLarge = taille === "large";
  const padding = isLarge ? "12px 13px" : "11px 9px";
  const labelSize = isLarge ? "10px" : "9px";
  const valueSize = isLarge ? "20px" : "15px";
  const template = opts.template
    || (isLarge ? `1.25fr ${"1fr ".repeat(kpis.length - 1).trim()}` : `repeat(${kpis.length},1fr)`);
  const renderKpi = (k: KpiItem) => {
    if (k.type === "main") {
      return `<div style="background:${t.navy};border-radius:9px;padding:${padding};display:flex;flex-direction:column">
        <div class="lt" style="font-size:${labelSize};color:${t.kpiOrPale}cc;letter-spacing:.04em;text-transform:uppercase;min-height:24px;line-height:1.25">${k.label}</div>
        <div class="lt" style="font-weight:700;font-size:${valueSize};color:${t.kpiOrPale};margin-top:5px;line-height:1">${k.value}</div>
      </div>`;
    }
    const valColor = k.type === "success" ? t.succes : t.navy;
    return `<div style="border:0.5px solid ${t.bordureMoyenne};border-radius:9px;padding:${padding};display:flex;flex-direction:column">
      <div class="lt" style="font-size:${labelSize};color:${t.texteFaible};letter-spacing:.04em;text-transform:uppercase;min-height:24px;line-height:1.25">${k.label}</div>
      <div class="lt" style="font-weight:700;font-size:${valueSize};color:${valColor};margin-top:5px;line-height:1">${k.value}</div>
    </div>`;
  };
  return `<div style="display:grid;grid-template-columns:${template};gap:${isLarge ? "9px" : "8px"};margin-top:18px">
    ${kpis.map(renderKpi).join("")}
  </div>`;
}

// ─── barreRepartition : barre multi-segments + légende à puces ──────────
// Reproduit le bloc « Revenus par nature » de la maquette IR.
// Le 1er segment affiche son % à l'intérieur (texte or pâle sur navy).
export type SegmentRepartition = {
  /** Libellé court affiché dans la légende. */
  label: string;
  /** Valeur (formatée, ex: "74 000 €"). */
  value: string;
  /** Pourcentage du total (0–100). */
  pct: number;
  /** Couleur du segment (hex ou token). */
  couleur: string;
};

export function barreRepartition(t: Tokens, segments: SegmentRepartition[]): string {
  // Trie pour garantir l'ordre attendu : 1er = dominant (affiche le %).
  const dominant = segments[0];
  const renderSeg = (s: SegmentRepartition, i: number) => {
    if (i === 0 && s.pct >= 12) {
      // 1er segment dominant : on inscrit le % à l'intérieur en or pâle
      return `<div style="width:${s.pct}%;background:${s.couleur};display:flex;align-items:center;justify-content:center">
        <span class="lt" style="font-size:10px;color:${t.kpiOrPale};font-weight:700">${s.pct} %</span>
      </div>`;
    }
    return `<div style="width:${s.pct}%;background:${s.couleur}"></div>`;
  };
  const renderLeg = (s: SegmentRepartition) =>
    `<div style="display:flex;align-items:center;gap:8px">
      <span style="width:9px;height:9px;border-radius:2px;flex:none;background:${s.couleur}"></span>
      <span class="lt" style="font-size:11.5px;color:${t.texte};flex:1">${s.label}</span>
      <span class="lt" style="font-weight:700;font-size:11.5px;color:${t.navy}">${s.value}</span>
    </div>`;
  void dominant;  // gardé pour clarté, utilisé via segments[0]
  return `
    <div style="display:flex;height:16px;border-radius:4px;overflow:hidden;margin-top:13px">
      ${segments.map(renderSeg).join("")}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;margin-top:13px">
      ${segments.map(renderLeg).join("")}
    </div>
  `;
}

// ─── cascadeRevenus : grille 3 colonnes (label / rail+fill / valeur) ────
// Reproduit le bloc « De vos revenus à l'impôt » de la maquette IR.
//   • revenu : fill navy 100%
//   • deduction : fill or pâle bordé or assombri, label brun gris
//   • netImposable : fill gris-bleu, valeur navy
//   • impot : fill or franc, valeur or assombri (eyebrowOr)
export type CascadeItem = {
  /** Libellé affiché en colonne gauche. */
  label: string;
  /** Largeur du fill (0–100 %). */
  pct: number;
  /** Valeur formatée (ex: "92 000 €" ou "− 9 200 €"). */
  valeur: string;
  /** Type → détermine les couleurs (label / fill / valeur). */
  type: "revenu" | "deduction" | "netImposable" | "impot";
};

export function cascadeRevenus(t: Tokens, items: CascadeItem[]): string {
  // Couleurs dérivées des tokens — fonctionne sur les 2 thèmes :
  const orDeductionFill = mixHex(t.or, "#FFFFFF", 0.30);   // or moyen pour les déductions
  const orDeductionBord = darkenHex(t.or, 0.20);
  const couleurFill = (it: CascadeItem): string => {
    switch (it.type) {
      case "revenu":       return t.navy;
      case "deduction":    return orDeductionFill;
      case "netImposable": return t.sectionGrisBleu;
      case "impot":        return t.or;
    }
  };
  const couleurValeur = (it: CascadeItem): string => {
    switch (it.type) {
      case "revenu":       return t.navy;
      case "deduction":    return t.texteFaible;
      case "netImposable": return t.navy;
      case "impot":        return t.eyebrowOr;
    }
  };
  const couleurLabel = (it: CascadeItem): string =>
    it.type === "deduction" ? t.texteFaible : t.texte;
  const styleFill = (it: CascadeItem): string => {
    const base = `width:${Math.min(100, Math.max(0, it.pct))}%;background:${couleurFill(it)}`;
    return it.type === "deduction" ? `${base};border:0.5px solid ${orDeductionBord}` : base;
  };
  const renderRow = (it: CascadeItem) => `
    <div class="lt" style="font-size:11.5px;color:${couleurLabel(it)}">${it.label}</div>
    <div style="background:${t.fondSeuilRail};border-radius:3px;height:13px;overflow:hidden">
      <div style="height:100%;border-radius:3px;${styleFill(it)}"></div>
    </div>
    <div class="lt" style="font-weight:700;font-size:11.5px;text-align:right;color:${couleurValeur(it)}">${it.valeur}</div>
  `;
  return `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:17px 20px;margin-top:12px">
      <div style="display:grid;grid-template-columns:152px 1fr 74px;align-items:center;column-gap:16px;row-gap:13px">
        ${items.map(renderRow).join("")}
      </div>
    </div>
  `;
}

// ─── Helpers couleur internes (réutilisés pour la cascade) ──────────────
// Dupliqués de tokens.ts pour éviter un export public ; à factoriser plus tard.
function hexToRgbLocal(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}
function rgbToHexLocal(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mixHex(c1: string, c2: string, ratio: number): string {
  const a = hexToRgbLocal(c1), b = hexToRgbLocal(c2);
  const k = Math.max(0, Math.min(1, ratio));
  return rgbToHexLocal(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k);
}
function darkenHex(c: string, ratio: number): string {
  return mixHex(c, "#000000", ratio);
}

// ─── sousTitreSection : barre verticale or + texte gris-bleu majuscules ─
export function sousTitreSection(_t: Tokens, label: string): string {
  return `<div class="sct">${label}</div>`;
}

// ─── barreRailFill : rail beige + fill navy + labels 0 / seuil ──────────
export function barreRailFill(t: Tokens, opts: {
  labelGauche: string;
  valeur: number;        // ex: assiette nette
  seuil: number;         // ex: seuil IFI 1 300 000 €
  noteSucces?: string;   // texte sous la barre si applicable (vert)
  noteAlerte?: string;   // texte sous la barre si dépassement (rouge/or)
}): string {
  const v = Number(opts.valeur) || 0;
  const s = Number(opts.seuil) || 1;
  const pct = Math.min(100, Math.max(0, (v / s) * 100));
  const note = opts.noteSucces
    ? `<div style="display:flex;align-items:center;gap:7px;margin-top:10px">
        ${icones.circleCheck(t.succes, 16)}
        <span class="lt" style="font-size:11px;color:${t.texte}">${opts.noteSucces}</span>
      </div>`
    : opts.noteAlerte
    ? `<div style="display:flex;align-items:center;gap:7px;margin-top:10px">
        <span style="color:${t.eyebrowOr};font-weight:700">⚠</span>
        <span class="lt" style="font-size:11px;color:${t.texte}">${opts.noteAlerte}</span>
      </div>`
    : "";
  return `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:16px 19px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="lt" style="font-size:12px;color:${t.texte}">${opts.labelGauche}</span>
        <span class="lt" style="font-weight:700;font-size:16px;color:${t.navy}">${euro(v)}</span>
      </div>
      <div style="position:relative;height:14px;background:${t.fondSeuilRail};border-radius:7px;margin-top:10px;overflow:hidden">
        <div style="width:${pct.toFixed(2)}%;height:100%;background:${t.navy};border-radius:7px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <span class="lt" style="font-size:9.5px;color:${t.texteFaibleClair}">0 €</span>
        <span class="lt" style="font-size:9.5px;color:${t.eyebrowOr};font-weight:700">seuil · ${euro(s)}</span>
      </div>
      ${note}
    </div>
  `;
}

// ─── tableauTitresDores : table + en-têtes dorés + alternance ───────────
export type Col = {
  label: string;
  align?: "left" | "right" | "center";
  width?: string;        // ex: "34%"
};
export type Cell = {
  value: string;
  align?: "left" | "right" | "center";
  color?: string;        // surcharge couleur (ex: vert pour abattement)
  bold?: boolean;
};

export function tableauTitresDores(t: Tokens, opts: {
  cols: Col[];
  rows: Cell[][];        // chaque ligne = tableau de Cell, dans l'ordre des cols
}): string {
  const renderTh = (c: Col) =>
    `<th class="th" style="text-align:${c.align || "left"};${c.width ? `width:${c.width}` : ""}">${c.label}</th>`;
  const renderTd = (cell: Cell, col: Col) => {
    const align = cell.align || col.align || "left";
    const color = cell.color ? `color:${cell.color};` : "";
    const weight = cell.bold ? "font-weight:700;" : "";
    return `<td class="td" style="text-align:${align};${color}${weight}">${cell.value}</td>`;
  };
  const renderRow = (row: Cell[], idx: number) =>
    `<tr${idx % 2 === 1 ? ` style="background:${t.fondTableauAlt}"` : ""}>${row.map((cell, i) => renderTd(cell, opts.cols[i])).join("")}</tr>`;
  return `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;overflow:hidden;margin-top:12px">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <thead><tr style="background:${t.fondTableau};border-bottom:1px solid ${t.bordureSeuilRail}">
          ${opts.cols.map(renderTh).join("")}
        </tr></thead>
        <tbody>
          ${opts.rows.map(renderRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ─── encartNotreLecture : fond beige + bordure or gauche + titre serif ──
export function encartNotreLecture(t: Tokens, opts: { titre: string; texte: string }): string {
  return `
    <div style="margin-top:20px;background:${t.fondEncart};border:0.5px solid ${t.bordureEncart};border-left:3px solid ${t.or};border-radius:8px;padding:15px 17px">
      <div class="ser" style="font-size:14px;color:${t.navy};margin-bottom:6px">${opts.titre}</div>
      <div class="lt" style="font-size:12.5px;color:${t.texte};line-height:1.6">${opts.texte}</div>
    </div>
  `;
}

// ─── encartMentionPortee : encart sobre (analogue au 8a-8e) ────────────
export function encartMentionPortee(t: Tokens, texte: string): string {
  return `
    <div style="margin-top:20px;font-size:9px;color:${t.eyebrowOr};line-height:1.5;background:${t.fondEncart};border-left:3px solid ${t.bordureEncart};padding:8px 12px;border-radius:4px">
      ${texte}
    </div>
  `;
}

// ─── piedPage : filet + 2 spans (gauche + droite) ──────────────────────
export function piedPage(t: Tokens, opts: { gauche: string; droite: string }): string {
  return `
    <div style="position:absolute;left:38px;right:38px;bottom:16px;border-top:1px solid ${t.bordureMoyenne};padding-top:8px;display:flex;justify-content:space-between">
      <span class="lt" style="font-size:10px;color:${t.texteFaibleClair}">${opts.gauche}</span>
      <span class="lt" style="font-size:10px;color:${t.texteFaibleClair}">${opts.droite}</span>
    </div>
  `;
}

// ─── coquillePage : structure A4 complète d'une page (avec padding standard
//                   + pied absolute). Le contenu vit dans le padding-top. ─
export function coquillePage(_t: Tokens, opts: { contenu: string; pied: string }): string {
  return `
    <div style="position:relative;width:210mm;height:297mm;overflow:hidden">
      <div style="padding:32px 38px 0">
        ${opts.contenu}
      </div>
      ${opts.pied}
    </div>
  `;
}

// ─── coquilleDocument : <!DOCTYPE html> + head (fonts + CSS commun) + body
export function coquilleDocument(t: Tokens, opts: {
  titre: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${opts.titre}</title>
${FONTS_HTML_LINKS}
<style>${cssCommun(t)}</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}
