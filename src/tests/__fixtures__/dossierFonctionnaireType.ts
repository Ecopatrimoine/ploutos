// ─── Fixture dossier 'fonctionnaire-type' (LOT D.3) ─────────────────────────
//
// Dossier de reference d'un foyer fonctionnaire titulaire, versionne et
// reutilisable par le harnais : couple marie, 2 enfants a charge, personne 1
// fonctionnaire (caisse FONCTION_PUBLIQUE) au revenu declare 40 000 EUR/an.
// C'est l'assiette UNIQUE (revenu declare = salaireBrutAnnuel) qui pilote IJ,
// invalidite et capital deces statutaires. Sert de dossier bout-en-bout
// (mapping -> projection -> succession -> PDF) dans
// prevoyance.fonctionpublique.dossier.test.ts et de source unique pour le test
// d'integration succession.

import { EMPTY_CHARGES_DETAIL } from "../../constants";
import type { PatrimonialData, SuccessionData, PayloadTravail } from "../../types/patrimoine";

// Revenu declare (assiette unique) — expose pour les assertions derivees.
export const REVENU_FONCTIONNAIRE = 40000;
// Capital deces attendu : un an de remuneration + 2 x 884,33 (majoration enfant).
export const CAPITAL_DECES_ATTENDU = 41768.66;

function travailFP(): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: "fonctionnaire", caisseAffiliation: "FONCTION_PUBLIQUE", employeur: null,
      dateEmbauche: "2010-01-01", dateDebutActivite: "2010-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: REVENU_FONCTIONNAIRE,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}

export function dossierFonctionnaireTypeData(): PatrimonialData {
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

export function dossierFonctionnaireTypeSuccession(): SuccessionData {
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
