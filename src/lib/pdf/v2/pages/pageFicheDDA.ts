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
import type { GroupeRecommandationsParDimension } from "./pageDeclarationAdequation";

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

/** Bloc identité client compact en haut de page 1 (sous header).
 *  Affiche P1 + (jj/mm/aaaa) & P2 + (jj/mm/aaaa) sur une ligne, l'adresse
 *  sur la suivante. Person2 et les dates sont optionnels : si absents,
 *  pas de « & » orphelin ni de parenthèses vides. */
export type IdentiteClientCompacte = {
  /** Personne principale (toujours présente). */
  person1: { nom: string; naissance?: string };
  /** Conjoint éventuel. */
  person2?: { nom: string; naissance?: string };
  /** Adresse postale composée (rue, CP ville). */
  adresse?: string;
};

/** Document IPID/DIC réellement attaché au dossier (Lot 8e). */
export type DocumentAnnexe = {
  type: "ipid" | "dic" | "autre";
  /** Nom du fichier ou intitulé court. */
  nom: string;
};

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
  /** Identité client compacte en haut de page 1 (omise si absente). */
  client?: IdentiteClientCompacte;
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
  /** Texte de l'encart « Documents remis » (IPID/DIC) — fallback si pas de
   *  liste réelle. Ignoré si `documents` est fourni avec ≥ 1 entrée. */
  documentsRemisHtml: string;
  /** Liste réelle des pièces IPID/DIC du dossier (Lot 8e). Si fournie avec
   *  ≥ 1 entrée, supplante documentsRemisHtml et liste les noms de fichiers. */
  documents?: DocumentAnnexe[];
  // ── Recos détaillées par dimension (encart page 2) ───────────────────
  /** Recommandations Lot 7 groupées par dimension (libellé + justification
   *  + besoin lié). Encart omis si absent ou tableau vide. */
  recommandationsGroupees?: GroupeRecommandationsParDimension[];
  // ── Pied / mentions ───────────────────────────────────────────────────
  mentionNonContractuelle: string;
};

export function pageFicheDDA(t: Tokens, d: FicheDDAPageData): string {
  // ─── PAGE 1 — Intro + Exigences & besoins + Conseil fourni ──────────
  const introTexte = `Cette fiche formalise vos <strong>exigences et besoins</strong>, le <strong>conseil</strong> fourni et sa <strong>justification</strong>, conformément au devoir de conseil du code des assurances. L'information est délivrée de manière claire, exacte et non trompeuse, et le conseil rendu avec impartialité.`;

  // ── Encadré « Vos exigences & besoins » : intro + liste besoins icônés
  // Libellé neutre figé (pas de varm ni de logique conditionnelle selon le
  // type de besoins) — couvre tous les cas : prévoyance, épargne, mixtes.
  const introBesoins = `Besoins recueillis lors de notre entretien :`;
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

  // ── Bandeau identité client compact (sous header, avant intro) ──────
  // Rendu uniquement si d.client fourni. 2 cellules en grille :
  //   • Le ou les client(s) : « P1 (jj/mm/aaaa) & P2 (jj/mm/aaaa) »
  //     — pas de « & » si seule person1, pas de « (…) » si naissance vide.
  //   • Adresse (varm, fallback « adresse postale » à confirmer si vide).
  const formatPersonne = (p: { nom: string; naissance?: string }): string => {
    return p.naissance ? `${p.nom} <span style="color:${t.texteFaibleClair}">(${p.naissance})</span>` : p.nom;
  };
  const labelClient = (d.client && d.client.person2) ? "Les clients" : "Le client";
  const lignePersonnes = d.client
    ? (d.client.person2
        ? `${formatPersonne(d.client.person1)} &amp; ${formatPersonne(d.client.person2)}`
        : formatPersonne(d.client.person1))
    : "";
  const bandeauClient = d.client
    ? `<div style="margin-top:11px;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-left:3px solid ${t.or};border-radius:8px;padding:8px 12px">
        <div style="display:grid;grid-template-columns:1.4fr 2fr;gap:9px 18px">
          <div>
            <div style="font-family:'Lato',sans-serif;font-size:8px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">${labelClient}</div>
            <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700;margin-top:1px">${lignePersonnes}</div>
          </div>
          <div>
            <div style="font-family:'Lato',sans-serif;font-size:8px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Adresse</div>
            <div class="lt" style="font-size:10.5px;color:${t.texte};margin-top:1px">${d.client.adresse ? champMission(t, d.client.adresse) : champMission(t, "adresse postale")}</div>
          </div>
        </div>
      </div>`
    : "";

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

    ${bandeauClient}

    ${encadreDocReg(t, { titre: "Vos exigences & besoins", marginTop: bandeauClient ? "11px" : "14px", contenuHtml: besoinsContenu })}
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

  // Encart Documents remis : style noteIconee « conseil » (fond beige bord or g).
  // Si une liste réelle de documents (IPID/DIC) est fournie, on l'affiche
  // sous forme de pastilles type + nom de fichier. Sinon, on garde le
  // wording générique passé via documentsRemisHtml.
  const documentsHtml = (d.documents && d.documents.length > 0)
    ? `<strong>Documents remis avec cette fiche</strong> : ` + d.documents
        .map(doc => `<span style="display:inline-block;background:#fff;border:0.5px solid ${t.bordureMoyenne};border-radius:10px;padding:1px 8px;margin:0 4px 2px 0;font-size:9.5px"><strong style="color:${t.navy}">${doc.type.toUpperCase()}</strong> · ${doc.nom}</span>`)
        .join("")
    : d.documentsRemisHtml;
  const docsRemis = noteIconee(t, {
    iconeSvg: icones.paperclip(t.eyebrowOr, 16),
    texteHtml: documentsHtml,
    style: "conseil",
  });

  // Nouvel encart « Recommandations issues du diagnostic » — recos Lot 7
  // groupées par dimension. Style identique à celui de l'Adéquation pour
  // cohérence visuelle entre les 2 documents conformité.
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
    ${encadreDocReg(t, { titre: "En quoi ce conseil répond à vos besoins", marginTop: "0",    contenuHtml: miseEnRegardContenu })}
    ${matriceRecos}
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
