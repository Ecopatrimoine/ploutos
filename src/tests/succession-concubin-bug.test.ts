// ─── Phase 1 — Filet TDD du bug moteur « exo conjoint vs PACS vs concubin » ───
//
// Ce fichier sert de FILET avant correction du moteur (red zone — fiscal).
// Il contient :
//   1. des snapshots BASELINE du comportement actuel pour 4 cas témoins
//      (marié, PACS, cohab, single) — capture l'état avant correction,
//      pour mesurer le delta exact après ;
//   2. des tests TDD qui DOIVENT ÉCHOUER aujourd'hui (preuve du bug) :
//      - PACS / cohab : buildCollectedHeirs étiquette à tort "conjoint" ;
//      - concubin survivant héritier : exonéré à tort (droits = 0) au lieu
//        d'être taxé 60 % au-delà de 1 594 € ;
//   3. des tests régression (marié) qui doivent passer aujourd'hui et après.
//
// Sources juridiques :
// - Marié : exo art. 796-0 bis CGI
// - PACS : exo art. 796-0 bis CGI (assimilation explicite TEPA 2007)
// - Concubin (cohab) : aucune exo conjoint, 60 % flat, abattement résiduel
//   ~1 594 € (art. 788 IV CGI — abattement tiers général)

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { buildCollectedHeirs } from "../lib/calculs/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";

// ─── Fixture de base — Pierre & Marie + 1 enfant + RP 800 000 € ───────────
// Le ownership est adapté au statut du couple pour rester réaliste juridiquement :
//   - married  → "common" + communauté légale (50 % au défunt)
//   - pacs     → "indivision" 50/50 (les PACS sont en séparation de biens par défaut)
//   - cohab    → "indivision" 50/50 (concubins, séparation)
//   - single   → "person1" (bien propre)
function makeData(coupleStatus: string) {
  const ownership =
    coupleStatus === "married" ? "common" :
    (coupleStatus === "pacs" || coupleStatus === "cohab") ? "indivision" :
    "person1";
  const matrimonialRegime = coupleStatus === "married" ? "communaute_legale" : "separation_biens";

  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: coupleStatus === "single" ? "" : "Marie",
    person2LastName:  coupleStatus === "single" ? "" : "Martin",
    person2BirthDate: coupleStatus === "single" ? "" : "1955-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus,
    matrimonialRegime,
    singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [
      { firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
        parentLink: "common_child", custody: "full", rattached: false, handicap: false },
    ],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [{
      name: "RP", type: "Résidence principale",
      ownership,
      propertyRight: "full",
      usufructAge: "", value: "800000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
      insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
      loanCapitalRemaining: "0", loanInterestAnnual: "0", loanInsurance: false,
      loanInsuranceRate1: "0", loanInsuranceRate2: "0", loanInsuranceRate: "0",
      loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable",
      loanAmount: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
      indivisionShare1: "50", indivisionShare2: "50",
      loanPledgedPlacementIndex: "-1", loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
    }],
    placements: [], otherLoans: [],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1) SNAPSHOTS BASELINE — état actuel pour 4 cas témoins
// ════════════════════════════════════════════════════════════════════════════
// Ces snapshots figent le comportement CURRENT du moteur. Quand la correction
// sera appliquée, ils CHANGERONT (notamment pour PACS et cohab). C'est l'effet
// recherché : voir le delta exact.

describe("BASELINE — computeSuccession × statut du couple (avant correction)", () => {
  const summarize = (result: any) =>
    result.results.map((r: any) => ({
      name: r.name,
      relation: r.relation,
      netReceived: Math.round(r.netReceived),
      duties: Math.round(r.duties),
      successionDuties: Math.round(r.successionDuties),
    }));

  it("baseline marié — dévolution légale 1/4 PP conjoint + enfant", () => {
    const data = makeData("married");
    const successionData = {
      deceasedPerson: "person1" as const,
      spousePresent: true,
      spouseOption: "legal_quarter_full",
      useTestament: false,
      legsMode: "global" as const,
      heirs: buildCollectedHeirs(data, "person1"),
      testamentHeirs: [],
      legsPrecisItems: [],
    };
    const result = computeSuccession(successionData, data);
    expect(summarize(result)).toMatchSnapshot();
  });

  it("baseline PACS — dévolution sans option conjoint (concubin = tiers en théorie)", () => {
    const data = makeData("pacs");
    const successionData = {
      deceasedPerson: "person1" as const,
      spousePresent: true,
      spouseOption: "none",
      useTestament: false,
      legsMode: "global" as const,
      heirs: buildCollectedHeirs(data, "person1"),
      testamentHeirs: [],
      legsPrecisItems: [],
    };
    const result = computeSuccession(successionData, data);
    expect(summarize(result)).toMatchSnapshot();
  });

  it("baseline concubin (cohab) — dévolution sans option conjoint", () => {
    const data = makeData("cohab");
    const successionData = {
      deceasedPerson: "person1" as const,
      spousePresent: true,
      spouseOption: "none",
      useTestament: false,
      legsMode: "global" as const,
      heirs: buildCollectedHeirs(data, "person1"),
      testamentHeirs: [],
      legsPrecisItems: [],
    };
    const result = computeSuccession(successionData, data);
    expect(summarize(result)).toMatchSnapshot();
  });

  it("baseline single — sans partenaire, enfant unique héritier", () => {
    const data = makeData("single");
    const successionData = {
      deceasedPerson: "person1" as const,
      spousePresent: false,
      spouseOption: "none",
      useTestament: false,
      legsMode: "global" as const,
      heirs: buildCollectedHeirs(data, "person1"),
      testamentHeirs: [],
      legsPrecisItems: [],
    };
    const result = computeSuccession(successionData, data);
    expect(summarize(result)).toMatchSnapshot();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2) TESTS TDD — DOIVENT ÉCHOUER sur le code actuel (preuve du bug)
// ════════════════════════════════════════════════════════════════════════════

describe("BUG #1 — buildCollectedHeirs étiquette à tort le partenaire 'conjoint'", () => {

  it("marié → partenaire étiqueté 'conjoint' (régression-test, DOIT PASSER avant et après)", () => {
    const heirs = buildCollectedHeirs(makeData("married"), "person1");
    const partner = heirs.find(h => h.name.includes("Marie"));
    expect(partner).toBeDefined();
    expect(partner!.relation).toBe("conjoint");
  });

  it("PACS → partenaire NON ajouté d'office (n'entre que par testament — art. 731 CC)", () => {
    // CIBLE : pas d'ajout d'office (le PACSé n'est pas héritier légal).
    // L'utilisateur le désigne explicitement via testament avec relation "pacs_partner".
    const heirs = buildCollectedHeirs(makeData("pacs"), "person1");
    const partner = heirs.find(h => h.name.includes("Marie"));
    expect(partner).toBeUndefined();
  });

  it("concubin (cohab) → partenaire NON ajouté d'office", () => {
    // CIBLE : pas d'ajout d'office (le concubin n'est pas héritier légal).
    // L'utilisateur le désigne explicitement via testament avec relation "autre" (tiers).
    const heirs = buildCollectedHeirs(makeData("cohab"), "person1");
    const partner = heirs.find(h => h.name.includes("Marie"));
    expect(partner).toBeUndefined();
  });
});

describe("BUG #2 — droits successoraux du partenaire survivant via testament", () => {
  // Cas réaliste : pour qu'un partenaire reçoive quelque chose, il faut un testament
  // (sinon en dévolution légale, ni PACS ni concubin n'ont vocation successorale).
  // On simule : testament partage 50/50 entre partenaire et enfant.

  function withTestament(data: any, partnerRelation: string) {
    return {
      deceasedPerson: "person1" as const,
      spousePresent: true,
      spouseOption: "none" as const,
      useTestament: true,
      legsMode: "global" as const,
      heirs: [],
      testamentHeirs: [
        { firstName: "Marie", lastName: "Martin", birthDate: "1955-01-01",
          relation: partnerRelation, shareGlobal: "50", propertyRight: "full",
          priorDonations: "0" },
        { firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
          relation: "enfant", shareGlobal: "50", propertyRight: "full",
          priorDonations: "0" },
      ],
      legsPrecisItems: [],
    };
  }

  it("marié + testament 50% conjoint → conjoint exonéré (droits = 0) — régression-test", () => {
    const data = makeData("married");
    const result = computeSuccession(withTestament(data, "conjoint"), data);
    const partner = result.results.find((r: any) => r.name.includes("Marie"));
    expect(partner).toBeDefined();
    expect(partner!.netReceived).toBeGreaterThan(0);
    expect(partner!.duties).toBe(0);
  });

  it("concubin + testament 50% partenaire 'autre' → partenaire TAXÉ (60 % au-delà de 1 594 €)", () => {
    // C'EST LE TEST CRITIQUE.
    // CIBLE : le partenaire concubin est traité comme un tiers (art. 788 IV CGI :
    //   abattement résiduel ~1 594 € ; taux plat 60 %). Aucune exonération conjoint.
    const data = makeData("cohab");
    const result = computeSuccession(withTestament(data, "autre"), data);
    const partner = result.results.find((r: any) => r.name.includes("Marie"));
    expect(partner).toBeDefined();
    expect(partner!.netReceived).toBeGreaterThan(0);
    expect(partner!.duties).toBeGreaterThan(0);
    // Vérification du taux 60% : droits ≈ (netReceived + duties - 1594) × 60 % / (1 - 0)
    // Plus simple : ratio droits/base ≈ 60 %.
    const baseTaxable = partner!.netReceived + partner!.duties;  // ≈ part brute reçue
    const expectedDuties = Math.max(0, baseTaxable - 1594) * 0.6;
    expect(Math.abs(partner!.duties - expectedDuties)).toBeLessThan(2); // tolérance arrondi
  });

  it("PACS + testament 50% partenaire 'pacs_partner' → exonéré (art. 796-0 bis CGI)", () => {
    // AUJOURD'HUI : la relation "pacs_partner" n'existe pas → traitée comme "autre"
    //   → 60 % au lieu d'exo → ÉCHOUE
    // CIBLE : computeAllowanceBrackets reconnaît "pacs_partner" et exonère.
    const data = makeData("pacs");
    const result = computeSuccession(withTestament(data, "pacs_partner"), data);
    const partner = result.results.find((r: any) => r.name.includes("Marie"));
    expect(partner).toBeDefined();
    expect(partner!.netReceived).toBeGreaterThan(0);
    // ↓ DOIT ÉCHOUER aujourd'hui (relation inconnue → traitée comme tiers)
    expect(partner!.duties).toBe(0);
  });
});
