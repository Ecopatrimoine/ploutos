// ─── Lot 9 — Page Prévoyance collective v2 (module Prévoyance) ──────────
//
// Remplace l'ancienne pagePrevoyanceColl (générique). Consomme l'audit
// conformité réel (audit-collectif.ts) : KPI + matrice des 6 contrôles
// + constats + mention DDA.

import {
  header,
  bandeKPI,
  sousTitreSection,
  tableauTitresDores,
  noteIconee,
  piedPage,
  coquillePage,
  icones,
} from "../primitives";
import type { Tokens } from "../tokens";
import type { Constat, ControleConformite, ControleStatut } from "../../../prevoyance/types";

export type PrevoyanceCollPageData = {
  active: boolean;
  clientName: string;
  dateStr: string;
  sousTitre: string;          // ex: "Dirigeant analysé : Pierre — SARL DUPONT"
  scoreGlobal: string;        // "67 %"
  effectifLibelle: string;    // "12 salariés"
  entrepriseLibelle: string;  // "SARL DUPONT"
  ccnLibelle: string;         // "IDCC 1486" ou "—"
  controles: ControleConformite[];
  constats: Constat[];
  mentionDDA: string;
  pagePosition: string;
  cabinetLibellePied: string;
};

const STATUT_LABEL: Record<ControleStatut, { label: string; color: string }> = {
  conforme:       { label: "Conforme",        color: "#2F7D5B" },
  non_conforme:   { label: "Non conforme",    color: "#DC2626" },
  vigilance:      { label: "Vigilance",       color: "#B07A1E" },
  non_applicable: { label: "Non applicable",  color: "#6B7280" },
};

const COULEUR_SEVERITE: Record<string, { bg: string; border: string; texte: string; label: string }> = {
  non_conformite: { bg: "#FBEAEA", border: "#DC2626", texte: "#7A1F1F", label: "NON-CONFORMITÉ" },
  alerte:         { bg: "#FBEDED", border: "#EF4444", texte: "#9B2C2C", label: "ALERTE" },
  attention:      { bg: "#FBF3E3", border: "#F59E0B", texte: "#7C4A04", label: "ATTENTION" },
  info:           { bg: "#EEF1F5", border: "#3B82F6", texte: "#1E3A8A", label: "INFO" },
};

function renderConstatHTML(t: Tokens, c: Constat): string {
  const couleur = COULEUR_SEVERITE[c.severite] ?? COULEUR_SEVERITE.info;
  const ref = c.reference
    ? `<div style="margin-top:5px;font-size:9px;font-style:italic;color:${t.texteFaible}">Référence : ${c.reference}</div>`
    : "";
  return `
    <div style="break-inside:avoid;page-break-inside:avoid;border:1px solid ${couleur.border};border-radius:8px;background:${couleur.bg};padding:10px 12px;margin-top:8px">
      <div style="font-size:9px;font-weight:800;letter-spacing:0.06em;color:${couleur.texte};margin-bottom:3px">${couleur.label}</div>
      <div style="font-size:11.5px;font-weight:700;color:${t.navy};margin-bottom:4px">${c.titre}</div>
      <div style="font-size:10.5px;line-height:1.45;color:${t.texte}">${c.detail}</div>
      <div style="font-size:10.5px;line-height:1.45;color:${t.navy};font-weight:600;margin-top:5px">→ ${c.action}</div>
      ${ref}
    </div>
  `;
}

export function pagePrevoyanceColl(t: Tokens, d: PrevoyanceCollPageData): string {
  if (!d.active) {
    const contenu = `
      ${header(t, {
        eyebrow: "Prévoyance",
        titre: "Prévoyance collective",
        droiteHaut: d.clientName,
        droiteBas: d.dateStr,
      })}
      <div style="margin-top:40px;text-align:center;font-size:12px;color:${t.texteFaible};line-height:1.6">
        Aucun dirigeant détecté dans le foyer et analyse externe non activée.<br/>
        Activer le module Prévoyance collective pour produire l'audit conformité.
      </div>
    `;
    return coquillePage(t, {
      contenu,
      pied: piedPage(t, { gauche: d.cabinetLibellePied, droite: d.pagePosition }),
    });
  }

  const kpis = [
    { label: "Score conformité", value: d.scoreGlobal, type: "main" as const },
    { label: "Entreprise", value: d.entrepriseLibelle, type: "normal" as const, valueFontSize: "12px" },
    { label: "Effectif", value: d.effectifLibelle, type: "normal" as const },
    { label: "Convention collective", value: d.ccnLibelle, type: "normal" as const, valueFontSize: "11px" },
  ];

  const matrice = tableauTitresDores(t, {
    cols: [
      { label: "Contrôle", align: "left", width: "40%" },
      { label: "Statut", align: "left", width: "18%" },
      { label: "Référence", align: "left", width: "42%" },
    ],
    rows: d.controles.map((c) => {
      const st = STATUT_LABEL[c.statut];
      return [
        { value: c.libelle, bold: true },
        { value: st.label, color: st.color, bold: true },
        { value: c.reference, color: t.texteFaible },
      ];
    }),
  });

  const constatsHTML =
    d.constats.length > 0
      ? d.constats.map((c) => renderConstatHTML(t, c)).join("")
      : `<div style="margin-top:8px;font-size:10.5px;color:${t.texteFaible};font-style:italic">Aucune non-conformité ni point de vigilance relevé sur la base des éléments déclarés.</div>`;

  const contenu = `
    ${header(t, {
      eyebrow: "Prévoyance",
      titre: "Prévoyance collective",
      sousTitre: d.sousTitre,
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}

    <div style="margin-top:16px">
      ${sousTitreSection(t, "Audit de conformité")}
      ${matrice}
    </div>

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
