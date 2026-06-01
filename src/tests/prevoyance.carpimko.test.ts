// ─── LOT CARPIMKO — auxiliaires médicaux libéraux (bloc docs/bloc-carpimko-2026.json) ──
//
// SPÉCIFICITÉ : prestations entièrement FORFAITAIRES (indépendantes du
// revenu), contrairement à la CARMF (liée au revenu) et la CIPAV (points).
// Le revenu n'intervient QUE en phase 1 CPAM.
//   J4-J90  : IJ libéraux (RAAM/730, plafond 3×PASS → 197,51, plancher 26,33).
//   J91→fin 3e année : allocation journalière forfaitaire 55,44 €/j
//             (+ 8,06/descendant + 20,16 tierce personne ; conjoint SUPPRIMÉ).
//   4e année → : rente d'invalidité forfaitaire (10 080 partielle / 20 160 totale / 0 < 66 %).
//
// Décès/rentes (forfaitaires) = fonctions pures hors courbe.
//
// TO_VERIFY (it.skip) : H4 majoration enfant invalidité (3 024 vs 6 048),
// H5 durée phase 2 (1095 vs 1005 j), H7 borne d'âge rente éducation,
// H9 conjoint collaborateur.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import {
  ijCarpimkoPhase1Journaliere,
  ijCarpimkoPhase2Journaliere,
  renteInvaliditeCarpimkoAnnuelle,
  majorationsInvaliditeTotaleCarpimkoAnnuelle,
  capitalDecesCarpimko,
  renteConjointCarpimkoAnnuelle,
  renteEducationCarpimkoAnnuelle,
} from "../lib/prevoyance/carpimko";
import { referentiels } from "../data/prevoyance";
import type { CarpimkoConfig, EntreePerso, ProjectionResult } from "../lib/prevoyance/types";

const ref = referentiels.carpimko;

function idxJour(axe: ProjectionResult["axe"], j: number): number {
  return axe.findIndex((p) => p.jour === j);
}

function cfg(over: Partial<CarpimkoConfig> = {}): CarpimkoConfig {
  return {
    revenuBNC_N2: 45000,
    tauxInvalidite: 100,
    nbEnfants: 1,
    besoinTiercePersonne: false,
    marie: false,
    ...over,
  };
}

function auxiliaire(over: Partial<EntreePerso> = {}, carpimkoOver: Partial<CarpimkoConfig> = {}): EntreePerso {
  return {
    age: 45, ageRetraite: 64, statutPro: "tns_liberal", caisse: "CARPIMKO",
    idccCCN: null, ancienneteMois: 180, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: 45000, nbEnfantsACharge: 1,
    contratsIndividuels: [], couvertureCollective: null,
    carpimko: cfg(carpimkoOver),
    ...over,
  };
}

// ────────────────────────────────────────────────────────────────────
// §1 — Phase 1 IJ libéraux (J4-J90, liée au revenu, dispositif commun)
// ────────────────────────────────────────────────────────────────────
describe("CARPIMKO §1 — IJ libéraux J4-J90 (seul barème lié au revenu)", () => {
  it("revenu intermédiaire : 45 000 / 730 = 61,64 €/j", () => {
    expect(ijCarpimkoPhase1Journaliere(ref, cfg(), 90)).toBeCloseTo(45000 / 730, 4);
  });

  it("plafond 3×PASS : revenu ≥ 144 180 € → 197,51 €/j", () => {
    expect(ijCarpimkoPhase1Journaliere(ref, cfg({ revenuBNC_N2: 200000 }), 90)).toBeCloseTo(144180 / 730, 4);
  });

  it("plancher : revenu 15 000 € → 26,33 €/j", () => {
    expect(ijCarpimkoPhase1Journaliere(ref, cfg({ revenuBNC_N2: 15000 }), 90)).toBeCloseTo(26.33, 2);
  });

  it("seuil d'éligibilité : revenu < 4 806 € → 0", () => {
    expect(ijCarpimkoPhase1Journaliere(ref, cfg({ revenuBNC_N2: 4000 }), 90)).toBe(0);
  });

  it("carence (J1-J3) et hors fenêtre (J91+) → 0", () => {
    expect(ijCarpimkoPhase1Journaliere(ref, cfg(), 3)).toBe(0);
    expect(ijCarpimkoPhase1Journaliere(ref, cfg(), 4)).toBeGreaterThan(0);
    expect(ijCarpimkoPhase1Journaliere(ref, cfg(), 91)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §2 — Phase 2 allocation journalière FORFAITAIRE (J91 → fin 3e année)
// ────────────────────────────────────────────────────────────────────
describe("CARPIMKO §2 — allocation journalière forfaitaire (indépendante du revenu)", () => {
  it("base 55,44 €/j (forfait, identique quel que soit le revenu)", () => {
    expect(ijCarpimkoPhase2Journaliere(ref, cfg({ revenuBNC_N2: 25000, nbEnfants: 0 }), 91)).toBeCloseTo(55.44, 2);
    expect(ijCarpimkoPhase2Journaliere(ref, cfg({ revenuBNC_N2: 200000, nbEnfants: 0 }), 91)).toBeCloseTo(55.44, 2);
  });

  it("majoration descendant : +8,06 €/j par enfant", () => {
    expect(ijCarpimkoPhase2Journaliere(ref, cfg({ nbEnfants: 1 }), 91)).toBeCloseTo(55.44 + 8.06, 2);
    expect(ijCarpimkoPhase2Journaliere(ref, cfg({ nbEnfants: 2 }), 91)).toBeCloseTo(55.44 + 2 * 8.06, 2);
  });

  it("majoration tierce personne : +20,16 €/j", () => {
    expect(ijCarpimkoPhase2Journaliere(ref, cfg({ nbEnfants: 0, besoinTiercePersonne: true }), 91)).toBeCloseTo(55.44 + 20.16, 2);
  });

  it("majoration conjoint SUPPRIMÉE (01/01/2025) : le statut marié ne change pas l'allocation", () => {
    expect(ijCarpimkoPhase2Journaliere(ref, cfg({ marie: true, nbEnfants: 0 }), 91)).toBeCloseTo(
      ijCarpimkoPhase2Journaliere(ref, cfg({ marie: false, nbEnfants: 0 }), 91), 6
    );
  });

  it("hors fenêtre (< J91 ou > fin 3e année) → 0", () => {
    expect(ijCarpimkoPhase2Journaliere(ref, cfg(), 90)).toBe(0);
    expect(ijCarpimkoPhase2Journaliere(ref, cfg(), 1096)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §3 — Rente d'invalidité forfaitaire par palier
// ────────────────────────────────────────────────────────────────────
describe("CARPIMKO §3 — rente d'invalidité forfaitaire (par palier, pas ×taux)", () => {
  it("totale (100 %) = 20 160 €/an", () => {
    expect(renteInvaliditeCarpimkoAnnuelle(ref, cfg({ tauxInvalidite: 100 }))).toBe(20160);
  });

  it("partielle (66-99 %) = 10 080 €/an (montant unique, indépendant du % exact)", () => {
    expect(renteInvaliditeCarpimkoAnnuelle(ref, cfg({ tauxInvalidite: 66 }))).toBe(10080);
    expect(renteInvaliditeCarpimkoAnnuelle(ref, cfg({ tauxInvalidite: 99 }))).toBe(10080);
  });

  it("sous 66 % → 0 (vide de couverture)", () => {
    expect(renteInvaliditeCarpimkoAnnuelle(ref, cfg({ tauxInvalidite: 65 }))).toBe(0);
    expect(renteInvaliditeCarpimkoAnnuelle(ref, cfg({ tauxInvalidite: 40 }))).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §4 — Décès & rentes (forfaitaires, fonctions pures hors courbe)
// ────────────────────────────────────────────────────────────────────
describe("CARPIMKO §4 — capital décès & rentes survivants (forfaitaires)", () => {
  it("capital décès selon la situation : 36 288 / 54 432 / 18 144", () => {
    expect(capitalDecesCarpimko(ref, cfg({ marie: true, nbEnfants: 0 }))).toBe(36288); // conjoint seul
    expect(capitalDecesCarpimko(ref, cfg({ marie: true, nbEnfants: 2 }))).toBe(54432); // conjoint + descendant
    expect(capitalDecesCarpimko(ref, cfg({ marie: false, nbEnfants: 0 }))).toBe(18144); // sans ayant droit
  });

  it("rente conjoint 10 080 €/an (si marié/PACS, 0 sinon)", () => {
    expect(renteConjointCarpimkoAnnuelle(ref, cfg({ marie: true }))).toBe(10080);
    expect(renteConjointCarpimkoAnnuelle(ref, cfg({ marie: false }))).toBe(0);
  });

  it("rente éducation 7 560 €/an PAR enfant", () => {
    expect(renteEducationCarpimkoAnnuelle(ref, cfg({ nbEnfants: 3 }))).toBe(3 * 7560);
    expect(renteEducationCarpimkoAnnuelle(ref, cfg({ nbEnfants: 0 }))).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §5 — Cas d'or (projection complète)
// ────────────────────────────────────────────────────────────────────
describe("CARPIMKO §5 — Cas G (IDEL 45 k€, 1 enfant)", () => {
  const e = auxiliaire();
  const r = projeterArretMaladie(e, "cat2", referentiels, "ald");

  it("revenu de référence = 45 000 / 12 = 3 750 €", () => {
    expect(r.revenuReferenceMensuel).toBeCloseTo(3750, 1);
  });

  it("J90 : IJ libéraux ≈ 1 849 €/mois (lié au revenu)", () => {
    expect(r.series.ijObligatoire[idxJour(r.axe, 90)]).toBeCloseTo((45000 / 730) * 30, 0);
  });

  it("J91 : relais forfait ≈ 1 905 €/mois (55,44 + 8,06 enfant) ×30", () => {
    expect(r.series.ijObligatoire[idxJour(r.axe, 91)]).toBeCloseTo((55.44 + 8.06) * 30, 0);
    expect(r.series.ijObligatoire[idxJour(r.axe, 547)]).toBeCloseTo((55.44 + 8.06) * 30, 0);
  });

  it("rupture « relais_carpimko » à J91 (ni relais CARMF ni trou CIPAV)", () => {
    expect(r.rupturesCles.some((rc) => rc.type === "relais_carpimko" && rc.jour === 91)).toBe(true);
    expect(r.rupturesCles.some((rc) => rc.type === "relais_carmf")).toBe(false);
    expect(r.rupturesCles.some((rc) => rc.type === "trou_cipav")).toBe(false);
  });

  it("J1095 : rente invalidité totale forfaitaire = 20 160 / 12 = 1 680 €/mois (sans majorations)", () => {
    const i = idxJour(r.axe, 1095);
    expect(r.series.pensionInvalObligatoire[i]).toBeCloseTo(1680, 0);
    expect(r.series.renteInvalEnfants[i]).toBe(0); // rentes CARPIMKO = décès, hors courbe
  });

  it("invalidité coupée à 62 ans (bascule retraite pour inaptitude)", () => {
    // La rente d'invalidité CARPIMKO est INCOMPATIBLE avec la retraite : elle
    // cesse à 62 ans (bascule retraite pour inaptitude). Source carpimko.com.
    // Règle d'âge légale commune (AGE_BASCULE_RETRAITE) appliquée à toutes les
    // caisses dans projeterArretMaladie. Ici age 45 → bascule à (62-45)*365.
    const dernierJour = (e.ageRetraite - e.age) * 365; // 19 ans → 6935 (âge 64 ≥ 62)
    // Avant 62 ans (J1095 = âge 48) : rente forfaitaire servie ; au-delà : 0.
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, 1095)]).toBeCloseTo(1680, 0);
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, dernierJour)]).toBe(0);
  });

  it("scénario ALD : pas de faux « données indisponibles » (branche dédiée)", () => {
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });
});

describe("CARPIMKO §5 — Cas G-haut-revenu (kiné 90 k€, effet forfait)", () => {
  const e = auxiliaire({ revenuTNSAnnuel: 90000, nbEnfantsACharge: 0 }, { revenuBNC_N2: 90000, nbEnfants: 0 });
  const r = projeterArretMaladie(e, "cat2", referentiels, "ald");

  it("J90 IJ ≈ 3 699 €/mois → J91 forfait 1 663 €/mois : chute ≈ −55 %", () => {
    const j90 = r.series.ijObligatoire[idxJour(r.axe, 90)];
    const j91 = r.series.ijObligatoire[idxJour(r.axe, 91)];
    expect(j90).toBeCloseTo((90000 / 730) * 30, 0);
    expect(j91).toBeCloseTo(55.44 * 30, 0);
    expect(j91 / j90).toBeCloseTo(0.45, 2); // -55 %
  });
});

describe("CARPIMKO §5 — Cas G-modeste (orthophoniste 25 k€, forfait protecteur)", () => {
  const e = auxiliaire({ revenuTNSAnnuel: 25000, nbEnfantsACharge: 0 }, { revenuBNC_N2: 25000, nbEnfants: 0 });
  const r = projeterArretMaladie(e, "cat2", referentiels, "ald");

  it("le forfait J91 (1 663 €) est SUPÉRIEUR à la phase 1 (1 027 €) : relais protecteur", () => {
    const j90 = r.series.ijObligatoire[idxJour(r.axe, 90)];
    const j91 = r.series.ijObligatoire[idxJour(r.axe, 91)];
    expect(j90).toBeCloseTo((25000 / 730) * 30, 0);
    expect(j91).toBeCloseTo(55.44 * 30, 0);
    expect(j91).toBeGreaterThan(j90);
  });
});

// ────────────────────────────────────────────────────────────────────
// §6 — TO_VERIFY (it.skip jusqu'à confirmation source)
// ────────────────────────────────────────────────────────────────────
describe("CARPIMKO §6 — TO_VERIFY (en attente de confirmation source)", () => {
  // H4 — majorations invalidité totale NON appliquées dans la courbe
  // (divergence sources : enfant 3 024 vs 6 048). La fonction pure existe et
  // sera branchée une fois la source confirmée.
  it.skip("TO_VERIFY H4 — majorations invalidité totale (tierce 6 048, enfant 3 024 €/an, divergence)", () => {
    const c = cfg({ tauxInvalidite: 100, nbEnfants: 1, besoinTiercePersonne: true });
    expect(majorationsInvaliditeTotaleCarpimkoAnnuelle(ref, c)).toBe(6048 + 3024);
  });

  // H5 — durée exacte de l'allocation phase 2 : 'fin de la 3e année' (≈ J1095)
  // vs 1005 j selon sources secondaires. Borne retenue : 1095.
  it.skip("TO_VERIFY H5 — durée phase 2 = fin 3e année (1095 vs 1005 j, à confirmer)", () => {
    expect(ref.ijCarpimkoPhase2.borneFinJour).toBe(1095);
  });

  // H7 — borne d'âge de la rente éducation (18/21 vs 25 si études).
  it.skip("TO_VERIFY H7 — borne d'âge rente éducation (18/21 vs 25 si études)", () => {
    expect(true).toBe(true); // à modéliser une fois la borne confirmée
  });

  // H9 — conjoint collaborateur CARPIMKO : statut existant mais droits
  // prévoyance non détaillés → option non implémentée.
  it.skip("TO_VERIFY H9 — option conjoint collaborateur CARPIMKO (non détaillée, non implémentée)", () => {
    expect(true).toBe(true);
  });
});
