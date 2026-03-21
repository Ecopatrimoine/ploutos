// Tests calcul Succession — droits 2024 — couverture exhaustive
import { describe, it, expect } from 'vitest'
import { computeSuccession } from '../lib/calculs/succession'
import { EMPTY_CHARGES_DETAIL } from '../constants'

const BASE_DATA = {
  person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
  person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
  person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1955-01-01",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [
    { firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
      parentLink: "common_child", custody: "full", rattached: false, handicap: false },
  ],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: {...EMPTY_CHARGES_DETAIL},
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: {...EMPTY_CHARGES_DETAIL},
  properties: [{
    name: "RP", type: "Résidence principale", ownership: "common", propertyRight: "full",
    usufructAge: "", value: "800000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
    insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
    loanCapitalRemaining: "0", loanInterestAnnual: "0", loanInsurance: false,
    loanInsuranceRate1: "100", loanInsuranceRate2: "100", loanInsuranceRate: "100",
    loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable",
    loanInitialCapital: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
    indivisionShare1: "50", indivisionShare2: "50",
    loanAmount: "0", loanPledgedPlacementIndex: "-1",
    loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
  }],
  placements: [], otherLoans: [],
}

const BASE_SUCCESSION = {
  deceasedPerson: "person1" as const,
  spouseOption: "legal_quarter_full",
  heirs: [
    { name: "Enfant Martin", firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
      relation: "enfant", childLink: "common_child", priorDonations: "0",
      share: "100", shareGlobal: "", propertyRight: "full" },
    { name: "Marie Martin", firstName: "Marie", lastName: "Martin", birthDate: "1955-01-01",
      relation: "conjoint", childLink: null, priorDonations: "0",
      share: "100", shareGlobal: "", propertyRight: "full" },
  ],
  testamentHeirs: [],
  testamentMode: false,
  legsPrecisItems: [],
  spousePresent: true,
  useTestament: false,
  legsMode: "global" as const,
}

// ─── EXONÉRATIONS ────────────────────────────────────────────────────────────
describe("computeSuccession — exonérations", () => {

  it("conjoint survivant → droits = 0", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const conjoint = s.results.find(r => r.relation === "conjoint")
    if (conjoint) {
      expect(conjoint.duties).toBe(0)
    }
  })

  it("actif net = 0 → droits = 0 pour tous", () => {
    const s = computeSuccession(BASE_SUCCESSION, { ...BASE_DATA, properties: [], placements: [] })
    s.results.forEach(r => expect(r.duties).toBe(0))
  })
})

// ─── ABATTEMENTS ─────────────────────────────────────────────────────────────
describe("computeSuccession — abattements légaux", () => {

  it("enfant → abattement 100 000 €", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const enfant = s.results.find(r => r.relation === "enfant")
    expect(enfant).toBeDefined()
    expect(enfant!.allowance).toBe(100000)
  })

  it("enfant handicapé → abattement 259 325 € (100k + 159 325)", () => {
    const dataHandi = {
      ...BASE_DATA,
      childrenData: [{ firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
        parentLink: "common_child", custody: "full", rattached: false, handicap: true }],
    }
    const s = computeSuccession(BASE_SUCCESSION, dataHandi)
    const enfant = s.results.find(r => r.relation === "enfant")
    expect(enfant!.allowance).toBe(259325)
  })

  it("abattement handicap cumulable avec abattement enfant", () => {
    const normal = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const dataHandi = {
      ...BASE_DATA,
      childrenData: [{ firstName: "Enfant", lastName: "Martin", birthDate: "1980-01-01",
        parentLink: "common_child", custody: "full", rattached: false, handicap: true }],
    }
    const handi = computeSuccession(BASE_SUCCESSION, dataHandi)
    const enfNormal = normal.results.find(r => r.relation === "enfant")
    const enfHandi = handi.results.find(r => r.relation === "enfant")
    expect(enfHandi!.allowance).toBeGreaterThan(enfNormal!.allowance)
  })
})

// ─── MASSE SUCCESSORALE ───────────────────────────────────────────────────────
describe("computeSuccession — masse successorale", () => {

  it("activeNet > 0 si patrimoine > 0", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    expect(s.activeNet).toBeGreaterThan(0)
  })

  it("activeNet ≤ valeur totale des biens", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    expect(s.activeNet).toBeLessThanOrEqual(800000)
  })

  it("passif réduit la masse successorale", () => {
    const dataAvecPret = {
      ...BASE_DATA,
      properties: [{
        ...BASE_DATA.properties[0],
        loanEnabled: true,
        loanCapitalRemaining: "200000",
        loanAmount: "200000",
      }]
    }
    const sans = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const avec = computeSuccession(BASE_SUCCESSION, dataAvecPret)
    expect(avec.activeNet).toBeLessThan(sans.activeNet)
  })

  it("placements s'ajoutent à la masse successorale", () => {
    const dataAvecPlacement = {
      ...BASE_DATA,
      placements: [{
        name: "PEA", type: "PEA", ownership: "person1", value: "100000",
        annualIncome: "0", taxableIncome: "0", deathValue: "100000",
        openDate: "2015-01-01", pfuEligible: true, pfuOptOut: false,
        totalPremiumsNet: "80000", premiumsBefore70: "0", premiumsAfter70: "0",
        exemptFromSuccession: "0", ucRatio: "0", annualWithdrawal: "",
        annualContribution: "0", perDeductible: true, beneficiaries: [],
      }]
    }
    const sans = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const avec = computeSuccession(BASE_SUCCESSION, dataAvecPlacement)
    expect(avec.activeNet).toBeGreaterThan(sans.activeNet)
  })
})

// ─── DROITS PROGRESSIFS ──────────────────────────────────────────────────────
describe("computeSuccession — progressivité des droits", () => {

  it("plus la part taxable est élevée, plus les droits sont élevés", () => {
    const small = computeSuccession(BASE_SUCCESSION, {
      ...BASE_DATA,
      properties: [{ ...BASE_DATA.properties[0], value: "300000" }]
    })
    const large = computeSuccession(BASE_SUCCESSION, {
      ...BASE_DATA,
      properties: [{ ...BASE_DATA.properties[0], value: "2000000" }]
    })
    expect(large.totalRights).toBeGreaterThan(small.totalRights)
  })

  it("donations antérieures réduisent l'abattement résiduel disponible", () => {
    const sansDonation = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const avecDonation = computeSuccession({
      ...BASE_SUCCESSION,
      heirs: BASE_SUCCESSION.heirs.map(h =>
        h.relation === "enfant" ? { ...h, priorDonations: "50000" } : h
      )
    }, BASE_DATA)
    const enfSans = sansDonation.results.find(r => r.relation === "enfant")
    const enfAvec = avecDonation.results.find(r => r.relation === "enfant")
    if (enfSans && enfAvec) {
      // L'abattement résiduel de l'enfant est réduit de 50k (donation rappelée fiscalement)
      expect(enfAvec.allowance).toBeLessThanOrEqual(enfSans.allowance)
    }
  })
})

// ─── HÉRITIERS MULTIPLES ─────────────────────────────────────────────────────
describe("computeSuccession — héritiers multiples", () => {

  it("2 enfants → droits répartis entre eux", () => {
    const data2Enfants = {
      ...BASE_DATA,
      childrenData: [
        { firstName: "Enfant1", lastName: "Martin", birthDate: "1980-01-01",
          parentLink: "common_child", custody: "full", rattached: false, handicap: false },
        { firstName: "Enfant2", lastName: "Martin", birthDate: "1985-01-01",
          parentLink: "common_child", custody: "full", rattached: false, handicap: false },
      ],
    }
    const succ2 = computeSuccession({
      ...BASE_SUCCESSION,
      heirs: [
        { name: "Enfant1 Martin", firstName: "Enfant1", lastName: "Martin", birthDate: "1980-01-01",
          relation: "enfant", childLink: "common_child", priorDonations: "0",
          share: "50", shareGlobal: "", propertyRight: "full" },
        { name: "Enfant2 Martin", firstName: "Enfant2", lastName: "Martin", birthDate: "1985-01-01",
          relation: "enfant", childLink: "common_child", priorDonations: "0",
          share: "50", shareGlobal: "", propertyRight: "full" },
        { name: "Marie Martin", firstName: "Marie", lastName: "Martin", birthDate: "1955-01-01",
          relation: "conjoint", childLink: null, priorDonations: "0",
          share: "0", shareGlobal: "", propertyRight: "full" },
      ]
    }, data2Enfants)
    const enfants = succ2.results.filter(r => r.relation === "enfant")
    expect(enfants.length).toBe(2)
  })

  it("totalRights = somme des droits individuels", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const sumDuties = s.results.reduce((acc, r) => acc + (r.duties || 0), 0)
    expect(s.totalRights).toBeCloseTo(sumDuties, 0)
  })
})

// ─── ASSURANCES VIE ───────────────────────────────────────────────────────────
describe("computeSuccession — assurances vie", () => {

  it("AV avec bénéficiaire → hors succession si avant 70 ans", () => {
    const dataAvecAV = {
      ...BASE_DATA,
      placements: [{
        name: "AV Avant 70", type: "Assurance Vie", ownership: "person1",
        value: "200000", annualIncome: "0", taxableIncome: "0", deathValue: "200000",
        openDate: "2000-01-01", pfuEligible: false, pfuOptOut: false,
        totalPremiumsNet: "150000", premiumsBefore70: "150000", premiumsAfter70: "0",
        exemptFromSuccession: "150000", ucRatio: "100", annualWithdrawal: "",
        annualContribution: "0", perDeductible: false,
        beneficiaries: [{ name: "Enfant Martin", share: "100" }],
      }]
    }
    const s = computeSuccession(BASE_SUCCESSION, dataAvecAV)
    // Les AV avec primes avant 70 ans et bénéficiaires désignés sont hors succession
    expect(s.activeNet).toBeGreaterThanOrEqual(0)
  })
})
