// ─── Lot 9 — Page IR v2 (refonte visuelle) ───────────────────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_page_fiscalite_A4_graphique_corrige.html
//
// Réutilise au MAXIMUM les primitives v2 existantes : header, bandeKPI
// (variante "large"), sousTitreSection, barreRepartition, cascadeRevenus,
// encartNotreLecture. Mise en page : compilerPageContrat (contrat déclaratif,
// Phase 3) — plus de boîte coquillePage ni de pied codé en dur (le pied vit
// désormais dans les margin-boxes @page du feeder).
//
// 🔴 Aucune logique fiscale : la page consomme des valeurs déjà calculées.

import {
  header,
  bandeKPI,
  sousTitreSection,
  barreRepartition,
  cascadeRevenus,
  encartNotreLecture,
  euro,
  type CascadeItem,
  type SegmentRepartition,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

export type IRPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  impotNetDu: number;       // 14 320
  trancheMarginale: string; // "30 %"
  tauxMoyen: string;        // "7,8 %"
  quotient: string;         // "3 parts"
  // Répartition revenus par nature (l'ordre = ordre de la barre + légende)
  salaires: number;         // 74 000
  fonciers: number;         // 11 000
  mobiliers: number;        // 4 500
  pensionsAutres: number;   // 2 500
  // Cascade « De vos revenus à l'impôt »
  revenusBruts: number;     // 92 000
  abattement10pct: number;  // 9 200
  revenuNetImposable: number; // 82 800
  // (impotNetDu = utilisé aussi pour la cascade)
  // Texte « Notre lecture »
  notreLecture: string;
  // Pagination
  pagePosition: string;     // "2 / 8"
  cabinetLibellePied: string;
};

export function pageIR(t: Tokens, d: IRPageData): string {
  // ─── KPI band (mode "large" — 4 KPI, 1er navy plus large) ──
  const kpis = [
    { label: "IMPÔT NET DÛ",   value: euro(d.impotNetDu),    type: "main"   as const },
    { label: "TRANCHE MARG.",  value: d.trancheMarginale,    type: "normal" as const },
    { label: "TAUX MOYEN",     value: d.tauxMoyen,           type: "normal" as const },
    { label: "QUOTIENT",       value: d.quotient,            type: "normal" as const },
  ];

  // ─── Répartition revenus par nature ──────────────────────────────────
  const totalRevenus = d.salaires + d.fonciers + d.mobiliers + d.pensionsAutres;
  const pct = (v: number) => totalRevenus > 0 ? Math.round((v / totalRevenus) * 100) : 0;
  const segments: SegmentRepartition[] = [
    { label: "Salaires & traitements", value: euro(d.salaires),       pct: pct(d.salaires),       couleur: t.navy },
    { label: "Revenus fonciers",       value: euro(d.fonciers),       pct: pct(d.fonciers),       couleur: t.sectionGrisBleu },
    { label: "Capitaux mobiliers",     value: euro(d.mobiliers),      pct: pct(d.mobiliers),      couleur: t.or },
    { label: "Pensions & autres",      value: euro(d.pensionsAutres), pct: pct(d.pensionsAutres), couleur: t.texteFaibleClair },
  ];

  // ─── Cascade « De vos revenus à l'impôt » ─────────────────────────────
  // Échelle commune : 100 % = revenus bruts.
  const echelle = d.revenusBruts || 1;
  const pctCascade = (v: number) => Math.min(100, Math.round((v / echelle) * 100));
  const items: CascadeItem[] = [
    { label: "Revenus bruts",         pct: 100,                                  valeur: euro(d.revenusBruts),                type: "revenu" },
    { label: "− Abattement 10 %",     pct: pctCascade(d.abattement10pct),        valeur: `− ${euro(d.abattement10pct)}`,      type: "deduction" },
    { label: "Revenu net imposable",  pct: pctCascade(d.revenuNetImposable),     valeur: euro(d.revenuNetImposable),          type: "netImposable" },
    { label: "Impôt sur le revenu",   pct: pctCascade(d.impotNetDu),             valeur: euro(d.impotNetDu),                  type: "impot" },
  ];

  // ─── Déclaration des blocs (contrat de page, engine/contrat.ts) ───────
  // Bascule de mécanisme (coquillePage → compilerPageContrat) : ordre visuel,
  // libellés, styles et couleurs INCHANGÉS — seule la mise en page passe en flux.
  const blocs: Bloc[] = [
    // Header de page (insécable).
    {
      kind: "insecable",
      html: header(t, {
        eyebrow: "Fiscalité",
        titre: "Impôt sur le revenu",
        droiteHaut: d.clientName,
        droiteBas: d.dateStr,
      }),
    },
    // Bande KPI (variante "large") — insécable.
    { kind: "insecable", html: bandeKPI(t, kpis, { taille: "large" }) },
    // Section « Revenus par nature » (sous-titre + barre, gardés ensemble).
    {
      kind: "insecable",
      html: `<div style="margin-top:24px">
      ${sousTitreSection(t, "Revenus par nature")}
      ${barreRepartition(t, segments)}
    </div>`,
    },
    // Section « De vos revenus à l'impôt » (sous-titre + cascade).
    {
      kind: "insecable",
      html: `<div style="margin-top:24px">
      ${sousTitreSection(t, "De vos revenus à l'impôt")}
      ${cascadeRevenus(t, items)}
    </div>`,
    },
    // Encart « Notre lecture » — queue épinglée en fin de flux.
    { kind: "queue", html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) },
  ];

  return compilerPageContrat(blocs);
}
