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
import { resolveCouvertureBranche } from "./couverture-branche";
import { categorieBranche } from "./categorie-branche";

// Paliers temporels phase AM (J0 → J1095).
const PALIERS_AM = [0, 3, 7, 14, 30, 60, 90, 120, 180, 365, 547, 730, 912, 1095];
const BASCULE_INVALIDITE = 1095;
// Âge légal de bascule invalidité → retraite (inaptitude) : la pension
// d'invalidité cesse à 62 ans, remplacée par la pension de retraite (hors
// périmètre de cette projection de revenus de remplacement). Règle d'âge
// LÉGALE commune à TOUTES les caisses — régime général ET libérales,
// CARPIMKO incluse (« rente d'invalidité incompatible avec la retraite »,
// carpimko.com). Distincte des cutoffs caisse-spécifiques (ex. CIPAV
// partielle 67 ans) : ce garde-fou s'y SUPERPOSE, il ne les remplace pas.
const AGE_BASCULE_RETRAITE = 62;

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

export function safeNum(v: unknown): number | null {
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

// Catégorie de maintien employeur conventionnel : aiguille vers le sous-bloc
// maintienEmployeur.cadres ou .nonCadres d'une CCN (LOT 1a-ii). Fonction TOTALE
// (ne jette jamais) : tout statut non listé retombe sur "nonCadres" — défaut
// prudent, et de toute façon les non-salariés sont filtrés en amont par
// isSalarie (le maintien n'est pas calculé pour eux).
//
// Choix d'aiguillage des assimilés salariés : president_sas et eurl_unique sont
// traités comme salariés par isSalarieOuAssimile ; faute de raison contraire
// dans le code, ils sont routés vers "cadres" par défaut (statut cadre usuel du
// dirigeant assimilé). fonctionnaire → "nonCadres" (hors CCN privée).
export function categorieMaintien(statutPro: StatutPro | ""): "cadres" | "nonCadres" {
  switch (statutPro) {
    case "salarie_cadre":
    case "president_sas":
    case "eurl_unique":
      return "cadres";
    default:
      return "nonCadres";
  }
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

// Segment de maintien à taux libre. `pct` est un POURCENTAGE (0..100) ; le
// taux réellement appliqué au salaire vaut pct / 100. Les segments d'un palier
// se suivent dans l'ordre : le 1er couvre [carence, carence + jours0), le 2e
// la fenêtre suivante, etc. Généralise l'ancien couple plein/66,66 % (LOT 1a-i).
type SegmentMaintien = { jours: number; pct: number };
type Palier = {
  ancienneteMois: number;
  segments: SegmentMaintien[];
};

type MaintienParams = {
  carenceJours: number;
  paliers: Palier[];
  source: "ccn" | "legal" | "indisponible";
};

// Garde-fou commun (LOT 1a-i) : un palier n'est retenu que s'il porte ≥ 1
// segment et que TOUS ses segments sont bien formés — jours fini ≥ 0 et pct
// dans [0, 100]. Un pct > 100 invalide le palier (on ne sur-indemnise JAMAIS) ;
// si tous les paliers tombent, le moteur bascule sur le fallback légal — même
// comportement qu'un ancien palier TO_VERIFY.
function paliersValides(paliers: Palier[]): Palier[] {
  return paliers.filter(
    (p) =>
      p.segments.length > 0 &&
      p.segments.every(
        (s) =>
          Number.isFinite(s.jours) &&
          s.jours >= 0 &&
          Number.isFinite(s.pct) &&
          s.pct >= 0 &&
          s.pct <= 100
      )
  );
}

// Lecture défensive d'un tableau de paliers de maintien CCN
// (conventions[idcc].maintienEmployeur.paliers) — données VOLONTAIREMENT
// polymorphes tant que les CCN ne sont pas remplies (TO_VERIFY / TO_FILL).
// Renvoie des paliers candidats, non encore filtrés par paliersValides.
function lirePaliersCcn(paliersBruts: unknown): Palier[] {
  if (!Array.isArray(paliersBruts)) return [];
  const out: Palier[] = [];
  for (const p of paliersBruts) {
    const anciennete = safeNum(p?.ancienneteMois);
    const segs = p?.segments;
    if (anciennete === null || !Array.isArray(segs)) continue;
    const segments: SegmentMaintien[] = [];
    for (const s of segs) {
      const jours = safeNum(s?.jours);
      const pct = safeNum(s?.pct);
      if (jours === null || pct === null) continue;
      segments.push({ jours, pct });
    }
    if (segments.length > 0) out.push({ ancienneteMois: anciennete, segments });
  }
  return out;
}

// Lit le maintien LÉGAL Mensualisation (toujours disponible, indépendant de la
// catégorie et de toute CCN). Bloc TYPÉ via l'import JSON (plus de `any`) : tout
// renommage de maintienLegal / paliers / segments / jours / pct casse à la
// COMPILATION. Sert à la fois de FALLBACK (CCN absente) et de PLANCHER permanent
// (LOT 1a-iii : le maintien réel = max(CCN, légal) jour par jour).
function lireMaintienLegal(ref: Referentiels): MaintienParams {
  const legal = ref.ccn.maintienLegal;
  const paliersLegal = paliersValides(
    legal.paliers.map((p) => ({
      ancienneteMois: p.ancienneteMois,
      segments: p.segments.map((s) => ({ jours: s.jours, pct: s.pct })),
    }))
  );
  if (paliersLegal.length > 0) {
    return {
      carenceJours: safeNum(legal.carenceJours) ?? 7,
      paliers: paliersLegal,
      source: "legal",
    };
  }
  return { carenceJours: 7, paliers: [], source: "indisponible" };
}

export function getMaintienParams(
  idcc: string | null,
  ref: Referentiels,
  categorie: "cadres" | "nonCadres"
): MaintienParams {
  // Bloc CCN : données polymorphes (TO_VERIFY / TO_FILL / null) → lecture
  // défensive. Depuis LOT 1a-ii, maintienEmployeur est différencié par
  // catégorie : { cadres: <bloc|null>, nonCadres: <bloc|null> }. On lit le
  // sous-bloc de la catégorie demandée ; s'il est null / absent / sans palier
  // valide, on retombe sur le maintien légal (useLegalDefault repasse à true).
  if (idcc) {
    const conventions = ref.ccn.conventions as Record<
      string,
      {
        maintienEmployeur?: {
          cadres?: { carenceJours?: unknown; paliers?: unknown } | null;
          nonCadres?: { carenceJours?: unknown; paliers?: unknown } | null;
        };
      } | undefined
    >;
    const m = conventions?.[idcc]?.maintienEmployeur?.[categorie];
    const paliers = paliersValides(lirePaliersCcn(m?.paliers));
    const carence = safeNum(m?.carenceJours);
    if (carence !== null && paliers.length > 0) {
      return { carenceJours: carence, paliers, source: "ccn" };
    }
  }
  // Pas de CCN documentée pour cette catégorie → maintien légal. La sémantique
  // source/useLegalDefault est INCHANGÉE (le plancher légal de 1a-iii est un
  // détail de calcul appliqué en aval, pas un changement de source).
  return lireMaintienLegal(ref);
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

// Marche DESCENDANTE de la courbe de maintien EFFECTIVE max(CCN, légal).
type MarcheMaintien = { jour: number; tauxAvant: number; tauxApres: number };

// Formate un taux (0..1) en pourcentage lisible, virgule française : entier si
// proche d'un entier (90, 80, 100), sinon 2 décimales tronquées (66,66 pour
// 2/3). Purement cosmétique (libellés de rupture) — aucun test n'en dépend.
function formatPctMaintien(taux: number): string {
  const pct = taux * 100;
  const arrondi = Math.round(pct);
  const val = Math.abs(pct - arrondi) < 1e-6 ? arrondi : Math.trunc(pct * 100) / 100;
  return String(val).replace(".", ",");
}

// Marches descendantes de la courbe de maintien EFFECTIVE max(CCN, légal)
// (LOT 1b). Énumère les jours-frontières des DEUX sources (carence + fins de
// segments cumulées), évalue le taux effectif de part et d'autre, et renvoie
// chaque BAISSE de taux { jour, tauxAvant, tauxApres }. Réutilisé par
// detectRuptures (libellés) ET par l'insertion des marches dans l'axe — la
// logique du max() n'est PAS dupliquée (tauxMaintienEffectif).
//
// Réduction au cas légal (aucune CCN) : les frontières sont celles du seul
// palier légal → on retrouve EXACTEMENT les 2 marches d'avant (fin du plein,
// puis fin du maintien). La dernière marche (tauxApres === 0) marque la fin
// RÉELLE de la courbe → jamais de fin prématurée quand le légal relaie la CCN.
function marchesMaintienEffectif(
  sources: ReadonlyArray<SourceMaintien>,
  isSalarie: boolean
): MarcheMaintien[] {
  if (!isSalarie) return [];
  const frontieres = new Set<number>();
  for (const { m, palier } of sources) {
    if (!palier || palier.segments.length === 0) continue;
    let cumul = m.carenceJours;
    frontieres.add(cumul);
    for (const seg of palier.segments) {
      cumul += seg.jours;
      frontieres.add(cumul);
    }
  }
  const jours = [...frontieres].filter((j) => j >= 0).sort((a, b) => a - b);
  const marches: MarcheMaintien[] = [];
  for (const j of jours) {
    // Courbe constante par morceaux : on échantillonne juste avant (j-1) et à
    // partir de la frontière (j). On ne retient que les BAISSES.
    const tauxAvant = tauxMaintienEffectif(sources, j - 1);
    const tauxApres = tauxMaintienEffectif(sources, j);
    if (tauxApres < tauxAvant - 1e-9) {
      marches.push({ jour: j, tauxAvant, tauxApres });
    }
  }
  return marches;
}

// Taux de maintien (0..1) applicable au jour t pour UN jeu (params, palier) :
// pct / 100 du segment couvrant t (cf. LOT 1a-i), ou 0 hors carence / hors
// fenêtre des segments.
function tauxMaintienJour(m: MaintienParams, palier: Palier | null, t: number): number {
  if (!palier || t < m.carenceJours) return 0;
  const tEffectif = t - m.carenceJours;
  let debutSegment = 0;
  for (const seg of palier.segments) {
    if (tEffectif < debutSegment + seg.jours) return seg.pct / 100;
    debutSegment += seg.jours;
  }
  return 0;
}

// Une source de maintien = un jeu (paramètres, palier applicable). Le moteur en
// fournit deux : la CCN (si documentée) et le légal Mensualisation (plancher).
type SourceMaintien = { m: MaintienParams; palier: Palier | null };

// Taux de maintien EFFECTIF (0..1) au jour t = le plus favorable parmi les
// sources (CCN + légal). Brique COMMUNE à la VALEUR (computeMaintienEmployeur)
// et aux RUPTURES/axe (marchesMaintienEffectif) — la logique du max() n'existe
// qu'ici, pas en double.
function tauxMaintienEffectif(sources: ReadonlyArray<SourceMaintien>, t: number): number {
  let taux = 0;
  for (const src of sources) {
    const tx = tauxMaintienJour(src.m, src.palier, t);
    if (tx > taux) taux = tx;
  }
  return taux;
}

// PLANCHER LÉGAL (LOT 1a-iii). Le maintien réel applique, à CHAQUE jour, le taux
// le PLUS FAVORABLE parmi les sources fournies (CCN et légal Mensualisation) :
// taux = max(taux_ccn(t), taux_legal(t)). Fondement : la Mensualisation
// (L.1226-1 C. trav.) est d'ordre public social — une CCN peut faire mieux,
// jamais moins ; le salarié bénéficie du plus favorable poste par poste. D'où :
//   - la CCN gagne tôt (taux plus élevé), le légal gagne tard (durée plus longue) ;
//   - dans la fenêtre légale mais hors fenêtre CCN, le maintien ne tombe PAS à 0.
// Comme tout taux ≤ 1 (pct ≤ 100), cible ≤ revenu de référence : le bornage
// anti-sur-indemnisation (max(0, cible − IJ)) reste appliqué après le max().
function computeMaintienEmployeur(
  t: number,
  sources: ReadonlyArray<SourceMaintien>,
  salaireMensuelCible: number,
  isSalarie: boolean,
  ijObligMensuel: number
): number {
  if (!isSalarie) return 0;
  const taux = tauxMaintienEffectif(sources, t);
  if (taux <= 0) return 0;
  const cible = salaireMensuelCible * taux;
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

  // 2bis) Règle paliers temporels (MSA exploitant AMEXA) : IJ forfaitaire dont
  // le montant change selon le jour d'arrêt t. Tableau ij.paliers ordonné :
  // [{ jusquaJour, montant }, ...]. On retourne le montant du PREMIER palier dont
  // (jusquaJour === null OU t <= jusquaJour). Indépendant du revenu (court-circuite
  // avant le calcul baseAnnuelle). Carence et plafond de durée déjà appliqués en amont.
  // Ex. MSA : 26 €/j du J4 au J28, 34,66 €/j à partir du J29.
  if (ij.regle === "paliers_temporels") {
    const paliers = Array.isArray(ij.paliers) ? ij.paliers : [];
    for (const p of paliers) {
      const jusqua = p?.jusquaJour;
      if (jusqua === null || jusqua === undefined || t <= jusqua) {
        return safeNum(p?.montant);
      }
    }
    return null; // aucun palier ne matche (donnée incohérente) -> trou visible, pas un faux montant
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
// Moteur FORFAITAIRE générique (CNBF, CARCDSF, CAVEC…)
//
// Caisses dont les prestations (IJ, invalidité, capital décès) sont
// déclarées EN DATA (caisseRef.moteur === "forfaitaire") plutôt que par
// une branche de code dédiée. Le moteur lit le `discriminant`, résout la
// clé pertinente (ancienneté / sous-profession / classe), puis applique
// les montants déclarés. Aucune logique par caisse en dur.
// Cf. SPEC_PREVOYANCE_CAISSES_FORFAITAIRES §3-4.
// ────────────────────────────────────────────────────────────────────

// Résout la clé de discriminant pour une caisse forfaitaire donnée.
// Retourne une chaîne (clé) ou null si la donnée nécessaire manque.
//   - "aucun"       → clé fixe "default" (montant uniforme, clé ignorée).
//   - "anciennete"  → premier seuil dont (maxMois === null || ancienneteMois
//                     < maxMois). < seuil (ex. < 240 mois → "moins20").
//   - "profession"  → entree.forfait?.sousProfession ?? null.
//   - "classe"      → classe forcée (forfait.classeOption) sinon dérivée du
//                     revenu via grilleRevenuClasse (1re ligne où revenu
//                     <= revenuMax, ou dernière ligne si revenuMax null).
export function resolveDiscriminant(caisseRef: any, entree: EntreePerso): string | null {
  const disc = caisseRef?.discriminant;
  if (!disc) return "default";
  const type = disc.type;
  if (type === "aucun") return "default";
  if (type === "anciennete") {
    const seuils = Array.isArray(disc.seuils) ? disc.seuils : [];
    const anc = safeNum(entree.ancienneteMois) ?? 0;
    for (const s of seuils) {
      const maxMois = safeNum(s?.maxMois);
      if (maxMois === null || anc < maxMois) return s?.cle ?? null;
    }
    return null;
  }
  if (type === "profession") {
    return entree.forfait?.sousProfession ?? null;
  }
  if (type === "classe") {
    const forced = entree.forfait?.classeOption;
    if (forced != null && forced !== "") return String(forced);
    // Défaut déclaré en DATA (ex. CAVOM classeParDefaut "C") : résolu À LA
    // LECTURE, sans jamais muter l'entrée. CAVEC n'a pas de classeParDefaut →
    // saute cette étape et retombe sur la grille revenu ci-dessous.
    const parDefaut = caisseRef?.classeParDefaut;
    if (parDefaut != null && String(parDefaut) !== "") return String(parDefaut);
    const grille = Array.isArray(disc.grilleRevenuClasse) ? disc.grilleRevenuClasse : [];
    const revenu = safeNum(entree.revenuTNSAnnuel) ?? 0;
    for (const row of grille) {
      const revenuMax = safeNum(row?.revenuMax);
      if (revenuMax === null || revenu <= revenuMax) return row?.classe != null ? String(row.classe) : null;
    }
    return grille.length > 0 ? String(grille[grille.length - 1].classe) : null;
  }
  return null;
}

// Résout une structure "montant" pour une clé donnée. Retourne null si non
// documenté (valeurs[clé] absent/null → "pas de montant", pas une erreur ;
// cf. CNBF plus20).
//   - {mode:"uniforme",valeur}                       → valeur fixe.
//   - {mode:"parDiscriminant",valeurs:{...}}          → valeurs[clé].
//   - {mode:"pourcentageRevenu",taux,plafond?,plancher?}
//        → taux × min(assiette, plafond), plancher optionnel (ex. CAVAMAC :
//          25 % des commissions brutes plafonnées). `taux` exprimé EN FRACTION
//          dans le JSON (0.25 = 25 %). assiette absente/0 → 0 (helper).
// Le param `assiette` est OPTIONNEL et rétro-compatible : un appel à deux
// arguments (modes uniforme/parDiscriminant) se comporte exactement comme avant
// — ces deux modes n'utilisent jamais l'assiette. (Pas de `vars` : le plafond
// est une valeur en euros littérale dans le JSON, aucun plafond paramétrique
// PASS requis pour CAVAMAC.)
export function resolveMontant(m: any, cle: string | null, assiette?: number | null): number | null {
  if (!m) return null;
  if (m.mode === "uniforme") return safeNum(m.valeur);
  if (m.mode === "parDiscriminant") {
    if (cle === null) return null;
    return safeNum(m.valeurs?.[cle]);
  }
  if (m.mode === "pourcentageRevenu") {
    const taux = safeNum(m.taux);
    if (taux === null) return null; // taux non documenté → pas un montant
    return tauxAppliquePlafonne(assiette, taux, safeNum(m.plafond), safeNum(m.plancher));
  }
  return null;
}

// IJ JOURNALIÈRE forfaitaire au jour t.
//   t < carenceJours          → phase1 (cpam → délégué ; externe/aucune → 0).
//   carence <= t < plafond     → montantJournalier résolu via discriminant.
//   t >= plafondDureeJours      → 0 (l'invalidité prend le relais).
function ijForfaitaireJournaliere(
  caisseRef: any,
  entree: EntreePerso,
  vars: PlafondVariables,
  scenarioArret: ScenarioArret,
  refCpam: any,
  t: number
): number {
  const ij = caisseRef?.ij;
  if (!ij) return 0;
  const carence = safeNum(ij.carenceJours) ?? 0;
  const plafond = safeNum(ij.plafondDureeJours);
  if (t < carence) {
    const phase1 = ij.phase1;
    if (phase1?.type === "cpam") {
      // Délègue au calcul CPAM libéraux existant (RAAM/730 ou SJB) via la
      // caisse CPAM générique, sur l'assiette de l'entrée.
      const j = computeIJObligatoireJournaliere(t, refCpam, entree, vars, scenarioArret);
      return j ?? 0;
    }
    // externe (LPA/AON) ou aucune → rien côté caisse (note = lot 3).
    return 0;
  }
  if (plafond !== null && t >= plafond) return 0;
  const cle = resolveDiscriminant(caisseRef, entree);
  const montant = resolveMontant(ij.montantJournalier, cle);
  return montant ?? 0;
}

// Pension d'INVALIDITÉ MENSUELLE forfaitaire (SPEC §4.4).
//   taux = entree.forfait?.tauxInvalidite ?? 0
//   borneAgeMax atteinte → 0 ; taux < seuil → 0
//   base = montantAnnuel100 résolu via discriminant ; null → 0 (PAS de flag
//   données indisponibles : cas CNBF plus20 intentionnel).
//   binaire → base ; proportionnel → base * taux/100
//   trancheCavamac → tranche partielle 33-65 % au facteur 3/2, plein ≥ 66 %
//   + majorationEnfantAnnuelle (si résolue != null) * nbEnfantsACharge
//   retour pension / 12.
export function forfaitaireInvalMensuel(caisseRef: any, entree: EntreePerso): number {
  const inv = caisseRef?.invalidite;
  if (!inv) return 0;
  const taux = safeNum(entree.forfait?.tauxInvalidite) ?? 0;
  const borneAgeMax = safeNum(inv.borneAgeMax);
  if (borneAgeMax !== null && entree.age >= borneAgeMax) return 0;
  const seuil = safeNum(inv.seuilTauxMinimal) ?? 0;
  if (taux < seuil) return 0;
  const cle = resolveDiscriminant(caisseRef, entree);
  // Assiette des modes "pourcentageRevenu" = commissions brutes saisies (champ
  // dédié, PAS de fallback sur revenuTNSAnnuel dans ce lot). Absente → assiette
  // undefined → pourcentageRevenu rend 0 (trou visible, pas faux silencieux).
  // Ignorée par uniforme / parDiscriminant (CAVOM, CAVEC, CNBF, CARCDSF).
  const assiette = entree.forfait?.commissionsBrutes;
  const base = resolveMontant(inv.montantAnnuel100, cle, assiette);
  if (base === null) return 0; // pas de montant (CNBF plus20) — pas un trou

  // Mode CARPV : double palier d'invalidité par classe.
  //   taux < seuilPartiel        -> 0 (invalidité non couverte sous 66 %)
  //   seuilPartiel <= taux < seuilTotal -> rente palier 66 % de la classe
  //   taux >= seuilTotal         -> rente palier 100 % de la classe
  //   Deux tables parDiscriminant distinctes (montantAnnuel66 / montantAnnuel100).
  //   Seuils lus depuis la donnée (fallback 66/100). NE PAS déclarer
  //   seuilTauxMinimal sur cette caisse (le plancher de taux est porté ici).
  //   Borne d'âge : évaluée plus haut (ligne 558) sur l'âge figé, comme CAVEC/CRN.
  if (inv.modeTaux === "doublePalierCarpv") {
    const seuilPartiel = safeNum(inv.seuilPartiel) ?? 66;
    const seuilTotal = safeNum(inv.seuilTotal) ?? 100;
    if (taux < seuilPartiel) return 0;
    const cleP = resolveDiscriminant(caisseRef, entree);
    const annuel =
      taux >= seuilTotal
        ? resolveMontant(inv.montantAnnuel100, cleP, assiette)
        : resolveMontant(inv.montantAnnuel66, cleP, assiette);
    return (annuel ?? 0) / 12;
  }

  // Mode CAVAMAC : barème par tranche distinct de binaire/proportionnel.
  //   `base` est la pension TOTALE (mode pourcentageRevenu : déjà PLANCHÉE par
  //   tauxAppliquePlafonne — lot A/B). La réduction partielle s'applique APRÈS
  //   le plancher (ordre métier : plancher dans la totale, puis × 1,5 × n).
  //   taux < seuilPartiel → 0 ; seuilPartiel ≤ taux < seuilPlein → totale × 1,5 × n/100 ;
  //   taux ≥ seuilPlein → totale pleine.
  //   Seuils lus depuis la donnée (inv.seuilPartiel / inv.seuilPlein) avec
  //   fallback barème CAVAMAC 33/66. NE réutilise PAS seuilTauxMinimal (qui, pour
  //   cette caisse, doit rester absent/≤ seuilPartiel — le plancher de taux est
  //   porté ici). Pas de majoration enfant (CAVAMAC n'en a pas sur l'invalidité).
  if (inv.modeTaux === "trancheCavamac") {
    const seuilPartiel = safeNum(inv.seuilPartiel) ?? 33;
    const seuilPlein = safeNum(inv.seuilPlein) ?? 66;
    let annuel: number;
    if (taux < seuilPartiel) annuel = 0;
    else if (taux < seuilPlein) annuel = base * 1.5 * (taux / 100);
    else annuel = base;
    return annuel / 12;
  }

  let pension = inv.modeTaux === "proportionnel" ? base * (taux / 100) : base;
  const maj = resolveMontant(inv.majorationEnfantAnnuelle, cle, assiette);
  if (maj !== null) pension += maj * (safeNum(entree.nbEnfantsACharge) ?? 0);
  return pension / 12;
}

// Capital décès forfaitaire (SPEC §4.5). Donnée de référence : N'alimente PAS
// les 9 séries de projection (revenus de remplacement). Exposé pour les tests
// et le futur module succession. Retourne null si non documenté.
export function forfaitaireCapitalDeces(caisseRef: any, entree: EntreePerso): number | null {
  const cap = caisseRef?.capitalDeces;
  if (!cap) return null;
  const cle = resolveDiscriminant(caisseRef, entree);
  // cf. forfaitaireInvalMensuel : assiette = commissions brutes (mode
  // pourcentageRevenu), ignorée par uniforme / parDiscriminant.
  const assiette = entree.forfait?.commissionsBrutes;

  // Capital 25/50 selon la situation familiale (ex. CAVAMAC). Activé
  // UNIQUEMENT en mode pourcentageRevenu AVEC tauxMajoreFamille déclaré : taux
  // majoré si conjoint/PACS (entree.marie) OU enfant à charge, sinon tauxBase.
  // Les caisses en uniforme/parDiscriminant (CAVOM, capital fixe) ou en
  // pourcentageRevenu SANS tauxMajoreFamille gardent le comportement historique
  // (resolveMontant) — aucun effet de marie/nbEnfants. Le plancher s'applique
  // sur le résultat final, au taux choisi (porté par tauxAppliquePlafonne).
  if (cap.mode === "pourcentageRevenu" && cap.tauxMajoreFamille != null) {
    const aAyantsDroit =
      entree.marie === true || (safeNum(entree.nbEnfantsACharge) ?? 0) > 0;
    const tauxChoisi = aAyantsDroit ? safeNum(cap.tauxMajoreFamille) : safeNum(cap.tauxBase);
    if (tauxChoisi === null) return null; // taux non documenté → pas un montant
    return tauxAppliquePlafonne(assiette, tauxChoisi, safeNum(cap.plafond), safeNum(cap.plancher));
  }

  return resolveMontant(cap, cle, assiette);
}

// ────────────────────────────────────────────────────────────────────
// IJ complémentaire collective et individuelle
// ────────────────────────────────────────────────────────────────────

// Montant = taux appliqué à une assiette plafonnée, avec plancher optionnel.
// taux en fraction (0.25 = 25 %). plafond/plancher en euros annuels.
// assiette en euros annuels. Helper PUR réutilisable par les caisses dont la
// prestation est « pct × min(revenu, plafond) » (ex. à venir : CAVAMAC).
// Le plancher ne s'applique que si assiette > 0 — un dossier sans assiette ne
// doit pas afficher faussement le plancher.
export function tauxAppliquePlafonne(
  assiette: number | null | undefined,
  taux: number,
  plafond?: number | null,
  plancher?: number | null
): number {
  const a = safeNum(assiette) ?? 0;
  const base = (plafond != null) ? Math.min(a, plafond) : a;
  let montant = base * taux;
  if (plancher != null && montant < plancher && a > 0) montant = plancher;
  return montant;
}

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

// `assietteMensuelle` = REVENU DE RÉFÉRENCE (LOT BRUT-NET-i) : la cible de
// remplacement est un % du revenu de référence (même assiette que le maintien
// et que la ligne « 100 % » du graphe), et NON du salaire brut. Évite la
// sur-indemnisation à ~107 % (0,80 brut / 0,75 net) ; le total se plafonne
// naturellement à 100 % du revenu de référence.
// LOT BTP-3 — majoration par enfant à charge : fraction supplémentaire de
// l'assiette = nbEnfants × majorationParEnfantPct. Lecture défensive : pct non
// numérique ou négatif → 0 (champ ignoré, la garantie principale reste servie) ;
// nbEnfants non fini → 0.
function majorationParEnfant(majorationParEnfantPct: number | undefined, nbEnfantsACharge: number): number {
  if (typeof majorationParEnfantPct !== "number" || !Number.isFinite(majorationParEnfantPct) || majorationParEnfantPct < 0) {
    return 0;
  }
  const n = Number.isFinite(nbEnfantsACharge) ? Math.max(0, Math.floor(nbEnfantsACharge)) : 0;
  return n * majorationParEnfantPct;
}

// LOT BTP-3bis — majoration FORFAITAIRE d'invalidité : fraction UNIQUE ajoutée
// (une seule fois) dès qu'il y a AU MOINS un enfant à charge — PAS multipliée par
// le nombre d'enfants. Sémantique parallèle à majorationParEnfant (même unité,
// même point d'ajout). Lecture défensive : pct non numérique / négatif → 0.
function majorationSiAuMoinsUnEnfant(majorationSiAuMoinsUnEnfantPct: number | undefined, nbEnfantsACharge: number): number {
  if (typeof majorationSiAuMoinsUnEnfantPct !== "number" || !Number.isFinite(majorationSiAuMoinsUnEnfantPct) || majorationSiAuMoinsUnEnfantPct < 0) {
    return 0;
  }
  const n = Number.isFinite(nbEnfantsACharge) ? Math.max(0, Math.floor(nbEnfantsACharge)) : 0;
  return n >= 1 ? majorationSiAuMoinsUnEnfantPct : 0;
}

// LOT ASSUR-0 — taux d'IJ au jour t pour une garantie à PALIERS temporels :
// pctSalaire du segment [deJour, aJour) (half-open, borne haute exclusive) qui
// contient t, ou null si t tombe hors de tout segment (avant le 1er deJour ou
// au-delà du dernier aJour → plus de complément). Segments validés en amont par
// le résolveur (ordonnés, contigus, fractions ]0,1]).
function tauxPalierIJ(
  paliers: ReadonlyArray<{ deJour: number; aJour: number; pctSalaire: number }>,
  t: number
): number | null {
  for (const seg of paliers) {
    if (t >= seg.deJour && t < seg.aJour) return seg.pctSalaire;
  }
  return null;
}

export function computeIJCollective(
  t: number,
  cov: CouvertureCollective | null,
  assietteMensuelle: number,
  dejaCouvertMensuel: number,
  nbEnfantsACharge: number = 0
): number {
  if (!cov?.ij) return 0;
  const f = cov.ij.franchise;
  if (t < f) return 0; // franchise commune (inchangée)
  // Taux applicable au jour t. LOT ASSUR-0 : si `paliers` est présent, le taux
  // vient du segment temporel courant (et la fenêtre est bornée par le dernier
  // aJour) ; sinon comportement historique mono-taux borné par [f, f + plafond].
  let taux: number;
  if (cov.ij.paliers && cov.ij.paliers.length > 0) {
    const tp = tauxPalierIJ(cov.ij.paliers, t);
    if (tp === null) return 0; // hors de tout palier → plus de complément
    taux = tp;
  } else {
    if (t > f + cov.ij.plafondJours) return 0;
    taux = cov.ij.pctSalaire;
  }
  // Majoration par enfant à charge (LOT BTP-3) sur la MÊME assiette que le
  // principal (revenuReference) — approximation conservatrice, cohérente avec le
  // gap d'assiette IJ déjà documenté. Champ absent/invalide → 0.
  const majo = majorationParEnfant(cov.ij.majorationParEnfantPct, nbEnfantsACharge);
  const cible = assietteMensuelle * (clampPct(taux) + majo);
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

// `assietteRevenuRef` = REVENU DE RÉFÉRENCE (LOT BRUT-NET-i) : assiette historique
// du % d'invalidité (la cible ne dépasse plus 100 % du revenu de référence).
// LOT BTP-2 — deux sémantiques portées par le bloc invalidité de branche :
//   mode "cibleInclSecu" (défaut, absent) : la rente complète jusqu'à la cible,
//     sous déduction de la pension Secu → max(0, assiette × pct − pensionOblig) ;
//   mode "additif" : la prestation (assiette × pct) est versée EN PLUS de la
//     pension Secu, SANS déduction (ouvriers BTP, RNPO : +X % du brut au-dessus
//     de la pension de base).
// `base` choisit l'assiette : "revenuReference" (défaut) ou "brut" = la MÊME
// assiette mensuelle que la pension Secu (salaireBrutMensuel, cf. l'appelant) →
// cohérence d'assiette obligatoire pour l'additif.
// Le bornage H11 (100 % du revenu de référence) s'applique EN AVAL et reste
// INCHANGÉ : l'additif y passe comme les autres séries (l'étage individuel comble
// la marge restante jusqu'à 100 % du revenu de référence). H11 (≈ 78 % du brut,
// via le coef brut→net) est PLUS restrictif que le plafond de cumul réel BTP
// (85 % du brut) → approximation conservatrice ; le plafond 85 % est un gap
// documenté du chantier BTP (différé).
export function computeRenteInvalCollective(
  cov: CouvertureCollective | null,
  categorie: CategorieInvalidite,
  assietteRevenuRef: number,
  pensionOblig: number,
  salaireBrutMensuel: number,
  nbEnfantsACharge: number = 0
): number {
  if (!cov?.invalidite) return 0;
  const inv = cov.invalidite;
  const c = inv[categorie];
  if (!c) return 0;
  const assiette = inv.base === "brut" ? salaireBrutMensuel : assietteRevenuRef;
  // Majorations PROPRES à la catégorie, sur la MÊME assiette que le principal
  // (revenuReference en cible, brut en additif si base=brut) : par enfant (LOT
  // BTP-3, linéaire) ET forfait "si au moins un enfant" (LOT BTP-3bis, unique).
  // Cumulables ; champ absent/invalide → 0.
  const pct =
    clampPct(c.pctSalaire) +
    majorationParEnfant(c.majorationParEnfantPct, nbEnfantsACharge) +
    majorationSiAuMoinsUnEnfant(c.majorationSiAuMoinsUnEnfantPct, nbEnfantsACharge);
  const prestation = assiette * pct;
  // Additif : versé EN PLUS de la pension (aucune déduction).
  if (inv.mode === "additif") return prestation;
  // Cible (défaut) : complément jusqu'à la cible, déduction faite de la Secu.
  return Math.max(0, prestation - pensionOblig);
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
  sourcesMaintien: ReadonlyArray<SourceMaintien>,
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

  // Ruptures de maintien : marches DESCENDANTES de la courbe EFFECTIVE
  // max(CCN, légal) (LOT 1b). Les jours de marche ont été insérés dans l'axe en
  // amont (cf. projeterArretMaladie) ; on ne crée la rupture que si le jour y
  // figure → aucune rupture orpheline. Une marche vers 0 (tauxApres === 0)
  // marque la FIN réelle du maintien → jamais de fin prématurée quand le légal
  // relaie la CCN.
  for (const marche of marchesMaintienEffectif(sourcesMaintien, isSalarie)) {
    if (!joursAxe.has(marche.jour)) continue;
    const finDuMaintien = marche.tauxApres <= 0;
    ruptures.push({
      jour: marche.jour,
      libelle: finDuMaintien
        ? `Fin du maintien employeur (${formatPctMaintien(marche.tauxAvant)} %)`
        : marche.tauxAvant >= 1
          ? "Fin du maintien employeur à taux plein (100 %)"
          : `Fin du maintien employeur à ${formatPctMaintien(marche.tauxAvant)} %`,
      impactNet: 0,
      type: finDuMaintien ? "fin_maintien_6666" : "fin_maintien_100",
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
  // Jour (depuis J0) de bascule invalidité → retraite à 62 ans : au-delà, les
  // 3 étages d'invalidité tombent à 0 (cf. garde-fou en aval de la boucle).
  // Pré-calcul hors boucle, clampé à 0 si la personne a déjà ≥ 62 ans à J0.
  const jourBasculeRetraite = Math.max(0, (AGE_BASCULE_RETRAITE - entree.age) * 365);
  const maintien = getMaintienParams(
    entree.idccCCN,
    ref,
    categorieMaintien(entree.statutPro)
  );
  const palier = findPalierMaintien(maintien.paliers, entree.ancienneteMois);
  // Plancher légal (LOT 1a-iii) : le maintien réel = max(CCN, légal) jour par
  // jour. On lit aussi le maintien LÉGAL (toujours disponible) et on l'ajoute
  // comme source de plancher permanent. Si `maintien` est déjà le légal (aucune
  // CCN), les deux sources coïncident → max(légal, légal) = légal → iso.
  const maintienLegal = lireMaintienLegal(ref);
  const palierLegal = findPalierMaintien(maintienLegal.paliers, entree.ancienneteMois);
  const sourcesMaintien = [
    { m: maintien, palier },
    { m: maintienLegal, palier: palierLegal },
  ];
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

  // Caisses FORFAITAIRES (CNBF, CARCDSF, CAVEC…) : moteur générique piloté par
  // la DONNÉE (caisseRef.moteur === "forfaitaire"), pas un isXxx en dur. IJ
  // forfaitaire J91→1095 (phase 1 CPAM ou externe selon le JSON), puis pension
  // d'invalidité forfaitaire. Capital décès stocké hors courbe (succession).
  const isForfaitaire = caisseRef?.moteur === "forfaitaire";
  const cpamRefForfait = isForfaitaire ? lookupCaisse("CPAM", ref) : null;

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
  const joursEvenements = [
    ...marchesMaintienEffectif(sourcesMaintien, isSalarie).map((mar) => mar.jour),
    ...(tptActif ? [tptDebut, tptFin] : []),
    ...(isCarmf ? [J_RELAIS_CARMF, jourFinInvalCarmf] : []),
    ...(isCipav ? [J_TROU_CIPAV, jourFinInvalCipav] : []),
    ...(isCarpimko ? [J_RELAIS_CARPIMKO] : []),
  ].filter((j): j is number => j !== null);
  const axe = insertJoursAxe(buildAxe(entree, today), joursEvenements, today, finJour);

  const salaireBrutMensuel = entree.salaireBrutAnnuel / 12;
  const nbEnfantsACharge = entree.nbEnfantsACharge ?? 0; // LOT BTP-3 — majorations IJ / invalidité de branche
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
  // Couverture EFFECTIVE consommée par les étages collectifs. Priorité ABSOLUE à
  // la saisie manuelle (le contrat réel du client fait foi). À DÉFAUT de saisie
  // (=== null), pour un salarié/assimilé porteur d'un IDCC documenté, on injecte
  // les minima conventionnels de branche (LOT IJ-INV-ii) : objet au format
  // CouvertureCollective fabriqué par resolveCouvertureBranche. Exclusion TNS H7
  // INCHANGÉE (un TNS reste à null, même avec IDCC). On ne fait QUE fabriquer
  // l'objet cov : clampPct, le complément (cible − déjàPerçu) et le bornage H11
  // s'appliquent ensuite à l'identique, sans condition sur l'origine.
  let couvertureEffective: CouvertureCollective | null = isTns
    ? null
    : entree.couvertureCollective;
  let couvertureIssueDeLaCcn = false;
  if (!isTns && entree.couvertureCollective === null && entree.idccCCN) {
    const branche = resolveCouvertureBranche(
      entree.idccCCN,
      categorieBranche(entree.idccCCN, entree.statutPro, ref),
      ref
    );
    if (!branche.donneeIndisponible) {
      couvertureEffective = { ij: branche.ij, invalidite: branche.invalidite };
      couvertureIssueDeLaCcn = true;
    }
  }

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
    if (isForfaitaire) {
      // IJ forfaitaire journalière (phase 1 déléguée à la CPAM si type cpam,
      // sinon 0 côté caisse), convertie en mensuel d'affichage (×30).
      return ijForfaitaireJournaliere(
        caisseRef, entree, plafondVars, scenarioArret, cpamRefForfait, t
      ) * 30;
    }
    return computeIJObligatoireMensuel(
      t, caisseRef, entree, revenuMensuelTNS, salaireBrutMensuel, plafondVars, scenarioArret
    );
  };

  // Scénario ALD demandé sur une caisse documentée dépourvue de durée
  // ALD → on retombe sur 360 j et on signale la donnée manquante
  // (cohérent avec la tolérance TO_VERIFY). Aucune caisse documentée
  // actuelle (CPAM, SSI) n'est concernée : elles portent les deux durées.
  // CARMF / CIPAV / CARPIMKO : leur branche dédiée gère intégralement les
  // durées ; le stub caisse générique (TO_VERIFY, sans durée ALD) n'est PAS
  // consulté, donc son absence de durée ALD ne doit PAS lever de faux
  // « données indisponibles ».
  let donneesIndisponibles =
    scenarioArret === "ald" &&
    !isCarmf &&
    !isCipav &&
    !isCarpimko &&
    !isForfaitaire &&
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
        revenuReferenceMensuel,
        salairePartiel + ijTPT,
        nbEnfantsACharge
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
        sourcesMaintien,
        revenuReferenceMensuel,
        isSalarie,
        series.ijObligatoire[i]
      );

      series.ijComplementaireCollective[i] = computeIJCollective(
        t,
        couvertureEffective,
        revenuReferenceMensuel,
        series.maintienEmployeur[i] + series.ijObligatoire[i],
        nbEnfantsACharge
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
      } else if (isForfaitaire) {
        // Pension d'invalidité forfaitaire (binaire ou proportionnelle au taux),
        // bornée par l'âge déclaré dans le JSON. Aucun flag « données
        // indisponibles » pour les caisses forfaitaires : une base null (CNBF
        // anciennete >= 20 ans) est une absence intentionnelle, pas un trou.
        series.pensionInvalObligatoire[i] = forfaitaireInvalMensuel(caisseRef, entree);
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
        revenuReferenceMensuel,
        series.pensionInvalObligatoire[i],
        salaireBrutMensuel,
        nbEnfantsACharge
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

      // Coupure invalidité → retraite : DEUX seuils distincts (en aval des 3
      // écritures, pour s'appliquer à toutes les branches sans effet de cascade).
      //
      // 1) PENSION OBLIGATOIRE : coupée à max(62, cutoff de la caisse). Les
      //    branches CIPAV/CARMF zéroïsent DÉJÀ leur pension à leur propre cutoff
      //    (jourFinInvalCipav = 62 totale / 67 partielle ; jourFinInvalCarmf = 62) ;
      //    le `max` garantit que ce garde-fou ne re-coupe JAMAIS avant elles —
      //    la pension CIPAV partielle court donc bien jusqu'à 67. Hors CIPAV/CARMF,
      //    ces deux variables valent 0 → le seuil retombe sur 62 pour les caisses
      //    sans cutoff propre (CPAM/SSI/MSA génériques, forfaitaires, CARPIMKO).
      const jourCoupurePension = Math.max(jourBasculeRetraite, jourFinInvalCarmf, jourFinInvalCipav);
      if (t >= jourCoupurePension) {
        series.pensionInvalObligatoire[i] = 0;
      }
      // 2) COMPLÉMENTS (collective + Madelin individuelle) : coupés à 62 STRICT
      //    pour TOUTES les caisses (bascule retraite, règle générale). Les termes
      //    Madelin varient par contrat → hypothèse PRUDENTE assumée (les compléments
      //    suivent la bascule légale à 62), TO_VERIFY si besoin d'affiner par contrat.
      //    renteInvalEnfants non touchée (seule CARMF la produit, déjà coupée à 62).
      if (t >= jourBasculeRetraite) {
        series.renteInvalCollective[i] = 0;
        series.renteInvalIndividuelle[i] = 0;
      }
    }
  }

  const rupturesCles = detectRuptures(
    axe,
    series,
    BASCULE_INVALIDITE,
    sourcesMaintien,
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
    couvertureIssueDeLaCcn,
    scenarioArret,
  };
}
