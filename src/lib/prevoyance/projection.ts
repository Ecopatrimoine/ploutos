// ─── Moteur de projection AM + invalidité (Lot 4) ────────────────────────
//
// Calcule, pour une personne donnée, l'évolution mensuelle estimée des
// revenus de remplacement en cas d'arrêt maladie (J0 → J1095) puis
// passage en invalidité jusqu'à l'âge légal de retraite.
//
// Tolérance des trous : toute valeur "TO_VERIFY" / "TO_FILL" /
// undefined dans le référentiel produit un étage à 0 dans la série
// correspondante + remontée via `donneesCaisseIndisponibles=true` et
// une `RuptureCle` "donnees_indisponibles".
//
// Pas de valeur inventée : le moteur lit STRICTEMENT le référentiel.

import type {
  AxePoint,
  CategorieInvalidite,
  ContratIndividuel,
  CouvertureCollective,
  EntreePerso,
  ProjectionResult,
  RuptureCle,
  ScenarioArret,
  SerieEmpilee,
} from "./types";
import type { Referentiels } from "../../data/prevoyance";
import type { NatureContrat, StatutPro, TptConfig } from "../../types/patrimoine";
import {
  buildPlafondVariables,
  evalFormulaPlafond,
  type PlafondVariables,
} from "./formula";
import { coefBrutNet } from "./constants";
import {
  computeIjCarmfJournaliere,
  pensionInvaliditeTotaleAnnuelle,
  renteEnfantsInvaliditeAnnuelle,
  jourFinInvaliditeCarmf,
} from "./carmf";
import {
  ijCipavPhase1Journaliere,
  pensionInvaliditeCipavAnnuelle,
  jourFinInvaliditeCipav,
} from "./cipav";
import {
  ijCarpimkoPhase1Journaliere,
  ijCarpimkoPhase2Journaliere,
  renteInvaliditeCarpimkoAnnuelle,
} from "./carpimko";

// Paliers temporels phase AM (J0 → J1095).
const PALIERS_AM = [0, 3, 7, 14, 30, 60, 90, 120, 180, 365, 547, 730, 912, 1095];
const BASCULE_INVALIDITE = 1095;
const TAUX_MAINTIEN_PARTIEL = 2 / 3; // 66,66 % — convention L.1226-1

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function isSalarieOuAssimile(s: StatutPro | ""): boolean {
  return (
    s === "salarie_non_cadre" ||
    s === "salarie_cadre" ||
    s === "president_sas" ||
    s === "eurl_unique" ||
    s === "fonctionnaire"
  );
}

function isTNS(s: StatutPro | ""): boolean {
  return (
    s === "tns_liberal" ||
    s === "tns_commercant" ||
    s === "tns_artisan" ||
    s === "gerant_majoritaire"
  );
}

function dateAt(start: Date, daysOffset: number): string {
  const d = new Date(start.getTime() + daysOffset * 86400000);
  return d.toISOString().slice(0, 10);
}

// ────────────────────────────────────────────────────────────────────
// Axe temporel
// ────────────────────────────────────────────────────────────────────

function buildAxe(entree: EntreePerso, today: Date): AxePoint[] {
  const finJour = Math.max(0, (entree.ageRetraite - entree.age) * 365);
  const points: AxePoint[] = [];

  for (const j of PALIERS_AM) {
    if (j > finJour) break;
    points.push({
      jour: j,
      date: dateAt(today, j),
      phase: j < BASCULE_INVALIDITE ? "am" : "invalidite",
    });
  }

  // Phase invalidité : J1095 puis +365 chaque année.
  let nextYear = BASCULE_INVALIDITE + 365;
  while (nextYear <= finJour) {
    points.push({
      jour: nextYear,
      date: dateAt(today, nextYear),
      phase: "invalidite",
    });
    nextYear += 365;
  }

  // Inclure le dernier jour de projection si différent.
  if (points.length === 0 || points[points.length - 1].jour < finJour) {
    points.push({
      jour: finJour,
      date: dateAt(today, finJour),
      phase: finJour < BASCULE_INVALIDITE ? "am" : "invalidite",
    });
  }
  return points;
}

// Insère des jours « événements » (ruptures) dans l'axe : déduplique,
// borne à [0, finJour], étiquette la phase, et préserve le tri croissant.
// Permet au graphique d'annoter la marche d'escalier exacte (fin de
// maintien employeur) au lieu d'interpoler en biais entre deux points.
function insertJoursAxe(axe: AxePoint[], jours: number[], today: Date, finJour: number): AxePoint[] {
  const existants = new Set(axe.map((p) => p.jour));
  const aAjouter = jours.filter(
    (j) => Number.isFinite(j) && j >= 0 && j <= finJour && !existants.has(j)
  );
  if (aAjouter.length === 0) return axe;
  const nouveaux: AxePoint[] = aAjouter.map((j) => ({
    jour: j,
    date: dateAt(today, j),
    phase: j < BASCULE_INVALIDITE ? "am" : "invalidite",
  }));
  return [...axe, ...nouveaux].sort((a, b) => a.jour - b.jour);
}

// ────────────────────────────────────────────────────────────────────
// Maintien employeur (CCN si dispo, sinon maintien légal L.1226-1)
// ────────────────────────────────────────────────────────────────────

type Palier = {
  ancienneteMois: number;
  joursA100Pct?: number;   // présent si source = ccn
  joursA90Pct?: number;    // présent si source = legal
  joursA6666Pct: number;
};

type MaintienParams = {
  carenceJours: number;
  paliers: Palier[];
  source: "ccn" | "legal" | "indisponible";
};

function getMaintienParams(idcc: string | null, ref: Referentiels): MaintienParams {
  const ccn = ref.ccn as any;
  if (idcc) {
    const conv = ccn?.conventions?.[idcc];
    const m = conv?.maintienEmployeur;
    if (m && Array.isArray(m.paliers)) {
      const paliers: Palier[] = m.paliers
        .filter(
          (p: any) =>
            safeNum(p?.ancienneteMois) !== null &&
            safeNum(p?.joursA6666Pct) !== null &&
            (safeNum(p?.joursA100Pct) !== null || safeNum(p?.joursA90Pct) !== null)
        )
        .map((p: any) => ({
          ancienneteMois: p.ancienneteMois,
          joursA100Pct: safeNum(p.joursA100Pct) ?? undefined,
          joursA90Pct: safeNum(p.joursA90Pct) ?? undefined,
          joursA6666Pct: p.joursA6666Pct,
        }));
      const carence = safeNum(m.carenceJours);
      if (carence !== null && paliers.length > 0) {
        return { carenceJours: carence, paliers, source: "ccn" };
      }
    }
  }
  // Fallback légal Mensualisation
  const legal = ccn?.maintienLegal;
  if (legal && Array.isArray(legal.paliers)) {
    const paliers: Palier[] = legal.paliers.map((p: any) => ({
      ancienneteMois: p.ancienneteMois,
      joursA90Pct: p.joursA90Pct,
      joursA6666Pct: p.joursA6666Pct,
    }));
    return {
      carenceJours: safeNum(legal.carenceJours) ?? 7,
      paliers,
      source: "legal",
    };
  }
  return { carenceJours: 7, paliers: [], source: "indisponible" };
}

function findPalierMaintien(paliers: Palier[], ancienneteMois: number): Palier | null {
  if (paliers.length === 0) return null;
  // Palier le plus élevé dont l'ancienneté minimale est ≤ l'ancienneté
  // de la personne. Si aucune ancienneté ne satisfait → null (pas de
  // maintien employeur).
  let best: Palier | null = null;
  for (const p of paliers) {
    if (ancienneteMois >= p.ancienneteMois) {
      if (!best || p.ancienneteMois > best.ancienneteMois) best = p;
    }
  }
  return best;
}

// Jours « événements » de fin de maintien employeur (taux plein puis
// 66,66 %). Calculés une seule fois et partagés entre l'insertion dans
// l'axe (pour annoter la marche) et detectRuptures (pour le libellé).
function joursRupturesMaintien(
  m: MaintienParams,
  palier: Palier | null,
  isSalarie: boolean
): { finPlein: number | null; finPartiel: number | null } {
  if (!isSalarie || !palier) return { finPlein: null, finPartiel: null };
  const joursPlein = palier.joursA100Pct ?? palier.joursA90Pct ?? 0;
  const jours6666 = palier.joursA6666Pct;
  const finPlein = joursPlein > 0 ? m.carenceJours + joursPlein : null;
  const finPartiel = jours6666 > 0 ? m.carenceJours + joursPlein + jours6666 : null;
  return { finPlein, finPartiel };
}

function computeMaintienEmployeur(
  t: number,
  m: MaintienParams,
  palier: Palier | null,
  salaireMensuelCible: number,
  isSalarie: boolean,
  ijObligMensuel: number
): number {
  if (!isSalarie || !palier || t < m.carenceJours) return 0;
  const tEffectif = t - m.carenceJours;
  const joursPlein = palier.joursA100Pct ?? palier.joursA90Pct ?? 0;
  const jours6666 = palier.joursA6666Pct;

  let cible = 0;
  if (tEffectif < joursPlein) {
    // CCN : 100 % du net. Légal : 90 % du brut (approxé via salaireMensuelCible).
    const tauxPlein = palier.joursA100Pct !== undefined ? 1.0 : 0.9;
    cible = salaireMensuelCible * tauxPlein;
  } else if (tEffectif < joursPlein + jours6666) {
    cible = salaireMensuelCible * TAUX_MAINTIEN_PARTIEL;
  } else {
    return 0;
  }
  // Le maintien employeur vient en COMPLÉMENT des IJ obligatoires.
  return Math.max(0, cible - ijObligMensuel);
}

// ────────────────────────────────────────────────────────────────────
// IJ obligatoires (régime de la caisse)
// ────────────────────────────────────────────────────────────────────

function lookupCaisse(caisseCode: string | null, ref: Referentiels): any | null {
  if (!caisseCode) return null;
  return (ref.caisses as any)?.caisses?.[caisseCode] ?? null;
}

function isCaisseToFill(c: any): boolean {
  return !c || c.TO_FILL === true || !c.ij;
}

// Résout la durée d'indemnisation des IJ obligatoires selon le scénario.
//   - "maladie_ordinaire" → plafondDureeJours (360 j CPAM/SSI)
//   - "ald"               → plafondDureeJoursALD (1095 j) si présent,
//                           sinon fallback sur plafondDureeJours +
//                           signal `aldManquant` (donnée non documentée).
function resolvePlafondDuree(
  ij: any,
  scenarioArret: ScenarioArret
): { duree: number | null; aldManquant: boolean } {
  if (scenarioArret === "ald") {
    const ald = safeNum(ij?.plafondDureeJoursALD);
    if (ald !== null) return { duree: ald, aldManquant: false };
    return { duree: safeNum(ij?.plafondDureeJours), aldManquant: true };
  }
  return { duree: safeNum(ij?.plafondDureeJours), aldManquant: false };
}

// Extrait le diviseur d'une formule IJ de type "RAAM / N" (régime SSI :
// "RAAM / 730"). Retourne null si la caisse n'utilise pas cette règle
// (CPAM, qui n'a pas de champ formuleIJ).
function parseFormuleRAAM(formuleIJ: unknown): number | null {
  if (typeof formuleIJ !== "string") return null;
  const m = formuleIJ.replace(/\s/g, "").match(/^RAAM\/(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const diviseur = parseFloat(m[1]);
  return Number.isFinite(diviseur) && diviseur > 0 ? diviseur : null;
}

// Valeur JOURNALIÈRE brute de l'IJ obligatoire (avant conversion ×30).
// Exportée pour les tests d'exactitude juridique (famille G) : on
// valide le journalier réglementaire, pas le mensuel d'affichage.
// Retourne null si la caisse n'est pas documentée ou si une donnée
// critique manque (le moteur n'invente jamais).
export function computeIJObligatoireJournaliere(
  t: number,
  caisseRef: any,
  entree: EntreePerso,
  vars: PlafondVariables,
  scenarioArret: ScenarioArret = "ald"
): number | null {
  if (isCaisseToFill(caisseRef)) return null;
  const ij = caisseRef.ij;
  if (ij?.TO_FILL) return null;

  const carence = safeNum(ij.carenceJours);
  if (carence === null) return null;
  if (t < carence) return 0;

  // Durée d'IJ selon le scénario (360 ordinaire / 1095 ALD).
  const { duree: plafondDuree } = resolvePlafondDuree(ij, scenarioArret);
  if (plafondDuree !== null && t > plafondDuree) return 0;

  // 1) Règle uniforme par classe (CARMF…)
  if (ij.regle === "uniforme_par_classe" && ij.classes) {
    const classe = entree.classeCotisationCaisse ?? null;
    const cl = classe ? ij.classes[classe] : null;
    return safeNum(cl?.ijJournaliere);
  }

  // 2) Règle uniforme (CARPIMKO…)
  if (ij.regle === "uniforme") {
    return safeNum(ij.ijJournaliere);
  }

  // 3) Règle tranche revenu (CPAM, SSI, CIPAV)
  const baseAnnuelle = entree.salaireBrutAnnuel > 0
    ? entree.salaireBrutAnnuel
    : (entree.revenuTNSAnnuel ?? 0);
  if (baseAnnuelle <= 0) return null;

  // 3a) Règle SSI : IJ = RAAM / 730 (RAAM = revenu d'activité annuel
  // moyen, plafonné au PASS). Pas de taux séparé (le /730 ≈ 50 %/jour).
  // IJ nulle sous le seuil plancher (RAAM < seuilRevenuNul) → trou
  // pédagogique RÉEL, pas un bug. Plafond IJ journalier = ijMaxJournaliere.
  const diviseurRAAM = parseFormuleRAAM(ij.formuleIJ);
  if (diviseurRAAM !== null) {
    const seuilNul = safeNum(ij.seuilRevenuNul);
    if (seuilNul !== null && baseAnnuelle < seuilNul) return 0;
    const passAnnuel = vars.PASS_annuel;
    const raamPlafonne = passAnnuel > 0 ? Math.min(baseAnnuelle, passAnnuel) : baseAnnuelle;
    let ijj = raamPlafonne / diviseurRAAM;
    const ijMax = safeNum(ij.ijMaxJournaliere);
    if (ijMax !== null) ijj = Math.min(ijj, ijMax);
    return ijj;
  }

  // 3b) Règle CPAM : SJB plafonné au salaire 1,4 SMIC. Taux requis.
  const taux = safeNum(ij.tauxBrut) ?? safeNum(ij.tauxIJ);
  if (taux === null) return null;
  const salaireMensuel = baseAnnuelle / 12;

  // Plafond du SALAIRE mensuel retenu (formule paramétrique 1,4 SMIC en
  // priorité — suit les revalorisations —, sinon valeur figée). Pour
  // CPAM : le plafond porte sur le SALAIRE, pas directement sur l'IJ.
  let plafondSalaireMensuel: number | null = null;
  if (typeof ij.plafondFormule === "string") {
    plafondSalaireMensuel = evalFormulaPlafond(ij.plafondFormule, vars);
  }
  if (plafondSalaireMensuel === null) plafondSalaireMensuel = safeNum(ij.plafondSalaireBrutMensuel);

  const salaireRetenu =
    plafondSalaireMensuel !== null ? Math.min(salaireMensuel, plafondSalaireMensuel) : salaireMensuel;

  // Salaire journalier de base (SJB) = salaire mensuel retenu × 3 mois /
  // diviseur (91,25 = 3 mois calendaires, convention CPAM). IJ = taux × SJB.
  const diviseurSJB = safeNum(ij.diviseurSJB);
  let ijj: number;
  if (diviseurSJB !== null && diviseurSJB > 0) {
    const sjb = (salaireRetenu * 3) / diviseurSJB;
    ijj = sjb * taux;
  } else {
    // Fallback (caisse sans diviseur SJB renseigné) : approximation
    // journalière /360 sur le salaire retenu, puis plafond journalier figé.
    ijj = (salaireRetenu * 12) / 360 * taux;
    const plafondJ = safeNum(ij.plafondJournalier);
    if (plafondJ !== null) ijj = Math.min(ijj, plafondJ);
  }

  // Majoration familiale J31 : N'EST PAS appliquée tant que la donnée
  // est TO_VERIFY (cf. décision — contradiction L.323-4 non résolue).
  // Le moteur n'invente jamais : maj.active doit être true ET tauxMajore
  // numérique pour s'appliquer.
  const maj = ij.majorationFamilleApresJ31;
  if (maj?.active === true && t >= 31 && (entree.nbEnfantsACharge ?? 0) >= 3) {
    const tauxMaj = safeNum(maj.tauxMajore);
    if (tauxMaj !== null && diviseurSJB !== null && diviseurSJB > 0) {
      const sjb = (salaireRetenu * 3) / diviseurSJB;
      ijj = Math.max(ijj, sjb * tauxMaj);
    }
  }

  return ijj;
}

// Wrapper MENSUEL pour l'affichage : journalière × 30 (« mois-type
// 30 jours », convention de lisibilité distincte du calcul
// réglementaire en jours calendaires).
function computeIJObligatoireMensuel(
  t: number,
  caisseRef: any,
  entree: EntreePerso,
  revenuMensuelTNS: number,
  salaireBrutMensuel: number,
  vars: PlafondVariables,
  scenarioArret: ScenarioArret = "ald"
): number | null {
  void salaireBrutMensuel;
  void revenuMensuelTNS;
  const journaliere = computeIJObligatoireJournaliere(t, caisseRef, entree, vars, scenarioArret);
  return journaliere === null ? null : journaliere * 30;
}

// ────────────────────────────────────────────────────────────────────
// IJ complémentaire collective et individuelle
// ────────────────────────────────────────────────────────────────────

// Borne un pourcentage de remplacement à 1.0 (principe indemnitaire :
// pas de revenu de remplacement > revenu d'activité — décision H11).
function clampPct(pct: number): number {
  return Math.min(Math.max(0, pct), 1);
}

// Détecte si une couverture (collective ou individuelle) vise plus de
// 100 % du revenu → bornée par clampPct (décision H11). Sert à lever
// un constat info.
function detecteSurCouverture(
  cov: CouvertureCollective | null,
  contrats: ContratIndividuel[]
): boolean {
  if (cov?.ij && cov.ij.pctSalaire > 1) return true;
  if (cov?.invalidite) {
    if (
      cov.invalidite.cat1.pctSalaire > 1 ||
      cov.invalidite.cat2.pctSalaire > 1 ||
      cov.invalidite.cat3.pctSalaire > 1
    ) {
      return true;
    }
  }
  if (contrats.some((c) => c.type === "invalidite" && (c.baseInvalidite ?? 0) > 1)) return true;
  return false;
}

function computeIJCollective(
  t: number,
  cov: CouvertureCollective | null,
  salaireBrutMensuel: number,
  dejaCouvertMensuel: number
): number {
  if (!cov?.ij) return 0;
  const f = cov.ij.franchise;
  const plafond = cov.ij.plafondJours;
  if (t < f) return 0;
  if (t > f + plafond) return 0;
  const cible = salaireBrutMensuel * clampPct(cov.ij.pctSalaire);
  return Math.max(0, cible - dejaCouvertMensuel);
}

// Résultat d'un étage individuel borné (IJ ou invalidité).
//   total      : montant mensuel effectivement versé (forfaitaire + indemnitaire borné)
//   forfaitaire: part des contrats forfaitaires (versée en plein)
//   bornee     : true si un contrat indemnitaire a été réduit (souhait > marge)
type EtageIndividuel = { total: number; forfaitaire: number; bornee: boolean };

// Répartit les contrats indemnitaires dans la marge restante jusqu'à 100 %
// du revenu de référence, après prise en compte du déjà-perçu (obligatoire
// + collective + maintien) et des forfaitaires versés en plein
// (SPEC_PREVOYANCE_SURCOUVERTURE §2.2). Un contrat sans `nature` est
// indemnitaire (rétrocompatible).
function repartirIndividuels(
  montants: Array<{ montant: number; nature: NatureContrat }>,
  revenuRef: number,
  dejaPercuMensuel: number
): EtageIndividuel {
  let forfaitaire = 0;
  const indemnitaires: number[] = [];
  for (const m of montants) {
    if (m.nature === "forfaitaire") forfaitaire += m.montant;
    else indemnitaires.push(m.montant);
  }
  // Les forfaitaires se servent d'abord (en plein) ; les indemnitaires
  // comblent ensuite la marge jusqu'à 100 % du revenu de référence.
  let marge = Math.max(0, revenuRef - dejaPercuMensuel - forfaitaire);
  let indemnitaireVerse = 0;
  let bornee = false;
  for (const souhait of indemnitaires) {
    const effectif = Math.min(souhait, marge);
    if (effectif < souhait - 1e-6) bornee = true;
    indemnitaireVerse += effectif;
    marge -= effectif;
  }
  return { total: forfaitaire + indemnitaireVerse, forfaitaire, bornee };
}

function computeIJIndividuelle(
  t: number,
  contrats: ContratIndividuel[],
  revenuRef: number,
  dejaPercuMensuel: number
): EtageIndividuel {
  const montants: Array<{ montant: number; nature: NatureContrat }> = [];
  for (const c of contrats) {
    if (c.type !== "ij") continue;
    const franchise = c.franchiseJours ?? 0;
    if (t < franchise) continue;
    if (c.plafondJoursIJ !== undefined && t > franchise + c.plafondJoursIJ) continue;
    // capitalOuMontant = IJ journalière complémentaire
    montants.push({ montant: c.capitalOuMontant * 30, nature: c.nature ?? "indemnitaire" });
  }
  return repartirIndividuels(montants, revenuRef, dejaPercuMensuel);
}

// ────────────────────────────────────────────────────────────────────
// Phase invalidité (≥ J1095)
// ────────────────────────────────────────────────────────────────────

export function computeInvalObligatoireMensuel(
  caisseRef: any,
  categorie: CategorieInvalidite,
  salaireBrutMensuel: number,
  revenuMensuelTNS: number
): number | null {
  if (isCaisseToFill(caisseRef)) return null;
  const inv = caisseRef.invalidite;
  if (!inv || inv.TO_FILL) return null;

  const cats = inv.categories ?? {};
  // 1) Schéma CPAM : cat1/cat2/cat3
  const direct = cats[categorie];
  if (direct) {
    const taux = safeNum(direct.taux) ?? safeNum(direct.tauxBase);
    if (taux === null) return null;
    let base = salaireBrutMensuel > 0 ? salaireBrutMensuel : revenuMensuelTNS;
    if (base <= 0) return null;
    // SAM plafonné au PASS (plafondSAM annuel → mensuel) si renseigné.
    const plafondSAM = safeNum(inv.plafondSAM);
    if (plafondSAM !== null) base = Math.min(base, plafondSAM / 12);
    let pension = base * taux;
    // cat3 : majoration tierce personne (prestation additionnelle, ne
    // pas inventer si non renseignée — cf. test H10).
    if (categorie === "cat3") {
      const mtp = safeNum(direct.majorationTiercePersonneMensuelle);
      if (mtp !== null) pension += mtp;
    }
    // Bornes mensuelles : plafond maxMensuel (fallback plafondMensuel —
    // ancien schéma), puis plancher minMensuel.
    const max = safeNum(direct.maxMensuel) ?? safeNum(direct.plafondMensuel);
    if (max !== null) pension = Math.min(pension, max);
    const min = safeNum(direct.minMensuel);
    if (min !== null) pension = Math.max(pension, min);
    return pension;
  }

  // 2) Schéma TNS / libéral : totale / partielle
  const mapTNS: Record<CategorieInvalidite, string[]> = {
    cat1: ["partielle_metier", "partielle"],
    cat2: ["totale_definitive", "totale"],
    cat3: ["totale_definitive", "totale"],
  };
  for (const key of mapTNS[categorie]) {
    const c = cats[key];
    if (c) {
      const taux = safeNum(c.tauxBase);
      if (taux === null) return null;
      const base = salaireBrutMensuel > 0 ? salaireBrutMensuel : revenuMensuelTNS;
      if (base <= 0) return null;
      return base * taux;
    }
  }
  return null;
}

function computeRenteInvalCollective(
  cov: CouvertureCollective | null,
  categorie: CategorieInvalidite,
  salaireBrutMensuel: number,
  pensionOblig: number
): number {
  if (!cov?.invalidite) return 0;
  const c = cov.invalidite[categorie];
  if (!c) return 0;
  const cible = salaireBrutMensuel * clampPct(c.pctSalaire);
  return Math.max(0, cible - pensionOblig);
}

function computeRenteInvalIndividuelle(
  contrats: ContratIndividuel[],
  baseMensuelle: number,
  revenuRef: number,
  dejaPercuMensuel: number
): EtageIndividuel {
  const montants: Array<{ montant: number; nature: NatureContrat }> = [];
  for (const c of contrats) {
    if (c.type !== "invalidite") continue;
    const base = clampPct(c.baseInvalidite ?? 0.5);
    montants.push({ montant: baseMensuelle * base, nature: c.nature ?? "indemnitaire" });
  }
  return repartirIndividuels(montants, revenuRef, dejaPercuMensuel);
}

// ────────────────────────────────────────────────────────────────────
// Ruptures clés
// ────────────────────────────────────────────────────────────────────

function sumAtIdx(s: SerieEmpilee, i: number): number {
  return (
    s.salaire[i] +
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i] +
    s.renteInvalEnfants[i]
  );
}

function detectRuptures(
  axe: AxePoint[],
  series: SerieEmpilee,
  basculeJour: number,
  maintien: MaintienParams,
  palier: Palier | null,
  isSalarie: boolean,
  donneesIndisponibles: boolean,
  tptRupture: { debut: number; fin: number; guerison: boolean } | null,
  jourRelaisCarmf: number | null,
  jourTrouCipav: number | null,
  jourRelaisCarpimko: number | null
): RuptureCle[] {
  const ruptures: RuptureCle[] = [];
  const joursAxe = new Set(axe.map((p) => p.jour));

  // Relais CPAM → CARMF à J91 (médecins libéraux).
  if (jourRelaisCarmf !== null && joursAxe.has(jourRelaisCarmf)) {
    const idx = axe.findIndex((p) => p.jour === jourRelaisCarmf);
    ruptures.push({
      jour: jourRelaisCarmf,
      libelle: "Relais CARMF (fin de l'indemnisation CPAM)",
      impactNet: idx > 0 ? sumAtIdx(series, idx) - sumAtIdx(series, idx - 1) : 0,
      type: "relais_carmf",
    });
  }

  // Trou de couverture CIPAV à J91 : fin des IJ libéraux, AUCUN relais.
  // La courbe IJ tombe à zéro et y reste jusqu'à l'invalidité (constat
  // pédagogique central CIPAV — bien plus marqué que la CARMF).
  if (jourTrouCipav !== null && joursAxe.has(jourTrouCipav)) {
    const idx = axe.findIndex((p) => p.jour === jourTrouCipav);
    ruptures.push({
      jour: jourTrouCipav,
      libelle: "Fin des IJ CPAM — trou de couverture CIPAV (aucun relais)",
      impactNet: idx > 0 ? sumAtIdx(series, idx) - sumAtIdx(series, idx - 1) : 0,
      type: "trou_cipav",
    });
  }

  // Relais CPAM → allocation journalière forfaitaire CARPIMKO à J91.
  if (jourRelaisCarpimko !== null && joursAxe.has(jourRelaisCarpimko)) {
    const idx = axe.findIndex((p) => p.jour === jourRelaisCarpimko);
    ruptures.push({
      jour: jourRelaisCarpimko,
      libelle: "Relais CARPIMKO (allocation journalière forfaitaire)",
      impactNet: idx > 0 ? sumAtIdx(series, idx) - sumAtIdx(series, idx - 1) : 0,
      type: "relais_carpimko",
    });
  }

  if (donneesIndisponibles) {
    ruptures.push({
      jour: 0,
      libelle: "Données régime obligatoire non disponibles, à compléter",
      impactNet: 0,
      type: "donnees_indisponibles",
    });
  }

  // Ruptures de maintien : les jours ont été insérés dans l'axe en amont
  // (cf. projeterArretMaladie). On ne crée la rupture que si le jour y
  // figure → garantit qu'aucune rupture n'est orpheline hors de l'axe.
  const { finPlein, finPartiel } = joursRupturesMaintien(maintien, palier, isSalarie);
  if (finPlein !== null && joursAxe.has(finPlein) && palier) {
    ruptures.push({
      jour: finPlein,
      libelle:
        palier.joursA100Pct !== undefined
          ? "Fin du maintien employeur à taux plein (100 %)"
          : "Fin du maintien employeur à 90 %",
      impactNet: 0,
      type: "fin_maintien_100",
    });
  }
  if (finPartiel !== null && joursAxe.has(finPartiel)) {
    ruptures.push({
      jour: finPartiel,
      libelle: "Fin du maintien employeur (66,66 %)",
      impactNet: 0,
      type: "fin_maintien_6666",
    });
  }

  // Ruptures du mi-temps thérapeutique (jours insérés dans l'axe en amont).
  if (tptRupture) {
    const idxDebut = axe.findIndex((p) => p.jour === tptRupture.debut);
    if (idxDebut > 0 && joursAxe.has(tptRupture.debut)) {
      ruptures.push({
        jour: tptRupture.debut,
        libelle: "Reprise en mi-temps thérapeutique",
        impactNet: sumAtIdx(series, idxDebut) - sumAtIdx(series, idxDebut - 1),
        type: "debut_tpt",
      });
    }
    const idxFin = axe.findIndex((p) => p.jour === tptRupture.fin);
    if (idxFin > 0 && joursAxe.has(tptRupture.fin)) {
      ruptures.push({
        jour: tptRupture.fin,
        libelle: tptRupture.guerison
          ? "Fin du mi-temps thérapeutique (guérison)"
          : "Fin du mi-temps thérapeutique (retour en arrêt total)",
        impactNet: sumAtIdx(series, idxFin) - sumAtIdx(series, idxFin - 1),
        type: "fin_tpt",
      });
    }
  }

  // Bascule invalidité — supprimée en cas de guérison (le risque s'arrête).
  if (!tptRupture?.guerison) {
    const idxBascule = axe.findIndex((p) => p.jour >= basculeJour);
    if (idxBascule > 0) {
      const avant = sumAtIdx(series, idxBascule - 1);
      const apres = sumAtIdx(series, idxBascule);
      ruptures.push({
        jour: basculeJour,
        libelle: "Reconnaissance de l'invalidité (passage AM → invalidité)",
        impactNet: apres - avant,
        type: "bascule_invalidite",
      });
    }
  }

  return ruptures.sort((a, b) => a.jour - b.jour);
}

// ────────────────────────────────────────────────────────────────────
// Signature publique
// ────────────────────────────────────────────────────────────────────

export function projeterArretMaladie(
  entree: EntreePerso,
  categorie: CategorieInvalidite = "cat2",
  ref: Referentiels,
  scenarioArret: ScenarioArret = "ald",
  tpt?: TptConfig
): ProjectionResult {
  const today = new Date();
  const finJour = Math.max(0, (entree.ageRetraite - entree.age) * 365);
  const maintien = getMaintienParams(entree.idccCCN, ref);
  const palier = findPalierMaintien(maintien.paliers, entree.ancienneteMois);
  const caisseRef = lookupCaisse(entree.caisse, ref);
  const isSalarie = isSalarieOuAssimile(entree.statutPro);
  const isTns = isTNS(entree.statutPro);

  // CARMF (médecins libéraux) : architecture 2 étages. IJ CPAM J4-J90
  // (bloc CPAM standard), relais CARMF J91-J1095, invalidité jusqu'au 62e
  // anniversaire. Activé par la présence du sous-objet `carmf`.
  const isCarmf = entree.carmf != null;
  const carmfRef = (ref as { carmf?: unknown }).carmf;
  const cpamRef = isCarmf ? lookupCaisse("CPAM", ref) : null;
  const J_RELAIS_CARMF = 91;
  const jourFinInvalCarmf = isCarmf ? jourFinInvaliditeCarmf(entree.age) : 0;

  // CIPAV (libéraux non réglementés) : architecture distincte. IJ libéraux
  // J4-J90 (barème dédié, cf. cipav.ts), TROU J91→1095 (aucun relais — la
  // courbe IJ tombe à 0), puis pension d'invalidité par points jusqu'au
  // cutoff (62 ans totale / 67 ans partielle). Activé par `entree.cipav`.
  const isCipav = entree.cipav != null;
  const cipavRef = (ref as { cipav?: unknown }).cipav;
  const J_TROU_CIPAV = 91;
  const jourFinInvalCipav = isCipav
    ? jourFinInvaliditeCipav(cipavRef, entree.age, entree.cipav!.tauxInvalidite)
    : 0;

  // CARPIMKO (auxiliaires médicaux) : architecture proche CARMF mais
  // FORFAITAIRE. IJ libéraux J4-J90, relais allocation journalière
  // forfaitaire J91→fin 3e année, puis rente d'invalidité forfaitaire (sans
  // borne d'âge → jusqu'à la fin de projection). Activé par `entree.carpimko`.
  const isCarpimko = entree.carpimko != null;
  const carpimkoRef = (ref as { carpimko?: unknown }).carpimko;
  const J_RELAIS_CARPIMKO = 91;

  // Mi-temps thérapeutique (SPEC_ALD_TPT §5). Le TPT n'a de sens qu'en
  // phase AM : finJour est borné à la bascule invalidité (1095) et le TPT
  // est ignoré si debutJour ≥ 1095 ou si l'intervalle est vide.
  const tptDebut = tpt?.actif ? Math.max(0, Math.round(tpt.debutJour)) : 0;
  const tptFin = tpt?.actif ? Math.min(Math.round(tpt.finJour), BASCULE_INVALIDITE) : 0;
  const tptActif = tpt?.actif === true && tptDebut < tptFin && tptDebut < BASCULE_INVALIDITE;
  const tptPct = tptActif ? Math.min(Math.max(tpt!.pctTempsTravaille, 0), 1) : 1;
  const tptGuerison = tptActif && tpt!.apresTpt === "guerison";

  // Construit l'axe puis y INSÈRE les jours « événements » de fin de
  // maintien (décision A9 : la rupture doit être un point de l'axe pour
  // que le graphique annote la marche d'escalier nette plutôt que
  // d'interpoler en biais). Les bornes du TPT (debut/fin) sont insérées
  // pour la même raison (marche nette à la reprise / fin du mi-temps).
  const { finPlein, finPartiel } = joursRupturesMaintien(maintien, palier, isSalarie);
  const joursEvenements = [
    finPlein,
    finPartiel,
    ...(tptActif ? [tptDebut, tptFin] : []),
    ...(isCarmf ? [J_RELAIS_CARMF, jourFinInvalCarmf] : []),
    ...(isCipav ? [J_TROU_CIPAV, jourFinInvalCipav] : []),
    ...(isCarpimko ? [J_RELAIS_CARPIMKO] : []),
  ].filter((j): j is number => j !== null);
  const axe = insertJoursAxe(buildAxe(entree, today), joursEvenements, today, finJour);

  const salaireBrutMensuel = entree.salaireBrutAnnuel / 12;
  // Revenu de référence TNS = bénéfice professionnel / 12. Le mapping
  // (buildEntreePerso) alimente revenuTNSAnnuel avec le BÉNÉFICE (assiette
  // IR : CA − charges), pas le CA brut. Distinct de l'assiette de
  // cotisation des caisses TNS qui sert au calcul des IJ versées.
  const revenuMensuelTNS = (entree.revenuTNSAnnuel ?? 0) / 12;
  const baseMensuelleInvalidite = isSalarie ? salaireBrutMensuel : revenuMensuelTNS;
  const plafondVars = buildPlafondVariables(ref);

  // Décision H7 : un TNS pur (tns_*, gérant majoritaire) n'a PAS accès
  // au contrat collectif de son entreprise (L.911-1 CSS — il n'est pas
  // salarié au sens social). Sa couverture passe par un contrat
  // individuel (Madelin). Le moteur ignore donc la couverture collective
  // saisie pour ces statuts. Les assimilés salariés (président SAS, EURL
  // unique) conservent l'accès (isSalarie=true pour eux).
  const couvertureCollectiveIgnoreeTNS = isTns && entree.couvertureCollective !== null;
  const couvertureEffective: CouvertureCollective | null = isTns
    ? null
    : entree.couvertureCollective;

  // Décision H11 : sur-couverture (pctSalaire ou baseInvalidite > 1)
  // détectée sur la couverture EFFECTIVE + les contrats individuels.
  // Le clamp est appliqué dans les fonctions de calcul ; ce flag sert
  // à lever un constat info.
  const surCouvertureBornee = detecteSurCouverture(couvertureEffective, entree.contratsIndividuels);

  // Constat de sur-couverture (SURCOUV §3). Levés pendant la boucle :
  //   - indemnitaireBornee : un contrat indemnitaire a vu sa prestation
  //     réduite (garantie sur-dimensionnée, fraction non indemnisée) ;
  //   - forfaitaire        : un contrat forfaitaire pousse le cumul d'un
  //     palier au-delà de 100 % du revenu de référence (sur-couverture réelle).
  let surCouvertureIndemnitaireBornee = false;
  let surCouvertureForfaitaire = false;
  const SEUIL_SURCOUVERTURE = 1.001; // tolérance d'arrondi ×30

  // Revenu de référence (manque à gagner, ligne pointillée).
  // Priorité à la valeur calculée en amont par le mapping
  // (buildEntreePerso : gère micro-TNS=CA, réel-TNS=bénéfice, salarié
  // brut prioritaire). Fallback interne pour les EntreePerso construits
  // à la main (tests/fuzzing) — Décision B : brut prioritaire, le net
  // saisi n'est jamais re-coefficienté.
  // ⚠️ NE PAS confondre avec l'IJ versée par la caisse (étage
  // ijObligatoire), calculée selon la formule propre de la caisse sur
  // SON assiette — ce sont deux grandeurs distinctes.
  const revenuReferenceMensuel =
    entree.revenuReferenceMensuel !== undefined
      ? entree.revenuReferenceMensuel
      : isSalarie
      ? salaireBrutMensuel > 0
        ? salaireBrutMensuel * coefBrutNet(entree.statutPro)
        : entree.salaireNetMensuel
      : revenuMensuelTNS;

  const series: SerieEmpilee = {
    salaire: axe.map(() => 0),
    maintienEmployeur: axe.map(() => 0),
    ijObligatoire: axe.map(() => 0),
    ijComplementaireCollective: axe.map(() => 0),
    ijComplementaireIndividuelle: axe.map(() => 0),
    pensionInvalObligatoire: axe.map(() => 0),
    renteInvalCollective: axe.map(() => 0),
    renteInvalIndividuelle: axe.map(() => 0),
    renteInvalEnfants: axe.map(() => 0),
  };

  // IJ obligatoire MENSUELLE au jour t. Pour un médecin CARMF : étage CPAM
  // jusqu'à J90, relais CARMF de J91 à J1095. Sinon, calcul générique de
  // la caisse du client. Retourne null si une donnée critique manque.
  const ijObligatoireMensuelAt = (t: number): number | null => {
    if (isCarmf) {
      if (t < J_RELAIS_CARMF) {
        return computeIJObligatoireMensuel(
          t, cpamRef, entree, revenuMensuelTNS, salaireBrutMensuel, plafondVars, scenarioArret
        );
      }
      return computeIjCarmfJournaliere(carmfRef, entree.carmf!, entree.age, t) * 30;
    }
    if (isCipav) {
      // Phase 1 IJ libéraux J4-J90 ; au-delà (J91+) : TROU, aucun relais.
      // ijCipavPhase1Journaliere renvoie déjà 0 hors fenêtre J4-J90.
      return ijCipavPhase1Journaliere(cipavRef, entree.cipav!, t) * 30;
    }
    if (isCarpimko) {
      // Phase 1 IJ libéraux J4-J90 (liée au revenu), puis relais allocation
      // journalière FORFAITAIRE J91→fin 3e année.
      if (t < J_RELAIS_CARPIMKO) {
        return ijCarpimkoPhase1Journaliere(carpimkoRef, entree.carpimko!, t) * 30;
      }
      return ijCarpimkoPhase2Journaliere(carpimkoRef, entree.carpimko!, t) * 30;
    }
    return computeIJObligatoireMensuel(
      t, caisseRef, entree, revenuMensuelTNS, salaireBrutMensuel, plafondVars, scenarioArret
    );
  };

  // Scénario ALD demandé sur une caisse documentée dépourvue de durée
  // ALD → on retombe sur 360 j et on signale la donnée manquante
  // (cohérent avec la tolérance TO_VERIFY). Aucune caisse documentée
  // actuelle (CPAM, SSI) n'est concernée : elles portent les deux durées.
  // CIPAV : la branche dédiée gère intégralement les durées (IJ libéraux
  // J4-J90 puis trou) ; le stub caisse générique n'est pas consulté, donc
  // son absence de durée ALD ne doit PAS lever de faux « données indisponibles ».
  let donneesIndisponibles =
    scenarioArret === "ald" &&
    !isCipav &&
    !isCarpimko &&
    !isCaisseToFill(caisseRef) &&
    caisseRef.ij?.TO_FILL !== true &&
    resolvePlafondDuree(caisseRef.ij, scenarioArret).aldManquant;

  for (let i = 0; i < axe.length; i++) {
    const t = axe[i].jour;

    // Phase « après TPT » en guérison : salaire plein, aucun autre étage,
    // pas de bascule invalidité — le risque s'arrête (SPEC §5.3).
    if (tptGuerison && t >= tptFin) {
      series.salaire[i] = revenuReferenceMensuel;
      continue;
    }

    // Phase 2 — mi-temps thérapeutique (debutJour ≤ t < finJour).
    if (tptActif && t >= tptDebut && t < tptFin) {
      const salairePartiel = revenuReferenceMensuel * tptPct;
      const perteSalaire = Math.max(0, revenuReferenceMensuel - salairePartiel);
      const ijPleineRaw = ijObligatoireMensuelAt(t);
      if (ijPleineRaw === null) donneesIndisponibles = true;
      // IJ TPT = min(IJ pleine plafonnée, perte de salaire), puis rabotée
      // pour que salaire partiel + IJ ne dépasse pas le revenu de référence.
      let ijTPT = Math.min(ijPleineRaw ?? 0, perteSalaire);
      if (salairePartiel + ijTPT > revenuReferenceMensuel) {
        ijTPT = Math.max(0, revenuReferenceMensuel - salairePartiel);
      }
      series.salaire[i] = salairePartiel;
      series.maintienEmployeur[i] = 0;
      series.ijObligatoire[i] = ijTPT;
      // Complémentaire : complète au-delà du salaire partiel + IJ TPT.
      series.ijComplementaireCollective[i] = computeIJCollective(
        t,
        couvertureEffective,
        salaireBrutMensuel,
        salairePartiel + ijTPT
      );
      // Individuel : bornage SURCOUV inchangé (déjà-perçu = salaire partiel
      // + IJ TPT + collective) → cumul plafonné au revenu de référence.
      const dejaPercuTpt =
        salairePartiel + ijTPT + series.ijComplementaireCollective[i];
      const etageTpt = computeIJIndividuelle(
        t,
        entree.contratsIndividuels,
        revenuReferenceMensuel,
        dejaPercuTpt
      );
      series.ijComplementaireIndividuelle[i] = etageTpt.total;
      if (etageTpt.bornee) surCouvertureIndemnitaireBornee = true;
      if (
        etageTpt.forfaitaire > 0 &&
        dejaPercuTpt + etageTpt.total > revenuReferenceMensuel * SEUIL_SURCOUVERTURE
      ) {
        surCouvertureForfaitaire = true;
      }
      continue;
    }

    if (t < BASCULE_INVALIDITE) {
      // Phase AM — arrêt total. Couvre la phase 1 (avant TPT) ET la phase 3
      // « retour arrêt total » après finJour : t étant le jour calendaire
      // d'un arrêt continu, le plafond de durée IJ (360/1095) intègre
      // automatiquement la durée déjà consommée (pas de remise à zéro).
      const ijObl = ijObligatoireMensuelAt(t);
      if (ijObl === null) {
        donneesIndisponibles = true;
        series.ijObligatoire[i] = 0;
      } else {
        series.ijObligatoire[i] = ijObl;
      }

      series.maintienEmployeur[i] = computeMaintienEmployeur(
        t,
        maintien,
        palier,
        revenuReferenceMensuel,
        isSalarie,
        series.ijObligatoire[i]
      );

      series.ijComplementaireCollective[i] = computeIJCollective(
        t,
        couvertureEffective,
        salaireBrutMensuel,
        series.maintienEmployeur[i] + series.ijObligatoire[i]
      );

      const dejaPercuIJ =
        series.maintienEmployeur[i] +
        series.ijObligatoire[i] +
        series.ijComplementaireCollective[i];
      const etageIJ = computeIJIndividuelle(
        t,
        entree.contratsIndividuels,
        revenuReferenceMensuel,
        dejaPercuIJ
      );
      series.ijComplementaireIndividuelle[i] = etageIJ.total;
      if (etageIJ.bornee) surCouvertureIndemnitaireBornee = true;
      // Salaire = 0 en arrêt → le cumul du palier est déjà-perçu + individuel.
      if (
        etageIJ.forfaitaire > 0 &&
        dejaPercuIJ + etageIJ.total > revenuReferenceMensuel * SEUIL_SURCOUVERTURE
      ) {
        surCouvertureForfaitaire = true;
      }
    } else {
      // Phase invalidité
      if (isCarmf) {
        // Pension CARMF (base + majorations) et rentes enfants (étage
        // distinct), versées jusqu'au trimestre suivant le 62e anniversaire.
        // Au-delà : étages à 0 (bascule retraite, hors périmètre projection).
        const nbEnf = entree.nbEnfantsACharge ?? 0;
        if (t < jourFinInvalCarmf) {
          series.pensionInvalObligatoire[i] =
            pensionInvaliditeTotaleAnnuelle(carmfRef, entree.carmf!, nbEnf) / 12;
          series.renteInvalEnfants[i] =
            renteEnfantsInvaliditeAnnuelle(carmfRef, entree.carmf!, nbEnf) / 12;
        }
      } else if (isCipav) {
        // Pension d'invalidité CIPAV (forfait + points), versée jusqu'au
        // cutoff (62 ans totale / 67 ans partielle). Au-delà : 0 (bascule
        // retraite, hors périmètre). Les rentes conjoint/enfant CIPAV sont
        // des prestations DÉCÈS (fonctions pures de cipav.ts), pas des
        // étages de la courbe invalidité → renteInvalEnfants reste 0.
        if (t < jourFinInvalCipav) {
          series.pensionInvalObligatoire[i] =
            pensionInvaliditeCipavAnnuelle(cipavRef, entree.cipav!) / 12;
        }
      } else if (isCarpimko) {
        // Rente d'invalidité CARPIMKO forfaitaire par palier (base, hors
        // majorations TO_VERIFY). Aucune borne d'âge documentée → versée
        // jusqu'à la fin de projection. Rentes décès = fonctions pures hors
        // courbe (renteInvalEnfants reste 0).
        series.pensionInvalObligatoire[i] =
          renteInvaliditeCarpimkoAnnuelle(carpimkoRef, entree.carpimko!) / 12;
      } else {
        const inv = computeInvalObligatoireMensuel(
          caisseRef,
          categorie,
          salaireBrutMensuel,
          revenuMensuelTNS
        );
        if (inv === null) {
          donneesIndisponibles = true;
          series.pensionInvalObligatoire[i] = 0;
        } else {
          series.pensionInvalObligatoire[i] = inv;
        }
      }

      series.renteInvalCollective[i] = computeRenteInvalCollective(
        couvertureEffective,
        categorie,
        salaireBrutMensuel,
        series.pensionInvalObligatoire[i]
      );

      const dejaPercuInval =
        series.pensionInvalObligatoire[i] +
        series.renteInvalCollective[i] +
        series.renteInvalEnfants[i];
      const etageInval = computeRenteInvalIndividuelle(
        entree.contratsIndividuels,
        baseMensuelleInvalidite,
        revenuReferenceMensuel,
        dejaPercuInval
      );
      series.renteInvalIndividuelle[i] = etageInval.total;
      if (etageInval.bornee) surCouvertureIndemnitaireBornee = true;
      if (
        etageInval.forfaitaire > 0 &&
        dejaPercuInval + etageInval.total > revenuReferenceMensuel * SEUIL_SURCOUVERTURE
      ) {
        surCouvertureForfaitaire = true;
      }
    }
  }

  const rupturesCles = detectRuptures(
    axe,
    series,
    BASCULE_INVALIDITE,
    maintien,
    palier,
    isSalarie,
    donneesIndisponibles,
    tptActif ? { debut: tptDebut, fin: tptFin, guerison: tptGuerison } : null,
    isCarmf ? J_RELAIS_CARMF : null,
    isCipav ? J_TROU_CIPAV : null,
    isCarpimko ? J_RELAIS_CARPIMKO : null
  );

  const useLegalDefault =
    maintien.source === "legal" && !!entree.idccCCN && entree.idccCCN.length > 0;

  // Garde-fou : aucune valeur NaN/undefined ne doit sortir.
  for (const key of Object.keys(series) as Array<keyof SerieEmpilee>) {
    for (let i = 0; i < series[key].length; i++) {
      const v = series[key][i];
      if (!Number.isFinite(v)) series[key][i] = 0;
    }
  }

  void isTns; // marqueur futur — sera utilisé par le moteur de règles (Lot 6)

  return {
    axe,
    series,
    revenuReferenceMensuel,
    rupturesCles,
    basculeInvaliditeJour: BASCULE_INVALIDITE,
    finProjectionJour: finJour,
    categorieInvaliditeProjetee: categorie,
    useLegalDefault,
    donneesCaisseIndisponibles: donneesIndisponibles,
    revenuReferenceMicroTNS: entree.revenuReferenceMicroTNS === true,
    surCouvertureBornee,
    surCouvertureIndemnitaireBornee,
    surCouvertureForfaitaire,
    couvertureCollectiveIgnoreeTNS,
    scenarioArret,
  };
}
