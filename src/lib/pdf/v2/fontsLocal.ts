// ─── Self-host des polices PDF (Fraunces + Lato) ───────────────────────────────
//
// Remplace les <link> jsdelivr (réseau) par des @font-face dont les woff2 sont
// BUNDLÉS par Vite → rendu PDF fidèle SANS dépendance réseau (export Electron
// offline, et aperçu hors-ligne).
//
// Module VITE-ONLY : importé uniquement par le feeder (aperçu iframe srcDoc +
// fenêtre offscreen Electron) et par generatePack (popup runtime). Le harnais DEV
// `tsx` (scripts/generatePdfLocal.ts) NE passe PAS par ici — il garde les <link>
// réseau via le défaut de coquilleDocument ; un `import '*.woff2'` y planterait
// (tsx/esbuild n'a pas de loader d'asset).
//
// Graisses bundlées = LES SEULES réellement rendues : Fraunces 400/600, Lato
// 400/700, sous-ensembles latin + latin-ext (couvre le français + les patronymes
// d'Europe centrale). Styles normaux uniquement (l'italique reste synthétisé, comme
// avec les <link> précédents). unicode-range, font-display:swap et noms de fichiers
// repris À L'IDENTIQUE de @fontsource.

import frL400 from "@fontsource/fraunces/files/fraunces-latin-400-normal.woff2";
import frE400 from "@fontsource/fraunces/files/fraunces-latin-ext-400-normal.woff2";
import frL600 from "@fontsource/fraunces/files/fraunces-latin-600-normal.woff2";
import frE600 from "@fontsource/fraunces/files/fraunces-latin-ext-600-normal.woff2";
import laL400 from "@fontsource/lato/files/lato-latin-400-normal.woff2";
import laE400 from "@fontsource/lato/files/lato-latin-ext-400-normal.woff2";
import laL700 from "@fontsource/lato/files/lato-latin-700-normal.woff2";
import laE700 from "@fontsource/lato/files/lato-latin-ext-700-normal.woff2";

// unicode-range @fontsource (latin / latin-ext) — identiques pour Fraunces et Lato.
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

// URL absolue, robuste pour les documents ISOLÉS (iframe srcDoc, popup about:blank,
// offscreen Electron file://) qui n'ont pas de base fiable pour résoudre du relatif.
// On résout contre la base du document app. Repli (env node des tests, sans
// `document`) : URL telle quelle — ces contextes ne rendent pas les polices.
function abs(url: string): string {
  return typeof document !== "undefined" ? new URL(url, document.baseURI).href : url;
}

function face(family: string, weight: number, url: string, range: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${abs(url)}) format('woff2');unicode-range:${range};}`;
}

/** Bloc <style> de @font-face locaux, injecté dans la <head> des documents PDF. */
export const FONT_FACES_STYLE = `<style>
${face("Fraunces", 400, frL400, LATIN)}
${face("Fraunces", 400, frE400, LATIN_EXT)}
${face("Fraunces", 600, frL600, LATIN)}
${face("Fraunces", 600, frE600, LATIN_EXT)}
${face("Lato", 400, laL400, LATIN)}
${face("Lato", 400, laE400, LATIN_EXT)}
${face("Lato", 700, laL700, LATIN)}
${face("Lato", 700, laE700, LATIN_EXT)}
</style>`;
