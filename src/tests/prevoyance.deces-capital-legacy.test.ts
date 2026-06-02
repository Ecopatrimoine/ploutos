// VOIE A — R4 : sentinelle de non-régression. "deces_capital" est RETIRÉ des
// unions de type créables, mais la valeur HISTORIQUE doit rester reconnue à la
// LECTURE (bridge succession + constats). Ce test verrouille ce comportement.
//
// NB : les dossiers réels chargés depuis le stockage portent encore
// type:"deces_capital" ; on le représente ici comme « donnée chargée » via un
// cast (le champ n'est plus un membre de l'union créable).

import { describe, it, expect } from "vitest";
import {
  getContratsTransmissionDecesAvecLegacy,
  mapDecesCapitalLegacy,
  TYPE_DECES_CAPITAL_LEGACY,
} from "../lib/prevoyance/utils";
import { capitalDecesUnifie } from "../lib/prevoyance/regles";
import type { ContratIndividuel } from "../lib/prevoyance/types";
import type { PayloadContratIndividuel, PayloadPrevoyancePerso } from "../types/patrimoine";

// Donnée legacy telle que chargée du stockage (type retiré des unions créables).
function legacyDecesCapital(montant: number): PayloadContratIndividuel {
  return { id: "old_dc", type: TYPE_DECES_CAPITAL_LEGACY, capitalOuMontant: montant } as unknown as PayloadContratIndividuel;
}

describe("R4 — la valeur historique deces_capital reste reconnue à la lecture", () => {
  it("la constante de reconnaissance vaut bien la valeur stockée", () => {
    expect(TYPE_DECES_CAPITAL_LEGACY).toBe("deces_capital");
  });

  it("bridge succession : un deces_capital legacy est toujours mappé en transmission", () => {
    const perso = {
      contratsIndividuels: [legacyDecesCapital(200000)],
      couvertureCollective: null,
      categorieInvaliditeProjetee: "cat2",
    } as unknown as PayloadPrevoyancePerso;
    const ponts = getContratsTransmissionDecesAvecLegacy(perso);
    expect(ponts).toHaveLength(1);
    expect(ponts[0].capitalTransmis).toBe(200000);
    expect(ponts[0].natureAssiette).toBe("capital");
    expect(ponts[0].beneficiaires).toEqual([]);
  });

  it("mapDecesCapitalLegacy reste utilisable directement", () => {
    expect(mapDecesCapitalLegacy(legacyDecesCapital(123456)).capitalTransmis).toBe(123456);
  });

  it("constats : capitalDecesUnifie compte toujours le capital legacy", () => {
    const legacy = [legacyDecesCapital(150000) as unknown as ContratIndividuel];
    expect(capitalDecesUnifie(legacy, [])).toBe(150000);
  });
});
