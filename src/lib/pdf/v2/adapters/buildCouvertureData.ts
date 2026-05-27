// ─── Lot Dossier client — Adapter Couverture v2 ──────────────────────
//
// Compose le nom client selon le couple ET le destinataire (recipient).
// - Marié / PACS : toujours "P1 & P2" (foyer fiscal unique).
// - Concubinage : routage par recipient — si "person1"/"person2", on n'affiche
//   QUE le destinataire (foyers fiscaux séparés). Si "couple" ou undefined,
//   on affiche les deux.
// - Solo : P1 seul.
//
// Ajoute le nom du conseiller (cabinet.conseiller) sur la couverture.

import type { CouverturePageData } from "../pages/pageCouverture";
import type { Recipient } from "../../pdfCore";

export type BuildCouvertureDataParams = {
  cabinet: Record<string, any>;
  data: Record<string, any>;
  recipient?: Recipient;
  clientName?: string;
  dateLettre?: string;
  /** Logo cabinet (data URL ou URL) — fourni via PackPayload.logoSrc. */
  logoSrc?: string;
};

export function buildCouvertureData(p: BuildCouvertureDataParams): CouverturePageData {
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  // ─── Nom client = "Prénom Nom" des personnes RÉELLES (data.person*) ──
  // On n'utilise PAS p.clientName ici (= alias / nom de dossier custom)
  // car la couverture doit montrer le nom des personnes, pas du dossier.
  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isMarriedOrPacs = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const isCohab = data.coupleStatus === "cohab";

  let composedName: string;
  if (isMarriedOrPacs && p2) {
    // Foyer fiscal unique → toujours les deux
    composedName = `${p1} & ${p2}`;
  } else if (isCohab && p2) {
    // Foyers séparés → routage par recipient
    if (p.recipient === "person1") composedName = p1;
    else if (p.recipient === "person2") composedName = p2;
    else composedName = `${p1} & ${p2}`;  // couple ou undefined
  } else {
    composedName = p1 || "Client";
  }

  // Logo : priorité au logoSrc fourni explicitement (state App.tsx),
  // sinon fallback sur cabinet.logoSrc / cabinet.logo (legacy).
  const logo = p.logoSrc || cabinet.logoSrc || cabinet.logo || undefined;

  return {
    cabinetNom: cabinet.cabinetName || cabinet.nom || "—",
    cabinetSousTitre: undefined,  // auto-calculé par la page si absent
    cabinetLogoSrc: logo,
    orias: cabinet.orias || undefined,
    eyebrowDocument: "Conseil en gestion de patrimoine",
    titreDocument: "Rapport\npatrimonial",
    clientName: composedName,
    dateStr,
    conseillerName: cabinet.conseiller || cabinet.conseillerName || undefined,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
