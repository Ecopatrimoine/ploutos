// ─── Lot Dossier client — Adapter Hypothèses v2 ─────────────────────
//
// Compare hypothesisResults[] (déjà calculés côté App.tsx avec
// computeIR/computeIFI/computeSuccession) à la base (ir/ifi/succession du
// scénario actuel) et expose les deltas signés par scénario.

import type { HyposPageData, HypoScenario, HypoScenarioKpi } from "../pages/pageHypos";

export type BuildHyposDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  ir?: any;
  ifi?: any;
  succession?: any;
  hypothesisResults?: any[];
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildHyposData(p: BuildHyposDataParams): HyposPageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const ir = p.ir || {};
  const ifi = p.ifi || {};
  const succession = p.succession || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  const baseIR = num(ir.finalIR);
  const baseIFI = num(ifi.ifi);
  const baseSuccession = num(succession.totalRights);

  const hypoResults = Array.isArray(p.hypothesisResults) ? p.hypothesisResults : [];
  // Filtre : hypothèse "active" = a tous ses résultats (ir + ifi + succession)
  const actives = hypoResults.filter(h => h && h.ir && h.ifi && h.succession);

  const scenarios: HypoScenario[] = actives.map(h => {
    const hIR = num(h.ir.finalIR);
    const hIFI = num(h.ifi.ifi);
    const hSucc = num(h.succession.totalRights);
    const dIR = hIR - baseIR;
    const dIFI = hIFI - baseIFI;
    const dSucc = hSucc - baseSuccession;
    const kpis: HypoScenarioKpi[] = [
      { label: "IR",            valeur: hIR,            delta: dIR },
      { label: "IFI",           valeur: hIFI,           delta: dIFI },
      { label: "Succession",    valeur: hSucc,          delta: dSucc },
      { label: "Total fiscal",  valeur: hIR + hIFI + hSucc, delta: dIR + dIFI + dSucc },
    ];
    return {
      titre: h.hypothesis?.name || "Scénario",
      objectif: h.hypothesis?.objective || undefined,
      notes: h.hypothesis?.notes || undefined,
      kpis,
    };
  });

  return {
    clientName,
    dateStr,
    baseIR,
    baseIFI,
    baseSuccession,
    scenarios,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Hypothèses — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
