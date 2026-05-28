// ─── Mapping PatrimonialData → EntreePerso (Lot 6 → pont LOT 7) ─────────
//
// Fonction pure utilisée par TabPrevoyancePerso (LOT 7) pour
// construire l'entrée moteur d'une personne à partir du payload
// Ploutos. Si data.travail n'existe pas pour la personne demandée
// (vieux dossier non migré, célibataire avec which="p2", etc.),
// la fonction retourne null — c'est le signal pour l'UI de masquer
// la colonne correspondante.
//
// Les contrats individuels et la couverture collective ne sont PAS
// remplis à ce stade : ils sont saisis dans la UI prévoyance au
// LOT 7 (et seront persistés dans data.prevoyance.{p1|p2} —
// cf. spec §2.2).

import type { PatrimonialData, StatutPro } from "../../types/patrimoine";
import type { EntreePerso } from "./types";
import { coefBrutNet, STATUTS_TNS, STATUTS_SALARIE } from "./constants";
import { computeBeneficeImposable } from "../calculs/ir";
import { n, isProfessionLiberale } from "../calculs/utils";

// Âge légal de retraite par défaut. Pour une personnalisation par
// génération (selon date de naissance), voir docs/ROADMAP_PREVOYANCE.md.
const AGE_RETRAITE_DEFAUT = 64;

// Bénéfice professionnel TNS d'une personne, via la fonction EXACTE
// utilisée par computeIR (pas de duplication de formule). isBNC / isBA
// déduits du PCS (groupe + catégorie), comme dans computeIR.
export function computeBeneficeTNS(data: PatrimonialData, which: "p1" | "p2"): number {
  const groupe = which === "p1" ? data.person1PcsGroupe : data.person2PcsGroupe;
  const categorie = which === "p1" ? data.person1Csp : data.person2Csp;
  const isBA = groupe === "1";
  const isBNC = isProfessionLiberale(categorie);
  const ca = n(which === "p1" ? data.ca1 : data.ca2);
  const bicType = which === "p1" ? data.bicType1 : data.bicType2;
  const microRegime = which === "p1" ? data.microRegime1 : data.microRegime2;
  const chargesReelles = n(which === "p1" ? data.chargesReelles1 : data.chargesReelles2);
  const baRevenue = n(which === "p1" ? data.baRevenue1 : data.baRevenue2);
  return computeBeneficeImposable(ca, bicType, isBNC, isBA, microRegime, chargesReelles, baRevenue);
}

export function calcAncienneteMois(dateEmbauche: string | null | undefined): number {
  if (!dateEmbauche) return 0;
  const start = new Date(dateEmbauche);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const diff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    (now.getDate() < start.getDate() ? -1 : 0);
  return Math.max(0, diff);
}

export function calcAgeFromBirth(birthDate: string | null | undefined): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mDelta = now.getMonth() - d.getMonth();
  if (mDelta < 0 || (mDelta === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, age);
}

function asNumber(v: string | undefined): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Construit l'entrée moteur pour la personne demandée.
 *
 * Renvoie null si :
 *  - data.travail est absent (dossier non migré)
 *  - data.travail[which] est null (cas P2 sur célibataire)
 */
export function buildEntreePerso(
  data: PatrimonialData,
  which: "p1" | "p2"
): EntreePerso | null {
  const travail = data.travail?.[which];
  if (!travail) return null;

  const birthDate = which === "p1" ? data.person1BirthDate : data.person2BirthDate;
  const age = calcAgeFromBirth(birthDate);

  const salaryAnnuel = asNumber(which === "p1" ? data.salary1 : data.salary2);
  // Salaire net mensuel conservé pour rétrocompat / affichage. La cible
  // de maintien employeur s'appuie désormais sur revenuReferenceMensuel
  // (calculé ci-dessous).
  const salaireNetMensuel =
    salaryAnnuel > 0
      ? salaryAnnuel / 12
      : travail.salaireBrutAnnuel > 0
      ? (travail.salaireBrutAnnuel * coefBrutNet(travail.statutPro)) / 12
      : 0;

  /**
   * Revenu de référence TNS = BÉNÉFICE professionnel (assiette IR :
   * CA − charges) pour le RÉEL. Sert au calcul des IJ caisse (assiette
   * pro). On se branche sur computeBeneficeImposable (fonction exacte
   * de computeIR), on ne recalcule pas la formule.
   *
   * À NE PAS confondre avec l'assiette de cotisation des caisses TNS
   * (revenu pro moyen 3 ans), qui sert au calcul des IJ VERSÉES — ça,
   * c'est la prestation (étage ijObligatoire), pas le revenu de
   * référence (le manque à gagner / ligne pointillée).
   */
  const benefTNS = computeBeneficeTNS(data, which);
  const revenuTNSAnnuel = benefTNS > 0 ? benefTNS : undefined;

  const statut = travail.statutPro;
  const isTNSstatut = STATUTS_TNS.includes(statut as StatutPro);
  const isSalarieStatut = STATUTS_SALARIE.includes(statut as StatutPro);
  const microRegime = which === "p1" ? data.microRegime1 : data.microRegime2;
  const caAnnuel = asNumber(which === "p1" ? data.ca1 : data.ca2);

  // ── Revenu de référence (manque à gagner / ligne pointillée) ──
  let revenuReferenceMensuel = 0;
  let revenuReferenceMicroTNS = false;
  if (isSalarieStatut) {
    // Décision B : brut prioritaire (coef appliqué au brut). À défaut de
    // brut, on prend le net SAISI tel quel (jamais re-coefficienté).
    if (travail.salaireBrutAnnuel > 0) {
      revenuReferenceMensuel = (travail.salaireBrutAnnuel * coefBrutNet(statut)) / 12;
    } else if (salaryAnnuel > 0) {
      revenuReferenceMensuel = salaryAnnuel / 12;
    }
  } else if (isTNSstatut) {
    // Décision A : micro → CA encaissé (abattement forfaitaire fictif) ;
    // réel → bénéfice (CA − charges).
    if (microRegime) {
      revenuReferenceMensuel = caAnnuel > 0 ? caAnnuel / 12 : 0;
      revenuReferenceMicroTNS = caAnnuel > 0;
    } else {
      revenuReferenceMensuel = benefTNS > 0 ? benefTNS / 12 : 0;
    }
  }
  // retraité / sans activité → 0

  return {
    age,
    ageRetraite: AGE_RETRAITE_DEFAUT,
    statutPro: travail.statutPro,
    caisse: travail.caisseAffiliation,
    idccCCN: travail.employeur?.idccCCN ?? null,
    ancienneteMois: calcAncienneteMois(travail.dateEmbauche),
    revenuReferenceMensuel,
    revenuReferenceMicroTNS,
    salaireBrutAnnuel: travail.salaireBrutAnnuel,
    salaireNetMensuel,
    revenuTNSAnnuel,
    contratsIndividuels: [], // saisis dans l'UI prévoyance (LOT 7)
    couvertureCollective: null, // idem
  };
}
