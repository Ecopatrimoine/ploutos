// Lot A2 — profil fiscal DONATION dedie (getDonationTaxProfile). Verifie les
// abattements donation 2026 et le fix du bug conjoint (succession 0 -> donation 80 724).
import { describe, it, expect } from "vitest";
import { getDonationTaxProfile } from "../lib/calculs/donation";

describe("getDonationTaxProfile — abattements donation 2026", () => {
  it("enfant = 100 000 (CGI 779 I)", () => {
    expect(getDonationTaxProfile("enfant").allowance).toBe(100000);
  });
  it("parent (ascendant) = 100 000", () => {
    expect(getDonationTaxProfile("parent").allowance).toBe(100000);
  });
  it("conjoint = 80 724 (FIX : succession exonere 0, donation 790 E)", () => {
    expect(getDonationTaxProfile("conjoint").allowance).toBe(80724);
  });
  it("pacs_partner = 80 724 (790 F)", () => {
    expect(getDonationTaxProfile("pacs_partner").allowance).toBe(80724);
  });
  it("petit-enfant = 31 865 (790 B)", () => {
    expect(getDonationTaxProfile("petit-enfant").allowance).toBe(31865);
  });
  it("arriere-petit-enfant = 5 310 (790 D)", () => {
    expect(getDonationTaxProfile("arriere-petit-enfant").allowance).toBe(5310);
  });
  it("frereSoeur = 15 932", () => {
    expect(getDonationTaxProfile("frereSoeur").allowance).toBe(15932);
  });
  it("neveuNiece = 7 967", () => {
    expect(getDonationTaxProfile("neveuNiece").allowance).toBe(7967);
  });
  it("tiers = 0 (aucun abattement de droit commun en donation)", () => {
    expect(getDonationTaxProfile("tiers").allowance).toBe(0);
    expect(getDonationTaxProfile("autre").allowance).toBe(0);
  });
  it("handicap +159 325 cumulable (enfant et conjoint)", () => {
    expect(getDonationTaxProfile("enfant", true).allowance).toBe(100000 + 159325);
    expect(getDonationTaxProfile("conjoint", true).allowance).toBe(80724 + 159325);
    expect(getDonationTaxProfile("tiers", true).allowance).toBe(159325);
  });
  it("bareme ligne directe reutilise (enfant = 7 tranches, conjoint idem)", () => {
    expect(getDonationTaxProfile("enfant").brackets.length).toBe(7);
    expect(getDonationTaxProfile("conjoint").brackets.length).toBe(7);
  });
});
