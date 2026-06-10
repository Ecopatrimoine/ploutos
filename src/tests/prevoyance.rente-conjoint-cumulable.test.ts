// ─── LOT BTP-4 — rente conjoint "cibleCumulable" : CUMUL avec la rente éducation ─
//
// Miroir du test d'EXCLUSIVITÉ substitutive HCR (prevoyance.hcr-1979.test.ts :
// « 1 enfant ouvrant droit → AUCUNE rente conjoint »). Pour le mode cibleCumulable
// (BTP/RNPO), la rente conjoint doit être versée MÊME en présence d'un enfant
// ouvrant droit à la rente éducation. Aucune CCN réelle ne porte ce mode → on
// injecte une convention de test dans le référentiel (nettoyée en afterAll).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const TEST_IDCC = "9988";

// Convention de test (mono-collège non-cadre) : rente conjoint cibleCumulable
// (12 %, fin 64 ans) + une rente éducation (pour prouver le CUMUL des deux).
beforeAll(() => {
  (referentiels.ccn as any).conventions[TEST_IDCC] = {
    nom: "BTP Test cumulable",
    plafondSalaireRefPass: 8,
    prevoyanceNonCadres: {
      garantiesMinimum: {
        renteConjoint: { mode: "cibleCumulable", tauxSalaireRef: 0.12, finAgeDefunt: 64, beneficiaires: ["conjoint", "pacs", "concubin"] },
        renteEducation: { mode: "trancheAge", tranches: [{ deAge: 0, aAge: 26, tauxSalaireRef: 0.10, minimumPass: 0 }] },
      },
    },
  };
});
afterAll(() => {
  delete (referentiels.ccn as any).conventions[TEST_IDCC];
});

function employeurCcn(idcc: string, nom: string): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "TEST", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: nom, sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  } as unknown as EmployeurInfo;
}
function travailDefunt(statut: string, employeur: EmployeurInfo, brut: number): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: "CPAM", employeur,
      dateEmbauche: "2010-01-01", dateDebutActivite: "2010-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: brut,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}
function childAge(firstName: string, age: number): PatrimonialData["childrenData"][number] {
  return {
    firstName, lastName: "Martin", birthDate: `${2026 - age}-01-01`,
    parentLink: "common_child", custody: "full", rattached: true, handicap: false,
  } as unknown as PatrimonialData["childrenData"][number];
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1986-01-01", // défunt, 40 ans en 2026
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1988-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    ...over,
  } as unknown as PatrimonialData;
}
function baseSuccession(): SuccessionData {
  return {
    deceasedPerson: "person1", spouseOption: "legal_quarter_full",
    heirs: [], testamentHeirs: [], legsPrecisItems: [], spousePresent: true,
    useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

describe("Rente conjoint cibleCumulable — CUMUL avec la rente éducation (LOT BTP-4)", () => {
  it("marié, 1 enfant 10 ans (ouvre droit) → rente conjoint PRÉSENTE + rente éducation présente", () => {
    const s = computeSuccession(
      baseSuccession(),
      baseData({
        coupleStatus: "married",
        childrenData: [childAge("Lea", 10)],
        travail: travailDefunt("salarie_non_cadre", employeurCcn(TEST_IDCC, "BTP Test"), 30000),
      })
    );
    const rc = s.capitalDecesLines.renteConjointBranche;
    // CUMUL : là où la substitutive HCR serait à 0, la cibleCumulable est versée.
    expect(rc).toHaveLength(1);
    expect(rc[0].montantAnnuel).toBeCloseTo(0.12 * 30000, 2); // 3600 (salaireRef 30000 < 8 PASS)
    expect(rc[0].dureeMaxAnnees).toBe(24);                    // 64 − 40
    expect(rc[0].beneficiaireNom).toContain("Marie");        // survivant = person2
    // …ET la rente éducation est servie simultanément.
    expect(s.capitalDecesLines.renteEducationBranche.length).toBeGreaterThan(0);
  });

  it("défunt 64 ans (≥ âge légal) → durée nulle → aucune rente conjoint", () => {
    const s = computeSuccession(
      baseSuccession(),
      baseData({
        coupleStatus: "married",
        person1BirthDate: "1962-01-01", // 64 ans en 2026 → durée 0
        travail: travailDefunt("salarie_non_cadre", employeurCcn(TEST_IDCC, "BTP Test"), 30000),
      })
    );
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
  });
});
