// ─── pdfCore — Noyau unique des documents PDF générés par Ploutos ───────────
// Tokens (charte « Encre & Or », surchargés par les couleurs cabinet),
// helpers dédupliqués (kpi, sec, tbl, hbar, segB),
// résolution couleurs, et coquille print.
//
// Règle de couleurs (préservée à l'identique du comportement existant) :
// - Si AU MOINS UNE couleur cabinet est définie → on utilise les couleurs
//   cabinet (avec fallback par couleur sur Encre & Or si une clé manque).
// - Si AUCUNE couleur cabinet n'est définie → on bascule intégralement sur
//   les defaults Encre & Or.
// Le comportement précédent utilisait directement `cabinet.colorXxx` (et
// produisait littéralement "undefined" dans le CSS si la clé manquait,
// sauf pour `colorBlue` qui avait déjà un fallback `||"#516AC7"`). Le
// refacto remplace ces lectures par les couleurs résolues.

import { euro } from "../calculs/utils";

// ─── Tokens Encre & Or (defaults — utilisés si AUCUNE couleur cabinet) ─────
export const ENCRE_OR = {
  navy:       "#0F172A",
  gold:       "#C4973D",
  goldText:   "#8A6A1E",
  goldOnNavy: "#E3C485",
  sky:        "#5B7089",
  cream:      "#FDF6E8",
  blue:       "#516AC7",
  paper:      "#FFFFFF",
  parchment:  "#E7E3DA",
  hairline:   "#E4DDCF",
  ink:        "#3A352B",
  clay:       "#C7A36A",
  clayBorder: "#A07D33",
  success:    "#2F7D5B",
} as const;

export type ResolvedColors = {
  navy: string;
  gold: string;
  sky: string;
  cream: string;
  blue: string;
};

// ─── Destinataire du document ──────────────────────────────────────────────
// Mode de routage par section :
// - IR  : toujours alimenté par person1 (les concubins n'ont pas de foyer fiscal
//         IR commun ; règle conservée pour tous les régimes)
// - IFI : toujours combiné (foyer IFI commun pour les concubins notoires) ;
//         ignore la sélection
// - Succession : suit la personne sélectionnée (le caller recalcule au besoin)
// - En-tête « Préparé pour » : reflète la sélection
export type Recipient = "person1" | "person2" | "couple";

// Résolution du destinataire par défaut, fondée sur coupleStatus.
// - married / pacs → "couple" (préserve le rendu actuel pour les couples)
// - cohab (concubin) → "person1" (les concubins ne forment PAS un couple
//   successoral : pas d'exonération conjoint, taxation 60 %)
// - single / divorced / widowed → "person1"
export function resolveRecipient(
  explicit: Recipient | undefined,
  coupleStatus: string | undefined
): Recipient {
  if (explicit) return explicit;
  if (coupleStatus === "married" || coupleStatus === "pacs") return "couple";
  return "person1";
}

// ─── Résolution couleurs cabinet → tokens ──────────────────────────────────
// Règle :
// 1. Si cabinet.pdfPalette === "encre_or" → defaults Encre & Or intégraux
//    (choix explicite de l'utilisateur via le sélecteur Paramètres → Documents).
// 2. Sinon (défaut ou "cabinet") :
//    - si AU MOINS UNE couleur cabinet est définie → couleurs cabinet (fallback
//      par couleur sur Encre & Or si une clé manque).
//    - sinon (cabinet entièrement vide) → defaults Encre & Or (sécurité « pas de PDF vide »).
export function resolveCabinetColors(cabinet: Record<string, string | undefined>): ResolvedColors {
  const wantsEncreOr = cabinet.pdfPalette === "encre_or";
  if (wantsEncreOr) {
    return {
      navy:  ENCRE_OR.navy,
      gold:  ENCRE_OR.gold,
      sky:   ENCRE_OR.sky,
      cream: ENCRE_OR.cream,
      blue:  ENCRE_OR.blue,
    };
  }
  const has =
    !!cabinet.colorNavy ||
    !!cabinet.colorGold ||
    !!cabinet.colorSky ||
    !!cabinet.colorCream ||
    !!cabinet.colorBlue;
  if (!has) {
    return {
      navy:  ENCRE_OR.navy,
      gold:  ENCRE_OR.gold,
      sky:   ENCRE_OR.sky,
      cream: ENCRE_OR.cream,
      blue:  ENCRE_OR.blue,
    };
  }
  return {
    navy:  cabinet.colorNavy  || ENCRE_OR.navy,
    gold:  cabinet.colorGold  || ENCRE_OR.gold,
    sky:   cabinet.colorSky   || ENCRE_OR.sky,
    cream: cabinet.colorCream || ENCRE_OR.cream,
    blue:  cabinet.colorBlue  || ENCRE_OR.blue,
  };
}

// ─── Helpers HTML — strings exactement compatibles avec l'existant ─────────
export const kpi = (label: string, value: string, sub?: string, accent = false) =>
  `<div class="kpi${accent?" kpi-accent":""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;

export const sec = (title: string, body: string) =>
  `<div class="section"><div class="section-title">${title}</div>${body}</div>`;

export const tbl = (headers: string[], rows: string[][], hl?: number) =>
  `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,i)=>`<tr class="${i%2===0?"row-even":"row-odd"}">${row.map((cell,j)=>`<td${j===hl?' class="highlight"':""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

// ─── Bibliothèque SVG — strictement identique aux helpers locaux actuels ──
export const hbar = (items: {label:string;value:number;color:string}[], width=420) => {
  const maxVal=Math.max(...items.map(i=>i.value),1);
  const rowH=28; const lW=140; const bW=width-lW-85; const svgH=items.length*rowH+8;
  return `<svg width="${width}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
    const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
    return `<text x="${lW-8}" y="${y+14}" text-anchor="end" font-size="8" fill="#555" font-family="Lato,sans-serif">${item.label}</text>
      <rect x="${lW}" y="${y+2}" width="${bw}" height="16" rx="4" fill="${item.color}" opacity="0.88"/>
      <text x="${lW+bw+6}" y="${y+14}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
  }).join("")}</svg>`;
};

export const segB = (segs:{label:string;value:number;color:string}[], width=420) => {
  const total=segs.reduce((s,i)=>s+i.value,0); if(total<=0) return "";
  let x=0;
  const rects=segs.map(seg=>{ const w=(seg.value/total)*width;
    const r=`<rect x="${x}" y="0" width="${w}" height="18" fill="${seg.color}"/><text x="${x+w/2}" y="13" text-anchor="middle" font-size="7.5" fill="white" font-family="Lato,sans-serif" font-weight="700">${Math.round(seg.value/total*100)}%</text>`;
    x+=w; return r; }).join("");
  const legend=segs.map((seg,i)=>`<g transform="translate(${i*200},0)"><circle cx="7" cy="7" r="5" fill="${seg.color}"/><text x="16" y="12" font-size="8" fill="#444" font-family="Lato,sans-serif">${seg.label} — ${euro(seg.value)}</text></g>`).join("");
  return `<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="18" rx="4" fill="#e5e7eb"/>${rects}<g transform="translate(0,26)">${legend}</g></svg>`;
};

// ─── Coquille print — popup + window.print() ───────────────────────────────
export function openPrintPopup(html: string): void {
  const popup = (globalThis as any).window?.open?.("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!popup) { (globalThis as any).window?.alert?.("Autorise les popups pour ce site."); return; }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => { popup.print(); }, 500);
}
