// ─── MICRO-LOT CCN Banque (IDCC 2120) — entree DOCUMENTAIRE ───────────────────
//
// CCN du 10/01/2000 (AFB) : aucun regime de prevoyance assure de branche. Entree
// posee pour DOCUMENTER l'absence (les garanties relevent des accords d'entreprise)
// et ne PAS la confondre avec un TO_FILL. Aucune garantie servie, cadre comme
// non-cadre (pas de collegeImpose, les deux colleges sont null).

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { categorieBranche } from "../lib/prevoyance/categorie-branche";
import { referentiels } from "../data/prevoyance";

const PASS = 48060;

describe("CCN Banque (IDCC 2120) — entree documentaire, aucune garantie de branche", () => {
  it("entree presente, sans collegeImpose, les deux colleges null", () => {
    const conv = (referentiels.ccn as any).conventions["2120"];
    expect(conv).toBeDefined();
    expect(conv.nom).toContain("Banque");
    expect(conv.collegeImpose).toBeUndefined();
    expect(conv.prevoyanceCadres).toBeNull();
    expect(conv.prevoyanceNonCadres).toBeNull();
  });

  it("aucune garantie servie — cadre COMME non-cadre", () => {
    for (const statut of ["salarie_cadre", "salarie_non_cadre"] as const) {
      const cat = categorieBranche("2120", statut, referentiels); // routage statutPro normal
      // Capital deces : indisponible (bloc null).
      expect(resolveCapitalDecesBranche("2120", cat, 50000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).donneeIndisponible).toBe(true);
      // IJ + invalidite : indisponibles.
      expect(resolveCouvertureBranche("2120", cat, referentiels).donneeIndisponible).toBe(true);
      // Rentes : indisponibles.
      expect(resolveRenteConjointSubstitutiveBranche("2120", cat, 50000, PASS, referentiels).donneeIndisponible).toBe(true);
      expect(resolveRenteEducationBranche("2120", cat, 50000, PASS, 10, referentiels).donneeIndisponible).toBe(true);
    }
  });
});
