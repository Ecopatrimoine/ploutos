// ─── Calculs rapides (accueil) — adaptateurs des fonctions PURES du moteur ─────
// Ces helpers CONSOMMENT le moteur fiscal, ils n'en dupliquent aucune logique.
// Seule arithmétique locale autorisée (cf. Lot 3) : coût total du crédit
// = mensualité × n − capital. Aucune règle fiscale recalculée ici.

import { calcMonthlyPayment } from "../calculs/credit";
import { computePvImmobiliere, type PvImmobiliereResult } from "../calculs/pvImmobiliere";
import { computeBaremeNet, computeIRConcubin, getChildrenFiscalParts, computeTaxFromBrackets } from "../calculs/utils";
import { getDonationTaxProfile } from "../calculs/donation";
import type { Child } from "../../types/patrimoine";

// Saisie tolérante : espaces (séparateurs de milliers) + virgule décimale.
export function parseNum(s: string): number {
  const v = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

export function formatEur(v: number): string {
  return Number.isFinite(v) ? v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : "—";
}

export function formatPct(frac: number): string {
  return (frac * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

// ── Crédit ────────────────────────────────────────────────────────────────────
export type CreditSummary = {
  valid: boolean;
  mensualite: number;
  coutTotal: number;
  totalRembourse: number;
};

// capital (€), tauxAnnuelPct (% annuel, ex. 3.4), dureeAnnees (années) — unités
// attendues par calcMonthlyPayment (confirmées étape 0).
export function creditSummary(capital: number, tauxAnnuelPct: number, dureeAnnees: number): CreditSummary {
  if (!(capital > 0) || !(dureeAnnees > 0)) {
    return { valid: false, mensualite: 0, coutTotal: 0, totalRembourse: 0 };
  }
  const n = dureeAnnees * 12;
  const mensualite = calcMonthlyPayment(capital, tauxAnnuelPct, dureeAnnees);
  const totalRembourse = mensualite * n;
  return { valid: true, mensualite, coutTotal: totalRembourse - capital, totalRembourse };
}

// ── Plus-value immobilière (foncier nu, art. 150 U CGI) ─────────────────────────
export type PvSummary = PvImmobiliereResult & {
  valid: boolean;
  exonereIr: boolean; // abattement IR à 100 % (>= 22 ans)
  exonerePs: boolean; // abattement PS à 100 % (>= 30 ans)
};

// prixAcquisition (€), prixCession (€), dureeAnnees (années de détention = `age`).
// CONSOMME computePvImmobiliere (moteur) ; aucune règle fiscale recalculée ici.
export function pvImmoSummary(prixAcquisition: number, prixCession: number, dureeAnnees: number): PvSummary {
  const valid = prixAcquisition > 0 && prixCession > 0 && dureeAnnees >= 0;
  const r = computePvImmobiliere({ prixAcquisition, prixCession, age: dureeAnnees });
  return { ...r, valid, exonereIr: r.abattementIr >= 1, exonerePs: r.abattementPs >= 1 };
}

// ── Donation & succession (DMTG) ─────────────────────────────────────────────
// CONSOMME getDonationTaxProfile (abattement + barème par lien) + computeTaxFromBrackets
// (moteur). Aucun abattement ni barème recalculé ici.
export type DmtgSummary = {
  valid: boolean;
  abattement: number;          // abattement légal du lien
  abattementApplique: number;  // effectivement absorbé (min montant / abattement)
  baseTaxable: number;
  droits: number;
  netTransmis: number;
};

export function dmtgSummary(montant: number, relation: string): DmtgSummary {
  if (!(montant > 0)) {
    return { valid: false, abattement: 0, abattementApplique: 0, baseTaxable: 0, droits: 0, netTransmis: 0 };
  }
  const profile = getDonationTaxProfile(relation);
  const base = Math.max(0, montant - profile.allowance);
  const droits = computeTaxFromBrackets(base, profile.brackets).tax;
  return {
    valid: true,
    abattement: profile.allowance,
    abattementApplique: Math.min(montant, profile.allowance),
    baseTaxable: base,
    droits,
    netTransmis: montant - droits,
  };
}

// ── Capacité d'endettement ──────────────────────────────────────────────────
// Arithmétique pure (aucune logique fiscale) : taux d'effort = charges / revenus.
// Norme HCSF (Haut Conseil de stabilité financière) : taux d'effort <= 35 %,
// assurance emprunteur comprise. Constante nommée (pas un littéral dispersé).
export const HCSF_TAUX_EFFORT_MAX = 0.35;

export type EndettementSummary = {
  valid: boolean;
  tauxEffortActuel: number;         // fraction
  tauxEffortProjet: number | null;  // fraction, null si pas de projet saisi
  mensualiteMax35: number;          // €/mois : mensualité max supplémentaire avant 35 %
  resteAVivre: number;              // €/mois après charges (+ projet)
};

export function endettementSummary(revenusMensuels: number, chargesCredits: number, mensualiteProjet: number): EndettementSummary {
  if (!(revenusMensuels > 0)) {
    return { valid: false, tauxEffortActuel: 0, tauxEffortProjet: null, mensualiteMax35: 0, resteAVivre: 0 };
  }
  const charges = Math.max(0, chargesCredits);
  const projet = mensualiteProjet > 0 ? mensualiteProjet : 0;
  return {
    valid: true,
    tauxEffortActuel: charges / revenusMensuels,
    tauxEffortProjet: projet > 0 ? (charges + projet) / revenusMensuels : null,
    mensualiteMax35: Math.max(0, revenusMensuels * HCSF_TAUX_EFFORT_MAX - charges),
    resteAVivre: revenusMensuels - charges - projet,
  };
}

// ── IR barème ───────────────────────────────────────────────────────────────
// CONSOMME computeBaremeNet (barème + plafonnement QF + décote), computeIRConcubin
// (tranche marginale du quotient) et getChildrenFiscalParts (demi-parts enfants).
// TMI affichée reproduit EXACTEMENT tmiEffective.ts : plafonnement actif -> tranche
// de référence (revenu/baseParts) ; sinon tranche du quotient (revenu/parts).
export type IrSummary = {
  valid: boolean;
  impot: number;
  tmi: number;        // taux marginal affiché (fraction, ex. 0.30)
  tauxMoyen: number;  // fraction
  parts: number;
  plafonnementActif: boolean;
};

export function irSummary(revenuImposable: number, couple: boolean, nbEnfants: number): IrSummary {
  const baseParts = couple ? 2 : 1;
  if (!(revenuImposable > 0)) {
    return { valid: false, impot: 0, tmi: 0, tauxMoyen: 0, parts: baseParts, plafonnementActif: false };
  }
  const n = Math.max(0, Math.floor(nbEnfants));
  // Enfants à charge simples (garde exclusive, non handicapés) : la règle des
  // demi-parts est appliquée par getChildrenFiscalParts (moteur), pas ici.
  const children: Child[] = Array.from({ length: n }, () => ({ rattached: true, custody: "full", handicap: false } as Child));
  const childrenParts = getChildrenFiscalParts(children);
  const parts = baseParts + childrenParts;
  const parentIsole = !couple && childrenParts > 0; // célibataire avec enfants = case T
  const bn = computeBaremeNet({ revenuImposable, parts, baseParts, isCouple: couple, parentIsole });
  const mr = computeIRConcubin(revenuImposable, parts).marginalRate;
  const tmi = bn.plafonnementActif ? bn.marginalRateReference : mr;
  return {
    valid: true,
    impot: bn.bareme,
    tmi,
    tauxMoyen: bn.bareme / revenuImposable,
    parts,
    plafonnementActif: bn.plafonnementActif,
  };
}
