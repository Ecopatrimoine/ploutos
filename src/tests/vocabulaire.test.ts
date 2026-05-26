// ─── Tests Lot 5 — helper vocabulaireReglementaire (écran uniquement) ───────
//
// Invariant critique : tant que `cif` n'est pas coché, le vocabulaire écran
// ne mentionne ni « MIF II » ni « RG AMF » — il bascule sur « assurance-vie /
// DDA ». L'helper n'est consommé que par l'UI ; les chaînes PDF restent gelées
// (snapshots) et seront migrées au Lot 8.

import { describe, it, expect } from "vitest";
import { vocabulaireReglementaire } from "../lib/conformite/vocabulaire";
import type { StatutFlags } from "../lib/conformite/referencesLegales";

const NO_STATUTS: StatutFlags = {
  coa: false, mia: false, iobsp: false, cif: false, carteT: false,
};

describe("vocabulaireReglementaire — règle critique : pas de MIF II sans CIF", () => {
  it("COA seul → reglementationProfil = « assurance-vie / DDA »", () => {
    const v = vocabulaireReglementaire({ ...NO_STATUTS, coa: true });
    expect(v.reglementationProfil).toBe("assurance-vie / DDA");
    expect(v.cadreReglementaire).toBe("DDA");
    expect(v.investissementPrincipal).toBe("assurance-vie");
    expect(v.reglementationProfil).not.toMatch(/MIF/);
    expect(v.cadreReglementaire).not.toMatch(/MIF/);
  });

  it("MIA seul → cadre = DDA, aucune mention MIF", () => {
    const v = vocabulaireReglementaire({ ...NO_STATUTS, mia: true });
    expect(v.cadreReglementaire).toBe("DDA");
    expect(v.cadreReglementaire).not.toMatch(/MIF/);
  });

  it("CIF + COA → cadre = « MIF II + DDA »", () => {
    const v = vocabulaireReglementaire({ ...NO_STATUTS, coa: true, cif: true });
    expect(v.cadreReglementaire).toBe("MIF II + DDA");
    expect(v.reglementationProfil).toBe("MIF II + DDA");
    expect(v.investissementPrincipal).toBe("instruments financiers et assurance-vie");
  });

  it("CIF seul → cadre = « MIF II »", () => {
    const v = vocabulaireReglementaire({ ...NO_STATUTS, cif: true });
    expect(v.cadreReglementaire).toBe("MIF II");
    expect(v.investissementPrincipal).toBe("instruments financiers");
  });

  it("Aucun statut → fallback neutre, aucune mention MIF", () => {
    const v = vocabulaireReglementaire(NO_STATUTS);
    expect(v.cadreReglementaire).toBe("—");
    expect(v.reglementationProfil).toBe("—");
    expect(v.cadreReglementaire).not.toMatch(/MIF/);
    expect(v.reglementationProfil).not.toMatch(/MIF/);
  });
});
