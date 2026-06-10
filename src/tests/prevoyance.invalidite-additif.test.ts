// ─── LOT BTP-2 — invalidité de branche mode "additif" (intégration moteur) ────
//
// L'additif (ouvriers BTP, RNPO) verse la prestation EN PLUS de la pension Secu,
// sans déduction — par opposition au mode "cibleInclSecu" historique. La fonction
// de compute étant interne à projection.ts, on vérifie le comportement de bout en
// bout via projeterArretMaladie, en lisant la série renteInvalCollective sur la
// phase invalidité (≥ J1095).

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, CouvertureCollective } from "../lib/prevoyance/types";

const EPS = 1; // tolérance €/mois (arrondis)

// Salarié CPAM, brut 24 000 €/an = 2 000 €/mois (< PASS → SAM = brut mensuel).
function entree(couvertureCollective: CouvertureCollective | null): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 24000,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective,
  };
}

// Taux identiques sur les 3 catégories → l'additif vaut brut × pct quelle que
// soit la catégorie (seule la pension Secu varie d'une catégorie à l'autre).
const cats10 = { cat1: { pctSalaire: 0.10 }, cat2: { pctSalaire: 0.10 }, cat3: { pctSalaire: 0.10 } };
const cats80 = { cat1: { pctSalaire: 0.80 }, cat2: { pctSalaire: 0.80 }, cat3: { pctSalaire: 0.80 } };

// Premier index de la phase invalidité (J1095).
function idxInval(r: any): number {
  return r.axe.findIndex((p: any) => p.phase === "invalidite");
}

describe("Invalidité additif de branche (LOT BTP-2)", () => {
  it("additif base brut : prestation = brut × pct, indépendante de la pension (cat1 vs cat2)", () => {
    const cov: CouvertureCollective = { invalidite: { mode: "additif", base: "brut", ...cats10 } };
    const r1 = projeterArretMaladie(entree(cov), "cat1", referentiels);
    const r2 = projeterArretMaladie(entree(cov), "cat2", referentiels);
    const i1 = idxInval(r1), i2 = idxInval(r2);
    // brut mensuel 2000 × 0,10 = 200, identique malgré des pensions différentes.
    expect(r1.series.renteInvalCollective[i1]).toBeCloseTo(200, 2);
    expect(r2.series.renteInvalCollective[i2]).toBeCloseTo(200, 2);
    // Sanity : la pension Secu cat1 (≈30 %) < cat2 (≈50 %) → 2 niveaux distincts.
    expect(r1.series.pensionInvalObligatoire[i1])
      .toBeLessThan(r2.series.pensionInvalObligatoire[i2]);
  });

  it("additif n'est PAS écrêté par la pension (là où la cible l'aurait été)", () => {
    const covAdd: CouvertureCollective = { invalidite: { mode: "additif", base: "brut", ...cats10 } };
    const covCible: CouvertureCollective = { invalidite: { mode: "cibleInclSecu", base: "brut", ...cats10 } };
    const rAdd = projeterArretMaladie(entree(covAdd), "cat2", referentiels);
    const rCible = projeterArretMaladie(entree(covCible), "cat2", referentiels);
    const iA = idxInval(rAdd), iC = idxInval(rCible);
    // Pension cat2 (≈1000) > cible 200 → cible écrêtée à 0 ; additif reste 200.
    expect(rCible.series.renteInvalCollective[iC]).toBeCloseTo(0, 2);
    expect(rAdd.series.renteInvalCollective[iA]).toBeCloseTo(200, 2);
  });

  it("mode absent ≡ mode cibleInclSecu base revenuReference explicite (iso)", () => {
    const covImplicite: CouvertureCollective = { invalidite: { ...cats80 } };
    const covExplicite: CouvertureCollective = { invalidite: { mode: "cibleInclSecu", base: "revenuReference", ...cats80 } };
    const rImp = projeterArretMaladie(entree(covImplicite), "cat2", referentiels);
    const rExp = projeterArretMaladie(entree(covExplicite), "cat2", referentiels);
    // Séries identiques jour par jour…
    expect(rImp.series.renteInvalCollective).toEqual(rExp.series.renteInvalCollective);
    // …et non triviales (cible 0,80 × revenuRef > pension → complément > 0).
    expect(rImp.series.renteInvalCollective[idxInval(rImp)]).toBeGreaterThan(0);
  });

  it("H11 : additif + contrat individuel → total borné à 100 % du revenu de référence", () => {
    const cov: CouvertureCollective = { invalidite: { mode: "additif", base: "brut", ...cats10 } };
    const e = entree(cov);
    e.contratsIndividuels = [{ id: "i1", type: "invalidite", capitalOuMontant: 0, baseInvalidite: 0.9 }];
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const i = idxInval(r);
    const total =
      r.series.pensionInvalObligatoire[i] + r.series.renteInvalCollective[i] +
      r.series.renteInvalIndividuelle[i] + r.series.renteInvalEnfants[i];
    expect(total).toBeLessThanOrEqual(r.revenuReferenceMensuel + EPS);
    // L'additif est bien servi (200) ; c'est l'étage individuel qui absorbe le plafond H11.
    expect(r.series.renteInvalCollective[i]).toBeCloseTo(200, 2);
  });
});
