// ─── PDF Déclaration d'adéquation (Lot 8d) ─────────────────────────────────
//
// Document le plus exigeant du Lot 8 : il JUSTIFIE le conseil et RELIE
// chaque recommandation aux infos KYC (besoin + dimension du profil).
//
// Architecture « qui peut le plus qui peut le moins » (poursuit 8a/8b/8c) :
//   • Tous les helpers déjà construits sont RÉUTILISÉS : pas de redéfinition.
//   • Cadre via vocabulaireReglementaire (DDA pour COA seul, MIF II + DDA
//     si CIF coché — L.522-x pour IBIP via le bloc références dynamique).
//   • Date ET HEURE paramétrables (dateGeneration) → snapshots déterministes.
//
// Règle de validité (CRITIQUE) : sans recommandation justifiée, pas
// d'adéquation valable → bandeau « NON VALIDE » + matrice supprimée +
// coûts/frais grisés. Pas de document vide qui ferait illusion.
//
// Conformité : aucun produit, aucun assureur, aucun ISIN. On relie
// besoin/garantie au profil, pas un produit.

import { resolveCabinetColors, openPrintPopup } from "./pdfCore";
import { ADEQUATION_PRESET } from "./registry";
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
import { computeProfilRisque, PONDERATION_HORIZON } from "../conformite/profil";
import { computeCapacitePerte } from "../conformite/capacitePerte";
import type { PatrimonialData } from "../../types/patrimoine";

export interface PdfAdequationParams {
  /** Cabinet (Lot 5 — statut*, rémunération, médiateur…). */
  cabinet: Record<string, any>;
  /** Données client (KYC patrimoniales). */
  data: PatrimonialData;
  /** Mission (besoins + ESG + horizon + questionnaire risque). */
  mission: Record<string, any>;
  /** Recommandations du Lot 7. */
  recommandations?: ReadonlyArray<Recommandation>;
  /** Nom du client pour personnaliser l'en-tête. */
  clientName?: string;
  /** Logo du cabinet (sinon repli sur cabinet.logoSrc). */
  logoSrc?: string;
  /** Date+heure de génération — paramétrable pour testabilité (snapshots
   *  déterministes). Si absent, new Date() est utilisé. */
  dateGeneration?: Date;
  /** Surcharge des sections actives (toutes par défaut). */
  sections?: Record<string, boolean>;
}

// ─── Libellés humains du bloc Horizon (cohérent avec PONDERATION_HORIZON) ──
const HORIZON_LABELS: Record<string, string> = {
  "0-4":  "Court terme (0 à 4 ans)",
  "5-8":  "Moyen terme (5 à 8 ans)",
  "9-15": "Long terme (9 à 15 ans)",
  "15+":  "Très long terme (plus de 15 ans)",
};

export function buildAndPrintAdequation(params: PdfAdequationParams): void {
  const cabinet = params.cabinet || {};
  const data = params.data || ({} as PatrimonialData);
  const mission = params.mission || {};
  const recommandations = filterComplete(params.recommandations || []);
  const logoSrc = cabinet.logoSrc || params.logoSrc || "";

  // Date+heure : paramétrable pour testabilité.
  const dateGen = params.dateGeneration || new Date();
  const dateStr = dateGen.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const heureStr = dateGen.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // Nom du client.
  const p1n = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || "—";
  const p2n = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ") || "";
  const isCouple = data.coupleStatus && data.coupleStatus !== "single" && p2n;
  const clientName = params.clientName || (isCouple ? `${p1n} & ${p2n}` : p1n);

  const colors = resolveCabinetColors(cabinet);

  // Helpers Lot 5.
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

  // Profil (Lot 6/6bis).
  const profilScore = computeProfilRisque(mission);
  const profilLabel = profilScore.profil.charAt(0).toUpperCase() + profilScore.profil.slice(1);
  const horizonLabel = mission.horizon ? (HORIZON_LABELS[mission.horizon as string] || mission.horizon) : "non renseigné";
  const horizonPts = PONDERATION_HORIZON[mission.horizon as keyof typeof PONDERATION_HORIZON] ?? 0;

  // Capacité de perte (Lot 6).
  const capacite = computeCapacitePerte(data);

  // Sections actives.
  const allOn: Record<string, boolean> = Object.fromEntries(ADEQUATION_PRESET.map(id => [id, true]));
  const sections = { ...allOn, ...(params.sections || {}) };

  // ─── RÈGLE DE VALIDITÉ : sans reco complète, état dégradé explicite ──────
  const isDegraded = recommandations.length === 0;

  // ─── Recommandations regroupées par dimension ────────────────────────────
  const recosParDim = groupRecommandationsByDimension(recommandations);

  // ─── Helpers locaux ──────────────────────────────────────────────────────
  const v = (val: any, fallback = "à confirmer"): string => {
    const s = (val === null || val === undefined) ? "" : String(val);
    return s.trim().length > 0 ? s : `<em style="color:#92400E">${fallback}</em>`;
  };

  const esgLabelText = (() => {
    if (mission.esgPref === "oui") return "Intégration prioritaire des critères ESG";
    if (mission.esgPref === "partiel") return "Intégration partielle des critères ESG";
    return "Pas de préférence ESG exprimée";
  })();

  const remunerationLabel = (() => {
    if (cabinet.remunerationType === "honoraire") return "Honoraires payés directement par le client";
    if (cabinet.remunerationType === "mixte") return "Combinaison commission + honoraires";
    return "Commission versée par l'assureur (incluse dans la prime)";
  })();

  const periodiciteRevue = cabinet.periodiciteRevue || "annuelle";

  // ─── CSS ─────────────────────────────────────────────────────────────────
  const css = `
  @page{size:A4;margin:14mm 12mm 12mm 12mm;}
  *{box-sizing:border-box;}
  body{font-family:'Lato',-apple-system,BlinkMacSystemFont,sans-serif;font-size:9.5pt;line-height:1.55;color:${colors.navy};margin:0;}
  .page{position:relative;min-height:255mm;padding:6mm 0 14mm 0;page-break-after:always;}
  .page:last-of-type{page-break-after:auto;}
  .cover{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:255mm;text-align:center;background:linear-gradient(135deg,${colors.cream} 0%,#fff 60%);padding:30mm 12mm;}
  .cover-logo{max-height:42mm;max-width:90mm;object-fit:contain;margin-bottom:14mm;}
  .cover-title{font-size:24pt;font-weight:900;letter-spacing:-0.5px;color:${colors.navy};margin-bottom:4mm;}
  .cover-subtitle{font-size:12pt;color:${colors.sky};font-weight:600;margin-bottom:8mm;}
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
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;}
  .kpi{background:#fff;border:1px solid rgba(227,175,100,0.25);border-radius:6px;padding:7px 9px;text-align:center;}
  .kpi-label{font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
  .kpi-value{font-size:11pt;font-weight:700;color:${colors.navy};}
  .kpi-sub{font-size:7pt;color:#666;margin-top:2px;}
  table.matrice{width:100%;border-collapse:collapse;font-size:8pt;}
  table.matrice th{background:${colors.navy};color:#fff;text-align:left;padding:6px 8px;font-weight:700;border:1px solid ${colors.navy};}
  table.matrice td{padding:6px 8px;border:1px solid #ddd;vertical-align:top;background:#fff;page-break-inside:avoid;break-inside:avoid;}
  table.matrice tr:nth-child(even) td{background:rgba(227,175,100,0.05);}
  .dim-header td{background:${colors.gold}20!important;font-weight:700;color:${colors.navy};font-size:8.5pt;}
  .non-valide{background:#FEE2E2;border:2px solid #DC2626;border-radius:6px;padding:10px 12px;margin:0 12mm 10mm 12mm;font-size:9.5pt;color:#991B1B;line-height:1.5;}
  .non-valide-title{font-size:11pt;font-weight:900;margin-bottom:4px;}
  .deg-grise{opacity:0.45;pointer-events:none;}
  .mention-reg{font-size:8pt;color:#666;font-style:italic;line-height:1.5;}
  .portee{margin:6mm 12mm 0 12mm;font-size:7pt;color:#92400E;line-height:1.5;background:rgba(146,64,14,0.05);border-left:3px solid rgba(146,64,14,0.35);padding:6px 10px;border-radius:4px;}
  a{color:${colors.sky};text-decoration:none;}
  @media print{
    .block,table.matrice tr,.kpi{page-break-inside:avoid;break-inside:avoid;}
  }`;

  const pH = (title: string) =>
    `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName} · ${dateStr} ${heureStr}</div></div>`;
  const pF = (label: string) =>
    `<div class="page-footer"><span>${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · ${label}</span><span>${dateStr} ${heureStr}</span></div>`;

  // ─── Cover ──────────────────────────────────────────────────────────────
  const cover = `<div class="page cover">
    ${logoSrc?`<img src="${logoSrc}" alt="${cabinet.cabinetName||""}" class="cover-logo"/>`:""}
    <div class="cover-title">Déclaration d'adéquation</div>
    <div class="cover-subtitle">${cadreReglementaire}</div>
    <div class="cover-bar"></div>
    <div style="font-size:9pt;color:${colors.navy};font-weight:600;margin-top:6mm;">Remise à : ${clientName}</div>
    <div style="font-size:9pt;color:#666;margin-top:2mm;">le ${dateStr} à ${heureStr}</div>
    <div class="cover-tagline">
      Document remis ${isDegraded ? "<strong>à titre informatif uniquement</strong>" : "<strong>préalablement à toute opération</strong>"}, conformément aux obligations ${cadreReglementaire}. Justifie en quoi le conseil délivré correspond aux objectifs, à l'horizon, à la tolérance au risque, à la capacité à subir des pertes et aux préférences de durabilité (ESG) du client.
    </div>
    <div style="margin-top:8mm;font-size:8.5pt;color:${colors.sky};font-weight:600;">Document remis MÊME SANS TRANSACTION effective.</div>
    <div class="cover-footer">${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Document confidentiel · ${dateStr} ${heureStr}</div>
  </div>`;

  // ─── Bandeau état dégradé (cas 0 recommandation) ────────────────────────
  const bandeauDegrade = isDegraded ? `<div class="non-valide">
    <div class="non-valide-title">⚠ Déclaration d'adéquation NON VALIDE</div>
    <p>Aucune recommandation justifiée n'a été saisie pour ce dossier. Une déclaration d'adéquation opposable nécessite au moins une recommandation rattachée à une dimension du profil (besoin / risque / ESG / capacité de perte).</p>
    <p style="margin-top:4px;font-size:8.5pt;">Saisir les recommandations dans l'onglet <strong>Lettre de mission</strong> → bloc <strong>Recommandations &amp; plan d'action</strong>, puis régénérer ce document.</p>
  </div>` : "";

  // ─── Section entete (mentions réglementaires) ───────────────────────────
  const pageEntete = sections.entete ? `<div class="section">
    <div class="section-title">En-tête réglementaire</div>
    <div class="block">
      <p><strong>Date et heure de remise :</strong> le ${dateStr} à ${heureStr}.</p>
      <p style="margin-top:4px;"><strong>Remise même sans transaction :</strong> le présent document est remis au client préalablement à toute opération, y compris si aucune transaction n'est conclue à l'issue de la mission.</p>
      <p style="margin-top:4px;"><strong>Suivi périodique :</strong> ce conseil fait l'objet d'un suivi périodique (revue ${periodiciteRevue}${cabinet.periodiciteRevue ? "" : " — à confirmer"}) au cours duquel l'adéquation est réévaluée à la lumière des évolutions de votre situation.</p>
    </div>
  </div>` : "";

  // ─── Section profil synthèse (4 KPI) ────────────────────────────────────
  const pageProfilSynthese = sections.profilSynthese ? `<div class="section">
    <div class="section-title">Synthèse du profil KYC (issue du questionnaire de mission)</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Tolérance au risque</div>
        <div class="kpi-value">${profilLabel}</div>
        <div class="kpi-sub">Score : ${profilScore.scoreRisque} / ${profilScore.totalMax - 4} pts (hors ESG)</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Horizon</div>
        <div class="kpi-value">${horizonLabel}</div>
        <div class="kpi-sub">+${horizonPts} pts</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Capacité à subir des pertes</div>
        <div class="kpi-value">${capacite.niveau}</div>
        <div class="kpi-sub">${Math.round(capacite.ratioMois)} mois de coussin liquide</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Préférence ESG</div>
        <div class="kpi-value">${(mission.esgPref || "non").toUpperCase()}</div>
        <div class="kpi-sub">Sous-score : ${profilScore.sousScoreESG} / 4 pts</div>
      </div>
    </div>
    ${capacite.justification.length > 0 ? `<div class="block" style="font-size:8pt;">
      <div class="block-title">Détail capacité à subir des pertes</div>
      <ul style="margin:0;padding-left:14px;">
        ${capacite.justification.map(j => `<li>${j}</li>`).join("")}
      </ul>
    </div>` : ""}
  </div>` : "";

  // ─── Section besoinsKyc ──────────────────────────────────────────────────
  const besoinsCoches = Object.keys(mission)
    .filter(k => k.startsWith("besoin") && mission[k] === true)
    .map(k => besoinLabel(k))
    .filter(label => label);
  const pageBesoinsKyc = sections.besoinsKyc ? `<div class="section">
    <div class="section-title">Rappel des besoins exprimés (KYC)</div>
    <div class="block">
      ${besoinsCoches.length > 0
        ? `<ul style="margin:0;padding-left:14px;">${besoinsCoches.map(b => `<li>${b}</li>`).join("")}</ul>`
        : `<p><em style="color:#92400E">Aucun besoin coché dans la mission — à compléter dans l'onglet Lettre de mission.</em></p>`
      }
    </div>
  </div>` : "";

  // ─── Section matrice profil/besoin → reco (cœur du 8d) ──────────────────
  const renderMatriceLignes = () => {
    if (isDegraded) return "";
    const lignes: string[] = [];
    for (const dim of DIMENSIONS_ORDER) {
      const items = recosParDim[dim];
      if (!items || items.length === 0) continue;
      // En-tête de dimension
      lignes.push(`<tr class="dim-header"><td colspan="4">${DIMENSIONS_LABEL[dim]}</td></tr>`);
      // Lignes de recommandations
      for (const r of items) {
        const lienKyc = r.besoinKey ? besoinLabel(r.besoinKey) : "—";
        lignes.push(`<tr>
          <td><strong>${r.libelle}</strong></td>
          <td style="white-space:nowrap;">${DIMENSIONS_LABEL[dim]}</td>
          <td>${lienKyc}</td>
          <td>${r.justification}</td>
        </tr>`);
      }
    }
    return lignes.join("");
  };
  const pageMatrice = (sections.matrice && !isDegraded) ? `<div class="section">
    <div class="section-title">Matrice profil/besoin → recommandation justifiée</div>
    <p class="mention-reg" style="margin-bottom:6px;">Chaque recommandation est rattachée à une dimension du profil et reliée, le cas échéant, à un besoin KYC explicite. La justification rappelle la cohérence entre le conseil délivré et les informations recueillies sur le client.</p>
    <table class="matrice">
      <thead>
        <tr>
          <th style="width:25%">Recommandation</th>
          <th style="width:18%">Dimension du profil</th>
          <th style="width:22%">Lien KYC (besoin)</th>
          <th style="width:35%">Justification</th>
        </tr>
      </thead>
      <tbody>
        ${renderMatriceLignes()}
      </tbody>
    </table>
  </div>` : "";

  // ─── Section coûts et frais (grisée si dégradé) ─────────────────────────
  const pageCoutsFrais = sections.coutsFrais ? `<div class="section${isDegraded ? " deg-grise" : ""}">
    <div class="section-title">Coûts, frais et impact durabilité</div>
    <div class="block">
      <div class="block-title">Mode de rémunération du cabinet</div>
      <p>${remunerationLabel}.</p>
      ${cabinet.baremeHonoraires ? `<p style="margin-top:4px;">Barème d'honoraires : <strong>${cabinet.baremeHonoraires}</strong>.</p>` : `<p style="margin-top:4px;">Barème d'honoraires : ${v(cabinet.baremeHonoraires)}.</p>`}
    </div>
    <div class="block">
      <div class="block-title">Impact des frais sur la performance</div>
      <p>Les frais (frais d'entrée, frais de gestion, frais d'arbitrage, le cas échéant) sont communiqués au client avant toute souscription, dans les documents précontractuels du contrat retenu (DIC / IPID). Leur impact sur la performance nette à long terme est explicité au moment de la souscription.</p>
    </div>
    <div class="block">
      <div class="block-title">Préférence en matière de durabilité (ESG)</div>
      <p>${esgLabelText}. Les recommandations émises tiennent compte de cette préférence et privilégient, le cas échéant, des supports labellisés ISR ou article 8/9 SFDR.</p>
    </div>
  </div>` : "";

  // ─── Section suivi périodique ───────────────────────────────────────────
  const pageSuivi = sections.suivi ? `<div class="section">
    <div class="section-title">Modalités de suivi périodique</div>
    <div class="block">
      <p>Conformément à l'article L.522-5 III du Code des assurances${statuts.cif ? " et au RG AMF (volet CIF)" : ""}, le cabinet s'engage à :</p>
      <ul style="margin-top:4px;padding-left:14px;">
        <li>réévaluer l'adéquation du conseil au minimum à fréquence <strong>${periodiciteRevue}</strong>${cabinet.periodiciteRevue ? "" : " (à confirmer)"} ;</li>
        <li>solliciter du client la mise à jour des informations KYC si une évolution significative de sa situation est portée à notre connaissance ;</li>
        <li>tenir à disposition du client un compte-rendu de chaque revue.</li>
      </ul>
    </div>
  </div>` : "";

  // ─── Section cadre réglementaire ────────────────────────────────────────
  const refsLegalesHtml = refsLegales.length > 0
    ? refsLegales.map(r => `<li><strong>${r.code}</strong> · ${r.article} — ${r.libelle}${r.note?` <em style="color:#92400E">(${r.note})</em>`:""}</li>`).join("")
    : `<li><em style="color:#92400E">Statuts ORIAS à renseigner dans Paramètres → Statuts &amp; conformité.</em></li>`;
  const pageCadre = sections.cadre ? `<div class="section">
    <div class="section-title">Cadre réglementaire et références légales</div>
    <div class="block">
      <p>Cette déclaration d'adéquation est établie conformément aux obligations ${cadreReglementaire} applicables à l'activité du cabinet ${cabinet.cabinetName||"Ploutos"}${statuts.cif?" (intermédiaire en assurance et conseiller en investissements financiers)":statuts.coa||statuts.mia?" (intermédiaire en assurance)":""}.</p>
      <p style="margin-top:6px;">Références applicables :</p>
      <ul style="margin-top:4px;padding-left:14px;font-size:8.5pt;line-height:1.7;">
        ${refsLegalesHtml}
      </ul>
    </div>
  </div>` : "";

  // ─── Assemblage des pages ────────────────────────────────────────────────
  const page1 = `<div class="page">
    ${pH("Déclaration d'adéquation — En-tête et profil")}
    ${bandeauDegrade}
    ${pageEntete}
    ${pageProfilSynthese}
    ${pageBesoinsKyc}
    ${pF("Déclaration d'adéquation")}
  </div>`;
  const page2 = `<div class="page">
    ${pH("Déclaration d'adéquation — Matrice et conseil")}
    ${pageMatrice}
    ${pageCoutsFrais}
    ${pF("Déclaration d'adéquation")}
  </div>`;
  const page3 = `<div class="page">
    ${pH("Déclaration d'adéquation — Suivi et cadre")}
    ${pageSuivi}
    ${pageCadre}
    <div class="portee">
      <strong>Portée du document — Ploutos (Ecopatrimoine).</strong> Ce document est généré pour vous aider à respecter vos obligations de conformité. Il ne constitue ni une attestation, ni une garantie d'exhaustivité réglementaire. Le conseiller reste seul responsable de la cohérence des mentions avec sa situation et le référentiel de son association professionnelle.
    </div>
    ${pF("Déclaration d'adéquation")}
  </div>`;

  const pages = cover + page1 + page2 + page3;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Déclaration d'adéquation — ${clientName}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

  openPrintPopup(html);
}
