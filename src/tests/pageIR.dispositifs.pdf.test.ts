// LOT E — Dispositifs fiscaux dans le PDF (cascade pageIR).
// Chaîne réelle : computeIR -> buildIRData -> pageIR (HTML généré, pas de snapshot).
// Doctrine : validation sur le HTML réellement produit.
import { describe, it, expect } from "vitest";
import { computeIR } from "../lib/calculs/ir";
import { buildIRData } from "../lib/pdf/v2/adapters/buildIRData";
import { pageIR } from "../lib/pdf/v2/pages/pageIR";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property } from "../types/patrimoine";

const t = buildTokens("encreOr");
const BASE = {
  person1FirstName: "David", person1LastName: "Test", person1BirthDate: "1980-01-01", person1JobTitle: "S", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "100000", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const REEL = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "real", other1: "0", other2: "0" } as any;
const MICRO = { ...REEL, foncierRegime: "micro" } as any;
const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "", value: "200000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
// Intl.NumberFormat fr-FR sépare avec des espaces insécables (U+202F / U+00A0) : on normalise.
const norm = (s: string) => s.replace(/ | /g, " ");
const html = (data: any, opts: any) => norm(pageIR(t, buildIRData({ ir: computeIR(data, opts), data, cabinet: { cabinetName: "Cabinet Test" }, clientName: "Test", dateLettre: "03 juillet 2026" })));

const pinel = prop({ id: "p1", name: "Appartement Pinel", type: "Location nue", dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9" }); // 4166.67
const jeanbrun = prop({ id: "j1", name: "Logement Jeanbrun", type: "Location nue", dispositifFiscal: "jeanbrunRelanceLogement", dispositifAnnee: "2026", dispositifNeufAncien: "neuf", dispositifNiveauLoyer: "social", dispositifBase: "200000", rentGrossAnnual: "16000", propertyTaxAnnual: "3000", otherChargesAnnual: "2000" }); // amort 7200

describe("pageIR — dispositifs dans la cascade", () => {
  it("réduction Pinel 4 166,67 + amortissement Jeanbrun 7 200 + note 150 VB", () => {
    const out = html({ ...BASE, coupleStatus: "married", person2FirstName: "C", person2LastName: "T", properties: [pinel, jeanbrun] }, REEL);
    expect(out).toContain("Réduction Pinel");
    expect(out).toContain("4 166,67 €");
    expect(out).toContain("amortissement Jeanbrun Relance logement");
    expect(out).toContain("7 200 €");
    expect(out).toContain("art. 150 VB"); // mention plus-value
  });

  it("statut non-ok : Censi sur SCPI -> note incoherent avec nom du bien et label lisible", () => {
    const scpiCensi = prop({ id: "s1", name: "Studio Perpignan", type: "SCPI", dispositifFiscal: "censiBouvard", dispositifAnnee: "2019", dispositifBase: "180000" });
    const out = html({ ...BASE, properties: [scpiCensi] }, MICRO);
    expect(out).toContain("Censi-Bouvard");        // label, jamais l'id
    expect(out).toContain("Studio Perpignan");     // nom du bien
    expect(out).not.toContain("censiBouvard");     // pas d'id technique
  });

  it("dossier SANS dispositif : aucune ligne dispositif ni note (section masquée)", () => {
    const out = html({ ...BASE, properties: [prop({ id: "b", type: "Location nue", rentGrossAnnual: "9000", propertyTaxAnnual: "1000" })] }, REEL);
    expect(out).not.toContain("Réduction ");
    expect(out).not.toContain("amortissement Jeanbrun");
    expect(out).not.toContain("150 VB");
    expect(out).not.toContain("Plafonnement global des niches");
    // la cascade d'origine reste intacte
    expect(out).toContain("Revenus bruts");
    expect(out).toContain("Revenu net imposable");
    expect(out).toContain("Impôt sur le revenu");
  });
});
