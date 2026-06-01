// ─── CIPAV PARTIELLE — verrou du comportement « 2 seuils » de la coupure ──
//
// Lot « coupure invalidité à 62 ans » : DEUX seuils distincts.
//   - Pension OBLIGATOIRE : coupée à max(62, cutoff caisse). Pour la CIPAV
//     PARTIELLE (tauxInvalidite < 100), le cutoff caisse est 67 ans
//     (cutoffAgePartielle) → la pension survit entre 62 et 67, puis 0.
//     Source lacipav.fr : pension d'invalidité partielle « cesse le mois
//     suivant le 67e anniversaire ».
//   - COMPLÉMENTS (collective + Madelin individuelle) : coupés à 62 STRICT
//     (bascule retraite, règle générale ; hypothèse prudente sur les termes
//     Madelin variables par contrat).
//
// Ce test VERROUILLE ce comportement fin (sinon régression silencieuse) :
// le cas d'or CIPAV principal est en cat2 totale (cutoff 62) avec
// ageRetraite 64, donc il ne couvre jamais la fenêtre 62→67. Ici on force
// age 50 / ageRetraite 67 pour que la projection traverse 62 ET 67.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { CipavConfig, EntreePerso, ProjectionResult } from "../lib/prevoyance/types";

function idxJour(axe: ProjectionResult["axe"], j: number): number {
  return axe.findIndex((p) => p.jour === j);
}

// CIPAV partielle (taux 80 ∈ [66,99] → cutoffAgePartielle 67), age 50 /
// ageRetraite 67 pour que finJour = (67-50)*365 = 6205 couvre 62 et 67.
// La phase invalidité démarre à J1095 = âge 53 → fenêtre 53→62 avant la
// coupure des compléments. Un contrat Madelin invalidité FORFAITAIRE garantit
// renteInvalIndividuelle > 0 (sinon le test « Madelin coupé » serait vide).
// NB : pour la branche CIPAV, c'est entree.cipav.tauxInvalidite (80) qui pilote
// le cutoff 67 ; la categorie "cat2" passée au moteur n'intervient pas ici.
const entree: EntreePerso = {
  age: 50,
  ageRetraite: 67,
  statutPro: "tns_liberal",
  caisse: "CIPAV",
  idccCCN: null,
  ancienneteMois: 180,
  salaireBrutAnnuel: 0,
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 60000,
  nbEnfantsACharge: 0,
  contratsIndividuels: [
    { id: "madelin_inv", type: "invalidite", nature: "forfaitaire", capitalOuMontant: 0, baseInvalidite: 0.5 },
  ],
  couvertureCollective: null,
  cipav: {
    revenuBNC_N2: 60000,
    ancienneteAffiliationMois: 180,
    cumulEmploiRetraite: false,
    tauxInvalidite: 80, // partielle → cutoff 67
    marie: false,
    nbEnfants: 0,
    decesAccidentel: false,
  } as CipavConfig,
};

const r = projeterArretMaladie(entree, "cat2", referentiels);

// Jours cibles (tous multiples de 365, donc exactement sur l'axe annuel) :
const J_AGE_61 = (61 - 50) * 365; // 4015 — avant 62, en invalidité (≥ J1095)
const J_AGE_62 = (62 - 50) * 365; // 4380 — bascule retraite (compléments coupés)
const J_AGE_64 = (64 - 50) * 365; // 5110 — entre 62 et 67
const J_AGE_67 = (67 - 50) * 365; // 6205 — cutoff partiel CIPAV (= finJour)

describe("CIPAV partielle — coupure invalidité à 2 seuils (pension 67 / compléments 62)", () => {
  it("garde-fou de cohérence : les 4 jours cibles existent bien sur l'axe", () => {
    for (const j of [J_AGE_61, J_AGE_62, J_AGE_64, J_AGE_67]) {
      expect(idxJour(r.axe, j)).toBeGreaterThanOrEqual(0);
    }
  });

  it("pension obligatoire CIPAV survit entre 62 et 67 (> 0 à l'âge 64)", () => {
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, J_AGE_64)]).toBeGreaterThan(0);
    // Et toujours servie juste après 62 (âge 64 ≥ 62) : la coupure pension
    // n'intervient PAS à 62 pour une partielle (cutoff caisse 67 > 62).
  });

  it("pension obligatoire CIPAV coupée à 67 (== 0 au dernier point, âge 67)", () => {
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, J_AGE_67)]).toBe(0);
  });

  it("compléments (Madelin individuelle) actifs avant 62, coupés dès 62", () => {
    // Avant 62 (âge 61, en phase invalidité) : Madelin forfaitaire servi.
    expect(r.series.renteInvalIndividuelle[idxJour(r.axe, J_AGE_61)]).toBeGreaterThan(0);
    // À partir de 62 : coupé, alors même que la pension obligatoire court encore.
    expect(r.series.renteInvalIndividuelle[idxJour(r.axe, J_AGE_62)]).toBe(0);
    expect(r.series.renteInvalIndividuelle[idxJour(r.axe, J_AGE_64)]).toBe(0);
  });
});
