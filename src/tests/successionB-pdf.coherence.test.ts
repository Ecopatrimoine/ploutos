// LOT 3 — Cohérence Page B PDF (buildSuccessionBData).
//
// La fiscalité AV des héritiers ne doit PAS être soustraite deux fois : les droits
// CIVILS de la page = totalSuccessionRights (pas totalRights, qui inclut aussi les
// droits AV des héritiers), la fiscalité AV étant déjà retranchée via
// netAuxBeneficiaires (somme sur avLines).

import { describe, it, expect } from "vitest";
import { buildSuccessionBData } from "../lib/pdf/v2/adapters/buildSuccessionBData";

describe("buildSuccessionBData — cohérence totalNetTransmis (LOT 3)", () => {
  const data = { person1FirstName: "Pierre", person1LastName: "Martin", coupleStatus: "married" };
  const cabinet = { cabinetName: "Cabinet Test" };

  it("droits civils seuls : la fiscalité AV des héritiers n'est pas comptée deux fois", () => {
    const succession = {
      activeNet: 1_000_000,
      totalSuccessionRights: 100_000,   // droits civils
      totalRights: 120_000,             // civils + 20 000 de droits AV héritiers (le piège)
      avLines: [
        { beneficiary: "Enfant Martin", relation: "enfant", amount: 200_000, totalTax: 20_000 },
      ],
      results: [],
    };
    const d = buildSuccessionBData({ succession, data, cabinet });
    // net AV = 200 000 − 20 000 = 180 000
    expect(d.netAuxBeneficiaires).toBe(180_000);
    // total = (activeNet − droits CIVILS) + net AV
    expect(d.totalNetTransmis).toBe((1_000_000 - 100_000) + 180_000);         // 1 080 000
    // l'ancien calcul (totalRights) aurait sous-évalué de 20 000 (fiscalité AV ×2)
    expect(d.totalNetTransmis).not.toBe((1_000_000 - 120_000) + 180_000);     // ≠ 1 060 000
  });

  it("fallback legacy : sans totalSuccessionRights, retombe sur totalRights", () => {
    const succession = {
      activeNet: 500_000,
      totalRights: 40_000,   // données legacy : pas de totalSuccessionRights
      avLines: [],
      results: [],
    };
    const d = buildSuccessionBData({ succession, data, cabinet });
    expect(d.totalNetTransmis).toBe(500_000 - 40_000);   // 460 000 (net AV = 0)
  });
});
