// ─── Lot Dossier client — Adapter Couverture v2 ──────────────────────
import type { CouverturePageData } from "../pages/pageCouverture";

export type BuildCouvertureDataParams = {
  cabinet: Record<string, any>;
  data: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
};

export function buildCouvertureData(p: BuildCouvertureDataParams): CouverturePageData {
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  // Nom client : composé couple si person2 renseigné
  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs" || data.coupleStatus === "cohab";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : p1) || "Client";

  return {
    cabinetNom: cabinet.cabinetName || cabinet.nom || "—",
    cabinetSousTitre: undefined,  // auto-calculé par la page si absent
    orias: cabinet.orias || undefined,
    eyebrowDocument: "Conseil en gestion de patrimoine",
    titreDocument: "Rapport\npatrimonial",
    clientName,
    dateStr,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
