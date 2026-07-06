// ─── Lot Dossier client — Adapter IR v2 ──────────────────────────────
//
// Mappe le résultat de `computeIR(data, irOptions, ...)` vers IRPageData.
// Les calculs (impôt, abattements, tranches) sont déjà faits côté moteur ;
// l'adapter ne fait que mapper + formatter pour l'affichage.

import type { IRPageData } from "../pages/pageIR";
import { DISPOSITIFS_FISCAUX } from "../../../../constants";
import { labelDispositifReduction, estReductionFinanciere } from "../../../calculs/utils";
import { referentiels } from "../../../../data/prevoyance";

export type BuildIRDataParams = {
  ir: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildIRData(p: BuildIRDataParams): IRPageData {
  const ir = p.ir || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // Mapping des revenus (les noms exacts dépendent de computeIR — fallback à 0).
  // Si certains champs sont absents, les KPIs apparaîtront à 0 € (pas crashants).
  const salaires       = num(ir.salaries ?? ir.salaires ?? (Number(data.salary1) + Number(data.salary2 || 0)));
  const fonciers       = num(ir.foncierBrut ?? ir.taxableFonciers ?? 0);
  const mobiliers      = num(ir.taxablePlacements ?? ir.totalPFU ?? 0);
  const pensionsAutres = num(ir.pensions ?? data.pensions ?? 0);
  const revenusBruts   = salaires + fonciers + mobiliers + pensionsAutres;
  const abattement10pct = num(ir.abattement10 ?? Math.round(salaires * 0.10));
  const revenuNetImposable = num(ir.revenuNetGlobal ?? (revenusBruts - abattement10pct));
  const impotNetDu = num(ir.finalIR ?? 0);
  const tmiPct = num((ir.marginalRate ?? 0) * (Number(ir.marginalRate) <= 1 ? 100 : 1));

  // ─── Analyse "masque" structurée — cadrage métier + chiffres + leviers ──
  const composition: string[] = [];
  if (salaires       > 0) composition.push(`salaires ${formatEuro(salaires)}`);
  if (fonciers       > 0) composition.push(`fonciers bruts ${formatEuro(fonciers)}`);
  if (mobiliers      > 0) composition.push(`placements taxables ${formatEuro(mobiliers)}`);
  if (pensionsAutres > 0) composition.push(`pensions ${formatEuro(pensionsAutres)}`);

  // Leviers contextuels selon le profil fiscal (logique déductive, pas IA).
  const leviers: string[] = [];
  if (tmiPct >= 30 && impotNetDu > 0) {
    leviers.push("PER individuel déductible (plafond annuel ~10 % des revenus pro nets) pour absorber la TMI 30–45 %");
  }
  if (fonciers > 0) {
    const regimeActuel = fonciers <= 15_000 ? "micro-foncier (30 % d'abattement forfaitaire)" : "réel (par défaut au-dessus de 15 000 € de loyers)";
    leviers.push(`arbitrage régime foncier (actuellement compatible ${regimeActuel}) — choix selon vos charges réelles déductibles`);
  }
  if (mobiliers > 0) {
    leviers.push("option PFU 30 % vs barème (intéressante si TMI ≤ 11 %) sur les revenus mobiliers");
  }
  if (leviers.length === 0) {
    leviers.push("Aucun levier fiscal prioritaire détecté sur cette situation");
  }

  const notreLectureCalculee = `
    <p style="margin:0 0 10px 0">Votre fiscalité personnelle reflète la <strong>composition de vos revenus</strong> et la mécanique du <strong>quotient familial</strong>. Les abattements et déductions ramènent l'assiette brute à l'assiette taxable.</p>
    <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
      <li><strong>Composition</strong> — Revenus bruts annuels : ${formatEuro(revenusBruts)} (${composition.join(", ") || "à compléter dans la collecte"}).</li>
      <li><strong>Assiette</strong> — Revenu net imposable : ${formatEuro(revenuNetImposable)} pour ${ir.parts || "—"} part${(ir.parts || 0) > 1 ? "s" : ""} fiscale${(ir.parts || 0) > 1 ? "s" : ""}.</li>
      <li><strong>Pression fiscale</strong> — ${impotNetDu > 0
        ? `Impôt dû : ${formatEuro(impotNetDu)}, soit ${formatPct(ir.averageRate)} en taux moyen. Tranche marginale ${tmiPct.toFixed(0)} % — chaque euro supplémentaire est taxé à ce taux.`
        : `Aucun impôt dû à ce stade (revenus sous le seuil ou compensés par les déductions).`}</li>
    </ul>
    <p style="margin:0;font-style:italic;color:#6B6353"><strong>Leviers à étudier :</strong> ${leviers.join(" ; ")}.</p>
  `.trim();

  // ── Dispositifs fiscaux (Lot E) : mappe dispositifsFiscaux + jeanbrunRetenu déjà
  //    exposés par le moteur (aucun recalcul). Labels via DISPOSITIFS_FISCAUX (jamais les ids). ──
  const df = ir.dispositifsFiscaux || {};
  const millesime = referentiels.pass.millesime;
  // Libellés via le résolveur partagé (immobilier + financier Lot 3) ; les réductions
  // FINANCIÈRES portent la mention « (investissement AAAA) » (one-shot de l'année simulée).
  const reductionsDispositifs = (df.reductions || [])
    .filter((r: any) => r.id !== "forfait_scolaire" && r.impute > 0)
    .map((r: any) => {
      const label = labelDispositifReduction(r.id);
      return { label: estReductionFinanciere(r.id) ? `${label} (investissement ${millesime})` : label, montant: r.impute };
    });
  const jeanbrunRetenu = Number(ir.jeanbrunRetenu) || 0;
  const jeanbrun = jeanbrunRetenu > 0 ? { retenu: jeanbrunRetenu, ecretement: Number(df.jeanbrun?.ecretement) || 0 } : null;
  // Écrêtement niches (art. 200-0 A) : valeur RÉELLE exposée par le moteur (double
  // enveloppe 10 000 / 18 000), ventilée par enveloppe pour la ligne PDF détaillée.
  const ecretementNiches = Number(df.ecretementNiches) || 0;
  const ecretementCommun = Number(df.ecretementCommun) || 0;
  const ecretementMajore = Number(df.ecretementMajore) || 0;
  const statutsNonOk = (df.statuts || []).map((s: any) => ({
    bienNom: (data.properties || []).find((pp: any) => pp.id === s.idBien)?.name || "Bien immobilier",
    dispositifLabel: DISPOSITIFS_FISCAUX.find((x) => x.value === s.dispositif)?.label ?? s.dispositif,
    motif: s.motif,
  }));

  return {
    clientName,
    dateStr,
    impotNetDu,
    trancheMarginale: formatPct(ir.marginalRate),
    tauxMoyen: formatPct(ir.averageRate),
    quotient: ir.parts ? `${ir.parts} part${ir.parts > 1 ? "s" : ""}` : "—",
    salaires,
    fonciers,
    mobiliers,
    pensionsAutres,
    revenusBruts,
    abattement10pct,
    revenuNetImposable,
    // SOURCE UNIQUE : décomposition par tranche (sur le quotient) DÉJÀ produite par computeIR.
    // Aucun recalcul, aucun barème en dur. marginalRate reste en décimal (pas d'arrondi num()).
    bracketFill: Array.isArray(ir.bracketFill) ? ir.bracketFill : [],
    quotientParPart: num(ir.quotient),
    parts: num(ir.parts),
    marginalRate: Number(ir.marginalRate) || 0,
    notreLecture: p.notreLecture || notreLectureCalculee,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Fiscalité — confidentiel`,
    reductionsDispositifs,
    jeanbrun,
    ecretementNiches,
    ecretementCommun,
    ecretementMajore,
    statutsNonOk,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatPct(v: any): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v.replace(/\s|%/g, "").replace(",", ".")) : v;
  if (!Number.isFinite(n)) return "—";
  // Si la valeur est déjà entre 0 et 1 (taux décimal), multiplier par 100
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1).replace(".", ",")} %`;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
}
