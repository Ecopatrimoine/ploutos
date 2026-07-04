// Lot F3 — la card heritier affiche l'abattement RESIDUEL (allowance - consomme),
// pas le plein. Test de la FORMULE d'affichage (replique exactement le calcul de
// la card) contre les valeurs du moteur + coherence arithmetique.
import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
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
const mkSucc = () => ({ deceasedPerson: "person1" as const, spouseOption: "legal_usufruct_total", heirs: [], testamentHeirs: [], testamentMode: false, legsPrecisItems: [], spousePresent: true, useTestament: false, legsMode: "global" as const });
const enfant = (r: any) => r.results.find((x: any) => x.relation === "enfant");

// Replique EXACTE de la formule d'affichage de la card (F3).
const cardAbattement = (heir: any) => {
  const baseRecue = heir.grossReceived + heir.nueValue;
  const consomme = Math.max(0, heir.rappelApplique?.abattementConsomme || 0);
  const residuel = Math.max(0, heir.allowance - consomme);
  const affiche = Math.min(residuel, Math.max(0, baseRecue));
  const detail = consomme > 0 ? `${heir.allowance} − ${consomme} = ${residuel}` : null;
  return { baseRecue, affiche, detail };
};

describe("F3 — card abattement = residuel + coherence", () => {
  it("avec donation 150 000 -> abattement affiche 0 + detail ; base - abatt = base taxable", () => {
    const heir = enfant(computeSuccession(mkSucc() as any, mkData([don150k]) as any));
    expect(heir.rappelApplique.abattementConsomme).toBe(100000);
    const c = cardAbattement(heir);
    expect(c.affiche).toBe(0);
    expect(c.detail).toBe("100000 − 100000 = 0");
    expect(c.baseRecue - c.affiche).toBeCloseTo(heir.successionTaxable, 6);
  });

  it("sans donation -> abattement plein (plafonne a la base), pas de detail", () => {
    const heir = enfant(computeSuccession(mkSucc() as any, mkData([]) as any));
    expect(heir.rappelApplique.abattementConsomme).toBe(0);
    const c = cardAbattement(heir);
    expect(c.affiche).toBe(Math.min(100000, c.baseRecue));
    expect(c.detail).toBeNull();
    expect(c.baseRecue - c.affiche).toBeCloseTo(heir.successionTaxable, 6);
  });
});
