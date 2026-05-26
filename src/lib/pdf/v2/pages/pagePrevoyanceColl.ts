// ─── Lot 9 — Page Prévoyance collective v2 (audit entreprise) ───────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_page_theme_prevoyance_collective_premier_jet.html
//
// Spécificité : pour une AUDIT ENTREPRISE (pas particulier). Le client est
// la société (SAS, SARL…). Le dirigeant est traité dans un encart conseil.
//
// Réutilise les primitives v2 : header (sousTitre), bandeKPI (compact,
// libellés courts pour Conformité/Effectif/Cadres + valueFontSize pour
// "Assimilé salarié"), bandeauInfo (nouveau), matriceConformite (nouveau),
// pill (nouveau, statuts sémantiques), noteIconee style "conseil" + "discrete",
// piedPage, coquillePage. Icônes ajoutées : check, alertTriangle, helpCircle,
// userShield (cf. icones registre).

import {
  header,
  bandeKPI,
  bandeauInfo,
  matriceConformite,
  noteIconee,
  pill,
  piedPage,
  coquillePage,
  icones,
  type LigneMatriceConformite,
  type PillStatut,
} from "../primitives";
import type { Tokens } from "../tokens";

export type LigneAuditConformite = {
  titre: string;
  reference: string;
  statut: PillStatut;        // success | warning | info
  pillLabel: string;         // ex: "Conforme", "Écart", "À confirmer"
};

export type PrevoyanceCollPageData = {
  // En-tête
  clientName: string;          // pour le coin droit (peut être "Audit entreprise")
  dateStr: string;             // "25 mai 2026"
  sousTitre?: string;          // ex: "SAS Atlas Ingénierie · 12 salariés"
  // KPI
  conformiteResume: string;    // "1 écart"
  effectif: string;            // "12 sal."  (peut inclure suffixe)
  effectifCadres: string;      // "3"
  statutDirigeant: string;     // "Assimilé salarié"
  // Convention collective
  ccnLabel: string;            // "Convention collective applicable"
  ccnValeur: string;           // "Syntec — IDCC 1486"
  ccnPillStatut: PillStatut;   // "success" | "warning" | "info"
  ccnPillLabel: string;        // "Résolue via SIRET · fiable"
  // Matrice conformité
  matrice: LigneAuditConformite[];
  // Encart conseil dirigeant
  conseilDirigeantHtml: string; // texte HTML (avec <strong>...</strong>)
  // Mention non-contractuelle
  mentionNonContractuelle: string;
  // Pied
  pagePosition: string;        // "1 / 4"
  cabinetLibellePied: string;
};

function pillIconeFromStatut(statut: PillStatut): (color: string, size?: number) => string {
  switch (statut) {
    case "success": return icones.check;
    case "warning": return icones.alertTriangle;
    case "info":    return icones.helpCircle;
  }
}

export function pagePrevoyanceColl(t: Tokens, d: PrevoyanceCollPageData): string {
  // ─── KPI band (compact, 4 KPI ; libellés textuels avec valueFontSize) ──
  const kpis = [
    { label: "Conformité",       value: d.conformiteResume, type: "main"   as const, valueFontSize: "14px" },
    { label: "Effectif",         value: d.effectif,         type: "normal" as const },
    { label: "Dont cadres",      value: d.effectifCadres,   type: "normal" as const },
    { label: "Statut dirigeant", value: d.statutDirigeant,  type: "normal" as const, valueFontSize: "12px" },
  ];

  // ─── Pill CCN (success/warning/info + icône appropriée) ──
  const ccnPillHtml = pill(t, {
    label: d.ccnPillLabel,
    statut: d.ccnPillStatut,
    icone: pillIconeFromStatut(d.ccnPillStatut),
  });

  // ─── Matrice de conformité (pill par ligne) ──
  const matriceLignes: LigneMatriceConformite[] = d.matrice.map(l => ({
    titre: l.titre,
    reference: l.reference,
    pillHtml: pill(t, {
      label: l.pillLabel,
      statut: l.statut,
      icone: pillIconeFromStatut(l.statut),
    }),
  }));

  const contenu = `
    ${header(t, {
      eyebrow: "Prévoyance collective",
      titre: "Audit de protection sociale",
      sousTitre: d.sousTitre,
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}

    ${bandeauInfo(t, {
      eyebrow: d.ccnLabel,
      valeur: d.ccnValeur,
      pillHtml: ccnPillHtml,
    })}

    <div style="margin-top:18px">
      <div class="sct">Conformité des obligations</div>
      ${matriceConformite(t, matriceLignes)}
    </div>

    ${noteIconee(t, {
      iconeSvg: icones.userShield(t.eyebrowOr, 17),
      texteHtml: d.conseilDirigeantHtml,
      style: "conseil",
    })}

    ${noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 14),
      texteHtml: d.mentionNonContractuelle,
      style: "discrete",
    })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
