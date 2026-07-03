// LOT A — Socle générique de réductions d'IR + migration du forfait scolaire.
//
// (a) liste vide -> impôt inchangé à l'identique
// (b) réduction > impôt -> impôtFinal 0, fraction perdue tracée (pas de report)
// (c) deux réductions -> imputation ordonnée et bornée à l'impôt restant
// (d) MIROIR concubins / foyer commun -> le forfait scolaire réduit l'impôt du
//     même montant dans les DEUX branches (preuve du point d'entrée unique)
// (e) VERROU forfait scolaire (iso) -> finalIR capturé sur main AVANT migration :
//       e1 (foyer commun, 1 enfant collège, salaire 60 000)  = 7435,99  (forfait 61)
//       e2 (foyer commun, 2 enfants lycée+sup, salaire 80 000) = 3857,98 (forfait 336)
//       cohab (concubins, 1 enfant collège, salaire 60 000)   = 5794,985 (forfait 61)
import { describe, it, expect } from 'vitest'
import { computeIR, appliquerReductionsIR, type ReductionIR } from '../lib/calculs/ir'
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
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any

const STD_OPTIONS = {
  expenseMode1: "standard" as const, expenseMode2: "standard" as const,
  km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9",
  km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9",
  foncierRegime: "micro",
  other1: "0", other2: "0",
} as any

const child = (schoolLevel: string, parentLink: string, birthDate: string) => ({
  firstName: "E", lastName: "T", birthDate, parentLink,
  custody: "full", rattached: true, handicap: false, schoolLevel,
})
const red = (id: string, montant: number): ReductionIR =>
  ({ id, label: id, montant, plafondNiches: false })

// ─── (a,b,c) Fonction pure appliquerReductionsIR ──────────────────────────────
describe("appliquerReductionsIR — socle pur", () => {
  it("(a) liste vide -> impôt strictement inchangé, no-op", () => {
    const r = appliquerReductionsIR(7435.99, [])
    expect(r.impotFinal).toBe(7435.99) // à l'identique (même valeur, pas d'arrondi)
    expect(r.totalImpute).toBe(0)
    expect(r.detail).toEqual([])
  })

  it("(b) réduction > impôt -> impôtFinal 0, fraction perdue tracée (pas de report)", () => {
    const r = appliquerReductionsIR(100, [red("x", 150)])
    expect(r.impotFinal).toBe(0)
    expect(r.totalImpute).toBe(100)
    expect(r.detail).toEqual([{ id: "x", montant: 150, impute: 100 }])
    // fraction perdue = montant déclaré - montant imputé (aucun report)
    expect(r.detail[0].montant - r.detail[0].impute).toBe(50)
  })

  it("(c) deux réductions -> imputation ordonnée et bornée à l'impôt restant", () => {
    const r = appliquerReductionsIR(300, [red("a", 200), red("b", 250)])
    // a impute 200 (reste 100) ; b borné à min(250, 100) = 100 (reste 0)
    expect(r.detail).toEqual([
      { id: "a", montant: 200, impute: 200 },
      { id: "b", montant: 250, impute: 100 },
    ])
    expect(r.impotFinal).toBe(0)
    expect(r.totalImpute).toBe(300)
  })

  it("(c-bis) deux réductions qui tiennent -> imputation totale, ordre préservé", () => {
    const r = appliquerReductionsIR(1000, [red("a", 200), red("b", 250)])
    expect(r.impotFinal).toBe(550)
    expect(r.totalImpute).toBe(450)
    expect(r.detail.map(d => d.impute)).toEqual([200, 250])
  })

  it("(c-ter) défensif : montant négatif ignoré, impôt négatif borné à 0", () => {
    expect(appliquerReductionsIR(1000, [red("neg", -50)]).impotFinal).toBe(1000)
    expect(appliquerReductionsIR(-5, [red("x", 10)]).impotFinal).toBe(0)
  })
})

// ─── (d) MIROIR concubins / foyer commun ──────────────────────────────────────
describe("forfait scolaire — miroir concubins / foyer commun", () => {
  const fcAvec = () => computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000",
    childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
  const fcSans = () => computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000",
    childrenData: [child("", "person1_only", "2010-01-01")] }, STD_OPTIONS)
  const cohabAvec = () => computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000",
    childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
  const cohabSans = () => computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000",
    childrenData: [child("", "person1_only", "2010-01-01")] }, STD_OPTIONS)

  it("(d) le forfait 61 € réduit l'impôt du MÊME montant dans les deux branches", () => {
    const deltaFC = fcSans().finalIR - fcAvec().finalIR
    const deltaCohab = cohabSans().finalIR - cohabAvec().finalIR
    expect(deltaFC).toBeCloseTo(61, 2)
    expect(deltaCohab).toBeCloseTo(61, 2)
    expect(deltaFC).toBeCloseTo(deltaCohab, 2) // cohérence stricte des deux chemins
  })

  it("(d-bis) le champ forfaitScolaireReduction reste exposé (iso de forme)", () => {
    expect(fcAvec().forfaitScolaireReduction).toBe(61)
    expect(cohabAvec().forfaitScolaireReduction).toBe(61)
  })
})

// ─── (e) VERROU ISO — valeurs capturées sur main AVANT migration ──────────────
describe("VERROU iso — finalIR forfait scolaire inchangé au centime", () => {
  it("(e1) foyer commun single, 1 enfant collège, salaire 60 000 -> 7435,99", () => {
    const ir = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000",
      childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    expect(ir.forfaitScolaireReduction).toBe(61)
    expect(ir.finalIR).toBeCloseTo(7435.99, 2)
  })

  it("(e2) foyer commun marié, 2 enfants lycée + supérieur, salaire 80 000 -> 3857,98", () => {
    const ir = computeIR({ ...BASE_DATA, coupleStatus: "married", salary1: "80000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [
        child("lycee", "common_child", "2008-01-01"),
        child("superieur", "common_child", "2004-01-01"),
      ] }, STD_OPTIONS)
    expect(ir.forfaitScolaireReduction).toBe(336)
    expect(ir.finalIR).toBeCloseTo(3857.98, 2)
  })

  it("(e-miroir) concubins, 1 enfant collège, salaire 60 000 -> 5794,985", () => {
    const ir = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000",
      childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    expect(ir.forfaitScolaireReduction).toBe(61)
    expect(ir.finalIR).toBeCloseTo(5794.985, 3)
  })
})
