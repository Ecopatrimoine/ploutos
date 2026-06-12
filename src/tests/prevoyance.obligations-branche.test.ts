// ─── Tests resolveObligationsBranche (LOT OBLIGATIONS) ────────────────────────
// Cas d'or tires de branches validees visuellement + balayage des conventions.

import { describe, it, expect } from "vitest";
import {
  resolveObligationsBranche,
  type ObligationsBranche,
  type ObligationGarantie,
} from "../lib/prevoyance/obligations-branche";
import { referentiels } from "../data/prevoyance";

function find(r: ObligationsBranche, college: "cadres" | "nonCadres", g: ObligationGarantie) {
  return r[college].find((i) => i.garantie === g);
}
function tousLesItems(r: ObligationsBranche) {
  return [...r.cadres, ...r.nonCadres];
}

describe("resolveObligationsBranche — cas d'or", () => {
  it("1486 Syntec : branche_documentee, capitalDC + renteEducation + ij + invalidite presents, maintien ccn", () => {
    const r = resolveObligationsBranche("1486", referentiels);
    expect(r.statut).toBe("branche_documentee");
    for (const g of ["capitalDC", "renteEducation", "ij", "invalidite"] as const) {
      expect(find(r, "cadres", g)?.presente).toBe(true);
    }
    const m = find(r, "cadres", "maintienEmployeur");
    expect(m?.presente).toBe(true);
    expect(m?.source).toBe("ccn");
  });

  it("2120 Banque : aucune_obligation_assuree MAIS maintien present source ccn (non masque)", () => {
    const r = resolveObligationsBranche("2120", referentiels);
    expect(r.statut).toBe("aucune_obligation_assuree");
    // maintien present, source ccn (5 paliers art. 54) — dans les deux colleges.
    for (const col of ["cadres", "nonCadres"] as const) {
      const m = find(r, col, "maintienEmployeur");
      expect(m?.presente).toBe(true);
      expect(m?.source).toBe("ccn");
    }
    // aucune garantie ASSUREE presente.
    for (const col of ["cadres", "nonCadres"] as const) {
      for (const g of ["capitalDC", "renteEducation", "renteConjoint", "ij", "invalidite"] as const) {
        expect(find(r, col, g)?.presente).toBe(false);
      }
    }
  });

  it("9999 temoin : AUCUNE garantie presente (canari)", () => {
    const r = resolveObligationsBranche("9999", referentiels);
    expect(tousLesItems(r).every((i) => i.presente === false)).toBe(true);
    expect(r.statut).toBe("aucune_obligation_assuree");
  });

  it("44 Chimie : aucune_obligation_assuree + maintien ccn (plancher etendu)", () => {
    const r = resolveObligationsBranche("44", referentiels);
    expect(r.statut).toBe("aucune_obligation_assuree");
    const m = find(r, "cadres", "maintienEmployeur");
    expect(m?.presente).toBe(true);
    expect(m?.source).toBe("ccn");
  });

  it("0000 inconnu : convention_inconnue, pas de crash", () => {
    const r = resolveObligationsBranche("0000", referentiels);
    expect(r.statut).toBe("convention_inconnue");
    expect(r.cadres).toEqual([]);
  });

  it("null : idcc_absent", () => {
    const r = resolveObligationsBranche(null, referentiels);
    expect(r.statut).toBe("idcc_absent");
  });
});

describe("resolveObligationsBranche — balayage + non-regression unites", () => {
  it("toutes les conventions reelles passent sans exception, statut valide", () => {
    const STATUTS = ["branche_documentee", "donnees_incompletes", "aucune_obligation_assuree", "convention_inconnue", "idcc_absent"];
    const ids = Object.keys((referentiels.ccn as { conventions: Record<string, unknown> }).conventions);
    expect(ids.length).toBeGreaterThanOrEqual(19);
    for (const id of ids) {
      const r = resolveObligationsBranche(id, referentiels);
      expect(STATUTS).toContain(r.statut);
      expect(Array.isArray(r.cadres)).toBe(true);
      expect(Array.isArray(r.nonCadres)).toBe(true);
      expect(r.cadres.length).toBe(6);
      expect(r.nonCadres.length).toBe(6);
    }
  });

  it("CONTRE-EPREUVE : garanties assurees TOUTES TO_FILL -> donnees_incompletes (jamais aucune_obligation_assuree)", () => {
    // Convention SYNTHETIQUE injectee via un referentiel derive (resolveurs et
    // moteur lisent le meme ref). Toutes les garanties assurees = "TO_VERIFY".
    const toFill = {
      capitalDC: "TO_VERIFY",
      renteEducation: "TO_VERIFY",
      renteConjoint: "TO_VERIFY",
      ij: "TO_VERIFY",
      invalidite: "TO_VERIFY",
    };
    const synthRef = {
      ...referentiels,
      ccn: {
        ...referentiels.ccn,
        conventions: {
          ...(referentiels.ccn as { conventions: Record<string, unknown> }).conventions,
          TESTTOFILL: {
            idcc: "TESTTOFILL",
            nom: "Convention test TO_FILL",
            maintienEmployeur: { cadres: null, nonCadres: null },
            prevoyanceCadres: { tauxT1Minimum: 1.5, garantiesMinimum: { ...toFill } },
            prevoyanceNonCadres: { garantiesMinimum: { ...toFill } },
            santeMinimum: { TO_FILL: true },
          },
        },
      },
    } as unknown as typeof referentiels;

    const r = resolveObligationsBranche("TESTTOFILL", synthRef);
    // Coeur de la contre-epreuve : donnee manquante != absence d'obligation.
    expect(r.statut).not.toBe("aucune_obligation_assuree");
    // Statut prioritaire precis.
    expect(r.statut).toBe("donnees_incompletes");
    // Chaque garantie assuree : PRESENTE (obligation documentee) mais donnee indisponible.
    for (const col of ["cadres", "nonCadres"] as const) {
      for (const g of ["capitalDC", "renteEducation", "renteConjoint", "ij", "invalidite"] as const) {
        const it = find(r, col, g);
        expect(it?.presente).toBe(true);
        expect(it?.donneeIndisponible).toBe(true);
      }
    }
  });

  it("Syntec : les garanties posees ne sont PAS donneeIndisponible (pas d'indispo inattendu)", () => {
    const r = resolveObligationsBranche("1486", referentiels);
    for (const g of ["capitalDC", "renteEducation", "ij", "invalidite"] as const) {
      const it = find(r, "cadres", g);
      expect(it?.presente).toBe(true);
      expect(it?.donneeIndisponible ?? false).toBe(false);
    }
    // unites : IJ en FRACTION -> resume avec "%" (ex 80 %), pas un entier brut.
    expect(find(r, "cadres", "ij")?.resume).toMatch(/%/);
  });
});
