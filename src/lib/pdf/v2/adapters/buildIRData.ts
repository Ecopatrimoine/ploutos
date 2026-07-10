// ─── Lot Dossier client — Adapter IR v2 ──────────────────────────────
//
// Mappe le résultat de `computeIR(data, irOptions, ...)` vers IRPageData.
// Les calculs (impôt, abattements, tranches) sont déjà faits côté moteur ;
// l'adapter ne fait que mapper + formatter pour l'affichage.

import type { IRPageData } from "../pages/pageIR";
import { DISPOSITIFS_FISCAUX } from "../../../../constants";
import { labelDispositifReduction, estReductionFinanciere, euro, pct, plur } from "../../../calculs/utils";
import { referentiels } from "../../../../data/prevoyance";
import { detectLmp } from "../../../calculs/locationMeublee";
import { collecteRevenusActiviteFoyer } from "../../../calculs/ir";
import { computeTmiView } from "../../../calculs/tmiEffective";

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

  // ── TMI effective (Lot C) : DÉLÉGATION au helper de vue partagé computeTmiView (source
  //    unique écran/PDF). Le PDF compose l'encart en HTML (byte-identique à l'existant) ; la
  //    phrase « Notre lecture » reste spécifique PDF (ci-dessous), pilotée par le tmiCase. ──
  const plafonnementQfActif = !!ir.plafonnementQfActif;   // champ graphe (return)
  const qfEcretement = Number(ir.quotientFamilialCapAdjustment) || 0; // champ graphe (return)
  const baseParts = isCouple ? 2 : 1;                     // champ graphe (return)
  const tmiView = computeTmiView(ir, isCouple);
  const tmiCase = tmiView.tmiCase;
  const tmiEncart = tmiView.encart
    ? { titre: tmiView.encart.titre, texteHtml: tmiView.encart.leadFort ? `<strong>${tmiView.encart.leadFort}</strong> ${tmiView.encart.corps}` : tmiView.encart.corps }
    : undefined;
  const reconBaremeLignes = tmiView.reconBaremeLignes;

  // Phrase « Notre lecture » (PDF-only) : normale inchangée ; divergence -> renvoi à l'encart ;
  // forfaitaire (Perry) = message PFU. Seconde phrase PFU en sus si présente (hors Perry).
  const tranchePctInt = Math.round((Number(ir.marginalRate) || 0) * 100);
  const totalPFU = Number(ir.totalPFU) || 0;
  const forfaitPFUPhrase = (totalPFU > 0 && tmiCase !== "forfaitaire")
    ? ` Vos revenus de capitaux sont par ailleurs imposés au forfait (${euro(totalPFU)} — PFU 31,4 %), indépendamment de la tranche.`
    : "";
  const tauxMoyenTxt = `Impôt dû : ${euro(impotNetDu)}, soit ${pct(Number(ir.averageRate) || 0, 1)} en taux moyen.`;
  let pressionFiscale: string;
  if (impotNetDu <= 0) {
    pressionFiscale = "Aucun impôt dû à ce stade (revenus sous le seuil ou compensés par les déductions).";
  } else if (tmiCase === "forfaitaire") {
    pressionFiscale = `Barème : 0 % — l'essentiel de votre impôt (${euro(impotNetDu)}) provient de l'imposition forfaitaire de vos revenus de capitaux.`;
  } else if (tmiCase === "frontiere") {
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale ${tranchePctInt} % — vous approchez de la tranche supérieure : voir l'encadré ci-dessus.`;
  } else if (tmiCase === "normal") {
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale ${tranchePctInt} % — chaque euro supplémentaire de revenu imposable est taxé à ce taux.`;
  } else if (tmiCase === "decote") {
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale ${tranchePctInt} % — votre taux marginal réel diffère (effet décote) : voir l'encadré « votre taux marginal réel » ci-dessus.`;
  } else {
    // plafonnement | cumul : la tranche marginale RÉELLE est celle du calcul de référence.
    pressionFiscale = `${tauxMoyenTxt} Tranche marginale réelle ${Math.round(tmiView.tmiAffichee * 100)} % (tranche sur le quotient ${tranchePctInt} %) — voir l'encadré « votre taux marginal réel » ci-dessus.`;
  }
  pressionFiscale += forfaitPFUPhrase;

  // ─── Analyse "masque" structurée — cadrage métier + chiffres + leviers ──
  const composition: string[] = [];
  if (salaires       > 0) composition.push(`salaires ${euro(salaires)}`);
  if (fonciers       > 0) composition.push(`fonciers bruts ${euro(fonciers)}`);
  if (mobiliers      > 0) composition.push(`placements taxables ${euro(mobiliers)}`);
  if (pensionsAutres > 0) composition.push(`pensions ${euro(pensionsAutres)}`);

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
      <li><strong>Composition</strong> — Revenus bruts annuels : ${euro(revenusBruts)} (${composition.join(", ") || "à compléter dans la collecte"}).</li>
      <li><strong>Assiette</strong> — Revenu net imposable : ${euro(revenuNetImposable)} pour ${ir.parts ? plur(ir.parts, "part fiscale", "parts fiscales") : "— part fiscale"}.</li>
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
    // % harmonisés à la précision de l'écran 10b : TMI en ENTIER (Math.round côté écran) ;
    // taux moyen à 1 décimale (pct(...,1) côté écran).
    trancheMarginale: pct(Number(ir.marginalRate) || 0, 0),
    // Lot C2 révisé : valeur principale tuile « TRANCHE MARG. » = tranche affichée (réf sous
    // plafonnement, statutaire sinon). Normal ⇒ = trancheMarginale (byte-identique).
    tmiAffichee: pct(tmiView.tmiAffichee, 0),
    tauxMoyen: pct(Number(ir.averageRate) || 0, 1),
    quotient: ir.parts ? plur(ir.parts, "part") : "—",
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
    // Lot C2 : sous-label tuile « TRANCHE MARG. » en cas de divergence (renvoi implicite à l'encart).
    trancheMargSousLabel: tmiView.sousTexteCard,
    // Graphe barème "QF plafonné" (foyer commun) : fill + quotient du calcul de référence.
    plafonnementQfActif,
    bracketFillBaseParts: Array.isArray(ir.bracketFillBaseParts) ? ir.bracketFillBaseParts : undefined,
    quotientBaseParts: ir.quotientBaseParts !== undefined ? num(ir.quotientBaseParts) : undefined,
    qfEcretement,
    baseParts,
    reconBaremeLignes,
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

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
