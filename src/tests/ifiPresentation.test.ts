// LOT 10b — réconciliation à l'euro de la carte-roi IFI : Σ lignes === ifi.ifi.
import { describe, it, expect } from "vitest";
import { buildIfiRoiCard, type IfiLike } from "../lib/analysis/ifiPresentation";

const sum = (r: { lines: { value: number }[] }) => r.lines.reduce((t, l) => t + l.value, 0);

describe("buildIfiRoiCard — réconciliation carte-roi (Lot 10b)", () => {
  it("au-dessus du seuil, sans décote : IFI barème = IFI dû", () => {
    const ifi: IfiLike = { netTaxable: 2_000_000, grossIfi: 8_190, decote: 0, ifi: 8_190 };
    const roi = buildIfiRoiCard(ifi);
    expect(roi.belowThreshold).toBe(false);
    expect(sum(roi)).toBeCloseTo(8_190, 2);
    expect(roi.lines).toHaveLength(1);
    expect(roi.lines[0].key).toBe("bareme");
  });

  it("dans la bande de décote (1,3–1,4 M€) : barème − décote = IFI dû", () => {
    // netTaxable 1,35 M€ -> décote = 17 500 − 1,25 % × 1 350 000 = 625
    const gross = 1_875; // barème (2e tranche) sur 1,35 M€
    const decote = 625;
    const ifi: IfiLike = { netTaxable: 1_350_000, grossIfi: gross, decote, ifi: gross - decote };
    const roi = buildIfiRoiCard(ifi);
    expect(sum(roi)).toBeCloseTo(gross - decote, 2);
    const d = roi.lines.find((l) => l.key === "decote")!;
    expect(d.negative).toBe(true);
    expect(d.value).toBeCloseTo(-625, 2);
  });

  it("sous le seuil : aucune ligne, total 0, motif « belowThreshold »", () => {
    const ifi: IfiLike = { netTaxable: 900_000, grossIfi: 700, decote: 0, ifi: 0 };
    const roi = buildIfiRoiCard(ifi);
    expect(roi.belowThreshold).toBe(true);
    expect(roi.total).toBe(0);
    expect(roi.lines).toHaveLength(0);
    expect(sum(roi)).toBe(0);
  });

  it("au seuil exact (1,3 M€) : non exigible", () => {
    const roi = buildIfiRoiCard({ netTaxable: 1_300_000, grossIfi: 1_625, decote: 0, ifi: 0 });
    expect(roi.belowThreshold).toBe(true);
    expect(roi.lines).toHaveLength(0);
  });
});
