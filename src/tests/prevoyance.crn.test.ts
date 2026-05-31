// ─── LOT CRN — tests de VALEURS 2026 (vraie entrée JSON CPRN/CRN) ───────────
//
// Lit l'entrée CRN (CPRN, notaires) RÉELLE de caisses-2026.json et valide les
// montants 2026 sourcés cprn.fr :
//   - invalidité PERMANENTE ET TOTALE uniquement (binaire, seuil 100) : rente
//     26 400 €/an jusqu'à 62 ans ;
//   - capital décès forfaitaire 110 000 € ;
//   - arrêt de travail : relais CPAM J4-J90, trou après J90 (aucune IJ caisse).
//
// JSON pur : zéro code moteur ajouté (binaire + uniforme + borneAgeMax existent).

import { describe, it, expect } from "vitest";
import {
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
  computeIJObligatoireJournaliere,
  projeterArretMaladie,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;
const crn = caisses.CRN;
const vars = buildPlafondVariables(referentiels);

// Notaire affilié CPRN. revenuTNSAnnuel sert au relais CPAM des 90 premiers
// jours ; la CPRN ne verse aucune IJ propre.
function entreeCrn(forfait: ForfaitConfig, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse: "CRN",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 80000,
    contratsIndividuels: [],
    couvertureCollective: null,
    forfait,
    ...over,
  };
}

describe("CRN/CPRN 2026 — schéma JSON (cprn.fr)", () => {
  it("forfaitaire, discriminant aucun, invalidité binaire totale (seuil 100), borne 62", () => {
    expect(crn.moteur).toBe("forfaitaire");
    expect(crn.discriminant.type).toBe("aucun");
    expect(crn.invalidite.modeTaux).toBe("binaire");
    expect(crn.invalidite.seuilTauxMinimal).toBe(100);
    expect(crn.invalidite.borneAgeMax).toBe(62);
    expect(crn.invalidite.montantAnnuel100).toEqual({ mode: "uniforme", valeur: 26400 });
    expect(crn.invalidite.majorationEnfantAnnuelle).toBeNull();
    expect(crn.capitalDeces).toMatchObject({ mode: "uniforme", valeur: 110000 });
    expect(crn.ij.phase1.type).toBe("cpam");
    expect(crn.ij.plafondDureeJours).toBeNull();
    expect(crn.ij.montantJournalier).toEqual({ mode: "uniforme", valeur: 0 });
  });
});

describe("CRN/CPRN 2026 — invalidité (totale uniquement)", () => {
  it("âge 45, taux total (100) → 26 400/12 = 2 200/mois", () => {
    const m = forfaitaireInvalMensuel(crn, entreeCrn({ tauxInvalidite: 100 }, { age: 45 }));
    expect(m).toBeCloseTo(26400 / 12, 6);
    expect(m).toBeCloseTo(2200, 6);
  });
  it("âge 45, taux < seuil (ex. 80 = non totale) → 0 (partielle non couverte)", () => {
    const m = forfaitaireInvalMensuel(crn, entreeCrn({ tauxInvalidite: 80 }, { age: 45 }));
    expect(m).toBe(0);
  });
  it("âge 63 (> borneAgeMax 62), taux total → 0 (borne d'âge dépassée)", () => {
    const m = forfaitaireInvalMensuel(crn, entreeCrn({ tauxInvalidite: 100 }, { age: 63 }));
    expect(m).toBe(0);
  });
});

describe("CRN/CPRN 2026 — capital décès", () => {
  it("capital décès forfaitaire → 110 000", () => {
    const cap = forfaitaireCapitalDeces(crn, entreeCrn({ tauxInvalidite: 0 }));
    expect(cap).toBe(110000);
  });
});

describe("CRN/CPRN 2026 — arrêt de travail (relais CPAM, trou après J90)", () => {
  it("J60 relais CPAM > 0 ; J120 trou (0) ; pas de faux 'données indisponibles'", () => {
    const e = entreeCrn({ tauxInvalidite: 0 });
    const result = projeterArretMaladie(e, "cat2", referentiels);

    const idx60 = result.axe.findIndex((p: any) => p.jour === 60);
    const idx120 = result.axe.findIndex((p: any) => p.jour === 120);
    expect(idx60).toBeGreaterThanOrEqual(0);
    expect(idx120).toBeGreaterThanOrEqual(0);

    const expected60 = computeIJObligatoireJournaliere(60, caisses.CPAM, e, vars, "ald")! * 30;
    expect(expected60).toBeGreaterThan(0);
    expect(result.series.ijObligatoire[idx60]).toBeCloseTo(expected60, 2);

    expect(result.series.ijObligatoire[idx120]).toBe(0); // trou après J90
    expect(result.donneesCaisseIndisponibles).toBe(false);
  });
});

describe("CRN/CPRN 2026 — non-régression caisses modèles", () => {
  it("CNBF (binaire parDiscriminant) inchangée : ancienneté < 20 ans, taux ≥ 66 → 9 577/12", () => {
    const cnbf = caisses.CNBF;
    const e = entreeCrn({ tauxInvalidite: 80 }, { caisse: "CNBF", ancienneteMois: 120, age: 50 });
    expect(forfaitaireInvalMensuel(cnbf, e)).toBeCloseTo(9577 / 12, 2);
  });
  it("CAVOM (binaire parDiscriminant) inchangée : classe C taux 80 → 33 070/12 ; capital 70 965", () => {
    const cavom = caisses.CAVOM;
    const e = entreeCrn({ tauxInvalidite: 80, classeOption: "C" }, { caisse: "CAVOM" });
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(33070 / 12, 2);
    expect(forfaitaireCapitalDeces(cavom, e)).toBe(70965);
  });
});
