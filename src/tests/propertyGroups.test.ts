import { describe, it, expect } from "vitest";
import { PROPERTY_GROUPS, PROPERTY_TYPES, PROPERTY_GROUP_COLORS } from "../constants";

// Garde-fou D2 : le groupement d'affichage doit couvrir EXACTEMENT les 11 natures
// de PROPERTY_TYPES, sans oubli ni doublon (les valeurs internes restent la source).
describe("PROPERTY_GROUPS — exhaustivité vs PROPERTY_TYPES", () => {
  it("l'union des groupes == PROPERTY_TYPES (même cardinalité, aucun oubli, aucun doublon)", () => {
    const flat = PROPERTY_GROUPS.flatMap((g) => [...g.types]);
    expect(flat).toHaveLength(PROPERTY_TYPES.length);          // même cardinalité (11)
    expect(new Set(flat).size).toBe(flat.length);              // aucun doublon
    expect([...flat].sort()).toEqual([...PROPERTY_TYPES].sort()); // même ensemble
  });

  it("chaque groupe a une couleur définie (solid + fill en hex)", () => {
    for (const g of PROPERTY_GROUPS) {
      const c = PROPERTY_GROUP_COLORS[g.value];
      expect(c).toBeTruthy();
      expect(c.solid).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
