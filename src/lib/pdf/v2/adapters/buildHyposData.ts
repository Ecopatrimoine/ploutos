// ─── Lot Dossier client — Adapter Hypothèses v2 ─────────────────────
//
// Compare hypothesisResults[] (déjà calculés côté App.tsx avec
// computeIR/computeIFI/computeSuccession) à la base (ir/ifi/succession du
// scénario actuel) et expose les deltas signés par scénario.

import type { HyposPageData, HypoScenario, HypoScenarioKpi } from "../pages/pageHypos";
import { euro, pct, plur } from "../../../calculs/utils";
import { SEMANTIC_SUCCES, SEMANTIC_DANGER } from "../tokens";

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
    // Source UNIQUE de la synthèse signée (= ancien kpis[3].delta, valeur inchangée).
    const deltaTotal = dIR + dIFI + dSucc;
    const kpis: HypoScenarioKpi[] = [
      { label: "IR",            valeur: hIR,            delta: dIR },
      { label: "IFI",           valeur: hIFI,           delta: dIFI },
      { label: "Succession",    valeur: hSucc,          delta: dSucc },
      { label: "Total fiscal",  valeur: hIR + hIFI + hSucc, delta: deltaTotal },
    ];
    return {
      titre: h.hypothesis?.name || "Scénario",
      objectif: h.hypothesis?.objective || undefined,
      notes: h.hypothesis?.notes || undefined,
      deltaTotal,
      kpis,
    };
  });

  // ─── Analyse "masque" : synthèse + scénario gagnant + perspective ────
  const baseTotal = baseIR + baseIFI + baseSuccession;
  let notreLecture: string | undefined;
  if (scenarios.length > 0) {
    // Scénario avec le delta TOTAL le plus négatif = meilleur gain (champ nommé deltaTotal).
    const sorted = [...scenarios].sort((a, b) => a.deltaTotal - b.deltaTotal);
    const gagnant = sorted[0];
    const deltaGagnant = gagnant.deltaTotal;
    const totalGagnant = gagnant.kpis[3]?.valeur || 0;
    const gainPct = baseTotal > 0 ? Math.abs(deltaGagnant) / baseTotal * 100 : 0;

    const points: string[] = [];
    if (deltaGagnant < 0) {
      points.push(`<strong>${gagnant.titre}</strong> apporte le meilleur gain global : ${euro(Math.abs(deltaGagnant))} économisés (soit ${pct(gainPct / 100, 1)} de la pression fiscale actuelle)`);
    } else {
      points.push("Aucun scénario n'apporte de gain global net — les arbitrages testés produisent un coût équivalent ou supérieur");
    }
    if (scenarios.length >= 2) {
      const ecartMax = (sorted[sorted.length - 1].kpis[3]?.valeur || 0) - (sorted[0].kpis[3]?.valeur || 0);
      points.push(`écart entre le scénario le moins / le plus coûteux : ${euro(ecartMax)}`);
    }
    points.push("simulations indicatives non opposables — à actualiser selon évolutions législatives et patrimoniales");

    notreLecture = `
      <p style="margin:0 0 10px 0">Les scénarios simulent l'impact de stratégies alternatives sur votre <strong>pression fiscale globale</strong> (IR + IFI + succession). La base de comparaison est votre situation actuelle.</p>
      <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
        <li><strong>Base actuelle</strong> — Total fiscal annuel + transmission : ${euro(baseTotal)}.</li>
        <li><strong>Scénarios étudiés</strong> — ${plur(scenarios.length, "scénario complet", "scénarios complets")}.</li>
        <li><strong>Scénario gagnant</strong> — ${gagnant.titre} : ${euro(totalGagnant)} (${deltaGagnant < 0 ? `<span style="color:${SEMANTIC_SUCCES}">− ${euro(Math.abs(deltaGagnant))}</span>` : `<span style="color:${SEMANTIC_DANGER}">+ ${euro(deltaGagnant)}</span>`} vs base).</li>
      </ul>
      <p style="margin:0;font-style:italic;color:#6B6353"><strong>Points d'attention :</strong> ${points.join(" ; ")}.</p>
    `.trim();
  }

  return {
    clientName,
    dateStr,
    baseIR,
    baseIFI,
    baseSuccession,
    scenarios,
    notreLecture,
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
