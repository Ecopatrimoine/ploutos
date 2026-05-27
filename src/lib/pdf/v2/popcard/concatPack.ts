// ─── Lot Dossier client — concaténation de pack PDF + popup print ─────
//
// Prend une liste ordonnée d'éléments cochés (PackItem[]) + les overrides
// per-dossier (palette PDF, lieu signature), et :
//  1. génère pour chaque item le BODY HTML (sans <html><head><style>)
//  2. assemble le tout dans une coquille HTML unique avec :
//     - les fonts CDN (Fraunces + Lato)
//     - le CSS commun v2 (cssCommun) — palette résolue selon override
//     - le CSS legacy v1 pour les sections v1-only (cabinet/famille/travail/
//       hypos/recommandations/mentions) — chargé seulement si nécessaires
//  3. ouvre une popup print (openPrintPopup) → 1 seul PDF à imprimer
//
// Ordre = PACK_ORDER (bilan AVANT docs réglementaires).
// Cohabitation CSS v1+v2 dans le même HTML : les classes v1 et v2 peuvent
// se chevaucher (.kpi notamment). Pour la première version, on émet les
// 2 jeux de CSS ; collisions à surveiller au test visuel.

import type { PackItem } from "./checkCompletude";
import { sortPack } from "./checkCompletude";
import { mapCabinetToThemeV2, type ThemeV2 } from "../adapters/mapTheme";
import { buildTokens } from "../tokens";
import { coquilleDocument } from "../primitives";
import { openPrintPopup } from "../../pdfCore";

// ─── Renderers v2 ─────────────────────────────────────────────────────
// Docs réglementaires (4) + 5 sections bilan câblées en 1ère passe.
// Les 6 autres sections (cabinet/famille/travail/hypos/recos/mentions +
// bilanEndettement/successionB/prevoyanceInd/prevoyanceColl) restent en
// placeholder pour une 2ème passe.
import { pageLettreMission } from "../pages/pageLettreMission";
import { pageDer } from "../pages/pageDer";
import { pageFicheDDA } from "../pages/pageFicheDDA";
import { pageDeclarationAdequation } from "../pages/pageDeclarationAdequation";
import { pageCouverture } from "../pages/pageCouverture";
import { pageIR } from "../pages/pageIR";
import { pageIFI } from "../pages/pageIFI";
import { pageSuccessionA } from "../pages/pageSuccessionA";
import { pageSuccessionB } from "../pages/pageSuccessionB";
import { pageProfil } from "../pages/pageProfil";
import { pageBilanEndettement } from "../pages/pageBilanEndettement";
import { pagePrevoyanceInd } from "../pages/pagePrevoyanceInd";
import { pagePrevoyanceColl } from "../pages/pagePrevoyanceColl";
import { pageCabinet } from "../pages/pageCabinet";
import { pageFamille } from "../pages/pageFamille";
import { pageTravail } from "../pages/pageTravail";
import { pageHypos } from "../pages/pageHypos";
import { pageRecommandations } from "../pages/pageRecommandations";
import { pageMentions } from "../pages/pageMentions";

// ─── Adapters ─────────────────────────────────────────────────────────
import { buildDerData } from "../adapters/buildDerData";
import { buildLettreMissionData } from "../adapters/buildLettreMissionData";
import { buildFicheDDAData } from "../adapters/buildFicheDDAData";
import { buildAdequationData } from "../adapters/buildDeclarationAdequationData";
import { buildCouvertureData } from "../adapters/buildCouvertureData";
import { buildIRData } from "../adapters/buildIRData";
import { buildIFIData } from "../adapters/buildIFIData";
import { buildSuccessionAData } from "../adapters/buildSuccessionAData";
import { buildSuccessionBData } from "../adapters/buildSuccessionBData";
import { buildProfilData } from "../adapters/buildProfilData";
import { buildBilanEndettementData } from "../adapters/buildBilanEndettementData";
import { buildPrevoyanceIndData } from "../adapters/buildPrevoyanceIndData";
import { buildPrevoyanceCollData } from "../adapters/buildPrevoyanceCollData";
import { buildCabinetData } from "../adapters/buildCabinetData";
import { buildFamilleData } from "../adapters/buildFamilleData";
import { buildTravailData } from "../adapters/buildTravailData";
import { buildHyposData } from "../adapters/buildHyposData";
import { buildRecommandationsData } from "../adapters/buildRecommandationsData";
import { buildMentionsData } from "../adapters/buildMentionsData";

export type PackOverrides = {
  /** Override palette PDF (vide = défaut cabinet via mapCabinetToThemeV2). */
  pdfPaletteOverride?: "" | "cabinet" | "encre_or";
  /** Override lieu de signature pour ce pack. */
  lieuSignatureOverride?: string;
};

export type PackPayload = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  data: Record<string, any>;
  recommandations?: ReadonlyArray<any>;
  piecesJointes?: ReadonlyArray<any>;
  /** ir/ifi/succession déjà calculés côté App.tsx (useMemo). */
  ir?: any;
  ifi?: any;
  succession?: any;
  hypothesisResults?: any;
  /** Optionnel : mode frais (réel/standard) pour libellé Travail. */
  irOptions?: { expenseMode1?: string; expenseMode2?: string };
  /** Destinataire du dossier (couple / person1 / person2) — routage couverture en concubinage. */
  recipient?: "person1" | "person2" | "couple";
  clientName?: string;
};

/** Résout le thème v2 en tenant compte d'un override per-dossier. */
function resolveTheme(cabinet: Record<string, any>, overrides: PackOverrides): ThemeV2 {
  if (overrides.pdfPaletteOverride === "encre_or") return { theme: "encreOr" };
  if (overrides.pdfPaletteOverride === "cabinet") return mapCabinetToThemeV2({ ...cabinet, pdfPalette: "cabinet" });
  // Vide = transparent → utilise cabinet.pdfPalette
  return mapCabinetToThemeV2(cabinet);
}

/** Génère le BODY HTML d'un item du pack (sans coquille html/head).
 *  Retourne "" si l'item n'est pas implémenté en v2 (sera traité en v1
 *  hybride dans une itération ultérieure du Lot Dossier client). */
function renderItemBody(
  item: PackItem,
  payload: PackPayload,
  themeV2: ThemeV2,
  pagination: { index: number; total: number },
): string {
  const t = buildTokens(themeV2.theme, themeV2.cabinetColors);
  const { cabinet, mission, data, recommandations, piecesJointes } = payload;
  const dateLettre = formatDateFr(new Date());
  const clientName = payload.clientName || [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || "—";
  // Position de la page dans le pack global ("3 / 12") — la couverture n'utilise pas ce champ.
  const pagePosition = `${pagination.index} / ${pagination.total}`;

  switch (item) {
    // ─── Documents réglementaires v2 ────────────────────────────────
    case "lettre": {
      const d = buildLettreMissionData({ cabinet, mission, data, clientName, dateLettre });
      return pageLettreMission(t, d);
    }
    case "der": {
      const d = buildDerData({ cabinet, dateLettre });
      return pageDer(t, d);
    }
    case "dda": {
      const d = buildFicheDDAData({ cabinet, mission, data, recommandations, piecesJointes, dateLettre });
      return pageFicheDDA(t, d);
    }
    case "adequation": {
      const d = buildAdequationData({ cabinet, data: data as any, mission, recommandations });
      return pageDeclarationAdequation(t, d);
    }

    // ─── Bilan patrimonial — sections v2 câblées (1ère passe) ────────
    case "couverture": {
      const d = buildCouvertureData({ cabinet, data, recipient: payload.recipient, clientName: payload.clientName, dateLettre });
      return pageCouverture(t, d);
    }
    case "ir": {
      if (!payload.ir) return placeholderSection(t, item, "Section IR requiert le résultat de computeIR (non fourni)");
      const d = buildIRData({ ir: payload.ir, data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pageIR(t, d);
    }
    case "ifi": {
      if (!payload.ifi) return placeholderSection(t, item, "Section IFI requiert le résultat de computeIFI (non fourni)");
      const d = buildIFIData({ ifi: payload.ifi, data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pageIFI(t, d);
    }
    case "successionA": {
      if (!payload.succession) return placeholderSection(t, item, "Section Succession requiert le résultat de computeSuccession (non fourni)");
      const d = buildSuccessionAData({ succession: payload.succession, data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pageSuccessionA(t, d);
    }
    case "profil": {
      const d = buildProfilData({ mission, data: data as any, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pageProfil(t, d);
    }
    case "bilanEndettement": {
      const d = buildBilanEndettementData({ data, cabinet, ir: payload.ir, clientName: payload.clientName, dateLettre, pagePosition });
      return pageBilanEndettement(t, d);
    }
    case "successionB": {
      if (!payload.succession) return placeholderSection(t, item, "Section Succession B requiert le résultat de computeSuccession (non fourni)");
      const d = buildSuccessionBData({ succession: payload.succession, data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pageSuccessionB(t, d);
    }
    case "prevoyanceInd": {
      const d = buildPrevoyanceIndData({ data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pagePrevoyanceInd(t, d);
    }
    case "prevoyanceColl": {
      const d = buildPrevoyanceCollData({ data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      return pagePrevoyanceColl(t, d);
    }

    // ─── Sections v2 (anciennement v1-only, refondues) ──────────────
    case "cabinet": {
      const d = buildCabinetData({ cabinet, data, clientName: payload.clientName, dateLettre, pagePosition });
      return pageCabinet(t, d);
    }
    case "famille": {
      const d = buildFamilleData({ data, cabinet, ir: payload.ir, clientName: payload.clientName, dateLettre, pagePosition });
      return pageFamille(t, d);
    }
    case "travail": {
      const d = buildTravailData({ data, cabinet, ir: payload.ir, irOptions: payload.irOptions, clientName: payload.clientName, dateLettre, pagePosition });
      return pageTravail(t, d);
    }
    case "hypos": {
      const d = buildHyposData({
        data, cabinet,
        ir: payload.ir, ifi: payload.ifi, succession: payload.succession,
        hypothesisResults: payload.hypothesisResults,
        clientName: payload.clientName, dateLettre, pagePosition,
      });
      return pageHypos(t, d);
    }
    case "recommandations": {
      const d = buildRecommandationsData({ recommandations, cabinet, data, clientName: payload.clientName, dateLettre, pagePosition });
      return pageRecommandations(t, d);
    }
    case "mentions": {
      const d = buildMentionsData({ cabinet, mission, data, clientName: payload.clientName, dateLettre, pagePosition });
      return pageMentions(t, d);
    }
  }
}

/** Placeholder visible pour les sections pas encore câblées ou qui manquent
 *  une donnée requise. Optionnel `customMessage` pour préciser la raison. */
function placeholderSection(t: any, item: PackItem, customMessage?: string): string {
  const message = customMessage ||
    "Cette section est sélectionnée dans le pack mais son adapter v2 n'est pas encore branché. Elle sera disponible dans une prochaine itération du Lot Dossier client.";
  return `<div style="position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;font-family:'Lato',system-ui,sans-serif">
    <div style="text-align:center;padding:40px;max-width:500px">
      <div style="font-size:48px;margin-bottom:18px;opacity:.3">📄</div>
      <div style="font-size:14px;font-weight:700;color:${t.navy};margin-bottom:8px">Section « ${item} » en attente de câblage</div>
      <div style="font-size:11px;color:${t.texteFaible};line-height:1.6">${message}</div>
    </div>
  </div>`;
}

/** Assemble le pack complet et ouvre la popup print. */
export function generatePack(
  packItems: PackItem[],
  overrides: PackOverrides,
  payload: PackPayload,
): void {
  if (packItems.length === 0) return;

  // Ordre canonique : bilan AVANT docs réglementaires
  const ordered = sortPack(packItems);

  // Résolution du thème selon override
  const themeV2 = resolveTheme(payload.cabinet, overrides);

  // Override lieu signature : injecté dans le payload mission temporairement
  const missionWithOverride = overrides.lieuSignatureOverride
    ? { ...payload.mission, lieuSignature: overrides.lieuSignatureOverride }
    : payload.mission;
  const payloadFinal = { ...payload, mission: missionWithOverride };

  // Rendu de chaque item — pagination "X / N" calculée ici (N = total sections du pack).
  const total = ordered.length;
  const bodies = ordered
    .map((item, idx) => renderItemBody(item, payloadFinal, themeV2, { index: idx + 1, total }))
    .filter(Boolean)
    .join("");

  // Assemblage final via coquilleDocument (header html + fonts + CSS + body)
  const t = buildTokens(themeV2.theme, themeV2.cabinetColors);
  const html = coquilleDocument(t, {
    titre: `Pack PDF — ${payload.clientName || "Dossier client"} — ${ordered.length} document(s)`,
    body: bodies,
  });

  openPrintPopup(html);
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
