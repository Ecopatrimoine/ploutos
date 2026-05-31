// ─── LOT C-1 (CARPV) — invalidité double palier par classe ──────────────────
//
// Valide le NOUVEAU modeTaux "doublePalierCarpv" (forfaitaireInvalMensuel) sur
// une caisseRef FICTIVE en dur — CARPV n'est PAS encodée (JSON = lot C-2), le
// référentiel n'est pas touché.
//
// Barème CARPV (sourcé Livret CARPV 2026) :
//   - taux < seuilPartiel (66 %)            -> 0 (invalidité non couverte) ;
//   - seuilPartiel ≤ taux < seuilTotal (100) -> rente palier 66 % de la classe ;
//   - taux ≥ seuilTotal                      -> rente palier 100 % de la classe ;
//   - classe résolue via resolveDiscriminant (classeOption ou classeParDefaut).

import { describe, it, expect } from "vitest";
import {
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
} from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;

function entree(forfait: ForfaitConfig, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 50,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse: null,
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 60000,
    contratsIndividuels: [],
    couvertureCollective: null,
    forfait,
    ...over,
  };
}

// Caisse FICTIVE CARPV-like. seuilTauxMinimal volontairement ABSENT : le plancher
// de taux (66 %) est porté par seuilPartiel/seuilTotal (cf. doc forfaitaireInvalMensuel).
const FICT_CARPV: any = {
  moteur: "forfaitaire",
  discriminant: { type: "classe" },
  classeParDefaut: "maximum",
  invalidite: {
    modeTaux: "doublePalierCarpv",
    seuilPartiel: 66,
    seuilTotal: 100,
    borneAgeMax: 65,
    montantAnnuel66: { mode: "parDiscriminant", valeurs: { minimum: 8560, medium: 17120, maximum: 25680 } },
    montantAnnuel100: { mode: "parDiscriminant", valeurs: { minimum: 13375, medium: 26750, maximum: 40125 } },
  },
};

describe("CARPV — double palier invalidité (classe explicite via classeOption)", () => {
  it("classe maximum, taux 100 → 40 125/12 (palier total)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 100, classeOption: "maximum" }));
    expect(m).toBeCloseTo(40125 / 12, 6);
  });
  it("classe maximum, taux 80 → 25 680/12 (palier 66, < plein)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 80, classeOption: "maximum" }));
    expect(m).toBeCloseTo(25680 / 12, 6);
  });
  it("classe maximum, taux 66 → 25 680/12 (borne basse incluse)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 66, classeOption: "maximum" }));
    expect(m).toBeCloseTo(25680 / 12, 6);
  });
  it("classe maximum, taux 65 → 0 (sous seuil partiel)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 65, classeOption: "maximum" }));
    expect(m).toBe(0);
  });
  it("classe maximum, taux 99 → 25 680/12 (juste sous total = encore palier 66)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 99, classeOption: "maximum" }));
    expect(m).toBeCloseTo(25680 / 12, 6);
  });
  it("classe minimum, taux 100 → 13 375/12", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 100, classeOption: "minimum" }));
    expect(m).toBeCloseTo(13375 / 12, 6);
  });
  it("classe minimum, taux 70 → 8 560/12 (palier 66)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 70, classeOption: "minimum" }));
    expect(m).toBeCloseTo(8560 / 12, 6);
  });
  it("classe medium, taux 100 → 26 750/12", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 100, classeOption: "medium" }));
    expect(m).toBeCloseTo(26750 / 12, 6);
  });
});

describe("CARPV — classe par défaut + borne d'âge", () => {
  it("classeOption absente → défaut maximum : taux 100 → 40 125/12 (classeParDefaut lu sans muter)", () => {
    const e = entree({ tauxInvalidite: 100 });
    const m = forfaitaireInvalMensuel(FICT_CARPV, e);
    expect(m).toBeCloseTo(40125 / 12, 6);
    // resolveDiscriminant ne doit pas avoir muté le dossier (pas de classeOption injectée).
    expect(e.forfait?.classeOption).toBeUndefined();
  });
  it("âge 66 (≥ borneAgeMax 65), taux 100 → 0 (borne d'âge dépassée)", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 100, classeOption: "maximum" }, { age: 66 }));
    expect(m).toBe(0);
  });
  it("âge 64 (< borneAgeMax 65), taux 100 → 40 125/12", () => {
    const m = forfaitaireInvalMensuel(FICT_CARPV, entree({ tauxInvalidite: 100, classeOption: "maximum" }, { age: 64 }));
    expect(m).toBeCloseTo(40125 / 12, 6);
  });
});

describe("CARPV — état du référentiel à l'issue de C-1", () => {
  it("CARPV référentiel encodé (C-2) : classe maximum taux 100 → 40125/12", () => {
    const carpv = caisses.CARPV;
    expect(carpv.moteur).toBe("forfaitaire");
    expect(carpv.invalidite?.modeTaux).toBe("doublePalierCarpv");
    const e = entree({ tauxInvalidite: 100, classeOption: "maximum" }, { caisse: "CARPV" });
    expect(forfaitaireInvalMensuel(carpv, e)).toBeCloseTo(40125 / 12, 2);
  });
  it("CARPV référentiel encodé (C-2) : classe par défaut maximum, taux 80 → 25680/12", () => {
    const carpv = caisses.CARPV;
    // pas de classeOption -> doit résoudre classeParDefaut "maximum"
    const e = entree({ tauxInvalidite: 80 }, { caisse: "CARPV" });
    expect(forfaitaireInvalMensuel(carpv, e)).toBeCloseTo(25680 / 12, 2);
  });
  it("CARPV référentiel encodé (C-2) : classe minimum taux 100 → 13375/12", () => {
    const carpv = caisses.CARPV;
    const e = entree({ tauxInvalidite: 100, classeOption: "minimum" }, { caisse: "CARPV" });
    expect(forfaitaireInvalMensuel(carpv, e)).toBeCloseTo(13375 / 12, 2);
  });
  it("CARPV référentiel encodé (C-2) : capital décès classe maximum → 113955", () => {
    const carpv = caisses.CARPV;
    const e = entree({ tauxInvalidite: 0, classeOption: "maximum" }, { caisse: "CARPV" });
    expect(forfaitaireCapitalDeces(carpv, e)).toBe(113955);
  });

  it("non-régression CAVOM invalidité (parDiscriminant) : classe C taux 80 → 33070/12", () => {
    const cavom = caisses.CAVOM;
    const e = entree({ tauxInvalidite: 80, classeOption: "C" }, { caisse: "CAVOM" });
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(33070 / 12, 2);
  });
});
