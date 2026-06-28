// ─── Lot — Page Fiche conseil DDA v2 (MIGRÉE au contrat moteur) ────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_fiche_conseil_dda_2pages.html
//
// Document DDA (Directive Distribution d'Assurance) — formalise les exigences et
// besoins du client, le conseil fourni et sa justification, conformément au devoir
// de conseil du code des assurances.
//
// PHASE 3 (moteur paged.js) — 2e document réglementaire migré au contrat
// (engine/contrat.ts), MÊME moule que la Déclaration d'adéquation. Le découpage
// manuel p1/p2 DISPARAÎT : la page DÉCLARE des blocs ; paged.js pagine (N feuilles).
//   • Sortie de coquillePageDocReg : plus de boîte A4, plus de pied codé en dur
//     (« 1 / 2 ») — le feeder fournit en-tête / pied / X-N via counter(page).
//   • Liseré navy+or réémis PAR FEUILLE via data-pdf-page="docReg" (LOT 1a).
//   • Marges docReg 44/36 PRÉSERVÉES : on n'utilise PAS compilerPageContrat (32/38).
//   • recommandationsGroupees (NON BORNÉE, le cas qui clippait) → suite de cartes
//     BlocInsecable écoulées, zéro perte.
//   • SLOT SIGNATURE (ligne ORIAS + 2 cadres + mention) → BlocInsecable terminal
//     solidaireAvecPrecedent (anti-veuve). PAS d'attestation à souder (contrairement
//     à DA). Remplace le slot absolu bottom:42 qui était display:none sur paged.js.

import {
  headerDocReg,
  legendeChampsDocReg,
  encadreDocReg,
  sousTitreSection,
  champCabinet,
  champMission,
  cadresSignatureDocReg,
  marqueurVerifie,
  noteIconee,
  tableauBesoinReponse,
  icones,
  type LigneBesoinReponse,
} from "../primitives";
import { compilerBloc, type Bloc } from "../engine/contrat";
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
  const introTexte = `Cette fiche formalise vos <strong>exigences et besoins</strong>, le <strong>conseil</strong> fourni et sa <strong>justification</strong>, conformément au devoir de conseil du code des assurances. L'information est délivrée de manière claire, exacte et non trompeuse, et le conseil rendu avec impartialité.`;

  // ── Encadré « Vos exigences & besoins » : intro + liste besoins icônés
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

  const headerHtml = headerDocReg(t, {
    eyebrow: "Document réglementaire · DDA",
    titre: "Fiche d'information\n& de conseil",
    cabinetNom: d.cabinetNom,
    dateLabel: "Établie le",
    dateValeur: d.dateLettre,
    dateAsChamp: true,
  });
  const introHtml = `<div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.5;margin-top:11px">${introTexte}</div>`;

  // ─── PAGE 2 (ex) — contenus ───────────────────────────────────────────
  const miseEnRegardContenu = tableauBesoinReponse(t, d.miseEnRegard);

  const voletIbipContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.5">${d.voletIbipHtml}</div>
  `;

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

  // Encart Documents remis : pastilles IPID/DIC réelles, sinon wording générique.
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

  // Carte de reco (matrice) : 1 carte = 1 BlocInsecable (suite écoulée, comme DA)
  // → zéro perte même si la liste déborde sur N feuilles.
  const renderRecoCard = (r: { libelle: string; justification: string; besoinLibelle?: string }) => `<div style="background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-left:3px solid ${t.or};border-radius:6px;padding:7px 11px;margin-bottom:5px;page-break-inside:avoid;break-inside:avoid">
      <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700;margin-bottom:2px">${r.libelle}</div>
      <div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.45">${r.justification}</div>
      ${r.besoinLibelle ? `<div class="lt" style="font-size:8.5px;color:${t.texteFaibleClair};margin-top:3px;font-style:italic">Lié au besoin : ${r.besoinLibelle}</div>` : ""}
    </div>`;

  // Slot signature : MÊME HTML qu'avant (ligne ORIAS + 2 cadres 62px + mention) —
  // seule l'ENVELOPPE change (slot absolu bottom:42 → BlocInsecable en flux).
  const ligneOrias = `
    <div class="lt" style="font-size:9px;color:${t.texteFaibleClair};line-height:1.5">
      Statut d'intermédiaire en assurance — ORIAS n° ${d.cabinetORIAS} (www.orias.fr), ${champCabinet(t, d.cabinetCategorieIas)}. Autorité de contrôle : ACPR, 4 place de Budapest, 75436 Paris Cedex 09. ${marqueurVerifie(t, d.dateLettre)}
    </div>
  `;
  const signatureHtml = `
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

  // ─── Déclaration des blocs (contrat de page) — ordre du flux ──────────
  const blocs: Bloc[] = [];

  // En-tête / intro / légende.
  blocs.push({ kind: "insecable", html: headerHtml });
  blocs.push({ kind: "insecable", html: introHtml });
  blocs.push({ kind: "insecable", html: legendeChampsDocReg(t) });

  // Bandeau identité client (si présent).
  if (bandeauClient) {
    blocs.push({ kind: "insecable", html: bandeauClient });
  }

  // Exigences & besoins / Le conseil fourni — bornés (adapter=3). secableEnDernierRecours
  // = FILET si un futur appelant dépasse la feuille (le type est non borné) ; aucun
  // changement de rendu aujourd'hui (1 bloc qui tient).
  blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: encadreDocReg(t, { titre: "Vos exigences & besoins", marginTop: bandeauClient ? "11px" : "14px", contenuHtml: besoinsContenu }) });
  blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: encadreDocReg(t, { titre: "Le conseil fourni",        marginTop: "13px", contenuHtml: conseilContenu }) });

  // Mise en regard besoin → réponse (bornée ~3).
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "En quoi ce conseil répond à vos besoins", marginTop: "13px", contenuHtml: miseEnRegardContenu }) });

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

  // Volet assurance-vie (IBIP) — contenu RÉGLEMENTAIRE fixe (adéquation renforcée + ESG).
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Volet assurance-vie (IBIP)", marginTop: "12px", contenuHtml: voletIbipContenu }) });

  // Rémunération & impartialité (fixe).
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Rémunération & impartialité", marginTop: "12px", contenuHtml: remunerationContenu }) });

  // Documents remis (disclosure IPID/DIC) — pas de cohésion avec la signature.
  blocs.push({ kind: "insecable", html: docsRemis });

  // Slot signature terminal : bloc EN FLUX, jamais coupé (break-inside:avoid) et jamais
  // veuf en haut d'une feuille de continuation (solidaireAvecPrecedent → break-before:avoid).
  // PAS d'attestation à souder ici (contrairement à DA) ; pas de secableEnDernierRecours
  // (l'unité est bornée << feuille).
  blocs.push({
    kind: "insecable",
    solidaireAvecPrecedent: true,
    html: `<div style="margin-top:14px">${signatureHtml}</div>`,
  });

  // ─── Enveloppe docReg : marges 44/36 PRÉSERVÉES (divergence intentionnelle) +
  // marqueur data-pdf-page="docReg" (liseré par feuille via le feeder, LOT 1a) +
  // marqueur data-pdf-doc (numérotation X/N PAR DOCUMENT : le feeder le hisse en
  // data-doc, le DocNumHandler numérote « Fiche conseil DDA · X / N »).
  // On n'utilise PAS compilerPageContrat (32/38 figé dans contrat.ts).
  const corps = blocs.map(compilerBloc).join("\n");
  return (
    `<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="Fiche conseil DDA" style="padding:0 36px 0 44px;orphans:2;widows:2">\n` +
    `${corps}\n` +
    `</div>`
  );
}
