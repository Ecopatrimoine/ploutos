// ─── Helpers PURS — Madelin prévoyance (Lot B1) ──────────────────────────────
//
// Agrégation des cotisations Madelin saisies en prévoyance + calcul du plafond de
// déduction « prévoyance-santé » (art. 154 bis CGI) et de l'enveloppe
// (disponible / consommé / restant / dépassement). Fonctions PURES, déterministes.
//
// Périmètre Madelin prévoyance (acté) : contrats individuels de type "ij" et
// "invalidite" UNIQUEMENT + contrats de transmission décès (capital). PAS les
// rentes de survivants, PAS les legacy.
//
// IMPORTANT :
//   - AUCUN import de ir.ts / computeBeneficeImposable : le bénéfice imposable est
//     passé EN ARGUMENT (calculé par l'appelant). -> zéro dépendance circulaire.
//   - AUCUNE valeur de PASS en dur : le PASS est passé en argument (source unique
//     referentiels.pass.pass.annuel côté appelant).
//   - AUCUN calcul d'impôt ici (c'est le Lot B2), aucune UI.

import type { PatrimonialData } from "../../types/patrimoine";
import { STATUTS_TNS } from "./constants";

// Garde-fou numérique : tout ce qui n'est pas un nombre fini vaut 0.
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export type LigneCotisationMadelin = { libelle: string; montant: number };

// Libellés d'affichage des cotisations d'incapacité/invalidité (le décès porte son
// propre libellé de contrat).
const LIBELLE_INCAPACITE: Record<string, string> = {
  ij: "Indemnités journalières (IJ)",
  invalidite: "Rente invalidité",
};

// Détail des cotisations Madelin LUES en prévoyance (hors « autre cotisation »
// racine, éditée à part). SOURCE UNIQUE DE FILTRAGE : contrats individuels "ij" /
// "invalidite" + contrats de transmission décès, marqués `deductibleMadelin === true`.
// Montant absent/NaN -> 0. Déterministe.
export function detailCotisationsMadelin(data: PatrimonialData, which: 1 | 2): LigneCotisationMadelin[] {
  const perso = data.prevoyance?.[which === 1 ? "p1" : "p2"];
  const lignes: LigneCotisationMadelin[] = [];

  // Contrats individuels : SEULEMENT "ij" et "invalidite" (tout autre type ignoré,
  // même marqué deductibleMadelin).
  for (const c of perso?.contratsIndividuels ?? []) {
    if ((c.type === "ij" || c.type === "invalidite") && c.deductibleMadelin === true) {
      lignes.push({ libelle: LIBELLE_INCAPACITE[c.type] ?? c.type, montant: num(c.cotisationMadelinAnnuelle) });
    }
  }
  // Contrats de transmission décès (capital) : tous, s'ils sont marqués déductibles.
  for (const c of perso?.contratsTransmissionDeces ?? []) {
    if (c.deductibleMadelin === true) {
      lignes.push({ libelle: c.libelle || "Capital décès", montant: num(c.cotisationMadelinAnnuelle) });
    }
  }
  return lignes;
}

// Somme des cotisations Madelin déductibles d'une personne (`which` = 1 | 2) =
// total du DÉTAIL (contrats prévoyance) + la case « autre cotisation » racine
// (suffixe 1/2). detailCotisationsMadelin est la source unique de filtrage →
// cohérence garantie : somme === Σ(détail) + autre cotisation.
export function sommeCotisationsMadelin(data: PatrimonialData, which: 1 | 2): number {
  const detailTotal = detailCotisationsMadelin(data, which).reduce((s, l) => s + l.montant, 0);
  const autre = num(which === 1 ? data.madelinAutreCotisation1 : data.madelinAutreCotisation2);
  return detailTotal + autre;
}

// Plafond de déduction Madelin prévoyance-santé (art. 154 bis CGI) :
//   plafond = min( 7 % du PASS + 3,75 % du bénéfice imposable , 3 % de 8 PASS ).
// Bénéfice négatif -> traité comme 0 (socle 7 % PASS seul). Pas d'arrondi ici
// (l'UI arrondira à l'affichage) ; résultat clampé >= 0.
export function plafondMadelinPrevoyance(benefice: number, pass: number): number {
  const b = Math.max(0, benefice);
  const plafond = Math.min(0.07 * pass + 0.0375 * b, 0.03 * 8 * pass);
  return Math.max(0, plafond);
}

export type EnveloppeMadelin = {
  cotisations: number;   // total cotisations Madelin (consommé)
  plafond: number;       // disponible
  deductible: number;    // effectivement déductible = min(cotisations, plafond)
  depassement: number;   // part non déductible = max(0, cotisations - plafond)
  depasse: boolean;      // cotisations > plafond
};

// Synthèse de l'enveloppe (consommé vs disponible). Pure, sans effet de bord.
export function enveloppeMadelinPrevoyance(cotisations: number, plafond: number): EnveloppeMadelin {
  return {
    cotisations,
    plafond,
    deductible: Math.min(cotisations, plafond),
    depassement: Math.max(0, cotisations - plafond),
    depasse: cotisations > plafond,
  };
}

// Éligibilité Madelin : la personne `which` a un statut TNS (STATUTS_TNS).
// Même convention d'accès par personne que sommeCotisationsMadelin (p1/p2).
export function estEligibleMadelin(data: PatrimonialData, which: 1 | 2): boolean {
  const statut = data.travail?.[which === 1 ? "p1" : "p2"]?.statutPro ?? "";
  return (STATUTS_TNS as readonly string[]).includes(statut);
}
