// ─── T5 / Famille G2 — Régimes obligatoires par caisse (PLAN_TESTS §G2) ─
//
// STRUCTURE PRÊTE À ACTIVER. Tant que caisses-2026.json contient des
// TO_VERIFY / TO_FILL sur les IJ journalières, taux d'invalidité et
// capitaux décès, ces tests restent en describe.skip. On les activera
// caisse par caisse, AU FIL du remplissage des valeurs sourcées (ameli,
// carmf.fr, cipav, carpimko, secu-independants…).
//
// Les tests portent sur la valeur JOURNALIÈRE (computeIJObligatoireJournaliere),
// pas le mensuel d'affichage (convention ×30).
//
// PRIORITÉ de remplissage : CPAM (tous salariés) → SSI (TNS commerce/
// artisans) → CARMF (médecins) → CIPAV (PL non régl.) → CARPIMKO → autres.

import { describe, it, expect } from "vitest";
import {
  computeIJObligatoireJournaliere,
  computeInvalObligatoireMensuel,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

const vars = buildPlafondVariables(referentiels);
const caisses = (referentiels.caisses as any).caisses;

function entreeSalarie(brut: number): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: brut,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
  };
}
function entreeTNS(caisse: EntreePerso["caisse"], revenu: number, classe?: string): EntreePerso {
  return {
    age: 48, ageRetraite: 64, statutPro: "tns_liberal", caisse,
    idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: revenu, classeCotisationCaisse: classe,
    contratsIndividuels: [], couvertureCollective: null,
  };
}

// ── CPAM (régime général, tous salariés du privé) — vérifié 2026-05-28 ──
describe("G2 — CPAM 2026 (valeurs vérifiées à la source ameli/service-public)", () => {
  const cpam = caisses.CPAM;
  // Au-delà du plafond salaire : SJB plafonné → IJ = 41,95 €/j.
  // Sous le plafond : IJ proportionnelle. PASS mensuel = 4005 €.
  const PASS_MENSUEL = 4005;

  it("carence 3 jours : IJ = 0 sur [J0,J2], > 0 à partir de J3", () => {
    const e = entreeSalarie(40000);
    expect(computeIJObligatoireJournaliere(2, cpam, e, vars)).toBe(0);
    expect(computeIJObligatoireJournaliere(3, cpam, e, vars)!).toBeGreaterThan(0);
  });
  it("IJ plafonnée à 41,95 €/j pour salaire > 2552 €/mois (plafond 1,4 SMIC)", () => {
    // salaire mensuel 200000/12 ≫ 2552,24 → SJB = 2552,24×3/91,25, IJ = ×0,5.
    const ij = computeIJObligatoireJournaliere(30, cpam, entreeSalarie(200000), vars);
    expect(ij).toBeCloseTo(41.95, 1);
  });
  it("IJ proportionnelle (50 % SJB) pour salaire < plafond", () => {
    // brut 24000 → salaire mensuel 2000 < 2552 → SJB = 2000×3/91,25 = 65,75,
    // IJ = 32,88 €/j (proportionnelle, sous le plafond).
    const ij = computeIJObligatoireJournaliere(30, cpam, entreeSalarie(24000), vars);
    expect(ij).toBeCloseTo(32.88, 1);
    expect(ij!).toBeLessThan(41.95);
  });
  it("scénario maladie ordinaire : IJ obligatoire = 0 après J360", () => {
    expect(
      computeIJObligatoireJournaliere(361, cpam, entreeSalarie(40000), vars, "maladie_ordinaire")
    ).toBe(0);
  });
  it("scénario ALD : IJ obligatoire maintenue à J361 (durée 1095 j)", () => {
    const ij = computeIJObligatoireJournaliere(361, cpam, entreeSalarie(40000), vars, "ald");
    expect(ij!).toBeGreaterThan(0);
    // À J1095 encore servie, à J1096 terminée (borne ALD).
    expect(computeIJObligatoireJournaliere(1095, cpam, entreeSalarie(40000), vars, "ald")!).toBeGreaterThan(0);
    expect(computeIJObligatoireJournaliere(1096, cpam, entreeSalarie(40000), vars, "ald")).toBe(0);
  });
  it("invalidité cat1 = 30 % SAM, bornée [338,31 ; 1201,50]", () => {
    expect(cpam.invalidite.categories.cat1.taux).toBe(0.30);
    // Haut revenu : SAM plafonné au PASS → 30 % × 4005 = 1201,50 (= maxMensuel).
    const haut = computeInvalObligatoireMensuel(cpam, "cat1", 200000 / 12, 0);
    expect(haut).toBeCloseTo(0.30 * PASS_MENSUEL, 2);
    expect(haut).toBeCloseTo(1201.50, 2);
  });
  it("invalidité cat2 = 50 % SAM, bornée [338,31 ; 2002,50]", () => {
    expect(cpam.invalidite.categories.cat2.taux).toBe(0.50);
    const haut = computeInvalObligatoireMensuel(cpam, "cat2", 200000 / 12, 0);
    expect(haut).toBeCloseTo(0.50 * PASS_MENSUEL, 2);
    expect(haut).toBeCloseTo(2002.50, 2);
  });
  it("invalidité cat3 = cat2 + MTP 1298,44, bornée [1636,75 ; 3300,94]", () => {
    expect(cpam.invalidite.categories.cat3.majorationTiercePersonneMensuelle).toBeCloseTo(1298.44, 2);
    const haut = computeInvalObligatoireMensuel(cpam, "cat3", 200000 / 12, 0);
    expect(haut).toBeCloseTo(2002.50 + 1298.44, 2);
    expect(haut).toBeCloseTo(3300.94, 2);
  });
  it("capital décès = 4 009 € forfaitaire (en vigueur 01/04/2026)", () => {
    expect(cpam.capitalDeces.montant).toBe(4009);
  });
});

// ── SSI (TNS commerçants / artisans) — vérifié 2026-05-28 ──
describe("G2 — SSI 2026 (valeurs vérifiées : arrêté 01/08/2023, ameli, SODECC)", () => {
  const ssi = caisses.SSI;

  it("carence maladie 3 jours", () => {
    expect(ssi.ij.carenceJours).toBe(3);
  });
  it("IJ = RAAM/730, plafonnée à 65,84 €/j (RAAM ≥ PASS)", () => {
    // RAAM 200000 ≫ PASS 48060 → RAAM plafonné → 48060/730 = 65,84 €/j.
    const ijHaut = computeIJObligatoireJournaliere(30, ssi, entreeTNS("SSI", 200000), vars);
    expect(ijHaut).toBeCloseTo(65.84, 1);
  });
  it("IJ proportionnelle = RAAM/730 sous le PASS (ex. RAAM 36 500 → 50 €/j)", () => {
    const ij = computeIJObligatoireJournaliere(30, ssi, entreeTNS("SSI", 36500), vars);
    expect(ij).toBeCloseTo(50.0, 2);
    expect(ij!).toBeLessThan(65.84);
  });
  it("IJ = 0 si RAAM < 4582 € (seuil plancher — trou pédagogique réel)", () => {
    expect(computeIJObligatoireJournaliere(30, ssi, entreeTNS("SSI", 3000), vars)).toBe(0);
  });
  it("invalidité PITD (cat2) = 50 % du revenu, bornée [747 ; 2002,50 €/mois]", () => {
    expect(ssi.invalidite.categories.cat2.taux).toBe(0.5);
    // Revenu mensuel 10 000 → 50 % = 5000, plafonné à 50 % PMSS = 2002,50 €
    // (maxMensuel confirmé ameli 2026, vérifié 30/05/2026).
    expect(computeInvalObligatoireMensuel(ssi, "cat2", 0, 10000)).toBeCloseTo(2002.50, 2);
    // Revenu faible (1000) → 50 % = 500 < 747 → remonté au plancher.
    expect(computeInvalObligatoireMensuel(ssi, "cat2", 0, 1000)).toBeCloseTo(747, 2);
  });
  it("invalidité PIPM (cat1) = 30 % du revenu, bornée [530,21 ; 1201,50 €/mois]", () => {
    expect(ssi.invalidite.categories.cat1.taux).toBe(0.3);
    // Revenu 10 000 → 30 % = 3000, plafonné à 30 % PMSS = 1201,50 € (maxMensuel confirmé ameli 2026).
    expect(computeInvalObligatoireMensuel(ssi, "cat1", 0, 10000)).toBeCloseTo(1201.50, 2);
    expect(computeInvalObligatoireMensuel(ssi, "cat1", 0, 1000)).toBeCloseTo(530.21, 2);
  });
  it("capital décès actif/invalide = 9 612 € (20 % PASS)", () => {
    expect(ssi.capitalDeces.montantActifOuInvalide).toBe(9612);
  });
  it("capital décès retraité = 3 844,80 € (8 % PASS 2026, corrigé depuis 3 768)", () => {
    expect(ssi.capitalDeces.montantRetraite).toBeCloseTo(3844.80, 2);
  });
  it("capital décès orphelin = 2 403 € par enfant (5 % PASS 2026, confirmé ameli)", () => {
    expect(ssi.capitalDeces.montantParEnfant).toBe(2403);
    expect(ssi.capitalDeces.montantParEnfant).toBeCloseTo((referentiels.pass as any).pass.annuel * 0.05, 2);
  });
  it("durées : 360 j ordinaire / 1095 j ALD", () => {
    expect(ssi.ij.plafondDureeJours).toBe(360);
    expect(ssi.ij.plafondDureeJoursALD).toBe(1095);
  });
});

// ── CARMF (médecins libéraux) — LE trou pédagogique (carence 90j) ──
describe.skip("G2 — CARMF 2026 (à activer après remplissage)", () => {
  const carmf = caisses.CARMF;
  it("carence 90 jours : IJ obligatoire = 0 sur [J0,J89], première valeur à J90", () => {
    const e = entreeTNS("CARMF", 95000, "B");
    expect(computeIJObligatoireJournaliere(60, carmf, e, vars)).toBe(0);
    expect(computeIJObligatoireJournaliere(90, carmf, e, vars)!).toBeGreaterThan(0);
  });
  it("IJ uniforme par classe A/B/C (valeurs journalières figées)", () => {
    expect(typeof carmf.ij.classes.B.ijJournaliere).toBe("number");
  });
  it("capital décès forfaitaire par classe (~71 500 € selon classe)", () => {
    expect(carmf.capitalDeces.montants).toBeDefined();
  });
});

// ── CIPAV (professions libérales non réglementées) ──
describe.skip("G2 — CIPAV 2026 (à activer après remplissage)", () => {
  const cipav = caisses.CIPAV;
  it("IJ faible (~22 €/j), introduite en 2021", () => {
    const ij = computeIJObligatoireJournaliere(30, cipav, entreeTNS("CIPAV", 50000), vars);
    expect(ij!).toBeCloseTo(22, 0);
  });
  it("durée limitée 87 jours (à vérifier 2026)", () => {
    expect(cipav.ij.plafondDureeJours).toBe(87);
  });
});

// ── CARPIMKO (auxiliaires médicaux) ──
describe.skip("G2 — CARPIMKO 2026 (à activer après remplissage)", () => {
  const carpimko = caisses.CARPIMKO;
  it("carence 90 jours, IJ uniforme", () => {
    expect(carpimko.ij.carenceJours).toBe(90);
    expect(typeof carpimko.ij.ijJournaliere).toBe("number");
  });
});
