// ─── Lot 9 — Page Déclaration d'adéquation v2 (2 pages) ───────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_declaration_adequation_2pages.html
//
// Document MIF II / RG AMF — justifie en quoi la recommandation correspond
// au profil du client (incluant la recommandation de ne pas agir). Remis
// préalablement à toute opération.
//
// Structure 2 pages :
//   • Page 1 : Intro + Votre profil retenu (5 champs grille) + Notre
//              recommandation (3 lignes › plan d'action)
//   • Page 2 : Mise en regard besoin → réponse (5 lignes) + Coûts & frais
//              + Suivi de l'adéquation + Signature (slot bas)

import {
  coquillePageDocReg,
  piedPageDocReg,
  headerDocReg,
  legendeChampsDocReg,
  encadreDocReg,
  champCabinet,
  champMission,
  cadresSignatureDocReg,
  noteIconee,
  tableauBesoinReponse,
  icones,
  type LigneBesoinReponse,
} from "../primitives";
import type { Tokens } from "../tokens";

export type ChampProfilAdequation = {
  /** Libellé en petite cap doré-gris (.lbl). */
  label: string;
  /** Valeur en texte standard (HTML autorisé pour suffixes type "(échelle 4 niveaux)"). */
  valeurHtml: string;
  /** Par défaut 1 col ; passer true pour occuper toute la largeur (ESG). */
  pleineLargeur?: boolean;
  /** Liste de puces optionnelles sous la valeur (utilisé pour la capacité
   *  à subir des pertes — affiche les justifications calculées par
   *  `computeCapacitePerte(data)`). */
  puces?: string[];
};

export type LigneRecommandation = {
  /** HTML autorisé (ex: "Versement sur un <strong>PER</strong>…"). */
  texteHtml: string;
};

/** Groupe de recommandations par dimension (matrice page 2). */
export type GroupeRecommandationsParDimension = {
  /** Libellé humain de la dimension (ex: « Tolérance au risque »). */
  dimensionLabel: string;
  /** Recommandations de cette dimension. */
  recos: Array<{
    libelle: string;
    justification: string;
    /** Libellé humain du besoin lié (ex: « Prévoyance — Décès »), si présent. */
    besoinLibelle?: string;
  }>;
};

export type DeclarationAdequationPageData = {
  // ── Cabinet (Paramètres) ──────────────────────────────────────────────
  cabinetNom: string;
  cabinetConseiller: string;
  // ── Dossier client (varm) ─────────────────────────────────────────────
  dateConseil: string;          // ex: "25 mai 2026"
  heureConseil: string;         // ex: "14h30"
  dateQuestionnaire: string;    // ex: "10 mai 2026"
  /** Phrase d'origine des recommandations (placée dans l'intro varm).
   *  Ex: "contenu dossier" — affichée en varm. */
  origineRecommandations?: string;
  // ── Profil retenu (5 champs) ──────────────────────────────────────────
  profil: ChampProfilAdequation[];
  // ── Recommandations issues du plan d'action ───────────────────────────
  recommandations: LigneRecommandation[];
  // ── Mise en regard besoin → réponse ───────────────────────────────────
  miseEnRegard: LigneBesoinReponse[];
  // ── Coûts & frais (varm + varc) ───────────────────────────────────────
  coutConseilHtml: string;          // varm — ex: "honoraires du dossier"
  fraisSupportsHtml: string;        // varm — ex: "frais courants / entrée"
  natureConseilHtml: string;        // varc — ex: "indépendant / non"
  // ── Suivi de l'adéquation (varc) ──────────────────────────────────────
  suiviActiveHtml: string;          // varc — ex: "est / n'est pas"
  periodiciteSuiviHtml: string;     // varc — ex: "annuelle"
  // ── Recos détaillées par dimension (matrice page 2) ──────────────────
  /** Recommandations Lot 7 groupées par dimension, avec leur justification
   *  et le libellé de besoin associé. Si absent ou tableau vide, l'encadré
   *  matrice n'est pas rendu. */
  recommandationsGroupees?: GroupeRecommandationsParDimension[];
  // ── Mentions ──────────────────────────────────────────────────────────
  mentionNonContractuelle: string;
};

export function pageDeclarationAdequation(t: Tokens, d: DeclarationAdequationPageData): string {
  // ─── PAGE 1 — Intro + Profil retenu + Notre recommandation ──────────
  const introTexte = `Ce document justifie <strong>en quoi la recommandation correspond à votre profil</strong>, sur la base des informations recueillies. Il vous est remis préalablement à toute opération, <strong>y compris si la recommandation est de ne pas agir</strong>.`;

  // ── Encadré « Votre profil retenu » : grille 2 cols + champs pleine
  // largeur pour ESG, + note source MIF II en bas
  const renderProfil = (c: ChampProfilAdequation) => {
    const colSpan = c.pleineLargeur ? `style="grid-column:1 / -1"` : "";
    const pucesHtml = (c.puces && c.puces.length > 0)
      ? `<ul style="margin:4px 0 0 0;padding-left:14px;list-style:disc;font-size:9.5px;color:${t.texteFaible};line-height:1.45">${c.puces.map(p => `<li style="margin-bottom:1px">${p}</li>`).join("")}</ul>`
      : "";
    return `<div ${colSpan}>
      <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">${c.label}</div>
      <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${c.valeurHtml}</div>
      ${pucesHtml}
    </div>`;
  };
  const noteProfil = `<div class="lt" style="font-size:8.5px;color:${t.texteFaibleClair};margin-top:8px">Synthèse issue du questionnaire de connaissance client et du profil MIF II daté du ${champMission(t, d.dateQuestionnaire)}.</div>`;
  const profilContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 18px">
      ${d.profil.map(renderProfil).join("")}
    </div>
    ${noteProfil}
  `;

  // ── Encadré « Notre recommandation » : intro + 3 lignes ›
  const introReco = `Recommandations issues du plan d'action ${champMission(t, d.origineRecommandations || "contenu dossier")} :`;
  const renderReco = (r: LigneRecommandation) => `
    <div style="display:flex;gap:9px;align-items:flex-start">
      <span style="color:${t.or};font-weight:700;font-size:12px;flex:none">›</span>
      <span class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.5">${r.texteHtml}</span>
    </div>
  `;
  const recoContenu = `
    <div class="lt" style="font-size:10px;color:${t.texteFaible};margin-bottom:8px">${introReco}</div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${d.recommandations.map(renderReco).join("")}
    </div>
  `;

  // Date composite (date + heure) — slot dateValeurHtml du headerDocReg
  const dateValeurComposite = `${champMission(t, d.dateConseil)} à ${champMission(t, d.heureConseil)}`;

  const page1Contenu = `
    ${headerDocReg(t, {
      eyebrow: "Document réglementaire",
      titre: "Déclaration\nd'adéquation",
      cabinetNom: d.cabinetNom,
      dateLabel: "Conseil donné le",
      dateValeurHtml: dateValeurComposite,
    })}

    <div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.5;margin-top:11px">
      ${introTexte}
    </div>

    ${legendeChampsDocReg(t)}

    ${encadreDocReg(t, { titre: "Votre profil retenu",  marginTop: "14px", contenuHtml: profilContenu })}
    ${encadreDocReg(t, { titre: "Notre recommandation", marginTop: "13px", contenuHtml: recoContenu })}
  `;

  const page1 = coquillePageDocReg(t, {
    contenu: page1Contenu,
    pied: piedPageDocReg(t, {
      gauche: `${d.cabinetNom} · Déclaration d'adéquation`,
      droite: "1 / 2",
    }),
  });

  // ─── PAGE 2 — Mise en regard + Coûts & frais + Suivi + Signature ────
  // Encadré « En quoi ce conseil vous correspond » via primitive partagée
  const miseEnRegardContenu = tableauBesoinReponse(t, d.miseEnRegard);

  // Encadré « Coûts & frais » : 2 champs varm + paragraphe avec varc nature conseil
  const coutsContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Coût du conseil</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champMission(t, d.coutConseilHtml)}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Frais des supports recommandés</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champMission(t, d.fraisSupportsHtml)}</div>
      </div>
    </div>
    <div class="lt" style="margin-top:9px;font-size:10px;color:${t.texteFaible};line-height:1.5">
      En cas de conseil non indépendant, les <strong>rémunérations perçues de tiers</strong> sont communiquées avec le présent document. ${champCabinet(t, "nature du conseil : " + d.natureConseilHtml)}
    </div>
  `;

  // Encadré « Suivi de l'adéquation » : phrase avec 2 champs varc
  const suiviContenu = `
    <div class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.55">
      Une évaluation périodique du caractère adéquat des recommandations ${champCabinet(t, d.suiviActiveHtml)} fournie. Le cas échéant, sa fréquence est de ${champCabinet(t, d.periodiciteSuiviHtml)}. Le profil doit être actualisé en cas d'évolution de votre situation.
    </div>
  `;

  // ── Nouvel encadré « Recommandations issues du diagnostic » ──────────
  // Recos Lot 7 groupées par dimension (besoin / risque / ESG / capacité
  // de perte). Rendu seulement si l'adapter passe des recos enrichies.
  const matriceRecosContenu = (d.recommandationsGroupees && d.recommandationsGroupees.length > 0)
    ? d.recommandationsGroupees.map(g => `
        <div style="margin-bottom:10px">
          <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair};margin-bottom:5px">${g.dimensionLabel}</div>
          ${g.recos.map(r => `
            <div style="background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-left:3px solid ${t.or};border-radius:6px;padding:7px 11px;margin-bottom:5px;page-break-inside:avoid;break-inside:avoid">
              <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700;margin-bottom:2px">${r.libelle}</div>
              <div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.45">${r.justification}</div>
              ${r.besoinLibelle ? `<div class="lt" style="font-size:8.5px;color:${t.texteFaibleClair};margin-top:3px;font-style:italic">Lié au besoin : ${r.besoinLibelle}</div>` : ""}
            </div>
          `).join("")}
        </div>
      `).join("")
    : "";
  const matriceRecos = matriceRecosContenu
    ? encadreDocReg(t, { titre: "Recommandations issues du diagnostic", marginTop: "12px", contenuHtml: matriceRecosContenu })
    : "";

  const page2Contenu = `
    ${encadreDocReg(t, { titre: "En quoi ce conseil vous correspond", marginTop: "0",    contenuHtml: miseEnRegardContenu })}
    ${matriceRecos}
    ${encadreDocReg(t, { titre: "Coûts & frais",                       marginTop: "12px", contenuHtml: coutsContenu })}
    ${encadreDocReg(t, { titre: "Suivi de l'adéquation",               marginTop: "12px", contenuHtml: suiviContenu })}
  `;

  // Slot signature en bas absolu (convention DocReg) :
  // cadres signature (mention "Conseil donné le date à heure — remis y
  // compris en l'absence de transaction") → note discrète
  const mentionConseilHtml = `Conseil donné le ${champMission(t, d.dateConseil)} à ${champMission(t, d.heureConseil)} — remis y compris en l'absence de transaction.`;
  const page2Signature = `
    ${cadresSignatureDocReg(t, {
      cabinetNomConseiller: d.cabinetConseiller,
      cabinetNom: d.cabinetNom,
      labelClient: "Le client",
      mentionClient: "date & signature",
      mentionCabinet: d.cabinetNom,
      hauteurCadre: "70px",
      mentionFaitHtml: mentionConseilHtml,
    })}
    ${noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 13),
      texteHtml: d.mentionNonContractuelle,
      style: "discrete",
    })}
  `;

  const page2 = coquillePageDocReg(t, {
    contenu: page2Contenu,
    signature: page2Signature,
    pied: piedPageDocReg(t, {
      gauche: `${d.cabinetNom} · Déclaration d'adéquation`,
      droite: "2 / 2",
    }),
  });

  return page1 + page2;
}
