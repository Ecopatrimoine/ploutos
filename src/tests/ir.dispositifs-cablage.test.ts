// LOT D2 — Câblage des dispositifs fiscaux dans le moteur IR (deux branches).
// Verrou ISO : tout dossier SANS dispositif -> finalIR identique au centime.
// anneeFiscale du moteur = referentiels.pass.millesime (2026) : Pinel 2023/9 actif.
import { describe, it, expect } from "vitest";
import { computeIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property } from "../types/patrimoine";

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
const MICRO = { expenseMode1: "standard" as const, expenseMode2: "standard" as const, km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const REEL = { ...MICRO, foncierRegime: "real" } as any;

const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full",
  usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "",
  worksAnnual: "", otherChargesAnnual: "", loanEnabled: false, loanType: "amortissable", loanAmount: "",
  loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "",
  loanInsuranceRate1: "", loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque",
  indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const child = (schoolLevel: string, parentLink: string, birthDate: string) => ({ firstName: "E", lastName: "T", birthDate, parentLink, custody: "full", rattached: true, handicap: false, schoolLevel });
const dispo = (ir: any) => ir.dispositifsFiscaux;
const pinel = (o: any = {}) => prop({ type: "Location nue", dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9", ...o }); // 250000x0.15/9 = 4166.67

describe("ISO — dossier sans dispositif inchangé au centime", () => {
  it("e1/e2/miroir identiques (aucun bien dispositif)", () => {
    const e1 = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000", childrenData: [child("college", "person1_only", "2010-01-01")] }, MICRO);
    const e2 = computeIR({ ...BASE_DATA, coupleStatus: "married", salary1: "80000", person2FirstName: "C", person2LastName: "T", childrenData: [child("lycee", "common_child", "2008-01-01"), child("superieur", "common_child", "2004-01-01")] }, MICRO);
    const miroir = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000", childrenData: [child("college", "person1_only", "2010-01-01")] }, MICRO);
    expect(e1.finalIR).toBeCloseTo(7435.99, 2);
    expect(e2.finalIR).toBeCloseTo(3857.98, 2);
    expect(miroir.finalIR).toBeCloseTo(5794.985, 3);
  });
  it("bien SANS dispositif -> finalIR identique au dossier sans le bien de dispositif", () => {
    const ref = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "80000", properties: [prop({ type: "Location nue", rentGrossAnnual: "6000" })] }, MICRO);
    const vide = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "80000", properties: [prop({ type: "Location nue", rentGrossAnnual: "6000", dispositifFiscal: "" })] }, MICRO);
    expect(ref.finalIR).toBeCloseTo(vide.finalIR, 6);
    expect(dispo(vide).statuts).toEqual([]);
  });
});

describe("Foyer commun — réduction Pinel", () => {
  it("Pinel 2023/9/250000, impôt confortable -> finalIR baisse d'exactement 4166,67", () => {
    const sans = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "100000", properties: [prop({ dispositifFiscal: "" })] }, MICRO);
    const avec = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "100000", properties: [pinel({ id: "b" })] }, MICRO);
    expect(sans.finalIR - avec.finalIR).toBeCloseTo(4166.67, 2);
    const r = dispo(avec).reductions.find((x: any) => x.id.startsWith("pinel"));
    expect(r.impute).toBeCloseTo(4166.67, 2);
  });

  it("réduction > impôt -> finalIR 0, perte tracée (montant > imputé)", () => {
    const sans = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "30000", properties: [prop({ dispositifFiscal: "" })] }, MICRO);
    const avec = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "30000", properties: [pinel({ id: "b" })] }, MICRO);
    expect(avec.finalIR).toBeCloseTo(0, 2);
    const r = dispo(avec).reductions.find((x: any) => x.id.startsWith("pinel"));
    expect(r.montant).toBeCloseTo(4166.67, 2);
    expect(r.impute).toBeCloseTo(sans.finalIR, 2); // imputé = impôt disponible
    expect(r.montant).toBeGreaterThan(r.impute);   // fraction perdue tracée
  });

  it("deux dispositifs plafonnables 6000+6000 -> écrêtement niches (imputé plafonné à 10000)", () => {
    // Pinel 2020/9/300000 = 300000x0.18/9 = 6000 chacun
    const p = (id: string) => pinel({ id, dispositifAnnee: "2020", dispositifBase: "300000" });
    const sans = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "200000", properties: [prop({ id: "a", dispositifFiscal: "" }), prop({ id: "b", dispositifFiscal: "" })] }, MICRO);
    const avec = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "200000", properties: [p("a"), p("b")] }, MICRO);
    // 12000 plafonnables -> plafond 10000 -> baisse = 10000 (pas 12000)
    expect(sans.finalIR - avec.finalIR).toBeCloseTo(10000, 2);
    const imputes = dispo(avec).reductions.filter((x: any) => x.id.startsWith("pinel")).reduce((s: number, x: any) => s + x.impute, 0);
    expect(imputes).toBeCloseTo(10000, 2);
  });
});

describe("Concubins — attribution par propriétaire + plafond par concubin", () => {
  const cohab = (props: Property[]) => computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "80000", salary2: "80000", person2FirstName: "C", person2LastName: "T", properties: props }, MICRO);
  it("Pinel du concubin 1 (ownership person1) -> une seule réduction, 4166,67", () => {
    const sans = cohab([prop({ id: "b", ownership: "person1", dispositifFiscal: "" })]);
    const avec = cohab([pinel({ id: "b", ownership: "person1" })]);
    expect(sans.finalIR - avec.finalIR).toBeCloseTo(4166.67, 2);
    const reds = dispo(avec).reductions.filter((x: any) => x.id.startsWith("pinel"));
    expect(reds.length).toBe(1);
    expect(reds[0].impute).toBeCloseTo(4166.67, 2);
  });
  it("Pinel en indivision 50/50 -> moitié chacun (2 entrées ~2083,335)", () => {
    const avec = cohab([pinel({ id: "b", ownership: "indivision", indivisionShare1: "50", indivisionShare2: "50" })]);
    const reds = dispo(avec).reductions.filter((x: any) => x.id.startsWith("pinel"));
    expect(reds.length).toBe(2);
    expect(reds[0].montant).toBeCloseTo(2083.335, 2);
    expect(reds.reduce((s: number, x: any) => s + x.impute, 0)).toBeCloseTo(4166.67, 2);
  });
  it("plafond niches PAR concubin : P1 6000 + P2 6000 -> baisse 12000 (pas 10000 combiné)", () => {
    const p = (id: string, own: string) => pinel({ id, ownership: own, dispositifAnnee: "2020", dispositifBase: "300000" });
    const sans = cohab([prop({ id: "a", ownership: "person1", dispositifFiscal: "" }), prop({ id: "b", ownership: "person2", dispositifFiscal: "" })]);
    const avec = cohab([p("a", "person1"), p("b", "person2")]);
    expect(sans.finalIR - avec.finalIR).toBeCloseTo(12000, 2); // chacun 6000 < 10000 -> aucun écrêtement
  });
});

describe("Jeanbrun — déduction foncière au réel + interaction déficit", () => {
  const jb = (o: any) => prop({ type: "Location nue", dispositifFiscal: "jeanbrunRelanceLogement", dispositifAnnee: "2026", dispositifNeufAncien: "neuf", ...o });
  it("neuf tresSocial base 300000, loyers 1000 -> amortissement 12000 crée un déficit plafonné à 10 700", () => {
    const d = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000", properties: [jb({ id: "b", dispositifBase: "300000", dispositifNiveauLoyer: "tresSocial", rentGrossAnnual: "1000" })] }, REEL);
    // retenu 12000 (plafond tresSocial), chargesReel - loyers = 12000-1000 = 11000 -> déficit imputé plafonné 10 700
    expect(dispo(d).jeanbrun.parBien[0].montantRetenu).toBeCloseTo(12000, 2);
    expect(d.deficitFoncierImpute).toBeCloseTo(10700, 2);
    expect(d.deficitFoncierReportable).toBeCloseTo(300, 2); // 11000 - 10700
    expect(d.taxableFonciers).toBeCloseTo(-10700, 2);
  });
  it("micro + Jeanbrun -> impôt STRICTEMENT identique au dossier sans dispositif + statut incompatible", () => {
    const sans = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000", properties: [prop({ id: "b", type: "Location nue", rentGrossAnnual: "5000", dispositifFiscal: "" })] }, MICRO);
    const avec = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000", properties: [jb({ id: "b", dispositifBase: "300000", dispositifNiveauLoyer: "tresSocial", rentGrossAnnual: "5000" })] }, MICRO);
    expect(avec.finalIR).toBeCloseTo(sans.finalIR, 6); // micro inchangé
    expect(dispo(avec).jeanbrun).toBeNull();
    expect(dispo(avec).statuts.some((s: any) => s.statut === "incompatible")).toBe(true);
  });
});

describe("Statuts non-ok toujours remontés", () => {
  it("Censi sur SCPI -> aucune réduction + statut incoherent", () => {
    const d = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "80000", properties: [prop({ id: "b", type: "SCPI", dispositifFiscal: "censiBouvard", dispositifAnnee: "2019", dispositifBase: "180000" })] }, MICRO);
    const reds = dispo(d).reductions.filter((x: any) => x.id.startsWith("censi"));
    expect(reds.length).toBe(0);
    expect(dispo(d).statuts.some((s: any) => s.statut === "incoherent")).toBe(true);
  });
});
