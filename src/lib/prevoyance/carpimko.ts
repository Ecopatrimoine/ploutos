// ─── Moteur CARPIMKO (auxiliaires médicaux libéraux) — calculs purs ────────
//
// Auxiliaires médicaux : masseurs-kinés, infirmiers (IDEL), orthophonistes,
// orthoptistes, pédicures-podologues.
//
// Architecture PROCHE de la CARMF (relais IJ propre à J91), MAIS prestations
// entièrement FORFAITAIRES (indépendantes du revenu) — contrairement à la
// CARMF (IJ liées au revenu) et à la CIPAV (points proportionnels) :
//   J4-J90  : IJ libéraux (RAAM/730, plafond 3×PASS, plancher 26,33 €/j).
//             SEUL barème lié au revenu (N-2). Dispositif commun CARMF/CIPAV.
//   J91 → fin 3e année : allocation journalière FORFAITAIRE 55,44 €/j
//             (+ 8,06/descendant + 20,16 si tierce personne ; majoration
//             conjoint SUPPRIMÉE au 01/01/2025 → exclue).
//   4e année → : rente d'invalidité FORFAITAIRE par palier (10 080 partielle /
//             20 160 totale / 0 sous 66 %). Aucune borne d'âge documentée →
//             versée jusqu'à la fin de projection (décision lot).
//
// Barèmes lus depuis `referentiels.carpimko` (carpimko.com + agrégateurs
// concordants, vérifié 2026-05-29). Aucune valeur inventée. Les majorations
// d'invalidité (tierce personne / enfant) restent TO_VERIFY (divergence
// sources) → exposées en fonction pure mais NON appliquées dans la courbe.

import type { CarpimkoConfig } from "./types";

type CarpimkoRef = any; // structure dédiée du bloc (cf. carpimko-2026.json)

// IJ journalière libéraux phase 1 (J4-J90, dispositif commun CARMF/CIPAV).
// RAAM/730 plafonné à 3×PASS, plancher 26,33 €/j dès le droit ouvert.
// 0 hors fenêtre, sous carence, ou sous le seuil d'éligibilité.
export function ijCarpimkoPhase1Journaliere(
  carpimkoRef: CarpimkoRef,
  cfg: CarpimkoConfig,
  jour: number
): number {
  const ij = carpimkoRef.ijCpamLiberaux;
  if (jour < ij.premierJourIndemnise || jour > ij.dernierJourIndemnise) return 0;
  const revenu = cfg.revenuBNC_N2;
  if (revenu < ij.seuilEligibiliteRevenu) return 0;
  const raam = Math.min(revenu, ij.raamPlafondAnnuel);
  let ijj = Math.min(raam / ij.diviseurRAAM, ij.ijMaxJournaliere);
  return Math.max(ijj, ij.ijMinJournaliere);
}

// Allocation journalière FORFAITAIRE phase 2 (J91 → fin 3e année).
// Base 55,44 €/j + 8,06/descendant + 20,16 si tierce personne. Indépendante
// du revenu. Majoration conjoint exclue (supprimée 01/01/2025).
export function ijCarpimkoPhase2Journaliere(
  carpimkoRef: CarpimkoRef,
  cfg: CarpimkoConfig,
  jour: number
): number {
  const ph = carpimkoRef.ijCarpimkoPhase2;
  if (jour < ph.borneDebutJour || jour > ph.borneFinJour) return 0;
  let ijj = ph.montantBaseJour;
  ijj += ph.majorationDescendantJour * Math.max(0, cfg.nbEnfants);
  if (cfg.besoinTiercePersonne) ijj += ph.majorationTiercePersonneJour;
  return ijj;
}

// Rente d'invalidité FORFAITAIRE annuelle par palier (hors majorations
// TO_VERIFY) : < 66 % → 0 ; 66-99 % → partielle ; 100 % → totale.
export function renteInvaliditeCarpimkoAnnuelle(carpimkoRef: CarpimkoRef, cfg: CarpimkoConfig): number {
  const inv = carpimkoRef.invalidite;
  if (cfg.tauxInvalidite < inv.seuilTauxMinimal) return 0;
  if (cfg.tauxInvalidite >= 100) return inv.renteTotaleAnnuelle;
  return inv.rentePartielleAnnuelle;
}

// Majorations de la rente d'invalidité TOTALE (tierce personne / enfant).
// TO_VERIFY — divergence sources (enfant 3 024 vs 6 048) → NON appliquées
// dans la courbe de projection. Exposées pour vérification (it.skip) et
// usage futur une fois la source confirmée.
export function majorationsInvaliditeTotaleCarpimkoAnnuelle(carpimkoRef: CarpimkoRef, cfg: CarpimkoConfig): number {
  const inv = carpimkoRef.invalidite;
  let maj = 0;
  if (cfg.besoinTiercePersonne) maj += inv.majorationTiercePersonneAnnuelle;
  maj += inv.majorationEnfantAnnuelle * Math.max(0, cfg.nbEnfants);
  return maj;
}

// Capital décès FORFAITAIRE selon la situation familiale (PACS inclus).
//   conjoint + descendant à charge → 54 432 ; conjoint seul → 36 288 ;
//   sinon (ascendant/descendant sans ayant droit) → 18 144.
export function capitalDecesCarpimko(carpimkoRef: CarpimkoRef, cfg: CarpimkoConfig): number {
  const cd = carpimkoRef.capitalDeces;
  if (cfg.marie) {
    return cfg.nbEnfants > 0 ? cd.conjointAvecDescendant : cd.conjointSansDescendant;
  }
  return cd.ascendantOuDescendantSansAyantDroit;
}

// Rente de survie au conjoint (forfaitaire), si marié/PACS.
export function renteConjointCarpimkoAnnuelle(carpimkoRef: CarpimkoRef, cfg: CarpimkoConfig): number {
  return cfg.marie ? carpimkoRef.renteConjointAnnuelle : 0;
}

// Rente éducation forfaitaire, servie PAR enfant (total = montant × nbEnfants).
export function renteEducationCarpimkoAnnuelle(carpimkoRef: CarpimkoRef, cfg: CarpimkoConfig): number {
  return carpimkoRef.renteEducationParEnfantAnnuelle * Math.max(0, cfg.nbEnfants);
}
