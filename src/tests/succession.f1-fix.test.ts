// Lot F1 — fix du bug F0 : stripStaleLegalHeirs neutralise (au CALCUL, non
// destructif) un cache stale de heirs de devolution legale (priorDonations "0"
// + sans childId) -> computeSuccession reconstruit via buildCollectedHeirs (auto).
import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { stripStaleLegalHeirs } from "../lib/calculs/normalizeStaleHeirs";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const yearsAgo = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };
const don150k = { id: "d1", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "cA", beneficiaireNom: "Alice", beneficiaireRelation: "enfant", date: yearsAgo(1), montant: "150000", type: "simple" };

const mkData = (donations: any[]) => ({
  person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
  person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
  person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1952-01-01",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [{ id: "cA", firstName: "Alice", lastName: "Martin", birthDate: "1985-01-01", parentLink: "common_child", custody: "full", rattached: false, handicap: false }],
  salary1: "0", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [{
    name: "Patrimoine", type: "Résidence secondaire", ownership: "common", propertyRight: "full", usufructAge: "", value: "2000000",
    propertyTaxAnnual: "0", rentGrossAnnual: "0", insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
    loanCapitalRemaining: "0", loanInterestAnnual: "0", loanInsurance: false, loanInsuranceRate1: "0", loanInsuranceRate2: "0",
    loanInsuranceRate: "0", loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable", loanAmount: "0", loanRate: "3",
    loanDuration: "20", loanStartDate: "2020-01-01", indivisionShare1: "50", indivisionShare2: "50",
    loanPledgedPlacementIndex: "-1", loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
  }],
  placements: [], otherLoans: [], donations,
});
// Cache STALE (ancien code) : enfant priorDonations "0" + PAS de childId.
const succStale = (heirs: any[]) => ({ deceasedPerson: "person1" as const, spouseOption: "legal_usufruct_total", heirs, testamentHeirs: [], testamentMode: false, legsPrecisItems: [], spousePresent: true, useTestament: false, legsMode: "global" as const });
const staleHeirs = [{ name: "Alice Martin", relation: "enfant", childLink: "common_child", priorDonations: "0", share: "0" }];
const enfant = (r: any) => r.results.find((x: any) => x.relation === "enfant");

describe("F1 — stripStaleLegalHeirs", () => {
  it("cache stale (enfant sans childId) -> heirs vide", () => {
    expect(stripStaleLegalHeirs(succStale(staleHeirs)).heirs).toEqual([]);
  });
  it("cache frais (enfant AVEC childId) -> inchange", () => {
    const frais = [{ name: "Alice Martin", relation: "enfant", childLink: "common_child", childId: "cA", priorDonations: "", share: "0" }];
    expect(stripStaleLegalHeirs(succStale(frais)).heirs).toBe(frais);
  });
  it("conjoint seul (pas d'enfant) -> inchange (conjoint sans childId est normal)", () => {
    const conj = [{ name: "Marie", relation: "conjoint", childLink: null, priorDonations: "", share: "0" }];
    expect(stripStaleLegalHeirs(succStale(conj)).heirs).toBe(conj);
  });
});

describe("F1 — integration : le fix restaure le mode AUTO (config DDV usufruit)", () => {
  it("avec strip : mode auto + droits changent apres donation", () => {
    const sd = stripStaleLegalHeirs(succStale(staleHeirs));
    const sans = enfant(computeSuccession(sd as any, mkData([]) as any));
    const avec = enfant(computeSuccession(sd as any, mkData([don150k]) as any));
    expect(avec.rappelApplique.mode).toBe("auto");
    expect(avec.successionDuties).not.toBeCloseTo(sans.successionDuties, 0);
  });
  it("sans strip (cache stale brut) : reste manuel + inchange (comportement moteur documente)", () => {
    const sans = enfant(computeSuccession(succStale(staleHeirs) as any, mkData([]) as any));
    const avec = enfant(computeSuccession(succStale(staleHeirs) as any, mkData([don150k]) as any));
    expect(avec.rappelApplique.mode).toBe("manuel");
    expect(avec.successionDuties).toBeCloseTo(sans.successionDuties, 6);
  });
});
