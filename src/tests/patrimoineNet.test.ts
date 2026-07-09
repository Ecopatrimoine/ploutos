// LOT 10b (addendum 2) — helper bilan patrimonial net (dénominateur du taux moyen IFI).
import { describe, it, expect } from "vitest";
import { computePatrimoineNet } from "../lib/calculs/patrimoine";

describe("computePatrimoineNet — actif brut − passif total", () => {
  it("agrège immobilier + placements financiers, actif net sans dette", () => {
    const data = {
      properties: [{ value: "500000" }],                 // pas d'emprunt -> crédit immo 0
      placements: [{ type: "Compte-titres", value: "100000" }, { type: "PEA", value: "50000" }],
      otherLoans: [],
    };
    const r = computePatrimoineNet(data);
    expect(r.immobilier).toBe(500_000);
    expect(r.placementsFinanciers).toBe(150_000);
    expect(r.actifBrut).toBe(650_000);
    expect(r.passifTotal).toBe(0);
    expect(r.patrimoineNet).toBe(650_000);
  });

  it("déduit les autres crédits (CRD) du patrimoine net", () => {
    const data = {
      properties: [{ value: "800000" }],
      placements: [],
      otherLoans: [{ capitalRemaining: "60000" }],
    };
    const r = computePatrimoineNet(data);
    expect(r.autresCredits).toBe(60_000);
    expect(r.patrimoineNet).toBe(740_000); // 800 000 − 60 000
  });

  it("données absentes -> tout à 0 (pas de crash)", () => {
    const r = computePatrimoineNet({});
    expect(r.patrimoineNet).toBe(0);
    expect(Number.isFinite(r.patrimoineNet)).toBe(true);
  });
});
