// ─── LOT BTP-3 — majoration par enfant à charge sur IJ + invalidité de branche ─
//
// La majoration s'applique dans la sémantique du mode porteur : mode cible → la
// CIBLE est relevée (déduction Secu inchangée) ; mode additif → l'ADDITIF est
// relevé (sans déduction). Assiette = celle du calcul principal (revenuReference
// en cible, brut en additif si base=brut). Tests unitaires des fonctions de
// compute (exportées) + un test d'intégration H11 via projeterArretMaladie.

import { describe, it, expect } from "vitest";
import {
  computeIJCollective,
  computeRenteInvalCollective,
  projeterArretMaladie,
} from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, CouvertureCollective } from "../lib/prevoyance/types";

const EPS = 1; // tolérance €/mois (arrondis)

// ── IJ : majoration par enfant (un seul champ au niveau du bloc ij) ───────────
describe("computeIJCollective — majoration par enfant (LOT BTP-3)", () => {
  // pct 70 %, +3,33 %/enfant ; assiette 2000, dejaCouvert 0, fenêtre ouverte.
  const cov: CouvertureCollective = {
    ij: { pctSalaire: 0.70, franchise: 0, plafondJours: 1000, baseCalcul: "brut_total", majorationParEnfantPct: 0.0333 },
  };

  it("cible croît linéairement avec le nombre d'enfants (0, 1, 3)", () => {
    const r0 = computeIJCollective(10, cov, 2000, 0, 0);
    const r1 = computeIJCollective(10, cov, 2000, 0, 1);
    const r3 = computeIJCollective(10, cov, 2000, 0, 3);
    expect(r0).toBeCloseTo(2000 * 0.70, 2);                  // 1400
    expect(r1).toBeCloseTo(2000 * (0.70 + 0.0333), 2);       // 1466,6
    expect(r3).toBeCloseTo(2000 * (0.70 + 3 * 0.0333), 2);   // 1599,8
    // Incrément strictement linéaire = assiette × majo par enfant.
    expect(r1 - r0).toBeCloseTo(2000 * 0.0333, 2);
    expect(r3 - r0).toBeCloseTo(3 * (r1 - r0), 2);
  });

  it("champ absent → identique au calcul actuel (iso, nbEnfants sans effet)", () => {
    const covSansMajo: CouvertureCollective = {
      ij: { pctSalaire: 0.70, franchise: 0, plafondJours: 1000, baseCalcul: "brut_total" },
    };
    expect(computeIJCollective(10, covSansMajo, 2000, 0, 5)).toBeCloseTo(2000 * 0.70, 2);
    expect(computeIJCollective(10, covSansMajo, 2000, 0, 0)).toBeCloseTo(2000 * 0.70, 2);
  });

  it("défensif : majoration négative → ignorée (garantie IJ principale intacte)", () => {
    const covNeg: CouvertureCollective = {
      ij: { pctSalaire: 0.70, franchise: 0, plafondJours: 1000, baseCalcul: "brut_total", majorationParEnfantPct: -0.05 },
    };
    expect(computeIJCollective(10, covNeg, 2000, 0, 3)).toBeCloseTo(2000 * 0.70, 2); // 1400
  });

  it("nbEnfantsACharge omis (défaut) → 0", () => {
    expect(computeIJCollective(10, cov, 2000, 0)).toBeCloseTo(2000 * 0.70, 2);
  });
});

// ── Invalidité : majoration PAR CATÉGORIE, dans la sémantique du mode ─────────
describe("computeRenteInvalCollective — majoration par enfant (LOT BTP-3)", () => {
  it("cible : majoration propre à la catégorie (cat2 majorée, cat3 non)", () => {
    const cov: CouvertureCollective = {
      invalidite: {
        cat1: { pctSalaire: 0.40 },
        cat2: { pctSalaire: 0.65, majorationParEnfantPct: 0.05 },
        cat3: { pctSalaire: 0.75 }, // pas de majoration
      },
    };
    // cat2, 2 enfants : (0,65 + 2×0,05) × 2000 = 1500 ; pension 0 → 1500.
    expect(computeRenteInvalCollective(cov, "cat2", 2000, 0, 2000, 2)).toBeCloseTo(1500, 2);
    // cat3 non majorée : identique avec 0 ou 2 enfants.
    expect(computeRenteInvalCollective(cov, "cat3", 2000, 0, 2000, 2)).toBeCloseTo(2000 * 0.75, 2);
    expect(computeRenteInvalCollective(cov, "cat3", 2000, 0, 2000, 0)).toBeCloseTo(2000 * 0.75, 2);
  });

  it("additif : prestation = base × (pct + n × majo), sans déduction de pension", () => {
    const cov: CouvertureCollective = {
      invalidite: {
        mode: "additif", base: "brut",
        cat1: { pctSalaire: 0.10, majorationParEnfantPct: 0.05 },
        cat2: { pctSalaire: 0.10, majorationParEnfantPct: 0.05 },
        cat3: { pctSalaire: 0.10, majorationParEnfantPct: 0.05 },
      },
    };
    // brut 2000 × (0,10 + 2×0,05) = 400 ; pension 1000 ignorée (additif).
    expect(computeRenteInvalCollective(cov, "cat2", 2000, 1000, 2000, 2)).toBeCloseTo(400, 2);
  });

  it("champ absent → identique au calcul actuel (iso, nbEnfants sans effet)", () => {
    const cov: CouvertureCollective = {
      invalidite: { cat1: { pctSalaire: 0.50 }, cat2: { pctSalaire: 0.50 }, cat3: { pctSalaire: 0.50 } },
    };
    const sans = computeRenteInvalCollective(cov, "cat2", 2000, 300, 2000, 0);
    const avec = computeRenteInvalCollective(cov, "cat2", 2000, 300, 2000, 5);
    expect(sans).toBeCloseTo(Math.max(0, 2000 * 0.50 - 300), 2); // 700
    expect(avec).toBe(sans);
  });

  it("défensif : majoration négative → ignorée (catégorie principale intacte)", () => {
    const cov: CouvertureCollective = {
      invalidite: { cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.65, majorationParEnfantPct: -0.05 }, cat3: { pctSalaire: 0.75 } },
    };
    expect(computeRenteInvalCollective(cov, "cat2", 2000, 0, 2000, 3)).toBeCloseTo(2000 * 0.65, 2); // 1300
  });
});

// ── H11 : la série majorée reste bornée (intégration via projeterArretMaladie) ─
describe("Majoration par enfant — bornage H11 (LOT BTP-3)", () => {
  function idxInval(r: any): number {
    return r.axe.findIndex((p: any) => p.phase === "invalidite");
  }

  it("invalidité cible majorée + contrat individuel → total borné à 100 % du revenu de référence", () => {
    const e: EntreePerso = {
      age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 24000,
      salaireNetMensuel: 0, nbEnfantsACharge: 3,
      contratsIndividuels: [{ id: "i1", type: "invalidite", capitalOuMontant: 0, baseInvalidite: 0.9 }],
      couvertureCollective: {
        invalidite: {
          cat1: { pctSalaire: 0.40 },
          cat2: { pctSalaire: 0.65, majorationParEnfantPct: 0.05 },
          cat3: { pctSalaire: 0.75 },
        },
      },
    };
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const i = idxInval(r);
    const total =
      r.series.pensionInvalObligatoire[i] + r.series.renteInvalCollective[i] +
      r.series.renteInvalIndividuelle[i] + r.series.renteInvalEnfants[i];
    expect(total).toBeLessThanOrEqual(r.revenuReferenceMensuel + EPS);
    // La majoration est bien active (cible 0,65 + 3×0,05 = 0,80 > base seule).
    expect(r.series.renteInvalCollective[i]).toBeGreaterThan(0);
  });
});
