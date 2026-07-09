// ─── Lot Dossier client — rendu des BODY HTML d'un pack PDF ───────────
//
// Prend une liste ordonnée d'éléments cochés (PackItem[]) + les overrides
// per-dossier (palette PDF, lieu signature) et génère pour chaque item le
// BODY HTML (sans <html><head><style>), dans l'ordre PACK_ORDER (bilan AVANT
// docs réglementaires). Ces bodies sont consommés par le moteur paged.js
// (feeder / ApercuPdf) via renderPackItemBodies ; resolvePackTokens partage
// la même palette v2.
//
// Cohabitation CSS v1+v2 : certaines sections portent des classes v1 et v2
// pouvant se chevaucher (.kpi notamment) — à surveiller au test visuel.

import type { PackItem } from "./checkCompletude";
import { sortPack } from "./checkCompletude";
import { mapCabinetToThemeV2, type ThemeV2 } from "../adapters/mapTheme";
import { buildTokens } from "../tokens";

// ─── Renderers v2 ─────────────────────────────────────────────────────
// Docs réglementaires (4) + 5 sections bilan câblées en 1ère passe.
// Les 6 autres sections (cabinet/famille/travail/hypos/recos/mentions +
// bilanEndettement/successionB/prevoyanceColl) restent en
// placeholder pour une 2ème passe.
import { pageLettreMission } from "../pages/pageLettreMission";
import { pageDer } from "../pages/pageDer";
import { pageDerAnnexe } from "../pages/pageDerAnnexe";
import { pageFicheDDA } from "../pages/pageFicheDDA";
import { pageDeclarationAdequation } from "../pages/pageDeclarationAdequation";
import { pageCouverture } from "../pages/pageCouverture";
import { pageIR } from "../pages/pageIR";
import { pageIFI } from "../pages/pageIFI";
import { pageSuccessionA } from "../pages/pageSuccessionA";
import { pageSuccessionB } from "../pages/pageSuccessionB";
import { pageCapitauxDeces } from "../pages/pageCapitauxDeces";
import { pageProfil } from "../pages/pageProfil";
import { pageBilanEndettement } from "../pages/pageBilanEndettement";
import { pagePrevoyancePerso } from "../pages/pagePrevoyancePerso";
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
import { buildCapitauxDecesData } from "../adapters/buildCapitauxDecesData";
import { buildProfilData } from "../adapters/buildProfilData";
import { buildBilanEndettementData } from "../adapters/buildBilanEndettementData";
import { buildPrevoyancePersoData } from "../adapters/buildPrevoyancePersoData";
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
  /** Logo cabinet (data URL ou URL) — affiché sur la page de couverture. */
  logoSrc?: string;
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
    case "derAnnexe": {
      // Mirror exact du case "der" mais appelant pageDerAnnexe : même DerPageData
      // (via buildDerData), section séparée portant data-pdf-doc=DOC_DER (compteur
      // X/N commun). Auto-incluse après "der" par renderPackItemBodies (LOT 1).
      const d = buildDerData({ cabinet, dateLettre });
      return pageDerAnnexe(t, d);
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
      const d = buildCouvertureData({ cabinet, data, recipient: payload.recipient, clientName: payload.clientName, dateLettre, logoSrc: payload.logoSrc });
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
    case "capitauxDeces": {
      // Section informative (capitaux décès exonérés + rentes de survie). Garde
      // succession : sans computeSuccession → exclu du pack (corps vide, PAS un
      // placeholder bavard). Idem si aucun capital/rente n'existe → corps vide → exclu.
      if (!payload.succession) return "";
      const d = buildCapitauxDecesData({ succession: payload.succession, data, cabinet, clientName: payload.clientName, dateLettre, pagePosition });
      const vide = d.caisses.length === 0 && d.prives.length === 0 && d.branche.length === 0
        && d.renteEducationBranche.length === 0 && d.renteConjointBranche.length === 0 && d.rentes.length === 0;
      if (vide) return "";
      return pageCapitauxDeces(t, d);
    }
    case "prevoyancePersoP1": {
      const d = buildPrevoyancePersoData({ data, cabinet, which: "p1", clientName: payload.clientName, dateLettre, pagePosition });
      return pagePrevoyancePerso(t, d);
    }
    case "prevoyancePersoP2": {
      const d = buildPrevoyancePersoData({ data, cabinet, which: "p2", clientName: payload.clientName, dateLettre, pagePosition });
      return pagePrevoyancePerso(t, d);
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
      <div style="margin-bottom:18px;opacity:.3"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${t.navy}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>
      <div style="font-size:14px;font-weight:700;color:${t.navy};margin-bottom:8px">Section « ${item} » en attente de câblage</div>
      <div style="font-size:11px;color:${t.texteFaible};line-height:1.6">${message}</div>
    </div>
  </div>`;
}

/** Tokens v2 résolus pour ce pack (thème cabinet/encreOr + override per-dossier).
 *  Exporté pour que le moteur paged.js (feeder) partage exactement la même palette. */
export function resolvePackTokens(cabinet: Record<string, any>, overrides: PackOverrides) {
  const themeV2 = resolveTheme(cabinet, overrides);
  return buildTokens(themeV2.theme, themeV2.cabinetColors);
}

/** Rend les BODY HTML de CHAQUE section du pack (un par section, ordre canonique).
 *  Réutilise renderItemBody — aucun contenu réécrit. Consommé par le feeder
 *  paged.js (ApercuPdf). */
export function renderPackItemBodies(
  packItems: PackItem[],
  overrides: PackOverrides,
  payload: PackPayload,
): string[] {
  // Ordre canonique : bilan AVANT docs réglementaires
  const ordered = sortPack(packItems);
  const themeV2 = resolveTheme(payload.cabinet, overrides);
  // Override lieu signature : injecté dans le payload mission temporairement
  const missionWithOverride = overrides.lieuSignatureOverride
    ? { ...payload.mission, lieuSignature: overrides.lieuSignatureOverride }
    : payload.mission;
  const payloadFinal = { ...payload, mission: missionWithOverride };
  // Pagination "X / N" calculée ici (N = total sections du pack).
  const total = ordered.length;
  // Auto-inclusion derAnnexe : l'annexe Références suit "der" SANS apparaître dans
  // l'UI (PopcardImpression a une liste de cases explicite, derAnnexe n'y est pas).
  // PACK_ORDER place derAnnexe juste après "der" ; on l'insère ici à cette même
  // position. derAnnexe n'est PAS ajouté à `ordered` pour le calcul index/total →
  // ZÉRO perturbation de la numérotation des autres sections (invisibilité LOT 1 :
  // derAnnexe rend "" → non poussé).
  const autoAnnexe = ordered.includes("der") && !ordered.includes("derAnnexe");
  const out: string[] = [];
  ordered.forEach((item, idx) => {
    const body = renderItemBody(item, payloadFinal, themeV2, { index: idx + 1, total });
    if (body) out.push(body);
    if (autoAnnexe && item === "der") {
      const annexe = renderItemBody("derAnnexe", payloadFinal, themeV2, { index: idx + 1, total });
      if (annexe) out.push(annexe);
    }
  });
  return out;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
