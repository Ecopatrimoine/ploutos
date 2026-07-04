// Lot E1 — corrections du picker : childId distinct (bug puces) + relation par
// DONATEUR (bug 3). L'integration childId -> droits est couverte par
// succession.rappel.test.ts / succession.c0-activation.test.ts.
import { describe, it, expect } from "vitest";
import { membresFamille } from "../lib/prevoyance/membres-famille";
import { mapMembreToDonationRelation } from "../lib/calculs/donation";

const mk = (childIds: boolean) => ({
  coupleStatus: "married",
  person1FirstName: "Pierre", person1LastName: "M", person2FirstName: "Marie", person2LastName: "M",
  childrenData: [
    { ...(childIds ? { id: "cA" } : {}), firstName: "Alice", lastName: "M", parentLink: "common_child" },
    { ...(childIds ? { id: "cB" } : {}), firstName: "Bob", lastName: "M", parentLink: "person2_only" },
  ],
} as any);

describe("E1 — bug puces : childId distinct par enfant", () => {
  it("enfants migres -> childId distincts (puces distinguables)", () => {
    const m = membresFamille(mk(true), 1).filter((x) => x.source === "enfant");
    const ids = m.map((x) => x.childId);
    expect(ids).toEqual(["cA", "cB"]);
    expect(new Set(ids).size).toBe(2);
  });
  it("enfants SANS id -> childId undefined (scenario du bug ; garde !!m.childId requise)", () => {
    const m = membresFamille(mk(false), 1).filter((x) => x.source === "enfant");
    expect(m.every((x) => x.childId === undefined)).toBe(true);
  });
});

describe("E1 — bug 3 : relation deduite vis-a-vis du DONATEUR", () => {
  it("enfant person2_only donne par P1 -> tiers ; par P2 -> enfant", () => {
    const bobP1 = membresFamille(mk(true), 1).find((x) => x.name.startsWith("Bob"));
    const bobP2 = membresFamille(mk(true), 2).find((x) => x.name.startsWith("Bob"));
    expect(mapMembreToDonationRelation(bobP1!.relation)).toBe("tiers");
    expect(mapMembreToDonationRelation(bobP2!.relation)).toBe("enfant");
  });
  it("enfant commun -> enfant quel que soit le donateur", () => {
    const aP1 = membresFamille(mk(true), 1).find((x) => x.name.startsWith("Alice"));
    const aP2 = membresFamille(mk(true), 2).find((x) => x.name.startsWith("Alice"));
    expect(mapMembreToDonationRelation(aP1!.relation)).toBe("enfant");
    expect(mapMembreToDonationRelation(aP2!.relation)).toBe("enfant");
  });
});
