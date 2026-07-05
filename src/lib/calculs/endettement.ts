// ─── Source unique du taux d'endettement (ecran + PDF) ───────────────────────
// Formule complete unifiee 01/07 : loyers x0,70, CA TNS net (via
// resolveBeneficeTns), assurance immo + autres, pensions fallback safe.
// Cablage ecran/PDF = Lot 3.

import type { PatrimonialData } from "../../types/patrimoine";
import { resolveBeneficeTns, resolveSalaireRetenu } from "./ir";
import { resolveLoanValuesMulti, resolveOtherLoan } from "./credit";
import { n } from "./utils";

// ─── Charges de credit annuelles = numerateur du taux d'endettement ──────────
// Extrait en helper PUR (Lot budget) pour une source UNIQUE reutilisee a
// l'identique par computeTauxEndettement ET computeBudget. Le total est
// STRICTEMENT egal a l'ancien calcul inline : (mensualites immo + autres) x 12
// + assurances immo + autres — aucun test endettement ne change.
export function computeChargesCreditAnnuelles(data: PatrimonialData): {
  mensualiteImmoMensuelle: number;
  assuranceImmoAnnuelle: number;
  mensualiteAutresMensuelle: number;
  assuranceAutresAnnuelle: number;
  total: number;
} {
  const properties = Array.isArray(data.properties) ? data.properties : [];
  const otherLoans = Array.isArray(data.otherLoans) ? data.otherLoans : [];

  let monthlyImmo = 0;
  let assuranceImmoAnnuelle = 0;
  for (const p of properties) {
    const r = resolveLoanValuesMulti(p);
    monthlyImmo += r.monthlyPayment || 0;
    assuranceImmoAnnuelle += r.insurancePremiumAnnual || 0;
  }
  // Mensualité auto-calculée si non saisie (barrière douce, resolveOtherLoan).
  const monthlyAutres = otherLoans.reduce((s, l) => s + resolveOtherLoan(l).monthlyPayment, 0);
  // Assurance des autres credits : `insurancePremium` est ANNUELLE (libelle
  // "Prime annuelle (E)" dans TabCredits) et DISTINCTE de la mensualite du
  // credit (pas de double-compte). Comptee seulement si `hasInsurance`.
  const assuranceAutresAnnuelle = otherLoans.reduce(
    (s, l) => s + (l.hasInsurance ? n(l.insurancePremium) : 0),
    0,
  );
  const total =
    (monthlyImmo + monthlyAutres) * 12 + assuranceImmoAnnuelle + assuranceAutresAnnuelle;

  return {
    mensualiteImmoMensuelle: monthlyImmo,
    assuranceImmoAnnuelle,
    mensualiteAutresMensuelle: monthlyAutres,
    assuranceAutresAnnuelle,
    total,
  };
}

export function computeTauxEndettement(data: PatrimonialData): {
  numerateurAnnuel: number;
  denominateurAnnuel: number;
  tauxPct: number;
} {
  const properties = Array.isArray(data.properties) ? data.properties : [];

  // ─── Numerateur : charges de credit annuelles (helper partage) ──────────
  const numerateurAnnuel = computeChargesCreditAnnuelles(data).total;

  // ─── Denominateur : revenus annuels retenus ─────────────────────────────
  // Salaire retenu ALIGNE sur l'opt-in cumul (resolveSalaireRetenu, meme predicat
  // que computeIR) : un salaire dormant d'un TNS sans activite secondaire 'salariat'
  // est ignore, exactement comme dans le calcul IR.
  const salaires = resolveSalaireRetenu(data, 1) + resolveSalaireRetenu(data, 2);
  // Pensions : regle SAFE alignee sur computeIR (ir.ts:82) — pensions1+2 si
  // l'un est renseigne, sinon fallback sur le champ global. JAMAIS la somme
  // des trois (evite le double-compte global + nominatifs).
  const pP1 = n(data.pensions1 || "");
  const pP2 = n(data.pensions2 || "");
  const pensions = pP1 + pP2 > 0 ? pP1 + pP2 : n(data.pensions);
  // Loyers bruts ponderes a 70 % (methode bancaire).
  const loyers = properties.reduce((s, p) => s + n(p.rentGrossAnnual), 0) * 0.70;
  // CA TNS retenu au NET (benefice imposable via resolveBeneficeTns), PAS le CA brut.
  const beneficeTns = resolveBeneficeTns(data, 1) + resolveBeneficeTns(data, 2);
  const denominateurAnnuel = salaires + pensions + loyers + beneficeTns;

  const tauxPct = denominateurAnnuel > 0
    ? Math.round((numerateurAnnuel / denominateurAnnuel) * 1000) / 10
    : 0;

  return { numerateurAnnuel, denominateurAnnuel, tauxPct };
}
