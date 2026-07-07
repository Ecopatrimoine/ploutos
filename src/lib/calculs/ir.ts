// Calcul IR — barème, QF, PFU, foncier, PER, concubinage
import type { PatrimonialData, IrOptions, TaxBracket, Property } from '../../types/patrimoine';
import { n, computeTaxFromBrackets, isAV, isPERType, fractionRVTO, getHandicapAbattement,
  getChildrenFiscalParts, getBaseFiscalParts, computeIRConcubin, getQuotientCapPerHalfPart,
  isProfessionLiberale, computeKilometricAllowance, isSet, isBienMeuble } from './utils';
import { resolveLoanValuesMulti } from './credit';
import { referentiels } from '../../data/prevoyance';
import { computeMicroBicMeuble, computeReelMeuble, amortissementAuto, type SousTypeMeuble, type RegimeMeuble } from './locationMeublee';
import refMeuble from '../../data/location-meublee.json';
import { sommeCotisationsMadelin, plafondMadelinPrevoyance, estEligibleMadelin } from '../prevoyance/madelin';
import { resolveReductionDispositif, resolveDeductionsJeanbrun, estReduction, type JeanbrunResultat, type PlafondNiches } from '../fiscal/dispositifs-resolveur';
import { resolveReductionFinanciere } from '../fiscal/dispositifs-financiers-resolveur';

// Alerte douce de défiscalisation financière remontée pour l'UI (Lot 2).
type AlerteFinanciereExposee = { placementId: string; dispositif: string; code: string; message: string };

// ─── CALCUL IR ────────────────────────────────────────────────────────────────

// ─── Calcul bénéfice imposable indépendant ────────────────────────────────────
// Abattements micro 2025 (source impots.gouv.fr) :
//   BIC vente/achat-revente : 71% (seuil 188 700€)
//   BIC prestations de services : 50% (seuil 77 700€)
//   BNC professions libérales : 34% (seuil 77 700€)
//   Abattement minimum : 305€
// Seuils micro 2025
export const SEUIL_MICRO_BA           = 120000; // moyenne triennale 2024-2025
export const SEUIL_MICRO_BNC          = 77700;
export const SEUIL_MICRO_BIC_SERVICES = 77700;
export const SEUIL_MICRO_BIC_VENTE    = 188700;

export function computeBeneficeImposable(
  ca: number,
  bicType: string,         // "vente" | "services"
  isBNC: boolean,          // true = BNC (profession libérale)
  isBA: boolean,           // true = bénéfice agricole
  microRegime: boolean,    // true = micro, false = réel
  chargesReelles: number,  // charges réelles si régime réel
  baRevenue: number,       // bénéfice agricole net si BA réel
): number {
  if (isBA) {
    if (microRegime) {
      // Micro-BA : abattement 87% sur recettes brutes
      if (ca <= 0) return 0;
      const abattement = Math.max(305, ca * 0.87);
      return Math.max(0, ca - abattement);
    }
    // Réel : ca contient le bénéfice net (même champ, label différent)
    return ca;
  }
  if (ca <= 0) return 0;
  if (microRegime) {
    const abattementRate = isBNC ? 0.34 : (bicType === "vente" ? 0.71 : 0.50);
    const abattement = Math.max(305, ca * abattementRate);
    return Math.max(0, ca - abattement);
  }
  // Régime réel : CA - charges réelles
  return Math.max(0, ca - chargesReelles);
}

// ─── Bénéfice imposable TNS d'une personne (extrait de computeIR) ─────────────
// Réutilisable (ex. taux d'endettement). Décide isIndep/isBNC/isBA via PCS/CSP
// EXACTEMENT comme computeIR, puis applique computeBeneficeImposable. 0 si non-TNS.
// Refactor PUR : logique déplacée, non réécrite.
// Detection "produit un benefice TNS" : PCS/CSP independant OU activite secondaire
// TNS (bic/bnc/ba). Base commune (UNE seule semantique de regime dans le fichier)
// a resolveBeneficeTns et resolveBeneficeAuReel.
function estTnsAvecBenefice(g: string, cat: string, sec: string): boolean {
  const secTns = sec === "bic" || sec === "bnc" || sec === "ba";
  return g === "1" || g === "2" || isProfessionLiberale(cat) || secTns;
}

export function resolveBeneficeTns(data: PatrimonialData, personne: 1 | 2): number {
  const g = personne === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
  const cat = personne === 1 ? data.person1Csp : data.person2Csp;
  // Lot A cumul salarie + TNS : une activite secondaire TNS (bic/bnc/ba) declaree
  // sur une personne salariee au sens PCS suffit a produire un benefice imposable.
  // Champ absent => secTns=false => detection PCS/CSP historique strictement inchangee.
  const sec = personne === 1 ? (data.activiteSecondaire1 ?? "") : (data.activiteSecondaire2 ?? "");
  const isIndep = estTnsAvecBenefice(g, cat, sec);
  if (!isIndep) return 0;
  const isBA = g === "1" || sec === "ba";
  const isBNC = isProfessionLiberale(cat) || sec === "bnc";
  const ca = personne === 1 ? n(data.ca1) : n(data.ca2);
  const bicType = personne === 1 ? data.bicType1 : data.bicType2;
  const microRegime = personne === 1 ? data.microRegime1 : data.microRegime2;
  const chargesReelles = personne === 1 ? n(data.chargesReelles1) : n(data.chargesReelles2);
  const baRevenue = personne === 1 ? n(data.baRevenue1) : n(data.baRevenue2);
  return computeBeneficeImposable(ca, bicType, isBNC, isBA, microRegime, chargesReelles, baRevenue);
}

// ─── Salaire retenu d'une personne (predicat unique des gardes C/D) ───────────
// UNIQUE definition du masquage salaire, partagee par computeIR (gardes C/D) ET
// les moteurs budget/endettement : le salaire est masque si la personne est TNS
// au sens PCS SANS activite secondaire 'salariat'. Champ activiteSecondaire
// absent => sec === "" => salaireMasque === isIndep => comportement historique
// SOIT/SOIT strictement preserve.
function salaireMasqueTns(data: PatrimonialData, personne: 1 | 2): boolean {
  const g = personne === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
  const cat = personne === 1 ? data.person1Csp : data.person2Csp;
  const isIndep = g === "1" || g === "2" || isProfessionLiberale(cat);
  const sec = personne === 1 ? (data.activiteSecondaire1 ?? "") : (data.activiteSecondaire2 ?? "");
  return isIndep && sec !== "salariat";
}

export function resolveSalaireRetenu(data: PatrimonialData, personne: 1 | 2): number {
  return salaireMasqueTns(data, personne) ? 0 : n(personne === 1 ? data.salary1 : data.salary2);
}

// ─── Regime du benefice TNS d'une personne (reel vs micro) ────────────────────
// true SSI la personne produit un benefice TNS (meme detection que
// resolveBeneficeTns via estTnsAvecBenefice) ET microRegime === false. Sert la
// majoration 154 bis, RESERVEE au reel (micro exclu). BA/BIC/BNC : le regime est
// porte par microRegimeX, comme dans resolveBeneficeTns. false pour un pur salarie.
export function resolveBeneficeAuReel(data: PatrimonialData, personne: 1 | 2): boolean {
  const g = personne === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
  const cat = personne === 1 ? data.person1Csp : data.person2Csp;
  const sec = personne === 1 ? (data.activiteSecondaire1 ?? "") : (data.activiteSecondaire2 ?? "");
  if (!estTnsAvecBenefice(g, cat, sec)) return false;
  const microRegime = personne === 1 ? data.microRegime1 : data.microRegime2;
  return !microRegime;
}

// ─── Base BIC imposable d'un bien meuble (LMNP/LMP) — Lot 0 ───────────────────
// Circuit BIC location meublee, JAMAIS foncier. Defauts conservateurs
// (arbitrage B) pour un bien existant sans champs saisis :
//   - recettes : recettesAnnuelles saisi, sinon loyers existants (rentGrossAnnual) ;
//   - regime   : regimeMeuble saisi, sinon micro si recettes <= seuil du sous-type,
//                sinon reel (charges 0 + amortissement 0 tant que rien n'est saisi).
//                Micro applique SEULEMENT si eligible (art. 50-0 CGI) : micro choisi
//                explicitement au-dessus du seuil => reel de plein droit ;
//   - sous-type par defaut : longue_duree ;
//   - amortissement (reel) : barriere douce isSet(amortissementAnnuelManuel)
//     ("0" = 0 voulu), sinon auto si prixAcquisition saisi, sinon 0 (jamais de
//     deduction inventee).
// Renvoie la base imposable au bareme (>= 0 : un deficit meuble ne remonte pas au
// revenu global, art. 156 I-1 ter). LMP calcule comme LMNP (base identique ; le
// constat LMP est un lot UI ulterieur).
function baseBicMeuble(p: Property): number {
  const recettes = isSet(p.recettesAnnuelles) ? n(p.recettesAnnuelles) : n(p.rentGrossAnnual);
  const sousType: SousTypeMeuble = p.sousType ?? "longue_duree";
  const seuilMicro = sousType === "tourisme_non_classe"
    ? refMeuble.microBic.tourismeNonClasse.seuil
    : refMeuble.microBic.residuel.seuil;
  const regime: RegimeMeuble = p.regimeMeuble ?? (recettes <= seuilMicro ? "micro" : "reel");
  // Le micro n'est de droit que si eligible (recettes <= seuil, art. 50-0 CGI) ;
  // un micro choisi au-dessus du seuil bascule en reel de plein droit.
  const micro = computeMicroBicMeuble(recettes, sousType);
  if (regime === "micro" && micro.eligible) {
    return micro.base;
  }
  const charges = n(p.chargesReelles);
  const dotationAmort = isSet(p.amortissementAnnuelManuel)
    ? n(p.amortissementAnnuelManuel)
    : isSet(p.prixAcquisition)
      ? amortissementAuto(
          n(p.prixAcquisition),
          isSet(p.partTerrain) ? n(p.partTerrain) : refMeuble.amortissement.partTerrainDefaut,
          n(p.valeurMobilier),
        ).total
      : 0;
  return computeReelMeuble(recettes, charges, dotationAmort).baseFoyer;
}

// ─── Revenus d'activite du foyer (helper de collecte pour la detection LMP) ───
// Base de comparaison aux recettes meublees (art. 155 IV-2 CGI) : salaires
// retenus P1+P2 (apres garde de masquage TNS) + pensions/rentes art. 79
// (pensions1/2 nominatives, sinon champ global) + benefice TNS hors meuble
// (BIC/BNC/BA + art. 62) des deux personnes via resolveBeneficeTns. Le meuble
// n'y figure PAS (il est porte par Property, hors ca1/ca2). Expose pour le lot
// UI LMP a venir : detectLmp(recettesMeubleesFoyer, collecteRevenusActiviteFoyer(data)).
export function collecteRevenusActiviteFoyer(data: PatrimonialData): number {
  const salaires = resolveSalaireRetenu(data, 1) + resolveSalaireRetenu(data, 2);
  const pensions = (n(data.pensions1) + n(data.pensions2)) > 0
    ? n(data.pensions1) + n(data.pensions2)
    : n(data.pensions);
  const benefices = resolveBeneficeTns(data, 1) + resolveBeneficeTns(data, 2);
  return salaires + pensions + benefices;
}

// ─── Socle générique de réductions d'impôt (art. 197-I-5 + 200-0 A CGI) ───────
// Une réduction vient EN DIMINUTION du BARÈME après décote UNIQUEMENT (art.
// 197-I-5) — jamais des prélèvements sociaux, du PFU/PFL ni de l'impôt sur le
// rachat d'AV. L'APPELANT ajoute ces impositions APRÈS imputation (cf. computeIR :
// finalIR = impotFinal + PFU + PS foncier + rachat AV + PS rentes PER). Chaque
// réduction est imputée dans l'ordre du tableau, à hauteur du barème restant
// (jamais négatif) ; la fraction non imputée faute de barème est perdue (pas de report).
//
// Plafonnement global des niches — art. 200-0 A CGI, DOUBLE ENVELOPPE :
//   • 'commun'  : cumul des réductions communes, plafond 10 000 € ;
//   • 'majore'  : cumul (communs RETENUS + majorées : outre-mer / Sofica),
//                 plafond GLOBAL 18 000 € ;
//   • false     : hors plafond (ne consomme aucune enveloppe, jamais écrêté).
// Chaque réduction consomme l'enveloppe à hauteur de montant×fractionPlafond
// (défaut 1) ; l'excédent est écrêté dans l'ordre du tableau (calcul en espace
// « fraction » puis reconversion en brut ÷ fractionPlafond) et tracé
// (ecretementNiches). Liste vide OU aucune entrée plafonnable = no-op strict.
// Point d'entrée UNIQUE des deux chemins de computeIR (foyer commun ET
// concubins) — aucune duplication.
export interface ReductionIR {
  id: string;
  label: string;
  montant: number;
  // 'commun' = enveloppe 10 000 € ; 'majore' = enveloppe majorée 18 000 €
  // (art. 200-0 A) ; false = hors plafond global.
  plafondNiches: PlafondNiches;
  // Part du montant qui consomme l'enveloppe (défaut 1). Seule montant×fractionPlafond
  // est décomptée du plafond ; l'écrêtement calculé sur cette fraction est reconverti
  // en brut (÷ fractionPlafond). Prévu pour les futurs dispositifs financiers.
  fractionPlafond?: number;
}

export interface ResultatReductionsIR {
  impotFinal: number;                       // BARÈME après imputation des réductions (>= 0) ; l'appelant y ajoute PFU/PS/AV
  totalImpute: number;                      // somme réellement imputée sur le barème
  totalPlafonnableAvantEcretement: number;  // cumul brut des montants plafonnables ('commun' + 'majore')
  ecretementNiches: number;                 // part BRUTE perdue par le plafond global (art. 200-0 A) = commun + majoré
  ecretementCommun: number;                 // part écrêtée par l'enveloppe commune (10 000 €)
  ecretementMajore: number;                 // part écrêtée par l'enveloppe majorée (18 000 €, outre-mer / Sofica)
  perduFauteImpot: number;                  // part perdue faute de barème restant (distincte de l'écrêtement)
  detail: { id: string; montant: number; impute: number }[];
}

export function appliquerReductionsIR(
  baremeApresDecote: number,
  reductions: ReductionIR[],
  plafondCommun: number,
  plafondMajore: number,
): ResultatReductionsIR {
  const capCommun = Math.max(0, plafondCommun);
  const capMajore = Math.max(0, plafondMajore);
  const fracOf = (r: ReductionIR) => (r.fractionPlafond && r.fractionPlafond > 0 ? r.fractionPlafond : 1);

  // ── Étape 1 : écrêtement DOUBLE ENVELOPPE (art. 200-0 A) ──
  // Consommation en espace « fraction » = montant×fractionPlafond. Enveloppe commune
  // (10 000 €) : cumul des 'commun'. Enveloppe majorée (18 000 €) : GLOBALE = communs
  // RETENUS + 'majore'. Répartition dans l'ordre du tableau ; reconversion brut ÷ frac.
  const sommeCommunRetenueFrac = Math.min(
    reductions.reduce((s, r) => (r.plafondNiches === 'commun' ? s + Math.max(0, r.montant) * fracOf(r) : s), 0),
    capCommun,
  );
  let capRestantCommun = capCommun;
  let capRestantMajore = Math.max(0, capMajore - sommeCommunRetenueFrac);
  let totalPlafonnableAvantEcretement = 0;
  const effectifs = reductions.map((r) => {
    const montant = Math.max(0, r.montant);
    if (r.plafondNiches === false) return montant; // hors plafond : jamais écrêté
    totalPlafonnableAvantEcretement += montant;
    const f = fracOf(r);
    const consFrac = montant * f;
    if (r.plafondNiches === 'commun') {
      const alloue = Math.min(consFrac, capRestantCommun);
      capRestantCommun -= alloue;
      return alloue / f; // reconversion brut
    }
    const alloue = Math.min(consFrac, capRestantMajore); // 'majore'
    capRestantMajore -= alloue;
    return alloue / f;
  });
  // Écrêtement ventilé par enveloppe : une entrée 'commun' n'est écrêtée que par le
  // plafond 10 000 ; une entrée 'majore' que par le plafond global 18 000.
  let ecretementCommun = 0;
  let ecretementMajore = 0;
  reductions.forEach((r, i) => {
    if (r.plafondNiches === false) return;
    const perdu = Math.max(0, r.montant) - effectifs[i];
    if (r.plafondNiches === 'commun') ecretementCommun += perdu;
    else ecretementMajore += perdu;
  });
  const ecretementNiches = ecretementCommun + ecretementMajore;

  // ── Étape 2 : imputation bornée par le BARÈME restant (art. 197-I-5) ──
  // MOD1 : l'assiette est le barème seul ; PFU/PS/rachat AV sont ajoutés par l'appelant.
  let baremeRestant = Math.max(0, baremeApresDecote);
  let totalImpute = 0;
  let perduFauteImpot = 0;
  const detail: { id: string; montant: number; impute: number }[] = [];
  reductions.forEach((r, i) => {
    const impute = Math.min(effectifs[i], baremeRestant);
    baremeRestant -= impute;
    totalImpute += impute;
    perduFauteImpot += effectifs[i] - impute;
    detail.push({ id: r.id, montant: r.montant, impute });
  });
  return {
    impotFinal: baremeRestant, totalImpute,
    totalPlafonnableAvantEcretement, ecretementNiches, ecretementCommun, ecretementMajore, perduFauteImpot, detail,
  };
}

// ─── Dispositifs fiscaux immobiliers (Lot D2) ─────────────────────────────────
// Évalue le dispositif d'UN bien pour l'année fiscale : soit une réduction d'IR
// (à ajouter au socle), soit un statut non-ok (remonté pour affichage, jamais
// silencieux), soit rien. Barrière douce micro-foncier (art. 32 CGI) : Jeanbrun
// (déduction, gérée à part) et Loc'Avantages sont INCOMPATIBLES avec le micro.
type EvalDispositifReduction = { kind: "reduction"; idBien: string; id: string; label: string; montant: number; plafondNiches: PlafondNiches };
type EvalDispositifStatut = { kind: "statut"; idBien: string; dispositif: string; statut: string; motif: string };
type EvalDispositif = EvalDispositifReduction | EvalDispositifStatut | null;

function evaluerDispositifBien(b: Property, anneeFiscale: number, regime: string): EvalDispositif {
  const dispo = b.dispositifFiscal as string | undefined;
  if (!dispo || dispo === "aucun") return null;
  const idBien = String(b.id ?? "");
  if (dispo === "jeanbrunRelanceLogement") {
    // Déduction foncière : gérée par resolveDeductionsJeanbrun (réel). Au micro : incompatible.
    return regime === "micro"
      ? { kind: "statut", idBien, dispositif: dispo, statut: "incompatible", motif: "incompatible micro-foncier (art. 32 CGI)" }
      : null;
  }
  if (dispo === "locavantages" && regime === "micro") {
    return { kind: "statut", idBien, dispositif: dispo, statut: "incompatible", motif: "incompatible micro-foncier (art. 32 CGI)" };
  }
  const res = resolveReductionDispositif(b, anneeFiscale);
  if (res === null) return null;
  if (estReduction(res)) return { kind: "reduction", idBien, id: res.id, label: res.label, montant: res.montant, plafondNiches: res.plafondNiches };
  return { kind: "statut", idBien, dispositif: dispo, statut: res.statut, motif: res.motif };
}

export function computeIR(data: PatrimonialData, irOptions: IrOptions, activeConcubinPerson: 1 | 2 = 1) {
  // ── Revenus selon PCS ──
  const g1 = data.person1PcsGroupe;
  const g2 = data.person2PcsGroupe;
  const cat1 = data.person1Csp;
  const cat2 = data.person2Csp;

  const isIndep1 = g1 === "1" || g1 === "2" || isProfessionLiberale(cat1);
  const isIndep2 = g2 === "1" || g2 === "2" || isProfessionLiberale(cat2);
  // Bénéfice imposable indépendants — extrait dans resolveBeneficeTns (logique identique)
  const benefice1 = resolveBeneficeTns(data, 1);
  const benefice2 = resolveBeneficeTns(data, 2);

  // Salaires. Lot A/C2 cumul : masquage centralise dans salaireMasqueTns /
  // resolveSalaireRetenu (predicat UNIQUE, partage avec budget/endettement).
  // Refactor iso : meme comportement qu'avant (gardes C/D). isIndep1/isIndep2
  // restent INCHANGES (consommes par le plafond PER, garde E hors perimetre).
  const salaireMasque1 = salaireMasqueTns(data, 1);
  const salaireMasque2 = salaireMasqueTns(data, 2);
  const salary1 = resolveSalaireRetenu(data, 1);
  const salary2 = resolveSalaireRetenu(data, 2);
  // Retraites / pensions nominatives par personne (rétrocompatibilité si champ global)
  const pensionP1 = n(data.pensions1 || "");
  const pensionP2 = n(data.pensions2 || "");
  // Si les champs nominatifs ne sont pas renseignés, fallback sur le champ global (données migrées)
  const pensions = pensionP1 + pensionP2 > 0 ? pensionP1 + pensionP2 : n(data.pensions);
  // Pour le plafond PER par personne : pensions attribuées nominativement
  const pensionForP2 = pensionP2 > 0 ? pensionP2 : (pensionP1 === 0 && pensionP2 === 0 ? n(data.pensions) : 0);
  const salaries = salary1 + salary2 + pensions + benefice1 + benefice2;

  const kmAllowance1 = irOptions.expenseMode1 === "actual" ? computeKilometricAllowance(n(irOptions.km1), n(irOptions.cv1)) : 0;
  const kmAllowance2 = irOptions.expenseMode2 === "actual" ? computeKilometricAllowance(n(irOptions.km2), n(irOptions.cv2)) : 0;
  const mealExpenses1 = irOptions.expenseMode1 === "actual" ? n(irOptions.mealCount1) * n(irOptions.mealUnit1) : 0;
  const mealExpenses2 = irOptions.expenseMode2 === "actual" ? n(irOptions.mealCount2) * n(irOptions.mealUnit2) : 0;
  const otherExpenses1 = irOptions.expenseMode1 === "actual" ? n(irOptions.other1) : 0;
  const otherExpenses2 = irOptions.expenseMode2 === "actual" ? n(irOptions.other2) : 0;

  // Frais déductibles : uniquement pour les salariés (les indépendants déduisent via charges réelles)
  // Abattement 10% salaires — plafonné 14 555 €, plancher 509 € par personne (revenus 2025)
  const retained1 = salaireMasque1 ? 0 : (irOptions.expenseMode1 === "actual"
    ? kmAllowance1 + mealExpenses1 + otherExpenses1
    : salary1 > 0 ? Math.max(509, Math.min(salary1 * 0.1, 14555)) : 0);
  const retained2 = salaireMasque2 ? 0 : (irOptions.expenseMode2 === "actual"
    ? kmAllowance2 + mealExpenses2 + otherExpenses2
    : salary2 > 0 ? Math.max(509, Math.min(salary2 * 0.1, 14555)) : 0);
  // Abattement 10% pensions — plancher 454 € par pensionné, plafond 4 439 € par foyer (revenus 2025)
  const pensionAbatt1 = pensionP1 > 0 ? Math.max(454, pensionP1 * 0.1) : 0;
  const pensionAbatt2 = pensionP2 > 0 ? Math.max(454, pensionP2 * 0.1) : 0;
  const pensionAbattFoyer = (pensionP1 + pensionP2 > 0)
    ? Math.min(pensionAbatt1 + pensionAbatt2, 4439)
    // Cas legacy (champ global, pas de ventilation) : 1 seul pensionné
    : (n(data.pensions) > 0 ? Math.min(Math.max(454, n(data.pensions) * 0.1), 4439) : 0);
  const retainedExpenses = retained1 + retained2 + pensionAbattFoyer;

  // Enfants non rattachés → leur ownership exclut leurs biens de l'IR/IFI du foyer
  const nonRattachedChildIndexes = new Set(
    data.childrenData
      .map((c, i) => c.rattached === false ? `child_${i}` : null)
      .filter(Boolean)
  );
  const isOwnedByNonRattached = (ownership: string) => nonRattachedChildIndexes.has(ownership);

  // ── Dispositifs fiscaux (Lot D2) : année de référence = millésime du moteur ──
  const anneeFiscale = referentiels.pass.millesime;
  const biensDispo = data.properties.filter((p) => !isOwnedByNonRattached(p.ownership));
  // Déduction Jeanbrun (amortissement foncier) — FOYER COMMUN, au RÉEL uniquement
  // (barrière douce micro). Le montant retenu total réduit le foncier au point (ii).
  const jeanbrunFoyer = irOptions.foncierRegime === "real" ? resolveDeductionsJeanbrun(biensDispo, anneeFiscale) : null;
  const jeanbrunRetenu = jeanbrunFoyer ? jeanbrunFoyer.parBien.reduce((s, p) => s + p.montantRetenu, 0) : 0;
  // Évaluations par bien (réductions à imputer + statuts non-ok, jamais silencieux).
  const evalsDispositifs = biensDispo
    .map((b) => evaluerDispositifBien(b, anneeFiscale, irOptions.foncierRegime))
    .filter((e): e is Exclude<EvalDispositif, null> => e !== null);
  const statutsDispositifs = evalsDispositifs
    .filter((e): e is EvalDispositifStatut => e.kind === "statut")
    .map((e) => ({ idBien: e.idBien, dispositif: e.dispositif, statut: e.statut, motif: e.motif }));

  let foncierBrut = 0;
  let foncierCharges = 0;
  let foncierInterests = 0;
  for (const property of data.properties) {
    if (isOwnedByNonRattached(property.ownership)) continue; // exclu : appartient à un enfant non rattaché
    // LMNP/LMP RETIRES du foncier (arbitrage B) : routes vers le circuit BIC
    // meuble (isBienMeuble / beneficeMeuble ci-dessous), jamais foncier.
    if (["Location nue", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(property.type)) {
      const ltype = property.loanType || "amortissable";
      const isLocatif = ["Location nue", "SCI IR", "SCI IS", "Local professionnel"].includes(property.type);
      // Charges communes à tous régimes
      foncierBrut += n(property.rentGrossAnnual);
      // Multi-crédits : agréger primes assurance de tous les crédits
      const lv = resolveLoanValuesMulti(property);
      foncierCharges += n(property.propertyTaxAnnual) + n(property.insuranceAnnual) + n(property.worksAnnual) + n(property.otherChargesAnnual)
        + lv.insurancePremiumAnnual;
      if (isLocatif && irOptions.foncierRegime === "real") {
        // Intérêts déductibles : somme de tous les crédits (hors PTZ)
        if (property.loans && property.loans.length > 0) {
          for (const r of lv.loans) {
            if (r.loan.type !== "ptz") foncierInterests += r.interestAnnual;
          }
        } else {
          const ltypeLegacy = property.loanType || "amortissable";
          if (ltypeLegacy !== "ptz") {
            foncierInterests += lv.interestAnnual > 0 ? lv.interestAnnual : n(property.loanInterestAnnual);
          }
        }
      } else if (!isLocatif || ltype === "ptz") {
        // Non déductible
      } else {
        foncierInterests += n(property.loanInterestAnnual);
      }
    }
  }

  // Déficit foncier — CGI art. 156-I-3° (régime réel uniquement)
  // Intérêts imputés d'abord sur les loyers ; seul le déficit hors intérêts s'impute
  // sur le revenu global (plafond 10 700 €) ; le surplus est reportable (informatif).
  let taxableFonciers: number;
  let deficitFoncierImpute = 0;    // part imputée sur revenu global (≤ 10 700)
  let deficitFoncierReportable = 0; // informatif — à reporter sur revenus fonciers futurs
  if (irOptions.foncierRegime === "real") {
    // Amortissement Jeanbrun ajouté aux charges hors intérêts AVANT le déficit foncier
    // (il peut créer/aggraver un déficit : légal et voulu ; le plafond 10 700 € s'applique ensuite).
    const chargesReel = foncierCharges + jeanbrunRetenu;
    const resultatBrut = foncierBrut - chargesReel - foncierInterests;
    if (resultatBrut >= 0) {
      taxableFonciers = resultatBrut;
    } else {
      // Déficit : ventiler intérêts vs charges hors intérêts
      const interetsAbsorbes = Math.min(foncierInterests, foncierBrut);
      const interetsNonAbsorbes = foncierInterests - interetsAbsorbes;
      const loyersApresInterets = foncierBrut - interetsAbsorbes;
      const deficitHorsInterets = Math.max(0, chargesReel - loyersApresInterets);
      deficitFoncierImpute = Math.min(deficitHorsInterets, 10700);
      deficitFoncierReportable = interetsNonAbsorbes + Math.max(0, deficitHorsInterets - 10700);
      taxableFonciers = -deficitFoncierImpute; // négatif → réduit le revenu global
    }
  } else {
    taxableFonciers = Math.max(0, foncierBrut * 0.7);
  }
  const foncierSocialLevy = Math.max(0, taxableFonciers) * 0.172; // PS uniquement sur revenu foncier positif

  let taxablePlacements = 0;
  let pfuBase = 0;
  let avRachatImpot = 0; // Fiscalité AV rachat (PFU + prélèvements sociaux)
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";

  for (const placement of data.placements) {
    if (isOwnedByNonRattached(placement.ownership)) continue; // exclu : appartient à un enfant non rattaché
    if (!isAV(placement.type)) {
      if (placement.pfuEligible && !placement.pfuOptOut) {
        pfuBase += n(placement.taxableIncome);          // PFU : taxé à part (31,4%)
      } else {
        taxablePlacements += n(placement.taxableIncome); // Barème : une seule fois
      }
    } else {
      const retrait = n(placement.annualWithdrawal || "");
      if (retrait > 0) {
        const valeur = n(placement.value);
        const primesNettes = n(placement.totalPremiumsNet);
        const plusValues = Math.max(0, valeur - primesNettes);
        const ratioGain = valeur > 0 ? plusValues / valeur : 0;
        const gainBrut = retrait * ratioGain;
        const dateOuv = placement.openDate ? new Date(placement.openDate) : null;
        const ageAns = dateOuv ? (Date.now() - dateOuv.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
        const over8 = ageAns >= 8;
        const abattement = over8 ? (isCouple ? 9200 : 4600) : 0;
        const gainNetAbatt = Math.max(0, gainBrut - abattement);
        if (gainNetAbatt > 0) {
          if (over8) {
            if (primesNettes > 150000) {
              // Partie prop. au-delà de 150k → 12,8% IR + 17,2% PS ; en dessous → PFLi 7,5% + 17,2% PS
              // AV exclue de la hausse LFSS 2026 : PS restent à 17,2% (CSG 9,2% + CRDS 0,5% + solidarité 7,5%)
              const ratioAbove = Math.min(1, (primesNettes - 150000) / primesNettes);
              avRachatImpot += gainNetAbatt * ratioAbove * 0.30; // 12,8% IR + 17,2% PS
              avRachatImpot += gainNetAbatt * (1 - ratioAbove) * (0.075 + 0.172); // PFLi 7,5% + PS 17,2%
            } else {
              avRachatImpot += gainNetAbatt * (0.075 + 0.172); // PFLi 7,5% + PS 17,2%
            }
          } else {
            avRachatImpot += gainNetAbatt * 0.30; // 12,8% IR + 17,2% PS (AV exclue hausse LFSS 2026)
          }
        }
      }
    }
  }

  // ── Calcul PER par personne + plafond individuel ──
  function isPER(type: string) { return ["PER bancaire", "PER assurantiel", "Madelin"].includes(type); }
  const PASS_2026 = referentiels.pass.pass.annuel; // PASS source unique (pass-2026.json)

  // Plafond PER individuel (art. 163 quatervicies CGI + majoration art. 154 bis).
  //  - base10 (163 quatervicies) : 10% de TOUS les revenus pro (salaire net
  //    imposable + benefice TNS), retenus dans la limite de 8 PASS, plancher
  //    10% PASS (= 4 806 EUR pour PASS 48 060).
  //  - sup15 (154 bis) : 15% de la fraction du benefice entre 1 et 8 PASS,
  //    RESERVEE au regime REEL (micro exclu : abattement forfaitaire repute
  //    couvrir toutes charges, RM n.20415 12/04/1999).
  //  - cap global : PASS x (0,10x8 + 0,15x7) = 88 911 EUR.
  // Approximation moteur : N ~ N-1 (une seule annee, cf. tooltip d'interaction ;
  // reports des 3 annees anterieures non modelises).
  // Renvoie la decomposition : composante163 + composante154 === total au centime.
  function calcPlafondPER(salaireBase: number, benefice: number, beneficeAuReel: boolean) {
    const base10 = Math.max(0.10 * Math.min(salaireBase + benefice, 8 * PASS_2026), 0.10 * PASS_2026);
    const sup15 = beneficeAuReel
      ? 0.15 * Math.min(Math.max(benefice - PASS_2026, 0), 7 * PASS_2026)
      : 0;
    const total = Math.min(base10 + sup15, PASS_2026 * (0.10 * 8 + 0.15 * 7));
    const composante163 = Math.min(base10, total);
    const composante154 = total - composante163;
    return { total, composante163, composante154 };
  }

  // Assiette cumul (garde E levee) : salaire net imposable retenu + benefice TNS
  // de la personne. salaireBase2 inclut pensionForP2 (convention existante conservee).
  const plafond1 = calcPlafondPER(salary1, benefice1, resolveBeneficeAuReel(data, 1));
  const plafond2 = calcPlafondPER(salary2 + pensionForP2, benefice2, resolveBeneficeAuReel(data, 2));
  const plafondPER1 = plafond1.total;
  const plafondPER2 = plafond2.total;

  // Versements PER par personne (ownership = person1 ou person2 ou child_X)
  const perP1Deductible = data.placements
    .filter(p => isPER(p.type) && p.ownership === "person1" && p.perDeductible !== false)
    .reduce((sum, p) => sum + n(p.annualContribution || ""), 0);
  const perP2Deductible = data.placements
    .filter(p => isPER(p.type) && p.ownership === "person2" && p.perDeductible !== false)
    .reduce((sum, p) => sum + n(p.annualContribution || ""), 0);

  // Déduction PER par personne, avec MUTUALISATION epoux/PACS (E4). Sur demande
  // expresse (BOFiP BOI-IR-BASE-20-50-30), plafonds et cotisations 163 quatervicies
  // sont additionnes en un POOL foyer ; la majoration 154 bis reste PERSONNELLE (ni
  // mutualisable ni reportable). Chaque conjoint absorbe d'abord ses versements sur SA
  // propre fraction 154 bis, le reliquat puise dans le pool 163 commun.
  let perDeductionVersements: number;
  if (isCouple) {
    const usableSup1 = Math.min(perP1Deductible, plafond1.composante154);
    const usableSup2 = Math.min(perP2Deductible, plafond2.composante154);
    const rem1 = perP1Deductible - usableSup1;
    const rem2 = perP2Deductible - usableSup2;
    const pool163 = plafond1.composante163 + plafond2.composante163;
    perDeductionVersements = usableSup1 + usableSup2 + Math.min(rem1 + rem2, pool163);
  } else {
    // Celibataire (concubins traites en amont, chemin separe) : min par personne, INCHANGE.
    perDeductionVersements = Math.min(perP1Deductible, plafondPER1) + Math.min(perP2Deductible, plafondPER2);
  }
  // Fallback saisie manuelle (E3/E3b) : actif seulement sans placement PER deductible
  // (condition INCHANGEE), cappe au plafond du foyer. On ne somme le plafond de la
  // personne 2 que si elle EXISTE (isCouple, ir.ts:354, meme predicat que decote / AV) :
  // le plancher 10% PASS est un droit par membre REEL, la personne 2 fictive exclue.
  const capFoyerManuel = plafondPER1 + (isCouple ? plafondPER2 : 0);
  const perDeductionCalc = perDeductionVersements
    + (perP1Deductible === 0 && perP2Deductible === 0 ? Math.min(n(data.perDeduction), capFoyerManuel) : 0);
  // Excedent foyer PER apres mutualisation (versements non deductibles) — warning UI.
  const perExcedentFoyer = Math.max(0, perP1Deductible + perP2Deductible - perDeductionVersements);

  // Plafond global (pour affichage — somme des deux)
  const plafondPER = plafondPER1 + plafondPER2;

  // ── Retrait PER en capital : capital au barème, intérêts au PFU ──
  let perCapitalImposable = 0;   // s'ajoute au revenu net global (barème)
  let perInteretsPFU = 0;        // imposé au PFU 31,4%
  for (const p of data.placements) {
    if (!isPER(p.type)) continue;
    const retrait = n(p.perWithdrawal || "");
    if (retrait <= 0) continue;
    if (p.perAnticiped) {
      // Déblocage anticipé : capital exonéré, intérêts PFU
      const capital = n(p.perWithdrawalCapital || "");
      const interets = n(p.perWithdrawalInterest || "");
      perInteretsPFU += interets > 0 ? interets : Math.max(0, retrait - capital);
    } else {
      // Sortie normale retraite : capital au barème + intérêts PFU
      const capital = n(p.perWithdrawalCapital || "");
      const interets = n(p.perWithdrawalInterest || "");
      // Si ventilation manuelle renseignée, l'utiliser ; sinon calcul auto depuis encours/versements
      const encours = n(p.value);
      const versements = n(p.annualContribution || "");
      const ratioCapital = encours > 0 && versements > 0
        ? Math.min(1, versements / encours)
        : (capital > 0 || interets > 0 ? 0 : 0.5); // fallback 50/50 si rien de renseigné
      perCapitalImposable += capital > 0 ? capital : retrait * ratioCapital;
      perInteretsPFU += interets > 0 ? interets : retrait * (1 - ratioCapital);
    }
  }

  // ── Rentes PER (RVTO) : fraction imposable au barème + PS 17,2% ──
  let perRentesImposable = 0;
  let perRentesPS = 0;
  for (const r of (data.perRentes || [])) {
    const montant = n(r.annualAmount || "");
    const age = Math.max(0, n(r.ageAtFirst || "0"));
    const fraction = fractionRVTO(age);
    perRentesImposable += montant * fraction;
    perRentesPS += montant * fraction * 0.172;
  }

  // ── Déduction Madelin prévoyance (Lot B2) — POSTE SÉPARÉ du PER, plafond
  // INDÉPENDANT (art. 154 bis CGI). Appliquée PAR PERSONNE si : statut TNS
  // (estEligibleMadelin) ET bénéfice saisi « avant déduction » (toggle
  // beneficeDejaDeduitMadelin absent/false). Réduit UNIQUEMENT le revenu imposable
  // (aucune assiette sociale ici). Sommée sur le foyer (p1 + p2), EXACTEMENT comme
  // perDeductionCalc. Réutilise benefice1/2 + PASS_2026 (source unique).
  function madelinDeductionPourPersonne(which: 1 | 2, benefice: number): number {
    if (!estEligibleMadelin(data, which)) return 0;
    if (data.travail?.[which === 1 ? "p1" : "p2"]?.beneficeDejaDeduitMadelin === true) return 0;
    return Math.min(sommeCotisationsMadelin(data, which), plafondMadelinPrevoyance(benefice, PASS_2026));
  }
  const madelinDed1 = madelinDeductionPourPersonne(1, benefice1);
  const madelinDed2 = madelinDeductionPourPersonne(2, benefice2);

  const deductibleCharges = perDeductionCalc + n(data.pensionDeductible) + n(data.otherDeductible)
    + n(data.csgDeductibleFoncier) + madelinDed1 + madelinDed2; // CSG déductible foncier N-1 (ligne 6DE) + Madelin prévoyance (B2)
  // Abattement handicap personne 1 et/ou 2 — CGI art. 157 bis (2 627 € si rev ≤ 16 410 €, 1 313 € si ≤ 26 831 €)
  const handicapAbatt1 = data.person1Handicap ? getHandicapAbattement(n(data.salary1) + n(data.ca1) + n(data.baRevenue1)) : 0;
  const handicapAbatt2 = data.person2Handicap ? getHandicapAbattement(n(data.salary2) + n(data.ca2) + n(data.baRevenue2)) : 0;
  const handicapAbatt = handicapAbatt1 + handicapAbatt2;
  // ── Location meublee (LMNP/LMP) — benefice BIC au bareme (SANS abattement
  // 10 %) + PS revenus du patrimoine 18,6 %. Le bien ne passe par AUCUN chemin
  // foncier (LMNP/LMP retires des listes ci-dessus). baseFoyer >= 0 : un deficit
  // meuble ne remonte pas au revenu global (art. 156 I-1 ter). Somme foyer ;
  // ventilation par concubin faite dans le chemin dedie.
  let beneficeMeuble = 0;
  for (const property of data.properties) {
    if (isOwnedByNonRattached(property.ownership)) continue;
    if (!isBienMeuble(property)) continue;
    beneficeMeuble += baseBicMeuble(property);
  }
  const meubleSocialLevy = beneficeMeuble * refMeuble.ps.revenusPatrimoine;
  const revenuNetGlobal = Math.max(0, salaries + taxableFonciers + taxablePlacements + perCapitalImposable + perRentesImposable + beneficeMeuble - retainedExpenses - deductibleCharges - handicapAbatt);

  // ── Réduction d'impôt forfait scolaire — art. 199 quater B CGI ──
  // Collège : 61 €/enfant | Lycée : 153 €/enfant | Supérieur : 183 €/enfant
  const FORFAIT_SCOLAIRE: Record<string, number> = { college: 61, lycee: 153, superieur: 183 };
  const forfaitScolaireReduction = data.childrenData
    .filter(c => c.rattached !== false)
    .reduce((sum, child) => sum + (FORFAIT_SCOLAIRE[(child.schoolLevel || "").toLowerCase()] || 0), 0);

  // Socle générique de réductions d'impôt (cf. appliquerReductionsIR). Le forfait
  // scolaire (art. 199 quater B CGI) est une entrée de cette liste ; les deux
  // chemins (concubins / foyer commun) la consomment via la MÊME fonction, avec la
  // MÊME double enveloppe de plafonnement (art. 200-0 A CGI, référentiel millésimé —
  // jamais 10 000/18 000 en dur). Le forfait scolaire est plafondNiches:false :
  // avantage lié à la situation personnelle, EXCLU du plafond (BOFiP BOI-IR-LIQ-20-20-10).
  // Le plafonnement est ACTIF depuis les dispositifs immobiliers (catégorie 'commun') ;
  // l'enveloppe 'majore' (18 000 €) est prête pour les dispositifs outre-mer / Sofica.
  const reductionsIR: ReductionIR[] = [
    { id: "forfait_scolaire", label: "Frais de scolarité", montant: forfaitScolaireReduction, plafondNiches: false },
  ];
  const plafondGlobalNiches = referentiels.pass.plafondGlobalNiches;
  const plafondMajoreNiches = referentiels.pass.plafondMajoreNiches;

  const isConcubin = data.coupleStatus === "cohab";

  // ── Concubinage : 2 foyers séparés ──────────────────────────────
  if (isConcubin) {
    const childrenParts = getChildrenFiscalParts(data.childrenData);
    // Enfants rattachés à la personne dont c'est le foyer (déterminé par qui a les enfants)
    const childrenP1 = data.childrenData.filter(c => c.rattached !== false && (c.parentLink === "common_child" || c.parentLink === "person1_only"));
    const childrenP2 = data.childrenData.filter(c => c.rattached !== false && c.parentLink === "person2_only");
    const partsChildP1 = getChildrenFiscalParts(childrenP1);
    const partsChildP2 = getChildrenFiscalParts(childrenP2);
    // Parts de base : 1 part chacun + enfants selon parenté
    const parts1 = 1 + partsChildP1 + (partsChildP2 === 0 && childrenParts > 0 ? childrenParts - partsChildP1 : 0);
    // Si aucun enfant n'est "person2_only", tous vont à p1 par défaut
    const parts2 = 1 + partsChildP2;
    // ── Ventilation des revenus par propriétaire réel ──────────────
    // Helper : quote-part d'un bien pour une personne donnée
    const ownerShare = (ownership: string, personKey: "person1" | "person2", prop?: { indivisionShare1?: string; indivisionShare2?: string }) => {
      if (ownership === personKey) return 1;
      if (ownership === (personKey === "person1" ? "person2" : "person1")) return 0;
      if (ownership === "common") return 0.5;
      if (ownership === "indivision" && prop) {
        const s = personKey === "person1" ? n(prop.indivisionShare1) : n(prop.indivisionShare2);
        return s > 0 ? Math.min(1, s / 100) : 0.5; // fallback 50/50 si non renseigné
      }
      return 0; // child_* ou autre → hors foyer
    };

    // ── Foncier ventilé par personne ──
    let foncierBrut1 = 0, foncierCharges1 = 0, foncierInterests1 = 0;
    let foncierBrut2 = 0, foncierCharges2 = 0, foncierInterests2 = 0;
    for (const property of data.properties) {
      if (isOwnedByNonRattached(property.ownership)) continue;
      // LMNP/LMP RETIRES du foncier (arbitrage B) : circuit BIC meuble ventile plus bas.
      if (!["Location nue", "SCI IR", "SCI IS", "Local professionnel", "Autre"].includes(property.type)) continue;
      const s1 = ownerShare(property.ownership, "person1", property);
      const s2 = ownerShare(property.ownership, "person2", property);
      const rent = n(property.rentGrossAnnual);
      const lv = resolveLoanValuesMulti(property);
      const charges = n(property.propertyTaxAnnual) + n(property.insuranceAnnual) + n(property.worksAnnual) + n(property.otherChargesAnnual) + lv.insurancePremiumAnnual;
      let interests = 0;
      const isLocatif = ["Location nue", "SCI IR", "SCI IS", "Local professionnel"].includes(property.type);
      if (isLocatif && irOptions.foncierRegime === "real") {
        if (property.loans && property.loans.length > 0) {
          for (const r of lv.loans) { if (r.loan.type !== "ptz") interests += r.interestAnnual; }
        } else {
          const lt = property.loanType || "amortissable";
          if (lt !== "ptz") interests += lv.interestAnnual > 0 ? lv.interestAnnual : n(property.loanInterestAnnual);
        }
      }
      foncierBrut1 += rent * s1; foncierCharges1 += charges * s1; foncierInterests1 += interests * s1;
      foncierBrut2 += rent * s2; foncierCharges2 += charges * s2; foncierInterests2 += interests * s2;
    }

    // Déficit foncier par personne (même logique #6, plafond 10 700 € par personne)
    const calcFoncierPerson = (brut: number, charges: number, interests: number) => {
      if (irOptions.foncierRegime !== "real") return { taxable: Math.max(0, brut * 0.7), impute: 0, reportable: 0 };
      const resultat = brut - charges - interests;
      if (resultat >= 0) return { taxable: resultat, impute: 0, reportable: 0 };
      const interetsAbsorbes = Math.min(interests, brut);
      const interetsNonAbsorbes = interests - interetsAbsorbes;
      const loyersApresInterets = brut - interetsAbsorbes;
      const deficitHorsInterets = Math.max(0, charges - loyersApresInterets);
      const impute = Math.min(deficitHorsInterets, 10700);
      const reportable = interetsNonAbsorbes + Math.max(0, deficitHorsInterets - 10700);
      return { taxable: -impute, impute, reportable };
    };
    // Jeanbrun (amortissement foncier) PAR concubin : bien attribué au concubin
    // majoritaire (50/50 ou commun -> P1), plafond PAR concubin (approx. v1 indivision).
    let jeanbrun1: JeanbrunResultat | null = null, jeanbrun2: JeanbrunResultat | null = null;
    if (irOptions.foncierRegime === "real") {
      const biensP1 = biensDispo.filter((b) => ownerShare(b.ownership, "person1", b) >= ownerShare(b.ownership, "person2", b));
      const biensP2 = biensDispo.filter((b) => ownerShare(b.ownership, "person2", b) > ownerShare(b.ownership, "person1", b));
      jeanbrun1 = resolveDeductionsJeanbrun(biensP1, anneeFiscale);
      jeanbrun2 = resolveDeductionsJeanbrun(biensP2, anneeFiscale);
    }
    const jeanbrunRetenu1 = jeanbrun1 ? jeanbrun1.parBien.reduce((s, p) => s + p.montantRetenu, 0) : 0;
    const jeanbrunRetenu2 = jeanbrun2 ? jeanbrun2.parBien.reduce((s, p) => s + p.montantRetenu, 0) : 0;
    const foncier1 = calcFoncierPerson(foncierBrut1, foncierCharges1 + jeanbrunRetenu1, foncierInterests1);
    const foncier2 = calcFoncierPerson(foncierBrut2, foncierCharges2 + jeanbrunRetenu2, foncierInterests2);

    // PS foncier par personne (uniquement sur la part positive)
    const foncierPS1 = Math.max(0, foncier1.taxable) * 0.172;
    const foncierPS2 = Math.max(0, foncier2.taxable) * 0.172;

    // ── Placements ventilés par personne (hors AV) ──
    let taxablePlac1 = 0, taxablePlac2 = 0, pfuBase1 = 0, pfuBase2 = 0;
    for (const placement of data.placements) {
      if (isOwnedByNonRattached(placement.ownership)) continue;
      if (isAV(placement.type)) continue; // AV traité séparément (avRachatImpot global)
      const s1 = ownerShare(placement.ownership, "person1");
      const s2 = ownerShare(placement.ownership, "person2");
      const income = n(placement.taxableIncome);
      if (placement.pfuEligible && !placement.pfuOptOut) {
        pfuBase1 += income * s1; pfuBase2 += income * s2;
      } else {
        taxablePlac1 += income * s1; taxablePlac2 += income * s2;
      }
    }

    // ── PER ventilé par personne ──
    const perDeduction1 = Math.min(perP1Deductible, plafondPER1);
    const perDeduction2 = Math.min(perP2Deductible, plafondPER2);

    // PER retraits capital ventilés par personne
    let perCapital1 = 0, perCapital2 = 0, perInteretsPFU1 = 0, perInteretsPFU2 = 0;
    for (const p of data.placements) {
      if (!isPER(p.type)) continue;
      const retrait = n(p.perWithdrawal || "");
      if (retrait <= 0) continue;
      const isP1 = p.ownership === "person1";
      if (p.perAnticiped) {
        const capital = n(p.perWithdrawalCapital || "");
        const interets = n(p.perWithdrawalInterest || "");
        const pfu = interets > 0 ? interets : Math.max(0, retrait - capital);
        if (isP1) perInteretsPFU1 += pfu; else perInteretsPFU2 += pfu;
      } else {
        const capital = n(p.perWithdrawalCapital || "");
        const interets = n(p.perWithdrawalInterest || "");
        const encours = n(p.value);
        const versements = n(p.annualContribution || "");
        const ratioCapital = encours > 0 && versements > 0
          ? Math.min(1, versements / encours)
          : (capital > 0 || interets > 0 ? 0 : 0.5);
        const cap = capital > 0 ? capital : retrait * ratioCapital;
        const int = interets > 0 ? interets : retrait * (1 - ratioCapital);
        if (isP1) { perCapital1 += cap; perInteretsPFU1 += int; } else { perCapital2 += cap; perInteretsPFU2 += int; }
      }
    }

    // PER rentes ventilées par personne
    let perRentes1 = 0, perRentesPS1 = 0, perRentes2 = 0, perRentesPS2 = 0;
    for (const r of (data.perRentes || [])) {
      const montant = n(r.annualAmount || "");
      const fraction = fractionRVTO(Math.max(0, n(r.ageAtFirst || "0")));
      const imposable = montant * fraction;
      const ps = imposable * 0.172;
      if (r.owner === "person2") { perRentes2 += imposable; perRentesPS2 += ps; }
      else { perRentes1 += imposable; perRentesPS1 += ps; }
    }

    // ── Charges déductibles ventilées par personne ──
    // CSG déductible foncier : ventilée au prorata du foncier net imposable
    // de chaque personne (cohérent avec qui paye réellement la CSG).
    // Fallback 50/50 si aucun foncier (champ saisi par erreur).
    const csgFoncier = n(data.csgDeductibleFoncier);
    const foncierTaxableP1 = Math.max(0, foncier1.taxable);
    const foncierTaxableP2 = Math.max(0, foncier2.taxable);
    const totalFoncierNet = foncierTaxableP1 + foncierTaxableP2;
    const csgFoncierP1 = totalFoncierNet > 0 ? (csgFoncier * foncierTaxableP1 / totalFoncierNet) : csgFoncier / 2;
    const csgFoncierP2 = csgFoncier - csgFoncierP1;
    // Pension déductible + autres charges : pas de champ nominatif → 50/50
    // (à ventiler quand des champs payeur dédiés existeront)
    const autresNonVentilable = n(data.pensionDeductible) + n(data.otherDeductible);

    // ── Abattement handicap par personne ──
    const hAbatt1 = data.person1Handicap ? getHandicapAbattement(n(data.salary1) + n(data.ca1) + n(data.baRevenue1)) : 0;
    const hAbatt2 = data.person2Handicap ? getHandicapAbattement(n(data.salary2) + n(data.ca2) + n(data.baRevenue2)) : 0;

    // ── Location meublee (LMNP/LMP) ventilee par concubin (part = ownerShare) ──
    // Symetrie stricte avec le foyer commun : benefice BIC au bareme (SANS
    // abattement 10 %) ajoute a rev1/rev2 ; PS revenus du patrimoine 18,6 %
    // ajoute a extra1/extra2. Bien meuble hors foncier (isBienMeuble).
    let beneficeMeuble1 = 0, beneficeMeuble2 = 0;
    for (const property of data.properties) {
      if (isOwnedByNonRattached(property.ownership)) continue;
      if (!isBienMeuble(property)) continue;
      const base = baseBicMeuble(property);
      beneficeMeuble1 += base * ownerShare(property.ownership, "person1", property);
      beneficeMeuble2 += base * ownerShare(property.ownership, "person2", property);
    }
    const meublePS1 = beneficeMeuble1 * refMeuble.ps.revenusPatrimoine;
    const meublePS2 = beneficeMeuble2 * refMeuble.ps.revenusPatrimoine;

    // ── Revenus nets par personne ──
    // Lot B cumul salarie + TNS : on SOMME salaire + benefice (au lieu du ternaire
    // exclusif isIndep ? benefice : salary). salary1/salary2 sont deja passes par la
    // garde C (salaireMasque) et retained1/retained2 par la garde D du Lot A (memes
    // variables de portee fonction) : concubin pur salarie => benefice=0 (inchange) ;
    // concubin pur TNS champ absent => salary=0 via garde C (inchange) ; cumulant =>
    // les deux s'additionnent, abattement 10% sur le SEUL salaire.
    const rev1 = Math.max(0, salary1 + benefice1 + pensionP1 - retained1
      + foncier1.taxable + taxablePlac1 + perCapital1 + perRentes1 + beneficeMeuble1
      - perDeduction1 - csgFoncierP1 - autresNonVentilable / 2 - hAbatt1 - madelinDed1);
    const rev2 = Math.max(0, salary2 + benefice2 + pensionP2 - retained2
      + foncier2.taxable + taxablePlac2 + perCapital2 + perRentes2 + beneficeMeuble2
      - perDeduction2 - csgFoncierP2 - autresNonVentilable / 2 - hAbatt2 - madelinDed2);

    const r1 = computeIRConcubin(rev1, parts1);
    const r2 = computeIRConcubin(rev2, parts2);
    // Décote concubinage — chaque foyer est un célibataire fiscal (897 € / seuil 1 982 €)
    const decote1 = r1.bareme > 0 && r1.bareme < 1982 ? Math.max(0, 897 - 0.4525 * r1.bareme) : 0;
    const decote2 = r2.bareme > 0 && r2.bareme < 1982 ? Math.max(0, 897 - 0.4525 * r2.bareme) : 0;
    const bareme1 = Math.max(0, r1.bareme - decote1);
    const bareme2 = Math.max(0, r2.bareme - decote2);
    // PFU ventilé par personne
    const totalPFU = (pfuBase1 + pfuBase2) * 0.314 + (perInteretsPFU1 + perInteretsPFU2) * 0.314;
    // ── Dispositifs PAR concubin (option A) : deux foyers fiscaux distincts. ──
    // Forfait scolaire réparti par foyer (childrenP1/P2) ; réductions attribuées par
    // ownerShare (indivision -> moitié chacun) ; plafond niches 10 000 € PAR concubin
    // (chaque socle est appelé séparément). avRachatImpot (global, non ventilé) porté
    // sur T1 (approx. documentée ; nul dans les verrous e1/e2/miroir).
    const forfaitP1 = childrenP1.reduce((s, c) => s + (FORFAIT_SCOLAIRE[(c.schoolLevel || "").toLowerCase()] || 0), 0);
    const forfaitP2 = childrenP2.reduce((s, c) => s + (FORFAIT_SCOLAIRE[(c.schoolLevel || "").toLowerCase()] || 0), 0);
    const liste1: ReductionIR[] = [{ id: "forfait_scolaire", label: "Frais de scolarité", montant: forfaitP1, plafondNiches: false }];
    const liste2: ReductionIR[] = [{ id: "forfait_scolaire", label: "Frais de scolarité", montant: forfaitP2, plafondNiches: false }];
    for (const e of evalsDispositifs) {
      if (e.kind !== "reduction") continue;
      const bienE = biensDispo.find((b) => String(b.id ?? "") === e.idBien);
      const s1 = bienE ? ownerShare(bienE.ownership, "person1", bienE) : 0;
      const s2 = bienE ? ownerShare(bienE.ownership, "person2", bienE) : 0;
      if (s1 > 0) liste1.push({ id: `${e.id}_${e.idBien}`, label: e.label, montant: e.montant * s1, plafondNiches: e.plafondNiches });
      if (s2 > 0) liste2.push({ id: `${e.id}_${e.idBien}`, label: e.label, montant: e.montant * s2, plafondNiches: e.plafondNiches });
    }
    // ── Défiscalisation financière (Lot 1) PAR concubin : attribution par ownerShare,
    // RNG = revenu net du concubin (rev1/rev2) pour la SOFICA. Alertes captées une
    // seule fois par placement (indépendantes du RNG). Full ownership => exact ; part
    // commune/indivision => quote-part (approx. documentée, comme l'immobilier). ──
    const alertesFinancieres: AlerteFinanciereExposee[] = [];
    for (const placement of data.placements) {
      if (isOwnedByNonRattached(placement.ownership)) continue;
      if (!placement.defiscalisation) continue;
      const pid = String(placement.id ?? "");
      const sf1 = ownerShare(placement.ownership, "person1");
      const sf2 = ownerShare(placement.ownership, "person2");
      const resF1 = sf1 > 0 ? resolveReductionFinanciere(placement.defiscalisation, anneeFiscale, { couple: false, rng: rev1 }) : null;
      const resF2 = sf2 > 0 ? resolveReductionFinanciere(placement.defiscalisation, anneeFiscale, { couple: false, rng: rev2 }) : null;
      if (resF1 && resF1.montant > 0) liste1.push({ id: `${resF1.id}_${pid}`, label: resF1.label, montant: resF1.montant * sf1, plafondNiches: resF1.plafondNiches, fractionPlafond: resF1.fractionPlafond });
      if (resF2 && resF2.montant > 0) liste2.push({ id: `${resF2.id}_${pid}`, label: resF2.label, montant: resF2.montant * sf2, plafondNiches: resF2.plafondNiches, fractionPlafond: resF2.fractionPlafond });
      const resAlert = resF1 ?? resF2;
      if (resAlert) for (const a of resAlert.alertes) alertesFinancieres.push({ placementId: pid, dispositif: resAlert.id, code: a.code, message: a.message });
    }
    // MOD1 (197-I-5) : chaque foyer impute ses réductions sur SON barème seul ; PS
    // foncier + PFU + PS rentes PER + rachat AV sont ajoutés APRÈS imputation.
    const extra1 = foncierPS1 + perRentesPS1 + (pfuBase1 + perInteretsPFU1) * 0.314 + avRachatImpot + meublePS1;
    const extra2 = foncierPS2 + perRentesPS2 + (pfuBase2 + perInteretsPFU2) * 0.314 + meublePS2;
    const socle1 = appliquerReductionsIR(bareme1, liste1, plafondGlobalNiches, plafondMajoreNiches);
    const socle2 = appliquerReductionsIR(bareme2, liste2, plafondGlobalNiches, plafondMajoreNiches);
    const finalIR = socle1.impotFinal + extra1 + socle2.impotFinal + extra2;
    const averageRate = revenuNetGlobal > 0 ? finalIR / revenuNetGlobal : 0;
    const brackets: TaxBracket[] = [
      { from: 0, to: 11600, rate: 0 }, { from: 11600, to: 29579, rate: 0.11 },
      { from: 29579, to: 84577, rate: 0.3 }, { from: 84577, to: 181917, rate: 0.41 },
      { from: 181917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
    ];
    // Données pour la personne active (affichage)
    const rActive = activeConcubinPerson === 2 ? r2 : r1;
    const partsActive = activeConcubinPerson === 2 ? parts2 : parts1;
    const revActive = activeConcubinPerson === 2 ? rev2 : rev1;
    const bracketFill = computeTaxFromBrackets(rActive.quotient, brackets).fill;
    const currentBracket = bracketFill.find((s) => rActive.quotient <= s.to) || bracketFill[bracketFill.length - 1];
    const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(rActive.quotient, 1);
    return {
      salaries, retainedExpenses, foncierBrut, foncierCharges, foncierInterests,
      taxableFonciers: foncier1.taxable + foncier2.taxable,
      foncierSocialLevy: foncierPS1 + foncierPS2,
      beneficeMeuble: beneficeMeuble1 + beneficeMeuble2, meubleSocialLevy: meublePS1 + meublePS2,
      beneficeMeuble1, beneficeMeuble2, meublePS1, meublePS2,
      taxablePlacements: taxablePlac1 + taxablePlac2, pfuBase: pfuBase1 + pfuBase2, deductibleCharges,
      revenuNetGlobal: revActive, finalIR, totalPFU, forfaitScolaireReduction,
      bareme: activeConcubinPerson === 2 ? bareme2 : bareme1, quotient: rActive.quotient, parts: partsActive,
      quotientFamilialCapAdjustment: 0, qfBenefit: 0, qfCap: 0,
      marginalRate: rActive.marginalRate, averageRate,
      bracketFill, currentBracketLabel: currentBracket.label,
      indicatorPct: visualMax > 0 ? Math.min(100, (rActive.quotient / visualMax) * 100) : 0, visualMax,
      avRachatImpot, perCapitalImposable: perCapital1 + perCapital2,
      perInteretsPFU: perInteretsPFU1 + perInteretsPFU2,
      perRentesImposable: perRentes1 + perRentes2, perRentesPS: perRentesPS1 + perRentesPS2,
      isConcubin: true, ir1: bareme1, ir2: bareme2,
      rev1, rev2, parts1, parts2, plafondPER, plafondPER1, plafondPER2,
      plafondPER1Base163: plafond1.composante163, plafondPER1Sup154: plafond1.composante154,
      plafondPER2Base163: plafond2.composante163, plafondPER2Sup154: plafond2.composante154,
      perDeductionCalc: perDeduction1 + perDeduction2, perP1Deductible, perP2Deductible,
      // Concubins : foyers separes, AUCUNE mutualisation => excedent = somme des excedents individuels.
      perExcedentFoyer: Math.max(0, perP1Deductible + perP2Deductible - (perDeduction1 + perDeduction2)),
      deficitFoncierImpute: foncier1.impute + foncier2.impute,
      deficitFoncierReportable: foncier1.reportable + foncier2.reportable,
      // ── Détail par personne (audit IR concubins #3 : affichage TabIR) ──
      foncierBrut1, foncierBrut2,
      foncierCharges1, foncierCharges2,
      foncierInterests1, foncierInterests2,
      foncierTaxable1: foncier1.taxable, foncierTaxable2: foncier2.taxable,
      foncierPS1, foncierPS2,
      taxablePlac1, taxablePlac2,
      pfuBase1, pfuBase2,
      perInteretsPFU1, perInteretsPFU2,
      // PFU total par foyer (placements barème PFU + PER intérêts) × 31,4 %
      totalPFU1: (pfuBase1 + perInteretsPFU1) * 0.314,
      totalPFU2: (pfuBase2 + perInteretsPFU2) * 0.314,
      csgFoncierP1, csgFoncierP2,
      // IR total des 2 foyers (ir.finalIR est filtré sur la personne active dans
      // certaines vues, mais ici le total réel = bareme1 + bareme2 + PS + PFU)
      finalIR1: bareme1 + foncierPS1 + (pfuBase1 * 0.314) + (perInteretsPFU1 * 0.314) + perRentesPS1 + meublePS1,
      finalIR2: bareme2 + foncierPS2 + (pfuBase2 * 0.314) + (perInteretsPFU2 * 0.314) + perRentesPS2 + meublePS2,
      // Exposition (Lot FIX-FONCIER) : foyer-wide, cohérent avec foncierCharges exposé.
      jeanbrunRetenu, foncierChargesTotal: foncierCharges + jeanbrunRetenu,
      dispositifsFiscaux: {
        reductions: [...socle1.detail, ...socle2.detail],
        jeanbrun: (jeanbrun1 || jeanbrun2) ? {
          parBien: [...(jeanbrun1?.parBien ?? []), ...(jeanbrun2?.parBien ?? [])],
          plafond: (jeanbrun1?.plafondFoyer ?? 0) + (jeanbrun2?.plafondFoyer ?? 0), // somme des plafonds par concubin
          ecretement: (jeanbrun1?.ecretement ?? 0) + (jeanbrun2?.ecretement ?? 0),
        } : null,
        statuts: statutsDispositifs,
        // Écrêtement niches réel (art. 200-0 A) = somme des deux foyers concubins.
        ecretementNiches: socle1.ecretementNiches + socle2.ecretementNiches,
        ecretementCommun: socle1.ecretementCommun + socle2.ecretementCommun,
        ecretementMajore: socle1.ecretementMajore + socle2.ecretementMajore,
        alertesFinancieres,
      },
    };
  }

  // ── Foyer commun (marié, pacsé, célibataire) ─────────────────────
  const baseParts = getBaseFiscalParts(data);
  const childrenParts = getChildrenFiscalParts(data.childrenData);
  // Demi-part supplémentaire si personne du foyer titulaire carte invalidité — CGI art. 195-1
  // (s'ajoute aux parts de base — plafond QF 1 785 € par demi-part supplémentaire)
  const handicapPersonParts = (data.person1Handicap ? 0.5 : 0) + (data.person2Handicap ? 0.5 : 0);
  const parts = Math.max(1, baseParts + childrenParts + handicapPersonParts + (data.singleParent ? 0.5 : 0));
  const quotient = revenuNetGlobal / parts;

  const brackets: TaxBracket[] = [
    { from: 0, to: 11600, rate: 0 },
    { from: 11600, to: 29579, rate: 0.11 },
    { from: 29579, to: 84577, rate: 0.3 },
    { from: 84577, to: 181917, rate: 0.41 },
    { from: 181917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
  ];

  const taxWithParts = computeTaxFromBrackets(quotient, brackets).tax * parts;
  const taxWithBaseParts = computeTaxFromBrackets(revenuNetGlobal / baseParts, brackets).tax * baseParts;
  const addedHalfParts = Math.max(0, parts - baseParts);
  // Plafonnement QF — parent isolé (case T) : 1ère demi-part enfant plafonnée à 4 262 €,
  // les suivantes à 1 807 € (CGI art. 197-I-2, revenus 2025)
  const qfCapParentIsole = data.singleParent && childrenParts > 0 ? 4262 : 0;
  const qfCapStandard = addedHalfParts > 0
    ? (data.singleParent && childrenParts > 0
      ? qfCapParentIsole + getQuotientCapPerHalfPart() * ((addedHalfParts - 0.5) / 0.5)
      : getQuotientCapPerHalfPart() * (addedHalfParts / 0.5))
    : 0;
  const qfCap = qfCapStandard;
  const qfBenefit = Math.max(0, taxWithBaseParts - taxWithParts);
  const quotientFamilialCapAdjustment = qfBenefit > qfCap ? qfBenefit - qfCap : 0;
  const baremeBeforeDecote = taxWithParts + quotientFamilialCapAdjustment;
  // Décote — CGI art. 197-I-4 (LF 2026, revenus 2025)
  const decotePlafond = isCouple ? 1483 : 897;
  const decoteSeuil = isCouple ? 3277 : 1982;
  const decote = baremeBeforeDecote > 0 && baremeBeforeDecote < decoteSeuil
    ? Math.max(0, decotePlafond - 0.4525 * baremeBeforeDecote) : 0;
  const bareme = Math.max(0, baremeBeforeDecote - decote);
  const bracketFill = computeTaxFromBrackets(quotient, brackets).fill;
  const totalPFU = pfuBase * 0.314 + perInteretsPFU * 0.314; // PFU 31,4% = 12,8% IR + 18,6% PS — dividendes, intérêts, PV mob. (LFSS 2026)
  // Réductions dispositifs (FOYER COMMUN) : ajoutées APRÈS le forfait scolaire
  // (hors plafond d'abord, plafonnables ensuite) ; une seule liste pour tout le foyer.
  for (const e of evalsDispositifs) {
    if (e.kind === "reduction") reductionsIR.push({ id: `${e.id}_${e.idBien}`, label: e.label, montant: e.montant, plafondNiches: e.plafondNiches });
  }
  // ── Défiscalisation financière (Lot 1) : IR-PME / FCPI / FIP / SOFICA / Girardin.
  // Une réduction n'est générée que si l'investissement a lieu l'année simulée ET
  // dans une fenêtre active ; base plafonnée selon la situation familiale ; SOFICA
  // plafonnée par le RNG (fourni ici). Alertes douces remontées pour l'UI (Lot 2). ──
  const alertesFinancieres: AlerteFinanciereExposee[] = [];
  for (const placement of data.placements) {
    if (isOwnedByNonRattached(placement.ownership)) continue;
    const resF = resolveReductionFinanciere(placement.defiscalisation, anneeFiscale, { couple: isCouple, rng: revenuNetGlobal });
    if (!resF) continue;
    const pid = String(placement.id ?? "");
    if (resF.montant > 0) reductionsIR.push({ id: `${resF.id}_${pid}`, label: resF.label, montant: resF.montant, plafondNiches: resF.plafondNiches, fractionPlafond: resF.fractionPlafond });
    for (const a of resF.alertes) alertesFinancieres.push({ placementId: pid, dispositif: resF.id, code: a.code, message: a.message });
  }
  // MOD1 (197-I-5) : les réductions s'imputent sur le BARÈME seul ; PFU, PS foncier,
  // rachat AV et PS rentes PER sont ajoutés APRÈS imputation (finalIR all-inclusive,
  // contrat de sortie inchangé pour les consommateurs de finalIR).
  const socleReductions = appliquerReductionsIR(
    bareme,
    reductionsIR,
    plafondGlobalNiches,
    plafondMajoreNiches,
  );
  const finalIR = socleReductions.impotFinal + totalPFU + foncierSocialLevy + avRachatImpot + perRentesPS + meubleSocialLevy;

  const marginalRate = quotient <= 11600 ? 0 : quotient <= 29579 ? 0.11 : quotient <= 84577 ? 0.3 : quotient <= 181917 ? 0.41 : 0.45;
  const averageRate = revenuNetGlobal > 0 ? finalIR / revenuNetGlobal : 0;
  const currentBracket = bracketFill.find((s) => quotient <= s.to) || bracketFill[bracketFill.length - 1];
  const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(quotient, 1);
  const indicatorPct = visualMax > 0 ? Math.min(100, Math.max(0, (quotient / visualMax) * 100)) : 0;

  return {
    salaries, retainedExpenses, foncierBrut, foncierCharges, foncierInterests,
    taxableFonciers, foncierSocialLevy, taxablePlacements, pfuBase, deductibleCharges,
    beneficeMeuble, meubleSocialLevy,
    revenuNetGlobal, finalIR, totalPFU, forfaitScolaireReduction, bareme, quotient, parts,
    quotientFamilialCapAdjustment, qfBenefit, qfCap, marginalRate, averageRate,
    bracketFill, currentBracketLabel: currentBracket.label, indicatorPct, visualMax,
    avRachatImpot, perCapitalImposable, perInteretsPFU, perRentesImposable, perRentesPS, isConcubin: false, plafondPER, plafondPER1, plafondPER2,
    plafondPER1Base163: plafond1.composante163, plafondPER1Sup154: plafond1.composante154,
    plafondPER2Base163: plafond2.composante163, plafondPER2Sup154: plafond2.composante154,
    perDeductionCalc, perP1Deductible, perP2Deductible, perExcedentFoyer, deficitFoncierImpute, deficitFoncierReportable,
    // Exposition (Lot FIX-FONCIER) : la card comparaison lit ces champs au lieu de recalculer.
    jeanbrunRetenu, foncierChargesTotal: foncierCharges + jeanbrunRetenu,
    dispositifsFiscaux: {
      reductions: socleReductions.detail,
      jeanbrun: jeanbrunFoyer ? { parBien: jeanbrunFoyer.parBien, plafond: jeanbrunFoyer.plafondFoyer, ecretement: jeanbrunFoyer.ecretement } : null,
      statuts: statutsDispositifs,
      // Écrêtement niches réel (art. 200-0 A, double enveloppe) exposé pour le trio + PDF.
      ecretementNiches: socleReductions.ecretementNiches,
      ecretementCommun: socleReductions.ecretementCommun,
      ecretementMajore: socleReductions.ecretementMajore,
      alertesFinancieres,
    },
  };
}
