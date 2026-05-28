// ─── Fixture fuzzing module Prévoyance (PLAN_TESTS T1, familles A/B) ────
//
// Générateur PSEUDO-aléatoire DÉTERMINISTE (seed fixe) d'EntreePerso,
// pour tester que le moteur ne produit jamais NaN/négatif/Infinity/crash
// quelles que soient les entrées (spec fuzzing A1/A2, 200 profils).

import type {
  CategorieInvalidite,
  ContratIndividuel,
  CouvertureCollective,
  EntreePerso,
} from "../../lib/prevoyance/types";
import type { CodeCaisse, StatutPro } from "../../types/patrimoine";

// PRNG mulberry32 — rapide, déterministe, suffisant pour du fuzzing.
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUTS: StatutPro[] = [
  "salarie_non_cadre", "salarie_cadre",
  "tns_liberal", "tns_commercant", "tns_artisan",
  "gerant_majoritaire", "president_sas", "eurl_unique",
  "fonctionnaire", "retraite", "sans_activite",
];

const CAISSES: CodeCaisse[] = [
  "CPAM", "SSI", "MSA", "CARMF", "CARCDSF", "CARPV",
  "CARPIMKO", "CIPAV", "CNBF", "CAVOM", "CAVEC", "CAVAMAC", "CRN",
];

const TYPES_CONTRAT: ContratIndividuel["type"][] = [
  "deces_capital", "deces_rente_conj", "deces_rente_educ",
  "ij", "invalidite", "ptia", "dependance", "gav",
];

const CATEGORIES: CategorieInvalidite[] = ["cat1", "cat2", "cat3"];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

function randomContrat(rng: () => number, i: number): ContratIndividuel {
  const type = pick(rng, TYPES_CONTRAT);
  return {
    id: `fuzz_${i}`,
    type,
    capitalOuMontant: intBetween(rng, 0, 400000),
    franchiseJours: type === "ij" ? pick(rng, [0, 15, 30, 90, 180]) : undefined,
    plafondJoursIJ: type === "ij" ? pick(rng, [365, 730, 1095]) : undefined,
    baseInvalidite: type === "invalidite" ? rng() : undefined,
  };
}

function randomCouverture(rng: () => number): CouvertureCollective | null {
  if (rng() < 0.5) return null;
  return {
    ij: {
      pctSalaire: rng() * 1.2,
      franchise: pick(rng, [0, 30, 90, 180]),
      plafondJours: pick(rng, [365, 730, 1095]),
      baseCalcul: pick(rng, ["T1_T2", "T1_seul", "brut_total"] as const),
    },
    invalidite: {
      cat1: { pctSalaire: rng() },
      cat2: { pctSalaire: rng() },
      cat3: { pctSalaire: rng() * 1.2 },
    },
    capitalDeces: { montant: intBetween(rng, 0, 500000) },
  };
}

export function generateRandomEntree(rng: () => number): { entree: EntreePerso; categorie: CategorieInvalidite } {
  const age = intBetween(rng, 18, 66);
  const statutPro = pick(rng, STATUTS);
  const nbContrats = intBetween(rng, 0, 5);
  const contratsIndividuels = Array.from({ length: nbContrats }, (_, i) => randomContrat(rng, i));
  const salaireBrutAnnuel = intBetween(rng, 0, 300000);
  const entree: EntreePerso = {
    age,
    ageRetraite: 64,
    statutPro,
    caisse: rng() < 0.95 ? pick(rng, CAISSES) : null,
    idccCCN: rng() < 0.5 ? pick(rng, ["1486", "3248", "9999", "16"]) : null,
    ancienneteMois: intBetween(rng, 0, 480),
    salaireBrutAnnuel,
    salaireNetMensuel: rng() < 0.5 ? (salaireBrutAnnuel * 0.78) / 12 : 0,
    revenuTNSAnnuel: rng() < 0.5 ? intBetween(rng, 0, 300000) : undefined,
    classeCotisationCaisse: rng() < 0.3 ? pick(rng, ["A", "B", "C"]) : undefined,
    nbEnfantsACharge: intBetween(rng, 0, 5),
    contratsIndividuels,
    couvertureCollective: randomCouverture(rng),
  };
  return { entree, categorie: pick(rng, CATEGORIES) };
}

// Génère N profils déterministes à partir d'une seed.
export function generateProfils(n: number, seed = 1234): Array<{ entree: EntreePerso; categorie: CategorieInvalidite }> {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => generateRandomEntree(rng));
}
