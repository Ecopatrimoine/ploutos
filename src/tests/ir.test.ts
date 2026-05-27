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

  it("revenu 15 000 € → tranche 11%, décote efface l'IR", () => {
    // Salaire 15 000 → RNG 13 500 → IR brut 209 €
    // Décote : 897 - 45,25% × 209 = 802,43 € → IR après décote = 0 €
    const ir = computeIR({ ...BASE_DATA, salary1: "15000" }, STD_OPTIONS)
    expect(ir.marginalRate).toBe(0.11)
    expect(ir.finalIR).toBe(0)
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

  it("abattement 10% salaires plafonné à 14 555 € par personne", () => {
    // Salaire 200 000 → 10% = 20 000 > plafond 14 555 → retenu = 14 555
    // RNG = 200 000 − 14 555 = 185 445
    const ir = computeIR({ ...BASE_DATA, salary1: "200000" }, STD_OPTIONS)
    expect(ir.retainedExpenses).toBeCloseTo(14555, 0)
    expect(ir.revenuNetGlobal).toBeCloseTo(185445, 0)
  })

  it("abattement 10% pensions plafonné à 4 439 € par foyer", () => {
    // Couple retraités : 50 000 € chacun → abattement 5 000 + 5 000 = 10 000 → plafonné 4 439
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "married",
      person2FirstName: "Conj", person2LastName: "Test",
      salary1: "0", salary2: "0", pensions1: "50000", pensions2: "50000",
    }, STD_OPTIONS)
    expect(ir.retainedExpenses).toBeCloseTo(4439, 0)
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

  it("parent isolé (case T) : plafond QF = 4 262 + 1 807 = 6 069 €", () => {
    // Célibataire parent isolé, 1 enfant, salaire 80 000 €
    // RNG = 72 000, parts = 2 (1 + 0.5 enfant + 0.5 case T)
    // qfBenefit = 6 896 > qfCap = 6 069 → ajustement = 827
    // bareme = 7 808 + 827 = 8 635, pas de décote → finalIR ≈ 8 635
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "single", singleParent: true, salary1: "80000",
      childrenData: [{ firstName: "E", lastName: "T", birthDate: "2010-01-01",
        parentLink: "common_child", custody: "full", rattached: true, handicap: false }],
    }, STD_OPTIONS)
    expect(ir.parts).toBe(2)
    expect(ir.quotientFamilialCapAdjustment).toBeCloseTo(827, 0)
    expect(ir.finalIR).toBeCloseTo(8635, 0)
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

  it("déficit foncier cas A : loyers 8k, intérêts 3k, charges 10k → imputation 5k sur global", () => {
    // Intérêts absorbés par loyers (3k < 8k) → loyers restants 5k
    // Charges hors intérêts (10k) − loyers restants (5k) = déficit 5k hors intérêts
    // Imputation global = min(5000, 10700) = 5000 — reportable = 0
    const prop = {
      ...propLocatif, rentGrossAnnual: "8000", loanEnabled: true,
      propertyTaxAnnual: "4000", insuranceAnnual: "2000", worksAnnual: "4000", otherChargesAnnual: "0",
      loanInterestAnnual: "3000",
    }
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop] },
      { ...STD_OPTIONS, foncierRegime: "real" })
    expect(ir.deficitFoncierImpute).toBeCloseTo(5000, 0)
    expect(ir.deficitFoncierReportable).toBeCloseTo(0, 0)
    expect(ir.taxableFonciers).toBeCloseTo(-5000, 0)
  })

  it("déficit foncier cas B : loyers 5k, intérêts 7k, charges 2k → imputation 2k, reportable 2k", () => {
    // Intérêts (7k) > loyers (5k) → 2k intérêts non absorbés (reportable)
    // Loyers après intérêts = 0 → charges hors intérêts (2k) intégralement en déficit
    // Imputation global = min(2000, 10700) = 2000 — reportable = 2000 (intérêts)
    const prop = {
      ...propLocatif, rentGrossAnnual: "5000", loanEnabled: true,
      propertyTaxAnnual: "1000", insuranceAnnual: "500", worksAnnual: "500", otherChargesAnnual: "0",
      loanInterestAnnual: "7000",
    }
    const ir = computeIR({ ...BASE_DATA, salary1: "30000", properties: [prop] },
      { ...STD_OPTIONS, foncierRegime: "real" })
    expect(ir.deficitFoncierImpute).toBeCloseTo(2000, 0)
    expect(ir.deficitFoncierReportable).toBeCloseTo(2000, 0)
    expect(ir.taxableFonciers).toBeCloseTo(-2000, 0)
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

  it("concubinage : foncier ventilé par ownership (person2 100%)", () => {
    // Person2 possède seul un locatif, person1 n'a rien
    // Foncier micro : 12 000 × 0.7 = 8 400 → 100% sur person2, 0 sur person1
    const prop = {
      name: "Loc", type: "Location nue", ownership: "person2", propertyRight: "full",
      usufructAge: "", value: "200000", propertyTaxAnnual: "0", rentGrossAnnual: "12000",
      insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
      loanEnabled: false, loanType: "amortissable", loanAmount: "0", loanRate: "0",
      loanDuration: "0", loanStartDate: "", loanCapitalRemaining: "0", loanInterestAnnual: "0",
      loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc",
      loanInsuranceRate: "0", loanInsuranceRate1: "0", loanInsuranceRate2: "0",
      loanInsurancePremium: "0", loanInsuranceCoverage: "banque",
      indivisionShare1: "", indivisionShare2: "",
    }
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "20000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    // rev1 = 30000 - 3000 + 0 = 27000 (pas de foncier)
    // rev2 = 20000 - 2000 + 8400 = 26400 (100% du foncier)
    expect(ir.rev1).toBeCloseTo(27000, 0)
    expect(ir.rev2).toBeCloseTo(26400, 0)
  })

  it("concubinage : PER nominatif ventilé (person1 uniquement)", () => {
    const per = {
      name: "PER P1", type: "PER bancaire", ownership: "person1", value: "30000",
      annualIncome: "0", taxableIncome: "0", deathValue: "0",
      openDate: "2020-01-01", pfuEligible: false, pfuOptOut: false,
      totalPremiumsNet: "0", premiumsBefore70: "0", premiumsAfter70: "0",
      exemptFromSuccession: "0", ucRatio: "0", annualWithdrawal: "",
      annualContribution: "5000", perDeductible: true,
      perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false,
      beneficiaries: [],
    }
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "40000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      placements: [per],
    }, STD_OPTIONS)
    // Plafond PER salarié : max(40000×10%, PASS×10%) = max(4000, 4710) = 4710
    // perDeduction1 = min(5000, 4710) = 4710 (plafonné)
    // rev1 = 40000 - 4000 (abatt salaire) - 4710 (PER plafonné) = 31290
    // rev2 = 30000 - 3000 = 27000 (pas de PER)
    expect(ir.rev1).toBeCloseTo(31290, 0)
    expect(ir.rev2).toBeCloseTo(27000, 0)
  })

  it("concubinage : indivision 70/30 ventilée correctement", () => {
    const prop = {
      name: "Indiv", type: "Location nue", ownership: "indivision", propertyRight: "full",
      usufructAge: "", value: "300000", propertyTaxAnnual: "0", rentGrossAnnual: "10000",
      insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
      loanEnabled: false, loanType: "amortissable", loanAmount: "0", loanRate: "0",
      loanDuration: "0", loanStartDate: "", loanCapitalRemaining: "0", loanInterestAnnual: "0",
      loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc",
      loanInsuranceRate: "0", loanInsuranceRate1: "0", loanInsuranceRate2: "0",
      loanInsurancePremium: "0", loanInsuranceCoverage: "banque",
      indivisionShare1: "70", indivisionShare2: "30",
    }
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    // Foncier micro : 10 000 × 0.7 = 7 000
    // P1 : 70% → 7000 × 0.7 = 4900, P2 : 30% → 7000 × 0.3 = 2100
    // rev1 = 30000 - 3000 + 4900 = 31900
    // rev2 = 30000 - 3000 + 2100 = 29100
    expect(ir.rev1).toBeCloseTo(31900, 0)
    expect(ir.rev2).toBeCloseTo(29100, 0)
  })

  const concubLocatif = (ownership: string, rent: string, charges: { tax: string; ins: string; works: string }, interest: string, shares?: { s1: string; s2: string }) => ({
    name: "Loc", type: "Location nue" as const, ownership, propertyRight: "full",
    usufructAge: "", value: "200000", propertyTaxAnnual: charges.tax, rentGrossAnnual: rent,
    insuranceAnnual: charges.ins, worksAnnual: charges.works, otherChargesAnnual: "0",
    loanEnabled: !!interest, loanType: "amortissable", loanAmount: "0", loanRate: "0",
    loanDuration: "0", loanStartDate: "", loanCapitalRemaining: "0", loanInterestAnnual: interest,
    loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc",
    loanInsuranceRate: "0", loanInsuranceRate1: "0", loanInsuranceRate2: "0",
    loanInsurancePremium: "0", loanInsuranceCoverage: "banque",
    indivisionShare1: shares?.s1 || "", indivisionShare2: shares?.s2 || "",
  });

  it("concubinage + déficit réel person2 : imputation sur rev2 uniquement", () => {
    // Loyers 8k, charges 10k, intérêts 3k → déficit 5k imputé sur person2
    const prop = concubLocatif("person2", "8000", { tax: "4000", ins: "3000", works: "3000" }, "3000");
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "20000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
    }, { ...STD_OPTIONS, foncierRegime: "real" })
    expect(ir.rev1).toBeCloseTo(27000, 0)
    expect(ir.rev2).toBeCloseTo(13000, 0)
    expect(ir.deficitFoncierImpute).toBeCloseTo(5000, 0)
    expect(ir.deficitFoncierReportable).toBeCloseTo(0, 0)
  })

  it("concubinage + intérêts > loyers person2 : reportable, pas sur le global", () => {
    // Loyers 5k, charges 2k, intérêts 7k → impute 2k, reportable 2k (intérêts)
    const prop = concubLocatif("person2", "5000", { tax: "1000", ins: "500", works: "500" }, "7000");
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "20000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
    }, { ...STD_OPTIONS, foncierRegime: "real" })
    expect(ir.rev1).toBeCloseTo(27000, 0)
    expect(ir.rev2).toBeCloseTo(16000, 0)
    expect(ir.deficitFoncierImpute).toBeCloseTo(2000, 0)
    expect(ir.deficitFoncierReportable).toBeCloseTo(2000, 0)
  })

  it("concubinage + common 50/50 : conservation (identique à l'ancien comportement)", () => {
    // Bien common, loyers 12k, micro → 8 400 répartis 50/50
    const prop = concubLocatif("common", "12000", { tax: "0", ins: "0", works: "0" }, "0");
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    expect(ir.rev1).toBeCloseTo(31200, 0)
    expect(ir.rev2).toBeCloseTo(31200, 0)
  })

  it("concubinage + 2 biens distincts : chacun récupère son foncier", () => {
    // P1 : loyers 6k, P2 : loyers 10k, micro
    const prop1 = concubLocatif("person1", "6000", { tax: "0", ins: "0", works: "0" }, "0");
    const prop2 = concubLocatif("person2", "10000", { tax: "0", ins: "0", works: "0" }, "0");
    const ir = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop1, prop2],
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    // P1 : 6000 × 0.7 = 4200, P2 : 10000 × 0.7 = 7000
    expect(ir.rev1).toBeCloseTo(31200, 0)
    expect(ir.rev2).toBeCloseTo(34000, 0)
  })

  // ─── Sentinelle CSG foncier ventilée par personne (audit IR concubins) ──
  it("concubinage : csgDeductibleFoncier ventilée 100 % sur le propriétaire seul du bien", () => {
    // Person2 possède SEUL un locatif → toute la CSG déductible doit lui être imputée.
    const prop = {
      name: "Loc", type: "Location nue", ownership: "person2", propertyRight: "full",
      usufructAge: "", value: "200000", propertyTaxAnnual: "0", rentGrossAnnual: "12000",
      insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
      loanEnabled: false, loanType: "amortissable", loanAmount: "0", loanRate: "0",
      loanDuration: "0", loanStartDate: "", loanCapitalRemaining: "0", loanInterestAnnual: "0",
      loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc",
      loanInsuranceRate: "0", loanInsuranceRate1: "0", loanInsuranceRate2: "0",
      loanInsurancePremium: "0", loanInsuranceCoverage: "banque",
      indivisionShare1: "", indivisionShare2: "",
    }
    const irAvecCsg = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "20000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
      csgDeductibleFoncier: "600",   // CSG 6,8 % sur 8 400 € ≈ 571 €, on prend 600 pour test
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    const irSansCsg = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "20000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [prop],
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    // P1 ne doit PAS être impactée par la CSG (elle n'a pas de foncier)
    expect(irAvecCsg.rev1).toBeCloseTo(irSansCsg.rev1, 0)
    // P2 doit avoir un revenu réduit de 600 € (la CSG totale)
    expect(irAvecCsg.rev2).toBeCloseTo(irSansCsg.rev2 - 600, 0)
  })

  it("concubinage : csgDeductibleFoncier ventilée au prorata si 2 biens (P1 30 % / P2 70 %)", () => {
    const propP1 = {
      name: "Loc P1", type: "Location nue", ownership: "person1", propertyRight: "full",
      usufructAge: "", value: "100000", propertyTaxAnnual: "0", rentGrossAnnual: "6000",
      insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
      loanEnabled: false, loanType: "amortissable", loanAmount: "0", loanRate: "0",
      loanDuration: "0", loanStartDate: "", loanCapitalRemaining: "0", loanInterestAnnual: "0",
      loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc",
      loanInsuranceRate: "0", loanInsuranceRate1: "0", loanInsuranceRate2: "0",
      loanInsurancePremium: "0", loanInsuranceCoverage: "banque",
      indivisionShare1: "", indivisionShare2: "",
    }
    const propP2 = { ...propP1, name: "Loc P2", ownership: "person2", rentGrossAnnual: "14000" }
    // Foncier micro : P1 = 6000×0.7 = 4200, P2 = 14000×0.7 = 9800, total = 14000
    // Ratio P1 = 4200/14000 = 30 %, P2 = 70 %
    // CSG 1000 € → P1 doit recevoir 300 €, P2 doit recevoir 700 €
    const irAvec = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [propP1, propP2],
      csgDeductibleFoncier: "1000",
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    const irSans = computeIR({
      ...BASE_DATA, coupleStatus: "cohab",
      salary1: "30000", salary2: "30000",
      person2FirstName: "Conj", person2LastName: "Test",
      properties: [propP1, propP2],
    }, { ...STD_OPTIONS, foncierRegime: "micro" })
    expect(irAvec.rev1).toBeCloseTo(irSans.rev1 - 300, 0)
    expect(irAvec.rev2).toBeCloseTo(irSans.rev2 - 700, 0)
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
