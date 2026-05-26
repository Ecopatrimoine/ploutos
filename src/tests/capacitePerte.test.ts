// ─── Tests Lot 6 — module capacitePerte (dérivée du patrimoine) ────────────

import { describe, it, expect } from "vitest";
import {
  computeCapacitePerte,
  CAPACITE_PERTE_SEUILS,
} from "../lib/conformite/capacitePerte";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData } from "../types/patrimoine";

// ─── Fabrique de PatrimonialData minimaliste pour les tests ─────────────────
function makeData(overrides: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Test", person1BirthDate: "1980-01-01",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "5",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "5",
    coupleStatus: "single", matrimonialRegime: "separation_biens", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "", salary2: "", pensions: "", pensions1: "", pensions2: "",
    csgDeductibleFoncier: "",
    perDeduction: "", pensionDeductible: "", otherDeductible: "", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    ...overrides,
  } as PatrimonialData;
}

// Helper pour placement cash (livret/fonds €).
function cash(value: string, type = "Livret A") {
  return {
    name: "Test", type, ownership: "person1", value,
    annualIncome: "", taxableIncome: "", deathValue: "", openDate: "",
    pfuEligible: false, pfuOptOut: false,
    totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "",
    exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "",
  } as any;
}

describe("computeCapacitePerte — niveau de base d'après le coussin liquide", () => {
  it("aucun cash, aucun revenu → faible (0 mois)", () => {
    const r = computeCapacitePerte(makeData());
    expect(r.niveau).toBe("faible");
    expect(r.ratioMois).toBe(0);
  });

  it("cash > 0 sans revenu → ratio borné à 999 → élevée", () => {
    const r = computeCapacitePerte(makeData({ placements: [cash("50000")] }));
    expect(r.ratioMois).toBe(999);
    expect(r.niveau).toBe("élevée");
  });

  it("cash = 3 mois de revenus → faible (< 6)", () => {
    // revenu annuel 36 000 → mensuel 3 000 → 9 000 / 3 000 = 3 mois
    const r = computeCapacitePerte(makeData({
      salary1: "36000",
      placements: [cash("9000")],
    }));
    expect(Math.round(r.ratioMois)).toBe(3);
    expect(r.niveau).toBe("faible");
  });

  it("cash = 6 mois → modérée (seuil inclusif côté haut)", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000", placements: [cash("18000")],
    }));
    expect(Math.round(r.ratioMois)).toBe(6);
    expect(r.niveau).toBe("modérée");
  });

  it("cash = 12 mois → moyenne", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000", placements: [cash("36000")],
    }));
    expect(Math.round(r.ratioMois)).toBe(12);
    expect(r.niveau).toBe("moyenne");
  });

  it("cash = 24 mois → élevée", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000", placements: [cash("72000")],
    }));
    expect(Math.round(r.ratioMois)).toBe(24);
    expect(r.niveau).toBe("élevée");
  });
});

describe("computeCapacitePerte — pénalité endettement > 40 %", () => {
  it("endettement = 50 % du patrimoine total → -1 cran (élevée → moyenne)", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000",
      placements: [cash("72000")],  // 24 mois → élevée
      properties: [{
        name: "RP", type: "habitation_principale", ownership: "person1",
        propertyRight: "full", usufructAge: "",
        value: "100000",  // patrimoine total = 72k + 100k = 172k
        propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "",
        worksAnnual: "", otherChargesAnnual: "",
        loanEnabled: true, loanType: "amortissable",
        loanAmount: "100000", loanRate: "", loanDuration: "",
        loanStartDate: "", loanCapitalRemaining: "100000",  // endettement = 100k / 172k ≈ 58 %
        loanInterestAnnual: "", loanPledgedPlacementIndex: "",
        loanInsurance: false, loanInsuranceGuarantees: "",
        loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
        loanInsurancePremium: "", loanInsuranceCoverage: "",
        indivisionShare1: "", indivisionShare2: "",
      } as any],
    }));
    expect(r.endettementRatio).toBeGreaterThan(CAPACITE_PERTE_SEUILS.endettementMax);
    expect(r.niveau).toBe("moyenne");
    expect(r.justification.some(j => /Endettement/i.test(j))).toBe(true);
  });

  it("endettement < 40 % → pas de rétrogradation", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000",
      placements: [cash("72000")],
      properties: [{
        name: "RP", type: "habitation_principale", ownership: "person1",
        propertyRight: "full", usufructAge: "",
        value: "300000",
        propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "",
        worksAnnual: "", otherChargesAnnual: "",
        loanEnabled: true, loanType: "amortissable",
        loanAmount: "50000", loanRate: "", loanDuration: "",
        loanStartDate: "", loanCapitalRemaining: "50000",  // 50k / 372k ≈ 13 %
        loanInterestAnnual: "", loanPledgedPlacementIndex: "",
        loanInsurance: false, loanInsuranceGuarantees: "",
        loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
        loanInsurancePremium: "", loanInsuranceCoverage: "",
        indivisionShare1: "", indivisionShare2: "",
      } as any],
    }));
    expect(r.endettementRatio).toBeLessThan(CAPACITE_PERTE_SEUILS.endettementMax);
    expect(r.niveau).toBe("élevée");
    expect(r.justification.every(j => !/Endettement/i.test(j))).toBe(true);
  });
});

describe("computeCapacitePerte — pénalité revenu unique du couple", () => {
  it("couple, P1 seul a un revenu → -1 cran", () => {
    const r = computeCapacitePerte(makeData({
      person2FirstName: "Marie",
      salary1: "36000",
      placements: [cash("72000")],  // 24 mois → élevée
    }));
    expect(r.niveau).toBe("moyenne");  // élevée → moyenne
    expect(r.justification.some(j => /Revenu unique/i.test(j))).toBe(true);
  });

  it("couple avec deux revenus → pas de pénalité", () => {
    const r = computeCapacitePerte(makeData({
      person2FirstName: "Marie",
      salary1: "30000", salary2: "30000",
      placements: [cash("120000")],  // 24 mois → élevée
    }));
    expect(r.niveau).toBe("élevée");
    expect(r.justification.every(j => !/Revenu unique/i.test(j))).toBe(true);
  });

  it("célibataire (pas de couple) → pas de pénalité revenu unique", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000",
      placements: [cash("72000")],
    }));
    expect(r.niveau).toBe("élevée");
    expect(r.justification.every(j => !/Revenu unique/i.test(j))).toBe(true);
  });
});

describe("computeCapacitePerte — cumul des pénalités, plancher = faible", () => {
  it("modérée + endettement + revenu unique → faible (plancher)", () => {
    const r = computeCapacitePerte(makeData({
      person2FirstName: "Marie",
      salary1: "36000",                  // P2 sans revenu → revenu unique
      placements: [cash("18000")],       // 6 mois → modérée
      properties: [{
        name: "RP", type: "habitation_principale", ownership: "person1",
        propertyRight: "full", usufructAge: "", value: "100000",
        propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "",
        worksAnnual: "", otherChargesAnnual: "",
        loanEnabled: true, loanType: "amortissable",
        loanAmount: "80000", loanRate: "", loanDuration: "",
        loanStartDate: "", loanCapitalRemaining: "80000",  // 80k / 118k ≈ 68 %
        loanInterestAnnual: "", loanPledgedPlacementIndex: "",
        loanInsurance: false, loanInsuranceGuarantees: "",
        loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
        loanInsurancePremium: "", loanInsuranceCoverage: "",
        indivisionShare1: "", indivisionShare2: "",
      } as any],
    }));
    expect(r.niveau).toBe("faible");  // modérée -1 (endett) = faible ; -1 (rev) plancher
  });
});

describe("computeCapacitePerte — robustesse types string vides", () => {
  it("placements sans value lisible → ignorés", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36000",
      placements: [cash(""), cash("not-a-number"), cash("18000")],
    }));
    expect(Math.round(r.ratioMois)).toBe(6);
  });

  it("séparateurs (espaces, virgules) acceptés", () => {
    const r = computeCapacitePerte(makeData({
      salary1: "36 000",
      placements: [cash("18 000,50")],
    }));
    expect(r.niveau).toBe("modérée");
  });
});
