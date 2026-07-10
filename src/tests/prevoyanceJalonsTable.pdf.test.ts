// LOT 11 G5-E — le tableau « Points clés » du PDF prévoyance dérive des MÊMES jalons que
// le graphe : les ruptures niveau 1 de la frise (ticksPdf), + J0 (état initial). Fini le
// gabarit fixe [0,7,30,90,180,365,1095] qui masquait les vraies ruptures (David J30 Madelin ;
// Erika J37/J67 maintien légal). Preuve : libellés(table) = [« J0 »] ∪ libellés(ticks niveau 1).
import { describe, it, expect } from "vitest";
import type { ProjectionResult, SerieEmpilee } from "../lib/prevoyance/types";
import { buildJalons } from "../lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { ticksPdf } from "../lib/pdf/v2/prevoyanceChart";

const arr = (n: number) => Array(n).fill(0);

// Frise minimale pilotée par l'IJ obligatoire : chaque changement de valeur = une rupture.
function makeProjection(jours: number[], oblig: number[], bascule = 1095, ref = 3900): ProjectionResult {
  const n = jours.length;
  const series = {
    salaire: arr(n), maintienEmployeur: arr(n), ijObligatoire: oblig,
    ijComplementaireCollective: arr(n), ijComplementaireIndividuelle: arr(n),
    pensionInvalObligatoire: arr(n), renteInvalCollective: arr(n),
    renteInvalIndividuelle: arr(n), renteInvalEnfants: arr(n),
  } as unknown as SerieEmpilee;
  const axe = jours.map((j) => ({ jour: j, date: "2026-01-01", phase: (j >= bascule ? "invalidite" : "am") as "am" | "invalidite" }));
  return { axe, series, revenuReferenceMensuel: ref, rupturesCles: [], basculeInvaliditeJour: bascule, finProjectionJour: 7300 } as unknown as ProjectionResult;
}

// Le libellé d'un tick niveau 1 = celui de la ligne table correspondante (même labelExact).
const labelsTicksN1 = (p: ProjectionResult) => ticksPdf(p).filter((t) => t.niveau === 1).map((t) => t.label);

describe("Prévoyance PDF — tableau Points clés = jalons du graphe (plus de gabarit fixe)", () => {
  it("PREUVE : libellés(table) = [« J0 »] ∪ libellés(ticks niveau 1) — David SSI (rupture J30)", () => {
    const proj = makeProjection([0, 30, 1095], [0, 1500, 0]);
    const table = buildJalons(proj).map((j) => j.libelle);
    expect(table).toEqual(["J0", ...labelsTicksN1(proj)]);
    expect(table).toEqual(["J0", "J30", "3 ans"]); // J30 = IJ Madelin après franchise 30 j
  });

  it("PREUVE : Erika CPAM — ruptures J37/J67 du maintien légal, PAS le gabarit générique", () => {
    const proj = makeProjection([0, 37, 67, 1095], [0, 2000, 1000, 0]);
    const table = buildJalons(proj).map((j) => j.libelle);
    expect(table).toEqual(["J0", ...labelsTicksN1(proj)]);
    expect(table).toEqual(["J0", "J37", "J67", "3 ans"]);
    // Le gabarit fixe aurait imprimé des horizons génériques absents des vraies ruptures.
    for (const generique of ["1 mois", "3 mois", "6 mois", "J7"]) expect(table).not.toContain(generique);
  });

  it("chaque ligne porte revenu, % réf. et composition non vides (données de la frise)", () => {
    const proj = makeProjection([0, 37, 67, 1095], [0, 2000, 1000, 0]);
    const jalons = buildJalons(proj);
    expect(jalons.length).toBe(4);
    for (const j of jalons) {
      expect(j.revenu).toMatch(/€/);
      expect(j.pct).toMatch(/%/);
      expect(j.detail.length).toBeGreaterThan(0);
    }
    // J0 = carence (aucun revenu de remplacement le 1er jour d'arrêt).
    expect(jalons[0].detail).toMatch(/carence|aucun/i);
  });
});
