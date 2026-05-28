// ─── T4 / Famille G1 — Socle réglementaire 2026 (PLAN_TESTS §G1) ───────
//
// Vérifie les paramètres SOCLE 2026 (PASS, SMIC, IJSS générales,
// forfait social). PAS les caisses individuelles ni les CCN (G2/G3, T5).
//
// RÈGLE : un test n'est ACTIF que si sa valeur est FERME dans
// pass-2026.json. Tout paramètre encore TO_VERIFY (ou absent du
// référentiel) est en it.skip documenté — il s'activera quand David
// aura rempli la valeur sourcée. Aucune valeur devinée n'est figée.

import { describe, it, expect } from "vitest";
import { referentiels } from "../data/prevoyance";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import type { EntreePerso } from "../lib/prevoyance/types";

const pass = referentiels.pass as any;

describe("G1 — Socle 2026 : PASS & SMIC (valeurs fermes dans pass-2026.json)", () => {
  it("PASS annuel = 48 060 €", () => {
    expect(pass.pass.annuel).toBe(48060);
  });
  it("PMSS (PASS mensuel) = 4 005 €", () => {
    expect(pass.pass.mensuel).toBe(4005);
  });
  it("PASS journalier = 220 € (arrêté 22/12/2025, D.242-17 CSS)", () => {
    expect(pass.pass.journalier).toBe(220);
  });
  it("SMIC mensuel de référence = 1 823,03 €", () => {
    expect(pass.smicMensuelReference).toBe(1823.03);
  });
  it("SMIC horaire dérivé ≈ 12,02 € (SMIC mensuel × 12 / (35 × 52))", () => {
    const v = buildPlafondVariables(referentiels);
    expect(v.SMIC_horaire).toBeCloseTo(12.02, 2);
  });
  it("Tranches T1/T2 cohérentes avec le PASS (T2.max = 8 PASS)", () => {
    expect(pass.tranches.T1.max).toBe(pass.pass.annuel);
    expect(pass.tranches.T2.max).toBe(pass.pass.annuel * 8);
  });
});

describe("G1 — IJSS maladie ordinaire (valeurs fermes)", () => {
  const m = pass.ijss.maladieOrdinaire;

  it("carence 3 jours", () => {
    expect(m.carenceJours).toBe(3);
  });
  it("taux IJ = 50 %", () => {
    expect(m.tauxIJ).toBe(0.5);
  });
  it("plafond SJB mensuel = 2 552,24 € ET = 1,4 × SMIC mensuel", () => {
    expect(m.plafondSalaireBrutMensuel).toBe(2552.24);
    expect(m.plafondSalaireBrutMensuel).toBeCloseTo(pass.smicMensuelReference * 1.4, 2);
  });
  it("IJ max journalière = 41,95 € ET = (plafond SJB × 3) / 91,25 × 0,5", () => {
    expect(m.ijMaxJournaliere).toBe(41.95);
    const calcule = (m.plafondSalaireBrutMensuel * 3) / 91.25 * 0.5;
    expect(m.ijMaxJournaliere).toBeCloseTo(calcule, 1);
  });
});

describe("G1 — IJSS accident du travail / maladie pro (valeurs fermes)", () => {
  const at = pass.ijss.accidentTravail;
  it("plafond J1-J28 = 240,49 €/j (R.433-1 CSS)", () => {
    expect(at.plafondJournalierJ1_J28).toBe(240.49);
  });
  it("plafond J29+ = 320,66 €/j (R.433-1 CSS)", () => {
    expect(at.plafondJournalierApresJ29).toBe(320.66);
    expect(at.plafondJournalierApresJ29).toBeGreaterThan(at.plafondJournalierJ1_J28);
  });
});

describe("G1 — Maternité / paternité & forfait social (valeurs fermes)", () => {
  it("IJ maternité/paternité max = 104,02 €/j", () => {
    expect(pass.ijss.maternitePaternite.ijMaxJournaliere).toBe(104.02);
  });
  it("forfait social standard = 20 %", () => {
    expect(pass.forfaitSocial.tauxStandard).toBe(0.2);
  });
  it("forfait social réduit < 11 salariés = 0 %", () => {
    expect(pass.forfaitSocial.tauxReduitMoinsDe11Salaries).toBe(0);
  });
  it("forfait social épargne salariale = 16 %", () => {
    expect(pass.forfaitSocial.tauxReduitEpargneSalariale).toBe(0.16);
  });
});

describe("G1 — Cohérence socle ↔ calcul IJ (plafondFormule)", () => {
  it("computeIJObligatoireJournaliere : CPAM patché avec plafondFormule 1,4 SMIC → IJ plafonnée à 41,95 €/j", () => {
    // Patch en mémoire (sans toucher au JSON) : CPAM avec la formule
    // réglementaire. Haut salaire pour saturer le plafond.
    const ref = JSON.parse(JSON.stringify(referentiels));
    ref.caisses.caisses.CPAM.ij.plafondFormule = "1.4 * SMIC_mensuel * 3 / 91.25 * 0.5";
    const vars = buildPlafondVariables(ref);
    const entree: EntreePerso = {
      age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: 200000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const ijJour = computeIJObligatoireJournaliere(30, ref.caisses.caisses.CPAM, entree, vars);
    expect(ijJour).toBeCloseTo(41.95, 1);
  });

  it("computeIJObligatoireJournaliere × 30 = mensuel (cohérence convention d'affichage)", () => {
    const ref = JSON.parse(JSON.stringify(referentiels));
    ref.caisses.caisses.CPAM.ij.plafondJournalier = 41.95;
    const vars = buildPlafondVariables(ref);
    const entree: EntreePerso = {
      age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: 200000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const ijJour = computeIJObligatoireJournaliere(30, ref.caisses.caisses.CPAM, entree, vars);
    expect(ijJour).not.toBeNull();
    expect((ijJour as number) * 30).toBeCloseTo(41.95 * 30, 5);
  });
});

// ────────────────────────────────────────────────────────────────────
// Paramètres NON fermes dans le référentiel → it.skip documenté.
// À activer quand David aura ajouté/confirmé la valeur sourcée.
// ────────────────────────────────────────────────────────────────────

describe("G1 — Paramètres à confirmer (it.skip, non figés dans le référentiel)", () => {
  // majorationApres30JoursAvecEnfants = "TO_VERIFY" dans pass-2026.json
  it.skip("IJSS maladie : majoration familiale après J30 (≥ 3 enfants) — TO_VERIFY", () => {
    // Source présumée : ameli.fr (majoration à compter du 31e jour).
    expect(pass.ijss.maladieOrdinaire.majorationApres30JoursAvecEnfants).toBeTypeOf("number");
  });

  // Sanction 1,50 % cadres = 3 PASS — ABSENT du référentiel (règle métier).
  it.skip("Sanction non-respect 1,50 % cadres = 3 PASS = 144 180 € — à ajouter au référentiel", () => {
    // Source : ANI 17 nov 2017. 3 × 48060 = 144 180.
    // À ajouter comme champ ferme avant activation.
    expect(pass.pass.annuel * 3).toBe(144180); // formule vérifiable, mais pas exposée comme paramètre
  });

  // Exonération sociale prévoyance/santé — formule texte, pas de montant ferme.
  it.skip("Exonération prévoyance/santé : 6 % PASS = 2 883,60 € — montant non figé (formule seule)", () => {
    // Source : BOSS. 6 % × 48060 = 2 883,60. Le JSON ne stocke que la formule.
    expect(pass.pass.annuel * 0.06).toBeCloseTo(2883.6, 2);
  });
  it.skip("Exonération prévoyance/santé : plafond 12 % PASS = 5 767,20 € — montant non figé", () => {
    // Source : BOSS. 12 % × 48060 = 5 767,20.
    expect(pass.pass.annuel * 0.12).toBeCloseTo(5767.2, 2);
  });

  // Forfait social 8 % prévoyance (≥ 11 salariés) — ABSENT (le JSON a 20 % standard).
  it.skip("Forfait social 8 % sur la prévoyance (≥ 11 salariés) — à ajouter (divergence avec 20 % standard)", () => {
    // Source : BOSS / URSSAF. Le forfait social sur les contributions
    // patronales de prévoyance complémentaire est de 8 % (≥ 11 sal.),
    // distinct du taux standard 20 %. À ajouter au référentiel comme
    // champ dédié (ex. forfaitSocial.tauxPrevoyance).
    expect((pass.forfaitSocial as any).tauxPrevoyance).toBe(0.08);
  });
});
