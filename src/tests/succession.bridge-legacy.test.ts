// VOIE A — R2 : pont read-time deces_capital legacy → transmission, + Option A
// (contrat sans bénéficiaire = capital visible, non taxé, marqueur).

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { capitalDecesUnifie } from "../lib/prevoyance/regles";
import {
  getContratsTransmissionDecesAvecLegacy,
  mapDecesCapitalLegacy,
} from "../lib/prevoyance/utils";
import type {
  ContratTransmissionDeces,
  PatrimonialData,
  PayloadContratIndividuel,
  PayloadPrevoyancePerso,
  SuccessionData,
} from "../types/patrimoine";
import type { ContratIndividuel } from "../lib/prevoyance/types";
import { EMPTY_CHARGES_DETAIL } from "../constants";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const RP_COMMUNE = {
  name: "RP", type: "Résidence principale", ownership: "common", propertyRight: "full",
  usufructAge: "", value: "800000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
  insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
  loanCapitalRemaining: "0", loanInterestAnnual: "0", loanInsurance: false,
  loanInsuranceRate1: "0", loanInsuranceRate2: "0", loanInsuranceRate: "0",
  loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable",
  loanAmount: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
  indivisionShare1: "50", indivisionShare2: "50",
  loanPledgedPlacementIndex: "-1", loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
};

function avPlacement(benefName: string, value: string, premiumsBefore70: string) {
  return {
    name: "AV", type: "Assurance-vie fonds euros", ownership: "person1",
    value, annualIncome: "", taxableIncome: "", deathValue: value, openDate: "",
    pfuEligible: true, pfuOptOut: false, totalPremiumsNet: "",
    premiumsBefore70, premiumsAfter70: "0", exemptFromSuccession: "",
    ucRatio: "", annualWithdrawal: "", annualContribution: "",
    perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "",
    perAnticiped: false,
    beneficiaries: [{ name: benefName, relation: "enfant", share: "100" }],
  };
}

function legacyDecesCapital(montant: number, conditions?: string): PayloadContratIndividuel {
  return { id: "ci_dc", type: "deces_capital", capitalOuMontant: montant, ...(conditions ? { conditions } : {}) };
}

function transmission(over: Partial<ContratTransmissionDeces> = {}): ContratTransmissionDeces {
  return {
    id: "td_1", libelle: "Temporaire décès", natureAssiette: "capital",
    capitalTransmis: 200000,
    beneficiaires: [{ name: "Enfant Martin", relation: "enfant", share: 100 }],
    ...over,
  };
}

function prevPerso(over: Partial<PayloadPrevoyancePerso> = {}): PayloadPrevoyancePerso {
  return {
    contratsIndividuels: [], couvertureCollective: null,
    categorieInvaliditeProjetee: "cat2", scenarioArret: "ald",
    ...over,
  };
}

function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1955-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [
      { firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: false },
    ],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    ...over,
  } as unknown as PatrimonialData;
}

function baseSuccession(): SuccessionData {
  return {
    deceasedPerson: "person1",
    spouseOption: "legal_quarter_full",
    heirs: [
      { name: "Enfant Martin", firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
        relation: "enfant", childLink: "common_child", priorDonations: "0",
        share: "100", shareGlobal: "", propertyRight: "full" },
      { name: "Marie Martin", firstName: "Marie", lastName: "Martin", birthDate: "1955-01-01",
        relation: "conjoint", childLink: null, priorDonations: "0",
        share: "0", shareGlobal: "", propertyRight: "full" },
    ],
    testamentHeirs: [], legsPrecisItems: [], spousePresent: true,
    useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

// ─── Unités : mapping + accès bridgé ─────────────────────────────────────────

describe("mapDecesCapitalLegacy / getContratsTransmissionDecesAvecLegacy", () => {
  it("mappe un deces_capital legacy en contrat de transmission (bénéficiaires vides)", () => {
    const mapped = mapDecesCapitalLegacy(legacyDecesCapital(200000, "clause X"));
    expect(mapped.natureAssiette).toBe("capital");
    expect(mapped.capitalTransmis).toBe(200000);
    expect(mapped.beneficiaires).toEqual([]);
    expect(mapped.libelle).toBe("Capital décès");
    expect(mapped.conditions).toBe("clause X");
  });

  it("concatène transmission réels + legacy mappés, et ignore les autres types", () => {
    const perso = prevPerso({
      contratsTransmissionDeces: [transmission()],
      contratsIndividuels: [
        legacyDecesCapital(50000),
        { id: "ij1", type: "ij", capitalOuMontant: 80 } as ContratIndividuel as PayloadContratIndividuel,
        { id: "rc1", type: "deces_rente_conj", capitalOuMontant: 1000 } as ContratIndividuel as PayloadContratIndividuel,
      ],
    });
    const all = getContratsTransmissionDecesAvecLegacy(perso);
    expect(all).toHaveLength(2); // 1 réel + 1 legacy deces_capital (ij/rente exclus)
    expect(all[1].capitalTransmis).toBe(50000);
  });
});

// ─── Succession : Option A + bridge ──────────────────────────────────────────

describe("computeSuccession — bridge legacy + Option A", () => {
  it("(a) 1 deces_capital legacy 200000, 0 transmission → capital visible, non taxé, marqueur", () => {
    const data = baseData({
      prevoyance: { version: 1, p1: prevPerso({ contratsIndividuels: [legacyDecesCapital(200000)] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.prives).toHaveLength(1);
    const line = s.capitalDecesLines.prives[0];
    expect(line.montant).toBe(200000);
    expect(line.duties).toBe(0);
    expect(line.beneficiairesARenseigner).toBe(true);
    expect(s.capitalDecesPriveCapital).toBe(200000);
    expect(s.capitalDecesPriveDuties).toBe(0);
  });

  it("(b) 1 transmission AVEC bénéficiaire enfant 100% capital 200000 → fiscalité Lot 3 inchangée", () => {
    const data = baseData({
      prevoyance: { version: 1, p1: prevPerso({ contratsTransmissionDeces: [transmission()] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);
    const line = s.capitalDecesLines.prives[0];
    expect(line.beneficiairesARenseigner).toBeUndefined();
    expect(line.before70Taxable).toBe(47500); // 200000 - 152500
    expect(line.duties).toBeCloseTo(9500, 6);
    expect(s.capitalDecesPriveDuties).toBeCloseTo(9500, 6);
  });

  it("(c) 1 transmission SANS bénéficiaire 150000 → désormais ligne visible, 0 droit (changement assumé)", () => {
    const data = baseData({
      prevoyance: { version: 1, p1: prevPerso({ contratsTransmissionDeces: [transmission({ capitalTransmis: 150000, beneficiaires: [] })] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.prives).toHaveLength(1);
    expect(s.capitalDecesLines.prives[0].montant).toBe(150000);
    expect(s.capitalDecesLines.prives[0].duties).toBe(0);
    expect(s.capitalDecesLines.prives[0].beneficiairesARenseigner).toBe(true);
    expect(s.capitalDecesPriveCapital).toBe(150000);
    expect(s.capitalDecesPriveDuties).toBe(0);
  });

  it("(d) dossier sans rien → aucune ligne privée (rétrocompat)", () => {
    const s = computeSuccession(baseSuccession(), baseData());
    expect(s.capitalDecesLines.prives).toEqual([]);
    expect(s.capitalDecesPriveCapital).toBe(0);
  });
});

// ─── (e) Constats : le bridge ne contamine PAS les constats (listes brutes) ──

describe("constats — le pont R2 ne double pas le legacy (max sur listes brutes)", () => {
  it("capitalDecesUnifie compte le legacy UNE fois (pas de bridge côté constats)", () => {
    // Côté constats : legacy brut + transmission brute (vide ici) → max(100000, 0).
    expect(capitalDecesUnifie([legacyDecesCapital(100000) as unknown as ContratIndividuel], [])).toBe(100000);
  });
});

// ─── Non-régression stricte (zone fiscale) ───────────────────────────────────

describe("non-régression — l'ajout d'un legacy ne touche aucun champ existant", () => {
  it("activeNet / totalRights / totalAvRights / avLines / results.duties identiques", () => {
    const ref = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
    });
    const sRef = computeSuccession(baseSuccession(), ref);

    const aug = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
      prevoyance: { version: 1, p1: prevPerso({ contratsIndividuels: [legacyDecesCapital(200000)] }), p2: null },
    });
    const sAug = computeSuccession(baseSuccession(), aug);

    expect(sAug.activeNet).toBe(sRef.activeNet);
    expect(sAug.totalRights).toBe(sRef.totalRights);
    expect(sAug.totalSuccessionRights).toBe(sRef.totalSuccessionRights);
    expect(sAug.totalAvRights).toBe(sRef.totalAvRights);
    expect(sAug.avLines).toEqual(sRef.avLines);
    expect(sAug.results.map((r) => r.duties)).toEqual(sRef.results.map((r) => r.duties));

    // Seul le bloc capitaux décès privés change (capital visible, 0 droit).
    expect(sAug.capitalDecesPriveCapital).toBe(200000);
    expect(sAug.capitalDecesPriveDuties).toBe(0);
  });
});
