// ─── Lot 1b — Page Déclaration d'adéquation v2 (MIGRÉE au contrat moteur) ─────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_declaration_adequation_2pages.html
//
// Document MIF II / RG AMF — justifie en quoi la recommandation correspond au
// profil du client (incluant la recommandation de ne pas agir). Remis
// préalablement à toute opération.
//
// PHASE 3 (moteur paged.js) — PREMIER document réglementaire migré au contrat
// (engine/contrat.ts). Le découpage manuel p1/p2 DISPARAÎT : la page DÉCLARE une
// séquence de blocs ; paged.js pagine selon le contenu réel (N feuilles).
//   • Sortie de coquillePageDocReg : plus de boîte A4, plus de pied codé en dur
//     (« 1 / 2 ») — le feeder fournit en-tête / pied / X-N par counter(page).
//   • Liseré navy+or : réémis PAR FEUILLE via le marqueur data-pdf-page="docReg"
//     posé sur le wrapper (cf. LOT 1a, feeder + .pagedjs_docReg_page).
//   • Marges docReg 44/36 PRÉSERVÉES (divergence intentionnelle) : on n'utilise PAS
//     compilerPageContrat (32/38 figé) — on enveloppe nous-mêmes via compilerBloc.
//   • recommandationsGroupees (NON BORNÉE, le cas qui clippait) → suite de cartes
//     BlocInsecable écoulées sur N feuilles, zéro perte.
//   • SLOT SIGNATURE (2 cadres + mention) → BlocInsecable solidaireAvecPrecedent
//     (flag Lot 0, break-before:avoid = anti « signature veuve »). Remplace le slot
//     absolu bottom:42 qui était SUPPRIMÉ (display:none) sur le chemin paged.js.

import {
  headerDocReg,
  legendeChampsDocReg,
  encadreDocReg,
  sousTitreSection,
  champCabinet,
  champMission,
  cadresSignatureDocReg,
  noteIconee,
  tableauBesoinReponse,
  icones,
  type LigneBesoinReponse,
} from "../primitives";
import { compilerBloc, type Bloc } from "../engine/contrat";
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
  // ── Questionnaire MIF II signé par le client (Lot Dossier) ───────────
  /** 6 lignes Q&A à afficher en bas de la page 2 (avant signature) pour
   *  que le client signe ses réponses, pas seulement le résultat de profil.
   *  Si absent, encart non rendu. */
  questionnaireSigne?: { question: string; reponse: string }[];
  // ── Mentions ──────────────────────────────────────────────────────────
  mentionNonContractuelle: string;
};

export function pageDeclarationAdequation(t: Tokens, d: DeclarationAdequationPageData): string {
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

  // ── Encadré « En quoi ce conseil vous correspond » via primitive partagée
  const miseEnRegardContenu = tableauBesoinReponse(t, d.miseEnRegard);

  // ── Encadré « Coûts & frais »
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

  // ── Encadré « Suivi de l'adéquation »
  const suiviContenu = `
    <div class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.55">
      Une évaluation périodique du caractère adéquat des recommandations ${champCabinet(t, d.suiviActiveHtml)} fournie. Le cas échéant, sa fréquence est de ${champCabinet(t, d.periodiciteSuiviHtml)}. Le profil doit être actualisé en cas d'évolution de votre situation.
    </div>
  `;

  // ── Carte de reco (matrice) : 1 carte = 1 BlocInsecable (suite écoulée,
  // comme les cartes Hypos) → zéro perte même si la liste déborde sur N feuilles.
  const renderRecoCard = (r: { libelle: string; justification: string; besoinLibelle?: string }) => `<div style="background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-left:3px solid ${t.or};border-radius:6px;padding:7px 11px;margin-bottom:5px;page-break-inside:avoid;break-inside:avoid">
      <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700;margin-bottom:2px">${r.libelle}</div>
      <div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.45">${r.justification}</div>
      ${r.besoinLibelle ? `<div class="lt" style="font-size:8.5px;color:${t.texteFaibleClair};margin-top:3px;font-style:italic">Lié au besoin : ${r.besoinLibelle}</div>` : ""}
    </div>`;

  // ── Encart « Vos réponses au questionnaire MIF II » (contenu)
  const questionnaireSigneContenu = (d.questionnaireSigne && d.questionnaireSigne.length > 0)
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">
        ${d.questionnaireSigne.map(qr => `
          <div style="padding:5px 0;border-bottom:1px solid ${t.bordureClaire}">
            <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">${qr.question}</div>
            <div class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.4;margin-top:2px;font-weight:700">${qr.reponse}</div>
          </div>
        `).join("")}
      </div>
      <div class="lt" style="font-size:9.5px;color:${t.texteFaible};line-height:1.5;margin-top:8px;font-style:italic">
        En signant ce document, vous attestez de l'exactitude de ces réponses qui ont servi de base à la détermination de votre profil et au conseil donné.
      </div>`
    : "";

  // Slot signature : MÊME HTML qu'avant (2 cadres client/cabinet + mention non
  // contractuelle) — seule l'ENVELOPPE change (slot absolu bottom:42 → bloc en flux).
  const mentionConseilHtml = `Conseil donné le ${champMission(t, d.dateConseil)} à ${champMission(t, d.heureConseil)} — remis y compris en l'absence de transaction.`;
  const signatureHtml = `
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

  // ─── Déclaration des blocs (contrat de page) — ordre du flux ──────────
  const blocs: Bloc[] = [];

  // En-tête / intro / légende.
  blocs.push({
    kind: "insecable",
    html: headerDocReg(t, {
      eyebrow: "Document réglementaire",
      titre: "Déclaration\nd'adéquation",
      cabinetNom: d.cabinetNom,
      dateLabel: "Conseil donné le",
      dateValeurHtml: dateValeurComposite,
    }),
  });
  blocs.push({
    kind: "insecable",
    html: `<div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.5;margin-top:11px">${introTexte}</div>`,
  });
  blocs.push({ kind: "insecable", html: legendeChampsDocReg(t) });

  // Profil retenu + Notre recommandation (nominales).
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Votre profil retenu",  marginTop: "14px", contenuHtml: profilContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Notre recommandation", marginTop: "13px", contenuHtml: recoContenu }) });

  // Mise en regard besoin → réponse (bornée).
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "En quoi ce conseil vous correspond", marginTop: "13px", contenuHtml: miseEnRegardContenu }) });

  // Matrice recos par dimension : sous-titre solidaire de sa 1ʳᵉ carte, puis
  // CHAQUE carte = un BlocInsecable (suite écoulée, NON BORNÉE, zéro perte).
  if (d.recommandationsGroupees && d.recommandationsGroupees.length > 0) {
    blocs.push({
      kind: "insecable",
      solidaireAvecSuivant: true,
      html: `<div style="margin-top:13px">${sousTitreSection(t, "Recommandations issues du diagnostic", { style: "serif" })}</div>`,
    });
    for (const g of d.recommandationsGroupees) {
      blocs.push({
        kind: "insecable",
        solidaireAvecSuivant: true,
        html: `<div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair};margin:8px 0 5px">${g.dimensionLabel}</div>`,
      });
      for (const r of g.recos) {
        blocs.push({ kind: "insecable", html: renderRecoCard(r) });
      }
    }
  }

  // Coûts & frais / Suivi (disclosures) — REMONTÉS au-dessus de l'unité de signature :
  // ce ne sont pas eux que la phrase d'attestation MIF II vise, ils n'ont pas à
  // s'intercaler entre les réponses attestées et la signature.
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Coûts & frais",         marginTop: "12px", contenuHtml: coutsContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Suivi de l'adéquation", marginTop: "12px", contenuHtml: suiviContenu }) });

  // ── UNITÉ TERMINALE RÉGLEMENTAIRE — cohérence attestation ↔ signature ──
  // Le client doit voir CE QU'IL ATTESTE en signant : les réponses MIF II + la phrase
  // « vous attestez de l'exactitude… » + les cadres de signature + la mention vivent
  // dans UN SEUL BlocInsecable -> jamais séparés par une coupure de feuille.
  // Unité BORNÉE (questionnaire ~6 Q/R fixe + signature fixe ≈ 330-400px << feuille) :
  // on garde break-inside:avoid (garantie forte). PAS de secableEnDernierRecours, qui
  // (break-inside:auto) réautoriserait un split à la jointure de feuille et
  // réintroduirait l'incohérence. solidaireAvecPrecedent = anti-veuve (l'unité reste
  // avec Suivi, jamais seule en haut d'une feuille de continuation).
  const questionnaireEncadreHtml = questionnaireSigneContenu
    ? encadreDocReg(t, { titre: "Vos réponses au questionnaire MIF II", marginTop: "12px", contenuHtml: questionnaireSigneContenu })
    : "";
  blocs.push({
    kind: "insecable",
    solidaireAvecPrecedent: true,
    html: `${questionnaireEncadreHtml}<div style="margin-top:14px">${signatureHtml}</div>`,
  });

  // ─── Enveloppe docReg : marges 44/36 PRÉSERVÉES (divergence intentionnelle) +
  // marqueur data-pdf-page="docReg" (liseré par feuille via le feeder, LOT 1a).
  // On n'utilise PAS compilerPageContrat (32/38 figé dans contrat.ts).
  const corps = blocs.map(compilerBloc).join("\n");
  return (
    `<div class="pdf-contrat" data-pdf-page="docReg" style="padding:30px 36px 0 44px;orphans:2;widows:2">\n` +
    `${corps}\n` +
    `</div>`
  );
}
