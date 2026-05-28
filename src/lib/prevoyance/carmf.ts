// ─── Moteur CARMF (médecins libéraux) — calculs purs ──────────────────
//
// Architecture 2 étages (SPEC_PREVOYANCE_CARMF) :
//   J4-J90   : IJ CPAM (régime des libéraux délégué à la CPAM) — géré
//              par le calcul générique du moteur, PAS ici.
//   J91-J1095: IJ CARMF (ce module).
//   ≥ J1095  : pension d'invalidité CARMF jusqu'au 62e anniversaire.
//
// Les barèmes sont lus depuis le bloc référentiel `referentiels.carmf`
// (source : carmf.fr, vérifié 2026-05-28). Aucune valeur inventée.
//
// ⚠️ Tranche de revenu intermédiaire (entre seuilBas et seuilHaut) : la
// CARMF ne publie pas de formule exacte. Hypothèse de travail retenue :
//   - IJ : proportionnelle revenuN2 / 730 ;
//   - pension invalidité : interpolation LINÉAIRE entre les deux bornes.
// Documenté comme tel dans les tests.

import type { CarmfConfig } from "./types";

type CarmfRef = any; // structure dédiée du bloc (cf. carmf-2026.json)

const J_DEBUT_CARMF = 91;
const J_FIN_IJ = 1095;
const TRIM_CARENCE = 8; // 2 ans d'affiliation
const TRIM_PLEIN = 24; // 6 ans → taux plein

function prorataConjoint(cfg: CarmfConfig): number {
  if (cfg.statut !== "conjoint_collaborateur") return 1;
  return cfg.optionConjointCollaborateur === "quart" ? 0.25 : 0.5;
}

// Facteur d'antériorité (réduction si maladie antérieure à l'affiliation,
// approximée par l'ancienneté) : 8-15 trim → 1/3, 16-23 → 2/3, ≥24 → 1.
function facteurAnteriorite(trim: number): number {
  if (trim < 16) return 1 / 3;
  if (trim < TRIM_PLEIN) return 2 / 3;
  return 1;
}

// Année d'indemnisation CARMF (pour le barème dégressif 62-69 ans) :
// 1 = J91-J455, 2 = J456-J820, 3 = J821-J1095.
export function anneeIndemnisationCarmf(jour: number): number {
  return Math.min(3, Math.max(1, Math.floor((jour - J_DEBUT_CARMF) / 365) + 1));
}

// IJ journalière « taux normal » (< 62 ans) selon le revenu N-2.
function ijNormalSelonRevenu(carmfRef: CarmfRef, revenuN2: number): number {
  const t = carmfRef.ij.tranchesRevenu;
  const low = carmfRef.ij.tableauMedecin.moinsDe62Ans.revenuLow.montantParJour;
  const high = carmfRef.ij.tableauMedecin.moinsDe62Ans.revenuHigh.montantParJour;
  if (revenuN2 <= t.seuilBas) return low;
  if (revenuN2 >= t.seuilHaut) return high;
  return revenuN2 / 730; // tranche intermédiaire (hypothèse 1/730)
}

// IJ journalière brute médecin (avant prorata conjoint et antériorité),
// selon l'âge au jour considéré et l'année d'indemnisation.
export function ijCarmfBrute(
  carmfRef: CarmfRef,
  ageAuJour: number,
  revenuN2: number,
  anneeIndemnisation: number
): number {
  const ijNormal = ijNormalSelonRevenu(carmfRef, revenuN2);
  if (ageAuJour < 62) return ijNormal;
  if (ageAuJour < 70) {
    const taux = anneeIndemnisation === 1 ? 1.0 : anneeIndemnisation === 2 ? 0.75 : 0.5;
    return ijNormal * taux;
  }
  return ijNormal * 0.5; // ≥ 70 ans
}

// IJ journalière CARMF effective au jour t (0 hors fenêtre, carences,
// cumul emploi-retraite). ageActuel = âge au début de l'arrêt (J0).
export function computeIjCarmfJournaliere(
  carmfRef: CarmfRef,
  cfg: CarmfConfig,
  ageActuel: number,
  jour: number
): number {
  if (jour < J_DEBUT_CARMF || jour > J_FIN_IJ) return 0;
  if (cfg.cumulEmploiRetraite) return 0;
  if (cfg.ancienneteAffiliationTrimestres < TRIM_CARENCE) return 0; // carence d'affiliation
  const ageAuJour = ageActuel + jour / 365;
  const annee = anneeIndemnisationCarmf(jour);
  const brute = ijCarmfBrute(carmfRef, ageAuJour, cfg.revenuBNC_N2, annee);
  return brute * prorataConjoint(cfg) * facteurAnteriorite(cfg.ancienneteAffiliationTrimestres);
}

// Pension d'invalidité annuelle de base (avant majorations), prorata
// conjoint et antériorité appliqués. meilleurRevenu = revenuBNC_N2 par
// défaut (le « meilleur revenu 3 ans » exact n'est pas saisi).
export function pensionInvaliditeBaseAnnuelle(carmfRef: CarmfRef, cfg: CarmfConfig): number {
  if (cfg.cumulEmploiRetraite) return 0;
  if (cfg.ancienneteAffiliationTrimestres < TRIM_CARENCE) return 0;
  const t = carmfRef.invalidite.tranchesRevenu;
  const bas = carmfRef.invalidite.pensionMedecin.revenuLow.montantAnnuel; // 23662
  const haut = carmfRef.invalidite.pensionMedecin.revenuHigh.montantAnnuel; // 31549
  const r = cfg.revenuBNC_N2;
  let pension: number;
  if (r <= t.seuilBas) pension = bas;
  else if (r >= t.seuilHaut) pension = haut;
  else pension = bas + (haut - bas) * ((r - t.seuilBas) / (t.seuilHaut - t.seuilBas)); // interpolation linéaire (hypothèse)
  pension *= prorataConjoint(cfg);
  // Antériorité : réduction d'1/3 entre 8 et 15 trimestres.
  if (cfg.ancienneteAffiliationTrimestres < 16) pension *= 2 / 3;
  return pension;
}

// Pension d'invalidité annuelle TOTALE = base + majorations cumulables
// (conjoint écrêté, tierce personne, bonification familiale).
export function pensionInvaliditeTotaleAnnuelle(
  carmfRef: CarmfRef,
  cfg: CarmfConfig,
  nbEnfants: number
): number {
  const base = pensionInvaliditeBaseAnnuelle(carmfRef, cfg);
  if (base <= 0) return 0;
  const maj = carmfRef.invalidite.majorations;
  let total = base;
  // Majoration conjoint (écrêtée au plafond de ressources).
  if (cfg.marie && cfg.anneesMariage >= 2 && cfg.ressourcesConjoint <= maj.conjoint.plafondRessourcesConjoint) {
    let m = base * maj.conjoint.taux;
    if (cfg.ressourcesConjoint + m > maj.conjoint.plafondRessourcesConjoint) {
      m = Math.max(0, maj.conjoint.plafondRessourcesConjoint - cfg.ressourcesConjoint);
    }
    total += m;
  }
  if (cfg.besoinTiercePersonne) total += base * maj.tiercePersonne.taux;
  if (nbEnfants >= 3) total += base * maj.bonificationFamiliale.taux;
  return total;
}

// Rente enfants annuelle (étage distinct de la pension). nbEnfants =
// enfants ouvrant droit (< 21 ans, ou < 25 si études — approximé ici par
// le nombre d'enfants à charge saisi).
export function renteEnfantsInvaliditeAnnuelle(
  carmfRef: CarmfRef,
  cfg: CarmfConfig,
  nbEnfants: number
): number {
  if (nbEnfants <= 0) return 0;
  if (pensionInvaliditeBaseAnnuelle(carmfRef, cfg) <= 0) return 0; // pas de droit ouvert
  const r = carmfRef.invalidite.rentesEnfants;
  const parEnfant =
    cfg.statut === "conjoint_collaborateur"
      ? cfg.optionConjointCollaborateur === "quart"
        ? r.optionQuart.annuel
        : r.optionMoitie.annuel
      : r.parEnfant.annuel;
  return nbEnfants * parEnfant;
}

// Jour (depuis J0) où la pension d'invalidité CARMF s'arrête : 62e
// anniversaire (approximé en jours-calendaires depuis l'âge à J0 ; la
// règle exacte « 1er jour du trimestre suivant » nécessiterait la date de
// naissance, non disponible dans EntreePerso).
export function jourFinInvaliditeCarmf(ageActuel: number): number {
  return Math.max(0, (62 - ageActuel) * 365);
}

// Capital décès CARMF (€) selon le statut.
export function capitalDecesCarmf(carmfRef: CarmfRef, cfg: CarmfConfig): number {
  if (cfg.statut === "conjoint_collaborateur") {
    const c = carmfRef.deces.capitalDecesConjointCollaborateur;
    return cfg.optionConjointCollaborateur === "quart" ? c.optionQuart : c.optionMoitie;
  }
  return carmfRef.deces.capitalDecesMedecin.montant;
}
