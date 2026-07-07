import { describe, it, expect } from "vitest";
import {
  computeMicroBicMeuble,
  computeReelMeuble,
  amortissementAuto,
  detectLmp,
} from "../lib/calculs/locationMeublee";

// Golden values verifiees en Python le 07/07/2026 (prompt Lot 0). Tolerance centime.

describe("locationMeublee — micro-BIC (art. 50-0 CGI)", () => {
  it("T1 residuel 12000 -> abattement 6000, base 6000, eligible", () => {
    const r = computeMicroBicMeuble(12000, "longue_duree");
    expect(r.base).toBeCloseTo(6000, 2);
    expect(r.abattement).toBeCloseTo(6000, 2);
    expect(r.eligible).toBe(true);
  });

  it("T2 tourisme non classe 14000 -> base 9800 (abattement 30 %)", () => {
    const r = computeMicroBicMeuble(14000, "tourisme_non_classe");
    expect(r.base).toBeCloseTo(9800, 2);
    expect(r.abattement).toBeCloseTo(4200, 2);
    expect(r.eligible).toBe(true);
  });

  it("T3 residuel 500 -> plancher abattement 305, base 195", () => {
    const r = computeMicroBicMeuble(500, "longue_duree");
    expect(r.abattement).toBeCloseTo(305, 2);
    expect(r.base).toBeCloseTo(195, 2);
  });

  it("T4 bornes d'eligibilite : 83600 true / 90000 false / nonClasse 16000 false", () => {
    expect(computeMicroBicMeuble(83600, "longue_duree").eligible).toBe(true);
    expect(computeMicroBicMeuble(90000, "longue_duree").eligible).toBe(false);
    expect(computeMicroBicMeuble(16000, "tourisme_non_classe").eligible).toBe(false);
  });
});

describe("locationMeublee — regime reel (art. 39 C + 156 I-1 ter CGI)", () => {
  it("T5 18000/8000/12000 -> resultat 0, amortDeductible 10000, ard 2000, baseFoyer 0", () => {
    const r = computeReelMeuble(18000, 8000, 12000);
    expect(r.resultat).toBeCloseTo(0, 2);
    expect(r.amortDeductible).toBeCloseTo(10000, 2);
    expect(r.ard).toBeCloseTo(2000, 2);
    expect(r.baseFoyer).toBeCloseTo(0, 2);
  });

  it("T6 15000/4000/6000 -> resultat 5000, ard 0, baseFoyer 5000", () => {
    const r = computeReelMeuble(15000, 4000, 6000);
    expect(r.resultat).toBeCloseTo(5000, 2);
    expect(r.ard).toBeCloseTo(0, 2);
    expect(r.baseFoyer).toBeCloseTo(5000, 2);
  });

  it("T7 10000/13000/5000 -> resultat -3000, amortDeductible 0, ard 5000, baseFoyer 0, deficitReportable 3000", () => {
    const r = computeReelMeuble(10000, 13000, 5000);
    expect(r.resultat).toBeCloseTo(-3000, 2);
    expect(r.amortDeductible).toBeCloseTo(0, 2);
    expect(r.ard).toBeCloseTo(5000, 2);
    expect(r.baseFoyer).toBeCloseTo(0, 2);
    expect(r.deficitReportable).toBeCloseTo(3000, 2);
  });
});

describe("locationMeublee — amortissement par composants", () => {
  it("T8 amortissementAuto(300000, 0.15, 10000) -> immobilier 9307.50, mobilier 1428.57, total 10736.07", () => {
    const r = amortissementAuto(300000, 0.15, 10000);
    expect(r.immobilier).toBeCloseTo(9307.5, 2);
    expect(r.mobilier).toBeCloseTo(1428.57, 2);
    expect(r.total).toBeCloseTo(10736.07, 2);
    // detail : GO 2550 / toiture 1020 / IGT 1912.50 / facade 1275 / agencements 2550
    const byName = Object.fromEntries(r.detail.map((d) => [d.composant, d.dotation]));
    expect(byName.grosOeuvre).toBeCloseTo(2550, 2);
    expect(byName.toiture).toBeCloseTo(1020, 2);
    expect(byName.installationsTechniques).toBeCloseTo(1912.5, 2);
    expect(byName.facadeEtancheite).toBeCloseTo(1275, 2);
    expect(byName.agencements).toBeCloseTo(2550, 2);
  });

  it("T10 override DUREE : gros oeuvre 40 ans -> dotation 3187.50, autres inchanges, total 11373.57", () => {
    const r = amortissementAuto(300000, 0.15, 10000, { grosOeuvre: { duree: 40 } });
    const byName = Object.fromEntries(r.detail.map((d) => [d.composant, d.dotation]));
    expect(byName.grosOeuvre).toBeCloseTo(3187.5, 2); // 255000 * 0.50 / 40
    expect(byName.toiture).toBeCloseTo(1020, 2);       // inchange
    expect(r.immobilier).toBeCloseTo(9945, 2);         // 3187.50 + 1020 + 1912.50 + 1275 + 2550
    expect(r.total).toBeCloseTo(11373.57, 2);          // + mobilier 1428.57
    expect(r.detail.find((d) => d.composant === "grosOeuvre")?.ajuste).toBe(true);
  });

  it("T12 override PART + garde somme des parts : gros oeuvre 60 % -> dotation 3060, sommeParts 1.10", () => {
    const r = amortissementAuto(300000, 0.15, 10000, { grosOeuvre: { part: 0.6 } });
    const byName = Object.fromEntries(r.detail.map((d) => [d.composant, d.dotation]));
    expect(byName.grosOeuvre).toBeCloseTo(3060, 2); // 255000 * 0.60 / 50
    expect(r.sommeParts).toBeCloseTo(1.1, 4);        // 0.60 + 0.10 + 0.15 + 0.10 + 0.15 -> garde UI (!= 1)
  });

  it("appel SANS overrides = comportement historique strict (retrocompat)", () => {
    const r = amortissementAuto(300000, 0.15, 10000);
    expect(r.total).toBeCloseTo(10736.07, 2);
    expect(r.sommeParts).toBeCloseTo(1, 6); // grille par defaut = 100 %
    expect(r.detail.every((d) => d.ajuste === false)).toBe(true);
  });
});

describe("locationMeublee — detection LMP (art. 155 IV-2 CGI, double borne stricte)", () => {
  it("T9 (30000,25000)=true ; (30000,40000)=false ; (22000,10000)=false ; (23000,10000)=false", () => {
    expect(detectLmp(30000, 25000)).toBe(true);
    expect(detectLmp(30000, 40000)).toBe(false);
    expect(detectLmp(22000, 10000)).toBe(false);
    expect(detectLmp(23000, 10000)).toBe(false); // borne stricte : 23000 non > 23000
  });
});
