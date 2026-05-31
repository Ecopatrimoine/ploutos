// ─── LOT CAVOM-1 — Régime obligatoire CAVOM (forfaitaire) ──────────────
//
// CAVOM (officiers ministériels : huissiers, commissaires-priseurs…) est
// une caisse FORFAITAIRE sans grille de revenu : la classe est choisie
// librement (forfait.classeOption). Particularité sensible : la CAVOM ne
// verse AUCUNE IJ propre. Phase J4→J90 = relais CPAM ; au-delà de J90 =
// trou (aucun revenu de remplacement côté régime obligatoire).
//
// On réplique les patterns d'import/helpers de prevoyance.caisses.test.ts.

import { describe, it, expect } from "vitest";
import {
  computeIJObligatoireJournaliere,
  resolveDiscriminant,
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
  projeterArretMaladie,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;
const cavom = caisses.CAVOM;
const vars = buildPlafondVariables(referentiels);

// Entrée TNS-libéral affiliée CAVOM (classe choisie via forfait.classeOption).
function entreeCavom(forfait: ForfaitConfig, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 50,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse: "CAVOM",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 60000,
    contratsIndividuels: [],
    couvertureCollective: null,
    forfait,
    ...over,
  };
}

describe("Forfaitaire — CAVOM 2026 (PDF officiel RID 13/01/2026)", () => {
  it("schéma JSON : moteur forfaitaire, discriminant classe sans grille, phase1 CPAM", () => {
    expect(cavom.moteur).toBe("forfaitaire");
    expect(cavom.discriminant.type).toBe("classe");
    expect(cavom.discriminant.grilleRevenuClasse).toBeUndefined();
    expect(cavom.discriminant.sourceClasse).toBeUndefined();
    expect(cavom.ij.phase1.type).toBe("cpam");
    expect(cavom.ij.plafondDureeJours).toBeNull();
  });

  // ── 4a) Invalidité, classe forcée "C", taux 80 (>=66) ──
  it("invalidité classe C, taux 80 → 33 070/12 €/mois", () => {
    const e = entreeCavom({ tauxInvalidite: 80, classeOption: "C" });
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(33070 / 12, 2);
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(2755.83, 2);
  });

  // ── 4b) Autres classes + capital décès + resolveDiscriminant ──
  it("invalidité classe A → 8 268/12 ; classe D → 49 605/12 €/mois", () => {
    const eA = entreeCavom({ tauxInvalidite: 80, classeOption: "A" });
    const eD = entreeCavom({ tauxInvalidite: 80, classeOption: "D" });
    expect(forfaitaireInvalMensuel(cavom, eA)).toBeCloseTo(8268 / 12, 2);
    expect(forfaitaireInvalMensuel(cavom, eD)).toBeCloseTo(49605 / 12, 2);
  });

  it("capital décès classe C → 70 965 € ; resolveDiscriminant honore classeOption", () => {
    const eC = entreeCavom({ tauxInvalidite: 0, classeOption: "C" });
    expect(resolveDiscriminant(cavom, eC)).toBe("C");
    expect(forfaitaireCapitalDeces(cavom, eC)).toBe(70965);
  });

  // ── 4c) IJ PHASE — le point sensible (relais CPAM puis trou) ──
  it("IJ : relais CPAM avant J90, trou (0) après J90 ; pas de faux warning ALD", () => {
    const e = entreeCavom({ tauxInvalidite: 0, classeOption: "C" });
    const result = projeterArretMaladie(e, "cat2", referentiels);

    const idx60 = result.axe.findIndex((p: any) => p.jour === 60);
    const idx120 = result.axe.findIndex((p: any) => p.jour === 120);
    expect(idx60).toBeGreaterThanOrEqual(0);
    expect(idx120).toBeGreaterThanOrEqual(0);

    // Jour 60 (t < 90) : relais CPAM. Valeur mensuelle = IJ CPAM journalière ×30.
    const expected60 =
      computeIJObligatoireJournaliere(60, caisses.CPAM, e, vars, "ald") * 30;
    expect(expected60).toBeGreaterThan(0); // CPAM verse une IJ positive pour revenu 60 000
    expect(result.series.ijObligatoire[idx60]).toBeCloseTo(expected60, 2);

    // Jour 120 (90 < t < 1095) : la CAVOM ne verse aucune IJ → le trou.
    expect(result.series.ijObligatoire[idx120]).toBeCloseTo(0, 2);

    // Forfaitaire renseigné → pas de faux « données indisponibles ».
    expect(result.donneesCaisseIndisponibles).toBe(false);
  });

  // ── 4d) Invalidité binaire : taux 50 (<66) → 0 ──
  it("invalidité taux 50 (< seuil 66), classe C → 0 (mode binaire)", () => {
    const e = entreeCavom({ tauxInvalidite: 50, classeOption: "C" });
    expect(forfaitaireInvalMensuel(cavom, e)).toBe(0);
  });
});
