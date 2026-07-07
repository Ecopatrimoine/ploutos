// ─── Lot Dossier client — Adapter IR v2 ──────────────────────────────
//
// Mappe le résultat de `computeIR(data, irOptions, ...)` vers IRPageData.
// Les calculs (impôt, abattements, tranches) sont déjà faits côté moteur ;
// l'adapter ne fait que mapper + formatter pour l'affichage.

import type { IRPageData } from "../pages/pageIR";
import { DISPOSITIFS_FISCAUX } from "../../../../constants";
import { labelDispositifReduction, estReductionFinanciere } from "../../../calculs/utils";
import { referentiels } from "../../../../data/prevoyance";
import { detectLmp } from "../../../calculs/locationMeublee";
import { collecteRevenusActiviteFoyer } from "../../../calculs/ir";

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

  // ── TMI effective (Lot B2) : classification du cas + encart pédagogique, depuis les
  //    champs Lot A du moteur (ZERO recalcul ni barème en dur ; frontière via ir.bracketFill
  //    déjà exposé). La tuile KPI reste la tranche statutaire. ──
  const euro2 = (v: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
  const pct2 = (r: number) => (r * 100).toFixed(2).replace(".", ",") + " %";
  const mrEff = Number(ir.marginalRateEffectif) || 0;   // décimal (0,30)
  const mr = Number(ir.marginalRate) || 0;              // décimal (tranche statutaire)
  const tranchePctInt = Math.round(mr * 100);
  const effPctInt = Math.round(mrEff * 100);
  const decoteMontant = Number(ir.decoteMontant) || 0;
  const plafonnementQfActif = !!ir.plafonnementQfActif;
  const qfEcretement = Number(ir.quotientFamilialCapAdjustment) || 0;
  const totalPFU = Number(ir.totalPFU) || 0;
  const forfaitaires = totalPFU + (Number(ir.avRachatImpot) || 0) + (Number(ir.foncierSocialLevy) || 0) + (Number(ir.perRentesPS) || 0) + (Number(ir.meubleSocialLevy) || 0);
  const baremeNul = (Number(ir.bareme) || 0) <= 0;
  const effDiffTranche = Math.abs(mrEff - mr) >= 0.0001;
  const baseParts = isCouple ? 2 : 1;
  // Frontière : le delta +100 chevauche un seuil de tranche (ni décote ni plafonnement).
  // Distance au seuil et taux suivant lus dans ir.bracketFill (aucun barème en dur).
  const brf: any[] = Array.isArray(ir.bracketFill) ? ir.bracketFill : [];
  const quotientVal = Number(ir.quotient) || 0;
  const partsVal = Number(ir.parts) || 1;
  const activeIdxBr = brf.findIndex((b) => quotientVal <= b.to);
  const activeBr = activeIdxBr >= 0 ? brf[activeIdxBr] : undefined;
  const nextBr = activeIdxBr >= 0 ? brf[activeIdxBr + 1] : undefined;
  const distSeuilFoyer = activeBr && Number.isFinite(activeBr.to) ? Math.max(0, (Number(activeBr.to) - quotientVal) * partsVal) : Infinity;

  // Classification (priorité : forfaitaire > cumul > plafonnement > décote > frontière > normal).
  let tmiCase: "normal" | "decote" | "plafonnement" | "cumul" | "frontiere" | "forfaitaire";
  if (impotNetDu <= 0) tmiCase = "normal";
  else if (baremeNul && forfaitaires > 0) tmiCase = "forfaitaire";
  else if (plafonnementQfActif && decoteMontant > 0) tmiCase = "cumul";
  else if (plafonnementQfActif) tmiCase = "plafonnement";
  else if (decoteMontant > 0) tmiCase = "decote";
  else if (effDiffTranche && !!nextBr) tmiCase = "frontiere";
  else tmiCase = "normal";

  // Encart « votre taux marginal réel » (mini-calcul) — ABSENT en normal/forfaitaire.
  let tmiEncart: { titre: string; texteHtml: string } | undefined;
  if (tmiCase === "decote") {
    const baremePart = mr * 100, totalPart = mrEff * 100, decotePart = totalPart - baremePart;
    tmiEncart = { titre: "Votre taux marginal réel", texteHtml: `<strong>${pct2(mrEff)}</strong> (et non ${tranchePctInt} %). Pour 100 € de revenu imposable en plus : +${euro2(baremePart)} de barème, +${euro2(decotePart)} de décote perdue (la décote s'éteint à mesure que le revenu monte) = ${euro2(totalPart)}.` };
  } else if (tmiCase === "plafonnement") {
    tmiEncart = { titre: "Votre taux marginal réel", texteHtml: `<strong>${effPctInt} %</strong> (et non ${tranchePctInt} %). Votre avantage de quotient familial est plafonné (écrêtement ${formatEuro(qfEcretement)}) : chaque euro supplémentaire est imposé comme pour un foyer de ${baseParts} parts, dans la tranche à ${effPctInt} %.` };
  } else if (tmiCase === "cumul") {
    tmiEncart = { titre: "Votre taux marginal réel", texteHtml: `<strong>${pct2(mrEff)}</strong> (et non ${tranchePctInt} %). Votre avantage de quotient familial est plafonné (écrêtement ${formatEuro(qfEcretement)}) : chaque euro est imposé comme pour un foyer de ${baseParts} parts ; s'y ajoute la décote (${formatEuro(decoteMontant)}) qui s'éteint à mesure que le revenu monte et renchérit encore l'euro marginal.` };
  } else if (tmiCase === "frontiere") {
    tmiEncart = { titre: "Vous approchez d'une tranche", texteHtml: `Vous êtes à ${formatEuro(distSeuilFoyer)} de revenu imposable du passage dans la tranche à ${Math.round((Number(nextBr?.rate) || 0) * 100)} %.` };
  }

  // Phrase "Pression fiscale" (Notre lecture) SIMPLIFIÉE : normale inchangée ; en cas de
  // divergence, renvoi à l'encart (pas de duplication) ; forfaitaire (Perry) = message PFU.
  const forfaitPFUPhrase = (totalPFU > 0 && tmiCase !== "forfaitaire")
    ? ` Vos revenus de capitaux sont par ailleurs imposés au forfait (${formatEuro(totalPFU)} — PFU 31,4 %), indépendamment de la tranche.`
    : "";
  const tauxMoyenTxt = `Impôt dû : ${formatEuro(impotNetDu)}, soit ${formatPct(ir.averageRate)} en taux moyen.`;
  let pressionFiscale: string;
  if (impotNetDu <= 0) {
    pressionFiscale = "Aucun impôt dû à ce stade (revenus sous le seuil ou compensés par les déductions).";
  } else if (tmiCase === "forfaitaire") {
    pressionFiscale = `Barème : 0 % — l'essentiel de votre impôt (${formatEuro(impotNetDu)}) provient de l'imposition forfaitaire de vos revenus de capitaux.`;
  } else if (tmiCase === "frontiere") {
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale ${tranchePctInt} % — vous approchez de la tranche supérieure : voir l'encadré ci-dessus.`;
  } else if (tmiCase === "normal") {
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale ${tranchePctInt} % — chaque euro supplémentaire de revenu imposable est taxé à ce taux.`;
  } else {
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale ${tranchePctInt} % — votre taux marginal réel diffère : voir l'encadré « votre taux marginal réel » ci-dessus.`;
  }
  pressionFiscale += forfaitPFUPhrase;

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
      <li><strong>Pression fiscale</strong> — ${pressionFiscale}</li>
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

  // ── Location meublee (BIC) : mapping des sorties moteur (ir.meubleDetail), AUCUN
  //    recalcul (lecon divergence ecran/PDF). Absent/vide ⇒ undefined ⇒ section
  //    masquee, sortie iso pour un dossier sans bien meuble. ──
  const meubleDetailRaw = Array.isArray(ir.meubleDetail) ? ir.meubleDetail : [];
  const meubleDetail = meubleDetailRaw.map((m: any) => ({
    nom: m.nom, type: m.type, regime: m.regime, sousType: m.sousType,
    recettes: num(m.recettes), abattement: num(m.abattement), chargesRetenues: num(m.chargesRetenues),
    amortDeductible: num(m.amortDeductible), ard: num(m.ard), deficitReportable: num(m.deficitReportable), base: num(m.base),
  }));
  // Constat LMP : predicat PUR partage avec l'ecran (recettes depuis le detail moteur,
  // revenus d'activite via collecteRevenusActiviteFoyer). Ne recalcule aucun IR.
  const recettesMeubleesFoyer = meubleDetailRaw.reduce((s: number, m: any) => s + (m.recettes || 0), 0);
  const lmpProbable = meubleDetail.length > 0
    && (detectLmp(recettesMeubleesFoyer, collecteRevenusActiviteFoyer(data as any)) || (data.properties || []).some((pp: any) => pp.type === "LMP"));

  return {
    meubleDetail: meubleDetail.length ? meubleDetail : undefined,
    meubleBaseTotale: num(ir.beneficeMeuble),
    meublePS: num(ir.meubleSocialLevy),
    lmpProbable: lmpProbable || undefined,
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
    // TMI effective (Lot B2) : classification + encart pédagogique (tuile = tranche statutaire).
    tmiCase,
    tmiEncart,
    // Graphe barème "QF plafonné" (foyer commun) : fill + quotient du calcul de référence.
    plafonnementQfActif,
    bracketFillBaseParts: Array.isArray(ir.bracketFillBaseParts) ? ir.bracketFillBaseParts : undefined,
    quotientBaseParts: ir.quotientBaseParts !== undefined ? num(ir.quotientBaseParts) : undefined,
    qfEcretement,
    baseParts,
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
