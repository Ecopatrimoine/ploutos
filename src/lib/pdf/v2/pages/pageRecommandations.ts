// ─── Lot Dossier client — Page Recommandations v2 (Plan d'action) ────
//
// Présente les recommandations issues du diagnostic, regroupées par
// dimension (Fiscalité IR, IFI, Succession, Prévoyance, etc.). Une carte
// par recommandation : libellé + justification.
//
// PHASE 2 (moteur paged.js) — page PILOTE du contrat de page.
// Au lieu de la boîte mono-feuille `coquillePage` (overflow:hidden → clip
// silencieux dès ~10-11 cartes EN PROD), cette page DÉCLARE désormais ses blocs
// via le contrat (engine/contrat.ts) :
//   - header de page + intro + chaque carte = BlocInsecable (jamais coupé),
//   - sous-titre de dimension = BlocInsecable solidaire de sa 1ʳᵉ carte
//     (break-after:avoid → titre jamais orphelin ; le flux inter-sections reste continu),
//   - encart « Notre lecture » = QueueEpinglee (reste en fin de flux).
// Le feeder paged.js écoule ces blocs sur N feuilles, sans clip, cartes intactes.
// NB : sortir de coquillePage retire le pied par-boîte ; en nouveau moteur le
// pied/en-tête/X-Y viennent des margin-boxes @page (Phase 1). Aucune autre page
// n'est touchée (Phase 3).

import {
  header,
  sousTitreSection,
  encartNotreLecture,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
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
  // Carte = unité insécable (libellé + justification).
  const renderCard = (r: RecoLigne) => `
    <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-left:3px solid ${t.or};border-radius:8px;padding:12px 14px;margin-bottom:8px">
      <div style="font-size:11.5px;font-weight:700;color:${t.navy};margin-bottom:4px">${r.libelle}</div>
      <div style="font-size:10.5px;color:${t.texte};line-height:1.5">${r.justification}</div>
    </div>`;

  const blocs: Bloc[] = [];

  // En-tête de page (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Plan d'action",
      titre: "Recommandations & plan d'action",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Intro (paragraphe court, insécable).
  blocs.push({
    kind: "insecable",
    html: `<div style="margin-top:18px;font-size:10.5px;line-height:1.55;color:${t.texte}">${d.intro}</div>`,
  });

  // Recommandations : par dimension, un sous-titre SOLIDAIRE de sa 1ʳᵉ carte, puis
  // une suite de cartes insécables qui s'écoulent (coupe entre cartes uniquement).
  if (d.groupes.length > 0) {
    for (const g of d.groupes) {
      blocs.push({
        kind: "insecable",
        solidaireAvecSuivant: true,
        html: `<div style="margin-top:14px">${sousTitreSection(t, g.dimension)}</div>`,
      });
      for (const item of g.items) {
        blocs.push({ kind: "insecable", html: renderCard(item) });
      }
    }
  } else {
    blocs.push({
      kind: "insecable",
      html: `<div style="margin-top:12px;font-size:10.5px;color:${t.texteFaibleClair};font-style:italic;background:${t.fondTableauAlt};border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:14px 16px">Aucune recommandation complète saisie pour ce dossier. Le diagnostic reste à enrichir dans l'onglet « Recommandations ».</div>`,
    });
  }

  // Note de fin (queue épinglée en fin de flux, insécable).
  blocs.push({
    kind: "queue",
    html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }),
  });

  return compilerPageContrat(blocs);
}
