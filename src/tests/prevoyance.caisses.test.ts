// ─── T5 / Famille G2 — Régimes obligatoires par caisse (PLAN_TESTS §G2) ─
//
// STRUCTURE PRÊTE À ACTIVER. Tant que caisses-2026.json contient des
// TO_VERIFY / TO_FILL sur les IJ journalières, taux d'invalidité et
// capitaux décès, ces tests restent en describe.skip. On les activera
// caisse par caisse, AU FIL du remplissage des valeurs sourcées (ameli,
// carmf.fr, cipav, carpimko, secu-independants…).
//
// Les tests portent sur la valeur JOURNALIÈRE (computeIJObligatoireJournaliere),
// pas le mensuel d'affichage (convention ×30).
//
// PRIORITÉ de remplissage : CPAM (tous salariés) → SSI (TNS commerce/
// artisans) → CARMF (médecins) → CIPAV (PL non régl.) → CARPIMKO → autres.

import { describe, it, expect } from "vitest";
import { computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

const vars = buildPlafondVariables(referentiels);
const caisses = (referentiels.caisses as any).caisses;

function entreeSalarie(brut: number): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: brut,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
  };
}
function entreeTNS(caisse: EntreePerso["caisse"], revenu: number, classe?: string): EntreePerso {
  return {
    age: 48, ageRetraite: 64, statutPro: "tns_liberal", caisse,
    idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: revenu, classeCotisationCaisse: classe,
    contratsIndividuels: [], couvertureCollective: null,
  };
}

// ── CPAM (régime général, tous salariés du privé) ──
describe.skip("G2 — CPAM 2026 (à activer après remplissage caisses-2026.json)", () => {
  const cpam = caisses.CPAM;
  it("carence 3 jours : IJ = 0 sur [J0,J2], > 0 à partir de J3", () => {
    const e = entreeSalarie(40000);
    expect(computeIJObligatoireJournaliere(2, cpam, e, vars)).toBe(0);
    expect(computeIJObligatoireJournaliere(3, cpam, e, vars)!).toBeGreaterThan(0);
  });
  it("IJ plafonnée à 41,95 €/j pour salaire > 2552 €/mois (plafond SJB)", () => {
    const ij = computeIJObligatoireJournaliere(30, cpam, entreeSalarie(200000), vars);
    expect(ij).toBeCloseTo(41.95, 1);
  });
  it("IJ proportionnelle (50 % SJR) pour salaire < plafond", () => {
    // ex. brut 24000 → SJR ~65,75 €/j → IJ ~32,88 €/j (à confirmer formule)
    const ij = computeIJObligatoireJournaliere(30, cpam, entreeSalarie(24000), vars);
    expect(ij!).toBeGreaterThan(0);
    expect(ij!).toBeLessThan(41.95);
  });
  it("invalidité cat1 = 30 % SAM, plafonnée à 50 % PASS mensuel", () => {
    expect(cpam.invalidite.categories.cat1.tauxBase).toBe(0.30);
  });
  it("invalidité cat2 = 50 % SAM", () => {
    expect(cpam.invalidite.categories.cat2.tauxBase).toBe(0.50);
  });
  it("invalidité cat3 = cat2 + majoration tierce personne", () => {
    expect(typeof cpam.invalidite.categories.cat3.majorationTiercePersonneMensuelle).toBe("number");
  });
  it("capital décès = montant forfaitaire 2026 (à vérifier ameli, ~3 910 €)", () => {
    expect(typeof cpam.capitalDeces.montant).toBe("number");
  });
});

// ── SSI (TNS commerçants / artisans) ──
describe.skip("G2 — SSI 2026 (à activer après remplissage)", () => {
  const ssi = caisses.SSI;
  it("carence maladie 3 jours (0 en AT/hospitalisation)", () => {
    expect(ssi.ij.carenceJours).toBe(3);
  });
  it("IJ entre plancher (~5,63 €/j bas revenu) et plafond (~64 €/j, 3 PASS)", () => {
    const ijBas = computeIJObligatoireJournaliere(30, ssi, entreeTNS("SSI", 8000), vars);
    const ijHaut = computeIJObligatoireJournaliere(30, ssi, entreeTNS("SSI", 200000), vars);
    expect(ijBas!).toBeGreaterThanOrEqual(5);
    expect(ijHaut!).toBeLessThanOrEqual(70);
  });
  it("durée maladie 87 j (hors ALD 360 j) — à vérifier", () => {
    expect(typeof ssi.ij.plafondDureeJours).toBe("number");
  });
  it("capital décès actif = 20 % PASS = 9 612 € (à vérifier)", () => {
    expect(ssi.capitalDeces.montantActif).toBeCloseTo(9612, 0);
  });
});

// ── CARMF (médecins libéraux) — LE trou pédagogique (carence 90j) ──
describe.skip("G2 — CARMF 2026 (à activer après remplissage)", () => {
  const carmf = caisses.CARMF;
  it("carence 90 jours : IJ obligatoire = 0 sur [J0,J89], première valeur à J90", () => {
    const e = entreeTNS("CARMF", 95000, "B");
    expect(computeIJObligatoireJournaliere(60, carmf, e, vars)).toBe(0);
    expect(computeIJObligatoireJournaliere(90, carmf, e, vars)!).toBeGreaterThan(0);
  });
  it("IJ uniforme par classe A/B/C (valeurs journalières figées)", () => {
    expect(typeof carmf.ij.classes.B.ijJournaliere).toBe("number");
  });
  it("capital décès forfaitaire par classe (~71 500 € selon classe)", () => {
    expect(carmf.capitalDeces.montants).toBeDefined();
  });
});

// ── CIPAV (professions libérales non réglementées) ──
describe.skip("G2 — CIPAV 2026 (à activer après remplissage)", () => {
  const cipav = caisses.CIPAV;
  it("IJ faible (~22 €/j), introduite en 2021", () => {
    const ij = computeIJObligatoireJournaliere(30, cipav, entreeTNS("CIPAV", 50000), vars);
    expect(ij!).toBeCloseTo(22, 0);
  });
  it("durée limitée 87 jours (à vérifier 2026)", () => {
    expect(cipav.ij.plafondDureeJours).toBe(87);
  });
});

// ── CARPIMKO (auxiliaires médicaux) ──
describe.skip("G2 — CARPIMKO 2026 (à activer après remplissage)", () => {
  const carpimko = caisses.CARPIMKO;
  it("carence 90 jours, IJ uniforme", () => {
    expect(carpimko.ij.carenceJours).toBe(90);
    expect(typeof carpimko.ij.ijJournaliere).toBe("number");
  });
});
