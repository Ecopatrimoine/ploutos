import { describe, it, expect } from "vitest";
import { computeExpositionMarche } from "../lib/calculs/exposition";
import type { Placement } from "../types/patrimoine";

// Fabrique un Placement valide (tous les champs requis) ; on ne surcharge
// que ce qui compte pour l'exposition (type, value, ucRatio).
function mk(over: Partial<Placement>): Placement {
  return {
    name: "P",
    type: "Livret A",
    ownership: "person1",
    value: "1000",
    annualIncome: "",
    taxableIncome: "",
    deathValue: "",
    openDate: "",
    pfuEligible: false,
    pfuOptOut: false,
    totalPremiumsNet: "",
    premiumsBefore70: "",
    premiumsAfter70: "",
    exemptFromSuccession: "",
    ucRatio: "",
    annualWithdrawal: "",
    annualContribution: "",
    perDeductible: true,
    perWithdrawal: "",
    perWithdrawalCapital: "",
    perWithdrawalInterest: "",
    perAnticiped: false,
    beneficiaries: [],
    ...over,
  };
}

describe("computeExpositionMarche", () => {
  // ─── LE BUG : PER / Madelin ponderes par ucRatio ───────────────────────
  it.each(["PER bancaire", "PER assurantiel", "Madelin"])(
    "%s a ucRatio 30 -> 30%% dynamique / 70%% securise (correctif)",
    (type) => {
      const r = computeExpositionMarche([mk({ type, value: "1000", ucRatio: "30" })]);
      expect(r.dynamique).toBeCloseTo(300, 6);
      expect(r.securise).toBeCloseTo(700, 6);
      expect(r.total).toBeCloseTo(1000, 6);
      expect(r.dynamiquePct).toBe(30);
      expect(r.securisePct).toBe(70);
    },
  );

  it("PER a ucRatio vide -> defaut 0 % -> 100 % securise", () => {
    const r = computeExpositionMarche([mk({ type: "PER assurantiel", value: "1000", ucRatio: "" })]);
    expect(r.securise).toBeCloseTo(1000, 6);
    expect(r.dynamique).toBeCloseTo(0, 6);
    expect(r.securisePct).toBe(100);
    expect(r.dynamiquePct).toBe(0);
  });

  // ─── Bug secondaire vide vs 0 : un 0 saisi est respecte ────────────────
  it("AV UC a ucRatio 0 -> 100 % securise (fix vide vs 0)", () => {
    const r = computeExpositionMarche([mk({ type: "Assurance-vie unités de compte", value: "1000", ucRatio: "0" })]);
    expect(r.securise).toBeCloseTo(1000, 6);
    expect(r.dynamique).toBeCloseTo(0, 6);
    expect(r.securisePct).toBe(100);
  });

  it("AV UC a ucRatio vide -> defaut 100 % -> 100 % dynamique (conserve)", () => {
    const r = computeExpositionMarche([mk({ type: "Assurance-vie unités de compte", value: "1000", ucRatio: "" })]);
    expect(r.dynamique).toBeCloseTo(1000, 6);
    expect(r.securise).toBeCloseTo(0, 6);
    expect(r.dynamiquePct).toBe(100);
  });

  it("AV UC a ucRatio 60 -> 60 % dynamique / 40 % securise (conserve)", () => {
    const r = computeExpositionMarche([mk({ type: "Assurance-vie unités de compte", value: "1000", ucRatio: "60" })]);
    expect(r.dynamique).toBeCloseTo(600, 6);
    expect(r.securise).toBeCloseTo(400, 6);
  });

  it("Contrat de capitalisation a ucRatio vide -> defaut 0 % -> 100 % securise (conserve)", () => {
    const r = computeExpositionMarche([mk({ type: "Contrat de capitalisation", value: "1000", ucRatio: "" })]);
    expect(r.securise).toBeCloseTo(1000, 6);
    expect(r.dynamique).toBeCloseTo(0, 6);
    expect(r.securisePct).toBe(100);
  });

  // ─── Types 100 %% dynamiques par nature (inchange) ─────────────────────
  it.each(["PEA", "Compte-titres", "Actions non cotées", "OPCVM / ETF"])(
    "%s -> 100 %% dynamique (inchange)",
    (type) => {
      const r = computeExpositionMarche([mk({ type, value: "1000", ucRatio: "" })]);
      expect(r.dynamique).toBeCloseTo(1000, 6);
      expect(r.securise).toBeCloseTo(0, 6);
      expect(r.dynamiquePct).toBe(100);
    },
  );

  // ─── Types 100 %% securises par nature (inchange) ──────────────────────
  it.each(["Livret A", "LDDS", "LEP", "Compte courant", "Compte à terme", "PEL", "CEL"])(
    "%s -> 100 %% securise (inchange)",
    (type) => {
      const r = computeExpositionMarche([mk({ type, value: "1000", ucRatio: "" })]);
      expect(r.securise).toBeCloseTo(1000, 6);
      expect(r.dynamique).toBeCloseTo(0, 6);
      expect(r.securisePct).toBe(100);
    },
  );

  it("Assurance-vie fonds euros -> 100 % securise (inchange)", () => {
    const r = computeExpositionMarche([mk({ type: "Assurance-vie fonds euros", value: "1000" })]);
    expect(r.securise).toBeCloseTo(1000, 6);
    expect(r.dynamique).toBeCloseTo(0, 6);
    expect(r.securisePct).toBe(100);
  });

  // ─── Mix realiste : invariant somme = 100 + montants ───────────────────
  it("mix realiste : securisePct + dynamiquePct == 100 et montants exacts", () => {
    const r = computeExpositionMarche([
      mk({ type: "Livret A", value: "10000" }),                                    // 10000 securise
      mk({ type: "Assurance-vie fonds euros", value: "20000" }),                   // 20000 securise
      mk({ type: "Assurance-vie unités de compte", value: "10000", ucRatio: "60" }), // 6000 dyn / 4000 sec
      mk({ type: "PER assurantiel", value: "10000", ucRatio: "30" }),              // 3000 dyn / 7000 sec
      mk({ type: "PEA", value: "5000" }),                                          // 5000 dyn
    ]);
    expect(r.securise).toBeCloseTo(41000, 6);
    expect(r.dynamique).toBeCloseTo(14000, 6);
    expect(r.total).toBeCloseTo(55000, 6);
    expect(r.securisePct).toBe(75);   // round(41000/55000*100) = round(74.55) = 75
    expect(r.dynamiquePct).toBe(25);
    expect(r.securisePct + r.dynamiquePct).toBe(100);
  });

  // ─── Aucun placement : pas de division par zero ────────────────────────
  it("aucun placement -> total 0, pas de division par zero", () => {
    const r = computeExpositionMarche([]);
    expect(r.total).toBe(0);
    expect(r.securise).toBe(0);
    expect(r.dynamique).toBe(0);
    expect(r.securisePct).toBe(0);
    expect(r.dynamiquePct).toBe(0);
  });
});
