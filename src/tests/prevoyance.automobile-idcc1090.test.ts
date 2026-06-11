// ─── LOT AUTO-1 — CCN 1090 Services de l'automobile (RPO IRP AUTO) ─────────────
//
// Regime de branche a COLLEGES ASYMETRIQUES (le coeur du lot) :
//   - OEA (nonCadres) : capital 150 % PASS + rente de CONJOINT, IJ franchise 45,
//     maintien 45 j ; PAS de rente education.
//   - cadres : capital 250 % PASS + rente d'EDUCATION (forfait % PASS), IJ franchise
//     90, maintien 90 j ; PAS de rente de conjoint.
// Capital forfaitaire en EUROS 2026 (ARBRE 2, pas d'unite pctPass). Invalidite
// ADDITIVE cat2/cat3 30 %, cat1 a 0 (ARBRE 1). Rente conjoint cibleCumulable 2 %
// (ARBRE 3). Devolution 5 rangs conjoint/PACS separes, sans representation.
// PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { computeIJCollective, getMaintienParams } from "../lib/prevoyance/projection";
import { resolveDevolutionCapitalDecesConfig } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";

const PASS = 48060;

describe("1090 — entree presente, nom, plafond 4 PASS", () => {
  it("entree existe, nom Services de l'automobile, plafondSalaireRefPass 4", () => {
    const conv = (referentiels.ccn as any).conventions["1090"];
    expect(conv).toBeDefined();
    expect(conv.nom).toContain("Services de l'automobile");
    expect(conv.plafondSalaireRefPass).toBe(4);
  });
});

// ── Maintien : nonCadres 45 j / cadres 90 j, carence 0, palier 12 mois ────────
describe("1090 — maintien employeur (asymetrie OEA 45 j / cadres 90 j)", () => {
  it("nonCadres : carence 0, palier 12 mois, 45 j a pct === 100", () => {
    const m = getMaintienParams("1090", referentiels, "nonCadres");
    expect(m.source).toBe("ccn");
    expect(m.carenceJours).toBe(0);
    const palier = m.paliers.find((p) => p.ancienneteMois === 12);
    expect(palier!.segments).toEqual([{ jours: 45, pct: 100 }]);
    expect(palier!.segments[0].pct).toBe(100);
  });

  it("cadres : carence 0, palier 12 mois, 90 j a pct === 100", () => {
    const m = getMaintienParams("1090", referentiels, "cadres");
    expect(m.carenceJours).toBe(0);
    const palier = m.paliers.find((p) => p.ancienneteMois === 12);
    expect(palier!.segments).toEqual([{ jours: 90, pct: 100 }]);
  });
});

// ── IJ paliers (3e usage ASSUR-0), franchise asymetrique ─────────────────────
describe("1090 — IJ de branche a paliers (100 % puis 30 %)", () => {
  const ijNC = (t: number) => computeIJCollective(t, { ij: resolveCouvertureBranche("1090", "nonCadres", referentiels).ij }, 1000, 0);
  const ijC = (t: number) => computeIJCollective(t, { ij: resolveCouvertureBranche("1090", "cadres", referentiels).ij }, 1000, 0);

  it("nonCadres : t=44 -> 0 ; t=45 et t=179 -> 1.00 ; t=180 et t=1094 -> 0.30 ; t=1095 -> 0", () => {
    expect(ijNC(44)).toBe(0);          // franchise 45
    expect(ijNC(45)).toBeCloseTo(1000);
    expect(ijNC(179)).toBeCloseTo(1000);
    expect(ijNC(180)).toBeCloseTo(300);
    expect(ijNC(1094)).toBeCloseTo(300);
    expect(ijNC(1095)).toBe(0);
  });

  it("cadres : t=89 -> 0 ; t=90 -> 1.00 ; t=180 -> 0.30 (bornes half-open, fractions)", () => {
    expect(ijC(89)).toBe(0);           // franchise 90
    expect(ijC(90)).toBeCloseTo(1000);
    expect(ijC(180)).toBeCloseTo(300);
    // FRACTIONS (jamais entiers) sur le 1er palier.
    expect(resolveCouvertureBranche("1090", "cadres", referentiels).ij?.paliers?.[0].pctSalaire).toBe(1.0);
  });
});

// ── Invalidite ADDITIVE (ARBRE 1) : cat1 a 0, cat2 = cat3 = 0.30 ─────────────
describe("1090 — invalidite mode additif (cat1 a 0, cat2/cat3 0.30)", () => {
  it("forme additif effective, base brut, cat1 0 / cat2 0.30 / cat3 0.30 (cadre ET non-cadre)", () => {
    for (const cat of ["nonCadres", "cadres"] as const) {
      const inv = resolveCouvertureBranche("1090", cat, referentiels).invalidite;
      expect(inv?.mode).toBe("additif");
      expect(inv?.base).toBe("brut");
      expect(inv?.cat1.pctSalaire).toBe(0);   // ARBRE 1 : cat1 non posee (omission conservatrice)
      expect(inv?.cat2.pctSalaire).toBe(0.30);
      expect(inv?.cat3.pctSalaire).toBe(0.30);
    }
  });
});

// ── Capital forfaitaire euros (ARBRE 2) : nonCadres 72 090 / cadres 120 150 ──
describe("1090 — capital deces forfaitaire (euros 2026, independant du salaire)", () => {
  const cap = (cat: "cadres" | "nonCadres", famille: any, salaire = 28000) =>
    resolveCapitalDecesBranche("1090", cat, salaire, PASS, referentiels, famille).capital;

  it("nonCadres : avecConjoint = 150 % PASS = 72 090 ; sansConjoint identique (majoration isole non representee)", () => {
    const avec = cap("nonCadres", { conjointPresent: true, nbEnfantsACharge: 2 });
    const sans = cap("nonCadres", { nbEnfantsACharge: 0 });
    expect(avec).toBeCloseTo(1.5 * PASS, 2); // 72 090
    expect(sans).toBeCloseTo(1.5 * PASS, 2); // identique (ARBRE 2 : +25 % SR isole non representable)
    expect(sans).toBeCloseTo(avec ?? -1, 2);
  });

  it("cadres 60 ke marie -> 250 % PASS = 120 150 EUR, INDEPENDANT du salaire", () => {
    expect(cap("cadres", { conjointPresent: true }, 60000)).toBeCloseTo(2.5 * PASS, 2); // 120 150
    expect(cap("cadres", { conjointPresent: true }, 200000)).toBeCloseTo(2.5 * PASS, 2); // idem (forfait euros)
  });
});

// ── Devolution : 5 rangs, conjoint/PACS SEPARES, concubin absent, sans repr ──
describe("1090 — devolution capital deces (5 rangs, conjoint et PACS separes)", () => {
  const config = resolveDevolutionCapitalDecesConfig("1090", referentiels);

  it("5 rangs : conjoint -> pacs -> enfants -> ascendants -> succession, sans representation", () => {
    expect(config!.rangs).toHaveLength(5);
    expect(config!.rangs[0].qualites).toEqual(["conjoint"]);
    expect(config!.rangs[1].qualites).toEqual(["pacs"]);      // PACS rang PROPRE (separe du conjoint)
    expect(config!.rangs[2].qualites).toEqual(["enfants"]);
    expect(config!.rangs[3].qualites).toEqual(["ascendants"]);
    expect(config!.rangs[4].qualites).toEqual(["devolutionSuccessorale"]);
    // Concubin ABSENT de la cascade ; aucune representation.
    expect(config!.rangs.some((r) => r.qualites.includes("concubin" as any))).toBe(false);
    expect(config!.rangs.some((r) => r.representation === true)).toBe(false);
  });
});

// ── ASYMETRIE DE COLLEGE (coeur des assertions) ──────────────────────────────
describe("1090 — asymetrie de college : rente conjoint OEA vs rente education cadres", () => {
  it("rente de conjoint : PRESENTE non-cadres / ABSENTE cadres", () => {
    // nonCadres : cibleCumulable 2 %, age defunt 40 < 64 -> resout.
    const rcNC = resolveRenteConjointSubstitutiveBranche("1090", "nonCadres", 28000, PASS, referentiels, 40);
    expect(rcNC.donneeIndisponible).toBe(false);
    expect(rcNC.montantAnnuel).toBeCloseTo(0.02 * 28000, 2); // 2 % du SR
    expect(rcNC.cumulableAvecRenteEducation).toBe(true);     // cibleCumulable -> pas bloquee par les enfants
    // cadres : renteConjoint null -> indisponible.
    expect(resolveRenteConjointSubstitutiveBranche("1090", "cadres", 55000, PASS, referentiels, 40).donneeIndisponible).toBe(true);
  });

  it("rente d'education : PRESENTE cadres ([0,16) 8 % PASS, [16,25) 10 %, extinction 25) / ABSENTE non-cadres", () => {
    const reC = (age: number) => resolveRenteEducationBranche("1090", "cadres", 55000, PASS, age, referentiels).montantAnnuelCourant;
    expect(reC(10)).toBeCloseTo(0.08 * PASS, 2); // 3 844,80 (< 16 ans)
    expect(reC(20)).toBeCloseTo(0.10 * PASS, 2); // 4 806 (16-<25)
    expect(reC(25)).toBe(0);                     // extinction a 25
    // non-cadres : renteEducation null -> indisponible.
    expect(resolveRenteEducationBranche("1090", "nonCadres", 28000, PASS, 10, referentiels).donneeIndisponible).toBe(true);
  });
});
