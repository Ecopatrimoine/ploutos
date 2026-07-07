// ─── Projection 10 ans d'un bien meuble au REEL (Lot 2) ──────────────────────
//
// Fonction PURE, A COTE du moteur : elle N'ENTRE JAMAIS dans computeIR (ecran
// seul). Simule l'accumulation de l'amortissement en report (ARD, art. 39 C) et
// des deficits BIC non pro (art. 156 I-1 ter) sur la periode.
//
// Hypotheses v1 (indicatives) :
//  - recettes et charges retenues CONSTANTES sur la periode. Charges retenues via
//    resolveChargesReellesMeuble (chargesReelles + taxe fonciere + assurance) —
//    SOURCE UNIQUE du Lot 1bis, aucun recalcul local.
//  - amortissement annee par annee :
//     * amortissementAnnuelManuel saisi ("0" compris) : montant CONSTANT sur la
//       periode (composition inconnue) — flag `manuel` pour la note UI ;
//     * sinon : plan par composants (grille + overrides amortissementComposants),
//       chaque composant s'eteint a la fin de sa duree (le mobilier 7 ans sort du
//       plan a l'annee 8).
//  - interets d'emprunt non degressifs (inclus tels quels dans chargesReelles).
//
// Mecanique annuelle :
//   resultatAvantAmort = recettes - chargesRetenues (constant)
//   dispo   = dotation(annee) + stockArd anterieur
//   utilise = min(dispo, max(resultatAvantAmort, 0))   (art. 39 C : jamais de deficit par l'amort)
//   stockArd = dispo - utilise                          (report illimite)
//   si resultatAvantAmort < 0 : le deficit d'exploitation alimente une file
//     (peremption 10 ans, art. 156 I-1 ter) ; sinon les deficits stockes s'imputent
//     (plus anciens d'abord) sur le resultat restant avant la base.
//   baseImposable = max(resultatApresAmort - deficitsImputes, 0)
//   psEstimes = base x ps.revenusPatrimoine (referentiel, jamais en dur)

import type { Property } from "../../types/patrimoine";
import { n, isSet, resolveRecettesMeuble, resolveChargesReellesMeuble } from "./utils";
import { amortissementAuto } from "./locationMeublee";
import { computePvImmobiliere } from "./pvImmobiliere";
import refMeuble from "../../data/location-meublee.json";

export type ProjectionAnnee = {
  annee: number;            // rang dans la projection (1..N)
  age: number;             // age / annee de detention du bien a cette annee (= anneesEcoulees + annee)
  dotation: number;         // amortissement theorique de l'annee (plan ou manuel)
  utilise: number;          // amortissement effectivement deduit (art. 39 C)
  stockArd: number;         // amortissement en report cumule (fin d'annee)
  deficitsImputes: number;  // deficits anterieurs imputes cette annee
  stockDeficits: number;    // deficits en report cumules (fin d'annee)
  baseImposable: number;    // base BIC apres amort + deficits
  psEstimes: number;        // PS estimes (base x taux revenus du patrimoine)
  // ── Volet plus-value BRUTE si vente en fin d'annee N (regime PV particuliers,
  // art. 150 U et s. CGI) — affichage seul, jamais dans computeIR. ──
  cumulDeduit: number;             // cumul des amortissements DEDUITS 1..N (jamais le stock ARD)
  prixAcquisitionCorrige: number;  // art. 150 VB : prix + forfaits - amort deduits reintegres (LF 2025)
  pvBrute: number;                 // max(prixCession - prixAcquisitionCorrige, 0)
  moinsValue: boolean;             // true si la PV brute serait negative
  // Impot PV apres abattements duree de detention (art. 150 VC), via pvImmobiliere :
  abattementIr: number; baseIr: number; impotIr: number;      // IR (19 %)
  abattementPs: number; basePs: number; impotPs: number;      // PS (17,2 %)
  impotPvTotal: number;            // IR + PS
  alerteSurtaxe: boolean;          // baseIr > 50000 (surtaxe art. 1609 nonies G, non calculee)
};

export type ProjectionMeubleResult = {
  lignes: ProjectionAnnee[];
  anneeBascule: number | null; // 1re annee ou baseImposable > 0 ; null si jamais
  manuel: boolean;             // amortissement manuel constant (note UI)
  recettes: number;
  chargesRetenues: number;
  pvDisponible: boolean;       // false si prixAcquisition absent (volet PV non calcule)
  prixCession: number;         // valeur estimee (constante), fallback prixAcquisition
  anneesEcoulees: number;      // annees de detention deja ecoulees a l'ouverture (0 si non renseigne)
  anneeAcquisition: number | null; // annee d'acquisition saisie (null si non renseignee)
  alerteSurtaxe: boolean;      // surtaxe PV elevees (art. 1609 nonies G) sur au moins une annee
};

const ANNEE_MIN_ACQUISITION = 1950;

const PEREMPTION_DEFICIT = 10; // art. 156 I-1 ter : report des deficits meubles sur 10 ans

export function computeProjectionMeuble(bien: Property, annees = 10): ProjectionMeubleResult {
  const recettes = resolveRecettesMeuble(bien);
  const chargesRetenues = resolveChargesReellesMeuble(bien);
  const resultatAvantAmort = recettes - chargesRetenues;
  const ps = refMeuble.ps.revenusPatrimoine;

  // Volet plus-value : prix d'acquisition requis (sinon volet non calcule) ;
  // prix de cession = valeur estimee constante, fallback prix d'acquisition.
  const prixAcquisition = n(bien.prixAcquisition);
  const pvDisponible = prixAcquisition > 0;
  const valeurEstimee = n(bien.value);
  const prixCession = valeurEstimee > 0 ? valeurEstimee : prixAcquisition;

  const manuel = isSet(bien.amortissementAnnuelManuel);
  const manualAmount = manuel ? n(bien.amortissementAnnuelManuel) : 0;
  const plan = manuel
    ? null
    : amortissementAuto(
        n(bien.prixAcquisition),
        isSet(bien.partTerrain) ? n(bien.partTerrain) : refMeuble.amortissement.partTerrainDefaut,
        n(bien.valeurMobilier),
        bien.amortissementComposants,
      );
  const dureeMob = refMeuble.amortissement.dureeMobilier;

  // Age du bien : anneesEcoulees deja passees depuis l'acquisition (annee simulee
  // du moteur = millesime du referentiel, JAMAIS Date.now). Champ absent / annee
  // hors bornes => 0 (comportement historique : an 1 = 1re annee de detention).
  const anneeCourante = refMeuble.millesime;
  const anneeAcqParsee = n(bien.anneeAcquisition);
  const anneeAcquisition = anneeAcqParsee >= ANNEE_MIN_ACQUISITION && anneeAcqParsee <= anneeCourante ? anneeAcqParsee : null;
  const anneesEcoulees = anneeAcquisition != null ? Math.max(0, anneeCourante - anneeAcquisition) : 0;
  const stockArdInit = Math.max(0, n(bien.stockArdAnterieur));

  // Dotation theorique du bien a un AGE donne (plan suppose applique depuis
  // l'acquisition) : chaque composant dote tant que age <= sa duree ; le mobilier
  // sort a l'age dureeMob+1. En manuel, montant constant.
  const dotationAge = (age: number): number => {
    if (manuel) return manualAmount;
    if (!plan) return 0;
    let d = 0;
    for (const c of plan.detail) if (age <= c.duree) d += c.dotation;
    if (age <= dureeMob) d += plan.mobilier;
    return d;
  };

  // Cumul deja DEDUIT avant l'ouverture (pour la PV) : ce qui a ete dote sur les
  // annees anterieures (ages 1..anneesEcoulees) et n'est PLUS en stock ARD a ete
  // deduit => max(dotations anterieures - stockArdAnterieur, 0). En manuel :
  // dotations anterieures = montant manuel x anneesEcoulees.
  let dotationsAnterieures = 0;
  for (let age = 1; age <= anneesEcoulees; age++) dotationsAnterieures += dotationAge(age);
  const cumulDeduitInitial = Math.max(0, dotationsAnterieures - stockArdInit);

  const lignes: ProjectionAnnee[] = [];
  let stockArd = stockArdInit;          // seed : stock ARD anterieur
  let cumulDeduit = cumulDeduitInitial; // seed : amortissements deja deduits (reintegration PV)
  const fileDeficits: { annee: number; montant: number }[] = []; // FIFO, plus anciens en tete
  let anneeBascule: number | null = null;
  let alerteSurtaxe = false;

  for (let annee = 1; annee <= annees; annee++) {
    const age = anneesEcoulees + annee;
    const dotation = dotationAge(age);
    const dispo = dotation + stockArd;
    const utilise = Math.min(dispo, Math.max(resultatAvantAmort, 0));
    stockArd = dispo - utilise;
    const resultatApresAmort = resultatAvantAmort - utilise;

    // Peremption : on retire les deficits dont la fenetre de 10 ans est passee.
    while (fileDeficits.length && fileDeficits[0].annee + PEREMPTION_DEFICIT < annee) fileDeficits.shift();

    let deficitsImputes = 0;
    if (resultatApresAmort < 0) {
      // Deficit d'exploitation (resultatAvantAmort < 0 => utilise = 0, ARD intact).
      fileDeficits.push({ annee, montant: -resultatApresAmort });
    } else if (resultatApresAmort > 0 && fileDeficits.length) {
      let reste = resultatApresAmort;
      while (reste > 1e-9 && fileDeficits.length) {
        const d = fileDeficits[0];
        const imp = Math.min(d.montant, reste);
        d.montant -= imp;
        reste -= imp;
        deficitsImputes += imp;
        if (d.montant <= 1e-9) fileDeficits.shift();
      }
    }

    const baseImposable = Math.max(0, resultatApresAmort - deficitsImputes);
    const psEstimes = baseImposable * ps;
    if (anneeBascule === null && baseImposable > 0) anneeBascule = annee;
    const stockDeficits = fileDeficits.reduce((s, d) => s + d.montant, 0);

    // ── Plus-value si vente en fin d'annee N (fonction pure partagee pvImmobiliere,
    // art. 150 VB/VC) : amortissements reintegres = cumul deja deduit (LF 2025). ──
    cumulDeduit += utilise;
    const pvr = pvDisponible
      ? computePvImmobiliere({ prixCession, prixAcquisition, age, amortissementsReintegres: cumulDeduit })
      : null;
    if (pvr?.alerteSurtaxe) alerteSurtaxe = true;

    lignes.push({
      annee, age, dotation, utilise, stockArd, deficitsImputes, stockDeficits, baseImposable, psEstimes, cumulDeduit,
      prixAcquisitionCorrige: pvr ? pvr.prixAcquisitionCorrige : 0,
      pvBrute: pvr ? pvr.pvBrute : 0,
      moinsValue: pvr ? pvr.moinsValue : false,
      abattementIr: pvr ? pvr.abattementIr : 0, baseIr: pvr ? pvr.baseIr : 0, impotIr: pvr ? pvr.impotIr : 0,
      abattementPs: pvr ? pvr.abattementPs : 0, basePs: pvr ? pvr.basePs : 0, impotPs: pvr ? pvr.impotPs : 0,
      impotPvTotal: pvr ? pvr.impotTotal : 0,
      alerteSurtaxe: pvr ? pvr.alerteSurtaxe : false,
    });
  }

  return { lignes, anneeBascule, manuel, recettes, chargesRetenues, pvDisponible, prixCession, anneesEcoulees, anneeAcquisition, alerteSurtaxe };
}
