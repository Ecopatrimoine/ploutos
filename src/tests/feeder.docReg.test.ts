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
