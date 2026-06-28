// ─── Garde-fou — auto-suffisance des polices sur les chemins PDF LIVRÉS ─────────
//
// Verrouille l'invariant : le rendu PDF EXPÉDIÉ au client embarque ses polices en
// LOCAL (@font-face Fraunces + Lato, woff2 bundlés par Vite) et ne référence AUCUN
// CDN réseau (jsdelivr / cdn.). Les deux seuls constructeurs de document livrés :
//   - buildFeederDocument  → aperçu paged.js (iframe srcDoc) + offscreen Electron ;
//   - coquilleDocument(... fontsHtml: FONT_FACES_STYLE) → popup runtime (generatePack).
//
// HORS SCOPE (intentionnel) : le défaut jsdelivr de coquilleDocument, exercé
// UNIQUEMENT par le harnais DEV (scripts/generatePdfLocal.ts + render*.ts), jamais
// bundlé ni expédié. Ce test cible donc la FORME LIVRÉE, pas le défaut DEV.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../tokens";
import { buildFeederDocument } from "../engine/feeder";
import { coquilleDocument } from "../primitives";
import { FONT_FACES_STYLE } from "../fontsLocal";

const t = buildTokens("encreOr");

// Double invariant : polices locales présentes (@font-face + 2 familles) ET aucun CDN.
function attendAutoSuffisant(html: string): void {
  expect(html).toContain("@font-face");
  expect(html).toContain("Fraunces");
  expect(html).toContain("Lato");
  expect(html).not.toContain("jsdelivr");
  expect(html).not.toContain("cdn.");
}

describe("Polices PDF — auto-suffisance des chemins LIVRÉS (offline-safe)", () => {
  it("buildFeederDocument (aperçu paged.js + offscreen Electron) : @font-face local, pas de CDN", () => {
    // Entrées minimales valides (mêmes formes que feeder.docReg.test.ts).
    const html = buildFeederDocument({
      bodies: [`<div class="pdf-contrat">Bilan</div>`],
      t,
      doctitle: "Dossier",
      cabinetLibelle: "Cabinet Test — confidentiel",
      polyfillCode: "",
    });
    attendAutoSuffisant(html);
  });

  it("coquilleDocument tel qu'appelé par generatePack (fontsHtml: FONT_FACES_STYLE) : @font-face local, pas de CDN", () => {
    // Forme EXACTE du chemin livré : generatePack passe fontsHtml: FONT_FACES_STYLE
    // (concatPack.ts). On reproduit cet appel au plus près du runtime.
    const html = coquilleDocument(t, {
      titre: "Pack PDF — Dossier client",
      body: `<div class="pdf-contrat">Section</div>`,
      fontsHtml: FONT_FACES_STYLE,
    });
    attendAutoSuffisant(html);
  });

  it("FONT_FACES_STYLE embarque les 2 familles en @font-face, sans CDN", () => {
    expect(FONT_FACES_STYLE).toContain("@font-face");
    expect(FONT_FACES_STYLE).toContain("font-family:'Fraunces'");
    expect(FONT_FACES_STYLE).toContain("font-family:'Lato'");
    expect(FONT_FACES_STYLE).not.toContain("jsdelivr");
    expect(FONT_FACES_STYLE).not.toContain("cdn.");
  });
});
