import { describe, it, expect } from "vitest";
import { parseNum, formatEur, formatPct, creditSummary, pvImmoSummary, irSummary, endettementSummary, dmtgSummary } from "../lib/accueil/quickCalc";

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

describe("irSummary — consomme computeBaremeNet + computeIRConcubin + getChildrenFiscalParts", () => {
  it("tranche 0 % (revenu faible)", () => {
    const r = irSummary(10000, false, 0);
    expect(r.valid).toBe(true);
    expect(Math.round(r.impot)).toBe(0);
    expect(r.tmi).toBe(0);
  });
  it("célibataire 30000 -> tranche 30 %", () => {
    const r = irSummary(30000, false, 0);
    expect(Math.round(r.impot)).toBe(2104);
    expect(r.tmi).toBe(0.3);
  });
  it("saut de tranche à 29579 / 29580 (TMI bascule 11 % -> 30 %)", () => {
    expect(irSummary(29579, false, 0).tmi).toBe(0.11);
    expect(irSummary(29580, false, 0).tmi).toBe(0.3);
  });
  it("couple 60000 -> 2 parts", () => {
    const r = irSummary(60000, true, 0);
    expect(Math.round(r.impot)).toBe(4208);
    expect(r.parts).toBe(2);
  });
  it("enfants -> demi-parts via getChildrenFiscalParts", () => {
    const r = irSummary(40000, false, 2);
    expect(r.parts).toBe(2); // 1 part de base + 2 x 0,5
    expect(Math.round(r.impot)).toBe(1787);
  });
  it("plafonnement QF actif -> TMI = tranche de référence", () => {
    const r = irSummary(150000, false, 3);
    expect(r.plafonnementActif).toBe(true);
    expect(r.tmi).toBe(0.41);
    expect(Math.round(r.impot)).toBe(35618);
  });
  it("revenu 0 -> invalide", () => {
    expect(irSummary(0, false, 0).valid).toBe(false);
  });
});

describe("endettementSummary — arithmétique pure (taux d'effort)", () => {
  it("sans projet", () => {
    const r = endettementSummary(4000, 800, 0);
    expect(r.valid).toBe(true);
    expect(r.tauxEffortActuel).toBeCloseTo(0.2);
    expect(r.tauxEffortProjet).toBeNull();
    expect(r.mensualiteMax35).toBeCloseTo(600); // 4000*0.35 - 800
    expect(r.resteAVivre).toBeCloseTo(3200);
  });
  it("avec projet", () => {
    const r = endettementSummary(4000, 800, 700);
    expect(r.tauxEffortProjet).toBeCloseTo(0.375); // (800+700)/4000
    expect(r.resteAVivre).toBeCloseTo(2500);
    expect(r.mensualiteMax35).toBeCloseTo(600);
  });
  it("revenus nuls -> invalide", () => {
    const r = endettementSummary(0, 800, 0);
    expect(r.valid).toBe(false);
    expect(Number.isNaN(r.tauxEffortActuel)).toBe(false);
  });
});

describe("dmtgSummary — consomme getDonationTaxProfile + computeTaxFromBrackets", () => {
  it("enfant sous l'abattement -> 0 droit", () => {
    const r = dmtgSummary(80000, "enfant");
    expect(r.valid).toBe(true);
    expect(r.abattement).toBe(100000);
    expect(r.baseTaxable).toBe(0);
    expect(Math.round(r.droits)).toBe(0);
    expect(Math.round(r.netTransmis)).toBe(80000);
  });
  it("enfant au-delà de l'abattement", () => {
    const r = dmtgSummary(200000, "enfant");
    expect(r.baseTaxable).toBe(100000);
    expect(Math.round(r.droits)).toBe(18194);
    expect(Math.round(r.netTransmis)).toBe(181806);
  });
  it("tiers (aucun abattement, 60 %)", () => {
    const r = dmtgSummary(50000, "tiers");
    expect(r.abattement).toBe(0);
    expect(Math.round(r.droits)).toBe(30000);
    expect(Math.round(r.netTransmis)).toBe(20000);
  });
  it("frère / soeur (abattement 15 932)", () => {
    const r = dmtgSummary(100000, "frereSoeur");
    expect(r.abattement).toBe(15932);
    expect(Math.round(r.droits)).toBe(35388);
  });
  it("montant 0 -> invalide", () => {
    expect(dmtgSummary(0, "enfant").valid).toBe(false);
  });
});
