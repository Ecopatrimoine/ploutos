// LOT RENTES-SURVIE-INDIV — Câblage des rentes de survie SAISIES au contrat
// individuel (deces_rente_conj / deces_rente_educ) dans la succession.
//
// Flux EXONÉRÉ hors masse taxable : aucun 990 I, aucun droit, aucune dévolution.
// Le montant saisi est MENSUEL → exposé en ANNUEL (×12) dans rentesSurvieAnnuelles
// avec source = "Contrat individuel". La rente éducation est PAR ENFANT : ×12
// UNIQUEMENT, JAMAIS × nombre d'enfants à charge.

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import type {
  PatrimonialData,
  PayloadContratIndividuel,
  PayloadPrevoyancePerso,
  PayloadTravail,
  SuccessionData,
} from "../types/patrimoine";
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

function travailPair(caisse: string, statut: string): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: caisse, employeur: null,
      dateEmbauche: "2000-01-01", dateDebutActivite: "2000-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: 50000,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}

function prevPerso(over: Partial<PayloadPrevoyancePerso> = {}): PayloadPrevoyancePerso {
  return {
    contratsIndividuels: [], couvertureCollective: null,
    categorieInvaliditeProjetee: "cat2", scenarioArret: "ald",
    ...over,
  };
}

// Rentes individuelles — montant saisi MENSUEL.
function renteConj(montantMensuel: number): PayloadContratIndividuel {
  return { id: "rc", type: "deces_rente_conj", capitalOuMontant: montantMensuel };
}
function renteEduc(montantMensuel: number): PayloadContratIndividuel {
  return { id: "re", type: "deces_rente_educ", capitalOuMontant: montantMensuel };
}

function child(firstName: string, birthDate: string, parentLink = "common_child") {
  return { firstName, lastName: "Martin", birthDate, parentLink, custody: "full", rattached: true, handicap: false };
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

const indiv = (s: ReturnType<typeof computeSuccession>) =>
  s.rentesSurvieAnnuelles.filter((r) => r.source === "Contrat individuel");

// ─── Mapping + unité (mensuel → annuel) ──────────────────────────────────────

describe("rentes de survie individuelles — mapping et unité", () => {
  it("rente conjoint 1000 €/mois → 1 entrée { conjoint, 12000 }, source Contrat individuel", () => {
    const data = baseData({
      prevoyance: { version: 1, p1: prevPerso({ contratsIndividuels: [renteConj(1000)] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);
    expect(indiv(s)).toEqual([
      { source: "Contrat individuel", type: "conjoint", montantAnnuel: 12000 },
    ]);
  });

  it("rente éducation 500 €/mois avec 2 enfants à charge → 6000/an (×12 PAR ENFANT, jamais ×2)", () => {
    const data = baseData({
      childrenData: [child("Léa", "2016-03-01"), child("Tom", "2014-03-01")] as PatrimonialData["childrenData"],
      prevoyance: { version: 1, p1: prevPerso({ contratsIndividuels: [renteEduc(500)] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);
    expect(indiv(s)).toEqual([
      { source: "Contrat individuel", type: "education", montantAnnuel: 6000 },
    ]);
    // Garde anti-régression : surtout PAS multiplié par le nombre d'enfants (≠ 12000).
    expect(indiv(s)[0].montantAnnuel).not.toBe(12000);
  });

  it("montant nul / négatif / NaN / absent → aucune entrée créée", () => {
    const data = baseData({
      prevoyance: {
        version: 1,
        p1: prevPerso({
          contratsIndividuels: [
            renteConj(0),
            renteEduc(-50),
            { id: "x", type: "deces_rente_conj", capitalOuMontant: NaN },
            { id: "y", type: "deces_rente_educ" } as unknown as PayloadContratIndividuel,
          ],
        }),
        p2: null,
      },
    });
    const s = computeSuccession(baseSuccession(), data);
    expect(indiv(s)).toEqual([]);
  });
});

// ─── Exonération : aucune influence sur masse taxable ni droits ───────────────

describe("rentes de survie individuelles — exonérées (invariance des masses)", () => {
  it("présence des rentes → masses et droits STRICTEMENT inchangés", () => {
    const ref = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
    });
    const sRef = computeSuccession(baseSuccession(), ref);

    const aug = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
      prevoyance: { version: 1, p1: prevPerso({ contratsIndividuels: [renteConj(1000), renteEduc(500)] }), p2: null },
    });
    const sAug = computeSuccession(baseSuccession(), aug);

    expect(sAug.activeNet).toBe(sRef.activeNet);
    expect(sAug.totalRights).toBe(sRef.totalRights);
    expect(sAug.totalSuccessionRights).toBe(sRef.totalSuccessionRights);
    expect(sAug.totalAvRights).toBe(sRef.totalAvRights);
    expect(sAug.results.map((r) => r.duties)).toEqual(sRef.results.map((r) => r.duties));
    expect(sAug.avLines).toEqual(sRef.avLines);

    // Seul ajout : 2 rentes annuelles exonérées (poste séparé, jamais sommées aux capitaux).
    expect(indiv(sAug)).toHaveLength(2);
  });
});

// ─── Cohabitation rente caisse + rente contrat individuel ────────────────────

describe("rentes de survie individuelles — cohabitation avec les rentes de caisse", () => {
  it("rente caisse (CARPV) + rente contrat individuel → 2 sources distinctes, sans écrasement", () => {
    const data = baseData({
      travail: travailPair("CARPV", "tns_liberal"),
      prevoyance: { version: 1, p1: prevPerso({ contratsIndividuels: [renteConj(1000)] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);

    // La rente individuelle est exposée (12000/an exonérée).
    expect(s.rentesSurvieAnnuelles).toEqual(
      expect.arrayContaining([
        { source: "Contrat individuel", type: "conjoint", montantAnnuel: 12000 },
      ])
    );
    // La rente conjoint de CAISSE (CARPV 14445/an) coexiste, source distincte, non écrasée.
    const caisseConj = s.rentesSurvieAnnuelles.find(
      (r) => r.source !== "Contrat individuel" && r.type === "conjoint"
    );
    expect(caisseConj?.montantAnnuel).toBe(14445);
    // Deux sources distinctes présentes.
    const sources = new Set(s.rentesSurvieAnnuelles.map((r) => r.source));
    expect(sources.has("Contrat individuel")).toBe(true);
    expect([...sources].some((src) => src !== "Contrat individuel")).toBe(true);
  });
});
