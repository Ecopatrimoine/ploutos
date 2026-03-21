// Utilitaires — n(), euro(), calculs, helpers PCS et domaine
import type { Child, Property, PatrimonialData, TaxBracket, FilledBracket,
  Beneficiary, Heir, TestamentHeir, ChargesDetail } from '../../types/patrimoine';
import { PLACEMENT_TYPES_BY_FAMILY, AV_TYPES, BRAND, PCS_GROUPES, PCS_CATEGORIES } from '../../constants';

export function isIndependant(groupeCode: string): boolean {
  return groupeCode === "1" || groupeCode === "2";
}
export function isProfessionLiberale(categorieCode: string): boolean {
  return categorieCode === "31";
}
export function isArtisanCommerçant(groupeCode: string, categorieCode: string): boolean {
  return groupeCode === "2" && (categorieCode === "21" || categorieCode === "22");
}
export function isChefEntreprise(categorieCode: string): boolean {
  return categorieCode === "23";
}
export function isRetraite(groupeCode: string): boolean {
  return groupeCode === "7";
}
export function isSansActivite(groupeCode: string): boolean {
  return groupeCode === "8";
}
export function isFonctionnaire(categorieCode: string): boolean {
  return ["33", "45", "52", "53"].includes(categorieCode);
}
export function getGroupeLabel(groupeCode: string): string {
  return PCS_GROUPES.find(g => g.code === groupeCode)?.label ?? "";
}
export function getCategorieLabel(categorieCode: string): string {
  for (const cats of Object.values(PCS_CATEGORIES) as any[]) {
    const found = cats.find(c => c.code === categorieCode);
    if (found) return found.label;
  }
  return "";
}

// Compatibilité legacy — utilisé dans les PDFs




export const ALL_PLACEMENTS = Object.values(PLACEMENT_TYPES_BY_FAMILY).flat();



export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function n(v: unknown): number {
  const parsed = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function euro(v: unknown): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n(v));
}

export function isAV(type: string): boolean {
  return AV_TYPES.includes(type);
}

export function isPERType(type: string): boolean {
  return ["PER bancaire", "PER assurantiel", "Madelin"].includes(type);
}
// ── Helpers calcul crédit immobilier ─────────────────────────────────
export function calcMonthlyPayment(capital: number, rateAnnual: number, durationYears: number): number {
  if (capital <= 0 || durationYears <= 0) return 0;
  if (rateAnnual <= 0) return capital / (durationYears * 12);
  const tm = rateAnnual / 100 / 12;
  const n = durationYears * 12;
  return capital * tm / (1 - Math.pow(1 + tm, -n));
}
export function calcCapitalRemaining(capital: number, rateAnnual: number, durationYears: number, yearsElapsed: number): number {
  if (capital <= 0 || durationYears <= 0) return 0;
  if (rateAnnual <= 0) return Math.max(0, capital * (1 - yearsElapsed / durationYears));
  const tm = rateAnnual / 100 / 12;
  const n = durationYears * 12;
  const k = Math.floor(yearsElapsed * 12);
  return capital * (Math.pow(1 + tm, n) - Math.pow(1 + tm, k)) / (Math.pow(1 + tm, n) - 1);
}
export function calcAnnualInterests(capital: number, rateAnnual: number, durationYears: number, yearsElapsed: number): number {
  if (capital <= 0 || rateAnnual <= 0) return 0;
  const tm = rateAnnual / 100 / 12;
  const monthly = calcMonthlyPayment(capital, rateAnnual, durationYears);
  let totalInterest = 0;
  let rem = calcCapitalRemaining(capital, rateAnnual, durationYears, yearsElapsed);
  for (let i = 0; i < 12; i++) {
    const interest = rem * tm;
    totalInterest += interest;
    rem -= (monthly - interest);
    if (rem < 0) break;
  }
  return totalInterest;
}
export function calcIfiInFineDeduction(capital: number, durationYears: number, yearsElapsed: number): number {
  if (capital <= 0 || durationYears <= 0) return 0;
  return Math.max(0, capital * (1 - Math.floor(yearsElapsed) / durationYears));
}
export function yearsElapsedSince(startDate: string): number {
  if (!startDate) return 0;
  return Math.max(0, (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}
export function resolveLoanValues(property: Property): { capital: number; interestAnnual: number; ifiDeduction: number; monthlyPayment: number } {
  if (!property.loanEnabled) return { capital: 0, interestAnnual: 0, ifiDeduction: 0, monthlyPayment: 0 };
  const C = +(property.loanAmount || 0) || 0;
  const rate = +(property.loanRate || 0) || 0;
  const dur = +(property.loanDuration || 0) || 0;
  const elapsed = yearsElapsedSince(property.loanStartDate);
  const ltype = property.loanType || "amortissable";
  let capital = +(property.loanCapitalRemaining || 0) || 0;
  let interestAnnual = +(property.loanInterestAnnual || 0) || 0;
  let monthlyPayment = 0;
  if (C > 0 && dur > 0) {
    if (ltype === "in_fine") {
      if (capital === 0) capital = C;
      if (interestAnnual === 0) interestAnnual = C * rate / 100;
      monthlyPayment = C * rate / 100 / 12;
    } else if (ltype === "ptz") {
      if (capital === 0) capital = Math.max(0, calcCapitalRemaining(C, 0, dur, elapsed));
      interestAnnual = 0;
      monthlyPayment = calcMonthlyPayment(C, 0, dur);
    } else {
      if (capital === 0) capital = Math.max(0, calcCapitalRemaining(C, rate, dur, elapsed));
      if (interestAnnual === 0) interestAnnual = calcAnnualInterests(C, rate, dur, elapsed);
      monthlyPayment = calcMonthlyPayment(C, rate, dur);
    }
  }
  const ifiDeduction = ltype === "in_fine" && C > 0 && dur > 0
    ? calcIfiInFineDeduction(C, dur, elapsed) : capital;
  return { capital, interestAnnual, ifiDeduction, monthlyPayment };
}


// Fraction imposable rente PER (RVTO art. 158-6 CGI)
export function fractionRVTO(ageAtFirst: number): number {
  if (ageAtFirst < 50) return 0.70;
  if (ageAtFirst < 60) return 0.50;
  if (ageAtFirst < 70) return 0.40;
  return 0.30;
}

export function personLabel(data: PatrimonialData, which: 1 | 2): string {
  const first = which === 1 ? data.person1FirstName : data.person2FirstName;
  const last = which === 1 ? data.person1LastName : data.person2LastName;
  const raw = `${first || ""} ${last || ""}`.trim();
  return raw || (which === 1 ? "Personne 1" : "Personne 2");
}

export function childMatchesDeceased(link: string | null, deceasedPerson: "person1" | "person2"): boolean {
  if (link === "common_child") return true;
  if (link === "person1_only") return deceasedPerson === "person1";
  if (link === "person2_only") return deceasedPerson === "person2";
  return true;
}

export function getAgeFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDelta = now.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function getDemembrementPercentages(age: number | null) {
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

export function getBaseFiscalParts(data: PatrimonialData): number {
  // Concubinage = 2 foyers séparés → 1 part de base chacun
  return data.coupleStatus === "married" || data.coupleStatus === "pacs" ? 2 : 1;
}

// ── IR concubins : calcul séparé pour chaque personne ──────────────
export function computeIRConcubin(
  revenuNetPersonne: number,
  partsPersonne: number,
): { bareme: number; quotient: number; marginalRate: number } {
  const brackets: TaxBracket[] = [
    { from: 0, to: 11600, rate: 0 },
    { from: 11600, to: 29579, rate: 0.11 },
    { from: 29579, to: 84577, rate: 0.3 },
    { from: 84577, to: 181917, rate: 0.41 },
    { from: 181917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
  ];
  const quotient = partsPersonne > 0 ? revenuNetPersonne / partsPersonne : 0;
  const bareme = computeTaxFromBrackets(quotient, brackets).tax * partsPersonne;
  const marginalRate = quotient <= 11600 ? 0 : quotient <= 29579 ? 0.11 : quotient <= 84577 ? 0.3 : quotient <= 181917 ? 0.41 : 0.45;
  return { bareme, quotient, marginalRate };
}

/**
 * CGI art. 194 — parts fiscales enfants :
 * - 1er et 2e enfant : 0,5 part chacun (0,25 en garde alternée)
 * - 3e enfant et suivants : 1 part chacun (0,5 en garde alternée)
 *
 * Règle garde mixte (tableau DGFiP) :
 * Les enfants en résidence principale (garde exclusive) sont classés EN PREMIER
 * pour déterminer leur rang, avant les enfants en garde alternée.
 * Ex : 2 excl + 1 alt = rang 1 excl (0,5) + rang 2 excl (0,5) + rang 3 alt (0,5/2=0,25) = 1,25 ✓
 */
export function getChildrenFiscalParts(childrenData: Child[]): number {
  // Seuls les enfants rattachés au foyer fiscal donnent droit aux parts
  // Tri : garde exclusive (résidence principale) avant garde alternée — CGI art. 194
  const rattached = [...childrenData.filter((c) => c.rattached !== false)]
    .sort((a, b) => {
      if (a.custody === "alternate" && b.custody !== "alternate") return 1;
      if (a.custody !== "alternate" && b.custody === "alternate") return -1;
      return 0;
    });
  return rattached.reduce((sum, child, index) => {
    const isAlternate = child.custody === "alternate";
    const base = index < 2 ? 0.5 : 1;
    const basePart = isAlternate ? base / 2 : base;
    // Enfant handicapé : +0,5 part (exclusif) ou +0,25 (alternée) — CGI art. 195
    const handicapBonus = child.handicap ? (isAlternate ? 0.25 : 0.5) : 0;
    return sum + basePart + handicapBonus;
  }, 0);
}

// Abattement IR pour personne handicapée (personne 1 ou 2 du foyer)
// CGI art. 157 bis : 2 627 € si revenu ≤ 16 410 €, 1 313 € si revenu ≤ 26 831 €
export function getHandicapAbattement(revenu: number): number {
  if (revenu <= 16410) return 2627;
  if (revenu <= 26831) return 1313;
  return 0;
}

export function getQuotientCapPerHalfPart(): number {
  return 1807;
}

export function getQuotiteDisponible(childrenCount: number): number {
  if (childrenCount <= 0) return 1;
  if (childrenCount === 1) return 0.5;
  if (childrenCount === 2) return 1 / 3;
  return 0.25;
}

export function isSpouseHeirEligible(data: PatrimonialData): boolean {
  return data.coupleStatus === "married";
}

export function getAvailableSpouseOptions(data: PatrimonialData, deceasedPerson: "person1" | "person2") {
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

export function buildCollectedHeirs(data: PatrimonialData, deceasedPerson: "person1" | "person2"): Heir[] {
  const heirs: Heir[] = [];
  if (deceasedPerson === "person1" && (data.person2FirstName || data.person2LastName)) {
    heirs.push({ name: personLabel(data, 2), relation: "conjoint", share: "0", priorDonations: "0", childLink: null });
  }
  if (deceasedPerson === "person2" && (data.person1FirstName || data.person1LastName)) {
    heirs.push({ name: personLabel(data, 1), relation: "conjoint", share: "0", priorDonations: "0", childLink: null });
  }
  data.childrenData.forEach((child, i) => {
    // N'inclure que les enfants héritiers du défunt selon la filiation
    if (!childMatchesDeceased(child.parentLink || "common_child", deceasedPerson)) return;
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

export function buildTestamentHeirs(testamentHeirs: TestamentHeir[], childrenData?: PatrimonialData["childrenData"]): Heir[] {
  return testamentHeirs.map((heir) => {
    // Retrouver le vrai parentLink depuis la collecte si disponible
    const matchedChild = heir.relation === "enfant" && childrenData
      ? childrenData.find(c =>
          (c.firstName || "").toLowerCase() === heir.firstName.toLowerCase() &&
          (c.lastName || "").toLowerCase() === heir.lastName.toLowerCase()
        )
      : null;
    return {
      name: `${heir.firstName || ""} ${heir.lastName || ""}`.trim() || "Héritier testamentaire",
      relation: heir.relation,
      share: "0",
      priorDonations: heir.priorDonations || "0",
      childLink: matchedChild ? (matchedChild.parentLink || "common_child") : (heir.relation === "enfant" ? "common_child" : null),
    };
  });
}

/** Retourne uniquement les bénéficiaires avec un nom non vide */
export function getFamilyBeneficiaries(data: PatrimonialData): Beneficiary[] {
  const beneficiaries: Beneficiary[] = [];
  const name1 = `${data.person1FirstName || ""} ${data.person1LastName || ""}`.trim();
  const name2 = `${data.person2FirstName || ""} ${data.person2LastName || ""}`.trim();
  if (name1) beneficiaries.push({ name: name1, relation: "conjoint", share: "0" });
  if (name2) beneficiaries.push({ name: name2, relation: "conjoint", share: "0" });
  data.childrenData.forEach((child) => {
    const childName = `${child.firstName || ""} ${child.lastName || ""}`.trim();
    if (childName) beneficiaries.push({
      name: childName,
      // parentLink stocké pour résolution au moment du calcul (décès connu)
      relation: "enfant",
      parentLink: child.parentLink || "common_child",
      share: "0",
    } as Beneficiary & { parentLink: string });
  });
  return beneficiaries;
}

export function computeKilometricAllowance(km: number, cv: number): number {
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

export function computeTaxFromBrackets(base: number, brackets: TaxBracket[]) {
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


// ─── HELPERS DOMAINE ──────────────────────────────────────────────────────────

export function placementFiscalSummary(type: string) {
  if (["Livret A", "LDDS", "LEP"].includes(type)) return { ir: "Exonéré", ifi: "Hors assiette", succession: "Actif successoral" };
  if (type === "Compte courant") return { ir: "Sans fiscalité propre", ifi: "Hors assiette", succession: "Actif successoral" };
  if (["Compte à terme", "PEL", "CEL"].includes(type)) return { ir: "Intérêts imposables", ifi: "Hors assiette", succession: "Actif successoral" };
  if (["Compte-titres", "Actions non cotées", "OPCVM / ETF", "PEA"].includes(type)) return { ir: "PFU ou barème", ifi: "Hors assiette", succession: "Actif successoral" };
  if (isAV(type)) return { ir: "Fiscalité de rachat", ifi: "Hors assiette", succession: "990 I / 757 B" };
  return { ir: "À qualifier", ifi: "Hors assiette", succession: "À qualifier" };
}

export function propertyNeedsRent(type: string) { return ["Location nue", "LMNP", "LMP", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(type); }
export function propertyNeedsPropertyTax(type: string) { return type !== "SCPI"; }
export function propertyNeedsInsurance(type: string) { return ["Location nue", "LMNP", "LMP", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(type); }
export function propertyNeedsWorks(type: string) { return ["Location nue", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(type); }
export function propertyNeedsLoan(type: string) { return ["Résidence principale", "Résidence secondaire", "Location nue", "LMNP", "LMP", "SCI IR", "SCI IS", "SCPI", "Local professionnel", "Autre"].includes(type); }
export function placementNeedsTaxableIncome(type: string) { return !["Livret A", "LDDS", "LEP", "Compte courant"].includes(type) && !isAV(type); }
export function placementNeedsDeathValue(type: string) { return !isAV(type); }
export function isCashPlacement(type: string) { return PLACEMENT_TYPES_BY_FAMILY.cash.includes(type); }
export function placementNeedsOpenDate(type: string) { return ["Compte à terme", "PEL", "PEA", "Assurance-vie fonds euros", "Assurance-vie unités de compte", "Contrat de capitalisation", "PER bancaire", "PER assurantiel", "Madelin"].includes(type); }
export function placementNeedsPFU(type: string) { return ["Compte à terme", "PEL", "Compte-titres", "Actions non cotées", "OPCVM / ETF"].includes(type); }

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────

export function safeFilePart(value: string) {
  return (value || "client").trim().toLowerCase()
    .replace(/[^a-z0-9àâäçéèêëîïôöùûüÿñæœ-]+/gi, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "") || "client";
}

export function buildExportFileName(clientName: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ecopatrimoine-${safeFilePart(clientName)}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

// ─── SELF-CHECKS ──────────────────────────────────────────────────────────────

export function sumChargesDetail(d: ChargesDetail): number {
  return ["loyer","materiel","deplacements","repas","tns","bancaires","comptable","autres"]
    .reduce((acc, k) => acc + (parseFloat((d as any)[k]) || 0), 0);
}