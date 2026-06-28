// ─── Lot 9 — Page IFI v2 (refonte visuelle) ──────────────────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_page_theme_ifi_A4.html
//
// Consomme les primitives v2 + des données déjà calculées par le moteur
// fiscal existant (computeIFI). Cette fonction ne fait AUCUN calcul fiscal.
//
// PHASE 3 (moteur paged.js) — 1er vrai usage de ListeEcoulable.
// Au lieu de la boîte mono-feuille coquillePage (overflow:hidden → clip ~18-24
// biens EN PROD), la page DÉCLARE ses blocs via le contrat (engine/contrat.ts) :
//   - header / bande KPI+note / jauge assiette-vs-seuil / encart = BlocInsecable,
//   - sous-titre « Détail de l'assiette taxable » = BlocInsecable solidaire du tableau,
//   - le TABLEAU DE BIENS = ListeEcoulable (table brute thead+tbody, coupable ENTRE
//     lignes ; thead répété + « (suite) » via le handler Phase 1),
//   - « Notre lecture » = QueueEpinglee.
// Les biens s'écoulent sur N feuilles sans clip, aucune ligne coupée en deux.
// NB : tableauTitresDores produit une table monolithique ; ListeEcoulable veut le
// thead et les <tr> séparés → on reconstruit ici le même rendu .th/.td (duplication
// ciblée à factoriser quand les tables Succession migreront). Aucune autre page ni
// l'adapter ne sont touchés ; aucune logique métier modifiée.

import {
  header,
  bandeKPI,
  sousTitreSection,
  barreRailFill,
  encartNotreLecture,
  construireTableEcoulable,
  euro,
  type Col,
  type Cell,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import { renderBracketChartSVG } from "../bracketChart";
import type { Tokens } from "../tokens";
import type { FilledBracket } from "../../../../types/patrimoine";

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
  ifiDu: number;            // 0 si en-dessous du seuil (= IFI net, après décote)
  // Barème par tranche (décomposition DÉJÀ calculée par computeIFI — pur affichage)
  bracketFill: FilledBracket[]; // assiette logée + impôt par tranche
  grossIfi: number;         // IFI brut = somme des tranches (avant décote)
  decote: number;           // décote 1,3–1,4 M€ (0 sinon) — pour la note de réconciliation
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

  // ── Colonnes + lignes du tableau « Détail de l'assiette taxable » ──
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

  // ── Table de biens → ListeEcoulable : thead + lignes <tr> via le helper partagé
  //    construireTableEcoulable (même rendu .th/.td que tableauTitresDores).
  const { enteteHtml, lignesHtml } = construireTableEcoulable(t, { cols, rows });

  // ── Déclaration des blocs (contrat de page) ──
  const blocs: Bloc[] = [];

  // Header (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Fiscalité",
      titre: "Impôt sur la fortune immobilière",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Bande KPI + note (insécables, gardées ensemble).
  blocs.push({
    kind: "insecable",
    html: `${bandeKPI(t, kpis)}
    <div class="foot">Seuls les actifs immobiliers entrent dans l'assiette ; la résidence principale bénéficie d'un abattement de 30 %.</div>`,
  });

  // Jauge « assiette face au seuil » (sous-titre + barre, insécable).
  blocs.push({
    kind: "insecable",
    html: `<div style="margin-top:22px">
      ${sousTitreSection(t, "Assiette face au seuil d'assujettissement")}
      ${barreRailFill(t, {
        labelGauche: "Assiette immobilière nette",
        valeur: d.assietteNette,
        seuil: d.seuilIFI,
        noteSucces,
        noteAlerte,
      })}
    </div>`,
  });

  // Barème par tranche (PUR AFFICHAGE de d.bracketFill ; aucun calcul ici).
  // Histogramme : hauteur = assiette logée par tranche, montant = IFI de la tranche.
  // Note de réconciliation assiette → IFI brut → décote → IFI net. AUCUN plafonnement
  // (absent du moteur — on n'invente rien).
  if (d.bracketFill.length > 0) {
    const noteBareme = d.decote > 0
      ? `Hauteur = assiette logée par tranche ; le montant au-dessus = IFI de la tranche. Somme des tranches = IFI brut ${euro(d.grossIfi)} ; après décote ${euro(d.decote)} (assiette entre 1,3 et 1,4 M€) = IFI net ${euro(d.ifiDu)}.`
      : `Hauteur = assiette logée par tranche ; le montant au-dessus = IFI de la tranche. Somme des tranches = IFI brut ${euro(d.grossIfi)} = IFI net ${euro(d.ifiDu)} (aucune décote applicable).`;
    blocs.push({
      kind: "insecable",
      html: `<div style="margin-top:22px">
        ${sousTitreSection(t, "Barème IFI — assiette par tranche")}
        ${renderBracketChartSVG(d.bracketFill, t, { formatBorne: "M" })}
        <div class="foot">${noteBareme}</div>
      </div>`,
    });
  }

  // Sous-titre « Détail de l'assiette taxable » : solidaire de son tableau (titre non orphelin).
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:20px">${sousTitreSection(t, "Détail de l'assiette taxable")}</div>`,
  });

  // TABLEAU DE BIENS = ListeEcoulable (coupable entre lignes ; thead répété + « (suite) »).
  blocs.push({
    kind: "liste",
    enteteHtml,
    lignesHtml,
    styleTable: `width:100%;border-collapse:collapse;table-layout:fixed;border:0.5px solid ${t.bordureClaire};margin-top:12px`,
  });

  // Note de fin (queue épinglée).
  blocs.push({
    kind: "queue",
    html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }),
  });

  return compilerPageContrat(blocs);
}
