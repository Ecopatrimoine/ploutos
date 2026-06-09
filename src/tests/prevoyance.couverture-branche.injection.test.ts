// ─── LOT IJ-INV-ii — Injection de la couverture IJ/invalidité de branche (CCN)
//     dans couvertureEffective ───────────────────────────────────────────────
//
// Règle de fallback : la CCN ne s'injecte QUE si !isTns ET couvertureCollective
// absente (=== null) ET idcc documenté. La saisie manuelle prime toujours.
// Exclusion TNS H7 stricte. Les étages collectifs + bornage H11 sont TRAVERSÉS
// (jamais court-circuités) : une couverture CCN les franchit à l'identique.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import type { EntreePerso } from "../lib/prevoyance/types";
import { referentiels } from "../data/prevoyance";

function entree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
    idccCCN: "1486", ancienneteMois: 48, salaireBrutAnnuel: 60000,
    salaireNetMensuel: 3900, contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}
const idxJ = (r: ReturnType<typeof projeterArretMaladie>, j: number) =>
  r.axe.findIndex((p) => p.jour === j);

describe("IJ-INV-ii — injection CCN (cadre Syntec sans saisie)", () => {
  it("IJ collective (relais après franchise 90) et rente inval cat2 alimentées par la CCN", () => {
    const r = projeterArretMaladie(entree(), "cat2", referentiels);
    expect(r.couvertureIssueDeLaCcn).toBe(true);
    // IJ collective : 0 avant la franchise 90 j, > 0 ensuite (J120, J180).
    expect(r.series.ijComplementaireCollective[idxJ(r, 60)]).toBe(0);
    expect(r.series.ijComplementaireCollective[idxJ(r, 120)]).toBeGreaterThan(0);
    expect(r.series.ijComplementaireCollective[idxJ(r, 180)]).toBeGreaterThan(0);
    // Rente invalidité cat2 = complément à 80 % du brut au-delà de l'obligatoire.
    const i1095 = idxJ(r, 1095);
    const brutMensuel = 60000 / 12; // 5000
    expect(r.series.renteInvalCollective[i1095]).toBeGreaterThan(0);
    expect(r.series.renteInvalCollective[i1095]).toBeCloseTo(
      Math.max(0, 0.80 * brutMensuel - r.series.pensionInvalObligatoire[i1095]), 2
    );
  });

  it("sans idcc (couverture null) → AUCUNE injection : séries collectives à 0", () => {
    const r = projeterArretMaladie(entree({ idccCCN: null }), "cat2", referentiels);
    expect(r.couvertureIssueDeLaCcn).toBe(false);
    expect(Math.max(...r.series.ijComplementaireCollective)).toBe(0);
    expect(Math.max(...r.series.renteInvalCollective)).toBe(0);
  });
});

describe("IJ-INV-ii — la saisie manuelle prime (CCN n'injecte rien)", () => {
  it("couverture manuelle présente → couvertureIssueDeLaCcn false, la SAISIE pilote (pctSalaire 0,5, pas 0,80 CCN)", () => {
    const manuelle = { ij: { pctSalaire: 0.5, franchise: 30, plafondJours: 800, baseCalcul: "T1_T2" as const } };
    const r = projeterArretMaladie(entree({ couvertureCollective: manuelle }), "cat2", referentiels);
    expect(r.couvertureIssueDeLaCcn).toBe(false);
    // Le complément collectif reflète la SAISIE (cible = 0,5 × brut), pas la CCN
    // (qui aurait donné 0,80 × brut). Preuve que la saisie prime et que la CCN
    // n'a pas été injectée. (NB : on ne compare PAS aux séries sans-idcc, qui
    // diffèrent par le maintien CCN vs légal — LOT 1b, hors périmètre.)
    const i180 = idxJ(r, 180);
    const brutMensuel = 60000 / 12;
    expect(r.series.ijComplementaireCollective[i180]).toBeCloseTo(
      Math.max(0, 0.5 * brutMensuel - r.series.maintienEmployeur[i180] - r.series.ijObligatoire[i180]), 2
    );
  });
});

describe("IJ-INV-ii — exclusion TNS H7 (aucune injection)", () => {
  it("TNS avec idcc 1486 + saisie → couvertureEffective null, ignorée TNS, pas d'injection CCN", () => {
    const manuelle = { invalidite: { cat1: { pctSalaire: 0.4 }, cat2: { pctSalaire: 0.8 }, cat3: { pctSalaire: 0.8 } } };
    const r = projeterArretMaladie(entree({ statutPro: "tns_liberal", couvertureCollective: manuelle }), "cat2", referentiels);
    expect(r.couvertureCollectiveIgnoreeTNS).toBe(true); // H7 intacte
    expect(r.couvertureIssueDeLaCcn).toBe(false);        // pas d'injection CCN
    expect(Math.max(...r.series.renteInvalCollective)).toBe(0); // couvertureEffective null
  });

  it("TNS avec idcc 1486 SANS saisie → pas d'injection (isTns garde), séries à 0", () => {
    const r = projeterArretMaladie(entree({ statutPro: "tns_liberal" }), "cat2", referentiels);
    expect(r.couvertureIssueDeLaCcn).toBe(false);
    expect(Math.max(...r.series.ijComplementaireCollective)).toBe(0);
    expect(Math.max(...r.series.renteInvalCollective)).toBe(0);
  });
});

describe("IJ-INV-ii — bornage H11 traversé (non court-circuité)", () => {
  it("CCN injectée + contrat individuel généreux → l'individuel est borné (marge consommée)", () => {
    const indiv = [{ type: "ij" as const, capitalOuMontant: 200, nature: "indemnitaire" as const, franchiseJours: 0 }];
    const avecCcn = projeterArretMaladie(entree({ contratsIndividuels: indiv }), "cat2", referentiels);
    const sansCcn = projeterArretMaladie(entree({ idccCCN: null, contratsIndividuels: indiv }), "cat2", referentiels);
    expect(avecCcn.couvertureIssueDeLaCcn).toBe(true);
    // La collective CCN a consommé une part de la marge → l'individuel borné est
    // <= au même dossier sans CCN (le bornage H11 redistribue dans la marge restante).
    const i = idxJ(avecCcn, 180);
    expect(avecCcn.series.ijComplementaireIndividuelle[i])
      .toBeLessThanOrEqual(sansCcn.series.ijComplementaireIndividuelle[i]);
    // Et le bornage indemnitaire est bien actif (marge saturée).
    expect(avecCcn.surCouvertureIndemnitaireBornee).toBe(true);
  });
});
