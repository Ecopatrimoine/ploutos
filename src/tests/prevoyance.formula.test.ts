// ─── Tests parseur formule de plafond (Lot 4 extension) ────────────────

import { describe, expect, it } from "vitest";
import {
  buildPlafondVariables,
  evalFormulaPlafond,
} from "../lib/prevoyance/formula";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

const VARS = {
  SMIC_mensuel: 1823.03,
  SMIC_horaire: 12.02,
  PASS_annuel: 48060,
  PASS_mensuel: 4005,
};

describe("evalFormulaPlafond", () => {
  it("évalue une constante simple", () => {
    expect(evalFormulaPlafond("42.5", VARS)).toBe(42.5);
  });

  it("évalue 1.4 × SMIC_mensuel = 2552,24", () => {
    expect(evalFormulaPlafond("1.4 * SMIC_mensuel", VARS)).toBeCloseTo(2552.24, 2);
  });

  it("évalue le plafond IJ maladie réglementaire : 41,95 €/j", () => {
    // (1.4 × SMIC × 3) / 91.25 × 0.5 = 41,95 (cf. pass-2026.json _ijMaxJournaliereFormule)
    const r = evalFormulaPlafond("1.4 * SMIC_mensuel * 3 / 91.25 * 0.5", VARS);
    expect(r).toBeCloseTo(41.95, 2);
  });

  it("évalue avec PASS_annuel", () => {
    expect(evalFormulaPlafond("0.5 * PASS_annuel", VARS)).toBe(24030);
  });

  it("évalue avec PASS_mensuel", () => {
    expect(evalFormulaPlafond("2 * PASS_mensuel", VARS)).toBe(8010);
  });

  it("évalue strictement gauche à droite (pas de précédence)", () => {
    // 2 + 3 × 4 vaudrait 14 en math, ici on n'a que × et /
    // Pour 2 * 3 / 6 = 6/6 = 1 (gauche à droite) — confirme l'eval séquentielle
    expect(evalFormulaPlafond("2 * 3 / 6", VARS)).toBe(1);
  });

  it("retourne null pour variable inconnue", () => {
    expect(evalFormulaPlafond("1.4 * SMIC_inconnu", VARS)).toBeNull();
  });

  it("refuse l'opérateur +", () => {
    expect(evalFormulaPlafond("1 + 2", VARS)).toBeNull();
  });

  it("refuse l'opérateur -", () => {
    expect(evalFormulaPlafond("10 - 5", VARS)).toBeNull();
  });

  it("refuse les parenthèses", () => {
    expect(evalFormulaPlafond("(1 + 2) * 3", VARS)).toBeNull();
  });

  it("refuse une formule vide", () => {
    expect(evalFormulaPlafond("", VARS)).toBeNull();
  });

  it("retourne null sur division par zéro", () => {
    expect(evalFormulaPlafond("10 / 0", VARS)).toBeNull();
  });

  it("refuse un type non-string", () => {
    // @ts-expect-error : on veut justement tester un input invalide
    expect(evalFormulaPlafond(null, VARS)).toBeNull();
    // @ts-expect-error
    expect(evalFormulaPlafond(123, VARS)).toBeNull();
  });

  it("tolère les espaces et tabulations", () => {
    expect(evalFormulaPlafond("  1.4  *  SMIC_mensuel  ", VARS)).toBeCloseTo(2552.24, 2);
  });
});

describe("buildPlafondVariables", () => {
  it("expose les 4 variables attendues depuis le référentiel courant", () => {
    const v = buildPlafondVariables(referentiels);
    expect(v.SMIC_mensuel).toBeGreaterThan(0);
    expect(v.SMIC_horaire).toBeGreaterThan(0);
    expect(v.PASS_annuel).toBeGreaterThan(0);
    expect(v.PASS_mensuel).toBeGreaterThan(0);
  });

  it("SMIC_horaire dérivé de SMIC_mensuel (= mensuel × 12 / (35 × 52))", () => {
    const v = buildPlafondVariables(referentiels);
    expect(v.SMIC_horaire).toBeCloseTo((v.SMIC_mensuel * 12) / (35 * 52), 2);
  });
});

describe("intégration plafondFormule dans projection", () => {
  // Deep clone pour patcher en mémoire sans toucher au JSON livré.
  function cloneRef(): typeof referentiels {
    return JSON.parse(JSON.stringify(referentiels));
  }

  const baseEntree: EntreePerso = {
    age: 35,
    ageRetraite: 64,
    statutPro: "salarie_cadre",
    caisse: "CPAM",
    idccCCN: null,
    ancienneteMois: 24,
    salaireBrutAnnuel: 120000, // sciemment élevé pour saturer le plafond
    salaireNetMensuel: 7800,
    contratsIndividuels: [],
    couvertureCollective: null,
  };

  it("plafondFormule (salaire) plafonne le SJB → IJ ≈ 41,95 €/j (×30 ≈ 1258,5 €)", () => {
    const ref = cloneRef();
    const cpam = (ref.caisses as any).caisses.CPAM;
    // Formule réglementaire : plafond du SALAIRE mensuel = 1,4 SMIC.
    // Le moteur plafonne le salaire (2552,24 €) puis calcule
    // SJB = 2552,24×3/91,25 et IJ = ×0,5 = 41,95 €/j.
    cpam.ij.plafondFormule = "1.4 * SMIC_mensuel";

    const r = projeterArretMaladie(baseEntree, "cat2", ref);
    const idxJ30 = r.axe.findIndex((p) => p.jour === 30);
    expect(r.series.ijObligatoire[idxJ30]).toBeCloseTo(41.95 * 30, 0);
  });

  it("plafondFormule invalide → fallback sur plafondSalaireBrutMensuel figé", () => {
    const ref = cloneRef();
    const cpam = (ref.caisses as any).caisses.CPAM;
    cpam.ij.plafondFormule = "1.4 * SMIC_inconnu"; // invalide → null
    cpam.ij.plafondSalaireBrutMensuel = 2552.24;   // valeur de contrôle figée

    const r = projeterArretMaladie(baseEntree, "cat2", ref);
    const idxJ30 = r.axe.findIndex((p) => p.jour === 30);
    // Le plafond salaire figé prend le relais → même IJ plafonnée.
    expect(r.series.ijObligatoire[idxJ30]).toBeCloseTo(41.95 * 30, 0);
  });

  it("aucun plafond salaire (formule + valeur absentes) → SJB non plafonné", () => {
    const ref = cloneRef();
    const cpam = (ref.caisses as any).caisses.CPAM;
    delete cpam.ij.plafondFormule;
    delete cpam.ij.plafondSalaireBrutMensuel;

    const r = projeterArretMaladie(baseEntree, "cat2", ref);
    const idxJ30 = r.axe.findIndex((p) => p.jour === 30);
    // Brut 120 000 → SJB = (120000/12)×3/91,25 = 328,77, IJ = 164,38 €/j.
    // Sans plafond, l'IJ dépasse largement 41,95 €/j (× 30).
    expect(r.series.ijObligatoire[idxJ30]).toBeCloseTo(164.38 * 30, 0);
    expect(r.series.ijObligatoire[idxJ30]).toBeGreaterThan(41.95 * 30);
  });

  it("caisse legacy sans diviseurSJB → plafondJournalier figé s'applique", () => {
    const ref = cloneRef();
    const cpam = (ref.caisses as any).caisses.CPAM;
    // On retire le diviseur SJB et les plafonds salaire → le moteur
    // bascule sur la branche journalière historique (/360) bornée par
    // plafondJournalier.
    delete cpam.ij.diviseurSJB;
    delete cpam.ij.plafondFormule;
    delete cpam.ij.plafondSalaireBrutMensuel;
    cpam.ij.plafondJournalier = 50;

    const r = projeterArretMaladie(baseEntree, "cat2", ref);
    const idxJ30 = r.axe.findIndex((p) => p.jour === 30);
    // (120000/360)×0,5 = 166,67 €/j > 50 → borné à 50 €/j (×30 = 1500 €).
    expect(r.series.ijObligatoire[idxJ30]).toBeCloseTo(50 * 30, 0);
  });
});
