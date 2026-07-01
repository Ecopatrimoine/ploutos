// Tests purs de computeTauxEndettement (source unique du taux d'endettement).
// Fonction pure -> pas de montage composant. Fixtures minimales castees.

import { describe, it, expect } from "vitest";
import { computeTauxEndettement } from "../lib/calculs/endettement";
import { computeBeneficeImposable } from "../lib/calculs/ir";
import type { PatrimonialData } from "../types/patrimoine";

// Fixture minimale : seuls les champs lus par computeTauxEndettement /
// resolveBeneficeTns / resolveLoanValuesMulti sont fournis (le reste est
// defensif au runtime). Cast unknown car on ne construit pas tout le type.
function mkData(over: Record<string, any>): PatrimonialData {
  return {
    salary1: "0", salary2: "0", pensions: "0", pensions1: "", pensions2: "",
    person1PcsGroupe: "", person2PcsGroupe: "", person1Csp: "", person2Csp: "",
    ca1: "0", ca2: "0", bicType1: "", bicType2: "",
    microRegime1: false, microRegime2: false,
    chargesReelles1: "0", chargesReelles2: "0", baRevenue1: "0", baRevenue2: "0",
    properties: [], otherLoans: [],
    ...over,
  } as unknown as PatrimonialData;
}

// Bien immobilier avec credit a taux 0 -> mensualite = capital / (duree*12),
// deterministe (240000 / 240 = 1000 /mois -> 12000 /an). Pas d'assurance par defaut.
function immoProp(over: Record<string, any> = {}) {
  return {
    loanEnabled: true, loanType: "amortissable", loanAmount: "240000", loanRate: "0",
    loanDuration: "20", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
    loanInsurance: false, loanInsurancePremium: "0", rentGrossAnnual: "0", ...over,
  };
}

describe("computeTauxEndettement — numerateur (charges)", () => {
  it("credit immo SEUL (0 autre credit) -> taux existe (cas du bug)", () => {
    const r = computeTauxEndettement(mkData({ properties: [immoProp()], salary1: "30000" }));
    expect(r.numerateurAnnuel).toBe(12000);   // 1000/mois x 12
    expect(r.denominateurAnnuel).toBe(30000);
    expect(r.tauxPct).toBe(40);               // 12000/30000
    expect(r.tauxPct).toBeGreaterThan(0);
  });

  it("otherLoan seul -> compte", () => {
    const r = computeTauxEndettement(mkData({
      otherLoans: [{ monthlyPayment: "500", hasInsurance: false, insurancePremium: "0" }],
      salary1: "24000",
    }));
    expect(r.numerateurAnnuel).toBe(6000);    // 500 x 12
    expect(r.tauxPct).toBe(25);
  });

  it("immo + autre -> les deux comptes", () => {
    const r = computeTauxEndettement(mkData({
      properties: [immoProp()],
      otherLoans: [{ monthlyPayment: "500", hasInsurance: false, insurancePremium: "0" }],
      salary1: "36000",
    }));
    expect(r.numerateurAnnuel).toBe(18000);   // 12000 + 6000
  });

  it("assurance immo annuelle comptee", () => {
    const r = computeTauxEndettement(mkData({
      properties: [immoProp({ loanInsurance: true, loanInsurancePremium: "1200" })],
    }));
    expect(r.numerateurAnnuel).toBe(13200);   // 12000 + 1200
  });

  it("assurance otherLoan : comptee si hasInsurance, ignoree sinon", () => {
    const avec = computeTauxEndettement(mkData({
      otherLoans: [{ monthlyPayment: "100", hasInsurance: true, insurancePremium: "300" }],
    }));
    expect(avec.numerateurAnnuel).toBe(1500); // 100x12 + 300

    const sans = computeTauxEndettement(mkData({
      otherLoans: [{ monthlyPayment: "100", hasInsurance: false, insurancePremium: "300" }],
    }));
    expect(sans.numerateurAnnuel).toBe(1200); // 100x12, prime ignoree
  });
});

describe("computeTauxEndettement — denominateur (revenus)", () => {
  it("loyers bruts ponderes x0,70", () => {
    const r = computeTauxEndettement(mkData({
      properties: [immoProp({ loanEnabled: false, rentGrossAnnual: "10000" })],
      salary1: "0",
    }));
    expect(r.denominateurAnnuel).toBe(7000);  // 10000 x 0,70
    expect(r.numerateurAnnuel).toBe(0);
    expect(r.tauxPct).toBe(0);
  });

  it("CA TNS retenu au NET (abattement micro), pas le CA brut", () => {
    // PCS groupe 2 -> independant ; BIC vente micro -> abattement 71%.
    const net = computeBeneficeImposable(100000, "vente", false, false, true, 0, 0);
    expect(net).toBe(29000);                  // 100000 - max(305, 71000)
    const r = computeTauxEndettement(mkData({
      person1PcsGroupe: "2", ca1: "100000", bicType1: "vente", microRegime1: true,
      salary1: "0",
    }));
    expect(r.denominateurAnnuel).toBe(29000); // le NET, pas 100000
  });

  it("pensions : nominatifs priment (jamais la somme des 3)", () => {
    const r = computeTauxEndettement(mkData({
      pensions1: "10000", pensions2: "5000", pensions: "99999", salary1: "0",
    }));
    expect(r.denominateurAnnuel).toBe(15000); // 10000 + 5000, PAS 114999
  });

  it("pensions : fallback sur le global si nominatifs vides", () => {
    const r = computeTauxEndettement(mkData({ pensions: "8000", pensions1: "", pensions2: "" }));
    expect(r.denominateurAnnuel).toBe(8000);
  });
});

describe("computeTauxEndettement — bornes", () => {
  it("denominateur 0 -> tauxPct 0 (pas de division par zero)", () => {
    const r = computeTauxEndettement(mkData({ properties: [immoProp()] }));
    expect(r.numerateurAnnuel).toBe(12000);
    expect(r.denominateurAnnuel).toBe(0);
    expect(r.tauxPct).toBe(0);
  });
});
