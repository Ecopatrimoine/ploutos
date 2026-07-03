// ─── Module budget : revenus, charges courantes, capacite d'epargne (Lot A) ──
//
// Fonction PURE qui LIT (data, ir). Elle ne modifie JAMAIS ir.ts / succession.ts
// / ifi.ts (frontiere stricte). Le seul refactor autorise est l'extraction du
// helper computeChargesCreditAnnuelles dans endettement.ts (source unique des
// charges de credit).
//
// Base "budget" DISTINCTE de la base bancaire du taux d'endettement : ici les
// loyers comptent a 100 % (tresorerie reellement percue), la ou l'endettement
// les pondere a 70 %.
//
// Unites : tout est calcule en ANNUEL puis ramene au MOIS (/12). AUCUN arrondi
// dans le calcul — l'affichage arrondira. Les charges COURANTES sont saisies
// MENSUELLES (train de vie) et utilisees telles quelles (PAS de /12) ; toutes
// les autres lignes sont annuelles -> /12. Le detail retourne est donc MENSUEL
// et non arrondi (somme des revenus du detail == revenusMensuels a l'unite pres
// flottante ; idem charges).

import type { PatrimonialData } from "../../types/patrimoine";
import { n } from "./utils";
import { resolveBeneficeTns } from "./ir";
import { computeChargesCreditAnnuelles } from "./endettement";

// `ir` = objet retourne par computeIR (branche foyer commun OU concubins). On ne
// lit que finalIR ; computeIR expose beaucoup d'autres cles, non utilisees ici.
type IrLike = { finalIR?: number;[k: string]: unknown };

export type BudgetDetail = {
  salairesPensions: number;         // mensuel : salaires nets + pensions (fallback safe)
  beneficeTns: number;              // mensuel : benefice TNS net (resolveBeneficeTns)
  rentesPer: number;                // mensuel : rentes PER percues
  loyersBruts: number;              // mensuel : loyers bruts a 100 %
  retraitsAvPer: number;            // mensuel : flux cash sortis (annualWithdrawal + perWithdrawal)
  chargesCourantes: number;         // mensuel : detail ou global (barriere douce)
  chargesCourantesIsDetail: boolean; // true = somme du detail ; false = champ global
  chargesFoncieres: number;         // mensuel : taxe fonc. + assurance + travaux + autres (par bien)
  creditsAssurances: number;        // mensuel : numerateur endettement /12
  impots: number;                   // mensuel : ir.finalIR /12 (tout-compris)
  pensionVersee: number;            // mensuel : pension alimentaire versee (pensionDeductible)
};

export type BudgetResult = {
  revenusMensuels: number;
  chargesMensuelles: number;
  capaciteEpargne: number;          // revenus - charges ; PAS de clamp (peut etre negatif)
  detail: BudgetDetail;
  hasChargesCourantes: boolean;     // >= 1 poste du detail OU le global renseigne
};

const M = 12;
// Barriere douce (patron resolveOtherLoan) : un champ renseigne — Y COMPRIS "0" —
// est une valeur ; seul le vide (apres trim) est "non renseigne".
const isFilled = (v: unknown): boolean => String(v ?? "").trim() !== "";

export function computeBudget(data: PatrimonialData, ir: IrLike): BudgetResult {
  const properties = Array.isArray(data.properties) ? data.properties : [];
  const placements = Array.isArray(data.placements) ? data.placements : [];

  // ─── REVENUS (base budget : loyers a 100 %, distincte de l'endettement) ──
  const salaires = n(data.salary1) + n(data.salary2);
  // Pensions : MEME regle de fallback que computeIR / computeTauxEndettement —
  // pensions1+2 si l'un est renseigne, sinon le champ global. Jamais la somme
  // des trois (evite le double-compte global + nominatifs).
  const pP1 = n(data.pensions1 || "");
  const pP2 = n(data.pensions2 || "");
  const pensionsAnnuelles = pP1 + pP2 > 0 ? pP1 + pP2 : n(data.pensions);
  const salairesPensions = (salaires + pensionsAnnuelles) / M;

  const beneficeTns = (resolveBeneficeTns(data, 1) + resolveBeneficeTns(data, 2)) / M;

  const rentesPerAnnuelles = (Array.isArray(data.perRentes) ? data.perRentes : [])
    .reduce((s, r) => s + n(r.annualAmount || ""), 0);
  const rentesPer = rentesPerAnnuelles / M;

  // Loyers BRUTS a 100 % (tresorerie percue), pas la ponderation bancaire 70 %.
  const loyersBruts = properties.reduce((s, p) => s + n(p.rentGrossAnnual), 0) / M;

  // Flux mobiliers SORTIS uniquement : retraits AV (annualWithdrawal) + PER
  // (perWithdrawal). taxableIncome / annualIncome EXCLUS (capitalise vs
  // distribue non distinguable dans le modele actuel).
  const retraitsAvPer = placements.reduce(
    (s, p) => s + n(p.annualWithdrawal || "") + n(p.perWithdrawal || ""),
    0,
  ) / M;

  const revenusMensuels =
    salairesPensions + beneficeTns + rentesPer + loyersBruts + retraitsAvPer;

  // ─── CHARGES ─────────────────────────────────────────────────────────────
  // Charges courantes : saisies MENSUELLES. Barriere douce : si >= 1 poste du
  // detail est renseigne (y compris "0"), le TOTAL du detail prime ; sinon le
  // champ global. Un poste "0" compte comme valeur (0), distinct de vide.
  const detail = data.chargesCourantesDetail;
  const postes = detail
    ? [detail.loyerRP, detail.energie, detail.assurancesPerso, detail.scolarite, detail.transport, detail.autres]
    : [];
  const anyDetailFilled = postes.some(isFilled);
  let chargesCourantes: number;
  let chargesCourantesIsDetail: boolean;
  if (anyDetailFilled) {
    chargesCourantes = postes.reduce((s, v) => s + n(v), 0);
    chargesCourantesIsDetail = true;
  } else {
    chargesCourantes = n(data.chargesCourantes || "");
    chargesCourantesIsDetail = false;
  }
  const hasChargesCourantes = anyDetailFilled || isFilled(data.chargesCourantes);

  // Charges foncieres reelles DECAISSEES (par bien) : taxe fonciere + assurance
  // + travaux + autres charges. PAS d'amortissement Jeanbrun (fiscal, non decaisse).
  const chargesFoncieres = properties.reduce(
    (s, p) => s + n(p.propertyTaxAnnual) + n(p.insuranceAnnual) + n(p.worksAnnual) + n(p.otherChargesAnnual),
    0,
  ) / M;

  // Credits + assurances : MEME numerateur que computeTauxEndettement (helper partage).
  const creditsAssurances = computeChargesCreditAnnuelles(data).total / M;

  // Impots DECAISSES : ir.finalIR est DEJA l'impot TOTAL du foyer, tout-compris
  // (bareme IR + PFU 31,4 % + PS foncier 17,2 % + impot rachat AV + PS rentes PER,
  // net des reductions/niches ; cf ir.ts appliquerReductionsIR). On NE ré-ajoute
  // donc PAS ir.totalPFU / ir.foncierSocialLevy : ils sont deja compris dans
  // finalIR (les ré-ajouter double-compterait). Coherent avec les retraits AV/PER
  // comptes en revenu cash ci-dessus. [Pour ne compter QUE IR bareme + PFU + PS
  // foncier, remplacer par n(ir.bareme) + n(ir.totalPFU) + n(ir.foncierSocialLevy).]
  const impots = n(ir.finalIR) / M;

  // Pension alimentaire VERSEE (deductible IR) = charge reellement decaissee.
  const pensionVersee = n(data.pensionDeductible) / M;

  const chargesMensuelles =
    chargesCourantes + chargesFoncieres + creditsAssurances + impots + pensionVersee;

  // ─── CAPACITE D'EPARGNE ── PAS de clamp : peut etre negative (deficit). ──
  const capaciteEpargne = revenusMensuels - chargesMensuelles;

  return {
    revenusMensuels,
    chargesMensuelles,
    capaciteEpargne,
    detail: {
      salairesPensions, beneficeTns, rentesPer, loyersBruts, retraitsAvPer,
      chargesCourantes, chargesCourantesIsDetail, chargesFoncieres, creditsAssurances,
      impots, pensionVersee,
    },
    hasChargesCourantes,
  };
}
