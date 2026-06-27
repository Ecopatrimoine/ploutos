// ─── Lot 9 → Migration moteur — Page DER v2 (Document d'Entrée en Relation) ──────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_der_document_entree_en_relation_2pages.html
//
// MIGRÉ au contrat moteur paged.js (engine/contrat.ts), MÊME moule que la Fiche
// conseil DDA (#3). Le découpage manuel p1/p2/p3 (3× coquillePageDocReg)
// DISPARAÎT : la page DÉCLARE une séquence de blocs ; paged.js pagine selon le
// contenu réel (N feuilles).
//   • Sortie de coquillePageDocReg : plus de boîte A4, plus de pied codé en dur
//     (« 1 / 3 ») — le feeder fournit en-tête / pied via counter(page) et le
//     DocNumHandler numérote PAR DOCUMENT (via data-pdf-doc).
//   • Cette page = SECTION PRINCIPALE (Identité → Statuts → Autorités → RCP →
//     Conseil → Rémunération → Conflits → Médiation → RGPD → Signature TERMINALE).
//     L'annexe « Références légales » part dans pageDerAnnexe.ts (section séparée,
//     feuille neuve). Les 2 sections partagent data-pdf-doc=DOC_DER → compteur X/N
//     COMMUN (DocNumHandler).
//   • SLOT SIGNATURE (variante DER : « lu et approuvé » / « un par partie » / 74px)
//     → BlocInsecable TERMINAL solidaireAvecPrecedent (anti « signature veuve »).
//     Remplace le slot absolu bottom:42 que paged.js mettait en display:none.
//   • Marges docReg 44/36 PRÉSERVÉES : on n'utilise PAS compilerPageContrat (32/38).

import {
  legendeChampsDocReg,
  encadreDocReg,
  headerDocReg,
  champCabinet,
  cadresSignatureDocReg,
  marqueurVerifie,
  marqueurAConfirmer,
  noteIconee,
  icones,
} from "../primitives";
import { compilerBloc, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

/** Libellé LISIBLE du document, PARTAGÉ octet-pour-octet avec pageDerAnnexe.ts.
 *  Le feeder le hisse en data-doc ; le DocNumHandler groupe les 2 sections
 *  (principal + annexe) sur un compteur X/N COMMUN « <DOC_DER> · X / N ».
 *  ⚠ Ce n'est PAS le PACK_LABEL "DER - annexe" : les deux sections doivent porter
 *  la MÊME chaîne pour être regroupées. */
export const DOC_DER = "Document d'entrée en relation";

export type DerPageData = {
  // ── Cabinet (Paramètres / Lot 5) ──────────────────────────────────────
  cabinetNom: string;
  cabinetAdresse: string;
  cabinetEmail?: string;
  cabinetTel?: string;
  cabinetORIAS: string;
  cabinetForme?: string;        // ex: "EI", "SAS", "SARL"
  cabinetCapital?: string;      // ex: "10 000 €"
  cabinetSiren?: string;
  cabinetRcsVille?: string;     // ex: "Perpignan" — ville du greffe RCS
  cabinetRcs?: string;          // ex: "123 456 789" — n° d'immatriculation RCS
  cabinetConseiller: string;    // "David Perry"
  // Statuts ORIAS détenus (par catégorie). statutIas est requis (rétro-compat).
  // Les flags fins ci-dessous (statutCoa/Mia/CarteT) servent à la page
  // Références légales (annexe) — si absents, la dérivation se replie sur statutIas.
  statutCif: boolean;
  cabinetAssociationCif?: string;
  statutIas: boolean;
  statutCoa?: boolean;
  statutMia?: boolean;
  cabinetCategorieIas?: string; // ex: "Courtier en assurance (COA)"
  statutIobsp: boolean;
  cabinetCategorieIobsp?: string;
  statutCarteT?: boolean;       // Carte T (transactions immobilières) — annexe réf. légales
  // RCP & garantie financière
  cabinetRcpAssureur?: string;
  cabinetRcpContrat?: string;
  cabinetRcpMontants?: string;  // ex: "1 564 610 € / sinistre — 2 315 610 € / an"
  cabinetGarantieFinanciere?: string;  // ex: "115 000 €" OU "ne reçoit aucun fonds"
  // Rémunération
  remunerationCifMode?: string;
  remunerationIasMode?: string;
  natureConseil: string;        // "indépendant" / "non indépendant"
  partenaires?: string;
  // Médiateurs
  mediateurAmf?: string;
  mediateurAssurance?: string;
  // Date
  dateLettre: string;
  villeSignature?: string;
  // Mention non-contractuelle
  mentionNonContractuelle: string;
};

// ─── Helper local : libellé d'immatriculation RCS unique ─────────────
// Combine ville du greffe + numéro (rcs si renseigné, sinon siren — c'est
// le même nombre dans 99 % des cas, l'immatriculation au greffe reprend
// le SIREN). Rend un seul libellé « RCS {ville} · {numéro} » au lieu de
// 2 lignes SIREN + RCS qui faisaient doublon.
function immatriculationRcs(d: DerPageData): string {
  const numero = d.cabinetRcs || d.cabinetSiren;
  if (!numero) return "n° d'immatriculation RCS";
  return d.cabinetRcsVille ? `RCS ${d.cabinetRcsVille} · ${numero}` : `RCS · ${numero}`;
}

export function pageDer(t: Tokens, d: DerPageData): string {
  // ─── Intro (ex-page 1) ──────────────────────────────────────────────
  const introTexte = `Document remis <strong>avant toute prestation de conseil</strong>, conformément aux obligations applicables à l'intermédiaire en assurance (<strong>Code des assurances, DDA</strong>)${d.statutCif ? " et au conseiller en investissements financiers (<strong>RG AMF</strong>)" : ""}.`;

  // Bloc Cabinet
  const cabinetContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Dénomination</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${d.cabinetNom}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Forme juridique · capital</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, `${d.cabinetForme || "forme"} · ${d.cabinetCapital || "capital"}`)}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Adresse professionnelle</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${d.cabinetAdresse}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Immatriculation</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, immatriculationRcs(d))}</div>
      </div>
      <div style="grid-column:1 / -1">
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Contact</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${[d.cabinetEmail, d.cabinetTel].filter(Boolean).join(" · ") || "—"}</div>
      </div>
    </div>
  `;

  // Bloc Statuts ORIAS (lignes conditionnelles selon statuts détenus)
  const statutsLignes: string[] = [];
  if (d.statutCif) {
    statutsLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Conseiller en investissements financiers (CIF)</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">Statut détenu</div></div>`);
    statutsLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Association CIF agréée AMF</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetAssociationCif || "nom de l'association")}</div></div>`);
  }
  if (d.statutIas) {
    statutsLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Intermédiaire en assurance (IAS)</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetCategorieIas || "catégorie IAS")}</div></div>`);
  }
  if (d.statutIobsp) {
    statutsLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Intermédiaire en op. de banque (IOBSP)</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetCategorieIobsp || "catégorie IOBSP")}</div></div>`);
  }
  const statutsContenu = `
    <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-bottom:9px">
      Immatriculé au registre unique des intermédiaires <strong>ORIAS n° ${d.cabinetORIAS}</strong> — vérifiable sur <strong>www.orias.fr</strong>. ${marqueurAConfirmer(t, "n° vérifié · statuts à confirmer")}
    </div>
    ${statutsLignes.length > 0 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 18px">${statutsLignes.join("")}</div>` : `<div class="lt" style="font-size:10px;color:${t.texteFaibleClair};font-style:italic">Aucun statut ORIAS coché dans Paramètres → Statuts &amp; conformité.</div>`}
  `;

  // Bloc Autorités (conditionnel : AMF si CIF, ACPR si IAS/IOBSP)
  const autoritesColonnes: string[] = [];
  if (d.statutCif) {
    autoritesColonnes.push(`
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Pour le conseil financier (CIF)</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          Autorité des marchés financiers (AMF)<br>
          17 place de la Bourse, 75082 Paris Cedex 02<br>
          <span style="color:${t.sectionGrisBleu}">www.amf-france.org</span>
        </div>
        <div style="margin-top:3px">${marqueurVerifie(t, d.dateLettre)}</div>
      </div>
    `);
  }
  if (d.statutIas || d.statutIobsp) {
    autoritesColonnes.push(`
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Pour l'assurance${d.statutIobsp ? " &amp; la banque" : ""}</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          Autorité de contrôle prudentiel et de résolution (ACPR)<br>
          4 place de Budapest, CS 92459, 75436 Paris Cedex 09<br>
          <span style="color:${t.sectionGrisBleu}">acpr.banque-france.fr</span>
        </div>
        <div style="margin-top:3px">${marqueurVerifie(t, d.dateLettre)}</div>
      </div>
    `);
  }
  const cols = autoritesColonnes.length === 1 ? "1fr" : "1fr 1fr";
  const autoritesContenu = autoritesColonnes.length > 0
    ? `<div style="display:grid;grid-template-columns:${cols};gap:9px 18px">${autoritesColonnes.join("")}</div>`
    : `<div class="lt" style="font-size:10px;color:${t.texteFaibleClair};font-style:italic">Aucun statut ORIAS coché → autorités de tutelle à déterminer une fois les statuts renseignés.</div>`;

  // Bloc RCP
  const rcpContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Assureur RC pro · n° de police</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, [d.cabinetRcpAssureur, d.cabinetRcpContrat].filter(Boolean).join(" · ") || "assureur & n° police RCP")}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Montants de garantie</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetRcpMontants || "1 564 610 € / sinistre — 2 315 610 € / an (arrêté 29/10/2024)")}</div>
      </div>
      <div style="grid-column:1 / -1">
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Garantie financière (si maniement de fonds)</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.cabinetGarantieFinanciere || "garantie financière / « ne reçoit aucun fonds »")}</div>
      </div>
    </div>
  `;

  // En-tête (ex-page 1).
  const headerHtml = headerDocReg(t, {
    eyebrow: "Document réglementaire",
    titre: "Document d'entrée\nen relation",
    cabinetNom: d.cabinetNom,
    dateLabel: "Remis le",
    dateValeur: d.dateLettre,
    dateAsChamp: false,
  });

  // ─── Conseil + Rémunération + Conflits + Médiation + RGPD (ex-page 2) ─
  const natureConseilContenu = `
    <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5">
      ${champCabinet(t, `conseil ${d.natureConseil}`)} — la portée du conseil est expliquée afin de permettre d'en distinguer le caractère. En cas de conseil non indépendant, le cabinet est susceptible de percevoir des rémunérations de tiers.
    </div>
  `;

  const remunerationLignes: string[] = [];
  if (d.statutCif) {
    remunerationLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Conseil financier (CIF)</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.remunerationCifMode || "honoraires / rétrocessions — barème")}</div></div>`);
  }
  if (d.statutIas) {
    remunerationLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Assurance (IAS)</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.remunerationIasMode || "courtier / mandataire · commissions / honoraires")}</div></div>`);
  }
  const remunerationContenu = `
    ${remunerationLignes.length > 0 ? `<div style="display:grid;grid-template-columns:${remunerationLignes.length === 1 ? "1fr" : "1fr 1fr"};gap:9px 18px">${remunerationLignes.join("")}</div>` : `<div class="lt" style="font-size:10px;color:${t.texteFaibleClair};font-style:italic">Modes de rémunération à préciser selon les statuts détenus.</div>`}
    <div class="lt" style="margin-top:9px;font-size:10px;color:${t.texteFaible};line-height:1.5">
      Le détail chiffré de la rémunération est précisé dans la lettre de mission et, pour l'assurance, communiqué avant la conclusion du contrat.
    </div>
  `;

  const liensContenu = `
    <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-bottom:8px">
      <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair};margin-bottom:2px">Liens capitalistiques ou commerciaux significatifs</div>
      ${champCabinet(t, d.partenaires || "liste des partenaires / promoteurs")}
    </div>
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.5">
      Le cabinet a mis en place une politique de prévention et de gestion des <strong>conflits d'intérêts</strong> ; toute situation ne pouvant être évitée est portée à votre connaissance avant la fourniture du conseil.
    </div>
  `;

  const mediationLignes: string[] = [];
  if (d.statutCif) {
    mediationLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Médiateur — litiges financiers (CIF)</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.mediateurAmf || "médiateur AMF / association")}</div></div>`);
  }
  if (d.statutIas) {
    mediationLignes.push(`<div><div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Médiateur — litiges assurance</div><div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champCabinet(t, d.mediateurAssurance || "médiateur de l'assurance")}</div></div>`);
  }
  const reclamationsContenu = `
    <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-bottom:8px">
      Toute réclamation peut être adressée gratuitement au cabinet (contact ci-dessus) ; une réponse est apportée dans les délais réglementaires. À défaut de solution amiable, vous pouvez saisir le médiateur compétent :
    </div>
    ${mediationLignes.length > 0 ? `<div style="display:grid;grid-template-columns:${mediationLignes.length === 1 ? "1fr" : "1fr 1fr"};gap:9px 18px">${mediationLignes.join("")}</div>` : ""}
    <div style="margin-top:6px">${marqueurAConfirmer(t, "coordonnées du médiateur à confirmer selon la désignation effective du cabinet")}</div>
  `;

  const rgpdContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.5">
      Les données recueillies sont traitées pour la gestion de la relation et le respect des obligations légales (devoir de conseil, LCB-FT). Vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition, et pouvez saisir la CNIL. La politique de confidentialité complète est disponible sur demande.
    </div>
  `;

  // Slot signature TERMINAL (convention DER). Variante "précédé de « lu et
  // approuvé »" + "un par partie" + cadre client sans pré-remplissage du nom
  // client (le DER peut être remis avant signature de la lettre de mission, donc
  // le nom client peut ne pas encore exister). CONSERVÉ À L'IDENTIQUE — on ne
  // bascule PAS vers les paramètres simplifiés de la DDA.
  const page2Signature = `
    ${cadresSignatureDocReg(t, {
      cabinetNomConseiller: d.cabinetConseiller,
      cabinetNom: d.cabinetNom,
      ville: d.villeSignature,
      date: d.dateLettre,
      labelClient: "Le client — nom & signature",
      mentionClient: "précédé de « lu et approuvé »",
      exemplaires: "en deux exemplaires, un par partie",
      hauteurCadre: "74px",
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
  blocs.push({ kind: "insecable", html: headerHtml });
  blocs.push({
    kind: "insecable",
    html: `<div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.5;margin-top:11px">${introTexte}</div>`,
  });
  blocs.push({ kind: "insecable", html: legendeChampsDocReg(t, { seulementCabinet: true }) });

  // Identité → Statuts → Autorités → RCP (ex-page 1), MÊME ordre / MÊME contenu.
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Le cabinet",                                          marginTop: "15px", contenuHtml: cabinetContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Statuts & immatriculation",                           contenuHtml: statutsContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Autorités de contrôle",                               contenuHtml: autoritesContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Assurance RC professionnelle & garantie financière",  contenuHtml: rcpContenu }) });

  // Conseil → Rémunération → Conflits → Médiation → RGPD (ex-page 2). « Nature du
  // conseil » avait marginTop:"0" (artefact de haut-de-page 2) ; en flux continu
  // on laisse le défaut (13px) pour un rythme cohérent avec les encadrés ci-dessus.
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Nature du conseil",                                   contenuHtml: natureConseilContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Modes de rémunération",                               marginTop: "12px", contenuHtml: remunerationContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Liens avec les entreprises & conflits d'intérêts",    marginTop: "12px", contenuHtml: liensContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Réclamations & médiation",                            marginTop: "12px", contenuHtml: reclamationsContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Protection des données (RGPD)",                       marginTop: "12px", contenuHtml: rgpdContenu }) });

  // Signature TERMINALE : bloc EN FLUX, jamais coupé (break-inside:avoid) et jamais
  // veuf en haut d'une feuille de continuation (solidaireAvecPrecedent → break-before:avoid).
  // C'est le DERNIER bloc : l'annexe Références part dans pageDerAnnexe (section neuve).
  blocs.push({
    kind: "insecable",
    solidaireAvecPrecedent: true,
    html: `<div style="margin-top:14px">${page2Signature}</div>`,
  });

  // ─── Enveloppe docReg : marges 44/36 PRÉSERVÉES (divergence intentionnelle) +
  // marqueur data-pdf-page="docReg" (liseré par feuille via le feeder, LOT 1a) +
  // marqueur data-pdf-doc=DOC_DER (numérotation X/N PAR DOCUMENT, PARTAGÉE avec
  // l'annexe). On n'utilise PAS compilerPageContrat (32/38 figé dans contrat.ts).
  const corps = blocs.map(compilerBloc).join("\n");
  return (
    `<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="${DOC_DER}" style="padding:0 36px 0 44px;orphans:2;widows:2">\n` +
    `${corps}\n` +
    `</div>`
  );
}
