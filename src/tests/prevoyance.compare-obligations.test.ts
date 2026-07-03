// ─── Tests compareObligationsSouscrit (LOT COMPARE) ───────────────────────────
// Gap-analysis obligation CCN vs souscrit. Cas d'or : valeurs Syntec derivees du
// JSON reel (ccn-2026.json) — capitalDC 2.00, ij 0.80 / franchise 90, invalidite
// cat1 0.40 / cat2 0.80 / cat3 0.80 (FRACTIONS).

import { describe, it, expect } from "vitest";
import { resolveObligationsBranche } from "../lib/prevoyance/obligations-branche";
import {
  compareObligationsSouscrit,
  type ComparaisonBranche,
  type VerdictGarantie,
} from "../lib/prevoyance/compare-obligations";
import { referentiels } from "../data/prevoyance";
import type { GarantiesSouscrites } from "../types/patrimoine";

function fv(c: ComparaisonBranche, college: "cadres" | "nonCadres", g: string): VerdictGarantie | undefined {
  return c[college].items.find((i) => i.garantie === g)?.verdict;
}

const obSyntec = resolveObligationsBranche("1486", referentiels);

describe("compareObligationsSouscrit — cas d'or", () => {
  it("Syntec cadres, souscrit strictement superieur -> conforme par garantie comparable, jamais insuffisant", () => {
    const souscrit: GarantiesSouscrites = {
      cadres: {
        capitalDC: { tauxSalaireRef: 2.5 },          // > 2.00
        ij: { pctSalaire: 0.9, franchiseJours: 30 }, // 0.9 > 0.8 ET 30 j < 90 j
        invalidite: { cat1: 0.5, cat2: 0.9, cat3: 0.9 },
      },
    };
    const c = compareObligationsSouscrit(obSyntec, souscrit);
    expect(fv(c, "cadres", "capitalDC")).toBe("conforme");
    expect(fv(c, "cadres", "ij")).toBe("conforme");
    expect(fv(c, "cadres", "invalidite")).toBe("conforme");
    expect(c.cadres.items.some((i) => i.verdict === "insuffisant")).toBe(false);
  });

  it("Syntec cadres, capitalDC souscrit inferieur -> insuffisant sur capitalDC UNIQUEMENT", () => {
    const souscrit: GarantiesSouscrites = {
      cadres: {
        capitalDC: { tauxSalaireRef: 1.0 },          // < 2.00
        ij: { pctSalaire: 0.9, franchiseJours: 30 },
        invalidite: { cat1: 0.5, cat2: 0.9, cat3: 0.9 },
      },
    };
    const c = compareObligationsSouscrit(obSyntec, souscrit);
    expect(fv(c, "cadres", "capitalDC")).toBe("insuffisant");
    expect(fv(c, "cadres", "ij")).toBe("conforme");
    expect(fv(c, "cadres", "invalidite")).toBe("conforme");
    expect(c.cadres.items.filter((i) => i.verdict === "insuffisant").map((i) => i.garantie)).toEqual(["capitalDC"]);
  });

  it("souscrit undefined -> garanties comparables indetermine, AUCUN insuffisant (regle 3)", () => {
    const c = compareObligationsSouscrit(obSyntec, undefined);
    expect(fv(c, "cadres", "capitalDC")).toBe("indetermine");
    expect(fv(c, "cadres", "ij")).toBe("indetermine");
    expect(fv(c, "cadres", "invalidite")).toBe("indetermine");
    expect(c.cadres.items.some((i) => i.verdict === "insuffisant")).toBe(false);
  });

  it("9999 temoin -> tout non_applicable (canari)", () => {
    const c = compareObligationsSouscrit(resolveObligationsBranche("9999", referentiels), undefined);
    expect([...c.cadres.items, ...c.nonCadres.items].every((i) => i.verdict === "non_applicable")).toBe(true);
    expect(c.cadres.verdictGlobal).toBe("non_applicable");
  });

  it("2120 Banque -> garanties assurees non_applicable (pas d'obligation)", () => {
    const c = compareObligationsSouscrit(resolveObligationsBranche("2120", referentiels), undefined);
    expect([...c.cadres.items, ...c.nonCadres.items].every((i) => i.verdict === "non_applicable")).toBe(true);
  });

  it("BTP 1596 capitalDC situationFamiliale -> indetermine regle 4 (manuelle), meme souscrit renseigne", () => {
    const souscrit: GarantiesSouscrites = { nonCadres: { capitalDC: { tauxSalaireRef: 2.5 } } };
    const c = compareObligationsSouscrit(resolveObligationsBranche("1596", referentiels), souscrit);
    const it = c.nonCadres.items.find((i) => i.garantie === "capitalDC");
    expect(it?.verdict).toBe("indetermine");
    expect(it?.motif).toMatch(/manuelle|paliers|situations/i);
  });

  it("TESTTOFILL synthetique -> indetermine regle 2 partout (donnee manquante)", () => {
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
            prevoyanceCadres: { garantiesMinimum: { ...toFill } },
            prevoyanceNonCadres: { garantiesMinimum: { ...toFill } },
            santeMinimum: { TO_FILL: true },
          },
        },
      },
    } as unknown as typeof referentiels;

    const ob = resolveObligationsBranche("TESTTOFILL", synthRef);
    // souscrit renseigne sur capitalDC : la regle 2 (indispo) doit primer la regle 5.
    const c = compareObligationsSouscrit(ob, { cadres: { capitalDC: { tauxSalaireRef: 2.0 } } });
    for (const col of ["cadres", "nonCadres"] as const) {
      for (const it of c[col].items) {
        expect(it.verdict).toBe("indetermine");
        expect(it.motif).toMatch(/non chiffree|donnee manquante/i);
      }
    }
  });
});
