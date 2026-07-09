// LOT 10b — couche de présentation IR (ZÉRO moteur, ZÉRO recalcul). Décompose le
// total-roi « Impôt total du foyer » (ir.finalIR) en lignes qui, PAR CONSTRUCTION,
// somment au total : le barème net est défini comme le RÉSIDU de l'identité moteur
//
//   finalIR = baremeNet + totalPFU + foncierSocialLevy + avRachatImpot
//             + perRentesPS + meubleSocialLevy            (ir.ts:1076)
//
// -> Σ lignes === finalIR en foyer commun ET en concubinage (ir.ts expose les
// composantes déjà COMBINÉES dans les deux modes). Réconciliation testée à l'euro.
import { n } from "../calculs/utils";

// Vue partielle de la sortie moteur consommée ici — jamais recalculée.
export type IrLike = {
  finalIR?: number;
  totalPFU?: number;
  foncierSocialLevy?: number;
  meubleSocialLevy?: number;
  avRachatImpot?: number;
  perRentesPS?: number;
};

export type IrRoiLine = {
  key: string;
  label: string;
  value: number;        // contribution (positive) au total
  detail?: string;      // sous-libellé discret (taux, périmètre)
  tooltip?: string;     // aide pédagogique migrée des anciens KPI-vitrine
};

export type IrRoi = {
  total: number;        // ir.finalIR (all-inclusive)
  lines: IrRoiLine[];   // invariant : Σ lines.value === total (à l'arrondi près)
};

const EPS = 0.005; // demi-centime : sous ce seuil, une ligne n'est pas matérialisée.

export function buildIrRoiCard(ir: IrLike): IrRoi {
  const total = n(ir.finalIR);
  const pfu = n(ir.totalPFU);
  const foncierPS = n(ir.foncierSocialLevy);
  const meublePS = n(ir.meubleSocialLevy);
  const avRachat = n(ir.avRachatImpot);
  const perPS = n(ir.perRentesPS);
  // Barème progressif net des réductions = résidu de l'identité finalIR (ci-dessus).
  // Défini ainsi, il absorbe tout, garantissant Σ lignes === finalIR.
  const baremeNet = total - pfu - foncierPS - meublePS - avRachat - perPS;

  const lines: IrRoiLine[] = [];
  if (Math.abs(baremeNet) >= EPS) {
    lines.push({
      key: "bareme",
      label: "Barème progressif",
      value: baremeNet,
      tooltip: "IR calculé par tranches sur le quotient familial, net des réductions d'impôt. Le détail additif figure dans « Décomposition du calcul ».",
    });
  }
  if (pfu >= EPS) {
    lines.push({
      key: "pfu",
      label: "PFU",
      value: pfu,
      detail: "12,8 % IR + 18,6 % PS",
      tooltip: "Prélèvement Forfaitaire Unique de 31,4 % depuis 2026 (12,8 % IR + 18,6 % PS) sur les revenus de capitaux mobiliers et les plus-values.",
    });
  }
  const psTotal = foncierPS + meublePS;
  if (psTotal >= EPS) {
    const parts: string[] = [];
    if (foncierPS >= EPS) parts.push("foncier 17,2 %");
    if (meublePS >= EPS) parts.push("meublé 18,6 %");
    lines.push({
      key: "ps",
      label: "Prélèvements sociaux",
      value: psTotal,
      detail: parts.join(" · "),
      tooltip: "Prélèvements sociaux sur les revenus du patrimoine : foncier nu 17,2 %, location meublée (BIC) 18,6 % (LFSS 2026).",
    });
  }
  if (avRachat >= EPS) {
    lines.push({
      key: "av",
      label: "Rachat assurance-vie",
      value: avRachat,
      tooltip: "Fiscalité des rachats d'assurance-vie de l'année (prélèvement forfaitaire ou barème, prélèvements sociaux inclus).",
    });
  }
  if (perPS >= EPS) {
    lines.push({
      key: "perPS",
      label: "Prél. sociaux rentes PER",
      value: perPS,
      detail: "18,6 %",
      tooltip: "Prélèvements sociaux 18,6 % sur la fraction imposable des rentes PER servies.",
    });
  }
  return { total, lines };
}
