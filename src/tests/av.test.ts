// Tests fiscalité Assurances Vie — 990I / 757B — couverture exhaustive
// Cible : computeAvTax (src/lib/calculs/succession.ts)
import { describe, it, expect } from 'vitest'
import { computeAvTax } from '../lib/calculs/succession'

// ─── RAPPEL DES RÈGLES FISCALES ───────────────────────────────────────────────
//
// Art. 990 I (primes versées AVANT 70 ans) :
//   - Abattement 152 500 € / bénéficiaire (tous contrats cumulés)
//   - 20 % jusqu'à 700 000 € de taxable
//   - 31,25 % au-delà de 700 000 € de taxable
//   - Conjoint : exonéré
//
// Art. 757 B (primes versées APRÈS 70 ans) :
//   - Abattement global 30 500 € (appliqué en amont → amountAfter70TaxableShare déjà réduit)
//   - Droits de succession selon barème du lien de parenté
//   - Abattement individuel de la relation déduit dans computeAvTax
//   - Conjoint : exonéré
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── CONJOINT : EXONÉRATION TOTALE ───────────────────────────────────────────

describe("computeAvTax — conjoint exonéré (art. 796-0 bis)", () => {

  it("conjoint + primes avant 70 ans élevées → totalTax = 0", () => {
    const r = computeAvTax("conjoint", 500000, 0)
    expect(r.totalTax).toBe(0)
    expect(r.before70Tax).toBe(0)
    expect(r.after70Tax).toBe(0)
  })

  it("conjoint + primes après 70 ans élevées → totalTax = 0", () => {
    const r = computeAvTax("conjoint", 0, 300000)
    expect(r.totalTax).toBe(0)
    expect(r.after70Tax).toBe(0)
  })

  it("conjoint + les deux types de primes → totalTax = 0", () => {
    const r = computeAvTax("conjoint", 300000, 200000)
    expect(r.totalTax).toBe(0)
  })
})

// ─── ENFANT — AVANT 70 ANS (art. 990 I) ──────────────────────────────────────

describe("computeAvTax — enfant, primes avant 70 ans (990 I)", () => {

  it("montant ≤ 152 500 € → taxable = 0 → taxe = 0", () => {
    const r = computeAvTax("enfant", 100000, 0)
    expect(r.before70Taxable).toBe(0)
    expect(r.before70Tax).toBe(0)
    expect(r.totalTax).toBe(0)
  })

  it("montant = 152 500 € (exactement l'abattement) → taxable = 0", () => {
    const r = computeAvTax("enfant", 152500, 0)
    expect(r.before70Taxable).toBe(0)
    expect(r.before70Tax).toBe(0)
  })

  it("montant = 200 000 € → taxable = 47 500 € → taxe = 9 500 €", () => {
    // 200 000 - 152 500 = 47 500 → 47 500 × 20% = 9 500 €
    const r = computeAvTax("enfant", 200000, 0)
    expect(r.before70Taxable).toBeCloseTo(47500, 0)
    expect(r.before70Tax).toBeCloseTo(9500, 0)
    expect(r.totalTax).toBeCloseTo(9500, 0)
  })

  it("montant = 852 500 € (exactement seuil 31,25%) → taxe = 700 000 × 20%", () => {
    // 852 500 - 152 500 = 700 000 → exactement la borne → 700 000 × 20% = 140 000 €
    const r = computeAvTax("enfant", 852500, 0)
    expect(r.before70Taxable).toBeCloseTo(700000, 0)
    expect(r.before70Tax).toBeCloseTo(140000, 0)
  })

  it("montant = 1 000 000 € → taux 31,25% sur excédent de 700k", () => {
    // taxable = 1 000 000 - 152 500 = 847 500
    // tranche 20% : 700 000 × 0.20 = 140 000
    // tranche 31,25% : 147 500 × 0.3125 = 46 093.75
    // total = 186 093.75
    const r = computeAvTax("enfant", 1000000, 0)
    expect(r.before70Taxable).toBeCloseTo(847500, 0)
    expect(r.before70Tax).toBeCloseTo(186093.75, 0)
    expect(r.totalTax).toBeCloseTo(186093.75, 0)
  })

  it("taxe before70 croît avec le montant reçu", () => {
    const t1 = computeAvTax("enfant", 300000, 0).before70Tax
    const t2 = computeAvTax("enfant", 600000, 0).before70Tax
    const t3 = computeAvTax("enfant", 1000000, 0).before70Tax
    expect(t2).toBeGreaterThan(t1)
    expect(t3).toBeGreaterThan(t2)
  })
})

// ─── ENFANT — APRÈS 70 ANS (art. 757 B) ─────────────────────────────────────

describe("computeAvTax — enfant, primes après 70 ans (757 B)", () => {

  it("amountAfter70TaxableShare ≤ abattement enfant (100k) → taxe après 70 = 0", () => {
    // abattement enfant = 100 000 €
    const r = computeAvTax("enfant", 0, 80000)
    expect(r.after70Taxable).toBe(0)
    expect(r.after70Tax).toBe(0)
  })

  it("amountAfter70TaxableShare = 200 000 → taxable = 100 000 → droits ligne directe", () => {
    // taxable = 200 000 - 100 000 (abatt. enfant) = 100 000
    // Barème ligne directe sur 100 000 :
    // 8 072 × 5% = 403.60
    // 4 037 × 10% = 403.70
    // 3 823 × 15% = 573.45
    // 84 068 × 20% = 16 813.60
    // Total ≈ 18 194.35
    const r = computeAvTax("enfant", 0, 200000)
    expect(r.after70Taxable).toBeCloseTo(100000, 0)
    expect(r.after70Tax).toBeCloseTo(18194, 0)  // tolérance ±50€
  })

  it("cumul avant + après 70 ans → totalTax = before70Tax + after70Tax", () => {
    const r = computeAvTax("enfant", 300000, 200000)
    expect(r.totalTax).toBeCloseTo(r.before70Tax + r.after70Tax, 0)
  })

  it("taxe après 70 croît avec le montant taxable", () => {
    const t1 = computeAvTax("enfant", 0, 150000).after70Tax
    const t2 = computeAvTax("enfant", 0, 500000).after70Tax
    const t3 = computeAvTax("enfant", 0, 1000000).after70Tax
    expect(t2).toBeGreaterThan(t1)
    expect(t3).toBeGreaterThan(t2)
  })
})

// ─── FRÈRE/SŒUR ──────────────────────────────────────────────────────────────

describe("computeAvTax — frère/sœur (757 B)", () => {

  it("abattement frère/sœur = 15 932 € sur après 70 ans", () => {
    const r = computeAvTax("frereSoeur", 0, 15932)
    expect(r.after70Taxable).toBe(0)
    expect(r.after70Tax).toBe(0)
  })

  it("after70TaxableShare = 200 000 → taxable = 184 068 → barème 35%/45%", () => {
    // taxable = 200 000 - 15 932 = 184 068
    // 24 430 × 35% = 8 550.50
    // 159 638 × 45% = 71 837.10
    // total ≈ 80 387.60
    const r = computeAvTax("frereSoeur", 0, 200000)
    expect(r.after70Taxable).toBeCloseTo(184068, 0)
    // Précision -1 = tolérance ±5€ pour éviter les erreurs d'arrondi float
    expect(r.after70Tax).toBeCloseTo(80387.6, 1)
  })

  it("before70 frère/sœur → taxé au taux 990I (20%/31,25%), pas barème succession", () => {
    // La 990I s'applique indépendamment de la relation (sauf conjoint)
    const r = computeAvTax("frereSoeur", 200000, 0)
    expect(r.before70Tax).toBeCloseTo(9500, 0)  // même calcul que pour l'enfant
  })
})

// ─── TIERS FISCAL (60%) ───────────────────────────────────────────────────────

describe("computeAvTax — tiers / autre (60%)", () => {

  it("autre relation → before70 taxé en 990I (20%), pas en 60%", () => {
    // La 990I est un prélèvement forfaitaire : taux 20%/31,25% quelle que soit la relation
    const r = computeAvTax("autre", 200000, 0)
    expect(r.before70Tax).toBeCloseTo(9500, 0)
  })

  it("autre relation → after70 taxé au barème tiers (60%), abattement 1 594 €", () => {
    // taxable = 200 000 - 1 594 = 198 406 → × 60% = 119 043.60
    const r = computeAvTax("autre", 0, 200000)
    expect(r.after70Taxable).toBeCloseTo(198406, 0)
    expect(r.after70Tax).toBeCloseTo(119044, 0)
  })

  it("montant = 0 de chaque côté → totalTax = 0", () => {
    const r = computeAvTax("enfant", 0, 0)
    expect(r.totalTax).toBe(0)
    expect(r.before70Tax).toBe(0)
    expect(r.after70Tax).toBe(0)
  })
})

// ─── INVARIANTS GÉNÉRAUX ──────────────────────────────────────────────────────

describe("computeAvTax — invariants", () => {

  it("taxe ≥ 0 pour toutes les relations et montants", () => {
    const relations = ["enfant", "frereSoeur", "neveuNiece", "conjoint", "autre", "parent"]
    const montants = [0, 50000, 200000, 1000000]
    relations.forEach(rel => {
      montants.forEach(m => {
        const r = computeAvTax(rel, m, m)
        expect(r.totalTax).toBeGreaterThanOrEqual(0)
        expect(r.before70Tax).toBeGreaterThanOrEqual(0)
        expect(r.after70Tax).toBeGreaterThanOrEqual(0)
      })
    })
  })

  it("taxe croît ou est stable quand les montants augmentent", () => {
    const t1 = computeAvTax("enfant", 300000, 200000).totalTax
    const t2 = computeAvTax("enfant", 600000, 400000).totalTax
    expect(t2).toBeGreaterThan(t1)
  })

  it("totalTax = before70Tax + after70Tax (toujours)", () => {
    const cases = [
      ["enfant", 200000, 100000],
      ["frereSoeur", 500000, 200000],
      ["conjoint", 800000, 300000],
    ] as [string, number, number][]
    cases.forEach(([rel, b, a]) => {
      const r = computeAvTax(rel, b, a)
      expect(r.totalTax).toBeCloseTo(r.before70Tax + r.after70Tax, 1)
    })
  })
})
