// LOT 10b (addendum 2) — réconciliation carte-roi IFI + taux moyen + cas décote.
import { describe, it, expect } from "vitest";
import { buildIfiRoiCard, type IfiLike } from "../lib/analysis/ifiPresentation";

const sum = (r: { lines: { value: number }[] }) => r.lines.reduce((t, l) => t + l.value, 0);
// Barème IFI (pour la tranche marginale) : bornes hautes + taux.
const BRACKETS = [
  { to: 800_000, rate: 0 }, { to: 1_300_000, rate: 0.005 }, { to: 2_570_000, rate: 0.007 },
  { to: 5_000_000, rate: 0.01 }, { to: 10_000_000, rate: 0.0125 }, { to: Number.POSITIVE_INFINITY, rate: 0.015 },
];

describe("buildIfiRoiCard — carte-roi IFI (addendum 2, Lot 10b)", () => {
  it("au-delà de 1,4 M€ : barème + décote grisée (placeholder 0) ; Σ = ifi", () => {
    const ifi: IfiLike = { netTaxable: 2_000_000, grossIfi: 8_190, decote: 0, ifi: 8_190, bracketFill: BRACKETS };
    const roi = buildIfiRoiCard(ifi);
    expect(roi.belowThreshold).toBe(false);
    expect(sum(roi)).toBeCloseTo(8_190, 2);
    const d = roi.lines.find((l) => l.key === "decote")!;
    expect(d.placeholder).toBe(true);
    expect(d.value).toBe(0);
    expect(roi.marginalRate).toBe(0.007); // tranche active à 2 M€
  });

  it("bande de décote (1,3–1,4 M€) : barème − décote = ifi", () => {
    const gross = 1_875, decote = 625; // netTaxable 1,35 M€ -> décote = 17 500 − 1,25 % × 1 350 000
    const ifi: IfiLike = { netTaxable: 1_350_000, grossIfi: gross, decote, ifi: gross - decote, bracketFill: BRACKETS };
    const roi = buildIfiRoiCard(ifi);
    expect(sum(roi)).toBeCloseTo(gross - decote, 2);
    const d = roi.lines.find((l) => l.key === "decote")!;
    expect(d.negative).toBe(true);
    expect(d.value).toBeCloseTo(-625, 2);
    expect(d.placeholder).toBeFalsy();
  });

  it("non-assujetti (actif ≤ 1,3 M€) : total 0, aucune ligne, marge verte informative", () => {
    const roi = buildIfiRoiCard({ netTaxable: 900_000, grossIfi: 500, decote: 0, ifi: 0, bracketFill: BRACKETS });
    expect(roi.belowThreshold).toBe(true);
    expect(roi.total).toBe(0);
    expect(roi.lines).toHaveLength(0);
    expect(sum(roi)).toBe(0);
  });

  it("au seuil exact (1,3 M€) : non exigible", () => {
    const roi = buildIfiRoiCard({ netTaxable: 1_300_000, grossIfi: 2_500, decote: 0, ifi: 0, bracketFill: BRACKETS });
    expect(roi.belowThreshold).toBe(true);
    expect(roi.lines).toHaveLength(0);
  });

  it("taux moyen = ifi / actif net taxable (2 décimales de présentation)", () => {
    const roi = buildIfiRoiCard({ netTaxable: 2_000_000, grossIfi: 8_190, decote: 0, ifi: 8_190, bracketFill: BRACKETS });
    expect(roi.tauxMoyen).toBeCloseTo(8_190 / 2_000_000, 6); // ~0,41 %
    // base nulle -> pas de division par zéro
    expect(buildIfiRoiCard({ netTaxable: 0, ifi: 0 }).tauxMoyen).toBe(0);
  });

  it("tranche marginale absente si bracketFill non fourni (fallback 0)", () => {
    const roi = buildIfiRoiCard({ netTaxable: 2_000_000, grossIfi: 8_190, ifi: 8_190 });
    expect(roi.marginalRate).toBe(0);
  });
});
