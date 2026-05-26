// ─── Lot 9 — Page IFI v2 (refonte visuelle) ──────────────────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_page_theme_ifi_A4.html
//
// Consomme les primitives v2 + des données déjà calculées par le moteur
// fiscal existant (computeIFI). Cette fonction ne fait AUCUN calcul fiscal.

import {
  header,
  bandeKPI,
  sousTitreSection,
  barreRailFill,
  tableauTitresDores,
  encartNotreLecture,
  piedPage,
  coquillePage,
  euro,
  type Col,
  type Cell,
} from "../primitives";
import type { Tokens } from "../tokens";

export type BienIFI = {
  nom: string;              // "Maison · résidence principale"
  valeurBrute: number;
  abattementRP: number;     // 30% de RP si applicable, 0 sinon
  dette: number;            // capital restant dû déductible
  netTaxable: number;       // calculé en amont
};

export type IFIPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  assietteNette: number;    // 588 400
  seuilIFI: number;         // 1 300 000
  margeSousSeuil: number;   // 711 600 (ou négatif si dépassement)
  ifiDu: number;            // 0 si en-dessous du seuil
  // Détail
  biens: BienIFI[];
  // Texte « Notre lecture » (compose en amont, ex. par le composant React)
  notreLecture: string;
  // Pagination
  pagePosition: string;     // ex: "3 / 8"
  // Cabinet
  cabinetLibellePied: string; // ex: "EcoPatrimoine Conseil · Fiscalité — confidentiel"
};

export function pageIFI(t: Tokens, d: IFIPageData): string {
  const enSeuil = d.assietteNette < d.seuilIFI;
  const noteSucces = enSeuil
    ? `Non redevable de l'IFI — marge de ${euro(d.margeSousSeuil)} sous le seuil.`
    : undefined;
  const noteAlerte = !enSeuil
    ? `Assiette au-dessus du seuil — calcul de l'IFI applicable : ${euro(d.ifiDu)}.`
    : undefined;

  // ── KPI band (1 navy + 3 cernés, le dernier en vert si IFI=0) ──
  const kpis = [
    { label: "Assiette IFI nette",        value: euro(d.assietteNette), type: "main" as const },
    { label: "Seuil d'assujettissement",  value: euro(d.seuilIFI),      type: "normal" as const },
    { label: "Marge sous le seuil",       value: euro(Math.max(0, d.margeSousSeuil)), type: "normal" as const },
    { label: "IFI dû",                    value: euro(d.ifiDu),
      type: (d.ifiDu === 0 ? "success" : "normal") as "success" | "normal" },
  ];

  // ── Colonnes du tableau « Détail de l'assiette taxable » ──
  const cols: Col[] = [
    { label: "Bien",         align: "left",  width: "34%" },
    { label: "Valeur brute", align: "right", width: "19%" },
    { label: "Abatt. RP",    align: "right", width: "16%" },
    { label: "Dette",        align: "right", width: "15%" },
    { label: "Net taxable",  align: "right", width: "16%" },
  ];

  const rows: Cell[][] = d.biens.map(b => ([
    { value: b.nom },
    { value: euro(b.valeurBrute), align: "right" },
    {
      value: b.abattementRP > 0 ? `− ${euro(b.abattementRP)}` : "—",
      align: "right",
      color: b.abattementRP > 0 ? t.succes : t.texteFaibleClair,
    },
    {
      value: b.dette > 0 ? `− ${euro(b.dette)}` : "—",
      align: "right",
      color: b.dette > 0 ? t.texteFaible : t.texteFaibleClair,
    },
    { value: euro(b.netTaxable), align: "right", bold: true },
  ]));

  // ── Assemblage de la page ──
  const contenu = `
    ${header(t, {
      eyebrow: "Fiscalité",
      titre: "Impôt sur la fortune immobilière",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}
    <div class="foot">Seuls les actifs immobiliers entrent dans l'assiette ; la résidence principale bénéficie d'un abattement de 30 %.</div>

    <div style="margin-top:22px">
      ${sousTitreSection(t, "Assiette face au seuil d'assujettissement")}
      ${barreRailFill(t, {
        labelGauche: "Assiette immobilière nette",
        valeur: d.assietteNette,
        seuil: d.seuilIFI,
        noteSucces,
        noteAlerte,
      })}
    </div>

    <div style="margin-top:20px">
      ${sousTitreSection(t, "Détail de l'assiette taxable")}
      ${tableauTitresDores(t, { cols, rows })}
    </div>

    ${encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
