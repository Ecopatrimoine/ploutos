// Lot 5 — Intégrité des références par id après suppression/réindexation.
// Prouve que retirer un actif situé AVANT la cible ne casse plus les 4
// références (nantissement, legs, donation), l'id étant désormais la clé.
// Aucune formule n'est testée ici — seule la RÉSOLUTION des références.

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { getDonationAssetValue } from "../lib/calculs/donation";
import { resolvePlacementRef } from "../lib/calculs/refs";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData, Placement, Property, DonationItem } from "../types/patrimoine";

// ─── Fixtures ──────────────────────────────────────────────────────────────
const CHILD = {
  firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
  parentLink: "common_child", custody: "full", rattached: false, handicap: false,
};

function baseData(placements: Placement[], properties: Property[]): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1955-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false, childrenData: [CHILD],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties, placements, otherLoans: [],
  } as unknown as PatrimonialData;
}

const SUCC = {
  deceasedPerson: "person1" as const, spouseOption: "legal_quarter_full",
  heirs: [{ name: "Enfant Martin", firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
    relation: "enfant", childLink: "common_child", priorDonations: "0", share: "100",
    shareGlobal: "", propertyRight: "full" }],
  testamentHeirs: [], legsPrecisItems: [], spousePresent: false,
  useTestament: false, legsMode: "global" as const,
} as any;

function placement(over: Partial<Placement>): Placement {
  return {
    id: "x", name: "", type: "Livret A", ownership: "person1", value: "0", annualIncome: "",
    taxableIncome: "", deathValue: "0", openDate: "", pfuEligible: false, pfuOptOut: false,
    totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "",
    ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: true,
    perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false,
    beneficiaries: [], ...over,
  } as Placement;
}

function property(over: Partial<Property>): Property {
  return {
    id: "x", name: "Bien", type: "Résidence secondaire", ownership: "person1", propertyRight: "full",
    usufructAge: "", value: "0", propertyTaxAnnual: "0", rentGrossAnnual: "0", insuranceAnnual: "0",
    worksAnnual: "0", otherChargesAnnual: "0", loanEnabled: false, loanType: "amortissable",
    loanAmount: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2015-01-01",
    loanCapitalRemaining: "0", loanInterestAnnual: "0", loanPledgedPlacementIndex: "-1",
    loanInsurance: false, loanInsuranceGuarantees: "", loanInsuranceRate: "0", loanInsuranceRate1: "0",
    loanInsuranceRate2: "0", loanInsurancePremium: "0", loanInsuranceCoverage: "banque",
    indivisionShare1: "", indivisionShare2: "", ...over,
  } as Property;
}

const LIVRET = placement({ id: "pl-livret", name: "Livret", type: "Livret A", value: "20000", deathValue: "20000" });
const AV = placement({
  id: "pl-av", name: "AV", type: "Assurance-vie fonds euros", value: "100000", deathValue: "100000",
  totalPremiumsNet: "100000", premiumsBefore70: "100000",
  beneficiaries: [{ name: "Enfant Martin", relation: "enfant", share: "100" }],
});
// Bien avec crédit in fine nantissant l'AV par ID (index legacy volontairement présent aussi).
const PROP_NANTI = property({
  id: "pr-nanti", value: "0", loanEnabled: true, loanType: "in_fine",
  loanAmount: "50000", loanCapitalRemaining: "50000",
  loanPledgedPlacementIndex: "1", loanPledgedPlacementId: "pl-av",
});

const avTotal = (s: any) => (s.avLines as any[]).reduce((t, l) => t + l.amount, 0);

describe("Intégrité stable-id — nantissement (succession)", () => {
  it("le nantissement AV survit à la suppression d'un placement placé AVANT (id, pas index)", () => {
    const withDecoy = computeSuccession(SUCC, baseData([LIVRET, AV], [PROP_NANTI])); // AV en index 1
    const withoutDecoy = computeSuccession(SUCC, baseData([AV], [PROP_NANTI]));      // AV en index 0
    // La réduction de nantissement est appliquée (AV taxable < valeur brute)...
    expect(avTotal(withDecoy)).toBeLessThan(100000);
    // ...et reste identique après réindexation (l'id résout, l'index aurait glissé).
    expect(avTotal(withoutDecoy)).toBe(avTotal(withDecoy));
  });

  it("l'id prime sur l'index : un loanPledgedPlacementIndex FAUX ne casse pas le nantissement", () => {
    const wrong = property({
      id: "pr-nanti", value: "0", loanEnabled: true, loanType: "in_fine",
      loanAmount: "50000", loanCapitalRemaining: "50000",
      loanPledgedPlacementIndex: "0", loanPledgedPlacementId: "pl-av", // index 0 = Livret (faux), id = AV
    });
    const s = computeSuccession(SUCC, baseData([LIVRET, AV], [wrong]));
    expect(avTotal(s)).toBeLessThan(100000); // l'id "pl-av" gagne -> AV bien réduite
  });
});

describe("Intégrité stable-id — donation (getDonationAssetValue)", () => {
  const DECOY = property({ id: "pr-decoy", value: "100000" });
  const TARGET = property({ id: "pr-target", value: "300000" });
  const don: DonationItem = {
    id: "d1", assetType: "property", assetIndex: 1, assetId: "pr-target",
    freeLabel: "", freeValue: "", donationType: "full", sharePercent: "100",
    donorAge: "60", donationDate: "", heirs: [],
  };

  it("la donation vise toujours la bonne propriété après suppression d'un bien en amont", () => {
    const v1 = getDonationAssetValue(don, baseData([], [DECOY, TARGET])).value; // TARGET en index 1
    const v2 = getDonationAssetValue(don, baseData([], [TARGET])).value;        // TARGET en index 0, assetIndex=1 périmé
    expect(v1).toBeGreaterThan(0);
    expect(v2).toBe(v1); // l'id résout TARGET indépendamment de l'index
  });

  it("l'id prime sur l'index : un assetIndex FAUX vise quand même la bonne propriété", () => {
    const wrongIdx: DonationItem = { ...don, assetIndex: 0 }; // index 0 = DECOY, id = TARGET
    const v = getDonationAssetValue(wrongIdx, baseData([], [DECOY, TARGET])).value;
    expect(v).toBe(getDonationAssetValue(don, baseData([], [DECOY, TARGET])).value); // == TARGET
  });
});

describe("Intégrité stable-id — legs (résolution par id)", () => {
  it("le legs pointe toujours le bon placement (CTO) après suppression d'une AV en tête", () => {
    const cto = placement({ id: "pl-cto", name: "CTO", type: "Compte-titres", value: "50000" });
    const placements = [AV, cto]; // CTO en index 1
    // legs stocké par id
    const legRef = { id: "pl-cto", index: 1 };
    expect(resolvePlacementRef(placements, legRef)?.id).toBe("pl-cto");
    // après suppression de l'AV en tête, CTO passe en index 0 mais l'id résout toujours
    const after = placements.filter((p) => p.id !== "pl-av");
    expect(resolvePlacementRef(after, legRef)?.id).toBe("pl-cto");
    // preuve que l'ancien index aurait dérivé : l'index 1 n'existe plus après suppression
    expect(resolvePlacementRef(after, { index: 1 })).toBeNull();
  });
});

// Nouveau comportement : addPlacement/addProperty inserent EN TETE (index 0). Toutes
// les references etant par id, ce decalage d'index ne detache aucun actif.
describe("Intégrité stable-id — insertion en tete (addPlacement/addProperty)", () => {
  const CTO = placement({ id: "pl-cto", name: "CTO", type: "Compte-titres", value: "50000", deathValue: "50000" });
  const NEW0 = placement({ id: "pl-new", name: "", type: "Livret A", value: "0", deathValue: "0" });

  // Succession testament « legs precis » leguant le CTO a l'enfant (par id).
  const SUCC_LEGS = {
    deceasedPerson: "person1" as const, spouseOption: "legal_quarter_full",
    heirs: [{ name: "Enfant Martin", firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
      relation: "enfant", childLink: "common_child", priorDonations: "0", share: "100",
      shareGlobal: "", propertyRight: "full" }],
    testamentHeirs: [],
    legsPrecisItems: [{
      assetType: "placement", assetId: "pl-cto", propertyIndex: 1,
      legataires: [{ heirName: "Enfant Martin", heirRelation: "enfant", heirBirthDate: "1980-01-01",
        sharePercent: "100", propertyRight: "full", contreparties: [] }],
    }],
    spousePresent: false, useTestament: true, legsMode: "precis" as const,
  } as any;

  const childGross = (s: any) => (s.results as any[]).find((r) => r.name === "Enfant Martin")?.grossReceived ?? 0;

  it("nantissement AV : ajout d'un placement EN TETE ne change pas la reduction (computeSuccession)", () => {
    const before = computeSuccession(SUCC, baseData([AV], [PROP_NANTI]));       // AV index 0
    const after = computeSuccession(SUCC, baseData([NEW0, AV], [PROP_NANTI]));  // AV pousse en index 1
    expect(avTotal(before)).toBeLessThan(100000);      // reduction bien appliquee
    expect(avTotal(after)).toBe(avTotal(before));       // stable malgre le decalage d'index
  });

  it("legs precis : ajout d'un placement EN TETE ne detache pas le bien legue (computeSuccession)", () => {
    const before = computeSuccession(SUCC_LEGS, baseData([AV, CTO], [PROP_NANTI]));        // CTO index 1
    const after = computeSuccession(SUCC_LEGS, baseData([NEW0, AV, CTO], [PROP_NANTI]));   // CTO pousse en index 2
    expect(childGross(before)).toBeGreaterThan(0);      // le legs CTO est bien attribue a l'enfant
    expect(childGross(after)).toBe(childGross(before));  // stable : l'id resout, l'index aurait glisse
  });
});
