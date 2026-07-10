import { describe, it, expect } from "vitest";
import { isCoupleCollecte, hasPerson2Identity, person2Mode, person2Dormant } from "../lib/collecte/person2";

// LOT 10e ADDENDUM U3 — Personne 2 conditionnelle : les 3 cas demandes par David.
describe("collecte / person2 (affichage conditionnel)", () => {
  describe("isCoupleCollecte (foyer vie courante = 3 valeurs)", () => {
    it("married / pacs / cohab -> couple", () => {
      expect(isCoupleCollecte("married")).toBe(true);
      expect(isCoupleCollecte("pacs")).toBe(true);
      expect(isCoupleCollecte("cohab")).toBe(true);
    });
    it("single / divorced / widowed / vide -> pas couple", () => {
      expect(isCoupleCollecte("single")).toBe(false);
      expect(isCoupleCollecte("divorced")).toBe(false);
      expect(isCoupleCollecte("widowed")).toBe(false); // legacy hors dropdown
      expect(isCoupleCollecte("")).toBe(false);
      expect(isCoupleCollecte(undefined)).toBe(false);
    });
  });

  describe("hasPerson2Identity", () => {
    it("prenom OU nom (trim) -> vrai", () => {
      expect(hasPerson2Identity({ person2FirstName: "Erika" })).toBe(true);
      expect(hasPerson2Identity({ person2LastName: "Perry" })).toBe(true);
      expect(hasPerson2Identity({ person2FirstName: " ", person2LastName: "Perry" })).toBe(true);
    });
    it("vide / espaces / absent -> faux", () => {
      expect(hasPerson2Identity({})).toBe(false);
      expect(hasPerson2Identity({ person2FirstName: "", person2LastName: "" })).toBe(false);
      expect(hasPerson2Identity({ person2FirstName: "   " })).toBe(false);
      expect(hasPerson2Identity(null)).toBe(false);
    });
  });

  describe("person2Mode — les 3 cas", () => {
    it("CAS 1 — seul sans identite P2 -> 'none' (P1 pleine largeur)", () => {
      expect(person2Mode({ coupleStatus: "single" })).toBe("none");
      expect(person2Mode({ coupleStatus: "divorced" })).toBe("none");
      expect(person2Mode({ coupleStatus: "widowed" })).toBe("none");
    });
    it("CAS 2 — couple sans identite P2 -> 'invite' (CTA Donnees familiales)", () => {
      expect(person2Mode({ coupleStatus: "married" })).toBe("invite");
      expect(person2Mode({ coupleStatus: "pacs", person2FirstName: "" })).toBe("invite");
      expect(person2Mode({ coupleStatus: "cohab" })).toBe("invite");
    });
    it("CAS 3 — identite P2 renseignee -> 'card' (jamais masquee), meme repasse seul", () => {
      expect(person2Mode({ coupleStatus: "married", person2FirstName: "Erika" })).toBe("card");
      expect(person2Mode({ coupleStatus: "single", person2LastName: "Perry" })).toBe("card"); // donnees dormantes
      expect(person2Mode({ coupleStatus: "divorced", person2FirstName: "Erika" })).toBe("card");
    });
  });

  describe("person2Dormant (note discrete)", () => {
    it("identite P2 + situation non-couple -> dormant", () => {
      expect(person2Dormant({ coupleStatus: "single", person2FirstName: "Erika" })).toBe(true);
      expect(person2Dormant({ coupleStatus: "divorced", person2LastName: "Perry" })).toBe(true);
    });
    it("identite P2 + couple -> pas dormant", () => {
      expect(person2Dormant({ coupleStatus: "married", person2FirstName: "Erika" })).toBe(false);
    });
    it("pas d'identite -> pas dormant", () => {
      expect(person2Dormant({ coupleStatus: "single" })).toBe(false);
      expect(person2Dormant({ coupleStatus: "married" })).toBe(false);
    });
  });
});
