// ─── Lot 9 — Page Fiche conseil DDA v2 (2 pages) ───────────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_fiche_conseil_dda_2pages.html
//
// Document DDA (Directive Distribution d'Assurance) — formalise les
// exigences et besoins du client, le conseil fourni et sa justification,
// conformément au devoir de conseil du code des assurances.
//
// Structure 2 pages :
//   • Page 1 : Intro + Exigences & besoins (3 besoins icônés)
//              + Conseil fourni (3 garanties)
//   • Page 2 : Mise en regard besoin → réponse + Volet IBIP (assurance-vie
//              durabilité) + Rémunération & impartialité + Documents remis
//              (IPID/DIC) + Statut IAS + Signature (slot bas)

import {
  coquillePageDocReg,
  piedPageDocReg,
  headerDocReg,
  legendeChampsDocReg,
  encadreDocReg,
  champCabinet,
  champMission,
  cadresSignatureDocReg,
  marqueurVerifie,
  noteIconee,
  tableauBesoinReponse,
  icones,
  type LigneBesoinReponse,
} from "../primitives";
import type { Tokens } from "../tokens";

export type BesoinIcone = {
  /** "shieldHeart" | "activityHeartbeat" | "calendarEuro" — clé du registre icones. */
  iconeKey: "shieldHeart" | "activityHeartbeat" | "calendarEuro";
  texteHtml: string;
};

export type LigneGarantie = {
  /** HTML autorisé (ex: "Contrat de prévoyance avec <strong>capital décès</strong>…"). */
  texteHtml: string;
};

// Alias pour cohérence interne ; la primitive partagée gère le rendu.
export type LigneMiseEnRegard = LigneBesoinReponse;

export type FicheDDAPageData = {
  // ── Cabinet (Paramètres) ──────────────────────────────────────────────
  cabinetNom: string;
  cabinetORIAS: string;
  cabinetConseiller: string;
  // Catégorie IAS (varc) — affichée dans la mention de statut bas de page 2.
  cabinetCategorieIas: string;
  // Statut & rémunération (varc) — affichés dans l'encadré Rémunération.
  cabinetStatut: string;            // ex: "courtier / mandataire"
  cabinetModeRemuneration: string;  // ex: "commissions / honoraires"
  // ── Dossier client (varm) ─────────────────────────────────────────────
  dateLettre: string;
  /** Phrase d'origine des besoins (placé dans l'intro de l'encadré 1).
   *  Ex: "issu du dossier" — affichée en varm. */
  origineDesBesoins?: string;
  // ── Contenu métier (varm — issu du dossier prévoyance / patrimoine) ──
  besoins: BesoinIcone[];
  garanties: LigneGarantie[];
  miseEnRegard: LigneMiseEnRegard[];
  /** Texte « Volet assurance-vie (IBIP) » — adéquation renforcée + ESG. */
  voletIbipHtml: string;
  /** Texte sous les champs rémunération — précisions impartialité. */
  textRemunerationImpartialiteHtml: string;
  /** Texte de l'encart « Documents remis » (IPID/DIC). */
  documentsRemisHtml: string;
  // ── Pied / mentions ───────────────────────────────────────────────────
  mentionNonContractuelle: string;
};

export function pageFicheDDA(t: Tokens, d: FicheDDAPageData): string {
  // ─── PAGE 1 — Intro + Exigences & besoins + Conseil fourni ──────────
  const introTexte = `Cette fiche formalise vos <strong>exigences et besoins</strong>, le <strong>conseil</strong> fourni et sa <strong>justification</strong>, conformément au devoir de conseil du code des assurances. L'information est délivrée de manière claire, exacte et non trompeuse, et le conseil rendu avec impartialité.`;

  // ── Encadré « Vos exigences & besoins » : intro + liste besoins icônés
  const introBesoins = `Besoins recueillis lors de l'analyse de prévoyance ${champMission(t, d.origineDesBesoins || "issu du dossier")} :`;
  const renderBesoin = (b: BesoinIcone) => {
    const iconeSvg = icones[b.iconeKey](t.eyebrowOr, 15);
    return `<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0">
      ${iconeSvg}
      <span class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.5">${b.texteHtml}</span>
    </div>`;
  };
  const besoinsContenu = `
    <div class="lt" style="font-size:10px;color:${t.texteFaible};margin-bottom:6px">${introBesoins}</div>
    ${d.besoins.map(renderBesoin).join("")}
  `;

  // ── Encadré « Le conseil fourni » : intro + liste › garanties
  const introConseil = `Conseil exprimé en <strong>garanties</strong> (sans désignation de produit ni d'assureur) :`;
  const renderGarantie = (g: LigneGarantie) => `
    <div style="display:flex;gap:9px;align-items:flex-start">
      <span style="color:${t.or};font-weight:700;font-size:12px;flex:none">›</span>
      <span class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.5">${g.texteHtml}</span>
    </div>
  `;
  const conseilContenu = `
    <div class="lt" style="font-size:10px;color:${t.texteFaible};margin-bottom:8px">${introConseil}</div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${d.garanties.map(renderGarantie).join("")}
    </div>
  `;

  const page1Contenu = `
    ${headerDocReg(t, {
      eyebrow: "Document réglementaire · DDA",
      titre: "Fiche d'information\n& de conseil",
      cabinetNom: d.cabinetNom,
      dateLabel: "Établie le",
      dateValeur: d.dateLettre,
      dateAsChamp: true,
    })}

    <div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.5;margin-top:11px">
      ${introTexte}
    </div>

    ${legendeChampsDocReg(t)}

    ${encadreDocReg(t, { titre: "Vos exigences & besoins", marginTop: "14px", contenuHtml: besoinsContenu })}
    ${encadreDocReg(t, { titre: "Le conseil fourni",        marginTop: "13px", contenuHtml: conseilContenu })}
  `;

  const page1 = coquillePageDocReg(t, {
    contenu: page1Contenu,
    pied: piedPageDocReg(t, {
      gauche: `${d.cabinetNom} · Fiche d'information & de conseil (DDA)`,
      droite: "1 / 2",
    }),
  });

  // ─── PAGE 2 — Mise en regard + IBIP + Rémunération + Documents + Sig ─
  // Tableau besoin → réponse via la primitive partagée (réutilisée par la
  // déclaration d'adéquation).
  const miseEnRegardContenu = tableauBesoinReponse(t, d.miseEnRegard);

  // Volet IBIP : texte simple
  const voletIbipContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.5">${d.voletIbipHtml}</div>
  `;

  // Rémunération & impartialité : 2 champs varc + paragraphe
  const remunerationContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Statut du cabinet</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetStatut)}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Mode de rémunération</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetModeRemuneration)}</div>
      </div>
    </div>
    <div class="lt" style="margin-top:9px;font-size:10px;color:${t.texteFaible};line-height:1.5">${d.textRemunerationImpartialiteHtml}</div>
  `;

  // Encart Documents remis : style noteIconee « conseil » (fond beige bord or g)
  const docsRemis = noteIconee(t, {
    iconeSvg: icones.paperclip(t.eyebrowOr, 16),
    texteHtml: d.documentsRemisHtml,
    style: "conseil",
  });

  const page2Contenu = `
    ${encadreDocReg(t, { titre: "En quoi ce conseil répond à vos besoins", marginTop: "0",    contenuHtml: miseEnRegardContenu })}
    ${encadreDocReg(t, { titre: "Volet assurance-vie (IBIP)",                marginTop: "12px", contenuHtml: voletIbipContenu })}
    ${encadreDocReg(t, { titre: "Rémunération & impartialité",                marginTop: "12px", contenuHtml: remunerationContenu })}
    ${docsRemis}
  `;

  // Slot signature en bas absolu (convention DocReg) :
  // ligne ORIAS + ACPR + ✓ vérifié → cadres signature (sans mention "Fait à")
  // → note discrète mention non-contractuelle
  const ligneOrias = `
    <div class="lt" style="font-size:9px;color:${t.texteFaibleClair};line-height:1.5">
      Statut d'intermédiaire en assurance — ORIAS n° ${d.cabinetORIAS} (www.orias.fr), ${champCabinet(t, d.cabinetCategorieIas)}. Autorité de contrôle : ACPR, 4 place de Budapest, 75436 Paris Cedex 09. ${marqueurVerifie(t, d.dateLettre)}
    </div>
  `;
  const page2Signature = `
    ${ligneOrias}
    ${cadresSignatureDocReg(t, {
      cabinetNomConseiller: d.cabinetConseiller,
      cabinetNom: d.cabinetNom,
      labelClient: "Le client",
      mentionClient: "date & signature",
      mentionCabinet: d.cabinetNom,
      hauteurCadre: "62px",
      masquerMentionFait: true,
    })}
    ${noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 12),
      texteHtml: d.mentionNonContractuelle,
      style: "discrete",
    })}
  `;

  const page2 = coquillePageDocReg(t, {
    contenu: page2Contenu,
    signature: page2Signature,
    pied: piedPageDocReg(t, {
      gauche: `${d.cabinetNom} · Fiche d'information & de conseil (DDA)`,
      droite: "2 / 2",
    }),
  });

  return page1 + page2;
}
