// ─── Migration moteur — Page DER · Annexe « Références légales » (section séparée) ─
//
// Section ANNEXE du DER, détachée de pageDer.ts lors de la migration au contrat
// moteur paged.js. La logique (statutFlags → referencesLegales → regroupement par
// régulateur → encadré UNIQUE « Cadre légal calculé d'après vos statuts ») est
// DÉPLACÉE TELLE QUELLE depuis l'ex-page 3 de pageDer : visuel inchangé, UN SEUL
// encadré (on n'éclate PAS par régulateur).
//
//   • Wrapper IDENTIQUE à pageDer : data-pdf-page="docReg" + marges 44/36.
//   • data-pdf-doc = DOC_DER, importé de pageDer → chaîne OCTET-POUR-OCTET identique
//     à la section principale. Le DocNumHandler regroupe alors les 2 sections sur un
//     compteur X/N COMMUN (« <DOC_DER> · X / N »), l'annexe = dernière feuille.
//   • Le saut de feuille entre la section principale et l'annexe est garanti par le
//     feeder (#pack-flow > section { break-before: page }, au bord de <section>,
//     indépendant de data-pdf-doc) — partager data-pdf-doc ne le supprime pas.
//   • Encadré Références = UN BlocInsecable + secableEnDernierRecours (filet anti-clip :
//     si la liste de références déborde une feuille, elle coule au lieu de boucler).

import {
  headerDocReg,
  encadreDocReg,
  marqueurAConfirmer,
  noteIconee,
  icones,
} from "../primitives";
import { compilerBloc, type Bloc } from "../engine/contrat";
import { referencesLegales, type StatutFlags } from "../../../conformite/referencesLegales";
import type { Tokens } from "../tokens";
import { DOC_DER, type DerPageData } from "./pageDer";

export function pageDerAnnexe(t: Tokens, d: DerPageData): string {
  // Dérivation des flags fins depuis les statuts agrégés (rétro-compat avec la
  // fixture v2 historique qui ne distinguait pas COA/MIA).
  const statutFlags: StatutFlags = {
    coa:    d.statutCoa    ?? d.statutIas,
    mia:    d.statutMia    ?? false,
    iobsp:  d.statutIobsp,
    cif:    d.statutCif,
    carteT: d.statutCarteT ?? false,
  };
  const refs = referencesLegales(statutFlags);

  // Groupement par régulateur pour la lisibilité (ACPR / AMF / DGCCRF...)
  // — l'ordre suit l'apparition (Map préserve l'insertion order).
  const refsByRegulateur = new Map<string, typeof refs>();
  for (const r of refs) {
    const arr = refsByRegulateur.get(r.regulateur) || [];
    arr.push(r);
    refsByRegulateur.set(r.regulateur, arr);
  }

  const refsParRegulateurHtml = refs.length === 0
    ? `<div class="lt" style="font-size:11px;color:${t.texteFaibleClair};font-style:italic">Aucun statut ORIAS coché dans Paramètres → la liste des références applicables se construira automatiquement dès qu'un statut sera renseigné.</div>`
    : Array.from(refsByRegulateur.entries()).map(([reg, items]) => `
        <div style="margin-bottom:12px">
          <div style="font-family:'Lato',sans-serif;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:${t.texteFaibleClair};margin-bottom:6px">${reg}</div>
          ${items.map(r => `
            <div style="display:grid;grid-template-columns:140px 1fr;gap:0;padding:6px 0;border-bottom:1px solid ${t.bordureClaire}">
              <div class="lt" style="font-size:10.5px;color:${t.texte};font-weight:700">${r.code}${r.article && r.article !== "—" ? ` · ${r.article}` : ""}</div>
              <div class="lt" style="font-size:10.5px;color:${t.texte};line-height:1.45;padding-left:12px">${r.libelle}${r.note ? ` ${marqueurAConfirmer(t, r.note)}` : ""}</div>
            </div>
          `).join("")}
        </div>
      `).join("");

  const introRefs = `Le tableau ci-dessous est <strong>généré dynamiquement</strong> à partir des statuts ORIAS renseignés dans les Paramètres du cabinet. Toute modification de ces statuts (ajout du CIF, par exemple) met automatiquement à jour cette page.`;

  // En-tête propre de l'annexe (reproduit l'ex-page 3).
  const headerHtml = headerDocReg(t, {
    eyebrow: "Document réglementaire · Annexe",
    titre: "Références légales\napplicables",
    cabinetNom: d.cabinetNom,
    dateLabel: "Remis le",
    dateValeur: d.dateLettre,
    dateAsChamp: false,
  });

  // ─── Déclaration des blocs (contrat de page) ──────────────────────────
  const blocs: Bloc[] = [];

  blocs.push({ kind: "insecable", html: headerHtml });
  blocs.push({
    kind: "insecable",
    html: `<div class="lt" style="font-size:10px;color:${t.texteFaible};line-height:1.5;margin-top:11px">${introRefs}</div>`,
  });

  // Encadré Références UNIQUE (groupé par régulateur en interne) — filet anti-clip.
  blocs.push({
    kind: "insecable",
    secableEnDernierRecours: true,
    html: encadreDocReg(t, {
      titre: "Cadre légal calculé d'après vos statuts",
      marginTop: "15px",
      contenuHtml: refsParRegulateurHtml,
    }),
  });

  blocs.push({
    kind: "insecable",
    html: noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 13),
      texteHtml: "Document d'aide à la conformité. Les numéros d'articles marqués « à confirmer » sont paramétrables selon le référentiel validé par votre association agréée (CNCGP, ANACOFI, La Compagnie des CGP…). Le conseiller reste seul responsable de la cohérence des mentions avec sa situation.",
      style: "discrete",
    }),
  });

  // ─── Enveloppe docReg : IDENTIQUE à pageDer (même data-pdf-page, même data-pdf-doc
  // = DOC_DER, mêmes marges 44/36, mêmes orphans/widows). data-pdf-doc partagé →
  // compteur X/N commun avec la section principale (DocNumHandler).
  const corps = blocs.map(compilerBloc).join("\n");
  return (
    `<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="${DOC_DER}" style="padding:30px 36px 0 44px;orphans:2;widows:2">\n` +
    `${corps}\n` +
    `</div>`
  );
}
