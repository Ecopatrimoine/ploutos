// ─── LOT A (CAVAMAC, étape 1/4) — Helper pur tauxAppliquePlafonne ───────
//
// Tests unitaires PURS du helper « montant = taux × min(assiette, plafond) »
// avec plancher optionnel. Aucun référentiel, aucune projection : on valide
// uniquement l'arithmétique et les gardes (plafond null, plancher conditionné
// à assiette > 0, assiette nulle/absente). Refactor à comportement constant :
// ce fichier ne touche aucun cas d'or existant, il ne fait qu'ajouter au total.

import { describe, it, expect } from "vitest";
import { tauxAppliquePlafonne } from "../lib/prevoyance/projection";

describe("tauxAppliquePlafonne — helper pur", () => {
  it("applique le taux sous le plafond (assiette non plafonnée)", () => {
    // 300 000 < 625 777 → 300 000 × 0,25 = 75 000
    expect(tauxAppliquePlafonne(300000, 0.25, 625777)).toBe(75000);
  });

  it("plafonne l'assiette avant d'appliquer le taux", () => {
    // 700 000 > 625 777 → 625 777 × 0,25 = 156 444,25
    expect(tauxAppliquePlafonne(700000, 0.25, 625777)).toBeCloseTo(156444.25, 6);
  });

  it("sans plafond (null), applique le taux à l'assiette brute", () => {
    // 50 000 × 0,25 = 12 500
    expect(tauxAppliquePlafonne(50000, 0.25, null)).toBe(12500);
  });

  it("relève au plancher quand le montant calculé est en dessous", () => {
    // 40 000 × 0,25 = 10 000 < plancher 24 738 → relevé à 24 738
    expect(tauxAppliquePlafonne(40000, 0.25, null, 24738)).toBe(24738);
  });

  it("n'applique PAS le plancher quand l'assiette est nulle", () => {
    // assiette 0 → 0, le plancher ne doit pas faire apparaître un montant
    expect(tauxAppliquePlafonne(0, 0.25, null, 24738)).toBe(0);
  });

  it("retourne 0 pour une assiette null ou undefined", () => {
    expect(tauxAppliquePlafonne(null, 0.25, 625777)).toBe(0);
    expect(tauxAppliquePlafonne(undefined, 0.25, 625777)).toBe(0);
  });
});
