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
import { referentiels } from '../data/prevoyance'

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
const redP = (id: string, montant: number): ReductionIR =>
  ({ id, label: id, montant, plafondNiches: true })
const PLAFOND = referentiels.pass.plafondGlobalNiches // 10 000 (art. 200-0 A CGI)

// ─── (a,b,c) Fonction pure appliquerReductionsIR ──────────────────────────────
describe("appliquerReductionsIR — socle pur", () => {
  it("(a) liste vide -> impôt strictement inchangé, no-op", () => {
    const r = appliquerReductionsIR(7435.99, [], PLAFOND)
    expect(r.impotFinal).toBe(7435.99) // à l'identique (même valeur, pas d'arrondi)
    expect(r.totalImpute).toBe(0)
    expect(r.detail).toEqual([])
  })

  it("(b) réduction > impôt -> impôtFinal 0, fraction perdue tracée (pas de report)", () => {
    const r = appliquerReductionsIR(100, [red("x", 150)], PLAFOND)
    expect(r.impotFinal).toBe(0)
    expect(r.totalImpute).toBe(100)
    expect(r.detail).toEqual([{ id: "x", montant: 150, impute: 100 }])
    // fraction perdue = montant déclaré - montant imputé (aucun report)
    expect(r.detail[0].montant - r.detail[0].impute).toBe(50)
  })

  it("(c) deux réductions -> imputation ordonnée et bornée à l'impôt restant", () => {
    const r = appliquerReductionsIR(300, [red("a", 200), red("b", 250)], PLAFOND)
    // a impute 200 (reste 100) ; b borné à min(250, 100) = 100 (reste 0)
    expect(r.detail).toEqual([
      { id: "a", montant: 200, impute: 200 },
      { id: "b", montant: 250, impute: 100 },
    ])
    expect(r.impotFinal).toBe(0)
    expect(r.totalImpute).toBe(300)
  })

  it("(c-bis) deux réductions qui tiennent -> imputation totale, ordre préservé", () => {
    const r = appliquerReductionsIR(1000, [red("a", 200), red("b", 250)], PLAFOND)
    expect(r.impotFinal).toBe(550)
    expect(r.totalImpute).toBe(450)
    expect(r.detail.map(d => d.impute)).toEqual([200, 250])
  })

  it("(c-ter) défensif : montant négatif ignoré, impôt négatif borné à 0", () => {
    expect(appliquerReductionsIR(1000, [red("neg", -50)], PLAFOND).impotFinal).toBe(1000)
    expect(appliquerReductionsIR(-5, [red("x", 10)], PLAFOND).impotFinal).toBe(0)
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

// ─── LOT B — Plafonnement global des niches (art. 200-0 A CGI) ─────────────────
// Logique DORMANTE : aucune réduction plafondNiches:true ne circule dans computeIR
// aujourd'hui (dispositifs immobiliers = Lot D). On teste donc la fonction pure,
// plus le verrou ISO au niveau computeIR (le forfait reste hors plafond).
describe("appliquerReductionsIR — plafonnement global des niches (200-0 A)", () => {
  it("(a) plafonnables cumulant 12 000 -> 10 000 imputés max, écrêtement 2000", () => {
    const r = appliquerReductionsIR(50000, [redP("a", 7000), redP("b", 5000)], PLAFOND)
    expect(r.totalPlafonnableAvantEcretement).toBe(12000)
    expect(r.ecretementNiches).toBe(2000)
    expect(r.totalImpute).toBe(10000)   // impôt large -> tout l'écrêté s'impute
    expect(r.impotFinal).toBe(40000)
    expect(r.perduFauteImpot).toBe(0)
  })

  it("(b) mix forfait (hors plafond) + plafonnable 11 000 -> forfait plein, plafonnable écrêté à 10 000", () => {
    const r = appliquerReductionsIR(50000, [red("forfait_scolaire", 336), redP("pinel", 11000)], PLAFOND)
    expect(r.totalPlafonnableAvantEcretement).toBe(11000) // le forfait (false) ne consomme pas l'enveloppe
    expect(r.ecretementNiches).toBe(1000)
    expect(r.totalImpute).toBe(10336)                     // 336 hors plafond + 10 000 plafonnés
    expect(r.impotFinal).toBe(39664)
    expect(r.detail).toEqual([
      { id: "forfait_scolaire", montant: 336, impute: 336 },
      { id: "pinel", montant: 11000, impute: 10000 },
    ])
  })

  it("(c) plafonnable 9 999 -> aucun écrêtement", () => {
    const r = appliquerReductionsIR(50000, [redP("a", 9999)], PLAFOND)
    expect(r.totalPlafonnableAvantEcretement).toBe(9999)
    expect(r.ecretementNiches).toBe(0)
    expect(r.totalImpute).toBe(9999)
  })

  it("(d) écrêtement PUIS borne d'impôt : plafonnable 12 000, impôt 4 000 -> impute 4000, écrêtement 2000, faute d'impôt 6000", () => {
    const r = appliquerReductionsIR(4000, [redP("a", 12000)], PLAFOND)
    expect(r.ecretementNiches).toBe(2000)   // perdu par le plafond (12 000 -> 10 000)
    expect(r.perduFauteImpot).toBe(6000)    // perdu faute d'impôt (10 000 écrêté - 4 000 imputé)
    expect(r.totalImpute).toBe(4000)
    expect(r.impotFinal).toBe(0)
    expect(r.ecretementNiches).not.toBe(r.perduFauteImpot) // deux pertes DISTINCTES et tracées
  })

  it("(e) miroir concubins / foyer commun : même plafond câblé, forfait 61 dans les deux branches", () => {
    const fcAvec = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000",
      childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    const fcSans = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000",
      childrenData: [child("", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    const cohabAvec = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000",
      childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    const cohabSans = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000",
      childrenData: [child("", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    expect(fcSans.finalIR - fcAvec.finalIR).toBeCloseTo(61, 2)
    expect(cohabSans.finalIR - cohabAvec.finalIR).toBeCloseTo(61, 2)
  })

  it("(f) VERROU ISO : e1/e2/miroir du Lot A inchangés au centime après câblage du plafond", () => {
    const e1 = computeIR({ ...BASE_DATA, coupleStatus: "single", salary1: "60000",
      childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    const e2 = computeIR({ ...BASE_DATA, coupleStatus: "married", salary1: "80000",
      person2FirstName: "Conj", person2LastName: "Test",
      childrenData: [child("lycee", "common_child", "2008-01-01"), child("superieur", "common_child", "2004-01-01")] }, STD_OPTIONS)
    const cohab = computeIR({ ...BASE_DATA, coupleStatus: "cohab", salary1: "60000",
      childrenData: [child("college", "person1_only", "2010-01-01")] }, STD_OPTIONS)
    expect(e1.finalIR).toBeCloseTo(7435.99, 2)
    expect(e2.finalIR).toBeCloseTo(3857.98, 2)
    expect(cohab.finalIR).toBeCloseTo(5794.985, 3)
  })
})
