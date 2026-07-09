// LOT 9 — garde-fous : états vides (C1) + alerte rattachement fiscal (C3).
import { describe, it, expect } from "vitest";
import {
  ifiEstVide, irEstVide, successionEstVide,
  alerteRattachementEnfant, ALERTE_RATTACHEMENT_21, ALERTE_RATTACHEMENT_25,
} from "../lib/gardefous";

describe("états vides des onglets d'analyse (C1)", () => {
  it("ifiEstVide : vide sans ligne, plein dès un bien", () => {
    expect(ifiEstVide({ lines: [] })).toBe(true);
    expect(ifiEstVide({})).toBe(true);
    expect(ifiEstVide({ lines: [{}] })).toBe(false);
  });

  it("irEstVide : vide sans aucun revenu", () => {
    expect(irEstVide({})).toBe(true);
    expect(irEstVide({ salaries: 0, foncierBrut: 0, taxablePlacements: 0, revenuNetGlobal: 0 })).toBe(true);
  });

  it("irEstVide : NON vide dès un revenu (salaire / foncier brut / pension)", () => {
    expect(irEstVide({ salaries: 30000, revenuNetGlobal: 27000 })).toBe(false);
    // foncier brut présent même si le net global est négatif (déficit) -> pas vide
    expect(irEstVide({ foncierBrut: 5000, revenuNetGlobal: -2000 })).toBe(false);
    // pension : passe par le net global seul
    expect(irEstVide({ revenuNetGlobal: 18000 })).toBe(false);
  });

  it("successionEstVide : vide sans patrimoine, plein dès un bien ou un placement", () => {
    expect(successionEstVide({ properties: [], placements: [] })).toBe(true);
    expect(successionEstVide({ properties: [{}] as any, placements: [] })).toBe(false);
    expect(successionEstVide({ properties: [], placements: [{}] as any })).toBe(false);
  });
});

describe("alerte rattachement fiscal (C3) — 21/25 × scolarisé × handicap", () => {
  const base = { rattached: true, handicap: false, schoolLevel: "" };

  it("<= 21 ans : aucune alerte", () => {
    expect(alerteRattachementEnfant(base, 20)).toBeNull();
    expect(alerteRattachementEnfant(base, 21)).toBeNull();
  });

  it("21 < âge <= 25 non scolarisé : alerte de base", () => {
    expect(alerteRattachementEnfant(base, 23)).toBe(ALERTE_RATTACHEMENT_21);
    expect(alerteRattachementEnfant(base, 25)).toBe(ALERTE_RATTACHEMENT_21);
  });

  it("21 < âge <= 25 EN études : aucune alerte", () => {
    expect(alerteRattachementEnfant({ ...base, schoolLevel: "superieur" }, 23)).toBeNull();
  });

  it("> 25 ans : alerte renforcée (même en études : 25 max)", () => {
    expect(alerteRattachementEnfant(base, 26)).toBe(ALERTE_RATTACHEMENT_25);
    expect(alerteRattachementEnfant({ ...base, schoolLevel: "superieur" }, 30)).toBe(ALERTE_RATTACHEMENT_25);
  });

  it("handicap coché : JAMAIS d'alerte (rattachement sans condition d'âge)", () => {
    expect(alerteRattachementEnfant({ ...base, handicap: true }, 30)).toBeNull();
    expect(alerteRattachementEnfant({ ...base, handicap: true }, 23)).toBeNull();
  });

  it("enfant non rattaché : aucune alerte", () => {
    expect(alerteRattachementEnfant({ ...base, rattached: false }, 30)).toBeNull();
  });

  it("âge inconnu (date absente) : aucune alerte", () => {
    expect(alerteRattachementEnfant(base, null)).toBeNull();
  });
});
