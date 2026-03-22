// Calcul crédit immobilier
import type { Property } from '../../types/patrimoine';
import { n } from './utils';

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
return Math.max(0, capital * (Math.pow(1 + tm, n) - Math.pow(1 + tm, k)) / (Math.pow(1 + tm, n) - 1));
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
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
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

// ── Multi-crédits ─────────────────────────────────────────────────────────────
import type { Loan } from '../../types/patrimoine';

/**
 * Résout un crédit individuel (Loan) — auto-calcul si champs vides, override sinon
 */
export function resolveOneLoan(loan: Loan): { capital: number; interestAnnual: number; ifiDeduction: number; monthlyPayment: number; insurancePremiumAnnual: number } {
  const C = n(loan.amount);
  const rate = n(loan.rate);
  const dur = n(loan.duration);
  const elapsed = yearsElapsedSince(loan.startDate);
  const ltype = loan.type || "amortissable";

  let capital = n(loan.capitalRemaining);       // 0 = auto-calculé
  let interestAnnual = n(loan.interestAnnual);  // 0 = auto-calculé
  let monthlyPayment = 0;

  if (C > 0 && dur > 0) {
    if (ltype === "in_fine") {
      if (capital === 0) capital = C;
      if (interestAnnual === 0) interestAnnual = C * rate / 100;
      monthlyPayment = C * rate / 100 / 12;
    } else if (ltype === "ptz" || ltype === "pel") {
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
    ? calcIfiInFineDeduction(C, dur, elapsed)
    : capital;

  // Prime assurance : auto-calculée si vide (taux moyen 0.3% du capital initial par an)
  const insurancePremiumAnnual = loan.insurance
    ? (n(loan.insurancePremium) > 0 ? n(loan.insurancePremium) : C * 0.003)
    : 0;

  return { capital, interestAnnual, ifiDeduction, monthlyPayment, insurancePremiumAnnual };
}

/**
 * Agrège tous les crédits d'un bien.
 * Si loans[] existe et non vide → utilise multi-crédits.
 * Sinon → fallback sur l'ancien resolveLoanValues().
 */
export function resolveLoanValuesMulti(property: import('../../types/patrimoine').Property): {
  capital: number;
  interestAnnual: number;
  ifiDeduction: number;
  monthlyPayment: number;
  insurancePremiumAnnual: number;
  loans: Array<{ loan: Loan; capital: number; interestAnnual: number; ifiDeduction: number; monthlyPayment: number; insurancePremiumAnnual: number }>;
} {
  const loans = property.loans;
  if (loans && loans.length > 0) {
    const resolved = loans.map(loan => ({ loan, ...resolveOneLoan(loan) }));
    return {
      capital: resolved.reduce((s, r) => s + r.capital, 0),
      interestAnnual: resolved.reduce((s, r) => s + r.interestAnnual, 0),
      ifiDeduction: resolved.reduce((s, r) => s + r.ifiDeduction, 0),
      monthlyPayment: resolved.reduce((s, r) => s + r.monthlyPayment, 0),
      insurancePremiumAnnual: resolved.reduce((s, r) => s + r.insurancePremiumAnnual, 0),
      loans: resolved,
    };
  }
  // Fallback ancien système
  const lv = resolveLoanValues(property);
  const insurancePremiumAnnual = property.loanInsurance ? n(property.loanInsurancePremium) : 0;
  return { ...lv, insurancePremiumAnnual, loans: [] };
}