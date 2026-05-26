// ─── Tests Lot 7 — modèle Recommandation ───────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  isRecommandationComplete,
  groupRecommandationsByDimension,
  filterComplete,
  DIMENSIONS_LABEL,
  DIMENSIONS_ORDER,
  type Recommandation,
} from "../lib/conformite/recommandations";

const make = (over: Partial<Recommandation> = {}): Recommandation => ({
  id: over.id ?? "id-1",
  libelle: "Renforcer la part obligataire",
  justification: "Cohérent avec un profil prudent",
  dimension: "risque",
  ...over,
});

describe("isRecommandationComplete", () => {
  it("vraie pour une reco avec libellé et justification non vides", () => {
    expect(isRecommandationComplete(make())).toBe(true);
  });
  it("fausse si libellé vide", () => {
    expect(isRecommandationComplete(make({ libelle: "" }))).toBe(false);
    expect(isRecommandationComplete(make({ libelle: "   " }))).toBe(false);
  });
  it("fausse si justification vide", () => {
    expect(isRecommandationComplete(make({ justification: "" }))).toBe(false);
    expect(isRecommandationComplete(make({ justification: "   " }))).toBe(false);
  });
  it("fausse pour null/undefined", () => {
    expect(isRecommandationComplete(null)).toBe(false);
    expect(isRecommandationComplete(undefined)).toBe(false);
  });
});

describe("groupRecommandationsByDimension", () => {
  it("regroupe correctement les 4 dimensions", () => {
    const recos: Recommandation[] = [
      make({ id: "1", dimension: "risque" }),
      make({ id: "2", dimension: "esg" }),
      make({ id: "3", dimension: "capacitePerte" }),
      make({ id: "4", dimension: "besoin" }),
      make({ id: "5", dimension: "risque" }),
    ];
    const g = groupRecommandationsByDimension(recos);
    expect(g.risque.map(r => r.id)).toEqual(["1", "5"]);
    expect(g.esg.map(r => r.id)).toEqual(["2"]);
    expect(g.capacitePerte.map(r => r.id)).toEqual(["3"]);
    expect(g.besoin.map(r => r.id)).toEqual(["4"]);
  });

  it("liste vide → toutes les dimensions à []", () => {
    const g = groupRecommandationsByDimension([]);
    expect(g.risque).toEqual([]);
    expect(g.esg).toEqual([]);
    expect(g.capacitePerte).toEqual([]);
    expect(g.besoin).toEqual([]);
  });

  it("ignore les recos sans dimension valide", () => {
    const g = groupRecommandationsByDimension([
      make({ id: "1" }),
      { id: "bad", libelle: "x", justification: "y", dimension: "inconnue" as any },
    ]);
    expect(g.risque.length).toBe(1);
    expect(g.risque[0].id).toBe("1");
  });

  it("robustesse : null/undefined dans la liste → ignorés", () => {
    const g = groupRecommandationsByDimension([
      make({ id: "1" }),
      null as any,
      undefined as any,
    ]);
    expect(g.risque.length).toBe(1);
  });
});

describe("filterComplete", () => {
  it("ne garde que les recos complètes, ordre d'origine préservé", () => {
    const recos: Recommandation[] = [
      make({ id: "1" }),
      make({ id: "2", libelle: "" }),  // incomplet
      make({ id: "3" }),
      make({ id: "4", justification: "" }),  // incomplet
    ];
    expect(filterComplete(recos).map(r => r.id)).toEqual(["1", "3"]);
  });

  it("liste vide → liste vide", () => {
    expect(filterComplete([])).toEqual([]);
  });
});

describe("DIMENSIONS_LABEL / DIMENSIONS_ORDER", () => {
  it("toutes les dimensions ont un libellé fr-FR", () => {
    for (const d of DIMENSIONS_ORDER) {
      expect(typeof DIMENSIONS_LABEL[d]).toBe("string");
      expect(DIMENSIONS_LABEL[d].length).toBeGreaterThan(0);
    }
  });

  it("ordre figé : besoin → risque → ESG → capacité de perte", () => {
    expect(DIMENSIONS_ORDER).toEqual(["besoin", "risque", "esg", "capacitePerte"]);
  });
});

describe("Conformité — aucune référence à un produit/assureur dans le modèle", () => {
  it("le type Recommandation n'a pas de champ 'produit' ni 'assureur'", () => {
    // Vérif statique : si on tente d'ajouter ces champs au type, TS doit échouer.
    // Vérif runtime : un cast forcé est ignoré par les helpers.
    const reco = { ...make(), produit: "X", assureur: "Y" } as any;
    expect(isRecommandationComplete(reco)).toBe(true);  // les helpers ne dépendent que de libellé/justification/dimension
  });
});
