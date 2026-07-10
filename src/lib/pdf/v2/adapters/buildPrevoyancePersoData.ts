// ─── Lot 9 — Adapter Prévoyance personnelle v2 (module Prévoyance) ──────
//
// Adapter PUR : à partir du payload Ploutos + de la personne ciblée,
// construit l'EntreePerso (mapping), l'enrichit des saisies UI
// (data.prevoyance.{p1|p2}), projette, évalue les règles, et produit
// le PrevoyancePersoPageData consommé par pagePrevoyancePerso.

import type { PrevoyancePersoPageData, PrevoyancePersoJalon } from "../pages/pagePrevoyancePerso";
import type {
  CategorieInvalidite,
  ContratIndividuel,
  CouvertureCollective,
  EntreePerso,
  ProjectionResult,
  ScenarioArret,
} from "../../../prevoyance/types";
import { buildEntreePerso } from "../../../prevoyance/mapping";
import { projeterArretMaladie } from "../../../prevoyance/projection";
import { buildContexteRegle } from "../../../prevoyance/contexte";
import { evaluerToutesLesRegles } from "../../../prevoyance/regles";
import { WARNING_MICRO_TNS } from "../../../prevoyance/constants";
import { referentiels } from "../../../../data/prevoyance";
import { mentionDDAPrevoyance } from "../textesLegaux";
import { formatDureeArret, plur, euro } from "../../../calculs/utils";
import { libelleStatut } from "../../../presentation/statutsPrevoyance";
import { compositionAtIdx, bornesPalier } from "../../../presentation/prevoyancePerso";
import { labelExact } from "../../../presentation/echelleTemps";
import { ticksPdf } from "../prevoyanceChart";

export type BuildPrevoyancePersoDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  which: "p1" | "p2";
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

const LIBELLE_CAISSE: Record<string, string> = {
  CPAM: "CPAM (régime général)",
  SSI: "SSI (indépendants)",
  MSA: "MSA (agricole)",
  CARMF: "CARMF (médecins)",
  CARCDSF: "CARCDSF (dentistes / sages-femmes)",
  CARPV: "CARPV (vétérinaires)",
  CARPIMKO: "CARPIMKO (paramédicaux)",
  CIPAV: "CIPAV (libéraux non réglementés)",
  CNBF: "CNBF (avocats)",
  CAVOM: "CAVOM (officiers ministériels)",
  CAVEC: "CAVEC (experts-comptables)",
  CAVAMAC: "CAVAMAC (agents d'assurance)",
  CRN: "CRN (notaires)",
};

function euroMois(v: number): string {
  return `${euro(v)}/mois`;
}

function totalAtIdx(s: ProjectionResult["series"], i: number): number {
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

// Jalons du tableau « Points clés » = EXACTEMENT les ruptures marquées sur le graphe.
// SOURCE UNIQUE : ticksPdf(projection) — la fonction que le graphe (renderProjectionSVG)
// consomme lui-même — filtrée sur niveau 1 (chaque rupture de la frise : tout étage change
// de valeur), PLUS J0 (état initial, carence). Fini le gabarit fixe [0,7,30,90,180,365,1095]
// qui masquait les VRAIES ruptures et affichait des horizons génériques : David J30 (IJ
// Madelin après franchise 30 j) et Erika J37/J67 (maintien légal 90→66→0) n'apparaissaient
// pas. Le tableau montre désormais les mêmes points que le graphe, ligne pour ligne.
function joursJalonsTable(projection: ProjectionResult): number[] {
  const ruptures = ticksPdf(projection)
    .filter((tk) => tk.niveau === 1)
    .map((tk) => tk.jour)
    .filter((j) => j > 0);
  return [0, ...ruptures];
}

export function buildJalons(projection: ProjectionResult): PrevoyancePersoJalon[] {
  const ref = projection.revenuReferenceMensuel;
  return joursJalonsTable(projection).map((j) => {
    const idx = projection.axe.findIndex((p) => p.jour === j);
    if (idx < 0) return null;
    const total = totalAtIdx(projection.series, idx);
    const pct = ref > 0 ? Math.round((total / ref) * 100) : 0;
    return {
      // labelExact = l'ÉTIQUETTE DU TICK DU GRAPHE (« J30 », « J37 », « 3 ans » à la bascule
      // invalidité) : jour exact sous 61 j, jamais arrondi au mois. Cohérence table↔graphe.
      libelle: labelExact(j),
      revenu: euro(total),
      pct: `${pct} %`,
      detail: compositionAtIdx(projection.series, idx, j),
    };
  }).filter(Boolean) as PrevoyancePersoJalon[];
}

function redigerNotreLecture(projection: ProjectionResult, personneLibelle: string): string {
  const ref = projection.revenuReferenceMensuel;
  const idxInval = projection.axe.findIndex((p) => p.jour >= 1095);
  const totalInval = idxInval >= 0 ? totalAtIdx(projection.series, idxInval) : 0;
  const pctInval = ref > 0 ? Math.round((totalInval / ref) * 100) : 0;

  // A3 — on décrit le PALIER de couverture autour de 6 mois d'arrêt (segment plat de la frise
  // contenant J180), pas un point isolé : bornes via bornesPalier() (lib de présentation).
  const palier = bornesPalier(projection, 180);
  const idxJ180 = projection.axe.findIndex((p) => p.jour === 180);
  const totalPalier = palier
    ? palier.total
    : idxJ180 >= 0
      ? totalAtIdx(projection.series, idxJ180)
      : 0;
  const pctPalier = ref > 0 ? Math.round((totalPalier / ref) * 100) : 0;

  const phrases: string[] = [];
  phrases.push(
    `La projection couvre la perte de revenus de ${personneLibelle} en cas d'arrêt de travail prolongé, ` +
    `du premier jour (carence) jusqu'à la reconnaissance d'invalidité (3 ans), puis jusqu'à l'âge légal de retraite.`
  );
  if (ref > 0) {
    const span =
      palier && palier.endJour > palier.startJour
        ? ` (palier de ${formatDureeArret(palier.startJour)} à ${formatDureeArret(palier.endJour)} d'arrêt)`
        : "";
    phrases.push(
      `Autour de 6 mois d'arrêt, le revenu de remplacement estimé représente environ ${pctPalier} % ` +
      `du revenu de référence${span} ; en cas d'invalidité reconnue, environ ${pctInval} %.`
    );
    if (pctInval < 70 || pctPalier < 70) {
      phrases.push(
        `Un écart sensible apparaît entre le revenu habituel et le revenu de remplacement : ` +
        `c'est précisément le besoin de couverture complémentaire à étudier.`
      );
    }
  }
  if (projection.donneesCaisseIndisponibles) {
    phrases.push(
      `Certaines données du régime obligatoire ne sont pas encore documentées dans le référentiel : ` +
      `les étages correspondants peuvent être sous-estimés et seront affinés ultérieurement.`
    );
  }
  return phrases.join(" ");
}

export function buildPrevoyancePersoData(p: BuildPrevoyancePersoDataParams): PrevoyancePersoPageData {
  const { data, cabinet, which } = p;
  const dateStr = p.dateLettre || formatDateFr(new Date());
  const clientName =
    p.clientName ||
    [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") ||
    "Client";

  const prenom =
    which === "p1"
      ? [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ")
      : [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const personneLibelle = prenom || (which === "p1" ? "Personne 1" : "Personne 2");

  const cabinetNom = cabinet.cabinetName || cabinet.nom || "Cabinet";
  const orias = cabinet.orias || "—";
  const mentionDDA = mentionDDAPrevoyance(cabinetNom, orias);
  const cabinetLibellePied = `${cabinetNom} · Prévoyance personnelle — confidentiel`;

  // Construction de l'entrée moteur.
  const entreeBase = buildEntreePerso(data as any, which);
  if (!entreeBase) {
    return {
      disponible: false,
      clientName,
      personneLibelle,
      dateStr,
      statutLibelle: "—",
      caisseLibelle: "—",
      ccnLibelle: null,
      revenuReference: "—",
      ageInfo: "",
      projection: null,
      jalons: [],
      constats: [],
      notreLecture: "",
      mentionDDA,
      warningMicroTNS: null,
      pagePosition: p.pagePosition || "— / —",
      cabinetLibellePied,
    };
  }

  // Enrichissement avec les saisies UI (data.prevoyance.{p1|p2}).
  const prevoyancePerso = data.prevoyance?.[which] ?? null;
  const categorie: CategorieInvalidite = prevoyancePerso?.categorieInvaliditeProjetee ?? "cat2";
  const scenarioArret: ScenarioArret = prevoyancePerso?.scenarioArret ?? "ald";
  const entree: EntreePerso = {
    ...entreeBase,
    contratsIndividuels: (prevoyancePerso?.contratsIndividuels ?? []) as ContratIndividuel[],
    couvertureCollective: (prevoyancePerso?.couvertureCollective ?? null) as CouvertureCollective | null,
  };

  const projection = projeterArretMaladie(entree, categorie, referentiels, scenarioArret, prevoyancePerso?.tpt);
  const ctx = buildContexteRegle(data as any, entree, projection, which);
  const constats = evaluerToutesLesRegles(ctx, which);

  const anneesAnciennete = Math.floor(entree.ancienneteMois / 12);
  const ageInfo =
    `${entree.age} ans · retraite à ${entree.ageRetraite} ans · ancienneté ${plur(anneesAnciennete, "an")}`;

  return {
    disponible: true,
    clientName,
    personneLibelle,
    dateStr,
    statutLibelle: libelleStatut(entree.statutPro),
    caisseLibelle: entree.caisse ? (LIBELLE_CAISSE[entree.caisse] ?? entree.caisse) : "—",
    ccnLibelle: entree.idccCCN ? `IDCC ${entree.idccCCN}` : null,
    revenuReference: euroMois(projection.revenuReferenceMensuel),
    ageInfo,
    projection,
    jalons: buildJalons(projection),
    constats,
    notreLecture: redigerNotreLecture(projection, personneLibelle),
    mentionDDA,
    warningMicroTNS: projection.revenuReferenceMicroTNS ? WARNING_MICRO_TNS : null,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
