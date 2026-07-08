import { describe, it, expect } from "vitest";
import { parseNum, formatEur, formatPct, creditSummary, pvImmoSummary } from "../lib/accueil/quickCalc";

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

describe("formatPct — fraction -> pourcentage fr-FR", () => {
  it("mappe les abattements", () => {
    expect(formatPct(0.96)).toBe("96 %");
    expect(formatPct(1)).toBe("100 %");
    expect(formatPct(0.28)).toBe("28 %");
    expect(formatPct(0)).toBe("0 %");
  });
});

describe("pvImmoSummary — consomme computePvImmobiliere", () => {
  it("détention courte (3 ans) : abattements nuls, IR 19 % + PS 17,2 %", () => {
    const r = pvImmoSummary(200000, 300000, 3);
    expect(r.valid).toBe(true);
    expect(r.moinsValue).toBe(false);
    expect(Math.round(r.baseIr)).toBe(85000);
    expect(Math.round(r.impotIr)).toBe(16150);
    expect(Math.round(r.impotPs)).toBe(14620);
    expect(Math.round(r.impotTotal)).toBe(30770);
    expect(r.exonereIr).toBe(false);
    expect(r.exonerePs).toBe(false);
  });
  it("22 ans : exonéré d'IR, PS encore dû", () => {
    const r = pvImmoSummary(200000, 400000, 22);
    expect(r.exonereIr).toBe(true);
    expect(Math.round(r.impotIr)).toBe(0);
    expect(r.exonerePs).toBe(false);
    expect(Math.round(r.impotPs)).toBe(19195);
  });
  it("30 ans : exonéré d'IR et de PS", () => {
    const r = pvImmoSummary(200000, 500000, 30);
    expect(r.exonereIr).toBe(true);
    expect(r.exonerePs).toBe(true);
    expect(Math.round(r.impotTotal)).toBe(0);
  });
  it("moins-value : 0 partout, aucun négatif", () => {
    const r = pvImmoSummary(300000, 250000, 10);
    expect(r.moinsValue).toBe(true);
    expect(r.pvBrute).toBe(0);
    expect(r.impotIr).toBe(0);
    expect(r.impotPs).toBe(0);
    expect(r.impotTotal).toBe(0);
    expect(r.impotTotal).toBeGreaterThanOrEqual(0);
  });
  it("invalide si un prix manque", () => {
    expect(pvImmoSummary(0, 300000, 10).valid).toBe(false);
    expect(pvImmoSummary(200000, 0, 10).valid).toBe(false);
  });
});
