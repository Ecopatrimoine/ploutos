// LOT D1 — Résolveur pur des dispositifs fiscaux (NON branché à ir.ts).
// Cas calculés A LA MAIN, valeurs attendues en commentaire. Toutes les fonctions
// sont datées (annee fiscale passée en paramètre) : aucun Date.now().
import { describe, it, expect } from "vitest";
import {
  resolveReductionDispositif, resolveDeductionsJeanbrun, estReduction,
  type ResolutionReduction,
} from "../lib/fiscal/dispositifs-resolveur";
import type { Property } from "../types/patrimoine";

const bien = (o: Partial<Property>): Partial<Property> => ({ type: "Location nue", ...o });
const statut = (r: ResolutionReduction) => (r && !estReduction(r) ? r.statut : null);

describe("resolveReductionDispositif — Pinel / Pinel+ / Denormandie", () => {
  it("Pinel 2023, 9 ans, base 250000 : 250000x0.15/9 = 4166,67/an (2023-2031)", () => {
    const b = bien({ dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9" });
    const r = resolveReductionDispositif(b, 2025);
    expect(estReduction(r)).toBe(true);
    if (estReduction(r)) {
      expect(r.montant).toBeCloseTo(4166.67, 2); // 37500 / 9
      expect(r.id).toBe("pinel");
      expect(r.plafondNiches).toBe(true);
      expect(r.phase).toBe("engagement");
    }
  });

  it("Pinel 2023, 9 ans : année 2033 SANS prorogation déclarée -> statut eteint", () => {
    const b = bien({ dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9" });
    const r = resolveReductionDispositif(b, 2033);
    expect(estReduction(r)).toBe(false);
    expect(statut(r)).toBe("eteint");
  });

  it("Pinel 2023, 9 ans, prorogation 1 : année 2033 -> 250000x0.025/3 = 2083,33", () => {
    const b = bien({ dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9", dispositifProrogation: "1" });
    const r = resolveReductionDispositif(b, 2033); // periode proro 2032-2034
    expect(estReduction(r)).toBe(true);
    if (estReduction(r)) {
      expect(r.montant).toBeCloseTo(2083.33, 2); // 6250 / 3
      expect(r.phase).toBe("prorogation");
    }
  });

  it("Pinel 2021, 6 ans, base 350000 -> écrêtée 300000 : 300000x0.12/6 = 6000/an (2021-2026)", () => {
    const b = bien({ dispositifFiscal: "pinel", dispositifAnnee: "2021", dispositifBase: "350000", dispositifEngagementAns: "6" });
    const r = resolveReductionDispositif(b, 2024);
    if (estReduction(r)) expect(r.montant).toBeCloseTo(6000, 2); // 36000 / 6
    expect(estReduction(r)).toBe(true);
    // 2027 : hors engagement, aucune prorogation déclarée -> eteint
    expect(statut(resolveReductionDispositif(b, 2027))).toBe("eteint");
  });

  it("Pinel+ 2024 vs Pinel 2024 (9 ans, base 300000) : 0.18 -> 6000 vs 0.12 -> 4000", () => {
    const plus = resolveReductionDispositif(bien({ dispositifFiscal: "pinelPlus", dispositifAnnee: "2024", dispositifBase: "300000", dispositifEngagementAns: "9" }), 2024);
    const std = resolveReductionDispositif(bien({ dispositifFiscal: "pinel", dispositifAnnee: "2024", dispositifBase: "300000", dispositifEngagementAns: "9" }), 2024);
    expect(estReduction(plus) && estReduction(std)).toBe(true);
    if (estReduction(plus)) expect(plus.montant).toBeCloseTo(6000, 2); // 300000x0.18/9
    if (estReduction(std)) expect(std.montant).toBeCloseTo(4000, 2);  // 300000x0.12/9
  });

  it("Denormandie 2025, 9 ans, base 200000 : 200000x0.18/9 = 4000/an", () => {
    const r = resolveReductionDispositif(bien({ dispositifFiscal: "denormandie", dispositifAnnee: "2025", dispositifBase: "200000", dispositifEngagementAns: "9" }), 2025);
    if (estReduction(r)) expect(r.montant).toBeCloseTo(4000, 2);
    expect(estReduction(r)).toBe(true);
  });
});

describe("resolveReductionDispositif — Censi-Bouvard", () => {
  it("Censi 2019 (LMNP), base 180000 : 180000x0.11/9 = 2200/an jusqu'en 2027", () => {
    const b = bien({ type: "LMNP", dispositifFiscal: "censiBouvard", dispositifAnnee: "2019", dispositifBase: "180000" });
    const r = resolveReductionDispositif(b, 2025);
    if (estReduction(r)) expect(r.montant).toBeCloseTo(2200, 2); // 19800 / 9
    expect(estReduction(r)).toBe(true);
    // engagement 2019-2027 ; 2028 -> eteint (report 6 ans non modelise)
    expect(statut(resolveReductionDispositif(b, 2028))).toBe("eteint");
  });

  it("Censi sur une SCPI -> incoherent avec motif (detention directe uniquement)", () => {
    const r = resolveReductionDispositif(bien({ type: "SCPI", dispositifFiscal: "censiBouvard", dispositifAnnee: "2019", dispositifBase: "180000" }), 2025);
    expect(estReduction(r)).toBe(false);
    expect(statut(r)).toBe("incoherent");
    if (r && !estReduction(r)) expect(r.motif).toMatch(/detention directe/i);
  });
});

describe("resolveReductionDispositif — Loc'Avantages", () => {
  it("loc2 AVEC intermediation, loyers 9000 : 9000x0.40 = 3600", () => {
    const r = resolveReductionDispositif(bien({ dispositifFiscal: "locavantages", dispositifAnnee: "2023", dispositifNiveauLoyer: "loc2", dispositifIntermediation: true, rentGrossAnnual: "9000" }), 2024);
    if (estReduction(r)) expect(r.montant).toBeCloseTo(3600, 2);
    expect(estReduction(r)).toBe(true);
  });

  it("loc3 SANS intermediation -> incoherent (IML obligatoire, pas de taux 65% sans IML)", () => {
    const r = resolveReductionDispositif(bien({ dispositifFiscal: "locavantages", dispositifAnnee: "2023", dispositifNiveauLoyer: "loc3", dispositifIntermediation: false, rentGrossAnnual: "9000" }), 2024);
    expect(estReduction(r)).toBe(false);
    expect(statut(r)).toBe("incoherent");
    if (r && !estReduction(r)) expect(r.motif).toMatch(/intermediation/i);
  });
});

describe("resolveReductionDispositif — cas nuls / bornes", () => {
  it("aucun dispositif -> null", () => {
    expect(resolveReductionDispositif(bien({ dispositifFiscal: "" }), 2025)).toBeNull();
    expect(resolveReductionDispositif(bien({}), 2025)).toBeNull();
  });
  it("Jeanbrun (deduction fonciere) -> null via cette fonction", () => {
    expect(resolveReductionDispositif(bien({ dispositifFiscal: "jeanbrunRelanceLogement" }), 2026)).toBeNull();
  });
});

describe("resolveDeductionsJeanbrun", () => {
  const jb = (o: Partial<Property>): Partial<Property> => ({
    type: "Location nue", dispositifFiscal: "jeanbrunRelanceLogement", propertyRight: "full",
    dispositifAnnee: "2026", dispositifNeufAncien: "neuf", ...o,
  });

  it("neuf tresSocial base 300000 : 300000x0.80x0.055 = 13200 brut -> retenu 12000, ecretement 1200", () => {
    const res = resolveDeductionsJeanbrun([jb({ id: "j1", dispositifBase: "300000", dispositifNiveauLoyer: "tresSocial", rentGrossAnnual: "10000" })], 2026);
    expect(res.plafondFoyer).toBe(12000);
    expect(res.parBien[0].montantBrut).toBeCloseTo(13200, 2);
    expect(res.parBien[0].montantRetenu).toBeCloseTo(12000, 2);
    expect(res.ecretement).toBeCloseTo(1200, 2);
  });

  it("2 biens intermediaires (brut 5000 chacun) : total 10000 -> retenu 8000, ecretement 2000", () => {
    // base 178571.43 : 178571.43 x 0.80 x 0.035 = 5000,00 (neuf intermediaire)
    const b = (id: string): Partial<Property> => jb({ id, dispositifBase: "178571.43", dispositifNiveauLoyer: "intermediaire", rentGrossAnnual: "8000" });
    const res = resolveDeductionsJeanbrun([b("a"), b("b")], 2026);
    expect(res.plafondFoyer).toBe(8000);
    const totalBrut = res.parBien.reduce((s, p) => s + p.montantBrut, 0);
    const totalRetenu = res.parBien.reduce((s, p) => s + p.montantRetenu, 0);
    expect(totalBrut).toBeCloseTo(10000, 0);
    expect(totalRetenu).toBeCloseTo(8000, 4);
    expect(res.ecretement).toBeCloseTo(2000, 0);
  });

  it("bien démembré -> exclu avec motif, montant 0", () => {
    const res = resolveDeductionsJeanbrun([jb({ id: "d", dispositifBase: "300000", dispositifNiveauLoyer: "tresSocial", propertyRight: "usufruct" })], 2026);
    expect(res.parBien[0].montantBrut).toBe(0);
    expect(res.parBien[0].motif).toMatch(/demembre/i);
  });

  it("acquisition 2025 (hors fenetre 2026-2028) -> exclu avec motif", () => {
    const res = resolveDeductionsJeanbrun([jb({ id: "h", dispositifAnnee: "2025", dispositifBase: "300000", dispositifNiveauLoyer: "tresSocial", rentGrossAnnual: "10000" })], 2025);
    expect(res.parBien[0].montantBrut).toBe(0);
    expect(res.parBien[0].motif).toMatch(/fenetre/i);
  });
});
