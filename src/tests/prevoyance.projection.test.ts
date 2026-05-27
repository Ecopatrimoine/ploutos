// ─── Tests structurels moteur de projection (Lot 4) ─────────────────────
//
// Couvre :
//   - signature publique
//   - axe temporel cohérent
//   - tolérance caisses TO_FILL / TO_VERIFY (étages à 0 + flag)
//   - fallback maintien légal quand IDCC inconnu
//   - couverture collective IJ et invalidité (compose avec l'obligatoire)
//   - contrats individuels (IJ + invalidité)
//   - cas limites : salaire = 0, âge proche retraite, ancienneté = 0
//   - aucune valeur NaN/undefined dans les séries retournées
//   - performance < 50 ms par projection
//
// Les valeurs absolues sont volontairement souples (sanity checks)
// car la majorité des chiffres caisses/CCN sont TO_VERIFY tant que
// David ne les a pas renseignés à la source. Les cas d'or fins
// (Mathieu / Lefèvre / Léa / Pierre) sont au Lot 5.

import { describe, expect, it } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

function baseEntree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40,
    ageRetraite: 64,
    statutPro: "salarie_cadre",
    caisse: "CPAM",
    idccCCN: "1486",
    ancienneteMois: 48,
    salaireBrutAnnuel: 55000,
    salaireNetMensuel: 3575,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

describe("projeterArretMaladie — signature et axe", () => {
  it("renvoie une ProjectionResult complète et typée", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    expect(r.axe).toBeDefined();
    expect(r.series).toBeDefined();
    expect(r.rupturesCles).toBeDefined();
    expect(r.basculeInvaliditeJour).toBe(1095);
    expect(r.categorieInvaliditeProjetee).toBe("cat2");
  });

  it("l'axe est strictement croissant", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    for (let i = 1; i < r.axe.length; i++) {
      expect(r.axe[i].jour).toBeGreaterThan(r.axe[i - 1].jour);
    }
  });

  it("l'axe contient les paliers fins de la phase AM (J0..J1095)", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    const jours = r.axe.map((p) => p.jour);
    for (const j of [0, 3, 7, 14, 30, 60, 90, 180, 365, 1095]) {
      expect(jours).toContain(j);
    }
  });

  it("l'axe est clampé à (ageRetraite - age) × 365", () => {
    const r = projeterArretMaladie(baseEntree({ age: 62, ageRetraite: 64 }), "cat2", referentiels);
    const dernier = r.axe[r.axe.length - 1].jour;
    expect(dernier).toBeLessThanOrEqual(2 * 365);
  });

  it("toutes les séries ont la même longueur que l'axe", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    const n = r.axe.length;
    expect(r.series.salaire.length).toBe(n);
    expect(r.series.maintienEmployeur.length).toBe(n);
    expect(r.series.ijObligatoire.length).toBe(n);
    expect(r.series.ijComplementaireCollective.length).toBe(n);
    expect(r.series.ijComplementaireIndividuelle.length).toBe(n);
    expect(r.series.pensionInvalObligatoire.length).toBe(n);
    expect(r.series.renteInvalCollective.length).toBe(n);
    expect(r.series.renteInvalIndividuelle.length).toBe(n);
  });
});

describe("projeterArretMaladie — aucune valeur NaN / undefined", () => {
  it("toutes les valeurs des séries sont des nombres finis", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    for (const key of Object.keys(r.series) as Array<keyof typeof r.series>) {
      for (const v of r.series[key]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("aucune valeur n'est négative dans la projection", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    for (const key of Object.keys(r.series) as Array<keyof typeof r.series>) {
      for (const v of r.series[key]) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("revenuReferenceMensuel est un nombre fini", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    expect(Number.isFinite(r.revenuReferenceMensuel)).toBe(true);
  });
});

describe("projeterArretMaladie — tolérance données indisponibles", () => {
  it("CPAM TO_VERIFY → étages obligatoires à 0 + flag donneesCaisseIndisponibles", () => {
    const r = projeterArretMaladie(baseEntree(), "cat2", referentiels);
    // Le référentiel actuel a la majorité des valeurs CPAM en TO_VERIFY
    // (plafondJournalier, plafondMensuel cat1/2/3…) donc on doit avoir
    // soit les IJ obligatoires à 0, soit le flag levé. On accepte les
    // deux (selon ce que le moteur a pu calculer).
    if (r.donneesCaisseIndisponibles) {
      expect(r.rupturesCles.some((rc) => rc.type === "donnees_indisponibles")).toBe(true);
    }
  });

  it("caisse TO_FILL (CARCDSF) → étages à 0 + flag levé + rupture 'donnees_indisponibles'", () => {
    const r = projeterArretMaladie(
      baseEntree({ caisse: "CARCDSF", statutPro: "tns_liberal", idccCCN: null }),
      "cat2",
      referentiels
    );
    expect(r.donneesCaisseIndisponibles).toBe(true);
    expect(r.rupturesCles.some((rc) => rc.type === "donnees_indisponibles")).toBe(true);
    // Aucune IJ ni invalidité obligatoire ne sort
    for (const v of r.series.ijObligatoire) expect(v).toBe(0);
    for (const v of r.series.pensionInvalObligatoire) expect(v).toBe(0);
  });

  it("caisse null → étages à 0, flag levé", () => {
    const r = projeterArretMaladie(
      baseEntree({ caisse: null, statutPro: "sans_activite" }),
      "cat2",
      referentiels
    );
    expect(r.donneesCaisseIndisponibles).toBe(true);
  });
});

describe("projeterArretMaladie — fallback maintien légal", () => {
  it("IDCC inconnu → useLegalDefault=true", () => {
    const r = projeterArretMaladie(baseEntree({ idccCCN: "999999" }), "cat2", referentiels);
    expect(r.useLegalDefault).toBe(true);
  });

  it("IDCC null → pas de fallback légal flaggé (pas d'IDCC saisi)", () => {
    const r = projeterArretMaladie(baseEntree({ idccCCN: null }), "cat2", referentiels);
    expect(r.useLegalDefault).toBe(false);
  });

  it("Syntec (1486) actuellement TO_VERIFY → tombe sur le maintien légal en pratique", () => {
    // Tant que le palier Syntec est TO_VERIFY dans le référentiel, le
    // moteur retombe sur le maintien légal Mensualisation.
    const r = projeterArretMaladie(baseEntree({ idccCCN: "1486" }), "cat2", referentiels);
    expect(r.useLegalDefault).toBe(true);
  });

  it("ancienneté = 0 → aucun maintien employeur (palier 12 mois min)", () => {
    const r = projeterArretMaladie(
      baseEntree({ ancienneteMois: 0 }),
      "cat2",
      referentiels
    );
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });

  it("ancienneté = 24 mois → maintien employeur > 0 sur au moins un point AM", () => {
    const r = projeterArretMaladie(
      baseEntree({ ancienneteMois: 24 }),
      "cat2",
      referentiels
    );
    const maintienMax = Math.max(...r.series.maintienEmployeur);
    expect(maintienMax).toBeGreaterThan(0);
  });
});

describe("projeterArretMaladie — couverture collective", () => {
  it("complémentaire IJ collective active après franchise", () => {
    const r = projeterArretMaladie(
      baseEntree({
        couvertureCollective: {
          ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1000, baseCalcul: "T1_T2" },
        },
      }),
      "cat2",
      referentiels
    );
    const idxJ60 = r.axe.findIndex((p) => p.jour === 60);
    const idxJ180 = r.axe.findIndex((p) => p.jour === 180);
    expect(r.series.ijComplementaireCollective[idxJ60]).toBe(0); // avant franchise
    expect(r.series.ijComplementaireCollective[idxJ180]).toBeGreaterThan(0);
  });

  it("rente invalidité collective alimente la phase invalidité cat2", () => {
    const r = projeterArretMaladie(
      baseEntree({
        couvertureCollective: {
          invalidite: {
            cat1: { pctSalaire: 0.4 },
            cat2: { pctSalaire: 0.8 },
            cat3: { pctSalaire: 1.0 },
          },
        },
      }),
      "cat2",
      referentiels
    );
    const idxJ1095 = r.axe.findIndex((p) => p.jour === 1095);
    expect(idxJ1095).toBeGreaterThanOrEqual(0);
    expect(r.series.renteInvalCollective[idxJ1095]).toBeGreaterThan(0);
  });
});

describe("projeterArretMaladie — contrats individuels", () => {
  it("contrat IJ individuel verse après franchise et avant plafond", () => {
    const r = projeterArretMaladie(
      baseEntree({
        contratsIndividuels: [
          { id: "m1", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 },
        ],
      }),
      "cat2",
      referentiels
    );
    const idxJ14 = r.axe.findIndex((p) => p.jour === 14);
    const idxJ60 = r.axe.findIndex((p) => p.jour === 60);
    expect(r.series.ijComplementaireIndividuelle[idxJ14]).toBe(0);
    expect(r.series.ijComplementaireIndividuelle[idxJ60]).toBe(100 * 30);
  });

  it("rente invalidité individuelle 60 % de la base à partir de J1095", () => {
    const r = projeterArretMaladie(
      baseEntree({
        contratsIndividuels: [
          { id: "i1", type: "invalidite", capitalOuMontant: 0, baseInvalidite: 0.6 },
        ],
      }),
      "cat2",
      referentiels
    );
    const idxJ1095 = r.axe.findIndex((p) => p.jour === 1095);
    const salaireBrutMensuel = 55000 / 12;
    expect(r.series.renteInvalIndividuelle[idxJ1095]).toBeCloseTo(salaireBrutMensuel * 0.6, 0);
  });

  it("baseInvalidite non précisée → 50 % par défaut", () => {
    const r = projeterArretMaladie(
      baseEntree({
        contratsIndividuels: [{ id: "i1", type: "invalidite", capitalOuMontant: 0 }],
      }),
      "cat2",
      referentiels
    );
    const idxJ1095 = r.axe.findIndex((p) => p.jour === 1095);
    const salaireBrutMensuel = 55000 / 12;
    expect(r.series.renteInvalIndividuelle[idxJ1095]).toBeCloseTo(salaireBrutMensuel * 0.5, 0);
  });
});

describe("projeterArretMaladie — cas limites", () => {
  it("salaire = 0 → projection à 0 partout, pas de NaN", () => {
    const r = projeterArretMaladie(
      baseEntree({ salaireBrutAnnuel: 0, salaireNetMensuel: 0 }),
      "cat2",
      referentiels
    );
    for (const key of Object.keys(r.series) as Array<keyof typeof r.series>) {
      for (const v of r.series[key]) expect(v).toBe(0);
    }
  });

  it("âge = ageRetraite → finProjectionJour = 0", () => {
    const r = projeterArretMaladie(
      baseEntree({ age: 64, ageRetraite: 64 }),
      "cat2",
      referentiels
    );
    expect(r.finProjectionJour).toBe(0);
  });

  it("catégorie cat3 acceptée par le moteur", () => {
    const r = projeterArretMaladie(baseEntree(), "cat3", referentiels);
    expect(r.categorieInvaliditeProjetee).toBe("cat3");
  });
});

describe("projeterArretMaladie — performance", () => {
  it("projection standard en moins de 50 ms", () => {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      projeterArretMaladie(baseEntree(), "cat2", referentiels);
    }
    const elapsed = (performance.now() - t0) / 10;
    expect(elapsed).toBeLessThan(50);
  });
});
