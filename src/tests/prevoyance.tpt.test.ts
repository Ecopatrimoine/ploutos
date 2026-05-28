// ─── LOT TPT — mi-temps thérapeutique (SPEC_ALD_TPT §5.7) ──────────────
//
// Couvre : phase TPT (salaire partiel + IJ plafonnée à la perte, cumul
// ≤ salaire plein), 80 %, retour arrêt total avec cumul de durée,
// guérison (pas de bascule invalidité), TPT × ALD, ruptures debut_tpt /
// fin_tpt dans l'axe, G4 vert, coexistence avec le bornage SURCOUV, et
// cas limites (carence, 100 %, finJour > 1095 borné).
//
// Astuce : `revenuReferenceMensuel` est fixé explicitement sur l'entrée
// (le moteur l'utilise tel quel) → arithmétique TPT déterministe. L'IJ
// pleine de référence est LUE d'une projection sans TPT, pas codée en dur.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { tptInputError } from "../lib/prevoyance/tpt";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, ProjectionResult, TptConfig } from "../lib/prevoyance/types";

const R = 2000; // revenu de référence mensuel (fixé pour des calculs ronds)

// Salarié CPAM, ancienneté 0 (aucun maintien employeur → bruit nul),
// revenu de référence forcé à R. L'IJ obligatoire reste calculée sur le
// brut (proportionnelle, sous le plafond 1,4 SMIC).
function salCPAM(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40,
    ageRetraite: 64,
    statutPro: "salarie_cadre",
    caisse: "CPAM",
    idccCCN: null,
    ancienneteMois: 0,
    salaireBrutAnnuel: 30000,
    salaireNetMensuel: 0,
    revenuReferenceMensuel: R,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

function tpt(over: Partial<TptConfig> = {}): TptConfig {
  return {
    actif: true,
    debutJour: 120,
    finJour: 500,
    pctTempsTravaille: 0.5,
    apresTpt: "retour_arret_total",
    ...over,
  };
}

function idxJour(axe: ProjectionResult["axe"], j: number): number {
  return axe.findIndex((p) => p.jour === j);
}

function totalAtIdx(s: ProjectionResult["series"], i: number): number {
  return (
    s.salaire[i] +
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i]
  );
}

// IJ pleine mensuelle servie à J120 en arrêt total (lue, pas hardcodée).
const ijPleineJ120 = (() => {
  const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald");
  return r.series.ijObligatoire[idxJour(r.axe, 120)];
})();

describe("TPT — phase mi-temps thérapeutique", () => {
  it("50 % : salaire = moitié du revenu réf, IJ = min(IJ pleine, perte), cumul ≤ salaire plein", () => {
    const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ pctTempsTravaille: 0.5 }));
    const j = idxJour(r.axe, 120);
    const salairePartiel = R * 0.5;
    const perte = R - salairePartiel;
    expect(r.series.salaire[j]).toBeCloseTo(salairePartiel, 6);
    expect(r.series.ijObligatoire[j]).toBeCloseTo(Math.min(ijPleineJ120, perte), 6);
    expect(totalAtIdx(r.series, j)).toBeLessThanOrEqual(R * 1.001);
  });

  it("80 % : IJ TPT plus faible qu'à 50 % (perte de salaire moindre)", () => {
    const r80 = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ pctTempsTravaille: 0.8 }));
    const r50 = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ pctTempsTravaille: 0.5 }));
    const j = idxJour(r80.axe, 120);
    expect(r80.series.salaire[j]).toBeCloseTo(R * 0.8, 6);
    expect(r80.series.ijObligatoire[j]).toBeCloseTo(Math.min(ijPleineJ120, R * 0.2), 6);
    expect(r80.series.ijObligatoire[j]).toBeLessThan(r50.series.ijObligatoire[j]);
    expect(totalAtIdx(r80.series, j)).toBeLessThanOrEqual(R * 1.001);
  });

  it("100 % : salaire plein, IJ TPT nulle (temps plein de fait), cumul = revenu réf", () => {
    const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ pctTempsTravaille: 1.0 }));
    const j = idxJour(r.axe, 120);
    expect(r.series.salaire[j]).toBeCloseTo(R, 6);
    expect(r.series.ijObligatoire[j]).toBeCloseTo(0, 6);
    expect(totalAtIdx(r.series, j)).toBeCloseTo(R, 6);
  });

  it("plafond de non-sur-indemnisation × SURCOUV : un contrat individuel indemnitaire est borné, cumul ≤ salaire plein", () => {
    // TNS CARMF (IJ obligatoire 0) + IJ individuelle indemnitaire 200 €/j
    // (=6000) très au-delà du besoin. En TPT 50 % : salaire 1500, l'IJ
    // individuelle ne comble que la marge (1500) → cumul = 3000 = réf.
    const e = salCPAM({
      statutPro: "tns_liberal",
      caisse: "CARMF",
      salaireBrutAnnuel: 0,
      revenuTNSAnnuel: 36000,
      revenuReferenceMensuel: 3000,
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels, "ald", tpt({ pctTempsTravaille: 0.5 }));
    const j = idxJour(r.axe, 120);
    expect(r.series.salaire[j]).toBeCloseTo(1500, 6);
    expect(r.series.ijComplementaireIndividuelle[j]).toBeCloseTo(1500, 6);
    expect(totalAtIdx(r.series, j)).toBeLessThanOrEqual(3000 * 1.001);
    expect(r.surCouvertureIndemnitaireBornee).toBe(true);
  });
});

describe("TPT — après la fin (retour arrêt total vs guérison)", () => {
  it("retour arrêt total × cumul de durée : ordinaire coupe à 360, ALD maintient (à J547 > finJour)", () => {
    const e = salCPAM();
    const rOrd = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire", tpt({ apresTpt: "retour_arret_total" }));
    const rAld = projeterArretMaladie(e, "cat2", referentiels, "ald", tpt({ apresTpt: "retour_arret_total" }));
    const jOrd = idxJour(rOrd.axe, 547);
    const jAld = idxJour(rAld.axe, 547);
    // Ordinaire : à J547 le plafond 360 j est consommé (arrêt continu
    // J0→TPT→retour) → IJ obligatoire nulle, revenu total nul.
    expect(rOrd.series.ijObligatoire[jOrd]).toBe(0);
    expect(totalAtIdx(rOrd.series, jOrd)).toBe(0);
    // ALD : plafond 1095 → l'IJ pleine reprend après le TPT.
    expect(rAld.series.ijObligatoire[jAld]).toBeGreaterThan(0);
  });

  it("guérison : salaire plein après finJour, aucune pension invalidité, pas de bascule", () => {
    const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ apresTpt: "guerison" }));
    const j547 = idxJour(r.axe, 547);
    expect(r.series.salaire[j547]).toBeCloseTo(R, 6);
    expect(totalAtIdx(r.series, j547)).toBeCloseTo(R, 6);
    const j1095 = idxJour(r.axe, 1095);
    expect(r.series.salaire[j1095]).toBeCloseTo(R, 6);
    expect(r.series.pensionInvalObligatoire[j1095]).toBe(0);
    expect(r.rupturesCles.some((rc) => rc.type === "bascule_invalidite")).toBe(false);
  });
});

describe("TPT — axe, ruptures et invariants", () => {
  it("ruptures debut_tpt / fin_tpt présentes, dans l'axe et triées (A9 étendu)", () => {
    const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt());
    const jours = r.axe.map((p) => p.jour);
    expect(jours).toContain(120);
    expect(jours).toContain(500);
    expect(r.rupturesCles.some((rc) => rc.type === "debut_tpt" && rc.jour === 120)).toBe(true);
    expect(r.rupturesCles.some((rc) => rc.type === "fin_tpt" && rc.jour === 500)).toBe(true);
    const joursAxe = new Set(jours);
    for (const rc of r.rupturesCles) expect(joursAxe.has(rc.jour)).toBe(true);
    for (let i = 1; i < r.rupturesCles.length; i++) {
      expect(r.rupturesCles[i].jour).toBeGreaterThanOrEqual(r.rupturesCles[i - 1].jour);
    }
  });

  it("G4 (anti-sur-indemnisation) reste vert avec TPT : cumul ≤ revenu réf sur toute la phase AM", () => {
    const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt());
    for (const p of r.axe) {
      if (p.jour >= r.basculeInvaliditeJour) continue;
      expect(totalAtIdx(r.series, idxJour(r.axe, p.jour))).toBeLessThanOrEqual(R * 1.001);
    }
  });

  it("rétrocompatibilité : tpt inactif ≡ aucun tpt (séries identiques)", () => {
    const sans = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald");
    const inactif = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ actif: false }));
    expect(inactif.series).toEqual(sans.series);
    expect(inactif.rupturesCles).toEqual(sans.rupturesCles);
  });
});

describe("TPT — cas limites", () => {
  it("finJour > 1095 borné à la bascule : TPT actif à J912, invalidité normale à J1095", () => {
    const r = projeterArretMaladie(
      salCPAM(),
      "cat2",
      referentiels,
      "ald",
      tpt({ debutJour: 900, finJour: 1300, apresTpt: "retour_arret_total" })
    );
    // En phase TPT à J912 : le salaire partiel réapparaît.
    expect(r.series.salaire[idxJour(r.axe, 912)]).toBeCloseTo(R * 0.5, 6);
    // À J1095 : pas de guérison → bascule invalidité normale.
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, 1095)]).toBeGreaterThan(0);
    expect(r.rupturesCles.some((rc) => rc.type === "bascule_invalidite")).toBe(true);
    // Aucun point d'axe ne porte de salaire TPT au-delà de la bascule.
    for (const p of r.axe) {
      if (p.jour > 1095) expect(r.series.salaire[idxJour(r.axe, p.jour)]).toBe(0);
    }
  });

  it("début pendant la carence : le moteur reste robuste (IJ TPT nulle tant que carence)", () => {
    // debutJour 2 < carence CPAM 3 j. L'UI refuse (cf. tptInputError),
    // mais le moteur ne doit pas produire de valeur aberrante.
    const r = projeterArretMaladie(salCPAM(), "cat2", referentiels, "ald", tpt({ debutJour: 2, finJour: 400 }));
    const j2 = idxJour(r.axe, 2);
    expect(j2).toBeGreaterThan(0);
    expect(r.series.salaire[j2]).toBeCloseTo(R * 0.5, 6);
    expect(r.series.ijObligatoire[j2]).toBe(0); // carence non écoulée
    expect(totalAtIdx(r.series, j2)).toBeLessThanOrEqual(R * 1.001);
  });

  it("validation UI (tptInputError) : carence, ordre des bornes, plage du %", () => {
    expect(tptInputError(120, 500, 0.5, 3)).toBeNull();
    expect(tptInputError(2, 500, 0.5, 3)).toMatch(/carence/i);
    expect(tptInputError(500, 120, 0.5, 3)).toMatch(/postérieure/i);
    expect(tptInputError(120, 500, 0.1, 3)).toMatch(/20 %/);
    expect(tptInputError(120, 500, 1.5, 3)).toMatch(/20 %/);
  });
});
