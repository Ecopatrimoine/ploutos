// ─── Lot Dossier client — Page Recommandations v2 (Plan d'action) ────
//
// Présente les recommandations issues du diagnostic, regroupées par
// dimension (Fiscalité IR, IFI, Succession, Prévoyance, etc.). Une carte
// par recommandation : libellé + justification.

import {
  header,
  sousTitreSection,
  encartNotreLecture,
  piedPage,
  coquillePage,
} from "../primitives";
import type { Tokens } from "../tokens";

export type RecoLigne = {
  libelle: string;
  justification: string;
};

export type RecoGroupe = {
  dimension: string;       // ex: "Fiscalité IR" / "Transmission"
  items: RecoLigne[];
};

export type RecommandationsPageData = {
  clientName: string;
  dateStr: string;
  intro: string;                     // paragraphe d'intro
  groupes: RecoGroupe[];             // peut être vide (page reste rendue avec fallback)
  notreLecture: string;
  pagePosition: string;
  cabinetLibellePied: string;
};

export function pageRecommandations(t: Tokens, d: RecommandationsPageData): string {
  const renderCard = (r: RecoLigne) => `
    <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-left:3px solid ${t.or};border-radius:8px;padding:12px 14px;margin-bottom:8px">
      <div style="font-size:11.5px;font-weight:700;color:${t.navy};margin-bottom:4px">${r.libelle}</div>
      <div style="font-size:10.5px;color:${t.texte};line-height:1.5">${r.justification}</div>
    </div>`;

  const renderGroupe = (g: RecoGroupe) => `
    <div style="margin-top:14px">
      ${sousTitreSection(t, g.dimension)}
      <div style="margin-top:6px">${g.items.map(renderCard).join("")}</div>
    </div>`;

  const corpsRecos = d.groupes.length > 0
    ? d.groupes.map(renderGroupe).join("")
    : `<div style="margin-top:12px;font-size:10.5px;color:${t.texteFaibleClair};font-style:italic;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:14px 16px">Aucune recommandation complète saisie pour ce dossier. Le diagnostic reste à enrichir dans l'onglet « Recommandations ».</div>`;

  const contenu = `
    ${header(t, {
      eyebrow: "Plan d'action",
      titre: "Recommandations & plan d'action",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    <div style="margin-top:18px;font-size:10.5px;line-height:1.55;color:${t.texte}">${d.intro}</div>

    ${corpsRecos}

    ${encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
