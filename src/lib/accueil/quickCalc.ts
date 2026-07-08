// ─── Calculs rapides (accueil) — adaptateurs des fonctions PURES du moteur ─────
// Ces helpers CONSOMMENT le moteur fiscal, ils n'en dupliquent aucune logique.
// Seule arithmétique locale autorisée (cf. Lot 3) : coût total du crédit
// = mensualité × n − capital. Aucune règle fiscale recalculée ici.

import { calcMonthlyPayment } from "../calculs/credit";
import { computePvImmobiliere, type PvImmobiliereResult } from "../calculs/pvImmobiliere";
import { computeBaremeNet, computeIRConcubin, getChildrenFiscalParts, computeTaxFromBrackets } from "../calculs/utils";
import { getDonationTaxProfile } from "../calculs/donation";
import { computeIFI } from "../calculs/ifi";
import { referentiels } from "../../data/prevoyance";
import { computeIjCarmfJournaliere, pensionInvaliditeTotaleAnnuelle, capitalDecesCarmf } from "../prevoyance/carmf";
import { ijCipavPhase1Journaliere, pensionInvaliditeCipavAnnuelle, capitalDecesCipav } from "../prevoyance/cipav";
import { ijCarpimkoPhase1Journaliere, renteInvaliditeCarpimkoAnnuelle, capitalDecesCarpimko } from "../prevoyance/carpimko";
import type { Child, CarmfConfig, CipavConfig, CarpimkoConfig, FilledBracket } from "../../types/patrimoine";

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

// ── IFI (impôt sur la fortune immobilière) ──────────────────────────────────
// Le barème IFI (tranches, seuil 1,3 M, décote 1,3-1,4 M) et l'abattement 30 % RP
// sont INLINE dans computeIFI (aucune fonction isolée « netTaxable -> IFI »).
// On CONSOMME computeIFI (déjà exporté) via une propriété minimale construite :
// aucune règle recalculée, aucune modification du moteur.
export const IFI_SEUIL = 1300000;

export type IfiSummary = {
  valid: boolean;
  assujetti: boolean;    // netTaxable > seuil 1,3 M
  netTaxable: number;
  ifi: number;
  decote: number;
  tauxMoyen: number;     // ifi / netTaxable
  bracketFill: FilledBracket[];
};

// Propriété minimale (sans crédit) — seuls value/type/propertyRight/ownership sont
// lus par computeIFI ; le type "Résidence principale" déclenche l'abattement 30 %.
function ifiProperty(type: string, value: number) {
  return {
    name: type, type, ownership: "person1", propertyRight: "full",
    value: String(value), loanEnabled: false,
  };
}

// patrimoineNet = patrimoine immobilier net de dettes (valeur brute des biens) ;
// residencePrincipale = valeur brute de la RP incluse dans ce total (abattement
// 30 % appliqué par computeIFI). netTaxable = patrimoineNet - 0,3 x RP.
export function ifiSummary(patrimoineNet: number, residencePrincipale: number): IfiSummary {
  if (!(patrimoineNet > 0)) {
    return { valid: false, assujetti: false, netTaxable: 0, ifi: 0, decote: 0, tauxMoyen: 0, bracketFill: [] };
  }
  const rp = Math.max(0, Math.min(residencePrincipale, patrimoineNet));
  const autre = patrimoineNet - rp;
  const properties: any[] = [];
  if (rp > 0) properties.push(ifiProperty("Résidence principale", rp));
  if (autre > 0) properties.push(ifiProperty("Autre", autre));
  const r = computeIFI({ properties, childrenData: [] } as any);
  return {
    valid: true,
    assujetti: r.netTaxable > IFI_SEUIL,
    netTaxable: r.netTaxable,
    ifi: r.ifi,
    decote: r.decote,
    tauxMoyen: r.netTaxable > 0 ? r.ifi / r.netTaxable : 0,
    bracketFill: r.bracketFill,
  };
}

// ── Prévoyance obligatoire ───────────────────────────────────────────────────
// Verdict étape 0 : seules CARMF / CIPAV / CARPIMKO exposent des briques pures
// dédiées produisant IJ + invalidité + capital décès directement (les caisses
// forfaitaires n'exposent PAS l'IJ complète -> reportées). On CONSOMME ces briques
// avec un profil par défaut simple ; aucune valeur réglementaire recalculée.
export type PrevoyanceCaisse = "CARMF" | "CIPAV" | "CARPIMKO";

export const PREVOYANCE_CAISSES: { value: PrevoyanceCaisse; label: string }[] = [
  { value: "CARMF", label: "CARMF (médecins)" },
  { value: "CIPAV", label: "CIPAV (professions libérales)" },
  { value: "CARPIMKO", label: "CARPIMKO (auxiliaires médicaux)" },
];

export type PrevoyanceSummary = {
  valid: boolean;
  ijJour: number;        // €/jour — invalidité temporaire (régime obligatoire)
  invaliditeAn: number;  // €/an — invalidité totale
  capitalDeces: number;  // € — versement unique
};

// Profil par défaut (affiché en note) : affiliation ancienne (hors carence),
// invalidité totale, célibataire sans enfant, statut titulaire.
export function prevoyanceSummary(caisse: PrevoyanceCaisse, revenuAnnuel: number, age: number): PrevoyanceSummary {
  const invalid = { valid: false, ijJour: 0, invaliditeAn: 0, capitalDeces: 0 };
  if (!(revenuAnnuel > 0) || !(age > 0)) return invalid;

  if (caisse === "CARMF") {
    const cfg: CarmfConfig = {
      statut: "medecin_titulaire", revenuBNC_N2: revenuAnnuel,
      ancienneteAffiliationTrimestres: 40, cumulEmploiRetraite: false,
      marie: false, anneesMariage: 0, ressourcesConjoint: 0, besoinTiercePersonne: false,
    };
    return {
      valid: true,
      ijJour: computeIjCarmfJournaliere(referentiels.carmf, cfg, age, 100),
      invaliditeAn: pensionInvaliditeTotaleAnnuelle(referentiels.carmf, cfg, 0),
      capitalDeces: capitalDecesCarmf(referentiels.carmf, cfg),
    };
  }
  if (caisse === "CIPAV") {
    const cfg: CipavConfig = {
      revenuBNC_N2: revenuAnnuel, ancienneteAffiliationMois: 60, cumulEmploiRetraite: false,
      tauxInvalidite: 100, marie: false, nbEnfants: 0, decesAccidentel: false,
    };
    return {
      valid: true,
      ijJour: ijCipavPhase1Journaliere(referentiels.cipav, cfg, 30),
      invaliditeAn: pensionInvaliditeCipavAnnuelle(referentiels.cipav, cfg),
      capitalDeces: capitalDecesCipav(referentiels.cipav, revenuAnnuel, false),
    };
  }
  // CARPIMKO
  const cfg: CarpimkoConfig = {
    revenuBNC_N2: revenuAnnuel, tauxInvalidite: 100, nbEnfants: 0,
    besoinTiercePersonne: false, marie: false,
  };
  return {
    valid: true,
    ijJour: ijCarpimkoPhase1Journaliere(referentiels.carpimko, cfg, 30),
    invaliditeAn: renteInvaliditeCarpimkoAnnuelle(referentiels.carpimko, cfg),
    capitalDeces: capitalDecesCarpimko(referentiels.carpimko, cfg),
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
  quotient: number;   // revenu imposable / parts (base du graphique par tranche)
  decote: number;     // montant de décote appliqué (0 si aucune)
  plafonnementActif: boolean;
};

export function irSummary(revenuImposable: number, couple: boolean, nbEnfants: number): IrSummary {
  const baseParts = couple ? 2 : 1;
  if (!(revenuImposable > 0)) {
    return { valid: false, impot: 0, tmi: 0, tauxMoyen: 0, parts: baseParts, quotient: 0, decote: 0, plafonnementActif: false };
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
    quotient: revenuImposable / parts,
    decote: bn.decote,
    plafonnementActif: bn.plafonnementActif,
  };
}
