// LOT 10c (A4) — échelle de temps compressée : compress() + génération des ticks.
import { describe, it, expect } from "vitest";
import type { ProjectionResult, SerieEmpilee } from "../lib/prevoyance/types";
import { compress, buildTicksTemps, SEGMENTS_ECHELLE_TEMPS } from "../lib/presentation/echelleTemps";

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

describe("buildTicksTemps — jalons du régime obligatoire de la personne", () => {
  it("régime A : IJ démarre J7 puis change J90 ; bascule 1095, retraite 7300", () => {
    // oblig: 0 (J0), 40 (J7 carence-end), 40, 30 (J90 changement taux), 30, 30 (bascule=pension)
    const ticks = buildTicksTemps(friseRegime([0, 40, 40, 30, 30, 25], [0, 7, 30, 90, 1095, 7300], 1095, 7300), 7300);
    const jours = ticks.filter((t) => t.major).map((t) => t.jour);
    expect(jours).toContain(7);    // fin de carence (0->40)
    expect(jours).toContain(90);   // changement de taux (40->30)
    expect(jours).toContain(1095); // bascule invalidité
    expect(jours).toContain(7300); // retraite
  });

  it("régime B (différent) : IJ démarre J3, pas de palier à J90 -> jalons différents", () => {
    const ticks = buildTicksTemps(friseRegime([0, 50, 50, 50, 50, 45], [0, 3, 30, 90, 1095, 7300], 1095, 7300), 7300);
    const jours = ticks.filter((t) => t.major).map((t) => t.jour);
    expect(jours).toContain(3);        // carence différente
    expect(jours).not.toContain(90);   // pas de changement de taux ici
  });

  it("anti-collision : deux jalons majeurs trop proches -> un seul gardé", () => {
    // changements à J3 et J7 : compress(3)=3, compress(7)=7 -> écart 4 > 2.5 (gardés) ;
    // avec minGap élevé (10), ils fusionnent.
    const proj = friseRegime([0, 40, 45, 45, 45, 40], [0, 3, 7, 30, 1095, 7300], 1095, 7300);
    expect(buildTicksTemps(proj, 7300, 2.5).filter((t) => t.major).map((t) => t.jour)).toEqual(expect.arrayContaining([3, 7]));
    const fusion = buildTicksTemps(proj, 7300, 10).map((t) => t.jour);
    expect(fusion.filter((j) => j === 3 || j === 7).length).toBe(1); // un seul des deux
  });
});
