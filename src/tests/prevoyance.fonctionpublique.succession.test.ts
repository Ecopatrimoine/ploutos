// ─── LOT C (Fonction publique) — integration capital deces -> succession + PDF ─
//
// Verifie qu'un dossier fonctionnaire (caisse FONCTION_PUBLIQUE) voit son capital
// deces statutaire remonter par le chemin EXISTANT (succession.ts:1240,
// resolveCapitauxDeces) dans le resultat succession ET dans les donnees PDF
// capitaux deces. Aucun second chemin.

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { buildCapitauxDecesData } from "../lib/pdf/v2/adapters/buildCapitauxDecesData";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData, SuccessionData, PayloadTravail } from "../types/patrimoine";

function travailFP(): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: "fonctionnaire", caisseAffiliation: "FONCTION_PUBLIQUE", employeur: null,
      dateEmbauche: "2010-01-01", dateDebutActivite: "2010-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: 40000,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}

function baseData(): PatrimonialData {
  return {
    person1FirstName: "Paul", person1LastName: "Dupont", person1BirthDate: "1985-01-01",
    person1JobTitle: "", person1Csp: "45", person1PcsGroupe: "4",
    person2FirstName: "Julie", person2LastName: "Dupont", person2BirthDate: "1986-01-01",
    person2JobTitle: "", person2Csp: "54", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [
      { firstName: "Lea", lastName: "Dupont", birthDate: "2015-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
      { firstName: "Tom", lastName: "Dupont", birthDate: "2018-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
    ],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    travail: travailFP(),
  } as unknown as PatrimonialData;
}

function baseSuccession(): SuccessionData {
  return {
    deceasedPerson: "person1",
    spouseOption: "legal_quarter_full",
    heirs: [
      { name: "Julie Dupont", firstName: "Julie", lastName: "Dupont", birthDate: "1986-01-01",
        relation: "conjoint", childLink: null, priorDonations: "0", share: "0", shareGlobal: "", propertyRight: "full" },
      { name: "Lea Dupont", firstName: "Lea", lastName: "Dupont", birthDate: "2015-01-01",
        relation: "enfant", childLink: "common_child", priorDonations: "0", share: "50", shareGlobal: "", propertyRight: "full" },
      { name: "Tom Dupont", firstName: "Tom", lastName: "Dupont", birthDate: "2018-01-01",
        relation: "enfant", childLink: "common_child", priorDonations: "0", share: "50", shareGlobal: "", propertyRight: "full" },
    ],
    testamentHeirs: [], legsPrecisItems: [], spousePresent: true, useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

describe("Integration Fonction publique — capital deces remonte (succession + PDF)", () => {
  it("succession : capital = un an de remuneration + majoration enfants (41768,66), exonere", () => {
    const s = computeSuccession(baseSuccession(), baseData());
    expect(s.capitalDecesLines.caisses).toHaveLength(1);
    const line = s.capitalDecesLines.caisses[0];
    expect(line.capital).toBeCloseTo(41768.66, 2); // 40000 x 1.00 + 2 x 884,33
    expect(line.exonere).toBe(true);
    expect(s.capitalDecesCaisseExonere).toBeCloseTo(41768.66, 2);
  });

  it("PDF capitaux deces : le meme capital est expose dans les donnees d'adaptateur", () => {
    const s = computeSuccession(baseSuccession(), baseData());
    const pdf = buildCapitauxDecesData({ succession: s, data: baseData(), cabinet: {} });
    expect(pdf.caisses).toHaveLength(1);
    expect(pdf.caisses[0].capital).toBeCloseTo(41768.66, 2);
  });
});
