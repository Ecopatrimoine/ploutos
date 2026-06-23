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
  encartNotreLecture,
  euro,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
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
  notreLecture?: string;
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

  // ─── Déclaration des blocs (contrat de page, engine/contrat.ts) ──
  const blocs: Bloc[] = [];

  // Header de page (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Optimisation",
      titre: "Scénarios d'optimisation",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Bande KPI de référence + note (insécables, gardées ensemble).
  blocs.push({
    kind: "insecable",
    html: `${bandeKPI(t, kpiBase)}
    <div class="foot">Référence de comparaison. Chaque scénario ci-dessous affiche le delta vs cette base — gain en vert, surcoût en rouge.</div>`,
  });

  // Comparatif visuel : sous-titre + chart SVG dans UN bloc insécable (le graphique
  // n'est jamais coupé). Le chart garde son cap visuel à MAX_SCENARIOS_AFFICHES=3
  // (renderHyposBarChart inchangé : 3 barres phares + note « + N non affichés »).
  if (d.scenarios.length > 0) {
    blocs.push({
      kind: "insecable",
      html: `<div style="margin-top:14px">
        ${sousTitreSection(t, "Comparatif visuel — IR / IFI / Succession")}
        ${renderHyposBarChart(t, d)}
      </div>`,
    });
  }

  // Sous-titre « Scénarios étudiés — N » : solidaire de sa 1ʳᵉ carte (titre non orphelin).
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:14px">${sousTitreSection(t, `Scénarios étudiés — ${d.scenarios.length}`)}</div>`,
  });

  // CHAQUE carte de scénario = bloc insécable. Suite écoulée sur N feuilles, ZÉRO perte
  // (contrairement au cap chart=3, les cartes ne sont PAS capées).
  if (d.scenarios.length > 0) {
    for (const s of d.scenarios) {
      blocs.push({ kind: "insecable", html: renderScenario(s) });
    }
  } else {
    blocs.push({
      kind: "insecable",
      html: `<div style="margin-top:14px;font-size:10.5px;color:${t.texteFaibleClair};font-style:italic;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:14px 16px">Aucune hypothèse complète saisie pour ce dossier. Les scénarios alternatifs sont à modéliser dans l'onglet « Hypothèses ».</div>`,
    });
  }

  // Note de fin (queue épinglée en fin de flux).
  if (d.notreLecture) {
    blocs.push({ kind: "queue", html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) });
  }

  return compilerPageContrat(blocs);
}

// ─── Bar chart vertical groupé (IR / IFI / Succession) ──────────────
// Compare la Base + chaque scénario (max 3 affichés pour rester lisible).
// SVG inline, palette v2 (navy pour Base, gold/sky/eyebrowOr pour scénarios).
function renderHyposBarChart(t: Tokens, d: HyposPageData): string {
  const MAX_SCENARIOS_AFFICHES = 3;
  const visibles = d.scenarios.slice(0, MAX_SCENARIOS_AFFICHES);
  const surplus = d.scenarios.length - visibles.length;

  const groupes = [
    { label: "IR",         base: d.baseIR,         values: visibles.map(s => s.kpis[0]?.valeur || 0) },
    { label: "IFI",        base: d.baseIFI,        values: visibles.map(s => s.kpis[1]?.valeur || 0) },
    { label: "Succession", base: d.baseSuccession, values: visibles.map(s => s.kpis[2]?.valeur || 0) },
  ];

  const allValues = groupes.flatMap(g => [g.base, ...g.values]);
  const maxValue = Math.max(...allValues, 1);

  const couleursScenarios = [t.or, t.sectionGrisBleu, t.eyebrowOr];

  // Dimensions (en unités SVG, viewBox responsive)
  const width = 600;
  const height = 220;
  const padding = { top: 22, right: 20, bottom: 44, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const groupWidth = innerW / groupes.length;
  const barCount = 1 + visibles.length;  // Base + scénarios
  const totalGap = groupWidth * 0.30;
  const barWidth = (groupWidth * 0.70) / barCount;
  const barGap = totalGap / (barCount + 1);

  let bars = "";
  let labels = "";

  groupes.forEach((g, i) => {
    const groupX = padding.left + i * groupWidth;
    const allInGroup = [g.base, ...g.values];
    const colors = [t.navy, ...visibles.map((_, j) => couleursScenarios[j % couleursScenarios.length])];

    allInGroup.forEach((val, j) => {
      const h = (val / maxValue) * innerH;
      const x = groupX + barGap + j * (barWidth + barGap);
      const y = padding.top + innerH - h;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${colors[j]}" rx="2"/>`;
      bars += `<text x="${(x + barWidth/2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="8.5" font-family="Lato,sans-serif" fill="${colors[j]}">${formatEuroCompact(val)}</text>`;
    });

    labels += `<text x="${(groupX + groupWidth/2).toFixed(1)}" y="${(padding.top + innerH + 18).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" font-family="Lato,sans-serif" fill="${t.texte}">${g.label}</text>`;
  });

  // Axe X
  const axeY = padding.top + innerH;
  const axe = `<line x1="${padding.left}" y1="${axeY}" x2="${width - padding.right}" y2="${axeY}" stroke="${t.bordureClaire}" stroke-width="1"/>`;

  // Légende
  const items = ["Base actuelle", ...visibles.map(s => s.titre)];
  const colorsLeg = [t.navy, ...visibles.map((_, j) => couleursScenarios[j % couleursScenarios.length])];
  const legende = items.map((label, j) => `
    <div style="display:inline-flex;align-items:center;gap:6px;margin-right:14px">
      <span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${colorsLeg[j]}"></span>
      <span style="font-size:10.5px;color:${t.texte}">${label}</span>
    </div>
  `).join("");

  const noteSurplus = surplus > 0
    ? `<div style="margin-top:6px;font-size:9.5px;color:${t.texteFaibleClair};font-style:italic">+ ${surplus} scénario${surplus > 1 ? "s" : ""} non affiché${surplus > 1 ? "s" : ""} dans le graphique (voir détail ci-dessous).</div>`
    : "";

  return `
    <div style="background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:12px 14px;margin-top:6px">
      <div style="margin-bottom:8px;line-height:1.6">${legende}</div>
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%;display:block">
        ${axe}
        ${bars}
        ${labels}
      </svg>
      ${noteSurplus}
    </div>
  `;
}

function formatEuroCompact(n: number): string {
  // Compact pour rester lisible au-dessus des barres : 1 234 € / 12 k€ / 1,2 M€.
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M€`;
  if (abs >= 10_000)    return `${Math.round(n / 1000)} k€`;
  if (abs >= 1_000)     return `${(n / 1000).toFixed(1).replace(".", ",")} k€`;
  return `${Math.round(n)} €`;
}
