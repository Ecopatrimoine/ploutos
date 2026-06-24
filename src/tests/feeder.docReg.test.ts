// ─── LOT 1a — Fondation moteur : named page docReg + liseré @feuille ──────────
//
// Le liseré (navy 7px + or 2px) des documents réglementaires était porté par la
// boîte A4 de coquillePageDocReg, neutralisée sur le chemin paged.js (feeder).
// Cette fondation le réémet PAR FEUILLE PHYSIQUE, CONFINÉ aux feuilles docReg via
// la classe named-page de paged.js (.pagedjs_docReg_page) — aucune page migrée
// dans ce lot : le mécanisme est inerte tant qu'aucune section ne pose le marqueur
// data-pdf-page="docReg" (cf. LOT 1b — migration DA).

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { feederCss, buildFeederDocument } from "../lib/pdf/v2/engine/feeder";
import { DOCNUM_HANDLER_SCRIPT } from "../lib/pdf/v2/engine/pagedHandler";

const t = buildTokens("encreOr");

describe("Feeder — fondation named-page docReg (LOT 1a)", () => {
  it("feederCss réémet le liseré docReg (navy 7px + or 2px) confiné à .pagedjs_docReg_page", () => {
    const css = feederCss(t, "Cabinet Test");
    // Cible la classe named-page (per-feuille), pas une page générique.
    expect(css).toContain(".pagedjs_docReg_page .pagedjs_pagebox::before");
    // Le liseré EXACT : navy 0→7px, or 7→9px (band 9px), via les tokens.
    expect(css).toContain(
      `background:linear-gradient(to right, ${t.navy} 0, ${t.navy} 7px, ${t.or} 7px, ${t.or} 9px)`
    );
    // Confinement : aucune règle liseré sur une page paged.js générique.
    expect(css).not.toContain(".pagedjs_page .pagedjs_pagebox::before");
  });

  it("buildFeederDocument hisse data-pdf-page=\"docReg\" vers data-page sur la <section>", () => {
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat" data-pdf-page="docReg">DA</div>`],
      t, doctitle: "T", cabinetLibelle: "C", polyfillCode: "",
    });
    expect(html).toContain(`<section data-page="docReg">`);
  });

  it("une section SANS marqueur reste inerte (aucun data-page injecté)", () => {
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat">Bilan</div>`],
      t, doctitle: "T", cabinetLibelle: "C", polyfillCode: "",
    });
    expect(html).toContain(`<section>`);
    // Précis : la <section> elle-même n'est pas taguée (le commentaire CSS du
    // feeder mentionne data-page à titre documentaire — on ne vise QUE la section).
    expect(html).not.toContain("<section data-page");
  });
});

// ─── LOT numérotation X/N par document — additif au socle 1a (NE CASSE RIEN) ──────
//
// Les assertions ci-dessus (liseré + hoist data-page) restent VRAIES : le nouveau
// marqueur data-doc est ORTHOGONAL. Ici on verrouille : (1) docReg -> par-document
// (hoist data-doc + override CSS + handler) ; (2) non-docReg -> compteur global
// INCHANGÉ (ni data-page ni data-doc, @bottom-right global préservé). Le RENDU
// effectif "X / N" est validé hors unit-test (PDF mixte + spike : paged.js a besoin
// d'un vrai layout, indisponible en jsdom) ; ici on lock la CHAÎNE de marqueurs/CSS.
describe("Feeder — numérotation X/N PAR DOCUMENT (LOT docnum)", () => {
  it("hisse data-pdf-doc -> data-doc sur la <section>, ADDITIF au hoist named-page", () => {
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="Déclaration d'adéquation">DA</div>`],
      t, doctitle: "T", cabinetLibelle: "C", polyfillCode: "",
    });
    // Les DEUX marqueurs coexistent : named-page (liseré, EXISTANT) + doc (numérotation, NOUVEAU).
    expect(html).toContain(`data-page="docReg"`);
    expect(html).toContain(`data-doc="Déclaration d'adéquation"`);
  });

  it("docReg SANS data-pdf-doc -> pas de data-doc (compteur global conservé)", () => {
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat" data-pdf-page="docReg">DA sans id doc</div>`],
      t, doctitle: "T", cabinetLibelle: "C", polyfillCode: "",
    });
    expect(html).toContain(`data-page="docReg"`);
    expect(html).not.toContain("data-doc=");
  });

  it("section bilan (non-docReg) : <section> NUE (aucun marqueur) -> 100% compteur global", () => {
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat">Bilan</div>`],
      t, doctitle: "T", cabinetLibelle: "C", polyfillCode: "",
    });
    // On scope à la BALISE <section> : le feeder documente "data-page=" dans un
    // commentaire CSS (liseré), donc on ne peut pas asserter son absence globale.
    // Ce qui compte : la section bilan ne porte AUCUN attribut data- -> le
    // @bottom-right global counter(page)/counter(pages) s'applique tel quel.
    expect(html).toContain("<section>");
    expect(html).not.toContain("<section data-");
  });

  it("feederCss : règle d'override docnum présente ET @bottom-right global PRÉSERVÉ (fallback)", () => {
    const css = feederCss(t, "Cabinet Test");
    // (1) Override par-document (réglementaires) : ::after = attr(data-docnum).
    expect(css).toContain(".pagedjs_margin-bottom-right .pagedjs_margin-content.docnum-fixed::after");
    expect(css).toContain("content: attr(data-docnum) !important");
    // (2) Fallback GLOBAL inchangé (bilan/prévoyance) : NE PAS retirer le @bottom-right.
    expect(css).toContain(`content: "Page " counter(page) " / " counter(pages)`);
  });

  it("DOCNUM_HANDLER_SCRIPT : post-layout, groupe par data-doc, ignore les feuilles non-docReg", () => {
    // Hook post-layout (le total d'un doc n'est connu qu'après pagination).
    expect(DOCNUM_HANDLER_SCRIPT).toContain("afterRendered");
    // Regroupement par document via [data-doc].
    expect(DOCNUM_HANDLER_SCRIPT).toContain("[data-doc]");
    // Garde-fou : feuille sans [data-doc] -> return (compteur global intact).
    expect(DOCNUM_HANDLER_SCRIPT).toContain("if (!holder) return");
    // Écrit le marqueur consommé par la règle CSS d'override.
    expect(DOCNUM_HANDLER_SCRIPT).toContain("docnum-fixed");
    expect(DOCNUM_HANDLER_SCRIPT).toContain("data-docnum");
    // Enregistré comme handler paged.js.
    expect(DOCNUM_HANDLER_SCRIPT).toContain("registerHandlers");
  });

  it("buildFeederDocument injecte le DOCNUM_HANDLER_SCRIPT dans le document", () => {
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="X">B</div>`],
      t, doctitle: "T", cabinetLibelle: "C", polyfillCode: "POLY",
    });
    // Le script (qui définit la classe docnum-fixed) est présent dans le document.
    expect(html).toContain("docnum-fixed");
    expect(html).toContain("window.Paged.registerHandlers(DocNumHandler)");
  });
});
