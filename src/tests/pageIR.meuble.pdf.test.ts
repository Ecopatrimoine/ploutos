// LOT 3 — Bloc "Location meublee (BIC)" dans le PDF IR (chaine reelle
// computeIR -> buildIRData -> pageIR, HTML genere). Miroir du bloc TabIR, aucun
// recalcul local. Le bien meuble ne doit apparaitre dans AUCUN agregat foncier.
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
  childrenData: [], salary1: "40000", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const MICRO = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "", value: "200000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const norm = (s: string) => s.replace(/ | /g, " ");
const build = (data: any, opts: any = MICRO) => buildIRData({ ir: computeIR(data, opts), data, cabinet: { cabinetName: "Cabinet Test" }, clientName: "Test", dateLettre: "07 juillet 2026" });
const html = (data: any, opts: any = MICRO) => norm(pageIR(t, build(data, opts)));

describe("pageIR — bloc Location meublee (BIC)", () => {
  it("micro : section + regime + base + PS revenus du patrimoine + ligne cascade", () => {
    const out = html({ ...BASE, properties: [prop({ type: "LMNP", name: "Studio", rentGrossAnnual: "12000" })] });
    expect(out).toContain("Location meublée (BIC)");
    expect(out).toContain("Micro-BIC");
    expect(out).toContain("6 000 €"); // base
    expect(out).toContain("Prélèvements sociaux revenus du patrimoine (LFSS 2026)");
    expect(out).toContain("Bénéfice location meublée (BIC)"); // ligne cascade
  });

  it("reel deficitaire : ARD (art. 39 C) + deficit non imputable (art. 156 I-1 ter)", () => {
    const out = html({ ...BASE, properties: [prop({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "10000", chargesReelles: "13000", amortissementAnnuelManuel: "5000" })] });
    expect(out).toContain("Amortissement en report (ARD)");
    expect(out).toContain("report illimité, art. 39 C");
    expect(out).toContain("non imputable au revenu global, art. 156 I-1 ter");
  });

  it("frontiere : bien LMNP absent des agregats fonciers (fonciers = 0)", () => {
    const d = build({ ...BASE, properties: [prop({ type: "LMNP", rentGrossAnnual: "12000" })] });
    expect(d.fonciers).toBe(0);              // le meuble n'entre pas dans le foncier
    expect(d.meubleDetail && d.meubleDetail.length).toBe(1);
    expect(d.meubleBaseTotale).toBe(6000);
  });

  it("dossier SANS bien meuble : section masquee (Location nue)", () => {
    const out = html({ ...BASE, properties: [prop({ type: "Location nue", rentGrossAnnual: "12000" })] });
    expect(out).not.toContain("Location meublée (BIC)");
  });

  it("LMP : encart 'Statut LMP probable' dans la page IR", () => {
    const out = html({ ...BASE, properties: [prop({ type: "LMP", rentGrossAnnual: "12000" })] });
    expect(out).toContain("Statut LMP probable");
  });
});
