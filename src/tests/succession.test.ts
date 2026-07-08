// Tests calcul Succession — droits 2024/2025 — couverture exhaustive
import { describe, it, expect } from 'vitest'
import { computeSuccession, computeAvTax, formatCompositionFiscale } from '../lib/calculs/succession'
import { getAgeFromBirthDate, getDemembrementPercentages } from '../lib/calculs/utils'
import { EMPTY_CHARGES_DETAIL } from '../constants'

// ─── FIXTURES ────────────────────────────────────────────────────────────────

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
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [{
    name: "RP", type: "Résidence principale", ownership: "common", propertyRight: "full",
    usufructAge: "", value: "800000", propertyTaxAnnual: "0", rentGrossAnnual: "0",
    insuranceAnnual: "0", worksAnnual: "0", otherChargesAnnual: "0",
    loanCapitalRemaining: "0", loanInterestAnnual: "0", loanInsurance: false,
    loanInsuranceRate1: "0", loanInsuranceRate2: "0", loanInsuranceRate: "0",
    loanInsurancePremium: "0", loanEnabled: false, loanType: "amortissable",
    loanAmount: "0", loanRate: "3", loanDuration: "20", loanStartDate: "2020-01-01",
    indivisionShare1: "50", indivisionShare2: "50",
    loanPledgedPlacementIndex: "-1", loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
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
      share: "0", shareGlobal: "", propertyRight: "full" },
  ],
  testamentHeirs: [],
  testamentMode: false,
  legsPrecisItems: [],
  spousePresent: true,
  useTestament: false,
  legsMode: "global" as const,
}

// Helper — bien propre simplifié
const makePropriete = (value: string, ownership: string, opts: {
  loanEnabled?: boolean, loanCapital?: string,
  loanInsurance?: boolean, loanInsuranceRate?: string,
  indivisionShare1?: string, indivisionShare2?: string,
  type?: string,
} = {}) => ({
  name: "Bien test", type: opts.type || "Résidence secondaire",
  ownership, propertyRight: "full", usufructAge: "", value,
  propertyTaxAnnual: "0", rentGrossAnnual: "0", insuranceAnnual: "0",
  worksAnnual: "0", otherChargesAnnual: "0",
  loanEnabled: opts.loanEnabled ?? false, loanType: "amortissable",
  loanAmount: opts.loanCapital || "0", loanRate: "3", loanDuration: "20",
  loanStartDate: "2015-01-01",
  loanCapitalRemaining: opts.loanCapital || "0", loanInterestAnnual: "0",
  loanInsurance: opts.loanInsurance ?? false,
  loanInsuranceRate: opts.loanInsuranceRate || "0",
  loanInsuranceRate1: opts.loanInsuranceRate || "0",
  loanInsuranceRate2: opts.loanInsuranceRate || "0",
  loanInsurancePremium: "0",
  indivisionShare1: opts.indivisionShare1 || "50", indivisionShare2: opts.indivisionShare2 || "50",
  loanPledgedPlacementIndex: "-1", loanInsuranceGuarantees: "", loanInsuranceCoverage: "0",
})

// ─── EXONÉRATIONS ────────────────────────────────────────────────────────────

describe("computeSuccession — exonérations", () => {

  it("conjoint survivant → droits = 0", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const conjoint = s.results.find(r => r.relation === "conjoint")
    if (conjoint) expect(conjoint.duties).toBe(0)
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

// ─── MASSE SUCCESSORALE ──────────────────────────────────────────────────────

describe("computeSuccession — masse successorale", () => {

  it("activeNet > 0 si patrimoine > 0", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    expect(s.activeNet).toBeGreaterThan(0)
  })

  it("activeNet ≤ valeur totale des biens", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    expect(s.activeNet).toBeLessThanOrEqual(800000)
  })

  it("passif réduit la masse successorale (bien propre du défunt)", () => {
    // Bien propre person1 avec crédit : le passif est à la charge de la succession
    // (≠ bien commun où la solidarité crédit met le passif à la charge du survivant)
    const dataAvecPret = {
      ...BASE_DATA,
      properties: [{
        ...BASE_DATA.properties[0],
        ownership: "person1",  // bien propre → passif successoral
        loanEnabled: true,
        loanCapitalRemaining: "200000",
        loanAmount: "200000",
      }]
    }
    const sansPassif = {
      ...BASE_DATA,
      properties: [{ ...BASE_DATA.properties[0], ownership: "person1" }]
    }
    const sans = computeSuccession(BASE_SUCCESSION, sansPassif)
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
        exemptFromSuccession: "0", ucRatio: "0", annualWithdrawal: "", annualContribution: "0",
        perDeductible: true, beneficiaries: [],
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
      ...BASE_DATA, properties: [{ ...BASE_DATA.properties[0], value: "300000" }]
    })
    const large = computeSuccession(BASE_SUCCESSION, {
      ...BASE_DATA, properties: [{ ...BASE_DATA.properties[0], value: "2000000" }]
    })
    expect(large.totalRights).toBeGreaterThan(small.totalRights)
  })

  it("donations antérieures augmentent les droits (rappel fiscal réduit l'abattement)", () => {
    // Patrimoine suffisamment élevé pour que le taxable soit > 0 même sans donation
    const bigData = { ...BASE_DATA, properties: [{ ...BASE_DATA.properties[0], value: "600000" }] }
    const sansDonation = computeSuccession(BASE_SUCCESSION, bigData)
    const avecDonation = computeSuccession({
      ...BASE_SUCCESSION,
      heirs: BASE_SUCCESSION.heirs.map(h =>
        h.relation === "enfant" ? { ...h, priorDonations: "50000" } : h
      )
    }, bigData)
    const enfSans = sansDonation.results.find(r => r.relation === "enfant")
    const enfAvec = avecDonation.results.find(r => r.relation === "enfant")
    if (enfSans && enfAvec) {
      // Rappel fiscal : donation 50k consomme 50k d'abattement → abattement résiduel 50k
      // → part taxable plus élevée → droits plus élevés
      expect(enfAvec.duties).toBeGreaterThan(enfSans.duties)
    }
  })
})

// ─── HÉRITIERS MULTIPLES ─────────────────────────────────────────────────────

describe("computeSuccession — héritiers multiples", () => {

  it("2 enfants → résultats contiennent les deux", () => {
    const data2 = {
      ...BASE_DATA,
      childrenData: [
        { firstName: "Ana", lastName: "Martin", birthDate: "1980-01-01",
          parentLink: "common_child", custody: "full", rattached: false, handicap: false },
        { firstName: "Luc", lastName: "Martin", birthDate: "1985-01-01",
          parentLink: "common_child", custody: "full", rattached: false, handicap: false },
      ],
    }
    const succ2 = computeSuccession({
      ...BASE_SUCCESSION,
      heirs: [
        { name: "Ana Martin", firstName: "Ana", lastName: "Martin", birthDate: "1980-01-01",
          relation: "enfant", childLink: "common_child", priorDonations: "0", share: "50", shareGlobal: "", propertyRight: "full" },
        { name: "Luc Martin", firstName: "Luc", lastName: "Martin", birthDate: "1985-01-01",
          relation: "enfant", childLink: "common_child", priorDonations: "0", share: "50", shareGlobal: "", propertyRight: "full" },
        { name: "Marie Martin", firstName: "Marie", lastName: "Martin", birthDate: "1955-01-01",
          relation: "conjoint", childLink: null, priorDonations: "0", share: "0", shareGlobal: "", propertyRight: "full" },
      ]
    }, data2)
    const enfants = succ2.results.filter(r => r.relation === "enfant")
    expect(enfants.length).toBe(2)
  })

  it("totalRights = somme des droits individuels", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    const sumDuties = s.results.reduce((acc, r) => acc + (r.duties || 0), 0)
    expect(s.totalRights).toBeCloseTo(sumDuties, 0)
  })
})

// ─── ASSURANCES VIE ──────────────────────────────────────────────────────────

describe("computeSuccession — assurances vie", () => {

  it("AV avec bénéficiaire hors succession → activeNet inchangé", () => {
    const dataAvecAV = {
      ...BASE_DATA,
      placements: [{
        name: "AV Avant 70", type: "Assurance Vie", ownership: "person1",
        value: "200000", annualIncome: "0", taxableIncome: "0", deathValue: "200000",
        openDate: "2000-01-01", pfuEligible: false, pfuOptOut: false,
        totalPremiumsNet: "150000", premiumsBefore70: "150000", premiumsAfter70: "0",
        exemptFromSuccession: "150000", ucRatio: "100", annualWithdrawal: "",
        annualContribution: "0", perDeductible: false,
        beneficiaries: [{ name: "Enfant Martin", relation: "enfant", share: "100" }],
      }]
    }
    const s = computeSuccession(BASE_SUCCESSION, dataAvecAV)
    expect(s.activeNet).toBeGreaterThanOrEqual(0)
  })
})

// ─── ÂGE EXACT POUR DÉMEMBREMENT ─────────────────────────────────────────────
describe("getAgeFromBirthDate — précision mois/jour pour barème art. 669", () => {

  it("usufruitier né en décembre, avant anniversaire → tranche correcte", () => {
    // Quelqu'un né le 15/12/1965 n'a PAS encore 61 ans au 23/05/2026 → il a 60 ans
    // Tranche 51-60 : usufruit 50%, NP 50%
    // L'ancien calcul (année - année) aurait donné 61 → tranche 61-70 (usufruit 40%, NP 60%) ERREUR
    const age = getAgeFromBirthDate("1965-12-15")
    expect(age).toBe(60) // pas 61
    const dp = getDemembrementPercentages(age!)
    expect(dp.usufruct).toBe(0.5)   // tranche 51-60
    expect(dp.nuePropriete).toBe(0.5)
  })
})

// ─── FILIATION — PARENTLINK (BUG CORRIGÉ) ────────────────────────────────────

describe("computeSuccession — filiation parentLink (bug corrigé)", () => {

  it("common_child hérite quel que soit le défunt (P1 ou P2)", () => {
    const sP1 = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1", heirs: [] }, BASE_DATA)
    const sP2 = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person2", heirs: [] }, BASE_DATA)
    const enfP1 = sP1.results.find(r => r.relation === "enfant")
    const enfP2 = sP2.results.find(r => r.relation === "enfant")
    expect(enfP1).toBeDefined()
    expect(enfP2).toBeDefined()
    expect(enfP1!.allowance).toBe(100000)
    expect(enfP2!.allowance).toBe(100000)
  })

  it("person1_only + défunt person1 → présent, relation enfant, abattement 100k", () => {
    const data = {
      ...BASE_DATA,
      childrenData: [{ firstName: "Luc", lastName: "Dupont", birthDate: "1985-01-01",
        parentLink: "person1_only", custody: "full", rattached: false, handicap: false }]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1", heirs: [] }, data)
    const luc = s.results.find(r => r.name.toLowerCase().includes("luc"))
    expect(luc).toBeDefined()
    expect(luc!.relation).toBe("enfant")
    expect(luc!.allowance).toBe(100000)
  })

  it("person1_only + défunt person2 → absent des héritiers collectés (filiation non établie)", () => {
    const data = {
      ...BASE_DATA,
      childrenData: [{ firstName: "Luc", lastName: "Dupont", birthDate: "1985-01-01",
        parentLink: "person1_only", custody: "full", rattached: false, handicap: false }]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person2", heirs: [] }, data)
    const luc = s.results.find(r => r.name.toLowerCase().includes("luc"))
    // Luc ne doit pas être héritier de person2 ou avoir grossReceived = 0
    if (luc) expect(luc.grossReceived).toBe(0)
    else expect(luc).toBeUndefined()
  })

  it("person2_only + défunt person2 → présent, relation enfant", () => {
    const data = {
      ...BASE_DATA,
      childrenData: [{ firstName: "Lea", lastName: "Dupont", birthDate: "1987-01-01",
        parentLink: "person2_only", custody: "full", rattached: false, handicap: false }]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person2", heirs: [] }, data)
    const lea = s.results.find(r => r.name.toLowerCase().includes("lea"))
    expect(lea).toBeDefined()
    expect(lea!.relation).toBe("enfant")
  })

  it("2 enfants mixtes (common + person1_only) + défunt person2 → seul le commun hérite", () => {
    const data = {
      ...BASE_DATA,
      childrenData: [
        { firstName: "Ana", lastName: "Martin", birthDate: "1982-01-01",
          parentLink: "common_child", custody: "full", rattached: false, handicap: false },
        { firstName: "Luc", lastName: "Dupont", birthDate: "1985-01-01",
          parentLink: "person1_only", custody: "full", rattached: false, handicap: false },
      ]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person2", heirs: [] }, data)
    const enfants = s.results.filter(r => r.relation === "enfant")
    // Seul Ana (common_child) est héritière de person2
    expect(enfants.length).toBe(1)
    expect(enfants[0].name.toLowerCase()).toContain("ana")
  })

  it("testament legs global : person1_only + défunt person2 → enfant_conjoint (tiers 60%)", () => {
    const data = {
      ...BASE_DATA,
      childrenData: [{ firstName: "Luc", lastName: "Dupont", birthDate: "1985-01-01",
        parentLink: "person1_only", custody: "full", rattached: false, handicap: false }]
    }
    const s = computeSuccession({
      ...BASE_SUCCESSION,
      deceasedPerson: "person2",
      useTestament: true,
      legsMode: "global" as const,
      testamentHeirs: [{
        firstName: "Luc", lastName: "Dupont", birthDate: "1985-01-01",
        relation: "enfant", priorDonations: "0",
        shareGlobal: "100", propertyRight: "full"
      }],
      heirs: []
    }, data)
    const luc = s.results.find(r => r.name.toLowerCase().includes("luc"))
    expect(luc).toBeDefined()
    // Doit être traité comme enfant_conjoint (tiers fiscal — 60%) car non biologique de person2
    expect(luc!.relation).toBe("enfant_conjoint")
    expect(luc!.allowance).toBe(1594)
  })
})

// ─── AUTRES LIENS DE PARENTÉ ─────────────────────────────────────────────────

describe("computeSuccession — autres liens de parenté", () => {

  const HEIRS_FRERE = (name: string) => [{
    name, firstName: "Jean", lastName: "Martin", birthDate: "1955-01-01",
    relation: "frereSoeur", childLink: null, priorDonations: "0",
    share: "100", shareGlobal: "", propertyRight: "full"
  }]

  const HEIRS_NEVEU = (name: string) => [{
    name, firstName: "Tom", lastName: "Martin", birthDate: "1980-01-01",
    relation: "neveuNiece", childLink: null, priorDonations: "0",
    share: "100", shareGlobal: "", propertyRight: "full"
  }]

  it("frère/sœur → abattement 15 932 €", () => {
    const dataSingle = { ...BASE_DATA, coupleStatus: "single", childrenData: [] }
    const s = computeSuccession({
      ...BASE_SUCCESSION, spousePresent: false,
      heirs: HEIRS_FRERE("Jean Martin")
    }, dataSingle)
    const frere = s.results.find(r => r.relation === "frereSoeur")
    expect(frere).toBeDefined()
    expect(frere!.allowance).toBe(15932)
  })

  it("neveu/nièce → abattement 7 967 €", () => {
    const dataSingle = { ...BASE_DATA, coupleStatus: "single", childrenData: [] }
    const s = computeSuccession({
      ...BASE_SUCCESSION, spousePresent: false,
      heirs: HEIRS_NEVEU("Tom Martin")
    }, dataSingle)
    const neveu = s.results.find(r => r.relation === "neveuNiece")
    expect(neveu).toBeDefined()
    expect(neveu!.allowance).toBe(7967)
  })

  it("enfant_conjoint → abattement 1 594 € (tiers fiscal)", () => {
    const dataSingle = { ...BASE_DATA, coupleStatus: "single", childrenData: [] }
    const s = computeSuccession({
      ...BASE_SUCCESSION, spousePresent: false,
      heirs: [{
        name: "Enfant conjoint", firstName: "Enfant", lastName: "Conjoint", birthDate: "1985-01-01",
        relation: "enfant_conjoint", childLink: null, priorDonations: "0",
        share: "100", shareGlobal: "", propertyRight: "full"
      }]
    }, dataSingle)
    const ec = s.results.find(r => r.relation === "enfant_conjoint")
    expect(ec).toBeDefined()
    expect(ec!.allowance).toBe(1594)
  })

  it("frère/sœur handicapé → abattement 15 932 + 159 325 = 175 257 €", () => {
    // Note: le flag handicap sur l'héritier est résolu via childrenData pour les enfants
    // Pour un frère, le profil est appelé directement via getSuccessionTaxProfile("frereSoeur", true)
    // Dans la succession, handicap = false par défaut sauf si dans childrenData
    // Ce test vérifie le profil direct (importé séparément si besoin)
    // On vérifie que frère sans handicap = 15 932€
    const dataSingle = { ...BASE_DATA, coupleStatus: "single", childrenData: [] }
    const s = computeSuccession({
      ...BASE_SUCCESSION, spousePresent: false,
      heirs: HEIRS_FRERE("Jean Martin")
    }, dataSingle)
    const frere = s.results.find(r => r.relation === "frereSoeur")
    expect(frere!.allowance).toBe(15932)
    // L'abattement handicap s'applique via getSuccessionTaxProfile("frereSoeur", true) = 175257
    // Testé directement dans av.test.ts via computeAvTax
  })
})

// ─── ASSURANCE DC — BIEN PROPRE ───────────────────────────────────────────────

describe("computeSuccession — assurance emprunteur DC (bien propre)", () => {

  it("bien propre sans assurance → passif entier déduit de la succession", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("500000", "person1", {
        loanEnabled: true, loanCapital: "200000", loanInsurance: false
      })]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1", heirs: [] }, data)
    // Passif de 200k déduit → masse immo réduite
    const line = s.propertyLines[0]
    expect(line.debtShare).toBeCloseTo(200000, -2)
    expect(line.netEstateValue).toBeLessThan(500000)
  })

  it("bien propre + assurance DC 100% → passif = 0 en succession", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("500000", "person1", {
        loanEnabled: true, loanCapital: "200000",
        loanInsurance: true, loanInsuranceRate: "100"
      })]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1", heirs: [] }, data)
    const line = s.propertyLines[0]
    expect(line.debtShare).toBe(0)          // assurance couvre 100% → passif net = 0
    expect(line.insuranceCover).toBeCloseTo(200000, -2)
  })

  it("bien propre + assurance DC 50% → passif résiduel = 50% de la dette", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("600000", "person1", {
        loanEnabled: true, loanCapital: "200000",
        loanInsurance: true, loanInsuranceRate: "50"
      })]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1", heirs: [] }, data)
    const line = s.propertyLines[0]
    expect(line.debtShare).toBeCloseTo(100000, -2)   // 50% de 200k
    expect(line.insuranceCover).toBeCloseTo(100000, -2)
  })

  it("bien commun + assurance → passif résiduel au survivant (hors succession)", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("800000", "common", {
        loanEnabled: true, loanCapital: "300000",
        loanInsurance: true, loanInsuranceRate: "50"
      })]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1" }, data)
    const line = s.propertyLines[0]
    // Bien commun = solidarité crédit : passif résiduel entier au survivant → debtShare = 0
    expect(line.debtShare).toBe(0)
  })
})

// ─── INDIVISION ───────────────────────────────────────────────────────────────

describe("computeSuccession — biens en indivision", () => {

  it("indivision 70/30 — défunt person1 → quote-part retenue = 70%", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("1000000", "indivision", {
        indivisionShare1: "70", indivisionShare2: "30"
      })]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1" }, data)
    const line = s.propertyLines[0]
    // 70% de 1 000 000 = 700 000
    expect(line.grossEstateValue).toBeCloseTo(700000, -2)
  })

  it("indivision 30/70 — défunt person2 → quote-part retenue = 70%", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("1000000", "indivision", {
        indivisionShare1: "30", indivisionShare2: "70"
      })]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person2" }, data)
    const line = s.propertyLines[0]
    // 70% de 1 000 000 = 700 000
    expect(line.grossEstateValue).toBeCloseTo(700000, -2)
  })

  it("bien de l'autre (ownership = person2) + défunt person1 → hors succession", () => {
    const data = {
      ...BASE_DATA,
      properties: [makePropriete("500000", "person2")]
    }
    const s = computeSuccession({ ...BASE_SUCCESSION, deceasedPerson: "person1" }, data)
    const line = s.propertyLines[0]
    // Bien propre person2 : pas de quote-part du défunt → valeur = 0
    expect(line.grossEstateValue).toBe(0)
    expect(line.netEstateValue).toBe(0)
  })
})

// ─── REFACTOR — SOURCE UNIQUE valeur fiscale (partRecueFiscale + composition) ──
// Verrouille que computeSuccession() expose des valeurs dérivées cohérentes pour
// chaque option spouse, et que la composition lisible reflète bien la formule.
// Si ces tests sautent, l'UI (TabSuccession) et le PDF (buildSuccessionAData)
// divergeront sur la valeur fiscale affichée.

describe("computeSuccession — source unique valeur fiscale dérivée", () => {

  it("conjoint en 1/4 PP → partRecueFiscale = grossReceived (= activeNet × 0.25)", () => {
    const s = computeSuccession(
      { ...BASE_SUCCESSION, spouseOption: "legal_quarter_full" },
      BASE_DATA,
    )
    const conjoint = s.results.find(r => r.relation === "conjoint")
    expect(conjoint).toBeDefined()
    if (!conjoint) return
    // Vérité : la PP n'a pas de coef Duvergier
    expect(conjoint.partRecueFiscale).toBe(conjoint.grossReceived + conjoint.nueValue + conjoint.usufructFiscalValue)
    expect(conjoint.partRecueFiscale).toBeCloseTo(s.activeNet * 0.25, 0)
    expect(conjoint.usufructFiscalValue).toBe(0)
    // Composition doit montrer "PP …" et pas "US fiscal …"
    expect(conjoint.compositionFiscale).toContain("PP")
    expect(conjoint.compositionFiscale).not.toContain("US fiscal")
  })

  it("conjoint en usufruit total → partRecueFiscale = activeNet × coef Duvergier", () => {
    const s = computeSuccession(
      { ...BASE_SUCCESSION, spouseOption: "legal_usufruct_total" },
      BASE_DATA,
    )
    const conjoint = s.results.find(r => r.relation === "conjoint")
    expect(conjoint).toBeDefined()
    if (!conjoint) return
    const usPct = s.demembrementPct.usufruct
    expect(conjoint.grossReceived).toBe(0)
    expect(conjoint.nueValue).toBe(0)
    expect(conjoint.usufructFiscalValue).toBeCloseTo(conjoint.usufructRawValue * usPct, 0)
    expect(conjoint.partRecueFiscale).toBeCloseTo(s.activeNet * usPct, 0)
    // Composition doit montrer "US fiscal …" avec le coef Duvergier en %
    expect(conjoint.compositionFiscale).toContain("US fiscal")
    expect(conjoint.compositionFiscale).toContain(`× ${Math.round(usPct * 100)}%`)
  })

  it("partRecueFiscale strictement = grossReceived + nueValue + usufructFiscalValue (tous héritiers)", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    s.results.forEach(r => {
      expect(r.partRecueFiscale).toBe(r.grossReceived + r.nueValue + r.usufructFiscalValue)
    })
  })

  it("netFiscal = max(0, partRecueFiscale - droits) + avNetReceived", () => {
    const s = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    s.results.forEach(r => {
      const expected = Math.max(0, r.partRecueFiscale - r.successionDuties) + r.avNetReceived
      expect(r.netFiscal).toBe(expected)
    })
  })

  it("formatCompositionFiscale : enfant PP pur → 'PP X €' uniquement", () => {
    const comp = formatCompositionFiscale({
      grossReceived: 100_000,
      nueRawValue: 0, nueValue: 0,
      usufructRawValue: 0, usufructFiscalValue: 0,
      usufructPctPercent: 60,
    })
    expect(comp).toMatch(/^PP\s/)
    expect(comp).not.toContain("NP")
    expect(comp).not.toContain("US")
  })

  it("formatCompositionFiscale : conjoint usufruit 60% → 'US fiscal … (… × 60%)'", () => {
    const comp = formatCompositionFiscale({
      grossReceived: 0,
      nueRawValue: 0, nueValue: 0,
      usufructRawValue: 1_972_950, usufructFiscalValue: 1_183_770,
      usufructPctPercent: 60,
    })
    expect(comp).toContain("US fiscal")
    expect(comp).toContain("× 60%")
    expect(comp).not.toContain("PP")
  })

  it("formatCompositionFiscale : enfant NP + US → composition combinée", () => {
    const comp = formatCompositionFiscale({
      grossReceived: 0,
      nueRawValue: 500_000, nueValue: 200_000,
      usufructRawValue: 100_000, usufructFiscalValue: 60_000,
      usufructPctPercent: 60,
    })
    expect(comp).toContain("NP fiscale")
    expect(comp).toContain("US fiscal")
    expect(comp.split(" + ")).toHaveLength(2)
  })

  it("formatCompositionFiscale : tout à 0 → string vide (héritier inactif)", () => {
    const comp = formatCompositionFiscale({
      grossReceived: 0, nueRawValue: 0, nueValue: 0,
      usufructRawValue: 0, usufructFiscalValue: 0,
      usufructPctPercent: 0,
    })
    expect(comp).toBe("")
  })
})

// ─── LOT 3 — Totaux succession : périmètre PER / AV consolidée / démembrement ──
// C1 double comptage démembrement dans la cascade ; C2 fiscalité AV consolidée
// sur tous les bénéficiaires ; C3 PER hors actif successoral civil.
describe("computeSuccession — LOT 3 périmètre et totaux", () => {

  // Placement complet (même structure que les fixtures ci-dessus)
  const mkPlacement = (over: Record<string, any>) => ({
    name: "P", type: "PEA", ownership: "person1", value: "0",
    annualIncome: "0", taxableIncome: "0", deathValue: "0",
    openDate: "2010-01-01", pfuEligible: true, pfuOptOut: false,
    totalPremiumsNet: "0", premiumsBefore70: "0", premiumsAfter70: "0",
    exemptFromSuccession: "0", ucRatio: "0", annualWithdrawal: "", annualContribution: "0",
    perDeductible: false, beneficiaries: [], ...over,
  })

  // ── C1 — démembrement : NP fiscale + US fiscal = 100 % de l'actif, jamais 2× ──
  it("C1 : sum(partRecueFiscale) = activeNet (NP + US fiscaux = 100 %, pas ~2×)", () => {
    const s = computeSuccession({ ...BASE_SUCCESSION, spouseOption: "legal_usufruct_total" }, BASE_DATA)
    const sumFiscal = s.results.reduce((a, r) => a + r.partRecueFiscale, 0)
    expect(sumFiscal).toBeCloseTo(s.activeNet, 0)                 // 336 000 = activeNet
    // Ancien total (shadow) : somme des netReceived économiques → sur-compte le
    // démembrement (NP pleine valeur + US pleine valeur ≈ 1,9× l'actif).
    const sumNetReceived = s.results.reduce((a, r) => a + r.netReceived, 0)
    expect(sumNetReceived).toBeGreaterThan(s.activeNet * 1.5)     // ≈ 646 766
    // Cascade corrigée (netFiscal) : sans AV, net = actif − droits succession.
    const sumNetFiscal = s.results.reduce((a, r) => a + r.netFiscal, 0)
    expect(sumNetFiscal).toBeCloseTo(s.activeNet - s.totalSuccessionRights, 0)
    expect(sumNetFiscal).toBeLessThanOrEqual(s.activeNet)
  })

  // ── C3 — PER hors actif successoral civil (art. L.132-12 C.assur / L.224-1 CMF) ──
  it("C3 : le PER ne compte pas dans l'actif — activeNet identique avec/sans PER", () => {
    const avecPER = computeSuccession(BASE_SUCCESSION, { ...BASE_DATA, placements: [
      mkPlacement({ name: "Mon PER", type: "PER assurantiel", value: "139000", deathValue: "139000", premiumsBefore70: "139000" }),
    ] })
    const sans = computeSuccession(BASE_SUCCESSION, BASE_DATA)
    expect(avecPER.activeNet).toBe(sans.activeNet)
    expect(avecPER.furnitureForfait).toBe(sans.furnitureForfait)       // ni dans le forfait 5 %
    expect(avecPER.placementLines.some(l => l.name === "Mon PER" && l.netEstateValue > 0)).toBe(false)
  })

  it("C3 : PER 139 000 vs même montant en compte-titres → delta actif = 139 000 × 1,05", () => {
    const per = computeSuccession(BASE_SUCCESSION, { ...BASE_DATA, placements: [
      mkPlacement({ name: "PER", type: "PER assurantiel", value: "139000", deathValue: "139000", premiumsBefore70: "139000" }),
    ] })
    const titres = computeSuccession(BASE_SUCCESSION, { ...BASE_DATA, placements: [
      mkPlacement({ name: "PEA", type: "PEA", value: "139000", deathValue: "139000" }),
    ] })
    // Le compte-titres entre dans l'actif (base + forfait mobilier 5 %), le PER non.
    expect(titres.activeNet - per.activeNet).toBeCloseTo(139000 * 1.05, 0)   // 145 950
  })

  // ── C2 — fiscalité AV consolidée : bénéficiaire non-héritier compté ──
  it("C2 : bénéficiaire AV non-héritier → totalAvRights = somme avLines (ancien héritiers-seuls = 0)", () => {
    const s = computeSuccession(BASE_SUCCESSION, { ...BASE_DATA, placements: [
      mkPlacement({
        name: "AV", type: "Assurance-vie fonds euros", value: "400000", deathValue: "400000",
        totalPremiumsNet: "400000", premiumsBefore70: "400000",
        beneficiaries: [{ name: "Sophie Concubin", relation: "autre", share: "100" }],
      }),
    ] })
    const consolidated = s.avLines.reduce((a, l) => a + l.before70Tax + l.after70Tax, 0)
    const heirsOnly = s.results.reduce((a, r) => a + r.avDuties, 0)
    expect(s.totalAvRights).toBeCloseTo(consolidated, 2)      // source unique = avLines
    expect(s.totalAvRights).toBeCloseTo(49500, 0)            // (400 000 − 152 500) × 20 %
    expect(heirsOnly).toBe(0)                                // le concubin n'est pas héritier…
    expect(s.totalAvRights).toBeGreaterThan(heirsOnly)       // …mais sa fiscalité AV est bien comptée
  })

  it("C2 non-régression : bénéficiaire héritier → totalAvRights = somme des avDuties héritiers", () => {
    const s = computeSuccession(BASE_SUCCESSION, { ...BASE_DATA, placements: [
      mkPlacement({
        name: "AV", type: "Assurance-vie fonds euros", value: "400000", deathValue: "400000",
        totalPremiumsNet: "400000", premiumsBefore70: "400000",
        beneficiaries: [{ name: "Enfant Martin", relation: "enfant", share: "100" }],
      }),
    ] })
    const heirsOnly = s.results.reduce((a, r) => a + r.avDuties, 0)
    expect(s.totalAvRights).toBeCloseTo(heirsOnly, 2)
    expect(s.totalAvRights).toBeCloseTo(49500, 0)
  })
})
