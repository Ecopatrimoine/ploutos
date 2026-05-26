// ─── Lot 9 — Page Prévoyance individuelle v2 ────────────────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_page_theme_prevoyance_individuelle_A4.html
//
// Réutilise les primitives v2 : header (avec sousTitre), bandeKPI (compact,
// le 4e KPI accepte un libellé long avec valueFontSize), sousTitreSection,
// listeBarresBesoinCouverture (nouvelle), encartNotreLecture, noteIconee
// taille "discrete" (nouvelle option), piedPage, coquillePage.

import {
  header,
  bandeKPI,
  sousTitreSection,
  listeBarresBesoinCouverture,
  encartNotreLecture,
  noteIconee,
  piedPage,
  coquillePage,
  icones,
  type LigneBesoinCouverture,
} from "../primitives";
import type { Tokens } from "../tokens";

export type PrevoyanceIndPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  sousTitre?: string;       // ex: "Profession libérale · affiliation CIPAV"
  // KPI
  deficitCapitalDeces: string;  // "185 000 €" — libellé textuel (peut inclure devise)
  revenuAProteger: string;      // "80 000 €/an"
  foyerAProteger: string;       // "Conjoint + 2 enfants"
  capitalDecesCouvert: string;  // "115 000 €"
  // Barres besoin vs couverture (3 lignes attendues : décès, IPT, arrêt travail)
  lignes: LigneBesoinCouverture[];
  // Notre lecture
  notreLecture: string;
  // Note discrète non-contractuelle
  mentionNonContractuelle: string;
  // Pied
  pagePosition: string;     // "7 / 8"
  cabinetLibellePied: string;
};

export function pagePrevoyanceInd(t: Tokens, d: PrevoyanceIndPageData): string {
  // ─── KPI band (compact, 4 KPI — libellés textuels avec valueFontSize) ──
  const kpis = [
    { label: "Déficit capital décès", value: d.deficitCapitalDeces,  type: "main"   as const },
    { label: "Revenu à protéger",     value: d.revenuAProteger,       type: "normal" as const },
    { label: "Foyer à protéger",      value: d.foyerAProteger,        type: "normal" as const, valueFontSize: "12px" },
    { label: "Capital décès couvert", value: d.capitalDecesCouvert,   type: "normal" as const },
  ];

  const contenu = `
    ${header(t, {
      eyebrow: "Prévoyance",
      titre: "Prévoyance individuelle",
      sousTitre: d.sousTitre,
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}

    <div style="margin-top:20px">
      ${sousTitreSection(t, "Besoin de protection vs couverture actuelle")}
      ${listeBarresBesoinCouverture(t, { lignes: d.lignes })}
    </div>

    ${encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture })}

    ${noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 14),
      texteHtml: d.mentionNonContractuelle,
      taille: "discrete",
    })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
