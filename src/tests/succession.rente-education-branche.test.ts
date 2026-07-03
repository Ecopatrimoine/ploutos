// LOT DECES-B-ii — Câblage de la rente éducation de branche dans la succession.
// Rente PAR ENFANT à charge (âge SEUL < 26), évolutive (phases 12 %/15 %),
// EXONÉRÉE, CUMULATIVE avec le capital (jamais additionnée), hors actif/droits.
// Syntec (1486), cadre 60 000, PASS 48 060 → phase 0-18 : 11 534,40 ; 18-26 :
// 14 418. NON-RÉGRESSION : masses + capital branche + dévolution inchangés.

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import type {
  EmployeurInfo,
  PatrimonialData,
  PayloadTravail,
  SuccessionData,
} from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

function employeurSyntec(idcc: string | null): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "ACME", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: "Syntec", sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  };
}

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

function child(firstName: string, birthDate: string, parentLink = "common_child") {
  return { firstName, lastName: "Martin", birthDate, parentLink, custody: "full", rattached: true, handicap: false };
}

function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1975-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1978-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
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
    deceasedPerson: "person1", spouseOption: "legal_quarter_full",
    heirs: [], testamentHeirs: [], legsPrecisItems: [], spousePresent: true,
    useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

const cadreSyntec = (children: PatrimonialData["childrenData"]) =>
  baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec("1486")), childrenData: children });

describe("computeSuccession — rente éducation de branche (Syntec cadre 60 000)", () => {
  it("enfant jeune (< 18) → ligne rente : montant courant 11 534,40, 2 phases", () => {
    const s = computeSuccession(baseSuccession(), cadreSyntec([child("Léa", "2016-03-01")] as PatrimonialData["childrenData"]));
    const lignes = s.capitalDecesLines.renteEducationBranche;
    expect(lignes).toHaveLength(1);
    const l = lignes[0];
    expect(l.enfantPrenom).toBe("Léa");
    expect(l.donneeIndisponible).toBe(false);
    expect(l.ageActuel).not.toBeNull();
    expect(l.montantAnnuelCourant).toBeCloseTo(11534.4, 2); // phase 0-18 : max(0,12×60000 ; 0,24×PASS)
    expect(l.phases).toHaveLength(2);
    expect(l.phases[0]).toMatchObject({ deAge: 0, aAge: 18 });
    expect(l.phases[0].montantAnnuel).toBeCloseTo(11534.4, 2);
    expect(l.phases[1]).toMatchObject({ deAge: 18, aAge: 26 });
    expect(l.phases[1].montantAnnuel).toBeCloseTo(14418, 2);
  });

  it("enfant 18-26 → montant courant = phase 15 % = 14 418", () => {
    const s = computeSuccession(baseSuccession(), cadreSyntec([child("Tom", "2006-03-01")] as PatrimonialData["childrenData"]));
    const l = s.capitalDecesLines.renteEducationBranche[0];
    expect(l.ageActuel).toBeGreaterThanOrEqual(18);
    expect(l.ageActuel).toBeLessThan(26);
    expect(l.montantAnnuelCourant).toBeCloseTo(14418, 2);
  });

  it("enfant >= 26 → hors charge : AUCUNE ligne de rente", () => {
    const s = computeSuccession(baseSuccession(), cadreSyntec([child("Aine", "1999-03-01")] as PatrimonialData["childrenData"]));
    expect(s.capitalDecesLines.renteEducationBranche).toHaveLength(0);
  });

  it("enfant sans date de naissance → ligne donneeIndisponible (jamais d'erreur)", () => {
    const s = computeSuccession(baseSuccession(), cadreSyntec([child("Sans", "")] as PatrimonialData["childrenData"]));
    const l = s.capitalDecesLines.renteEducationBranche[0];
    expect(l).toBeDefined();
    expect(l.ageActuel).toBeNull();
    expect(l.donneeIndisponible).toBe(true);
    expect(l.montantAnnuelCourant).toBeNull();
  });

  it("filtre défunt : un enfant person2_only est exclu quand le défunt est person1", () => {
    const s = computeSuccession(baseSuccession(), cadreSyntec([
      child("Commun", "2016-03-01", "common_child"),
      child("AutreLit", "2016-03-01", "person2_only"),
    ] as PatrimonialData["childrenData"]));
    const lignes = s.capitalDecesLines.renteEducationBranche;
    expect(lignes).toHaveLength(1);
    expect(lignes[0].enfantPrenom).toBe("Commun");
  });

  it("défunt SANS idcc → aucune ligne de rente éducation", () => {
    const s = computeSuccession(baseSuccession(), baseData({
      travail: travailDefunt("salarie_cadre", employeurSyntec(null)),
      childrenData: [child("Léa", "2016-03-01")] as PatrimonialData["childrenData"],
    }));
    expect(s.capitalDecesLines.renteEducationBranche).toHaveLength(0);
  });
});

describe("computeSuccession — non-régression : rente éducation strictement additive", () => {
  const children = [child("Léa", "2016-03-01"), child("Tom", "2006-03-01")] as PatrimonialData["childrenData"];

  it("masses et droits INCHANGÉS au centime avec/sans la branche", () => {
    const sAvec = computeSuccession(baseSuccession(), cadreSyntec(children));
    const sSans = computeSuccession(baseSuccession(), baseData({
      travail: travailDefunt("salarie_cadre", employeurSyntec(null)), childrenData: children,
    }));
    expect(sAvec.activeNet).toBeCloseTo(sSans.activeNet, 2);
    expect(sAvec.totalRights).toBeCloseTo(sSans.totalRights, 2);
    expect(sAvec.totalSuccessionRights).toBeCloseTo(sSans.totalSuccessionRights, 2);
    expect(sAvec.totalAvRights).toBeCloseTo(sSans.totalAvRights, 2);
  });

  it("le capital de branche et sa dévolution ne sont PAS gonflés par la rente", () => {
    const s = computeSuccession(baseSuccession(), cadreSyntec(children));
    // Capital branche = capital seul (144 180), JAMAIS capital + rentes.
    expect(s.capitalDecesBrancheExonere).toBeCloseTo(144180, 2);
    expect(s.capitalDecesLines.branche[0].capital).toBeCloseTo(144180, 2);
    // La dévolution du capital reste produite (poste capital intact).
    expect(s.capitalDecesLines.branche[0].repartition.length).toBeGreaterThan(0);
    // La rente vit dans un poste SÉPARÉ (2 enfants à charge → 2 lignes).
    expect(s.capitalDecesLines.renteEducationBranche).toHaveLength(2);
    // Aucune somme rente+capital exposée : capitalDecesBrancheExonere n'inclut pas la rente.
    const totalRente = s.capitalDecesLines.renteEducationBranche
      .reduce((acc, l) => acc + (l.montantAnnuelCourant ?? 0), 0);
    expect(totalRente).toBeGreaterThan(0);
    expect(s.capitalDecesBrancheExonere).toBeLessThan(144180 + totalRente);
  });

  it("rentes caisses (rentesSurvieAnnuelles) inchangées par la branche", () => {
    const sAvec = computeSuccession(baseSuccession(), cadreSyntec(children));
    const sSans = computeSuccession(baseSuccession(), baseData({
      travail: travailDefunt("salarie_cadre", employeurSyntec(null)), childrenData: children,
    }));
    expect(JSON.stringify(sAvec.rentesSurvieAnnuelles)).toBe(JSON.stringify(sSans.rentesSurvieAnnuelles));
  });
});
