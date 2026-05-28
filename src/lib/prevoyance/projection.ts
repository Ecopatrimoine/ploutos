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
  SerieEmpilee,
} from "./types";
import type { Referentiels } from "../../data/prevoyance";
import type { StatutPro } from "../../types/patrimoine";
import {
  buildPlafondVariables,
  evalFormulaPlafond,
  type PlafondVariables,
} from "./formula";
import { coefBrutNet } from "./constants";

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

function computeIJObligatoireMensuel(
  t: number,
  caisseRef: any,
  entree: EntreePerso,
  revenuMensuelTNS: number,
  salaireBrutMensuel: number,
  vars: PlafondVariables
): number | null {
  // CONVENTION ×30 : les IJ sont stockées/calculées en valeur
  // JOURNALIÈRE, converties en mensuel pour l'AFFICHAGE par × 30
  // (« mois-type 30 jours »), convention de lisibilité distincte du
  // calcul réglementaire en jours calendaires. Les tests d'exactitude
  // juridique (famille G/T4) porteront sur la valeur journalière (avant
  // × 30) — à exposer via un helper si besoin (cf. ROADMAP).
  if (isCaisseToFill(caisseRef)) return null;
  const ij = caisseRef.ij;
  if (ij?.TO_FILL) return null;

  const carence = safeNum(ij.carenceJours);
  if (carence === null) return null;
  if (t < carence) return 0;

  const plafondDuree = safeNum(ij.plafondDureeJours);
  if (plafondDuree !== null && t > plafondDuree) return 0;

  // 1) Règle uniforme par classe (CARMF…)
  if (ij.regle === "uniforme_par_classe" && ij.classes) {
    const classe = entree.classeCotisationCaisse ?? null;
    const cl = classe ? ij.classes[classe] : null;
    const ijj = safeNum(cl?.ijJournaliere);
    if (ijj === null) return null;
    return ijj * 30;
  }

  // 2) Règle uniforme (CARPIMKO…)
  if (ij.regle === "uniforme") {
    const ijj = safeNum(ij.ijJournaliere);
    if (ijj === null) return null;
    return ijj * 30;
  }

  // 3) Règle tranche revenu (CPAM, SSI, CIPAV)
  const taux = safeNum(ij.tauxBrut) ?? safeNum(ij.tauxIJ);
  if (taux === null) return null;

  // Revenu journalier de base — approximation : salaire brut/360 (jours
  // calendaires) ou revenu TNS/360. Affinage possible Lot 4.1 via la
  // règle CPAM 91,25 jours documentée dans pass-2026.json.
  const baseAnnuelle = entree.salaireBrutAnnuel > 0
    ? entree.salaireBrutAnnuel
    : (entree.revenuTNSAnnuel ?? 0);
  if (baseAnnuelle <= 0) {
    // pas de revenu connu, on ne peut pas calculer
    return null;
  }
  const revenuJournalier = baseAnnuelle / 360;
  let ijj = revenuJournalier * taux;

  // Plafond journalier : formule paramétrique en priorité (qui suit
  // les revalorisations du SMIC/PASS via les variables), puis valeur
  // figée plafondJournalier si la formule absente ou échoue.
  let plafondJ: number | null = null;
  if (typeof ij.plafondFormule === "string") {
    plafondJ = evalFormulaPlafond(ij.plafondFormule, vars);
  }
  if (plafondJ === null) plafondJ = safeNum(ij.plafondJournalier);
  if (plafondJ !== null) ijj = Math.min(ijj, plafondJ);

  // Majoration CPAM : 3 enfants à charge, à partir de J31
  const maj = ij.majorationFamilleApresJ31;
  if (maj?.active && t >= 31 && (entree.nbEnfantsACharge ?? 0) >= 3) {
    const tauxMaj = safeNum(maj.tauxMajore);
    if (tauxMaj !== null) {
      const ijjMaj = revenuJournalier * tauxMaj;
      const ijjBornee = plafondJ !== null ? Math.min(ijjMaj, plafondJ) : ijjMaj;
      ijj = Math.max(ijj, ijjBornee);
    }
  }

  // Note : `salaireBrutMensuel` et `revenuMensuelTNS` sont reçus pour
  // future amélioration (calcul par tranche de revenu). Pour cette
  // version, on reste sur la formule journalière simple.
  void salaireBrutMensuel;
  void revenuMensuelTNS;

  return ijj * 30;
}

// ────────────────────────────────────────────────────────────────────
// IJ complémentaire collective et individuelle
// ────────────────────────────────────────────────────────────────────

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
  const cible = salaireBrutMensuel * cov.ij.pctSalaire;
  return Math.max(0, cible - dejaCouvertMensuel);
}

function computeIJIndividuelle(t: number, contrats: ContratIndividuel[]): number {
  let total = 0;
  for (const c of contrats) {
    if (c.type !== "ij") continue;
    const franchise = c.franchiseJours ?? 0;
    if (t < franchise) continue;
    if (c.plafondJoursIJ !== undefined && t > franchise + c.plafondJoursIJ) continue;
    // capitalOuMontant = IJ journalière complémentaire
    total += c.capitalOuMontant * 30;
  }
  return total;
}

// ────────────────────────────────────────────────────────────────────
// Phase invalidité (≥ J1095)
// ────────────────────────────────────────────────────────────────────

function computeInvalObligatoireMensuel(
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
    const taux = safeNum(direct.tauxBase);
    if (taux === null) return null;
    const base = salaireBrutMensuel > 0 ? salaireBrutMensuel : revenuMensuelTNS;
    if (base <= 0) return null;
    let pension = base * taux;
    if (categorie === "cat3") {
      const mtp = safeNum(direct.majorationTiercePersonneMensuelle);
      if (mtp !== null) pension += mtp;
    }
    const pl = safeNum(direct.plafondMensuel);
    if (pl !== null) pension = Math.min(pension, pl);
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
  const cible = salaireBrutMensuel * c.pctSalaire;
  return Math.max(0, cible - pensionOblig);
}

function computeRenteInvalIndividuelle(
  contrats: ContratIndividuel[],
  baseMensuelle: number
): number {
  let total = 0;
  for (const c of contrats) {
    if (c.type !== "invalidite") continue;
    const base = c.baseInvalidite ?? 0.5;
    total += baseMensuelle * base;
  }
  return total;
}

// ────────────────────────────────────────────────────────────────────
// Ruptures clés
// ────────────────────────────────────────────────────────────────────

function sumAtIdx(s: SerieEmpilee, i: number): number {
  return (
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i]
  );
}

function detectRuptures(
  axe: AxePoint[],
  series: SerieEmpilee,
  basculeJour: number,
  maintien: MaintienParams,
  palier: Palier | null,
  isSalarie: boolean,
  donneesIndisponibles: boolean
): RuptureCle[] {
  const ruptures: RuptureCle[] = [];
  const joursAxe = new Set(axe.map((p) => p.jour));

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

  return ruptures.sort((a, b) => a.jour - b.jour);
}

// ────────────────────────────────────────────────────────────────────
// Signature publique
// ────────────────────────────────────────────────────────────────────

export function projeterArretMaladie(
  entree: EntreePerso,
  categorie: CategorieInvalidite = "cat2",
  ref: Referentiels
): ProjectionResult {
  const today = new Date();
  const finJour = Math.max(0, (entree.ageRetraite - entree.age) * 365);
  const maintien = getMaintienParams(entree.idccCCN, ref);
  const palier = findPalierMaintien(maintien.paliers, entree.ancienneteMois);
  const caisseRef = lookupCaisse(entree.caisse, ref);
  const isSalarie = isSalarieOuAssimile(entree.statutPro);
  const isTns = isTNS(entree.statutPro);

  // Construit l'axe puis y INSÈRE les jours « événements » de fin de
  // maintien (décision A9 : la rupture doit être un point de l'axe pour
  // que le graphique annote la marche d'escalier nette plutôt que
  // d'interpoler en biais).
  const { finPlein, finPartiel } = joursRupturesMaintien(maintien, palier, isSalarie);
  const joursEvenements = [finPlein, finPartiel].filter((j): j is number => j !== null);
  const axe = insertJoursAxe(buildAxe(entree, today), joursEvenements, today, finJour);

  const salaireBrutMensuel = entree.salaireBrutAnnuel / 12;
  // Revenu de référence TNS = bénéfice professionnel / 12. Le mapping
  // (buildEntreePerso) alimente revenuTNSAnnuel avec le BÉNÉFICE (assiette
  // IR : CA − charges), pas le CA brut. Distinct de l'assiette de
  // cotisation des caisses TNS qui sert au calcul des IJ versées.
  const revenuMensuelTNS = (entree.revenuTNSAnnuel ?? 0) / 12;
  const baseMensuelleInvalidite = isSalarie ? salaireBrutMensuel : revenuMensuelTNS;
  const plafondVars = buildPlafondVariables(ref);

  // Revenu de référence (manque à gagner, ligne pointillée) :
  //  - salarié / assimilé : net mensuel saisi, sinon brut × coef(statut)
  //  - TNS : bénéfice mensuel (revenuMensuelTNS), SANS coefficient
  // ⚠️ NE PAS confondre avec l'IJ versée par la caisse (étage
  // ijObligatoire), calculée selon la formule propre de la caisse sur
  // SON assiette — ce sont deux grandeurs distinctes.
  const revenuReferenceMensuel =
    entree.salaireNetMensuel > 0
      ? entree.salaireNetMensuel
      : isSalarie
      ? salaireBrutMensuel * coefBrutNet(entree.statutPro)
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
  };

  let donneesIndisponibles = false;

  for (let i = 0; i < axe.length; i++) {
    const t = axe[i].jour;

    if (t < BASCULE_INVALIDITE) {
      // Phase AM
      const ijObl = computeIJObligatoireMensuel(
        t,
        caisseRef,
        entree,
        revenuMensuelTNS,
        salaireBrutMensuel,
        plafondVars
      );
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
        entree.couvertureCollective,
        salaireBrutMensuel,
        series.maintienEmployeur[i] + series.ijObligatoire[i]
      );

      series.ijComplementaireIndividuelle[i] = computeIJIndividuelle(
        t,
        entree.contratsIndividuels
      );
    } else {
      // Phase invalidité
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

      series.renteInvalCollective[i] = computeRenteInvalCollective(
        entree.couvertureCollective,
        categorie,
        salaireBrutMensuel,
        series.pensionInvalObligatoire[i]
      );

      series.renteInvalIndividuelle[i] = computeRenteInvalIndividuelle(
        entree.contratsIndividuels,
        baseMensuelleInvalidite
      );
    }
  }

  const rupturesCles = detectRuptures(
    axe,
    series,
    BASCULE_INVALIDITE,
    maintien,
    palier,
    isSalarie,
    donneesIndisponibles
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
  };
}
