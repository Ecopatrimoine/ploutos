// ─── TMI effective — couche de vue PARTAGÉE (écran TabIR + PDF buildIRData) ───────
//
// SOURCE UNIQUE de la restitution « taux marginal réel » : classification du cas,
// encart pédagogique (mini-calcul) et réconciliation du barème. Fonction PURE, sans
// dépendance React/DOM ni recalcul fiscal — ne lit QUE les champs déjà exposés par
// computeIR (Lot A). Le PDF compose l'encart en HTML (byte-identique à l'existant) ;
// l'écran rend les mêmes pièces en JSX. Aucun barème en dur (frontière via bracketFill).

export type TmiCase = "normal" | "decote" | "plafonnement" | "cumul" | "frontiere" | "forfaitaire";

// Encart structuré (renderer-agnostic) : `leadFort` = fragment mis en gras en tête
// (le taux réel), `corps` = suite du texte. Le PDF rend `<strong>leadFort</strong> corps`.
export type TmiEncart = { titre: string; leadFort?: string; corps: string };

export type TmiView = { tmiCase: TmiCase; encart?: TmiEncart; reconBaremeLignes: string[] };

const formatEuro = (n: number): string =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
const euro2 = (v: number): string =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
const pct2 = (r: number): string => (r * 100).toFixed(2).replace(".", ",") + " %";

// `ir` = sortie de computeIR (foyer commun ou concubin actif) ; `isCouple` = marié/pacsé.
export function computeTmiView(ir: any, isCouple: boolean): TmiView {
  const mrEff = Number(ir?.marginalRateEffectif) || 0;
  const mr = Number(ir?.marginalRate) || 0;
  const tranchePctInt = Math.round(mr * 100);
  const effPctInt = Math.round(mrEff * 100);
  const impotNetDu = Math.round(Number(ir?.finalIR) || 0);
  const decoteMontant = Number(ir?.decoteMontant) || 0;
  const plafonnementQfActif = !!ir?.plafonnementQfActif;
  const qfEcretement = Number(ir?.quotientFamilialCapAdjustment) || 0;
  const totalPFU = Number(ir?.totalPFU) || 0;
  const forfaitaires = totalPFU + (Number(ir?.avRachatImpot) || 0) + (Number(ir?.foncierSocialLevy) || 0) + (Number(ir?.perRentesPS) || 0) + (Number(ir?.meubleSocialLevy) || 0);
  const baremeNul = (Number(ir?.bareme) || 0) <= 0;
  const effDiffTranche = Math.abs(mrEff - mr) >= 0.0001;
  const baseParts = isCouple ? 2 : 1;
  // Frontière : distance au seuil + taux suivant lus dans ir.bracketFill (aucun barème en dur).
  const brf: any[] = Array.isArray(ir?.bracketFill) ? ir.bracketFill : [];
  const quotientVal = Number(ir?.quotient) || 0;
  const partsVal = Number(ir?.parts) || 1;
  const activeIdxBr = brf.findIndex((b) => quotientVal <= b.to);
  const activeBr = activeIdxBr >= 0 ? brf[activeIdxBr] : undefined;
  const nextBr = activeIdxBr >= 0 ? brf[activeIdxBr + 1] : undefined;
  const distSeuilFoyer = activeBr && Number.isFinite(activeBr.to) ? Math.max(0, (Number(activeBr.to) - quotientVal) * partsVal) : Infinity;

  // Classification (priorité : forfaitaire > cumul > plafonnement > décote > frontière > normal).
  let tmiCase: TmiCase;
  if (impotNetDu <= 0) tmiCase = "normal";
  else if (baremeNul && forfaitaires > 0) tmiCase = "forfaitaire";
  else if (plafonnementQfActif && decoteMontant > 0) tmiCase = "cumul";
  else if (plafonnementQfActif) tmiCase = "plafonnement";
  else if (decoteMontant > 0) tmiCase = "decote";
  else if (effDiffTranche && !!nextBr) tmiCase = "frontiere";
  else tmiCase = "normal";

  // Encart « votre taux marginal réel » — ABSENT en normal/forfaitaire.
  let encart: TmiEncart | undefined;
  if (tmiCase === "decote") {
    const baremePart = mr * 100, totalPart = mrEff * 100, decotePart = totalPart - baremePart;
    encart = { titre: "Votre taux marginal réel", leadFort: pct2(mrEff), corps: `(et non ${tranchePctInt} %). Pour 100 € de revenu imposable en plus : +${euro2(baremePart)} de barème, +${euro2(decotePart)} de décote perdue (la décote s'éteint à mesure que le revenu monte) = ${euro2(totalPart)}.` };
  } else if (tmiCase === "plafonnement") {
    encart = { titre: "Votre taux marginal réel", leadFort: `${effPctInt} %`, corps: `(et non ${tranchePctInt} %). Votre avantage de quotient familial est plafonné (écrêtement ${formatEuro(qfEcretement)}) : chaque euro supplémentaire est imposé comme pour un foyer de ${baseParts} parts, dans la tranche à ${effPctInt} %.` };
  } else if (tmiCase === "cumul") {
    encart = { titre: "Votre taux marginal réel", leadFort: pct2(mrEff), corps: `(et non ${tranchePctInt} %). Votre avantage de quotient familial est plafonné (écrêtement ${formatEuro(qfEcretement)}) : chaque euro est imposé comme pour un foyer de ${baseParts} parts ; s'y ajoute la décote (${formatEuro(decoteMontant)}) qui s'éteint à mesure que le revenu monte et renchérit encore l'euro marginal.` };
  } else if (tmiCase === "frontiere") {
    encart = { titre: "Vous approchez d'une tranche", corps: `Vous êtes à ${formatEuro(distSeuilFoyer)} de revenu imposable du passage dans la tranche à ${Math.round((Number(nextBr?.rate) || 0) * 100)} %.` };
  }

  // Réconciliation barème : somme des tranches -> impôt barème net. En variante plafonnement,
  // part de la somme réf-2-parts × baseParts MOINS le plafond fixe (cohérent avec les barres).
  const baremeVal = Number(ir?.bareme) || 0;
  const reconBaremeLignes: string[] = [];
  if (plafonnementQfActif && Array.isArray(ir?.bracketFillBaseParts)) {
    const sommeRef = (ir.bracketFillBaseParts as any[]).reduce((s, b) => s + (Number(b.tax) || 0), 0);
    reconBaremeLignes.push(`Somme des tranches (référence ${baseParts} parts) ${formatEuro(sommeRef)} × ${baseParts} = ${formatEuro(sommeRef * baseParts)}`);
    reconBaremeLignes.push(`− plafonnement du quotient familial ${formatEuro(Number(ir?.qfCap) || 0)}`);
    if (decoteMontant > 0) reconBaremeLignes.push(`− décote ${formatEuro(decoteMontant)}`);
    reconBaremeLignes.push(`= impôt barème net ${formatEuro(baremeVal)}`);
  } else if (decoteMontant > 0 || qfEcretement > 0) {
    const sommePart = brf.reduce((s, b) => s + (Number(b.tax) || 0), 0);
    reconBaremeLignes.push(`Somme des tranches ${formatEuro(sommePart)} × ${partsVal} part${partsVal > 1 ? "s" : ""} = ${formatEuro(sommePart * partsVal)}`);
    if (decoteMontant > 0) reconBaremeLignes.push(`− décote ${formatEuro(decoteMontant)}`);
    if (qfEcretement > 0) reconBaremeLignes.push(`+ avantage QF écrêté repris ${formatEuro(qfEcretement)}`);
    reconBaremeLignes.push(`= impôt barème net ${formatEuro(baremeVal)}`);
  } else {
    reconBaremeLignes.push(`= impôt barème net ${formatEuro(baremeVal)} (aucune décote ni plafonnement)`);
  }

  return { tmiCase, encart, reconBaremeLignes };
}
