// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Child = {
  firstName: string;
  lastName: string;
  birthDate: string;
  parentLink: string;
  custody: string;
  rattached: boolean; // true = rattaché au foyer fiscal (défaut), false = non rattaché (enfant majeur indépendant)
  handicap: boolean;  // titulaire carte d'invalidité / CMI-invalidité → +0,5 part IR (0,25 si alternée) + abattement succession 159 325 €
  // Niveau scolaire → réduction d'impôt forfait scolaire art. 199 quater B CGI
  // college = 61 €/an | lycee = 153 €/an | superieur = 183 €/an
  schoolLevel?: string; // "" | "college" | "lycee" | "superieur" — optionnel pour rétrocompatibilité
};

// ── Crédit immobilier (nouveau : multi-crédits par bien) ──────────────────
export type Loan = {
  id: string;
  type: string;           // "amortissable"|"in_fine"|"ptz"|"pel"|"travaux"
  label: string;          // "Prêt principal", "PTZ", "PEL"…
  amount: string;         // montant initial
  rate: string;           // taux annuel %
  duration: string;       // durée en années
  startDate: string;
  capitalRemaining: string;   // vide = auto-calculé
  interestAnnual: string;     // vide = auto-calculé
  pledgedPlacementIndex: string; // AV nantie pour in_fine (-1 = aucune)
  insurance: boolean;
  insuranceGuarantees: string; // "dc"|"dc_ptia"|...
  insuranceRate: string;       // bien propre ou mono
  insuranceRate1: string;      // couple/indivision P1
  insuranceRate2: string;      // couple/indivision P2
  insurancePremium: string;    // vide = auto-calculé (montant * rate / 100 / 12 * 12)
  insuranceCoverage: string;   // "banque"|"delegation"
};

export type Property = {
  name: string;
  type: string;
  ownership: string;
  propertyRight: string;
  usufructAge: string;
  value: string;
  propertyTaxAnnual: string;
  rentGrossAnnual: string;
  insuranceAnnual: string;
  worksAnnual: string;
  otherChargesAnnual: string;
  // ── Crédit ──────────────────────────────────────────
  loanEnabled: boolean;
  loanType: string;             // "amortissable"|"in_fine"|"relais"|"ptz"|"travaux"
  loanAmount: string;
  loanRate: string;
  loanDuration: string;
  loanStartDate: string;
  loanCapitalRemaining: string;
  loanInterestAnnual: string;
  loanPledgedPlacementIndex: string; // index AV nantie (-1 = aucune)
  // ── Assurance ────────────────────────────────────────
  loanInsurance: boolean;
  loanInsuranceGuarantees: string;  // "dc"|"dc_ptia"|"dc_ptia_itt"|"dc_ptia_itt_ipp"
  loanInsuranceRate: string;
  loanInsuranceRate1: string;
  loanInsuranceRate2: string;
  loanInsurancePremium: string;
  loanInsuranceCoverage: string;    // "banque"|"delegation"
  indivisionShare1: string;
  indivisionShare2: string;
  // ── Multi-crédits (nouveau) ───────────────────────────────────────────────
  // Priorité sur les anciens champs loan* si présent et non vide
  loans?: Loan[];
};

export type Beneficiary = {
  name: string;
  relation: string;
  share: string;
};

export type Placement = {
  name: string;
  type: string;
  ownership: string;
  value: string;
  annualIncome: string;
  taxableIncome: string;
  deathValue: string;
  openDate: string;
  pfuEligible: boolean;
  pfuOptOut: boolean;   // true = option barème IR au lieu du PFU (avantageux si TMI < 30%)
  totalPremiumsNet: string;
  premiumsBefore70: string;
  premiumsAfter70: string;
  exemptFromSuccession: string;
  ucRatio: string; // % investi en UC (reste = fonds euros), uniquement pour AV UC
  annualWithdrawal: string; // retrait annuel AV — déclenche calcul fiscalité rachat
  annualContribution: string; // versement annuel PER/Madelin — base déduction IR
  perDeductible: boolean;      // true = versement déductible IR (défaut), false = non déductible
  perWithdrawal: string;       // retrait annuel PER (capital + intérêts)
  perWithdrawalCapital: string; // dont capital (imposable au barème)
  perWithdrawalInterest: string; // dont intérêts (PFU 31,4%)
  perAnticiped: boolean;       // true = déblocage anticipé (cas exceptionnel)
  beneficiaries: Beneficiary[];
};

// ── Détail des charges professionnelles par nature ─────────────────────────
export type ChargesDetail = {
  loyer: string;          // Loyer / bureau
  materiel: string;       // Matériel & équipements
  deplacements: string;   // Déplacements (km + transport)
  repas: string;          // Repas professionnels
  tns: string;            // Cotisations TNS (URSSAF, retraite...)
  bancaires: string;      // Frais bancaires
  comptable: string;      // Honoraires comptable
  autres: string;         // Autres charges
};

export const EMPTY_CHARGES_DETAIL: ChargesDetail = {
  loyer: "", materiel: "", deplacements: "", repas: "",
  tns: "", bancaires: "", comptable: "", autres: "",
};

export function sumChargesDetail(d: ChargesDetail): number {
  return ["loyer","materiel","deplacements","repas","tns","bancaires","comptable","autres"]
    .reduce((acc, k) => acc + (parseFloat((d as any)[k]) || 0), 0);
}

// ── Autre crédit (consommation, personnel, LOA…) ──────────────────────
export type OtherLoan = {
  name: string;
  loanType: string;       // "conso"|"personnel"|"loa"|"employeur"|"revolving"|"familial"
  owner: string;          // "person1"|"person2"|"common"
  capitalRemaining: string;
  monthlyPayment: string;
  rate: string;
  durationRemaining: string; // mois restants
  purpose: string;
  hasInsurance: boolean;
  insuranceGuarantees: string;
  insurancePremium: string;
};

export type PatrimonialData = {
  person1FirstName: string;
  person1LastName: string;
  person1BirthDate: string;
  person1JobTitle: string;
  person1Csp: string;
  person1PcsGroupe: string;
  person2FirstName: string;
  person2LastName: string;
  person2BirthDate: string;
  person2JobTitle: string;
  person2Csp: string;
  person2PcsGroupe: string;
  coupleStatus: string;
  matrimonialRegime: string;
  singleParent: boolean;
  person1Handicap: boolean;  // personne 1 handicapée → abattement revenu 2 627 € + plafond QF +1 785 €
  person2Handicap: boolean;  // personne 2 handicapée → idem
  childrenData: Child[];
  salary1: string;
  salary2: string;
  // Retraites / pensions — nominatives par personne (remplace le champ global pensions)
  pensions1?: string;  // retraite / pension personne 1 — optionnel pour rétrocompatibilité
  pensions2?: string;  // retraite / pension personne 2 — optionnel pour rétrocompatibilité
  pensions: string;   // champ global — conservé pour rétrocompatibilité (migration automatique)
  // CSG déductible sur revenus fonciers de l'année précédente
  csgDeductibleFoncier?: string; // optionnel pour rétrocompatibilité
  perDeduction: string;
  pensionDeductible: string;
  otherDeductible: string;
  // ── Revenus indépendants personne 1 ──
  ca1: string;               // Chiffre d'affaires
  bicType1: string;          // "vente" | "services" (pour BIC)
  microRegime1: boolean;     // true = micro, false = réel
  chargesReelles1: string;   // Charges déductibles réelles (régime réel) — somme du détail
  baRevenue1: string;        // Bénéfice agricole (groupe 1)
  chargesDetail1: ChargesDetail; // Détail par nature
  // ── Revenus indépendants personne 2 ──
  ca2: string;
  bicType2: string;
  microRegime2: boolean;
  chargesReelles2: string;
  baRevenue2: string;
  chargesDetail2: ChargesDetail; // Détail par nature
  properties: Property[];
  placements: Placement[];
  perRentes: PERRente[];    // rentes PER en phase de rente
  otherLoans: OtherLoan[];  // autres crédits (conso, personnel, LOA…)
};

// ── Rente PER (sortie en rente — onglet Revenus) ─────────────────────────
export type PERRente = {
  owner: string;          // "person1" | "person2"
  annualAmount: string;   // rente annuelle brute (€)
  ageAtFirst: string;     // âge au 1er versement (détermine la fraction imposable)
};

export type Heir = {
  name: string;
  relation: string;
  share: string;
  priorDonations: string;
  childLink: string | null;
};

export type TestamentHeir = {
  firstName: string;
  lastName: string;
  birthDate: string;
  relation: string;
  priorDonations: string;
  // Legs global
  shareGlobal: string;        // % du patrimoine total légué
  propertyRight: string;      // "full"|"bare"|"usufruct"
};

// Contrepartie d'un démembrement (l'autre côté NP/US)
export type DemembrementContrepartie = {
  heirName: string;
  heirRelation: string;
  heirBirthDate: string;
  sharePercent: string;  // quotité de cette contrepartie
};

// Légataire dans un legs précis (centré sur le bien)
export type LegsPrecisLegataire = {
  heirName: string;
  heirRelation: string;
  heirBirthDate: string;
  sharePercent: string;     // % du bien attribué à ce légataire
  propertyRight: string;    // "full"|"bare"|"usufruct"
  contreparties: DemembrementContrepartie[];
};

// Legs précis : centré sur le BIEN — un bien peut avoir plusieurs légataires
export type LegsPrecisItem = {
  propertyIndex: number;
  assetType: "property" | "placement" | "free";
  freeLabel?: string;       // si bien libre (assetType="free")
  freeValue?: string;       // valeur estimée du bien libre
  isResidual?: boolean;     // "reste du patrimoine" = patrimoine total - autres biens en legs précis
  legataires: LegsPrecisLegataire[];
  // Rétrocompatibilité — champs ancienne structure (migration auto au chargement)
  heirName?: string;
  heirRelation?: string;
  heirBirthDate?: string;
  sharePercent?: string;
  propertyRight?: string;
  contreparties?: DemembrementContrepartie[];
};

export type SuccessionData = {
  deceasedPerson: "person1" | "person2";
  spousePresent: boolean;
  spouseOption: string;
  useTestament: boolean;
  legsMode: "global" | "precis";  // mode testament
  heirs: Heir[];
  testamentHeirs: TestamentHeir[];
  legsPrecisItems: LegsPrecisItem[];
};

export type IrOptions = {
  expenseMode1: "standard" | "actual";
  expenseMode2: "standard" | "actual";
  km1: string;
  km2: string;
  cv1: string;
  cv2: string;
  mealCount1: string;
  mealCount2: string;
  mealUnit1: string;
  mealUnit2: string;
  other1: string;
  other2: string;
  foncierRegime: "micro" | "real";
};

export type Hypothesis = {
  id: number;
  name: string;
  notes: string;
  objective: string;
  savedAt: string | null;
  data: PatrimonialData | null;
  successionData: SuccessionData | null;
  irOptions: IrOptions | null;
};

export type BaseSnapshot = {
  savedAt: string | null;
  data: PatrimonialData | null;
  successionData: SuccessionData | null;
  irOptions: IrOptions | null;
};

export type TaxBracket = { from: number; to: number; rate: number };

export type FilledBracket = {
  label: string;
  from: number;
  to: number;
  filled: number;
  tax: number;
  rate: number;
};

export type SuccessionResult = {
  name: string;
  relation: string;
  fraction: number;
  nueFraction: number;
  usufructFraction: number;
  grossReceived: number;
  nueRawValue: number;
  nueValue: number;
  usufructRawValue: number;
  avReceived: number;
  successionTaxable: number;
  successionDuties: number;
  avDuties: number;
  duties: number;
  netReceived: number;
  successionNetReceived: number;
  avNetReceived: number;
  avTaxableBefore70: number;
  avTaxableAfter70: number;
  bracketFill: FilledBracket[];
  graphTitle: string;
  allowance: number;
  indicatorPct: number;
  visualMax: number;
  currentBracketLabel: string;
  effectiveReceived: number;
};

export type SuccessionPropertyLine = {
  name: string;
  grossEstateValue: number;
  residenceAbatement: number;
  debtShare: number;
  debtShareGross: number;
  insuranceCover: number;
  insuranceRate: number;
  netEstateValue: number;
  note: string;
};

export type SuccessionPlacementLine = {
  name: string;
  netEstateValue: number;
  note: string;
};

export type SuccessionAvLine = {
  contract: string;
  beneficiary: string;
  relation: string;
  sharePct: number;
  amount: number;
  amountBefore70Capital: number;
  amountAfter70Premiums: number;
  amountAfter70TaxableShare: number;
  before70Tax: number;
  after70Tax: number;
  totalTax: number;
};

export type PieDatum = { name: string; holder: string; value: number };

export type DifferenceLine = {
  label: string;
  baseValue: string;
  hypothesisValue: string;
  impact: "up" | "down" | "neutral";
  fiscalArea: string;
};

export type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};
