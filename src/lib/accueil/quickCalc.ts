// ─── Calculs rapides (accueil) — adaptateurs des fonctions PURES du moteur ─────
// Ces helpers CONSOMMENT le moteur fiscal, ils n'en dupliquent aucune logique.
// Seule arithmétique locale autorisée (cf. Lot 3) : coût total du crédit
// = mensualité × n − capital. Aucune règle fiscale recalculée ici.

import { calcMonthlyPayment } from "../calculs/credit";
import { computePvImmobiliere, type PvImmobiliereResult } from "../calculs/pvImmobiliere";

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
