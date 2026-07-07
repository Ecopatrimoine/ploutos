// ─── Plus-values immobilieres des particuliers (art. 150 U et s. CGI) ─────────
//
// Fonction PURE partagee : consommee par le projete meuble (amortissements
// reintegres = cumul deduit) ET la fenetre "Plus-value de cession" du foncier
// nu (calcul a date). AUCUN effet dans computeIR (ecran seul).
//
// Taux : tauxIr (art. 200 B) et tauxDerogatoire172 (art. L136-8 IV CSS) viennent
// du referentiel (jamais en dur). Forfaits (art. 150 VB) et abattements pour
// duree de detention (art. 150 VC) sont des baremes legaux codes ci-dessous.

import refMeuble from "../../data/location-meublee.json";

// Forfaits sur le prix d'acquisition (art. 150 VB II-3 / II-4).
const PV_FORFAIT_ACQUISITION = 0.075; // frais d'acquisition
const PV_FORFAIT_TRAVAUX = 0.15;      // travaux (detention > 5 ans)
const PV_SEUIL_TRAVAUX_ANS = 5;
// Seuil d'alerte surtaxe (art. 1609 nonies G) — surtaxe NON calculee en v1.
const PV_SEUIL_SURTAXE = 50000;

// Abattements pour duree de detention (art. 150 VC), age = annees de detention :
//  IR : 6 %/an de la 6e a la 21e annee + 4 % la 22e  -> 100 % a 22 ans ;
//  PS : 1,65 %/an (6e-21e) + 1,60 % la 22e + 9 %/an (23e-30e) -> 100 % a 30 ans.
export function abattementIrDetention(age: number): number {
  if (age <= 5) return 0;
  if (age >= 22) return 1;
  return 0.06 * (age - 5); // 6..21 -> 0,06 .. 0,96
}
export function abattementPsDetention(age: number): number {
  if (age <= 5) return 0;
  if (age >= 30) return 1;
  if (age <= 21) return 0.0165 * (age - 5); // 6..21 -> 0,0165 .. 0,264
  if (age === 22) return 0.264 + 0.016;     // 0,28
  return 0.28 + 0.09 * (age - 22);          // 23..29 -> 0,37 .. 0,91 (30 -> 1 ci-dessus)
}

export type PvImmobiliereInput = {
  prixCession: number;
  prixAcquisition: number;
  age: number;
  amortissementsReintegres?: number;
};

export type PvImmobiliereResult = {
  prixAcquisitionCorrige: number;
  pvBrute: number;
  moinsValue: boolean;
  abattementIr: number;
  baseIr: number;
  impotIr: number;
  abattementPs: number;
  basePs: number;
  impotPs: number;
  impotTotal: number;
  alerteSurtaxe: boolean;
};

export function computePvImmobiliere({ prixCession, prixAcquisition, age, amortissementsReintegres = 0 }: PvImmobiliereInput): PvImmobiliereResult {
  const forfaitTravaux = age > PV_SEUIL_TRAVAUX_ANS ? PV_FORFAIT_TRAVAUX : 0;
  const prixAcquisitionCorrige = prixAcquisition * (1 + PV_FORFAIT_ACQUISITION + forfaitTravaux) - amortissementsReintegres;
  const pvNette = prixCession - prixAcquisitionCorrige;
  const pvBrute = Math.max(0, pvNette);
  const moinsValue = pvNette < 0;

  const abattementIr = abattementIrDetention(age);
  const abattementPs = abattementPsDetention(age);
  const baseIr = pvBrute * (1 - abattementIr);
  const basePs = pvBrute * (1 - abattementPs);
  const impotIr = baseIr * refMeuble.pv.tauxIr;
  const impotPs = basePs * refMeuble.ps.tauxDerogatoire172;
  const impotTotal = impotIr + impotPs;
  const alerteSurtaxe = baseIr > PV_SEUIL_SURTAXE;

  return { prixAcquisitionCorrige, pvBrute, moinsValue, abattementIr, baseIr, impotIr, abattementPs, basePs, impotPs, impotTotal, alerteSurtaxe };
}
