// Lot B2 — branchement du rappel fiscal dans computeSuccession (manuel/auto).
// On lit grossReceived depuis le resultat et on verifie les RELATIONS (robuste
// aux details de fraction legale). dateDuJour interne = today -> dates relatives.
import { describe, it, expect } from "vitest";
import { computeSuccession, getSuccessionTaxProfile } from "../lib/calculs/succession";
import { computeTaxFromBrackets } from "../lib/calculs/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const yearsAgo = (y: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
};

const donPassee = (o: Record<string, any>) => ({
  id: "don1", donorPersonKey: "person1", beneficiaireType: "child",
  date: yearsAgo(5), montant: "0", type: "simple", ...o,
});

// Foyer : person1 (defunt), celibataire, 2 enfants communs cA/cB, une RS 1 000 000
// detenue 100 % par person1 -> chaque enfant recoit 500 000 (part legale 1/2).
const mkData = (donations: any[]) => ({
  person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
  person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
  coupleStatus: "single", matrimonialRegime: "", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [
    { id: "cA", firstName: "Alice", lastName: "Martin", birthDate: "1980-01-01", parentLink: "common_child", custody: "full", rattached: false, handicap: false },
    { id: "cB", firstName: "Bob", lastName: "Martin", birthDate: "1982-01-01", parentLink: "common_child", custody: "full", rattached: false, handicap: false },
  ],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [{
    name: "RS", type: "Résidence secondaire", ownership: "person1", propertyRight: "full",
    usufructAge: "", value: "1000000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
    insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
    loanCapitalRemaining: "0", loanInterestAnnual: "0", loanInsurance: false,
    loanInsuranceRate1: "0", loanInsuranceRate2: "0", loanInsuranceRate: "0",
    loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable",
    loanAmount: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
    indivisionShare1: "100", indivisionShare2: "0",
    loanPledgedPlacementIndex: "-1", loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
  }],
  placements: [], otherLoans: [],
  donations,
});

// Heritiers fournis directement (path successionData.heirs -> priorDonations PRESERVE,
// permet le MODE AUTO quand priorDonations vide). childId cA/cB pour le match.
const mkSucc = (heirsOver?: any[]) => ({
  deceasedPerson: "person1" as const, spouseOption: "none",
  heirs: heirsOver || [
    { name: "Alice Martin", relation: "enfant", childLink: "common_child", childId: "cA", priorDonations: "", share: "50", shareGlobal: "", propertyRight: "full" },
    { name: "Bob Martin", relation: "enfant", childLink: "common_child", childId: "cB", priorDonations: "", share: "50", shareGlobal: "", propertyRight: "full" },
  ],
  testamentHeirs: [], testamentMode: false, legsPrecisItems: [], spousePresent: false, useTestament: false, legsMode: "global" as const,
});

const brackets = getSuccessionTaxProfile("enfant").brackets;
const T = (base: number) => computeTaxFromBrackets(Math.max(0, base), brackets).tax;
const alice = (r: any) => r.results.find((x: any) => x.name === "Alice Martin");
const bob = (r: any) => r.results.find((x: any) => x.name === "Bob Martin");

describe("computeSuccession — rappel fiscal branche (Lot B)", () => {
  it("REGISTRE VIDE : aucun rappel, droits = T(taxable) direct (non-regression)", () => {
    const a = alice(computeSuccession(mkSucc() as any, mkData([]) as any));
    expect(a.rappelApplique.mode).toBe("aucun");
    expect(a.rappelApplique.abattementConsomme).toBe(0);
    expect(a.rappelApplique.baseTaxeeAnterieure).toBe(0);
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 100000), 2);
    expect(a.successionDuties).toBeCloseTo(T(a.successionTaxable), 2);
  });

  it("donation 40 000 il y a 5 ans a l'enfant A -> abattement residuel 60 000 ; B intact", () => {
    const r = computeSuccession(mkSucc() as any, mkData([donPassee({ montant: "40000", beneficiaireChildId: "cA" })]) as any);
    const a = alice(r), b = bob(r);
    expect(a.rappelApplique.mode).toBe("auto");
    expect(a.rappelApplique.abattementConsomme).toBe(40000);
    expect(a.rappelApplique.baseTaxeeAnterieure).toBe(0);
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 60000), 2);
    expect(a.successionDuties).toBeCloseTo(T(a.successionTaxable), 2);
    // Enfant B : aucune donation -> intact
    expect(b.rappelApplique.mode).toBe("aucun");
    expect(b.rappelApplique.abattementConsomme).toBe(0);
    expect(b.successionTaxable).toBeCloseTo(Math.max(0, b.grossReceived - 100000), 2);
  });

  it("donation 150 000 -> abattement 0 + REPRISE : droits = T(50000 + taxable) - T(50000)", () => {
    const a = alice(computeSuccession(mkSucc() as any, mkData([donPassee({ montant: "150000", beneficiaireChildId: "cA" })]) as any));
    expect(a.rappelApplique.abattementConsomme).toBe(100000);
    expect(a.rappelApplique.baseTaxeeAnterieure).toBe(50000);
    expect(a.successionTaxable).toBeCloseTo(a.grossReceived, 2); // residual allowance 0
    expect(a.successionDuties).toBeCloseTo(T(50000 + a.successionTaxable) - T(50000), 2);
  });

  it("790 G -> aucun effet succession (hors rappel)", () => {
    const a = alice(computeSuccession(mkSucc() as any, mkData([donPassee({ montant: "31865", date: yearsAgo(3), beneficiaireChildId: "cA", type: "don_familial_790G" })]) as any));
    expect(a.rappelApplique.mode).toBe("aucun");
    expect(a.rappelApplique.abattementConsomme).toBe(0);
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 100000), 2);
  });

  it("heir.priorDonations SAISI + registre rempli -> MANUEL gagne (pas de reprise)", () => {
    const succ = mkSucc([
      { name: "Alice Martin", relation: "enfant", childLink: "common_child", childId: "cA", priorDonations: "30000", share: "50" },
      { name: "Bob Martin", relation: "enfant", childLink: "common_child", childId: "cB", priorDonations: "", share: "50" },
    ]);
    const a = alice(computeSuccession(succ as any, mkData([donPassee({ montant: "150000", beneficiaireChildId: "cA" })]) as any));
    expect(a.rappelApplique.mode).toBe("manuel");
    expect(a.rappelApplique.baseTaxeeAnterieure).toBe(0);
    // residual = 100000 - 30000 = 70000 ; le registre (150000) est IGNORE
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 70000), 2);
    expect(a.successionDuties).toBeCloseTo(T(a.successionTaxable), 2);
  });

  it("donation il y a 16 ans -> hors fenetre, aucun effet", () => {
    const a = alice(computeSuccession(mkSucc() as any, mkData([donPassee({ montant: "40000", date: yearsAgo(16), beneficiaireChildId: "cA" })]) as any));
    expect(a.rappelApplique.mode).toBe("aucun");
    expect(a.rappelApplique.abattementConsomme).toBe(0);
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 100000), 2);
  });

  it("date vide dans le registre -> aVerifier=true remonte, donation ignoree", () => {
    const a = alice(computeSuccession(mkSucc() as any, mkData([donPassee({ montant: "40000", date: "", beneficiaireChildId: "cA" })]) as any));
    expect(a.rappelApplique.aVerifier).toBe(true);
    expect(a.rappelApplique.abattementConsomme).toBe(0);
    expect(a.rappelApplique.mode).toBe("aucun");
  });

  it("registre [] neutre : identique a un dossier sans donations", () => {
    const avec = alice(computeSuccession(mkSucc() as any, mkData([]) as any));
    const sans = alice(computeSuccession(mkSucc() as any, { ...mkData([]), donations: undefined } as any));
    expect(avec.successionDuties).toBeCloseTo(sans.successionDuties, 6);
    expect(avec.successionTaxable).toBeCloseTo(sans.successionTaxable, 6);
  });
});
