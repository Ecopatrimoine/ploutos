// ─── T1 / Famille B — Cohérence mathématique interne (PLAN_TESTS §B) ───
//
// Vérifie les relations entre grandeurs, indépendamment des valeurs
// absolues. Ces tests survivent au remplissage des TO_VERIFY.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, ProjectionResult, SerieEmpilee } from "../lib/prevoyance/types";

const SERIES_KEYS: Array<keyof SerieEmpilee> = [
  "salaire", "maintienEmployeur", "ijObligatoire",
  "ijComplementaireCollective", "ijComplementaireIndividuelle",
  "pensionInvalObligatoire", "renteInvalCollective", "renteInvalIndividuelle",
];

function baseSalarie(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40, ageRetraite: 64,
    statutPro: "salarie_cadre", caisse: "CPAM", idccCCN: null,
    ancienneteMois: 120, salaireBrutAnnuel: 55000, salaireNetMensuel: 3575,
    contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}
function baseTNS(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45, ageRetraite: 64,
    statutPro: "tns_liberal", caisse: "CARMF", idccCCN: null,
    ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: 90000, contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

function idx(r: ProjectionResult, jour: number): number {
  return r.axe.findIndex((p) => p.jour === jour);
}
function total(s: SerieEmpilee, i: number): number {
  return SERIES_KEYS.reduce((acc, k) => acc + s[k][i], 0);
}
function dureeMaintien(r: ProjectionResult): number {
  return r.series.maintienEmployeur.filter((v) => v > 0).length;
}

describe("Famille B — Cohérence mathématique interne", () => {
  // B1 — monotonie ancienneté
  it("B1 — plus l'ancienneté est élevée, plus la durée de maintien est longue (ou égale)", () => {
    const anciennetes = [0, 12, 72, 132, 252, 372];
    let prev = -1;
    for (const a of anciennetes) {
      const r = projeterArretMaladie(baseSalarie({ ancienneteMois: a }), "cat2", referentiels);
      const d = dureeMaintien(r);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  // B2 — la carence est un creux, pas un pic
  it("B2 — revenu à J0 (carence) <= revenu après le début d'indemnisation", () => {
    const r = projeterArretMaladie(
      baseSalarie({ ancienneteMois: 120, couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 30, plafondJours: 1095, baseCalcul: "T1_T2" } } }),
      "cat2", referentiels
    );
    const tJ0 = total(r.series, idx(r, 0));
    const tJ90 = total(r.series, idx(r, 90));
    expect(tJ0).toBeLessThanOrEqual(tJ90);
  });

  // B3 — empilement = total (pas de double comptage)
  it("B3 — la somme des 8 étages à chaque point est finie et >= 0", () => {
    const r = projeterArretMaladie(baseSalarie(), "cat2", referentiels);
    for (let i = 0; i < r.axe.length; i++) {
      const somme = total(r.series, i);
      expect(Number.isFinite(somme)).toBe(true);
      expect(somme).toBeGreaterThanOrEqual(0);
    }
  });

  // B4 — effet franchise contrat IJ
  it("B4 — contrat IJ franchise 30j : 0 sur [J0,J29], valeur à partir de J30", () => {
    const r = projeterArretMaladie(
      baseSalarie({ contratsIndividuels: [{ id: "ij", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 }] }),
      "cat2", referentiels
    );
    expect(r.series.ijComplementaireIndividuelle[idx(r, 14)]).toBe(0);
    expect(r.series.ijComplementaireIndividuelle[idx(r, 30)]).toBe(100 * 30);
  });

  // B5 — effet plafond contrat IJ
  it("B5 — au-delà du plafondJoursIJ, l'étage individuel retombe à 0", () => {
    const r = projeterArretMaladie(
      baseSalarie({ contratsIndividuels: [{ id: "ij", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 60 }] }),
      "cat2", referentiels
    );
    // Fenêtre active [30, 90], au-delà = 0.
    expect(r.series.ijComplementaireIndividuelle[idx(r, 60)]).toBe(100 * 30);
    expect(r.series.ijComplementaireIndividuelle[idx(r, 120)]).toBe(0);
  });

  // B6 — additivité contrats
  it("B6 — 2 contrats IJ 100 €/j (même franchise) → étage individuel = 200 €/j", () => {
    const r = projeterArretMaladie(
      baseSalarie({ contratsIndividuels: [
        { id: "ij1", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 },
        { id: "ij2", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 },
      ] }),
      "cat2", referentiels
    );
    expect(r.series.ijComplementaireIndividuelle[idx(r, 60)]).toBe(200 * 30);
  });

  // B7 — complémentaire collective = complément, jamais négatif ni sur-couverture
  it("B7 — ijColl = max(0, cible_pct × brut − (ijObl + maintien)) à chaque point AM", () => {
    const pct = 0.8;
    const r = projeterArretMaladie(
      baseSalarie({ ancienneteMois: 120, couvertureCollective: { ij: { pctSalaire: pct, franchise: 0, plafondJours: 1095, baseCalcul: "T1_T2" } } }),
      "cat2", referentiels
    );
    const brutMensuel = 55000 / 12;
    for (const p of r.axe) {
      if (p.jour >= 1095) continue;
      const i = idx(r, p.jour);
      const dejaCouvert = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i];
      const attendu = Math.max(0, brutMensuel * pct - dejaCouvert);
      expect(r.series.ijComplementaireCollective[i]).toBeCloseTo(attendu, 2);
    }
  });

  // B8 — catégories invalidité croissantes
  it("B8 — revenu invalidité cat3 >= cat2 >= cat1 (à couverture égale)", () => {
    const cov = { invalidite: { cat1: { pctSalaire: 0.4 }, cat2: { pctSalaire: 0.8 }, cat3: { pctSalaire: 1.0 } } };
    const e = baseSalarie({ couvertureCollective: cov });
    const j = 1095;
    const t1 = (() => { const r = projeterArretMaladie(e, "cat1", referentiels); return total(r.series, idx(r, j)); })();
    const t2 = (() => { const r = projeterArretMaladie(e, "cat2", referentiels); return total(r.series, idx(r, j)); })();
    const t3 = (() => { const r = projeterArretMaladie(e, "cat3", referentiels); return total(r.series, idx(r, j)); })();
    expect(t2).toBeGreaterThanOrEqual(t1);
    expect(t3).toBeGreaterThanOrEqual(t2);
  });

  // B9 — salaire nul + pas de TNS → tout à 0, pas de crash
  it("B9 — salaire brut 0 et pas de TNS → toutes séries à 0", () => {
    const r = projeterArretMaladie(
      baseSalarie({ salaireBrutAnnuel: 0, salaireNetMensuel: 0, statutPro: "sans_activite", caisse: null }),
      "cat2", referentiels
    );
    for (const key of SERIES_KEYS) {
      for (const v of r.series[key]) expect(v).toBe(0);
    }
  });

  // B10 — clamp âge proche retraite
  it("B10 — age 63 (retraite 64) → finProjectionJour = 365, aucun point au-delà", () => {
    const r = projeterArretMaladie(baseSalarie({ age: 63, ageRetraite: 64 }), "cat2", referentiels);
    expect(r.finProjectionJour).toBe(365);
    for (const p of r.axe) expect(p.jour).toBeLessThanOrEqual(365);
  });

  // B11 — TNS : maintien employeur = 0 partout
  it("B11 — TNS → maintienEmployeur = 0 sur tout l'axe", () => {
    const r = projeterArretMaladie(baseTNS(), "cat2", referentiels);
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });

  // B12 — salarié sans contrat ni collective : seuls maintien + IJ obligatoire en AM
  it("B12 — salarié sans contrat ni collective → étages individuel/collectif nuls", () => {
    const r = projeterArretMaladie(baseSalarie({ ancienneteMois: 120 }), "cat2", referentiels);
    for (const v of r.series.ijComplementaireIndividuelle) expect(v).toBe(0);
    for (const v of r.series.ijComplementaireCollective) expect(v).toBe(0);
    for (const v of r.series.renteInvalCollective) expect(v).toBe(0);
    for (const v of r.series.renteInvalIndividuelle) expect(v).toBe(0);
  });

  // B13 — continuité à la bascule J1095
  it("B13 — pas de saut absurde entre J912 (AM) et J1095 (invalidité)", () => {
    const r = projeterArretMaladie(
      baseSalarie({ ancienneteMois: 120, couvertureCollective: {
        ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" },
        invalidite: { cat1: { pctSalaire: 0.4 }, cat2: { pctSalaire: 0.8 }, cat3: { pctSalaire: 1.0 } },
      } }),
      "cat2", referentiels
    );
    const tAvant = total(r.series, idx(r, 912));
    const tApres = total(r.series, idx(r, 1095));
    expect(Number.isFinite(tApres)).toBe(true);
    // Pas de division par zéro / explosion : le revenu invalidité ne peut
    // pas exploser d'un facteur déraisonnable par rapport à la fin de l'AM.
    if (tAvant > 0) {
      expect(tApres).toBeLessThan(tAvant * 5 + 1000);
    }
  });

  // B14 — coefficient du revenu de référence salarié
  it("B14 — revenuRef ≈ salaireBrut × 0.78 / 12 quand le net mensuel n'est pas fourni", () => {
    const r = projeterArretMaladie(
      baseSalarie({ salaireBrutAnnuel: 60000, salaireNetMensuel: 0 }),
      "cat2", referentiels
    );
    expect(r.revenuReferenceMensuel).toBeCloseTo((60000 * 0.78) / 12, 2);
  });
});
