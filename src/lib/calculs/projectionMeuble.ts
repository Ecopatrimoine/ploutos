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
import refMeuble from "../../data/location-meublee.json";

export type ProjectionAnnee = {
  annee: number;
  dotation: number;         // amortissement theorique de l'annee (plan ou manuel)
  utilise: number;          // amortissement effectivement deduit (art. 39 C)
  stockArd: number;         // amortissement en report cumule (fin d'annee)
  deficitsImputes: number;  // deficits anterieurs imputes cette annee
  stockDeficits: number;    // deficits en report cumules (fin d'annee)
  baseImposable: number;    // base BIC apres amort + deficits
  psEstimes: number;        // PS estimes (base x taux revenus du patrimoine)
};

export type ProjectionMeubleResult = {
  lignes: ProjectionAnnee[];
  anneeBascule: number | null; // 1re annee ou baseImposable > 0 ; null si jamais
  manuel: boolean;             // amortissement manuel constant (note UI)
  recettes: number;
  chargesRetenues: number;
};

const PEREMPTION_DEFICIT = 10; // art. 156 I-1 ter : report des deficits meubles sur 10 ans

export function computeProjectionMeuble(bien: Property, annees = 10): ProjectionMeubleResult {
  const recettes = resolveRecettesMeuble(bien);
  const chargesRetenues = resolveChargesReellesMeuble(bien);
  const resultatAvantAmort = recettes - chargesRetenues;
  const ps = refMeuble.ps.revenusPatrimoine;

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

  // Dotation de l'annee : chaque composant contribue tant que annee <= sa duree ;
  // le mobilier sort a l'annee dureeMob+1. En manuel, montant constant.
  const dotationAnnee = (annee: number): number => {
    if (manuel) return manualAmount;
    if (!plan) return 0;
    let d = 0;
    for (const c of plan.detail) if (annee <= c.duree) d += c.dotation;
    if (annee <= dureeMob) d += plan.mobilier;
    return d;
  };

  const lignes: ProjectionAnnee[] = [];
  let stockArd = 0;
  const fileDeficits: { annee: number; montant: number }[] = []; // FIFO, plus anciens en tete
  let anneeBascule: number | null = null;

  for (let annee = 1; annee <= annees; annee++) {
    const dotation = dotationAnnee(annee);
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

    lignes.push({ annee, dotation, utilise, stockArd, deficitsImputes, stockDeficits, baseImposable, psEstimes });
  }

  return { lignes, anneeBascule, manuel, recettes, chargesRetenues };
}
