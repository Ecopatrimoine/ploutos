// LOT 1e-B — capital initial immo déduit du CRD (aller-retour + intégration).
import { describe, it, expect } from "vitest";
import { calcCapitalRemaining, calcInitialCapitalFromCRD, resolveOneLoan } from "../lib/calculs/credit";

describe("calcInitialCapitalFromCRD — aller-retour avec calcCapitalRemaining", () => {
  it("taux 3%, 20 ans, 5 ans écoulés -> retrouve le capital initial", () => {
    const C = 200000, rate = 3, dur = 20, elapsed = 5;
    const crd = calcCapitalRemaining(C, rate, dur, elapsed);
    expect(crd).toBeGreaterThan(0);
    expect(crd).toBeLessThan(C); // amorti
    expect(calcInitialCapitalFromCRD(crd, rate, dur, elapsed)).toBeCloseTo(C, 0);
  });

  it("taux 0 : aller-retour linéaire exact", () => {
    const C = 120000, rate = 0, dur = 20, elapsed = 8;
    const crd = calcCapitalRemaining(C, rate, dur, elapsed);
    expect(calcInitialCapitalFromCRD(crd, rate, dur, elapsed)).toBeCloseTo(C, 6);
  });
});

describe("resolveOneLoan — déduction du capital initial (amount vide)", () => {
  const loan = (o: any = {}) => ({
    id: "l1", type: "amortissable", label: "P", amount: "", rate: "3", duration: "20", startDate: "2018-01-01",
    capitalRemaining: "170000", interestAnnual: "", pledgedPlacementIndex: "-1", insurance: false,
    insuranceGuarantees: "dc", insuranceRate: "", insuranceRate1: "", insuranceRate2: "", insurancePremium: "", insuranceCoverage: "banque", ...o,
  });

  it("amount VIDE + CRD/taux/durée/date -> amountResolved déduit (> CRD), amountAuto=true", () => {
    const r = resolveOneLoan(loan());
    expect(r.amountAuto).toBe(true);
    expect(r.amountResolved).toBeGreaterThan(170000); // capital initial > CRD amorti
  });

  it("amount SAISI -> override respecté, amountAuto=false", () => {
    const r = resolveOneLoan(loan({ amount: "250000" }));
    expect(r.amountAuto).toBe(false);
    expect(r.amountResolved).toBe(250000);
  });

  it("un des 4 champs manquant (pas de date) -> pas de déduction", () => {
    const r = resolveOneLoan(loan({ startDate: "" }));
    expect(r.amountAuto).toBe(false);
  });
});
