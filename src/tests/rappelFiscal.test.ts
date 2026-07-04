// Lot A3 — moteur de rappel fiscal (art. 784 CGI). dateReference INJECTEE (fixe)
// pour un test deterministe ; dates de donations relatives a REF = 2026-07-04.
import { describe, it, expect } from "vitest";
import { computeRappelParHeritier } from "../lib/calculs/rappelFiscal";
import type { DonationPassee } from "../types/patrimoine";

const REF = "2026-07-04";
const mk = (o: Partial<DonationPassee>): DonationPassee => ({
  id: "d", donorPersonKey: "person1", beneficiaireType: "child", beneficiaireChildId: "c1",
  date: "2021-07-04", montant: "0", type: "simple", ...o,
});
const all = () => true;

describe("computeRappelParHeritier — rappel fiscal 15 ans", () => {
  it("donation simple 40 000 il y a 5 ans -> consomme 40 000, base 0", () => {
    const r = computeRappelParHeritier([mk({ montant: "40000", date: "2021-07-04" })], "person1", all, REF);
    expect(r.abattementConsomme).toBe(40000);
    expect(r.baseTaxeeAnterieure).toBe(0);
    expect(r.donationsRetenues.length).toBe(1);
    expect(r.aVerifier).toBe(false);
  });

  it("donation 150 000 il y a 5 ans -> consomme 100 000, base 50 000", () => {
    const r = computeRappelParHeritier([mk({ montant: "150000" })], "person1", all, REF);
    expect(r.abattementConsomme).toBe(100000);
    expect(r.baseTaxeeAnterieure).toBe(50000);
  });

  it("don familial 790G 31 865 il y a 3 ans -> HORS rappel, tout a zero", () => {
    const r = computeRappelParHeritier([mk({ montant: "31865", date: "2023-07-04", type: "don_familial_790G" })], "person1", all, REF);
    expect(r.abattementConsomme).toBe(0);
    expect(r.baseTaxeeAnterieure).toBe(0);
    expect(r.donationsRetenues.length).toBe(0);
    expect(r.aVerifier).toBe(false);
  });

  it("present d'usage et 790A_bis -> HORS rappel", () => {
    const r = computeRappelParHeritier([
      mk({ id: "p", montant: "5000", type: "present_usage" }),
      mk({ id: "a", montant: "9000", type: "don_790A_bis" }),
    ], "person1", all, REF);
    expect(r.donationsRetenues.length).toBe(0);
    expect(r.abattementConsomme).toBe(0);
  });

  it("donation il y a 16 ans -> hors fenetre 15 ans", () => {
    const r = computeRappelParHeritier([mk({ montant: "40000", date: "2010-07-04" })], "person1", all, REF);
    expect(r.donationsRetenues.length).toBe(0);
    expect(r.abattementConsomme).toBe(0);
    expect(r.aVerifier).toBe(false);
  });

  it("deux donations successives -> consommation sequentielle par date croissante", () => {
    const r = computeRappelParHeritier([
      mk({ id: "d2", montant: "60000", date: "2023-07-04" }), // plus recente (saisie en 1er)
      mk({ id: "d1", montant: "60000", date: "2018-07-04" }), // plus ancienne
    ], "person1", all, REF);
    // 60 000 (2018) -> pool 40 000 ; 60 000 (2023) consomme 40 000 -> base 20 000
    expect(r.abattementConsomme).toBe(100000);
    expect(r.baseTaxeeAnterieure).toBe(20000);
    expect(r.donationsRetenues.map((d) => d.id)).toEqual(["d1", "d2"]); // tri croissant
  });

  it("date vide -> donation ignoree du rappel + aVerifier", () => {
    const r = computeRappelParHeritier([mk({ montant: "40000", date: "" })], "person1", all, REF);
    expect(r.aVerifier).toBe(true);
    expect(r.donationsRetenues.length).toBe(0);
    expect(r.abattementConsomme).toBe(0);
  });

  it("montant vide -> ignoree + aVerifier", () => {
    const r = computeRappelParHeritier([mk({ montant: "", date: "2021-07-04" })], "person1", all, REF);
    expect(r.aVerifier).toBe(true);
    expect(r.donationsRetenues.length).toBe(0);
  });

  it("filtre donorKey : donations de l'autre donateur ignorees", () => {
    const r = computeRappelParHeritier([mk({ montant: "40000", donorPersonKey: "person2" })], "person1", all, REF);
    expect(r.donationsRetenues.length).toBe(0);
    expect(r.abattementConsomme).toBe(0);
  });

  it("beneficiaireMatch : ne retient que le beneficiaire cible (par childId)", () => {
    const dons = [
      mk({ id: "a", montant: "40000", beneficiaireChildId: "c1" }),
      mk({ id: "b", montant: "50000", beneficiaireChildId: "c2" }),
    ];
    const r = computeRappelParHeritier(dons, "person1", (d) => d.beneficiaireChildId === "c1", REF);
    expect(r.donationsRetenues.map((d) => d.id)).toEqual(["a"]);
    expect(r.abattementConsomme).toBe(40000);
  });

  it("petit-enfant : abattement DONATION 31 865 (profil donation)", () => {
    const r = computeRappelParHeritier([mk({ montant: "50000", beneficiaireType: "autre", beneficiaireRelation: "petit-enfant" })], "person1", all, REF);
    expect(r.abattementConsomme).toBe(31865);
    expect(r.baseTaxeeAnterieure).toBe(50000 - 31865);
  });
});
