import { describe, it, expect } from "vitest";
import { computeIrBracketFill, computeBaremeNet } from "../lib/calculs/utils";

// Test de COHÉRENCE CROISÉE (Lot 5b R2, exception moteur additive) :
// le détail par tranche de computeIrBracketFill doit reconstituer EXACTEMENT le
// barème de référence de computeBaremeNet (avant décote / plafonnement), sinon
// la fonction additive a divergé du barème -> on ne livre pas.

describe("computeIrBracketFill — cohérence croisée avec computeBaremeNet", () => {
  // Grille couvrant chaque tranche + les seuils EXACTS + valeurs de part et d'autre.
  const quotients = [
    0, 5000, 11599, 11600, 11601, 20000, 29578, 29579, 29580, 50000,
    84576, 84577, 84578, 120000, 181916, 181917, 181918, 250000, 500000, 1000000,
  ];

  it("somme des impôts par tranche === barème de référence (avant décote/plafonnement)", () => {
    for (const q of quotients) {
      const sommeTranches = computeIrBracketFill(q).reduce((s, b) => s + b.tax, 0);
      // Référence : parts = baseParts = 1 -> aucune demi-part -> ecretement 0,
      // donc baremeBeforeDecote = impôt barème brut sur le quotient.
      const ref = computeBaremeNet({ revenuImposable: q, parts: 1, baseParts: 1, isCouple: false, parentIsole: false });
      expect(sommeTranches).toBeCloseTo(ref.baremeBeforeDecote, 6);
    }
  });

  it("le revenu logé (filled) totalise le quotient", () => {
    for (const q of quotients) {
      const sommeFilled = computeIrBracketFill(q).reduce((s, b) => s + b.filled, 0);
      expect(sommeFilled).toBeCloseTo(q, 6);
    }
  });

  it("les bornes et taux correspondent au barème IR 2025", () => {
    const fill = computeIrBracketFill(300000);
    expect(fill.map((b) => b.rate)).toEqual([0, 0.11, 0.3, 0.41, 0.45]);
    expect(fill.map((b) => b.from)).toEqual([0, 11600, 29579, 84577, 181917]);
  });
});
