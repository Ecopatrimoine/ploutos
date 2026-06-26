// ─── Lot Dossier client — Page Mentions v2 (Notes & Mentions légales) ──
//
// Page d'annexe : notes libres du conseiller + mentions légales fixes du
// document (généré le…, cabinet, ORIAS, portée).
//
// Structure : header v2 + section Notes (boîte préformatée ou fallback) +
// section Mentions légales (paragraphes). Le pied est géré par les margin-boxes
// @page du feeder (plus de pied codé en dur depuis la bascule Phase 3).

import {
  header,
  sousTitreSection,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

export type MentionsPageData = {
  clientName: string;
  dateStr: string;
  notesConseiller?: string;       // libre — fallback si vide
  mentionsLegales: string[];      // paragraphes (déjà composés par l'adapter)
  generePar: string;              // ex: "Généré le 25/05/2026 — EcoPatrimoine Conseil — ORIAS 25006907"
  pagePosition: string;
  cabinetLibellePied: string;
};

export function pageMentions(t: Tokens, d: MentionsPageData): string {
  const notesHtml = d.notesConseiller && d.notesConseiller.trim().length > 0
    ? `<div style="white-space:pre-wrap;font-size:10.5px;line-height:1.55;color:${t.texte};background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:12px 14px">${escapeHtml(d.notesConseiller)}</div>`
    : `<div style="font-size:10.5px;line-height:1.55;color:${t.texteFaibleClair};font-style:italic;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:12px 14px">Aucune note saisie par le conseiller.</div>`;

  // ─── Déclaration des blocs (contrat de page, engine/contrat.ts) ───────
  // Bascule de mécanisme (coquillePage → compilerPageContrat). Le flux texte
  // (notes + mentions) DOIT pouvoir paginer — c'est précisément le clip
  // (overflow:hidden) qu'on supprime. On découpe AU NIVEAU paragraphe pour que
  // la séquence s'écoule et coupe ENTRE blocs, jamais au milieu d'un paragraphe.
  const blocs: Bloc[] = [];

  // Header de page (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Annexe",
      titre: "Notes & Mentions légales",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Section « Notes du conseiller » : sous-titre solidaire de la boîte de notes.
  // La boîte est sécable en dernier recours (garde-fou : une note plus haute
  // qu'une feuille s'écoule au lieu de boucler / clipper sous paged.js).
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:18px">${sousTitreSection(t, "Notes du conseiller")}</div>`,
  });
  blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: notesHtml });

  // Section « Mentions légales » : sous-titre solidaire du 1er paragraphe, puis
  // un bloc PAR paragraphe (coupe entre mentions), enfin la ligne « généré le ».
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:18px">${sousTitreSection(t, "Mentions légales")}</div>`,
  });
  for (const p of d.mentionsLegales) {
    blocs.push({
      kind: "insecable",
      html: `<p style="font-size:10px;line-height:1.55;color:${t.texte};margin:0 0 8px 0">${p}</p>`,
    });
  }
  blocs.push({
    kind: "insecable",
    html: `<div style="margin-top:10px;font-size:9.5px;color:${t.texteFaibleClair};font-style:italic">${d.generePar}</div>`,
  });

  return compilerPageContrat(blocs);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
