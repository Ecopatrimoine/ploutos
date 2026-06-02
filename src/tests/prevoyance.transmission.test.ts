// Lot 2 — Persistance des contrats de transmission décès.
//
// Vérifie que ContratTransmissionDeces se persiste dans data.prevoyance via le
// merge partagé (patchPrevoyancePair) et se relit sans perte (round-trip JSON),
// et que la rétro-compatibilité tient (dossier sans le champ → []).

import { describe, it, expect } from "vitest";
import type { ContratTransmissionDeces, PatrimonialData } from "../types/patrimoine";
import {
  getContratsTransmissionDeces,
  getPrevoyancePerso,
  patchPrevoyancePair,
} from "../lib/prevoyance/utils";

const contrat: ContratTransmissionDeces = {
  id: "td_test_1",
  libelle: "Temporaire décès Madelin",
  assureur: "Compagnie X",
  natureAssiette: "primes_avant70",
  capitalTransmis: 200000,
  primesAvant70: 30000,
  beneficiaires: [
    { name: "Conjoint", relation: "conjoint", share: 50 },
    { name: "Enfant", relation: "enfant", share: 50 },
  ],
  conditions: "clause bénéficiaire standard",
};

describe("ContratTransmissionDeces — persistance data.prevoyance", () => {
  it("se persiste et se relit sans perte (round-trip JSON)", () => {
    const prevoyance = patchPrevoyancePair(
      undefined,
      "p1",
      { contratsTransmissionDeces: [contrat] },
      false
    );
    const data = { prevoyance } as unknown as PatrimonialData;

    // Sérialisation réelle (le payload est stocké en jsonb).
    const reloaded = JSON.parse(JSON.stringify(data)) as PatrimonialData;
    const perso = getPrevoyancePerso(reloaded, "p1");

    expect(getContratsTransmissionDeces(perso)).toEqual([contrat]);
  });

  it("n'écrase pas les autres saisies de la personne (merge ciblé)", () => {
    let prevoyance = patchPrevoyancePair(undefined, "p1", { contratsIndividuels: [] }, false);
    prevoyance = patchPrevoyancePair(prevoyance, "p1", { contratsTransmissionDeces: [contrat] }, false);
    const perso = getPrevoyancePerso({ prevoyance } as unknown as PatrimonialData, "p1");

    expect(getContratsTransmissionDeces(perso)).toHaveLength(1);
    expect(perso.categorieInvaliditeProjetee).toBe("cat2"); // valeur du défaut, préservée
  });

  it("rétro-compatibilité : dossier sans data.prevoyance → []", () => {
    const empty = {} as PatrimonialData;
    expect(getContratsTransmissionDeces(getPrevoyancePerso(empty, "p1"))).toEqual([]);
  });

  it("rétro-compatibilité : prévoyance présente mais champ absent → []", () => {
    const prevoyance = patchPrevoyancePair(undefined, "p1", { contratsIndividuels: [] }, false);
    const perso = getPrevoyancePerso({ prevoyance } as unknown as PatrimonialData, "p1");
    expect(perso.contratsTransmissionDeces).toBeUndefined();
    expect(getContratsTransmissionDeces(perso)).toEqual([]);
  });
});
