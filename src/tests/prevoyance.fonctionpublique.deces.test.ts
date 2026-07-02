// ─── LOT C (Fonction publique) — capital deces statutaire ───────────────────
//
// Capital = un an de remuneration declaree (taux 1.00) + 884,33 EUR par enfant a
// charge, avec plancher statutaire 16 036 EUR. Apres l'age minimal de retraite
// (64), bascule a 25 % de la remuneration SANS majoration ni plancher. Assiette =
// revenu annuel declaré (mode pourcentageRevenu generalise via assiette).

import { describe, it, expect } from "vitest";
import { resolveCapitauxDeces } from "../lib/prevoyance/capitaux-deces";
import type { EntreePerso } from "../lib/prevoyance/types";
import { referentiels } from "../data/prevoyance";

const FP = (referentiels.caisses as any).caisses.FONCTION_PUBLIQUE;

function entree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 64,
    statutPro: "fonctionnaire",
    caisse: "FONCTION_PUBLIQUE",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 40000,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 0,
    contratsIndividuels: [],
    couvertureCollective: null,
    marie: false,
    nbEnfantsACharge: 0,
    ...over,
  };
}

describe("Fonction publique — capital deces (un an de remuneration, plancher, majoration, bascule 64)", () => {
  it("40000, avant 64, sans enfant -> 40000 (plancher inactif)", () => {
    expect(resolveCapitauxDeces(FP, entree()).capital).toBeCloseTo(40000, 2);
  });
  it("12000, avant 64, sans enfant -> plancher 16036", () => {
    expect(resolveCapitauxDeces(FP, entree({ salaireBrutAnnuel: 12000 })).capital).toBeCloseTo(16036, 2);
  });
  it("40000, avant 64, 2 enfants -> 41768,66 (+ 2 x 884,33)", () => {
    expect(resolveCapitauxDeces(FP, entree({ nbEnfantsACharge: 2 })).capital).toBeCloseTo(41768.66, 2);
  });
  it("40000, 66 ans -> 25 % = 10000, sans majoration ni plancher", () => {
    expect(resolveCapitauxDeces(FP, entree({ age: 66, nbEnfantsACharge: 2 })).capital).toBeCloseTo(10000, 2);
  });
  it("age inconnu (0) -> branche avant 64 avec majorations (nominal)", () => {
    expect(resolveCapitauxDeces(FP, entree({ age: 0, nbEnfantsACharge: 2 })).capital).toBeCloseTo(41768.66, 2);
  });
});
