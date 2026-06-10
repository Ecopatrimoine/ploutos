// ─── LOT IJ-INV-i — Résolveur IJ + invalidité de branche (CCN) ──────────────
//
// Syntec (IDCC 1486) : IJ = complément à 80 % du salaire, franchise 90 j (relais
// après maintien employeur), plafond 1005 j (hypothèse), base brut_total (art. 6).
// Invalidité : cat1 40 %, cat2/cat3 80 % (art. 7), identique cadres/non-cadres.
// L'objet produit est au FORMAT CouvertureCollective (ij/invalidite uniquement),
// directement consommable par le moteur de projection SANS adaptation.

import { describe, it, expect } from "vitest";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import type { Referentiels } from "../data/prevoyance";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";

describe("resolveCouvertureBranche — Syntec (1486)", () => {
  it("cadre → IJ complément 80 % (franchise 90, plafond 1005, brut_total)", () => {
    const r = resolveCouvertureBranche("1486", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.categorie).toBe("cadres");
    expect(r.ij).toEqual({ pctSalaire: 0.80, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" });
  });

  it("cadre → invalidité cat1 40 %, cat2/cat3 80 %", () => {
    const r = resolveCouvertureBranche("1486", "cadres", referentiels);
    expect(r.invalidite).toEqual({
      cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.80 }, cat3: { pctSalaire: 0.80 },
    });
  });

  it("non-cadre → IJ et invalidité IDENTIQUES au cadre (taux non différenciés)", () => {
    const cadre = resolveCouvertureBranche("1486", "cadres", referentiels);
    const nonCadre = resolveCouvertureBranche("1486", "nonCadres", referentiels);
    expect(nonCadre.donneeIndisponible).toBe(false);
    expect(nonCadre.ij).toEqual(cadre.ij);
    expect(nonCadre.invalidite).toEqual(cadre.invalidite);
  });

  it("forme CouvertureCollective compatible (assignable sans adaptation)", () => {
    const r = resolveCouvertureBranche("1486", "cadres", referentiels);
    // Compile uniquement si r.ij / r.invalidite ont exactement la forme du type.
    const cov: CouvertureCollective = { ij: r.ij, invalidite: r.invalidite };
    expect(cov.ij?.baseCalcul).toBe("brut_total");
    expect(cov.ij?.pctSalaire).toBe(0.80);
    expect(cov.invalidite?.cat2.pctSalaire).toBe(0.80);
    expect(cov.invalidite?.cat1.pctSalaire).toBe(0.40);
  });
});

describe("resolveCouvertureBranche — cas indisponibles (jamais d'exception)", () => {
  it("idcc inconnu → donneeIndisponible, ni ij ni invalidite", () => {
    const r = resolveCouvertureBranche("9999", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(true);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeUndefined();
  });

  it("idcc null → donneeIndisponible", () => {
    const r = resolveCouvertureBranche(null, "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(true);
  });

  it("CCN sans garanties IJ/invalidité documentées (1996 TO_FILL) → donneeIndisponible", () => {
    // 3248 (Métallurgie) porte désormais capital/rente éducation (mais ni IJ ni
    // invalidité) → on prend 1996 (Pharmacie, entièrement TO_FILL) comme exemple
    // non ambigu de branche sans aucune garantie documentée.
    const r = resolveCouvertureBranche("1996", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(true);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeUndefined();
  });
});

describe("resolveCouvertureBranche — lecture défensive (stubs)", () => {
  function stub(prevoyanceCadres: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres } } } } as unknown as Referentiels;
  }

  it("ij \"TO_VERIFY\" (string) → ij omis", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: "TO_VERIFY", invalidite: "TO_VERIFY" } }));
    expect(r.donneeIndisponible).toBe(true);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeUndefined();
  });

  it("ij mode inconnu → ij omis ; invalidité valide seule → exploitée", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      ij: { mode: "forfaitaire", pctSalaire: 0.80, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" },
      invalidite: { cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.80 }, cat3: { pctSalaire: 0.80 } },
    } }));
    expect(r.donneeIndisponible).toBe(false);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeDefined();
  });

  it("ij pctSalaire > 1 → ij omis (garde de cohérence)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      ij: { mode: "complementSecu", pctSalaire: 1.5, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" },
    } }));
    expect(r.ij).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("invalidité avec une catégorie manquante → invalidité omise", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.80 } },
    } }));
    expect(r.invalidite).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });
});

// ─── LOT BTP-2 — invalidité mode "additif" / base (passthrough + défensif) ────
describe("resolveCouvertureBranche — invalidité mode additif (LOT BTP-2)", () => {
  function stub(prevoyanceCadres: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres } } } } as unknown as Referentiels;
  }
  const cats = { cat1: { pctSalaire: 0.10 }, cat2: { pctSalaire: 0.10 }, cat3: { pctSalaire: 0.10 } };

  it("mode additif + base brut → mode/base portés tels quels", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { mode: "additif", base: "brut", ...cats },
    } }));
    expect(r.donneeIndisponible).toBe(false);
    expect(r.invalidite?.mode).toBe("additif");
    expect(r.invalidite?.base).toBe("brut");
  });

  it("mode/base absents → clés OMISES du résultat (forme historique inchangée)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { ...cats },
    } }));
    expect(r.invalidite).toEqual(cats); // ni mode ni base
  });

  it("mode inconnu → invalidité indisponible (pas de fallback silencieux sur la cible)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { mode: "forfaitaire", ...cats },
    } }));
    expect(r.invalidite).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("base inconnue → invalidité indisponible", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { mode: "additif", base: "net", ...cats },
    } }));
    expect(r.invalidite).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });
});
