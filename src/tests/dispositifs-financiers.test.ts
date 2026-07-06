// LOT 1 — Défiscalisation financière : résolveur (C1-C9) + câblage moteur (C10-C11).
// Valeurs vérifiées à la main / Python. anneeFiscale du moteur = referentiels.pass.millesime (2026).
import { describe, it, expect } from "vitest";
import { resolveReductionFinanciere } from "../lib/fiscal/dispositifs-financiers-resolveur";
import { computeIR, appliquerReductionsIR, type ReductionIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property, Placement, DefiscalisationPlacement } from "../types/patrimoine";

const ctx = (rng: number, couple = false) => ({ couple, rng });
const defisc = (o: Partial<DefiscalisationPlacement>): DefiscalisationPlacement =>
  ({ dispositif: "irpme", montantSouscrit: "", dateInvestissement: "2026-06-01", ...o } as DefiscalisationPlacement);

// ─── C1-C9 : résolveur pur ────────────────────────────────────────────────────
describe("resolveReductionFinanciere — SOFICA", () => {
  it("(C1) 48%, versement 18000, RNG 100000 -> reduction 8640", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "sofica", montantSouscrit: "18000", tauxSofica: "48" }), 2026, ctx(100000));
    expect(r).not.toBeNull();
    expect(r!.baseRetenue).toBeCloseTo(18000, 2); // min(18000, 25000, 18000)
    expect(r!.montant).toBeCloseTo(8640, 2);      // 18000 x 0.48
    expect(r!.plafondNiches).toBe("majore");
    expect(r!.fractionPlafond).toBe(1);
  });

  it("(C2) 48%, versement 18000, RNG 40000 -> base 10000, reduction 4800", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "sofica", montantSouscrit: "18000", tauxSofica: "48" }), 2026, ctx(40000));
    expect(r!.baseRetenue).toBeCloseTo(10000, 2); // min(18000, 0.25*40000=10000, 18000)
    expect(r!.montant).toBeCloseTo(4800, 2);      // 10000 x 0.48
  });
});

describe("resolveReductionFinanciere — FCPI / FCPI JEI", () => {
  it("(C3) FCPI 15/01/2026, versement 15000, celibataire -> base 12000, taux 0.25, reduction 3000", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "fcpi", montantSouscrit: "15000", dateInvestissement: "2026-01-15" }), 2026, ctx(50000, false));
    expect(r!.baseRetenue).toBe(12000);         // min(15000, plafond seul 12000)
    expect(r!.montant).toBeCloseTo(3000, 2);    // 12000 x 0.25 (fenetre 28/09/2025 -> 20/02/2026)
    expect(r!.plafondNiches).toBe("commun");
    expect(r!.alertes.some((a) => a.code === "excedent_versement")).toBe(true);
  });

  it("(C4) FCPI 01/03/2026 -> reduction 0 + alerte hors fenetre", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "fcpi", montantSouscrit: "15000", dateInvestissement: "2026-03-01" }), 2026, ctx(50000));
    expect(r!.montant).toBe(0);                 // supprime a compter du 21/02/2026
    expect(r!.alertes.some((a) => a.code === "hors_fenetre")).toBe(true);
  });

  it("(C5) FCPI JEI, versement 40000, couple -> reduction 12000, plafondNiches false", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "fcpiJei", montantSouscrit: "40000" }), 2026, ctx(80000, true));
    expect(r!.montant).toBeCloseTo(12000, 2);   // min(40000, 150000) x 0.30 = 12000, plafond propre 50000 non atteint
    expect(r!.plafondNiches).toBe(false);       // n'entame aucune enveloppe globale
  });

  it("(C9) FCPI JEI, reduction annee ~20000, dejaConsommee 40000 -> retenue 10000", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "fcpiJei", montantSouscrit: "66667", reductionJeiDejaConsommee: "40000" }), 2026, ctx(80000, false));
    // 0.30 x min(66667, 75000) = 20000,1 ; reste propre = 50000 - 40000 = 10000 -> min = 10000
    expect(r!.montant).toBeCloseTo(10000, 2);
  });
});

describe("resolveReductionFinanciere — IR-PME / Girardin", () => {
  it("(C6) Girardin plein droit, attestation 11500 -> reduction 11500, conso enveloppe majoree 5060", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "girardinIndustriel", montantReductionGirardin: "11500", regimeGirardin: "pleinDroit" }), 2026, ctx(0));
    expect(r!.montant).toBeCloseTo(11500, 2);
    expect(r!.fractionPlafond).toBeCloseTo(0.44, 4);
    expect(r!.montant * r!.fractionPlafond!).toBeCloseTo(5060, 2); // 11500 x 0.44
    expect(r!.plafondNiches).toBe("majore");
  });

  it("(C7) IR-PME direct, versement 60000, celibataire -> base 50000, reduction 9000, alerte excedent 10000", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "irpme", montantSouscrit: "60000" }), 2026, ctx(80000, false));
    expect(r!.baseRetenue).toBe(50000);         // min(60000, plafond seul 50000)
    expect(r!.montant).toBeCloseTo(9000, 2);    // 50000 x 0.18
    const exc = r!.alertes.find((a) => a.code === "excedent_versement");
    expect(exc).toBeTruthy();
    expect(exc!.message).toContain("10000");    // 60000 - 50000 non reportable
  });

  it("(C8) FCPI souscrit 15/06/2024, annee simulee 2026 -> null (aucune reduction, aucune alerte d'erreur)", () => {
    const r = resolveReductionFinanciere(defisc({ dispositif: "fcpi", montantSouscrit: "15000", dateInvestissement: "2024-06-15" }), 2026, ctx(50000));
    expect(r).toBeNull(); // investissement d'une autre annee : comportement normal (engagement reste affichable via le bloc)
  });
});

// ─── C10-C11 : câblage moteur (computeIR) ─────────────────────────────────────
const BASE_DATA = {
  person1FirstName: "Test", person1LastName: "IR", person1BirthDate: "1980-01-01",
  person1JobTitle: "Salarié", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const MICRO = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;

const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full",
  usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "",
  worksAnnual: "", otherChargesAnnual: "", loanEnabled: false, loanType: "amortissable", loanAmount: "",
  loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "",
  loanInsuranceRate1: "", loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque",
  indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const plac = (o: any): Placement => ({
  id: "x", name: "P", type: "Compte-titres", ownership: "person1", value: "0",
  annualIncome: "", taxableIncome: "", deathValue: "", openDate: "",
  pfuEligible: false, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "",
  premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "",
  annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "",
  perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [], ...o,
} as Placement);
const dispo = (ir: any) => ir.dispositifsFiscaux;

describe("Câblage moteur — intégration défiscalisation financière", () => {
  it("(C10) SOFICA 8640 + Pinel 6000, meme foyer -> commun 6000, total 14640 <= 18000, rien ecrete, finalIR = 60000 - 14640 = 45360", () => {
    // (a) preuve socle exacte : bareme 60000, deux enveloppes.
    const liste: ReductionIR[] = [
      { id: "pinel_b", label: "Pinel", montant: 6000, plafondNiches: "commun" },
      { id: "sofica_x", label: "SOFICA", montant: 8640, plafondNiches: "majore", fractionPlafond: 1 },
    ];
    const socle = appliquerReductionsIR(60000, liste, 10000, 18000);
    expect(socle.ecretementNiches).toBeCloseTo(0, 6);   // commun 6000<=10000 ; global 14640<=18000
    expect(socle.impotFinal).toBeCloseTo(45360, 6);     // 60000 - 14640

    // (b) intégration bout-en-bout : le foyer combine Pinel (bien) + SOFICA (placement).
    const pinel = prop({ id: "b", dispositifFiscal: "pinel", dispositifAnnee: "2020", dispositifBase: "300000", dispositifEngagementAns: "9" }); // 6000
    const sofica = plac({ id: "s", defiscalisation: { dispositif: "sofica", montantSouscrit: "18000", dateInvestissement: "2026-06-01", tauxSofica: "48" } }); // 8640
    const sans = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "200000", properties: [prop({ id: "b", dispositifFiscal: "" })], placements: [] }, MICRO);
    const avec = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "200000", properties: [pinel], placements: [sofica] }, MICRO);
    expect(sans.finalIR - avec.finalIR).toBeCloseTo(14640, 2); // 6000 + 8640, tout imputé
    expect(dispo(avec).ecretementNiches).toBeCloseTo(0, 2);    // rien d'écrêté
    const impPinel = dispo(avec).reductions.find((r: any) => r.id.startsWith("pinel"));
    const impSofica = dispo(avec).reductions.find((r: any) => r.id.startsWith("sofica"));
    expect(impPinel.impute).toBeCloseTo(6000, 2);
    expect(impSofica.impute).toBeCloseTo(8640, 2);
  });

  it("(C11) Concubins : le placement défisc du concubin A (ownership person1) ne réduit QUE l'IR de A", () => {
    const irpmeP1 = plac({ id: "d", ownership: "person1", defiscalisation: { dispositif: "irpme", montantSouscrit: "50000", dateInvestissement: "2026-06-01" } }); // 9000
    const irpmeP2 = plac({ id: "d", ownership: "person2", defiscalisation: { dispositif: "irpme", montantSouscrit: "50000", dateInvestissement: "2026-06-01" } });
    const base = { ...BASE_DATA, coupleStatus: "cohab", salary1: "100000", salary2: "0", person2FirstName: "C", person2LastName: "T" };
    const sans = computeIR({ ...base, placements: [] }, MICRO);
    const avecP1 = computeIR({ ...base, placements: [irpmeP1] }, MICRO);
    const avecP2 = computeIR({ ...base, placements: [irpmeP2] }, MICRO);
    // A (person1) a du barème -> la réduction 9000 s'impute intégralement.
    expect(sans.finalIR - avecP1.finalIR).toBeCloseTo(9000, 0);
    // B (person2) sans revenu -> aucun barème -> la même réduction ne s'impute pas (0).
    expect(sans.finalIR - avecP2.finalIR).toBeCloseTo(0, 2);
    // La réduction est bien attribuée au foyer de A.
    const red = dispo(avecP1).reductions.find((r: any) => r.id.startsWith("irpme"));
    expect(red.impute).toBeCloseTo(9000, 0);
  });
});
