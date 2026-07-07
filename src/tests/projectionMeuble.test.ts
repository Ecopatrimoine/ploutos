// LOT 2 — projection 10 ans d'un bien meuble au reel (fonction PURE, ecran seul,
// jamais dans computeIR). Golden values verifiees en Python le 07/07/2026.
import { describe, it, expect } from "vitest";
import { computeProjectionMeuble } from "../lib/calculs/projectionMeuble";
import type { Property } from "../types/patrimoine";

const bien = (over: any): Property => ({ id: "b", name: "Meuble", type: "LMNP", regimeMeuble: "reel", ...over } as unknown as Property);

describe("computeProjectionMeuble — T10 accumulation ARD (grille par defaut)", () => {
  // recettes 18000, charges retenues 8000, bien 300000 / terrain 0.15 / mobilier 10000.
  const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", partTerrain: "0.15", valeurMobilier: "10000" }));
  const L = r.lignes;

  it("ans 1-7 : dotation 10736.07, utilise 10000, stock ARD croissant de 736.07/an", () => {
    const stockAttendu = [736.07, 1472.14, 2208.21, 2944.29, 3680.36, 4416.43, 5152.50];
    for (let i = 0; i < 7; i++) {
      expect(L[i].dotation).toBeCloseTo(10736.07, 2);
      expect(L[i].utilise).toBeCloseTo(10000, 2);
      expect(L[i].stockArd).toBeCloseTo(stockAttendu[i], 2);
    }
  });

  it("an 8 : dotation 9307.50 (mobilier sorti), utilise 10000, stock ARD 4460.00", () => {
    expect(L[7].dotation).toBeCloseTo(9307.5, 2);
    expect(L[7].utilise).toBeCloseTo(10000, 2);
    expect(L[7].stockArd).toBeCloseTo(4460.0, 2);
  });

  it("ans 9-10 : stock ARD 3767.50 puis 3075.00", () => {
    expect(L[8].stockArd).toBeCloseTo(3767.5, 2);
    expect(L[9].stockArd).toBeCloseTo(3075.0, 2);
  });

  it("baseImposable = 0 sur les 10 ans, anneeBascule = null", () => {
    expect(L.every((l) => l.baseImposable === 0)).toBe(true);
    expect(r.anneeBascule).toBeNull();
  });
});

describe("computeProjectionMeuble — bascule reelle (petit amortissement)", () => {
  // recettes 18000, charges 8000, amortissement manuel 4000 (constant) -> base des l'an 1.
  const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", amortissementAnnuelManuel: "4000" }));
  it("anneeBascule = 1, base 6000, PS estimes 1116 (18,6 %), manuel", () => {
    expect(r.manuel).toBe(true);
    expect(r.anneeBascule).toBe(1);
    expect(r.lignes[0].baseImposable).toBeCloseTo(6000, 2); // 18000 - 8000 - 4000
    expect(r.lignes[0].psEstimes).toBeCloseTo(1116, 2);     // 6000 x 0.186
    expect(r.lignes[0].stockArd).toBeCloseTo(0, 2);
    expect(r.lignes[9].baseImposable).toBeCloseTo(6000, 2); // constant
  });
});

describe("computeProjectionMeuble — deficit hors amortissement", () => {
  // recettes 5000 < charges 10000 -> resultatAvantAmort = -5000 chaque annee.
  const r = computeProjectionMeuble(bien({ recettesAnnuelles: "5000", chargesReelles: "10000", prixAcquisition: "300000", partTerrain: "0.15", valeurMobilier: "10000" }));
  const L = r.lignes;
  it("ARD intact (utilise 0, stock ARD = cumul des dotations)", () => {
    expect(L.every((l) => l.utilise === 0)).toBe(true);
    expect(L[0].stockArd).toBeCloseTo(10736.07, 2);
    expect(L[1].stockArd).toBeCloseTo(21472.14, 2); // 2 x 10736.07
  });
  it("file deficits alimentee (5000/an), base 0, anneeBascule null", () => {
    expect(L[0].stockDeficits).toBeCloseTo(5000, 2);
    expect(L[2].stockDeficits).toBeCloseTo(15000, 2);
    expect(L.every((l) => l.baseImposable === 0)).toBe(true);
    expect(L.every((l) => l.deficitsImputes === 0)).toBe(true); // pas de resultat positif -> pas d'imputation
    expect(r.anneeBascule).toBeNull();
  });
});
