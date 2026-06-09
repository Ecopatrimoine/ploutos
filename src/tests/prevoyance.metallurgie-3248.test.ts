// ─── CCN Métallurgie (IDCC 3248) — périmètre réduit, modes existants ────────
//
// Capital décès 200 % (cadre) / 100 % (non-cadre) du salaire de référence brut,
// plafonné à 8 PASS (art 17.3) ; rente éducation 4/6/8 % par âge (art 17.4) ;
// dévolution cascade exclusive avec CONCUBIN ADMIS au rang 1 (contrairement à
// HCR). IJ et invalidité de branche NON posées dans le JSON (IJ : mode paliers
// temporels différé ; invalidité : valeurs TO_VERIFY art 17.2 — non diffusées
// dans la projection tant que non confirmées). PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import {
  devolutionCapitalDecesBranche,
  devolutionCapitalDecesBrancheCascade,
  resolveDevolutionCapitalDecesConfig,
} from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { PatrimonialData } from "../types/patrimoine";

const PASS = 48060;

function child(firstName: string, parentLink = "common_child") {
  return { firstName, lastName: "Martin", birthDate: "2014-01-01", parentLink, custody: "full", rattached: true, handicap: false };
}
function data(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin",
    person2FirstName: "Marie", person2LastName: "Martin",
    coupleStatus: "married", childrenData: [],
    ...over,
  } as unknown as PatrimonialData;
}

describe("Métallurgie (3248) — capital décès (200 % cadre / 100 % non-cadre, plafond 8 PASS)", () => {
  it("cadre brut 60 000 (< 8 PASS) → 2,00 × 60 000 = 120 000", () => {
    const r = resolveCapitalDecesBranche("3248", "cadres", 60000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(120000, 2);
  });

  it("cadre brut 500 000 (> 8 PASS) → 2,00 × (8 × PASS) = 768 960 (plafond mord)", () => {
    const r = resolveCapitalDecesBranche("3248", "cadres", 500000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(2.0 * 8 * PASS, 2);
  });

  it("non-cadre = 1,00 × min(brut, 8 PASS)", () => {
    expect(resolveCapitalDecesBranche("3248", "nonCadres", 30000, PASS, referentiels).capital).toBeCloseTo(30000, 2);
    expect(resolveCapitalDecesBranche("3248", "nonCadres", 500000, PASS, referentiels).capital).toBeCloseTo(8 * PASS, 2);
  });
});

describe("Métallurgie (3248) — dévolution (CONCUBIN ADMIS au rang 1)", () => {
  it("concubin SEUL (ni conjoint ni PACS) → le concubin reçoit le capital (rang 1, point clé Métallurgie)", () => {
    const r = devolutionCapitalDecesBranche(120000, data({ coupleStatus: "cohab" }), "p1", "3248", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "autre", montant: 120000 });
    expect(r[0].beneficiaire).toContain("Marie");
  });

  it("conjoint + enfants → conjoint 100 % (cascade exclusive)", () => {
    const r = devolutionCapitalDecesBranche(
      120000,
      data({ coupleStatus: "married", childrenData: [child("Léa"), child("Tom")] as PatrimonialData["childrenData"] }),
      "p1", "3248", referentiels
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "conjoint", montant: 120000 });
  });

  it("ni partenaire ni enfant, ascendants présents → ascendants (parts égales)", () => {
    const config = resolveDevolutionCapitalDecesConfig("3248", referentiels);
    const r = devolutionCapitalDecesBrancheCascade(120000, { enfants: [], ascendants: ["Pere", "Mere"] }, config);
    expect(r).toHaveLength(2);
    expect(r.every((l) => l.relation === "ascendant" && l.montant === 60000)).toBe(true);
  });
});

describe("Métallurgie (3248) — rente éducation (4 % / 6 % / 8 % par âge)", () => {
  it("enfant 10 ans → 4 % × brut", () => {
    const r = resolveRenteEducationBranche("3248", "nonCadres", 30000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuelCourant).toBeCloseTo(0.04 * 30000, 2); // 1 200
  });

  it("enfant 17 ans → 6 % × brut", () => {
    expect(resolveRenteEducationBranche("3248", "nonCadres", 30000, PASS, 17, referentiels).montantAnnuelCourant)
      .toBeCloseTo(0.06 * 30000, 2); // 1 800
  });

  it("enfant 22 ans → 8 % × brut", () => {
    expect(resolveRenteEducationBranche("3248", "nonCadres", 30000, PASS, 22, referentiels).montantAnnuelCourant)
      .toBeCloseTo(0.08 * 30000, 2); // 2 400
  });

  it("enfant 26 ans → 0 (hors tranches [0,16) [16,19) [19,26))", () => {
    expect(resolveRenteEducationBranche("3248", "nonCadres", 30000, PASS, 26, referentiels).montantAnnuelCourant)
      .toBe(0);
  });
});

describe("Métallurgie (3248) — invalidité (PRIMARY art 17.2.c avenant n1)", () => {
  // Valeurs PRIMARY (art 17.2.c annexe 9, avenant n1) : cadre 45/75/75,
  // non-cadre 42/70/70. Sémantique = cible sous déduction Secu (identique HCR/
  // Syntec). Assiette NON plafonnée 8 PASS (art 17.2.b — raffinement différé).
  it("cadre → cat1 45 %, cat2/3 75 % (PRIMARY art 17.2.c avenant n1)", () => {
    const r = resolveCouvertureBranche("3248", "cadres", referentiels);
    expect(r.invalidite).toEqual({ cat1: { pctSalaire: 0.45 }, cat2: { pctSalaire: 0.75 }, cat3: { pctSalaire: 0.75 } });
  });

  it("non-cadre → cat1 42 %, cat2/3 70 % (PRIMARY art 17.2.c avenant n1)", () => {
    const r = resolveCouvertureBranche("3248", "nonCadres", referentiels);
    expect(r.invalidite).toEqual({ cat1: { pctSalaire: 0.42 }, cat2: { pctSalaire: 0.70 }, cat3: { pctSalaire: 0.70 } });
  });
});
