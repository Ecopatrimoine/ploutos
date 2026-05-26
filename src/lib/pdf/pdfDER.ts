// ─── PDF DER — Document d'Entrée en Relation (Lot 8b) ──────────────────────
// Document court et standardisé du cabinet, REMIS au premier rendez-vous.
// Indépendant du dossier client : ne consomme pas data/ir/mission/succession.
//
// Architecture « qui peut le plus qui peut le moins » : PILOTÉ par les
// interrupteurs de statut du Lot 5. COA seul → sous-ensemble (assurances/DDA,
// pas de volet AMF/CIF). CIF coché → volet CIF + association + AMF s'allument
// AUTOMATIQUEMENT sans modifier ce code.
//
// Garde-fou conformité : aucun produit, aucun assureur, aucun ISIN nommé.

import { resolveCabinetColors, openPrintPopup } from "./pdfCore";
import { DER_PRESET } from "./registry";
import { referencesLegales, type StatutFlags } from "../conformite/referencesLegales";
import { vocabulaireReglementaire } from "../conformite/vocabulaire";

export interface PdfDERParams {
  /** Données cabinet (Lot 5 : statut*, association, médiateur, etc.). */
  cabinet: Record<string, any>;
  /** Nom du client (facultatif, pour personnaliser l'en-tête si remise nominative). */
  clientName?: string;
  /** Logo du cabinet (sinon repli sur cabinet.logoSrc). */
  logoSrc?: string;
  /** Surcharge des sections actives par défaut (toutes à true, conditionnées aux statuts). */
  sections?: Record<string, boolean>;
}

export function buildAndPrintDER(params: PdfDERParams): void {
  const cabinet = params.cabinet || {};
  const clientName = params.clientName || "—";
  const logoSrc = cabinet.logoSrc || params.logoSrc || "";

  const colors = resolveCabinetColors(cabinet);
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // Statuts du cabinet → helpers conformité (Lot 5 + 8a).
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
  const isAssurance = statuts.coa || statuts.mia || statuts.iobsp;

  // Sections actives : par défaut toutes, surchargeables, puis conditionnées
  // automatiquement aux statuts (sections « assurance » et « cif »).
  const allOn: Record<string, boolean> = Object.fromEntries(DER_PRESET.map(id => [id, true]));
  const sections = { ...allOn, ...(params.sections || {}) };
  if (!isAssurance) sections.assurance = false;
  if (!statuts.cif)  sections.cif = false;

  // Helper « à confirmer » sur champ cabinet vide (mention pédagogique).
  const v = (val: any, fallback = "à confirmer"): string => {
    const s = (val === null || val === undefined) ? "" : String(val);
    return s.trim().length > 0 ? s : `<em style="color:#92400E">${fallback}</em>`;
  };

  // ─── Statuts ORIAS détenus → libellés affichés ─────────────────────────────
  const statutsLibelles: string[] = [];
  if (statuts.coa) statutsLibelles.push("Courtier en assurance (COA)");
  if (statuts.mia) statutsLibelles.push("Mandataire d'intermédiaire en assurance (MIA)");
  if (statuts.iobsp) statutsLibelles.push("Intermédiaire en opérations de banque et services de paiement (IOBSP)");
  if (statuts.cif) statutsLibelles.push("Conseiller en investissements financiers (CIF)");
  if (statuts.carteT) statutsLibelles.push("Titulaire de la carte T (transactions immobilières)");

  // ─── CSS minimal (Encre & Or / surchargeable par les couleurs cabinet) ────
  const css = `
  @page{size:A4;margin:14mm 12mm 12mm 12mm;}
  *{box-sizing:border-box;}
  body{font-family:'Lato',-apple-system,BlinkMacSystemFont,sans-serif;font-size:9.5pt;line-height:1.55;color:${colors.navy};margin:0;}
  .page{position:relative;min-height:255mm;padding:6mm 0 14mm 0;page-break-after:always;}
  .page:last-of-type{page-break-after:auto;}
  .cover{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:255mm;text-align:center;background:linear-gradient(135deg,${colors.cream} 0%,#fff 60%);padding:30mm 12mm;}
  .cover-logo{max-height:42mm;max-width:90mm;object-fit:contain;margin-bottom:14mm;}
  .cover-title{font-size:26pt;font-weight:900;letter-spacing:-0.5px;color:${colors.navy};margin-bottom:4mm;}
  .cover-subtitle{font-size:13pt;color:${colors.sky};font-weight:600;margin-bottom:10mm;}
  .cover-bar{width:60mm;height:2px;background:${colors.gold};margin:8mm auto;}
  .cover-tagline{font-size:8.5pt;color:#666;line-height:1.7;margin-top:6mm;max-width:120mm;}
  .cover-footer{position:absolute;bottom:14mm;left:0;right:0;text-align:center;font-size:7.5pt;color:#888;}
  .page-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${colors.gold};padding:0 12mm 4mm 12mm;margin-bottom:6mm;}
  .page-header-title{font-size:13pt;font-weight:700;color:${colors.navy};}
  .page-header-client{font-size:8pt;color:#888;}
  .page-footer{position:absolute;bottom:6mm;left:12mm;right:12mm;display:flex;justify-content:space-between;font-size:7pt;color:#999;border-top:1px solid #eee;padding-top:3mm;}
  .section{margin:0 12mm 8mm 12mm;}
  .section-title{font-size:10pt;font-weight:700;color:${colors.navy};border-bottom:1px solid ${colors.gold};padding-bottom:3px;margin-bottom:6px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 12mm 8mm 12mm;}
  .legal-block{background:#fff;border:1px solid rgba(227,175,100,0.25);border-left:3px solid ${colors.gold};border-radius:6px;padding:8px 11px;margin-bottom:8px;font-size:8.5pt;line-height:1.55;color:#333;}
  .legal-title{font-size:9.5pt;font-weight:700;color:${colors.navy};margin-bottom:4px;}
  .legal-block ul{margin:4px 0 0 0;padding-left:14px;}
  .legal-block li{margin-bottom:2px;}
  .portee{margin:6mm 12mm 0 12mm;font-size:7pt;color:#92400E;line-height:1.5;background:rgba(146,64,14,0.05);border-left:3px solid rgba(146,64,14,0.35);padding:6px 10px;border-radius:4px;}
  a{color:${colors.sky};text-decoration:none;}
  @media print{
    .legal-block,.section{page-break-inside:avoid;break-inside:avoid;}
  }`;

  const pH = (title: string) =>
    `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName} · ${dateStr}</div></div>`;
  const pF = (label: string) =>
    `<div class="page-footer"><span>${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · ${label}</span><span>${dateStr}</span></div>`;

  // ─── Cover ──────────────────────────────────────────────────────────────────
  const cover = `<div class="page cover">
    ${logoSrc?`<img src="${logoSrc}" alt="${cabinet.cabinetName||""}" class="cover-logo"/>`:""}
    <div class="cover-title">Document d'Entrée en Relation</div>
    <div class="cover-subtitle">${cabinet.cabinetName||"Le cabinet"}</div>
    <div class="cover-bar"></div>
    <div style="font-size:9pt;color:${colors.navy};font-weight:600;margin-top:6mm;">Remis à : ${clientName}</div>
    <div style="font-size:9pt;color:#666;margin-top:2mm;">${dateStr}</div>
    <div class="cover-tagline">
      Document remis préalablement à toute mission, conformément aux exigences réglementaires (${cadreReglementaire !== "—" ? cadreReglementaire : "code des assurances"}). Il présente notre cabinet, nos statuts, nos conditions d'intervention et vos droits en tant que client.
    </div>
    <div class="cover-footer">${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Document confidentiel · ${dateStr}</div>
  </div>`;

  // ─── Page 1 : Identité + Statuts + (Assurance / CIF) ──────────────────────
  const pageMain = `<div class="page">
    ${pH("Présentation du cabinet")}

    ${sections.identite ? `<div class="section">
      <div class="section-title">Identité du cabinet</div>
      <div class="two-col" style="margin:0">
        <div class="legal-block">
          <div class="legal-title">Coordonnées</div>
          <p><strong>${v(cabinet.cabinetName, "Nom du cabinet à confirmer")}</strong>${cabinet.forme?`, ${cabinet.forme}`:""}</p>
          <p style="margin-top:4px;">${v(cabinet.adresse, "Adresse à confirmer")} ${cabinet.codePostal||""} ${cabinet.ville||""}</p>
          ${cabinet.tel?`<p style="margin-top:4px;">Tél. : <strong>${cabinet.tel}</strong></p>`:""}
          ${cabinet.email?`<p>Email : <strong>${cabinet.email}</strong></p>`:""}
        </div>
        <div class="legal-block">
          <div class="legal-title">Informations légales</div>
          ${cabinet.rcs ? `<p>RCS de ${cabinet.villeRcs||"—"} : <strong>${cabinet.rcs}</strong></p>` : ""}
          <p>SIREN : ${v(cabinet.siren)}</p>
          <p>Capital social : ${v(cabinet.capital)}</p>
          <p>Forme juridique : ${v(cabinet.forme)}</p>
          ${cabinet.conseiller?`<p style="margin-top:4px;">Conseiller : <strong>${cabinet.conseiller}</strong></p>`:""}
        </div>
      </div>
    </div>` : ""}

    ${sections.statuts ? `<div class="section">
      <div class="section-title">Statuts détenus & autorités de tutelle</div>
      <div class="legal-block" style="border-left-color:${colors.sky}">
        <p>${cabinet.cabinetName||"Le cabinet"} est immatriculé à l'<strong>ORIAS</strong> (Organisme pour le registre unique des intermédiaires en assurance, banque et finance — <a href="https://www.orias.fr">www.orias.fr</a>) sous le n° <strong>${v(cabinet.orias)}</strong>.</p>
        ${statutsLibelles.length > 0 ? `<p style="margin-top:5px;">Statuts détenus :</p><ul>${statutsLibelles.map(s => `<li>${s}</li>`).join("")}</ul>` : `<p style="margin-top:5px;"><em style="color:#92400E">Statuts ORIAS à renseigner dans Paramètres → Statuts &amp; conformité.</em></p>`}
        <p style="margin-top:6px;">Autorités de tutelle :</p>
        <ul>
          ${isAssurance ? `<li><strong>ACPR</strong> — Autorité de Contrôle Prudentiel et de Résolution, 4 place de Budapest, CS 92459, 75436 Paris Cedex 09${statuts.iobsp ? ` (compétente également pour l'activité IOBSP)` : ""}.</li>` : ""}
          ${statuts.cif ? `<li><strong>AMF</strong> — Autorité des Marchés Financiers, 17 place de la Bourse, 75082 Paris Cedex 02.</li>` : ""}
        </ul>
        ${statuts.cif ? `<p style="margin-top:5px;">Association professionnelle CIF : ${v(cabinet.associationCif, "association CIF à renseigner dans Paramètres")}.</p>` : ""}
      </div>
    </div>` : ""}

    <div class="two-col">
      ${sections.assurance ? `<div class="legal-block">
        <div class="legal-title">Volet assurance — liens & rémunération</div>
        <p>Notre cabinet n'est soumis à aucune obligation contractuelle de travailler exclusivement avec une ou plusieurs entreprises d'assurance. Notre analyse porte sur les contrats proposés par nos partenaires sélectionnés.</p>
        ${cabinet.partenaires?`<p style="margin-top:4px;color:#666;font-size:7.5pt;">Partenaires sélectionnés : ${cabinet.partenaires}.</p>`:""}
        <p style="margin-top:6px;">Notre cabinet n'entretient aucune participation directe ou indirecte ≥ 10 % dans le capital d'une entreprise d'assurance, ni l'inverse (art. L.521-2 I, Code des assurances).</p>
        <p style="margin-top:6px;">Mode de rémunération :</p>
        <ul>
          ${cabinet.remunerationType==="commission" || !cabinet.remunerationType ? `<li>☒ Par <strong>commission</strong> versée par l'assureur (incluse dans la prime).</li>` : `<li>☐ Par commission versée par l'assureur.</li>`}
          ${cabinet.remunerationType==="honoraire" ? `<li>☒ Par <strong>honoraires</strong> payés directement par le client.</li>` : `<li>☐ Par honoraires payés directement par le client.</li>`}
          ${cabinet.remunerationType==="mixte" ? `<li>☒ Par une <strong>combinaison</strong> commission + honoraires.</li>` : `<li>☐ Par combinaison commission + honoraires.</li>`}
        </ul>
      </div>` : ""}

      ${sections.cif ? `<div class="legal-block" style="border-left-color:${colors.sky}">
        <div class="legal-title">Volet CIF — rémunération</div>
        <p>L'activité de Conseiller en investissements financiers (CIF) est régie par le Code monétaire et financier (art. L.541-1 et s.) et par le Règlement général de l'AMF.</p>
        <p style="margin-top:5px;">Mode de rémunération CIF : ${v(cabinet.remuneration, "à préciser dans Paramètres")}${cabinet.baremeHonoraires?` — barème : <strong>${cabinet.baremeHonoraires}</strong>`:""}.</p>
        <p style="margin-top:6px;"><strong>Lettre de mission CIF à venir</strong> : préalablement à toute prestation de conseil en investissements financiers, une <strong>lettre de mission</strong> dédiée vous sera remise et signée. Elle détaillera l'objet, le périmètre, la durée et les conditions financières de notre intervention.</p>
      </div>` : ""}
    </div>

    ${pF("Document d'entrée en relation")}
  </div>`;

  // ─── Page 2 : Réclamations + Médiation + Conflits + RGPD ───────────────────
  const pageReclamationsConflits = (sections.reclamations || sections.conflits || sections.rgpd) ? `<div class="page">
    ${pH("Vos droits & nos engagements")}

    <div class="two-col">
      ${sections.reclamations ? `<div class="legal-block">
        <div class="legal-title">Traitement des réclamations</div>
        <p>Toute réclamation peut être adressée au cabinet :</p>
        <ul>
          ${cabinet.email?`<li>Par email : <strong>${cabinet.email}</strong></li>`:""}
          ${cabinet.adresse?`<li>Par courrier : ${cabinet.adresse} ${cabinet.codePostal||""} ${cabinet.ville||""}</li>`:""}
        </ul>
        <p style="margin-top:5px;font-size:7.5pt;color:#666">Accusé de réception sous 10 jours ouvrables. Réponse écrite sous 2 mois maximum.</p>
        <p style="margin-top:8px;"><strong>Médiation (art. L.616-1 Code de la consommation)</strong></p>
        <p style="margin-top:3px;">${cabinet.mediateur ? `Médiateur compétent : <strong>${cabinet.mediateur}</strong>` : `<em style="color:#92400E">Médiateur à renseigner dans Paramètres → Médiation.</em>`}</p>
        ${cabinet.mediateurAdresse?`<p style="font-size:7.5pt;color:#666">${cabinet.mediateurAdresse}</p>`:""}
        ${cabinet.mediateurUrl?`<p style="font-size:7.5pt;color:#666"><a href="${cabinet.mediateurUrl}">${cabinet.mediateurUrl}</a></p>`:""}
        ${statuts.cif ? `<p style="margin-top:6px;font-size:7.5pt;color:#666">Pour le volet CIF, le client peut également saisir le <strong>Médiateur de l'AMF</strong> (17 place de la Bourse, 75082 Paris Cedex 02 — <a href="https://www.amf-france.org">www.amf-france.org</a>).</p>` : ""}
      </div>` : ""}

      ${sections.conflits ? `<div class="legal-block">
        <div class="legal-title">Politique de gestion des conflits d'intérêts</div>
        <p>Notre cabinet tient à jour un <strong>registre des conflits d'intérêts</strong>, conformément aux obligations ${cadreReglementaire}. La politique de gestion correspondante est disponible sur simple demande.</p>
        <p style="margin-top:5px;">En cas de conflit d'intérêts détecté préalablement à une recommandation, nous nous engageons à :</p>
        <ul>
          <li>vous en informer par écrit ;</li>
          <li>vous présenter la nature et les sources du conflit ;</li>
          <li>vous laisser libre de poursuivre ou non la prestation.</li>
        </ul>
      </div>` : ""}
    </div>

    ${sections.rgpd ? `<div class="section">
      <div class="section-title">Protection des données personnelles (RGPD)</div>
      <div class="legal-block">
        <p>Vos données personnelles sont collectées par <strong>${cabinet.cabinetName||"le cabinet"}</strong> (responsable de traitement) pour les besoins exclusifs de la mission de conseil et de l'établissement des recommandations.</p>
        <p style="margin-top:5px;">Base légale : exécution du contrat de mission, respect d'obligations légales (LCB-FT, ${cadreReglementaire}, fiscalité). Durée de conservation : 5 ans après la fin de la relation contractuelle (10 ans pour les pièces LCB-FT).</p>
        <p style="margin-top:5px;">Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité (art. 15 à 22 RGPD)${cabinet.email?` exerçable à l'adresse <strong>${cabinet.email}</strong>`:""}. Vous pouvez également introduire une réclamation auprès de la <strong>CNIL</strong> (<a href="https://www.cnil.fr">www.cnil.fr</a>).</p>
        <p style="margin-top:5px;font-size:7.5pt;color:#666">Lutte contre le démarchage téléphonique : pour vous inscrire sur la liste d'opposition, rendez-vous sur <a href="https://www.bloctel.gouv.fr">www.bloctel.gouv.fr</a>.</p>
      </div>
    </div>` : ""}

    <div class="portee">
      <strong>Portée du document — Ploutos (Ecopatrimoine).</strong> Ce document est généré pour vous aider à respecter vos obligations de conformité. Il ne constitue ni une attestation, ni une garantie d'exhaustivité réglementaire. Le conseiller reste seul responsable de la cohérence des mentions avec sa situation et le référentiel de son association professionnelle.
    </div>

    ${pF("Document d'entrée en relation")}
  </div>` : "";

  // ─── Page « Références légales applicables » (renvoi conformité) ───────────
  const refsLegalesHtml = refsLegales.length > 0
    ? refsLegales.map(r => `<li><strong>${r.code}</strong> · ${r.article} — ${r.libelle}${r.note?` <em style="color:#92400E">(${r.note})</em>`:""}</li>`).join("")
    : `<li><em style="color:#92400E">Statuts ORIAS à renseigner dans Paramètres → Statuts &amp; conformité.</em></li>`;
  const pageReferences = `<div class="page">
    ${pH("Références légales applicables")}
    <div class="section">
      <div class="section-title">Calculées d'après les statuts du cabinet</div>
      <div class="legal-block">
        <p style="font-size:8pt;color:#666;margin-bottom:6px;">Le bloc ci-dessous est généré dynamiquement à partir des interrupteurs de statut renseignés dans les Paramètres du cabinet. Toute modification des statuts (ajout du CIF, par exemple) modifie automatiquement la liste affichée.</p>
        <ul style="font-size:8.5pt;line-height:1.7;">
          ${refsLegalesHtml}
        </ul>
      </div>
    </div>
    <div class="portee">
      <strong>Portée du document — Ploutos (Ecopatrimoine).</strong> Ce document est généré pour vous aider à respecter vos obligations de conformité. Il ne constitue ni une attestation, ni une garantie d'exhaustivité réglementaire.
    </div>
    ${pF("Document d'entrée en relation — Références")}
  </div>`;

  const pages = cover + pageMain + pageReclamationsConflits + pageReferences;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>DER — ${cabinet.cabinetName||"Cabinet"}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

  openPrintPopup(html);
}
