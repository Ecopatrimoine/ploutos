// ─── Résolveur des CAPITAUX DÉCÈS des régimes obligatoires (Lot 1) ────────
//
// Module PUR : agrège, pour UNE personne, les prestations versées AU DÉCÈS
// par sa caisse obligatoire (capital décès, capital orphelin, rentes de
// survie / éducation). Données de RÉFÉRENCE destinées au futur module
// succession — N'alimentent PAS les 9 séries de projection (revenus de
// remplacement). Aucune valeur en dur : tout vient du référentiel
// (caisses-2026.json + cipav-2026.json). Une donnée TO_VERIFY / absente →
// champ null + donneeIndisponible, JAMAIS une valeur inventée.
//
// Trois familles de format, résolues sans logique par caisse en dur :
//   1. CIPAV (entree.cipav != null) : capital par POINTS de prévoyance
//      (bloc séparé referentiels.cipav) → délégué à capitalDecesCipav.
//   2. caisseRef.moteur === "forfaitaire" (CARCDSF, CARPV, CNBF, CAVOM,
//      CAVEC, CAVAMAC, CRN) : capital au format `mode` → réutilise
//      forfaitaireCapitalDeces (uniforme / parDiscriminant / pourcentageRevenu
//      + majoration famille CAVAMAC). NE PAS réimplémenter.
//   3. autres (CPAM, SSI, CARMF, CARPIMKO, MSA) : capital au format `type`,
//      lu ici (resolveMontant ne lit que `mode`).
//
// Les rentes de survie/éducation (CARPV, CAVOM, CRN) sont au format `mode`
// (uniforme / parDiscriminant) : résolues via resolveMontant avec la clé de
// discriminant déjà calculée (cohérence moteur).

import type { EntreePerso } from "./types";
import { forfaitaireCapitalDeces, resolveDiscriminant, resolveMontant, safeNum } from "./projection";
import { capitalDecesCipav } from "./cipav";

export type CapitauxDeces = {
  // Capital décès en euros (versé en une fois). null = non documenté.
  capital: number | null;
  // SSI : capital orphelin par enfant à charge (5 % PASS).
  capitalParEnfant?: number;
  // Rentes annuelles de survie (présentes uniquement si documentées).
  renteConjointAnnuelle?: number;
  renteEducationAnnuelle?: number;
  // Poste fusionné conjoint + orphelin de CAVOM / CRN.
  renteSurvieOrphelinAnnuelle?: number;
  // SSI : situation retenue pour le montant du capital.
  situationRetenue?: "actif_ou_invalide" | "retraite";
  // true si le capital n'a pas pu être résolu (TO_VERIFY / absent).
  donneeIndisponible: boolean;
  // Libellé de la caisse source (affichage / traçabilité).
  source: string;
};

// true si le statut professionnel correspond à un retraité (la SSI sert un
// capital réduit dans ce cas). Comparaison sur chaîne brute pour tolérer la
// variante accentuée hors du type StatutPro.
function estRetraite(statut: unknown): boolean {
  const s = String(statut ?? "");
  return s === "retraite" || s === "retraité";
}

// Résout, pour `entree`, les capitaux décès servis par sa caisse obligatoire.
// `cipavRef` (bloc referentiels.cipav) requis seulement pour les affiliés
// CIPAV. Ne lève JAMAIS d'exception : toute donnée manquante → null +
// donneeIndisponible.
export function resolveCapitauxDeces(
  caisseRef: any,
  entree: EntreePerso,
  cipavRef?: any
): CapitauxDeces {
  const source = String(caisseRef?.nom ?? caisseRef?.libelle ?? "");

  // 1. CIPAV — capital par points (bloc référentiel distinct). Décès
  //    accidentel = false par défaut (TO_VERIFY pour le doublement).
  if (entree.cipav != null) {
    const src = source || "CIPAV";
    if (cipavRef == null) {
      return { capital: null, donneeIndisponible: true, source: src };
    }
    const revenu = safeNum(entree.cipav.revenuBNC_N2) ?? 0;
    const capital = safeNum(capitalDecesCipav(cipavRef, revenu, false));
    return { capital, donneeIndisponible: capital === null, source: src };
  }

  // Clé de discriminant (classe / ancienneté / sous-profession) commune au
  // capital `mode` et aux rentes. assiette = commissions brutes (mode
  // pourcentageRevenu), ignorée par uniforme / parDiscriminant.
  const cle = resolveDiscriminant(caisseRef, entree);
  const assiette = entree.forfait?.commissionsBrutes;

  let capital: number | null = null;
  let capitalParEnfant: number | undefined;
  let situationRetenue: CapitauxDeces["situationRetenue"];

  if (caisseRef?.moteur === "forfaitaire") {
    // 2. Format `mode` — réutilise le résolveur forfaitaire existant.
    capital = forfaitaireCapitalDeces(caisseRef, entree);
  } else {
    // 3. Format `type` (caisses sans moteur forfaitaire).
    const cap = caisseRef?.capitalDeces;
    const type = cap?.type;
    if (type === "forfaitaire") {
      capital = safeNum(cap.montant);
    } else if (type === "forfaitaire_par_situation") {
      const retraite = estRetraite(entree.statutPro);
      capital = retraite ? safeNum(cap.montantRetraite) : safeNum(cap.montantActifOuInvalide);
      situationRetenue = retraite ? "retraite" : "actif_ou_invalide";
      const parEnfant = safeNum(cap.montantParEnfant);
      if (parEnfant !== null) capitalParEnfant = parEnfant;
    } else if (type === "forfaitaire_par_classe") {
      // montants objet → lecture par classe ; "TO_VERIFY" (string) → null.
      const montants = cap.montants;
      if (montants != null && typeof montants === "object") {
        capital = safeNum(montants[entree.classeCotisationCaisse ?? ""]);
      }
    } else if (type === "forfaitaire_par_situation_familiale") {
      // Capital selon la SITUATION FAMILIALE du défunt (CARPIMKO) — miroir du
      // mode "situationFamiliale" CCN (cf. FamilleCapitalDeces). SÉLECTION du cas
      // uniquement (aucun calcul au-delà) : conjoint / PACS (entree.marie) avec
      // ou sans descendant à charge (entree.nbEnfantsACharge), sinon "sans ayant
      // droit". "TO_VERIFY" / absent → null + donneeIndisponible (comme les autres).
      const conjoint = entree.marie === true;
      const avecDescendant = (entree.nbEnfantsACharge ?? 0) > 0;
      const champ = conjoint
        ? (avecDescendant ? "montantConjointAvecDescendant" : "montantConjointSansDescendant")
        : "montantSansAyantDroit";
      capital = safeNum(cap[champ]);
    }
  }

  // Rentes de survie / éducation (présentes seulement où documentées).
  const renteConjointAnnuelle = resolveMontant(caisseRef?.renteSurvieConjoint, cle, assiette);
  const renteEducationAnnuelle = resolveMontant(caisseRef?.renteEducationOrphelin, cle, assiette);
  const renteSurvieOrphelinAnnuelle = resolveMontant(caisseRef?.renteSurvieOrphelin, cle, assiette);

  const out: CapitauxDeces = {
    capital,
    donneeIndisponible: capital === null,
    source,
  };
  if (capitalParEnfant !== undefined) out.capitalParEnfant = capitalParEnfant;
  if (situationRetenue !== undefined) out.situationRetenue = situationRetenue;
  if (renteConjointAnnuelle !== null) out.renteConjointAnnuelle = renteConjointAnnuelle;
  if (renteEducationAnnuelle !== null) out.renteEducationAnnuelle = renteEducationAnnuelle;
  if (renteSurvieOrphelinAnnuelle !== null) out.renteSurvieOrphelinAnnuelle = renteSurvieOrphelinAnnuelle;
  return out;
}
