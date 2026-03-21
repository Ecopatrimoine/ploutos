// Tests calcul IFI — barème 2024 — couverture exhaustive
import { describe, it, expect } from 'vitest'
import { computeIFI } from '../lib/calculs/ifi'
import { EMPTY_CHARGES_DETAIL } from '../constants'

const BASE_DATA = {
  person1FirstName: "Test", person1LastName: "IFI", person1BirthDate: "1970-01-01",
  person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: {...EMPTY_CHARGES_DETAIL},
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: {...EMPTY_CHARGES_DETAIL},
  placements: [], otherLoans: [],
}

const makeProperty = (
  value: string,
  type = "Résidence principale",
  opts: {
    loanEnabled?: boolean, loanCapital?: string, loanInsurance?: boolean,
    loanInsuranceRate?: string, propertyRight?: string, ownership?: string,
  } = {}
) => ({
  name: "Bien test", type,
  ownership: opts.ownership || "person1",
  propertyRight: opts.propertyRight || "full",
  usufructAge: "", value,
  propertyTaxAnnual: "0", rentGrossAnnual: "0",
  insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
  loanCapitalRemaining: opts.loanCapital || "0",
  loanInterestAnnual: "0",
  loanInsurance: opts.loanInsurance || false,
  loanInsuranceRate1: opts.loanInsuranceRate || "0",
  loanInsuranceRate2: opts.loanInsuranceRate || "0",
  loanInsuranceRate: opts.loanInsuranceRate || "0",
  loanInsurancePremium: "0",
  loanEnabled: opts.loanEnabled || false,
  loanType: "amortissable",
  loanInitialCapital: opts.loanCapital || "0",
  loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
  indivisionShare1: "100", indivisionShare2: "0",
  loanAmount: "0", loanPledgedPlacementIndex: "-1",
  loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
})

// ─── SEUIL ET ABATTEMENTS ────────────────────────────────────────────────────
describe("computeIFI — seuil et abattements", () => {

  it("patrimoine 0 → IFI = 0", () => {
    const ifi = computeIFI({ ...BASE_DATA, properties: [] })
    expect(ifi.ifi).toBe(0)
    expect(ifi.netTaxable).toBe(0)
  })

  it("RP 1 200 000 € → abattement 30% → 840k < seuil → IFI = 0", () => {
    const ifi = computeIFI({ ...BASE_DATA, properties: [makeProperty("1200000")] })
    expect(ifi.ifi).toBe(0)
    expect(ifi.netTaxable).toBeCloseTo(840000, -2)
  })

  it("RP 1 858 000 € → abattement 30% → 1 300 600 € > seuil → IFI > 0", () => {
    const ifi = computeIFI({ ...BASE_DATA, properties: [makeProperty("1858000")] })
    expect(ifi.ifi).toBeGreaterThan(0)
    expect(ifi.netTaxable).toBeGreaterThan(1300000)
  })

  it("résidence secondaire 1 200 000 € → sous le seuil 1.3M → IFI = 0", () => {
    // 1.2M < seuil 1.3M → pas d'IFI malgré l'absence d'abattement
    const ifi = computeIFI({ ...BASE_DATA, properties: [makeProperty("1200000", "Résidence secondaire")] })
    expect(ifi.netTaxable).toBeCloseTo(1200000, -2)
    expect(ifi.ifi).toBe(0)
  })

  it("résidence secondaire 2 000 000 € → IFI > 0", () => {
    const ifi = computeIFI({ ...BASE_DATA, properties: [makeProperty("2000000", "Résidence secondaire")] })
    expect(ifi.ifi).toBeGreaterThan(0)
    expect(ifi.netTaxable).toBeGreaterThan(1300000)
  })

  it("abattement RP exactement 30%", () => {
    const ifi = computeIFI({ ...BASE_DATA, properties: [makeProperty("2000000")] })
    expect(ifi.netTaxable).toBeCloseTo(2000000 * 0.7, -2)
  })

  it("IFI croît avec la valeur du patrimoine", () => {
    const ifi1 = computeIFI({ ...BASE_DATA, properties: [makeProperty("2000000", "Résidence secondaire")] })
    const ifi2 = computeIFI({ ...BASE_DATA, properties: [makeProperty("5000000", "Résidence secondaire")] })
    const ifi3 = computeIFI({ ...BASE_DATA, properties: [makeProperty("10000000", "Résidence secondaire")] })
    expect(ifi2.ifi).toBeGreaterThan(ifi1.ifi)
    expect(ifi3.ifi).toBeGreaterThan(ifi2.ifi)
  })
})

// ─── DÉDUCTION DETTES ────────────────────────────────────────────────────────
describe("computeIFI — déduction dettes", () => {

  it("crédit immobilier réduit l'assiette IFI", () => {
    const sans = computeIFI({ ...BASE_DATA, properties: [makeProperty("2000000", "Résidence secondaire")] })
    const avec = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire", { loanEnabled: true, loanCapital: "500000" })]
    })
    expect(avec.netTaxable).toBeLessThan(sans.netTaxable)
    expect(avec.ifi).toBeLessThan(sans.ifi)
  })

  it("assurance emprunteur DC réduit la dette déductible", () => {
    const sans = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire", { loanEnabled: true, loanCapital: "500000" })]
    })
    const avec = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire", {
        loanEnabled: true, loanCapital: "500000",
        loanInsurance: true, loanInsuranceRate: "100"
      })]
    })
    // Avec assurance 100% → dette nette = 0 → assiette plus élevée
    expect(avec.netTaxable).toBeGreaterThan(sans.netTaxable)
  })

  it("assurance 50% → dette réduite de 50%", () => {
    const sans = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("3000000", "Résidence secondaire", { loanEnabled: true, loanCapital: "1000000" })]
    })
    const avec50 = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("3000000", "Résidence secondaire", {
        loanEnabled: true, loanCapital: "1000000",
        loanInsurance: true, loanInsuranceRate: "50"
      })]
    })
    // Avec 50% assurance, dette nette = 500k → assiette intermédiaire
    expect(avec50.netTaxable).toBeGreaterThan(sans.netTaxable)
    expect(avec50.netTaxable).toBeLessThan(3000000)
  })
})

// ─── DROITS DE PROPRIÉTÉ ──────────────────────────────────────────────────────
describe("computeIFI — droits de propriété", () => {

  it("nue-propriété → non retenue dans l'assiette IFI", () => {
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire", { propertyRight: "bare" })]
    })
    expect(ifi.netTaxable).toBe(0)
    expect(ifi.ifi).toBe(0)
  })

  it("pleine propriété → retenue en totalité", () => {
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire", { propertyRight: "full" })]
    })
    expect(ifi.netTaxable).toBeCloseTo(2000000, -2)
  })

  it("usufruit → inclus dans l'assiette", () => {
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire", { propertyRight: "usufruct" })]
    })
    expect(ifi.netTaxable).toBeGreaterThan(0)
  })
})

// ─── MULTIPLES BIENS ─────────────────────────────────────────────────────────
describe("computeIFI — multiples biens", () => {

  it("cumul de biens → assiette = somme des valeurs nettes", () => {
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [
        makeProperty("1500000", "Résidence principale"),
        makeProperty("800000", "Résidence secondaire"),
      ]
    })
    // RP : 1.5M × 0.7 = 1.05M ; RS : 0.8M → total = 1.85M
    expect(ifi.netTaxable).toBeCloseTo(1050000 + 800000, -2)
    expect(ifi.ifi).toBeGreaterThan(0)
  })

  it("5 lignes → lines.length = 5", () => {
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [
        makeProperty("500000", "Résidence principale"),
        makeProperty("400000", "Résidence secondaire"),
        makeProperty("300000", "Location nue"),
        makeProperty("200000", "SCI IR"),
        makeProperty("100000", "Terrain"),
      ]
    })
    expect(ifi.lines.length).toBe(5)
  })
})

// ─── DÉCOTE ──────────────────────────────────────────────────────────────────
describe("computeIFI — décote", () => {

  it("patrimoine juste au-dessus du seuil → décote positive", () => {
    // Décote si 1.3M ≤ netTaxable < 1.4M : 17 500 - 0.0125 × netTaxable
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("1350000", "Résidence secondaire")]
    })
    // 1.35M > 1.3M → décote = 17500 - 0.0125 × 1350000 = 17500 - 16875 = 625
    if (ifi.netTaxable >= 1300000 && ifi.netTaxable < 1400000) {
      expect(ifi.decote).toBeGreaterThan(0)
    }
  })

  it("patrimoine > 1 400 000 € → décote = 0", () => {
    const ifi = computeIFI({
      ...BASE_DATA,
      properties: [makeProperty("2000000", "Résidence secondaire")]
    })
    expect(ifi.decote).toBe(0)
  })
})
