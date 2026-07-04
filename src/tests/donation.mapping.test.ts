// Lot C — mapping vocabulaire membresFamille -> relation DONATION + childId expose.
import { describe, it, expect } from "vitest";
import { mapMembreToDonationRelation } from "../lib/calculs/donation";
import { membresFamille } from "../lib/prevoyance/membres-famille";

describe("mapMembreToDonationRelation", () => {
  it("enfant -> enfant", () => expect(mapMembreToDonationRelation("enfant")).toBe("enfant"));
  it("conjoint -> conjoint", () => expect(mapMembreToDonationRelation("conjoint")).toBe("conjoint"));
  it("pacs_partner -> conjoint", () => expect(mapMembreToDonationRelation("pacs_partner")).toBe("conjoint"));
  it("enfant_conjoint -> tiers", () => expect(mapMembreToDonationRelation("enfant_conjoint")).toBe("tiers"));
  it("autre -> tiers", () => expect(mapMembreToDonationRelation("autre")).toBe("tiers"));
  it("inconnu -> tiers", () => expect(mapMembreToDonationRelation("xyz")).toBe("tiers"));
});

describe("membresFamille — expose childId pour les enfants (picker donation)", () => {
  const data = {
    coupleStatus: "married",
    person1FirstName: "Pierre", person1LastName: "Martin",
    person2FirstName: "Marie", person2LastName: "Martin",
    childrenData: [
      { id: "cA", firstName: "Alice", lastName: "Martin", parentLink: "common_child" },
      { id: "cB", firstName: "Bob", lastName: "Martin", parentLink: "person2_only" },
    ],
  } as any;

  it("enfants portent childId ; conjoint sans childId", () => {
    const membres = membresFamille(data, 1);
    const conjoint = membres.find((m) => m.source === "conjoint");
    const alice = membres.find((m) => m.name.startsWith("Alice"));
    expect(conjoint?.childId).toBeUndefined();
    expect(alice?.childId).toBe("cA");
  });

  it("relation fiscale croisee conservee (person2_only vu du defunt 1 = enfant_conjoint)", () => {
    const bob = membresFamille(data, 1).find((m) => m.name.startsWith("Bob"));
    expect(bob?.relation).toBe("enfant_conjoint");
    // mappe en tiers pour la donation
    expect(mapMembreToDonationRelation(bob!.relation)).toBe("tiers");
  });
});
