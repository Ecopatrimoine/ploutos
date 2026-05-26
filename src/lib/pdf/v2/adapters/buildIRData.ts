// ─── Lot Dossier client — Adapter IR v2 ──────────────────────────────
//
// Mappe le résultat de `computeIR(data, irOptions, ...)` vers IRPageData.
// Les calculs (impôt, abattements, tranches) sont déjà faits côté moteur ;
// l'adapter ne fait que mapper + formatter pour l'affichage.

import type { IRPageData } from "../pages/pageIR";

export type BuildIRDataParams = {
  ir: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildIRData(p: BuildIRDataParams): IRPageData {
  const ir = p.ir || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // Mapping des revenus (les noms exacts dépendent de computeIR — fallback à 0).
  // Si certains champs sont absents, les KPIs apparaîtront à 0 € (pas crashants).
  const salaires       = num(ir.salaries ?? ir.salaires ?? (Number(data.salary1) + Number(data.salary2 || 0)));
  const fonciers       = num(ir.foncierBrut ?? ir.taxableFonciers ?? 0);
  const mobiliers      = num(ir.taxablePlacements ?? ir.totalPFU ?? 0);
  const pensionsAutres = num(ir.pensions ?? data.pensions ?? 0);
  const revenusBruts   = salaires + fonciers + mobiliers + pensionsAutres;
  const abattement10pct = num(ir.abattement10 ?? Math.round(salaires * 0.10));
  const revenuNetImposable = num(ir.revenuNetGlobal ?? (revenusBruts - abattement10pct));

  return {
    clientName,
    dateStr,
    impotNetDu: num(ir.finalIR ?? 0),
    trancheMarginale: formatPct(ir.marginalRate),
    tauxMoyen: formatPct(ir.averageRate),
    quotient: ir.parts ? `${ir.parts} part${ir.parts > 1 ? "s" : ""}` : "—",
    salaires,
    fonciers,
    mobiliers,
    pensionsAutres,
    revenusBruts,
    abattement10pct,
    revenuNetImposable,
    notreLecture: p.notreLecture || "Synthèse fiscale issue du calcul automatique. À compléter par votre conseiller pour une analyse détaillée.",
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Fiscalité — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatPct(v: any): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v.replace(/\s|%/g, "").replace(",", ".")) : v;
  if (!Number.isFinite(n)) return "—";
  // Si la valeur est déjà entre 0 et 1 (taux décimal), multiplier par 100
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1).replace(".", ",")} %`;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
