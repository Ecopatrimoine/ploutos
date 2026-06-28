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
  * { font-variant-ligatures: none; }
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
  fileText: (color: string, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`,
  shieldCheck: (color: string, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
  infoCircle: (color: string, size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  check: (color: string, size = 12) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  alertTriangle: (color: string, size = 12) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  helpCircle: (color: string, size = 12) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  userShield: (color: string, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><circle cx="12" cy="10" r="2"></circle><path d="M8.5 16.5c1-2 6-2 7 0"></path></svg>`,
  // Bouclier + cœur (équivalent fonctionnel de Tabler shield-heart) — utilisé
  // pour les besoins de protection foyer dans la fiche conseil DDA.
  shieldHeart: (color: string, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M15.4 10.5a2.4 2.4 0 0 0-3.4-1.4 2.4 2.4 0 0 0-3.4 1.4 2.4 2.4 0 0 0 .6 2.7l2.8 2.8 2.8-2.8a2.4 2.4 0 0 0 .6-2.7z" fill="${color}"></path></svg>`,
  // Courbe d'activité (équivalent Tabler activity-heartbeat) — utilisé pour
  // les besoins de maintien de revenu (invalidité, arrêt de travail).
  activityHeartbeat: (color: string, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  // Calendrier avec euro (équivalent Tabler calendar-dollar adapté €) —
  // utilisé pour les besoins d'épargne / horizon moyen-long terme.
  calendarEuro: (color: string, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><text x="12" y="19" text-anchor="middle" font-size="10" stroke="none" fill="${color}" font-weight="700" font-family="'Lato',sans-serif">€</text></svg>`,
  // Trombone (équivalent Tabler paperclip) — utilisé pour les blocs de
  // documents joints (IPID, DIC, annexes).
  paperclip: (color: string, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex:none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path></svg>`,
};

// ─── Helpers de formatage ────────────────────────────────────────────────
export function euro(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n.replace(/\s/g, "").replace(",", ".")) : (n || 0);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
}

// ─── header : eyebrow doré + titre Fraunces + colonne droite + filet or ─
// Option sousTitre : petit texte gris entre le titre et le filet (ex:
// « Profession libérale · affiliation CIPAV » sur la page Prévoyance ind.).
export function header(t: Tokens, opts: {
  eyebrow: string;
  titre: string;
  sousTitre?: string;
  droiteHaut?: string;    // ex: nom du client
  droiteBas?: string;     // ex: date
}): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div class="eb">${opts.eyebrow}</div>
        <div class="ser" style="font-size:21px;font-weight:600;color:${t.navy};margin-top:5px">${opts.titre}</div>
        ${opts.sousTitre ? `<div class="lt" style="font-size:10.5px;color:${t.texteFaible};margin-top:4px">${opts.sousTitre}</div>` : ""}
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
  /** Surcharge la taille de la valeur (par défaut 15px compact / 20px large).
   *  Utile pour les libellés textuels longs (« Modérée », « Équilibré »…). */
  valueFontSize?: string;
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
    const vSize = k.valueFontSize || valueSize;
    if (k.type === "main") {
      return `<div style="background:${t.navy};border-radius:9px;padding:${padding};display:flex;flex-direction:column">
        <div class="lt" style="font-size:${labelSize};color:${t.kpiOrPale}cc;letter-spacing:.04em;text-transform:uppercase;min-height:24px;line-height:1.25">${k.label}</div>
        <div class="lt" style="font-weight:700;font-size:${vSize};color:${t.kpiOrPale};margin-top:5px;line-height:1">${k.value}</div>
      </div>`;
    }
    const valColor = k.type === "success" ? t.succes : t.navy;
    return `<div style="border:0.5px solid ${t.bordureMoyenne};border-radius:9px;padding:${padding};display:flex;flex-direction:column">
      <div class="lt" style="font-size:${labelSize};color:${t.texteFaible};letter-spacing:.04em;text-transform:uppercase;min-height:24px;line-height:1.25">${k.label}</div>
      <div class="lt" style="font-weight:700;font-size:${vSize};color:${valColor};margin-top:5px;line-height:1">${k.value}</div>
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

// ─── listeBarresBesoinCouverture : grille 3 col (label / barre besoin-vs-
//     couverture / déficit). Rail or pâle bordé, fill navy pour la part
//     couverte. Légende couverture/déficit en bas. Utilisé pour la page
//     Prévoyance individuelle.
export type LigneBesoinCouverture = {
  label: string;            // "Décès"
  besoinTexte: string;      // "besoin · 300 000 €"
  pctCouverture: number;    // 0-100 (largeur du fill navy)
  deficit: string;          // "− 185 000 €"
  deficitSuffixe?: string;  // ex: "/an" appendu après deficit (par défaut: rien)
};

export function listeBarresBesoinCouverture(t: Tokens, opts: {
  lignes: LigneBesoinCouverture[];
  labelCouverture?: string;   // par défaut "couverture actuelle"
  labelDeficit?: string;      // par défaut "déficit de protection"
}): string {
  // Couleurs du rail/déficit (or pâle bordé) — calibrées Encre & Or.
  // En thème cabinet : dérivées algorithmiquement pour rester cohérentes.
  const railBg = mixHex(t.or, "#FFFFFF", 0.62);   // or très pâle (rail)
  const railBd = mixHex(t.or, "#FFFFFF", 0.40);   // or moyen (bordure rail)
  const deficitColor = darkenHex(t.or, 0.25);
  const renderLigne = (l: LigneBesoinCouverture) => `
    <div>
      <div class="lt" style="font-size:11.5px;color:${t.texte};font-weight:700">${l.label}</div>
      <div class="lt" style="font-size:9px;color:${t.texteFaibleClair};margin-top:1px">${l.besoinTexte}</div>
    </div>
    <div style="height:16px;background:${railBg};border:0.5px solid ${railBd};border-radius:4px;overflow:hidden">
      <div style="width:${Math.min(100, Math.max(0, l.pctCouverture))}%;height:100%;background:${t.navy}"></div>
    </div>
    <div style="text-align:right">
      <span class="lt" style="font-size:12px;font-weight:700;color:${deficitColor}">${l.deficit}${l.deficitSuffixe || ""}</span>
      <div class="lt" style="font-size:9px;color:${t.texteFaibleClair};text-align:right;margin-top:1px">déficit</div>
    </div>
  `;
  const labelCouv = opts.labelCouverture || "couverture actuelle";
  const labelDef = opts.labelDeficit || "déficit de protection";
  return `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:16px 18px;margin-top:12px">
      <div style="display:grid;grid-template-columns:138px 1fr 104px;align-items:center;column-gap:13px;row-gap:14px">
        ${opts.lignes.map(renderLigne).join("")}
      </div>
      <div style="display:flex;gap:18px;margin-top:14px;padding-top:11px;border-top:1px solid ${t.bordureClaire}">
        <span class="lt" style="font-size:10px;color:${t.texteFaible}">
          <span style="width:11px;height:11px;border-radius:2px;display:inline-block;vertical-align:middle;background:${t.navy}"></span>
          ${labelCouv}
        </span>
        <span class="lt" style="font-size:10px;color:${t.texteFaible}">
          <span style="width:11px;height:11px;border-radius:2px;display:inline-block;vertical-align:middle;background:${railBg};border:0.5px solid ${railBd}"></span>
          ${labelDef}
        </span>
      </div>
    </div>
  `;
}

// ─── badge : pillule libellée (ex: « Dévolution légale ») ──────────────
// Fond beige clair, bordure or clair, texte navy.
export function badge(t: Tokens, label: string): string {
  return `<span class="lt" style="font-size:10px;font-weight:700;letter-spacing:.04em;color:${t.navy};background:${t.fondTableau};border:0.5px solid ${t.bordureSeuilRail};padding:3px 9px;border-radius:6px">${label}</span>`;
}

// ─── barreDevolution : 2 segments avec textes internes + 2 légendes ─────
// Cas réserve héréditaire / quotité disponible (page Succession A) — peut
// servir à d'autres cas de répartition 2-en-1 (ex: bilan endettement).
export type BarreDevolutionOpts = {
  badge?: string;          // ex: "Dévolution légale"
  description?: string;    // ex: "2 enfants · conjoint — option ¼ en pleine propriété"
  segmentGauche: {
    pct: number;
    couleur: string;
    texte: string;
    couleurTexte: string;
  };
  segmentDroite: {
    pct: number;
    couleur: string;
    texte: string;
    couleurTexte: string;
  };
  legendeGauche: {
    label: string;
    valeur: string;
    couleurValeur: string;
  };
  legendeDroite: {
    label: string;
    valeur: string;
    couleurValeur: string;
  };
};

export function barreDevolution(t: Tokens, opts: BarreDevolutionOpts): string {
  const enTete = (opts.badge || opts.description)
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${opts.badge ? badge(t, opts.badge) : ""}
        ${opts.description ? `<span class="lt" style="font-size:11.5px;color:${t.texte}">${opts.description}</span>` : ""}
      </div>`
    : "";
  return `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:13px 16px;margin-top:10px">
      ${enTete}
      <div style="display:flex;height:16px;border-radius:4px;overflow:hidden;margin-top:12px">
        <div style="width:${opts.segmentGauche.pct}%;background:${opts.segmentGauche.couleur};display:flex;align-items:center;justify-content:center">
          <span class="lt" style="font-size:10px;color:${opts.segmentGauche.couleurTexte};font-weight:700">${opts.segmentGauche.texte}</span>
        </div>
        <div style="width:${opts.segmentDroite.pct}%;background:${opts.segmentDroite.couleur};display:flex;align-items:center;justify-content:center">
          <span class="lt" style="font-size:10px;color:${opts.segmentDroite.couleurTexte};font-weight:700">${opts.segmentDroite.texte}</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span class="lt" style="font-size:10.5px;color:${t.texteFaible}">${opts.legendeGauche.label} : <strong style="color:${opts.legendeGauche.couleurValeur}">${opts.legendeGauche.valeur}</strong></span>
        <span class="lt" style="font-size:10.5px;color:${t.texteFaible}">${opts.legendeDroite.label} : <strong style="color:${opts.legendeDroite.couleurValeur}">${opts.legendeDroite.valeur}</strong></span>
      </div>
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
  /** Type → détermine les couleurs (label / fill / valeur).
   *  • revenu / actif principal : fill navy
   *  • deduction / crédit : fill or pâle bordé, label brun gris
   *  • netImposable / actif secondaire : fill gris-bleu
   *  • impot / actif tertiaire : fill or franc, valeur or assombri
   *  • total : fill navy 100 % + séparateur top (utilisé en dernière ligne) */
  type: "revenu" | "deduction" | "netImposable" | "impot" | "total";
  /** Surcharge la taille de la valeur (par défaut 11.5px). */
  valeurFontSize?: string;
};

export type CascadeRevenusOpts = {
  /** Largeur de la colonne gauche (label). Par défaut "152px". */
  largeurLabel?: string;
  /** Largeur de la colonne droite (valeur). Par défaut "74px". */
  largeurValeur?: string;
  /** Si vrai, pas d'encadré autour de la cascade (cas Bilan endettement). */
  sansEncadre?: boolean;
};

export function cascadeRevenus(t: Tokens, items: CascadeItem[], opts: CascadeRevenusOpts = {}): string {
  // Couleurs dérivées des tokens — fonctionne sur les 2 thèmes :
  const orDeductionFill = mixHex(t.or, "#FFFFFF", 0.30);   // or moyen pour les déductions
  const orDeductionBord = darkenHex(t.or, 0.20);
  const couleurFill = (it: CascadeItem): string => {
    switch (it.type) {
      case "revenu":       return t.navy;
      case "deduction":    return orDeductionFill;
      case "netImposable": return t.sectionGrisBleu;
      case "impot":        return t.or;
      case "total":        return t.navy;
    }
  };
  const couleurValeur = (it: CascadeItem): string => {
    switch (it.type) {
      case "revenu":       return t.navy;
      case "deduction":    return t.texteFaible;
      case "netImposable": return t.navy;
      case "impot":        return t.eyebrowOr;
      case "total":        return t.navy;
    }
  };
  const couleurLabel = (it: CascadeItem): string => {
    if (it.type === "deduction") return t.texteFaible;
    if (it.type === "total")     return t.navy;
    return t.texte;
  };
  const styleFill = (it: CascadeItem): string => {
    const base = `width:${Math.min(100, Math.max(0, it.pct))}%;background:${couleurFill(it)}`;
    return it.type === "deduction" ? `${base};border:0.5px solid ${orDeductionBord}` : base;
  };
  // Le type "total" ajoute un trait supérieur séparateur sur les 3 cellules.
  const wrapTotal = (it: CascadeItem, html: string): string => {
    if (it.type !== "total") return html;
    return `<div style="border-top:1px solid ${t.bordureMoyenne};padding-top:11px">${html}</div>`;
  };
  const renderRow = (it: CascadeItem) => {
    const fontWeight = it.type === "total" ? "font-weight:700;" : "";
    const valSize = it.valeurFontSize || "11.5px";
    return `
      ${wrapTotal(it, `<div class="lt" style="font-size:11.5px;color:${couleurLabel(it)};${fontWeight}">${it.label}</div>`)}
      ${wrapTotal(it, `<div style="background:${t.fondSeuilRail};border-radius:3px;height:13px;overflow:hidden"><div style="height:100%;border-radius:3px;${styleFill(it)}"></div></div>`)}
      ${wrapTotal(it, `<div class="lt" style="font-weight:700;font-size:${valSize};text-align:right;color:${couleurValeur(it)}">${it.valeur}</div>`)}
    `;
  };
  const largeurLabel = opts.largeurLabel || "152px";
  const largeurValeur = opts.largeurValeur || "74px";
  const grid = `<div style="display:grid;grid-template-columns:${largeurLabel} 1fr ${largeurValeur};align-items:center;column-gap:16px;row-gap:13px">
    ${items.map(renderRow).join("")}
  </div>`;
  if (opts.sansEncadre) {
    return `<div style="margin-top:13px">${grid}</div>`;
  }
  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:17px 20px;margin-top:12px">
    ${grid}
  </div>`;
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

// ─── sousTitreSection : barre verticale or + texte (2 styles disponibles)
//   • "majuscules" (par défaut) : Lato 11px maj. gris-bleu — pages thématiques
//   • "serif" : Fraunces 13.5px navy — documents réglementaires (lettre de
//     mission, DER, fiche DDA, déclaration d'adéquation)
export function sousTitreSection(t: Tokens, label: string, opts: { style?: "majuscules" | "serif" } = {}): string {
  if (opts.style === "serif") {
    return `<div style="font-family:'Fraunces',Georgia,serif;font-size:13.5px;font-weight:600;color:${t.navy};border-left:3px solid ${t.or};padding-left:9px;margin-bottom:8px">${label}</div>`;
  }
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

// ─── construireTableEcoulable : thead + lignes <tr> SÉPARÉS, pour les tables
//     ListeEcoulable du contrat (engine/contrat.ts). Helper PARTAGÉ qui factorise le
//     rendu .th/.td jadis dupliqué inline dans pageIFI (dette Phase 3).
//     tableauTitresDores le réutilise pour l'intérieur de sa table → rendu INCHANGÉ
//     au byte près (goldens stables) : enteteHtml conserve EXACTEMENT le whitespace
//     (saut + indentation) de l'ancien template de tableauTitresDores.
export function construireTableEcoulable(t: Tokens, opts: {
  cols: Col[];
  rows: Cell[][];
}): { enteteHtml: string; lignesHtml: string[] } {
  const renderTh = (c: Col) =>
    `<th class="th" style="text-align:${c.align || "left"};${c.width ? `width:${c.width}` : ""}">${c.label}</th>`;
  const renderTd = (cell: Cell, col: Col) => {
    const align = cell.align || col.align || "left";
    const color = cell.color ? `color:${cell.color};` : "";
    const weight = cell.bold ? "font-weight:700;" : "";
    return `<td class="td" style="text-align:${align};${color}${weight}">${cell.value}</td>`;
  };
  const enteteHtml = `<thead><tr style="background:${t.fondTableau};border-bottom:1px solid ${t.bordureSeuilRail}">
          ${opts.cols.map(renderTh).join("")}
        </tr></thead>`;
  const lignesHtml = opts.rows.map((row, idx) =>
    `<tr${idx % 2 === 1 ? ` style="background:${t.fondTableauAlt}"` : ""}>${row.map((cell, i) => renderTd(cell, opts.cols[i])).join("")}</tr>`
  );
  return { enteteHtml, lignesHtml };
}

export function tableauTitresDores(t: Tokens, opts: {
  cols: Col[];
  rows: Cell[][];        // chaque ligne = tableau de Cell, dans l'ordre des cols
}): string {
  const { enteteHtml, lignesHtml } = construireTableEcoulable(t, opts);
  return `
    <div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;margin-top:12px">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        ${enteteHtml}
        <tbody>
          ${lignesHtml.join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ─── noteIconee : encart sobre avec icône à gauche + texte (HTML autorisé)
// 3 styles disponibles :
//   • "neutre" (par défaut, Succession B) : fond clair, 11px texte standard
//   • "discrete" (Prévoyance ind., mention non-contractuelle) : 9.5px gris pâle
//   • "conseil" (Prévoyance coll., dirigeant assimilé salarié) : fond beige,
//     bordure or gauche 3px (style « encart Notre lecture » avec icône)
export function noteIconee(t: Tokens, opts: {
  iconeSvg: string;
  texteHtml: string;
  taille?: "normale" | "discrete";   // legacy : "normale" mappe sur "neutre"
  style?: "neutre" | "discrete" | "conseil";
}): string {
  // Compat : si `taille` est passé, on l'utilise comme style (legacy API).
  const style = opts.style || (opts.taille === "discrete" ? "discrete" : "neutre");
  const isDiscrete = style === "discrete";
  const isConseil  = style === "conseil";
  const padding = isDiscrete ? "10px 13px" : isConseil ? "12px 15px" : "9px 12px";
  const fontSize = isDiscrete ? "9.5px" : isConseil ? "11.5px" : "11px";
  const color = isDiscrete ? t.texteFaible : t.texte;
  const lineHeight = isDiscrete ? "1.5" : isConseil ? "1.5" : "1.4";
  const align = isDiscrete || isConseil ? "flex-start" : "center";
  const bg = isConseil ? t.fondEncart : t.fondTableauAlt;
  const borderColor = isConseil ? t.bordureEncart : t.bordureClaire;
  const borderLeft = isConseil ? `border-left:3px solid ${t.or};` : "";
  return `
    <div style="display:flex;align-items:${align};gap:9px;margin-top:11px;border:0.5px solid ${borderColor};${borderLeft}border-radius:8px;padding:${padding};background:${bg}">
      ${opts.iconeSvg}
      <span class="lt" style="font-size:${fontSize};color:${color};line-height:${lineHeight}">${opts.texteHtml}</span>
    </div>
  `;
}

// ─── pill : pillule statut (icône + label) avec couleurs sémantiques ────
// Couleurs sémantiques FIXES (vert/orange/bleu-gris) — invariantes à travers
// les 2 thèmes pour préserver la lisibilité conformité (vert = OK partout).
export type PillStatut = "success" | "warning" | "info";

const PILL_PALETTE: Record<PillStatut, { bg: string; text: string; icon: string }> = {
  success: { bg: "#EEF5F0", text: "#1F5A41", icon: "#2F7D5B" },
  warning: { bg: "#FBF3E3", text: "#8A5A0E", icon: "#B07A1E" },
  info:    { bg: "#EEF1F5", text: "#475569", icon: "#5B7089" },
};

export function pill(_t: Tokens, opts: {
  label: string;
  statut: PillStatut;
  /** Builder d'icône (ex: icones.check). Reçoit la couleur sémantique. */
  icone?: (color: string, size?: number) => string;
}): string {
  const p = PILL_PALETTE[opts.statut];
  const iconHtml = opts.icone ? opts.icone(p.icon, 12) : "";
  return `<span class="lt" style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:13px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;background:${p.bg};color:${p.text}">${iconHtml}${opts.label}</span>`;
}

// ─── bandeauInfo : bandeau gris (eyebrow + valeur à gauche + pill à droite)
// Utilisé pour « Convention collective applicable » page Prévoyance coll.
export function bandeauInfo(t: Tokens, opts: {
  eyebrow: string;
  valeur: string;
  pillHtml?: string;          // optionnel : généré via pill(...)
}): string {
  return `
    <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureMoyenne};border-radius:9px;padding:11px 15px">
      <div>
        <div class="lt" style="font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:${t.texteFaibleClair}">${opts.eyebrow}</div>
        <div class="lt" style="font-size:12.5px;color:${t.navy};font-weight:700;margin-top:2px">${opts.valeur}</div>
      </div>
      ${opts.pillHtml || ""}
    </div>
  `;
}

// ─── matriceConformite : liste de lignes (titre + référence à gauche + pill
//     statut à droite). Utilisée pour la matrice des obligations page
//     Prévoyance collective. Dernière ligne sans border-bottom.
export type LigneMatriceConformite = {
  titre: string;        // "Santé collective obligatoire"
  reference: string;    // "ANI 2013 · art. L.911-7 CSS"
  pillHtml: string;     // <span class="pill">...</span> (généré via pill(...))
};

export function matriceConformite(t: Tokens, lignes: LigneMatriceConformite[]): string {
  const renderLigne = (l: LigneMatriceConformite, i: number) => {
    const isLast = i === lignes.length - 1;
    const border = isLast ? "" : `border-bottom:1px solid ${t.bordureClaire};`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;${border}">
      <div>
        <div class="lt" style="font-size:11.5px;color:${t.texte};font-weight:700">${l.titre}</div>
        <div class="lt" style="font-size:9px;color:${t.texteFaibleClair};margin-top:1px">${l.reference}</div>
      </div>
      ${l.pillHtml}
    </div>`;
  };
  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:4px 16px;margin-top:12px">
    ${lignes.map(renderLigne).join("")}
  </div>`;
}

// ─── bandeauConsolide : fond navy + label (2 lignes) gauche + valeur or
// droite (serif). Utilisé pour le total transmis page Succession B.
export function bandeauConsolide(t: Tokens, opts: {
  labelHaut: string;
  labelBas?: string;
  valeur: string;
}): string {
  return `
    <div style="margin-top:22px;background:${t.navy};border-radius:9px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center">
      <div style="line-height:1.3">
        <div class="lt" style="font-size:12px;color:${t.cream}">${opts.labelHaut}</div>
        ${opts.labelBas ? `<div class="lt" style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">${opts.labelBas}</div>` : ""}
      </div>
      <span class="ser" style="font-size:22px;font-weight:600;color:${t.kpiOrPale};white-space:nowrap">${opts.valeur}</span>
    </div>
  `;
}

// ─── echelleSegments : barre N segments + curseur ▲ au-dessus du segment
// actif. Premier et dernier segments arrondis aux extrémités, le segment
// actif est plein navy avec texte or pâle. Utilisé pour le profil 4 niveaux.
export function echelleSegments(t: Tokens, opts: {
  segments: string[];          // ex: ["Prudent","Équilibré","Dynamique","Offensif"]
  activeIndex: number;         // index du segment actif (0-based)
  labelCurseur?: string;       // ex: "▲ votre profil"
}): string {
  const n = opts.segments.length;
  const curseurLabel = opts.labelCurseur || "▲";
  // Ligne du curseur — vide sauf au-dessus du segment actif
  const curseur = `<div style="display:grid;grid-template-columns:repeat(${n},1fr);margin-bottom:5px">
    ${opts.segments.map((_, i) =>
      i === opts.activeIndex
        ? `<div style="text-align:center;font-family:'Lato',sans-serif;font-size:9.5px;font-weight:700;color:${t.eyebrowOr}">${curseurLabel}</div>`
        : `<div></div>`
    ).join("")}
  </div>`;
  // Barre des segments
  const seg = (label: string, isActive: boolean, isFirst: boolean, isLast: boolean) => {
    const radius = isFirst && isLast ? "5px"
      : isFirst ? "5px 0 0 5px"
      : isLast ? "0 5px 5px 0"
      : "0";
    const bg = isActive ? t.navy : t.fondSeuilRail;
    const fg = isActive ? t.kpiOrPale : t.texteFaible;
    return `<div class="lt" style="font-size:9.5px;text-align:center;padding:7px 2px;font-weight:700;background:${bg};color:${fg};border-radius:${radius}">${label}</div>`;
  };
  const barre = `<div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:3px">
    ${opts.segments.map((s, i) => seg(s, i === opts.activeIndex, i === 0, i === n - 1)).join("")}
  </div>`;
  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:15px 18px;margin-top:11px">
    ${curseur}
    ${barre}
  </div>`;
}

// ─── listeQA : liste de questions/réponses avec lignes séparées ─────────
// Utilisée pour le questionnaire MIF II. La dernière ligne n'a pas de
// bordure inférieure. Optionnellement, `reponseCouleur` colore la réponse.
export type QAItem = {
  question: string;
  reponse: string;          // HTML autorisé
  reponseCouleur?: string;  // surcharge (ex: vert pour ESG)
};

export function listeQA(t: Tokens, items: QAItem[]): string {
  const renderRow = (it: QAItem, i: number) => {
    const isLast = i === items.length - 1;
    const border = isLast ? "border-bottom:none" : `border-bottom:1px solid ${t.bordureClaire}`;
    const colorR = it.reponseCouleur || t.texte;
    return `<div style="display:flex;justify-content:space-between;gap:14px;padding:6.5px 0;${border}">
      <span class="lt" style="font-size:11px;color:${t.texteFaible}">${it.question}</span>
      <span class="lt" style="font-size:11px;color:${colorR};font-weight:700;text-align:right">${it.reponse}</span>
    </div>`;
  };
  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:5px 16px 7px;margin-top:11px">
    ${items.map(renderRow).join("")}
  </div>`;
}

// ─── encartAdequation : encart vert succès + icône bouclier + titre + texte
// Utilisé pour la conclusion d'adéquation MIF II. Couleurs sémantiques fixes
// (vert succès) car la conformité réglementaire a un code couleur stable.
export function encartAdequation(t: Tokens, opts: {
  titre: string;
  texte: string;
}): string {
  // Couleurs vert succès semi-désaturées (cohérentes avec le palette pastel
  // des encarts beige/or — fond pastel, bordure plus saturée, texte sombre).
  const fond = "#EEF5F0";
  const bord = "#CDE6D9";
  const titreColor = "#1F5A41";
  const texteColor = "#2B4A3B";
  void t;  // tokens non utilisés ici — couleurs sémantiques fixes
  return `<div style="margin-top:16px;display:flex;align-items:flex-start;gap:9px;background:${fond};border:0.5px solid ${bord};border-radius:8px;padding:13px 15px">
    ${icones.shieldCheck("#2F7D5B", 18)}
    <div>
      <div class="lt" style="font-size:11.5px;font-weight:700;color:${titreColor}">${opts.titre}</div>
      <div class="lt" style="font-size:11px;color:${texteColor};margin-top:3px;line-height:1.5">${opts.texte}</div>
    </div>
  </div>`;
}

// ─── encartSignature : 2 colonnes (client + conseiller) avec champs
// pré-remplis et zones signature manuscrite. Réutilisable pour le rapport
// patrimonial ET les 4 documents réglementaires v2 (lettre mission, DER,
// fiche DDA, déclaration d'adéquation). Sans signature, le document n'est
// pas opposable.
export type EncartSignatureOpts = {
  /** Nom du / des client(s) (ex: "Hélène & Marc Dubreuil"). */
  nomClient: string;
  /** Nom du conseiller (ex: "David Perry"). */
  nomConseiller: string;
  /** Ville de signature (par défaut, vide → ligne pointillée à remplir). */
  ville?: string;
  /** Date de signature (par défaut, vide → ligne pointillée à remplir). */
  date?: string;
  /** Image de signature du conseiller (data URL ou URL). Si présente,
   *  affichée dans sa case. La case client reste vide (signature manuscrite). */
  signatureConseillerSrc?: string;
  /** Mention introductive (par défaut "Lu et approuvé"). */
  mention?: string;
};

export function encartSignature(t: Tokens, opts: EncartSignatureOpts): string {
  const mention = opts.mention || "Lu et approuvé";
  const ligne = (val?: string) => val
    ? `<span class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700">${val}</span>`
    : `<span style="display:inline-block;border-bottom:1px dotted ${t.bordureMoyenne};width:80px;height:12px"></span>`;
  const sigConseiller = opts.signatureConseillerSrc
    ? `<img src="${opts.signatureConseillerSrc}" alt="Signature" style="max-height:48px;max-width:140px;object-fit:contain" />`
    : "";
  return `
    <div style="margin-top:16px;border:0.5px solid ${t.bordureEncart};border-radius:8px;padding:13px 15px;background:${t.fondTableauAlt}">
      <div class="lt" style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:${t.eyebrowOr};font-weight:700;margin-bottom:8px">${mention}</div>
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:10px">
        <span class="lt" style="font-size:10.5px;color:${t.texteFaible}">Fait à : ${ligne(opts.ville)}</span>
        <span class="lt" style="font-size:10.5px;color:${t.texteFaible}">Le : ${ligne(opts.date)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div>
          <div class="lt" style="font-size:9.5px;color:${t.texteFaible};text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Le client</div>
          <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700;margin-bottom:6px">${opts.nomClient}</div>
          <div style="height:54px;border:0.5px dashed ${t.bordureMoyenne};border-radius:5px;background:#fff"></div>
        </div>
        <div>
          <div class="lt" style="font-size:9.5px;color:${t.texteFaible};text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Le conseiller</div>
          <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700;margin-bottom:6px">${opts.nomConseiller}</div>
          <div style="height:54px;border:0.5px dashed ${t.bordureMoyenne};border-radius:5px;background:#fff;display:flex;align-items:center;justify-content:center">${sigConseiller}</div>
        </div>
      </div>
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

// ─── bandePiedAncree : bande basse ancree (slot signature optionnel + pied) ──
// Primitive partagee par coquillePage et coquillePageDocReg (LOT #3, etape 3.2).
// Emet, dans l'ORDRE HTML historique, le slot signature absolu (si `signature`
// fourni) PUIS le pied, separes par "\n" + 6 espaces (l'indentation des coquilles).
//
// MODE ACTUEL (3.2) : `pied` est fourni DEJA CONSTRUIT par l'appelant (piedPage /
// piedPageDocReg cote builders) et injecte VERBATIM. C'est ce que figent les
// snapshots golden (primitives.coquilles) -> rendu byte-identique exige.
//
// MODE construirePied (LOT #3 etape 3.4) : si construirePied=true, bandePiedAncree
// BATIT le div pied absolu (left/right/piedBottom/piedPaddingTop + bordureMoyenne)
// autour de `pied` (contenu interne), avec piedExtraStyle ajoute au style du div.
// Active pour le pied bespoke de la couverture (56/42, bottom 30, flex-end + gap).
// `piedFont` reste reserve (la police vit dans les spans internes, pas sur le div) ;
// migrer piedPage / piedPageDocReg vers ce mode est differe au lot #2. Defaut
// (construirePied absent/false) = comportement historique : `pied` deja construit,
// injecte VERBATIM apres le slot signature -> golden cas 1-6 inchanges.
export function bandePiedAncree(t: Tokens, opts: {
  left: number;
  right: number;
  piedBottom: number;
  piedPaddingTop: number;
  piedFont: number;
  pied: string;
  signature?: string;
  signatureBottom?: number;
  construirePied?: boolean;
  piedExtraStyle?: string;
}): string {
  if (opts.construirePied) {
    const extra = opts.piedExtraStyle ?? "";
    return `<div style="position:absolute;left:${opts.left}px;right:${opts.right}px;bottom:${opts.piedBottom}px;border-top:1px solid ${t.bordureMoyenne};padding-top:${opts.piedPaddingTop}px;display:flex;justify-content:space-between${extra}">${opts.pied}</div>`;
  }
  const signatureBottom = opts.signatureBottom ?? 42;
  const slotSignature = opts.signature
    ? `<div style="position:absolute;left:${opts.left}px;right:${opts.right}px;bottom:${signatureBottom}px">${opts.signature}</div>`
    : "";
  return `${slotSignature}
      ${opts.pied}`;
}

// ─── coquilleBase : base A4 commune (conteneur + liseres? + padding + ancre) ──
// Base INTERNE partagee par coquillePage et coquillePageDocReg (LOT #3, etape 3.3).
// Conteneur A4 identique ; ordre HTML inchange : [liseres?] [div padding contenu]
// [bandePiedAncree]. Les valeurs DIVERGENTES (padding top 30 vs 32, marges 44/36 vs
// 38/38, etc.) ne sont PAS unifiees : elles restent passees PAR PARAMETRE, pour un
// rendu byte-identique (cf golden master primitives.coquilles).
function coquilleBase(t: Tokens, opts: {
  contenu: string;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  liseres?: string;
  pied: string;
  signature?: string;
  ancre: {
    left: number;
    right: number;
    piedBottom: number;
    piedPaddingTop: number;
    piedFont: number;
    signatureBottom: number;
  };
}): string {
  // Reproduit EXACTEMENT les deux formes de padding existantes (byte-identique) :
  //   coquillePage       -> "32px 38px 0"       (left == right : 3 valeurs, bas nu "0")
  //   coquillePageDocReg -> "30px 36px 0 44px"  (left != right : 4 valeurs)
  const bas = opts.paddingBottom === 0 ? "0" : `${opts.paddingBottom}px`;
  const gauche = opts.paddingLeft !== opts.paddingRight ? ` ${opts.paddingLeft}px` : "";
  const padding = `${opts.paddingTop}px ${opts.paddingRight}px ${bas}${gauche}`;
  return `
    <div style="position:relative;width:210mm;height:297mm;overflow:hidden">${opts.liseres ?? ""}
      <div style="padding:${padding}">
        ${opts.contenu}
      </div>
      ${bandePiedAncree(t, { left: opts.ancre.left, right: opts.ancre.right, piedBottom: opts.ancre.piedBottom, piedPaddingTop: opts.ancre.piedPaddingTop, piedFont: opts.ancre.piedFont, pied: opts.pied, signature: opts.signature, signatureBottom: opts.ancre.signatureBottom })}
    </div>
  `;
}

// ─── coquillePage : structure A4 complète d'une page (avec padding standard
//                   + pied absolute + slot signature absolute optionnel). ─
// Le slot `signature` est calé en bas absolu (au-dessus du pied) pour que
// la signature soit toujours au même endroit, quel que soit le volume du
// contenu au-dessus. Utilisé pour la page Profil et les 4 documents
// réglementaires v2 à venir.
//
// 🔴 RÈGLES DE PAGINATION (Lot 9 — pagination manuelle) :
//   • Chaque container A4 a une zone SAFE pour le contenu :
//     - sans signature : bottom ~35px (pied seul, à 16px du bas + 19px hauteur)
//     - avec signature : bottom ~170px (signature ~130px + marge 42px)
//   • Le contenu qui dépasse est CACHÉ (overflow:hidden) — pas de saut auto.
//   • Si une page risque de déborder (contenu variable), créer DEUX containers
//     A4 séquentiels dans le même render et placer la signature uniquement
//     sur le dernier (cf. documents 2-pages : lettre mission, DER, etc.).
//   • Pour les contenus FORTEMENT variables (tableaux d'hypothèses, annexes
//     biens…), prévoir un futur passage à la pagination automatique Chromium
//     (@page + page-break-inside:avoid + displayHeaderFooter), hors périmètre
//     du Lot 9 socle.
export function coquillePage(_t: Tokens, opts: {
  contenu: string;
  pied: string;
  signature?: string;
}): string {
  return coquilleBase(_t, {
    contenu: opts.contenu,
    paddingTop: 32, paddingRight: 38, paddingBottom: 0, paddingLeft: 38,
    pied: opts.pied,
    signature: opts.signature,
    ancre: { left: 38, right: 38, piedBottom: 16, piedPaddingTop: 8, piedFont: 10, signatureBottom: 42 },
  });
}

// ── Pagination de liste Succession A/B (hauteurs MESURÉES Chromium, arrondi conservateur) ──
// Aucune constante magique : chaque valeur = mesure getBoundingClientRect + margin-top
// du bloc correspondant, arrondie vers le haut (sur-compte = jamais de clip).
export const H_LIGNE_LISTE_PX = 30;          // row tableauTitresDores mono-ligne (.td padding 8+8 + texte 10px) — mesuré 28-29
export const H_BLOC_DEVOLUTION_PX = 140;     // Succession A : sct « Dévolution » + barreDevolution (mesuré 117) + margin-top 18
export const H_FOOTNOTE_TABLE_PX = 36;       // .foot légende sous la table (mesuré 27) + margin-top 6
export const H_ENCART_NOTRE_LECTURE_BASE_PX = 76; // encartNotreLecture HORS texte : margin-top 20 + padding 15×2 + titre serif (~)
export const H_BANDEAU_CONSOLIDE_PX = 82;    // Succession B : bandeauConsolide (mesuré 59) + margin-top 22
export const H_CLAUSE_BENEF_PX = 48;         // Succession B : noteIconee clause (mesuré 35) + margin-top 11
export const CHARS_PAR_LIGNE_ENCART = 75;    // encart 12.5px sur ~684px utile : 75 = sur-compte modéré le nb de lignes

// ════════════════════════════════════════════════════════════════════════
// DOCUMENTS RÉGLEMENTAIRES — primitives partagées par les 4 documents v2
// (lettre de mission, DER, fiche DDA, déclaration d'adéquation)
// ════════════════════════════════════════════════════════════════════════

// ─── coquillePageDocReg : structure A4 avec liseré gauche navy+or ───────
// Variante pour documents réglementaires (lettre de mission, DER, fiche
// DDA, déclaration d'adéquation). Padding ajusté pour le liseré.
//
// Slot `signature?` : même convention que `coquillePage` pour les pages
// thématiques — la signature est CALÉE EN BAS ABSOLU (au-dessus du pied),
// au même emplacement sur toutes les pages signables. Convention non
// négociable établie sur la page Profil et étendue à tous les documents
// réglementaires v2 (DER, fiche DDA, déclaration d'adéquation à venir).
export function coquillePageDocReg(t: Tokens, opts: {
  contenu: string;
  pied: string;
  signature?: string;
}): string {
  const liseres =
    `\n      <div style="position:absolute;top:0;left:0;bottom:0;width:7px;background:${t.navy}"></div>` +
    `\n      <div style="position:absolute;top:0;left:7px;bottom:0;width:2px;background:${t.or}"></div>`;
  return coquilleBase(t, {
    contenu: opts.contenu,
    paddingTop: 30, paddingRight: 36, paddingBottom: 0, paddingLeft: 44,
    liseres,
    pied: opts.pied,
    signature: opts.signature,
    ancre: { left: 44, right: 36, piedBottom: 15, piedPaddingTop: 7, piedFont: 9.5, signatureBottom: 42 },
  });
}

// ─── piedPageDocReg : pied compact (police 9.5px, espacement ajusté) ───
// Variante du piedPage standard pour les documents réglementaires.
export function piedPageDocReg(t: Tokens, opts: { gauche: string; droite: string }): string {
  return `
    <div style="position:absolute;left:44px;right:36px;bottom:15px;border-top:1px solid ${t.bordureMoyenne};padding-top:7px;display:flex;justify-content:space-between">
      <span class="lt" style="font-size:9.5px;color:${t.texteFaibleClair}">${opts.gauche}</span>
      <span class="lt" style="font-size:9.5px;color:${t.texteFaibleClair}">${opts.droite}</span>
    </div>
  `;
}

// ─── headerDocReg : eyebrow + titre Fraunces + bloc cabinet droite + filet
// Le titre supporte les sauts de ligne explicites via "\n" (convertis en
// <br>). La date à droite peut être affichée comme champ mission (varm) ou
// brute (selon `dateAsChamp`). Par défaut : champ mission.
//
// `dateValeurHtml?` : override complet de la valeur (composite, ex:
// "<varm>date</varm> à <varm>heure</varm>"). Si fourni, ignore dateValeur
// et dateAsChamp.
export function headerDocReg(t: Tokens, opts: {
  eyebrow: string;        // ex: "Document réglementaire"
  titre: string;          // ex: "Lettre de mission" ou "Document d'entrée\nen relation"
  cabinetNom: string;     // ex: "EcoPatrimoine Conseil"
  dateLabel?: string;     // ex: "Établie le" / "Remis le" (par défaut "Établie le")
  dateValeur?: string;    // ex: "25 mai 2026"
  dateAsChamp?: boolean;  // par défaut true (varm). false → texte brut, pas de champMission
  dateValeurHtml?: string;  // override complet (champs composites — ex: date + heure)
}): string {
  const dateLabel = opts.dateLabel || "Établie le";
  const dateAsChamp = opts.dateAsChamp !== false;
  const titreHtml = opts.titre.split("\n").join("<br>");
  const dateHtml = opts.dateValeurHtml
    ? opts.dateValeurHtml
    : (opts.dateValeur
        ? (dateAsChamp ? champMission(t, opts.dateValeur) : opts.dateValeur)
        : (dateAsChamp ? champMission(t, "date") : "—"));
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${t.eyebrowOr}">${opts.eyebrow}</div>
        <div class="ser" style="font-size:22px;font-weight:600;color:${t.navy};margin-top:5px;line-height:1.15">${titreHtml}</div>
      </div>
      <div style="text-align:right">
        <div class="lt" style="font-size:12px;color:${t.navy};font-weight:700">${opts.cabinetNom}</div>
        <div class="lt" style="font-size:10px;color:${t.texteFaible};margin-top:2px">${dateLabel} ${dateHtml}</div>
      </div>
    </div>
    <div style="height:2px;background:${t.or};margin-top:9px;opacity:.9"></div>
  `;
}

// ─── champ annoté : variable cabinet (varc) — fond beige bordé doré ───
export function champCabinet(_t: Tokens, label: string): string {
  return `<span style="background:#FBF3E0;border-bottom:1px dotted #C4973D;padding:0 4px;border-radius:2px;color:#6E5410;font-style:italic;font-family:'Lato',sans-serif">${label}</span>`;
}

// ─── champ annoté : variable mission/client (varm) — fond bleu pâle ───
export function champMission(_t: Tokens, label: string): string {
  return `<span style="background:#ECF1F7;border-bottom:1px dotted #5B7089;padding:0 4px;border-radius:2px;color:#3A506B;font-style:italic;font-family:'Lato',sans-serif">${label}</span>`;
}

// ─── legendeChampsDocReg : légende explicative des types de champs ─────
// `seulementCabinet?` : afficher uniquement le marqueur cabinet (utilisé
// pour le DER qui n'a pas de variables mission/client).
export function legendeChampsDocReg(_t: Tokens, opts: { seulementCabinet?: boolean } = {}): string {
  const champCab = `<span class="lt" style="font-size:8px;color:#5C5648">
    <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#FBF3E0;border:1px dotted #C4973D;vertical-align:middle"></span>
    champ ${opts.seulementCabinet ? "rempli depuis vos réglages cabinet" : "cabinet (Paramètres)"}
  </span>`;
  if (opts.seulementCabinet) {
    return `<div style="display:flex;gap:14px;margin-top:9px">${champCab}</div>`;
  }
  return `
    <div style="display:flex;gap:16px;margin-top:9px">
      ${champCab}
      <span class="lt" style="font-size:8px;color:#5C5648">
        <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#ECF1F7;border:1px dotted #5B7089;vertical-align:middle"></span>
        champ mission / client (ce dossier)
      </span>
    </div>
  `;
}

// ─── Marqueurs visuels pour éléments réglementaires ──────────────────────
// `marqueurVerifie(date)` : badge vert ✓ "vérifié le JJ/MM/AAAA"
// `marqueurAConfirmer(texte)` : badge orange ⚠ pour info à confirmer
// Couleurs sémantiques FIXES (vert/orange) — invariantes thèmes pour
// préserver la signalétique conformité.
export function marqueurVerifie(_t: Tokens, date: string): string {
  return `<span class="lt" style="font-size:8px;color:#2F7D5B;letter-spacing:.02em">✓ vérifié le ${date}</span>`;
}

export function marqueurAConfirmer(_t: Tokens, texte: string): string {
  return `<span class="lt" style="font-size:8px;color:#B07A1E;letter-spacing:.02em">${texte}</span>`;
}

// ─── tableauBesoinReponse : grille 2 colonnes (besoin | réponse) avec
// séparateur or vertical entre les colonnes et bordure or horizontale entre
// les lignes (sauf dernière). Réutilisé par la fiche conseil DDA (« En quoi
// ce conseil répond à vos besoins ») et la déclaration d'adéquation (« En
// quoi ce conseil vous correspond »).
export type LigneBesoinReponse = {
  besoin: string;
  reponse: string;
};

export function tableauBesoinReponse(t: Tokens, lignes: LigneBesoinReponse[]): string {
  const renderLigne = (l: LigneBesoinReponse, i: number) => {
    const isLast = i === lignes.length - 1;
    const border = isLast ? "" : `border-bottom:1px solid ${t.bordureClaire};`;
    return `
      <div style="display:grid;grid-template-columns:1fr 1.25fr;gap:0;${border}">
        <div class="lt" style="font-size:10.5px;color:${t.texteFaible};padding:8px 12px 8px 0;border-right:2px solid ${t.or}">${l.besoin}</div>
        <div class="lt" style="font-size:10.5px;color:${t.texte};padding:8px 0 8px 14px;line-height:1.45">${l.reponse}</div>
      </div>
    `;
  };
  return `<div style="margin-top:4px">${lignes.map(renderLigne).join("")}</div>`;
}

// ─── encadreDocReg : encadré standard avec titre serif Fraunces intégré
export function encadreDocReg(t: Tokens, opts: {
  titre: string;        // affiché en sous-titre serif Fraunces 13.5px
  contenuHtml: string;  // HTML brut
  marginTop?: string;   // par défaut "13px" (pour le 1er bx : "14px")
}): string {
  const mt = opts.marginTop || "13px";
  return `
    <div style="margin-top:${mt};border:0.5px solid ${t.bordureClaire};border-radius:9px;padding:12px 15px">
      ${sousTitreSection(t, opts.titre, { style: "serif" })}
      ${opts.contenuHtml}
    </div>
  `;
}

// ─── listeCasesPrestations : grille 2 colonnes de cases cochées/non ───
export type CasePrestation = {
  label: string;
  cochee: boolean;
};

export function listeCasesPrestations(t: Tokens, items: CasePrestation[]): string {
  const renderItem = (it: CasePrestation) => {
    const box = it.cochee
      ? `<span style="width:13px;height:13px;border-radius:3px;flex:none;background:${t.navy}"></span>`
      : `<span style="width:13px;height:13px;border-radius:3px;flex:none;background:${t.fondSeuilRail};border:1px solid ${t.bordureMoyenne}"></span>`;
    const textColor = it.cochee ? t.texte : t.texteFaibleClair;
    return `<div style="display:flex;align-items:center;gap:7px;padding:5px 0;font-family:'Lato',sans-serif;font-size:10.5px;color:${textColor}">
      ${box}${it.label}
    </div>`;
  };
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px">
    ${items.map(renderItem).join("")}
  </div>`;
}

// ─── cadresSignatureDocReg : 2 cadres compacts (client + cabinet) ─────
// Plus simple que `encartSignature` : pas de pré-remplissage "Fait à / Le"
// dans les cadres eux-mêmes (la mention est mise SOUS les 2 cadres).
// Utilisé pour les 4 documents réglementaires v2.
export function cadresSignatureDocReg(t: Tokens, opts: {
  cabinetNomConseiller: string;   // ex: "David Perry"
  cabinetNom: string;             // ex: "EcoPatrimoine Conseil"
  ville?: string;                 // pour la mention "Fait à X, le Y"
  date?: string;
  exemplaires?: string;           // par défaut "en deux exemplaires"
  labelClient?: string;           // par défaut "Le client"
  mentionClient?: string;         // par défaut "« lu et approuvé », date & signature"
  mentionCabinet?: string;        // par défaut cabinetNom
  hauteurCadre?: string;          // par défaut "72px"
  masquerMentionFait?: boolean;   // si vrai, supprime la ligne "Fait à X, le Y"
  mentionFaitHtml?: string;       // override HTML complet de la ligne sous les cadres (ex: déclaration adéquation)
}): string {
  const exempl = opts.exemplaires || "en deux exemplaires";
  const ville = opts.ville ? champMission(t, opts.ville) : champMission(t, "lieu");
  const date  = opts.date  ? champMission(t, opts.date)  : champMission(t, "date");
  const labelClient = opts.labelClient || "Le client";
  const mentionClient = opts.mentionClient || "« lu et approuvé », date & signature";
  const mentionCabinet = opts.mentionCabinet || opts.cabinetNom;
  const hauteur = opts.hauteurCadre || "72px";
  const mentionFait = opts.mentionFaitHtml
    ? `<div class="lt" style="font-size:9px;color:${t.texteFaible};margin-top:7px">${opts.mentionFaitHtml}</div>`
    : opts.masquerMentionFait
    ? ""
    : `<div class="lt" style="font-size:9px;color:${t.texteFaible};margin-top:7px">Fait à ${ville}, le ${date} — ${exempl}.</div>`;
  return `
    <div style="margin-top:14px;display:flex;gap:14px">
      <div style="flex:1;border:0.5px solid ${t.bordureMoyenne};border-radius:9px;padding:11px 13px;height:${hauteur};position:relative">
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">${labelClient}</div>
        <div class="lt" style="position:absolute;bottom:8px;left:13px;font-size:9px;color:${t.texteFaibleClair}">${mentionClient}</div>
      </div>
      <div style="flex:1;border:0.5px solid ${t.bordureMoyenne};border-radius:9px;padding:11px 13px;height:${hauteur};position:relative;background:${t.fondTableauAlt}">
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Le cabinet — ${opts.cabinetNomConseiller}</div>
        <div class="lt" style="position:absolute;bottom:8px;left:13px;font-size:9px;color:${t.texteFaibleClair}">${mentionCabinet}</div>
      </div>
    </div>
    ${mentionFait}
  `;
}

// ════════════════════════════════════════════════════════════════════════
// FIN DES PRIMITIVES DOCUMENTS RÉGLEMENTAIRES
// ════════════════════════════════════════════════════════════════════════

// ─── coquilleDocument : <!DOCTYPE html> + head (fonts + CSS commun) + body
export function coquilleDocument(t: Tokens, opts: {
  titre: string;
  body: string;
  /** Bloc polices a injecter. Defaut = <link> jsdelivr reseau (FONTS_HTML_LINKS),
   *  conserve pour le harnais DEV `tsx`. Le runtime (generatePack) passe les
   *  @font-face locaux bundles (FONT_FACES_STYLE) -> rendu offline. */
  fontsHtml?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${opts.titre}</title>
${opts.fontsHtml ?? FONTS_HTML_LINKS}
<style>${cssCommun(t)}</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}

// ─── motifArcsBasDroit : 3 arcs or concentriques + petit cercle plein ──
// Utilisé pour la couverture (motif décoratif « croissance »).
export function motifArcsBasDroit(t: Tokens, taille = 200): string {
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 200 200" style="position:absolute;right:0;bottom:0" aria-hidden="true">
    <g fill="none" stroke="${t.or}" stroke-width="1.4">
      <path d="M200 56 A144 144 0 0 0 56 200" opacity=".2"/>
      <path d="M200 100 A100 100 0 0 0 100 200" opacity=".28"/>
      <path d="M200 140 A60 60 0 0 0 140 200" opacity=".38"/>
    </g>
    <circle cx="200" cy="200" r="6" fill="${t.or}" opacity=".5"/>
  </svg>`;
}

// ─── Initiales d'un cabinet (« EcoPatrimoine Conseil » → « EC ») ──────
export function initialesDe(nom: string): string {
  const mots = (nom || "").trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}
