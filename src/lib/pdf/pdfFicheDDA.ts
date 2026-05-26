// ─── PDF Fiche d'information et de conseil DDA (Lot 8c) ───────────────────
//
// Document orienté ASSURANCE (volet COA/MIA — code des assurances + DDA).
// Dépend du dossier client : consomme data (identité), mission (besoins +
// ESG) et recommandations (Lot 7) pour produire le conseil et sa
// justification rattachée à la dimension du profil.
//
// Architecture « qui peut le plus qui peut le moins » (poursuite 8a/8b) :
// - StatutFlags dérivés de cabinet.statut* → helpers Lot 5.
// - Cadre réglementaire dynamique : « DDA » pour COA seul, « MIF II + DDA »
//   si CIF coché — sans modifier ce code.
// - Si ni coa ni mia cochés → avertissement pédagogique en tête de la
//   section cadre, le document reste généré (pattern « à confirmer »).
//
// Garde-fous : aucun produit, aucun assureur, aucun ISIN nommé. Le mécanisme
// d'attachement IPID/DIC est reporté au Lot 8e (ici on cite seulement
// l'emplacement et le rappel d'obligation).

import { resolveCabinetColors, openPrintPopup } from "./pdfCore";
import { FICHE_DDA_PRESET } from "./registry";
import { referencesLegales, type StatutFlags } from "../conformite/referencesLegales";
import { vocabulaireReglementaire } from "../conformite/vocabulaire";
import {
  filterComplete,
  groupRecommandationsByDimension,
  besoinLabel,
  DIMENSIONS_LABEL,
  DIMENSIONS_ORDER,
  type Recommandation,
  type DimensionRecommandation,
} from "../conformite/recommandations";
// Lot 8e — section IPID rendue dynamique selon les pièces réellement rattachées.
import { filterByType, type PieceJointe } from "../conformite/piecesJointes";
import type { PatrimonialData } from "../../types/patrimoine";

export interface PdfFicheDDAParams {
  /** Cabinet (Lot 5 — statut*, association, médiateur…). */
  cabinet: Record<string, any>;
  /** Données client (identité, état civil…). */
  data: PatrimonialData;
  /** Mission (besoinsSante/Prev/Retraite/Epargne_*, esgPref…). */
  mission: Record<string, any>;
  /** Recommandations du Lot 7 (libellé + justification + dimension + besoinKey). */
  recommandations?: ReadonlyArray<Recommandation>;
  /** Pièces jointes IPID/DIC rattachées au dossier (Lot 8e). Vide ou absent →
   *  la section IPID affichera « IPID à remettre » au lieu de « joint en annexe ». */
  piecesJointes?: ReadonlyArray<PieceJointe>;
  /** Nom du client pour personnaliser l'en-tête. */
  clientName?: string;
  /** Logo du cabinet (sinon repli sur cabinet.logoSrc). */
  logoSrc?: string;
  /** Surcharge des sections actives (toutes par défaut). */
  sections?: Record<string, boolean>;
}

// ─── Mapping besoin → groupe d'affichage ───────────────────────────────────
const BESOINS_GROUPES: Array<{ titre: string; clefs: ReadonlyArray<string> }> = [
  { titre: "Santé",           clefs: ["besoinSante_depenses", "besoinSante_hospit", "besoinSante_depasse", "besoinSante_surcompl"] },
  { titre: "Prévoyance",      clefs: ["besoinPrev_arret", "besoinPrev_deces", "besoinPrev_fraisGen"] },
  { titre: "Retraite",        clefs: ["besoinRetraite_capital", "besoinRetraite_rente", "besoinRetraite_moderniser"] },
  { titre: "Épargne et investissement", clefs: ["besoinEpargne_valoriser", "besoinEpargne_transmettre", "besoinEpargne_completer", "besoinEpargne_projet"] },
];

export function buildAndPrintFicheDDA(params: PdfFicheDDAParams): void {
  const cabinet = params.cabinet || {};
  const data = params.data || ({} as PatrimonialData);
  const mission = params.mission || {};
  const recommandations = filterComplete(params.recommandations || []);
  // Lot 8e — pièces IPID réellement rattachées (filtre depuis params.piecesJointes).
  const ipidsRattaches = filterByType(params.piecesJointes || [], "ipid");
  const logoSrc = cabinet.logoSrc || params.logoSrc || "";

  // Nom du client pour l'en-tête.
  const p1n = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || "—";
  const p2n = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ") || "";
  const isCouple = data.coupleStatus && data.coupleStatus !== "single" && p2n !== "—" && p2n !== "";
  const clientName = params.clientName || (isCouple ? `${p1n} & ${p2n}` : p1n);

  const colors = resolveCabinetColors(cabinet);
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // Statuts → helpers Lot 5.
  const statuts: StatutFlags = {
    coa:    !!cabinet?.statutCoa,
    mia:    !!cabinet?.statutMia,
    iobsp:  !!cabinet?.statutIobsp,
    cif:    !!cabinet?.statutCif,
    carteT: !!cabinet?.statutCarteT,
  };
  const refsLegales = referencesLegales(statuts);
  const voc = vocabulaireReglementaire(statuts);
  const cadreReglementaire = voc.cadreReglementaire;
  const isAssurance = statuts.coa || statuts.mia;

  // Sections actives (toutes par défaut + surcharge optionnelle).
  const allOn: Record<string, boolean> = Object.fromEntries(FICHE_DDA_PRESET.map(id => [id, true]));
  const sections = { ...allOn, ...(params.sections || {}) };

  // ─── Besoins cochés (filtre depuis mission.besoin*) ─────────────────────
  type BesoinAffiche = { key: string; label: string };
  const besoinsParGroupe: Array<{ titre: string; items: BesoinAffiche[] }> = BESOINS_GROUPES.map(g => ({
    titre: g.titre,
    items: g.clefs
      .filter(k => mission[k] === true)
      .map(k => ({ key: k, label: besoinLabel(k).replace(/^[^—]*— /, "") })),  // on retire le préfixe ("Santé — ") car déjà dans le titre du groupe
  }));
  const aucunBesoinCoche = besoinsParGroupe.every(g => g.items.length === 0);

  // ─── Recommandations groupées par dimension ─────────────────────────────
  const recosParDim = groupRecommandationsByDimension(recommandations);

  // ─── Helpers locaux ──────────────────────────────────────────────────────
  const v = (val: any, fallback = "à confirmer"): string => {
    const s = (val === null || val === undefined) ? "" : String(val);
    return s.trim().length > 0 ? s : `<em style="color:#92400E">${fallback}</em>`;
  };

  const esgLabel = (() => {
    if (mission.esgPref === "oui") return "Intégration <strong>prioritaire</strong> des critères ESG dans les supports recommandés.";
    if (mission.esgPref === "partiel") return "Intégration <strong>partielle</strong> des critères ESG dans les supports recommandés.";
    return "<em>Aucune préférence ESG exprimée par le client.</em>";
  })();

  // ─── CSS minimal (cohérent avec pdfDER) ──────────────────────────────────
  const css = `
  @page{size:A4;margin:14mm 12mm 12mm 12mm;}
  *{box-sizing:border-box;}
  body{font-family:'Lato',-apple-system,BlinkMacSystemFont,sans-serif;font-size:9.5pt;line-height:1.55;color:${colors.navy};margin:0;}
  .page{position:relative;min-height:255mm;padding:6mm 0 14mm 0;page-break-after:always;}
  .page:last-of-type{page-break-after:auto;}
  .cover{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:255mm;text-align:center;background:linear-gradient(135deg,${colors.cream} 0%,#fff 60%);padding:30mm 12mm;}
  .cover-logo{max-height:42mm;max-width:90mm;object-fit:contain;margin-bottom:14mm;}
  .cover-title{font-size:24pt;font-weight:900;letter-spacing:-0.5px;color:${colors.navy};margin-bottom:4mm;}
  .cover-subtitle{font-size:12pt;color:${colors.sky};font-weight:600;margin-bottom:10mm;}
  .cover-bar{width:60mm;height:2px;background:${colors.gold};margin:8mm auto;}
  .cover-tagline{font-size:8.5pt;color:#666;line-height:1.7;margin-top:6mm;max-width:130mm;}
  .cover-footer{position:absolute;bottom:14mm;left:0;right:0;text-align:center;font-size:7.5pt;color:#888;}
  .page-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${colors.gold};padding:0 12mm 4mm 12mm;margin-bottom:6mm;}
  .page-header-title{font-size:13pt;font-weight:700;color:${colors.navy};}
  .page-header-client{font-size:8pt;color:#888;}
  .page-footer{position:absolute;bottom:6mm;left:12mm;right:12mm;display:flex;justify-content:space-between;font-size:7pt;color:#999;border-top:1px solid #eee;padding-top:3mm;}
  .section{margin:0 12mm 8mm 12mm;}
  .section-title{font-size:10pt;font-weight:700;color:${colors.navy};border-bottom:1px solid ${colors.gold};padding-bottom:3px;margin-bottom:6px;}
  .block{background:#fff;border:1px solid rgba(227,175,100,0.25);border-left:3px solid ${colors.gold};border-radius:6px;padding:8px 11px;margin-bottom:8px;font-size:8.5pt;line-height:1.55;color:#333;}
  .block-title{font-size:9.5pt;font-weight:700;color:${colors.navy};margin-bottom:4px;}
  .besoin-group{margin-bottom:8px;}
  .besoin-group-title{font-size:9pt;font-weight:700;color:${colors.sky};margin-bottom:3px;}
  .besoin-list{margin:0;padding-left:14px;}
  .besoin-list li{margin-bottom:2px;}
  .reco-dim{margin-bottom:9px;}
  .reco-dim-title{font-size:9pt;font-weight:700;color:${colors.navy};border-bottom:1px dashed rgba(227,175,100,0.5);padding-bottom:2px;margin-bottom:4px;}
  .reco-card{background:#fff;border:1px solid rgba(227,175,100,0.25);border-left:3px solid ${colors.gold};border-radius:5px;padding:6px 9px;margin-bottom:5px;page-break-inside:avoid;break-inside:avoid;}
  .reco-libelle{font-size:9pt;font-weight:700;color:${colors.navy};margin-bottom:2px;}
  .reco-justif{font-size:8pt;color:#555;line-height:1.5;}
  .reco-link{font-size:7.5pt;color:${colors.sky};margin-top:3px;font-style:italic;}
  .alerte{background:rgba(146,64,14,0.08);border-left:3px solid #92400E;border-radius:4px;padding:6px 10px;margin-bottom:8px;font-size:8pt;color:#92400E;line-height:1.5;}
  .portee{margin:6mm 12mm 0 12mm;font-size:7pt;color:#92400E;line-height:1.5;background:rgba(146,64,14,0.05);border-left:3px solid rgba(146,64,14,0.35);padding:6px 10px;border-radius:4px;}
  a{color:${colors.sky};text-decoration:none;}
  @media print{
    .block,.reco-card,.besoin-group{page-break-inside:avoid;break-inside:avoid;}
  }`;

  const pH = (title: string) =>
    `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName} · ${dateStr}</div></div>`;
  const pF = (label: string) =>
    `<div class="page-footer"><span>${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · ${label}</span><span>${dateStr}</span></div>`;

  // ─── Cover ──────────────────────────────────────────────────────────────
  const cover = `<div class="page cover">
    ${logoSrc?`<img src="${logoSrc}" alt="${cabinet.cabinetName||""}" class="cover-logo"/>`:""}
    <div class="cover-title">Fiche d'information et de conseil</div>
    <div class="cover-subtitle">Distribution d'assurance — ${cadreReglementaire}</div>
    <div class="cover-bar"></div>
    <div style="font-size:9pt;color:${colors.navy};font-weight:600;margin-top:6mm;">Remise à : ${clientName}</div>
    <div style="font-size:9pt;color:#666;margin-top:2mm;">${dateStr}</div>
    <div class="cover-tagline">
      Document remis préalablement à la conclusion d'un contrat d'assurance, conformément aux articles <strong>L.521-2 et L.521-4 du Code des assurances</strong>. Il formalise les exigences et besoins exprimés ainsi que le conseil délivré et sa justification.
    </div>
    <div class="cover-footer">${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Document confidentiel · ${dateStr}</div>
  </div>`;

  // ─── Section identite ──────────────────────────────────────────────────
  const pageIdentite = sections.identite ? `<div class="section">
    <div class="section-title">Client(s) — identité et état civil</div>
    <div class="block">
      <div class="block-title">Personne 1</div>
      <p>Identité : <strong>${p1n}</strong></p>
      ${data.person1NomNaissance?`<p>Nom de naissance : ${data.person1NomNaissance}</p>`:""}
      ${data.person1BirthDate?`<p>Date de naissance : ${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}${data.person1LieuNaissance?` à ${data.person1LieuNaissance}`:""}</p>`:""}
      ${data.person1Nationalite?`<p>Nationalité : ${data.person1Nationalite}</p>`:""}
      ${data.person1JobTitle?`<p>Profession : ${data.person1JobTitle}</p>`:""}
    </div>
    ${isCouple ? `<div class="block">
      <div class="block-title">Personne 2</div>
      <p>Identité : <strong>${p2n}</strong></p>
      ${data.person2NomNaissance?`<p>Nom de naissance : ${data.person2NomNaissance}</p>`:""}
      ${data.person2BirthDate?`<p>Date de naissance : ${new Date(data.person2BirthDate).toLocaleDateString("fr-FR")}${data.person2LieuNaissance?` à ${data.person2LieuNaissance}`:""}</p>`:""}
      ${data.person2Nationalite?`<p>Nationalité : ${data.person2Nationalite}</p>`:""}
      ${data.person2JobTitle?`<p>Profession : ${data.person2JobTitle}</p>`:""}
    </div>` : ""}
  </div>` : "";

  // ─── Section besoins ────────────────────────────────────────────────────
  const pageBesoins = sections.besoins ? `<div class="section">
    <div class="section-title">Exigences et besoins exprimés (art. L.521-4)</div>
    <div class="block">
      ${aucunBesoinCoche
        ? `<p><em style="color:#92400E">Aucun besoin coché dans le formulaire de mission. À compléter dans l'onglet « Lettre de mission » pour produire la fiche de conseil DDA.</em></p>`
        : besoinsParGroupe.filter(g => g.items.length > 0).map(g => `
          <div class="besoin-group">
            <div class="besoin-group-title">${g.titre}</div>
            <ul class="besoin-list">
              ${g.items.map(it => `<li>${it.label}</li>`).join("")}
            </ul>
          </div>`).join("")
      }
    </div>
  </div>` : "";

  // ─── Section conseil (recommandations groupées par dimension) ───────────
  const renderRecoCard = (r: Recommandation) => `
    <div class="reco-card">
      <div class="reco-libelle">${r.libelle}</div>
      <div class="reco-justif">${r.justification}</div>
      ${r.besoinKey ? `<div class="reco-link">Lié au besoin : ${besoinLabel(r.besoinKey)}</div>` : ""}
    </div>`;
  const renderRecoGroupe = (dim: DimensionRecommandation) => {
    const items = recosParDim[dim];
    if (!items || items.length === 0) return "";
    return `<div class="reco-dim">
      <div class="reco-dim-title">${DIMENSIONS_LABEL[dim]}</div>
      ${items.map(renderRecoCard).join("")}
    </div>`;
  };
  const recosHtml = recommandations.length === 0
    ? `<p><em style="color:#92400E">Aucune recommandation enregistrée pour ce dossier. À saisir dans l'onglet « Lettre de mission » → bloc « Recommandations & plan d'action ».</em></p>`
    : DIMENSIONS_ORDER.map(renderRecoGroupe).filter(Boolean).join("");
  const pageConseil = sections.conseil ? `<div class="section">
    <div class="section-title">Conseil fourni et justification (art. L.521-4 II)</div>
    <div class="block">
      <p style="margin-bottom:6px;font-size:8pt;color:#666;">Chaque recommandation se rattache à une <strong>dimension du profil</strong> (besoin exprimé, tolérance au risque, ESG, capacité à subir des pertes). Le conseil est raisonné <strong>besoin / garantie</strong> ; aucun produit ni assureur n'est nommé à ce stade.</p>
      ${recosHtml}
    </div>
  </div>` : "";

  // ─── Section IPID (assurance non-vie) ──────────────────────────────────
  // Lot 8e — wording DYNAMIQUE selon les pièces réellement rattachées :
  //   • 0 IPID dans piecesJointes → « IPID à remettre » (état non joint)
  //   • ≥ 1 IPID → « IPID joint en annexe — N pièce(s) : <noms> »
  const ipidStatusHtml = ipidsRattaches.length === 0
    ? `<p style="margin-top:5px;font-style:italic;color:#92400E;"><strong>IPID à remettre</strong> (non joint à ce jour) — le client doit recevoir l'IPID préalablement à la souscription. Rattacher la pièce dans l'onglet « Lettre de mission » → bloc « Pièces jointes ».</p>`
    : `<p style="margin-top:5px;font-style:italic;color:#0F5132;"><strong>IPID joint en annexe</strong> — ${ipidsRattaches.length} pièce${ipidsRattaches.length > 1 ? "s" : ""} : ${ipidsRattaches.map(p => p.nom).join(", ")}.</p>`;
  const pageIpid = sections.ipid ? `<div class="section">
    <div class="section-title">Documents IPID — assurance non-vie</div>
    <div class="block">
      <p>Pour chaque contrat d'assurance <strong>non-vie</strong> recommandé (santé, prévoyance hors décès, dommages…), le <strong>Document d'Information sur le Produit d'Assurance (IPID)</strong> doit être remis au client préalablement à la souscription, conformément à l'article <strong>L.112-2 II du Code des assurances</strong>.</p>
      <p style="margin-top:5px;">Format : document standardisé court (2 pages maximum), structuré selon le règlement d'exécution (UE) 2017/1469.</p>
      ${ipidStatusHtml}
    </div>
  </div>` : "";

  // ─── Section adequation (vie/IBIP + ESG) ───────────────────────────────
  const pageAdequation = sections.adequation ? `<div class="section">
    <div class="section-title">Adéquation renforcée (assurance-vie / IBIP) et durabilité (ESG)</div>
    <div class="block">
      <div class="block-title">Adéquation renforcée — produits d'investissement basés sur l'assurance (IBIP)</div>
      <p>Pour tout contrat d'assurance comportant un volet d'investissement (assurance-vie en unités de compte, contrat de capitalisation, PER assurantiel…), la <strong>recommandation est encadrée par l'art. L.522-5 du Code des assurances</strong> (devoir de conseil renforcé) qui exige la vérification :</p>
      <ul style="margin-top:4px;padding-left:14px;">
        <li>de l'<strong>adéquation</strong> entre le contrat proposé et les exigences/besoins du client ;</li>
        <li>de la <strong>cohérence</strong> avec le profil investisseur (tolérance au risque, capacité à subir des pertes, horizon de placement) ;</li>
        <li>du respect des <strong>préférences ESG</strong> exprimées (cf. ci-dessous).</li>
      </ul>
    </div>
    <div class="block">
      <div class="block-title">Préférences en matière de durabilité (ESG) — ${cadreReglementaire}</div>
      <p>${esgLabel}</p>
      <p style="margin-top:5px;font-size:7.5pt;color:#666;">Cadre : règlement délégué (UE) 2017/2359 modifié — exigences de durabilité applicables à la distribution d'assurance depuis le 2 août 2022.</p>
    </div>
  </div>` : "";

  // ─── Section cadre (références légales + avertissement si !assurance) ──
  const refsLegalesHtml = refsLegales.length > 0
    ? refsLegales.map(r => `<li><strong>${r.code}</strong> · ${r.article} — ${r.libelle}${r.note?` <em style="color:#92400E">(${r.note})</em>`:""}</li>`).join("")
    : `<li><em style="color:#92400E">Statuts ORIAS à renseigner dans Paramètres → Statuts &amp; conformité.</em></li>`;
  const avertissementSansAssurance = !isAssurance ? `<div class="alerte">
    <strong>Document non applicable en l'état :</strong> la fiche d'information et de conseil DDA s'adresse aux intermédiaires en assurance (statut COA ou MIA). Les statuts ORIAS du cabinet doivent être complétés dans <strong>Paramètres → Statuts &amp; conformité</strong> pour que ce document soit pleinement opposable.
  </div>` : "";
  const pageCadre = sections.cadre ? `<div class="section">
    <div class="section-title">Cadre réglementaire et références légales</div>
    ${avertissementSansAssurance}
    <div class="block">
      <p>Cette fiche est établie conformément aux obligations ${cadreReglementaire} applicables au cabinet ${cabinet.cabinetName||"Ploutos"}, en sa qualité d'intermédiaire en assurance${statuts.cif?" et de conseiller en investissements financiers":""}.</p>
      <p style="margin-top:6px;">Références légales applicables — <em>calculées d'après les statuts du cabinet</em> :</p>
      <ul style="margin-top:4px;padding-left:14px;font-size:8.5pt;line-height:1.7;">
        ${refsLegalesHtml}
      </ul>
      <p style="margin-top:6px;font-size:7.5pt;color:#666;">Autorité de tutelle : <strong>ACPR</strong> (4 place de Budapest, 75436 Paris Cedex 09)${statuts.cif?` ; <strong>AMF</strong> pour le volet CIF (17 place de la Bourse, 75082 Paris Cedex 02)`:""}.</p>
    </div>
  </div>` : "";

  // ─── Assemblage des pages ────────────────────────────────────────────────
  // Pour rester lisible, on regroupe : page 1 = cover, page 2 = identite +
  // besoins + conseil, page 3 = ipid + adequation + cadre + portée.
  const page1 = `<div class="page">
    ${pH("Identité, besoins et conseil")}
    ${pageIdentite}
    ${pageBesoins}
    ${pageConseil}
    ${pF("Fiche d'information et de conseil DDA")}
  </div>`;
  const page2 = `<div class="page">
    ${pH("IPID, adéquation et cadre réglementaire")}
    ${pageIpid}
    ${pageAdequation}
    ${pageCadre}
    <div class="portee">
      <strong>Portée du document — Ploutos (Ecopatrimoine).</strong> Ce document est généré pour vous aider à respecter vos obligations de conformité. Il ne constitue ni une attestation, ni une garantie d'exhaustivité réglementaire. Le conseiller reste seul responsable de la cohérence des mentions avec sa situation et le référentiel de son association professionnelle.
    </div>
    ${pF("Fiche d'information et de conseil DDA")}
  </div>`;

  const pages = cover + page1 + page2;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Fiche conseil DDA — ${clientName}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

  openPrintPopup(html);
}
