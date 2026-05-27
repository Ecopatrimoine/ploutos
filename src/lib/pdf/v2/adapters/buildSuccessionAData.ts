// ─── Lot Dossier client — Adapter Succession A v2 ────────────────────
//
// Mappe `computeSuccession()` vers SuccessionAPageData. Le moteur calcule
// la masse civile, les droits par héritier, les abattements.

import type { SuccessionAPageData } from "../pages/pageSuccessionA";

export type BuildSuccessionADataParams = {
  succession: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildSuccessionAData(p: BuildSuccessionADataParams): SuccessionAPageData {
  const s = p.succession || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // ─── Héritiers — mapping trivial sur les champs dérivés du moteur ──
  // SOURCE UNIQUE : computeSuccession() expose déjà partRecueFiscale, netFiscal
  // et compositionFiscale (cf. succession.ts ligne ~699-713). Aucun recalcul
  // ici → impossible que le PDF diverge de l'UI.
  const heritiersRaw: any[] = Array.isArray(s.results) ? s.results : [];
  const heritiers = heritiersRaw.map(h => {
    const partRecue = num(h.partRecueFiscale ?? 0);
    const abattement = num(h.allowance ?? 0);
    const droits = num(h.successionDuties ?? 0);
    const droitsExonere = droits === 0 && h.relation === "conjoint" && isCouple;
    const net = Math.max(0, partRecue - droits);
    return {
      nom: h.name || "Héritier",
      lien: relationLabel(h.relation),
      partRecue,
      abattement: abattement > 0 ? abattement : undefined,
      droits,
      droitsExonere: droitsExonere || undefined,
      net,
      composition: h.compositionFiscale || undefined,
    };
  });

  // ─── KPI dérivés des héritiers (cohérence garantie avec le tableau) ──
  // Les totaux affichés en KPI haut de page = SOMME des valeurs par héritier.
  // Évite l'écart entre KPI (clé succession.activeNet = économique brute) et
  // tableau héritier (formule fiscale). Si les héritiers sont vides, fallback
  // sur les clés succession globales.
  const masseSuccessoraleNette = heritiers.length > 0
    ? heritiers.reduce((sum, h) => sum + h.partRecue, 0)
    : num(s.activeNet ?? s.netCivil ?? 0);
  const droitsSuccession = heritiers.length > 0
    ? heritiers.reduce((sum, h) => sum + h.droits, 0)
    : num(s.totalRights ?? s.totalTax ?? 0);
  const netTransmis = masseSuccessoraleNette - droitsSuccession;
  const tauxMoyenPct = masseSuccessoraleNette > 0
    ? (droitsSuccession / masseSuccessoraleNette) * 100
    : 0;
  const tauxMoyen = `${tauxMoyenPct.toFixed(1).replace(".", ",")} %`;

  // Réserve héréditaire / Quotité disponible — calcul selon nb enfants
  const nbEnfants = Array.isArray(data.childrenData) ? data.childrenData.length : 0;
  const reservePct = nbEnfants === 1 ? 50 : nbEnfants === 2 ? 67 : nbEnfants >= 3 ? 75 : 0;
  const reserveMontant = Math.round(masseSuccessoraleNette * reservePct / 100);
  const quotitePct = 100 - reservePct;
  const quotiteMontant = masseSuccessoraleNette - reserveMontant;
  const reserveFraction = nbEnfants === 1 ? "1/2" : nbEnfants === 2 ? "2/3" : nbEnfants >= 3 ? "3/4" : "—";
  const quotiteFraction = nbEnfants === 1 ? "1/2" : nbEnfants === 2 ? "1/3" : nbEnfants >= 3 ? "1/4" : "—";

  // Description dévolution (composée selon situation famille)
  const devolutionDescription = describeDevolution(data, nbEnfants);

  return {
    clientName,
    dateStr,
    masseSuccessoraleNette,
    droitsSuccession,
    netTransmis,
    tauxMoyen,
    noteKpi: "Masse civile, hors assurance-vie et PER (transmis hors succession — voir page suivante).",
    devolutionBadge: "Dévolution légale",
    devolutionDescription,
    reservePct,
    reserveLabel: `Réserve héréditaire · ${reserveFraction}`,
    reserveMontant,
    quotitePct,
    quotiteLabel: `Quotité dispo. · ${quotiteFraction}`,
    quotiteMontant,
    heritiers,
    notreLecture: p.notreLecture || `Avec ${nbEnfants} enfant${nbEnfants > 1 ? "s" : ""}, les droits successoraux ressortent à ${tauxMoyen} du patrimoine net transmis. La situation reste à actualiser selon votre régime matrimonial et vos donations antérieures.`,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Transmission — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function relationLabel(r: any): string {
  if (!r) return "Héritier";
  const map: Record<string, string> = {
    "conjoint": "Conjoint",
    "enfant": "Enfant",
    "petit-enfant": "Petit-enfant",
    "frere-soeur": "Frère/Sœur",
    "parent": "Parent",
    "autre": "Autre",
  };
  return map[String(r).toLowerCase()] || String(r);
}

function describeDevolution(data: Record<string, any>, nbEnfants: number): string {
  const status = data.coupleStatus;
  const parts: string[] = [];
  if (nbEnfants > 0) parts.push(`${nbEnfants} enfant${nbEnfants > 1 ? "s" : ""}`);
  if (status === "married" || status === "pacs") {
    parts.push("conjoint — option ¼ en pleine propriété");
  } else if (status === "cohab") {
    parts.push("concubin (non héritier légal — taxation 60 %)");
  }
  return parts.join(" · ") || "Dévolution à préciser";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
