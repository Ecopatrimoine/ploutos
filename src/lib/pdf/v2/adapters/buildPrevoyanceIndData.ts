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
    notreLecture: p.notreLecture || (() => {
      const ratioDeficitDeces = revenuAnnuel > 0 ? deficitDeces / revenuAnnuel : 0;
      const deficitDecesGraviteAns = ratioDeficitDeces.toFixed(1).replace(".", ",");

      // Leviers contextuels
      const leviers: string[] = [];
      if (deficitDeces > 0) {
        leviers.push("contrat temporaire décès (TPD) à capital fixe — coût annuel modeste rapporté au capital protégé");
      }
      if (deficitIPT > 0) {
        leviers.push("contrat invalidité (IPT/IPP) avec rente de maintien de revenu indexée");
      }
      if (deficitArretTravail > 0) {
        leviers.push("indemnités journalières (IJ) en complément de la Sécurité sociale (carence et plafond à vérifier)");
      }
      if (deficitDeces === 0 && deficitIPT === 0 && deficitArretTravail === 0) {
        leviers.push("dispositif complet — vérifier néanmoins les exclusions, franchises et plafonds de vos contrats");
      } else {
        leviers.push("auditer les exclusions et la durée d'indemnisation des contrats existants (notamment cumul avec couverture employeur)");
      }

      return `
        <p style="margin:0 0 10px 0">La prévoyance vise à <strong>maintenir le niveau de vie du foyer</strong> en cas de décès, d'invalidité ou d'arrêt de travail. Les besoins sont estimés sur la base de 4 ans de revenus (min. 150 000 €) pour le décès, et 60 % du revenu annuel pour l'invalidité et l'arrêt de travail.</p>
        <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
          <li><strong>Revenu à protéger</strong> — ${formatEuro(revenuAnnuel)}/an.</li>
          <li><strong>Besoins estimés</strong> — Décès : ${formatEuro(besoinDeces)} (4 × revenus, plancher 150 k€). Invalidité : ${formatEuro(besoinInvalidite)}/an. Arrêt de travail : ${formatEuro(besoinArretTravail)}/an.</li>
          <li><strong>Couverture décès actuelle (AV/PER)</strong> — ${formatEuro(couvertureDeces)}.</li>
          <li><strong>Déficit décès</strong> — ${deficitDeces > 0
            ? `<span style="color:#B0413E">${formatEuro(deficitDeces)} non couverts</span>, soit ${deficitDecesGraviteAns} année${ratioDeficitDeces > 1 ? "s" : ""} de revenus du foyer.`
            : `<span style="color:#2F7D5B">Aucun — capital actuel couvre le besoin estimé.</span>`}</li>
          <li><strong>Déficits invalidité / arrêt travail</strong> — Invalidité : ${formatEuro(deficitIPT)}/an non couverts ; arrêt travail : ${formatEuro(deficitArretTravail)}/an non couverts (hors complément Sécu).</li>
        </ul>
        <p style="margin:0;font-style:italic;color:#6B6353"><strong>Leviers à étudier :</strong> ${leviers.join(" ; ")}.</p>
      `.trim();
    })(),
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
