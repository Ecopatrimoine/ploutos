// LOT 2 — projection 10 ans d'un bien meuble au reel (fonction PURE, ecran seul,
// jamais dans computeIR). Golden values verifiees en Python le 07/07/2026.
import { describe, it, expect } from "vitest";
import { computeProjectionMeuble } from "../lib/calculs/projectionMeuble";
import refMeuble from "../data/location-meublee.json";
import type { Property } from "../types/patrimoine";

const bien = (over: any): Property => ({ id: "b", name: "Meuble", type: "LMNP", regimeMeuble: "reel", ...over } as unknown as Property);
const MILLESIME = refMeuble.millesime;

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

describe("computeProjectionMeuble — T12 plus-value brute (art. 150 VB)", () => {
  // bien 300000 / terrain 0.15 / mobilier 10000 / valeurEstimee 300000 ; recettes 18000, charges 8000.
  const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", partTerrain: "0.15", valeurMobilier: "10000", value: "300000" }));
  const L = r.lignes;
  it("pvDisponible = true, prixCession = valeur estimee 300000", () => {
    expect(r.pvDisponible).toBe(true);
    expect(r.prixCession).toBe(300000);
  });
  it("an 1 : cumul 10000, prixCorrige 312500, moins-value (pvBrute 0)", () => {
    expect(L[0].cumulDeduit).toBeCloseTo(10000, 2);
    expect(L[0].prixAcquisitionCorrige).toBeCloseTo(312500, 2);
    expect(L[0].pvBrute).toBeCloseTo(0, 2);
    expect(L[0].moinsValue).toBe(true);
  });
  it("an 3 : cumul 30000, prixCorrige 292500, pvBrute 7500", () => {
    expect(L[2].cumulDeduit).toBeCloseTo(30000, 2);
    expect(L[2].prixAcquisitionCorrige).toBeCloseTo(292500, 2);
    expect(L[2].pvBrute).toBeCloseTo(7500, 2);
  });
  it("an 5 : cumul 50000, prixCorrige 272500, pvBrute 27500", () => {
    expect(L[4].cumulDeduit).toBeCloseTo(50000, 2);
    expect(L[4].prixAcquisitionCorrige).toBeCloseTo(272500, 2);
    expect(L[4].pvBrute).toBeCloseTo(27500, 2);
  });
  it("an 6 : forfait travaux 15 % entre -> prixCorrige 307500, moins-value", () => {
    expect(L[5].cumulDeduit).toBeCloseTo(60000, 2);
    expect(L[5].prixAcquisitionCorrige).toBeCloseTo(307500, 2);
    expect(L[5].pvBrute).toBeCloseTo(0, 2);
    expect(L[5].moinsValue).toBe(true);
  });
  it("an 7 : pvBrute 2500 ; an 10 : cumul 100000, prixCorrige 267500, pvBrute 32500", () => {
    expect(L[6].pvBrute).toBeCloseTo(2500, 2);
    expect(L[9].cumulDeduit).toBeCloseTo(100000, 2);
    expect(L[9].prixAcquisitionCorrige).toBeCloseTo(267500, 2);
    expect(L[9].pvBrute).toBeCloseTo(32500, 2);
  });
});

describe("computeProjectionMeuble — volet PV : garde-fous", () => {
  it("pvDisponible = false sans prixAcquisition (amortissement manuel sans intrants)", () => {
    const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", amortissementAnnuelManuel: "5000" }));
    expect(r.pvDisponible).toBe(false);
    expect(r.lignes.every((l) => l.pvBrute === 0)).toBe(true);
  });
  it("fallback prixCession = prixAcquisition si valeur estimee absente", () => {
    const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "250000", value: "" }));
    expect(r.pvDisponible).toBe(true);
    expect(r.prixCession).toBe(250000);
  });
});

describe("computeProjectionMeuble — T13 annee d'acquisition + stock ARD anterieur", () => {
  // Meme bien que T12, acquis il y a 5 ans, stock ARD anterieur 8000.
  const r = computeProjectionMeuble(bien({
    recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000",
    partTerrain: "0.15", valeurMobilier: "10000", value: "300000",
    anneeAcquisition: String(MILLESIME - 5), stockArdAnterieur: "8000",
  }));
  const L = r.lignes;
  it("anneesEcoulees 5 ; cumul deduit initial 45680.36 (53680.36 dotes - 8000 ARD)", () => {
    expect(r.anneesEcoulees).toBe(5);
    expect(L[0].age).toBe(6);
    expect(L[0].cumulDeduit - L[0].utilise).toBeCloseTo(45680.36, 2); // = cumul initial
  });
  it("k1 (age 6) : dotation 10736.07, stock ARD 8736.07, cumul 55680.36, prixCorrige 311819.64, MV", () => {
    expect(L[0].dotation).toBeCloseTo(10736.07, 2);
    expect(L[0].stockArd).toBeCloseTo(8736.07, 2);
    expect(L[0].cumulDeduit).toBeCloseTo(55680.36, 2);
    expect(L[0].prixAcquisitionCorrige).toBeCloseTo(311819.64, 2);
    expect(L[0].moinsValue).toBe(true); // forfait travaux deja actif (age 6 > 5)
  });
  it("k3 (age 8) : dotation 9307.50 (mobilier sorti), pvBrute 8180.36", () => {
    expect(L[2].age).toBe(8);
    expect(L[2].dotation).toBeCloseTo(9307.5, 2);
    expect(L[2].pvBrute).toBeCloseTo(8180.36, 2);
  });
  it("k5 : stock ARD 7394.64, pvBrute 28180.36", () => {
    expect(L[4].stockArd).toBeCloseTo(7394.64, 2);
    expect(L[4].pvBrute).toBeCloseTo(28180.36, 2);
  });
  it("k10 (age 15) : stock ARD 3932.14, cumul 145680.36, pvBrute 78180.36", () => {
    expect(L[9].age).toBe(15);
    expect(L[9].stockArd).toBeCloseTo(3932.14, 2);
    expect(L[9].cumulDeduit).toBeCloseTo(145680.36, 2);
    expect(L[9].pvBrute).toBeCloseTo(78180.36, 2);
  });
  it("k10 : impot PV apres abattements (age 15) - IR 5941.71 + PS 11228.26 = 17169.97", () => {
    expect(L[9].impotIr).toBeCloseTo(5941.71, 2);
    expect(L[9].impotPs).toBeCloseTo(11228.26, 2);
    expect(L[9].impotPvTotal).toBeCloseTo(17169.97, 2);
  });
});

describe("computeProjectionMeuble — iso strict (champs vides) + garde-fous 2ter", () => {
  it("anneeAcquisition = annee courante : anneesEcoulees 0, iso T12 (an 1 prixCorrige 312500)", () => {
    const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", partTerrain: "0.15", valeurMobilier: "10000", value: "300000", anneeAcquisition: String(MILLESIME) }));
    expect(r.anneesEcoulees).toBe(0);
    expect(r.lignes[0].age).toBe(1);
    expect(r.lignes[0].cumulDeduit).toBeCloseTo(10000, 2);
    expect(r.lignes[0].prixAcquisitionCorrige).toBeCloseTo(312500, 2);
  });
  it("champs vides : anneesEcoulees 0, anneeAcquisition null (comportement historique)", () => {
    const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", prixAcquisition: "300000", value: "300000" }));
    expect(r.anneesEcoulees).toBe(0);
    expect(r.anneeAcquisition).toBeNull();
  });
  it("amortissement manuel + annees ecoulees : cumul initial = manuel x n", () => {
    const r = computeProjectionMeuble(bien({ recettesAnnuelles: "18000", chargesReelles: "8000", amortissementAnnuelManuel: "4000", anneeAcquisition: String(MILLESIME - 3), stockArdAnterieur: "0" }));
    expect(r.anneesEcoulees).toBe(3);
    // cumul initial (avant an 1) = 4000 x 3 = 12000
    expect(r.lignes[0].cumulDeduit - r.lignes[0].utilise).toBeCloseTo(12000, 2);
  });
});
