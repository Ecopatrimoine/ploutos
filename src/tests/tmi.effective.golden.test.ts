// GOLDEN — TMI effective (Lot A). Rejoue computeIR sur les dossiers temoins de la
// recon (RECON_TMI.md, 07/07/2026) : la TMI affichee (marginalRate, tranche
// statutaire) diverge de la TMI effective (delta +100 EUR de revenu imposable sur
// le bareme net, decote + plafonnement QF inclus). Valeurs verifiees a la main.
import { describe, it, expect } from "vitest";
import { computeIR } from "../lib/calculs/ir";
import { computeBaremeNet } from "../lib/calculs/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const OPTS = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;

const base = (o: any = {}) => ({
  person1FirstName: "A", person1LastName: "Test", person1BirthDate: "1975-01-01", person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "0", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
  ...o,
} as any);
const child = (birthDate: string) => ({ schoolLevel: "", custody: "full", handicap: false, lastName: "K", birthDate, firstName: "E", rattached: true, parentLink: "common_child" });
const cto = (taxableIncome: string) => ({ id: "cto", name: "CTO", type: "Compte-titres", ownership: "person1", value: "80000", annualIncome: "", taxableIncome, deathValue: "", openDate: "", pfuEligible: true, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: false, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [] });

describe("TMI effective (Lot A) — dossiers temoins de la recon", () => {
  it("D1 forfaitaire (seul, salaire 12000 + dividendes PFU ~9740) : bareme 0 mais impot forfaitaire", () => {
    const ir = computeIR(base({ salary1: "12000", placements: [cto("9740")] }), OPTS);
    expect(ir.marginalRate).toBe(0);              // quotient 10 800 <= 11 600
    expect(ir.marginalRateEffectif).toBe(0);      // +100 salaire reste sous le seuil
    expect(ir.plafonnementQfActif).toBe(false);
    expect(ir.decoteMontant).toBe(0);
    expect(ir.bareme).toBe(0);
    expect(ir.finalIR).toBeCloseTo(3058.36, 2);   // 100 % forfaitaire (PFU 31,4 %)
  });

  it("D2 plafonnement QF (marie, 3 enfants, salaire 120000, 4 parts) : effective 0.30 >> tranche 0.11", () => {
    const ir = computeIR(base({ coupleStatus: "married", salary1: "120000", childrenData: [child("2016-01-01"), child("2012-01-01"), child("2009-01-01")] }), OPTS);
    expect(ir.parts).toBe(4);
    expect(ir.quotientFamilialCapAdjustment).toBeCloseTo(4603.98, 2);
    expect(ir.plafonnementQfActif).toBe(true);
    expect(ir.bareme).toBeCloseTo(11379.98, 2);
    expect(ir.marginalRate).toBe(0.11);           // tranche du quotient (27 000)
    expect(ir.marginalRateEffectif).toBeCloseTo(0.30, 4); // marginal reel = ref 2 parts (cap fixe)
    expect(ir.marginalRateReference).toBe(0.30);  // Lot C2 revise : tranche du calcul de reference (54 000)
  });

  it("D3 decote (seul, salaire 25000) : effective 0.1598 (0.11 x 1.4525) > tranche 0.11", () => {
    const ir = computeIR(base({ salary1: "25000" }), OPTS);
    expect(ir.marginalRate).toBe(0.11);
    expect(ir.bareme).toBeCloseTo(844.55, 2);
    expect(ir.decoteMontant).toBeCloseTo(354.45, 2);
    expect(ir.marginalRateEffectif).toBeCloseTo(0.1598, 4);
  });

  it("discontinuite decote (couple) : dans la zone effective 0.1598 ; apres extinction elle retombe a la tranche 0.11", () => {
    // baremeBeforeDecote autour du seuil couple 3 277 EUR, MEME tranche 11 % des deux cotes.
    const dansLaZone = computeIR(base({ coupleStatus: "married", salary1: "57800" }), OPTS); // RNG 52 020, decote active
    const apresExtinction = computeIR(base({ coupleStatus: "married", salary1: "60000" }), OPTS); // RNG 54 000, decote nulle
    expect(dansLaZone.marginalRate).toBe(0.11);
    expect(dansLaZone.decoteMontant).toBeGreaterThan(0);
    expect(dansLaZone.marginalRateEffectif).toBeCloseTo(0.1598, 4);
    expect(apresExtinction.marginalRate).toBe(0.11);
    expect(apresExtinction.decoteMontant).toBe(0);
    expect(apresExtinction.marginalRateEffectif).toBeCloseTo(0.11, 4); // retombe a la tranche
  });

  it("concubins : deux effectives independantes, active suit activeConcubinPerson", () => {
    const d = base({ coupleStatus: "cohab", salary1: "25000", salary2: "60000" });
    const ir1 = computeIR(d, OPTS, 1);
    const ir2 = computeIR(d, OPTS, 2);
    expect(ir1.isConcubin).toBe(true);
    expect(ir1.plafonnementQfActif).toBe(false); // plafonnement non modelise en concubinage
    // Personne 1 (rev 22 500) en zone de decote ; personne 2 (rev 54 000) tranche 30 % sans decote.
    expect(ir1.marginalRateEffectif1).toBeCloseTo(0.1598, 4);
    expect(ir1.marginalRateEffectif2).toBeCloseTo(0.30, 4);
    // Le champ actif suit la personne demandee.
    expect(ir1.marginalRateEffectif).toBeCloseTo(0.1598, 4);
    expect(ir2.marginalRateEffectif).toBeCloseTo(0.30, 4);
  });
});

describe("computeBaremeNet — helper pur (neutralisation plafonnement en concubinage)", () => {
  it("baseParts = parts => qfBenefit 0, plafonnement inactif (comportement concubins inchange)", () => {
    const r = computeBaremeNet({ revenuImposable: 40000, parts: 1.5, baseParts: 1.5, isCouple: false, parentIsole: false });
    expect(r.qfBenefit).toBe(0);
    expect(r.ecretement).toBe(0);
    expect(r.plafonnementActif).toBe(false);
  });
  it("D2 en direct : ecretement 4603.98, bareme 11379.98 (plafonnement actif)", () => {
    const r = computeBaremeNet({ revenuImposable: 108000, parts: 4, baseParts: 2, isCouple: true, parentIsole: false });
    expect(r.ecretement).toBeCloseTo(4603.98, 2);
    expect(r.plafonnementActif).toBe(true);
    expect(r.bareme).toBeCloseTo(11379.98, 2);
  });
});
