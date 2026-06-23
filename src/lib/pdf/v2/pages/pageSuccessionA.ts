// ─── Lot 9 — Page Succession A v2 (volet « Dévolution & droits ») ───────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_succession_pageA_corrige_hauteur.html
//
// Réutilise au MAXIMUM les primitives v2 existantes : header, bandeKPI
// (compact, 4 KPI), sousTitreSection, tableauTitresDores, encartNotreLecture,
// piedPage, coquillePage. Nouvelles primitives consommées : badge,
// barreDevolution.
//
// PAGINATION (Lot débordement) : la liste d'héritiers peut dépasser une feuille.
// On garde EXACTEMENT le chemin v1.23.0 (corps centré via regionCorpsCentree) tant
// que tout tient sur une feuille ; sinon on découpe la table PAR COMPTAGE sur
// plusieurs feuilles (paginerLignesSurFeuilles), en-tête de colonnes répété, encart
// « Notre lecture » + foot-note sur la dernière feuille seulement.

import {
  header,
  bandeKPI,
  sousTitreSection,
  barreDevolution,
  tableauTitresDores,
  encartNotreLecture,
  piedPage,
  coquillePage,
  regionCorpsCentree,
  paginerLignesSurFeuilles,
  H_HEADER_PX,
  H_BANDE_KPI_PX,
  H_LIGNE_TEXTE_PX,
  H_SOUSTITRE_PX,
  H_BLOC_DEVOLUTION_PX,
  H_FOOTNOTE_TABLE_PX,
  H_ENCART_NOTRE_LECTURE_BASE_PX,
  CHARS_PAR_LIGNE_CONVENTION,
  CHARS_PAR_LIGNE_ENCART,
  RESERVE_PIED_PX,
  euro,
  type Col,
  type Cell,
} from "../primitives";
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
  // 1 row = 1 héritier (unité de découpage). poids = 2 si `composition` (2e sous-ligne US/NP).
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
  const poidsLigne = (h: HeritierSuccession): number => (h.composition ? 2 : 1);
  const rows: Cell[][] = d.heritiers.map(rendreLigne);

  // ─── Pièces partagées (extraites en consts : interpolation byte-identique au
  //     chemin v1.23.0 ; réutilisées telles quelles dans le bloc de queue) ──
  const enTete = header(t, {
    eyebrow: "Transmission — volet 1 / 2",
    titre: "Dévolution & droits",
    droiteHaut: d.clientName,
    droiteBas: d.dateStr,
  });
  const barreDevolutionHTML = barreDevolution(t, {
    badge: d.devolutionBadge,
    description: d.devolutionDescription,
    segmentGauche: {
      pct: d.reservePct,
      couleur: t.navy,
      texte: d.reserveLabel,
      couleurTexte: t.kpiOrPale,
    },
    segmentDroite: {
      pct: d.quotitePct,
      couleur: t.or,
      texte: d.quotiteLabel,
      // Texte foncé sur or pour la lisibilité (contraste WCAG).
      couleurTexte: "#3A2A07",
    },
    legendeGauche: {
      label: "Réserve",
      valeur: euro(d.reserveMontant),
      couleurValeur: t.navy,
    },
    legendeDroite: {
      label: "Quotité disponible",
      valeur: euro(d.quotiteMontant),
      couleurValeur: t.eyebrowOr,
    },
  });
  const footNoteHTML = `<div class="foot" style="margin-top:6px">
        Part reçue = pleine propriété + nue-propriété fiscale + usufruit valorisé selon le coefficient Duvergier (CGI art. 669). Le conjoint marié ou partenaire de PACS est exonéré de droits (CGI art. 796-0 bis).
      </div>`;
  const encartHTML = encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture });

  // ─── Assemblage (chemin v1.23.0, conservé byte-identique en feuille unique) ──
  const zoneHaute = `
    ${enTete}

    ${bandeKPI(t, kpis)}
    <div class="foot">${d.noteKpi}</div>
  `;

  const corps = `

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Dévolution")}
      ${barreDevolutionHTML}
    </div>

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Détail par héritier")}
      ${tableauTitresDores(t, { cols, rows })}
      ${footNoteHTML}
    </div>

    ${encartHTML}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  // ─── Décision de pagination par comptage (conservatrice, zéro DOM) ──
  // Zone haute feuille 1 = header + KPI + note + Dévolution + sous-titre table.
  // Zone haute continuation = header + sous-titre table (thead géré par le helper).
  // Bloc de queue = foot-note + encart « Notre lecture » (épinglé dernière feuille).
  const lignesNote = Math.max(1, Math.ceil(d.noteKpi.length / CHARS_PAR_LIGNE_CONVENTION));
  const lignesNotreLecture = Math.max(1, Math.ceil(d.notreLecture.length / CHARS_PAR_LIGNE_ENCART));
  const zoneHaute1Px =
    H_HEADER_PX + H_BANDE_KPI_PX + lignesNote * H_LIGNE_TEXTE_PX + H_BLOC_DEVOLUTION_PX + H_SOUSTITRE_PX;
  const zoneHauteContPx = H_HEADER_PX + H_SOUSTITRE_PX;
  const hauteurBlocQueuePx =
    H_FOOTNOTE_TABLE_PX + H_ENCART_NOTRE_LECTURE_BASE_PX + lignesNotreLecture * H_LIGNE_TEXTE_PX;
  const blocQueueHTML = `${footNoteHTML}${encartHTML}`;

  const fragments = paginerLignesSurFeuilles<HeritierSuccession>({
    t,
    lignes: d.heritiers,
    cols,
    rendreLigne,
    poidsLigne,
    blocQueueHTML,
    zoneHaute1Px,
    zoneHauteContPx,
    hauteurBlocQueuePx,
  });

  // ── Cas courant : tout tient sur UNE feuille → chemin v1.23.0 INCHANGÉ (corps centré) ──
  if (fragments.length <= 1) {
    const hauteurZoneHautPx = H_HEADER_PX + H_BANDE_KPI_PX + lignesNote * H_LIGNE_TEXTE_PX;
    const contenu = `
    ${zoneHaute}
    ${regionCorpsCentree(corps, { hauteurZoneHautPx, reserveBasPx: RESERVE_PIED_PX })}
  `;
    return coquillePage(t, { contenu, pied });
  }

  // ── Multi-feuilles : Dévolution + table en flux depuis le haut, thead répété par
  //    feuille, encart + foot-note sur la dernière. Pied/numérotation inchangés (même
  //    pied sur toutes les feuilles ; l'écart X/N sections↔feuilles reste hors périmètre).
  const devolutionBlock = `
    <div style="margin-top:18px">
      ${sousTitreSection(t, "Dévolution")}
      ${barreDevolutionHTML}
    </div>`;
  return fragments
    .map((frag, i) => {
      const estPremiere = i === 0;
      const sousTitre = sousTitreSection(t, estPremiere ? "Détail par héritier" : "Détail par héritier (suite)");
      const zone = estPremiere
        ? `
    ${zoneHaute}
    ${devolutionBlock}
    <div style="margin-top:18px">${sousTitre}</div>`
        : `
    ${enTete}
    <div style="margin-top:18px">${sousTitre}</div>`;
      return coquillePage(t, { contenu: `${zone}\n    ${frag}`, pied });
    })
    .join("");
}
