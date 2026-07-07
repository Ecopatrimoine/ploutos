// LOT 0 LMNP/LMP — Branchement du circuit BIC meuble dans computeIR (2 chemins).
// Arbitrage B (David 07/07/2026) : les types "LMNP"/"LMP" existants SORTENT du
// foncier et ENTRENT en BIC meuble. Consequence assumee : un dossier portant un
// bien LMNP/LMP change de resultat IR. Les tests documentent l'AVANT / l'APRES.
import { describe, it, expect } from "vitest";
import { computeIR, collecteRevenusActiviteFoyer } from "../lib/calculs/ir";
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

// ─── Preuve 1 — Triplet d'or iso au centime (AUCUN bien meuble) ──────────────
describe("LMNP — non-regression : triplet d'or inchange (aucun bien meuble)", () => {
  it("e1 / e2 / miroir strictement iso au centime", () => {
    const e1 = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000", childrenData: [child("college", "person1_only", "2010-01-01")] }, MICRO);
    const e2 = computeIR({ ...BASE_DATA, coupleStatus: "married", salary1: "80000", person2FirstName: "C", person2LastName: "T", childrenData: [child("lycee", "common_child", "2008-01-01"), child("superieur", "common_child", "2004-01-01")] }, MICRO);
    const miroir = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000", childrenData: [child("college", "person1_only", "2010-01-01")] }, MICRO);
    expect(e1.finalIR).toBeCloseTo(7435.99, 2);
    expect(e2.finalIR).toBeCloseTo(3857.98, 2);
    expect(miroir.finalIR).toBeCloseTo(5794.985, 3);
    // Aucun benefice meuble sur ces dossiers.
    expect(e1.beneficeMeuble).toBe(0);
    expect(e1.meubleSocialLevy).toBe(0);
  });
});

// ─── Preuve 2 — Dossier foncier pur (Location nue) : 0 valeur changee ─────────
describe("LMNP — non-regression : Location nue reste du foncier pur", () => {
  it("micro-foncier 12000 -> taxable 8400, PS 17,2 %, beneficeMeuble 0", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop({ type: "Location nue", rentGrossAnnual: "12000" })] }, MICRO);
    expect(ir.taxableFonciers).toBeCloseTo(8400, 2);        // 12000 * 0,7
    expect(ir.foncierSocialLevy).toBeCloseTo(8400 * 0.172, 2); // PS foncier 17,2 % inchange
    expect(ir.beneficeMeuble).toBe(0);                      // pas de meuble
    expect(ir.meubleSocialLevy).toBe(0);
  });
});

// ─── Preuve 3 — Bascule LMNP : sortie foncier -> entree BIC micro ─────────────
describe("LMNP — bascule d'un bien LMNP existant vers le BIC meuble", () => {
  // Dossier : single, salaire 30000, bien LMNP loyers 12000, aucun autre champ.
  // AVANT (ancien traitement foncier micro) : taxable 8400, PS foncier 1444,80,
  //   revenuNetGlobal 35400 -> bareme 3723,99 -> finalIR 5168,79.
  // APRES (BIC micro longue_duree) : base 6000, PS patrimoine 18,6 % = 1116,00,
  //   revenuNetGlobal 33000 -> bareme 3003,99 -> finalIR 4119,99. Foncier = 0.
  it("recettes 12000 -> BIC micro base 6000, PS 18,6 % = 1116,00, hors foncier", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop({ type: "LMNP", rentGrossAnnual: "12000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(6000, 2);
    expect(ir.meubleSocialLevy).toBeCloseTo(1116.0, 2);     // 6000 * 0,186
    expect(ir.taxableFonciers).toBe(0);                     // plus AUCUN foncier
    expect(ir.foncierSocialLevy).toBe(0);
    expect(ir.finalIR).toBeCloseTo(4119.99, 2);             // APRES documente
  });
});

// ─── Preuve 4 — Frontiere : LMNP absent de TOUT agregat foncier ───────────────
describe("LMNP — frontiere foncier (aucun agregat foncier ne compte le meuble)", () => {
  it("bien LMNP : foncierBrut / taxableFonciers / PS foncier / deficit = 0", () => {
    const ir: any = computeIR(
      { ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", rentGrossAnnual: "20000", propertyTaxAnnual: "3000", worksAnnual: "5000" })] },
      { ...MICRO, foncierRegime: "real" },
    );
    expect(ir.foncierBrut).toBe(0);
    expect(ir.taxableFonciers).toBe(0);
    expect(ir.foncierSocialLevy).toBe(0);
    expect(ir.deficitFoncierImpute).toBe(0);
    expect(ir.deficitFoncierReportable).toBe(0);
    expect(ir.beneficeMeuble).toBeGreaterThan(0);           // bien bien pris en BIC
  });
});

// ─── Preuve T11 — Defauts conservateurs (bien LMNP existant sans champs) ──────
describe("LMNP — T11 defauts conservateurs (aucun champ meuble saisi)", () => {
  it("loyers 12000, rien d'autre -> micro longue_duree, base 6000", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop({ type: "LMNP", rentGrossAnnual: "12000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(6000, 2);         // = micro residuel 50 %
    expect(ir.meubleSocialLevy).toBeCloseTo(1116.0, 2);
  });
  it("LMP calcule comme LMNP (meme base BIC)", () => {
    const lmnp = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop({ type: "LMNP", rentGrossAnnual: "12000" })] }, MICRO);
    const lmp = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop({ type: "LMP", rentGrossAnnual: "12000" })] }, MICRO);
    expect(lmp.beneficeMeuble).toBeCloseTo(lmnp.beneficeMeuble, 6);
    expect(lmp.finalIR).toBeCloseTo(lmnp.finalIR, 6);
  });
});

// ─── Preuve 6 — Concubins : ventilation par ownerShape (symetrie stricte) ─────
describe("LMNP — chemin concubins (ventilation par ownerShare)", () => {
  it("LMNP ownership person1 -> tout sur P1", () => {
    const ir: any = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "30000", properties: [prop({ type: "LMNP", ownership: "person1", rentGrossAnnual: "12000" })] }, MICRO);
    expect(ir.beneficeMeuble1).toBeCloseTo(6000, 2);
    expect(ir.beneficeMeuble2).toBeCloseTo(0, 2);
    expect(ir.meublePS1).toBeCloseTo(1116.0, 2);
    expect(ir.beneficeMeuble).toBeCloseTo(6000, 2);         // total foyer
  });
  it("LMNP ownership common -> 50/50 entre les deux concubins", () => {
    const ir: any = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "30000", properties: [prop({ type: "LMNP", ownership: "common", rentGrossAnnual: "12000" })] }, MICRO);
    expect(ir.beneficeMeuble1).toBeCloseTo(3000, 2);
    expect(ir.beneficeMeuble2).toBeCloseTo(3000, 2);
    expect(ir.beneficeMeuble).toBeCloseTo(6000, 2);
  });
});

// ─── Preuve 7 — Barriere douce amortissement ("0" saisi vs vide) ──────────────
describe("LMNP — regime reel : barriere douce sur amortissementAnnuelManuel", () => {
  const commun = { type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "20000", chargesReelles: "5000" };
  it('"0" saisi = 0 voulu -> aucun amortissement, base = 20000 - 5000 = 15000', () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ ...commun, amortissementAnnuelManuel: "0", prixAcquisition: "300000", valeurMobilier: "10000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(15000, 2);        // "0" bat l'auto (prix ignore)
  });
  it("vide + prixAcquisition saisi -> amortissement auto (10736,07) -> base 4263,93", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ ...commun, prixAcquisition: "300000", partTerrain: "0.15", valeurMobilier: "10000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(4263.93, 2);      // 20000 - 5000 - 10736,07
  });
  it("vide + aucun prix -> amortissement 0 (jamais invente), base = 15000", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ ...commun })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(15000, 2);        // defaut conservateur
  });
});

// ─── Micro choisi explicitement AU-DESSUS du seuil -> reel de plein droit ─────
// GO David 07/07/2026 (art. 50-0 CGI : le micro n'est de droit que si eligible).
describe("LMNP — micro choisi au-dessus du seuil bascule en reel de plein droit", () => {
  it("regimeMeuble micro + recettes 90000 (> 83600) -> reel, base 90000 (PAS micro 45000)", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", regimeMeuble: "micro", recettesAnnuelles: "90000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(90000, 2); // reel (recettes - 0 - 0), pas 45000
  });
  it("tourisme non classe micro + recettes 16000 (> 15000) -> reel, base 16000 (PAS micro 11200)", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", sousType: "tourisme_non_classe", regimeMeuble: "micro", recettesAnnuelles: "16000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(16000, 2);
  });
  it("micro eligible (recettes <= seuil) reste micro (non regresse)", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", regimeMeuble: "micro", recettesAnnuelles: "12000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(6000, 2); // micro 50 % applique normalement
  });
});

// ─── Lot 1bis — charges reelles = chargesReelles + taxe + assurance ───────────
describe("LMNP 1bis — charges retenues au reel incluent taxe fonciere + assurance", () => {
  it("reel 30000 / chargesReelles 3000 / taxe 2000 / assurance 1000 -> charges 6000, base 24000", () => {
    const ir: any = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "30000", chargesReelles: "3000", propertyTaxAnnual: "2000", insuranceAnnual: "1000" })] }, MICRO);
    expect(ir.beneficeMeuble).toBeCloseTo(24000, 2); // 30000 - 6000 - 0
    expect(ir.meubleDetail[0].chargesRetenues).toBeCloseTo(6000, 2);
  });
  it("fallback legacy : otherChargesAnnual utilise si chargesReelles vide", () => {
    const ir: any = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "30000", otherChargesAnnual: "4000", propertyTaxAnnual: "1000" })] }, MICRO);
    expect(ir.meubleDetail[0].chargesRetenues).toBeCloseTo(5000, 2); // 4000 + 1000 + 0
  });
});

// ─── Lot 1bis — detail par bien expose (affichage TabIR, aucun recalcul local) ─
describe("LMNP 1bis — meubleDetail expose par bien", () => {
  it("micro : detail regime/recettes/abattement/base", () => {
    const ir: any = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop({ type: "LMNP", rentGrossAnnual: "12000" })] }, MICRO);
    expect(ir.meubleDetail).toHaveLength(1);
    const d = ir.meubleDetail[0];
    expect(d.regime).toBe("micro");
    expect(d.recettes).toBeCloseTo(12000, 2);
    expect(d.abattement).toBeCloseTo(6000, 2);
    expect(d.base).toBeCloseTo(6000, 2);
  });
  it("reel deficitaire : ARD + deficit reportable exposes, base 0", () => {
    // recettes 10000, charges 13000 (via chargesReelles), amort 5000 -> T7 du module
    const ir: any = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "10000", chargesReelles: "13000", amortissementAnnuelManuel: "5000" })] }, MICRO);
    const d = ir.meubleDetail[0];
    expect(d.base).toBeCloseTo(0, 2);
    expect(d.ard).toBeCloseTo(5000, 2);
    expect(d.deficitReportable).toBeCloseTo(3000, 2);
  });
});

// ─── Lot 1bis — overrides d'amortissement par composant (modal Detail) ────────
describe("LMNP 1bis — amortissementComposants (overrides) branches dans computeIR", () => {
  it("override gros oeuvre 40 ans change la base reel", () => {
    const base = { type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "40000", prixAcquisition: "300000" };
    const sans: any = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ ...base })] }, MICRO);
    const avec: any = computeIR({ ...BASE_DATA, salary1: "40000", properties: [prop({ ...base, amortissementComposants: { grosOeuvre: { duree: 40 } } })] }, MICRO);
    expect(sans.beneficeMeuble).toBeCloseTo(40000 - 9307.5, 2); // amort auto 9307.50
    expect(avec.beneficeMeuble).toBeCloseTo(40000 - 9945, 2);   // amort override 9945
  });
});

// ─── Helper de collecte (detection LMP, lot UI a venir) ───────────────────────
describe("LMNP — collecteRevenusActiviteFoyer (base de comparaison LMP)", () => {
  it("somme salaires + pensions + benefice TNS, hors meuble", () => {
    const rev = collecteRevenusActiviteFoyer({ ...BASE_DATA, salary1: "30000", salary2: "10000", pensions1: "5000" });
    expect(rev).toBeCloseTo(45000, 2); // 30000 + 10000 + 5000 (pas de TNS ici)
  });
});
