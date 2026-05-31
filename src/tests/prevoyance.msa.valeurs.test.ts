// ─── LOT M-2b (MSA) — valeurs 2026 sur l'entree JSON reelle (AMEXA exploitant) ──
//
// Lit l'entree MSA REELLE de caisses-2026.json et valide les montants 2026 sources
// msa.fr / Legifrance : IJ paliers (26/34,66), invalidite cat1/cat2 bornees, capital
// deces 4009. Inclut le test POSITIF du depassement forfaitaire a bas revenu (cas
// exclu de G4b en M-2a, ici documente comme comportement attendu et borne).

import { describe, it, expect } from "vitest";
import {
  computeIJObligatoireJournaliere,
  computeInvalObligatoireMensuel,
  projeterArretMaladie,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

const caisses = (referentiels.caisses as any).caisses;
const msa = caisses.MSA;
const vars = buildPlafondVariables(referentiels);

function entreeExploitant(revenuTNS: number, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45, ageRetraite: 67, statutPro: "tns_liberal", caisse: "MSA",
    idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 0,
    salaireNetMensuel: 0, revenuTNSAnnuel: revenuTNS,
    contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

describe("MSA 2026 — schema JSON (msa.fr / Legifrance)", () => {
  it("operationnelle : regle IJ paliers_temporels, invalidite cat1/cat2/cat3, capital 4009", () => {
    expect(msa.ij.TO_FILL).toBeUndefined();
    expect(msa.ij.regle).toBe("paliers_temporels");
    expect(msa.ij.carenceJours).toBe(3);
    expect(msa.invalidite.categories.cat1.taux).toBe(0.30);
    expect(msa.invalidite.categories.cat2.taux).toBe(0.50);
    expect(msa.invalidite.categories.cat3.taux).toBe(0.50); // copie cat2
    expect(msa.capitalDeces).toMatchObject({ type: "forfaitaire", montant: 4009 });
  });
});

describe("MSA 2026 — IJ exploitant (paliers temporels)", () => {
  const e = entreeExploitant(30000);
  it("J2 carence -> 0", () => { expect(computeIJObligatoireJournaliere(2, msa, e, vars)).toBe(0); });
  it("J10 -> 26", () => { expect(computeIJObligatoireJournaliere(10, msa, e, vars)).toBe(26); });
  it("J28 -> 26", () => { expect(computeIJObligatoireJournaliere(28, msa, e, vars)).toBe(26); });
  it("J29 -> 34,66", () => { expect(computeIJObligatoireJournaliere(29, msa, e, vars)).toBe(34.66); });
  it("J200 -> 34,66 (palier terminal)", () => { expect(computeIJObligatoireJournaliere(200, msa, e, vars)).toBe(34.66); });
  it("J361 maladie ordinaire -> 0 (plafond 360)", () => {
    expect(computeIJObligatoireJournaliere(361, msa, e, vars, "maladie_ordinaire")).toBe(0);
  });
  it("J361 ALD -> 34,66 (plafond 1095)", () => {
    expect(computeIJObligatoireJournaliere(361, msa, e, vars, "ald")).toBe(34.66);
  });
});

describe("MSA 2026 — invalidite exploitant (cat1 30%, cat2 50%, bornees)", () => {
  it("cat1 revenu eleve -> plafond 600,75", () => {
    expect(computeInvalObligatoireMensuel(msa, "cat1", 0, 100000)).toBeCloseTo(600.75, 2);
  });
  it("cat1 revenu faible -> plancher 372,14", () => {
    // revenu mensuel 1000 -> 30% = 300 < plancher 372,14
    expect(computeInvalObligatoireMensuel(msa, "cat1", 0, 1000)).toBeCloseTo(372.14, 2);
  });
  it("cat2 revenu eleve -> plafond 1001,25", () => {
    expect(computeInvalObligatoireMensuel(msa, "cat2", 0, 100000)).toBeCloseTo(1001.25, 2);
  });
  it("cat2 revenu faible -> plancher 659,70", () => {
    // revenu mensuel 1000 -> 50% = 500 < plancher 659,70
    expect(computeInvalObligatoireMensuel(msa, "cat2", 0, 1000)).toBeCloseTo(659.70, 2);
  });
  it("cat2 revenu intermediaire -> 50% = 1000/mois (dans les bornes)", () => {
    // revenu mensuel 2000 -> 50% = 1000 dans [659,70 ; 1001,25]
    expect(computeInvalObligatoireMensuel(msa, "cat2", 0, 2000)).toBeCloseTo(1000, 2);
  });
  it("cat3 = copie cat2 (pas de faux trou) -> identique a cat2", () => {
    const c2 = computeInvalObligatoireMensuel(msa, "cat2", 0, 100000);
    const c3 = computeInvalObligatoireMensuel(msa, "cat3", 0, 100000);
    expect(c3).toBeCloseTo(c2!, 2);
  });
});

describe("MSA 2026 — depassement forfaitaire a bas revenu (cas exclu de G4b, documente)", () => {
  it("exploitant a tres bas revenu : IJ forfaitaire peut depasser le revenu de reference", () => {
    // revenuTNS faible -> revenuReferenceMensuel faible, mais IJ forfaitaire 34,66/j.
    const e = entreeExploitant(9000); // 750 €/mois de reference
    const result = projeterArretMaladie(e, "cat2", referentiels, "ald");
    const idxLate = result.axe.findIndex((p: any) => p.jour >= 60);
    expect(idxLate).toBeGreaterThanOrEqual(0);
    const ijMensuel = result.series.ijObligatoire[idxLate];
    // IJ = 34,66 * 30 = 1039,80 €/mois, qui DEPASSE le revenu de reference (~750).
    expect(ijMensuel).toBeCloseTo(34.66 * 30, 1);
    expect(ijMensuel).toBeGreaterThan(result.revenuReferenceMensuel);
    // Comportement attendu (IJ forfaitaire AMEXA), pas un faux signal :
    expect(result.donneesCaisseIndisponibles).toBe(false);
  });
});

describe("MSA 2026 — pas de faux 'donnees indisponibles'", () => {
  it("projection cat2 -> donneesCaisseIndisponibles false", () => {
    const e = entreeExploitant(30000);
    const result = projeterArretMaladie(e, "cat2", referentiels, "ald");
    expect(result.donneesCaisseIndisponibles).toBe(false);
  });
});
