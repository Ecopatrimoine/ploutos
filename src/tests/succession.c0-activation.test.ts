// Lot C0 — defaut priorDonations "" dans les builders : active le MODE AUTO en
// devolution legale (heritiers construits par buildCollectedHeirs) tout en restant
// NEUTRE quand le registre est vide (preuve rapport Lot B : manuel-"0" == auto-vide).
import { describe, it, expect } from "vitest";
import { computeSuccession, getSuccessionTaxProfile } from "../lib/calculs/succession";
import { computeTaxFromBrackets } from "../lib/calculs/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const yearsAgo = (y: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
};

// Devolution LEGALE : successionData.heirs VIDE -> buildCollectedHeirs(data, person1).
// person1 celibataire, 2 enfants communs cA/cB, RS 1 000 000 detenue 100 % -> 500 000/enfant.
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

// Path devolution legale : heirs VIDE.
const succLegal = { deceasedPerson: "person1" as const, spouseOption: "none", heirs: [], testamentHeirs: [], testamentMode: false, legsPrecisItems: [], spousePresent: false, useTestament: false, legsMode: "global" as const };

const brackets = getSuccessionTaxProfile("enfant").brackets;
const T = (b: number) => computeTaxFromBrackets(Math.max(0, b), brackets).tax;
const alice = (r: any) => r.results.find((x: any) => x.relation === "enfant" && x.name.startsWith("Alice"));

describe("Lot C0 — activation MODE AUTO en devolution legale", () => {
  it("registre VIDE : neutre (mode aucun, droits = T(taxable) barème direct)", () => {
    const a = alice(computeSuccession(succLegal as any, mkData([]) as any));
    expect(a.rappelApplique.mode).toBe("aucun"); // plus "manuel" : defaut "" -> auto
    expect(a.rappelApplique.abattementConsomme).toBe(0);
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 100000), 2);
    expect(a.successionDuties).toBeCloseTo(T(a.successionTaxable), 2);
  });

  it("registre rempli : MODE AUTO actif en devolution legale (match par childId)", () => {
    const don = { id: "d1", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "cA", date: yearsAgo(5), montant: "40000", type: "simple" };
    const a = alice(computeSuccession(succLegal as any, mkData([don]) as any));
    expect(a.rappelApplique.mode).toBe("auto");
    expect(a.rappelApplique.abattementConsomme).toBe(40000);
    expect(a.successionTaxable).toBeCloseTo(Math.max(0, a.grossReceived - 60000), 2);
    expect(a.successionDuties).toBeCloseTo(T(a.successionTaxable), 2);
  });
});
