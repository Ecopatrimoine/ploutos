// ─── LOT ASSUR-3 — CCN 1679 Inspection d'assurance (RPP partage avec 1672) ─────
//
// Le RPP (accord 24/06/2013) couvre 1672 ET 1679 a l'identique ; seul le maintien
// employeur est propre (art. 59 CCN 1679, miroir de l'art. 82 CCN 1672). Ce lot
// pose une garde anti-divergence : les blocs de garanties RPP de 1679 doivent
// rester STRICTEMENT egaux a ceux de 1672. PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import { resolveCapitalDecesBranche } from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { computeIJCollective, getMaintienParams } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";

const PASS = 48060;
const conv = (idcc: string) => (referentiels.ccn as any).conventions[idcc];

describe("1679 — entree presente, nom, plafond 8 PASS", () => {
  it("entree existe, nom Inspection d'assurance, plafondSalaireRefPass 8", () => {
    const c = conv("1679");
    expect(c).toBeDefined();
    expect(c.nom).toContain("Inspection d'assurance");
    expect(c.plafondSalaireRefPass).toBe(8);
  });
});

// ── Garde anti-divergence : blocs RPP STRICTEMENT egaux a 1672 ────────────────
describe("1679 — garanties RPP strictement egales a 1672 (garde anti-divergence)", () => {
  const a = conv("1672");
  const b = conv("1679");

  it("devolutionCapitalDeces identique a 1672", () => {
    expect(b.devolutionCapitalDeces).toEqual(a.devolutionCapitalDeces);
  });

  it("plafondSalaireRefPass identique a 1672", () => {
    expect(b.plafondSalaireRefPass).toEqual(a.plafondSalaireRefPass);
  });

  for (const college of ["prevoyanceCadres", "prevoyanceNonCadres"] as const) {
    for (const bloc of ["capitalDC", "renteEducation", "ij", "invalidite"] as const) {
      it(`${college}.garantiesMinimum.${bloc} identique a 1672`, () => {
        expect(b[college].garantiesMinimum[bloc]).toEqual(a[college].garantiesMinimum[bloc]);
      });
    }
  }
});

// ── Maintien propre (art. 59) : structurellement identique a 1672 ─────────────
describe("1679 — maintien employeur art. 59 (propre, miroir art. 82)", () => {
  for (const cat of ["cadres", "nonCadres"] as const) {
    it(`${cat} : carence 0, 90 j a pct === 100 (ENTIER)`, () => {
      const m = getMaintienParams("1679", referentiels, cat);
      expect(m.source).toBe("ccn");
      expect(m.carenceJours).toBe(0);
      const palier = m.paliers.find((p) => p.ancienneteMois === 12);
      expect(palier).toBeDefined();
      expect(palier!.segments).toEqual([{ jours: 90, pct: 100 }]);
      expect(palier!.segments[0].pct).toBe(100);
    });
  }
});

// ── Cas chiffre de controle : capital marie 2 enfants = 275 % (plafond 8 PASS) ─
describe("1679 — capital marie 2 enfants = 275 %", () => {
  it("marie 2 enfants, salaire 80 000 -> 275 % x 80 000 = 220 000 EUR", () => {
    const cap = resolveCapitalDecesBranche("1679", "cadres", 80000, PASS, referentiels, {
      conjointPresent: true, nbEnfantsACharge: 2,
    }).capital;
    expect(cap).toBeCloseTo(2.75 * 80000, 2); // 220 000
  });

  it("plafond 8 PASS : marie 2 enfants, salaire 500 000 -> 275 % x 8 PASS", () => {
    const cap = resolveCapitalDecesBranche("1679", "cadres", 500000, PASS, referentiels, {
      conjointPresent: true, nbEnfantsACharge: 2,
    }).capital;
    expect(cap).toBeCloseTo(2.75 * 8 * PASS, 2); // 1 057 320
  });
});

// ── IJ : le mode paliers sert bien le second IDCC ────────────────────────────
describe("1679 — IJ branche a 2 paliers (mode paliers partage)", () => {
  const branche = resolveCouvertureBranche("1679", "cadres", referentiels);
  const cov: CouvertureCollective = { ij: branche.ij };
  const ij = (t: number) => computeIJCollective(t, cov, 1000, 0);

  it("t=90 -> 0.85 (850), t=360 -> 0.70 (700)", () => {
    expect(ij(90)).toBeCloseTo(850);
    expect(ij(360)).toBeCloseTo(700);
  });
});
