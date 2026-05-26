// ─── Tests Lot 5 — helper referencesLegales (statuts ∩ prestations) ─────────
//
// Vérifient les invariants critiques :
//   1. JAMAIS de RG AMF ni de MIF II tant que `cif` n'est pas coché.
//   2. Socle par statut conforme au tableau du prompt (COA/MIA, IOBSP, CIF, T).
//   3. Les numéros paramétrables (L.521-x, RG AMF) sont marqués « à confirmer ».

import { describe, it, expect } from "vitest";
import { referencesLegales, type StatutFlags } from "../lib/conformite/referencesLegales";

const NO_STATUTS: StatutFlags = {
  coa: false, mia: false, iobsp: false, cif: false, carteT: false,
};

describe("referencesLegales — règle critique : aucun RG AMF / MIF II sans CIF", () => {
  it("COA seul → aucune référence RG AMF ni MIF II", () => {
    const refs = referencesLegales({ ...NO_STATUTS, coa: true });
    expect(refs.some(r => /RG AMF/i.test(r.code))).toBe(false);
    expect(refs.some(r => /MIF/i.test(r.code))).toBe(false);
  });

  it("MIA seul → aucune référence RG AMF ni MIF II", () => {
    const refs = referencesLegales({ ...NO_STATUTS, mia: true });
    expect(refs.some(r => /RG AMF|MIF/i.test(r.code))).toBe(false);
  });

  it("IOBSP seul → aucune référence RG AMF ni MIF II", () => {
    const refs = referencesLegales({ ...NO_STATUTS, iobsp: true });
    expect(refs.some(r => /RG AMF|MIF/i.test(r.code))).toBe(false);
  });

  it("Carte T seule → aucune référence RG AMF ni MIF II", () => {
    const refs = referencesLegales({ ...NO_STATUTS, carteT: true });
    expect(refs.some(r => /RG AMF|MIF/i.test(r.code))).toBe(false);
  });
});

describe("referencesLegales — socle par statut", () => {
  it("COA seul → Code des assurances L.511-1 / L.521-1 et s. / L.522-1 et s. + DDA", () => {
    const refs = referencesLegales({ ...NO_STATUTS, coa: true });
    const articles = refs.map(r => r.article);
    expect(articles).toContain("L.511-1 et s.");
    expect(articles).toContain("L.521-1 et s.");
    expect(articles).toContain("L.522-1 et s.");
    expect(refs.some(r => /DDA/.test(r.code))).toBe(true);
    expect(refs.every(r => r.statut === "coa")).toBe(true);
  });

  it("Cocher CIF fait apparaître CMF L.541-1 s. + RG AMF + MIF II", () => {
    const refs = referencesLegales({ ...NO_STATUTS, coa: true, cif: true });
    const articles = refs.map(r => r.article);
    const codes = refs.map(r => r.code);
    expect(articles).toContain("L.541-1 et s.");
    expect(codes).toContain("RG AMF");
    expect(codes.some(c => /MIF/.test(c))).toBe(true);
  });

  it("Décocher CIF fait disparaître CMF L.541-1 s., RG AMF et MIF II", () => {
    const refs = referencesLegales({ ...NO_STATUTS, coa: true, cif: false });
    const articles = refs.map(r => r.article);
    const codes = refs.map(r => r.code);
    expect(articles).not.toContain("L.541-1 et s.");
    expect(codes).not.toContain("RG AMF");
    expect(codes.some(c => /MIF/.test(c))).toBe(false);
  });

  it("IOBSP → CMF L.519-1 et s. + MCD", () => {
    const refs = referencesLegales({ ...NO_STATUTS, iobsp: true });
    expect(refs.some(r => r.article === "L.519-1 et s.")).toBe(true);
    expect(refs.some(r => /MCD/.test(r.code))).toBe(true);
  });

  it("Carte T → Loi Hoguet 70-9 + décret 72-678", () => {
    const refs = referencesLegales({ ...NO_STATUTS, carteT: true });
    expect(refs.some(r => /Hoguet/.test(r.code))).toBe(true);
    expect(refs.some(r => /72-678/.test(r.code))).toBe(true);
  });

  it("Aucun statut actif → aucune référence", () => {
    expect(referencesLegales(NO_STATUTS)).toEqual([]);
  });
});

describe("referencesLegales — libellés génériques pro (refacto wording Lot Dossier)", () => {
  // Le refactor wording a remplacé les libellés provisoires « L.521-x à confirmer »
  // par des références génériques affirmatives (« L.521-1 et s. » + libellé complet
  // « DDA transposée en droit français »). Ces tests vérifient l'absence du
  // marqueur « à confirmer » (régression) et la présence des nouveaux libellés.
  it("L.521-1 et s. n'est PLUS marqué « à confirmer » (refacto wording)", () => {
    const refs = referencesLegales({ ...NO_STATUTS, coa: true });
    const r = refs.find(x => x.article === "L.521-1 et s.");
    expect(r).toBeDefined();
    expect(r?.note).toBeUndefined();
  });

  it("L.522-1 et s. n'est PLUS marqué « à confirmer » (refacto wording)", () => {
    const refs = referencesLegales({ ...NO_STATUTS, coa: true });
    const r = refs.find(x => x.article === "L.522-1 et s.");
    expect(r).toBeDefined();
    expect(r?.note).toBeUndefined();
  });

  it("RG AMF n'est PLUS marqué « à confirmer » (libellé Livre III à la place)", () => {
    const refs = referencesLegales({ ...NO_STATUTS, cif: true });
    const r = refs.find(x => x.code === "RG AMF");
    expect(r).toBeDefined();
    expect(r?.note).toBeUndefined();
    expect(r?.article).toBe("Livre III");
  });
});
