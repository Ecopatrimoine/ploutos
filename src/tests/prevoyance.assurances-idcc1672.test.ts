// ─── LOT ASSUR-1 — CCN 1672 Societes d'assurances (RPP) ───────────────────────
//
// Premier usage REEL du mode paliers IJ (ASSUR-0). Regime de branche COMPLET,
// garanties identiques cadres/non-cadres (statut unique, art. 82 + reglement RPP) :
// capital situationFamiliale (isole 50/150/200 %, marie 175/275 %), rente education
// 5/10/15 %, IJ a 2 paliers (85 % puis 70 %), invalidite cible 70 %, maintien 3 mois.
// Assiette plafonnee 8 PASS. PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { categorieBranche } from "../lib/prevoyance/categorie-branche";
import {
  computeIJCollective,
  computeRenteInvalCollective,
  getMaintienParams,
} from "../lib/prevoyance/projection";
import { resolveDevolutionCapitalDecesConfig } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";

const PASS = 48060;

describe("1672 — entree presente, nom, plafond 8 PASS", () => {
  it("entree existe, nom Societes d'assurances, plafondSalaireRefPass 8", () => {
    const conv = (referentiels.ccn as any).conventions["1672"];
    expect(conv).toBeDefined();
    expect(conv.nom).toContain("assurances");
    expect(conv.plafondSalaireRefPass).toBe(8);
  });
});

// ── Capital DC situationFamiliale (isole vs marie), plafond 8 PASS ─────────────
describe("1672 — capital deces situationFamiliale", () => {
  const cap = (famille: any, salaire = 30000) =>
    resolveCapitalDecesBranche("1672", "cadres", salaire, PASS, referentiels, famille).capital;

  it("isole (sans conjoint, concubin NON assimile) : 0/1/2 enfants = 50/150/200 %", () => {
    expect(cap({ nbEnfantsACharge: 0 })).toBeCloseTo(0.50 * 30000, 2); // 15 000
    expect(cap({ nbEnfantsACharge: 1 })).toBeCloseTo(1.50 * 30000, 2); // 45 000 (50 + 100)
    expect(cap({ nbEnfantsACharge: 2 })).toBeCloseTo(2.00 * 30000, 2); // 60 000 (50 + 100 + 50)
  });

  it("marie/PACS : 0/2 enfants = 175/275 %", () => {
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 0 })).toBeCloseTo(1.75 * 30000, 2); // 52 500
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 2 })).toBeCloseTo(2.75 * 30000, 2); // 82 500 (175 + 50 + 50)
  });

  it("assiette plafonnee a 8 PASS : isole 0 enfant, salaire 500 000 -> 50 % x 8 PASS", () => {
    expect(cap({ nbEnfantsACharge: 0 }, 500000)).toBeCloseTo(0.50 * 8 * PASS, 2); // 192 240
  });
});

// ── Devolution : 4 rangs, concubin absent du rang 1, representation au rang 2 ──
describe("1672 — devolution capital deces (cascade)", () => {
  const config = resolveDevolutionCapitalDecesConfig("1672", referentiels);

  it("4 rangs : rang 1 conjoint+pacs (concubin EXCLU), rang 2 enfants representation", () => {
    expect(config!.rangs).toHaveLength(4);
    expect(config!.rangs[0].qualites).toEqual(["conjoint", "pacs"]);
    expect(config!.rangs[0].qualites).not.toContain("concubin");
    expect(config!.rangs[1].qualites).toEqual(["enfants"]);
    expect(config!.rangs[1].representation).toBe(true);
    expect(config!.rangs[2].qualites).toEqual(["ascendants"]);
    expect(config!.rangs[3].qualites).toEqual(["devolutionSuccessorale"]);
  });
});

// ── Rente education : 5/10/15 %, pivots 6 et 14 (aAge exclusif), extinction 26 ─
describe("1672 — rente education (tranches contiguës, fraction)", () => {
  const re = (age: number, salaire = 30000) =>
    resolveRenteEducationBranche("1672", "cadres", salaire, PASS, age, referentiels).montantAnnuelCourant;

  it("taux aux ages 3/10/20 = 5/10/15 %", () => {
    expect(re(3)).toBeCloseTo(0.05 * 30000, 2);
    expect(re(10)).toBeCloseTo(0.10 * 30000, 2);
    expect(re(20)).toBeCloseTo(0.15 * 30000, 2);
  });

  it("pivot aAge exclusif : age 6 -> 10 % (tranche [6,14)), age 14 -> 15 % (tranche [14,26))", () => {
    expect(re(6)).toBeCloseTo(0.10 * 30000, 2);
    expect(re(14)).toBeCloseTo(0.15 * 30000, 2);
  });

  it("extinction a 26 ans (au-dela de la derniere borne) -> 0", () => {
    expect(re(26)).toBe(0);
  });
});

// ── IJ a paliers (premier usage reel) ─────────────────────────────────────────
describe("1672 — IJ branche a 2 paliers (85 % mois 4-12, 70 % mois 13-36)", () => {
  const branche = resolveCouvertureBranche("1672", "cadres", referentiels);
  const cov: CouvertureCollective = { ij: branche.ij };
  // Sans deja-percu, le complement = assiette x taux (assiette 1000 -> € directs).
  const ij = (t: number) => computeIJCollective(t, cov, 1000, 0);

  it("franchise : t=89 -> 0", () => {
    expect(ij(89)).toBe(0);
  });

  it("palier 1 (0.85) : t=90 et t=359 -> 850", () => {
    expect(ij(90)).toBeCloseTo(850);
    expect(ij(359)).toBeCloseTo(850);
  });

  it("palier 2 (0.70) : t=360 et t=1079 -> 700", () => {
    expect(ij(360)).toBeCloseTo(700);
    expect(ij(1079)).toBeCloseTo(700);
  });

  it("extinction : t=1080 -> 0", () => {
    expect(ij(1080)).toBe(0);
  });

  it("pctSalaire des paliers est une FRACTION (0.85, 0.70), jamais un entier", () => {
    const paliers = branche.ij?.paliers;
    expect(paliers).toHaveLength(2);
    expect(paliers![0].pctSalaire).toBe(0.85);
    expect(paliers![1].pctSalaire).toBe(0.70);
    expect(paliers![0].pctSalaire).toBeLessThanOrEqual(1);
  });
});

// ── Invalidite : 0.70 toutes cats, injectee pour un salarie IDCC 1672 ──────────
describe("1672 — invalidite cible 70 % (injection sans couverture saisie)", () => {
  it("invalidite presente et injectee cadre COMME non-cadre, cible 70 %", () => {
    for (const cat of ["cadres", "nonCadres"] as const) {
      const branche = resolveCouvertureBranche("1672", cat, referentiels);
      expect(branche.donneeIndisponible).toBe(false);
      expect(branche.invalidite).toBeDefined();
      const cov: CouvertureCollective = { invalidite: branche.invalidite };
      const cible = (c: "cat1" | "cat2" | "cat3") => computeRenteInvalCollective(cov, c, 30000, 0, 30000, 0);
      expect(cible("cat1")).toBeCloseTo(30000 * 0.70, 2);
      expect(cible("cat2")).toBeCloseTo(30000 * 0.70, 2);
      expect(cible("cat3")).toBeCloseTo(30000 * 0.70, 2);
    }
  });
});

// ── Maintien : 90 j a 100 % (entier), carence 0, identique cadres/nonCadres ────
describe("1672 — maintien employeur art. 82 (statut unique)", () => {
  for (const cat of ["cadres", "nonCadres"] as const) {
    it(`${cat} : carence 0, 90 j a pct === 100 (ENTIER)`, () => {
      const m = getMaintienParams("1672", referentiels, cat);
      expect(m.source).toBe("ccn");
      expect(m.carenceJours).toBe(0);
      const palier = m.paliers.find((p) => p.ancienneteMois === 12);
      expect(palier).toBeDefined();
      expect(palier!.segments).toEqual([{ jours: 90, pct: 100 }]);
      expect(palier!.segments[0].pct).toBe(100); // ENTIER, jamais une fraction
    });
  }
});

// ── renteConjoint : absente ───────────────────────────────────────────────────
describe("1672 — pas de rente conjoint de branche", () => {
  it("rente conjoint indisponible (conforme au regime, pas un gap)", () => {
    expect(resolveRenteConjointSubstitutiveBranche("1672", "cadres", 30000, PASS, referentiels).donneeIndisponible).toBe(true);
  });
});

// ── Garde-fou routage : un cadre IDCC 1672 a bien les memes garanties ──────────
describe("1672 — routage cadre/non-cadre (garanties identiques)", () => {
  it("categorieBranche route par statutPro et les deux colleges sont servis", () => {
    expect(categorieBranche("1672", "salarie_cadre", referentiels)).toBe("cadres");
    expect(categorieBranche("1672", "salarie_non_cadre", referentiels)).toBe("nonCadres");
    const cadre = resolveCapitalDecesBranche("1672", "cadres", 30000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).capital;
    const nonCadre = resolveCapitalDecesBranche("1672", "nonCadres", 30000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).capital;
    expect(cadre).toBeCloseTo(nonCadre ?? -1, 2);
  });
});
