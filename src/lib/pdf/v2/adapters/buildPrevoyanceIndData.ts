// ─── Lot Dossier client — Adapter Prévoyance individuelle v2 ─────────
//
// Synthétise les besoins de couverture (décès, IPT, arrêt travail) à
// partir du dossier. Pour cette première version, on utilise des règles
// simplifiées : déficit = revenu net annuel × 4 ans (ordre de grandeur),
// couverture actuelle déduite des placements assurance-vie en cas de
// décès. Les vrais calculs prévoyance demanderont un moteur dédié.

import type { PrevoyanceIndPageData } from "../pages/pagePrevoyanceInd";
import { isAV } from "../../../calculs/utils";

export type BuildPrevoyanceIndDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildPrevoyanceIndData(p: BuildPrevoyanceIndDataParams): PrevoyanceIndPageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // ─── Estimations besoin / couverture (règles simplifiées) ────────
  const revenuAnnuel = num(data.salary1) + num(data.salary2 || 0);
  const besoinDeces = Math.max(150_000, revenuAnnuel * 4);  // 4 ans de revenu min 150 k€
  const besoinInvalidite = Math.round(revenuAnnuel * 0.6);  // 60 % revenu
  const besoinArretTravail = Math.round(revenuAnnuel * 0.6);

  // Couverture décès = AV existante (transmis hors succession). On utilise
  // la fonction canonique isAV() qui connaît les vraies valeurs AV_TYPES
  // (les types concaténés avec "assurance"/"av" en lowercase ne matchent
  // PAS « Assurance-vie fonds euros » qui contient une majuscule + tiret).
  const placements: any[] = Array.isArray(data.placements) ? data.placements : [];
  const couvertureDeces = placements
    .filter(pl => isAV(pl.type))
    .reduce((s, pl) => s + num(pl.value), 0);

  const deficitDeces = Math.max(0, besoinDeces - couvertureDeces);
  const deficitIPT = besoinInvalidite;            // hypothèse : 0 couverture
  const deficitArretTravail = besoinArretTravail;

  // Sous-titre selon profession
  const jobTitle = data.person1JobTitle || "";
  const sousTitre = jobTitle ? `${jobTitle}` : undefined;

  // Foyer
  const nbEnfants = Array.isArray(data.childrenData) ? data.childrenData.length : 0;
  const foyerAProteger = (isCouple ? "Conjoint" : "Foyer") + (nbEnfants > 0 ? ` + ${nbEnfants} enfant${nbEnfants > 1 ? "s" : ""}` : "");

  return {
    clientName,
    dateStr,
    sousTitre,
    deficitCapitalDeces: deficitDeces > 0 ? formatEuro(deficitDeces) : "0 €",
    revenuAProteger: `${formatEuro(revenuAnnuel)}/an`,
    foyerAProteger,
    capitalDecesCouvert: formatEuro(couvertureDeces),
    lignes: [
      {
        label: "Décès",
        besoinTexte: `besoin · ${formatEuro(besoinDeces)}`,
        pctCouverture: besoinDeces > 0 ? Math.min(100, Math.round((couvertureDeces / besoinDeces) * 100)) : 0,
        deficit: deficitDeces > 0 ? `− ${formatEuro(deficitDeces)}` : "0 €",
      },
      {
        label: "Invalidité (IPT)",
        besoinTexte: `besoin · ${formatEuro(besoinInvalidite)}/an`,
        pctCouverture: 0,
        deficit: `− ${formatEuro(deficitIPT)}`,
        deficitSuffixe: "/an",
      },
      {
        label: "Arrêt de travail",
        besoinTexte: `besoin · ${formatEuro(besoinArretTravail)}/an`,
        pctCouverture: 0,
        deficit: `− ${formatEuro(deficitArretTravail)}`,
        deficitSuffixe: "/an",
      },
    ],
    notreLecture: p.notreLecture || (deficitDeces > 0
      ? `En l'état, un décès laisserait un déficit de ${formatEuro(deficitDeces)} ; une invalidité ou un arrêt prolongé amputerait votre revenu d'environ ${formatEuro(deficitIPT)}/an non couverts. Renforcer le capital décès et prévoir une rente de maintien de revenu sont les deux priorités.`
      : `Votre capital décès couvre votre besoin estimé. Le maintien de revenu en cas d'invalidité ou d'arrêt prolongé reste un sujet à traiter.`),
    mentionNonContractuelle:
      "Montants illustratifs, à valider auprès de votre caisse et selon les garanties de votre contrat de prévoyance. Simulation non contractuelle ; toute recommandation s'inscrit dans le cadre du devoir de conseil (DDA).",
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Prévoyance — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
