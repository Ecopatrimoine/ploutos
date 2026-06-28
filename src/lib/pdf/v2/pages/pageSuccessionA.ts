// ─── Lot 9 — Page Succession A v2 (volet « Dévolution & droits ») ───────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_succession_pageA_corrige_hauteur.html
//
// PHASE 3 (moteur paged.js) — page DÉCLARÉE via le contrat (engine/contrat.ts),
// comme Recommandations/Hypos/IFI/PrevPerso. Sortie de coquillePage ET abandon du
// chunking par comptage : la table d'héritiers devient une
// ListeEcoulable (mesurée par paged.js, thead répété + « (suite) »). foot-note CGI +
// « Notre lecture » = queue épinglée en bas de la dernière feuille.

import {
  header,
  bandeKPI,
  sousTitreSection,
  barreDevolution,
  encartNotreLecture,
  construireTableEcoulable,
  euro,
  type Col,
  type Cell,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

export type HeritierSuccession = {
  nom: string;          // "Hélène Dubreuil"
  lien: string;         // "Conjoint" | "Enfant" | etc.
  partRecue: number;    // 265 150
  abattement?: number;  // 100 000 (0 ou undefined si pas d'abattement)
  droits: number;       // 45 100 ; mettre 0 + flagExonere si exonéré
  droitsExonere?: boolean;  // true → affiche "exonéré" en vert au lieu d'un montant
  net: number;          // 352 625
  composition?: string; // ex: "US fiscal 941 164 € (1 972 950 € × 50%)"
};

export type SuccessionAPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  masseSuccessoraleNette: number; // 1 060 600
  droitsSuccession: number;       // 90 200
  netTransmis: number;            // 970 400
  tauxMoyen: string;              // "8,5 %"
  // Note sous les KPI
  noteKpi: string;                // "Masse civile, hors AV et PER..."
  // Dévolution
  devolutionBadge: string;        // "Dévolution légale"
  devolutionDescription: string;  // "2 enfants · conjoint — option ¼ en pleine propriété"
  reservePct: number;             // 67 (Réserve héréditaire 2/3)
  reserveLabel: string;           // "Réserve héréditaire · 2/3"
  reserveMontant: number;         // 707 067
  quotitePct: number;             // 33 (Quotité disponible 1/3)
  quotiteLabel: string;           // "Quotité dispo. · 1/3"
  quotiteMontant: number;         // 353 533
  // Détail héritiers
  heritiers: HeritierSuccession[];
  // Notre lecture
  notreLecture: string;
  // Pied
  pagePosition: string;           // "4 / 8"
  cabinetLibellePied: string;     // "EcoPatrimoine Conseil · Transmission — confidentiel"
};

export function pageSuccessionA(t: Tokens, d: SuccessionAPageData): string {
  // ─── KPI band (compact, 4 KPI, 1 navy + 3 cernés) ──
  const kpis = [
    { label: "Masse successorale nette", value: euro(d.masseSuccessoraleNette), type: "main"   as const },
    { label: "Droits de succession",     value: euro(d.droitsSuccession),       type: "normal" as const },
    { label: "Net transmis",             value: euro(d.netTransmis),            type: "normal" as const },
    { label: "Taux moyen",               value: d.tauxMoyen,                    type: "normal" as const },
  ];

  // ─── Détail par héritier (tableau 6 colonnes) ──
  const cols: Col[] = [
    { label: "Héritier",   align: "left",  width: "25%" },
    { label: "Lien",       align: "left",  width: "18%" },
    { label: "Part reçue", align: "right", width: "16%" },
    { label: "Abatt.",     align: "right", width: "13%" },
    { label: "Droits",     align: "right", width: "13%" },
    { label: "Net",        align: "right", width: "15%" },
  ];
  // 1 row = 1 héritier. La `composition` (US/NP) ajoute une 2e sous-ligne DANS la cellule
  // « Héritier » → la row reste un seul <tr> insécable, juste plus haute.
  const rendreLigne = (h: HeritierSuccession): Cell[] => ([
    {
      value: h.composition
        ? `${h.nom}<div style="font-size:8.5px;color:${t.texteFaibleClair};margin-top:1px;line-height:1.25">${h.composition}</div>`
        : h.nom,
    },
    { value: h.lien, color: t.texteFaible },
    { value: euro(h.partRecue), align: "right" },
    {
      value: h.abattement && h.abattement > 0 ? euro(h.abattement) : "—",
      align: "right",
      color: h.abattement && h.abattement > 0 ? undefined : t.texteFaibleClair,
    },
    h.droitsExonere
      ? { value: "exonéré", align: "right", color: t.succes, bold: true }
      : { value: euro(h.droits), align: "right", color: t.thOr },
    { value: euro(h.net), align: "right", bold: true },
  ]);
  const rows: Cell[][] = d.heritiers.map(rendreLigne);
  const { enteteHtml, lignesHtml } = construireTableEcoulable(t, { cols, rows });

  // foot-note CGI (légende sous la table) — réutilisée dans la queue.
  const footNoteHTML = `<div class="foot" style="margin-top:6px">
        Part reçue = pleine propriété + nue-propriété fiscale + usufruit valorisé selon le coefficient Duvergier (CGI art. 669). Le conjoint marié ou partenaire de PACS est exonéré de droits (CGI art. 796-0 bis).
      </div>`;

  // ─── Déclaration des blocs (contrat de page) ──
  const blocs: Bloc[] = [];

  // Header (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Transmission — volet 1 / 2",
      titre: "Dévolution & droits",
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

  // Dévolution (badge + barre réserve/quotité) — insécable.
  blocs.push({
    kind: "insecable",
    html: `<div style="margin-top:18px">
      ${sousTitreSection(t, "Dévolution")}
      ${barreDevolution(t, {
        badge: d.devolutionBadge,
        description: d.devolutionDescription,
        segmentGauche: { pct: d.reservePct, couleur: t.navy, texte: d.reserveLabel, couleurTexte: t.kpiOrPale },
        // Texte foncé sur or pour la lisibilité (contraste WCAG).
        segmentDroite: { pct: d.quotitePct, couleur: t.or, texte: d.quotiteLabel, couleurTexte: "#3A2A07" },
        legendeGauche: { label: "Réserve", valeur: euro(d.reserveMontant), couleurValeur: t.navy },
        legendeDroite: { label: "Quotité disponible", valeur: euro(d.quotiteMontant), couleurValeur: t.eyebrowOr },
      })}
    </div>`,
  });

  // Sous-titre « Détail par héritier » : solidaire de son tableau (titre non orphelin).
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:18px">${sousTitreSection(t, "Détail par héritier")}</div>`,
  });

  // Table héritiers = ListeEcoulable (coupable entre lignes ; thead répété + « (suite) »).
  blocs.push({
    kind: "liste",
    enteteHtml,
    lignesHtml,
    styleTable: `width:100%;border-collapse:collapse;table-layout:fixed;border:0.5px solid ${t.bordureClaire};margin-top:12px`,
  });

  // Queue épinglée en bas de la dernière feuille : foot-note CGI + « Notre lecture ».
  blocs.push({ kind: "queue", html: footNoteHTML });
  blocs.push({ kind: "queue", html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) });

  return compilerPageContrat(blocs);
}
