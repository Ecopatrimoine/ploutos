// ─── LOT A (Fonction publique) — regle IJ "pourcentage_revenu_paliers" ──────
//
// Maintien statutaire titulaire : carence 1 jour, puis 90 jours a 90 % du revenu
// declare, puis 270 jours a 50 %, puis fin des droits IJ. Montant JOURNALIER =
// (revenuAnnuel / 365) x tauxRevenu du palier. AUCUN plafond PASS/SMIC (assiette
// = revenu declare, decision David 02/07). `t` = jour d'arret (t=0 = 1er jour).

import { describe, it, expect } from "vitest";
import { computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

const vars = buildPlafondVariables(referentiels);
const FP = (referentiels.caisses as any).caisses.FONCTION_PUBLIQUE;

function entreeFonct(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 64,
    statutPro: "fonctionnaire",
    caisse: "FONCTION_PUBLIQUE",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 40000,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 0,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

const daily = (revenu: number, taux: number) => (revenu / 365) * taux;

describe("Fonction publique — IJ pourcentage_revenu_paliers (maintien statutaire)", () => {
  const e = entreeFonct();

  it("carence 1 jour : t=0 -> 0", () => {
    expect(computeIJObligatoireJournaliere(0, FP, e, vars)).toBe(0);
  });
  it("t=1 (1er jour indemnise) -> 90 % du journalier", () => {
    expect(computeIJObligatoireJournaliere(1, FP, e, vars)).toBeCloseTo(daily(40000, 0.90), 6);
  });
  it("t=90 (dernier jour du palier 90 jours) -> 90 %", () => {
    expect(computeIJObligatoireJournaliere(90, FP, e, vars)).toBeCloseTo(daily(40000, 0.90), 6);
  });
  it("t=91 (bascule) -> 50 %", () => {
    expect(computeIJObligatoireJournaliere(91, FP, e, vars)).toBeCloseTo(daily(40000, 0.50), 6);
  });
  it("t=360 (dernier jour indemnise, 1 + 90 + 270 - 1) -> 50 %", () => {
    expect(computeIJObligatoireJournaliere(360, FP, e, vars)).toBeCloseTo(daily(40000, 0.50), 6);
  });
  it("t=361 (fin des droits) -> 0", () => {
    expect(computeIJObligatoireJournaliere(361, FP, e, vars)).toBe(0);
  });
  it("aucun plafond PASS/SMIC : le journalier suit le revenu declare (60000)", () => {
    const riche = entreeFonct({ salaireBrutAnnuel: 60000 });
    expect(computeIJObligatoireJournaliere(1, FP, riche, vars)).toBeCloseTo(daily(60000, 0.90), 6);
  });
});
