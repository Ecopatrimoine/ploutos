// ─── Lot 9 — Tokens charte PDF v2 (refonte visuelle) ──────────────────────
//
// Deux thèmes pilotés par le toggle existant (Paramètres → Documents) :
//
//   • "encreOr"   — défaut. Valeurs EXACTES de la maquette
//                   (navy #0F172A / or #C4973D / crème #FAF7F0). Les
//                   dérivés sont figés pour respecter le pixel près.
//
//   • "cabinet"   — les 5 couleurs du cabinet surchargent navy/or/cream.
//                   Les dérivés (texte, filets, fonds) sont CALCULÉS
//                   algorithmiquement par mix de couleurs, pour garantir
//                   le contraste quelles que soient les couleurs cabinet.
//
// 🔴 Aucune couleur en dur ailleurs dans pdf/v2 — toutes les primitives et
// pages consomment ce module. Modifier les couleurs = modifier ici.

export type Theme = "encreOr" | "cabinet";

export type Tokens = {
  // ── Couleurs primaires (surchargeables par le thème cabinet) ──
  navy: string;
  or: string;
  cream: string;
  // ── Texte ──
  texte: string;          // corps de texte
  texteFaible: string;    // texte secondaire
  texteFaibleClair: string;
  eyebrowOr: string;      // or assombri pour eyebrow lisible
  thOr: string;           // or table-header lisible
  kpiOrPale: string;      // or pâle pour KPI à fond navy
  sectionGrisBleu: string;
  // ── Filets / fonds ──
  bordureClaire: string;
  bordureMoyenne: string;
  fondTableau: string;
  fondTableauAlt: string;
  fondEncart: string;
  bordureEncart: string;
  fondSeuilRail: string;
  bordureSeuilRail: string;
  // ── Statut ──
  succes: string;
};

// ─── Helpers de mix / dérivation de couleurs ─────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Mélange linéaire de deux couleurs hex. ratio=0 → c1 pur, ratio=1 → c2 pur. */
function mix(c1: string, c2: string, ratio: number): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const t = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

/** Assombrit une couleur en la mixant avec du noir. */
function darken(c: string, ratio: number): string {
  return mix(c, "#000000", ratio);
}

// ─── Preset Encre & Or (valeurs EXACTES de la maquette) ─────────────────
const ENCRE_OR: Tokens = {
  navy:              "#0F172A",
  or:                "#C4973D",
  cream:             "#FAF7F0",
  texte:             "#3A352B",
  texteFaible:       "#6B6353",
  texteFaibleClair:  "#777060",
  eyebrowOr:         "#8A6A1E",
  thOr:              "#9A7322",
  kpiOrPale:         "#E3C485",
  sectionGrisBleu:   "#5B7089",
  bordureClaire:     "#EEE7D8",
  bordureMoyenne:    "#E4DDCF",
  fondTableau:       "#FBF7EF",
  fondTableauAlt:    "#FBF9F4",
  fondEncart:        "#FBF8F1",
  bordureEncart:     "#ECE3CF",
  fondSeuilRail:     "#F2EEE5",
  bordureSeuilRail:  "#E7D9BF",
  succes:            "#2F7D5B",
};

// ─── Couleurs cabinet attendues depuis le modèle Lot 5 ───────────────────
// (correspond aux clés colorNavy / colorGold / colorCream / colorSky /
//  colorBlue du modèle cabinet existant).
export type CouleursCabinet = {
  navy: string;
  or: string;       // = colorGold
  cream: string;
  sky?: string;     // dérive sectionGrisBleu si présent
  blue?: string;
};

/** Construit les tokens à partir d'un thème (et de couleurs cabinet le cas échéant). */
export function buildTokens(theme: Theme, cabinet?: CouleursCabinet): Tokens {
  if (theme === "encreOr") return { ...ENCRE_OR };
  // Thème "cabinet" — dérivés algorithmiques garantissant le contraste.
  const navy  = cabinet?.navy  || ENCRE_OR.navy;
  const or    = cabinet?.or    || ENCRE_OR.or;
  const cream = cabinet?.cream || ENCRE_OR.cream;
  return {
    navy,
    or,
    cream,
    // Texte : assombrissement progressif du navy pour la hiérarchie typo.
    texte:            mix(navy, "#FFFFFF", 0.18),    // navy → texte foncé lisible
    texteFaible:      mix(navy, "#FFFFFF", 0.28),    // gris
    texteFaibleClair: mix(navy, "#FFFFFF", 0.375),   // beige grisé
    // Or assombri pour les libellés sur fond clair (eyebrow, th).
    eyebrowOr:        darken(or, 0.30),
    thOr:             darken(or, 0.20),
    // Or pâle pour KPI à fond navy.
    kpiOrPale:        mix(or, "#FFFFFF", 0.50),
    // Si le cabinet renseigne sky, on l'utilise pour le titre de section ;
    // sinon repli sur la valeur Encre & Or.
    sectionGrisBleu:  cabinet?.sky || ENCRE_OR.sectionGrisBleu,
    // Filets / fonds : déclinaisons claires de l'or et de la crème.
    bordureClaire:    mix(or,    "#FFFFFF", 0.85),
    bordureMoyenne:   mix(or,    "#FFFFFF", 0.75),
    fondTableau:      mix(cream, "#FFFFFF", 0.30),
    fondTableauAlt:   mix(cream, "#FFFFFF", 0.50),
    fondEncart:       mix(cream, "#FFFFFF", 0.40),
    bordureEncart:    mix(or,    "#FFFFFF", 0.78),
    fondSeuilRail:    mix(cream, "#FFFFFF", 0.20),
    bordureSeuilRail: mix(or,    "#FFFFFF", 0.60),
    // Sémantique : vert succès reste fixe (lisibilité réglementaire).
    succes:           "#2F7D5B",
  };
}

/** URL des polices Fraunces (serif titres) + Lato (corps), via fontsource CDN.
 *  Identique à la maquette refonte_pdf_page_theme_ifi_A4.html. */
export const FONTS_HTML_LINKS = `
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/fraunces/400.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/fraunces/600.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/lato/400.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/lato/700.css">
`;
