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

  it("taux plus élevé → mensualité plus élevée (capital et durée fixes)", () => {
    const m1 = calcMonthlyPayment(200000, 2, 20)
    const m2 = calcMonthlyPayment(200000, 4, 20)
    expect(m2).toBeGreaterThan(m1)
  })

  it("durée plus longue → mensualité plus faible (capital et taux fixes)", () => {
    const m1 = calcMonthlyPayment(200000, 3, 15)
    const m2 = calcMonthlyPayment(200000, 3, 25)
    expect(m2).toBeLessThan(m1)
  })

  it("capital négatif → mensualité = 0", () => {
    expect(calcMonthlyPayment(-10000, 3, 20)).toBe(0)
  })

  it("durée = 1 an → 12 mensualités couvrent le capital + intérêts", () => {
    const capital = 10000
    const taux = 5
    const m = calcMonthlyPayment(capital, taux, 1)
    // 12 × m doit ≈ capital + intérêts ≈ capital × (1 + taux/100)
    expect(12 * m).toBeGreaterThan(capital)
    expect(12 * m).toBeLessThan(capital * 1.10) // intérêts raisonnables
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

  it("capital restant jamais négatif", () => {
    const c = calcCapitalRemaining(200000, 3, 20, 25)  // au-delà de la durée
    expect(c).toBeGreaterThanOrEqual(0)
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

  it("intérêts plus élevés en début de prêt qu'à mi-durée et fin", () => {
    const debut = calcAnnualInterests(200000, 3, 20, 0)
    const milieu = calcAnnualInterests(200000, 3, 20, 10)
    const fin = calcAnnualInterests(200000, 3, 20, 18)
    expect(debut).toBeGreaterThan(milieu)
    expect(milieu).toBeGreaterThan(fin)
  })

  it("intérêts année 1 < capital × taux annuel (amortissement mensuel)", () => {
    const i = calcAnnualInterests(200000, 3, 20, 0)
    expect(i).toBeCloseTo(5899, -1)
    expect(i).toBeLessThan(200000 * 0.03)
  })

  it("intérêts année 1 > 0 si capital > 0 et taux > 0", () => {
    const i = calcAnnualInterests(100000, 2, 15, 0)
    expect(i).toBeGreaterThan(0)
  })

  it("taux plus élevé → intérêts plus élevés (même capital, même durée, même moment)", () => {
    const i1 = calcAnnualInterests(200000, 2, 20, 0)
    const i2 = calcAnnualInterests(200000, 4, 20, 0)
    expect(i2).toBeGreaterThan(i1)
  })
})

// ─── IN FINE — DÉDUCTION IFI ─────────────────────────────────────────────────

describe("calcIfiInFineDeduction", () => {

  it("capital = 0 → déduction = 0", () => {
    expect(calcIfiInFineDeduction(0, 20, 5)).toBe(0)
  })

  it("durée = 0 → déduction = 0", () => {
    expect(calcIfiInFineDeduction(200000, 0, 5)).toBe(0)
  })

  it("début du prêt (0 an écoulé) → déduction = capital total", () => {
    const d = calcIfiInFineDeduction(200000, 20, 0)
    expect(d).toBeCloseTo(200000, -2)
  })

  it("mi-durée → déduction = 50% du capital", () => {
    const d = calcIfiInFineDeduction(200000, 20, 10)
    expect(d).toBeCloseTo(100000, -2)
  })

  it("fin de prêt → déduction = 0", () => {
    const d = calcIfiInFineDeduction(200000, 20, 20)
    expect(d).toBe(0)
  })

  it("déduction décroît linéairement dans le temps", () => {
    const d0 = calcIfiInFineDeduction(200000, 20, 0)
    const d5 = calcIfiInFineDeduction(200000, 20, 5)
    const d10 = calcIfiInFineDeduction(200000, 20, 10)
    expect(d5).toBeLessThan(d0)
    expect(d10).toBeLessThan(d5)
    // Linéarité : d5 ≈ 75% × capital, d10 ≈ 50%
    expect(d5).toBeCloseTo(150000, -2)
  })

  it("déduction toujours ≥ 0 même au-delà de la durée", () => {
    const d = calcIfiInFineDeduction(200000, 20, 25)
    expect(d).toBeGreaterThanOrEqual(0)
  })
})

// ─── ANNÉES ÉCOULÉES ─────────────────────────────────────────────────────────

describe("yearsElapsedSince", () => {

  it("date vide → 0 années", () => {
    expect(yearsElapsedSince("")).toBe(0)
  })

  it("date future → 0 (jamais négatif)", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split("T")[0]
    expect(yearsElapsedSince(future)).toBe(0)
  })

  it("date il y a 10 ans → ~10 années", () => {
    const tenYearsAgo = new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const years = yearsElapsedSince(tenYearsAgo)
    expect(years).toBeCloseTo(10, 0)
  })

  it("date d'aujourd'hui → ~0 années", () => {
    const today = new Date().toISOString().split("T")[0]
    expect(yearsElapsedSince(today)).toBeCloseTo(0, 0)
  })

  it("date invalide → 0 années", () => {
    expect(yearsElapsedSince("not-a-date")).toBe(0)
  })
})

// ─── RESOLVE LOAN VALUES ─────────────────────────────────────────────────────

const BASE_PROP = {
  name: "Test", type: "Résidence principale", ownership: "person1", propertyRight: "full",
  usufructAge: "", value: "300000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
  insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
  loanCapitalRemaining: "0", loanInterestAnnual: "0",
  loanInsurance: false, loanInsuranceRate1: "0", loanInsuranceRate2: "0",
  loanInsuranceRate: "0", loanInsurancePremium: "0",
  loanEnabled: false, loanType: "amortissable",
  loanAmount: "0", loanRate: "3", loanDuration: "20",
  loanStartDate: "2020-01-01", indivisionShare1: "100", indivisionShare2: "0",
  loanPledgedPlacementIndex: "-1",
  loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
}

describe("resolveLoanValues — prêts désactivés et cas de base", () => {

  it("loanEnabled = false → tout à 0", () => {
    const r = resolveLoanValues(BASE_PROP)
    expect(r.capital).toBe(0)
    expect(r.interestAnnual).toBe(0)
    expect(r.ifiDeduction).toBe(0)
    expect(r.monthlyPayment).toBe(0)
  })

  it("prêt amortissable actif → capital, mensualité et intérêts > 0", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
    })
    expect(r.capital).toBeGreaterThan(0)
    expect(r.monthlyPayment).toBeGreaterThan(0)
    expect(r.interestAnnual).toBeGreaterThan(0)
  })

  it("capital restant renseigné manuellement → utilisé tel quel (prioritaire)", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true,
      loanCapitalRemaining: "150000",
    })
    expect(r.capital).toBe(150000)
  })

  it("intérêts annuels renseignés manuellement → utilisés tels quels", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true,
      loanCapitalRemaining: "150000", loanInterestAnnual: "4500",
    })
    expect(r.interestAnnual).toBe(4500)
  })
})

describe("resolveLoanValues — types de prêts", () => {

  it("prêt in_fine → mensualité = intérêts seulement (capital × taux / 12)", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanType: "in_fine",
      loanStartDate: "2020-01-01",
    })
    expect(r.monthlyPayment).toBeCloseTo(200000 * 0.03 / 12, 0)
  })

  it("prêt PTZ → taux = 0 → intérêts = 0", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "100000",
      loanRate: "0", loanDuration: "20", loanType: "ptz",
      loanStartDate: "2020-01-01",
    })
    expect(r.interestAnnual).toBe(0)
    expect(r.monthlyPayment).toBeGreaterThan(0) // remboursement capital sans intérêts
  })

  it("prêt relais → traité comme amortissable (ifiDeduction = capital)", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "150000",
      loanRate: "4", loanDuration: "2", loanType: "relais",
      loanStartDate: "2024-01-01",
    })
    // Amortissable → ifiDeduction = capital restant (pas calcul in_fine)
    expect(r.ifiDeduction).toBeCloseTo(r.capital, 0)
  })

  it("prêt in_fine → ifiDeduction < capital initial (dégressif dans le temps)", () => {
    // Démarré il y a 5 ans sur 20 ans → ifiDeduction = capital × (1 - 5/20) = 75%
    const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0]
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanType: "in_fine",
      loanStartDate: fiveYearsAgo,
    })
    // In fine : ifiDeduction = capital × (1 - floor(elapsed)/duration)
    expect(r.ifiDeduction).toBeLessThan(200000)
    expect(r.ifiDeduction).toBeGreaterThan(0)
  })

  it("prêt amortissable → ifiDeduction = capital restant (pas calcul spécifique)", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanType: "amortissable",
      loanStartDate: "2020-01-01",
    })
    expect(r.ifiDeduction).toBeCloseTo(r.capital, 0)
  })
})

// ─── COHÉRENCE MATHÉMATIQUE ───────────────────────────────────────────────────

describe("cohérence mathématique — invariants des calculs de crédit", () => {

  it("totalPaid > capital si taux > 0 (intérêts positifs)", () => {
    const capital = 200000
    const taux = 3
    const durée = 20
    const m = calcMonthlyPayment(capital, taux, durée)
    const totalPaid = m * durée * 12
    expect(totalPaid).toBeGreaterThan(capital)
  })

  it("totalPaid = capital si taux = 0 (pas d'intérêts)", () => {
    const capital = 120000
    const durée = 10
    const m = calcMonthlyPayment(capital, 0, durée)
    const totalPaid = m * durée * 12
    expect(totalPaid).toBeCloseTo(capital, -1)
  })

  it("capital restant à mi-durée < capital restant à 1/4 de la durée", () => {
    // Vérifie la monotonie décroissante du capital restant
    // (remplace le test d'invariant comptable qui nécessitait la somme cumulée des intérêts)
    const c5 = calcCapitalRemaining(200000, 3, 20, 5)
    const c10 = calcCapitalRemaining(200000, 3, 20, 10)
    expect(c10).toBeLessThan(c5)
    // À 10 ans sur 20, il reste plus de 50% à rembourser (amortissement lent au début)
    expect(c10).toBeGreaterThan(200000 * 0.5)
  })

  it("intérêts année 1 < capital × taux annuel (l'amortissement mensuel réduit la base)", () => {
    const i = calcAnnualInterests(200000, 4, 20, 0)
    expect(i).toBeLessThan(200000 * 0.04)
    expect(i).toBeGreaterThan(0)
  })

  it("mensualité plus élevée → prêt remboursé plus vite → capital restant à mi-durée plus faible", () => {
    // Durée 15 ans vs 25 ans → mensualité plus haute → moins de capital restant à 7 ans
    const c15 = calcCapitalRemaining(200000, 3, 15, 7)
    const c25 = calcCapitalRemaining(200000, 3, 25, 7)
    expect(c15).toBeLessThan(c25)
  })

  it("les 4 retours de resolveLoanValues sont tous ≥ 0", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "250000",
      loanRate: "3.5", loanDuration: "25", loanStartDate: "2022-01-01",
    })
    expect(r.capital).toBeGreaterThanOrEqual(0)
    expect(r.interestAnnual).toBeGreaterThanOrEqual(0)
    expect(r.ifiDeduction).toBeGreaterThanOrEqual(0)
    expect(r.monthlyPayment).toBeGreaterThanOrEqual(0)
  })
})

// ─── CAS LIMITES ET EDGE CASES ────────────────────────────────────────────────

describe("edge cases — valeurs extrêmes", () => {

  it("calcMonthlyPayment : capital très élevé → résultat proportionnel", () => {
    const m1 = calcMonthlyPayment(100000, 3, 20)
    const m2 = calcMonthlyPayment(1000000, 3, 20)
    expect(m2).toBeCloseTo(m1 * 10, 0)
  })

  it("calcMonthlyPayment : taux très faible (0.1%) → proche du remboursement linéaire", () => {
    const mTauxFaible = calcMonthlyPayment(100000, 0.1, 20)
    const mSansTaux = calcMonthlyPayment(100000, 0, 20)
    // Très proche mais légèrement supérieur
    expect(mTauxFaible).toBeGreaterThan(mSansTaux)
    expect(mTauxFaible - mSansTaux).toBeLessThan(50) // différence < 50€/mois
  })

  it("resolveLoanValues : loanAmount = 0 et loanCapitalRemaining = 0 → capital = 0", () => {
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true,
      loanAmount: "0", loanCapitalRemaining: "0",
      loanRate: "3", loanDuration: "20",
    })
    expect(r.capital).toBe(0)
    expect(r.monthlyPayment).toBe(0)
  })

  it("resolveLoanValues : date de départ dans le futur → elapsed ≈ 0 → capital ≈ capital initial", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const r = resolveLoanValues({
      ...BASE_PROP, loanEnabled: true, loanAmount: "200000",
      loanRate: "3", loanDuration: "20", loanStartDate: futureDate,
    })
    expect(r.capital).toBeCloseTo(200000, -2)
  })

  it("calcCapitalRemaining : taux élevé (10%) → capital restant à mi-durée > 50% du capital", () => {
    // Avec taux élevé, l'amortissement est plus lent en début de prêt
    const c = calcCapitalRemaining(200000, 10, 20, 10)
    expect(c).toBeGreaterThan(100000) // > 50% du capital initial
  })
})
