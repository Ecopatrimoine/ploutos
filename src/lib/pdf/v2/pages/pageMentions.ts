// ─── Lot Dossier client — Page Mentions v2 (Notes & Mentions légales) ──
//
// Page d'annexe : notes libres du conseiller + mentions légales fixes du
// document (généré le…, cabinet, ORIAS, portée).
//
// Structure : header v2 + section Notes (boîte préformatée ou fallback) +
// section Mentions légales (paragraphes) + pied de page.

import {
  header,
  sousTitreSection,
  piedPage,
  coquillePage,
} from "../primitives";
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

  const mentionsHtml = d.mentionsLegales
    .map(p => `<p style="font-size:10px;line-height:1.55;color:${t.texte};margin:0 0 8px 0">${p}</p>`)
    .join("");

  const contenu = `
    ${header(t, {
      eyebrow: "Annexe",
      titre: "Notes & Mentions légales",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Notes du conseiller")}
      ${notesHtml}
    </div>

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Mentions légales")}
      ${mentionsHtml}
      <div style="margin-top:10px;font-size:9.5px;color:${t.texteFaibleClair};font-style:italic">${d.generePar}</div>
    </div>
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
