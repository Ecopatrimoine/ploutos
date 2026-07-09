// LOT 10c (A4) — échelle de temps compressée : compress() + génération des ticks.
import { describe, it, expect } from "vitest";
import type { ProjectionResult, SerieEmpilee } from "../lib/prevoyance/types";
import { compress, buildTicksTemps, labelExact, SEGMENTS_ECHELLE_TEMPS } from "../lib/presentation/echelleTemps";

describe("compress() — échelle linéaire par morceaux", () => {
  it("origine et valeurs aux bornes de segments (rapports cumulés)", () => {
    expect(compress(0)).toBe(0);
    expect(compress(14)).toBeCloseTo(14, 6);                 // 14×1
    expect(compress(30)).toBeCloseTo(22, 6);                 // 14 + 16×0.5
    expect(compress(180)).toBeCloseTo(37, 6);                // 22 + 150×0.1
    expect(compress(1095)).toBeCloseTo(46.15, 6);            // 37 + 915×0.01
    expect(compress(7300)).toBeCloseTo(46.15 + 6205 * 0.002, 6);
  });
  it("strictement monotone croissante", () => {
    let prev = -1;
    for (const j of [0, 3, 7, 14, 30, 60, 90, 180, 365, 1095, 2000, 7300]) {
      const x = compress(j);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
  it("négatif borné à 0 ; segments = constantes nommées", () => {
    expect(compress(-100)).toBe(0);
    expect(SEGMENTS_ECHELLE_TEMPS[0]).toEqual({ finJour: 14, rapport: 1 });
  });
});

const arr = (n: number) => Array(n).fill(0);
// Deux régimes différents => jalons majeurs différents (dérivés de la frise, pas d'un gabarit).
function friseRegime(oblig: number[], jours: number[], bascule: number, retraite: number): ProjectionResult {
  const series = {
    salaire: arr(jours.length), maintienEmployeur: arr(jours.length), ijObligatoire: oblig,
    ijComplementaireCollective: arr(jours.length), ijComplementaireIndividuelle: arr(jours.length),
    pensionInvalObligatoire: arr(jours.length), renteInvalCollective: arr(jours.length),
    renteInvalIndividuelle: arr(jours.length), renteInvalEnfants: arr(jours.length),
  } as unknown as SerieEmpilee;
  const axe = jours.map((j) => ({ jour: j, date: "2026-01-01", phase: (j >= bascule ? "invalidite" : "am") as "am" | "invalidite" }));
  return { axe, series, rupturesCles: [], basculeInvaliditeJour: bascule, finProjectionJour: retraite } as unknown as ProjectionResult;
}

describe("labelExact — libellés exacts, jamais arrondis (C2)", () => {
  it("< 61 j -> jour ; multiple 30 -> mois ; multiple 365 -> an ; sinon J{n}", () => {
    expect(labelExact(47)).toBe("J47");
    expect(labelExact(60)).toBe("J60");     // < 61 -> reste en jour
    expect(labelExact(90)).toBe("3 mois");
    expect(labelExact(120)).toBe("4 mois"); // jamais « 3 mois »
    expect(labelExact(365)).toBe("1 an");
    expect(labelExact(730)).toBe("2 ans");
    expect(labelExact(1095)).toBe("3 ans");
    expect(labelExact(547)).toBe("J547");   // pas un multiple exact -> jour
  });
});

describe("buildTicksTemps — chaque rupture libellée (niveau 1) + repères (niveau 2)", () => {
  it("chaque rupture d'étage -> tick niveau 1 libellé (aucune muette)", () => {
    // ruptures oblig à J7 (carence 0->40), J90 (taux 40->30), J1095 (bascule 30->0) + retraite
    const ticks = buildTicksTemps(friseRegime([0, 40, 40, 30, 0, 0], [0, 7, 30, 90, 1095, 7300], 1095, 7300), 7300);
    const n1 = ticks.filter((t) => t.niveau === 1);
    const jours = n1.map((t) => t.jour);
    expect(jours).toEqual(expect.arrayContaining([7, 90, 1095, 7300]));
    expect(n1.every((t) => t.label.length > 0)).toBe(true); // aucun libellé vide
    expect(n1.find((t) => t.jour === 90)!.label).toBe("3 mois");
    expect(n1.find((t) => t.jour === 1095)!.label).toBe("3 ans");
  });

  it("anti-collision : deux ruptures proches -> 2 lignes (0 et 1), les DEUX gardées", () => {
    // J900 et J950 : compress ~44.2 / 44.7, écart 0.5 < 3 % de maxX (~1.38) -> décalage.
    const ticks = buildTicksTemps(friseRegime([0, 40, 35, 30, 0, 0], [0, 7, 900, 950, 1095, 7300], 1095, 7300), 7300);
    const proches = ticks.filter((t) => t.jour === 900 || t.jour === 950);
    expect(proches.length).toBe(2);                          // aucune supprimée
    expect(new Set(proches.map((t) => t.ligne)).size).toBe(2); // sur 2 lignes distinctes
  });

  it("niveau 2 : repères présents, mais effacés près d'un jalon niveau 1", () => {
    // vue 3 ans -> repères 30/180/730 ; rupture oblig à J180 -> efface le repère 6 mois.
    const ticks = buildTicksTemps(friseRegime([0, 40, 30, 0, 0, 0], [0, 7, 180, 900, 1095, 7300], 1095, 7300), 1095);
    const n2 = ticks.filter((t) => t.niveau === 2).map((t) => t.jour);
    expect(n2).toContain(30);       // 1 mois : gardé (loin de toute rupture)
    expect(n2).not.toContain(180);  // 6 mois : effacé (rupture à J180)
  });
});
