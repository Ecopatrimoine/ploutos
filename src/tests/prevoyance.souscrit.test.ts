// ─── Lot SOUSCRIT — schema additif des garanties souscrites ───────────────────
// Schema seul : on verifie (a) la retro-compatibilite (audit inchange), (b)
// l'aller-retour de conversion % <-> fraction, (c) champ vide -> undefined.

import { describe, it, expect } from "vitest";
import { runAuditConformite } from "../lib/prevoyance/audit-collectif";
import {
  emptyEntrepriseAudit,
  pctSaisieVersFraction,
  fractionVersPctSaisie,
  joursSaisie,
} from "../components/prevoyance/BlocEntreprise";
import { referentiels } from "../data/prevoyance";
import type { EntrepriseAudit } from "../types/patrimoine";

describe("Lot SOUSCRIT — garanties souscrites (schema additif)", () => {
  it("(a) dossier sans garantiesSouscrites : audit conformite STRICTEMENT inchange", () => {
    const base: EntrepriseAudit = {
      ...emptyEntrepriseAudit(),
      effectif: 12,
      idccCCN: "1486",
      nomCCN: "Syntec",
      santeCollectiveEnPlace: true,
      prevoyanceCadresEnPlace: true,
      tauxT1Cadres: 1.5,
      categoriesObjectivesDeclarees: "cadres art. 4",
    };
    expect(base.garantiesSouscrites).toBeUndefined();

    const avec: EntrepriseAudit = {
      ...base,
      garantiesSouscrites: {
        cadres: { capitalDC: { tauxSalaireRef: 2.0 }, ij: { pctSalaire: 0.8, franchiseJours: 90 } },
      },
    };
    // L'audit (Lot 8) ne lit PAS garantiesSouscrites -> resultat identique.
    expect(runAuditConformite(avec, referentiels)).toEqual(runAuditConformite(base, referentiels));
  });

  it("(b) aller-retour saisie % <-> fraction stockee", () => {
    expect(pctSaisieVersFraction("200")).toBe(2.0);   // 200 % -> 2.0
    expect(pctSaisieVersFraction("80")).toBeCloseTo(0.8, 10);
    expect(pctSaisieVersFraction("40")).toBeCloseTo(0.4, 10);
    expect(fractionVersPctSaisie(2.0)).toBe("200");
    expect(fractionVersPctSaisie(0.8)).toBe("80");     // pas de "80.00000000000001"
    // round-trip stable
    expect(fractionVersPctSaisie(pctSaisieVersFraction("200")!)).toBe("200");
    expect(fractionVersPctSaisie(pctSaisieVersFraction("40")!)).toBe("40");
    // franchise en jours : AUCUNE conversion
    expect(joursSaisie("90")).toBe(90);
  });

  it("(c) champ vide -> undefined, JAMAIS 0", () => {
    expect(pctSaisieVersFraction("")).toBeUndefined();
    expect(pctSaisieVersFraction("   ")).toBeUndefined();
    expect(joursSaisie("")).toBeUndefined();
    expect(fractionVersPctSaisie(undefined)).toBe("");
    // garde-fou explicite : surtout pas un 0 silencieux
    expect(pctSaisieVersFraction("")).not.toBe(0);
    expect(joursSaisie("")).not.toBe(0);
  });
});
