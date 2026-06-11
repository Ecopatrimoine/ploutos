// ─── LOT DONNEES PHARMACIE — CCN 1996 Pharmacie d'officine (APGIS, 2 colleges) ─
//
// Premier regime de branche aux DEUX colleges remplis (cadre ET non-cadre),
// garanties IDENTIQUES sauf la franchise IJ (non-cadre 3 j / cadre 61e jour).
// Capital situationFamiliale (saut +50 au 1er enfant), rente education 5 % < 28 ans,
// IJ 82 %, invalidite cible 90 / 67,5 %. Temoin de test 9999 = branche sans garantie
// (remplace l'ancien usage de 1996 vide). PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { computeIJCollective, computeRenteInvalCollective, getMaintienParams } from "../lib/prevoyance/projection";
import { resolveDevolutionCapitalDecesConfig } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";

const PASS = 48060;

describe("1996 — entree pharmacie d'officine (deux colleges remplis)", () => {
  it("entree presente, nom, plafond 4 PASS, deux colleges non null", () => {
    const conv = (referentiels.ccn as any).conventions["1996"];
    expect(conv).toBeDefined();
    expect(conv.nom).toBe("Pharmacie d'officine");
    expect(conv.plafondSalaireRefPass).toBe(4);
    expect(conv.prevoyanceCadres).not.toBeNull();
    expect(conv.prevoyanceNonCadres).not.toBeNull();
  });
});

// ── (a) PHAR-A : preparateur NON-CADRE, marie, 2 enfants (10 et 15), 30 000 ────
describe("1996 — dossier PHAR-A (non-cadre, marie, 2 enfants, 30 000 EUR)", () => {
  const cap = resolveCapitalDecesBranche("1996", "nonCadres", 30000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).capital;
  const re = (age: number) => resolveRenteEducationBranche("1996", "nonCadres", 30000, PASS, age, referentiels).montantAnnuelCourant;
  const branche = resolveCouvertureBranche("1996", "nonCadres", referentiels);
  const covIJ: CouvertureCollective = { ij: branche.ij };
  const covInv: CouvertureCollective = { invalidite: branche.invalidite };

  it("capital : (250 + 25) % x 30 000 = 82 500 EUR", () => {
    expect(cap).toBeCloseTo(2.75 * 30000, 2);
  });

  it("2 rentes education 5 % x 30 000 = 1 500 EUR/an chacune (plancher 3 % PASS inerte)", () => {
    expect(re(10)).toBeCloseTo(0.05 * 30000, 2); // 1 500 > 3 % PASS (1 441,80)
    expect(re(15)).toBeCloseTo(0.05 * 30000, 2);
  });

  it("IJ : 82 % des le 4e jour (franchise 3)", () => {
    expect(computeIJCollective(2, covIJ, 1000, 0)).toBe(0);          // dans la franchise (t < 3)
    expect(computeIJCollective(3, covIJ, 1000, 0)).toBeCloseTo(820); // 0,82 x ref des le 4e jour
  });

  it("invalidite : cat1 67,5 % ; cat2 90 % (cible sous deduction Secu)", () => {
    expect(computeRenteInvalCollective(covInv, "cat1", 30000, 0, 30000, 0)).toBeCloseTo(0.675 * 30000, 2);
    expect(computeRenteInvalCollective(covInv, "cat2", 30000, 0, 30000, 0)).toBeCloseTo(0.90 * 30000, 2);
  });
});

// ── (b) Variantes capital : le SAUT +50 au 1er enfant ─────────────────────────
describe("1996 — capital situationFamiliale (saut +50 au 1er enfant)", () => {
  const cap = (famille: any) => resolveCapitalDecesBranche("1996", "nonCadres", 30000, PASS, referentiels, famille).capital;

  it("celibataire 0 enfant : 200 % = 60 000", () => {
    expect(cap({ nbEnfantsACharge: 0 })).toBeCloseTo(2.00 * 30000, 2);
  });
  it("celibataire 1 enfant : 250 % = 75 000 (SAUT +50 au rang 1)", () => {
    expect(cap({ nbEnfantsACharge: 1 })).toBeCloseTo(2.50 * 30000, 2);
  });
  it("celibataire 2 enfants : 275 % = 82 500", () => {
    expect(cap({ nbEnfantsACharge: 2 })).toBeCloseTo(2.75 * 30000, 2);
  });
  it("marie 0 enfant : 250 % = 75 000", () => {
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 0 })).toBeCloseTo(2.50 * 30000, 2);
  });
  it("marie 3 enfants : 300 % = 90 000 (rangs 2 et 3, +25 chacun)", () => {
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 3 })).toBeCloseTo(3.00 * 30000, 2);
  });
});

// ── (c) CADRE : memes garanties SAUF la franchise IJ (60 vs 3) ─────────────────
describe("1996 — college CADRE : memes capitaux/rentes/invalidite, franchise IJ 60", () => {
  it("capital / rente / invalidite IDENTIQUES au non-cadre", () => {
    const capC = resolveCapitalDecesBranche("1996", "cadres", 30000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).capital;
    expect(capC).toBeCloseTo(2.75 * 30000, 2);
    expect(resolveRenteEducationBranche("1996", "cadres", 30000, PASS, 10, referentiels).montantAnnuelCourant).toBeCloseTo(0.05 * 30000, 2);
    const inv = resolveCouvertureBranche("1996", "cadres", referentiels).invalidite;
    expect(inv?.cat1.pctSalaire).toBe(0.675);
    expect(inv?.cat2.pctSalaire).toBe(0.90);
  });

  it("IJ franchise 60 (cadre) vs 3 (non-cadre) : a t=3 le non-cadre est servi, le cadre NON", () => {
    const covNC: CouvertureCollective = { ij: resolveCouvertureBranche("1996", "nonCadres", referentiels).ij };
    const covC: CouvertureCollective = { ij: resolveCouvertureBranche("1996", "cadres", referentiels).ij };
    expect(resolveCouvertureBranche("1996", "cadres", referentiels).ij?.franchise).toBe(60);
    expect(computeIJCollective(3, covNC, 1000, 0)).toBeCloseTo(820); // non-cadre servi des le 4e jour
    expect(computeIJCollective(3, covC, 1000, 0)).toBe(0);           // cadre : franchise 60
    expect(computeIJCollective(60, covC, 1000, 0)).toBeCloseTo(820); // cadre servi au 61e jour
  });
});

// ── Devolution + absence de rente de conjoint ─────────────────────────────────
describe("1996 — devolution APGIS et pas de rente de conjoint", () => {
  it("devolution 4 rangs : conjoint/PACS -> enfants (representation) -> ascendants -> succession", () => {
    const config = resolveDevolutionCapitalDecesConfig("1996", referentiels);
    expect(config!.rangs).toHaveLength(4);
    expect(config!.rangs[0].qualites).toEqual(["conjoint", "pacs"]);
    expect(config!.rangs[1].qualites).toEqual(["enfants"]);
    expect(config!.rangs[1].representation).toBe(true);
  });

  it("rente de conjoint indisponible (cadre ET non-cadre)", () => {
    expect(resolveRenteConjointSubstitutiveBranche("1996", "nonCadres", 30000, PASS, referentiels, 40).donneeIndisponible).toBe(true);
    expect(resolveRenteConjointSubstitutiveBranche("1996", "cadres", 30000, PASS, referentiels, 40).donneeIndisponible).toBe(true);
  });
});

// ── (d) TEMOIN DE TEST 9999 : aucune garantie servie ─────────────────────────
describe("9999 — temoin de test : aucune garantie de branche (cadre comme non-cadre)", () => {
  it("entree presente mais prevoyance null -> tout indisponible", () => {
    const conv = (referentiels.ccn as any).conventions["9999"];
    expect(conv).toBeDefined();
    expect(conv.prevoyanceCadres).toBeNull();
    expect(conv.prevoyanceNonCadres).toBeNull();
    for (const cat of ["cadres", "nonCadres"] as const) {
      expect(resolveCouvertureBranche("9999", cat, referentiels).donneeIndisponible).toBe(true);
      expect(resolveCapitalDecesBranche("9999", cat, 30000, PASS, referentiels, { conjointPresent: true }).capital).toBeNull();
      expect(resolveRenteEducationBranche("9999", cat, 30000, PASS, 10, referentiels).donneeIndisponible).toBe(true);
      expect(resolveRenteConjointSubstitutiveBranche("9999", cat, 30000, PASS, referentiels, 40).donneeIndisponible).toBe(true);
    }
    // Pas de clause de devolution -> repli par defaut (config null).
    expect(resolveDevolutionCapitalDecesConfig("9999", referentiels)).toBeNull();
    // Maintien null -> plancher legal de mensualisation.
    expect(getMaintienParams("9999", referentiels, "cadres").source).toBe("legal");
  });
});
