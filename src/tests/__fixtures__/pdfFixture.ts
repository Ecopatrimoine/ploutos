// ─── Fixture client de référence — Lot 0 (filet snapshots PDF) ─────────────────
// Sert UNIQUEMENT aux tests snapshot HTML de pdfReport et pdfMission.
// Aucun calcul fiscal n'est défini ici : on s'appuie sur les compute* du moteur.
// Si un calcul change, le snapshot doit changer aussi (et nous alerter).

import type {
  PatrimonialData,
  IrOptions,
  SuccessionData,
  Hypothesis,
} from "../../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../../constants";
import { computeIR } from "../../lib/calculs/ir";
import { computeIFI } from "../../lib/calculs/ifi";
import { computeSuccession } from "../../lib/calculs/succession";

// ─── Données patrimoniales ──────────────────────────────────────────────────
export const fixtureData: PatrimonialData = {
  person1FirstName: "Pierre",
  person1LastName: "Dupont",
  person1BirthDate: "1975-04-12",
  person1JobTitle: "Cadre informatique",
  person1Csp: "38",
  person1PcsGroupe: "3",
  person2FirstName: "Sophie",
  person2LastName: "Dupont",
  person2BirthDate: "1978-09-25",
  person2JobTitle: "Médecin libéral",
  person2Csp: "31",
  person2PcsGroupe: "3",
  coupleStatus: "married",
  matrimonialRegime: "communaute_legale",
  singleParent: false,
  person1Handicap: false,
  person2Handicap: false,
  childrenData: [
    {
      firstName: "Léa", lastName: "Dupont", birthDate: "2008-06-15",
      parentLink: "common_child", custody: "full", rattached: true, handicap: false,
    },
    {
      firstName: "Hugo", lastName: "Dupont", birthDate: "2012-03-22",
      parentLink: "common_child", custody: "full", rattached: true, handicap: false,
    },
  ],
  salary1: "75000",
  salary2: "0",
  pensions: "0",
  perDeduction: "5000",
  pensionDeductible: "0",
  otherDeductible: "0",
  ca1: "",
  bicType1: "services",
  microRegime1: true,
  chargesReelles1: "",
  baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "120000",
  bicType2: "services",
  microRegime2: false,
  chargesReelles2: "35000",
  baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [
    {
      name: "Résidence principale",
      type: "Résidence principale",
      ownership: "common",
      propertyRight: "full",
      usufructAge: "",
      value: "650000",
      propertyTaxAnnual: "2400",
      rentGrossAnnual: "0",
      insuranceAnnual: "650",
      worksAnnual: "0",
      otherChargesAnnual: "0",
      loanEnabled: true,
      loanType: "amortissable",
      loanAmount: "500000",
      loanRate: "1.8",
      loanDuration: "25",
      loanStartDate: "2018-01-01",
      loanCapitalRemaining: "380000",
      loanInterestAnnual: "6500",
      loanPledgedPlacementIndex: "-1",
      loanInsurance: true,
      loanInsuranceGuarantees: "dc_ptia",
      loanInsuranceRate: "0.20",
      loanInsuranceRate1: "0.20",
      loanInsuranceRate2: "0.20",
      loanInsurancePremium: "0",
      loanInsuranceCoverage: "banque",
      indivisionShare1: "50",
      indivisionShare2: "50",
    },
    {
      name: "Locatif Toulouse",
      type: "Location nue",
      ownership: "common",
      propertyRight: "full",
      usufructAge: "",
      value: "280000",
      propertyTaxAnnual: "1450",
      rentGrossAnnual: "13200",
      insuranceAnnual: "320",
      worksAnnual: "0",
      otherChargesAnnual: "180",
      loanEnabled: false,
      loanType: "amortissable",
      loanAmount: "0",
      loanRate: "0",
      loanDuration: "0",
      loanStartDate: "",
      loanCapitalRemaining: "0",
      loanInterestAnnual: "0",
      loanPledgedPlacementIndex: "-1",
      loanInsurance: false,
      loanInsuranceGuarantees: "",
      loanInsuranceRate: "0",
      loanInsuranceRate1: "0",
      loanInsuranceRate2: "0",
      loanInsurancePremium: "0",
      loanInsuranceCoverage: "",
      indivisionShare1: "50",
      indivisionShare2: "50",
    },
  ],
  placements: [
    {
      name: "AV Mon Contrat",
      type: "Assurance-vie unités de compte",
      ownership: "common",
      value: "120000",
      annualIncome: "0",
      taxableIncome: "0",
      deathValue: "120000",
      openDate: "2010-05-01",
      pfuEligible: true,
      pfuOptOut: false,
      totalPremiumsNet: "85000",
      premiumsBefore70: "85000",
      premiumsAfter70: "0",
      exemptFromSuccession: "0",
      ucRatio: "60",
      annualWithdrawal: "0",
      annualContribution: "0",
      perDeductible: true,
      perWithdrawal: "0",
      perWithdrawalCapital: "0",
      perWithdrawalInterest: "0",
      perAnticiped: false,
      beneficiaries: [
        { name: "Sophie Dupont", relation: "conjoint", share: "100" },
      ],
    },
    {
      name: "PER Pierre",
      type: "PER assurantiel",
      ownership: "person1",
      value: "45000",
      annualIncome: "0",
      taxableIncome: "0",
      deathValue: "45000",
      openDate: "2020-01-01",
      pfuEligible: false,
      pfuOptOut: false,
      totalPremiumsNet: "30000",
      premiumsBefore70: "30000",
      premiumsAfter70: "0",
      exemptFromSuccession: "0",
      ucRatio: "70",
      annualWithdrawal: "0",
      annualContribution: "5000",
      perDeductible: true,
      perWithdrawal: "0",
      perWithdrawalCapital: "0",
      perWithdrawalInterest: "0",
      perAnticiped: false,
      beneficiaries: [],
    },
    {
      name: "Livret A",
      type: "Livret A",
      ownership: "common",
      value: "22950",
      annualIncome: "0",
      taxableIncome: "0",
      deathValue: "0",
      openDate: "",
      pfuEligible: false,
      pfuOptOut: false,
      totalPremiumsNet: "0",
      premiumsBefore70: "0",
      premiumsAfter70: "0",
      exemptFromSuccession: "0",
      ucRatio: "0",
      annualWithdrawal: "0",
      annualContribution: "0",
      perDeductible: false,
      perWithdrawal: "0",
      perWithdrawalCapital: "0",
      perWithdrawalInterest: "0",
      perAnticiped: false,
      beneficiaries: [],
    },
  ],
  perRentes: [],
  otherLoans: [],
};

// ─── Options IR ─────────────────────────────────────────────────────────────
export const fixtureIrOptions: IrOptions = {
  expenseMode1: "standard",
  expenseMode2: "standard",
  km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9",
  km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9",
  other1: "0", other2: "0",
  foncierRegime: "micro",
};

// ─── Succession (décès person1) ─────────────────────────────────────────────
export const fixtureSuccessionData: SuccessionData = {
  deceasedPerson: "person1",
  spousePresent: true,
  spouseOption: "legal_quarter_full",
  useTestament: false,
  legsMode: "global",
  heirs: [
    { name: "Sophie Dupont", relation: "conjoint", share: "0", priorDonations: "0", childLink: null },
    { name: "Léa Dupont", relation: "enfant", share: "50", priorDonations: "0", childLink: "common_child" },
    { name: "Hugo Dupont", relation: "enfant", share: "50", priorDonations: "0", childLink: "common_child" },
  ],
  testamentHeirs: [],
  legsPrecisItems: [],
};

// ─── Cabinet (EcoPatrimoine Conseil, données réelles confirmées) ────────────
export const fixtureCabinet: Record<string, string> = {
  cabinetName: "EcoPatrimoine Conseil",
  conseiller: "David Perry",
  forme: "EI",
  rcs: "—",
  villeRcs: "Perpignan",
  orias: "25006907",
  siren: "—",
  adresse: "6 rue Victor Mirabeau",
  codePostal: "66000",
  ville: "Perpignan",
  tel: "—",
  email: "contact@ecopatrimoine-conseil.com",
  partenaires: "—",
  rcpAssureur: "—",
  rcpContrat: "—",
  niveauConseil: "1",
  remunerationType: "commission",
  mediateur: "Médiateur de l'Assurance",
  mediateurUrl: "www.mediation-assurance.org",
  colorNavy: "#0F172A",
  colorGold: "#C4973D",
  colorSky: "#26428B",
  colorCream: "#FDF6E8",
  colorBlue: "#516AC7",
  logoSrc: "",
  signatureSrc: "",
};

// ─── Cabinet SANS couleurs personnalisées — déclenche le repli Encre & Or ──
// Toutes les clés colorNavy/colorGold/colorSky/colorCream/colorBlue absentes.
// Sert au test de la branche « repli intégral sur les tokens Encre & Or ».
export const fixtureCabinetNoColors: Record<string, string> = {
  cabinetName: "EcoPatrimoine Conseil",
  conseiller: "David Perry",
  forme: "EI",
  rcs: "—",
  villeRcs: "Perpignan",
  orias: "25006907",
  siren: "—",
  adresse: "6 rue Victor Mirabeau",
  codePostal: "66000",
  ville: "Perpignan",
  tel: "—",
  email: "contact@ecopatrimoine-conseil.com",
  partenaires: "—",
  rcpAssureur: "—",
  rcpContrat: "—",
  niveauConseil: "1",
  remunerationType: "commission",
  mediateur: "Médiateur de l'Assurance",
  mediateurUrl: "www.mediation-assurance.org",
  logoSrc: "",
  signatureSrc: "",
};

// ─── Mission (lettre de mission — formulaire profil) ────────────────────────
export const fixtureMission: Record<string, any> = {
  // Besoins
  besoinSante_depenses: true,
  besoinSante_hospit: true,
  besoinSante_depasse: false,
  besoinSante_surcompl: false,
  besoinPrev_arret: true,
  besoinPrev_deces: true,
  besoinPrev_fraisGen: false,
  besoinRetraite_capital: true,
  besoinRetraite_rente: false,
  besoinRetraite_moderniser: true,
  besoinEpargne_valoriser: true,
  besoinEpargne_transmettre: true,
  besoinEpargne_completer: false,
  besoinEpargne_projet: false,
  // Q1 attitude (0/8/12/18)
  attitude: 12,
  // Q2 réaction baisse (0/6/12/18)
  reactionBaisse: 12,
  // Q3 connaissances / investi
  connaitFondsEuros: true, investiFondsEuros: true,
  connaitActions: true, investiActions: false,
  connaitOPCVM: true, investiOPCVM: true,
  connaitImmo: true, investiImmo: true,
  connaitTrackers: false, investiTrackers: false,
  connaitStructures: false, investiStructures: false,
  // Q4a/Q4b
  aSubiPertes: true, ampleurPertes: -10, reactionPertes: 2,
  aRealiseGains: true, ampleurGains: 10, reactionGains: 2,
  // Q5 gestion
  modeGestion: "pilote",
  // Q6 savoirs
  savoirUCRisque: true, savoirHorizonUC: true, savoirRisqueRendement: true,
  // Horizon
  horizon: "9-15",
  // Rémunération
  remuCommission: true, remuHonoraire: false, remuHonoraireMontant: "", remuMixte: false,
  // Obligations fiscales
  residenceFranceIR: true, residenceFranceIFI: true,
  nationaliteUS: false, residentFiscalUS: false, ppe: false, ppeDetails: "",
  justifDomicile: true, justifOrigineFonds: true,
  // ESG
  esgPref: "partiel",
  // Signature
  lieuSignature: "Perpignan",
};

// ─── Snapshot calculé (résultats des compute*) ──────────────────────────────
// On RECALCULE à partir de la donnée — pas de valeurs en dur.
// Si le moteur fiscal change, le snapshot HTML changera également.
export function buildFixtureComputed() {
  const ir = computeIR(fixtureData, fixtureIrOptions);
  const ifi = computeIFI(fixtureData);
  const succession = computeSuccession(fixtureSuccessionData, fixtureData);
  return { ir, ifi, succession };
}

// ─── Fixture CONCUBIN avec partenaire héritier (garde-fou Lot 3) ────────────
// Reproduit le scénario du bug moteur signalé : coupleStatus="cohab" + un heir
// avec relation="conjoint" → exonération abusive du concubin survivant.
// Sert au snapshot du bandeau d'avertissement visuel.
export const fixtureDataCohab: PatrimonialData = {
  ...fixtureData,
  coupleStatus: "cohab",
  matrimonialRegime: "separation_biens",  // les concubins n'ont pas de régime
};

export const fixtureSuccessionDataCohab: SuccessionData = {
  deceasedPerson: "person1",
  spousePresent: true,
  spouseOption: "none",
  useTestament: false,
  legsMode: "global",
  heirs: [
    // Le partenaire concubin survivant — étiqueté "conjoint" comme aujourd'hui
    // (cf. bug moteur buildCollectedHeirs). C'est exactement ce que le garde-fou
    // visuel doit signaler.
    { name: "Sophie Dupont", relation: "conjoint", share: "0", priorDonations: "0", childLink: null },
    { name: "Léa Dupont",  relation: "enfant", share: "50", priorDonations: "0", childLink: "common_child" },
    { name: "Hugo Dupont", relation: "enfant", share: "50", priorDonations: "0", childLink: "common_child" },
  ],
  testamentHeirs: [],
  legsPrecisItems: [],
};

export function buildFixtureComputedCohab() {
  const ir = computeIR(fixtureDataCohab, fixtureIrOptions);
  const ifi = computeIFI(fixtureDataCohab);
  const succession = computeSuccession(fixtureSuccessionDataCohab, fixtureDataCohab);
  return { ir, ifi, succession };
}

// ─── Fixture GROS PATRIMOINE — bascule pagination (Lot 4) ──────────────────
// 20 properties + 25 placements pour déclencher la synthèse + annexe.
// Les IFI lines découlent des properties IFI-éligibles (locatifs essentiellement).
// Conserve la même structure familiale que fixtureData (couple marié + 2 enfants).
const PROPERTY_TYPES_LARGE = [
  "Résidence principale", "Résidence secondaire", "Location nue", "Location nue",
  "LMNP", "LMNP", "LMNP", "LMP", "SCI IR", "SCI IR",
  "SCPI", "SCPI", "SCPI", "Terrain", "Terrain",
  "Local professionnel", "Location nue", "LMNP", "SCI IR", "SCPI",
];
const PLACEMENT_TYPES_LARGE = [
  "Livret A", "LDDS", "LEP", "PEL", "CEL",
  "Compte courant", "Compte à terme",
  "PEA", "Compte-titres", "Actions non cotées", "OPCVM / ETF",
  "Assurance-vie fonds euros", "Assurance-vie fonds euros",
  "Assurance-vie unités de compte", "Assurance-vie unités de compte",
  "Assurance-vie unités de compte", "Contrat de capitalisation",
  "PER bancaire", "PER bancaire", "PER assurantiel", "PER assurantiel",
  "Madelin", "OPCVM / ETF", "PEA", "Compte-titres",
];

export const fixtureDataLarge: PatrimonialData = {
  ...fixtureData,
  properties: PROPERTY_TYPES_LARGE.map((type, i) => ({
    name: `Bien ${i + 1}`,
    type,
    ownership: i % 3 === 0 ? "person1" : i % 3 === 1 ? "person2" : "common",
    propertyRight: "full",
    usufructAge: "",
    value: String(150000 + i * 25000),
    propertyTaxAnnual: "0",
    rentGrossAnnual: type === "Résidence principale" ? "0" : String(6000 + i * 200),
    insuranceAnnual: "0",
    worksAnnual: "0",
    otherChargesAnnual: "0",
    loanEnabled: false,
    loanType: "amortissable",
    loanAmount: "0", loanRate: "0", loanDuration: "0", loanStartDate: "",
    loanCapitalRemaining: "0", loanInterestAnnual: "0",
    loanPledgedPlacementIndex: "-1",
    loanInsurance: false,
    loanInsuranceGuarantees: "",
    loanInsuranceRate: "0", loanInsuranceRate1: "0", loanInsuranceRate2: "0",
    loanInsurancePremium: "0",
    loanInsuranceCoverage: "",
    indivisionShare1: "50", indivisionShare2: "50",
  })),
  placements: PLACEMENT_TYPES_LARGE.map((type, i) => ({
    name: `Placement ${i + 1}`,
    type,
    ownership: i % 3 === 0 ? "person1" : i % 3 === 1 ? "person2" : "common",
    value: String(10000 + i * 5000),
    annualIncome: "0", taxableIncome: "0", deathValue: "0",
    openDate: "2015-01-01",
    pfuEligible: true, pfuOptOut: false,
    totalPremiumsNet: "0", premiumsBefore70: "0", premiumsAfter70: "0",
    exemptFromSuccession: "0",
    ucRatio: "50",
    annualWithdrawal: "0", annualContribution: "0",
    perDeductible: true,
    perWithdrawal: "0", perWithdrawalCapital: "0", perWithdrawalInterest: "0",
    perAnticiped: false,
    beneficiaries: [],
  })),
};

export function buildFixtureComputedLarge() {
  const ir = computeIR(fixtureDataLarge, fixtureIrOptions);
  const ifi = computeIFI(fixtureDataLarge);
  const succession = computeSuccession(fixtureSuccessionData, fixtureDataLarge);
  return { ir, ifi, succession };
}

// ─── Hypothèses (vides — pas de scénario actif dans la fixture par défaut) ──
export const fixtureHypothesisResults: Array<{
  hypothesis: Hypothesis;
  ir: any;
  ifi: any;
  succession: any;
  differences: any[];
}> = [];

// ─── Sections — toutes activées (par défaut) ────────────────────────────────
export const allSectionsReport: Record<string, boolean> = {
  cabinet: true, famille: true, travail: true, bilan: true,
  ir: true, ifi: true, succession: true, hypos: true,
  annexes: true,  // Lot 4 — rendue uniquement si un tableau a basculé en synthèse
  mentions: true,
};

export const allSectionsMission: Record<string, boolean> = {
  legal: true, famille: true, travail: true, besoins: true,
  bilan: true, ir: true, ifi: true, succession: true,
  profil: true,
  annexes: true,  // Lot 4 — idem
  signature: true,
};

// Helper : produit un objet sections avec une seule section à true, le reste à false.
export function onlySection(allSections: Record<string, boolean>, key: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(allSections)) out[k] = (k === key);
  return out;
}
