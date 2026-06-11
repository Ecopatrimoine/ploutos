// ─── LOT HOSP-1 — CCN 2264 Hospitalisation privee (regime assure art. 84) ──────
//
// Regime de branche COMPLET sans condition d'anciennete (palier 0, premier de la
// base) et avec carence reelle non nulle (3 j non-cadres, premiere carence > 0).
// Capital UNIFORME 85 % (option b, aucune majoration famille), rente education
// 5/10/15 % (bornes texte 12/18/25), IJ mono-taux 80 % (lecture A plancher),
// invalidite 50/85/85. PAS de devolution conventionnelle, PAS de plafond PASS.
// Garanties identiques cadres/non-cadres (seule la carence du maintien differe).
// PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import {
  computeIJCollective,
  computeRenteInvalCollective,
  getMaintienParams,
} from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";

const PASS = 48060;

describe("2264 — entree presente, nom, PAS de plafond PASS", () => {
  it("entree existe, nom Hospitalisation privee, aucun plafondSalaireRefPass", () => {
    const conv = (referentiels.ccn as any).conventions["2264"];
    expect(conv).toBeDefined();
    expect(conv.nom).toContain("Hospitalisation privee");
    expect(conv.plafondSalaireRefPass).toBeUndefined();
    expect(conv.devolutionCapitalDeces).toBeUndefined(); // pas de clause conventionnelle
  });
});

// ── Maintien : palier ancienneteMois 0 actif, carence 0 cadres / 3 non-cadres ──
describe("2264 — maintien employeur art. 84.1 (sans condition d'anciennete)", () => {
  it("cadres : carence 0, palier ancienneteMois 0 actif, 90 j a pct === 100", () => {
    const m = getMaintienParams("2264", referentiels, "cadres");
    expect(m.source).toBe("ccn");
    expect(m.carenceJours).toBe(0);
    const palier = m.paliers.find((p) => p.ancienneteMois === 0);
    expect(palier).toBeDefined(); // palier 0 retenu (regime sans condition d'anciennete)
    expect(palier!.segments).toEqual([{ jours: 90, pct: 100 }]);
    expect(palier!.segments[0].pct).toBe(100); // ENTIER
  });

  it("non-cadres : carence 3 (premiere carence reelle de la base), palier 0, 90 j a 100", () => {
    const m = getMaintienParams("2264", referentiels, "nonCadres");
    expect(m.source).toBe("ccn");
    expect(m.carenceJours).toBe(3);
    const palier = m.paliers.find((p) => p.ancienneteMois === 0);
    expect(palier).toBeDefined();
    expect(palier!.segments).toEqual([{ jours: 90, pct: 100 }]);
  });
});

// ── IJ mono-taux 80 % (lecture A), franchise 90, extinction a la bascule ───────
describe("2264 — IJ de branche 80 % (lecture A plancher, mono-taux)", () => {
  const branche = resolveCouvertureBranche("2264", "cadres", referentiels);
  const cov: CouvertureCollective = { ij: branche.ij };
  const ij = (t: number) => computeIJCollective(t, cov, 1000, 0); // assiette 1000 -> € directs

  it("mono-taux 0.80 (FRACTION), franchise 90, plafondJours 1004, pas de paliers", () => {
    expect(branche.ij?.pctSalaire).toBe(0.80);
    expect(branche.ij?.franchise).toBe(90);
    expect(branche.ij?.plafondJours).toBe(1004);
    expect(branche.ij?.paliers).toBeUndefined();
  });

  it("t<90 -> 0 (le maintien porte la fenetre) ; t=90 et t=1094 -> 0.80 ; t=1095 -> 0", () => {
    expect(ij(89)).toBe(0);        // franchise : IJ inactive, le maintien employeur couvre
    expect(ij(90)).toBeCloseTo(800);
    expect(ij(1094)).toBeCloseTo(800); // dernier jour servi
    expect(ij(1095)).toBe(0);          // extinction a la bascule invalidite
  });
});

// ── Capital UNIFORME 85 % : aucune variation par situation familiale ──────────
describe("2264 — capital deces 85 % UNIFORME (option b, aucune majoration)", () => {
  const cap = (famille: any, salaire = 40000) =>
    resolveCapitalDecesBranche("2264", "cadres", salaire, PASS, referentiels, famille).capital;

  it("85 % du brut, IDENTIQUE isole 0 enfant et marie 2 enfants (aucune majoration)", () => {
    const isole = cap({ nbEnfantsACharge: 0 });
    const marie2 = cap({ conjointPresent: true, nbEnfantsACharge: 2 });
    expect(isole).toBeCloseTo(0.85 * 40000, 2);  // 34 000
    expect(marie2).toBeCloseTo(0.85 * 40000, 2); // 34 000 — meme montant
    expect(marie2).toBeCloseTo(isole ?? -1, 2);
  });
});

// ── Rente education 5/10/15 %, bornes texte 12/18/25, extinction 25 ───────────
describe("2264 — rente education (bornes du texte 12/18/25)", () => {
  const re = (age: number, salaire = 40000) =>
    resolveRenteEducationBranche("2264", "cadres", salaire, PASS, age, referentiels).montantAnnuelCourant;

  it("ages 5/13/20 -> 5/10/15 %", () => {
    expect(re(5)).toBeCloseTo(0.05 * 40000, 2);
    expect(re(13)).toBeCloseTo(0.10 * 40000, 2);
    expect(re(20)).toBeCloseTo(0.15 * 40000, 2);
  });

  it("pivots aAge exclusifs : age 12 -> 10 % ; age 18 -> 15 %", () => {
    expect(re(12)).toBeCloseTo(0.10 * 40000, 2);
    expect(re(18)).toBeCloseTo(0.15 * 40000, 2);
  });

  it("extinction a 25 ans (borne texte, et non 26) : age 25 -> 0", () => {
    expect(re(25)).toBe(0);
  });
});

// ── Invalidite 50/85/85 injectee, cadre ET non-cadre ──────────────────────────
describe("2264 — invalidite cibles 50/85/85 (injection sans couverture saisie)", () => {
  it("cat1 50 %, cat2/cat3 85 % injectes pour un salarie IDCC 2264 (cadre ET non-cadre)", () => {
    for (const cat of ["cadres", "nonCadres"] as const) {
      const branche = resolveCouvertureBranche("2264", cat, referentiels);
      expect(branche.donneeIndisponible).toBe(false);
      expect(branche.invalidite).toBeDefined();
      const cov: CouvertureCollective = { invalidite: branche.invalidite };
      const cible = (c: "cat1" | "cat2" | "cat3") => computeRenteInvalCollective(cov, c, 40000, 0, 40000, 0);
      expect(cible("cat1")).toBeCloseTo(40000 * 0.50, 2);
      expect(cible("cat2")).toBeCloseTo(40000 * 0.85, 2);
      expect(cible("cat3")).toBeCloseTo(40000 * 0.85, 2);
    }
  });
});

// ── Pas de rente conjoint de branche ──────────────────────────────────────────
describe("2264 — pas de rente conjoint de branche", () => {
  it("rente conjoint indisponible (conforme au regime)", () => {
    expect(resolveRenteConjointSubstitutiveBranche("2264", "cadres", 40000, PASS, referentiels).donneeIndisponible).toBe(true);
  });
});
