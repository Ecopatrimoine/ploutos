// ─── Lot 9 → Migration moteur — Page Lettre de mission v2 (document réglementaire) ─
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_lettre_de_mission_2pages.html
//
// MIGRÉ au contrat moteur paged.js (engine/contrat.ts), MÊME moule que le DER (#2)
// et la Fiche conseil DDA (#3). Le découpage manuel p1/p2 (2× coquillePageDocReg)
// DISPARAÎT : la page DÉCLARE une séquence de blocs ; paged.js pagine selon le
// contenu réel (N feuilles).
//   • Sortie de coquillePageDocReg : plus de boîte A4, plus de pied codé en dur
//     (« 1 / 2 ») — le feeder fournit en-tête / pied via counter(page) et le
//     DocNumHandler numérote PAR DOCUMENT (« Lettre de mission · X / N ») via
//     data-pdf-doc, au lieu du compteur GLOBAL du pack.
//   • SLOT SIGNATURE (variante PAR DÉFAUT : « Le client » / « lu et approuvé » /
//     « Fait à … » affiché / hauteur défaut) → BlocInsecable TERMINAL
//     solidaireAvecPrecedent (anti « signature veuve »). Remplace le slot absolu
//     bottom:42 que paged.js mettait en display:none. On NE copie PAS les overrides
//     DER (« un par partie » / 74px / masquerMentionFait).
//   • Marges docReg 44/36 PRÉSERVÉES : on n'utilise PAS compilerPageContrat (32/38).

import {
  headerDocReg,
  legendeChampsDocReg,
  encadreDocReg,
  champCabinet,
  champMission,
  listeCasesPrestations,
  cadresSignatureDocReg,
  noteIconee,
  icones,
  type CasePrestation,
} from "../primitives";
import { compilerBloc, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

export type LettreMissionPageData = {
  // ── Cabinet (issu de Paramètres / Lot 5) ───────────────────────────────
  cabinetNom: string;            // "EcoPatrimoine Conseil"
  cabinetAdresse: string;        // "6 rue Victor Mirabeau, 66000 Perpignan"
  cabinetTel?: string;           // M6 — coordonnée contact obligatoire
  cabinetEmail?: string;         // M6 — coordonnée contact obligatoire
  cabinetORIAS: string;          // "25006907"
  cabinetStatuts: string;        // ex: "Courtier en assurance (COA)"
  cabinetConseiller: string;     // "David Perry"
  cabinetBaremeHonoraires?: string;
  cabinetPartenaires?: string;   // M3 — liste partenaires assurance
  cabinetNiveauConseil?: "1" | "2"; // M2 — Niveau 1 (analyse besoins) ou 2 (perso)
  cabinetRcpAssureur?: string;   // M1 — assureur RCP
  cabinetRcpContrat?: string;    // M1 — n° contrat RCP
  cabinetRcpGarantiesMin?: string; // M1 — ex: "1 564 610 € / sinistre — 2 315 610 € / an (arrêté 29/10/2024 — à revérifier)"
  cabinetMediateur?: string;     // M5 — nom du médiateur compétent
  cabinetMediateurAdresse?: string; // M5
  cabinetMediateurUrl?: string;  // M5
  cabinetAssociationCif?: string; // affiché seulement si statutCif true
  // ── Statuts du cabinet (Lot 5) — pilotent les mentions conditionnelles ─
  statutCif: boolean;            // B2 — conditionne AMF + association CIF
  // statutCoa/Mia implicite ici (la lettre de mission est pour activité IAS)
  // ── Mission / client (varm) ────────────────────────────────────────────
  clientNom: string;
  clientAdresse: string;
  clientContact: string;
  dateLettre: string;            // "25 mai 2026"
  // ── Prestations cochées ────────────────────────────────────────────────
  prestations: CasePrestation[];
  // ── Rémunération (côté mission) ───────────────────────────────────────
  remunerationMode: string;
  natureConseil: string;         // "indépendant" ou "non indépendant"
  // ── Durée / résiliation ───────────────────────────────────────────────
  dureeMission: string;
  delaiPreavis: string;
  // ── Signature ──────────────────────────────────────────────────────────
  villeSignature?: string;
  // ── Mention non-contractuelle ─────────────────────────────────────────
  mentionNonContractuelle: string;
};

export function pageLettreMission(t: Tokens, d: LettreMissionPageData): string {
  // ─── Intro (ex-page 1) ──────────────────────────────────────────────
  // B1 corrigé : DDA / Code des assurances (et non RG AMF — le cabinet n'est
  // pas CIF par défaut). Si statutCif, mention complémentaire RG AMF.
  const introTexte = d.statutCif
    ? `La présente lettre définit la mission confiée au cabinet et ses conditions, <strong>préalablement à toute prestation de conseil</strong>, conformément aux obligations de l'intermédiaire en assurance (Code des assurances, DDA) et du conseiller en investissements financiers (RG AMF).`
    : `La présente lettre définit la mission confiée au cabinet et ses conditions, <strong>préalablement à toute prestation de conseil</strong>, conformément aux obligations de l'intermédiaire en assurance (<strong>Code des assurances</strong>, articles L.521-2 et L.521-4 — <strong>DDA</strong>).`;

  // ── Les parties — enrichi avec contact tel/email (M6) ────────────────
  const contactLignes: string[] = [];
  if (d.cabinetTel)   contactLignes.push(`Tél. ${d.cabinetTel}`);
  if (d.cabinetEmail) contactLignes.push(`${d.cabinetEmail}`);
  const partiesContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Le cabinet</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          ${d.cabinetNom}<br>
          ${d.cabinetAdresse}<br>
          ${contactLignes.length > 0 ? contactLignes.join(" · ") + "<br>" : ""}
          ORIAS n° ${d.cabinetORIAS} — ${champCabinet(t, d.cabinetStatuts)}
        </div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Le client</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          ${champMission(t, d.clientNom)}<br>
          ${champMission(t, d.clientAdresse)}<br>
          ${champMission(t, d.clientContact)}
        </div>
      </div>
    </div>
  `;

  // ── M3 : « Comment exerçons-nous ? » (art. L521-2 II 1°b) — IAS ────
  const exerciceContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.5">
      Nous exerçons notre activité selon les dispositions prévues à l'<strong>article L.521-2, II, 1°, b du Code des assurances</strong> :
      <ul style="margin-top:5px;padding-left:14px">
        <li>Nous ne sommes soumis à <strong>aucune obligation de travailler exclusivement</strong> avec une ou plusieurs entreprises d'assurance.</li>
        <li>Notre analyse porte sur les produits proposés par <strong>nos partenaires sélectionnés</strong> et ne constitue pas une analyse exhaustive de tous les produits du marché.</li>
        <li>Notre accompagnement repose sur un <em>contrôle de cohérence</em> entre vos besoins et les solutions proposées.</li>
      </ul>
      ${d.cabinetPartenaires
        ? `<p style="margin-top:6px;font-size:9.5px;color:${t.texteFaibleClair}">Partenaires sélectionnés (liste non exhaustive) : ${champCabinet(t, d.cabinetPartenaires)}.</p>`
        : `<p style="margin-top:6px;font-size:9.5px;color:${t.texteFaibleClair}">Partenaires sélectionnés : ${champCabinet(t, "à compléter dans Paramètres")}.</p>`
      }
    </div>
  `;

  // ── Objet & périmètre (fusion avec diligences pour gagner de la place) ─
  const objetEtDiligencesContenu = `
    <div class="lt" style="font-size:10px;color:${t.texteFaible};margin-bottom:7px">
      Prestations retenues pour ce dossier ${champMission(t, "sélection mission")} :
    </div>
    ${listeCasesPrestations(t, d.prestations)}
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.5;margin-top:10px;padding-top:8px;border-top:1px solid ${t.bordureClaire}">
      <strong>Diligences :</strong> le cabinet procède au recueil de votre situation (familiale, patrimoniale, financière, professionnelle), de vos objectifs, de votre horizon, de votre tolérance au risque et de vos préférences de durabilité, puis formalise ses recommandations dans un <strong>rapport écrit</strong> et, le cas échéant, une <strong>déclaration d'adéquation</strong>. Obligation de moyens, exercée avec diligence et impartialité.
    </div>
  `;

  // ── M2 : Niveau de conseil délivré (art. L521-4 DDA) ─────────────────
  const niveauActif = d.cabinetNiveauConseil || "1";
  const cocheNiv = (actif: boolean) => actif
    ? `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:2px solid ${t.navy};background:${t.navy};margin-right:5px;vertical-align:middle"></span>`
    : `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:2px solid ${t.bordureMoyenne};margin-right:5px;vertical-align:middle"></span>`;
  const niveauConseilContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="border:${niveauActif === "1" ? "1.5px solid " + t.navy : "0.5px solid " + t.bordureClaire};border-radius:6px;padding:8px 10px">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
          ${cocheNiv(niveauActif === "1")}
          <strong class="lt" style="font-size:10px;color:${t.navy}">Niveau 1 — Analyse des besoins</strong>
        </div>
        <p class="lt" style="font-size:9px;color:${t.texteFaible};line-height:1.4;margin:0">Recommandation cohérente avec vos besoins et exigences, sans analyse approfondie de tous les produits du marché.</p>
      </div>
      <div style="border:${niveauActif === "2" ? "1.5px solid " + t.navy : "0.5px solid " + t.bordureClaire};border-radius:6px;padding:8px 10px">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
          ${cocheNiv(niveauActif === "2")}
          <strong class="lt" style="font-size:10px;color:${t.navy}">Niveau 2 — Recommandation personnalisée</strong>
        </div>
        <p class="lt" style="font-size:9px;color:${t.texteFaible};line-height:1.4;margin:0">Conseil reposant sur une analyse objective du marché et une évaluation approfondie de votre situation patrimoniale globale.</p>
      </div>
    </div>
  `;

  // En-tête (ex-page 1). dateAsChamp PAR DÉFAUT = true (date en champ mission varm)
  // — divergence VOULUE vs DER (qui forçait false). NE PAS la modifier.
  const headerHtml = headerDocReg(t, {
    eyebrow: "Document réglementaire",
    titre: "Lettre de mission",
    cabinetNom: d.cabinetNom,
    dateValeur: d.dateLettre,
  });

  // ─── Rémunération + RCP + Durée + Obligations + Statuts/médiation (ex-page 2) ─
  // M4 ajouté : mention « ≥10% » (art. L.521-2 I). Nature du conseil dans
  // une ligne séparée pour lisibilité.
  const remunerationContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Honoraires de conseil — ce dossier</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          ${champMission(t, d.remunerationMode)}
        </div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Barème de référence du cabinet</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          ${champCabinet(t, d.cabinetBaremeHonoraires || "barème honoraires")}
        </div>
      </div>
    </div>
    <div class="lt" style="margin-top:9px;font-size:10px;color:${t.texteFaible};line-height:1.5">
      Le cas échéant, le cabinet perçoit des <strong>commissions</strong> de la part des partenaires au titre de la distribution de produits ; leur nature est précisée et, pour l'assurance, communiquée avant la conclusion de tout contrat. Nature du conseil : ${champCabinet(t, d.natureConseil)}.
    </div>
    <div class="lt" style="margin-top:6px;font-size:9px;color:${t.texteFaibleClair};line-height:1.45">
      <strong>Indépendance capitalistique (art. L.521-2 I) :</strong> le cabinet n'entretient aucune participation directe ou indirecte ≥ 10 % dans le capital d'une entreprise d'assurance, ni l'inverse.
    </div>
  `;

  // M1 : RCP — assureur + n° contrat + garanties minimales légales
  const rcpAssureur = d.cabinetRcpAssureur || "assureur RCP";
  const rcpContrat  = d.cabinetRcpContrat  || "n° contrat";
  const rcpGaranties = d.cabinetRcpGarantiesMin
    || "1 564 610 € par sinistre / 2 315 610 € par année (arrêté du 29 oct. 2024 — à revérifier)";
  const rcpContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.55">
      Le cabinet est titulaire d'un contrat d'assurance Responsabilité Civile Professionnelle, en application de l'article L.512-7 du Code des assurances :
      <ul style="margin-top:4px;padding-left:14px">
        <li>Assureur : ${champCabinet(t, rcpAssureur)}</li>
        <li>N° de contrat : ${champCabinet(t, rcpContrat)}</li>
        <li>Garanties minimales légales : <strong>${rcpGaranties}</strong></li>
      </ul>
    </div>
  `;

  const dureeContenu = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 18px">
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Durée de la mission</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">${champMission(t, d.dureeMission)}</div>
      </div>
      <div>
        <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair}">Résiliation</div>
        <div class="lt" style="font-size:11px;color:${t.texte};line-height:1.5;margin-top:2px">
          par chaque partie, par écrit, sous réserve d'un préavis de ${champMission(t, d.delaiPreavis)}
        </div>
      </div>
    </div>
  `;

  const obligationsContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.55">
      Le cabinet s'engage à un conseil diligent, objectif et adapté, et au respect de la confidentialité. Le client s'engage à fournir une information <strong>exacte et complète</strong> ; à défaut, le cabinet ne pourrait être tenu responsable d'un conseil rendu sur des bases erronées. Sans communication des informations nécessaires, le cabinet s'abstient de fournir le conseil.
    </div>
  `;

  // B2 corrigé : AMF + association CIF conditionnés via statutCif.
  // M5 ajouté : médiateur compétent (nom + adresse + URL).
  const mediateur = d.cabinetMediateur || "médiateur de l'assurance";
  const mediateurAdr = d.cabinetMediateurAdresse || "TSA 50110, 75441 Paris Cedex 09";
  const mediateurUrl = d.cabinetMediateurUrl || "www.mediation-assurance.org";
  const statutsContenu = `
    <div class="lt" style="font-size:10px;color:${t.texte};line-height:1.55">
      ORIAS n° ${d.cabinetORIAS} (<a href="https://www.orias.fr" style="color:${t.sectionGrisBleu}">www.orias.fr</a>) — ${champCabinet(t, d.cabinetStatuts)}.
      <br><br>
      <strong>Autorité de tutelle :</strong> ACPR — Autorité de Contrôle Prudentiel et de Résolution, 4 place de Budapest CS 92459, 75436 Paris Cedex 09${d.statutCif ? `. Pour le volet CIF, l'autorité compétente est l'AMF — Autorité des Marchés Financiers, 17 place de la Bourse, 75082 Paris Cedex 02. Association CIF de rattachement : ${champCabinet(t, d.cabinetAssociationCif || "à renseigner")}.` : "."}
      <br><br>
      <strong>Médiation (art. L.616-1 Code de la consommation) :</strong> en cas de litige non résolu, le client peut saisir ${champCabinet(t, mediateur)}${mediateurAdr ? ` — ${mediateurAdr}` : ""}${mediateurUrl ? ` (<a href="https://${mediateurUrl}" style="color:${t.sectionGrisBleu}">${mediateurUrl}</a>)` : ""}.
    </div>
  `;

  // Slot signature TERMINAL — VARIANTE PAR DÉFAUT de cadresSignatureDocReg :
  // « Le client » / « lu et approuvé », date & signature / ligne « Fait à {ville},
  // le {date} » AFFICHÉE (pas de masquerMentionFait) / hauteur par défaut.
  // CONSERVÉ À L'IDENTIQUE — on NE copie PAS les overrides DER (« un par partie »
  // / 74px / labelClient enrichi / masquerMentionFait).
  const page2Signature = `
    ${cadresSignatureDocReg(t, {
      cabinetNomConseiller: d.cabinetConseiller,
      cabinetNom: d.cabinetNom,
      ville: d.villeSignature,
      date: d.dateLettre,
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
  blocs.push({ kind: "insecable", html: legendeChampsDocReg(t) });

  // Parties → Exercice → Objet/diligences → Niveau de conseil (ex-page 1).
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Les parties",                                          marginTop: "12px", contenuHtml: partiesContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Comment exerçons-nous ? (art. L.521-2 II 1°b)",        contenuHtml: exerciceContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Objet, périmètre & diligences",                       contenuHtml: objetEtDiligencesContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Niveau de conseil délivré (art. L.521-4 DDA)",         contenuHtml: niveauConseilContenu }) });

  // Rémunération → RCP → Durée → Obligations → Statuts/médiation (ex-page 2).
  // « Rémunération » avait marginTop:"0" (artefact de haut-de-page 2) ; en flux
  // continu on laisse le défaut (13px) pour un rythme cohérent avec ci-dessus.
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Rémunération",                                         contenuHtml: remunerationContenu }) });
  // RCP : texte long -> filet secableEnDernierRecours (laisse couler si une feuille déborde).
  blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: encadreDocReg(t, { titre: "Responsabilité Civile Professionnelle", marginTop: "11px", contenuHtml: rcpContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Durée & résiliation",                                  marginTop: "11px", contenuHtml: dureeContenu }) });
  blocs.push({ kind: "insecable", html: encadreDocReg(t, { titre: "Obligations réciproques",                              marginTop: "11px", contenuHtml: obligationsContenu }) });
  // Statuts/médiation : texte long (conditionnel CIF) -> filet secableEnDernierRecours.
  blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: encadreDocReg(t, { titre: "Statuts, autorités de contrôle & médiation", marginTop: "11px", contenuHtml: statutsContenu }) });

  // Signature TERMINALE : bloc EN FLUX, jamais coupé (break-inside:avoid) et jamais
  // veuf en haut d'une feuille de continuation (solidaireAvecPrecedent → break-before:avoid).
  // C'est le DERNIER bloc.
  blocs.push({
    kind: "insecable",
    solidaireAvecPrecedent: true,
    html: `<div style="margin-top:14px">${page2Signature}</div>`,
  });

  // ─── Enveloppe docReg : marges 44/36 PRÉSERVÉES (divergence intentionnelle) +
  // marqueur data-pdf-page="docReg" (liseré par feuille via le feeder, LOT 1a) +
  // marqueur data-pdf-doc="Lettre de mission" (numérotation X/N PAR DOCUMENT, en dur
  // comme DDA/DA — pas de constante). On n'utilise PAS compilerPageContrat (32/38 figé).
  const corps = blocs.map(compilerBloc).join("\n");
  return (
    `<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="Lettre de mission" style="padding:30px 36px 0 44px;orphans:2;widows:2">\n` +
    `${corps}\n` +
    `</div>`
  );
}
