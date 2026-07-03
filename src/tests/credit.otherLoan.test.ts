// LOT 1 — resolveOtherLoan : mensualité auto des "autres crédits" (barrière douce).
import { describe, it, expect } from "vitest";
import { resolveOtherLoan } from "../lib/calculs/credit";
import { computeTauxEndettement } from "../lib/calculs/endettement";
import type { OtherLoan, PatrimonialData } from "../types/patrimoine";

const ol = (o: Partial<OtherLoan>): OtherLoan => ({
  name: "", loanType: "conso", owner: "person1", capitalRemaining: "", monthlyPayment: "",
  rate: "", durationRemaining: "", purpose: "", hasInsurance: false, insuranceGuarantees: "dc", insurancePremium: "", ...o,
});

describe("resolveOtherLoan — mensualité auto (barrière douce)", () => {
  it("nominal : CRD 10000, 5%, 24 mois -> 438,71 €/mois, isAuto=true", () => {
    const r = resolveOtherLoan(ol({ capitalRemaining: "10000", rate: "5", durationRemaining: "24" }));
    expect(r.monthlyPayment).toBeCloseTo(438.71, 2);
    expect(r.autoField).toBe('monthlyPayment');
  });

  it("taux 0 -> linéaire (CRD 12000, 24 mois -> 500)", () => {
    const r = resolveOtherLoan(ol({ capitalRemaining: "12000", rate: "0", durationRemaining: "24" }));
    expect(r.monthlyPayment).toBeCloseTo(500, 6);
    expect(r.autoField).toBe('monthlyPayment');
  });

  it("taux VIDE -> linéaire aussi (CRD 12000, 24 mois -> 500)", () => {
    const r = resolveOtherLoan(ol({ capitalRemaining: "12000", durationRemaining: "24" }));
    expect(r.monthlyPayment).toBeCloseTo(500, 6);
    expect(r.autoField).toBe('monthlyPayment');
  });

  it("mensualité SAISIE -> override respecté, isAuto=false (pas de recalcul)", () => {
    const r = resolveOtherLoan(ol({ monthlyPayment: "300", capitalRemaining: "10000", rate: "5", durationRemaining: "24" }));
    expect(r.monthlyPayment).toBe(300);
    expect(r.autoField).toBeNull();
  });

  it("mensualité '0' (chaîne) -> traitée comme SAISIE, PAS d'auto-calcul", () => {
    const r = resolveOtherLoan(ol({ monthlyPayment: "0", capitalRemaining: "10000", rate: "5", durationRemaining: "24" }));
    expect(r.monthlyPayment).toBe(0);
    expect(r.autoField).toBeNull();
  });

  it("0 ou 1 champ renseigné -> aucune déduction (autoField=null)", () => {
    for (const l of [ol({ rate: "5" }), ol({ capitalRemaining: "10000" }), ol({ durationRemaining: "24" }), ol({ monthlyPayment: "300" })]) {
      const r = resolveOtherLoan(l);
      expect(r.autoField).toBeNull();
    }
  });
});

describe("endettement — intégration resolveOtherLoan", () => {
  const baseData = (otherLoans: OtherLoan[]): PatrimonialData => ({
    person1PcsGroupe: "4", person1Csp: "47", person2PcsGroupe: "5", person2Csp: "47",
    salary1: "50000", salary2: "0", pensions: "0", pensions1: "", pensions2: "",
    ca1: "", ca2: "", bicType1: "services", bicType2: "services", microRegime1: true, microRegime2: true,
    chargesReelles1: "", chargesReelles2: "", baRevenue1: "", baRevenue2: "",
    properties: [], otherLoans, childrenData: [],
  } as any);

  it("non-régression : mensualité SAISIE -> numérateur inchangé (300 x 12)", () => {
    const res = computeTauxEndettement(baseData([ol({ monthlyPayment: "300", capitalRemaining: "5000", rate: "5", durationRemaining: "20" })]));
    expect(res.numerateurAnnuel).toBeCloseTo(3600, 6); // l'override prime, jamais l'auto
  });

  it("auto : mensualité VIDE + CRD/durée -> numérateur = mensualité auto x 12", () => {
    const auto = resolveOtherLoan(ol({ capitalRemaining: "10000", rate: "5", durationRemaining: "24" })).monthlyPayment;
    const res = computeTauxEndettement(baseData([ol({ capitalRemaining: "10000", rate: "5", durationRemaining: "24" })]));
    expect(res.numerateurAnnuel).toBeCloseTo(auto * 12, 4);
  });
});
