import { describe, it, expect } from "vitest";
import { parseNum, formatEur, creditSummary } from "../lib/accueil/quickCalc";

describe("parseNum — saisie tolérante", () => {
  it("espaces (milliers) + virgule décimale", () => {
    expect(parseNum("250 000")).toBe(250000);
    expect(parseNum("3,4")).toBe(3.4);
    expect(parseNum("1 234,56")).toBeCloseTo(1234.56);
  });
  it("vide / invalide -> 0", () => {
    expect(parseNum("")).toBe(0);
    expect(parseNum("abc")).toBe(0);
    expect(parseNum(undefined as any)).toBe(0);
  });
});

describe("formatEur — fr-FR", () => {
  it("0 et infini/NaN", () => {
    expect(formatEur(0)).toBe("0 €");
    expect(formatEur(NaN)).toBe("—");
    expect(formatEur(Infinity)).toBe("—");
  });
  it("se termine par le symbole euro", () => {
    expect(formatEur(94901).endsWith("€")).toBe(true);
  });
});

describe("creditSummary — consomme calcMonthlyPayment", () => {
  it("cas nominal 250000 / 3,4 % / 20 ans", () => {
    const r = creditSummary(250000, 3.4, 20);
    expect(r.valid).toBe(true);
    expect(Math.round(r.mensualite)).toBe(1437);
    expect(Math.round(r.totalRembourse)).toBe(344901);
    expect(Math.round(r.coutTotal)).toBe(94901);
    expect(r.coutTotal).toBeCloseTo(r.totalRembourse - 250000);
  });
  it("taux zéro -> amortissement linéaire, coût nul", () => {
    const r = creditSummary(100000, 0, 10);
    expect(Math.round(r.mensualite)).toBe(833);
    expect(Math.round(r.totalRembourse)).toBe(100000);
    expect(Math.round(r.coutTotal)).toBe(0);
  });
  it("durée nulle -> invalide, aucun NaN", () => {
    const r = creditSummary(250000, 3.4, 0);
    expect(r.valid).toBe(false);
    expect(r.mensualite).toBe(0);
    expect(Number.isNaN(r.mensualite)).toBe(false);
    expect(Number.isNaN(r.coutTotal)).toBe(false);
    expect(Number.isNaN(r.totalRembourse)).toBe(false);
  });
  it("capital nul -> invalide", () => {
    expect(creditSummary(0, 3.4, 20).valid).toBe(false);
  });
});
