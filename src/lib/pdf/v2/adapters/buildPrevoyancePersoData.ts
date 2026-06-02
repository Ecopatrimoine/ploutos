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

export type BuildPrevoyancePersoDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  which: "p1" | "p2";
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

const LIBELLE_STATUT: Record<string, string> = {
  salarie_non_cadre: "Salarié non-cadre",
  salarie_cadre: "Salarié cadre",
  tns_liberal: "TNS — profession libérale",
  tns_commercant: "TNS — commerçant",
  tns_artisan: "TNS — artisan",
  gerant_majoritaire: "Gérant majoritaire",
  president_sas: "Président SAS / SASU",
  eurl_unique: "EURL gérant non majoritaire",
  fonctionnaire: "Fonctionnaire",
  retraite: "Retraité",
  sans_activite: "Sans activité",
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
  return `${Math.round(v).toLocaleString("fr-FR")} €/mois`;
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

function compositionAtIdx(s: ProjectionResult["series"], i: number, jour: number): string {
  const parts: string[] = [];
  if (s.salaire[i] > 0) parts.push("salaire (activité)");
  if (s.maintienEmployeur[i] > 0) parts.push("maintien employeur");
  if (s.ijObligatoire[i] > 0) parts.push("IJ régime obl.");
  if (s.ijComplementaireCollective[i] > 0) parts.push("IJ coll.");
  if (s.ijComplementaireIndividuelle[i] > 0) parts.push("IJ ind.");
  if (s.pensionInvalObligatoire[i] > 0) parts.push("pension inval. obl.");
  if (s.renteInvalCollective[i] > 0) parts.push("rente inval. coll.");
  if (s.renteInvalIndividuelle[i] > 0) parts.push("rente inval. ind.");
  if (s.renteInvalEnfants[i] > 0) parts.push("rente enfants");
  if (parts.length === 0) return jour < 7 ? "carence — aucun revenu" : "aucun revenu de remplacement";
  return parts.join(" + ");
}

const JALONS = [0, 7, 30, 90, 180, 365, 1095];

function libelleJalon(jour: number): string {
  if (jour === 0) return "J0";
  if (jour < 30) return `J${jour}`;
  if (jour < 365) return `${Math.round(jour / 30)} mois`;
  if (jour === 1095) return "3 ans (inval.)";
  return `${(jour / 365).toFixed(1)} ans`;
}

function buildJalons(projection: ProjectionResult): PrevoyancePersoJalon[] {
  const ref = projection.revenuReferenceMensuel;
  return JALONS.map((j) => {
    const idx =
      j === 1095
        ? projection.axe.findIndex((p) => p.jour >= 1095)
        : projection.axe.findIndex((p) => p.jour === j);
    if (idx < 0) return null;
    const total = totalAtIdx(projection.series, idx);
    const pct = ref > 0 ? Math.round((total / ref) * 100) : 0;
    return {
      libelle: libelleJalon(j),
      revenu: `${Math.round(total).toLocaleString("fr-FR")} €`,
      pct: `${pct} %`,
      detail: compositionAtIdx(projection.series, idx, j),
    };
  }).filter(Boolean) as PrevoyancePersoJalon[];
}

function redigerNotreLecture(projection: ProjectionResult, personneLibelle: string): string {
  const ref = projection.revenuReferenceMensuel;
  const idxJ180 = projection.axe.findIndex((p) => p.jour === 180);
  const idxInval = projection.axe.findIndex((p) => p.jour >= 1095);
  const totalJ180 = idxJ180 >= 0 ? totalAtIdx(projection.series, idxJ180) : 0;
  const totalInval = idxInval >= 0 ? totalAtIdx(projection.series, idxInval) : 0;
  const pctJ180 = ref > 0 ? Math.round((totalJ180 / ref) * 100) : 0;
  const pctInval = ref > 0 ? Math.round((totalInval / ref) * 100) : 0;

  const phrases: string[] = [];
  phrases.push(
    `La projection couvre la perte de revenus de ${personneLibelle} en cas d'arrêt de travail prolongé, ` +
    `du premier jour (carence) jusqu'à la reconnaissance d'invalidité (3 ans), puis jusqu'à l'âge légal de retraite.`
  );
  if (ref > 0) {
    phrases.push(
      `À 6 mois d'arrêt, le revenu de remplacement estimé représente environ ${pctJ180} % du revenu de référence ; ` +
      `en cas d'invalidité reconnue, environ ${pctInval} %.`
    );
    if (pctInval < 70 || pctJ180 < 70) {
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
  const mentionDDA =
    `Document remis à titre indicatif — analyse non contractuelle. Ne constitue ni un conseil en ` +
    `investissement au sens de l'art. L.541-1 et s. CMF, ni un conseil en distribution d'assurance au ` +
    `sens de l'art. L.521-4 C. ass. Toute mise en place de couverture doit faire l'objet d'un devoir de ` +
    `conseil formalisé et d'une recommandation personnalisée par un intermédiaire habilité. ` +
    `${cabinetNom} — ORIAS n° ${orias}.`;
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
    `${entree.age} ans · retraite à ${entree.ageRetraite} ans · ancienneté ${anneesAnciennete} an${anneesAnciennete > 1 ? "s" : ""}`;

  return {
    disponible: true,
    clientName,
    personneLibelle,
    dateStr,
    statutLibelle: LIBELLE_STATUT[entree.statutPro] ?? "—",
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
