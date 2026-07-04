// Lot D — restitution PDF du rappel fiscal (buildSuccessionAData + pageSuccessionA).
import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { buildSuccessionAData } from "../lib/pdf/v2/adapters/buildSuccessionAData";
import { pageSuccessionA } from "../lib/pdf/v2/pages/pageSuccessionA";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const yearsAgo = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };
const t = buildTokens("encreOr");

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
  placements: [], otherLoans: [], donations,
});
const succLegal = { deceasedPerson: "person1" as const, spouseOption: "none", heirs: [], testamentHeirs: [], testamentMode: false, legsPrecisItems: [], spousePresent: false, useTestament: false, legsMode: "global" as const };

const build = (donations: any[]) => {
  const succession = computeSuccession(succLegal as any, mkData(donations) as any);
  return buildSuccessionAData({ succession, data: mkData(donations), cabinet: {}, dateLettre: "4 juillet 2026" });
};

describe("buildSuccessionAData — rappel fiscal (Lot D)", () => {
  it("registre rempli : l'heritier expose rappel { plein, consomme, residuel }", () => {
    const d = build([{ id: "d1", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "cA", date: yearsAgo(5), montant: "40000", type: "simple" }]);
    const alice = d.heritiers.find((h: any) => h.nom.startsWith("Alice"));
    expect(alice.rappel).toBeDefined();
    expect(alice.rappel.plein).toBe(100000);
    expect(alice.rappel.consomme).toBe(40000);
    expect(alice.rappel.residuel).toBe(60000);
    // Enfant B : aucun rappel
    const bob = d.heritiers.find((h: any) => h.nom.startsWith("Bob"));
    expect(bob.rappel).toBeUndefined();
  });

  it("registre vide : aucun rappel expose", () => {
    const d = build([]);
    expect(d.heritiers.every((h: any) => !h.rappel)).toBe(true);
    expect(d.heritiers.every((h: any) => !h.aVerifier)).toBe(true);
  });
});

describe("pageSuccessionA — rendu du rappel (Lot D)", () => {
  it("rappel actif : abattement residuel + detail + note de bas de bloc art. 784", () => {
    const html = pageSuccessionA(t, build([{ id: "d1", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "cA", date: yearsAgo(5), montant: "40000", type: "simple" }]));
    expect(html).toContain("donations &lt; 15 ans");
    expect(html).toContain("CGI art. 784");
  });

  it("aVerifier : note 'donation non prise en compte (donnees incompletes)'", () => {
    const html = pageSuccessionA(t, build([{ id: "d1", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "cA", date: "", montant: "40000", type: "simple" }]));
    expect(html).toContain("données incomplètes");
  });

  it("registre vide : pas de note rappel 784", () => {
    const html = pageSuccessionA(t, build([]));
    expect(html).not.toContain("CGI art. 784");
  });
});
