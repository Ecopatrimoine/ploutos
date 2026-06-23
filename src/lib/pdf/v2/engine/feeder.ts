// ─── Phase 1 — Feeder du moteur PDF unifié (paged.js) ──────────────────────────
//
// Assemble les sections d'un pack en UN SEUL document EN FLUX (et non les boîtes A4
// fixes concaténées du chemin window.print actuel), puis y injecte le CSS @page :
// format A4, marges, margin-boxes (en-tête courant, pied cabinet, pagination X/Y).
//
// PÉRIMÈTRE PHASE 1 = SOCLE. On NE migre AUCUNE page sur le futur contrat de blocs
// (Phase 2-3) et on NE réécrit PAS le contenu : le feeder réutilise les `bodies`
// produits par les builders existants (via renderPackItemBodies de concatPack) et
// NEUTRALISE AU VOL leurs boîtes A4 fixes (height:297mm/overflow:hidden, pieds
// absolus, entretoises de centrage) pour laisser paged.js paginer le contenu réel.
// → Ce « pont » CSS est temporaire : en Phase 2 les builders émettront des blocs en
//   flux et cette neutralisation disparaîtra.
//
// Parades anti-faux-négatif du spike :
//  - print-color-adjust:exact (sinon les aplats navy/gold disparaissent à l'impression) ← ICI.
//  - document.fonts.ready avant pagination ← côté appelant (ApercuPdf / harness), via PagedConfig.before.

import type { Tokens } from "../tokens";
import { FONTS_HTML_LINKS } from "../tokens";
import { cssCommun } from "../primitives";
import { HANDLER_SCRIPT } from "./pagedHandler";

// Géométrie du moteur (mm).
// MARGES LATÉRALES @page = 0 : la boîte module (width:210mm) occupe toute la largeur
// utile et redonne son canvas d'origine via son PROPRE padding (38px ≈ 10,05mm) →
// contenu = 210mm − 2×38px = 189,9mm = 538,3pt, exactement la largeur intérieure de
// l'ancienne coquillePage. (Des marges latérales >0 rétréciraient la zone sous 210mm
// et la boîte déborderait — cf. diag. ÉTAPE 1.)
const MARGE_HAUT_MM = 15;       // bande haute (en-tête courant)
const MARGE_BAS_MM = 15;        // bande basse (pied + X/Y)
// Inset latéral de l'en-tête courant / pied / X-Y = EXACTEMENT le padding latéral des
// modules (coquillePage paddingLeft/Right = 38px) -> aligné au pixel sur le corps.
const INSET_LATERAL_PX = 38;

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Échappe pour une chaîne CSS `content: "..."` (guillemets + antislash).
function escapeCssString(s: string): string {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\22 ");
}

/** CSS du moteur : cssCommun (sans son @page margin:0) + @page paginé + neutralisation + parades. */
export function feederCss(t: Tokens, cabinetLibelle: string): string {
  // cssCommun porte un "@page { size:A4; margin:0 }" — on le neutralise pour laisser
  // gouverner le @page du moteur (marges + margin-boxes).
  const base = cssCommun(t).replace(/@page\s*\{[^}]*\}/, "");
  const faible = t.texteFaibleClair;
  const pied = escapeCssString(cabinetLibelle);
  return `${base}

/* ── @page moteur : A4 + en-tête courant + pied cabinet + pagination X/Y ──
   Marges latérales = 0 : la boîte module (210mm) occupe toute la largeur et
   redonne son inset d'origine via son propre padding (cf. feeder.ts en-tête). */
@page {
  size: A4;
  margin: ${MARGE_HAUT_MM}mm 0 ${MARGE_BAS_MM}mm 0;
  @top-left { content: string(doctitle); font-family:'Lato',sans-serif; font-size:9px; color:${faible}; }
  @bottom-left { content: "${pied}"; font-family:'Lato',sans-serif; font-size:9px; color:${faible}; }
  @bottom-right { content: "Page " counter(page) " / " counter(pages); font-family:'Lato',sans-serif; font-size:9px; color:${faible}; }
}
/* Inset latéral des margin-boxes appliqué sur le DOM RENDU par paged.js (déterministe :
   le padding posé sur les règles @page n'est pas honoré de façon fiable par paged.js 0.4.3,
   d'où l'en-tête/pied parfois collés au bord). Aligné au pixel sur le corps (38px). */
.pagedjs_margin-top-left .pagedjs_margin-content,
.pagedjs_margin-bottom-left .pagedjs_margin-content { padding-left:${INSET_LATERAL_PX}px !important; box-sizing:border-box; }
.pagedjs_margin-bottom-right .pagedjs_margin-content { padding-right:${INSET_LATERAL_PX}px !important; box-sizing:border-box; }
/* Source string-set du titre courant : insérée en flux -> on l'aligne aussi sur le corps. */
.doctitle { string-set: doctitle content(text); font-family:'Fraunces',Georgia,serif; font-size:15px; color:${t.navy}; margin:0 0 10px; padding-left:${INSET_LATERAL_PX}px; }

/* ── Parade spike : aplats navy/gold visibles à l'impression ── */
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* ── Table écoulable : entête répété par paged.js (handler) + lignes insécables ── */
#pack-flow thead { display: table-header-group; }
#pack-flow tr, #pack-flow td, #pack-flow th { break-inside: avoid; }
/* Les SVG (charts) et encarts restent atomiques. */
#pack-flow svg, #pack-flow .pdf-insecable { break-inside: avoid; }

/* ── PONT PHASE 1 : neutralisation des boîtes A4 fixes des builders existants ──
   (à supprimer en Phase 2 quand les builders émettront des blocs en flux). */
#pack-flow div[style*="height:297mm"] { height:auto !important; min-height:0 !important; overflow:visible !important; }
/* regionCorpsCentree : hauteur bornée + entretoises de centrage -> flux simple. */
#pack-flow div[style*="flex-direction:column"][style*="box-sizing:border-box"] { height:auto !important; overflow:visible !important; display:block !important; }
#pack-flow div[style*="flex:1 1 0"], #pack-flow div[style*="flex:2 1 0"] { display:none !important; }
/* Pieds + slot signature internes (absolus) -> remplacés par les margin-boxes @page. */
#pack-flow div[style*="position:absolute"][style*="bottom:16px"],
#pack-flow div[style*="position:absolute"][style*="bottom:15px"],
#pack-flow div[style*="position:absolute"][style*="bottom:30px"],
#pack-flow div[style*="position:absolute"][style*="bottom:42px"] { display:none !important; }

/* ── Saut de feuille entre sections du pack (chaque section démarre une feuille) ── */
#pack-flow > section { break-before: page; }
#pack-flow > section:first-child { break-before: avoid; }
`;
}

export type FeederOptions = {
  /** HTML déjà rendu de chaque section (réutilise les builders ; on ne réécrit pas le contenu). */
  bodies: string[];
  t: Tokens;
  /** Titre courant (en-tête répété sur chaque feuille). */
  doctitle: string;
  /** Libellé pied cabinet (pied courant). */
  cabinetLibelle: string;
  /** Code source du polyfill paged.js (inliné -> document autonome, pas de dépendance réseau). */
  polyfillCode: string;
};

/** Document HTML autonome EN FLUX, prêt à être paginé par paged.js (auto-run via PagedConfig).
 *  Expose, une fois paginé : window.__done / __pages / __ms et postMessage {pagedDone}. */
export function buildFeederDocument(opts: FeederOptions): string {
  const sections = opts.bodies.map((b) => `<section>${b}</section>`).join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(opts.doctitle)}</title>
${FONTS_HTML_LINKS}
<style>${feederCss(opts.t, opts.cabinetLibelle)}</style>
<script>
  window.PagedConfig = {
    auto: true,
    before: async () => { await document.fonts.ready; window.__t0 = performance.now(); },
    after: (flow) => {
      window.__ms = performance.now() - window.__t0;
      window.__pages = flow.total;
      window.__done = true;
      try { parent.postMessage({ pagedDone: true, pages: flow.total }, "*"); } catch (e) {}
    }
  };
</script>
</head>
<body>
<div class="doctitle">${escapeHtml(opts.doctitle)}</div>
<div id="pack-flow">
${sections}
</div>
<script>${opts.polyfillCode}</script>
<script>${HANDLER_SCRIPT}</script>
</body>
</html>`;
}
