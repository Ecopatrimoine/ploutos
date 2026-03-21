// Tests calcul crédit immobilier — couverture exhaustive
import { describe, it, expect } from 'vitest'
import {
  calcMonthlyPayment,
  calcCapitalRemaining,
  calcAnnualInterests,
  calcIfiInFineDeduction,
  yearsElapsedSince,
  resolveLoanValues,
} from '../lib/calculs/credit'

// ─── MENSUALITÉ ──────────────────────────────────────────────────────────────
describe("calcMonthlyPayment", () => {

  it("capital = 0 → mensualité = 0", () => {
    expect(calcMonthlyPayment(0, 3, 20)).toBe(0)
  })

  it("durée = 0 → mensualité = 0", () => {
    expect(calcMonthlyPayment(200000, 3, 0)).toBe(0)
  })

  it("taux = 0 → mensualité = capital / (durée * 12)", () => {
    const m = calcMonthlyPayment(120000, 0, 10)
    expect(m).toBeCloseTo(1000, 0)
  })

  it("emprunt 200 000 € à 3% sur 20 ans → ~1 109 €/mois", () => {
    const m = calcMonthlyPayment(200000, 3, 20)
    expect(m).toBeCloseTo(1109, 0)
  })

  it("emprunt 300 000 € à 2% sur 25 ans → ~1 272 €/mois", () => {
    const m = calcMonthlyPayment(300000, 2, 25)
    expect(m).toBeCloseTo(1272, 0)
  })

  it("taux plus élevé → mensualité plus élevée", () => {
    const m1 = calcMonthlyPayment(200000, 2, 20)
    const m2 = calcMonthlyPayment(200000, 4, 20)
    expect(m2).toBeGreaterThan(m1)
  })

  it("durée plus longue → mensualité plus faible", () => {
    const m1 = calcMonthlyPayment(200000, 3, 15)
    const m2 = calcMonthlyPayment(200000, 3, 25)
    expect(m2).toBeLessThan(m1)
  })
})

// ─── CAPITAL RESTANT ─────────────────────────────────────────────────────────
describe("calcCapitalRemaining", () => {

  it("capital = 0 → capital restant = 0", () => {
    expect(calcCapitalRemaining(0, 3, 20, 5)).toBe(0)
  })

  it("durée = 0 → capital restant = 0", () => {
    expect(calcCapitalRemaining(200000, 3, 0, 5)).toBe(0)
  })

  it("au départ (0 an écoulé) → capital restant ≈ capital initial", () => {
    const c = calcCapitalRemaining(200000, 3, 20, 0)
    expect(c).toBeCloseTo(200000, -2)
  })

  it("à mi-durée → capital restant < capital initial", () => {
    const c = calcCapitalRemaining(200000, 3, 20, 10)
    expect(c).toBeLessThan(200000)
    expect(c).toBeGreaterThan(0)
  })

  it("à la fin → capital restant ≈ 0", () => {
    const c = calcCapitalRemaining(200000, 3, 20, 20)
    expect(c).toBeCloseTo(0, -2)
  })

  it("capital restant décroît avec le temps", () => {
    const c0 = calcCapitalRemaining(200000, 3, 20, 0)
    const c5 = calcCapitalRemaining(200000, 3, 20, 5)
    const c10 = calcCapitalRemaining(200000, 3, 20, 10)
    const c15 = calcCapitalRemaining(200000, 3, 20, 15)
    expect(c5).toBeLessThan(c0)
    expect(c10).toBeLessThan(c5)
    expect(c15).toBeLessThan(c10)
  })

  it("taux = 0 → remboursement linéaire", () => {
    const c = calcCapitalRemaining(200000, 0, 20, 10)
    expect(c).toBeCloseTo(100000, -2)
  })
})

// ─── INTÉRÊTS ANNUELS ────────────────────────────────────────────────────────
describe("calcAnnualInterests", () => {

  it("capital = 0 → intérêts = 0", () => {
    expect(calcAnnualInterests(0, 3, 20, 0)).toBe(0)
  })

  it("taux = 0 → intérêts = 0", () => {
    expect(calcAnnualInterests(200000, 0, 20, 0)).toBe(0)
  })

  it("intérêts plus élevés en début de prêt", () => {
    const debut = calcAnnualInterests(200000, 3, 20, 0)
    const milieu = calcAnnualInterests(200000, 3, 20, 10)
    const fin = calcAnnualInterests(200000, 3, 20, 18)
    expect(debut).toBeGreaterThan(milieu)
    expect(milieu).toBeGreaterThan(fin)
  })

  it("intérêts année 1 < capital × taux annuel (amortissement mensuel)", () => {
    const i = calcAnnualInterests(200000, 3, 20, 0)
    // L'amortissement mensuel réduit légèrement la base chaque mois
    // Valeur calculée réelle : ~5 899 €
    expect(i).toBeCloseTo(5899, -1)
    // Toujours inférieur à capital × taux annuel brut
    expect(i).toBeLessThan(200000 * 0.03)
  })
})

// ─── IN FINE DÉDUCTION IFI ───────────────────────────────────────────────────
describe("calcIfiInFineDeduction", () => {

  it("capital = 0 → déduction = 0", () => {
    expect(calcIfiInFineDeduction(0, 20, 5)).toBe(0)
  })

  it("durée = 0 → déduction = 0", () => {
    expect(calcIfiInFineDeduction(200000, 0, 5)).toBe(0)
  })

  it("début du prêt → déduction ≈ capital total", () => {
    const d = calcIfiInFineDeduction(200000, 20, 0)
    expect(d).toBeCloseTo(200000, -2)
  })

  it("mi-durée → déduction = 50% du capital", () => {
    const d = calcIfiInFineDeduction(200000, 20, 10)
    expect(d).toBeCloseTo(100000, -2)
  })

  it("fin de prêt → déduction ≈ 0", () => {
    const d = calcIfiInFineDeduction(200000, 20, 20)
    expect(d).toBe(0)
  })

  it("déduction décroît linéairement", () => {
    const d0 = calcIfiInFineDeduction(200000, 20, 0)
    const d5 = calcIfiInFineDeduction(200000, 20, 5)
    const d10 = calcIfiInFineDeduction(200000, 20, 10)
    expect(d5).toBeLessThan(d0)
    expect(d10).toBeLessThan(d5)
  })
})

// ─── ANNÉES ÉCOULÉES ─────────────────────────────────────────────────────────
describe("yearsElapsedSince", () => {

  it("date vide → 0 années", () => {
    expect(yearsElapsedSince("")).toBe(0)
  })

  it("date future → 0 (pas de valeur négative)", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split("T")[0]
    expect(yearsElapsedSince(future)).toBe(0)
  })

  it("date il y a 10 ans → ~10 années", () => {
    const tenYearsAgo = new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const years = yearsElapsedSince(tenYearsAgo)
    expect(years).toBeCloseTo(10, 0)
  })
})

// ─── RESOLVE LOAN VALUES ─────────────────────────────────────────────────────
describe("resolveLoanValues", () => {

  const BASE_PROP = {
    name: "Test", type: "Résidence principale", ownership: "person1", propertyRight: "full",
    usufructAge: "", value: "300000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
    insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
    loanCapitalRemaining: "0", loanInterestAnnual: "0",
    loanInsurance: false, loanInsuranceRate1: "0", loanInsuranceRate2: "0",
    loanInsuranceRate: "0", loanInsurancePremium: "0",
    loanEnabled: false, loanType: "amortissable",
    loanInitialCapital: "0", loanRate: "3", loanDuration: "20",
    loanStartDate: "2020-01-01", indivisionShare1: "100", indivisionShare2: "0",
    loanAmount: "0", loanPledgedPlacementIndex: "-1",
    loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
  }

  it("loanEnabled = false → tout à 0", () => {
    const r = resolveLoanValues(BASE_PROP)
    expect(r.capital).toBe(0)
    expect(r.interestAnnual).toBe(0)
    expect(r.ifiDeduction).toBe(0)
    expect(r.monthlyPayment).toBe(0)
  })

  it("prêt amortissable sans capital renseigné → calcul auto", () => {
    const r = resolveLoanValues({
      ...BASE_PROP,
      loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
    })
    expect(r.capital).toBeGreaterThan(0)
    expect(r.monthlyPayment).toBeGreaterThan(0)
  })

  it("capital renseigné manuellement → utilisé tel quel", () => {
    const r = resolveLoanValues({
      ...BASE_PROP,
      loanEnabled: true,
      loanCapitalRemaining: "150000",
    })
    expect(r.capital).toBe(150000)
  })

  it("prêt in fine → mensualité = intérêts seulement", () => {
    const r = resolveLoanValues({
      ...BASE_PROP,
      loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanType: "in_fine",
      loanStartDate: "2020-01-01",
    })
    // In fine : mensualité = capital × taux / 12
    expect(r.monthlyPayment).toBeCloseTo(200000 * 0.03 / 12, 0)
  })

  it("PTZ → taux = 0 → pas d'intérêts", () => {
    const r = resolveLoanValues({
      ...BASE_PROP,
      loanEnabled: true, loanAmount: "100000",
      loanRate: "0", loanDuration: "20", loanType: "ptz",
      loanStartDate: "2020-01-01",
    })
    expect(r.interestAnnual).toBe(0)
  })
})
