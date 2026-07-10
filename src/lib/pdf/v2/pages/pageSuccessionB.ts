// ─── Lot 9 — Page Succession B v2 (volet « Assurance-vie & PER ») ───────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_succession_pageB_consolide_deux_lignes.html
//
// PHASE 3 (moteur paged.js) — page DÉCLARÉE via le contrat (engine/contrat.ts).
// Sortie de coquillePage + abandon du chunking par comptage : la table de
// bénéficiaires devient une ListeEcoulable (thead répété + « (suite) »). La clause
// bénéficiaire, le bandeau consolidé (TOTAL) et « Notre lecture » sont épinglés EN
// QUEUE — le montant de synthèse ne flotte jamais au milieu de l'écoulement.

import {
  header,
  bandeKPI,
  sousTitreSection,
  noteIconee,
  bandeauConsolide,
  encartNotreLecture,
  construireTableEcoulable,
  euro,
  icones,
  type Col,
  type Cell,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

export type BeneficiaireAV = {
  nom: string;           // "Lucas Dubreuil"
  lien: string;          // "Enfant"
  capital: number;       // 94 000
  // Abattement 990 I INDIVIDUEL (152 500 € par bénéficiaire) — présent (> 0) UNIQUEMENT si
  // le bénéficiaire a une part issue de versements AVANT 70 ans. Un bénéficiaire purement
  // 757 B (après 70 ans) porte 0 ici : l'abattement 757 B est GLOBAL (30 500 € partagé,
  // jamais par bénéficiaire), rappelé en note — cf. présentation écran (TabSuccession).
  abattement990I: number;
  // Décomposition de la fiscalité par régime (propagée depuis successionPresentation) :
  // 990 I = versements avant 70 ans ; 757 B = après 70 ans. Optionnelles (fixtures legacy).
  tax990I?: number;
  tax757B?: number;
  fiscalite: number;     // 990 I + 757 B (0 si exonéré → afficher en vert)
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
  // Libellé aligné MOT POUR MOT sur l'écran 10a (TabSuccession, modale AV) : le net AV
  // porte le même nom des deux côtés (« Net transmis — assurances-vie (tous bénéficiaires) »).
  const kpis = [
    { label: "Capitaux transmis",      value: euro(d.capitauxTransmis),    type: "main"   as const },
    { label: "Fiscalité totale",       value: euro(d.fiscaliteTotale),
      type: (d.fiscaliteTotale === 0 ? "success" : "normal") as "success" | "normal" },
    { label: "Net transmis — assurances-vie (tous bénéficiaires)", value: euro(d.netAuxBeneficiaires), type: "normal" as const },
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
  const rendreLigne = (b: BeneficiaireAV): Cell[] => {
    // Abattement selon le RÉGIME RÉEL : 152 500 € (990 I individuel) uniquement si le
    // bénéficiaire a une part avant 70 ans ; sinon « — » (l'abattement 757 B est GLOBAL
    // 30 500 €, rappelé en note, JAMAIS affiché par bénéficiaire).
    const abatt: Cell = b.abattement990I > 0
      ? { value: euro(b.abattement990I), align: "right" }
      : { value: "—", align: "right", color: t.texteFaibleClair };
    // Décomposition 990 I / 757 B en sous-ligne quand les DEUX régimes coexistent.
    const t990 = b.tax990I ?? 0;
    const t757 = b.tax757B ?? 0;
    const decompo = t990 > 0 && t757 > 0
      ? `<div style="font-size:8.5px;color:${t.texteFaibleClair};margin-top:1px;line-height:1.25">990 I : ${euro(t990)} · 757 B : ${euro(t757)}</div>`
      : "";
    const fisc: Cell = b.fiscalite === 0
      ? { value: euro(0), align: "right", color: t.succes, bold: true }
      : { value: `${euro(b.fiscalite)}${decompo}`, align: "right", color: t.thOr };
    return [
      { value: b.nom },
      { value: b.lien, color: t.texteFaible },
      { value: euro(b.capital), align: "right" },
      abatt,
      fisc,
      { value: euro(b.net), align: "right", bold: true },
    ];
  };
  const rows: Cell[][] = d.beneficiaires.map(rendreLigne);
  const { enteteHtml, lignesHtml } = construireTableEcoulable(t, { cols, rows });

  // ─── Déclaration des blocs (contrat de page) ──
  const blocs: Bloc[] = [];

  // Header (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Transmission — volet 2 / 2",
      titre: "Assurance-vie & PER",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Bande KPI + note (insécables, gardées ensemble).
  blocs.push({
    kind: "insecable",
    html: `${bandeKPI(t, kpis)}
    <div class="foot">${d.noteKpi}</div>`,
  });

  // Sous-titre « Détail par bénéficiaire » : solidaire de son tableau.
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:24px">${sousTitreSection(t, "Détail par bénéficiaire")}</div>`,
  });

  // Table bénéficiaires = ListeEcoulable.
  blocs.push({
    kind: "liste",
    enteteHtml,
    lignesHtml,
    styleTable: `width:100%;border-collapse:collapse;table-layout:fixed;border:0.5px solid ${t.bordureClaire};margin-top:12px`,
  });

  // Queue épinglée en bas de la dernière feuille : clause + bandeau consolidé (TOTAL) + Notre lecture.
  // Le TOTAL reste ainsi toujours APRÈS tous les bénéficiaires, jamais au milieu de l'écoulement.
  blocs.push({
    kind: "queue",
    html: noteIconee(t, { iconeSvg: icones.fileText(t.eyebrowOr, 15), texteHtml: d.clauseBeneficiaireHtml }),
  });
  blocs.push({
    kind: "queue",
    html: bandeauConsolide(t, { labelHaut: d.totalLabelHaut, labelBas: d.totalLabelBas, valeur: euro(d.totalNetTransmis) }),
  });
  blocs.push({
    kind: "queue",
    html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }),
  });

  return compilerPageContrat(blocs);
}
