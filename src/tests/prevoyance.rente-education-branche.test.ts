// ─── LOT DECES-B-i — Résolveur rente éducation de branche (CCN) ─────────────
//
// Clause type Syntec (IDCC 1486, art. 5 accord prévoyance 27/03/1997) : rente
// PAR ENFANT, évolutive avec l'âge. 12 % du salaire de référence jusqu'au 18e
// anniversaire, 15 % de 18 à 26 ans, fin à 26. Plancher en % du PASS selon âge
// ET statut : non-cadres 12 % / 15 % ; cadres 24 % / 30 %. salaireRef plafonné
// à 8 PASS (comme le capital). PASS 2026 = 48 060. CALCUL PUR, isolé.

import { describe, it, expect } from "vitest";
import {
  resolveRenteEducationBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import type { Referentiels } from "../data/prevoyance";
import { referentiels } from "../data/prevoyance";

const PASS = 48060;

describe("resolveRenteEducationBranche — Syntec (1486) non-cadre", () => {
  it("enfant 10 ans (tranche 0-18) → max(0,12×30000 ; 0,12×PASS) = 5 767,20 /an", () => {
    const r = resolveRenteEducationBranche("1486", "nonCadres", 30000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.categorie).toBe("nonCadres");
    expect(r.montantAnnuelCourant).toBeCloseTo(5767.2, 2);
  });

  it("enfant 20 ans (tranche 18-26) → max(0,15×30000 ; 0,15×PASS) = 7 209 /an", () => {
    const r = resolveRenteEducationBranche("1486", "nonCadres", 30000, PASS, 20, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(7209, 2);
  });

  it("enfant 27 ans → plus à charge : montant courant 0, aucune phase active", () => {
    const r = resolveRenteEducationBranche("1486", "nonCadres", 30000, PASS, 27, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuelCourant).toBe(0);
    expect(r.phases.find((p) => 27 >= p.deAge && 27 < p.aAge)).toBeUndefined();
  });

  it("grille complète (2 phases) indépendante de l'âge", () => {
    const r = resolveRenteEducationBranche("1486", "nonCadres", 30000, PASS, 10, referentiels);
    expect(r.phases).toHaveLength(2);
    expect(r.phases[0]).toMatchObject({ deAge: 0, aAge: 18, tauxSalaireRef: 0.12 });
    expect(r.phases[0].montantAnnuel).toBeCloseTo(5767.2, 2);
    expect(r.phases[1]).toMatchObject({ deAge: 18, aAge: 26, tauxSalaireRef: 0.15 });
    expect(r.phases[1].montantAnnuel).toBeCloseTo(7209, 2);
  });
});

describe("resolveRenteEducationBranche — Syntec (1486) cadre", () => {
  it("enfant 10 ans → plancher 0,24 PASS = max(0,12×60000 ; 0,24×PASS) = 11 534,40 /an", () => {
    const r = resolveRenteEducationBranche("1486", "cadres", 60000, PASS, 10, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(11534.4, 2);
  });

  it("enfant 20 ans → plancher 0,30 PASS = max(0,15×60000 ; 0,30×PASS) = 14 418 /an", () => {
    const r = resolveRenteEducationBranche("1486", "cadres", 60000, PASS, 20, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(14418, 2);
  });
});

describe("resolveRenteEducationBranche — âge inconnu (photo sans date de naissance)", () => {
  it("ageEnfant null → grille calculée, montant courant null (jamais d'erreur)", () => {
    const r = resolveRenteEducationBranche("1486", "cadres", 60000, PASS, null, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.phases).toHaveLength(2);
    expect(r.montantAnnuelCourant).toBeNull();
  });
});

describe("resolveRenteEducationBranche — cas indisponibles (jamais d'exception)", () => {
  it("idcc inconnu → donneeIndisponible, phases vides", () => {
    const r = resolveRenteEducationBranche("9999", "cadres", 60000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(true);
    expect(r.phases).toEqual([]);
    expect(r.montantAnnuelCourant).toBeNull();
  });

  it("idcc null → donneeIndisponible", () => {
    const r = resolveRenteEducationBranche(null, "cadres", 60000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(true);
  });

  it("CCN sans renteEducation documentée (1996 TO_FILL) → donneeIndisponible", () => {
    // 3248 (Métallurgie) est désormais documenté → on prend 1996 (Pharmacie,
    // encore TO_FILL) pour préserver le verrou « branche non documentée ».
    const r = resolveRenteEducationBranche("1996", "cadres", 60000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(true);
  });

  it("renteEducation = \"TO_VERIFY\" (string) → donneeIndisponible (non-objet rejeté)", () => {
    const stub = {
      ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres: { garantiesMinimum: { renteEducation: "TO_VERIFY" } } } } },
    } as unknown as Referentiels;
    const r = resolveRenteEducationBranche("0001", "cadres", 60000, PASS, 10, stub);
    expect(r.donneeIndisponible).toBe(true);
  });

  it("garde de cohérence : tauxSalaireRef > 1 → donneeIndisponible (rejet pct aberrant)", () => {
    const stub = {
      ccn: { conventions: { "0002": { nom: "Test", prevoyanceCadres: { garantiesMinimum: { renteEducation: {
        mode: "trancheAge", tranches: [{ deAge: 0, aAge: 18, tauxSalaireRef: 1.5, minimumPass: 0.24 }],
      } } } } } },
    } as unknown as Referentiels;
    const r = resolveRenteEducationBranche("0002", "cadres", 60000, PASS, 10, stub);
    expect(r.donneeIndisponible).toBe(true);
  });
});

// ─── Marqueur « non prévu par la branche » : renteConjoint = null (≠ TO_VERIFY) ─
describe("référentiel Syntec — renteConjoint null traité comme « non prévu » (pas une erreur)", () => {
  const conv = (referentiels.ccn as any).conventions["1486"];

  it("renteConjoint = null dans les deux catégories (marqueur non prévu, distinct de TO_VERIFY)", () => {
    expect(conv.prevoyanceCadres.garantiesMinimum.renteConjoint).toBeNull();
    expect(conv.prevoyanceNonCadres.garantiesMinimum.renteConjoint).toBeNull();
    // Distinct de "TO_VERIFY" : ce n'est pas une valeur à vérifier mais une absence assumée.
    expect(conv.prevoyanceCadres.garantiesMinimum.renteConjoint).not.toBe("TO_VERIFY");
  });

  it("la résolution de la rente éducation fonctionne malgré renteConjoint null (pas d'erreur)", () => {
    const r = resolveRenteEducationBranche("1486", "cadres", 60000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.phases).toHaveLength(2);
  });
});
