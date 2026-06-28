// ─── Variante AUTOPORTANTE des polices PDF (base64 inline) ──────────────────────
//
// MÊMES 8 @font-face que fontsLocal.ts (variante URL), MAIS les woff2 sont INLINÉS
// en data: URI base64 (import Vite `?inline`) → document 100 % origine-indépendant :
// les polices se rendent depuis N'IMPORTE QUELLE origine, y compris un document
// `data:` (origine opaque) ou `file://`. C'est la forme requise pour l'export
// Electron via webContents.printToPDF (cf. RECON #2 Lot B : un document `data:` ne
// peut PAS charger de woff2 `file://` externes — origine opaque bloquée).
//
// LAZY : module SÉPARÉ, destiné à un `await import("./fontsInline")` AU MOMENT DE
// L'EXPORT uniquement. AUCUN import statique côté app → les ~165 Ko de base64 ne
// sont PAS dans le bundle des pages. L'aperçu et le popup gardent la variante URL
// légère (fontsLocal.ts / FONT_FACES_STYLE), inchangée.
//
// unicode-range + font-display:swap IDENTIQUES à la variante URL — égalité
// verrouillée par fonts.inline.test.ts (compare les unicode-range des 2 variantes).

import frL400 from "@fontsource/fraunces/files/fraunces-latin-400-normal.woff2?inline";
import frE400 from "@fontsource/fraunces/files/fraunces-latin-ext-400-normal.woff2?inline";
import frL600 from "@fontsource/fraunces/files/fraunces-latin-600-normal.woff2?inline";
import frE600 from "@fontsource/fraunces/files/fraunces-latin-ext-600-normal.woff2?inline";
import laL400 from "@fontsource/lato/files/lato-latin-400-normal.woff2?inline";
import laE400 from "@fontsource/lato/files/lato-latin-ext-400-normal.woff2?inline";
import laL700 from "@fontsource/lato/files/lato-latin-700-normal.woff2?inline";
import laE700 from "@fontsource/lato/files/lato-latin-ext-700-normal.woff2?inline";

// unicode-range @fontsource (latin / latin-ext) — IDENTIQUES à fontsLocal.ts.
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

// `dataUri` = data:font/woff2;base64,… (déjà autoportant, aucune résolution externe).
function face(family: string, weight: number, dataUri: string, range: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${dataUri}) format('woff2');unicode-range:${range};}`;
}

/** Bloc <style> de @font-face 100 % inline (base64), pour l'export origine-indépendant. */
export const FONT_FACES_STYLE_INLINE = `<style>
${face("Fraunces", 400, frL400, LATIN)}
${face("Fraunces", 400, frE400, LATIN_EXT)}
${face("Fraunces", 600, frL600, LATIN)}
${face("Fraunces", 600, frE600, LATIN_EXT)}
${face("Lato", 400, laL400, LATIN)}
${face("Lato", 400, laE400, LATIN_EXT)}
${face("Lato", 700, laL700, LATIN)}
${face("Lato", 700, laE700, LATIN_EXT)}
</style>`;
