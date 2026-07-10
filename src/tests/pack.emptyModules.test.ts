// LOT 11 C1 — un module vide ne génère PLUS de page dans le pack (cohérence empty state
// écran). renderItemBody retourne "" ; renderPackItemBodies n'ajoute rien → 0 feuille.
import { describe, it, expect } from "vitest";
import { renderPackItemBodies } from "../lib/pdf/v2/popcard/concatPack";
import type { PackItem } from "../lib/pdf/v2/popcard/checkCompletude";

// Dossier MINIMAL, célibataire, sans hypothèses ni recommandations, sans module collectif.
const payload = {
  cabinet: { cabinetName: "Cabinet Test", orias: "25006907" },
  mission: {},
  data: {
    person1FirstName: "Alice", person1LastName: "Martin", coupleStatus: "single",
    travail: { p1: null, p2: null },
    childrenData: [], properties: [], placements: [],
  },
  ir: {}, ifi: {}, succession: {},
  hypothesisResults: [],   // aucun scénario
  recommandations: [],     // aucune recommandation
  clientName: "Alice Martin",
} as any;

const bodyOf = (item: PackItem) => renderPackItemBodies([item], {}, payload);

describe("C1 — modules vides exclus du pack (pas de feuille pour trois lignes)", () => {
  it("prévoyance perso P2 (pas de 2e personne) → 0 feuille", () => {
    expect(bodyOf("prevoyancePersoP2")).toEqual([]);
  });
  it("prévoyance collective (module inactif) → 0 feuille", () => {
    expect(bodyOf("prevoyanceColl")).toEqual([]);
  });
  it("hypothèses (aucun scénario) → 0 feuille", () => {
    expect(bodyOf("hypos")).toEqual([]);
  });
  it("recommandations (aucune reco complète) → 0 feuille", () => {
    expect(bodyOf("recommandations")).toEqual([]);
  });
  it("une section non vide (mentions) génère bien sa feuille", () => {
    expect(bodyOf("mentions").length).toBe(1);
  });
  it("pack mixte : seules les sections non vides sont poussées", () => {
    const bodies = renderPackItemBodies(
      ["prevoyancePersoP2", "prevoyanceColl", "hypos", "recommandations", "mentions"],
      {}, payload,
    );
    expect(bodies.length).toBe(1); // mentions seule
  });
});
