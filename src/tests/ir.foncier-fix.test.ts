// LOT FIX-FONCIER — exposition additive (jeanbrunRetenu, foncierChargesTotal).
// Le moteur (finalIR, PS, taxableFonciers) est INCHANGE : verrous ISO + la card
// dispose desormais de la charge totale (amortissement Jeanbrun inclus).
import { describe, it, expect } from "vitest";
import { computeIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property } from "../types/patrimoine";

const BASE = {
  person1FirstName: "T", person1LastName: "IR", person1BirthDate: "1980-01-01",
  person1JobTitle: "S", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false, childrenData: [],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const MICRO = { expenseMode1: "standard" as const, expenseMode2: "standard" as const, km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const REEL = { ...MICRO, foncierRegime: "real" } as any;
const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "",
  value: "200000", propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "",
  otherChargesAnnual: "", loanEnabled: false, loanType: "amortissable", loanAmount: "", loanRate: "",
  loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "", loanPledgedPlacementIndex: "-1",
  loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
  loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const child = (schoolLevel: string, parentLink: string, birthDate: string) => ({ firstName: "E", lastName: "T", birthDate, parentLink, custody: "full", rattached: true, handicap: false, schoolLevel });

describe("ISO moteur — champs additifs sans effet sur finalIR", () => {
  it("e1/e2/miroir inchangés au centime", () => {
    const e1 = computeIR({ ...BASE, coupleStatus: "single", salary1: "60000", childrenData: [child("college", "person1_only", "2010-01-01")] }, MICRO);
    const e2 = computeIR({ ...BASE, coupleStatus: "married", salary1: "80000", person2FirstName: "C", person2LastName: "T", childrenData: [child("lycee", "common_child", "2008-01-01"), child("superieur", "common_child", "2004-01-01")] }, MICRO);
    const miroir = computeIR({ ...BASE, coupleStatus: "cohab", salary1: "60000", childrenData: [child("college", "person1_only", "2010-01-01")] }, MICRO);
    expect(e1.finalIR).toBeCloseTo(7435.99, 2);
    expect(e2.finalIR).toBeCloseTo(3857.98, 2);
    expect(miroir.finalIR).toBeCloseTo(5794.985, 3);
  });
});

describe("Exposition foncierChargesTotal / jeanbrunRetenu (fiche : réel 3800, pas 11000)", () => {
  const jbBien = prop({ id: "b", dispositifFiscal: "jeanbrunRelanceLogement", dispositifAnnee: "2026", dispositifNeufAncien: "neuf", dispositifNiveauLoyer: "social", dispositifBase: "200000", rentGrossAnnual: "16000", propertyTaxAnnual: "3000", otherChargesAnnual: "2000" });
  it("réel : jeanbrunRetenu 7200, foncierChargesTotal 12200, net card 3800", () => {
    const ir: any = computeIR({ ...BASE, coupleStatus: "single", salary1: "60000", properties: [jbBien] }, REEL);
    expect(ir.foncierBrut).toBeCloseTo(16000, 2);
    expect(ir.jeanbrunRetenu).toBeCloseTo(7200, 2);          // 200000 x 0.80 x 0.045
    expect(ir.foncierChargesTotal).toBeCloseTo(12200, 2);    // 5000 charges + 7200 amortissement
    // Formule exacte utilisée par la card :
    const reelVal = Math.max(0, ir.foncierBrut - ir.foncierChargesTotal - ir.foncierInterests);
    expect(reelVal).toBeCloseTo(3800, 2);                    // et NON 11000 (sans jeanbrun)
    expect(ir.taxableFonciers).toBeCloseTo(3800, 2);         // cohérent avec le moteur
  });
  it("micro : jeanbrunRetenu 0 (barrière douce), foncierChargesTotal = foncierCharges", () => {
    const ir: any = computeIR({ ...BASE, coupleStatus: "single", salary1: "60000", properties: [jbBien] }, MICRO);
    expect(ir.jeanbrunRetenu).toBe(0);
    expect(ir.foncierChargesTotal).toBeCloseTo(ir.foncierCharges, 6);
  });
  it("sans jeanbrun : foncierChargesTotal = foncierCharges (additif neutre)", () => {
    const ir: any = computeIR({ ...BASE, coupleStatus: "single", salary1: "60000", properties: [prop({ id: "b", rentGrossAnnual: "9000", propertyTaxAnnual: "1000" })] }, REEL);
    expect(ir.jeanbrunRetenu).toBe(0);
    expect(ir.foncierChargesTotal).toBeCloseTo(ir.foncierCharges, 6);
  });
});
