// LOT 10b — couche de présentation IFI (ZÉRO moteur, ZÉRO recalcul). Décompose le
// total-roi « IFI dû » (ifi.ifi) selon l'identité moteur (ifi.ts:74) :
//
//   ifi = netTaxable > 1,3 M€ ? max(0, grossIfi − decote) : 0
//
// Au-dessus du seuil, Σ lignes (IFI barème − décote) === ifi. Sous le seuil, aucune
// ligne (Σ = 0 = ifi) et un motif remplace la décomposition. Réconciliation testée.
import { n } from "../calculs/utils";

export type IfiLike = {
  netTaxable?: number;
  grossIfi?: number;
  decote?: number;
  ifi?: number;
};

export type IfiRoiLine = {
  key: string;
  label: string;
  value: number;        // signé : négatif pour la décote
  detail?: string;
  tooltip?: string;
  negative?: boolean;
};

export type IfiRoi = {
  total: number;          // ifi.ifi (net dû)
  lines: IfiRoiLine[];    // invariant : Σ lines.value === total
  belowThreshold: boolean; // actif net taxable <= 1,3 M€ : IFI non exigible
};

const SEUIL_IFI = 1_300_000;
const EPS = 0.005;

export function buildIfiRoiCard(ifi: IfiLike): IfiRoi {
  const total = n(ifi.ifi);
  const gross = n(ifi.grossIfi);
  const decote = n(ifi.decote);
  const netTaxable = n(ifi.netTaxable);
  const belowThreshold = netTaxable <= SEUIL_IFI;

  const lines: IfiRoiLine[] = [];
  if (!belowThreshold && total > 0) {
    lines.push({
      key: "bareme",
      label: "IFI au barème",
      value: gross,
      tooltip: "IFI calculé par le barème progressif sur l'actif net taxable, avant décote.",
    });
    if (decote >= EPS) {
      lines.push({
        key: "decote",
        label: "Décote",
        value: -decote,
        negative: true,
        detail: "17 500 − 1,25 % × actif net",
        tooltip: "Décote appliquée si l'actif net taxable est compris entre 1,3 M€ et 1,4 M€ : 17 500 − 1,25 % × actif net.",
      });
    }
  }
  return { total, lines, belowThreshold };
}
