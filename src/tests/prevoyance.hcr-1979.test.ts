// ─── LOT HCR-3.3a — Données prévoyance HCR (IDCC 1979) ──────────────────────
//
// Garanties HCR (art. 18 accord prévoyance 02/11/2004) : capital décès 150 % du
// salaire de référence (plafonné à 1 PASS), rente éducation 12 % (<8 ans) / 18 %
// (8-26 ans), IJ 70 % (base T1_seul, franchise 90 j, plafond 1005 j), invalidité
// cat1 45 % / cat2-3 70 %, IDENTIQUES cadres et non-cadres. Dévolution : conjoint
// OU PACS au rang 1 (PAS de concubin, contrairement à Syntec). PASS 2026 = 48 060.
// Pur DATA : ce lot ne touche aucun .ts moteur, il valide les formes posées.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { devolutionCapitalDecesBranche } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { PatrimonialData } from "../types/patrimoine";

const PASS = 48060;

// data minimal pour la dévolution (lit coupleStatus, childrenData, noms, prevoyance).
function child(firstName: string, parentLink = "common_child") {
  return { firstName, lastName: "Martin", birthDate: "2014-01-01", parentLink, custody: "full", rattached: true, handicap: false };
}
function data(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin",
    person2FirstName: "Marie", person2LastName: "Martin",
    coupleStatus: "married",
    childrenData: [],
    ...over,
  } as unknown as PatrimonialData;
}

describe("HCR (1979) — capital décès (plafond 1 PASS, 150 % salaire réf.)", () => {
  it("non-cadre, brut 30 000 (< 1 PASS) → 1,50 × 30 000 = 45 000", () => {
    const r = resolveCapitalDecesBranche("1979", "nonCadres", 30000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(45000, 2);
  });

  it("cadre, brut 60 000 (> 1 PASS) → salaireRef plafonné 48 060 → 1,50 × 48 060 = 72 090", () => {
    const r = resolveCapitalDecesBranche("1979", "cadres", 60000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(1.5 * 1 * PASS, 2); // 72 090 (prouve plafond 1 PASS HCR)
  });

  it("cadre ET non-cadre → MÊME capital à brut égal (garanties identiques)", () => {
    const cadre = resolveCapitalDecesBranche("1979", "cadres", 30000, PASS, referentiels);
    const nonCadre = resolveCapitalDecesBranche("1979", "nonCadres", 30000, PASS, referentiels);
    expect(cadre.capital).toBeCloseTo(45000, 2);
    expect(nonCadre.capital).toBeCloseTo(45000, 2);
    expect(cadre.capital).toBe(nonCadre.capital);
  });
});

describe("HCR (1979) — dévolution (conjoint/PACS rang 1, PAS de concubin)", () => {
  it("marié, capital 45 000 → 1 ligne conjoint 45 000", () => {
    const r = devolutionCapitalDecesBranche(45000, data({ coupleStatus: "married" }), "p1", "1979", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "conjoint", montant: 45000, source: "auto" });
  });

  it("PACS → 1 ligne pacs_partner 45 000", () => {
    const r = devolutionCapitalDecesBranche(45000, data({ coupleStatus: "pacs" }), "p1", "1979", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "pacs_partner", montant: 45000 });
  });

  it("concubin (cohab) + 1 enfant → 1 ligne ENFANT 45 000 (concubin NON admis rang 1)", () => {
    const r = devolutionCapitalDecesBranche(
      45000,
      data({ coupleStatus: "cohab", childrenData: [child("Léa")] as PatrimonialData["childrenData"] }),
      "p1", "1979", referentiels
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "enfant", montant: 45000 });
    expect(r[0].beneficiaire).toContain("Léa");
  });

  it("concubin (cohab) + 0 enfant → [] (à déterminer)", () => {
    const r = devolutionCapitalDecesBranche(45000, data({ coupleStatus: "cohab" }), "p1", "1979", referentiels);
    expect(r).toEqual([]);
  });
});

describe("HCR (1979) — rente éducation (12 % < 8 ans, 18 % de 8 à 26 ans)", () => {
  it("enfant 5 ans → 0,12 × 30 000 = 3 600 /an", () => {
    const r = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 5, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuelCourant).toBeCloseTo(3600, 2);
  });

  it("enfant 12 ans → 0,18 × 30 000 = 5 400 /an", () => {
    const r = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 12, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(5400, 2);
  });

  it("enfant 26 ans → 0 (hors borne, plus à charge)", () => {
    const r = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 26, referentiels);
    expect(r.montantAnnuelCourant).toBe(0);
  });

  it("source = nom de CCN dynamique (LOT LABEL-CCN) : 1979 → HCR, 1486 → Syntec", () => {
    const hcr = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 5, referentiels);
    expect(hcr.source).toContain("Hôtels");
    expect(hcr.source).not.toContain("Syntec");
    const syntec = resolveRenteEducationBranche("1486", "cadres", 60000, PASS, 10, referentiels);
    expect(syntec.source).toContain("Syntec");
  });
});

describe("HCR (1979) — IJ / invalidité (resolveCouvertureBranche)", () => {
  it("IJ : 70 %, franchise 90, plafond 1005, base T1_seul", () => {
    const r = resolveCouvertureBranche("1979", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.ij).toEqual({ pctSalaire: 0.70, franchise: 90, plafondJours: 1005, baseCalcul: "T1_seul" });
  });

  it("invalidité : cat1 45 %, cat2/cat3 70 %", () => {
    const r = resolveCouvertureBranche("1979", "cadres", referentiels);
    expect(r.invalidite).toEqual({
      cat1: { pctSalaire: 0.45 }, cat2: { pctSalaire: 0.70 }, cat3: { pctSalaire: 0.70 },
    });
  });

  it("non-cadre identique au cadre (garanties non différenciées)", () => {
    const cadre = resolveCouvertureBranche("1979", "cadres", referentiels);
    const nonCadre = resolveCouvertureBranche("1979", "nonCadres", referentiels);
    expect(nonCadre.ij).toEqual(cadre.ij);
    expect(nonCadre.invalidite).toEqual(cadre.invalidite);
  });
});

describe("HCR (1979) — NON-RÉGRESSION : Syntec (1486) inchangé", () => {
  it("capital Syntec cadre 60 000 → 163 404 (plancher 3,40 PASS, plafond 8 PASS)", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(163404, 2);
  });

  it("dévolution Syntec concubin (cohab) → relation autre 100 % (concubin admis rang 1)", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ coupleStatus: "cohab" }), "p1", "1486", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "autre", montant: 100000 });
  });
});
