// ─── Moteur CIPAV (professions libérales non réglementées) — calculs purs ──
//
// Architecture DIFFÉRENTE de la CARMF (SPEC_PREVOYANCE_CIPAV, bloc
// docs/bloc-cipav-2026.json) :
//   J4-J90  : IJ libéraux (RAAM/730, plafond 3×PASS, plancher 26,33 €/j).
//             Barème DISTINCT du bloc CPAM salarié (cap 41,95 €/j) — la
//             CIPAV réutilise le DISPOSITIF libéraux, pas le bloc salarié.
//   J91 → invalidité : TROU. Aucun relais IJ (0 €). Constat choc en RDV.
//   invalidité → 62 ans (totale) / 67 ans (partielle) : pension par points.
//
// Socle commun « points prévoyance » (réforme 2023, fin des classes A-H) :
//   points = (revenu × 0,005) / 0,013      [valeur service point = 3,01 €]
// Diviseurs différents selon la prestation : invalidité points/3,
// rentes points/10, capital décès points entiers.
//
// Décision lot : revenu de référence = N-2 (champ unique cipav.revenuBNC_N2),
// par prudence fiscale et cohérence avec les IJ. Les barèmes sont lus depuis
// le bloc `referentiels.cipav` (source lacipav.fr + ameli.fr, vérifié
// 2026-05-29). Aucune valeur inventée.

import type { CipavConfig } from "./types";

type CipavRef = any; // structure dédiée du bloc (cf. cipav-2026.json)

// Nombre de points prévoyance ouverts par le revenu déclaré.
//   points = (revenu × cotisationInvDecesTaux) / valeurAchatPoint
export function pointsCipav(cipavRef: CipavRef, revenu: number): number {
  const p = cipavRef.pointsPrevoyance;
  if (revenu <= 0) return 0;
  const cotisation = revenu * p.cotisationInvDecesTaux;
  return cotisation / p.valeurAchatPoint;
}

// IJ journalière libéraux au jour t (phase 1, J4-J90). Retourne 0 hors
// fenêtre, sous carence, sous le seuil d'éligibilité, si l'affiliation est
// < 1 an, ou en cumul emploi-retraite. RAAM plafonné à 3×PASS, plancher
// 26,33 €/j appliqué dès lors que le droit est ouvert.
export function ijCipavPhase1Journaliere(
  cipavRef: CipavRef,
  cfg: CipavConfig,
  jour: number
): number {
  const ij = cipavRef.ijCpamLiberaux;
  if (jour < ij.premierJourIndemnise || jour > ij.dernierJourIndemnise) return 0;
  if (cfg.cumulEmploiRetraite) return 0;
  if (cfg.ancienneteAffiliationMois < ij.affiliationMinMois) return 0; // affiliation < 1 an → trou dès J4
  const revenu = cfg.revenuBNC_N2;
  if (revenu < ij.seuilEligibiliteRevenu) return 0; // sous le seuil → pas d'IJ
  const raam = Math.min(revenu, ij.raamPlafondAnnuel);
  let ijj = Math.min(raam / ij.diviseurRAAM, ij.ijMaxJournaliere);
  ijj = Math.max(ijj, ij.ijMinJournaliere); // plancher (hors micro-entrepreneurs, non modélisé)
  return ijj;
}

// Pension d'invalidité TOTALE annuelle (taux 100 %) :
//   forfait (5 % PASS) + (points / 3) × valeurServicePoint
export function pensionInvaliditeTotaleCipavAnnuelle(cipavRef: CipavRef, revenu: number): number {
  const inv = cipavRef.invalidite;
  const pts = pointsCipav(cipavRef, revenu);
  return inv.forfaitAnnuel + (pts / inv.diviseurPoints) * cipavRef.pointsPrevoyance.valeurServicePoint;
}

// Pension d'invalidité annuelle effective selon le taux de la config :
//   < seuil (66 %) → 0 ; 66-99 % → totale × taux/100 ; ≥ 100 % → totale.
// Nulle en cumul emploi-retraite.
export function pensionInvaliditeCipavAnnuelle(cipavRef: CipavRef, cfg: CipavConfig): number {
  if (cfg.cumulEmploiRetraite) return 0;
  const seuil = cipavRef.invalidite.seuilTauxMinimal;
  if (cfg.tauxInvalidite < seuil) return 0;
  const totale = pensionInvaliditeTotaleCipavAnnuelle(cipavRef, cfg.revenuBNC_N2);
  if (cfg.tauxInvalidite >= 100) return totale;
  return totale * (cfg.tauxInvalidite / 100);
}

// Jour (depuis J0) où la pension d'invalidité CIPAV s'arrête : 62e
// anniversaire (invalidité totale) ou 67e (partielle), approximé en
// jours-calendaires depuis l'âge à J0.
export function jourFinInvaliditeCipav(cipavRef: CipavRef, ageActuel: number, tauxInvalidite: number): number {
  const inv = cipavRef.invalidite;
  const cutoff = tauxInvalidite >= 100 ? inv.cutoffAgeTotale : inv.cutoffAgePartielle;
  return Math.max(0, (cutoff - ageActuel) * 365);
}

// Capital décès CIPAV (€), exonéré :
//   forfait (15 % PASS) + (points [+5 000 si décès accidentel]) × 3,01
export function capitalDecesCipav(cipavRef: CipavRef, revenu: number, decesAccidentel: boolean): number {
  const cd = cipavRef.capitalDeces;
  const pts = pointsCipav(cipavRef, revenu) + (decesAccidentel ? cd.majorationDecesAccidentelPoints : 0);
  return cd.forfait + pts * cipavRef.pointsPrevoyance.valeurServicePoint;
}

// Rente annuelle conjoint OU enfant (même formule) :
//   forfait (1,5 % PASS) + (points / 10) × 3,01
// La rente enfant est servie PAR enfant (multiplier au point d'appel).
export function renteCipavAnnuelle(cipavRef: CipavRef, revenu: number): number {
  const r = cipavRef.rentes;
  const pts = pointsCipav(cipavRef, revenu);
  return r.forfaitAnnuel + (pts / r.diviseurPoints) * cipavRef.pointsPrevoyance.valeurServicePoint;
}
