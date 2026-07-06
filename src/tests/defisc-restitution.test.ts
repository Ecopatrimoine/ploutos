// LOT 3 — Restitution défiscalisation : buildIRData + page PDF (cascade).
// Deux dossiers de contrôle :
//   A : FCPI 12000 (15/01/2026) + Pinel -> deux réductions visibles, PAS d'écrêtement.
//   B : SOFICA 18000 + 2 Pinel (communs saturés) -> écrêtement DOUBLE enveloppe visible.
import { describe, it, expect } from "vitest";
import { computeIR } from "../lib/calculs/ir";
import { buildIRData } from "../lib/pdf/v2/adapters/buildIRData";
import { pageIR } from "../lib/pdf/v2/pages/pageIR";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property, Placement } from "../types/patrimoine";

const t = buildTokens("encreOr");
const norm = (s: string) => s.replace(/ | /g, " ");
const BASE = {
  person1FirstName: "Test", person1LastName: "IR", person1BirthDate: "1980-01-01", person1JobTitle: "S", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "100000", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const MICRO = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "", value: "300000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const plac = (o: any): Placement => ({
  id: "x", name: "P", type: "Compte-titres", ownership: "person1", value: "0", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "",
  pfuEligible: false, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "",
  annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [], ...o,
} as Placement);
const pinel = (id: string, base: string, annee: string) => prop({ id, type: "Location nue", dispositifFiscal: "pinel", dispositifAnnee: annee, dispositifBase: base, dispositifEngagementAns: "9" });
const html = (data: any) => norm(pageIR(t, buildIRData({ ir: computeIR(data, MICRO), data, cabinet: { cabinetName: "Cabinet Test" } })));

describe("Restitution PDF — dossier A (FCPI + Pinel, sans écrêtement)", () => {
  const dataA = {
    ...BASE, salary1: "100000",
    properties: [pinel("p", "250000", "2023")], // 4166,67
    placements: [plac({ id: "f", type: "FCPI", defiscalisation: { dispositif: "fcpi", montantSouscrit: "12000", dateInvestissement: "2026-01-15" } })], // 3000
  };
  it("les deux réductions apparaissent avec libellés corrects + mention millésime FCPI", () => {
    const irData = buildIRData({ ir: computeIR(dataA, MICRO), data: dataA, cabinet: { cabinetName: "T" } });
    const labels = irData.reductionsDispositifs!.map((r) => r.label);
    expect(labels).toContain("Pinel");
    expect(labels).toContain("FCPI (investissement 2026)"); // libellé court financier + millésime
    expect(irData.ecretementNiches).toBe(0);
    const fcpi = irData.reductionsDispositifs!.find((r) => r.label.startsWith("FCPI"))!;
    expect(fcpi.montant).toBeCloseTo(3000, 2); // 12000 x 0.25
  });
  it("PDF : les deux lignes de réduction, aucune ligne d'écrêtement", () => {
    const out = html(dataA);
    expect(out).toContain("Réduction Pinel");
    expect(out).toContain("Réduction FCPI (investissement 2026)");
    expect(out).not.toContain("Plafonnement des niches");
  });
});

describe("Restitution PDF — dossier B (SOFICA + 2 Pinel, écrêtement double enveloppe)", () => {
  const dataB = {
    ...BASE, salary1: "200000",
    properties: [pinel("pa", "300000", "2020"), pinel("pb", "300000", "2020")], // 6000 + 6000 = 12000 communs
    placements: [plac({ id: "s", type: "SOFICA", defiscalisation: { dispositif: "sofica", montantSouscrit: "18000", dateInvestissement: "2026-06-01", tauxSofica: "48" } })], // 8640
  };
  const ir = computeIR(dataB, MICRO);
  it("socle : communs retenus 10000, SOFICA retenue 8000, écrêtement 2000 + 640 = 2640", () => {
    const df = ir.dispositifsFiscaux;
    expect(df.ecretementCommun).toBeCloseTo(2000, 2);
    expect(df.ecretementMajore).toBeCloseTo(640, 2);
    expect(df.ecretementNiches).toBeCloseTo(2640, 2);
    const sofica = df.reductions.find((r: any) => r.id.startsWith("sofica"))!;
    expect(sofica.impute).toBeCloseTo(8000, 2); // 18000 - 10000 communs retenus
    const communs = df.reductions.filter((r: any) => r.id.startsWith("pinel")).reduce((s: number, r: any) => s + r.impute, 0);
    expect(communs).toBeCloseTo(10000, 2);
  });
  it("buildIRData : expose la ventilation d'écrêtement + label SOFICA", () => {
    const irData = buildIRData({ ir, data: dataB, cabinet: { cabinetName: "T" } });
    expect(irData.ecretementCommun).toBeCloseTo(2000, 2);
    expect(irData.ecretementMajore).toBeCloseTo(640, 2);
    const sofica = irData.reductionsDispositifs!.find((r) => r.label.startsWith("SOFICA"))!;
    expect(sofica.label).toBe("SOFICA (investissement 2026)");
    expect(sofica.montant).toBeCloseTo(8000, 2);
  });
  it("PDF : ligne d'écrêtement double enveloppe (10 000 € : 2 000 ; majorée 18 000 € : 640) + total 2 640 non imputés", () => {
    const out = html(dataB);
    expect(out).toContain("Plafonnement des niches (art. 200-0 A)");
    expect(out).toContain("enveloppe 10 000 € : 2 000 €");
    expect(out).toContain("enveloppe majorée 18 000 € : 640 €");
    expect(out).toContain("2 640 € non imputés");
  });
});
