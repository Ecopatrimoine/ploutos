// ─── Fixture conformité DDA — assureurs & produits interdits ───────────
//
// Liste MAINTENUE des noms d'assureurs / mutuelles / institutions de
// prévoyance qui ne doivent JAMAIS apparaître dans un constat produit
// par le module Prévoyance (art. L.521-4 C. ass. — le module produit
// des BESOINS, jamais une recommandation d'organisme ou de produit).
//
// Réutilisée par tous les tests de la famille E. À compléter au fil
// des acteurs rencontrés.

// Acronymes / marques NON ambigus en français → détection insensible
// à la casse (AXA, axa, Axa…).
const ASSUREURS_INSENSIBLES: string[] = [
  "AXA", "Generali", "Apicil", "Allianz", "CNP", "SwissLife", "Swiss Life",
  "Aviva", "MAAF", "Matmut", "GAN", "MMA", "Macif", "Groupama", "Malakoff",
  "Humanis", "AG2R", "Entoria", "Kereis", "Alptis", "Cardif", "Metlife",
  "Klesia", "Probtp", "Pro BTP",
];

// Marques HOMOGRAPHES d'un mot courant français → détection SENSIBLE à
// la casse. La marque s'écrit avec une majuscule initiale ; le mot
// courant en minuscule (« peut prévoir », « en harmonie ») ne doit pas
// déclencher de faux positif.
const ASSUREURS_SENSIBLES: string[] = [
  "Prévoir", "Harmonie", "April", "Abeille", "Gerber",
];

// Liste complète (pour affichage / documentation).
export const ASSUREURS_INTERDITS: string[] = [
  ...ASSUREURS_INSENSIBLES,
  ...ASSUREURS_SENSIBLES,
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const REGEX_ASSUREURS_INTERDITS = new RegExp(
  "\\b(" + ASSUREURS_INSENSIBLES.map(escapeRegex).join("|") + ")\\b",
  "i"
);

const REGEX_ASSUREURS_SENSIBLES = new RegExp(
  "\\b(" + ASSUREURS_SENSIBLES.map(escapeRegex).join("|") + ")\\b"
);

// Renvoie le nom d'assureur interdit trouvé dans le texte, ou null.
export function trouveAssureurInterdit(texte: string): string | null {
  const m1 = texte.match(REGEX_ASSUREURS_INTERDITS);
  if (m1) return m1[1];
  const m2 = texte.match(REGEX_ASSUREURS_SENSIBLES);
  if (m2) return m2[1];
  return null;
}

// Noms de gammes commerciales génériques : un mot-clé marketing suivi
// d'une majuscule (= nom de produit, ex. « Pack Pro », « Sérénité + »).
export const REGEX_PRODUITS_COMMERCIAUX =
  /\b(Pack|Sérénité|Serenite|Confort|Premium|Formule)\s+[A-ZÉÈÀ0-9]/;

// Verbes prescriptifs interdits en tête d'action (DDA : on ne pousse
// pas à souscrire / choisir un produit précis).
export const REGEX_VERBES_PRESCRIPTIFS = /^\s*(Souscrire|Choisir|Prendre|Achetez?|Optez?)/i;

// Verbes d'analyse attendus en tête des actions de constats INDIVIDUELS.
export const VERBES_ANALYSE = ["Évaluer", "Vérifier", "Étudier", "Analyser", "Quantifier"];

export function actionCommenceParVerbeAnalyse(action: string): boolean {
  const a = action.trimStart();
  return VERBES_ANALYSE.some((v) => a.startsWith(v));
}

// Liste FERMÉE des verbes impératifs autorisés pour les actions
// correctives de conformité collective (obligations légales de
// l'employeur). Objectif : empêcher qu'un « Souscrire » déguisé en
// obligation passe un jour. Toute action collective doit commencer
// par l'un de ces verbes.
export const VERBES_OBLIGATION_AUTORISES = [
  "Mettre en place", "Mettre à jour", "Régulariser",
  "Vérifier", "Documenter", "Formaliser", "Établir",
];

export function actionCommenceParVerbeObligation(action: string): boolean {
  const a = action.trimStart();
  return VERBES_OBLIGATION_AUTORISES.some((v) => a.startsWith(v));
}
