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
import { FONT_FACES_STYLE } from "../fontsLocal";
import { cssCommun } from "../primitives";
import { HANDLER_SCRIPT, DOCNUM_HANDLER_SCRIPT, COVER_HANDLER_SCRIPT } from "./pagedHandler";
import { INSET_LATERAL_PX, DOCREG_INSET_GAUCHE_PX, DOCREG_INSET_DROITE_PX } from "./insets";

// Géométrie du moteur (mm).
// MARGES LATÉRALES @page = 0 : la boîte module (width:210mm) occupe toute la largeur
// utile et redonne son canvas d'origine via son PROPRE padding (38px ≈ 10,05mm) →
// contenu = 210mm − 2×38px = 189,9mm = 538,3pt, exactement la largeur intérieure de
// l'ancienne coquillePage. (Des marges latérales >0 rétréciraient la zone sous 210mm
// et la boîte déborderait — cf. diag. ÉTAPE 1.)
const MARGE_HAUT_MM = 15;       // bande haute (en-tête courant)
const MARGE_BAS_MM = 15;        // bande basse (pied + X/Y)
// Insets latéraux (INSET_LATERAL_PX symétrique / DOCREG asymétrique 44-36) : SOURCE UNIQUE
// engine/insets.ts (C3), partagée avec le corps (.pdf-contrat) et les 5 pages réglementaires.
// L'en-tête/pied/X-Y s'alignent au pixel sur le bord du corps (chrome et corps = même bord).

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
/* docReg : override CONFINÉ (.pagedjs_docReg_page) -> en-tête/pied/numéro alignés sur le bord
   du corps docReg (44 gauche / 36 droite, respiration du liseré 9px). Les feuilles bilan
   gardent 38 (règle par défaut ci-dessus). */
.pagedjs_docReg_page .pagedjs_margin-top-left .pagedjs_margin-content,
.pagedjs_docReg_page .pagedjs_margin-bottom-left .pagedjs_margin-content { padding-left:${DOCREG_INSET_GAUCHE_PX}px !important; }
.pagedjs_docReg_page .pagedjs_margin-bottom-right .pagedjs_margin-content { padding-right:${DOCREG_INSET_DROITE_PX}px !important; }
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

/* ── Documents réglementaires : liseré navy 7px + or 2px réémis PAR FEUILLE ──
   Le liseré était porté par la boîte A4 de coquillePageDocReg, neutralisée par le
   pont Phase 1. On le repose ici via la classe named-page de paged.js, CONFINÉ aux
   feuilles docReg (.pagedjs_docReg_page) → jamais sur les pages bilan. Déclencheur :
   une section data-page="docReg" (cf. buildFeederDocument, hissé depuis data-pdf-page).
   .pagedjs_pagebox est position:relative (base paged.js) → l'ancre couvre toute la feuille. */
.pagedjs_docReg_page .pagedjs_pagebox::before {
  content:""; position:absolute; left:0; top:0; bottom:0; width:9px; z-index:1; pointer-events:none;
  background:linear-gradient(to right, ${t.navy} 0, ${t.navy} 7px, ${t.or} 7px, ${t.or} 9px);
}

/* ── Numerotation X/N PAR DOCUMENT (documents reglementaires) ──
   Le DocNumHandler pose EN POST-LAYOUT la classe docnum-fixed + l'attribut
   data-docnum="<libelle> · X / N" sur la margin-box bas-droite des SEULES feuilles
   portant data-doc (reglementaires). On surcharge alors le compteur global ::after par
   le numero PAR DOCUMENT. Les feuilles SANS data-doc (bilan, prevoyance...) ne sont pas
   touchees et gardent le @bottom-right global counter(page)/counter(pages). */
.pagedjs_margin-bottom-right .pagedjs_margin-content.docnum-fixed::after {
  content: attr(data-docnum) !important;
}
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
  /** Bloc polices à injecter. Défaut = FONT_FACES_STYLE (variante URL, légère, same-origin :
   *  aperçu + offscreen file://). L'export Electron passe la variante base64 inline
   *  (FONT_FACES_STYLE_INLINE) → document AUTOPORTANT pour printToPDF. Miroir exact
   *  d'opts.fontsHtml de coquilleDocument (primitives.ts). */
  fontsHtml?: string;
};

/** Document HTML autonome EN FLUX, prêt à être paginé par paged.js (auto-run via PagedConfig).
 *  Expose, une fois paginé : window.__done / __pages / __ms et postMessage {pagedDone}. */
export function buildFeederDocument(opts: FeederOptions): string {
  // Named page paged.js : une page migrée peut demander une @page nommée en posant
  // data-pdf-page="NOM" sur son wrapper. On HISSE ce marqueur en data-page sur la
  // <section> -> paged.js tague alors CHAQUE feuille physique de la section
  // (.pagedjs_NOM_page). Inerte si le marqueur est absent (sections inchangées).
  const sections = opts.bodies.map((b, idx) => {
    const m = b.match(/data-pdf-page="([A-Za-z0-9_-]+)"/);
    const pageAttr = m ? ` data-page="${m[1]}"` : "";
    // Numerotation X/N PAR DOCUMENT : on hisse data-pdf-doc -> data-doc sur la <section>,
    // MIROIR EXACT du hoist named-page ci-dessus. La valeur (libelle lisible du document)
    // sert A LA FOIS de cle de regroupement et de prefixe affiche par le DocNumHandler.
    // Charset elargi ([^"]) car le libelle porte espaces/accents/apostrophe. Inerte si
    // absent (section non-docReg -> pas de data-doc -> compteur @page global conserve).
    const md = b.match(/data-pdf-doc="([^"]+)"/);
    const docAttr = md ? ` data-doc="${md[1]}"` : "";
    // .doctitle (porteur de string-set: doctitle pour l'en-tete courant) injecte DANS la
    // 1re section UNIQUEMENT -> il herite de la page de cette section. Si la 1re section est
    // une page nommee docReg, il n'y a plus de page-par-defaut separee en tete = plus de
    // feuille FANTOME (cause prouvee : un .doctitle emis avant #pack-flow creait une page par
    // defaut, puis le docReg demarrait sa page nommee en feuille suivante). En pack complet, la
    // 1re section est la couverture -> le CoverHandler trouve toujours .doctitle (querySelector)
    // et le masque ; string-set capte au layout AVANT le masquage -> en-tete courant preserve.
    const doctitleDiv = idx === 0 ? `<div class="doctitle">${escapeHtml(opts.doctitle)}</div>` : "";
    return `<section${pageAttr}${docAttr}>${doctitleDiv}${b}</section>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(opts.doctitle)}</title>
${opts.fontsHtml ?? FONT_FACES_STYLE}
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
<div id="pack-flow">
${sections}
</div>
<script>${opts.polyfillCode}</script>
<script>${HANDLER_SCRIPT}</script>
<script>${DOCNUM_HANDLER_SCRIPT}</script>
<script>${COVER_HANDLER_SCRIPT}</script>
</body>
</html>`;
}
