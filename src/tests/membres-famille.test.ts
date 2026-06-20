// ─── Tests helper pur membresFamille (Lot P1) ───────────────────────────────
//
// C'est du FISCAL déguisé : `relation` pilote la fiscalité 990 I (computeAvTax /
// getSuccessionTaxProfile). On vérifie donc le mapping famille -> relation de
// façon exhaustive, notamment le cas beau-fils (enfant_conjoint) dans les 2 sens.

import { describe, it, expect } from "vitest";
import { membresFamille } from "../lib/prevoyance/membres-famille";
import type { Child, PatrimonialData } from "../types/patrimoine";

// Dossier minimal : seuls les champs lus par le helper, le reste casté.
function makeData(over: Partial<PatrimonialData>): PatrimonialData {
  return {
    coupleStatus: "single",
    person1FirstName: "",
    person1LastName: "",
    person2FirstName: "",
    person2LastName: "",
    childrenData: [],
    ...over,
  } as unknown as PatrimonialData;
}

function child(over: Partial<Child>): Child {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    parentLink: "common_child",
    custody: "full",
    rattached: true,
    handicap: false,
    ...over,
  } as Child;
}

// Vocabulaire RELATIONS de BlocTransmissionDeces.tsx (garde-fou).
const RELATIONS = new Set([
  "conjoint", "pacs_partner", "enfant", "petit-enfant", "parent",
  "frereSoeur", "neveuNiece", "enfant_conjoint", "autre",
]);

describe("membresFamille — conjoint (relation selon coupleStatus)", () => {
  const base = { person2FirstName: "Marie", person2LastName: "Martin" };

  it("marié -> conjoint ; PACS -> pacs_partner ; concubin -> autre", () => {
    expect(
      membresFamille(makeData({ coupleStatus: "married", ...base }), 1).find((m) => m.source === "conjoint")?.relation
    ).toBe("conjoint");
    expect(
      membresFamille(makeData({ coupleStatus: "pacs", ...base }), 1).find((m) => m.source === "conjoint")?.relation
    ).toBe("pacs_partner");
    expect(
      membresFamille(makeData({ coupleStatus: "cohab", ...base }), 1).find((m) => m.source === "conjoint")?.relation
    ).toBe("autre");
  });

  it("single / divorced / widowed -> aucun conjoint", () => {
    for (const st of ["single", "divorced", "widowed"]) {
      const membres = membresFamille(makeData({ coupleStatus: st, ...base }), 1);
      expect(membres.some((m) => m.source === "conjoint")).toBe(false);
    }
  });
});

describe("membresFamille — symétrie défunt 1 <-> 2", () => {
  it("le conjoint est l'AUTRE personne, avec SON nom", () => {
    const d = makeData({
      coupleStatus: "married",
      person1FirstName: "Pierre", person1LastName: "Martin",
      person2FirstName: "Marie", person2LastName: "Martin",
    });
    // défunt = 1 -> conjoint = person2
    expect(membresFamille(d, 1).find((m) => m.source === "conjoint")).toEqual({
      name: "Marie Martin", relation: "conjoint", source: "conjoint",
    });
    // défunt = 2 -> conjoint = person1
    expect(membresFamille(d, 2).find((m) => m.source === "conjoint")).toEqual({
      name: "Pierre Martin", relation: "conjoint", source: "conjoint",
    });
  });
});

describe("membresFamille — enfants (parentLink x défunt)", () => {
  it("enfant commun -> 'enfant' quel que soit le défunt", () => {
    const d = makeData({
      coupleStatus: "married",
      childrenData: [child({ firstName: "Léa", lastName: "Martin", parentLink: "common_child" })],
    });
    expect(membresFamille(d, 1).find((m) => m.source === "enfant")?.relation).toBe("enfant");
    expect(membresFamille(d, 2).find((m) => m.source === "enfant")?.relation).toBe("enfant");
  });

  it("BEAU-FILS dans les 2 sens (test clé) + sens propre", () => {
    const p1only = makeData({ childrenData: [child({ parentLink: "person1_only" })] });
    expect(membresFamille(p1only, 1).find((m) => m.source === "enfant")?.relation).toBe("enfant");
    expect(membresFamille(p1only, 2).find((m) => m.source === "enfant")?.relation).toBe("enfant_conjoint");

    const p2only = makeData({ childrenData: [child({ parentLink: "person2_only" })] });
    expect(membresFamille(p2only, 2).find((m) => m.source === "enfant")?.relation).toBe("enfant");
    expect(membresFamille(p2only, 1).find((m) => m.source === "enfant")?.relation).toBe("enfant_conjoint");
  });

  it("parentLink vide/inconnu -> 'enfant' (défaut documenté révisable)", () => {
    expect(
      membresFamille(makeData({ childrenData: [child({ parentLink: "" })] }), 1).find((m) => m.source === "enfant")?.relation
    ).toBe("enfant");
    expect(
      membresFamille(makeData({ childrenData: [child({ parentLink: "valeur_inconnue" })] }), 2).find((m) => m.source === "enfant")?.relation
    ).toBe("enfant");
  });
});

describe("membresFamille — name fallback & dégradation", () => {
  it("name fallback 'Enfant' si prénom/nom vides", () => {
    const d = makeData({ childrenData: [child({ firstName: "", lastName: "", parentLink: "common_child" })] });
    expect(membresFamille(d, 1).find((m) => m.source === "enfant")?.name).toBe("Enfant");
  });

  it("name fallback 'Conjoint' si couple déclaré mais nom vide", () => {
    const d = makeData({ coupleStatus: "married", person2FirstName: "", person2LastName: "" });
    expect(membresFamille(d, 1).find((m) => m.source === "conjoint")?.name).toBe("Conjoint");
  });

  it("single -> pas de conjoint ; pas d'enfants -> aucun enfant ; les deux -> []", () => {
    expect(membresFamille(makeData({ coupleStatus: "single" }), 1).some((m) => m.source === "conjoint")).toBe(false);
    expect(
      membresFamille(makeData({ coupleStatus: "married", person2FirstName: "Marie", childrenData: [] }), 1)
        .some((m) => m.source === "enfant")
    ).toBe(false);
    expect(membresFamille(makeData({ coupleStatus: "single", childrenData: [] }), 1)).toEqual([]);
  });
});

describe("membresFamille — garde-fou vocabulaire RELATIONS", () => {
  it("chaque relation produite appartient au vocabulaire RELATIONS", () => {
    const d = makeData({
      coupleStatus: "cohab",
      person1FirstName: "Pierre", person2FirstName: "Marie",
      childrenData: [
        child({ parentLink: "common_child" }),
        child({ parentLink: "person1_only" }),
        child({ parentLink: "person2_only" }),
        child({ parentLink: "" }),
      ],
    });
    for (const w of [1, 2] as const) {
      const membres = membresFamille(d, w);
      expect(membres.length).toBeGreaterThan(0);
      for (const m of membres) {
        expect(RELATIONS.has(m.relation)).toBe(true);
      }
    }
  });
});
