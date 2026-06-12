// Lot 3 — Capitaux décès agrégés dans la succession (HORS actif).
//
// Vérifie : (1) capitaux décès des CAISSES exonérés + rentes annuelles ;
// (2) contrats privés de transmission taxés 990 I via computeAvTax, avec
// fusion de l'abattement 152 500 € COMMUN avec les AV (consommé AV-first) ;
// (3) NON-RÉGRESSION stricte : activeNet / totalRights / totalSuccessionRights
// / totalAvRights / results[].duties / avLines inchangés par l'ajout.

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import type {
  ContratTransmissionDeces,
  PatrimonialData,
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

function transmission(over: Partial<ContratTransmissionDeces> = {}): ContratTransmissionDeces {
  return {
    id: "td_1", libelle: "Temporaire décès", natureAssiette: "capital",
    capitalTransmis: 200000,
    beneficiaires: [{ name: "Enfant Martin", relation: "enfant", share: 100 }],
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

function baseSuccession(over: Partial<SuccessionData> = {}): SuccessionData {
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
    ...over,
  } as unknown as SuccessionData;
}

// ─── Source CAISSES ──────────────────────────────────────────────────────────

describe("capitaux décès caisses — exonérés, hors actif", () => {
  it("défunt CPAM → capital 4009, exonéré, hors activeNet", () => {
    const data = baseData({ travail: travailPair("CPAM", "salarie_cadre") });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.caisses).toHaveLength(1);
    expect(s.capitalDecesLines.caisses[0].capital).toBe(4009);
    expect(s.capitalDecesLines.caisses[0].exonere).toBe(true);
    expect(s.capitalDecesCaisseExonere).toBe(4009);
    // Hors actif : activeNet identique au même dossier sans caisse.
    expect(s.activeNet).toBe(computeSuccession(baseSuccession(), baseData()).activeNet);
  });

  it("défunt CARPV (classe par défaut maximum) → capital + rentes annuelles", () => {
    const data = baseData({ travail: travailPair("CARPV", "tns_liberal") });
    const s = computeSuccession(baseSuccession(), data);
    const line = s.capitalDecesLines.caisses[0];
    expect(line.capital).toBe(113955);
    expect(line.renteConjointAnnuelle).toBe(14445);
    expect(line.renteEducationAnnuelle).toBe(12840);
    expect(s.rentesSurvieAnnuelles).toEqual(
      expect.arrayContaining([
        { source: line.source, type: "conjoint", montantAnnuel: 14445 },
        { source: line.source, type: "education", montantAnnuel: 12840 },
      ])
    );
    // Les rentes (€/an) ne sont JAMAIS sommées dans le total des capitaux.
    expect(s.capitalDecesCaisseExonere).toBe(113955);
  });
});

// ─── Source CONTRATS PRIVÉS (990 I) ────────────────────────────────────────

describe("contrats privés de transmission — fiscalité 990 I", () => {
  it("natureAssiette 'capital' 200000, bénéf enfant 100% → taxable 47500, droits 9500", () => {
    const data = baseData({
      prevoyance: { version: 1, p1: prevPerso({ contratsTransmissionDeces: [transmission()] }), p2: null },
    });
    const s = computeSuccession(baseSuccession(), data);
    const line = s.capitalDecesLines.prives[0];
    expect(line.assiette990I).toBe(200000);
    expect(line.before70Taxable).toBe(47500); // 200000 - 152500
    expect(line.duties).toBeCloseTo(47500 * 0.2, 6); // 9500
    expect(s.capitalDecesPriveCapital).toBe(200000);
    expect(s.capitalDecesPriveDuties).toBeCloseTo(9500, 6);
  });

  it("natureAssiette 'primes_avant70' capital 300000 primes 40000 → assiette 40000 < 152500 → 0 droit", () => {
    const data = baseData({
      prevoyance: {
        version: 1,
        p1: prevPerso({
          contratsTransmissionDeces: [
            transmission({ natureAssiette: "primes_avant70", capitalTransmis: 300000, primesAvant70: 40000 }),
          ],
        }),
        p2: null,
      },
    });
    const s = computeSuccession(baseSuccession(), data);
    const line = s.capitalDecesLines.prives[0];
    expect(line.assiette990I).toBe(40000);
    expect(line.duties).toBe(0);
    expect(line.montant).toBe(300000); // capital transmis (exonéré en pratique)
    expect(s.capitalDecesPriveDuties).toBe(0);
  });

  it("bénéficiaire conjoint → exonéré (computeAvTax)", () => {
    const data = baseData({
      prevoyance: {
        version: 1,
        p1: prevPerso({
          contratsTransmissionDeces: [
            transmission({ beneficiaires: [{ name: "Marie Martin", relation: "conjoint", share: 100 }] }),
          ],
        }),
        p2: null,
      },
    });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.prives[0].duties).toBe(0);
    expect(s.capitalDecesPriveDuties).toBe(0);
  });

  it("MÊME bénéficiaire sur AV 100000 (avant70) + transmission capital 100000 → abattement 152500 COMMUN", () => {
    const data = baseData({
      placements: [avPlacement("Enfant Martin", "100000", "100000")],
      prevoyance: {
        version: 1,
        p1: prevPerso({ contratsTransmissionDeces: [transmission({ capitalTransmis: 100000 })] }),
        p2: null,
      },
    });
    const s = computeSuccession(baseSuccession(), data);
    const line = s.capitalDecesLines.prives[0];
    // Abattement consommé AV-first (AV 100000 → taxable 0), le contrat porte la
    // taxe marginale sur l'abattement résiduel : 200000 - 152500 = 47500.
    expect(line.before70Taxable).toBe(47500);
    expect(line.duties).toBeCloseTo(9500, 6);
    // L'AV elle-même reste à 0 droit (100000 < 152500) → totalAvRights inchangé.
    expect(s.totalAvRights).toBe(0);
  });
});

// ─── NON-RÉGRESSION ──────────────────────────────────────────────────────────

describe("non-régression — l'ajout des capitaux décès ne touche aucun champ existant", () => {
  it("activeNet / totalRights / totalSuccessionRights / totalAvRights / duties / avLines identiques", () => {
    // Dossier de référence : RP commune + AV, AUCUN capital décès.
    const ref = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
    });
    const sRef = computeSuccession(baseSuccession(), ref);

    // Même dossier + caisse + contrat de transmission (mêmes placements/biens).
    const aug = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
      travail: travailPair("CPAM", "salarie_cadre"),
      prevoyance: { version: 1, p1: prevPerso({ contratsTransmissionDeces: [transmission()] }), p2: null },
    });
    const sAug = computeSuccession(baseSuccession(), aug);

    expect(sAug.activeNet).toBe(sRef.activeNet);
    expect(sAug.totalRights).toBe(sRef.totalRights);
    expect(sAug.totalSuccessionRights).toBe(sRef.totalSuccessionRights);
    expect(sAug.totalAvRights).toBe(sRef.totalAvRights);
    expect(sAug.results.map((r) => r.duties)).toEqual(sRef.results.map((r) => r.duties));
    expect(sAug.avLines).toEqual(sRef.avLines);

    // Et le NOUVEAU contenu est bien présent (preuve que le dossier augmenté diffère).
    expect(sAug.capitalDecesCaisseExonere).toBe(4009);
    expect(sAug.capitalDecesPriveDuties).toBeGreaterThan(0);
  });
});

// ─── Invariant caisses CARMF / CARPIMKO (LOT CAISSES-DC) ─────────────────────
// Réplique pour les nouvelles caisses la non-régression du capital décès branche :
// l'ajout du capital caisse est STRICTEMENT ADDITIF et exonéré — aucune masse
// (activeNet / totalRights / totalSuccessionRights / totalAvRights / duties /
// avLines) n'est modifiée. baseData = couple marié + 1 enfant à charge.
describe("non-régression caisses CARMF / CARPIMKO — sortie additive exonérée", () => {
  it("CARMF (71500 actif) et CARPIMKO (54432 conjoint+descendant) n'altèrent aucune masse", () => {
    const ref = baseData({
      properties: [RP_COMMUNE],
      placements: [avPlacement("Enfant Martin", "300000", "300000")],
    });
    const sRef = computeSuccession(baseSuccession(), ref);

    for (const [caisse, statut, attendu] of [
      ["CARMF", "tns_liberal", 71500],
      ["CARPIMKO", "tns_liberal", 54432], // marié + 1 enfant à charge (baseData)
    ] as const) {
      const aug = baseData({
        properties: [RP_COMMUNE],
        placements: [avPlacement("Enfant Martin", "300000", "300000")],
        travail: travailPair(caisse, statut),
      });
      const sAug = computeSuccession(baseSuccession(), aug);

      expect(sAug.activeNet).toBe(sRef.activeNet);
      expect(sAug.totalRights).toBe(sRef.totalRights);
      expect(sAug.totalSuccessionRights).toBe(sRef.totalSuccessionRights);
      expect(sAug.totalAvRights).toBe(sRef.totalAvRights);
      expect(sAug.results.map((r) => r.duties)).toEqual(sRef.results.map((r) => r.duties));
      expect(sAug.avLines).toEqual(sRef.avLines);
      // Capital caisse présent, exonéré, hors actif (sortie additive).
      expect(sAug.capitalDecesCaisseExonere).toBe(attendu);
      expect(sAug.capitalDecesLines.caisses[0].exonere).toBe(true);
    }
  });

  it("CARMF retraité → aucun capital (0), masses inchangées (exclusion estRetraite)", () => {
    const ref = baseData({ properties: [RP_COMMUNE] });
    const sRef = computeSuccession(baseSuccession(), ref);
    const aug = baseData({ properties: [RP_COMMUNE], travail: travailPair("CARMF", "retraite") });
    const sAug = computeSuccession(baseSuccession(), aug);
    expect(sAug.capitalDecesCaisseExonere).toBe(0);
    expect(sAug.activeNet).toBe(sRef.activeNet);
    expect(sAug.totalSuccessionRights).toBe(sRef.totalSuccessionRights);
  });
});
