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
  // Le bloc CPAM embarqué porte plafondFormule = "1.4 * SMIC_mensuel"
  // (plafond du SALAIRE mensuel retenu, pas de l'IJ). Le moteur plafonne
  // le salaire puis calcule SJB = salaire×3/91,25 et IJ = ×0,5.
  const cpam = (referentiels.caisses as any).caisses.CPAM;
  const vars = buildPlafondVariables(referentiels);

  it("computeIJObligatoireJournaliere : plafondFormule 1,4 SMIC → IJ plafonnée à 41,95 €/j (haut salaire)", () => {
    // Vérifie qu'aucun patch n'est nécessaire : la formule embarquée suffit.
    expect(cpam.ij.plafondFormule).toBe("1.4 * SMIC_mensuel");
    const entree: EntreePerso = {
      age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: 200000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const ijJour = computeIJObligatoireJournaliere(30, cpam, entree, vars);
    expect(ijJour).toBeCloseTo(41.95, 1);
  });

  it("computeIJObligatoireJournaliere × 30 = mensuel (cohérence convention d'affichage)", () => {
    const entree: EntreePerso = {
      age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: 200000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const ijJour = computeIJObligatoireJournaliere(30, cpam, entree, vars);
    expect(ijJour).not.toBeNull();
    expect((ijJour as number) * 30).toBeCloseTo(41.95 * 30, 0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Paramètres NON fermes dans le référentiel → it.skip documenté.
// À activer quand David aura ajouté/confirmé la valeur sourcée.
// ────────────────────────────────────────────────────────────────────

describe("G1 — Paramètres confirmés à la source et figés (vérifiés 2026-05-28)", () => {
  it("Sanction non-respect 1,50 % cadres = 3 PASS = 144 180 € (ANI 17 nov 2017)", () => {
    expect(pass.prevoyanceCadres1_50.sanctionMontant).toBe(144180);
    expect(pass.prevoyanceCadres1_50.sanctionMontant).toBe(pass.pass.annuel * 3);
    expect(pass.prevoyanceCadres1_50.tauxT1Minimum).toBe(0.015);
  });

  it("Exonération prévoyance/santé : part fixe 6 % PASS = 2 883,60 € (BOSS)", () => {
    expect(pass.exonerationsSociales.prevoyanceSante.partFixeMontant).toBe(2883.6);
    expect(pass.exonerationsSociales.prevoyanceSante.partFixeMontant).toBeCloseTo(pass.pass.annuel * 0.06, 2);
    expect(pass.exonerationsSociales.prevoyanceSante.partRemuneration).toBe(0.015);
  });

  it("Exonération prévoyance/santé : plafond 12 % PASS = 5 767,20 € (BOSS)", () => {
    expect(pass.exonerationsSociales.prevoyanceSante.plafondMontant).toBe(5767.2);
    expect(pass.exonerationsSociales.prevoyanceSante.plafondMontant).toBeCloseTo(pass.pass.annuel * 0.12, 2);
  });

  it("Forfait social 8 % sur la prévoyance (≥ 11 salariés, art. D.242-1 CSS)", () => {
    expect(pass.forfaitSocial.tauxPrevoyance).toBe(0.08);
  });
});

describe("G1 — Majoration familiale IJ après J31 (≥ 3 enfants) : SUPPRIMÉE (L.323-4, LFSS art. 85)", () => {
  // CONFIRMÉ (vérifié 30/05/2026) : l'article 85 de la LFSS a modifié
  // l'art. L.323-4 CSS et SUPPRIMÉ cette majoration pour les arrêts
  // prescrits à compter du 01/07/2020 (dispositif aboli, stable). Le champ
  // majorationFamilleApresJ31 reste désactivé DÉFINITIVEMENT. Tests de
  // NON-RÉGRESSION : un assuré CPAM avec 3 enfants ne doit PAS voir ses IJ
  // majorées après le 31e jour.
  const vars = buildPlafondVariables(referentiels);
  const cpam = (referentiels.caisses as any).caisses.CPAM;
  const e: EntreePerso = {
    age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 60, salaireBrutAnnuel: 30000, salaireNetMensuel: 1950,
    nbEnfantsACharge: 3, contratsIndividuels: [], couvertureCollective: null,
  };

  it("IJ identique avant/après J31 — aucune marche d'escalier (majoration non appliquée)", () => {
    const ijJ30 = computeIJObligatoireJournaliere(30, cpam, e, vars);
    const ijJ35 = computeIJObligatoireJournaliere(35, cpam, e, vars);
    const ijJ90 = computeIJObligatoireJournaliere(90, cpam, e, vars);
    expect(ijJ30).not.toBeNull();
    expect(ijJ35).toBeCloseTo(ijJ30!, 6);
    expect(ijJ90).toBeCloseTo(ijJ30!, 6);
  });

  it("le moteur reste à 50 % du SJB, jamais le taux majoré 66,66 %", () => {
    const ijJ35 = computeIJObligatoireJournaliere(35, cpam, e, vars)!;
    const sjb = (2500 * 3) / 91.25; // salaire mensuel 2500 < plafond 1,4 SMIC
    expect(ijJ35).toBeCloseTo(sjb * 0.5, 2);
    expect(ijJ35).not.toBeCloseTo(sjb * 0.6666, 1);
  });

  it("référentiel : champ majorationFamilleApresJ31 désactivé (active ≠ true)", () => {
    expect(cpam.ij.majorationFamilleApresJ31.active).not.toBe(true);
  });
});
