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
  ir: true, ifi: true, succession: true, hypos: true, mentions: true,
};

export const allSectionsMission: Record<string, boolean> = {
  legal: true, famille: true, travail: true, besoins: true,
  bilan: true, ir: true, ifi: true, succession: true,
  profil: true, signature: true,
};

// Helper : produit un objet sections avec une seule section à true, le reste à false.
export function onlySection(allSections: Record<string, boolean>, key: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(allSections)) out[k] = (k === key);
  return out;
}
