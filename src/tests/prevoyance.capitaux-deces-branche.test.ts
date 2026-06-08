// ─── LOT DECES-A — Résolveur capital décès de branche (CCN) ─────────────────
//
// Valeurs Syntec (IDCC 1486) : capital = max(1,70 × salaireRef, minimumPass ×
// PASS), salaireRef plafonné à 8 PASS. minimumPass = 3,40 (cadres) / 1,70
// (non-cadres). PASS 2026 = 48 060. Toute donnée absente → null + indispo.

import { describe, it, expect } from "vitest";
import { resolveCapitalDecesBranche } from "../lib/prevoyance/capitaux-deces-branche";
import { referentiels } from "../data/prevoyance";

const PASS = 48060;

describe("resolveCapitalDecesBranche — Syntec (1486)", () => {
  it("cadre, salaire 60 000 → plancher 3,40 PASS = 163 404", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 60000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.categorie).toBe("cadres");
    // max(1,70×60000=102000 ; 3,40×48060=163404) = 163404
    expect(r.capital).toBeCloseTo(163404, 2);
  });

  it("cadre, salaire 120 000 → 1,70 × salaire = 204 000 (plafond 8 PASS non atteint)", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(204000, 2);
  });

  it("plafond 8 PASS : salaire 500 000 → salaireRef plafonné = 8 × PASS", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 500000, PASS, referentiels);
    // 1,70 × (8 × 48060) = 1,70 × 384480 = 653 616
    expect(r.capital).toBeCloseTo(1.7 * 8 * PASS, 2);
  });

  it("non-cadre, salaire 30 000 → plancher 1,70 PASS = 81 702", () => {
    const r = resolveCapitalDecesBranche("1486", "nonCadres", 30000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    // max(1,70×30000=51000 ; 1,70×48060=81702) = 81702
    expect(r.capital).toBeCloseTo(81702, 2);
  });

  it("non-cadre, salaire 60 000 → 1,70 × salaire = 102 000 (au-dessus du plancher)", () => {
    const r = resolveCapitalDecesBranche("1486", "nonCadres", 60000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(102000, 2);
  });

  it("idcc inconnu → null + donneeIndisponible", () => {
    const r = resolveCapitalDecesBranche("9999", "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("idcc null → null + donneeIndisponible", () => {
    const r = resolveCapitalDecesBranche(null, "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("CCN présente mais capitalDC non documenté (3248 TO_FILL) → null + donneeIndisponible", () => {
    const r = resolveCapitalDecesBranche("3248", "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });
});
