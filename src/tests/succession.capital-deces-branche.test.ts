// ─── LOT DECES-A — Capital décès de branche (CCN) dans la succession ────────
//
// Vérifie : (1) un défunt salarié cadre IDCC 1486 → ligne branche EXONÉRÉE avec
// le capital attendu ; (2) un défunt sans IDCC / TNS → aucune ligne branche ;
// (3) NON-RÉGRESSION STRICTE : activeNet / totalRights / totalSuccessionRights /
// totalAvRights INCHANGÉS par l'ajout de la branche (sortie additive).

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import type {
  EmployeurInfo,
  PatrimonialData,
  PayloadTravail,
  SuccessionData,
} from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

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

function employeurSyntec(idcc: string): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "ACME", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: "Syntec", sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  };
}

// p1 (le défunt) salarié, caisse CPAM, salaire brut 60 000. employeur ⇒ IDCC,
// ou null (pas d'IDCC). statut paramétrable (cadre / non-cadre / TNS).
function travailDefunt(statut: string, employeur: EmployeurInfo | null): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: "CPAM", employeur,
      dateEmbauche: "2000-01-01", dateDebutActivite: "2000-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: 60000,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
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
    properties: [RP_COMMUNE], placements: [], otherLoans: [],
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

describe("LOT DECES-A — capital décès de branche dans la succession", () => {
  it("défunt salarié cadre IDCC 1486 → ligne branche exonérée, capital 163 404", () => {
    const data = baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec("1486")) });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.branche).toHaveLength(1);
    const l = s.capitalDecesLines.branche[0];
    expect(l.capital).toBeCloseTo(163404, 2); // cadre 60000 → plancher 3,40 PASS
    expect(l.categorie).toBe("cadres");
    expect(l.exonere).toBe(true);
    expect(l.donneeIndisponible).toBe(false);
    expect(l.beneficiairesAuContrat).toBe(true);
    expect(s.capitalDecesBrancheExonere).toBeCloseTo(163404, 2);
  });

  it("défunt salarié non-cadre IDCC 1486 → capital 102 000 (1,70 × salaire)", () => {
    const data = baseData({ travail: travailDefunt("salarie_non_cadre", employeurSyntec("1486")) });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.branche[0].capital).toBeCloseTo(102000, 2);
    expect(s.capitalDecesLines.branche[0].categorie).toBe("nonCadres");
  });

  it("défunt salarié SANS IDCC (employeur null) → aucune ligne branche", () => {
    const data = baseData({ travail: travailDefunt("salarie_cadre", null) });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.branche).toHaveLength(0);
    expect(s.capitalDecesBrancheExonere).toBe(0);
  });

  it("défunt TNS (pas d'employeur) → aucune ligne branche", () => {
    const data = baseData({ travail: travailDefunt("tns_liberal", null) });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.branche).toHaveLength(0);
  });

  it("CCN documentée sans capitalDC (1996 TO_FILL) → ligne présente mais donneeIndisponible", () => {
    // 3248 (Métallurgie) porte désormais un capitalDC → on prend 1996 (Pharmacie,
    // CCN présente mais prévoyance TO_FILL) pour garder le verrou « ligne produite
    // mais capital indisponible ».
    const data = baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec("1996")) });
    const s = computeSuccession(baseSuccession(), data);
    expect(s.capitalDecesLines.branche).toHaveLength(1);
    expect(s.capitalDecesLines.branche[0].capital).toBeNull();
    expect(s.capitalDecesLines.branche[0].donneeIndisponible).toBe(true);
    expect(s.capitalDecesBrancheExonere).toBe(0);
  });

  it("NON-RÉGRESSION : la branche n'altère AUCUNE masse (activeNet / droits) au centime", () => {
    const dataAvec = baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec("1486")) });
    const dataSans = baseData({ travail: travailDefunt("salarie_cadre", null) });
    const sAvec = computeSuccession(baseSuccession(), dataAvec);
    const sSans = computeSuccession(baseSuccession(), dataSans);
    // Le seul écart entre les deux dossiers est l'IDCC → la branche. Les masses
    // et droits doivent être STRICTEMENT identiques (sortie additive, hors actif).
    expect(sAvec.activeNet).toBeCloseTo(sSans.activeNet, 2);
    expect(sAvec.totalRights).toBeCloseTo(sSans.totalRights, 2);
    expect(sAvec.totalSuccessionRights).toBeCloseTo(sSans.totalSuccessionRights, 2);
    expect(sAvec.totalAvRights).toBeCloseTo(sSans.totalAvRights, 2);
    // ... alors que la branche, elle, diffère (preuve que le test n'est pas vacant).
    expect(sAvec.capitalDecesBrancheExonere).toBeGreaterThan(0);
    expect(sSans.capitalDecesBrancheExonere).toBe(0);
  });
});
