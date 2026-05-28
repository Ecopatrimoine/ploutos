// ─── Lot 9 — Page Prévoyance personnelle v2 (module Prévoyance) ─────────
//
// Remplace l'ancienne pagePrevoyanceInd (générique). Consomme désormais
// le VRAI moteur de projection : graphique d'aires empilées en SVG
// inline + tableau des jalons + constats triés + mention DDA.
//
// Une page par personne (P1 / P2). Mentions DDA non négociables en bas
// (spec §13.3).

import {
  header,
  bandeKPI,
  sousTitreSection,
  tableauTitresDores,
  encartNotreLecture,
  noteIconee,
  piedPage,
  coquillePage,
  icones,
} from "../primitives";
import type { Tokens } from "../tokens";
import type { Constat, ProjectionResult } from "../../../prevoyance/types";
import { renderProjectionSVG } from "../prevoyanceChart";

export type PrevoyancePersoJalon = {
  libelle: string;
  revenu: string;
  pct: string;
  detail: string;
};

export type PrevoyancePersoPageData = {
  disponible: boolean;
  clientName: string;
  personneLibelle: string;
  dateStr: string;
  statutLibelle: string;
  caisseLibelle: string;
  ccnLibelle: string | null;
  revenuReference: string;
  ageInfo: string;
  projection: ProjectionResult | null;
  jalons: PrevoyancePersoJalon[];
  constats: Constat[];
  notreLecture: string;
  mentionDDA: string;
  warningMicroTNS: string | null;
  pagePosition: string;
  cabinetLibellePied: string;
};

const COULEUR_SEVERITE: Record<string, { bg: string; border: string; texte: string; label: string }> = {
  non_conformite: { bg: "#FBEAEA", border: "#DC2626", texte: "#7A1F1F", label: "NON-CONFORMITÉ" },
  alerte:         { bg: "#FBEDED", border: "#EF4444", texte: "#9B2C2C", label: "ALERTE" },
  attention:      { bg: "#FBF3E3", border: "#F59E0B", texte: "#7C4A04", label: "ATTENTION" },
  info:           { bg: "#EEF1F5", border: "#3B82F6", texte: "#1E3A8A", label: "INFO" },
};

function renderConstatHTML(t: Tokens, c: Constat): string {
  const couleur = COULEUR_SEVERITE[c.severite] ?? COULEUR_SEVERITE.info;
  const impact = c.impactChiffre
    ? `<div style="margin-top:6px;display:inline-block;border-radius:6px;padding:3px 8px;font-size:9.5px;font-weight:700;background:#fff;color:${couleur.texte}">${c.impactChiffre.libelle} : ${Math.round(c.impactChiffre.montant).toLocaleString("fr-FR")} €</div>`
    : "";
  const ref = c.reference
    ? `<div style="margin-top:5px;font-size:9px;font-style:italic;color:${t.texteFaible}">Référence : ${c.reference}</div>`
    : "";
  return `
    <div style="break-inside:avoid;page-break-inside:avoid;border:1px solid ${couleur.border};border-radius:8px;background:${couleur.bg};padding:10px 12px;margin-top:8px">
      <div style="font-size:9px;font-weight:800;letter-spacing:0.06em;color:${couleur.texte};margin-bottom:3px">${couleur.label}</div>
      <div style="font-size:11.5px;font-weight:700;color:${t.navy};margin-bottom:4px">${c.titre}</div>
      <div style="font-size:10.5px;line-height:1.45;color:${t.texte}">${c.detail}</div>
      <div style="font-size:10.5px;line-height:1.45;color:${t.navy};font-weight:600;margin-top:5px">→ ${c.action}</div>
      ${impact}
      ${ref}
    </div>
  `;
}

export function pagePrevoyancePerso(t: Tokens, d: PrevoyancePersoPageData): string {
  if (!d.disponible || !d.projection) {
    const contenu = `
      ${header(t, {
        eyebrow: "Prévoyance",
        titre: `Prévoyance personnelle — ${d.personneLibelle}`,
        droiteHaut: d.clientName,
        droiteBas: d.dateStr,
      })}
      <div style="margin-top:40px;text-align:center;font-size:12px;color:${t.texteFaible};line-height:1.6">
        Données professionnelles non renseignées pour cette personne.<br/>
        Compléter l'onglet Travail pour activer la projection prévoyance.
      </div>
    `;
    return coquillePage(t, {
      contenu,
      pied: piedPage(t, { gauche: d.cabinetLibellePied, droite: d.pagePosition }),
    });
  }

  const kpis = [
    { label: "Revenu de référence", value: d.revenuReference, type: "main" as const },
    { label: "Statut", value: d.statutLibelle, type: "normal" as const, valueFontSize: "12px" },
    { label: "Régime obligatoire", value: d.caisseLibelle, type: "normal" as const, valueFontSize: "12px" },
    { label: "Convention collective", value: d.ccnLibelle ?? "—", type: "normal" as const, valueFontSize: "11px" },
  ];

  const jalonsTable = tableauTitresDores(t, {
    cols: [
      { label: "Jalon", align: "left", width: "20%" },
      { label: "Revenu mensuel", align: "right", width: "20%" },
      { label: "% réf.", align: "right", width: "12%" },
      { label: "Composition", align: "left", width: "48%" },
    ],
    rows: d.jalons.map((j) => [
      { value: j.libelle, bold: true },
      { value: j.revenu, align: "right" as const },
      { value: j.pct, align: "right" as const },
      { value: j.detail, align: "left" as const, color: t.texteFaible },
    ]),
  });

  const constatsHTML =
    d.constats.length > 0
      ? d.constats.map((c) => renderConstatHTML(t, c)).join("")
      : `<div style="margin-top:8px;font-size:10.5px;color:${t.texteFaible};font-style:italic">Aucun constat à signaler — la couverture en place semble cohérente avec la situation déclarée.</div>`;

  const contenu = `
    ${header(t, {
      eyebrow: "Prévoyance",
      titre: `Prévoyance personnelle — ${d.personneLibelle}`,
      sousTitre: d.ageInfo,
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}

    ${d.warningMicroTNS
      ? `<div style="margin-top:12px;border:1px solid #F59E0B;border-radius:8px;background:#FBF3E3;padding:10px 12px;font-size:10px;line-height:1.45;color:#7C4A04">${d.warningMicroTNS}</div>`
      : ""}

    <div style="margin-top:16px">
      ${sousTitreSection(t, "Projection des revenus de remplacement (arrêt maladie puis invalidité)")}
      ${renderProjectionSVG(d.projection, t)}
    </div>

    <div style="margin-top:14px">
      ${sousTitreSection(t, "Points clés")}
      ${jalonsTable}
    </div>

    ${encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture })}

    <div style="margin-top:14px">
      ${sousTitreSection(t, "Constats et pistes")}
      ${constatsHTML}
    </div>

    ${noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 14),
      texteHtml: d.mentionDDA,
      style: "discrete",
    })}
  `;

  return coquillePage(t, {
    contenu,
    pied: piedPage(t, { gauche: d.cabinetLibellePied, droite: d.pagePosition }),
  });
}
