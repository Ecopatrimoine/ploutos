// ─── Lot Dossier client — Page Hypothèses v2 (Scénarios d'optimisation) ──
//
// Compare la situation de base vs chaque scénario actif (IR / IFI / Succession
// + Total fiscal), avec delta signé et coloration vert (gain) / rouge (perte).
//
// Structure : header + bandeau Base (3 KPI référence) + une card par hypothèse
// avec 4 KPI delta + pied.

import {
  header,
  bandeKPI,
  sousTitreSection,
  piedPage,
  coquillePage,
  euro,
} from "../primitives";
import type { Tokens } from "../tokens";

export type HypoScenarioKpi = {
  label: string;        // "IR" / "IFI" / "Succession" / "Total fiscal"
  valeur: number;
  delta: number;        // négatif = gain (économie), positif = surcoût
};

export type HypoScenario = {
  titre: string;
  objectif?: string;
  notes?: string;
  kpis: HypoScenarioKpi[];   // 4 KPI : IR, IFI, Succession, Total
};

export type HyposPageData = {
  clientName: string;
  dateStr: string;
  baseIR: number;
  baseIFI: number;
  baseSuccession: number;
  scenarios: HypoScenario[];   // si vide, page rend un fallback
  pagePosition: string;
  cabinetLibellePied: string;
};

export function pageHypos(t: Tokens, d: HyposPageData): string {
  const kpiBase = [
    { label: "IR (base)",         value: euro(d.baseIR),         type: "main"   as const },
    { label: "IFI (base)",        value: euro(d.baseIFI),        type: "normal" as const },
    { label: "Succession (base)", value: euro(d.baseSuccession), type: "normal" as const },
  ];

  const formatDelta = (delta: number): { texte: string; couleur: string } => {
    if (delta === 0)  return { texte: `±0 €`, couleur: t.texteFaible };
    if (delta < 0)    return { texte: `− ${euro(Math.abs(delta))}`, couleur: t.succes };
    // Pas de token danger défini ; rouge bordeaux sobre, cohérent navy/or.
    return { texte: `+ ${euro(delta)}`, couleur: "#B0413E" };
  };

  const renderKpi = (k: HypoScenarioKpi) => {
    const { texte, couleur } = formatDelta(k.delta);
    return `
      <div style="background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:10px 12px;text-align:center">
        <div style="font-size:9.5px;color:${t.texteFaible};margin-bottom:3px">${k.label}</div>
        <div style="font-size:14px;font-weight:700;color:${t.navy}">${euro(k.valeur)}</div>
        <div style="font-size:10px;font-weight:600;color:${couleur};margin-top:3px">${texte}</div>
      </div>`;
  };

  const renderScenario = (s: HypoScenario) => `
    <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px;margin-top:12px">
      <div style="font-size:12.5px;font-weight:700;color:${t.navy};margin-bottom:4px">${s.titre}</div>
      ${s.objectif ? `<div style="font-size:10.5px;color:${t.eyebrowOr};font-weight:600;margin-bottom:4px">Objectif : ${s.objectif}</div>` : ""}
      ${s.notes ? `<div style="font-size:10.5px;color:${t.texteFaible};line-height:1.5;margin-bottom:8px;font-style:italic">${s.notes}</div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(${s.kpis.length}, 1fr);gap:8px;margin-top:8px">
        ${s.kpis.map(renderKpi).join("")}
      </div>
    </div>`;

  const corpsScenarios = d.scenarios.length > 0
    ? d.scenarios.map(renderScenario).join("")
    : `<div style="margin-top:14px;font-size:10.5px;color:${t.texteFaibleClair};font-style:italic;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:14px 16px">Aucune hypothèse complète saisie pour ce dossier. Les scénarios alternatifs sont à modéliser dans l'onglet « Hypothèses ».</div>`;

  const contenu = `
    ${header(t, {
      eyebrow: "Optimisation",
      titre: "Scénarios d'optimisation",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpiBase)}
    <div class="foot">Référence de comparaison. Chaque scénario ci-dessous affiche le delta vs cette base — gain en vert, surcoût en rouge.</div>

    <div style="margin-top:14px">
      ${sousTitreSection(t, `Scénarios étudiés — ${d.scenarios.length}`)}
      ${corpsScenarios}
    </div>
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
