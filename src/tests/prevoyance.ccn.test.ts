// ─── T5 / Famille G3 — Conventions collectives Tranche 1 (PLAN_TESTS §G3) ─
//
// STRUCTURE PRÊTE À ACTIVER. Les paliers de maintien employeur et les
// minima de prévoyance des CCN sont aujourd'hui TO_VERIFY / TO_FILL dans
// ccn-2026.json. Ces tests restent en describe.skip et s'activeront CCN
// par CCN, au fil du remplissage depuis Légifrance / base KALI.
//
// Pour chaque CCN remplie, on vérifie :
//   - carence employeur (0 pour Syntec subrogation, 7 j légal sinon)
//   - paliers de maintien selon ancienneté (jours à 100/90 %, 66 %)
//   - taux T1 prévoyance cadres >= 1,50 %
//   - cohérence avec le maintien légal Mensualisation (CCN >= légal)

import { describe, it, expect } from "vitest";
import { referentiels } from "../data/prevoyance";

const ccn = referentiels.ccn as any;
const conventions = ccn.conventions;

// Le maintien légal Mensualisation est, lui, FERME (valeurs publiques).
describe("G3 — Maintien légal Mensualisation (ferme, actif)", () => {
  it("carence légale 7 jours", () => {
    expect(ccn.maintienLegal.carenceJours).toBe(7);
  });
  it("7 paliers croissants (12 → 372 mois)", () => {
    const p = ccn.maintienLegal.paliers;
    expect(p).toHaveLength(7);
    expect(p[0].ancienneteMois).toBe(12);
    expect(p[6].ancienneteMois).toBe(372);
  });
  it("palier 1 an : 30 j à 90 % puis 30 j à 66,66 %", () => {
    expect(ccn.maintienLegal.paliers[0].joursA90Pct).toBe(30);
    expect(ccn.maintienLegal.paliers[0].joursA6666Pct).toBe(30);
  });
});

// ── Syntec (1486) — référence T1, subrogation ──
describe.skip("G3 — Syntec (IDCC 1486) (à activer après remplissage paliers)", () => {
  const syntec = conventions["1486"];
  it("taux T1 prévoyance cadres >= 1,50 %", () => {
    expect(syntec.prevoyanceCadres.tauxT1Minimum).toBeGreaterThanOrEqual(1.5);
  });
  it("carence employeur 0 (subrogation)", () => {
    expect(syntec.maintienEmployeur.carenceJours).toBe(0);
    expect(syntec.maintienEmployeur.subrogation).toBe(true);
  });
  it("maintien Syntec >= maintien légal Mensualisation (à ancienneté égale)", () => {
    // Comparaison palier à palier à activer quand les paliers Syntec
    // seront renseignés (jours à 100 % et 66 %).
    expect(Array.isArray(syntec.maintienEmployeur.paliers)).toBe(true);
  });
});

// ── Métallurgie (3248) ──
describe.skip("G3 — Métallurgie (IDCC 3248) (à activer après remplissage)", () => {
  const metal = conventions["3248"];
  it("maintien employeur renseigné (barèmes par classes A-I)", () => {
    expect(metal.maintienEmployeur.paliers).toBeDefined();
  });
});

// ── HCR (1979) ──
describe.skip("G3 — HCR (IDCC 1979) (à activer après remplissage)", () => {
  const hcr = conventions["1979"];
  it("maintien employeur non-cadres renseigné", () => {
    expect(hcr.prevoyanceNonCadres).toBeDefined();
  });
});

// ── Bâtiment (1597/1596/2609/2420), Pharmacie (1996), Commerce alim
//    (2216), Transports (16) : même structure à dupliquer au remplissage.
describe.skip("G3 — Autres CCN Tranche 1 (à activer au fil du remplissage)", () => {
  const idccTranche1 = ["1597", "1596", "2609", "2420", "1996", "2216", "16"];
  it("chaque CCN Tranche 1 a un maintien employeur >= légal une fois renseignée", () => {
    for (const idcc of idccTranche1) {
      expect(conventions[idcc]).toBeDefined();
    }
  });
});
