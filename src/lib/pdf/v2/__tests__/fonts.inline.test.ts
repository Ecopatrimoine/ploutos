// ─── Garde-fou — variante AUTOPORTANTE des polices (export Electron) ────────────
//
// Prouve que FONT_FACES_STYLE_INLINE (et un document livré qui l'embarque) est
// origine-INDÉPENDANT : chaque @font-face porte sa fonte EN PROPRE, sans aucune
// référence réseau. C'est la garantie qu'un export chargé en `data:` (origine
// opaque) ou `file://` rendra les polices PARTOUT (cf. RECON #2 Lot B).
//
// NOTE ENVIRONNEMENT : `?inline` n'est résolu en `data:font/woff2;base64,…` qu'au
// BUILD (vérifié hors-test : un build-lib de fontsInline.ts émet bien ce préfixe).
// Sous vitest (mode serve), l'asset n'est pas inliné et le `src` conserve la
// directive `…woff2?inline`. Le test accepte donc les DEUX formes autoportantes
// (base64 OU `?inline`) — la présence de l'une GARANTIT la base64 à l'export — et
// REJETTE toute forme externe (http(s), jsdelivr, cdn., file://).
//
// Verrouille aussi l'égalité des unicode-range avec la variante URL (fontsLocal.ts).

import { describe, it, expect } from "vitest";
import { buildTokens } from "../tokens";
import { coquilleDocument } from "../primitives";
import { FONT_FACES_STYLE } from "../fontsLocal";
import { FONT_FACES_STYLE_INLINE } from "../fontsInline";

const t = buildTokens("encreOr");

// src autoportant : data: base64 (BUILD) OU directive `?inline` (vitest serve).
const SRC_AUTOPORTANT = /src:url\((?:data:font\/woff2;base64,[^)]*|[^)]*\.woff2\?inline)\)/g;

function attendAutoportant(html: string): void {
  expect(html).toContain("@font-face");
  expect(html).toContain("Fraunces");
  expect(html).toContain("Lato");
  // Aucune dépendance réseau / CDN, aucune référence externe.
  expect(html).not.toContain("jsdelivr");
  expect(html).not.toContain("cdn.");
  expect(html).not.toMatch(/https?:\/\//);
  expect(html).not.toContain("file://");
}

function ranges(style: string): string[] {
  return (style.match(/unicode-range:[^;]+/g) ?? []).slice().sort();
}

describe("Polices PDF — variante AUTOPORTANTE (export Electron origine-indépendant)", () => {
  it("FONT_FACES_STYLE_INLINE : 8 @font-face autoportants (?inline -> base64 au build), zéro ref externe", () => {
    attendAutoportant(FONT_FACES_STYLE_INLINE);
    expect((FONT_FACES_STYLE_INLINE.match(/@font-face/g) ?? []).length).toBe(8);
    // Les 8 src sont tous en forme autoportante (base64 au build / ?inline en serve).
    expect((FONT_FACES_STYLE_INLINE.match(SRC_AUTOPORTANT) ?? []).length).toBe(8);
  });

  it("coquilleDocument(fontsHtml: FONT_FACES_STYLE_INLINE) : document livré autoportant", () => {
    const html = coquilleDocument(t, {
      titre: "Export PDF — Dossier client",
      body: `<div class="pdf-contrat">Section</div>`,
      fontsHtml: FONT_FACES_STYLE_INLINE,
    });
    attendAutoportant(html);
    expect((html.match(SRC_AUTOPORTANT) ?? []).length).toBe(8);
  });

  it("unicode-range IDENTIQUES entre variante inline et variante URL (anti-divergence)", () => {
    expect(ranges(FONT_FACES_STYLE_INLINE)).toEqual(ranges(FONT_FACES_STYLE));
  });
});
