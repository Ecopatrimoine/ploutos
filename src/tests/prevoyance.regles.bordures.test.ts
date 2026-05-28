// ─── T2 / Famille C — Bordures des règles & constats (PLAN_TESTS §C) ───
//
// Les cas positif/négatif de base sont couverts dans
// prevoyance.regles.test.ts (Lot 6). Ce fichier se concentre sur les
// BORDURES (seuils exacts : ≤ vs <, âge pivot, %), où se cachent les
// erreurs d'inégalité stricte/large. Pour les seuils chiffrés on FORGE
// une projection déterministe afin de contrôler le ratio au centième.

import { describe, it, expect } from "vitest";
import {
  regleDcCapitalInsuffisantDettes,
  regleDcPasDeRenteConjointEnfantsJeunes,
  regleIjPlafondInsuffisant,
  regleInvCat2AucuneCouvertureCompl,
} from "../lib/prevoyance/regles";
import { calcConjointACharge, calcEnfantsMineurs } from "../lib/prevoyance/contexte";
import type {
  ContexteRegle,
  EntreePerso,
  ProjectionResult,
  SerieEmpilee,
} from "../lib/prevoyance/types";
import type { PatrimonialData } from "../types/patrimoine";

// ── Helpers de forge ────────────────────────────────────────────────

function baseEntree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 48, salaireBrutAnnuel: 55000,
    salaireNetMensuel: 3575, contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

// Projection minimale à 2 points (J180 et J1095) pour piloter les
// ratios de seuil au centième près.
function fakeProjection(opts: {
  revenuRef: number;
  totalJ180?: number;
  pensionJ1095?: number;
  renteCollJ1095?: number;
  renteIndJ1095?: number;
}): ProjectionResult {
  const z = () => [0, 0];
  const series: SerieEmpilee = {
    salaire: z(), maintienEmployeur: z(), ijObligatoire: z(),
    ijComplementaireCollective: z(), ijComplementaireIndividuelle: z(),
    pensionInvalObligatoire: z(), renteInvalCollective: z(), renteInvalIndividuelle: z(),
  };
  if (opts.totalJ180 !== undefined) series.ijObligatoire[0] = opts.totalJ180;
  if (opts.pensionJ1095 !== undefined) series.pensionInvalObligatoire[1] = opts.pensionJ1095;
  if (opts.renteCollJ1095 !== undefined) series.renteInvalCollective[1] = opts.renteCollJ1095;
  if (opts.renteIndJ1095 !== undefined) series.renteInvalIndividuelle[1] = opts.renteIndJ1095;
  return {
    axe: [
      { jour: 180, date: "2026-01-01", phase: "am" },
      { jour: 1095, date: "2029-01-01", phase: "invalidite" },
    ],
    series,
    revenuReferenceMensuel: opts.revenuRef,
    rupturesCles: [],
    basculeInvaliditeJour: 1095,
    finProjectionJour: 8760,
    categorieInvaliditeProjetee: "cat2",
    useLegalDefault: false,
    donneesCaisseIndisponibles: false,
  };
}

function ctxWith(projection: ProjectionResult, over: Partial<ContexteRegle> = {}): ContexteRegle {
  return {
    entree: baseEntree(),
    projection,
    dettesImmobilieres: 0,
    conjointACharge: false,
    enfantsMineurs: 0,
    revenuP1Mensuel: 0,
    revenuP2Mensuel: 0,
    ...over,
  };
}

function minimalData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "", person1LastName: "", person1BirthDate: "",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: false,
    person1Handicap: false, person2Handicap: false, childrenData: [],
    salary1: "0", salary2: "0", pensions: "0", perDeduction: "0",
    pensionDeductible: "0", otherDeductible: "0",
    ca1: "0", bicType1: "", microRegime1: true, chargesReelles1: "0", baRevenue1: "0",
    chargesDetail1: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    ca2: "0", bicType2: "", microRegime2: true, chargesReelles2: "0", baRevenue2: "0",
    chargesDetail2: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    properties: [], placements: [], perRentes: [], otherLoans: [],
    ...over,
  };
}

describe("Famille C — Bordures des règles", () => {
  // C2 bordure — capital DC = dettes exactement → ne déclenche pas
  it("C2 — capital décès == dettes exactement → ne déclenche pas (seuil >=)", () => {
    const ctx = ctxWith(fakeProjection({ revenuRef: 3000 }), {
      entree: baseEntree({ contratsIndividuels: [{ id: "dc", type: "deces_capital", capitalOuMontant: 200000 }] }),
      dettesImmobilieres: 200000,
    });
    expect(regleDcCapitalInsuffisantDettes(ctx, "p1")).toBeNull();
    // 1 € de moins de capital → déclenche
    const ctx2 = ctxWith(fakeProjection({ revenuRef: 3000 }), {
      entree: baseEntree({ contratsIndividuels: [{ id: "dc", type: "deces_capital", capitalOuMontant: 199999 }] }),
      dettesImmobilieres: 200000,
    });
    const c = regleDcCapitalInsuffisantDettes(ctx2, "p1");
    expect(c).not.toBeNull();
    expect(c?.impactChiffre?.montant).toBe(1);
  });

  // C3 bordure — âge pivot 18 ans
  it("C3 — enfant 17 ans 11 mois compte comme mineur ; 18 ans révolus non", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    // ~17 ans 11 mois : né il y a 17 ans et 11 mois
    const presque18 = new Date(y - 18, m + 1, d).toISOString().slice(0, 10);
    // 18 ans pile aujourd'hui
    const exact18 = new Date(y - 18, m, d).toISOString().slice(0, 10);
    expect(calcEnfantsMineurs(minimalData({ childrenData: [
      { firstName: "A", lastName: "", birthDate: presque18, parentLink: "", custody: "", rattached: true, handicap: false },
    ] }))).toBe(1);
    expect(calcEnfantsMineurs(minimalData({ childrenData: [
      { firstName: "B", lastName: "", birthDate: exact18, parentLink: "", custody: "", rattached: true, handicap: false },
    ] }))).toBe(0);
  });

  // C3 (suite) — la règle ne déclenche pas si plus d'enfant mineur
  it("C3 — dc_pas_de_rente : déclenche avec enfant mineur, pas sans", () => {
    const proj = fakeProjection({ revenuRef: 3000 });
    const avecEnfant = ctxWith(proj, { conjointACharge: true, enfantsMineurs: 1, revenuP1Mensuel: 4000, revenuP2Mensuel: 500 });
    const sansEnfant = ctxWith(proj, { conjointACharge: true, enfantsMineurs: 0, revenuP1Mensuel: 4000, revenuP2Mensuel: 500 });
    expect(regleDcPasDeRenteConjointEnfantsJeunes(avecEnfant, "p1")).not.toBeNull();
    expect(regleDcPasDeRenteConjointEnfantsJeunes(sansEnfant, "p1")).toBeNull();
  });

  // C5 bordure — trou exactement 30 % → ne déclenche pas (seuil ratio >= 0.7)
  it("C5 — trou = 30 % pile (ratio 0.70) → ne déclenche pas ; 31 % → déclenche", () => {
    const ref = 1000;
    // ratio 0.70 exactement : total = 700
    const ctx70 = ctxWith(fakeProjection({ revenuRef: ref, totalJ180: 700 }));
    expect(regleIjPlafondInsuffisant(ctx70, "p1")).toBeNull();
    // ratio 0.69 (trou 31 %) : total = 690 → déclenche
    const ctx69 = ctxWith(fakeProjection({ revenuRef: ref, totalJ180: 690 }));
    const c = regleIjPlafondInsuffisant(ctx69, "p1");
    expect(c).not.toBeNull();
    expect(c?.severite).toBe("attention");
    expect(c?.impactChiffre?.montant).toBeCloseTo(310, 0);
  });

  // C7 bordure — pension cat2 = 60 % pile → ne déclenche pas
  it("C7 — pension invalidité = 60 % du revenu pile → ne déclenche pas ; 59 % → déclenche", () => {
    const ref = 1000;
    const ctx60 = ctxWith(fakeProjection({ revenuRef: ref, pensionJ1095: 600 }));
    expect(regleInvCat2AucuneCouvertureCompl(ctx60, "p1")).toBeNull();
    const ctx59 = ctxWith(fakeProjection({ revenuRef: ref, pensionJ1095: 590 }));
    expect(regleInvCat2AucuneCouvertureCompl(ctx59, "p1")).not.toBeNull();
  });

  // C7 (suite) — présence d'une rente compl. neutralise la règle même si pension faible
  it("C7 — rente collective présente → ne déclenche pas même si pension obl faible", () => {
    const ctx = ctxWith(fakeProjection({ revenuRef: 1000, pensionJ1095: 100, renteCollJ1095: 500 }));
    expect(regleInvCat2AucuneCouvertureCompl(ctx, "p1")).toBeNull();
  });

  // C9 bordure — conjoint à charge au seuil 50 %
  it("C9 — P2 à 49,9 % du revenu P1 → à charge ; 50,1 % → pas à charge", () => {
    // P1 = 100 000 ; seuil = 50 000
    const aCharge = calcConjointACharge(minimalData({ coupleStatus: "married", salary1: "100000", salary2: "49900" }));
    const pasACharge = calcConjointACharge(minimalData({ coupleStatus: "married", salary1: "100000", salary2: "50100" }));
    expect(aCharge).toBe(true);
    expect(pasACharge).toBe(false);
  });

  it("C9 — P2 exactement à 50 % → PAS à charge (seuil strict <)", () => {
    const exact50 = calcConjointACharge(minimalData({ coupleStatus: "married", salary1: "100000", salary2: "50000" }));
    expect(exact50).toBe(false);
  });
});
