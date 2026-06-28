// ─── Lot Dossier client — Adapter Travail v2 ────────────────────────
//
// Mappe data + ir vers TravailPageData : revenus pros par personne +
// déductions. Tous les calculs sont déjà faits dans computeIR().

import type { TravailPageData, PersonneTravail, LigneRevenu, LigneDeduction } from "../pages/pageTravail";

export type BuildTravailDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  ir?: any;
  irOptions?: { expenseMode1?: string; expenseMode2?: string };
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildTravailData(p: BuildTravailDataParams): TravailPageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const ir = p.ir || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1Prenom = data.person1FirstName || "";
  const p1Nom    = data.person1LastName  || "";
  const p2Prenom = data.person2FirstName || "";
  const p2Nom    = data.person2LastName  || "";
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2Nom ? `${p1Prenom} ${p1Nom} & ${p2Prenom} ${p2Nom}` : `${p1Prenom} ${p1Nom}`).trim() || "Client";

  const salary1 = num(data.salary1);
  const salary2 = num(data.salary2);
  const ca1     = num(data.ca1);
  const ca2     = num(data.ca2);
  // Pensions : migration legacy ↔ par-personne (cf. src/lib/calculs/ir.ts ligne 80)
  // Si pensions1/2 renseignés → on les utilise ; sinon fallback sur pensions (champ foyer legacy).
  const pensionP1 = num(data.pensions1);
  const pensionP2 = num(data.pensions2);
  const pensionsLegacy = num(data.pensions);
  const pensionsFoyer = (pensionP1 + pensionP2) > 0 ? (pensionP1 + pensionP2) : pensionsLegacy;

  const revenusP1: LigneRevenu[] = [];
  if (salary1   > 0) revenusP1.push({ label: "Salaires nets annuels", valeur: salary1 });
  if (ca1       > 0) revenusP1.push({ label: "Chiffre d'affaires (BIC/BNC/BA)", valeur: ca1 });
  if (pensionP1 > 0) revenusP1.push({ label: "Pensions / retraites", valeur: pensionP1 });

  const revenusP2: LigneRevenu[] = [];
  if (salary2   > 0) revenusP2.push({ label: "Salaires nets annuels", valeur: salary2 });
  if (ca2       > 0) revenusP2.push({ label: "Chiffre d'affaires (BIC/BNC/BA)", valeur: ca2 });
  if (pensionP2 > 0) revenusP2.push({ label: "Pensions / retraites", valeur: pensionP2 });

  // ─── Revenus du foyer (non rattachés P1/P2) : foncier, mobilier, pensions legacy ──
  const revenusFoyer: LigneRevenu[] = [];
  const foncierBrut = num(ir.foncierBrut);
  const taxablePlacements = num(ir.taxablePlacements);
  if (foncierBrut       > 0) revenusFoyer.push({ label: "Revenus fonciers bruts (loyers)", valeur: foncierBrut });
  if (taxablePlacements > 0) revenusFoyer.push({ label: "Revenus mobiliers (placements taxables)", valeur: taxablePlacements });
  // Cas legacy : pensions saisies au foyer sans répartition P1/P2.
  if (pensionP1 === 0 && pensionP2 === 0 && pensionsLegacy > 0) {
    revenusFoyer.push({ label: "Pensions / retraites (foyer)", valeur: pensionsLegacy });
  }

  const personne1: PersonneTravail = {
    prenom: p1Prenom,
    profession: data.person1JobTitle || undefined,
    revenus: revenusP1,
  };

  // Cond stricte : couple + revenus saisis (aligne sur v1, évite card vide)
  const personne2: PersonneTravail | undefined = (isCouple && (salary2 > 0 || ca2 > 0 || pensionP2 > 0))
    ? {
        prenom: p2Prenom,
        profession: data.person2JobTitle || undefined,
        revenus: revenusP2,
      }
    : undefined;

  // KPI agrégés — formule v1 : salaires + foncier + placements (HORS pensions, déjà comptées via salaries dans certains cas).
  const revenusBruts = num(ir.salaries) + num(ir.foncierBrut) + num(ir.taxablePlacements);
  const revenuNetImposable = num(ir.revenuNetGlobal);
  const irEstime = num(ir.finalIR);

  // Déductions — formule v1 : "Autres déductions = max(0, deductibleCharges − perDeductionCalc)" pour éviter le double comptage.
  const deductions: LigneDeduction[] = [];
  const retainedExpenses = num(ir.retainedExpenses);
  const deductibleCharges = num(ir.deductibleCharges);
  const perDeduction = num(ir.perDeductionCalc);
  const autresDeductions = Math.max(0, deductibleCharges - perDeduction);
  if (retainedExpenses > 0) {
    const label = composeFraisLabel(p.irOptions);
    deductions.push({ label, valeur: retainedExpenses });
  }
  if (perDeduction     > 0) deductions.push({ label: "PER déductible", valeur: perDeduction });
  if (autresDeductions > 0) deductions.push({ label: "Autres déductions", valeur: autresDeductions });

  return {
    clientName,
    dateStr,
    revenusBruts,
    revenuNetImposable,
    irEstime,
    noteKpi: "Revenus bruts = salaires + foncier + placements taxables. IR estimé selon barème en vigueur, après abattements et déductions.",
    personne1,
    personne2,
    revenusFoyer,
    deductions,
    notreLecture: composeNotreLectureTravail({
      revenusBruts, revenusActifs: salairesActifs(salary1, salary2, ca1, ca2, pensionP1, pensionP2, pensionsLegacy),
      revenusPassifs: foncierBrut + taxablePlacements,
      salaries: salary1 + salary2, ca: ca1 + ca2,
      foncierBrut, taxablePlacements, perDeduction,
      irEstime, averageRate: Number(ir.averageRate),
    }),
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Revenus — confidentiel`,
  };
}

function salairesActifs(s1: number, s2: number, c1: number, c2: number, p1: number, p2: number, pLegacy: number): number {
  return s1 + s2 + c1 + c2 + p1 + p2 + (p1 === 0 && p2 === 0 ? pLegacy : 0);
}

function composeNotreLectureTravail(o: {
  revenusBruts: number; revenusActifs: number; revenusPassifs: number;
  salaries: number; ca: number; foncierBrut: number; taxablePlacements: number;
  perDeduction: number; irEstime: number; averageRate: number;
}): string {
  const totalRefer = o.revenusBruts > 0 ? o.revenusBruts : 1;
  const partPassif = Math.round((o.revenusPassifs / totalRefer) * 100);
  const partSalaires = Math.round((o.salaries / totalRefer) * 100);

  const points: string[] = [];
  if (o.ca > 30_000 && o.foncierBrut > 0) {
    points.push("revenus mixtes (indépendant + foncier) — vérifier l'arbitrage micro vs réel selon les charges réelles déductibles");
  }
  if (o.foncierBrut > 15_000) {
    points.push(`revenus fonciers > 15 000 € : régime réel obligatoire (le micro-foncier 30 % d'abattement n'est plus accessible)`);
  } else if (o.foncierBrut > 0) {
    points.push("revenus fonciers < 15 000 € : micro-foncier (30 % d'abattement) ou réel — à arbitrer selon vos charges");
  }
  if (o.taxablePlacements > 0) {
    points.push("revenus mobiliers présents : option PFU 30 % vs barème — à arbitrer chaque année selon votre TMI");
  }
  if (o.perDeduction === 0 && o.irEstime > 5_000) {
    points.push("PER non utilisé alors qu'un impôt est dû — levier d'épargne défiscalisée à étudier (plafond annuel ~10 % des revenus pro nets)");
  }
  if (partPassif > 30) {
    points.push(`revenus passifs (foncier + mobiliers) > 30 % des revenus bruts (${partPassif} %) : structure de revenus solide pour préparer la retraite`);
  }
  if (points.length === 0) {
    points.push("Structure de revenus simple — à revoir lors d'un changement professionnel ou patrimonial majeur");
  }

  return `
    <p style="margin:0 0 10px 0">La structure de vos revenus conditionne votre <strong>capacité d'épargne</strong>, vos <strong>marges d'optimisation fiscale</strong> et vos choix d'enveloppes patrimoniales.</p>
    <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
      <li><strong>Revenus actifs (salaires, CA, pensions)</strong> — ${formatEuroT(o.revenusActifs)}, soit ${Math.round((o.revenusActifs / totalRefer) * 100)} % des revenus bruts.</li>
      <li><strong>Revenus passifs (foncier + mobiliers)</strong> — ${formatEuroT(o.revenusPassifs)}, soit ${partPassif} %.</li>
      <li><strong>Pression fiscale</strong> — IR ${formatEuroT(o.irEstime)} — taux moyen ${formatPct(o.averageRate)} (IR / revenu net imposable).</li>
    </ul>
    <p style="margin:0;font-style:italic;color:#6B6353"><strong>Points d'attention :</strong> ${points.join(" ; ")}.</p>
  `.trim();
}

function formatEuroT(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
}

// Identique a buildIRData.formatPct : le taux moyen affiche dans la prose Travail
// matche EXACTEMENT le KPI net (formatPct(ir.averageRate)). averageRate est un taux
// decimal (0-1) => *100 ; valeur absente/non finie => "—".
function formatPct(v: any): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v.replace(/\s|%/g, "").replace(",", ".")) : v;
  if (!Number.isFinite(n)) return "—";
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1).replace(".", ",")} %`;
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function composeFraisLabel(irOptions?: { expenseMode1?: string; expenseMode2?: string }): string {
  // Aligne sur v1 : si l'un des modes est "actual" → "Frais réels" ; sinon → "Abattement 10%".
  // Si irOptions n'est pas fourni → label neutre.
  if (!irOptions) return "Frais professionnels retenus";
  const isActual = irOptions.expenseMode1 === "actual" || irOptions.expenseMode2 === "actual";
  return isActual ? "Frais réels" : "Abattement forfaitaire 10%";
}
