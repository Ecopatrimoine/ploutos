// ─── LOT DONNEES RNPO — Ouvriers du BTP (IDCC 1596 / 1597 / 1702) ─────────────
//
// Les trois IDCC partagent LE MEME regime national (RNPO) : blocs de garanties
// strictement identiques (decision Q6, duplication + garde-fou d'egalite). PASS
// 2026 = 48 060 ; SR (salaire de reference BTP) = 6,71 EUR au 01/07/2025.

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const SR = 6.71;

// ── a. Coherence Q6 : egalite profonde des blocs prevoyance des 3 IDCC ────────
describe("RNPO — coherence Q6 (1596 / 1597 / 1702 identiques)", () => {
  const ccn = referentiels.ccn as any;
  const c1596 = ccn.conventions["1596"];
  const c1597 = ccn.conventions["1597"];
  const c1702 = ccn.conventions["1702"];

  it("blocs prevoyance / devolution / maintien / college IDENTIQUES (hors metadonnees)", () => {
    // prevoyanceNonCadres : garanties (capital, rente conjoint, rente educ, ij, invalidite).
    expect(c1597.prevoyanceNonCadres).toEqual(c1596.prevoyanceNonCadres);
    expect(c1702.prevoyanceNonCadres).toEqual(c1596.prevoyanceNonCadres);
    // devolution + maintien + college.
    expect(c1597.devolutionCapitalDeces).toEqual(c1596.devolutionCapitalDeces);
    expect(c1702.devolutionCapitalDeces).toEqual(c1596.devolutionCapitalDeces);
    expect(c1597.maintienEmployeur).toEqual(c1596.maintienEmployeur);
    expect(c1702.maintienEmployeur).toEqual(c1596.maintienEmployeur);
    for (const c of [c1596, c1597, c1702]) {
      expect(c.collegeImpose).toBe("nonCadres");
      expect(c.prevoyanceCadres).toBeNull();
    }
  });

  it("metadonnees DISTINCTES (libelles propres a chaque IDCC)", () => {
    expect(c1596.nom).not.toBe(c1597.nom);
    expect(c1597.nom).not.toBe(c1702.nom);
    expect(c1702.nom).toContain("Travaux publics");
  });
});

// ── b. Dossier synthetique BTP-A ──────────────────────────────────────────────
// Builders calques sur les tests succession existants (cast partiel).
function employeurCcn(idcc: string, nom: string): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "TEST", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: nom, sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  } as unknown as EmployeurInfo;
}
function travailDefunt(statut: string, employeur: EmployeurInfo, brut: number): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: "CPAM", employeur,
      dateEmbauche: "2006-01-01", dateDebutActivite: "2006-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: brut,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}
function childAge(firstName: string, age: number): PatrimonialData["childrenData"][number] {
  return {
    firstName, lastName: "Martin", birthDate: `${2026 - age}-01-01`,
    parentLink: "common_child", custody: "full", rattached: true, handicap: false,
  } as unknown as PatrimonialData["childrenData"][number];
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1986-01-01", // defunt, 40 ans en 2026
    person1JobTitle: "", person1Csp: "62", person1PcsGroupe: "6",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1988-01-01",
    person2JobTitle: "", person2Csp: "62", person2PcsGroupe: "6",
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
const EMP_1597 = () => employeurCcn("1597", "Batiment ouvriers (entreprises de plus de 10 salaries)");

describe("RNPO — dossier BTP-A (ouvrier batiment >10, IDCC 1597, marie, 2 enfants, 28 000 EUR)", () => {
  const sMarie = computeSuccession(
    baseSuccession(),
    baseData({
      coupleStatus: "married",
      childrenData: [childAge("Lea", 8), childAge("Tom", 12)],
      travail: travailDefunt("salarie_non_cadre", EMP_1597(), 28000),
    })
  );

  it("capital deces : avec conjoint + 2 enfants = (3500 + 1000) SR x 6,71 = 30 195 EUR", () => {
    const br = sMarie.capitalDecesLines.branche;
    expect(br).toHaveLength(1);
    expect(br[0].capital).toBeCloseTo(4500 * SR, 2); // 30 195
  });

  it("rente conjoint : presente, 12% x 28 000 = 3 360 EUR/an, duree 64 - 40 = 24 ans", () => {
    const rc = sMarie.capitalDecesLines.renteConjointBranche;
    expect(rc).toHaveLength(1);
    expect(rc[0].montantAnnuel).toBeCloseTo(0.12 * 28000, 2); // 3 360
    expect(rc[0].dureeMaxAnnees).toBe(24); // 64 - 40
  });

  it("CUMUL rente conjoint + rente education : 2 lignes education (10% x 28 000 = 2 800 EUR/an chacune)", () => {
    const re = sMarie.capitalDecesLines.renteEducationBranche;
    expect(re).toHaveLength(2); // 2 enfants
    for (const ligne of re) {
      expect(ligne.montantAnnuelCourant).toBeCloseTo(2800, 2); // plancher 2 684 inerte (2 800 > 2 684)
    }
    // CUMUL effectif : la rente conjoint coexiste avec la rente education.
    expect(sMarie.capitalDecesLines.renteConjointBranche).toHaveLength(1);
  });

  it("capital deces : celibataire sans enfant = 750 SR x 6,71 = 5 032,50 EUR", () => {
    const sCelib = computeSuccession(
      baseSuccession(),
      baseData({ coupleStatus: "single", childrenData: [], travail: travailDefunt("salarie_non_cadre", EMP_1597(), 28000) })
    );
    expect(sCelib.capitalDecesLines.branche[0].capital).toBeCloseTo(750 * SR, 2); // 5 032,50
  });

  // ── Projection (IJ + invalidite) : couverture de branche RNPO injectee ──
  const entree: EntreePerso = {
    age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
    idccCCN: "1597", ancienneteMois: 240, salaireBrutAnnuel: 28000,
    salaireNetMensuel: 0, marie: true, nbEnfantsACharge: 2,
    contratsIndividuels: [], couvertureCollective: null,
  };

  it("IJ : complement de branche porte le total a 75% du revenu de reference (des le 91e jour)", () => {
    const r = projeterArretMaladie(entree, "cat2", referentiels);
    // Jour de la phase AM ou la complementaire collective de branche est active.
    const i = r.axe.findIndex((p, k) => p.phase === "am" && r.series.ijComplementaireCollective[k] > 0);
    expect(i).toBeGreaterThan(-1);
    // Franchise 90 : 1er jour indemnise = t >= 90 (convention moteur `t < f` non paye,
    // = apres 90 jours de franchise, soit le "91e jour" en comptage humain).
    expect(r.axe[i].jour).toBeGreaterThanOrEqual(90);
    const total = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i] + r.series.ijComplementaireCollective[i];
    expect(total).toBeCloseTo(0.75 * r.revenuReferenceMensuel, 0); // cible 75% SB (assiette revenu de ref)
  });

  it("invalidite cat2 : complement ADDITIF +10% + 2x5% = 20% du brut = 5 600 EUR/an (au-dessus de la pension Secu)", () => {
    const r = projeterArretMaladie(entree, "cat2", referentiels);
    const i = r.axe.findIndex((p) => p.phase === "invalidite");
    // brut mensuel 28 000/12 x 0,20 = 466,67/mois (= 5 600/an), additif (sans deduction).
    expect(r.series.renteInvalCollective[i]).toBeCloseTo((28000 / 12) * 0.20, 2);
  });

  it("invalidite cat1 : aucune garantie de branche → contribution nulle (complement additif 0)", () => {
    const r = projeterArretMaladie(entree, "cat1", referentiels);
    const i = r.axe.findIndex((p) => p.phase === "invalidite");
    expect(r.series.renteInvalCollective[i]).toBeCloseTo(0, 2);
  });
});
