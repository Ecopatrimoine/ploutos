// Tests calcul IR — barème 2024 — couverture exhaustive
import { describe, it, expect } from 'vitest'
import { computeIR, computeBeneficeImposable } from '../lib/calculs/ir'
import { EMPTY_CHARGES_DETAIL } from '../constants'

const BASE_DATA = {
  person1FirstName: "Test", person1LastName: "IR", person1BirthDate: "1980-01-01",
  person1JobTitle: "Salarié", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: {...EMPTY_CHARGES_DETAIL},
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: {...EMPTY_CHARGES_DETAIL},
  properties: [], placements: [], otherLoans: [],
}

const STD_OPTIONS = {
  expenseMode1: "standard" as const, expenseMode2: "standard" as const,
  km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9",
  km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9",
  foncierRegime: "micro",
  other1: "0", other2: "0",
}

// ─── BARÈME DE BASE ───────────────────────────────────────────────────────────
describe("computeIR — barème de base", () => {

  it("revenu 0 → IR = 0", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "0" }, STD_OPTIONS)
    expect(ir.finalIR).toBe(0)
    expect(ir.parts).toBe(1)
    expect(ir.marginalRate).toBe(0)
  })

  it("revenu 10 000 € → sous le seuil d'imposition → IR = 0", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "10000" }, STD_OPTIONS)
    expect(ir.finalIR).toBe(0)
    expect(ir.marginalRate).toBe(0)
  })

  it("revenu 15 000 € → tranche 11%", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "15000" }, STD_OPTIONS)
    expect(ir.marginalRate).toBe(0.11)
    expect(ir.finalIR).toBeCloseTo(209, 0)
  })

  it("revenu 30 000 € → tranche 11%", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000" }, STD_OPTIONS)
    expect(ir.marginalRate).toBe(0.11)
    expect(ir.finalIR).toBeGreaterThan(0)
  })

  it("revenu 50 000 € → tranche 30%", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "50000" }, STD_OPTIONS)
    expect(ir.marginalRate).toBe(0.30)
  })

  it("revenu 100 000 € → tranche 41%", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "100000" }, STD_OPTIONS)
    expect(ir.marginalRate).toBe(0.41)
    expect(ir.finalIR).toBeGreaterThan(0)
  })

  it("revenu 300 000 € → tranche 45%", () => {
    // Abattement 10% → RNG = 270k → quotient = 270k > 181 917 → tranche 45%
    const ir = computeIR({ ...BASE_DATA, salary1: "300000" }, STD_OPTIONS)
    expect(ir.marginalRate).toBe(0.45)
  })

  it("IR augmente avec le revenu (monotone)", () => {
    const ir1 = computeIR({ ...BASE_DATA, salary1: "30000" }, STD_OPTIONS)
    const ir2 = computeIR({ ...BASE_DATA, salary1: "60000" }, STD_OPTIONS)
    const ir3 = computeIR({ ...BASE_DATA, salary1: "100000" }, STD_OPTIONS)
    expect(ir2.finalIR).toBeGreaterThan(ir1.finalIR)
    expect(ir3.finalIR).toBeGreaterThan(ir2.finalIR)
  })

  it("taux moyen toujours < taux marginal", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "80000" }, STD_OPTIONS)
    expect(ir.averageRate).toBeLessThan(ir.marginalRate)
  })
})

// ─── QUOTIENT FAMILIAL ────────────────────────────────────────────────────────
describe("computeIR — quotient familial", () => {

  it("célibataire sans enfant → 1 part", () => {
    const ir = computeIR({ ...BASE_DATA }, STD_OPTIONS)
    expect(ir.parts).toBe(1)
  })

  it("couple marié sans enfant → 2 parts", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married",
      salary1: "30000", salary2: "20000",
      person2FirstName: "Conj", person2LastName: "Test",
    }, STD_OPTIONS)
    expect(ir.parts).toBe(2)
  })

  it("couple pacsé sans enfant → 2 parts", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "pacs",
      salary1: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
    }, STD_OPTIONS)
    expect(ir.parts).toBe(2)
  })

  it("couple marié avec 1 enfant → 2.5 parts", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married",
      salary1: "40000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [{ firstName: "E", lastName: "T", birthDate: "2015-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: false }],
    }, STD_OPTIONS)
    expect(ir.parts).toBe(2.5)
  })

  it("couple marié avec 2 enfants → 3 parts", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married",
      salary1: "50000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [
        { firstName: "A", lastName: "T", birthDate: "2010-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
        { firstName: "B", lastName: "T", birthDate: "2012-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
      ],
    }, STD_OPTIONS)
    expect(ir.parts).toBe(3)
  })

  it("couple marié avec 3 enfants → 4 parts (3e = 1 part)", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married",
      salary1: "60000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [
        { firstName: "A", lastName: "T", birthDate: "2010-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
        { firstName: "B", lastName: "T", birthDate: "2012-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
        { firstName: "C", lastName: "T", birthDate: "2015-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
      ],
    }, STD_OPTIONS)
    expect(ir.parts).toBe(4)
  })

  it("enfant en garde alternée → +0.25 part (et non +0.5)", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married", salary1: "40000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [{ firstName: "E", lastName: "T", birthDate: "2015-01-01",
        parentLink: "common_child", custody: "alternate", rattached: true, handicap: false }],
    }, STD_OPTIONS)
    expect(ir.parts).toBe(2.25)
  })

  it("enfant handicapé → +0.5 part supplémentaire", () => {
    const base = computeIR({
      ...BASE_DATA, coupleStatus: "married", salary1: "40000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [{ firstName: "E", lastName: "T", birthDate: "2010-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: false }],
    }, STD_OPTIONS)
    const handi = computeIR({
      ...BASE_DATA, coupleStatus: "married", salary1: "40000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [{ firstName: "E", lastName: "T", birthDate: "2010-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: true }],
    }, STD_OPTIONS)
    expect(handi.parts).toBe(base.parts + 0.5)
    expect(handi.finalIR).toBeLessThanOrEqual(base.finalIR)
  })

  it("plus d'enfants → moins d'IR", () => {
    const ir1 = computeIR({
      ...BASE_DATA, coupleStatus: "married", salary1: "60000",
      person2FirstName: "Conj", person2LastName: "Test", childrenData: [],
    }, STD_OPTIONS)
    const ir2 = computeIR({
      ...BASE_DATA, coupleStatus: "married", salary1: "60000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [{ firstName: "A", lastName: "T", birthDate: "2010-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: false }],
    }, STD_OPTIONS)
    expect(ir2.finalIR).toBeLessThan(ir1.finalIR)
  })

  it("plafonnement QF — revenu élevé avec enfant", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married", salary1: "200000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [{ firstName: "E", lastName: "T", birthDate: "2010-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: false }],
    }, STD_OPTIONS)
    expect(ir.quotientFamilialCapAdjustment).toBeGreaterThan(0)
  })
})

// ─── FRAIS RÉELS ──────────────────────────────────────────────────────────────
describe("computeIR — frais réels vs abattement standard", () => {

  it("frais réels > abattement 10% → IR plus faible", () => {
    const std = computeIR({ ...BASE_DATA, salary1: "40000" }, STD_OPTIONS)
    const reel = computeIR({ ...BASE_DATA, salary1: "40000" }, {
      ...STD_OPTIONS, expenseMode1: "actual" as const,
      km1: "20000", cv1: "7",  // kilométrique élevé
      other1: "5000",
    })
    expect(reel.finalIR).toBeLessThan(std.finalIR)
  })

  it("frais réels nuls → même IR qu'abattement 10%", () => {
    const std = computeIR({ ...BASE_DATA, salary1: "40000" }, STD_OPTIONS)
    const reel = computeIR({ ...BASE_DATA, salary1: "40000" }, {
      ...STD_OPTIONS, expenseMode1: "actual" as const,
      km1: "0", cv1: "5", mealCount1: "0", other1: "0",
    })
    // Frais réels = 0 < abattement 10% = 4000 → plus d'IR avec frais réels nuls
    expect(reel.finalIR).toBeGreaterThanOrEqual(std.finalIR)
  })
})

// ─── REVENUS FONCIERS ─────────────────────────────────────────────────────────
describe("computeIR — revenus fonciers", () => {

  const propLocatif = {
    name: "Loc", type: "Location nue", ownership: "person1", propertyRight: "full",
    usufructAge: "", value: "200000", propertyTaxAnnual: "1000", rentGrossAnnual: "12000",
    insuranceAnnual: "500", worksAnnual: "2000", otherChargesAnnual: "0",
    loanCapitalRemaining: "0", loanInterestAnnual: "3000", loanInsurance: false,
    loanInsuranceRate1: "100", loanInsuranceRate2: "100", loanInsuranceRate: "100",
    loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable",
    loanInitialCapital: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
    indivisionShare1: "100", indivisionShare2: "0",
    loanAmount: "0", loanPledgedPlacementIndex: "-1",
    loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
  }

  it("micro-foncier : abattement 30% sur loyers bruts", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [propLocatif] },
      { ...STD_OPTIONS, foncierRegime: "micro" })
    expect(ir.taxableFonciers).toBeCloseTo(12000 * 0.7, 0)
  })

  it("régime réel : loyers - charges", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [propLocatif] },
      { ...STD_OPTIONS, foncierRegime: "real" })
    // 12000 - 1000 - 500 - 2000 - 3000 = 5500
    expect(ir.taxableFonciers).toBeCloseTo(5500, 0)
  })

  it("revenus fonciers augmentent l'IR", () => {
    const sans = computeIR({ ...BASE_DATA, salary1: "30000" }, STD_OPTIONS)
    const avec = computeIR({ ...BASE_DATA, salary1: "30000", properties: [propLocatif] }, STD_OPTIONS)
    expect(avec.finalIR).toBeGreaterThan(sans.finalIR)
  })

  it("prélèvements sociaux 17.2% sur revenus fonciers nets", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [propLocatif] },
      { ...STD_OPTIONS, foncierRegime: "micro" })
    expect(ir.foncierSocialLevy).toBeCloseTo(12000 * 0.7 * 0.172, 0)
  })
})

// ─── HANDICAP ────────────────────────────────────────────────────────────────
describe("computeIR — abattement handicap", () => {

  it("personne handicapée → IR réduit", () => {
    const base = computeIR({ ...BASE_DATA, salary1: "20000" }, STD_OPTIONS)
    const handi = computeIR({ ...BASE_DATA, salary1: "20000", person1Handicap: true }, STD_OPTIONS)
    expect(handi.finalIR).toBeLessThanOrEqual(base.finalIR)
  })
})

// ─── BÉNÉFICE IMPOSABLE INDÉPENDANTS ─────────────────────────────────────────
describe("computeBeneficeImposable", () => {

  it("BIC services micro : abattement 50%", () => {
    const b = computeBeneficeImposable(60000, "services", false, false, true, 0, 0)
    expect(b).toBeCloseTo(60000 * 0.5, 0)
  })

  it("BIC vente micro : abattement 71%", () => {
    const b = computeBeneficeImposable(100000, "vente", false, false, true, 0, 0)
    expect(b).toBeCloseTo(100000 * 0.29, 0)
  })

  it("BNC micro : abattement 34%", () => {
    const b = computeBeneficeImposable(80000, "services", true, false, true, 0, 0)
    expect(b).toBeCloseTo(80000 * 0.66, 0)
  })

  it("régime réel : CA - charges", () => {
    const b = computeBeneficeImposable(100000, "services", false, false, false, 40000, 0)
    expect(b).toBe(60000)
  })

  it("charges réelles > CA → bénéfice = 0 (pas négatif)", () => {
    const b = computeBeneficeImposable(50000, "services", false, false, false, 80000, 0)
    expect(b).toBe(0)
  })

  it("CA = 0 → bénéfice = 0", () => {
    const b = computeBeneficeImposable(0, "services", false, false, true, 0, 0)
    expect(b).toBe(0)
  })

  it("micro-BA : abattement 87%", () => {
    const b = computeBeneficeImposable(50000, "services", false, true, true, 0, 0)
    expect(b).toBeCloseTo(50000 * 0.13, 0)
  })

  it("abattement minimum 305€", () => {
    const b = computeBeneficeImposable(500, "services", false, false, true, 0, 0)
    // 500 * 50% = 250 < 305 → abattement = 305 → bénéfice = max(0, 500-305) = 195
    expect(b).toBe(195)
  })
})

// ─── CONCUBINAGE ──────────────────────────────────────────────────────────────
describe("computeIR — concubinage (2 foyers)", () => {

  it("concubins → isConcubin = true", () => {
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
    }, STD_OPTIONS)
    expect(ir.isConcubin).toBe(true)
  })

  it("concubins avec revenus inégaux → IR différent de marié", () => {
    const marie = computeIR({
      ...BASE_DATA, coupleStatus: "married",
      salary1: "60000", salary2: "0",
      person2FirstName: "Conj", person2LastName: "Test",
    }, STD_OPTIONS)
    const concubin = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "60000", salary2: "0",
      person2FirstName: "Conj", person2LastName: "Test",
    }, STD_OPTIONS)
    // Concubins imposés séparément → IR différent
    expect(concubin.finalIR).not.toBeCloseTo(marie.finalIR, -2)
  })
})

// ─── PFU ──────────────────────────────────────────────────────────────────────
describe("computeIR — PFU placements", () => {

  const placement = {
    name: "PEA", type: "PEA", ownership: "person1", value: "50000",
    annualIncome: "2000", taxableIncome: "2000", deathValue: "50000",
    openDate: "2015-01-01", pfuEligible: true, pfuOptOut: false,
    totalPremiumsNet: "0", premiumsBefore70: "0", premiumsAfter70: "0",
    exemptFromSuccession: "0", ucRatio: "0", annualWithdrawal: "",
    annualContribution: "0", perDeductible: true,
    beneficiaries: [],
  }

  it("placement PFU → PFU = 31.4% du revenu taxable", () => {
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", placements: [placement] }, STD_OPTIONS)
    expect(ir.totalPFU).toBeCloseTo(2000 * 0.314, 0)
  })

  it("placement PFU → augmente l'IR total", () => {
    const sans = computeIR({ ...BASE_DATA, salary1: "30000" }, STD_OPTIONS)
    const avec = computeIR({ ...BASE_DATA, salary1: "30000", placements: [placement] }, STD_OPTIONS)
    expect(avec.finalIR).toBeGreaterThan(sans.finalIR)
  })
})
