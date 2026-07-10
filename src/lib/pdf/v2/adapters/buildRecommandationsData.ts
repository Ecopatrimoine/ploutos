// ─── Lot Dossier client — Adapter Recommandations v2 ────────────────
//
// Mappe les recommandations du diagnostic (regroupées par dimension) vers
// RecommandationsPageData. Réutilise les helpers existants filterComplete
// et groupRecommandationsByDimension pour ne pas dupliquer la logique.

import {
  filterComplete,
  groupRecommandationsByDimension,
  DIMENSIONS_LABEL,
  DIMENSIONS_ORDER,
  type Recommandation,
} from "../../../conformite/recommandations";
import { plur } from "../../../calculs/utils";

import type { RecommandationsPageData, RecoGroupe } from "../pages/pageRecommandations";

export type BuildRecommandationsDataParams = {
  recommandations?: ReadonlyArray<Recommandation>;
  cabinet: Record<string, any>;
  data: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildRecommandationsData(p: BuildRecommandationsDataParams): RecommandationsPageData {
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  const recosComplete = filterComplete(p.recommandations || []);
  const grouped = groupRecommandationsByDimension(recosComplete);

  const groupes: RecoGroupe[] = DIMENSIONS_ORDER
    .map(dim => ({
      dimension: DIMENSIONS_LABEL[dim] || dim,
      items: (grouped[dim] || []).map(r => ({
        libelle: r.libelle,
        justification: r.justification,
      })),
    }))
    .filter(g => g.items.length > 0);

  // Mention conformité reprise du rapport v1 : "garanties et besoins, aucun produit nommé".
  const intro = `Chaque recommandation se rattache à une dimension du profil (fiscalité, transmission, protection, etc.). Le cabinet raisonne en garanties et besoins ; aucun produit ni assureur n'est nommé à ce stade. Chaque proposition est à valider avec votre conseiller selon l'évolution de votre situation.`;

  const notreLecture = groupes.length > 0
    ? `${plur(groupes.length, "dimension couverte", "dimensions couvertes")} par ${plur(recosComplete.length, "recommandation")}. Le plan d'action sera revu lors du prochain entretien.`
    : `Aucune recommandation complète n'a été finalisée pour ce dossier. Le diagnostic reste à enrichir.`;

  return {
    clientName,
    dateStr,
    intro,
    groupes,
    notreLecture,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Plan d'action — confidentiel`,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
