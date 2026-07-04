// Lot E2 — une donation passee saisie via le flux picker (DonationPasseeModal)
// alimente computeRappelParHeritier bout en bout. Le picker produit une
// DonationPassee { beneficiaireType 'child', beneficiaireChildId, relation mappee }.
// (Le flux complet computeSuccession est couvert par succession.rappel.test.ts.)
import { describe, it, expect } from "vitest";
import { computeRappelParHeritier } from "../lib/calculs/rappelFiscal";
import { membresFamille } from "../lib/prevoyance/membres-famille";
import { mapMembreToDonationRelation } from "../lib/calculs/donation";
import type { DonationPassee } from "../types/patrimoine";

const yearsAgo = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };
const REF = yearsAgo(0);
const data = { coupleStatus: "single", person1FirstName: "P", person1LastName: "1", childrenData: [{ id: "cA", firstName: "Alice", lastName: "M", parentLink: "person1_only" }] } as any;

describe("E2 — flux picker -> DonationPassee -> rappel", () => {
  it("clic puce enfant (donateur P1) produit child+childId+relation -> alimente le rappel", () => {
    const alice = membresFamille(data, 1).find((m) => m.name.startsWith("Alice"))!;
    // Ce que produit pick() du modal :
    const don: DonationPassee = {
      id: "d", donorPersonKey: "person1",
      beneficiaireType: "child", beneficiaireChildId: alice.childId, beneficiaireNom: alice.name,
      beneficiaireRelation: mapMembreToDonationRelation(alice.relation),
      date: yearsAgo(5), montant: "40000", type: "simple",
    };
    expect(don.beneficiaireChildId).toBe("cA");
    expect(don.beneficiaireRelation).toBe("enfant");
    const r = computeRappelParHeritier([don], "person1", (d) => d.beneficiaireChildId === "cA", REF);
    expect(r.abattementConsomme).toBe(40000);
    expect(r.donationsRetenues.length).toBe(1);
    expect(r.aVerifier).toBe(false);
  });

  it("type hors rappel (790 G) saisi via le flux -> ignore du calcul", () => {
    const don: DonationPassee = { id: "d", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "cA", beneficiaireNom: "Alice", beneficiaireRelation: "enfant", date: yearsAgo(3), montant: "31865", type: "don_familial_790G" };
    const r = computeRappelParHeritier([don], "person1", (d) => d.beneficiaireChildId === "cA", REF);
    expect(r.abattementConsomme).toBe(0);
    expect(r.donationsRetenues.length).toBe(0);
  });
});
