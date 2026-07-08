// LOT 4 (charts) — C4 : labels de tranche au format FR (virgule decimale, pas de
// point anglais, ".0" superflu retire). Le formateur vit dans computeTaxFromBrackets.
import { describe, it, expect } from "vitest";
import { computeTaxFromBrackets, euro, euroTick } from "../lib/calculs/utils";

// Construit des tranches contigues et remplit tout (base tres grande) pour lire les labels.
const labelsFor = (rates: number[]): string[] => {
  let from = 0;
  const brackets = rates.map((rate, i) => {
    const to = i === rates.length - 1 ? Infinity : from + 100_000;
    const b = { from, to, rate };
    from = to as number;
    return b;
  });
  return computeTaxFromBrackets(10_000_000, brackets).fill.map((f) => f.label);
};

describe("computeTaxFromBrackets — labels de tranche (C4)", () => {
  it("decimales en virgule FR", () => {
    expect(labelsFor([0.005])[0]).toBe("0,5 %");
    expect(labelsFor([0.007])[0]).toBe("0,7 %");
    expect(labelsFor([0.013])[0]).toBe("1,3 %");
  });

  it("'.0' superflu retire (1.0 -> 1)", () => {
    expect(labelsFor([0.01])[0]).toBe("1 %");
  });

  it("taux >= 10 % : entier, sans decimale", () => {
    expect(labelsFor([0.11])[0]).toBe("11 %");
    expect(labelsFor([0.30])[0]).toBe("30 %");
    expect(labelsFor([0.45])[0]).toBe("45 %");
  });

  it("aucun point decimal anglais dans les labels (bareme IFI + IR)", () => {
    const labels = labelsFor([0, 0.005, 0.007, 0.01, 0.0125, 0.015, 0.11, 0.30, 0.41, 0.45]);
    labels.forEach((l) => expect(l).not.toMatch(/\d\.\d/));
  });
});

describe("euro — grands nombres (ticks YAxis C3)", () => {
  it("format FR (groupes non separes par des virgules anglaises) + symbole €", () => {
    const s = euro(999_999_999);
    expect(s).toContain("€");
    expect(s).not.toMatch(/\d,\d{3}/); // pas de "999,999,999"
    expect(euro(90_000)).toContain("€");
  });

  it("euroTick : euros pleins sous le seuil, compact (M€/Md€) au-dela (C3)", () => {
    expect(euroTick(90_000)).toBe(euro(90_000));         // plein
    expect(euroTick(12_000_000)).toBe(euro(12_000_000)); // patrimoine realiste max -> plein
    expect(euroTick(250_000_000)).toBe("250 M€");        // compact
    expect(euroTick(1_000_000_000)).toBe("1 Md€");       // compact
  });
});
