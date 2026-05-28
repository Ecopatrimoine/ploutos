// ─── T1 / Famille A — Invariants structurels (PLAN_TESTS §A) ───────────
//
// Ces tests ne dépendent d'aucune valeur officielle : ils vérifient que
// la sortie du moteur est toujours bien formée, quelles que soient les
// entrées. Ils doivent passer même avec un référentiel 100 % TO_VERIFY.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, ProjectionResult, SerieEmpilee } from "../lib/prevoyance/types";
import { generateProfils } from "./__fixtures__/prevoyanceFuzzing";

const SERIES_KEYS: Array<keyof SerieEmpilee> = [
  "salaire", "maintienEmployeur", "ijObligatoire",
  "ijComplementaireCollective", "ijComplementaireIndividuelle",
  "pensionInvalObligatoire", "renteInvalCollective", "renteInvalIndividuelle",
];

const PROFILS = generateProfils(200, 1234);

function baseEntree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40, ageRetraite: 64,
    statutPro: "salarie_cadre", caisse: "CPAM", idccCCN: "1486",
    ancienneteMois: 48, salaireBrutAnnuel: 55000, salaireNetMensuel: 3575,
    contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

describe("Famille A — Invariants structurels", () => {
  // A1 — fuzzing : aucune valeur NaN / null / undefined / Infinity
  it("A1 — aucune valeur de série n'est NaN/null/undefined/Infinity (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      for (const key of SERIES_KEYS) {
        for (const v of r.series[key]) {
          expect(typeof v).toBe("number");
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  // A2 — fuzzing : aucune valeur négative
  it("A2 — aucune valeur de série n'est négative (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      for (const key of SERIES_KEYS) {
        for (const v of r.series[key]) {
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  // A3 — alignement strict axe / 7 séries
  it("A3 — axe.length === series[*].length pour les 8 séries (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const n = r.axe.length;
      for (const key of SERIES_KEYS) {
        expect(r.series[key].length).toBe(n);
      }
    }
  });

  // A4 — axe strictement croissant
  it("A4 — l'axe est strictement croissant en jour (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      for (let i = 1; i < r.axe.length; i++) {
        expect(r.axe[i].jour).toBeGreaterThan(r.axe[i - 1].jour);
      }
    }
  });

  // A5 — basculeInvaliditeJour === 1095 systématiquement
  it("A5 — basculeInvaliditeJour === 1095 systématiquement (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      expect(r.basculeInvaliditeJour).toBe(1095);
    }
  });

  // A6 — finProjectionJour === (ageRetraite - age) * 365, clampé à 0
  it("A6 — finProjectionJour = max(0, (ageRetraite - age) * 365) (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const attendu = Math.max(0, (entree.ageRetraite - entree.age) * 365);
      expect(r.finProjectionJour).toBe(attendu);
      // ≥ 1095 sauf clamp documenté quand age proche/au-delà de la retraite
      if (entree.age <= entree.ageRetraite - 3) {
        expect(r.finProjectionJour).toBeGreaterThanOrEqual(1095);
      }
    }
  });

  // A7 — phase cohérente : jour < 1095 → am, >= 1095 → invalidite
  it("A7 — la phase de chaque point d'axe est cohérente avec son jour (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      for (const p of r.axe) {
        expect(p.phase).toBe(p.jour < 1095 ? "am" : "invalidite");
      }
    }
  });

  // A8 — revenuReferenceMensuel >= 0
  it("A8 — revenuReferenceMensuel >= 0 (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      expect(Number.isFinite(r.revenuReferenceMensuel)).toBe(true);
      expect(r.revenuReferenceMensuel).toBeGreaterThanOrEqual(0);
    }
  });

  // A9 — toutes les rupturesCles ont un jour présent dans l'axe
  // Décision (a) appliquée : les jours de rupture (fin_maintien_100/6666)
  // sont désormais insérés dans l'axe par le moteur (cf. insertJoursAxe).
  it("A9 — toutes les rupturesCles ont un jour présent dans l'axe (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const joursAxe = new Set(r.axe.map((p) => p.jour));
      for (const rupture of r.rupturesCles) {
        expect(joursAxe.has(rupture.jour), `rupture ${rupture.type}@J${rupture.jour} hors axe`).toBe(true);
      }
    }
  });

  // A9bis — variante « pas de rupture orpheline » : le jour de chaque
  // rupture est dans la plage de projection [0, finProjectionJour].
  // (Filet de sécurité actif en attendant la décision sur A9.)
  it("A9bis — toute rupture a un jour dans [0, finProjectionJour] (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const max = Math.max(r.finProjectionJour, r.basculeInvaliditeJour);
      for (const rupture of r.rupturesCles) {
        expect(rupture.jour).toBeGreaterThanOrEqual(0);
        expect(rupture.jour).toBeLessThanOrEqual(max);
      }
    }
  });

  // A10 — rupturesCles triées par jour croissant
  it("A10 — les rupturesCles sont triées par jour croissant (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      for (let i = 1; i < r.rupturesCles.length; i++) {
        expect(r.rupturesCles[i].jour).toBeGreaterThanOrEqual(r.rupturesCles[i - 1].jour);
      }
    }
  });

  // A11 — performance < 50 ms (moyenne sur 100 runs)
  it("A11 — une projection s'exécute en < 50 ms (moyenne sur 100 runs)", () => {
    const e = baseEntree();
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) projeterArretMaladie(e, "cat2", referentiels);
    const moyenne = (performance.now() - t0) / 100;
    expect(moyenne).toBeLessThan(50);
  });

  // A12 — idempotence : deux appels identiques → résultats égaux
  it("A12 — deux appels identiques produisent des résultats strictement égaux", () => {
    const e = baseEntree({ ancienneteMois: 120, couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" } } });
    const r1 = projeterArretMaladie(e, "cat2", referentiels);
    const r2 = projeterArretMaladie(e, "cat2", referentiels);
    expect(r1.series).toEqual(r2.series);
    expect(r1.rupturesCles).toEqual(r2.rupturesCles);
    expect(r1.axe.map((p) => p.jour)).toEqual(r2.axe.map((p) => p.jour));
    expect(r1.revenuReferenceMensuel).toBe(r2.revenuReferenceMensuel);
  });

  // A13 — immuabilité : l'EntreePerso d'entrée n'est pas muté
  it("A13 — l'objet EntreePerso passé en entrée n'est pas muté (fonction pure)", () => {
    const e = baseEntree({
      contratsIndividuels: [{ id: "c1", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 }],
      couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" } },
    });
    const snapshot = JSON.parse(JSON.stringify(e));
    projeterArretMaladie(e, "cat3", referentiels);
    expect(JSON.parse(JSON.stringify(e))).toEqual(snapshot);
  });

  // A14 — référentiel "trou" (caisse TO_FILL) → flag + rupture donnees_indisponibles
  it("A14 — caisse non documentée (TO_FILL) → donneesCaisseIndisponibles + rupture associée", () => {
    // CARCDSF est au schéma minimal (TO_FILL) dans le référentiel.
    const e = baseEntree({ caisse: "CARCDSF", statutPro: "tns_liberal", idccCCN: null, salaireBrutAnnuel: 0, revenuTNSAnnuel: 80000 });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    expect(r.donneesCaisseIndisponibles).toBe(true);
    expect(r.rupturesCles.some((rc) => rc.type === "donnees_indisponibles")).toBe(true);
  });
});
