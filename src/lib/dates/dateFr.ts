// ─── Util dates FR — conversion JJ/MM/AAAA <-> ISO yyyy-mm-dd ──────────────
//
// Fonctions PURES, sans effet de bord, indépendantes de la locale du navigateur.
// Le stockage reste l'ISO "yyyy-mm-dd" (identique à l'existant). Ces helpers ne
// servent QUE la saisie/affichage : parse la saisie masquée FR vers l'ISO,
// formate l'ISO stocké vers l'affichage FR. Aucun impact sur les calculs.

function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

/** Nombre de jours du mois (1-12), 29 en février bissextile. */
function joursDuMois(mois: number, annee: number): number {
  const jours = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mois === 2 && estBissextile(annee)) return 29;
  return jours[mois - 1];
}

/** Bornes d'année plausibles (larges) pour une date de naissance / événement. */
const ANNEE_MIN = 1900;
const ANNEE_MAX = 2100;

/**
 * Parse une saisie "JJ/MM/AAAA" et rend l'ISO "yyyy-mm-dd" si la date est
 * COMPLETE et VALIDE, sinon null.
 * Rejette : format incomplet, année à 2 chiffres, mois > 12, jour hors du
 * nombre de jours réel du mois (gère 30/31 et 29/02 bissextile), année hors
 * [1900, 2100].
 */
export function parseDateFr(saisie: string): string | null {
  if (typeof saisie !== "string") return null;
  const s = saisie.trim();
  // Format strict : 2 chiffres / 2 chiffres / 4 chiffres (année 2 chiffres rejetée).
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const jour = Number(m[1]);
  const mois = Number(m[2]);
  const annee = Number(m[3]);
  if (annee < ANNEE_MIN || annee > ANNEE_MAX) return null;
  if (mois < 1 || mois > 12) return null;
  if (jour < 1 || jour > joursDuMois(mois, annee)) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Formate un ISO "yyyy-mm-dd" en "JJ/MM/AAAA" pour l'affichage.
 * Rend "" si l'entrée est vide, mal formée, ou représente une date irréelle
 * (mois > 12, jour hors du mois). Ne borne PAS l'année (formatage pur).
 */
export function formatIsoVersFr(iso: string): string {
  if (typeof iso !== "string") return "";
  const s = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "";
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  const jour = Number(m[3]);
  if (mois < 1 || mois > 12) return "";
  if (jour < 1 || jour > joursDuMois(mois, annee)) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
