// LOT 10b (addendum 2) — couche de présentation IFI (ZÉRO moteur, ZÉRO recalcul).
// Décompose le total-roi « IFI dû » (ifi.ifi) selon l'identité moteur (ifi.ts:74) :
//
//   ifi = netTaxable > 1,3 M€ ? max(0, grossIfi − decote) : 0
//
// Trois cas :
//   • non-assujetti (actif ≤ 1,3 M€) : total 0, aucune ligne (Σ = 0).
//   • bande de décote (1,3–1,4 M€) : « IFI au barème » + « Décote » en négatif.
//   • au-delà de 1,4 M€ : « IFI au barème » + « Décote » grisée « non applicable » (0).
// La ligne grisée vaut 0 -> n'affecte pas la somme. Réconciliation testée à l'euro.
// Fournit aussi la tranche marginale (barème) et le taux moyen (présentation simple).
import { n } from "../calculs/utils";

export type IfiLike = {
  netTaxable?: number;
  grossIfi?: number;
  decote?: number;
  ifi?: number;
  bracketFill?: { to: number; rate: number }[];
};

export type IfiRoiLine = {
  key: string;
  label: string;
  value: number;        // signé : négatif pour la décote appliquée ; 0 pour un placeholder
  detail?: string;
  tooltip?: string;
  negative?: boolean;   // décote appliquée : « − X »
  placeholder?: boolean; // décote non applicable : ligne grisée, « — »
};

export type IfiRoi = {
  total: number;          // ifi.ifi (net dû)
  lines: IfiRoiLine[];    // invariant : Σ lines.value === total
  belowThreshold: boolean; // actif net taxable ≤ 1,3 M€ : IFI non exigible
  marginalRate: number;   // taux de la tranche IFI active (barème)
  tauxMoyen: number;      // IFI dû / actif net taxable (0 si base nulle)
};

const SEUIL_IFI = 1_300_000;
const PLAFOND_DECOTE = 1_400_000;
const EPS = 0.005;

export function buildIfiRoiCard(ifi: IfiLike): IfiRoi {
  const total = n(ifi.ifi);
  const gross = n(ifi.grossIfi);
  const decote = n(ifi.decote);
  const netTaxable = n(ifi.netTaxable);
  const belowThreshold = netTaxable <= SEUIL_IFI;
  const tauxMoyen = netTaxable > 0 ? total / netTaxable : 0;
  const marginalRate = (() => {
    const bf = ifi.bracketFill || [];
    const cur = bf.find((s) => netTaxable <= s.to) || bf[bf.length - 1];
    return cur ? n(cur.rate) : 0;
  })();

  const lines: IfiRoiLine[] = [];
  if (!belowThreshold) {
    lines.push({
      key: "bareme",
      label: "IFI au barème",
      value: gross,
      tooltip: "IFI calculé par le barème progressif sur l'actif net taxable, avant décote.",
    });
    if (netTaxable < PLAFOND_DECOTE && decote >= EPS) {
      lines.push({
        key: "decote",
        label: "Décote",
        value: -decote,
        negative: true,
        detail: "17 500 − 1,25 % × actif net",
        tooltip: "Décote appliquée quand l'actif net taxable est compris entre 1,3 M€ et 1,4 M€ : 17 500 − 1,25 % × actif net.",
      });
    } else {
      lines.push({
        key: "decote",
        label: "Décote",
        value: 0,
        placeholder: true,
        detail: "non applicable (actif > 1,4 M€)",
        tooltip: "La décote ne s'applique qu'entre 1,3 M€ et 1,4 M€ d'actif net taxable.",
      });
    }
  }
  return { total, lines, belowThreshold, marginalRate, tauxMoyen };
}
