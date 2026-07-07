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
import { renderBracketChartSVG } from "../bracketChart";
import type { Tokens } from "../tokens";
import type { FilledBracket } from "../../../../types/patrimoine";

export type IRPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  impotNetDu: number;       // 14 320
  trancheMarginale: string; // "30 %"
  tauxMoyen: string;        // "7,8 %"
  quotient: string;         // "3 parts" (libellé KPI — nombre de parts, NE PAS confondre)
  // Barème par tranche (décomposition DÉJÀ calculée par computeIR sur le QUOTIENT — pur affichage)
  bracketFill: FilledBracket[]; // revenu logé + impôt par tranche, PAR PART
  quotientParPart: number;  // revenu net imposable par part (= revenuNetGlobal / parts)
  parts: number;            // nombre de parts fiscales (numérique)
  marginalRate: number;     // TMI en décimal (0,30) — sert au libellé du badge
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
  // ── Dispositifs fiscaux immobiliers (Lot E) — OPTIONNELS : absents ⇒ section masquée,
  //    sortie byte-identique à l'existant (dossier sans dispositif). ──
  reductionsDispositifs?: { label: string; montant: number }[]; // montant = imputé
  jeanbrun?: { retenu: number; ecretement: number } | null;
  ecretementNiches?: number;
  ecretementCommun?: number;  // part écrêtée par l'enveloppe 10 000 €
  ecretementMajore?: number;  // part écrêtée par l'enveloppe majorée 18 000 €
  statutsNonOk?: { bienNom: string; dispositifLabel: string; motif: string }[];
  // ── Location meublee (BIC, Lot 3) — OPTIONNELS : absents ⇒ section masquee,
  //    sortie iso pour un dossier sans bien meuble. Mirror du bloc TabIR. ──
  meubleDetail?: { nom: string; type: string; regime: "micro" | "reel"; sousType: string; recettes: number; abattement: number; chargesRetenues: number; amortDeductible: number; ard: number; deficitReportable: number; base: number }[];
  meubleBaseTotale?: number;
  meublePS?: number;
  lmpProbable?: boolean;
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
  // Format 2 décimales (réductions/amortissements exacts) : round -> sans décimale, sinon 2.
  const euro2 = (v: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v) + " €";
  const reductionsDispositifs = d.reductionsDispositifs ?? [];
  const jeanbrun = d.jeanbrun ?? null;
  const ecretementNiches = d.ecretementNiches ?? 0;
  const ecretementCommun = d.ecretementCommun ?? 0;
  const ecretementMajore = d.ecretementMajore ?? 0;
  // Label écrêtement : détaille les deux enveloppes (art. 200-0 A) quand chacune contribue.
  const partsEcretement: string[] = [];
  if (ecretementCommun > 0) partsEcretement.push(`enveloppe 10 000 € : ${euro2(ecretementCommun)}`);
  if (ecretementMajore > 0) partsEcretement.push(`enveloppe majorée 18 000 € : ${euro2(ecretementMajore)}`);
  const labelEcretement = "Plafonnement des niches (art. 200-0 A)" + (partsEcretement.length ? ` — ${partsEcretement.join(" ; ")}` : "");
  const statutsNonOk = d.statutsNonOk ?? [];
  const items: CascadeItem[] = [
    { label: "Revenus bruts",         pct: 100,                                  valeur: euro(d.revenusBruts),                type: "revenu" },
    { label: "− Abattement 10 %",     pct: pctCascade(d.abattement10pct),        valeur: `− ${euro(d.abattement10pct)}`,      type: "deduction" },
    // Benefice BIC meuble ajoute au revenu global par le moteur (revenuNetGlobal),
    // SANS abattement 10 % (art. 50-0 / reel). Ligne informative, deja dans le net.
    ...((d.meubleBaseTotale ?? 0) > 0 ? [{ label: "+ Bénéfice location meublée (BIC)", pct: pctCascade(d.meubleBaseTotale as number), valeur: `+ ${euro(d.meubleBaseTotale as number)}`, type: "revenu" as const }] : []),
    { label: "Revenu net imposable",  pct: pctCascade(d.revenuNetImposable),     valeur: euro(d.revenuNetImposable),          type: "netImposable" },
    // dont amortissement Jeanbrun (déjà reflété dans le revenu net imposable — informatif).
    ...(jeanbrun ? [{ label: "dont amortissement Jeanbrun Relance logement" + (jeanbrun.ecretement > 0 ? ` — plafond foyer atteint (${euro2(jeanbrun.ecretement)} écrêtés)` : ""), pct: pctCascade(jeanbrun.retenu), valeur: `− ${euro2(jeanbrun.retenu)}`, type: "deduction" as const }] : []),
    // Réductions d'impôt (une par dispositif) avant l'impôt net.
    ...reductionsDispositifs.map((r) => ({ label: `Réduction ${r.label}`, pct: pctCascade(r.montant), valeur: `− ${euro2(r.montant)}`, type: "deduction" as const })),
    ...(ecretementNiches > 0 ? [{ label: labelEcretement, pct: pctCascade(ecretementNiches), valeur: `− ${euro2(ecretementNiches)} non imputés`, type: "deduction" as const }] : []),
    { label: "Impôt sur le revenu",   pct: pctCascade(d.impotNetDu),             valeur: euro(d.impotNetDu),                  type: "impot" },
  ];
  // Notes de bas de section (statuts non-ok, une ligne chacun ; mention 150 VB si amortissement actif).
  const notes: string[] = [];
  for (const s of statutsNonOk) notes.push(`${s.dispositifLabel} — ${s.bienNom} : ${s.motif}`);
  if (jeanbrun) notes.push("Les amortissements déduits minoreront le prix d'acquisition pour le calcul de la plus-value en cas de cession (art. 150 VB CGI).");
  const notesHtml = notes.length > 0 ? "\n      " + notes.map((nn) => `<div class="foot">${nn}</div>`).join("\n      ") : "";

  // ─── Barème IR par tranche (PUR AFFICHAGE de d.bracketFill, calculé sur le QUOTIENT) ──
  // Option A « par part » : hauteur = revenu logé par tranche pour une part ; montant = impôt
  // de la tranche par part ; tranche active = celle du quotient (TMI), marquée contour + badge
  // « TMI ». Note de réconciliation QUALITATIVE (la décote et le plafonnement QF ne sont pas
  // exposés par le moteur) : la somme des barres N'EST PAS l'impôt net. Aucun plafonnement 75 %.
  const aBareme = Array.isArray(d.bracketFill) && d.bracketFill.length > 0;
  const tmiPct = Math.round((d.marginalRate <= 1 ? d.marginalRate * 100 : d.marginalRate));
  const baremeBloc: Bloc = {
    kind: "insecable",
    html: `<div style="margin-top:24px">
      ${sousTitreSection(t, "Barème IR — remplissage des tranches (par part)")}
      <div class="foot" style="margin-bottom:6px">Lecture pour <strong>une part</strong> de quotient familial (${euro(d.quotientParPart)} par part, ${d.parts} part${d.parts > 1 ? "s" : ""}) — hauteur = revenu logé par tranche, montant = impôt de la tranche, par part. La tranche « TMI » est votre tranche marginale (${tmiPct} %).</div>
      ${renderBracketChartSVG(d.bracketFill, t, { referenceValue: d.quotientParPart, badgeActif: "TMI", formatBorne: "euro" })}
      <div class="foot">Barème appliqué au revenu par part (quotient) : impôt par part × ${d.parts} part${d.parts > 1 ? "s" : ""}, puis décote et plafonnement du quotient familial donnent l'impôt net dû. La somme des barres ci-dessus n'est donc pas l'impôt net.</div>
    </div>`,
  };

  // ─── Location meublee (BIC) — mirror du bloc TabIR (Lot 3), PUR AFFICHAGE de
  //     d.meubleDetail (sorties moteur), aucun recalcul. Absent ⇒ blocs vides. ──
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const SOUS_LABEL: Record<string, string> = { longue_duree: "Longue durée", tourisme_classe: "Tourisme classé", tourisme_non_classe: "Tourisme non classé" };
  // Typo alignee sur le bloc "De vos revenus a l'impot" (cascadeRevenus) : Lato
  // 11,5px, libelles en graisse normale, valeurs 700 ; le meuble n'est pas plus
  // proeminent que le reste de la page (la taille 11,5px est portee par le wrapper).
  const ligneMeuble = (label: string, valeur: string, opts: { fort?: boolean; note?: string } = {}) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:1.5px 0"><span style="${opts.fort ? `font-weight:700;color:${t.navy}` : `color:${t.texteFaible}`}">${label}${opts.note ? ` <span style="color:${t.texteFaibleClair};font-size:9.5px">${opts.note}</span>` : ""}</span><span style="font-weight:700;color:${t.navy}">${valeur}</span></div>`;
  const meubleBlocs: Bloc[] = [];
  if (d.meubleDetail && d.meubleDetail.length > 0) {
    const biensHtml = d.meubleDetail.map((m) => {
      const entete = `<div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-weight:700;color:${t.navy}">${esc(m.nom)}</span><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;color:${t.or}">${m.regime === "micro" ? "Micro-BIC" : "Réel"} · ${SOUS_LABEL[m.sousType] || esc(m.sousType)}</span></div>`;
      const corps = m.regime === "micro"
        ? ligneMeuble("Recettes", euro(m.recettes)) + ligneMeuble("Abattement", `− ${euro(m.abattement)}`)
        : ligneMeuble("Recettes", euro(m.recettes))
          + ligneMeuble("Charges retenues", `− ${euro(m.chargesRetenues)}`)
          + (m.amortDeductible > 0 ? ligneMeuble("Amortissement déduit", `− ${euro(m.amortDeductible)}`) : "")
          + (m.ard > 0 ? ligneMeuble("Amortissement en report (ARD)", euro(m.ard), { note: "report illimité, art. 39 C" }) : "")
          + (m.deficitReportable > 0 ? ligneMeuble("Déficit", euro(m.deficitReportable), { note: "non imputable au revenu global, art. 156 I-1 ter" }) : "");
      return `<div style="border:0.5px solid ${t.bordureEncart};border-radius:6px;padding:7px 9px;margin-bottom:6px">${entete}${corps}<div style="border-top:0.5px solid ${t.bordureEncart};margin-top:3px;padding-top:3px">${ligneMeuble("Base imposable", euro(m.base), { fort: true })}</div></div>`;
    }).join("");
    const totalHtml = `<div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid ${t.bordureEncart}"><span style="font-weight:700;color:${t.navy}">Base imposable meublée (total)</span><span style="font-weight:700;color:${t.navy}">${euro(d.meubleBaseTotale ?? 0)}</span></div>`
      + ((d.meublePS ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding-top:2px"><span style="color:${t.texteFaibleClair}">Prélèvements sociaux revenus du patrimoine (LFSS 2026)</span><span style="font-weight:700;color:${t.danger}">${euro(d.meublePS)}</span></div>` : "");
    meubleBlocs.push({
      kind: "insecable",
      html: `<div class="lt" style="margin-top:24px;font-size:11.5px;line-height:1.5">
      ${sousTitreSection(t, "Location meublée (BIC)")}
      ${biensHtml}${totalHtml}
    </div>`,
    });
    if (d.lmpProbable) {
      meubleBlocs.push({
        kind: "insecable",
        html: `<div style="margin-top:12px;background:${t.fondEncart};border:0.5px solid ${t.bordureEncart};border-left:3px solid ${t.or};border-radius:6px;padding:10px 13px;font-size:10.5px;color:${t.texteFaibleClair}"><strong style="color:${t.navy}">Statut LMP probable</strong> — recettes meublées du foyer supérieures à 23 000 € et aux revenus d'activité. Conséquences non modélisées : déficit imputable au revenu global, cotisations SSI, plus-values professionnelles, exonération IFI possible (art. 975 V). Modélisation LMNP conservée (sens conservateur).</div>`,
      });
    }
  }

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
      ${cascadeRevenus(t, items)}${notesHtml}
    </div>`,
    },
    // Section « Location meublée (BIC) » (Lot 3) — après la cascade, mirror TabIR.
    ...meubleBlocs,
    // Barème par tranche (par part) — inséré après la cascade, avant « Notre lecture ».
    ...(aBareme ? [baremeBloc] : []),
    // Encart « Notre lecture » — queue épinglée en fin de flux.
    { kind: "queue", html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) },
  ];

  return compilerPageContrat(blocs);
}
