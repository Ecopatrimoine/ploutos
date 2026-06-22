// ─── Lot 9 — Page Succession B v2 (volet « Assurance-vie & PER ») ───────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_succession_pageB_consolide_deux_lignes.html
//
// Réutilise les primitives v2 : header, bandeKPI (compact, 1 KPI vert
// succès), sousTitreSection, tableauTitresDores, noteIconee (nouvelle),
// bandeauConsolide (nouveau), encartNotreLecture, piedPage, coquillePage.

import {
  header,
  bandeKPI,
  sousTitreSection,
  tableauTitresDores,
  noteIconee,
  bandeauConsolide,
  encartNotreLecture,
  piedPage,
  coquillePage,
  regionCorpsCentree,
  H_HEADER_PX,
  H_BANDE_KPI_PX,
  H_LIGNE_TEXTE_PX,
  CHARS_PAR_LIGNE_CONVENTION,
  RESERVE_PIED_PX,
  euro,
  icones,
  type Col,
  type Cell,
} from "../primitives";
import type { Tokens } from "../tokens";

export type BeneficiaireAV = {
  nom: string;           // "Lucas Dubreuil"
  lien: string;          // "Enfant"
  capital: number;       // 94 000
  abattement990I: number; // 152 500 (abattement individuel pour 990 I)
  fiscalite: number;     // 0 (si exonéré → afficher en vert)
  net: number;           // 94 000
};

export type SuccessionBPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  capitauxTransmis: number;       // 188 000
  fiscaliteTotale: number;        // 0
  netAuxBeneficiaires: number;    // 188 000
  abattementRestant: number;      // 117 000
  // Note KPI
  noteKpi: string;                // "Régime : 990 I... 757 B..."
  // Détail bénéficiaires
  beneficiaires: BeneficiaireAV[];
  // Clause bénéficiaire (HTML autorisé pour <em>...</em>)
  clauseBeneficiaireHtml: string;
  // Total consolidé
  totalNetTransmis: number;       // 1 158 400 (succession + AV)
  totalLabelHaut: string;         // "Total transmis net aux proches"
  totalLabelBas?: string;         // "(succession + assurance-vie)"
  // Notre lecture
  notreLecture: string;
  // Pied
  pagePosition: string;           // "5 / 8"
  cabinetLibellePied: string;     // "EcoPatrimoine Conseil · Transmission — confidentiel"
};

export function pageSuccessionB(t: Tokens, d: SuccessionBPageData): string {
  // ─── KPI band (compact, 4 KPI ; le 2e en vert succès quand fiscalité=0) ──
  const kpis = [
    { label: "Capitaux transmis",      value: euro(d.capitauxTransmis),    type: "main"   as const },
    { label: "Fiscalité totale",       value: euro(d.fiscaliteTotale),
      type: (d.fiscaliteTotale === 0 ? "success" : "normal") as "success" | "normal" },
    { label: "Net aux bénéficiaires",  value: euro(d.netAuxBeneficiaires), type: "normal" as const },
    { label: "Abattement restant",     value: euro(d.abattementRestant),   type: "normal" as const },
  ];

  // ─── Détail par bénéficiaire (tableau 6 colonnes) ──
  const cols: Col[] = [
    { label: "Bénéficiaire", align: "left",  width: "24%" },
    { label: "Lien",         align: "left",  width: "14%" },
    { label: "Capital",      align: "right", width: "16%" },
    { label: "Abatt. 990 I", align: "right", width: "18%" },
    { label: "Fiscalité",    align: "right", width: "12%" },
    { label: "Net",          align: "right", width: "16%" },
  ];
  const rows: Cell[][] = d.beneficiaires.map(b => ([
    { value: b.nom },
    { value: b.lien, color: t.texteFaible },
    { value: euro(b.capital), align: "right" },
    { value: euro(b.abattement990I), align: "right" },
    b.fiscalite === 0
      ? { value: euro(0), align: "right", color: t.succes, bold: true }
      : { value: euro(b.fiscalite), align: "right", color: t.thOr },
    { value: euro(b.net), align: "right", bold: true },
  ]));

  // ─── Assemblage ──
  const zoneHaute = `
    ${header(t, {
      eyebrow: "Transmission — volet 2 / 2",
      titre: "Assurance-vie & PER",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}
    <div class="foot">${d.noteKpi}</div>
  `;

  const corps = `

    <div style="margin-top:24px">
      ${sousTitreSection(t, "Détail par bénéficiaire")}
      ${tableauTitresDores(t, { cols, rows })}
      ${noteIconee(t, {
        iconeSvg: icones.fileText(t.eyebrowOr, 15),
        texteHtml: d.clauseBeneficiaireHtml,
      })}
    </div>

    ${bandeauConsolide(t, {
      labelHaut: d.totalLabelHaut,
      labelBas: d.totalLabelBas,
      valeur: euro(d.totalNetTransmis),
    })}

    ${encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture })}
  `;

  // Zone haute = header + bandeKPI + note de synthese (recap fixe en haut). Hauteur
  // estimee depuis les constantes FIGEES Lot 1 : H_HEADER_PX + H_BANDE_KPI_PX + lignes
  // de note (CHARS_PAR_LIGNE_CONVENTION, meme convention que tientSurUneFeuille).
  // Aucun nombre magique nouveau. Pied inchange via la coquille ; pas de DDA ici.
  const lignesNote = Math.max(1, Math.ceil(d.noteKpi.length / CHARS_PAR_LIGNE_CONVENTION));
  const hauteurZoneHautPx = H_HEADER_PX + H_BANDE_KPI_PX + lignesNote * H_LIGNE_TEXTE_PX;

  const contenu = `
    ${zoneHaute}
    ${regionCorpsCentree(corps, { hauteurZoneHautPx, reserveBasPx: RESERVE_PIED_PX })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
