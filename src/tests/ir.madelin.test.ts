// ─── Tests IR — déduction Madelin prévoyance (Lot B2) ────────────────────────
//
// Branche le poste Madelin dans computeIR (chemins principal ET concubin). Zone
// fiscale sensible : on vérifie que SANS donnée Madelin rien ne bouge, et que la
// déduction = min(cotisations, plafond) PAR PERSONNE, conditionnée TNS + toggle.
// Fichier dédié : ir.test.ts reste INTACT (non-régression).

import { describe, it, expect } from "vitest";
import { computeIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const BASE_DATA = {
  person1FirstName: "Test", person1LastName: "IR", person1BirthDate: "1980-01-01",
  person1JobTitle: "Salarié", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
};

const STD_OPTIONS = {
  expenseMode1: "standard" as const, expenseMode2: "standard" as const,
  km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9",
  km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9",
  foncierRegime: "micro",
  other1: "0", other2: "0",
};

// Contrat individuel ij marqué Madelin (cast pour poser les champs librement).
function ciMadelin(cotisation: number): any {
  return { id: "m1", type: "ij", capitalOuMontant: 0, deductibleMadelin: true, cotisationMadelinAnnuelle: cotisation };
}
function persoP1(cotisation: number): any {
  return {
    contratsIndividuels: [ciMadelin(cotisation)],
    contratsTransmissionDeces: [],
    couvertureCollective: null,
    categorieInvaliditeProjetee: "cat2",
  };
}

// Dossier célibataire TNS : bénéfice = 80 000 € (régime RÉEL, charges 0 -> benefice = ca),
// statut TNS, cotisations Madelin marquées. Plafond Madelin = 0,07*48060 + 0,0375*80000
// = 3364,2 + 3000 = 6364,2 €.
function tnsCelibataire(over: Record<string, unknown> = {}): any {
  return {
    ...BASE_DATA,
    person1PcsGroupe: "2",                  // indépendant -> benefice imposable calculé
    microRegime1: false, ca1: "80000", chargesReelles1: "0",  // réel : benefice1 = 80 000
    travail: { p1: { statutPro: "tns_artisan" }, p2: null },
    prevoyance: { version: 1, p1: persoP1(5000), p2: null },
    ...over,
  };
}

describe("computeIR — déduction Madelin (chemin principal)", () => {
  it("NON-RÉGRESSION : sans donnée Madelin, RNG inchangé (dossier salarié de base)", () => {
    const sans = computeIR({ ...BASE_DATA, salary1: "40000" } as any, STD_OPTIONS);
    // ajouter travail TNS mais AUCUNE cotisation -> toujours 0
    const avecStatutSansCotis = computeIR({ ...BASE_DATA, salary1: "40000", travail: { p1: { statutPro: "tns_artisan" }, p2: null } } as any, STD_OPTIONS);
    expect(avecStatutSansCotis.revenuNetGlobal).toBe(sans.revenuNetGlobal);
    expect(avecStatutSansCotis.finalIR).toBe(sans.finalIR);
  });

  it("CAS CHIFFRÉ : TNS « avant déduction » -> RNG baisse de min(cotis, plafond) = 5000", () => {
    const base = tnsCelibataire();
    const sans = computeIR({ ...base, prevoyance: undefined } as any, STD_OPTIONS); // 0 cotisation
    const avec = computeIR(base as any, STD_OPTIONS);
    // cotis 5000 < plafond 6364,2 -> déduction = 5000
    expect(avec.revenuNetGlobal).toBeCloseTo(sans.revenuNetGlobal - 5000, 0);
    expect(avec.finalIR).toBeLessThan(sans.finalIR);
  });

  it("TOGGLE « déjà déduite » -> AUCUNE déduction (anti-double-comptage)", () => {
    const base = tnsCelibataire();
    const sans = computeIR({ ...base, prevoyance: undefined } as any, STD_OPTIONS);
    const dejaDeduit = computeIR({
      ...base,
      travail: { p1: { statutPro: "tns_artisan", beneficeDejaDeduitMadelin: true }, p2: null },
    } as any, STD_OPTIONS);
    expect(dejaDeduit.revenuNetGlobal).toBeCloseTo(sans.revenuNetGlobal, 0);
  });

  it("PLAFOND : cotisations > plafond -> déduction plafonnée à 6364,2", () => {
    const base = tnsCelibataire({ prevoyance: { version: 1, p1: persoP1(20000), p2: null } });
    const sans = computeIR({ ...base, prevoyance: undefined } as any, STD_OPTIONS);
    const avec = computeIR(base as any, STD_OPTIONS);
    // cotis 20000 > plafond 6364,2 -> déduction = 6364,2 (pas 20000)
    expect(sans.revenuNetGlobal - avec.revenuNetGlobal).toBeCloseTo(6364.2, 1);
  });

  it("GARDE-FOU statutPro : non-TNS (président SAS) -> AUCUNE déduction malgré champs marqués", () => {
    // person1PcsGroupe "2" => le CALCUL voit un indépendant (benefice 80000),
    // MAIS statutPro "president_sas" n'est pas TNS -> estEligibleMadelin false.
    const base = tnsCelibataire({ travail: { p1: { statutPro: "president_sas" }, p2: null } });
    const sans = computeIR({ ...base, prevoyance: undefined } as any, STD_OPTIONS);
    const avec = computeIR(base as any, STD_OPTIONS);
    expect(avec.revenuNetGlobal).toBeCloseTo(sans.revenuNetGlobal, 0);
  });
});

describe("computeIR — déduction Madelin (chemin concubin, le piège)", () => {
  it("la déduction du TNS p1 réduit rev1 et PAS rev2 (cloisonnement)", () => {
    const base = {
      ...BASE_DATA,
      coupleStatus: "cohab",
      person1PcsGroupe: "2", microRegime1: false, ca1: "80000", chargesReelles1: "0", // p1 TNS, benefice 80000
      person2FirstName: "Conj", person2LastName: "Test",
      person2PcsGroupe: "4", salary2: "40000",  // p2 salarié
      travail: { p1: { statutPro: "tns_artisan" }, p2: { statutPro: "salarie_cadre" } },
      prevoyance: { version: 1, p1: persoP1(5000), p2: null },
    };
    const sans = computeIR({ ...base, prevoyance: undefined } as any, STD_OPTIONS);
    const avec = computeIR(base as any, STD_OPTIONS);
    expect(avec.rev1).toBeCloseTo(sans.rev1 - 5000, 0); // p1 déduit
    expect(avec.rev2).toBeCloseTo(sans.rev2, 0);        // p2 intact
  });
});
