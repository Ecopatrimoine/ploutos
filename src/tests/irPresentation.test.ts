// LOT 10b — réconciliation à l'euro de la carte-roi IR : Σ lignes === finalIR.
import { describe, it, expect } from "vitest";
import { buildIrRoiCard, type IrLike } from "../lib/analysis/irPresentation";

const sum = (r: { lines: { value: number }[] }) => r.lines.reduce((t, l) => t + l.value, 0);

describe("buildIrRoiCard — réconciliation carte-roi (Lot 10b)", () => {
  it("cas standard : barème (résidu) + PFU + PS foncier + PS meublé = finalIR", () => {
    const ir: IrLike = { finalIR: 10_000, totalPFU: 1_500, foncierSocialLevy: 800, meubleSocialLevy: 200 };
    const roi = buildIrRoiCard(ir);
    expect(sum(roi)).toBeCloseTo(10_000, 2);
    const bareme = roi.lines.find((l) => l.key === "bareme")!;
    expect(bareme.value).toBeCloseTo(7_500, 2); // 10000 − 1500 − 800 − 200
    // PS foncier + meublé fusionnés en une ligne « Prélèvements sociaux »
    const ps = roi.lines.find((l) => l.key === "ps")!;
    expect(ps.value).toBeCloseTo(1_000, 2);
    expect(ps.detail).toBe("foncier 17,2 % · meublé 18,6 %");
  });

  it("composantes rares (rachat AV + PS rentes PER) restent dans la réconciliation", () => {
    const ir: IrLike = { finalIR: 20_000, totalPFU: 2_000, foncierSocialLevy: 1_000, meubleSocialLevy: 0, avRachatImpot: 1_200, perRentesPS: 600 };
    const roi = buildIrRoiCard(ir);
    expect(sum(roi)).toBeCloseTo(20_000, 2);
    expect(roi.lines.find((l) => l.key === "av")!.value).toBeCloseTo(1_200, 2);
    expect(roi.lines.find((l) => l.key === "perPS")!.value).toBeCloseTo(600, 2);
    // barème résidu = 20000 − 2000 − 1000 − 0 − 1200 − 600
    expect(roi.lines.find((l) => l.key === "bareme")!.value).toBeCloseTo(15_200, 2);
  });

  it("cas forfaitaire : barème ~0, l'essentiel de l'impôt vient du PFU", () => {
    const ir: IrLike = { finalIR: 3_058, totalPFU: 3_058, foncierSocialLevy: 0 };
    const roi = buildIrRoiCard(ir);
    expect(sum(roi)).toBeCloseTo(3_058, 2);
    // barème nul -> pas de ligne barème ; PFU porte tout le total
    expect(roi.lines.find((l) => l.key === "bareme")).toBeUndefined();
    expect(roi.lines).toHaveLength(1);
    expect(roi.lines[0].key).toBe("pfu");
  });

  it("PS foncier seul : détail « foncier 17,2 % » sans « meublé »", () => {
    const ir: IrLike = { finalIR: 5_000, totalPFU: 0, foncierSocialLevy: 500, meubleSocialLevy: 0 };
    const roi = buildIrRoiCard(ir);
    expect(sum(roi)).toBeCloseTo(5_000, 2);
    expect(roi.lines.find((l) => l.key === "ps")!.detail).toBe("foncier 17,2 %");
  });

  it("impôt nul : aucune ligne (Σ = 0)", () => {
    const roi = buildIrRoiCard({ finalIR: 0 });
    expect(roi.total).toBe(0);
    expect(roi.lines).toHaveLength(0);
  });

  it("champs absents (undefined) traités comme 0 — pas de NaN", () => {
    const roi = buildIrRoiCard({ finalIR: 7_435.99 });
    expect(sum(roi)).toBeCloseTo(7_435.99, 2);
    expect(roi.lines.every((l) => Number.isFinite(l.value))).toBe(true);
  });
});
