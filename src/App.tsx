import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Plus, Trash2, Database, FileText, Settings } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { useClients, ClientManager } from "./useClients";
import type { ClientRecord, ClientPayload } from "./useClients";
import { useAuth } from "./hooks/useAuth";
import { AuthGate } from "./components/AuthGate";

// ─── BRAND & SURFACE ─────────────────────────────────────────────────────────

const BRAND = {
  white: "#F8F6F7",
  cream: "#FBECD7",
  gold: "#E3AF64",
  navy: "#101B3B",
  sky: "#26428B",
  blue: "#516AC7",
};

const SURFACE = {
  app: `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)`,
  hero: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 38%, ${BRAND.blue} 68%, ${BRAND.gold} 100%)`,
  accent: `linear-gradient(90deg, ${BRAND.gold} 0%, ${BRAND.cream} 55%, #fff7ea 100%)`,
  card: "rgba(255,255,255,0.94)",
  cardSoft: "rgba(251,236,215,0.72)",
  border: "rgba(227,175,100,0.22)",
  borderStrong: "rgba(227,175,100,0.34)",
  input: "rgba(255,255,255,0.98)",
  inputBorder: "rgba(227,175,100,0.28)",
  tableHead: "rgba(227,175,100,0.12)",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  "Résidence principale",
  "Résidence secondaire",
  "Location nue",
  "LMNP",
  "LMP",
  "SCI IR",
  "SCI IS",
  "SCPI",
  "Terrain",
  "Local professionnel",
  "Autre",
] as const;

const PROPERTY_RIGHTS = [
  { value: "full", label: "Pleine propriété" },
  { value: "bare", label: "Nue-propriété" },
  { value: "usufruct", label: "Usufruit" },
] as const;

const CHILD_LINKS = [
  { value: "common_child", label: "Enfant commun" },
  { value: "person1_only", label: "Enfant de personne 1 uniquement" },
  { value: "person2_only", label: "Enfant de personne 2 uniquement" },
] as const;

const CUSTODY_OPTIONS = [
  { value: "full", label: "Classique" },
  { value: "alternate", label: "Alternée" },
] as const;

const CSP_OPTIONS = [
  "Agriculteurs exploitants.",
  "Artisans, commerçants et chefs d'entreprise.",
  "Cadres et professions intellectuelles supérieures.",
  "Professions Intermédiaires.",
  "Employés.",
  "Ouvriers.",
] as const;

const COUPLE_STATUS_OPTIONS = [
  { value: "married", label: "Marié" },
  { value: "pacs", label: "PACS" },
  { value: "cohab", label: "Concubinage" },
  { value: "single", label: "Célibataire" },
  { value: "divorced", label: "Divorcé / séparé" },
] as const;

const MATRIMONIAL_OPTIONS = [
  { value: "communaute_legale", label: "Communauté légale" },
  { value: "separation_biens", label: "Séparation de biens" },
  { value: "participation_acquets", label: "Participation aux acquêts" },
  { value: "communaute_universelle", label: "Communauté universelle" },
] as const;

const PLACEMENT_FAMILIES = [
  { value: "cash", label: "Comptes et épargne réglementée" },
  { value: "market", label: "Valeurs mobilières" },
  { value: "wrapper", label: "Enveloppes et capitalisation" },
  { value: "retirement", label: "Retraite" },
] as const;

const PLACEMENT_TYPES_BY_FAMILY: Record<string, string[]> = {
  cash: ["Compte courant", "Compte à terme", "PEL", "CEL", "Livret A", "LDDS", "LEP"],
  market: ["PEA", "Compte-titres", "Actions non cotées", "OPCVM / ETF"],
  wrapper: ["Assurance-vie fonds euros", "Assurance-vie unités de compte", "Contrat de capitalisation"],
  retirement: ["PER bancaire", "PER assurantiel", "Madelin"],
};

const ALL_PLACEMENTS = Object.values(PLACEMENT_TYPES_BY_FAMILY).flat();
const AV_TYPES = ["Assurance-vie fonds euros", "Assurance-vie unités de compte"];

const TESTAMENT_RELATION_OPTIONS = [
  { value: "conjoint", label: "Conjoint" },
  { value: "enfant", label: "Enfant" },
  { value: "frereSoeur", label: "Frère / sœur" },
  { value: "neveuNiece", label: "Neveu / nièce" },
  { value: "parent", label: "Parent" },
  { value: "autre", label: "Autre" },
] as const;

const BENEFICIARY_RELATION_OPTIONS = [
  { value: "conjoint", label: "Conjoint" },
  { value: "enfant", label: "Enfant" },
  { value: "petit-enfant", label: "Petit-enfant" },
  { value: "parent", label: "Parent" },
  { value: "frereSoeur", label: "Frère / sœur" },
  { value: "neveuNiece", label: "Neveu / nièce" },
  { value: "autre", label: "Autre" },
] as const;

const CHART_COLORS = [BRAND.gold, BRAND.sky, BRAND.blue, "#88A0F0", "#C1CDF8", BRAND.cream, "#DDE5FF", "#F3D3A1"];
const RECEIVED_COLORS = [BRAND.sky, BRAND.blue, BRAND.gold, "#9CB0F4", "#D8B06C", "#CAD4FA", BRAND.cream, "#7D95E8"];
const LEGUE_COLORS = [BRAND.gold, BRAND.cream, BRAND.blue, "#8CA2F0", BRAND.sky, "#E8C995", "#CBD5FF", "#D9E3FF"];

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Child = {
  firstName: string;
  lastName: string;
  birthDate: string;
  parentLink: string;
  custody: string;
};

type Property = {
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
  loanCapitalRemaining: string;
  loanInterestAnnual: string;
};

type Beneficiary = {
  name: string;
  relation: string;
  share: string;
};

type Placement = {
  name: string;
  type: string;
  ownership: string;
  value: string;
  annualIncome: string;
  taxableIncome: string;
  deathValue: string;
  openDate: string;
  pfuEligible: boolean;
  totalPremiumsNet: string;
  premiumsBefore70: string;
  premiumsAfter70: string;
  exemptFromSuccession: string;
  ucRatio: string; // % investi en UC (reste = fonds euros), uniquement pour AV UC
  annualWithdrawal: string; // retrait annuel AV — déclenche calcul fiscalité rachat
  beneficiaries: Beneficiary[];
};

type PatrimonialData = {
  person1FirstName: string;
  person1LastName: string;
  person1BirthDate: string;
  person1JobTitle: string;
  person1Csp: string;
  person2FirstName: string;
  person2LastName: string;
  person2BirthDate: string;
  person2JobTitle: string;
  person2Csp: string;
  coupleStatus: string;
  matrimonialRegime: string;
  singleParent: boolean;
  childrenData: Child[];
  salary1: string;
  salary2: string;
  pensions: string;
  perDeduction: string;
  pensionDeductible: string;
  otherDeductible: string;
  properties: Property[];
  placements: Placement[];
};

type Heir = {
  name: string;
  relation: string;
  share: string;
  priorDonations: string;
  childLink: string | null;
};

type TestamentHeir = {
  firstName: string;
  lastName: string;
  birthDate: string;
  relation: string;
  priorDonations: string;
};

type SuccessionData = {
  deceasedPerson: "person1" | "person2";
  spousePresent: boolean;
  spouseOption: string;
  useTestament: boolean;
  heirs: Heir[];
  testamentHeirs: TestamentHeir[];
};

type IrOptions = {
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

type Hypothesis = {
  id: number;
  name: string;
  notes: string;
  objective: string;
  savedAt: string | null;
  data: PatrimonialData | null;
  successionData: SuccessionData | null;
  irOptions: IrOptions | null;
};

type BaseSnapshot = {
  savedAt: string | null;
  data: PatrimonialData | null;
  successionData: SuccessionData | null;
  irOptions: IrOptions | null;
};

type TaxBracket = { from: number; to: number; rate: number };

type FilledBracket = {
  label: string;
  from: number;
  to: number;
  filled: number;
  tax: number;
  rate: number;
};

type SuccessionResult = {
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

type SuccessionPropertyLine = {
  name: string;
  grossEstateValue: number;
  residenceAbatement: number;
  debtShare: number;
  netEstateValue: number;
  note: string;
};

type SuccessionPlacementLine = {
  name: string;
  netEstateValue: number;
  note: string;
};

type SuccessionAvLine = {
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

type PieDatum = { name: string; holder: string; value: number };

type DifferenceLine = {
  label: string;
  baseValue: string;
  hypothesisValue: string;
  impact: "up" | "down" | "neutral";
  fiscalArea: string;
};

type FilePickerWindow = Window & {
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

// ─── PURE UTILITIES ───────────────────────────────────────────────────────────

/** FIX #1 — deepClone était manquant dans la v2 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function n(v: unknown): number {
  const parsed = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function euro(v: unknown): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n(v));
}

function isAV(type: string): boolean {
  return AV_TYPES.includes(type);
}

function personLabel(data: PatrimonialData, which: 1 | 2): string {
  const first = which === 1 ? data.person1FirstName : data.person2FirstName;
  const last = which === 1 ? data.person1LastName : data.person2LastName;
  const raw = `${first || ""} ${last || ""}`.trim();
  return raw || (which === 1 ? "Personne 1" : "Personne 2");
}

function childMatchesDeceased(link: string | null, deceasedPerson: "person1" | "person2"): boolean {
  if (link === "common_child") return true;
  if (link === "person1_only") return deceasedPerson === "person1";
  if (link === "person2_only") return deceasedPerson === "person2";
  return true;
}

function getAgeFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDelta = now.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function getDemembrementPercentages(age: number | null) {
  if (age === null) return { usufruct: 0, nuePropriete: 0 };
  if (age <= 20) return { usufruct: 0.9, nuePropriete: 0.1 };
  if (age <= 30) return { usufruct: 0.8, nuePropriete: 0.2 };
  if (age <= 40) return { usufruct: 0.7, nuePropriete: 0.3 };
  if (age <= 50) return { usufruct: 0.6, nuePropriete: 0.4 };
  if (age <= 60) return { usufruct: 0.5, nuePropriete: 0.5 };
  if (age <= 70) return { usufruct: 0.4, nuePropriete: 0.6 };
  if (age <= 80) return { usufruct: 0.3, nuePropriete: 0.7 };
  if (age <= 90) return { usufruct: 0.2, nuePropriete: 0.8 };
  return { usufruct: 0.1, nuePropriete: 0.9 };
}

function getBaseFiscalParts(data: PatrimonialData): number {
  return data.coupleStatus === "married" || data.coupleStatus === "pacs" ? 2 : 1;
}

/**
 * CGI art. 194 — parts fiscales enfants :
 * - 1er et 2e enfant : 0,5 part chacun (0,25 en garde alternée)
 * - 3e enfant et suivants : 1 part chacun (0,5 en garde alternée)
 */
function getChildrenFiscalParts(childrenData: Child[]): number {
  return childrenData.reduce((sum, child, index) => {
    const isAlternate = child.custody === "alternate";
    const base = index < 2 ? 0.5 : 1;
    return sum + (isAlternate ? base / 2 : base);
  }, 0);
}

function getQuotientCapPerHalfPart(): number {
  return 1807;
}

function getQuotiteDisponible(childrenCount: number): number {
  if (childrenCount <= 0) return 1;
  if (childrenCount === 1) return 0.5;
  if (childrenCount === 2) return 1 / 3;
  return 0.25;
}

function isSpouseHeirEligible(data: PatrimonialData): boolean {
  return data.coupleStatus === "married";
}

function getAvailableSpouseOptions(data: PatrimonialData, deceasedPerson: "person1" | "person2") {
  if (!isSpouseHeirEligible(data)) {
    return [{ value: "none", label: "Aucun droit successoral automatique du conjoint" }];
  }
  const children = data.childrenData.filter((c) => childMatchesDeceased(c.parentLink, deceasedPerson));
  const hasNonCommonChildren = children.some((c) => c.parentLink !== "common_child");
  const options = [{ value: "legal_quarter_full", label: "Dévolution légale : 1/4 en pleine propriété" }];
  if (!hasNonCommonChildren) {
    options.push({ value: "legal_usufruct_total", label: "Dévolution légale : totalité en usufruit" });
  }
  options.push({ value: "ddv_usufruct_total", label: "Donation au dernier vivant : totalité en usufruit" });
  options.push({ value: "ddv_quarter_full_3q_usufruct", label: "Donation au dernier vivant : 1/4 PP + 3/4 usufruit" });
  options.push({ value: "ddv_quotite_disponible", label: "Donation au dernier vivant : quotité disponible spéciale" });
  return options;
}

function buildCollectedHeirs(data: PatrimonialData, deceasedPerson: "person1" | "person2"): Heir[] {
  const heirs: Heir[] = [];
  if (deceasedPerson === "person1" && (data.person2FirstName || data.person2LastName)) {
    heirs.push({ name: personLabel(data, 2), relation: "conjoint", share: "0", priorDonations: "0", childLink: null });
  }
  if (deceasedPerson === "person2" && (data.person1FirstName || data.person1LastName)) {
    heirs.push({ name: personLabel(data, 1), relation: "conjoint", share: "0", priorDonations: "0", childLink: null });
  }
  data.childrenData.forEach((child, i) => {
    heirs.push({
      name: `${child.firstName || `Enfant ${i + 1}`} ${child.lastName || ""}`.trim(),
      relation: "enfant",
      share: "0",
      priorDonations: "0",
      childLink: child.parentLink || "common_child",
    });
  });
  return heirs;
}

function buildTestamentHeirs(testamentHeirs: TestamentHeir[]): Heir[] {
  return testamentHeirs.map((heir) => ({
    name: `${heir.firstName || ""} ${heir.lastName || ""}`.trim() || "Héritier testamentaire",
    relation: heir.relation,
    share: "0",
    priorDonations: heir.priorDonations || "0",
    childLink: heir.relation === "enfant" ? "common_child" : null,
  }));
}

/** Retourne uniquement les bénéficiaires avec un nom non vide */
function getFamilyBeneficiaries(data: PatrimonialData): Beneficiary[] {
  const beneficiaries: Beneficiary[] = [];
  const name1 = `${data.person1FirstName || ""} ${data.person1LastName || ""}`.trim();
  const name2 = `${data.person2FirstName || ""} ${data.person2LastName || ""}`.trim();
  if (name1) beneficiaries.push({ name: name1, relation: "conjoint", share: "0" });
  if (name2) beneficiaries.push({ name: name2, relation: "conjoint", share: "0" });
  data.childrenData.forEach((child) => {
    const childName = `${child.firstName || ""} ${child.lastName || ""}`.trim();
    if (childName) beneficiaries.push({ name: childName, relation: "enfant", share: "0" });
  });
  return beneficiaries;
}

function computeKilometricAllowance(km: number, cv: number): number {
  const k = Math.max(0, km);
  const p = Math.max(0, Math.round(cv));
  if (k <= 0 || p <= 0) return 0;
  if (p <= 3) {
    if (k <= 5000) return k * 0.529;
    if (k <= 20000) return k * 0.316 + 1065;
    return k * 0.37;
  }
  if (p === 4) {
    if (k <= 5000) return k * 0.606;
    if (k <= 20000) return k * 0.34 + 1330;
    return k * 0.407;
  }
  if (p === 5) {
    if (k <= 5000) return k * 0.636;
    if (k <= 20000) return k * 0.357 + 1395;
    return k * 0.427;
  }
  if (p === 6) {
    if (k <= 5000) return k * 0.665;
    if (k <= 20000) return k * 0.374 + 1457;
    return k * 0.447;
  }
  if (k <= 5000) return k * 0.697;
  if (k <= 20000) return k * 0.394 + 1515;
  return k * 0.47;
}

function computeTaxFromBrackets(base: number, brackets: TaxBracket[]) {
  const safeBase = Math.max(0, base);
  let tax = 0;
  const fill: FilledBracket[] = brackets.map((bracket) => {
    const cap = Number.isFinite(bracket.to) ? bracket.to : safeBase;
    const filled = Math.max(0, Math.min(safeBase, cap) - bracket.from);
    const lineTax = filled * bracket.rate;
    tax += lineTax;
    return {
      label: `${(bracket.rate * 100).toFixed(bracket.rate >= 0.1 ? 0 : 1).replace(".0", "")} %`,
      from: bracket.from,
      to: Number.isFinite(bracket.to) ? bracket.to : safeBase,
      filled,
      tax: lineTax,
      rate: bracket.rate,
    };
  });
  return { tax, fill };
}

// ─── CALCUL IR ────────────────────────────────────────────────────────────────

function computeIR(data: PatrimonialData, irOptions: IrOptions) {
  const salary1 = n(data.salary1);
  const salary2 = n(data.salary2);
  const pensions = n(data.pensions);
  const salaries = salary1 + salary2 + pensions;

  const kmAllowance1 = irOptions.expenseMode1 === "actual" ? computeKilometricAllowance(n(irOptions.km1), n(irOptions.cv1)) : 0;
  const kmAllowance2 = irOptions.expenseMode2 === "actual" ? computeKilometricAllowance(n(irOptions.km2), n(irOptions.cv2)) : 0;
  const mealExpenses1 = irOptions.expenseMode1 === "actual" ? n(irOptions.mealCount1) * n(irOptions.mealUnit1) : 0;
  const mealExpenses2 = irOptions.expenseMode2 === "actual" ? n(irOptions.mealCount2) * n(irOptions.mealUnit2) : 0;
  const otherExpenses1 = irOptions.expenseMode1 === "actual" ? n(irOptions.other1) : 0;
  const otherExpenses2 = irOptions.expenseMode2 === "actual" ? n(irOptions.other2) : 0;

  const retained1 = irOptions.expenseMode1 === "actual"
    ? kmAllowance1 + mealExpenses1 + otherExpenses1
    : salary1 * 0.1;
  const retained2 = irOptions.expenseMode2 === "actual"
    ? kmAllowance2 + mealExpenses2 + otherExpenses2
    : salary2 * 0.1;
  const retainedExpenses = retained1 + retained2 + pensions * 0.1;

  let foncierBrut = 0;
  let foncierCharges = 0;
  let foncierInterests = 0;
  for (const property of data.properties) {
    if (["Location nue", "SCI IR", "SCI IS", "LMNP", "LMP", "Local professionnel", "Autre"].includes(property.type)) {
      foncierBrut += n(property.rentGrossAnnual);
      foncierCharges += n(property.propertyTaxAnnual) + n(property.insuranceAnnual) + n(property.worksAnnual) + n(property.otherChargesAnnual);
      foncierInterests += n(property.loanInterestAnnual);
    }
  }

  const taxableFonciers = irOptions.foncierRegime === "real"
    ? Math.max(0, foncierBrut - foncierCharges - foncierInterests)
    : Math.max(0, foncierBrut * 0.7);
  const foncierSocialLevy = taxableFonciers * 0.172;

  let taxablePlacements = 0;
  let pfuBase = 0;
  let avRachatImpot = 0; // Fiscalité AV rachat (PFU + prélèvements sociaux)
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";

  for (const placement of data.placements) {
    if (!isAV(placement.type)) {
      taxablePlacements += n(placement.taxableIncome);
      if (placement.pfuEligible) pfuBase += n(placement.taxableIncome);
    } else {
      const retrait = n((placement as any).annualWithdrawal || "");
      if (retrait > 0) {
        const valeur = n(placement.value);
        const primesNettes = n(placement.totalPremiumsNet);
        const plusValues = Math.max(0, valeur - primesNettes);
        const ratioGain = valeur > 0 ? plusValues / valeur : 0;
        const gainBrut = retrait * ratioGain;
        const dateOuv = placement.openDate ? new Date(placement.openDate) : null;
        const ageAns = dateOuv ? (Date.now() - dateOuv.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
        const over8 = ageAns >= 8;
        const abattement = over8 ? (isCouple ? 9200 : 4600) : 0;
        const gainNetAbatt = Math.max(0, gainBrut - abattement);
        if (gainNetAbatt > 0) {
          if (over8) {
            if (primesNettes > 150000) {
              // Partie prop. au-delà de 150k → PFU 30% ; en dessous → PFLi 7.5% + PS 17.2%
              const ratioAbove = Math.min(1, (primesNettes - 150000) / primesNettes);
              avRachatImpot += gainNetAbatt * ratioAbove * 0.30;
              avRachatImpot += gainNetAbatt * (1 - ratioAbove) * (0.075 + 0.172);
            } else {
              avRachatImpot += gainNetAbatt * (0.075 + 0.172);
            }
          } else {
            avRachatImpot += gainNetAbatt * 0.30;
          }
        }
      }
    }
  }

  const deductibleCharges = n(data.perDeduction) + n(data.pensionDeductible) + n(data.otherDeductible);
  const revenuNetGlobal = Math.max(0, salaries + taxableFonciers + taxablePlacements - retainedExpenses - deductibleCharges);

  const baseParts = getBaseFiscalParts(data);
  const childrenParts = getChildrenFiscalParts(data.childrenData);
  const parts = Math.max(1, baseParts + childrenParts + (data.singleParent ? 0.5 : 0));
  const quotient = revenuNetGlobal / parts;

  const brackets: TaxBracket[] = [
    { from: 0, to: 11600, rate: 0 },
    { from: 11600, to: 29579, rate: 0.11 },
    { from: 29579, to: 84577, rate: 0.3 },
    { from: 84577, to: 181917, rate: 0.41 },
    { from: 181917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
  ];

  const taxWithParts = computeTaxFromBrackets(quotient, brackets).tax * parts;
  const taxWithBaseParts = computeTaxFromBrackets(revenuNetGlobal / baseParts, brackets).tax * baseParts;
  const addedHalfParts = Math.max(0, parts - baseParts);
  const qfCap = getQuotientCapPerHalfPart() * (addedHalfParts / 0.5);
  const qfBenefit = Math.max(0, taxWithBaseParts - taxWithParts);
  const quotientFamilialCapAdjustment = qfBenefit > qfCap ? qfBenefit - qfCap : 0;
  const bareme = taxWithParts + quotientFamilialCapAdjustment;
  const bracketFill = computeTaxFromBrackets(quotient, brackets).fill;
  const totalPFU = pfuBase * 0.3;
  const finalIR = bareme + totalPFU + foncierSocialLevy + avRachatImpot;

  const marginalRate = quotient <= 11600 ? 0 : quotient <= 29579 ? 0.11 : quotient <= 84577 ? 0.3 : quotient <= 181917 ? 0.41 : 0.45;
  const averageRate = revenuNetGlobal > 0 ? finalIR / revenuNetGlobal : 0;
  const currentBracket = bracketFill.find((s) => quotient <= s.to) || bracketFill[bracketFill.length - 1];
  const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(quotient, 1);
  const indicatorPct = visualMax > 0 ? Math.min(100, Math.max(0, (quotient / visualMax) * 100)) : 0;

  return {
    salaries, retainedExpenses, foncierBrut, foncierCharges, foncierInterests,
    taxableFonciers, foncierSocialLevy, taxablePlacements, pfuBase, deductibleCharges,
    revenuNetGlobal, finalIR, totalPFU, bareme, quotient, parts,
    quotientFamilialCapAdjustment, qfBenefit, qfCap, marginalRate, averageRate,
    bracketFill, currentBracketLabel: currentBracket.label, indicatorPct, visualMax,
    avRachatImpot,
  };
}

// ─── CALCUL IFI ───────────────────────────────────────────────────────────────

function computeIFI(data: PatrimonialData) {
  const lines = data.properties.map((property) => {
    const fullValue = Math.max(0, n(property.value));
    const debt = Math.max(0, n(property.loanCapitalRemaining));
    const residenceAbatement = property.type === "Résidence principale" ? fullValue * 0.3 : 0;
    const taxableGross = Math.max(0, fullValue - residenceAbatement);
    const deductibleDebt = Math.min(debt, taxableGross);
    const included = property.propertyRight !== "bare";
    const taxableNet = included ? Math.max(0, taxableGross - deductibleDebt) : 0;
    return {
      name: property.name || property.type,
      type: property.type,
      rightMode: property.propertyRight === "usufruct"
        ? "Usufruit imposable en pleine propriété"
        : property.propertyRight === "bare"
          ? "Nue-propriété non retenue"
          : "Pleine propriété",
      taxableNet,
      grossValue: fullValue,
      residenceAbatement,
      deductibleDebt: included ? deductibleDebt : 0,
    };
  });

  const netTaxable = lines.reduce((sum, l) => sum + l.taxableNet, 0);
  const brackets: TaxBracket[] = [
    { from: 0, to: 800000, rate: 0 },
    { from: 800000, to: 1300000, rate: 0.005 },
    { from: 1300000, to: 2570000, rate: 0.007 },
    { from: 2570000, to: 5000000, rate: 0.01 },
    { from: 5000000, to: 10000000, rate: 0.0125 },
    { from: 10000000, to: Number.POSITIVE_INFINITY, rate: 0.015 },
  ];

  const grossIfiCalc = computeTaxFromBrackets(netTaxable, brackets);
  const grossIfi = grossIfiCalc.tax;
  const decote = netTaxable >= 1300000 && netTaxable < 1400000 ? Math.max(0, 17500 - 0.0125 * netTaxable) : 0;
  const ifi = netTaxable > 1300000 ? Math.max(0, grossIfi - decote) : 0;
  const currentBracket = grossIfiCalc.fill.find((s) => netTaxable <= s.to) || grossIfiCalc.fill[grossIfiCalc.fill.length - 1];
  const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(netTaxable, 1);
  const indicatorPct = visualMax > 0 ? Math.min(100, Math.max(0, (netTaxable / visualMax) * 100)) : 0;

  return {
    lines, netTaxable, grossIfi, decote, ifi,
    bracketFill: grossIfiCalc.fill,
    currentBracketLabel: currentBracket.label,
    indicatorPct, visualMax,
  };
}

// ─── CALCUL SUCCESSION ────────────────────────────────────────────────────────

function getSuccessionTaxProfile(relation: string) {
  if (relation === "enfant") {
    return {
      allowance: 100000,
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe",
    };
  }
  if (relation === "frereSoeur") {
    return {
      allowance: 15932,
      brackets: [
        { from: 0, to: 24430, rate: 0.35 },
        { from: 24430, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème frère / sœur",
    };
  }
  if (relation === "neveuNiece") {
    return {
      allowance: 7967,
      brackets: [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.55 }] as TaxBracket[],
      graphTitle: "Barème neveu / nièce",
    };
  }
  return {
    allowance: relation === "conjoint" ? 0 : 1594,
    brackets: relation === "conjoint" ? [] as TaxBracket[] : [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.6 }] as TaxBracket[],
    graphTitle: relation === "conjoint" ? "Exonération conjoint" : "Barème autres héritiers",
  };
}

/**
 * Fiscalité AV :
 * - Avant 70 ans : art. 990 I — abattement 152 500 € / bénéficiaire, puis 20 % jusqu'à 700 k€, 31,25 % au-delà
 * - Après 70 ans : art. 757 B — abattement commun 30 500 € sur les primes (déjà alloué en amont), droits de succession selon barème lien
 *
 * FIX #3 — cette fonction est appelée UNE SEULE FOIS dans avLines ; results la réutilise depuis avLines.
 */
function computeAvTax(relation: string, amountBefore70Capital: number, amountAfter70TaxableShare: number) {
  const isConjoint = relation === "conjoint";
  const before70Taxable = isConjoint ? 0 : Math.max(0, amountBefore70Capital - 152500);
  const before70Tax = isConjoint
    ? 0
    : before70Taxable <= 700000
      ? before70Taxable * 0.2
      : 700000 * 0.2 + (before70Taxable - 700000) * 0.3125;
  const profile = getSuccessionTaxProfile(relation);
  const after70Taxable = isConjoint ? 0 : Math.max(0, amountAfter70TaxableShare - profile.allowance);
  const after70Tax = isConjoint
    ? 0
    : computeTaxFromBrackets(after70Taxable, profile.brackets).tax;
  return {
    before70Tax,
    before70Taxable,
    after70Tax,
    after70Taxable,
    totalTax: before70Tax + after70Tax,
  };
}

function computeSuccession(successionData: SuccessionData, data: PatrimonialData) {
  const testamentMode = successionData.useTestament && successionData.testamentHeirs.length > 0;
  const heirs = testamentMode
    ? buildTestamentHeirs(successionData.testamentHeirs)
    : successionData.heirs.length > 0
      ? successionData.heirs
      : buildCollectedHeirs(data, successionData.deceasedPerson);

  const deceasedKey = successionData.deceasedPerson;
  const survivorKey = deceasedKey === "person1" ? "person2" : "person1";
  const spouseEligible = isSpouseHeirEligible(data);
  const spouseOptions = getAvailableSpouseOptions(data, deceasedKey);
  const allowedSpouseValues = new Set(spouseOptions.map((o) => o.value));
  const spouseOption = spouseEligible && allowedSpouseValues.has(successionData.spouseOption)
    ? successionData.spouseOption
    : spouseOptions[0]?.value || "none";

  const warnings: string[] = [];
  const reserveChildrenCount = data.childrenData.filter((c) => childMatchesDeceased(c.parentLink, deceasedKey)).length;
  const hasNonCommonChildren = testamentMode
    ? false
    : data.childrenData.some((c) => childMatchesDeceased(c.parentLink, deceasedKey) && c.parentLink !== "common_child");
  const usufruitierBirthDate = survivorKey === "person1" ? data.person1BirthDate : data.person2BirthDate;
  const usufruitierAge = getAgeFromBirthDate(usufruitierBirthDate);
  const demembrementPct = getDemembrementPercentages(usufruitierAge);

  if (!spouseEligible && spouseOption !== "none")
    warnings.push("Le conjoint n'a pas de vocation successorale automatique dans cette situation de couple.");
  if (spouseOption === "legal_usufruct_total" && hasNonCommonChildren)
    warnings.push("La totalité en usufruit n'est pas ouverte en dévolution légale en présence d'enfants non communs.");

  // ── Actif successoral immobilier ──
  const propertyLines: SuccessionPropertyLine[] = data.properties.map((property) => {
    const fullValue = Math.max(0, n(property.value));
    const debt = Math.max(0, n(property.loanCapitalRemaining));
    const belongsToDeceased = property.ownership === deceasedKey || property.ownership === "common";
    const baseShare = property.ownership === "common" && data.matrimonialRegime !== "separation_biens" ? 0.5
      : property.ownership === deceasedKey ? 1 : 0;
    const rpAbatementEligible = property.type === "Résidence principale" && belongsToDeceased
      && (spouseEligible || data.childrenData.length > 0);

    let estateValue = 0;
    let note = "";

    if (!belongsToDeceased) {
      note = "Bien hors succession du défunt";
    } else if (property.propertyRight === "usufruct") {
      note = "Usufruit non retenu à l'actif successoral";
    } else if (property.propertyRight === "bare") {
      const usufAge = property.usufructAge ? n(property.usufructAge) : null;
      const dePercent = usufAge !== null ? getDemembrementPercentages(usufAge) : null;
      estateValue = fullValue * baseShare * (dePercent ? dePercent.nuePropriete : 0);
      note = dePercent
        ? `Nue-propriété retenue — CGI art. 669 (âge usufruitier : ${usufAge} ans)`
        : "Nue-propriété non valorisable sans âge de l'usufruitier";
      if (!dePercent)
        warnings.push(`Le bien « ${property.name || property.type} » est en nue-propriété mais l'âge de l'usufruitier n'est pas renseigné.`);
    } else {
      estateValue = fullValue * baseShare;
      note = property.ownership === "common" ? "Part communautaire retenue" : "Bien propre retenu";
    }

    const residenceAbatement = rpAbatementEligible ? estateValue * 0.2 : 0;
    const debtShare = property.ownership === "common" && data.matrimonialRegime !== "separation_biens"
      ? debt * 0.5
      : property.ownership === deceasedKey ? debt : 0;

    return {
      name: property.name || property.type,
      grossEstateValue: estateValue,
      residenceAbatement,
      debtShare,
      netEstateValue: Math.max(0, estateValue - residenceAbatement - debtShare),
      note,
    };
  });

  // ── Actif successoral placements hors AV ──
  const placementLines: SuccessionPlacementLine[] = data.placements.map((placement) => {
    const value = Math.max(0, n(placement.deathValue || placement.value));
    const belongsToDeceased = placement.ownership === deceasedKey || placement.ownership === "common";
    const baseShare = placement.ownership === "common" && data.matrimonialRegime !== "separation_biens" ? 0.5
      : placement.ownership === deceasedKey ? 1 : 0;
    return {
      name: placement.name || placement.type,
      netEstateValue: belongsToDeceased && !isAV(placement.type) ? value * baseShare : 0,
      note: !belongsToDeceased ? "Placement hors succession du défunt"
        : isAV(placement.type) ? "Assurance-vie hors actif successoral classique"
          : placement.ownership === "common" ? "Part communautaire retenue" : "Placement propre retenu",
    };
  });

  // ── Lignes AV — FIX #3 : calcul de la fiscalité ici, réutilisé dans results ──
  const avContracts = data.placements.filter(
    (p) => isAV(p.type) && (p.ownership === deceasedKey || p.ownership === "common")
  );
  const totalAfter70Pool = avContracts.reduce((s, p) => s + Math.max(0, n(p.premiumsAfter70)), 0);
  const totalAfter70TaxablePool = Math.max(0, totalAfter70Pool - 30500);

  const avLines: SuccessionAvLine[] = avContracts.flatMap((placement) => {
    const contractValue = Math.max(0, n(placement.value));
    // Capital exonéré totalement (hors 152 500 € / bénéf.) — ex : conjoint CGI 796-0 bis
    const exemptCapital = Math.min(Math.max(0, n(placement.exemptFromSuccession)), contractValue);
    // Capital taxable (soumis aux règles 990I / 757B)
    const taxableContractValue = contractValue - exemptCapital;
    const before70PremiumPool = Math.max(0, n(placement.premiumsBefore70));
    const after70Pool = Math.max(0, n(placement.premiumsAfter70));
    const totalPremiumPool = before70PremiumPool + after70Pool;
    // Répartition du capital taxable selon les primes (avant/après 70 ans)
    const before70CapRatio = totalPremiumPool > 0 ? before70PremiumPool / totalPremiumPool : 1;
    const before70CapPool = taxableContractValue * before70CapRatio;
    const after70TaxableContractPool = totalAfter70Pool > 0
      ? totalAfter70TaxablePool * (after70Pool / totalAfter70Pool)
      : 0;

    return placement.beneficiaries.map((beneficiary, index) => {
      const sharePct = Math.max(0, n(beneficiary.share));
      const shareRatio = sharePct / 100;
      // Le montant reçu inclut la part exonérée + la part taxable
      const amount = contractValue * shareRatio;
      const amountBefore70Capital = before70CapPool * shareRatio;
      const amountAfter70Premiums = after70Pool * shareRatio;
      const amountAfter70TaxableShare = after70TaxableContractPool * shareRatio;
      const relation = beneficiary.relation || "autre";
      // Calcul de la taxe AV sur la seule part taxable (UNE SEULE FOIS ici)
      const avTax = computeAvTax(relation, amountBefore70Capital, amountAfter70TaxableShare);
      return {
        contract: placement.name || placement.type,
        beneficiary: beneficiary.name || `Bénéficiaire ${index + 1}`,
        relation,
        sharePct,
        amount,
        amountBefore70Capital,
        amountAfter70Premiums,
        amountAfter70TaxableShare,
        before70Tax: avTax.before70Tax,
        after70Tax: avTax.after70Tax,
        totalTax: avTax.totalTax,
      };
    });
  });

  // ── Masses successorales ──
  const propertyEstateBrut = propertyLines.reduce((s, l) => s + l.netEstateValue, 0);
  const placementsSuccession = placementLines.reduce((s, l) => s + l.netEstateValue, 0);
  const furnitureForfait = Math.max(0, (propertyEstateBrut + placementsSuccession) * 0.05);
  const collectedPropertyEstate = propertyEstateBrut + furnitureForfait;
  const activeNet = collectedPropertyEstate + placementsSuccession;

  const eligibleChildren = testamentMode
    ? heirs.filter((h) => h.relation === "enfant")
    : heirs.filter((h) => h.relation === "enfant" && childMatchesDeceased(h.childLink, deceasedKey));
  const childrenCount = eligibleChildren.length;
  const quotiteDisponible = getQuotiteDisponible(reserveChildrenCount);

  let spouseFullFraction = 0;
  let spouseUsufructFraction = 0;
  switch (spouseOption) {
    case "legal_quarter_full": spouseFullFraction = spouseEligible ? 0.25 : 0; break;
    case "legal_usufruct_total": spouseUsufructFraction = spouseEligible && !hasNonCommonChildren ? 1 : 0; break;
    case "ddv_usufruct_total": spouseUsufructFraction = spouseEligible ? 1 : 0; break;
    case "ddv_quarter_full_3q_usufruct":
      spouseFullFraction = spouseEligible ? 0.25 : 0;
      spouseUsufructFraction = spouseEligible ? 0.75 : 0;
      break;
    case "ddv_quotite_disponible": spouseFullFraction = spouseEligible ? quotiteDisponible : 0; break;
  }

  if (reserveChildrenCount > 0 && spouseFullFraction > quotiteDisponible + 1e-9)
    warnings.push("La pleine propriété attribuée au conjoint dépasse la quotité disponible.");
  if (spouseUsufructFraction > 0 && usufruitierAge === null)
    warnings.push("La date de naissance du conjoint survivant doit être renseignée pour valoriser le démembrement.");

  const childNueFraction = spouseUsufructFraction > 0 && childrenCount > 0
    ? (1 - spouseFullFraction) / childrenCount : 0;
  const childFullFraction = spouseUsufructFraction > 0
    ? 0
    : childrenCount > 0 ? Math.max(0, 1 - spouseFullFraction) / childrenCount : 0;

  const legalReserveAmount = reserveChildrenCount > 0 ? activeNet * (1 - quotiteDisponible) : 0;
  const legalDisposableAmount = reserveChildrenCount > 0 ? activeNet * quotiteDisponible : activeNet;

  // ── Résultats par héritier ──
  const results: SuccessionResult[] = heirs.map((heir) => {
    let fraction = 0;
    let nueFraction = 0;
    let usufructFraction = 0;

    if (heir.relation === "conjoint") {
      fraction = spouseFullFraction;
      usufructFraction = spouseUsufructFraction;
    } else if (heir.relation === "enfant" && (testamentMode || childMatchesDeceased(heir.childLink, deceasedKey))) {
      fraction = childFullFraction;
      nueFraction = childNueFraction;
    }

    const grossReceived = activeNet * fraction;
    const nueRawValue = activeNet * nueFraction;
    const nueValue = nueRawValue * demembrementPct.nuePropriete;
    const usufructRawValue = activeNet * usufructFraction;
    // NOTE : usufructTaxValue n'entre PAS dans successionTaxable (FIX #2)
    // Le conjoint est exonéré de droits de succession (CGI art. 796-0 bis).

    // ── AV : réutilisation des données calculées dans avLines (FIX #3) ──
    const avForHeir = avLines.filter((l) => l.beneficiary === heir.name);
    const avReceived = avForHeir.reduce((s, l) => s + l.amount, 0);
    const avDuties = avForHeir.reduce((s, l) => s + l.totalTax, 0);
    const avTaxableBefore70 = avForHeir.reduce((s, l) => s + (computeAvTax(l.relation, l.amountBefore70Capital, l.amountAfter70TaxableShare).before70Taxable), 0);
    const avTaxableAfter70 = avForHeir.reduce((s, l) => s + (computeAvTax(l.relation, l.amountBefore70Capital, l.amountAfter70TaxableShare).after70Taxable), 0);

    // ── Droits de succession (hors AV) ──
    const profile = getSuccessionTaxProfile(heir.relation);
    // FIX #2 : base = grossReceived + nueValue uniquement (pas usufructTaxValue)
    const successionTaxable = Math.max(
      0,
      grossReceived + nueValue - profile.allowance - Math.max(0, n(heir.priorDonations))
    );
    const successionCalc = profile.brackets.length > 0
      ? computeTaxFromBrackets(successionTaxable, profile.brackets)
      : { tax: 0, fill: [] as FilledBracket[] };
    const successionDuties = successionCalc.tax;

    const duties = successionDuties + avDuties;

    // FIX #4 : netReceived cohérent — le conjoint reçoit aussi usufructRawValue économiquement
    const successionNetReceived = Math.max(0, grossReceived + nueRawValue + usufructRawValue - successionDuties);
    const avNetReceived = Math.max(0, avReceived - avDuties);
    const netReceived = successionNetReceived + avNetReceived;

    const currentBracket = successionCalc.fill.find((s) => successionTaxable <= s.to) || successionCalc.fill[successionCalc.fill.length - 1];
    const visualMax = currentBracket ? (Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(successionTaxable, 1)) : 1;
    const indicatorPct = successionTaxable > 0 && visualMax > 0 ? Math.min(100, Math.max(0, (successionTaxable / visualMax) * 100)) : 0;

    return {
      name: heir.name,
      relation: heir.relation,
      fraction, nueFraction, usufructFraction,
      grossReceived, nueRawValue, nueValue, usufructRawValue,
      avReceived, successionTaxable, successionDuties, avDuties, duties,
      netReceived, successionNetReceived, avNetReceived,
      avTaxableBefore70, avTaxableAfter70,
      bracketFill: successionCalc.fill,
      graphTitle: profile.graphTitle,
      allowance: profile.allowance,
      indicatorPct, visualMax,
      currentBracketLabel: currentBracket?.label || "—",
      effectiveReceived: grossReceived + nueRawValue + usufructRawValue + avReceived,
    };
  });

  // ── Graphique de référence (héritier le plus taxé) ──
  const taxableResults = results.filter((r) => r.successionTaxable > 0 && r.bracketFill.length > 0);
  const reference = [...taxableResults].sort((a, b) => b.successionTaxable - a.successionTaxable)[0] || null;
  const successionBracketFill = reference ? reference.bracketFill : [];
  const successionCurrentBracket = reference
    ? successionBracketFill.find((s) => reference.successionTaxable <= s.to) || successionBracketFill[successionBracketFill.length - 1]
    : null;
  const successionVisualMax = successionCurrentBracket
    ? (Number.isFinite(successionCurrentBracket.to) ? successionCurrentBracket.to : Math.max(reference.successionTaxable, 1))
    : 1;
  const successionIndicatorPct = reference ? Math.min(100, Math.max(0, (reference.successionTaxable / successionVisualMax) * 100)) : 0;

  // ── Camemberts ──
  const pieData: PieDatum[] = [
    legalReserveAmount > 0 ? { name: "Réserve légale", holder: `${reserveChildrenCount} enfant(s)`, value: legalReserveAmount } : null,
    legalDisposableAmount > 0 ? { name: reserveChildrenCount > 0 ? "Quotité disponible" : "Masse disponible", holder: spouseEligible ? "Conjoint / disposition" : "Libre disposition", value: legalDisposableAmount } : null,
  ].filter((e): e is PieDatum => Boolean(e));

  const receivedPieData: PieDatum[] = results
    .filter((r) => r.effectiveReceived > 0)
    .map((r) => ({ name: r.name, holder: r.relation, value: r.effectiveReceived }));

  const patrimoineLeguePieData: PieDatum[] = results
    .filter((r) => r.grossReceived + r.nueValue > 0)
    .map((r) => ({ name: r.name, holder: r.grossReceived > 0 ? "PP" : "NP", value: r.grossReceived + r.nueValue }));

  // ── Vérification réserve ──
  const reserveAllocatedToChildren = results
    .filter((r) => r.relation === "enfant")
    .reduce((s, r) => s + r.grossReceived + r.nueRawValue, 0);
  if (reserveChildrenCount > 0 && reserveAllocatedToChildren + 0.5 < legalReserveAmount) {
    warnings.push(`Réserve héréditaire spoliée : les enfants devraient recevoir au moins ${euro(legalReserveAmount)}, mais la simulation ne leur attribue que ${euro(reserveAllocatedToChildren)}.`);
  }

  return {
    deceasedKey, survivorKey, spouseEligible, spouseOptions, spouseOption, quotiteDisponible,
    warnings, activeNet, furnitureForfait,
    totalRights: results.reduce((s, r) => s + r.duties, 0),
    totalSuccessionRights: results.reduce((s, r) => s + r.successionDuties, 0),
    totalAvRights: results.reduce((s, r) => s + r.avDuties, 0),
    collectedPropertyEstate, placementsSuccession, propertyLines, placementLines, avLines, results,
    graphReferenceName: reference?.name || "Aucun héritier taxable",
    graphReferenceTitle: reference?.graphTitle || "Aucun barème applicable",
    bracketFill: successionBracketFill,
    currentBracketLabel: successionCurrentBracket?.label || "—",
    indicatorPct: successionIndicatorPct,
    visualMax: successionVisualMax,
    graphTaxableBase: reference?.successionTaxable || 0,
    testamentMode, reserveChildrenCount,
    pieData, receivedPieData, patrimoineLeguePieData,
    legalReserveAmount, legalDisposableAmount, usufruitierAge, demembrementPct,
  };
}

// ─── DIFF HYPOTHÈSES ──────────────────────────────────────────────────────────

function moneyDiffLine(label: string, baseRaw: number, hypoRaw: number, fiscalArea: string): DifferenceLine | null {
  if (Math.round(baseRaw) === Math.round(hypoRaw)) return null;
  return {
    label,
    baseValue: euro(baseRaw),
    hypothesisValue: euro(hypoRaw),
    impact: hypoRaw > baseRaw ? "up" : "down",
    fiscalArea,
  };
}

function textDiffLine(label: string, baseValue: string, hypoValue: string, fiscalArea: string): DifferenceLine | null {
  const a = (baseValue || "").trim() || "—";
  const b = (hypoValue || "").trim() || "—";
  if (a === b) return null;
  return { label, baseValue: a, hypothesisValue: b, impact: "neutral", fiscalArea };
}

function buildHypothesisDifferenceLines(
  baseData: PatrimonialData | null,
  baseIrOptions: IrOptions | null,
  hypothesisData: PatrimonialData | null,
  hypothesisIrOptions: IrOptions | null,
): DifferenceLine[] {
  if (!baseData || !baseIrOptions || !hypothesisData || !hypothesisIrOptions) return [];
  const lines: DifferenceLine[] = [];
  const push = (l: DifferenceLine | null) => { if (l) lines.push(l); };

  // Revenus
  push(moneyDiffLine("Salaire personne 1", n(baseData.salary1), n(hypothesisData.salary1), "IR"));
  push(moneyDiffLine("Salaire personne 2", n(baseData.salary2), n(hypothesisData.salary2), "IR"));
  push(moneyDiffLine("Pensions", n(baseData.pensions), n(hypothesisData.pensions), "IR"));
  push(moneyDiffLine("Versements PER déductibles", n(baseData.perDeduction), n(hypothesisData.perDeduction), "IR"));
  push(moneyDiffLine("Pensions déductibles", n(baseData.pensionDeductible), n(hypothesisData.pensionDeductible), "IR"));
  push(moneyDiffLine("Autres charges déductibles", n(baseData.otherDeductible), n(hypothesisData.otherDeductible), "IR"));

  // Options IR
  push(textDiffLine("Mode frais P1", baseIrOptions.expenseMode1 === "actual" ? "Frais réels" : "Abattement 10 %", hypothesisIrOptions.expenseMode1 === "actual" ? "Frais réels" : "Abattement 10 %", "IR"));
  push(textDiffLine("Mode frais P2", baseIrOptions.expenseMode2 === "actual" ? "Frais réels" : "Abattement 10 %", hypothesisIrOptions.expenseMode2 === "actual" ? "Frais réels" : "Abattement 10 %", "IR"));
  push(textDiffLine("Régime foncier", baseIrOptions.foncierRegime === "real" ? "Réel" : "Micro-foncier", hypothesisIrOptions.foncierRegime === "real" ? "Réel" : "Micro-foncier", "IR"));
  push(moneyDiffLine("Km P1", n(baseIrOptions.km1), n(hypothesisIrOptions.km1), "IR"));
  push(moneyDiffLine("Km P2", n(baseIrOptions.km2), n(hypothesisIrOptions.km2), "IR"));
  push(moneyDiffLine("Repas P1", n(baseIrOptions.mealCount1) * n(baseIrOptions.mealUnit1), n(hypothesisIrOptions.mealCount1) * n(hypothesisIrOptions.mealUnit1), "IR"));
  push(moneyDiffLine("Repas P2", n(baseIrOptions.mealCount2) * n(baseIrOptions.mealUnit2), n(hypothesisIrOptions.mealCount2) * n(hypothesisIrOptions.mealUnit2), "IR"));

  // Immobilier
  const maxProp = Math.max(baseData.properties.length, hypothesisData.properties.length);
  for (let i = 0; i < maxProp; i++) {
    const bp = baseData.properties[i];
    const hp = hypothesisData.properties[i];
    const label = hp?.name || bp?.name || `Bien ${i + 1}`;
    if (!bp && hp) { push({ label: `Nouveau bien · ${label}`, baseValue: "Absent", hypothesisValue: `${hp.type} · ${euro(hp.value)}`, impact: "up", fiscalArea: "IFI / Succession" }); continue; }
    if (bp && !hp) { push({ label: `Bien supprimé · ${label}`, baseValue: `${bp.type} · ${euro(bp.value)}`, hypothesisValue: "Absent", impact: "down", fiscalArea: "IFI / Succession" }); continue; }
    if (bp && hp) {
      push(textDiffLine(`Type · ${label}`, bp.type, hp.type, "IFI / Succession"));
      push(textDiffLine(`Droit · ${label}`, bp.propertyRight, hp.propertyRight, "IFI / Succession"));
      push(textDiffLine(`Propriétaire · ${label}`, bp.ownership, hp.ownership, "IFI / Succession"));
      push(moneyDiffLine(`Valeur · ${label}`, n(bp.value), n(hp.value), "IFI / Succession"));
      push(moneyDiffLine(`Capital restant dû · ${label}`, n(bp.loanCapitalRemaining), n(hp.loanCapitalRemaining), "IFI / Succession"));
      push(moneyDiffLine(`Loyer brut · ${label}`, n(bp.rentGrossAnnual), n(hp.rentGrossAnnual), "IR"));
    }
  }

  // Placements
  const maxPlac = Math.max(baseData.placements.length, hypothesisData.placements.length);
  for (let i = 0; i < maxPlac; i++) {
    const bl = baseData.placements[i];
    const hl = hypothesisData.placements[i];
    const label = hl?.name || bl?.name || `Placement ${i + 1}`;
    if (!bl && hl) { push({ label: `Nouveau placement · ${label}`, baseValue: "Absent", hypothesisValue: `${hl.type} · ${euro(hl.value)}`, impact: "up", fiscalArea: isAV(hl.type) ? "Succession / AV" : "IR / Succession" }); continue; }
    if (bl && !hl) { push({ label: `Placement supprimé · ${label}`, baseValue: `${bl.type} · ${euro(bl.value)}`, hypothesisValue: "Absent", impact: "down", fiscalArea: isAV(bl.type) ? "Succession / AV" : "IR / Succession" }); continue; }
    if (bl && hl) {
      const area = isAV(bl.type) || isAV(hl.type) ? "Succession / AV" : "IR / Succession";
      push(textDiffLine(`Type · ${label}`, bl.type, hl.type, area));
      push(textDiffLine(`Titulaire · ${label}`, bl.ownership, hl.ownership, area));
      push(moneyDiffLine(`Valeur · ${label}`, n(bl.value), n(hl.value), area));
      push(moneyDiffLine(`Revenu taxable · ${label}`, n(bl.taxableIncome), n(hl.taxableIncome), "IR"));
      push(moneyDiffLine(`Valeur décès · ${label}`, n(bl.deathValue), n(hl.deathValue), "Succession"));
      push(moneyDiffLine(`Primes avant 70 ans · ${label}`, n(bl.premiumsBefore70), n(hl.premiumsBefore70), "Succession / AV"));
      push(moneyDiffLine(`Primes après 70 ans · ${label}`, n(bl.premiumsAfter70), n(hl.premiumsAfter70), "Succession / AV"));
    }
  }

  return lines;
}

// ─── HELPERS DOMAINE ──────────────────────────────────────────────────────────

function placementFiscalSummary(type: string) {
  if (["Livret A", "LDDS", "LEP"].includes(type)) return { ir: "Exonéré", ifi: "Hors assiette", succession: "Actif successoral" };
  if (type === "Compte courant") return { ir: "Sans fiscalité propre", ifi: "Hors assiette", succession: "Actif successoral" };
  if (["Compte à terme", "PEL", "CEL"].includes(type)) return { ir: "Intérêts imposables", ifi: "Hors assiette", succession: "Actif successoral" };
  if (["Compte-titres", "Actions non cotées", "OPCVM / ETF", "PEA"].includes(type)) return { ir: "PFU ou barème", ifi: "Hors assiette", succession: "Actif successoral" };
  if (isAV(type)) return { ir: "Fiscalité de rachat", ifi: "Hors assiette", succession: "990 I / 757 B" };
  return { ir: "À qualifier", ifi: "Hors assiette", succession: "À qualifier" };
}

function propertyNeedsRent(type: string) { return ["Location nue", "LMNP", "LMP", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(type); }
function propertyNeedsPropertyTax(type: string) { return type !== "SCPI"; }
function propertyNeedsInsurance(type: string) { return ["Location nue", "LMNP", "LMP", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(type); }
function propertyNeedsWorks(type: string) { return ["Location nue", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(type); }
function propertyNeedsLoan(type: string) { return ["Résidence principale", "Résidence secondaire", "Location nue", "LMNP", "LMP", "SCI IR", "SCI IS", "SCPI", "Local professionnel", "Autre"].includes(type); }
function placementNeedsTaxableIncome(type: string) { return !["Livret A", "LDDS", "LEP", "Compte courant"].includes(type) && !isAV(type); }
function placementNeedsDeathValue(type: string) { return !isAV(type); }
function isCashPlacement(type: string) { return PLACEMENT_TYPES_BY_FAMILY.cash.includes(type); }
function placementNeedsOpenDate(type: string) { return ["Compte à terme", "PEL", "PEA", "Assurance-vie fonds euros", "Assurance-vie unités de compte", "Contrat de capitalisation", "PER bancaire", "PER assurantiel", "Madelin"].includes(type); }
function placementNeedsPFU(type: string) { return ["Compte à terme", "PEL", "Compte-titres", "Actions non cotées", "OPCVM / ETF"].includes(type); }

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────

function safeFilePart(value: string) {
  return (value || "client").trim().toLowerCase()
    .replace(/[^a-z0-9àâäçéèêëîïôöùûüÿñæœ-]+/gi, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "") || "client";
}

function buildExportFileName(clientName: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ecopatrimoine-${safeFilePart(clientName)}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

// ─── SELF-CHECKS ──────────────────────────────────────────────────────────────

function runSelfChecks() {
  const sample: PatrimonialData = {
    person1FirstName: "A", person1LastName: "B", person1BirthDate: "1980-01-01",
    person1JobTitle: "Cadre", person1Csp: "Cadres et professions intellectuelles supérieures.",
    person2FirstName: "C", person2LastName: "D", person2BirthDate: "1982-01-01",
    person2JobTitle: "Salarié", person2Csp: "Professions Intermédiaires.",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    childrenData: [
      { firstName: "E", lastName: "B", birthDate: "2010-01-01", parentLink: "common_child", custody: "full" },
      { firstName: "F", lastName: "B", birthDate: "2012-01-01", parentLink: "common_child", custody: "alternate" },
      { firstName: "G", lastName: "B", birthDate: "2015-01-01", parentLink: "common_child", custody: "full" },
    ],
    salary1: "40000", salary2: "30000", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0",
    properties: [{
      name: "Locatif", type: "Location nue", ownership: "person1", propertyRight: "full",
      usufructAge: "", value: "300000", propertyTaxAnnual: "1000", rentGrossAnnual: "12000",
      insuranceAnnual: "300", worksAnnual: "500", otherChargesAnnual: "200",
      loanCapitalRemaining: "50000", loanInterestAnnual: "1500",
    }],
    placements: [
      { name: "CT", type: "Compte à terme", ownership: "person1", value: "20000", annualIncome: "", taxableIncome: "", deathValue: "20000", openDate: "", pfuEligible: true, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", beneficiaries: [] },
      { name: "AV", type: "Assurance-vie fonds euros", ownership: "person1", value: "100000", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "", pfuEligible: false, totalPremiumsNet: "100000", premiumsBefore70: "70000", premiumsAfter70: "30000", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", beneficiaries: [{ name: "E B", relation: "enfant", share: "100" }] },
    ],
  };
  const sampleIr: IrOptions = {
    expenseMode1: "standard", expenseMode2: "standard",
    km1: "0", km2: "0", cv1: "0", cv2: "0",
    mealCount1: "0", mealCount2: "0", mealUnit1: "5.35", mealUnit2: "5.35",
    other1: "0", other2: "0", foncierRegime: "micro",
  };
  const sampleSuccession: SuccessionData = {
    deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
    useTestament: false, heirs: [], testamentHeirs: [],
  };

  const ir = computeIR(sample, sampleIr);
  const ifi = computeIFI(sample);
  const succession = computeSuccession(sampleSuccession, sample);
  const diff = buildHypothesisDifferenceLines(sample, sampleIr, { ...sample, perDeduction: "1000" }, sampleIr);
  const clone = deepClone(sample);

  if (!Number.isFinite(ir.finalIR)) throw new Error("IR self-check failed");
  if (!Number.isFinite(ifi.ifi)) throw new Error("IFI self-check failed");
  if (!Number.isFinite(succession.totalRights)) throw new Error("Succession self-check failed");
  if (diff.length === 0) throw new Error("Diff self-check failed");
  if (clone.salary1 !== sample.salary1) throw new Error("deepClone self-check failed");

  // Vérification parts fiscales : 3 enfants (full, alternate, full) = 0.5 + 0.25 + 1 = 1.75
  const expectedParts = getBaseFiscalParts(sample) + getChildrenFiscalParts(sample.childrenData);
  if (Math.abs(expectedParts - 3.75) > 0.001) throw new Error(`Parts fiscales incorrectes : ${expectedParts}`);

  // Vérification FIX #2 : le conjoint marié est exonéré de droits de succession (CGI art. 796-0 bis).
  // Sa base taxable PEUT être non nulle (ex: 1/4 PP reçu), mais ses droits de succession doivent être nuls.
  // Ce qu'on vérifie aussi : usufructTaxValue n'entre plus dans successionTaxable — testé via
  // un scénario usufruit total où la base taxable du conjoint doit rester à 0 (aucune PP reçue).
  const conjointResult = succession.results.find((r) => r.relation === "conjoint");
  if (conjointResult && conjointResult.successionDuties > 0.01)
    throw new Error(`FIX #2 échec — conjoint marié a des droits de succession non nuls : ${conjointResult.successionDuties}`);

  // Vérification spécifique usufruit : avec usufruit total, la base taxable du conjoint doit être nulle
  const successionUsufruit = computeSuccession({ deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_usufruct_total", useTestament: false, heirs: [], testamentHeirs: [] }, { ...sample, childrenData: [sample.childrenData[0]] });
  const conjointUsufruit = successionUsufruit.results.find((r) => r.relation === "conjoint");
  if (conjointUsufruit && conjointUsufruit.successionTaxable > 0.01)
    throw new Error(`FIX #2 échec — conjoint usufruitier a une base taxable non nulle : ${conjointUsufruit.successionTaxable}`);
}

runSelfChecks();

// ─── COMPOSANTS UI ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold tracking-wide" style={{ color: BRAND.sky }}>{label}</Label>
      {children}
    </div>
  );
}

function MoneyField({ label, value, onChange, compact }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; compact?: boolean }) {
  return (
    <Field label={label}>
      <Input
        value={value || ""}
        onChange={onChange}
        className={compact ? "rounded-xl h-8 text-sm border shadow-sm transition-all focus-visible:ring-2" : "rounded-2xl border shadow-sm transition-all focus-visible:ring-2"}
        style={{ background: SURFACE.input, borderColor: SURFACE.inputBorder }}
        inputMode="decimal"
      />
    </Field>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-2xl border shadow-none backdrop-blur-sm" style={{ borderColor: SURFACE.borderStrong, background: `linear-gradient(180deg, ${SURFACE.card} 0%, ${SURFACE.cardSoft} 100%)` }}>
      <CardContent className="p-4">
        <div className="text-sm font-medium" style={{ color: BRAND.sky }}>{label}</div>
        <div className="mt-1 text-xl font-semibold" style={{ color: BRAND.navy }}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function BracketFillChart({ title, data, referenceValue, valueLabel }: {
  title: string; data: FilledBracket[]; referenceValue: number; valueLabel: string;
}) {
  const chartData = data.map((item, index) => ({
    label: item.label,
    filled: Math.round(item.filled),
    tax: Math.round(item.tax),
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const currentIndex = data.findIndex((s) => referenceValue <= s.to);
  const safeIndex = currentIndex >= 0 ? currentIndex : Math.max(0, data.length - 1);
  const currentSlice = data[safeIndex];
  const localMax = currentSlice ? (Number.isFinite(currentSlice.to) ? currentSlice.to : Math.max(referenceValue, 1)) : Math.max(referenceValue, 1);
  const indicatorPct = localMax > 0 ? Math.min(100, Math.max(0, (referenceValue / localMax) * 100)) : 0;

  return (
    <Card className="rounded-2xl border shadow-none backdrop-blur-sm" style={{ borderColor: SURFACE.borderStrong, background: SURFACE.card }}>
      <CardHeader><CardTitle style={{ color: BRAND.navy }}>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">{valueLabel} : <strong>{euro(referenceValue)}</strong></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tranche active : <strong>{currentSlice?.label || "—"}</strong></span>
            <span>{euro(referenceValue)} / {euro(localMax)}</span>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "rgba(81,106,199,0.16)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${indicatorPct}%`, background: `linear-gradient(90deg, ${BRAND.gold} 0%, ${BRAND.blue} 100%)` }} />
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value: number) => euro(value)} />
              <Bar dataKey="filled" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={entry.fill} />)}
                <LabelList dataKey="filled" position="top" formatter={(value: number) => euro(value)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl p-3 shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND.cream} 0%, ${BRAND.gold} 100%)` }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xl font-semibold" style={{ color: BRAND.navy }}>{title}</div>
        <div className="text-sm text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}

function DifferenceBadge({ impact }: { impact: DifferenceLine["impact"] }) {
  if (impact === "up") return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Hausse</span>;
  if (impact === "down") return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Baisse</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Modification</span>;
}

// ─── APP ──────────────────────────────────────────────────────────────────────

// Logo chargé dynamiquement — remplacez ce placeholder par votre fichier PNG via l'interface
const DEFAULT_LOGO_SRC = "data:image/png;base64,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";


// ─── CABINET SETTINGS PERSISTENCE ────────────────────────────────────────────

const CABINET_STORAGE_KEY = "vision_ecopatrimoine_cabinet";
const _isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const _eAPI = _isElectron ? (window as any).electronAPI : null;

function loadCabinetFromStorage() {
  try {
    const raw = localStorage.getItem(CABINET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function loadCabinetAsync(): Promise<Record<string, string> | null> {
  if (_isElectron && _eAPI?.readCabinet) {
    try { return await _eAPI.readCabinet(); } catch {}
  }
  return loadCabinetFromStorage();
}

async function saveCabinetAsync(data: Record<string, string>) {
  // Toujours sauvegarder dans localStorage (web + fallback Electron)
  try { localStorage.setItem(CABINET_STORAGE_KEY, JSON.stringify(data)); } catch {}
  // En Electron : aussi sauvegarder dans le fichier persistant
  if (_isElectron && _eAPI?.writeCabinet) {
    try { await _eAPI.writeCabinet(data); } catch {}
  }
}

const DEFAULT_CABINET = {
  nom: "EcoPatrimoine Conseil",
  forme: "SARL au capital de 1 000 €",
  rcs: "909 388 373",
  villeRcs: "Perpignan",
  adresse: "6 rue des Mirabeau",
  codePostal: "66000",
  ville: "Perpignan",
  tel: "06.22.67.08.69",
  email: "david.perry@ecopatrimoine-conseil.com",
  conseiller: "David PERRY",
  orias: "25006907",
  rcpAssureur: "Matrisk Assurance",
  rcpContrat: "MRCMBR2202508FR00000000066735A00",
  mediateur: "CNPM - MEDIATION DE LA CONSOMMATION",
  mediateurUrl: "https://cnpm-mediation-consommation.eu",
  mediateurAdresse: "Immeuble l'Horizon - Esplanade de France - 3, rue J. Constant Milleret - 42000 SAINT-ETIENNE",
  partenaires: "Abeille Assurances, April, Bnp Paribas Cardif, Eres, Gan Eurocourtage, Swisslife",
  colorNavy: "#101B3B",
  colorSky: "#26428B",
  colorBlue: "#516AC7",
  colorGold: "#E3AF64",
  colorCream: "#FBECD7",
};

function AppInner({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO_SRC);

  // Charger le logo persistant au démarrage
  useEffect(() => {
    loadCabinetAsync().then(saved => {
      if (saved?.logoSrc) setLogoSrc(saved.logoSrc as string);
    });
  }, []);



  const [cabinet, setCabinet] = useState(() => {
    const saved = loadCabinetFromStorage();
    return saved ? { ...DEFAULT_CABINET, ...saved } : DEFAULT_CABINET;
  });

  // En Electron : charger depuis le fichier persistant au démarrage
  useEffect(() => {
    loadCabinetAsync().then(saved => {
      if (saved) setCabinet(prev => ({ ...DEFAULT_CABINET, ...prev, ...saved }));
    });
  }, []);

  const updateCabinet = (key: keyof typeof cabinet, val: string) => {
    setCabinet(prev => {
      const next = { ...prev, [key]: val };
      saveCabinetAsync(next as Record<string, string>);
      return next;
    });
  };
  const { clients, createClient, saveClient, deleteClient, duplicateClient, renameClient } = useClients(userId)
  const [activeClient, setActiveClient] = useState<ClientRecord | null>(null)
  // Couleurs dynamiques tirées des paramètres cabinet
  const CAB = {
    navy: cabinet.colorNavy,
    sky: cabinet.colorSky,
    blue: cabinet.colorBlue,
    gold: cabinet.colorGold,
    cream: cabinet.colorCream,
  };
  const [signatureSrc, setSignatureSrc] = useState<string>("");
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setSignatureSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  // ── Données mission ──
  const [mission, setMission] = useState({
    // Besoins
    besoinSante_depenses: false, besoinSante_hospit: false, besoinSante_depasse: false, besoinSante_surcompl: false,
    besoinPrev_arret: false, besoinPrev_deces: false, besoinPrev_fraisGen: false,
    besoinRetraite_capital: false, besoinRetraite_rente: false, besoinRetraite_moderniser: false,
    besoinEpargne_valoriser: false, besoinEpargne_transmettre: false, besoinEpargne_completer: false, besoinEpargne_projet: false,
    // Rémunération
    remuHonoraire: false, remuCommission: true, remuMixte: false, remuHonoraireMontant: "",
    // Profil investisseur — attitude
    attitude: 0 as 0|8|12|18,
    reactionBaisse: 0 as 0|6|12|18,
    // Profil investisseur — pertes/gains
    aSubiPertes: false, ampleurPertes: "" as ""|-5|-10|-20|-99,
    reactionPertes: 0 as 0|1|2|3,
    aRealiseGains: false, ampleurGains: "" as ""|5|10|20|99,
    reactionGains: 0 as 0|1|2|3,
    modeGestion: "" as ""|"pilote"|"libre",
    // Connaissances financières — tableau
    connaitFondsEuros: false, investiFondsEuros: false,
    connaitActions: false, investiActions: false,
    connaitOPCVM: false, investiOPCVM: false,
    connaitImmo: false, investiImmo: false,
    connaitTrackers: false, investiTrackers: false,
    connaitStructures: false, investiStructures: false,
    // Connaissances financières — questions theorie
    savoirUCRisque: false, savoirHorizonUC: false, savoirRisqueRendement: false,
    // Horizon
    horizon: "" as ""| "0-4" | "5-8" | "9-15" | "15+",
    // Obligations fiscales
    residenceFranceIR: true, residenceFranceIFI: false,
    nationaliteUS: false, residentFiscalUS: false,
    ppe: false, ppeDetails: "",
    // Lieu signature
    lieuSignature: "Perpignan",
  });
  const updateMission = (key: keyof typeof mission, val: unknown) => setMission(prev => ({ ...prev, [key]: val }));
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const newLogo = ev.target.result as string;
        setLogoSrc(newLogo);
        // Persister le logo avec les paramètres cabinet
        saveCabinetAsync({ ...cabinet, logoSrc: newLogo } as Record<string, string>);
      }
    };
    reader.readAsDataURL(file);
  };
  const [clientName, setClientName] = useState("Client");
  const [notes, setNotes] = useState("");
  const [placementFamily, setPlacementFamily] = useState("cash");
  const [data, setData] = useState<PatrimonialData>({
    person1FirstName: "", person1LastName: "", person1BirthDate: "", person1JobTitle: "", person1Csp: "Employés.",
    person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "Employés.",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    childrenData: [], salary1: "", salary2: "", pensions: "",
    perDeduction: "", pensionDeductible: "", otherDeductible: "",
    properties: [], placements: [],
  });
  const [successionData, setSuccessionData] = useState<SuccessionData>({
    deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
    useTestament: false, heirs: [], testamentHeirs: [],
  });
  const [irOptions, setIrOptions] = useState<IrOptions>({
    expenseMode1: "standard", expenseMode2: "standard",
    km1: "", km2: "", cv1: "", cv2: "",
    mealCount1: "", mealCount2: "", mealUnit1: "5.35", mealUnit2: "5.35",
    other1: "", other2: "", foncierRegime: "micro",
  });
  const [exportStatus, setExportStatus] = useState("");
  const [exportFallbackOpen, setExportFallbackOpen] = useState(false);
  const [exportFallbackContent, setExportFallbackContent] = useState("");
  const [exportFallbackFileName, setExportFallbackFileName] = useState("");
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([
    { id: 1, name: "Hypothèse 1", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    { id: 2, name: "Hypothèse 2", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    { id: 3, name: "Hypothèse 3", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
  ]);
  const [baseSnapshot, setBaseSnapshot] = useState<BaseSnapshot>({ savedAt: null, data: null, successionData: null, irOptions: null });

  const person1 = personLabel(data, 1);
  const person2 = personLabel(data, 2);
  const ownerOptions = [
    { value: "person1", label: person1 },
    { value: "person2", label: person2 },
    { value: "common", label: "Communauté" },
  ];

  // ── Setters ──
  const setField = <K extends keyof PatrimonialData>(key: K, value: PatrimonialData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const addChild = () => setData((prev) => ({ ...prev, childrenData: [...prev.childrenData, { firstName: "", lastName: "", birthDate: "", parentLink: "common_child", custody: "full" }] }));
  const updateChild = (index: number, key: keyof Child, value: string) =>
    setData((prev) => ({ ...prev, childrenData: prev.childrenData.map((c, i) => i === index ? { ...c, [key]: value } : c) }));
  const removeChild = (index: number) =>
    setData((prev) => ({ ...prev, childrenData: prev.childrenData.filter((_, i) => i !== index) }));

  const addProperty = (type: string) => setData((prev) => ({
    ...prev,
    properties: [...prev.properties, { name: "", type, ownership: "person1", propertyRight: "full", usufructAge: "", value: "", propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanCapitalRemaining: "", loanInterestAnnual: "" }],
  }));
  const updateProperty = (index: number, key: keyof Property, value: string) =>
    setData((prev) => ({ ...prev, properties: prev.properties.map((p, i) => i === index ? { ...p, [key]: value } : p) }));
  const removeProperty = (index: number) =>
    setData((prev) => ({ ...prev, properties: prev.properties.filter((_, i) => i !== index) }));

  const addPlacement = (type: string) => setData((prev) => ({
    ...prev,
    placements: [...prev.placements, { name: "", type, ownership: "person1", value: "", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "", pfuEligible: placementNeedsPFU(type), totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", beneficiaries: [{ name: "", relation: "autre", share: "100" }] }],
  }));
  const updatePlacementStr = <K extends Exclude<keyof Placement, "pfuEligible" | "beneficiaries">>(index: number, key: K, value: Placement[K]) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, [key]: value } : p) }));
  const updatePlacementBool = (index: number, value: boolean) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, pfuEligible: value } : p) }));
  const removePlacement = (index: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.filter((_, i) => i !== index) }));

  const addPlacementBeneficiary = (placementIndex: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: [...p.beneficiaries, { name: "", relation: "autre", share: "0" }] } : p) }));
  const updatePlacementBeneficiary = (placementIndex: number, bIndex: number, key: keyof Beneficiary, value: string) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: p.beneficiaries.map((b, j) => j === bIndex ? { ...b, [key]: value } : b) } : p) }));
  const removePlacementBeneficiary = (placementIndex: number, bIndex: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: p.beneficiaries.filter((_, j) => j !== bIndex) } : p) }));

  const importFamilyBeneficiaries = (placementIndex: number) => {
    const family = getFamilyBeneficiaries(data);
    setData((prev) => ({
      ...prev,
      placements: prev.placements.map((p, i) => {
        if (i !== placementIndex) return p;
        const existingKeys = new Set(p.beneficiaries.map((b) => `${b.name}__${b.relation}`));
        const merged = [...p.beneficiaries];
        family.forEach((b) => {
          const key = `${b.name}__${b.relation}`;
          if (!existingKeys.has(key)) { merged.push(b); existingKeys.add(key); }
        });
        return { ...p, beneficiaries: merged };
      }),
    }));
  };

  // ── Calculs mémoïsés ──
  const ir = useMemo(() => computeIR(data, irOptions), [data, irOptions]);
  const ifi = useMemo(() => computeIFI(data), [data]);
  const succession = useMemo(() => computeSuccession(successionData, data), [successionData, data]);
  const spouseOptions = useMemo(() => getAvailableSpouseOptions(data, successionData.deceasedPerson), [data, successionData.deceasedPerson]);
  const effectiveSpouseOption = spouseOptions.some((o) => o.value === successionData.spouseOption)
    ? successionData.spouseOption
    : spouseOptions[0]?.value || "none";

  useEffect(() => {
    if (successionData.spouseOption !== effectiveSpouseOption) {
      setSuccessionData((prev) => ({ ...prev, spouseOption: effectiveSpouseOption }));
    }
  }, [effectiveSpouseOption, successionData.spouseOption]);

  useEffect(() => {
    const id = "ecp-scrollbar-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: #e8e0d6 !important; border-radius: 99px; }
      ::-webkit-scrollbar-thumb { background: #26428B !important; border-radius: 99px; border: 2px solid #e8e0d6; transition: background 0.2s; }
      ::-webkit-scrollbar-thumb:hover { background: #1a2e6b !important; }
      ::-webkit-scrollbar-corner { background: #e8e0d6; }
      * { scrollbar-width: thin !important; scrollbar-color: #26428B #e8e0d6 !important; }
      [data-radix-popper-content-wrapper] > * { background: #ffffff !important; }
      [role="listbox"] { background: #ffffff !important; }
      [data-radix-select-content] { background: #ffffff !important; }
      [data-radix-select-viewport] { background: #ffffff !important; }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const baseReference = useMemo(() => {
    if (baseSnapshot.data && baseSnapshot.irOptions && baseSnapshot.successionData) {
      return {
        ir: computeIR(baseSnapshot.data, baseSnapshot.irOptions),
        ifi: computeIFI(baseSnapshot.data),
        succession: computeSuccession(baseSnapshot.successionData, baseSnapshot.data),
      };
    }
    return {
      ir: computeIR(data, irOptions),
      ifi: computeIFI(data),
      succession: computeSuccession(successionData, data),
    };
  }, [baseSnapshot, data, irOptions, successionData]);

  const hypothesisResults = useMemo(() =>
    hypotheses.map((hypothesis) => {
      if (!hypothesis.data || !hypothesis.irOptions || !hypothesis.successionData) {
        return { hypothesis, ir: null, ifi: null, succession: null, differences: [] as DifferenceLine[] };
      }
      return {
        hypothesis,
        ir: computeIR(hypothesis.data, hypothesis.irOptions),
        ifi: computeIFI(hypothesis.data),
        succession: computeSuccession(hypothesis.successionData, hypothesis.data),
        differences: buildHypothesisDifferenceLines(baseSnapshot.data, baseSnapshot.irOptions, hypothesis.data, hypothesis.irOptions),
      };
    }),
    [hypotheses, baseSnapshot]
  );


  // ── Succession ──
  const syncCollectedHeirs = () => setSuccessionData((prev) => ({ ...prev, heirs: buildCollectedHeirs(data, successionData.deceasedPerson) }));
  const addTestamentHeir = () => setSuccessionData((prev) => ({ ...prev, testamentHeirs: [...prev.testamentHeirs, { firstName: "", lastName: "", birthDate: "", relation: "enfant", priorDonations: "0" }] }));
  const updateTestamentHeir = (index: number, key: keyof TestamentHeir, value: string) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h, i) => i === index ? { ...h, [key]: value } : h) }));
  const removeTestamentHeir = (index: number) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.filter((_, i) => i !== index) }));

  // ── Hypothèses ──
  const renameHypothesis = (id: number, name: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, name } : h));
  const updateHypothesisNotes = (id: number, notesValue: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, notes: notesValue } : h));
  const updateHypothesisObjective = (id: number, objectiveValue: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, objective: objectiveValue } : h));
  const saveBaseSnapshot = () =>
    setBaseSnapshot({ savedAt: new Date().toISOString(), data: deepClone(data), successionData: deepClone(successionData), irOptions: deepClone(irOptions) });
  const restoreBaseSnapshot = () => {
    if (!baseSnapshot.data || !baseSnapshot.successionData || !baseSnapshot.irOptions) return;
    setData(deepClone(baseSnapshot.data));
    setSuccessionData(deepClone(baseSnapshot.successionData));
    setIrOptions(deepClone(baseSnapshot.irOptions));
  };
  const saveHypothesis = (id: number) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, savedAt: new Date().toISOString(), data: deepClone(data), successionData: deepClone(successionData), irOptions: deepClone(irOptions) } : h));
  const loadHypothesis = (id: number) => {
    const selected = hypotheses.find((h) => h.id === id);
    if (!selected?.data || !selected.successionData || !selected.irOptions) return;
    setData(deepClone(selected.data));
    setSuccessionData(deepClone(selected.successionData));
    setIrOptions(deepClone(selected.irOptions));
  };
  const clearHypothesis = (id: number) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null } : h));

  // ── PDF ──
  // ── Sauvegarde client et retour liste ──
  const handleSaveAndClose = () => {
    if (!activeClient) return
    const payload: ClientPayload = {
      clientName, notes, data, irOptions, successionData, hypotheses, baseSnapshot, mission,
    }
    const displayName = [(data as any).person1LastName, (data as any).person1FirstName].filter(Boolean).join(' ') || clientName
    saveClient(activeClient.id, payload as ClientPayload, displayName)
    setActiveClient(null)
  }

  const handleOpenClient = (client: ClientRecord) => {
    const p = client.payload
    if (p.clientName) setClientName(p.clientName as string)
    if (p.notes) setNotes(p.notes as string)
    if (p.data) setData(p.data as typeof data)
    if (p.irOptions) setIrOptions(p.irOptions as typeof irOptions)
    if (p.successionData) setSuccessionData(p.successionData as typeof successionData)
    if (p.hypotheses) setHypotheses(p.hypotheses as typeof hypotheses)
    if (p.baseSnapshot) setBaseSnapshot(p.baseSnapshot as typeof baseSnapshot)
    if (p.mission) setMission(p.mission as typeof mission)
    setActiveClient(client)
  }

  const handleCreateClient = (name: string) => {
    const client = createClient(name)
    // Remettre tous les états à zéro pour un nouveau dossier vierge
    setClientName(name)
    setNotes("")
    setData({
      person1FirstName: "", person1LastName: "", person1BirthDate: "", person1JobTitle: "", person1Csp: "Employés.",
      person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "Employés.",
      coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
      childrenData: [], salary1: "", salary2: "", pensions: "",
      perDeduction: "", pensionDeductible: "", otherDeductible: "",
      properties: [], placements: [],
    })
    setSuccessionData({
      deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
      useTestament: false, heirs: [], testamentHeirs: [],
    })
    setIrOptions({
      expenseMode1: "standard", expenseMode2: "standard",
      km1: "", km2: "", cv1: "", cv2: "",
      mealCount1: "", mealCount2: "", mealUnit1: "5.35", mealUnit2: "5.35",
      other1: "", other2: "", foncierRegime: "micro",
    })
    setHypotheses([
      { id: 1, name: "Hypothèse 1", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
      { id: 2, name: "Hypothèse 2", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
      { id: 3, name: "Hypothèse 3", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    ])
    setBaseSnapshot({ savedAt: null, data: null, successionData: null, irOptions: null })
    setActiveClient(client)
  }

  const generatePdf = () => {
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const dateTimeStr = new Date().toLocaleString("fr-FR");
    const immobilierBrut = data.properties.reduce((s, p) => s + n(p.value), 0);
    const immobilierNet = data.properties.reduce((s, p) => s + Math.max(0, n(p.value) - n(p.loanCapitalRemaining)), 0);
    const placementsTotal = data.placements.reduce((s, p) => s + n(p.value), 0);
    const avTotal = data.placements.filter((p) => isAV(p.type)).reduce((s, p) => s + n(p.value), 0);
    const patrimoineTotal = immobilierNet + placementsTotal;
    const coupleLabel = { married: "Marié(s)", pacs: "Pacsé(s)", cohabitation: "Concubinage", single: "Célibataire", divorced: "Divorcé(e)", widowed: "Veuf/Veuve" }[data.coupleStatus] || data.coupleStatus;

    // ── Helpers HTML ──
    const kpi = (label: string, value: string, sub?: string) => `
      <div class="kpi">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
      </div>`;

    const section = (title: string, content: string) => `
      <div class="section">
        <div class="section-title">${title}</div>
        ${content}
      </div>`;

    const table = (headers: string[], rows: string[][], highlight?: number) => `
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row, i) => `<tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
            ${row.map((cell, j) => `<td${j === highlight ? ' class="highlight"' : ""}>${cell}</td>`).join("")}
          </tr>`).join("")}
        </tbody>
      </table>`;

    const delta = (base: number, hypo: number) => {
      const d = hypo - base;
      if (Math.abs(d) < 1) return `<span class="neutral">—</span>`;
      return d > 0
        ? `<span class="neg">+${euro(d)}</span>`
        : `<span class="pos">${euro(d)}</span>`;
    };

    // ── Héritiers ──
    const heirRows = succession.results.map((r) => [
      r.name || "—",
      r.relation,
      euro(r.grossReceived + r.nueRawValue + r.avReceived),
      euro(r.successionTaxable),
      euro(r.avDuties > 0 ? r.avDuties : 0),
      euro(r.duties),
      `<strong>${euro(r.netReceived)}</strong>`,
    ]);

    // ── Hypothèses actives ──
    const activeHypos = hypothesisResults.filter((h) => h.ir && h.ifi && h.succession && h.hypothesis.savedAt);
    const baseIR = ir.finalIR;
    const baseIFI = ifi.ifi;
    const baseSucc = succession.totalRights;

    const hypoDetailBlocks = activeHypos.map((h) => {
      const hIR = h.ir!.finalIR;
      const hIFI = h.ifi!.ifi;
      const hSucc = h.succession!.totalRights;
      const diffIR = hIR - baseIR;
      const diffIFI = hIFI - baseIFI;
      const diffSucc = hSucc - baseSucc;
      const sign = (v: number) => v > 0 ? "+" : "";
      const cls = (v: number) => Math.abs(v) < 1 ? "neutral" : v < 0 ? "pos" : "neg";
      return `
        <div class="hypo-block">
          <div class="hypo-title">${h.hypothesis.name}</div>
          ${h.hypothesis.objective ? `<div class="hypo-objective">Objectif : ${h.hypothesis.objective}</div>` : ""}
          ${h.hypothesis.notes ? `<div class="hypo-notes">${h.hypothesis.notes}</div>` : ""}
          <div class="hypo-grid">
            <div class="hypo-kpi">
              <div class="hypo-kpi-label">IR</div>
              <div class="hypo-kpi-value">${euro(hIR)}</div>
              <div class="hypo-kpi-delta ${cls(diffIR)}">${sign(diffIR)}${euro(diffIR)} vs base</div>
            </div>
            <div class="hypo-kpi">
              <div class="hypo-kpi-label">IFI</div>
              <div class="hypo-kpi-value">${euro(hIFI)}</div>
              <div class="hypo-kpi-delta ${cls(diffIFI)}">${sign(diffIFI)}${euro(diffIFI)} vs base</div>
            </div>
            <div class="hypo-kpi">
              <div class="hypo-kpi-label">Succession</div>
              <div class="hypo-kpi-value">${euro(hSucc)}</div>
              <div class="hypo-kpi-delta ${cls(diffSucc)}">${sign(diffSucc)}${euro(diffSucc)} vs base</div>
            </div>
            <div class="hypo-kpi">
              <div class="hypo-kpi-label">Pression fiscale totale</div>
              <div class="hypo-kpi-value">${euro(hIR + hIFI + hSucc)}</div>
              <div class="hypo-kpi-delta ${cls(diffIR + diffIFI + diffSucc)}">${sign(diffIR + diffIFI + diffSucc)}${euro(diffIR + diffIFI + diffSucc)} vs base</div>
            </div>
          </div>
          ${h.succession!.results.length > 0 ? `
          <div class="hypo-sub-title">Détail succession — ${h.hypothesis.name}</div>
          ${table(
            ["Héritier", "Lien", "Base taxable", "Droits succ.", "Droits AV", "Total droits", "Net estimé"],
            h.succession!.results.map((r) => [
              r.name || "—", r.relation,
              euro(r.successionTaxable), euro(r.successionDuties),
              euro(r.avDuties > 0 ? r.avDuties : 0), euro(r.duties), euro(r.netReceived),
            ]),
            6
          )}` : ""}
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Rapport patrimonial — ${clientName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: ${cabinet.colorNavy}; background: #fff; }

    /* ── PAGE COVER ── */
    .cover {
      min-height: 100vh;
      background: linear-gradient(135deg, ${cabinet.colorNavy} 0%, ${cabinet.colorSky} 45%, ${cabinet.colorBlue} 75%, ${cabinet.colorGold} 100%);
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 60px 56px 48px;
      page-break-after: always;
    }
    .cover-logo-area { display: flex; align-items: center; gap: 16px; }
    .cover-logo { height: 64px; object-fit: contain; }
    .cover-brand { font-size: 22pt; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .cover-brand span { color: #E3AF64; }
    .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
    .cover-doc-type { font-size: 11pt; color: rgba(255,255,255,0.65); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px; }
    .cover-client { font-size: 32pt; font-weight: 700; color: #fff; line-height: 1.15; margin-bottom: 12px; }
    .cover-date { font-size: 11pt; color: rgba(255,255,255,0.7); }
    .cover-divider { width: 64px; height: 3px; background: ${cabinet.colorGold}; margin: 20px 0; border-radius: 2px; }
    .cover-tagline { font-size: 11pt; color: rgba(255,255,255,0.55); font-style: italic; }
    .cover-footer { font-size: 8pt; color: rgba(255,255,255,0.4); border-top: 1px solid rgba(255,255,255,0.15); padding-top: 16px; }

    /* ── PAGE LAYOUT ── */
    .page { padding: 40px 48px; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .page-header { display: flex; justify-content: space-between; align-items: center;
      border-bottom: 2px solid ${cabinet.colorGold}; padding-bottom: 10px; margin-bottom: 28px; }
    .page-header-title { font-size: 15pt; font-weight: 700; color: ${cabinet.colorNavy}; }
    .page-header-client { font-size: 9pt; color: ${cabinet.colorSky}; font-weight: 600; }
    .page-footer { margin-top: 32px; border-top: 1px solid #e5e0d8; padding-top: 10px;
      font-size: 7.5pt; color: #aaa; display: flex; justify-content: space-between; }

    /* ── SECTION ── */
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 11pt; font-weight: 700; color: ${cabinet.colorSky};
      border-left: 3px solid ${cabinet.colorGold}; padding-left: 10px; margin-bottom: 12px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    /* ── KPI GRID ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
    .kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .kpi-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .kpi {
      background: linear-gradient(160deg, ${cabinet.colorCream} 0%, #fff8f0 100%);
      border: 1px solid rgba(227,175,100,0.3); border-radius: 10px;
      padding: 12px 14px;
    }
    .kpi-label { font-size: 7.5pt; color: ${cabinet.colorSky}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .kpi-value { font-size: 15pt; font-weight: 700; color: #101B3B; line-height: 1; }
    .kpi-sub { font-size: 8pt; color: #777; margin-top: 3px; }
    .kpi-accent { background: linear-gradient(160deg, ${cabinet.colorNavy} 0%, ${cabinet.colorSky} 100%); border-color: ${cabinet.colorSky}; }
    .kpi-accent .kpi-label { color: rgba(255,255,255,0.7); }
    .kpi-accent .kpi-value { color: ${cabinet.colorGold}; }
    .kpi-accent .kpi-sub { color: rgba(255,255,255,0.5); }

    /* ── TABLE ── */
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 4px; }
    th {
      background: linear-gradient(90deg, rgba(227,175,100,0.18) 0%, rgba(227,175,100,0.08) 100%);
      text-align: left; padding: 7px 10px; font-weight: 700; color: ${cabinet.colorSky};
      border-bottom: 2px solid rgba(227,175,100,0.4); font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px;
    }
    td { padding: 6px 10px; border-bottom: 1px solid rgba(0,0,0,0.05); vertical-align: top; }
    .row-even { background: #fff; }
    .row-odd { background: rgba(251,236,215,0.2); }
    td.highlight { font-weight: 700; color: #101B3B; }
    tr:last-child td { border-bottom: none; }

    /* ── PROFILE BLOCK ── */
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
    .profile-card {
      background: linear-gradient(160deg, #f8f6f7 0%, #fff 100%);
      border: 1px solid rgba(227,175,100,0.25); border-radius: 10px; padding: 16px 18px;
    }
    .profile-card-title { font-size: 8pt; font-weight: 700; color: #26428B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 1px solid rgba(227,175,100,0.2); padding-bottom: 6px; }
    .profile-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 9pt; }
    .profile-label { color: #666; }
    .profile-value { font-weight: 600; color: #101B3B; }

    /* ── PATRIMOINE DONUT SIMPLE ── */
    .patri-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; margin: 8px 0 4px; }
    .patri-bar-seg { height: 100%; }
    .patri-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; }
    .patri-legend-item { display: flex; align-items: center; gap: 5px; font-size: 8pt; color: #444; }
    .patri-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

    /* ── HYPOTHÈSES ── */
    .hypo-block {
      background: linear-gradient(160deg, #f8f6f7 0%, #fff 100%);
      border: 1px solid rgba(227,175,100,0.3); border-radius: 12px;
      padding: 20px 22px; margin-bottom: 20px;
    }
    .hypo-title { font-size: 13pt; font-weight: 700; color: ${cabinet.colorNavy}; margin-bottom: 4px; }
    .hypo-objective { font-size: 9pt; color: #26428B; font-weight: 600; margin-bottom: 6px; }
    .hypo-notes { font-size: 9pt; color: #555; font-style: italic; background: rgba(227,175,100,0.1); padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; border-left: 3px solid ${cabinet.colorGold}; }
    .hypo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
    .hypo-kpi { background: #fff; border: 1px solid rgba(227,175,100,0.25); border-radius: 8px; padding: 10px 12px; }
    .hypo-kpi-label { font-size: 7.5pt; color: ${cabinet.colorSky}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
    .hypo-kpi-value { font-size: 13pt; font-weight: 700; color: #101B3B; line-height: 1; }
    .hypo-kpi-delta { font-size: 8pt; font-weight: 600; margin-top: 3px; }
    .hypo-sub-title { font-size: 9pt; font-weight: 700; color: ${cabinet.colorSky}; text-transform: uppercase; letter-spacing: 0.3px; margin: 14px 0 8px; padding-left: 8px; border-left: 2px solid #E3AF64; }
    .pos { color: #16a34a; }
    .neg { color: #dc2626; }
    .neutral { color: #888; }

    /* ── COMPARATIF TABLE ── */
    .comp-table th { background: linear-gradient(90deg, rgba(16,27,59,0.08) 0%, transparent 100%); color: #101B3B; }
    .comp-base { font-style: italic; color: #666; }

    /* ── NOTES ── */
    .notes-box {
      background: #f8f6f7; border: 1px solid rgba(227,175,100,0.25); border-radius: 10px;
      padding: 16px 20px; font-size: 9.5pt; white-space: pre-wrap; min-height: 80px;
      color: #333; line-height: 1.6;
    }

    /* ── MENTIONS ── */
    .mentions { font-size: 7.5pt; color: #888; line-height: 1.5; }
    .mentions strong { color: #555; }

    @media print {
      @page { margin: 1.2cm 1.5cm; size: A4; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .kpi, .hypo-block, .profile-card, .hypo-kpi { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

<!-- ════════════════════════════════════════════════
     PAGE 1 — COUVERTURE
════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo-area">
    <img src="${logoSrc}" class="cover-logo" alt="Vision Ecopatrimoine" />
  </div>
  <div class="cover-body">
    <div class="cover-doc-type">Rapport patrimonial</div>
    <div class="cover-client">${clientName || "Client"}</div>
    <div class="cover-date">${dateStr}</div>
    <div class="cover-divider"></div>
    <div class="cover-tagline">Analyse fiscale · Bilan successoral · Scénarios d'optimisation</div>
  </div>
  <div class="cover-footer">
    EcoPatrimoine Conseil · Document confidentiel · Simulation à titre indicatif, ne constitue pas un conseil juridique ou fiscal.
  </div>
</div>

<!-- ════════════════════════════════════════════════
     PAGE 2 — SYNTHÈSE CLIENT
════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Synthèse patrimoniale</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  ${section("Situation personnelle", `
    <div class="profile-grid">
      <div class="profile-card">
        <div class="profile-card-title">Personne 1</div>
        ${data.person1FirstName || data.person1LastName ? `<div class="profile-row"><span class="profile-label">Identité</span><span class="profile-value">${[data.person1FirstName, data.person1LastName].filter(Boolean).join(" ")}</span></div>` : ""}
        ${data.person1BirthDate ? `<div class="profile-row"><span class="profile-label">Date de naissance</span><span class="profile-value">${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}</span></div>` : ""}
        ${data.person1JobTitle ? `<div class="profile-row"><span class="profile-label">Profession</span><span class="profile-value">${data.person1JobTitle}</span></div>` : ""}
        ${data.person1Csp ? `<div class="profile-row"><span class="profile-label">CSP</span><span class="profile-value">${data.person1Csp}</span></div>` : ""}
      </div>
      <div class="profile-card">
        <div class="profile-card-title">Situation familiale</div>
        <div class="profile-row"><span class="profile-label">Statut</span><span class="profile-value">${coupleLabel}</span></div>
        ${data.childrenData.length > 0 ? `<div class="profile-row"><span class="profile-label">Enfants</span><span class="profile-value">${data.childrenData.length} enfant(s)</span></div>` : ""}
        <div class="profile-row"><span class="profile-label">Quotient familial</span><span class="profile-value">${ir.parts} parts</span></div>
        ${data.coupleStatus === "married" ? `<div class="profile-row"><span class="profile-label">Régime matrimonial</span><span class="profile-value">${data.matrimonialRegime || "—"}</span></div>` : ""}
      </div>
    </div>
  `)}

  ${section("Bilan patrimonial", `
    <div class="kpi-grid kpi-grid-3">
      ${kpi("Immobilier brut", euro(immobilierBrut), `Net de dettes : ${euro(immobilierNet)}`)}
      ${kpi("Placements financiers", euro(placementsTotal - avTotal), `Dont assurances-vie : ${euro(avTotal)}`)}
      ${kpi("Patrimoine net total", euro(patrimoineTotal), "Immobilier net + placements")}
    </div>
    ${data.properties.length > 0 ? `
    <div style="margin-top:12px">
    ${table(
      ["Bien", "Type", "Détention", "Valeur brute", "Capital restant dû", "Valeur nette"],
      data.properties.map((p) => [
        p.name || p.type, p.type, p.ownership === "person1" ? (data.person1FirstName || "P1") : p.ownership === "person2" ? (data.person2FirstName || "P2") : "Commun",
        euro(n(p.value)), n(p.loanCapitalRemaining) > 0 ? euro(n(p.loanCapitalRemaining)) : "—",
        euro(Math.max(0, n(p.value) - n(p.loanCapitalRemaining))),
      ])
    )}
    </div>` : ""}
  `)}

  ${(() => {
    // ── Calcul exposition aux marchés ──
    // Placements sécurisés = cash + fonds euros (AV FE + part fonds euros des AV UC)
    // Placements dynamiques = market + retirement + part UC des AV UC
    let securise = 0;
    let dynamique = 0;
    for (const p of data.placements) {
      const val = n(p.value);
      if (PLACEMENT_TYPES_BY_FAMILY.cash.includes(p.type)) {
        securise += val;
      } else if (p.type === "Assurance-vie fonds euros") {
        securise += val;
      } else if (p.type === "Assurance-vie unités de compte") {
        const ucPct = Math.min(100, Math.max(0, n(p.ucRatio) || 100));
        dynamique += val * ucPct / 100;
        securise += val * (100 - ucPct) / 100;
      } else if (p.type === "Contrat de capitalisation") {
        securise += val; // considéré sécurisé par défaut
      } else {
        dynamique += val;
      }
    }
    const total = securise + dynamique;
    if (total <= 0) return "";
    const secPct = Math.round(securise / total * 100);
    const dynPct = 100 - secPct;
    // SVG camembert
    const r = 60; const cx = 80; const cy = 70;
    const toRad = (deg: number) => deg * Math.PI / 180;
    const secAngle = secPct * 3.6;
    const x1 = cx + r * Math.sin(toRad(0));
    const y1 = cy - r * Math.cos(toRad(0));
    const x2 = cx + r * Math.sin(toRad(secAngle));
    const y2 = cy - r * Math.cos(toRad(secAngle));
    const largeArc = secAngle > 180 ? 1 : 0;
    const pie = secPct >= 100
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#4B9CD3" />`
      : secPct <= 0
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8A838" />`
        : `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="#4B9CD3"/>
           <path d="M${cx},${cy} L${x2},${y2} A${r},${r} 0 ${1-largeArc},1 ${x1},${y1} Z" fill="#E8A838"/>`;
    return section("Placements financiers — Exposition aux marchés", `
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        <svg width="160" height="140" viewBox="0 0 160 140" style="flex-shrink:0">
          ${pie}
          <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-weight="bold" fill="#1a2740">${secPct}%</text>
          <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="8" fill="#1a2740">sécurisé</text>
        </svg>
        <div style="flex:1;min-width:200px">
          <div style="margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="width:14px;height:14px;border-radius:3px;background:#4B9CD3;flex-shrink:0"></div>
              <strong>Placements sécurisés : ${euro(securise)} (${secPct}%)</strong>
            </div>
            <div style="font-size:11px;color:#555;margin-left:22px">Livrets, comptes, fonds euros, part fonds euros des AV UC</div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="width:14px;height:14px;border-radius:3px;background:#E8A838;flex-shrink:0"></div>
              <strong>Placements dynamiques : ${euro(dynamique)} (${dynPct}%)</strong>
            </div>
            <div style="font-size:11px;color:#555;margin-left:22px">PEA, CTO, PER, actions, UC des AV unités de compte</div>
          </div>
          ${data.placements.filter(p => p.type === "Assurance-vie unités de compte" && n(p.value) > 0).length > 0 ? `
          <div style="margin-top:12px;font-size:10px;color:#888;font-style:italic">
            Détail AV UC :
            ${data.placements.filter(p => p.type === "Assurance-vie unités de compte" && n(p.value) > 0).map(p => {
              const uc = Math.min(100, Math.max(0, n(p.ucRatio) || 100));
              return `${p.name || "AV UC"} — ${uc}% UC / ${100-uc}% fonds euros`;
            }).join(" · ")}
          </div>` : ""}
        </div>
      </div>
    `);
  })()}

  ${section("Fiscalité — vue d'ensemble", `
    <div class="kpi-grid">
      ${kpi("Impôt sur le revenu", euro(ir.finalIR), `TMI ${Math.round(ir.marginalRate * 100)} % · Taux moyen ${(ir.averageRate * 100).toFixed(1)} %`)}
      ${kpi("IFI", euro(ifi.ifi), ifi.ifi > 0 ? "Patrimoine immobilier net taxable" : "Non assujetti")}
      ${kpi("Droits de succession", euro(succession.totalRights), `Actif successoral : ${euro(succession.activeNet)}`)}
      ${kpi("Pression fiscale totale", euro(ir.finalIR + ifi.ifi + succession.totalRights))}
    </div>
  `)}

  <div class="page-footer">
    <span>EcoPatrimoine Conseil — Rapport confidentiel</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- ════════════════════════════════════════════════
     PAGE 3 — FISCALITÉ DÉTAILLÉE
════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Fiscalité détaillée</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  ${section("Impôt sur le revenu", `
    <div class="kpi-grid">
      ${kpi("IR net à payer", euro(ir.finalIR), "Après abattements et déductions")}
      ${kpi("Revenu net global", euro(ir.revenuNetGlobal))}
      ${kpi("Taux marginal (TMI)", `${Math.round(ir.marginalRate * 100)} %`)}
      ${kpi("Taux moyen effectif", `${(ir.averageRate * 100).toFixed(1)} %`)}
    </div>
    ${table(
      ["Composante", "Montant brut", "Abattement / déduction", "Montant net"],
      [
        ["Salaire(s)", euro(ir.salaries + ir.retainedExpenses), euro(ir.retainedExpenses), euro(ir.salaries)],
        ...(ir.foncierBrut > 0 ? [["Revenus fonciers", euro(ir.foncierBrut), euro(ir.foncierBrut - ir.taxableFonciers), euro(ir.taxableFonciers)]] : []),
        ...(ir.taxablePlacements > 0 ? [["Revenus de capitaux mobiliers", euro(ir.taxablePlacements), "—", euro(ir.taxablePlacements)]] : []),
        ...(ir.deductibleCharges > 0 ? [["Charges déductibles", "—", euro(ir.deductibleCharges), `−${euro(ir.deductibleCharges)}`]] : []),
        ["<strong>Revenu net global imposable</strong>", "", "", `<strong>${euro(ir.revenuNetGlobal)}</strong>`],
      ]
    )}
  `)}

  ${ifi.ifi > 0 ? section("Impôt sur la Fortune Immobilière (IFI)", `
    <div class="kpi-grid kpi-grid-3">
      ${kpi("IFI dû", euro(ifi.ifi), `Barème progressif CGI art. 982`)}
      ${kpi("Patrimoine immobilier brut", euro(ifi.grossIfi || 0))}
      ${kpi("Patrimoine immobilier net taxable", euro(ifi.netTaxable || 0), "Après abattements et dettes")}
    </div>
  `) : section("IFI — Non assujetti", `<p style="color:#666;font-size:9pt;padding:8px 0">Le patrimoine immobilier net est inférieur au seuil d'imposition de 1 300 000 €.</p>`)}

  ${section("Prélèvements sur revenus du capital", `
    <div class="kpi-grid kpi-grid-2">
      ${kpi("PFU / Flat tax (30%)", euro(ir.totalPFU || 0), "Sur placements éligibles au PFU")}
      ${kpi("Prélèvements sociaux (17,2%)", euro(ir.foncierSocialLevy || 0), "Sur revenus fonciers et capitaux")}
    </div>
  `)}

  <div class="page-footer">
    <span>EcoPatrimoine Conseil — Rapport confidentiel</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- ════════════════════════════════════════════════
     PAGE 4 — SUCCESSION
════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Analyse successorale</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  ${section("Masse successorale", `
    <div class="kpi-grid">
      ${kpi("Actif successoral net", euro(succession.activeNet), "Immobilier + placements hors AV")}
      ${kpi("Droits de succession totaux", euro(succession.totalRights), "Ensemble des héritiers")}
      ${kpi("Assurances-vie (hors actif)", euro(avTotal), "Régime fiscal spécifique 990I / 757B")}
      ${kpi("Actif net transmis", euro(succession.activeNet + avTotal - succession.totalRights))}
    </div>
  `)}

  ${succession.results.length > 0 ? section("Répartition par héritier", `
    ${table(
      ["Héritier", "Lien", "Montant reçu", "Base taxable", "Droits AV", "Droits succ.", "Net estimé"],
      heirRows,
      6
    )}
    <p style="font-size:7.5pt;color:#888;margin-top:6px">Les droits AV correspondent à la taxe 990I et/ou droits 757B selon l'âge des versements.</p>
  `) : section("Succession", `<p style="color:#666;font-size:9pt;padding:8px 0">Aucun héritier renseigné ou successeur non identifiable dans les données saisies.</p>`)}

  ${succession.avLines && succession.avLines.length > 0 ? section("Assurances-vie — détail fiscal", `
    ${table(
      ["Contrat", "Bénéficiaire", "Lien", "Capital reçu", "Capital avant 70 ans", "Capital après 70 ans", "Taxe 990I", "Taxe 757B"],
      succession.avLines.map((l) => [
        l.contract, l.beneficiary, l.relation,
        euro(l.amount), euro(l.amountBefore70Capital), euro(l.amountAfter70Premiums),
        euro(l.before70Tax), euro(l.after70Tax),
      ])
    )}
  `) : ""}

  ${succession.warnings && succession.warnings.length > 0 ? `
    <div class="section">
      <div class="section-title">Points d'attention</div>
      <ul style="font-size:9pt;color:#dc6e00;padding-left:18px;line-height:1.8">
        ${succession.warnings.map((w) => `<li>${w}</li>`).join("")}
      </ul>
    </div>` : ""}

  <div class="page-footer">
    <span>EcoPatrimoine Conseil — Rapport confidentiel</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- ════════════════════════════════════════════════
     PAGE 5+ — HYPOTHÈSES & COMPARAISONS
════════════════════════════════════════════════ -->
${activeHypos.length > 0 ? `
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Hypothèses & scénarios</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  ${section("Tableau comparatif des scénarios", `
    <table class="comp-table">
      <thead>
        <tr>
          <th>Scénario</th>
          <th>IR estimé</th>
          <th>Δ IR</th>
          <th>IFI</th>
          <th>Δ IFI</th>
          <th>Succession</th>
          <th>Δ Succession</th>
          <th>Total charges</th>
          <th>Δ Total</th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-even">
          <td class="comp-base"><em>Situation actuelle (base)</em></td>
          <td>${euro(baseIR)}</td><td>—</td>
          <td>${euro(baseIFI)}</td><td>—</td>
          <td>${euro(baseSucc)}</td><td>—</td>
          <td><strong>${euro(baseIR + baseIFI + baseSucc)}</strong></td><td>—</td>
        </tr>
        ${activeHypos.map((h, i) => {
          const hIR = h.ir!.finalIR, hIFI = h.ifi!.ifi, hSucc = h.succession!.totalRights;
          return `<tr class="${i % 2 === 0 ? "row-odd" : "row-even"}">
            <td><strong>${h.hypothesis.name}</strong></td>
            <td>${euro(hIR)}</td><td>${delta(baseIR, hIR)}</td>
            <td>${euro(hIFI)}</td><td>${delta(baseIFI, hIFI)}</td>
            <td>${euro(hSucc)}</td><td>${delta(baseSucc, hSucc)}</td>
            <td><strong>${euro(hIR + hIFI + hSucc)}</strong></td>
            <td>${delta(baseIR + baseIFI + baseSucc, hIR + hIFI + hSucc)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    <p style="font-size:7.5pt;color:#888;margin-top:6px">
      <span class="pos">Vert</span> = économie fiscale · <span class="neg">Rouge</span> = surcoût fiscal
    </p>
  `)}

  ${hypoDetailBlocks}

  <div class="page-footer">
    <span>EcoPatrimoine Conseil — Rapport confidentiel</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>` : ""}

<!-- ════════════════════════════════════════════════
     DERNIÈRE PAGE — NOTES & MENTIONS
════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Notes & mentions légales</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  ${section("Notes de synthèse du conseiller", `
    <div class="notes-box">${notes || "Aucune note saisie."}</div>
  `)}

  ${section("Mentions légales et limitations", `
    <div class="mentions">
      <p><strong>Nature du document :</strong> Ce rapport est un document de simulation établi sur la base des informations communiquées par le client. Il est fourni à titre indicatif et ne constitue pas un conseil en investissement, un conseil juridique ou un conseil fiscal au sens des réglementations en vigueur (MIF2, DDA).</p><br/>
      <p><strong>Limites des calculs :</strong> Les calculs d'impôt sur le revenu, d'IFI et de droits de succession sont des estimations basées sur la législation fiscale en vigueur à la date d'édition. Ils ne tiennent pas compte de toutes les situations particulières, de l'évolution réglementaire future, ni de certains dispositifs spécifiques (pacte Dutreil, démembrement complexe, SCI, holding patrimoniale…).</p><br/>
      <p><strong>Confidentialité :</strong> Ce document est strictement confidentiel et destiné exclusivement au(x) client(s) mentionné(s) en page de couverture. Toute reproduction ou diffusion est interdite sans l'accord préalable d'EcoPatrimoine Conseil.</p><br/>
      <p><strong>Validité :</strong> Ce document est valable à la date de son édition. Toute modification de situation personnelle, patrimoniale ou fiscale peut rendre ces simulations caduques. Une mise à jour régulière est recommandée.</p><br/>
      <p>Document généré le <strong>${dateTimeStr}</strong> par EcoPatrimoine Conseil.</p>
    </div>
  `)}

  <div class="page-footer">
    <span>EcoPatrimoine Conseil — Rapport confidentiel</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

</body>
</html>`;

    const popup = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
    if (!popup) {
      alert("Le navigateur a bloqué l'ouverture de la fenêtre. Autorise les popups pour ce site.");
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    // Petit délai pour que les styles soient appliqués avant l'impression
    setTimeout(() => { popup.print(); }, 400);
  };

  // ── PDF Lettre de mission ──
  const generateMissionPdf = () => {
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const dateTimeStr = new Date().toLocaleString("fr-FR");
    const immobilierNet = data.properties.reduce((s, p) => s + Math.max(0, n(p.value) - n(p.loanCapitalRemaining)), 0);
    const placementsTotal = data.placements.reduce((s, p) => s + n(p.value), 0);
    const coupleLabel: Record<string, string> = { married: "Marié(s)", pacs: "Pacsé(s)", cohabitation: "Concubinage", single: "Célibataire", divorced: "Divorcé(e)" };
    const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || "—";
    const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ") || "—";

    // Calcul profil investisseur
    const pts = mission.attitude + mission.reactionBaisse +
      (mission.connaitFondsEuros ? 1 : 0) + (mission.investiFondsEuros ? 1 : 0) +
      (mission.connaitActions ? 1 : 0) + (mission.investiActions ? 3 : 0) +
      (mission.connaitOPCVM ? 1 : 0) + (mission.investiOPCVM ? 3 : 0) +
      (mission.connaitImmo ? 1 : 0) + (mission.investiImmo ? 2 : 0) +
      (mission.connaitTrackers ? 1 : 0) + (mission.investiTrackers ? 3 : 0) +
      (mission.connaitStructures ? 1 : 0) + (mission.investiStructures ? 4 : 0) +
      (mission.reactionPertes||0) + (mission.reactionGains||0) +
      (mission.modeGestion==="pilote"?2:mission.modeGestion==="libre"?4:0) +
      (mission.savoirUCRisque?2:0) + (mission.savoirHorizonUC?2:0) + (mission.savoirRisqueRendement?2:0);
    const profil = pts <= 10 ? "Sécuritaire" : pts <= 20 ? "Prudent" : pts <= 40 ? "Équilibré" : pts <= 60 ? "Dynamique" : "Offensif";

    const cb = (v: boolean) => v ? `<span style="display:inline-block;width:13px;height:13px;border:2px solid #26428B;border-radius:3px;background:#26428B;margin-right:6px;vertical-align:middle"></span>` : `<span style="display:inline-block;width:13px;height:13px;border:2px solid #aaa;border-radius:3px;margin-right:6px;vertical-align:middle"></span>`;
    const rb = (checked: boolean) => checked ? `<span style="display:inline-block;width:13px;height:13px;border-radius:50%;border:2px solid #26428B;background:#26428B;margin-right:6px;vertical-align:middle"></span>` : `<span style="display:inline-block;width:13px;height:13px;border-radius:50%;border:2px solid #aaa;margin-right:6px;vertical-align:middle"></span>`;

    const horizonLabel: Record<string, string> = { "0-4": "0 à 4 ans", "5-8": "5 à 8 ans", "9-15": "9 à 15 ans", "15+": "+ de 15 ans" };

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Lettre de mission — ${clientName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #101B3B; background: #fff; }
    .page { padding: 36px 48px; page-break-after: always; }
    .page:last-child { page-break-after: auto; }

    /* COVER */
    .cover { min-height: 100vh; background: linear-gradient(135deg, ${cabinet.colorNavy} 0%, ${cabinet.colorSky} 45%, ${cabinet.colorBlue} 75%, ${cabinet.colorGold} 100%);
      display: flex; flex-direction: column; justify-content: space-between; padding: 60px 56px 48px; page-break-after: always; }
    .cover-logo { height: 64px; object-fit: contain; }
    .cover-doc-type { font-size: 11pt; color: rgba(255,255,255,0.65); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px; }
    .cover-client { font-size: 30pt; font-weight: 700; color: #fff; line-height: 1.15; margin-bottom: 10px; }
    .cover-date { font-size: 11pt; color: rgba(255,255,255,0.7); }
    .cover-divider { width: 64px; height: 3px; background: #E3AF64; margin: 18px 0; border-radius: 2px; }
    .cover-tagline { font-size: 11pt; color: rgba(255,255,255,0.55); font-style: italic; }
    .cover-footer { font-size: 8pt; color: rgba(255,255,255,0.4); border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px; }

    /* PAGE HEADER/FOOTER */
    .page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${cabinet.colorGold}; padding-bottom: 10px; margin-bottom: 24px; }
    .page-header-title { font-size: 14pt; font-weight: 700; color: #101B3B; }
    .page-header-client { font-size: 9pt; color: #26428B; font-weight: 600; }
    .page-footer { margin-top: 28px; border-top: 1px solid #e5e0d8; padding-top: 10px; font-size: 7.5pt; color: #aaa; display: flex; justify-content: space-between; }

    /* SECTION */
    .section { margin-bottom: 20px; }
    .section-title { font-size: 10.5pt; font-weight: 700; color: #fff; background: ${cabinet.colorSky}; padding: 5px 12px; margin-bottom: 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }

    /* KPI */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; }
    .kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .kpi { background: linear-gradient(160deg, ${cabinet.colorCream} 0%, #fff8f0 100%); border: 1px solid rgba(227,175,100,0.3); border-radius: 8px; padding: 10px 12px; }
    .kpi-label { font-size: 7pt; color: ${cabinet.colorSky}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px; }
    .kpi-value { font-size: 13pt; font-weight: 700; color: #101B3B; }
    .kpi-sub { font-size: 7.5pt; color: #777; margin-top: 2px; }

    /* TABLE */
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 4px; }
    th { background: rgba(227,175,100,0.18); text-align: left; padding: 6px 9px; font-weight: 700; color: #26428B; border-bottom: 2px solid rgba(227,175,100,0.4); font-size: 7.5pt; text-transform: uppercase; }
    td { padding: 5px 9px; border-bottom: 1px solid rgba(0,0,0,0.05); vertical-align: top; }
    tr:nth-child(even) { background: rgba(251,236,215,0.18); }

    /* LEGAL */
    .legal-block { background: #f8f6f7; border: 1px solid rgba(227,175,100,0.22); border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; font-size: 9pt; line-height: 1.6; }
    .legal-block ul { padding-left: 18px; }
    .legal-block li { margin-bottom: 4px; }
    .legal-title { font-weight: 700; color: #26428B; margin-bottom: 6px; }
    .legal-sub { font-size: 8pt; color: #666; font-style: italic; margin-bottom: 8px; }

    /* BESOINS */
    .besoins-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .besoin-card { border: 2px solid #dc2626; border-radius: 8px; padding: 12px 14px; }
    .besoin-card-title { font-weight: 700; font-size: 10pt; text-align: center; margin-bottom: 10px; color: #101B3B; }
    .besoin-item { margin-bottom: 5px; font-size: 8.5pt; line-height: 1.4; display: flex; align-items: flex-start; gap: 2px; }

    /* PROFIL */
    .profil-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 10px 0; }
    .profil-table th { background: ${cabinet.colorNavy}; color: #fff; padding: 6px 10px; text-align: left; }
    .profil-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
    .profil-highlight { background: rgba(227,175,100,0.3) !important; font-weight: 700; }

    /* PROFIL RADIO */
    .radio-group { display: flex; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
    .radio-item { display: flex; align-items: center; gap: 5px; font-size: 8.5pt; }

    /* SIGNATURE */
    .sign-box { border: 1px dashed #aaa; border-radius: 8px; min-height: 80px; padding: 12px; margin-top: 8px; background: #fafafa; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
    .sign-label { font-weight: 700; font-size: 9pt; margin-bottom: 4px; color: #26428B; }
    .sign-name { font-size: 9pt; color: #555; margin-top: 4px; }
    .sign-check { display: flex; align-items: flex-start; gap: 8px; font-size: 8.5pt; line-height: 1.5; margin-bottom: 6px; }

    /* NOTES */
    .notes-box { background: #f8f6f7; border: 1px solid rgba(227,175,100,0.25); border-radius: 8px; padding: 14px 18px; font-size: 9pt; white-space: pre-wrap; min-height: 60px; color: #333; line-height: 1.6; }

    @media print {
      @page { margin: 1.2cm 1.5cm; size: A4; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .kpi, .besoin-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

<!-- PAGE 1 : COUVERTURE -->
<div class="cover">
  <div><img src="${logoSrc}" class="cover-logo" alt="Logo" /></div>
  <div>
    <div class="cover-doc-type">Lettre de mission & Fiche Information et Conseil</div>
    <div class="cover-client">${clientName || "Client"}</div>
    <div class="cover-date">${dateStr}</div>
    <div class="cover-divider"></div>
    <div class="cover-tagline">En application des articles L.521-2 et R.521-2 du code des assurances</div>
  </div>
  <div class="cover-footer">${cabinet.nom} · ORIAS n° ${cabinet.orias} · Document confidentiel</div>
</div>

<!-- PAGE 2 : SYNTHÈSE PATRIMONIALE CHIFFRÉE -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Synthèse patrimoniale</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  <div class="section">
    <div class="section-title">Situation personnelle</div>
    <table>
      <tr><th>Personne 1</th><th>Personne 2</th><th>Situation</th><th>Enfants</th></tr>
      <tr>
        <td>${p1}${data.person1BirthDate ? `<br/><span style="color:#666;font-size:8pt">${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}</span>` : ""}</td>
        <td>${p2}${data.person2BirthDate ? `<br/><span style="color:#666;font-size:8pt">${new Date(data.person2BirthDate).toLocaleDateString("fr-FR")}</span>` : ""}</td>
        <td>${coupleLabel[data.coupleStatus] || data.coupleStatus || "—"}</td>
        <td>${data.childrenData.length > 0 ? `${data.childrenData.length} enfant(s)` : "Aucun"}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Bilan fiscal estimé</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">IR estimé</div><div class="kpi-value">${euro(ir.finalIR)}</div><div class="kpi-sub">TMI ${Math.round(ir.marginalRate * 100)} % · Taux moyen ${(ir.averageRate * 100).toFixed(1)} %</div></div>
      <div class="kpi"><div class="kpi-label">IFI estimé</div><div class="kpi-value">${euro(ifi.ifi)}</div><div class="kpi-sub">${ifi.ifi > 0 ? `Base nette : ${euro(ifi.netTaxable)}` : "Non assujetti"}</div></div>
      <div class="kpi"><div class="kpi-label">Droits de succession</div><div class="kpi-value">${euro(succession.totalRights)}</div><div class="kpi-sub">Actif : ${euro(succession.activeNet)}</div></div>
      <div class="kpi"><div class="kpi-label">Patrimoine net total</div><div class="kpi-value">${euro(immobilierNet + placementsTotal)}</div><div class="kpi-sub">Immo. net + placements</div></div>
    </div>
    <div class="kpi-grid kpi-grid-3">
      <div class="kpi"><div class="kpi-label">Immobilier net</div><div class="kpi-value">${euro(immobilierNet)}</div></div>
      <div class="kpi"><div class="kpi-label">Placements financiers</div><div class="kpi-value">${euro(placementsTotal)}</div><div class="kpi-sub">Dont AV : ${euro(data.placements.filter(p => isAV(p.type)).reduce((s,p) => s + n(p.value), 0))}</div></div>
      <div class="kpi"><div class="kpi-label">Revenu net global</div><div class="kpi-value">${euro(ir.revenuNetGlobal)}</div><div class="kpi-sub">${ir.parts} parts fiscales</div></div>
    </div>
  </div>

  ${(() => {
    let securise2 = 0;
    let dynamique2 = 0;
    for (const p of data.placements) {
      const val = n(p.value);
      if (PLACEMENT_TYPES_BY_FAMILY.cash.includes(p.type)) {
        securise2 += val;
      } else if (p.type === "Assurance-vie fonds euros") {
        securise2 += val;
      } else if (p.type === "Assurance-vie unités de compte") {
        const ucPct = Math.min(100, Math.max(0, n(p.ucRatio) || 100));
        dynamique2 += val * ucPct / 100;
        securise2 += val * (100 - ucPct) / 100;
      } else if (p.type === "Contrat de capitalisation") {
        securise2 += val;
      } else {
        dynamique2 += val;
      }
    }
    const total2 = securise2 + dynamique2;
    if (total2 <= 0) return "";
    const secPct2 = Math.round(securise2 / total2 * 100);
    const dynPct2 = 100 - secPct2;
    const r2 = 50; const cx2 = 65; const cy2 = 58;
    const toRad2 = (deg: number) => deg * Math.PI / 180;
    const secAngle2 = secPct2 * 3.6;
    const x1b = cx2 + r2 * Math.sin(toRad2(0));
    const y1b = cy2 - r2 * Math.cos(toRad2(0));
    const x2b = cx2 + r2 * Math.sin(toRad2(secAngle2));
    const y2b = cy2 - r2 * Math.cos(toRad2(secAngle2));
    const la2 = secAngle2 > 180 ? 1 : 0;
    const pie2 = secPct2 >= 100
      ? `<circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="#4B9CD3" />`
      : secPct2 <= 0
        ? `<circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="#E8A838" />`
        : `<path d="M${cx2},${cy2} L${x1b},${y1b} A${r2},${r2} 0 ${la2},1 ${x2b},${y2b} Z" fill="#4B9CD3"/>
           <path d="M${cx2},${cy2} L${x2b},${y2b} A${r2},${r2} 0 ${1-la2},1 ${x1b},${y1b} Z" fill="#E8A838"/>`;
    return `<div class="section">
      <div class="section-title">Exposition aux marchés financiers</div>
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <svg width="130" height="116" viewBox="0 0 130 116" style="flex-shrink:0">
          ${pie2}
          <text x="${cx2}" y="${cy2+3}" text-anchor="middle" font-size="10" font-weight="bold" fill="#1a2740">${secPct2}%</text>
          <text x="${cx2}" y="${cy2+13}" text-anchor="middle" font-size="7" fill="#1a2740">sécurisé</text>
        </svg>
        <div style="flex:1;min-width:180px;font-size:9pt">
          <div style="margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <div style="width:12px;height:12px;border-radius:2px;background:#4B9CD3;flex-shrink:0"></div>
              <strong>Sécurisé : ${euro(securise2)} (${secPct2}%)</strong>
            </div>
            <div style="font-size:8pt;color:#555;margin-left:18px">Livrets, fonds euros, comptes</div>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <div style="width:12px;height:12px;border-radius:2px;background:#E8A838;flex-shrink:0"></div>
              <strong>Dynamique : ${euro(dynamique2)} (${dynPct2}%)</strong>
            </div>
            <div style="font-size:8pt;color:#555;margin-left:18px">PEA, CTO, PER, UC des AV</div>
          </div>
        </div>
      </div>
    </div>`;
  })()}

  ${notes ? `<div class="section"><div class="section-title">Notes conseiller</div><div class="notes-box">${notes}</div></div>` : ""}

  <div class="page-footer">
    <span>${cabinet.nom} · Lettre de mission confidentielle</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- PAGE 3 : INFORMATIONS GÉNÉRALES LÉGALES -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Informations générales</div>
    <div class="page-header-client">En application de l'article L.521-2 du code des assurances</div>
  </div>

  <div class="section">
    <div class="section-title">Qui sommes-nous ?</div>
    <div class="legal-block">
      <p><strong>${cabinet.nom}</strong>, ${cabinet.forme}, est immatriculée au RCS de ${cabinet.villeRcs} sous le n° ${cabinet.rcs} et a son siège social au ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}.</p>
      <br/>
      <p><strong>${cabinet.nom}</strong> est immatriculée à l'ORIAS (<a href="https://www.orias.fr">https://www.orias.fr</a>) sous le n° <strong>${cabinet.orias}</strong> en qualité de Courtier d'assurance.</p>
      <br/>
      <p>L'autorité en charge du contrôle de nos opérations est l'<strong>ACPR</strong> (Autorité de Contrôle Prudentiel et de Résolution), située 4 place de Budapest CS 92459, 75436 Paris Cédex 09.</p>
      <br/>
      <p>Vous pouvez nous joindre :</p>
      <ul>
        <li>par téléphone : <strong>${cabinet.tel}</strong></li>
        <li>par email : <strong>${cabinet.email}</strong></li>
      </ul>
      <br/>
      <p>Conformément à la loi, nous disposons d'une <strong>Responsabilité Civile Professionnelle</strong> couvrant nos activités :</p>
      <ul>
        <li>RCP souscrite auprès de : ${cabinet.rcpAssureur}</li>
        <li>Numéro de contrat : ${cabinet.rcpContrat}</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Comment exerçons-nous ?</div>
    <div class="legal-block">
      <p>Nous exerçons notre activité selon les dispositions prévues à l'article L521-2, II, 1°, b du code des Assurances. En ce sens :</p>
      <ul>
        <li>nous ne sommes soumis à aucune obligation de travailler avec une ou plusieurs entreprises d'assurances.</li>
        <li>notre analyse porte exclusivement sur le(s) produit(s) proposé(s) par nos partenaires et non sur une analyse exhaustive de tous les produits du marché.</li>
      </ul>
      <br/>
      <p>Liste non exhaustive des partenaires sélectionnés : ${cabinet.partenaires}. La liste exhaustive vous sera communiquée sur simple demande.</p>
      <br/>
      <p>Notre accompagnement repose sur un <em>« contrôle de cohérence »</em>. Nous vérifions que les garanties et services inclus dans le(s) produit(s) d'assurance que nous vous proposons correspondent aux exigences et besoins que vous avez exprimés.</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Comment sommes-nous rémunérés ?</div>
    <div class="legal-block">
      <p>Dans le cadre de la commercialisation des produits d'assurance, nous sommes rémunérés :</p>
      <br/>
      <p>${cb(mission.remuHonoraire)} d'un honoraire payé directement par le souscripteur${mission.remuHonoraire && mission.remuHonoraireMontant ? ` — montant : <strong>${mission.remuHonoraireMontant}</strong>` : ""}</p>
      <p style="margin-top:6px">${cb(mission.remuCommission)} d'une commission (rémunération incluse dans la prime d'assurance)</p>
      <p style="margin-top:6px">${cb(mission.remuMixte)} d'une combinaison honoraire + commission</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Liens capitalistiques</div>
    <div class="legal-block">
      <div class="legal-sub">En application de l'article R.521-1, II du code des assurances</div>
      <p>Notre société n'entretient pas de relation significative et de nature capitalistique ou commerciale avec une entreprise d'assurance.</p>
    </div>
  </div>

  <div class="page-footer">
    <span>${cabinet.nom} · Lettre de mission confidentielle</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- PAGE 4 : INFORMATIONS PERSONNELLES CLIENT -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Vos informations personnelles</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  <div class="section">
    <div class="section-title">État civil — Personne 1</div>
    <table>
      <tr><td style="width:25%;font-weight:600">Nom</td><td>${data.person1LastName || "—"}</td><td style="width:25%;font-weight:600">Prénom</td><td>${data.person1FirstName || "—"}</td></tr>
      <tr><td style="font-weight:600">Date de naissance</td><td>${data.person1BirthDate ? new Date(data.person1BirthDate).toLocaleDateString("fr-FR") : "—"}</td><td style="font-weight:600">Profession</td><td>${data.person1JobTitle || "—"}</td></tr>
      <tr><td style="font-weight:600">CSP</td><td>${data.person1Csp || "—"}</td><td style="font-weight:600">Régime social</td><td>—</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Situation familiale</div>
    <table>
      <tr><td style="width:30%;font-weight:600">Situation maritale</td><td>${coupleLabel[data.coupleStatus] || "—"}</td><td style="width:30%;font-weight:600">Régime matrimonial</td><td>${data.matrimonialRegime || "—"}</td></tr>
    </table>
    ${(data.coupleStatus === "married" || data.coupleStatus === "pacs") ? `
    <br/><strong style="font-size:9pt;color:#26428B">Informations conjoint / partenaire de PACS</strong>
    <table style="margin-top:6px">
      <tr><td style="width:25%;font-weight:600">Nom</td><td>${data.person2LastName || "—"}</td><td style="width:25%;font-weight:600">Prénom</td><td>${data.person2FirstName || "—"}</td></tr>
      <tr><td style="font-weight:600">Date de naissance</td><td>${data.person2BirthDate ? new Date(data.person2BirthDate).toLocaleDateString("fr-FR") : "—"}</td><td style="font-weight:600">Profession</td><td>${data.person2JobTitle || "—"}</td></tr>
    </table>` : ""}
    ${data.childrenData.length > 0 ? `
    <br/><strong style="font-size:9pt;color:#26428B">Enfants</strong>
    <table style="margin-top:6px">
      <thead><tr><th>Prénom</th><th>Date de naissance</th><th>Lien</th></tr></thead>
      <tbody>${data.childrenData.map(c => `<tr><td>${[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td><td>${c.birthDate ? new Date(c.birthDate).toLocaleDateString("fr-FR") : "—"}</td><td>${c.parentLink || "—"}</td></tr>`).join("")}</tbody>
    </table>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Obligations fiscales</div>
    <div class="legal-block">
      <p><strong>Votre foyer fiscal est-il imposé en France :</strong></p>
      <p style="margin-top:8px">${rb(mission.residenceFranceIR)} À l'impôt sur le revenu ?  &nbsp;&nbsp; ${rb(!mission.residenceFranceIR)} Non</p>
      <p style="margin-top:6px">${rb(mission.residenceFranceIFI)} À l'impôt sur la Fortune Immobilière ? &nbsp;&nbsp; ${rb(!mission.residenceFranceIFI)} Non</p>
      <br/>
      <p><strong>FATCA :</strong></p>
      <p style="margin-top:6px">${rb(mission.nationaliteUS)} Nationalité américaine &nbsp;&nbsp; ${rb(!mission.nationaliteUS)} Non</p>
      <p style="margin-top:6px">${rb(mission.residentFiscalUS)} Résident fiscal aux États-Unis &nbsp;&nbsp; ${rb(!mission.residentFiscalUS)} Non</p>
      <br/>
      <p><strong>Personne Politiquement Exposée :</strong> ${rb(mission.ppe)} Oui &nbsp;&nbsp; ${rb(!mission.ppe)} Non ${mission.ppeDetails ? `<br/><em style="color:#555">${mission.ppeDetails}</em>` : ""}</p>
    </div>
  </div>

  <div class="page-footer">
    <span>${cabinet.nom} · Lettre de mission confidentielle</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- PAGE 5 : VOS BESOINS -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Vos besoins</div>
    <div class="page-header-client">${clientName} · ${dateStr}</div>
  </div>

  <p style="font-size:9pt;margin-bottom:16px;font-style:italic">Lors de notre entretien vous avez exprimé le(s) besoin(s) suivant(s) :</p>

  <div class="besoins-grid">
    <div class="besoin-card">
      <div class="besoin-card-title">Votre besoin Santé</div>
      <div class="besoin-item">${cb(mission.besoinSante_depenses)} Couvrir vos dépenses de santé, optique, dentaire, médecine</div>
      <div class="besoin-item">${cb(mission.besoinSante_hospit)} Prise en charge de l'hospitalisation seule</div>
      <div class="besoin-item">${cb(mission.besoinSante_depasse)} Prise en charge des dépassements d'honoraires</div>
      <div class="besoin-item">${cb(mission.besoinSante_surcompl)} Sur-complémentaire</div>
    </div>
    <div class="besoin-card">
      <div class="besoin-card-title">Votre besoin Prévoyance</div>
      <div class="besoin-item">${cb(mission.besoinPrev_arret)} Maintenir votre rémunération en cas d'arrêt de travail, d'invalidité</div>
      <div class="besoin-item">${cb(mission.besoinPrev_deces)} Protéger votre famille en cas de décès</div>
      <div class="besoin-item">${cb(mission.besoinPrev_fraisGen)} Couvrir vos frais généraux professionnels</div>
    </div>
    <div class="besoin-card">
      <div class="besoin-card-title">Votre besoin Retraite</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_capital)} Constituer un capital en vue de disposer de revenus complémentaires</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_rente)} Constituer un capital retraite à convertir en rente viagère</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_moderniser)} Moderniser un contrat existant</div>
    </div>
    <div class="besoin-card">
      <div class="besoin-card-title">Votre besoin Épargne</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_valoriser)} Valoriser un capital en faisant fructifier votre épargne</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_transmettre)} Transmettre un capital en bénéficiant des avantages fiscaux de l'assurance-vie</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_completer)} Compléter vos revenus</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_projet)} Épargner en vue d'un projet en constituant progressivement un capital</div>
    </div>
  </div>

  <div class="section" style="margin-top:16px">
    <div class="section-title">Profil investisseur</div>

    <p style="font-size:8.5pt;margin-bottom:8px"><strong>Q1 — Variations acceptables :</strong></p>
    <div class="radio-group">
      <div class="radio-item">${rb(mission.attitude === 0)} Portefeuille A — Sécurisé (0 pt)</div>
      <div class="radio-item">${rb(mission.attitude === 8)} Portefeuille B — Prudent (8 pts)</div>
      <div class="radio-item">${rb(mission.attitude === 12)} Portefeuille C — Équilibré (12 pts)</div>
      <div class="radio-item">${rb(mission.attitude === 18)} Portefeuille D — Dynamique (18 pts)</div>
    </div>

    <p style="font-size:8.5pt;margin:10px 0 8px"><strong>Q2 — Réaction face à une baisse :</strong></p>
    <div class="radio-group" style="flex-direction:column;gap:4px">
      <div class="radio-item">${rb(mission.reactionBaisse === 0)} Je récupèrerais mon investissement (0 pt)</div>
      <div class="radio-item">${rb(mission.reactionBaisse === 6)} J'attendrais, et si la situation ne s'améliore pas, je m'en séparerais (6 pts)</div>
      <div class="radio-item">${rb(mission.reactionBaisse === 12)} Cela ne me poserait pas de problème : les marchés sont imprévisibles (12 pts)</div>
      <div class="radio-item">${rb(mission.reactionBaisse === 18)} Je penserais à augmenter mon investissement — opportunité ! (18 pts)</div>
    </div>

    <p style="font-size:8.5pt;margin:10px 0 8px"><strong>Q3 — Expérience et connaissances financières :</strong></p>
    <table>
      <thead><tr>
        <th></th>
        <th style="text-align:center">Je connais les risques (1 pt)</th>
        <th style="text-align:center">Déjà investi 3 ans</th>
      </tr></thead>
      <tbody>
        <tr><td>Fonds euros</td><td style="text-align:center">${cb(mission.connaitFondsEuros)}</td><td style="text-align:center">${cb(mission.investiFondsEuros)} 1 pt</td></tr>
        <tr><td>Actions / obligations</td><td style="text-align:center">${cb(mission.connaitActions)}</td><td style="text-align:center">${cb(mission.investiActions)} 3 pts</td></tr>
        <tr><td>OPCVM (fonds actions, mixtes)</td><td style="text-align:center">${cb(mission.connaitOPCVM)}</td><td style="text-align:center">${cb(mission.investiOPCVM)} 3 pts</td></tr>
        <tr><td>Immobilier (SCPI, OPCI, SCI)</td><td style="text-align:center">${cb(mission.connaitImmo)}</td><td style="text-align:center">${cb(mission.investiImmo)} 2 pts</td></tr>
        <tr><td>Trackers / ETF (fonds indiciels)</td><td style="text-align:center">${cb(mission.connaitTrackers)}</td><td style="text-align:center">${cb(mission.investiTrackers)} 3 pts</td></tr>
        <tr><td>Produits structurés (EMTN…)</td><td style="text-align:center">${cb(mission.connaitStructures)}</td><td style="text-align:center">${cb(mission.investiStructures)} 4 pts</td></tr>
      </tbody>
    </table>

    ${(() => {
      const pertesHtml = mission.aSubiPertes ? (
        "<p style=\"font-size:7.5pt;margin-top:6px\">Ampleur : " + (mission.ampleurPertes === -5 ? "0 à -5%" : mission.ampleurPertes === -10 ? "-6% à -10%" : mission.ampleurPertes === -20 ? "-11% à -20%" : mission.ampleurPertes === -99 ? "Supérieure à -20%" : "—") + "</p>" +
        "<p style=\"font-size:7.5pt\">Réaction : " + (mission.reactionPertes === 1 ? "J\'ai vendu (1 pt)" : mission.reactionPertes === 2 ? "J\'ai attendu (2 pts)" : mission.reactionPertes === 3 ? "J\'ai réinvesti (3 pts)" : "—") + "</p>"
      ) : "";
      const gainsHtml = mission.aRealiseGains ? (
        "<p style=\"font-size:7.5pt;margin-top:6px\">Ampleur : " + (mission.ampleurGains === 5 ? "0 à 5%" : mission.ampleurGains === 10 ? "6% à 10%" : mission.ampleurGains === 20 ? "11% à 20%" : mission.ampleurGains === 99 ? "Supérieure à 20%" : "—") + "</p>" +
        "<p style=\"font-size:7.5pt\">Réaction : " + (mission.reactionGains === 1 ? "J\'ai tout vendu (1 pt)" : mission.reactionGains === 2 ? "J\'ai attendu (2 pts)" : mission.reactionGains === 3 ? "J\'ai réinvesti (3 pts)" : "—") + "</p>"
      ) : "";
      if (!mission.aSubiPertes && !mission.aRealiseGains) return "";
      return "<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0\">" +
        "<div style=\"background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:10px\">" +
          "<p style=\"font-size:8pt;font-weight:700;color:#b91c1c;margin-bottom:6px\">Q4a — Pertes subies</p>" +
          "<p style=\"font-size:8pt\">" + rb(mission.aSubiPertes) + " Oui " + rb(!mission.aSubiPertes) + " Non</p>" +
          pertesHtml +
        "</div>" +
        "<div style=\"background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px\">" +
          "<p style=\"font-size:8pt;font-weight:700;color:#15803d;margin-bottom:6px\">Q4b — Gains réalisés</p>" +
          "<p style=\"font-size:8pt\">" + rb(mission.aRealiseGains) + " Oui " + rb(!mission.aRealiseGains) + " Non</p>" +
          gainsHtml +
        "</div>" +
      "</div>";
    })()}

    <p style="font-size:8.5pt;margin:10px 0 6px"><strong>Q5 — Mode de gestion :</strong></p>
    <div class="radio-group" style="flex-direction:column;gap:4px">
      <div class="radio-item">${rb(mission.modeGestion === "pilote")} Gestion pilotée — je délègue à des professionnels (2 pts)</div>
      <div class="radio-item">${rb(mission.modeGestion === "libre")} Gestion libre — je gère moi-même (4 pts)</div>
    </div>

    <p style="font-size:8.5pt;margin:10px 0 6px"><strong>Q6 — Connaissances financières :</strong></p>
    <div style="font-size:8.5pt;line-height:1.8">
      <div>${cb(mission.savoirUCRisque)} Un support UC présente un risque de perte en capital (Oui = 2 pts)</div>
      <div>${cb(mission.savoirHorizonUC)} Plus l'horizon est long, plus la part en UC peut être élevée (Oui = 2 pts)</div>
      <div>${cb(mission.savoirRisqueRendement)} Plus le risque est élevé, plus l'espérance de rendement est élevée (Oui = 2 pts)</div>
    </div>

    <p style="font-size:8.5pt;margin:10px 0 6px"><strong>Horizon de placement :</strong></p>
    <div class="radio-group">
      <div class="radio-item">${rb(mission.horizon === "0-4")} 0 à 4 ans (0 pt)</div>
      <div class="radio-item">${rb(mission.horizon === "5-8")} 5 à 8 ans (4 pts)</div>
      <div class="radio-item">${rb(mission.horizon === "9-15")} 9 à 15 ans (8 pts)</div>
      <div class="radio-item">${rb(mission.horizon === "15+")} + de 15 ans (16 pts)</div>
    </div>

    <div style="background:${cabinet.colorNavy};color:${cabinet.colorGold};border-radius:8px;padding:10px 16px;margin-top:12px;font-size:9pt;font-weight:700">
      Score total : ${pts} points &nbsp;|&nbsp; Profil déterminé : ${profil}
    </div>
    ${(() => {
      const descriptions: Record<string, string> = {
        "Sécuritaire": "La préservation du capital est votre priorité. Portefeuille composé quasi-exclusivement d'actifs sans risque (fonds euros). Rentabilité faible mais capital garanti.",
        "Prudent": "Vous acceptez une légère exposition aux marchés. Allocation cible : ~70% obligataire, ~30% actions. Priorité à la stabilité.",
        "Équilibré": "Compromis sécurité/performance. Allocation cible : ~50% obligataire, ~50% actions. Fluctuations modérées acceptées sur le moyen terme.",
        "Dynamique": "Objectif de croissance patrimoniale. ~60–80% actions. Tolérance aux variations significatives à court terme pour viser une performance supérieure.",
        "Offensif": "Performance maximale. ~80–100% actions. Forte tolérance à la volatilité, vision long terme indispensable.",
      };
      const horizonNotes: Record<string, string> = {
        "Sécuritaire": "Adapté à tout horizon de placement.",
        "Prudent": "Horizon recommandé : 3 ans minimum.",
        "Équilibré": "Horizon recommandé : 5–7 ans pour lisser les fluctuations.",
        "Dynamique": "Horizon recommandé : 8 ans minimum.",
        "Offensif": "Horizon recommandé : 10 ans et plus.",
      };
      const horizonLabels: Record<string, string> = { "0-4": "court terme (0–4 ans)", "5-8": "moyen terme (5–8 ans)", "9-15": "long terme (9–15 ans)", "15+": "très long terme (+ 15 ans)" };
      const horizonStr = mission.horizon ? (horizonLabels[mission.horizon] || "") : "";
      const horizonPhrase = horizonStr ? " Horizon déclaré : " + horizonStr + "." : "";
      return "<div style=\"background:#f8f6f7;border:1px solid rgba(38,66,139,0.2);border-radius:8px;padding:10px 14px;margin-top:8px;font-size:8.5pt;line-height:1.6\">" +
        "<strong>" + descriptions[profil] + "</strong>" + horizonPhrase +
        "<br/><em style=\"color:#666\">" + horizonNotes[profil] + "</em></div>";
    })()}
  </div>

  <div class="page-footer">
    <span>${cabinet.nom} · Lettre de mission confidentielle</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- PAGE 6 : RÉCLAMATION + RGPD -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Réclamation & Politique de confidentialité</div>
    <div class="page-header-client">En application des articles R.521-1 et RGPD</div>
  </div>

  <div class="section">
    <div class="section-title">En cas de réclamation</div>
    <div class="legal-block">
      <div class="legal-sub">En application de l'article R.521-1, I du code des assurances</div>
      <p>Si votre réclamation porte sur un contrat d'assurance lui-même, adressez votre réclamation directement à la compagnie d'assurance en cause.</p>
      <br/>
      <p>Si vous souhaitez formuler une réclamation relative aux services fournis par notre société, vous pouvez nous contacter :</p>
      <ul>
        <li>par voie postale : ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}</li>
        <li>par courrier électronique : ${cabinet.email}</li>
      </ul>
      <br/>
      <p>Nous accuserons réception dans un délai de <strong>10 jours ouvrables</strong> et apporterons une réponse dans un délai maximum de <strong>2 mois</strong>.</p>
      <br/>
      <p>Conformément aux articles L.616-1 et R.616-1 du code de la consommation, l'entité de médiation retenue est : <strong>${cabinet.mediateur}</strong>.</p>
      <p>En cas de litige : <a href="${cabinet.mediateurUrl}">${cabinet.mediateurUrl}</a> ou par voie postale : ${cabinet.mediateurAdresse}.</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Politique de confidentialité (RGPD)</div>
    <div class="legal-block">
      <p>Les données collectées vous concernant seront conservées pendant toute la durée de nos relations contractuelles, puis en archive pendant <strong>5 ans</strong>.</p>
      <br/>
      <p><strong>Finalités :</strong> traitement des demandes de souscription, conformité réglementaire (TRACFIN), traitement des réclamations.</p>
      <br/>
      <p><strong>Vos droits :</strong> conformément à la Loi Informatique et Libertés n°78-17 du 6 janvier 1978, vous bénéficiez d'un droit d'accès, de rectification, d'effacement, d'opposition et de portabilité. Pour exercer ces droits : ${cabinet.email}</p>
      <br/>
      <p>Vous pouvez déposer une réclamation auprès de la CNIL : <a href="https://www.cnil.fr">www.cnil.fr</a></p>
      <p>Opposition au démarchage téléphonique : <a href="https://www.bloctel.gouv.fr">www.bloctel.gouv.fr</a></p>
    </div>
  </div>

  <div class="page-footer">
    <span>${cabinet.nom} · Lettre de mission confidentielle</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

<!-- PAGE 7 : SIGNATURE -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">Signature</div>
    <div class="page-header-client">En application de l'article R.521-2 du code des assurances</div>
  </div>

  <p style="font-size:9pt;margin-bottom:14px">Je déclare et reconnais :</p>
  ${[
    "avoir reçu et pris connaissance du contenu du présent document d'information et de conseil.",
    "que les renseignements renseignés ci-dessus sont complets, sincères et exacts.",
    "avoir reçu une information claire sur les principales caractéristiques de(s) contrat(s) proposé(s) ainsi que sur l'étendue, la définition des risques et des garanties proposées.",
    "m'engager à informer EcoPatrimoine Conseil de toute modification concernant ma situation personnelle et patrimoniale.",
    "avoir été informé(e) que nous sommes susceptibles de ne pas vous fournir l'intégralité des services que nous proposons dans le cas où vous refuseriez de compléter tout ou partie du présent document.",
    "qu'une fausse déclaration ou réticence peut entraîner la nullité de votre contrat (art. L113-8 du code des assurances) ou la majoration de la cotisation (art. L113-9 du code des assurances).",
  ].map(item => `<div class="sign-check">${cb(false)} ${item}</div>`).join("")}

  <p style="margin-top:16px;font-size:9pt">Fait à : <strong>${mission.lieuSignature}</strong></p>
  <p style="margin-top:6px;font-size:9pt">Le : <strong>${dateStr}</strong></p>

  <div class="sign-grid">
    <div>
      <div class="sign-label">Signature du client</div>
      <div class="sign-name">${clientName}</div>
      <div class="sign-box"></div>
    </div>
    <div>
      <div class="sign-label">Signature du conseiller</div>
      <div class="sign-name">${cabinet.conseiller}</div>
      <div class="sign-box">${signatureSrc ? `<img src="${signatureSrc}" alt="Signature" style="max-height:70px;max-width:200px;object-fit:contain" />` : ""}</div>
    </div>
  </div>

  <div class="page-footer" style="margin-top:24px">
    <span>${cabinet.nom} · ORIAS n° ${cabinet.orias} · ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}</span>
    <span>Généré le ${dateTimeStr}</span>
  </div>
</div>

</body>
</html>`;

    const popup = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
    if (!popup) { alert("Le navigateur a bloqué l'ouverture de la fenêtre. Autorise les popups pour ce site."); return; }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => { popup.print(); }, 500);
  };

  // ── Export JSON ──
  const exportDataFile = async () => {
    try {
      setExportStatus("");
      const payload = { version: 2, exportedAt: new Date().toISOString(), clientName, notes, data, successionData, irOptions, hypotheses, baseSnapshot };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const fileName = buildExportFileName(clientName);
      const pickerWindow = window as FilePickerWindow;
      if (pickerWindow.showSaveFilePicker) {
        const handle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName, types: [{ description: "Fichier Ecopatrimoine", accept: { "application/json": [".json"] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setExportStatus(`Fichier enregistré : ${fileName}`);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = fileName; anchor.rel = "noopener noreferrer"; anchor.style.display = "none";
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => { anchor.parentNode?.removeChild(anchor); window.URL.revokeObjectURL(url); }, 500);
      setExportStatus(`Téléchargement lancé : ${fileName}`);
    } catch (error) {
      console.error("Export impossible", error);
      const payload = { version: 2, exportedAt: new Date().toISOString(), clientName, notes, data, successionData, irOptions, hypotheses, baseSnapshot };
      const fallbackJson = JSON.stringify(payload, null, 2);
      const fallbackFileName = buildExportFileName(clientName);
      setExportFallbackContent(fallbackJson); setExportFallbackFileName(fallbackFileName); setExportFallbackOpen(true);
      setExportStatus("L'aperçu bloque l'enregistrement direct. Utilise la fenêtre qui s'ouvre.");
    }
  };

  const copyExportFallback = async () => {
    try {
      await navigator.clipboard.writeText(exportFallbackContent);
      setExportStatus(`Contenu copié. Enregistre-le dans un fichier nommé ${exportFallbackFileName}.`);
    } catch { setExportStatus("Copie automatique impossible. Sélectionne le contenu manuellement."); }
  };

  // ── Import JSON ──
  const importDataFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (parsed.clientName !== undefined) setClientName(String(parsed.clientName || "Client"));
        if (parsed.notes !== undefined) setNotes(String(parsed.notes || ""));
        if (parsed.data) setData(parsed.data as PatrimonialData);
        if (parsed.successionData) setSuccessionData(parsed.successionData as SuccessionData);
        if (parsed.irOptions) setIrOptions(parsed.irOptions as IrOptions);
        if (Array.isArray(parsed.hypotheses)) setHypotheses(parsed.hypotheses as Hypothesis[]);
        if (parsed.baseSnapshot) setBaseSnapshot(parsed.baseSnapshot as BaseSnapshot);
      } catch (error) { console.error("Import impossible", error); }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // Guard — Client actif

  if (!activeClient) {
    return (
      <ClientManager
        clients={clients}
        onOpen={handleOpenClient}
        onCreate={handleCreateClient}
        onDelete={deleteClient}
        onDuplicate={(id) => { const c = duplicateClient(id); if (c) handleOpenClient(c) }}
        onRename={renameClient}
        logoSrc={logoSrc}
        cabinetName={cabinet.nom}
        colorNavy={cabinet.colorNavy}
        colorGold={cabinet.colorGold}
        colorSky={cabinet.colorSky}
        colorCream={cabinet.colorCream}
      />
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll" style={{ background: SURFACE.app, scrollbarWidth: "thin", scrollbarColor: "#26428B #e8e0d6", scrollbarGutter: "stable" }}>
      <div className="mx-auto max-w-7xl p-6 space-y-6">

        {/* ── Header ── */}
        <Card className="overflow-hidden rounded-[28px] border-0 shadow-2xl shadow-slate-300/40">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${CAB.gold} 0%, ${CAB.cream} 55%, #fff7ea 100%)` }} />
          <CardContent className="px-6 py-5 md:px-10 md:py-6" style={{ background: `linear-gradient(135deg, ${CAB.navy} 0%, ${CAB.sky} 38%, ${CAB.blue} 68%, ${CAB.gold} 100%)` }}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <button onClick={handleSaveAndClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "10px", padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  ← Dossiers
                </button>
                <button onClick={() => { handleSaveAndClose(); onSignOut(); }} style={{ background: "rgba(255,255,255,0.10)", border: "none", borderRadius: "10px", padding: "6px 14px", color: "rgba(255,255,255,0.7)", fontSize: "12px", cursor: "pointer" }}>
                  Déconnexion
                </button>
                <img src={logoSrc} alt="Vision Ecopatrimoine" className="h-16 w-auto object-contain md:h-20 drop-shadow-md" />
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Client</label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="h-9 w-48 rounded-xl border-0 bg-white/95 text-sm shadow-md shadow-slate-950/10"
                    placeholder="Nom du client"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl border-0 bg-white/90 px-3 text-sm font-medium text-[#101B3B] shadow-sm hover:bg-white" onClick={() => { void exportDataFile(); }}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />Sauvegarder
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border-0 bg-white/90 px-3 text-sm font-medium text-[#101B3B] shadow-sm transition hover:bg-white">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />Charger
                    <input type="file" accept="application/json" className="hidden" onChange={importDataFile} />
                  </label>
                  <Button className="h-9 rounded-xl px-3 text-sm font-medium shadow-md" style={{ background: BRAND.gold, color: BRAND.navy }} onClick={generatePdf}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />PDF Rapport
                  </Button>
                  <Button className="h-9 rounded-xl px-3 text-sm font-medium shadow-md" style={{ background: BRAND.navy, color: "#fff" }} onClick={generateMissionPdf}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />PDF Mission
                  </Button>
                </div>
              </div>
            </div>
            {exportStatus && <div className="mt-2 text-xs text-white/70">{exportStatus}</div>}
          </CardContent>
        </Card>

        {/* ── Dialogue export fallback ── */}
        <Dialog open={exportFallbackOpen} onOpenChange={setExportFallbackOpen}>
          <DialogContent className="max-w-4xl rounded-2xl">
            <DialogHeader><DialogTitle style={{ color: BRAND.navy }}>Sauvegarde manuelle des données</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                L'aperçu bloque l'enregistrement direct. Copie le contenu ci-dessous et enregistre-le dans un fichier nommé <strong>{exportFallbackFileName}</strong>.
              </div>
              <Button className="rounded-xl" style={{ background: BRAND.navy }} onClick={() => { void copyExportFallback(); }}>Copier le contenu</Button>
              <Textarea value={exportFallbackContent} readOnly className="min-h-[420px] rounded-xl font-mono text-xs" />
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Navigation ── */}
        <Tabs defaultValue="collecte" className="space-y-6">
          <div className="flex gap-2" style={{ alignItems: "stretch" }}>
            <TabsList className="flex-1 grid grid-cols-6 rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              {(["collecte", "ir", "ifi", "succession", "hypotheses", "rapport"] as const).map((tab) => {
                const labels: Record<string, string> = { collecte: "Collecte patrimoniale", ir: "Impôt sur le revenu", ifi: "IFI", succession: "Succession", hypotheses: "Hypothèses", rapport: "Rapport client" };
                return (
                  <TabsTrigger key={tab} value={tab} className="flex items-center justify-center rounded-xl border border-transparent px-4 text-center text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                    {labels[tab]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsList className="rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              <TabsTrigger value="mission" className="flex items-center justify-center rounded-xl border border-transparent px-4 text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                📋 Mission
              </TabsTrigger>
            </TabsList>
            <TabsList className="rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              <TabsTrigger value="parametres" title="Paramètres cabinet" className="flex items-center justify-center rounded-xl border border-transparent px-3 text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                <Settings className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ════ COLLECTE ════ */}
          <TabsContent value="collecte" className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={Database} title="Collecte patrimoniale" subtitle="Données familiales, travail, revenus, immobilier et placements." /></CardHeader>
              <CardContent>
                <Tabs defaultValue="famille" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-5 rounded-2xl p-1 shadow-sm" style={{ background: `linear-gradient(90deg, ${BRAND.cream} 0%, rgba(255,255,255,0.95) 100%)` }}>
                    {["famille", "travail", "revenus", "immobilier", "placements"].map((tab) => {
                      const labels: Record<string, string> = { famille: "Données familiales", travail: "Travail", revenus: "Revenus", immobilier: "Immobilier", placements: "Placements" };
                      return <TabsTrigger key={tab} value={tab} className="rounded-xl border border-transparent px-3 py-2 text-slate-700 transition-all data-[state=active]:bg-[#516AC7] data-[state=active]:text-white data-[state=active]:shadow-md">{labels[tab]}</TabsTrigger>;
                    })}
                  </TabsList>

                  {/* ── Famille ── */}
                  <TabsContent value="famille" className="space-y-6">
                    {/* Deux personnes côte à côte */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Personne 1 */}
                      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Personne 1</div>
                        <div className="grid gap-3 grid-cols-2">
                          <Field label="Prénom"><Input value={data.person1FirstName} onChange={(e) => setField("person1FirstName", e.target.value)} className="rounded-xl" /></Field>
                          <Field label="Nom"><Input value={data.person1LastName} onChange={(e) => setField("person1LastName", e.target.value)} className="rounded-xl" /></Field>
                        </div>
                        <Field label="Date de naissance"><Input type="date" value={data.person1BirthDate} onChange={(e) => setField("person1BirthDate", e.target.value)} className="rounded-xl" /></Field>
                      </div>
                      {/* Personne 2 */}
                      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Personne 2</div>
                        <div className="grid gap-3 grid-cols-2">
                          <Field label="Prénom"><Input value={data.person2FirstName} onChange={(e) => setField("person2FirstName", e.target.value)} className="rounded-xl" /></Field>
                          <Field label="Nom"><Input value={data.person2LastName} onChange={(e) => setField("person2LastName", e.target.value)} className="rounded-xl" /></Field>
                        </div>
                        <Field label="Date de naissance"><Input type="date" value={data.person2BirthDate} onChange={(e) => setField("person2BirthDate", e.target.value)} className="rounded-xl" /></Field>
                      </div>
                    </div>
                    {/* Situation couple sur une ligne */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Situation de couple">
                        <Select value={data.coupleStatus} onValueChange={(v) => setField("coupleStatus", v)}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>{COUPLE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      <Field label="Régime matrimonial">
                        <Select value={data.matrimonialRegime} onValueChange={(v) => setField("matrimonialRegime", v)} disabled={data.coupleStatus !== "married"}>
                          <SelectTrigger className={`rounded-xl ${data.coupleStatus !== "married" ? "bg-slate-100 text-slate-400" : ""}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{MATRIMONIAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      <Field label="Parent isolé">
                        <Select value={data.singleParent ? "yes" : "no"} onValueChange={(v) => setField("singleParent", v === "yes")}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="no">Non</SelectItem><SelectItem value="yes">Oui</SelectItem></SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {/* Enfants */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold" style={{ color: BRAND.navy }}>Enfants</h3>
                        <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={addChild}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>
                      </div>
                      {data.childrenData.length === 0 && <div className="text-sm text-slate-500">Aucun enfant saisi.</div>}
                      {data.childrenData.map((child, index) => (
                        <div key={index} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_1.2fr_1.3fr_1fr_auto]" style={{ borderColor: SURFACE.border }}>
                          <Field label="Prénom"><Input value={child.firstName} onChange={(e) => updateChild(index, "firstName", e.target.value)} className="rounded-xl" /></Field>
                          <Field label="Nom"><Input value={child.lastName} onChange={(e) => updateChild(index, "lastName", e.target.value)} className="rounded-xl" /></Field>
                          <Field label="Date de naissance"><Input type="date" value={child.birthDate} onChange={(e) => updateChild(index, "birthDate", e.target.value)} className="rounded-xl" /></Field>
                          <Field label="Parenté">
                            <Select value={child.parentLink} onValueChange={(v) => updateChild(index, "parentLink", v)}>
                              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>{CHILD_LINKS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <Field label="Garde">
                            <Select value={child.custody} onValueChange={(v) => updateChild(index, "custody", v)}>
                              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>{CUSTODY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <div className="flex items-end"><Button variant="outline" className="h-9 w-9 rounded-xl p-0" onClick={() => removeChild(index)}><Trash2 className="h-4 w-4" /></Button></div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* ── Travail ── */}
                  <TabsContent value="travail" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {([1, 2] as const).map((which) => (
                        <div key={which} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>{which === 1 ? person1 : person2}</div>
                          <Field label="Intitulé du poste">
                            <Input value={which === 1 ? data.person1JobTitle : data.person2JobTitle} onChange={(e) => setField(which === 1 ? "person1JobTitle" : "person2JobTitle", e.target.value)} className="rounded-xl" />
                          </Field>
                          <Field label="CSP">
                            <Select value={which === 1 ? data.person1Csp : data.person2Csp} onValueChange={(v) => setField(which === 1 ? "person1Csp" : "person2Csp", v)}>
                              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>{CSP_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* ── Revenus ── */}
                  <TabsContent value="revenus" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Revenus bruts */}
                      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Revenus</div>
                        <MoneyField label={`Salaire ${person1}`} value={data.salary1} onChange={(e) => setField("salary1", e.target.value)} />
                        <MoneyField label={`Salaire ${person2}`} value={data.salary2} onChange={(e) => setField("salary2", e.target.value)} />
                        <MoneyField label="Pensions / retraites" value={data.pensions} onChange={(e) => setField("pensions", e.target.value)} />
                      </div>
                      {/* Charges déductibles */}
                      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Charges déductibles</div>
                        <MoneyField label="Versements PER déductibles" value={data.perDeduction} onChange={(e) => setField("perDeduction", e.target.value)} />
                        <MoneyField label="Pensions alimentaires déductibles" value={data.pensionDeductible} onChange={(e) => setField("pensionDeductible", e.target.value)} />
                        <MoneyField label="Autres charges déductibles" value={data.otherDeductible} onChange={(e) => setField("otherDeductible", e.target.value)} />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Immobilier ── */}
                  <TabsContent value="immobilier" className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Immobilier</h3>
                      <div className="flex items-end gap-2">
                        <Select onValueChange={(v) => { if (v) addProperty(v); }}>
                          <SelectTrigger className="h-9 rounded-xl min-w-[240px] text-sm"><SelectValue placeholder="Ajouter un bien…" /></SelectTrigger>
                          <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {data.properties.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun bien immobilier saisi. Choisissez une nature dans le menu ci-dessus.</div>}
                    {data.properties.map((property, index) => (
                      <Card key={index} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
                        <CardContent className="p-4 space-y-3">
                          {/* Identité + suppression */}
                          <div className="flex items-end gap-2">
                            <div className="flex-1 grid gap-2 grid-cols-[1.4fr_1.6fr_1fr_1fr]">
                              <Field label="Nom"><Input value={property.name} onChange={(e) => updateProperty(index, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                              <Field label="Nature">
                                <Select value={property.type} onValueChange={(v) => updateProperty(index, "type", v)}>
                                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                </Select>
                              </Field>
                              <Field label="Propriétaire">
                                <Select value={property.ownership} onValueChange={(v) => updateProperty(index, "ownership", v)}>
                                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>{ownerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </Field>
                              <Field label="Droit">
                                <Select value={property.propertyRight} onValueChange={(v) => updateProperty(index, "propertyRight", v)}>
                                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>{PROPERTY_RIGHTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </Field>
                            </div>
                            <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => removeProperty(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                          {/* Valeurs financières — grille adaptative, sans divs vides */}
                          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
                            <MoneyField label={property.propertyRight === "full" ? "Valeur estimée" : "Valeur PP"} value={property.value} onChange={(e) => updateProperty(index, "value", e.target.value)} compact />
                            {property.propertyRight !== "full" && <MoneyField label="Âge usufruitier" value={property.usufructAge} onChange={(e) => updateProperty(index, "usufructAge", e.target.value)} compact />}
                            {propertyNeedsPropertyTax(property.type) && <MoneyField label="Taxe foncière/an" value={property.propertyTaxAnnual} onChange={(e) => updateProperty(index, "propertyTaxAnnual", e.target.value)} compact />}
                            {propertyNeedsRent(property.type) && <MoneyField label="Loyer brut/an" value={property.rentGrossAnnual} onChange={(e) => updateProperty(index, "rentGrossAnnual", e.target.value)} compact />}
                            {propertyNeedsInsurance(property.type) && <MoneyField label="Assurance/an" value={property.insuranceAnnual} onChange={(e) => updateProperty(index, "insuranceAnnual", e.target.value)} compact />}
                            {propertyNeedsWorks(property.type) && <MoneyField label="Travaux/an" value={property.worksAnnual} onChange={(e) => updateProperty(index, "worksAnnual", e.target.value)} compact />}
                            {propertyNeedsRent(property.type) && <MoneyField label="Autres charges/an" value={property.otherChargesAnnual} onChange={(e) => updateProperty(index, "otherChargesAnnual", e.target.value)} compact />}
                            {propertyNeedsLoan(property.type) && <MoneyField label="Capital restant dû" value={property.loanCapitalRemaining} onChange={(e) => updateProperty(index, "loanCapitalRemaining", e.target.value)} compact />}
                            {propertyNeedsLoan(property.type) && <MoneyField label="Intérêts/an" value={property.loanInterestAnnual} onChange={(e) => updateProperty(index, "loanInterestAnnual", e.target.value)} compact />}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  {/* ── Placements ── */}
                  <TabsContent value="placements" className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Placements et comptes</h3>
                      <div className="flex items-center gap-2">
                        <Select value={placementFamily} onValueChange={setPlacementFamily}>
                          <SelectTrigger className="h-9 rounded-xl w-52 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{PLACEMENT_FAMILIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select onValueChange={(v) => { if (v) addPlacement(v); }}>
                          <SelectTrigger className="h-9 rounded-xl w-52 text-sm"><SelectValue placeholder="Ajouter un produit…" /></SelectTrigger>
                          <SelectContent>{(PLACEMENT_TYPES_BY_FAMILY[placementFamily] || []).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {data.placements.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun placement saisi. Sélectionnez une famille puis un produit.</div>}
                    {data.placements.map((placement, index) => {
                      const fiscal = placementFiscalSummary(placement.type);
                      const totalShare = placement.beneficiaries.reduce((s, b) => s + n(b.share), 0);
                      const shareOverflow = totalShare > 100.0001;
                      const isAVType = isAV(placement.type);
                      const isCash = isCashPlacement(placement.type);
                      const isUCorCapi = placement.type === "Assurance-vie unités de compte" || placement.type === "Contrat de capitalisation";
                      return (
                        <Card key={index} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
                          <CardContent className="p-4 space-y-2">
                            {/* Ligne identité + suppression compacte */}
                            <div className="flex items-end gap-2">
                              <div className="flex-1 grid gap-2 grid-cols-[1fr_1.8fr_0.9fr_1fr]">
                                <Field label="Nom"><Input value={placement.name} onChange={(e) => updatePlacementStr(index, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                                <Field label="Type">
                                  <Select value={placement.type} onValueChange={(v) => updatePlacementStr(index, "type", v)}>
                                    <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ALL_PLACEMENTS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                  </Select>
                                </Field>
                                <Field label="Titulaire">
                                  <Select value={placement.ownership} onValueChange={(v) => updatePlacementStr(index, "ownership", v)}>
                                    <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ownerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                </Field>
                                <MoneyField label="Encours" value={placement.value} onChange={(e) => updatePlacementStr(index, "value", e.target.value)} compact />
                              </div>
                              <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => removePlacement(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>

                            {/* Badges fiscaux */}
                            <div className="flex flex-wrap gap-1.5">
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${BRAND.gold}22`, color: BRAND.navy }}>IR : {fiscal.ir}</span>
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${BRAND.sky}15`, color: BRAND.sky }}>Succession : {fiscal.succession}</span>
                            </div>

                            {/* Champs selon type — grille dense sans divs vides */}
                            <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
                              {!isAVType && !isCash && <MoneyField label="Revenu annuel" value={placement.annualIncome} onChange={(e) => updatePlacementStr(index, "annualIncome", e.target.value)} compact />}
                              {placementNeedsTaxableIncome(placement.type) && <MoneyField label="Part taxable" value={placement.taxableIncome} onChange={(e) => updatePlacementStr(index, "taxableIncome", e.target.value)} compact />}
                              {!isAVType && !isCash && <MoneyField label="Valeur au décès" value={placement.deathValue} onChange={(e) => updatePlacementStr(index, "deathValue", e.target.value)} compact />}
                              {!isAVType && placementNeedsOpenDate(placement.type) && (
                                <Field label="Date d'ouverture"><Input type="date" value={placement.openDate} onChange={(e) => updatePlacementStr(index, "openDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                              )}
                              {!isAVType && !isCash && placementNeedsPFU(placement.type) && (
                                <Field label="PFU">
                                  <Select value={placement.pfuEligible ? "yes" : "no"} onValueChange={(v) => updatePlacementBool(index, v === "yes")}>
                                    <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="yes">Oui</SelectItem><SelectItem value="no">Non</SelectItem></SelectContent>
                                  </Select>
                                </Field>
                              )}
                              {isAVType && <MoneyField label="Primes nettes" value={placement.totalPremiumsNet} onChange={(e) => updatePlacementStr(index, "totalPremiumsNet", e.target.value)} compact />}
                              {isAVType && <MoneyField label="Primes < 70 ans" value={placement.premiumsBefore70} onChange={(e) => updatePlacementStr(index, "premiumsBefore70", e.target.value)} compact />}
                              {isAVType && <MoneyField label="Primes ≥ 70 ans" value={placement.premiumsAfter70} onChange={(e) => updatePlacementStr(index, "premiumsAfter70", e.target.value)} compact />}
                              {isAVType && placementNeedsOpenDate(placement.type) && (
                                <Field label="Date d'ouverture"><Input type="date" value={placement.openDate} onChange={(e) => updatePlacementStr(index, "openDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                              )}
                              {isAVType && <MoneyField label="Capital exonéré succ." value={placement.exemptFromSuccession} onChange={(e) => updatePlacementStr(index, "exemptFromSuccession", e.target.value)} compact />}
                              {isUCorCapi && (
                                <Field label="Part UC (%)">
                                  <Input type="number" min="0" max="100" placeholder="ex: 70" value={placement.ucRatio} onChange={(e) => updatePlacementStr(index, "ucRatio", e.target.value)} className="rounded-xl h-8 text-sm" />
                                </Field>
                              )}
                            </div>

                            {/* Retrait annuel AV + simulateur fiscal */}
                            {isAVType && (() => {
                              const retrait = n((placement as any).annualWithdrawal || "");
                              const valeur = n(placement.value);
                              const primesNettes = n(placement.totalPremiumsNet);
                              const plusValues = Math.max(0, valeur - primesNettes);
                              const ratioGain = valeur > 0 ? plusValues / valeur : 0;
                              const gainBrut = retrait * ratioGain;
                              const dateOuv = placement.openDate ? new Date(placement.openDate) : null;
                              const ageAns = dateOuv ? (Date.now() - dateOuv.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
                              const over8 = ageAns >= 8;
                              const isCoupleForme = data.coupleStatus === "married" || data.coupleStatus === "pacs";
                              const abattement = over8 ? (isCoupleForme ? 9200 : 4600) : 0;
                              const gainNetAbatt = Math.max(0, gainBrut - abattement);
                              const above150k = primesNettes > 150000;
                              return (
                                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
                                  <MoneyField label="Retrait annuel (€)" value={(placement as any).annualWithdrawal || ""} onChange={(e) => updatePlacementStr(index, "annualWithdrawal" as any, e.target.value)} compact />
                                  {retrait > 0 && (
                                    <div className="col-span-full rounded-xl border px-3 py-2.5 text-xs space-y-1.5" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                                      <div className="font-semibold" style={{ color: BRAND.sky }}>Simulation fiscale rachat</div>
                                      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-600">
                                        <span>Gain brut dans le retrait :</span>
                                        <span className="font-medium text-right">{euro(gainBrut)}</span>
                                        <span>Abattement {over8 ? (isCoupleForme ? "(9 200 € couple)" : "(4 600 € célibataire)") : "(0 — contrat < 8 ans)"} :</span>
                                        <span className="font-medium text-right">{over8 ? `− ${euro(abattement)}` : "—"}</span>
                                        <span>Gain imposable net :</span>
                                        <span className="font-medium text-right" style={{ color: gainNetAbatt > 0 ? "#b45309" : "#16a34a" }}>{euro(gainNetAbatt)}</span>
                                        <span>Versements &gt; 150 000 € :</span>
                                        <span className={"font-medium text-right " + (above150k ? "text-amber-600" : "text-slate-500")}>{above150k ? "Oui → taux majoré 30%" : "Non → taux réduit 7,5%"}</span>
                                        <span>Fiscalité applicable :</span>
                                        <span className="font-medium text-right text-slate-700">{!placement.openDate ? "⚠ Date ouverture manquante" : over8 ? (above150k ? "PFU 30% (excédent 150k) + PFLi 7,5%/PS 17,2%" : "PFLi 7,5% + PS 17,2%") : "PFU 30% (< 8 ans)"}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Bénéficiaires AV */}
                            {isAVType && (
                              <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Bénéficiaires</div>
                                  <div className="flex items-center gap-1.5">
                                    <Button variant="outline" className="h-6 rounded-lg px-2 text-xs" onClick={() => importFamilyBeneficiaries(index)}>Importer famille</Button>
                                    <Button variant="outline" className="h-6 rounded-lg px-2 text-xs" onClick={() => addPlacementBeneficiary(index)}><Plus className="mr-1 h-3 w-3" />Ajouter</Button>
                                  </div>
                                </div>
                                <div className={"rounded-lg border px-2 py-1 text-xs " + (shareOverflow ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white/60 text-slate-600")}>
                                  Total : <strong>{Math.round(totalShare * 100) / 100} %</strong>{shareOverflow ? " — dépasse 100 %." : ""}
                                </div>
                                {placement.beneficiaries.map((beneficiary, bIndex) => (
                                  <div key={bIndex} className="grid gap-2 grid-cols-[1fr_1fr_0.6fr_auto] items-end">
                                    <Field label="Nom"><Input value={beneficiary.name} onChange={(e) => updatePlacementBeneficiary(index, bIndex, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                                    <Field label="Lien">
                                      <Select value={beneficiary.relation || "autre"} onValueChange={(v) => updatePlacementBeneficiary(index, bIndex, "relation", v)}>
                                        <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>{BENEFICIARY_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </Field>
                                    <MoneyField label="% part" value={beneficiary.share} onChange={(e) => updatePlacementBeneficiary(index, bIndex, "share", e.target.value)} compact />
                                    <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => removePlacementBeneficiary(index, bIndex)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {/* Widget exposition aux marchés */}
                    {data.placements.length > 0 && (() => {
                      let sec = 0; let dyn = 0;
                      for (const p of data.placements) {
                        const val = n(p.value);
                        if (PLACEMENT_TYPES_BY_FAMILY.cash.includes(p.type)) { sec += val; }
                        else if (p.type === "Assurance-vie fonds euros") { sec += val; }
                        else if (p.type === "Assurance-vie unités de compte" || p.type === "Contrat de capitalisation") {
                          const uc = Math.min(100, Math.max(0, n(p.ucRatio) || (p.type === "Assurance-vie unités de compte" ? 100 : 0)));
                          dyn += val * uc / 100; sec += val * (100 - uc) / 100;
                        } else { dyn += val; }
                      }
                      const tot = sec + dyn;
                      if (tot <= 0) return null;
                      const secPct = Math.round(sec / tot * 100);
                      const dynPct = 100 - secPct;
                      return (
                        <div className="rounded-2xl p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>Exposition aux marchés financiers</div>
                          <div className="flex items-center gap-6 flex-wrap">
                            <div className="flex-1 min-w-48">
                              <div className="flex justify-between text-xs mb-1" style={{ color: BRAND.navy }}>
                                <span>🔵 Sécurisé {secPct}%</span>
                                <span>🟡 Dynamique {dynPct}%</span>
                              </div>
                              <div className="h-4 rounded-full overflow-hidden flex" style={{ background: "#e5e7eb" }}>
                                <div className="h-full transition-all" style={{ width: `${secPct}%`, background: "#4B9CD3" }} />
                                <div className="h-full transition-all" style={{ width: `${dynPct}%`, background: "#E8A838" }} />
                              </div>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div><div className="text-xs text-slate-500">Sécurisé</div><div className="font-bold" style={{ color: "#4B9CD3" }}>{euro(sec)}</div></div>
                              <div><div className="text-xs text-slate-500">Dynamique</div><div className="font-bold" style={{ color: "#E8A838" }}>{euro(dyn)}</div></div>
                              <div><div className="text-xs text-slate-500">Total</div><div className="font-bold" style={{ color: BRAND.navy }}>{euro(tot)}</div></div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-400 italic">Sécurisé : livrets, fonds euros, comptes. Dynamique : PEA, CTO, PER, UC des AV/capitalisation.</div>
                        </div>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ IR ════ */}
          <TabsContent value="ir" className="space-y-4">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="Impôt sur le revenu" subtitle="Base imposable, barème, quotient familial et PFU." /></CardHeader>
              <CardContent className="space-y-4">

                {/* KPIs principaux sur une ligne */}
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard label="IR total" value={euro(ir.finalIR)} />
                  <MetricCard label="Revenu net global" value={euro(ir.revenuNetGlobal)} />
                  <MetricCard label="TMI" value={`${Math.round(ir.marginalRate * 100)} %`} />
                  <MetricCard label="Taux moyen" value={`${Math.round(ir.averageRate * 1000) / 10} %`} />
                </div>

                {/* Détail horizontal */}
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard label="Barème progressif" value={euro(ir.bareme)} />
                  <MetricCard label="PFU" value={euro(ir.totalPFU)} />
                  <MetricCard label="Quotient familial" value={euro(ir.quotient)} hint={`${ir.parts} part(s)`} />
                  <MetricCard label="Plafonnement QF" value={euro(ir.quotientFamilialCapAdjustment)} hint={`Avantage retenu : ${euro(Math.min(ir.qfBenefit, ir.qfCap))}`} />
                </div>

                {/* Options frais + régime foncier — 2 personnes + 1 col régime côte à côte */}
                <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Options de calcul</div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* P1 */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-slate-500">{person1}</div>
                      <Field label="Mode de frais">
                        <Select value={irOptions.expenseMode1} onValueChange={(v: "standard" | "actual") => setIrOptions((prev) => ({ ...prev, expenseMode1: v }))}>
                          <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="standard">Abattement 10 %</SelectItem><SelectItem value="actual">Frais réels</SelectItem></SelectContent>
                        </Select>
                      </Field>
                      {irOptions.expenseMode1 === "actual" && (
                        <div className="grid gap-2 grid-cols-2">
                          <MoneyField label="Km professionnels" value={irOptions.km1} onChange={(e) => setIrOptions((prev) => ({ ...prev, km1: e.target.value }))} />
                          <MoneyField label="CV fiscal" value={irOptions.cv1} onChange={(e) => setIrOptions((prev) => ({ ...prev, cv1: e.target.value }))} />
                          <MoneyField label="Nb repas" value={irOptions.mealCount1} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealCount1: e.target.value }))} />
                          <MoneyField label="€ / repas" value={irOptions.mealUnit1} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealUnit1: e.target.value }))} />
                          <div className="col-span-2"><MoneyField label="Autres frais" value={irOptions.other1} onChange={(e) => setIrOptions((prev) => ({ ...prev, other1: e.target.value }))} /></div>
                          <div className="col-span-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                            IK : <strong>{euro(computeKilometricAllowance(n(irOptions.km1), n(irOptions.cv1)))}</strong> · Repas : <strong>{euro(n(irOptions.mealCount1) * n(irOptions.mealUnit1))}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* P2 */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-slate-500">{person2}</div>
                      <Field label="Mode de frais">
                        <Select value={irOptions.expenseMode2} onValueChange={(v: "standard" | "actual") => setIrOptions((prev) => ({ ...prev, expenseMode2: v }))}>
                          <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="standard">Abattement 10 %</SelectItem><SelectItem value="actual">Frais réels</SelectItem></SelectContent>
                        </Select>
                      </Field>
                      {irOptions.expenseMode2 === "actual" && (
                        <div className="grid gap-2 grid-cols-2">
                          <MoneyField label="Km professionnels" value={irOptions.km2} onChange={(e) => setIrOptions((prev) => ({ ...prev, km2: e.target.value }))} />
                          <MoneyField label="CV fiscal" value={irOptions.cv2} onChange={(e) => setIrOptions((prev) => ({ ...prev, cv2: e.target.value }))} />
                          <MoneyField label="Nb repas" value={irOptions.mealCount2} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealCount2: e.target.value }))} />
                          <MoneyField label="€ / repas" value={irOptions.mealUnit2} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealUnit2: e.target.value }))} />
                          <div className="col-span-2"><MoneyField label="Autres frais" value={irOptions.other2} onChange={(e) => setIrOptions((prev) => ({ ...prev, other2: e.target.value }))} /></div>
                          <div className="col-span-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                            IK : <strong>{euro(computeKilometricAllowance(n(irOptions.km2), n(irOptions.cv2)))}</strong> · Repas : <strong>{euro(n(irOptions.mealCount2) * n(irOptions.mealUnit2))}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Foncier */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-slate-500">Revenus fonciers</div>
                      <Field label="Régime foncier">
                        <Select value={irOptions.foncierRegime} onValueChange={(v: "micro" | "real") => setIrOptions((prev) => ({ ...prev, foncierRegime: v }))}>
                          <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="micro">Micro-foncier (30 %)</SelectItem><SelectItem value="real">Régime réel</SelectItem></SelectContent>
                        </Select>
                      </Field>
                      <div className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600 space-y-0.5">
                        <div>Foncier brut : <strong>{euro(ir.foncierBrut)}</strong></div>
                        <div>Foncier taxable : <strong>{euro(ir.taxableFonciers)}</strong></div>
                        <div>Prélèvements sociaux : <strong>{euro(ir.foncierSocialLevy)}</strong></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barème */}
                <BracketFillChart title="Barème IR — remplissage des tranches" data={ir.bracketFill} referenceValue={ir.quotient} valueLabel="Quotient familial" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ IFI ════ */}
          <TabsContent value="ifi" className="space-y-4">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="IFI — Impôt sur la Fortune Immobilière" subtitle="Assiette, passif déductible, décote et barème progressif." /></CardHeader>
              <CardContent className="space-y-4">
                {/* KPIs + barème côte à côte */}
                <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                  <div className="space-y-3">
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-1">
                      <MetricCard label="Actif net taxable IFI" value={euro(ifi.netTaxable)} />
                      <MetricCard label="IFI brut" value={euro(ifi.grossIfi)} />
                      <MetricCard label="Décote" value={euro(ifi.decote)} />
                      <MetricCard label="IFI net dû" value={euro(ifi.ifi)} />
                    </div>
                  </div>
                  <BracketFillChart title="Barème IFI" data={ifi.bracketFill} referenceValue={ifi.netTaxable} valueLabel="Base taxable" />
                </div>

                {/* Table des biens compacte */}
                {ifi.lines.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
                    <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>
                      Biens retenus dans l'assiette IFI
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: SURFACE.tableHead }}>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">Bien</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-600">Droit</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">Valeur brute</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">Abatt. RP</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600">Passif</th>
                            <th className="px-4 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Valeur taxable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ifi.lines.map((line, idx) => (
                            <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                              <td className="px-4 py-2.5 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-500">{line.rightMode}</td>
                              <td className="px-4 py-2.5 text-right">{euro(line.grossValue)}</td>
                              <td className="px-4 py-2.5 text-right text-slate-500">- {euro(line.residenceAbatement)}</td>
                              <td className="px-4 py-2.5 text-right text-slate-500">- {euro(line.deductibleDebt)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.taxableNet)}</td>
                            </tr>
                          ))}
                          <tr className="border-t" style={{ background: SURFACE.tableHead, borderColor: SURFACE.borderStrong }}>
                            <td colSpan={5} className="px-4 py-2 text-right text-sm font-semibold" style={{ color: BRAND.sky }}>Total assiette IFI</td>
                            <td className="px-4 py-2 text-right text-sm font-bold" style={{ color: BRAND.navy }}>{euro(ifi.netTaxable)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {ifi.lines.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun bien immobilier saisi dans la collecte.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ SUCCESSION ════ */}
          <TabsContent value="succession" className="space-y-4">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="Succession" subtitle="Actif successoral, assurance-vie et droits par héritier." /></CardHeader>
              <CardContent className="space-y-4">

                {/* Paramètres + KPIs sur une même zone */}
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
                  <Field label="Décès simulé de">
                    <Select value={successionData.deceasedPerson} onValueChange={(v: "person1" | "person2") => setSuccessionData((prev) => ({ ...prev, deceasedPerson: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="person1">{person1}</SelectItem><SelectItem value="person2">{person2}</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <Field label="Option conjoint survivant">
                    <Select value={effectiveSpouseOption} onValueChange={(v) => setSuccessionData((prev) => ({ ...prev, spouseOption: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{spouseOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <div className="rounded-2xl border px-4 py-3 text-xs text-slate-600 space-y-0.5 self-end" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                    <div>Conjoint survivant : <strong>{succession.survivorKey === "person1" ? person1 : person2}</strong></div>
                    <div>Quotité disponible : <strong>{Math.round(succession.quotiteDisponible * 100)} %</strong> · Enfants réservataires : <strong>{succession.reserveChildrenCount}</strong></div>
                    {succession.usufruitierAge !== null
                      ? <div>Démembrement : <strong>US {Math.round(succession.demembrementPct.usufruct * 100)} % / NP {Math.round(succession.demembrementPct.nuePropriete * 100)} %</strong> ({succession.usufruitierAge} ans)</div>
                      : <div className="text-amber-600">Date de naissance du conjoint à renseigner pour le démembrement.</div>}
                  </div>
                </div>

                {/* Actions + warnings */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-sm" onClick={syncCollectedHeirs}>Importer héritiers</Button>
                  <Button className="h-9 rounded-xl px-3 text-sm" variant={successionData.useTestament ? "default" : "outline"}
                    onClick={() => setSuccessionData((prev) => ({ ...prev, useTestament: !prev.useTestament }))}
                    style={successionData.useTestament ? { background: BRAND.navy } : undefined}>
                    Testament {successionData.useTestament ? "activé" : "désactivé"}
                  </Button>
                </div>

                {succession.warnings.length > 0 && (
                  <div className="space-y-2">
                    {succession.warnings.map((w, idx) => (
                      <div key={idx} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">{w}</div>
                    ))}
                  </div>
                )}

                {/* Testament */}
                {successionData.useTestament && (
                  <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Répartition testamentaire</div>
                      <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={addTestamentHeir}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>
                    </div>
                    {successionData.testamentHeirs.length === 0 && <div className="text-sm text-slate-500">Aucun héritier testamentaire saisi.</div>}
                    {successionData.testamentHeirs.map((heir, index) => (
                      <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_1.3fr_1fr_auto] items-end">
                        <Field label="Prénom"><Input value={heir.firstName} onChange={(e) => updateTestamentHeir(index, "firstName", e.target.value)} className="rounded-xl" /></Field>
                        <Field label="Nom"><Input value={heir.lastName} onChange={(e) => updateTestamentHeir(index, "lastName", e.target.value)} className="rounded-xl" /></Field>
                        <Field label="Date de naissance"><Input type="date" value={heir.birthDate} onChange={(e) => updateTestamentHeir(index, "birthDate", e.target.value)} className="rounded-xl" /></Field>
                        <Field label="Lien de parenté">
                          <Select value={heir.relation} onValueChange={(v) => updateTestamentHeir(index, "relation", v)}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <MoneyField label="Donations antérieures" value={heir.priorDonations} onChange={(e) => updateTestamentHeir(index, "priorDonations", e.target.value)} />
                        <Button variant="outline" className="h-9 w-9 rounded-xl p-0" onClick={() => removeTestamentHeir(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* KPIs succession en 2 lignes de 3 */}
                <div className="grid gap-3 md:grid-cols-3">
                  <MetricCard label="Actif successoral net" value={euro(succession.activeNet)} />
                  <MetricCard label="Droits de succession" value={euro(succession.totalSuccessionRights)} />
                  <MetricCard label="Fiscalité AV" value={euro(succession.totalAvRights)} hint={`Total combiné : ${euro(succession.totalRights)}`} />
                  <MetricCard label="Immobilier retenu" value={euro(succession.collectedPropertyEstate)} />
                  <MetricCard label="Placements retenus" value={euro(succession.placementsSuccession)} />
                  <MetricCard label="Forfait mobilier 5 %" value={euro(succession.furnitureForfait)} />
                </div>

                {/* Tables compactes côte à côte */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Biens */}
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Biens immobiliers</div>
                    {succession.propertyLines.length === 0
                      ? <div className="px-4 py-4 text-sm text-slate-400">Aucun bien retenu.</div>
                      : <table className="w-full text-xs">
                          <thead><tr style={{ background: SURFACE.tableHead }}>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Bien</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Valeur brute</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Déductions</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Net</th>
                          </tr></thead>
                          <tbody>
                            {succession.propertyLines.map((line, idx) => (
                              <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                                <td className="px-3 py-2">
                                  <div className="font-medium" style={{ color: BRAND.navy }}>{line.name}</div>
                                  <div className="text-slate-400">{line.note}</div>
                                </td>
                                <td className="px-3 py-2 text-right">{euro(line.grossEstateValue)}</td>
                                <td className="px-3 py-2 text-right text-slate-500">- {euro(line.residenceAbatement + line.debtShare)}</td>
                                <td className="px-3 py-2 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.netEstateValue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>}
                  </div>

                  {/* Placements hors AV */}
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Placements hors AV</div>
                    {succession.placementLines.filter(l => l.netEstateValue > 0).length === 0
                      ? <div className="px-4 py-4 text-sm text-slate-400">Aucun placement retenu.</div>
                      : <table className="w-full text-xs">
                          <thead><tr style={{ background: SURFACE.tableHead }}>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Placement</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Note</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Net retenu</th>
                          </tr></thead>
                          <tbody>
                            {succession.placementLines.map((line, idx) => (
                              <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                                <td className="px-3 py-2 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                                <td className="px-3 py-2 text-slate-400">{line.note}</td>
                                <td className="px-3 py-2 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.netEstateValue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>}
                  </div>
                </div>

                {/* AV compacte */}
                {succession.avLines.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Assurance-vie au décès</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{ background: SURFACE.tableHead }}>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Contrat</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Bénéficiaire</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Capital</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Cap. av. 70 ans</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Primes ap. 70 ans</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Taxe 990I</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Taxe 757B</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Fiscalité AV</th>
                        </tr></thead>
                        <tbody>
                          {succession.avLines.map((line, idx) => (
                            <tr key={line.contract + line.beneficiary + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                              <td className="px-3 py-2 font-medium" style={{ color: BRAND.navy }}>{line.contract}</td>
                              <td className="px-3 py-2">{line.beneficiary} <span className="text-slate-400">({line.sharePct} %)</span></td>
                              <td className="px-3 py-2 text-right">{euro(line.amount)}</td>
                              <td className="px-3 py-2 text-right">{euro(line.amountBefore70Capital)}</td>
                              <td className="px-3 py-2 text-right">{euro(line.amountAfter70Premiums)}</td>
                              <td className="px-3 py-2 text-right">{euro(line.before70Tax)}</td>
                              <td className="px-3 py-2 text-right">{euro(line.after70Tax)}</td>
                              <td className="px-3 py-2 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.totalTax)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Barème + camemberts côte à côte */}
                {succession.bracketFill.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <BracketFillChart
                      title={`Barème · ${succession.graphReferenceTitle}`}
                      data={succession.bracketFill}
                      referenceValue={succession.graphTaxableBase}
                      valueLabel={`Base taxable (${succession.graphReferenceName})`}
                    />
                    <div className="space-y-4">
                      <Card className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ color: BRAND.navy }}>Réserve et quotité disponible</CardTitle></CardHeader>
                        <CardContent className="h-44 -mt-2">
                          {succession.pieData.length > 0
                            ? <ResponsiveContainer width="100%" height="100%">
                                <PieChart><Pie data={succession.pieData} dataKey="value" nameKey="name" outerRadius={70} label={({ name, value }) => `${name.split(" ")[0]} ${euro(value)}`}>
                                  {succession.pieData.map((e, i) => <Cell key={e.name + i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Pie><Tooltip formatter={(v: number) => euro(v)} /></PieChart>
                              </ResponsiveContainer>
                            : <div className="text-sm text-slate-400 pt-4">Pas de données.</div>}
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ color: BRAND.navy }}>Répartition reçue par héritier</CardTitle></CardHeader>
                        <CardContent className="h-44 -mt-2">
                          {succession.receivedPieData.length > 0
                            ? <ResponsiveContainer width="100%" height="100%">
                                <PieChart><Pie data={succession.receivedPieData} dataKey="value" nameKey="name" outerRadius={70} label={({ name, value }) => `${name} ${euro(value)}`}>
                                  {succession.receivedPieData.map((e, i) => <Cell key={e.name + i} fill={RECEIVED_COLORS[i % RECEIVED_COLORS.length]} />)}
                                </Pie><Tooltip formatter={(v: number) => euro(v)} /></PieChart>
                              </ResponsiveContainer>
                            : <div className="text-sm text-slate-400 pt-4">Pas de données.</div>}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Détail héritiers — table compacte */}
                {succession.results.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Détail par héritier</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{ background: SURFACE.tableHead }}>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Héritier</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Lien</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Actif reçu</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">NP économique</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Abattement</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Base taxable</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Droits succession</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">AV reçue</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Fiscalité AV</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Net global</th>
                        </tr></thead>
                        <tbody>
                          {succession.results.map((line, idx) => (
                            <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                              <td className="px-3 py-2.5 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                              <td className="px-3 py-2.5 text-slate-500">{line.relation}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.grossReceived + line.usufructRawValue + line.nueRawValue)}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.nueRawValue)}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.allowance)}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.successionTaxable)}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.successionDuties)}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.avReceived)}</td>
                              <td className="px-3 py-2.5 text-right">{euro(line.avDuties)}</td>
                              <td className="px-3 py-2.5 text-right font-bold" style={{ color: BRAND.navy }}>{euro(line.netReceived)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ HYPOTHÈSES ════ */}
          <TabsContent value="hypotheses">
            <div className="space-y-4">

              {/* Barre de base — compacte sur une ligne */}
              <Card className="rounded-2xl border-0 shadow-md" style={{ background: SURFACE.cardSoft }}>
                <CardContent className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Base de référence</div>
                        <div className="text-xs text-slate-500 mt-0.5">{baseSnapshot.savedAt ? `Figée le ${new Date(baseSnapshot.savedAt).toLocaleString("fr-FR")}` : "Aucune base figée"}</div>
                      </div>
                      <div className="flex gap-3 text-sm">
                        {[
                          { label: "IR", value: baseReference.ir.finalIR },
                          { label: "IFI", value: baseReference.ifi.ifi },
                          { label: "Succession", value: baseReference.succession.totalRights },
                          { label: "Actif successoral", value: baseReference.succession.activeNet },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-xl border px-3 py-1.5 text-xs" style={{ borderColor: SURFACE.border, background: "white" }}>
                            <span className="text-slate-500">{label} : </span><strong style={{ color: BRAND.navy }}>{euro(value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="h-8 rounded-xl px-3 text-sm" style={{ background: BRAND.navy }} onClick={saveBaseSnapshot}>Figer la base actuelle</Button>
                      <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={restoreBaseSnapshot} disabled={!baseSnapshot.data}>Recharger</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Situation courante vs base */}
              <div className="rounded-2xl border px-5 py-3" style={{ borderColor: SURFACE.border, background: "white" }}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Situation courante</div>
                  {[
                    { label: "IR", value: ir.finalIR, base: baseReference.ir.finalIR },
                    { label: "IFI", value: ifi.ifi, base: baseReference.ifi.ifi },
                    { label: "Succession", value: succession.totalRights, base: baseReference.succession.totalRights },
                    { label: "Actif successoral", value: succession.activeNet, base: baseReference.succession.activeNet },
                  ].map(({ label, value, base }) => {
                    const diff = value - base;
                    return (
                      <div key={label} className="flex items-baseline gap-2 rounded-xl border px-3 py-1.5 text-xs" style={{ borderColor: SURFACE.border }}>
                        <span className="text-slate-500">{label} : </span>
                        <strong style={{ color: BRAND.navy }}>{euro(value)}</strong>
                        {baseSnapshot.data && (
                          <span className={`text-xs font-medium ${Math.abs(diff) < 1 ? "text-slate-400" : diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                            {diff >= 0 ? "+" : ""}{euro(diff)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3 cartes hypothèses */}
              <div className="grid gap-4 md:grid-cols-3">
                {hypothesisResults.map((item) => (
                  <Card key={item.hypothesis.id} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
                    <CardContent className="p-4 space-y-3">
                      {/* Nom + boutons */}
                      <div className="flex items-center gap-2">
                        <Input
                          value={item.hypothesis.name}
                          onChange={(e) => renameHypothesis(item.hypothesis.id, e.target.value)}
                          className="h-8 flex-1 rounded-xl text-sm font-semibold"
                          style={{ color: BRAND.navy }}
                        />
                        <Button className="h-8 w-8 rounded-xl p-0" style={{ background: BRAND.navy }} onClick={() => saveHypothesis(item.hypothesis.id)} title="Enregistrer">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => loadHypothesis(item.hypothesis.id)} disabled={!item.hypothesis.data} title="Charger">
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => clearHypothesis(item.hypothesis.id)} title="Effacer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Field label="Hypothèse"><Textarea value={item.hypothesis.notes} onChange={(e) => updateHypothesisNotes(item.hypothesis.id, e.target.value)} className="rounded-xl min-h-[64px] text-sm" /></Field>
                      <Field label="Objectifs"><Textarea value={item.hypothesis.objective || ""} onChange={(e) => updateHypothesisObjective(item.hypothesis.id, e.target.value)} className="rounded-xl min-h-[64px] text-sm" /></Field>

                      <div className="text-xs text-slate-400">{item.hypothesis.savedAt ? `Capturée : ${new Date(item.hypothesis.savedAt).toLocaleString("fr-FR")}` : "Aucune capture."}</div>

                      {item.ir && item.ifi && item.succession ? (
                        <div className="space-y-2">
                          {/* KPIs avec écart coloré */}
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "IR", value: item.ir.finalIR, base: baseReference.ir.finalIR },
                              { label: "IFI", value: item.ifi.ifi, base: baseReference.ifi.ifi },
                              { label: "Succession", value: item.succession.totalRights, base: baseReference.succession.totalRights },
                              { label: "Actif succ.", value: item.succession.activeNet, base: baseReference.succession.activeNet },
                            ].map(({ label, value, base }) => {
                              const diff = value - base;
                              return (
                                <div key={label} className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: SURFACE.border }}>
                                  <div className="text-slate-500">{label}</div>
                                  <div className="font-semibold" style={{ color: BRAND.navy }}>{euro(value)}</div>
                                  <div className={`text-xs ${Math.abs(diff) < 1 ? "text-slate-400" : diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                    {diff >= 0 ? "+" : ""}{euro(diff)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Modifications détaillées */}
                          {item.differences.length > 0 && (
                            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Modifications vs base</div>
                              {item.differences.map((diff, i) => (
                                <div key={diff.label + i} className="flex items-start justify-between gap-2 text-xs">
                                  <div className="flex-1">
                                    <div className="font-medium text-slate-700">{diff.label}</div>
                                    <div className="text-slate-400">{diff.baseValue} → <strong>{diff.hypothesisValue}</strong></div>
                                  </div>
                                  <DifferenceBadge impact={diff.impact} />
                                </div>
                              ))}
                            </div>
                          )}
                          {item.differences.length === 0 && baseSnapshot.data && (
                            <div className="text-xs text-slate-400">Aucune différence détectée vs la base.</div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed px-3 py-4 text-xs text-center text-slate-400" style={{ borderColor: SURFACE.border }}>
                          Enregistre la situation courante pour comparer.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ════ RAPPORT ════ */}
          <TabsContent value="rapport">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="Rapport client" subtitle="Synthèse exportable en PDF." /></CardHeader>
              <CardContent className="space-y-6">
                <Field label="Notes de synthèse">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl min-h-[160px]" />
                </Field>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label="IR estimé" value={euro(ir.finalIR)} />
                  <MetricCard label="IFI estimé" value={euro(ifi.ifi)} />
                  <MetricCard label="Droits succession" value={euro(succession.totalRights)} />
                  <MetricCard label="Actif successoral net" value={euro(succession.activeNet)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ LETTRE DE MISSION ════ */}
          <TabsContent value="mission" className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="Lettre de mission" subtitle="Besoins client, profil investisseur et obligations fiscales pour la fiche réglementaire." /></CardHeader>
              <CardContent className="space-y-6">
                {/* Besoins */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>BESOINS EXPRIMÉS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
                      <div className="text-sm font-bold text-center mb-3">Besoin Santé</div>
                      {([["besoinSante_depenses","Dépenses de santé, optique, dentaire"],["besoinSante_hospit","Hospitalisation seule"],["besoinSante_depasse","Dépassements d'honoraires"],["besoinSante_surcompl","Sur-complémentaire"]] as [keyof typeof mission, string][]).map(([k, label]) => (
                        <label key={k} className="flex items-start gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
                      <div className="text-sm font-bold text-center mb-3">Besoin Prévoyance</div>
                      {([["besoinPrev_arret","Maintenir rémunération (arrêt travail, invalidité)"],["besoinPrev_deces","Protéger la famille en cas de décès"],["besoinPrev_fraisGen","Couvrir frais généraux professionnels"]] as [keyof typeof mission, string][]).map(([k, label]) => (
                        <label key={k} className="flex items-start gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
                      <div className="text-sm font-bold text-center mb-3">Besoin Retraite</div>
                      {([["besoinRetraite_capital","Capital pour revenus complémentaires"],["besoinRetraite_rente","Capital retraite à convertir en rente"],["besoinRetraite_moderniser","Moderniser un contrat existant"]] as [keyof typeof mission, string][]).map(([k, label]) => (
                        <label key={k} className="flex items-start gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
                      <div className="text-sm font-bold text-center mb-3">Besoin Épargne</div>
                      {([["besoinEpargne_valoriser","Valoriser un capital"],["besoinEpargne_transmettre","Transmettre via assurance-vie"],["besoinEpargne_completer","Compléter les revenus"],["besoinEpargne_projet","Épargner pour un projet"]] as [keyof typeof mission, string][]).map(([k, label]) => (
                        <label key={k} className="flex items-start gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Profil investisseur */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>PROFIL INVESTISSEUR</h3>

                  {/* Q1 - Attitude risque + graphique */}
                  <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Q1 — Quelles variations pouvez-vous accepter ?</div>
                    <div className="grid grid-cols-2 gap-6 items-start">
                      {/* Radio options */}
                      <div className="space-y-2">
                        {([["0","Portefeuille A — Sécurisé"],["8","Portefeuille B — Prudent"],["12","Portefeuille C — Équilibré"],["18","Portefeuille D — Dynamique"]] as [string, string][]).map(([val, label]) => (
                          <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="attitude" checked={mission.attitude === Number(val)} onChange={() => updateMission("attitude", Number(val) as 0|8|12|18)} className="h-4 w-4 accent-[#26428B]" />
                            <span className={mission.attitude === Number(val) ? "font-semibold" : ""}>{label}</span>
                          </label>
                        ))}
                      </div>
                      {/* Graphique rendement/risque — axe 0 central */}
                      <div>
                        <div className="text-xs text-slate-500 mb-2 text-center font-medium">Rendement annuel potentiel</div>
                        {(() => {
                          // Data: max above 0 and min below 0
                          const bars = [
                            { label: "A", maxUp: 4, maxDown: 0, color: "#60a5fa", pts: 0 },
                            { label: "B", maxUp: 13, maxDown: 2, color: "#34d399", pts: 8 },
                            { label: "C", maxUp: 20, maxDown: 7, color: "#fbbf24", pts: 12 },
                            { label: "D", maxUp: 28, maxDown: 13, color: "#f87171", pts: 18 },
                          ];
                          const maxUp = 28; // scale reference
                          const maxDown = 13;
                          const totalH = 120; // px total height
                          const upH = Math.round(totalH * maxUp / (maxUp + maxDown)); // ~81px for positives
                          const downH = totalH - upH; // ~39px for negatives
                          return (
                            <div style={{ position: "relative" }}>
                              <div className="flex items-stretch gap-2 justify-center" style={{ height: `${totalH}px` }}>
                                {bars.map((b) => {
                                  const active = mission.attitude === b.pts;
                                  const barUpH = Math.round(upH * b.maxUp / maxUp);
                                  const barDownH = Math.round(downH * b.maxDown / maxDown) || 0;
                                  return (
                                    <div key={b.label} className="flex flex-col items-center" style={{ flex: 1, height: "100%" }}>
                                      {/* Positive zone */}
                                      <div style={{ height: `${upH}px`, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", alignItems: "center" }}>
                                        <div className="text-xs font-bold mb-0.5" style={{ color: active ? b.color : "#aaa" }}>+{b.maxUp}%</div>
                                        <div style={{
                                          width: "70%", height: `${barUpH}px`,
                                          background: active ? b.color : `${b.color}44`,
                                          borderRadius: "4px 4px 0 0",
                                          border: active ? `2px solid ${b.color}` : "none",
                                          borderBottom: "none",
                                          transition: "all 0.2s",
                                          minHeight: "4px",
                                        }} />
                                      </div>
                                      {/* Zero line label */}
                                      <div style={{ height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <div className="text-xs font-bold" style={{ color: active ? BRAND.navy : "#999" }}>{b.label}</div>
                                      </div>
                                      {/* Negative zone */}
                                      <div style={{ height: `${downH}px`, display: "flex", flexDirection: "column", justifyContent: "flex-start", width: "100%", alignItems: "center" }}>
                                        <div style={{
                                          width: "70%", height: `${barDownH}px`,
                                          background: active ? `${b.color}99` : `${b.color}33`,
                                          borderRadius: "0 0 4px 4px",
                                          border: active ? `2px solid ${b.color}` : "none",
                                          borderTop: "none",
                                          transition: "all 0.2s",
                                          minHeight: b.maxDown > 0 ? "4px" : "0",
                                        }} />
                                        {b.maxDown > 0 && <div className="text-xs font-bold mt-0.5" style={{ color: active ? b.color : "#aaa" }}>−{b.maxDown}%</div>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Ligne zéro */}
                              <div style={{
                                position: "absolute",
                                top: `${upH + 8}px`,
                                left: 0, right: 0,
                                borderTop: "2px dashed rgba(0,0,0,0.18)",
                              }}>
                                <span style={{ position: "absolute", right: 0, top: "-9px", fontSize: "9px", color: "#999", background: "transparent", paddingLeft: "4px" }}>0%</span>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="text-xs text-slate-400 text-center mt-1">Variations annuelles potentielles max</div>
                      </div>
                    </div>
                  </div>

                  {/* Q2 - Réaction baisse */}
                  <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND.sky }}>Q2 — Réaction face à une baisse</div>
                    {([["0","Je récupèrerais mon investissement (0 pt)"],["6","J'attendrais — si ça ne s'améliore pas, je vends (6 pts)"],["12","Cela ne me pose pas de problème (12 pts)"],["18","J'augmenterais mon investissement ! (18 pts)"]] as [string, string][]).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" name="reactionBaisse" checked={mission.reactionBaisse === Number(val)} onChange={() => updateMission("reactionBaisse", Number(val) as 0|6|12|18)} className="h-4 w-4 accent-[#26428B]" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Q3 - Connaissances tableau */}
                  <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q3 — Expérience et connaissances financières</div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left pb-2 font-semibold" style={{ color: BRAND.navy }}></th>
                          <th className="text-center pb-2 font-semibold w-32" style={{ color: BRAND.navy }}>Je connais (1 pt)</th>
                          <th className="text-center pb-2 font-semibold w-32" style={{ color: BRAND.navy }}>Déjà investi (+pts)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          ["connaitFondsEuros","investiFondsEuros","Fonds euros","1 pt"],
                          ["connaitActions","investiActions","Actions / obligations","3 pts"],
                          ["connaitOPCVM","investiOPCVM","OPCVM (fonds actions, mixtes)","3 pts"],
                          ["connaitImmo","investiImmo","Immobilier (SCPI, OPCI, SCI)","2 pts"],
                          ["connaitTrackers","investiTrackers","Trackers / ETF (fonds indiciels)","3 pts"],
                          ["connaitStructures","investiStructures","Produits structurés (EMTN…)","4 pts"],
                        ] as [keyof typeof mission, keyof typeof mission, string, string][]).map(([kC, kI, label, pts]) => (
                          <tr key={kC} className="border-t border-white/50">
                            <td className="py-1.5 pr-3">{label}</td>
                            <td className="text-center"><input type="checkbox" checked={mission[kC] as boolean} onChange={e => updateMission(kC, e.target.checked)} className="h-4 w-4 accent-[#26428B]" /></td>
                            <td className="text-center"><label className="flex items-center justify-center gap-1 cursor-pointer"><input type="checkbox" checked={mission[kI] as boolean} onChange={e => updateMission(kI, e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span className="text-xs text-slate-500">{pts}</span></label></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Q4 - Pertes/Gains */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-red-700">Q4a — Pertes déjà subies</div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={mission.aSubiPertes} onChange={e => updateMission("aSubiPertes", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
                        <span>Oui, j'ai subi des pertes</span>
                      </label>
                      {mission.aSubiPertes && (
                        <div className="mt-2 space-y-1.5">
                          <div className="text-xs text-slate-500 mb-1">Ampleur :</div>
                          {([[-5,"De 0 à -5%"],[-10,"De -6% à -10%"],[-20,"De -11% à -20%"],[-99,"Supérieure à -20%"]] as [number,string][]).map(([v,l]) => (
                            <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="radio" name="ampleurPertes" checked={mission.ampleurPertes === v} onChange={() => updateMission("ampleurPertes", v)} className="h-3.5 w-3.5 accent-[#26428B]" />
                              <span>{l}</span>
                            </label>
                          ))}
                          <div className="text-xs text-slate-500 mt-2 mb-1">Réaction :</div>
                          {([[1,"J'ai vendu (1 pt)"],[2,"J'ai attendu (2 pts)"],[3,"J'ai réinvesti (3 pts)"]] as [number,string][]).map(([v,l]) => (
                            <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="radio" name="reactionPertes" checked={mission.reactionPertes === v} onChange={() => updateMission("reactionPertes", v as 0|1|2|3)} className="h-3.5 w-3.5 accent-[#26428B]" />
                              <span>{l}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-green-700">Q4b — Gains déjà réalisés</div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={mission.aRealiseGains} onChange={e => updateMission("aRealiseGains", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
                        <span>Oui, j'ai réalisé des gains</span>
                      </label>
                      {mission.aRealiseGains && (
                        <div className="mt-2 space-y-1.5">
                          <div className="text-xs text-slate-500 mb-1">Ampleur :</div>
                          {([[5,"De 0% à 5%"],[10,"De +6% à 10%"],[20,"De +11% à 20%"],[99,"Supérieure à 20%"]] as [number,string][]).map(([v,l]) => (
                            <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="radio" name="ampleurGains" checked={mission.ampleurGains === v} onChange={() => updateMission("ampleurGains", v)} className="h-3.5 w-3.5 accent-[#26428B]" />
                              <span>{l}</span>
                            </label>
                          ))}
                          <div className="text-xs text-slate-500 mt-2 mb-1">Réaction :</div>
                          {([[1,"J'ai tout vendu (1 pt)"],[2,"J'ai attendu (2 pts)"],[3,"J'ai réinvesti (3 pts)"]] as [number,string][]).map(([v,l]) => (
                            <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                              <input type="radio" name="reactionGains" checked={mission.reactionGains === v} onChange={() => updateMission("reactionGains", v as 0|1|2|3)} className="h-3.5 w-3.5 accent-[#26428B]" />
                              <span>{l}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Q5 - Mode gestion */}
                  <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q5 — Mode de gestion retenu</div>
                    <div className="space-y-2">
                      {([["pilote","Gestion pilotée — je délègue à des professionnels (2 pts)"],["libre","Gestion libre — je gère moi-même (4 pts)"]] as [string,string][]).map(([v,l]) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="radio" name="modeGestion" checked={mission.modeGestion === v} onChange={() => updateMission("modeGestion", v)} className="h-4 w-4 accent-[#26428B]" />
                          <span>{l}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Q6 - Connaissances théoriques */}
                  <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q6 — Connaissances financières (2 pts chacune)</div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={mission.savoirUCRisque} onChange={e => updateMission("savoirUCRisque", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
                        <span>Un support en UC présente un risque de perte en capital (Oui = 2 pts)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={mission.savoirHorizonUC} onChange={e => updateMission("savoirHorizonUC", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
                        <span>Plus l'horizon est long, plus la part en UC peut être élevée (Oui = 2 pts)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={mission.savoirRisqueRendement} onChange={e => updateMission("savoirRisqueRendement", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
                        <span>Plus le risque est élevé, plus l'espérance de rendement est élevée (Oui = 2 pts)</span>
                      </label>
                    </div>
                  </div>

                  {/* Horizon */}
                  <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Horizon de placement</div>
                    <div className="flex gap-6 flex-wrap">
                      {([["0-4","0 à 4 ans (0 pt)"],["5-8","5 à 8 ans (4 pts)"],["9-15","9 à 15 ans (8 pts)"],["15+","+ de 15 ans (16 pts)"]] as [string, string][]).map(([val, label]) => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="radio" name="horizon" checked={mission.horizon === val} onChange={() => updateMission("horizon", val)} className="h-4 w-4 accent-[#26428B]" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Score */}
                  {(() => {
                    const pts = mission.attitude + mission.reactionBaisse +
                      (mission.connaitFondsEuros?1:0)+(mission.investiFondsEuros?1:0)+
                      (mission.connaitActions?1:0)+(mission.investiActions?3:0)+
                      (mission.connaitOPCVM?1:0)+(mission.investiOPCVM?3:0)+
                      (mission.connaitImmo?1:0)+(mission.investiImmo?2:0)+
                      (mission.connaitTrackers?1:0)+(mission.investiTrackers?3:0)+
                      (mission.connaitStructures?1:0)+(mission.investiStructures?4:0)+
                      (mission.reactionPertes||0)+(mission.reactionGains||0)+
                      (mission.modeGestion==="pilote"?2:mission.modeGestion==="libre"?4:0)+
                      (mission.savoirUCRisque?2:0)+(mission.savoirHorizonUC?2:0)+(mission.savoirRisqueRendement?2:0);
                    const profil = pts<=10?"Sécuritaire":pts<=20?"Prudent":pts<=40?"Équilibré":pts<=60?"Dynamique":"Offensif";
                    const horizonLabel: Record<string, string> = { "0-4": "court terme (0–4 ans)", "5-8": "moyen terme (5–8 ans)", "9-15": "long terme (9–15 ans)", "15+": "très long terme (+ 15 ans)" };
                    const profilDesc: Record<string, string> = {
                      "Sécuritaire": "La préservation du capital est votre priorité absolue. Votre portefeuille est composé quasi-exclusivement d'actifs sans risque (fonds euros, obligations). Vous acceptez une rentabilité faible en échange d'une garantie du capital.",
                      "Prudent": "Vous acceptez une légère exposition aux marchés pour améliorer le rendement, mais la stabilité reste primordiale. Une majorité d'actifs obligataires (70–80%) avec une petite poche actions (20–30%).",
                      "Équilibré": "Vous recherchez un compromis entre sécurité et performance. Votre allocation cible est 50/50 entre actifs obligataires et actions. Vous acceptez des fluctuations modérées sur le moyen terme.",
                      "Dynamique": "La croissance de votre patrimoine est votre objectif principal. Vous tolérez des variations significatives à court terme pour viser une performance supérieure à long terme. Allocation majoritairement actions (60–80%).",
                      "Offensif": "Vous êtes orienté performance maximale et acceptez des variations importantes de votre portefeuille. Une allocation très largement actions (80–100%), avec une vision long terme et une forte tolérance à la volatilité.",
                    };
                    const profilHorizonNote: Record<string, string> = {
                      "Sécuritaire": "Ce profil est adapté à tout horizon, y compris court terme.",
                      "Prudent": "Ce profil convient à un horizon de placement d'au moins 3 à 5 ans.",
                      "Équilibré": "Ce profil nécessite un horizon de placement d'au moins 5 à 7 ans pour lisser les fluctuations.",
                      "Dynamique": "Ce profil est adapté à un horizon long terme de 8 ans minimum pour absorber la volatilité.",
                      "Offensif": "Ce profil requiert un horizon très long terme (10 ans et plus) pour optimiser le rapport risque/rendement.",
                    };
                    const horizonStr = mission.horizon ? horizonLabel[mission.horizon] || "" : "";
                    const horizonNote = horizonStr ? ` Avec un horizon de placement ${horizonStr}, ${profil === "Sécuritaire" || profil === "Prudent" ? "ce profil est cohérent avec votre durée d'investissement." : profil === "Équilibré" ? "un profil équilibré est bien adapté à votre durée d'investissement." : "veillez à vous assurer que vous n'aurez pas besoin de ces fonds avant la fin de l'horizon prévu."}` : "";
                    return (
                      <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${BRAND.sky}` }}>
                        <div className="flex items-center gap-4 px-5 py-3 text-sm font-semibold" style={{ background: BRAND.navy, color: "#E3AF64" }}>
                          <span>Score : {pts} pts</span>
                          <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
                          <span>Profil déterminé : <strong>{profil}</strong></span>
                        </div>
                        <div className="px-5 py-4 space-y-2" style={{ background: "rgba(251,236,215,0.25)" }}>
                          <p className="text-sm" style={{ color: BRAND.navy }}>{profilDesc[profil]}</p>
                          {horizonNote && <p className="text-sm font-medium" style={{ color: BRAND.sky }}>{horizonNote}</p>}
                          <p className="text-xs text-slate-500 italic">{profilHorizonNote[profil]}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Rémunération */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>MODE DE RÉMUNÉRATION</h3>
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
                    <p className="text-xs text-slate-500">Sélectionner le mode applicable à cette mission (art. L521-2 code des assurances)</p>
                    <label className="flex items-start gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={mission.remuCommission} onChange={e => updateMission("remuCommission", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#26428B]" />
                      <span>Commission (rémunération incluse dans la prime d'assurance)</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={mission.remuHonoraire} onChange={e => updateMission("remuHonoraire", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#26428B]" />
                      <span>Honoraire payé directement par le client</span>
                    </label>
                    {mission.remuHonoraire && (
                      <div className="flex items-center gap-2 ml-6">
                        <span className="text-sm text-slate-600">Montant / mode de calcul :</span>
                        <input type="text" value={mission.remuHonoraireMontant} onChange={e => updateMission("remuHonoraireMontant", e.target.value)}
                          placeholder="Ex : 500 € ou 1% du capital"
                          className="rounded-lg border px-2 py-1 text-sm flex-1"
                          style={{ borderColor: "rgba(227,175,100,0.4)", background: "rgba(255,255,255,0.98)" }} />
                      </div>
                    )}
                    <label className="flex items-start gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={mission.remuMixte} onChange={e => updateMission("remuMixte", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#26428B]" />
                      <span>Combinaison honoraire + commission</span>
                    </label>
                  </div>
                </div>

                {/* Obligations fiscales */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>OBLIGATIONS FISCALES & CONFORMITÉ</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: BRAND.sky }}>Résidence fiscale France</div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residenceFranceIR} onChange={e => updateMission("residenceFranceIR", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Imposé à l'IR en France</span></label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residenceFranceIFI} onChange={e => updateMission("residenceFranceIFI", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Imposé à l'IFI en France</span></label>
                    </div>
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: BRAND.sky }}>FATCA & PPE</div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.nationaliteUS} onChange={e => updateMission("nationaliteUS", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Nationalité américaine</span></label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residentFiscalUS} onChange={e => updateMission("residentFiscalUS", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Résident fiscal USA</span></label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.ppe} onChange={e => updateMission("ppe", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Personne politiquement exposée</span></label>
                    </div>
                  </div>
                </div>

                {/* Lieu signature */}
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: BRAND.sky }}>SIGNATURE — LIEU</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">Fait à :</span>
                    <input type="text" value={mission.lieuSignature} onChange={e => updateMission("lieuSignature", e.target.value)}
                      className="rounded-xl border px-3 py-1.5 text-sm w-48"
                      style={{ borderColor: "rgba(227,175,100,0.4)", background: "rgba(255,255,255,0.98)" }} />
                  </div>
                </div>

                <Button className="rounded-xl px-5 py-2 text-sm font-medium shadow-md" style={{ background: BRAND.navy, color: "#fff" }} onClick={generateMissionPdf}>
                  <Download className="mr-2 h-4 w-4" />Générer PDF Lettre de mission
                </Button>

              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ PARAMÈTRES CABINET ════ */}
          <TabsContent value="parametres" className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={Settings} title="Paramètres cabinet" subtitle="Identité, coordonnées légales, visuels et couleurs pour tous les documents PDF." /></CardHeader>
              <CardContent className="space-y-6">

                {/* ── Logo & Signature ── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>IDENTITÉ VISUELLE</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Logo du cabinet</div>
                      <label className="cursor-pointer group relative inline-block" title="Cliquer pour changer le logo">
                        <img src={logoSrc} alt="Logo" className="h-20 w-auto object-contain rounded-lg transition-opacity group-hover:opacity-60" style={{ background: "#fff", padding: "6px", border: "1px solid #eee" }} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: BRAND.navy, color: "#fff" }}>
                            <Upload className="inline h-3 w-3 mr-1" />Changer
                          </div>
                        </div>
                        <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
                      </label>
                      <p className="text-xs text-slate-400">Cliquez sur le logo pour le remplacer</p>
                    </div>
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Signature du conseiller</div>
                      <div className="flex items-center gap-4">
                        {signatureSrc
                          ? <img src={signatureSrc} alt="Signature" className="h-14 w-auto object-contain rounded-lg" style={{ background: "#fff", padding: "4px", border: "1px solid #eee" }} />
                          : <div className="h-14 w-32 rounded-lg flex items-center justify-center text-xs text-slate-400" style={{ background: "#fff", border: "1px dashed #ccc" }}>Aucune signature</div>
                        }
                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition hover:opacity-90"
                          style={{ background: BRAND.sky, color: "#fff" }}>
                          <Upload className="h-4 w-4" />Charger signature
                          <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleSignatureUpload} />
                        </label>
                        {signatureSrc && (
                          <button onClick={() => setSignatureSrc("")} className="text-xs text-red-500 hover:text-red-700">Supprimer</button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">Formats acceptés : PNG, JPEG, SVG, WebP — fond transparent recommandé</p>
                    </div>
                  </div>
                </div>

                {/* ── Couleurs ── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>COULEURS DU CABINET (PDF)</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {([
                      ["colorNavy","Couleur principale (navy)"],
                      ["colorSky","Couleur secondaire (sky)"],
                      ["colorBlue","Accent bleu"],
                      ["colorGold","Or / accent"],
                      ["colorCream","Fond clair"],
                    ] as [keyof typeof DEFAULT_CABINET, string][]).map(([key, label]) => (
                      <div key={String(key)} className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full border-2 border-white shadow-md" style={{ background: cabinet[key] }} />
                        <label className="text-xs text-center text-slate-600 cursor-pointer">
                          {label}
                          <input type="color" value={cabinet[key]} onChange={e => updateCabinet(key, e.target.value)} className="sr-only" />
                        </label>
                        <input type="text" value={cabinet[key]} onChange={e => updateCabinet(key, e.target.value)}
                          className="w-20 text-center rounded-lg border px-1 py-0.5 text-xs font-mono"
                          style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Ces couleurs sont utilisées dans les en-têtes et éléments graphiques des PDF générés.</p>
                </div>

                {/* ── Coordonnées légales ── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>COORDONNÉES & MENTIONS LÉGALES</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      ["nom","Nom du cabinet"],["forme","Forme juridique"],
                      ["rcs","Numéro RCS"],["villeRcs","Ville RCS"],
                      ["adresse","Adresse"],["codePostal","Code postal"],
                      ["ville","Ville"],["tel","Téléphone"],
                      ["email","Email"],["conseiller","Nom du conseiller"],
                      ["orias","Numéro ORIAS"],["rcpAssureur","Assureur RCP"],
                      ["rcpContrat","N° contrat RCP"],
                    ] as [keyof typeof DEFAULT_CABINET, string][]).map(([key, label]) => (
                      <div key={String(key)}>
                        <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>{label}</Label>
                        <Input value={cabinet[key]} onChange={e => updateCabinet(key, e.target.value)} className="rounded-xl text-sm"
                          style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>Partenaires assurance</Label>
                      <Input value={cabinet.partenaires} onChange={e => updateCabinet("partenaires", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
                    <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>Médiateur</Label>
                      <Input value={cabinet.mediateur} onChange={e => updateCabinet("mediateur", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
                    <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>URL médiateur</Label>
                      <Input value={cabinet.mediateurUrl} onChange={e => updateCabinet("mediateurUrl", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
                    <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>Adresse postale médiateur</Label>
                      <Input value={cabinet.mediateurAdresse} onChange={e => updateCabinet("mediateurAdresse", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
                  </div>
                </div>

                <div className="rounded-2xl p-4 text-sm" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
                  <p className="font-semibold mb-2" style={{ color: BRAND.navy }}>💡 Ces paramètres alimentent automatiquement :</p>
                  <ul className="list-disc ml-4 space-y-1 text-sm" style={{ color: "#555" }}>
                    <li>Page de couverture de tous les PDFs (logo)</li>
                    <li>Page "Qui sommes-nous ?" de la Lettre de mission</li>
                    <li>Section réclamation et médiation</li>
                    <li>Politique de confidentialité RGPD</li>
                    <li>Page de signature (conseiller + signature visuelle)</li>
                    <li>Couleurs des en-têtes et éléments graphiques PDF</li>
                  </ul>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  if (auth.authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)" }}>
        <div className="text-slate-400 text-sm animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (auth.authState === "unauthenticated" || auth.authState === "expired") {
    return (
      <AuthGate
        authHook={auth}
        logoSrc={""}
        colorNavy={"#101B3B"}
        colorGold={"#E3AF64"}
        colorSky={"#26428B"}
        colorCream={"#FBECD7"}
      />
    );
  }

  return <AppInner userId={auth.user?.id ?? ""} onSignOut={auth.signOut} />;
}
