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
const redP = (id: string, montant: number): ReductionIR =>            // 'commun' (enveloppe 10 000 €)
  ({ id, label: id, montant, plafondNiches: 'commun' })
const redM = (id: string, montant: number, fractionPlafond?: number): ReductionIR =>  // 'majore' (18 000 €)
  ({ id, label: id, montant, plafondNiches: 'majore', fractionPlafond })
const PLAFOND = referentiels.pass.plafondGlobalNiches       // 10 000 (art. 200-0 A CGI)
const PLAFOND_MAJORE = referentiels.pass.plafondMajoreNiches // 18 000 (outre-mer / Sofica)

// ─── (a,b,c) Fonction pure appliquerReductionsIR ──────────────────────────────
describe("appliquerReductionsIR — socle pur", () => {
  it("(a) liste vide -> impôt strictement inchangé, no-op", () => {
    const r = appliquerReductionsIR(7435.99, [], PLAFOND, PLAFOND_MAJORE)
    expect(r.impotFinal).toBe(7435.99) // à l'identique (même valeur, pas d'arrondi)
    expect(r.totalImpute).toBe(0)
    expect(r.detail).toEqual([])
  })

  it("(b) réduction > impôt -> impôtFinal 0, fraction perdue tracée (pas de report)", () => {
    const r = appliquerReductionsIR(100, [red("x", 150)], PLAFOND, PLAFOND_MAJORE)
    expect(r.impotFinal).toBe(0)
    expect(r.totalImpute).toBe(100)
    expect(r.detail).toEqual([{ id: "x", montant: 150, impute: 100 }])
    // fraction perdue = montant déclaré - montant imputé (aucun report)
    expect(r.detail[0].montant - r.detail[0].impute).toBe(50)
  })

  it("(c) deux réductions -> imputation ordonnée et bornée à l'impôt restant", () => {
    const r = appliquerReductionsIR(300, [red("a", 200), red("b", 250)], PLAFOND, PLAFOND_MAJORE)
    // a impute 200 (reste 100) ; b borné à min(250, 100) = 100 (reste 0)
    expect(r.detail).toEqual([
      { id: "a", montant: 200, impute: 200 },
      { id: "b", montant: 250, impute: 100 },
    ])
    expect(r.impotFinal).toBe(0)
    expect(r.totalImpute).toBe(300)
  })

  it("(c-bis) deux réductions qui tiennent -> imputation totale, ordre préservé", () => {
    const r = appliquerReductionsIR(1000, [red("a", 200), red("b", 250)], PLAFOND, PLAFOND_MAJORE)
    expect(r.impotFinal).toBe(550)
    expect(r.totalImpute).toBe(450)
    expect(r.detail.map(d => d.impute)).toEqual([200, 250])
  })

  it("(c-ter) défensif : montant négatif ignoré, impôt négatif borné à 0", () => {
    expect(appliquerReductionsIR(1000, [red("neg", -50)], PLAFOND, PLAFOND_MAJORE).impotFinal).toBe(1000)
    expect(appliquerReductionsIR(-5, [red("x", 10)], PLAFOND, PLAFOND_MAJORE).impotFinal).toBe(0)
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
// Enveloppe 'commun' (10 000 €) ACTIVE via les dispositifs immobiliers. On teste
// la fonction pure sur l'enveloppe commune (ex-`true` -> 'commun'), plus le verrou
// ISO au niveau computeIR (le forfait reste hors plafond). L'enveloppe 'majore'
// (18 000 €) est couverte par le LOT 0 ci-dessous.
describe("appliquerReductionsIR — plafonnement global des niches (200-0 A)", () => {
  it("(a) plafonnables cumulant 12 000 -> 10 000 imputés max, écrêtement 2000", () => {
    const r = appliquerReductionsIR(50000, [redP("a", 7000), redP("b", 5000)], PLAFOND, PLAFOND_MAJORE)
    expect(r.totalPlafonnableAvantEcretement).toBe(12000)
    expect(r.ecretementNiches).toBe(2000)
    expect(r.totalImpute).toBe(10000)   // impôt large -> tout l'écrêté s'impute
    expect(r.impotFinal).toBe(40000)
    expect(r.perduFauteImpot).toBe(0)
  })

  it("(b) mix forfait (hors plafond) + plafonnable 11 000 -> forfait plein, plafonnable écrêté à 10 000", () => {
    const r = appliquerReductionsIR(50000, [red("forfait_scolaire", 336), redP("pinel", 11000)], PLAFOND, PLAFOND_MAJORE)
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
    const r = appliquerReductionsIR(50000, [redP("a", 9999)], PLAFOND, PLAFOND_MAJORE)
    expect(r.totalPlafonnableAvantEcretement).toBe(9999)
    expect(r.ecretementNiches).toBe(0)
    expect(r.totalImpute).toBe(9999)
  })

  it("(d) écrêtement PUIS borne d'impôt : plafonnable 12 000, impôt 4 000 -> impute 4000, écrêtement 2000, faute d'impôt 6000", () => {
    const r = appliquerReductionsIR(4000, [redP("a", 12000)], PLAFOND, PLAFOND_MAJORE)
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

// ─── LOT 0 — Socle défiscalisation ─────────────────────────────────────────────
// MOD1 : assiette d'imputation = BARÈME seul (art. 197-I-5). La fonction ne voit
// QUE le barème ; PFU/PS/rachat AV sont ajoutés APRÈS par l'appelant (computeIR).
describe("appliquerReductionsIR — assiette barème seul (MOD1, art. 197-I-5)", () => {
  it("(A1) barème 3000, PFU 5000, réduction 'commun' 4000 -> imputée 3000, perdu 1000, finalIR 5000", () => {
    const PFU = 5000 // ajouté APRÈS imputation par l'appelant, hors périmètre de la réduction
    const r = appliquerReductionsIR(3000, [redP("ir_pme", 4000)], PLAFOND, PLAFOND_MAJORE)
    expect(r.totalImpute).toBe(3000)          // borné au barème, PAS à barème+PFU
    expect(r.perduFauteImpot).toBe(1000)      // 4000 retenu - 3000 imputé (aucun report)
    expect(r.impotFinal).toBe(0)              // barème résiduel
    expect(r.impotFinal + PFU).toBe(5000)     // ancien moteur : 4000 -> ce test CASSE si on régresse
  })

  it("(A2) barème 10000, PFU 0, réduction 4000 -> finalIR 6000 (non-régression)", () => {
    const r = appliquerReductionsIR(10000, [redP("x", 4000)], PLAFOND, PLAFOND_MAJORE)
    expect(r.impotFinal).toBe(6000)
    expect(r.impotFinal + 0).toBe(6000)
  })
})

// MOD2 : double enveloppe 200-0 A. Barème 60 000 (suffisant pour tout imputer) =>
// isole l'effet ENVELOPPE de l'effet borne d'impôt.
describe("appliquerReductionsIR — double enveloppe 200-0 A (MOD2)", () => {
  const BAREME = 60000
  it("(B1) communs 12000 + majoré 8640 -> communs 10000, majoré 8000, écrêté total 2640", () => {
    const r = appliquerReductionsIR(BAREME, [redP("c", 12000), redM("m", 8640)], PLAFOND, PLAFOND_MAJORE)
    expect(r.detail[0].impute).toBeCloseTo(10000, 6) // commun écrêté à 10 000
    expect(r.detail[1].impute).toBeCloseTo(8000, 6)  // majoré : 18 000 - 10 000 = 8 000
    expect(r.ecretementNiches).toBeCloseTo(2640, 6)  // 2000 (commun) + 640 (majoré)
    expect(r.totalImpute).toBeCloseTo(18000, 6)
  })

  it("(B2) communs 4000 + majoré 8640 -> rien d'écrêté (total 12640 <= 18000)", () => {
    const r = appliquerReductionsIR(BAREME, [redP("c", 4000), redM("m", 8640)], PLAFOND, PLAFOND_MAJORE)
    expect(r.detail[0].impute).toBeCloseTo(4000, 6)
    expect(r.detail[1].impute).toBeCloseTo(8640, 6)
    expect(r.ecretementNiches).toBeCloseTo(0, 6)
    expect(r.totalImpute).toBeCloseTo(12640, 6)
  })

  it("(B3) majoré seul brut 40909, fractionPlafond 0.44 -> fraction 17999.96, rien d'écrêté, retenu 40909", () => {
    const r = appliquerReductionsIR(BAREME, [redM("m", 40909, 0.44)], PLAFOND, PLAFOND_MAJORE)
    expect(r.detail[0].impute).toBeCloseTo(40909, 2) // 40909×0.44 = 17999,96 < 18000
    expect(r.ecretementNiches).toBeCloseTo(0, 2)
  })

  it("(B4) majoré seul brut 45000, fractionPlafond 0.44 -> fraction 19800, écrêté 1800 (fraction), retenu brut 40909.09", () => {
    const r = appliquerReductionsIR(BAREME, [redM("m", 45000, 0.44)], PLAFOND, PLAFOND_MAJORE)
    // 45000×0.44 = 19800 ; plafond 18000 ; écrêté 1800 en fraction -> 1800/0.44 = 4090,91 brut
    expect(r.detail[0].impute).toBeCloseTo(40909.09, 2) // 18000/0.44
    expect(r.ecretementNiches).toBeCloseTo(4090.91, 2)  // 45000 - 40909,09 (brut perdu)
  })

  it("(B5) réduction false + communs saturés 10000 -> la false s'impute en entier sans consommer d'enveloppe", () => {
    const r = appliquerReductionsIR(BAREME, [red("emploi_domicile", 3000), redP("c", 12000)], PLAFOND, PLAFOND_MAJORE)
    expect(r.detail[0].impute).toBeCloseTo(3000, 6)                  // false : imputée intégralement
    expect(r.detail[1].impute).toBeCloseTo(10000, 6)                // commun écrêté à 10 000
    expect(r.totalPlafonnableAvantEcretement).toBeCloseTo(12000, 6) // la false NE consomme PAS l'enveloppe
    expect(r.ecretementNiches).toBeCloseTo(2000, 6)
  })
})
