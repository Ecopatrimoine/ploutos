// ─── LOT C (CAVAMAC, étape 3/4) — invalidité partielle 3/2, planchers, ──────
//                                   capital décès 25/50 familial
//
// Valide le NOUVEAU modeTaux "trancheCavamac" (forfaitaireInvalMensuel) et le
// capital 25/50 selon situation familiale (forfaitaireCapitalDeces), sur une
// caisseRef FICTIVE en dur — CAVAMAC n'est PAS encodée (JSON = lot D), le
// référentiel n'est pas touché.
//
// Barème CAVAMAC (sourcé cavamac.fr) :
//   - pension totale = tauxBase × min(commissions, plafond), plancher inclus ;
//   - partielle 33 % ≤ n < 66 % = totale × 1,5 × (n/100) ; n < 33 → 0 ; n ≥ 66 → plein ;
//   - capital décès = 50 % si conjoint/PACS OU enfant, 25 % sinon, plafonné/planché.

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

// Caisse FICTIVE CAVAMAC-like. seuilTauxMinimal volontairement ABSENT : le seuil
// partiel est porté par seuilPartiel/seuilPlein (cf. doc forfaitaireInvalMensuel).
const FICT_CAVAMAC: any = {
  moteur: "forfaitaire",
  invalidite: {
    modeTaux: "trancheCavamac",
    montantAnnuel100: { mode: "pourcentageRevenu", taux: 0.25, plafond: 625777, plancher: 24738 },
  },
  capitalDeces: {
    mode: "pourcentageRevenu",
    tauxBase: 0.25,
    tauxMajoreFamille: 0.5,
    plafond: 625777,
    plancher: 24738,
  },
};

describe("LOT C — invalidité trancheCavamac (assiette 300 000 → totale 75 000/an)", () => {
  const com = 300000;
  it("taux 80 → plein 75 000/12", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 80, commissionsBrutes: com }));
    expect(m).toBeCloseTo(75000 / 12, 6);
  });
  it("taux 50 → 75 000 × 1,5 × 0,50 = 56 250/an", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 50, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(56250, 4);
  });
  it("taux 33 (borne basse incluse) → 75 000 × 1,5 × 0,33 = 37 125/an", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 33, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(37125, 4);
  });
  it("taux 65 (< 66) → 75 000 × 1,5 × 0,65 = 73 125/an (partiel, < plein)", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 65, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(73125, 4);
    expect(m * 12).toBeLessThan(75000);
  });
  it("taux 66 (borne haute) → plein 75 000/an", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 66, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(75000, 6);
  });
  it("taux 32 (< 33) → 0", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 32, commissionsBrutes: com }));
    expect(m).toBe(0);
  });
});

describe("LOT C — plancher invalidité (assiette 40 000 → 10 000 < plancher → totale planchée 24 738)", () => {
  const com = 40000;
  it("taux 80 → plein planché 24 738/12", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 80, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(24738, 6);
  });
  it("taux 50 → 24 738 × 1,5 × 0,50 = 18 553,5/an (plancher DANS la totale, puis réduction)", () => {
    const m = forfaitaireInvalMensuel(FICT_CAVAMAC, entree({ tauxInvalidite: 50, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(18553.5, 4);
  });
});

describe("LOT C — capital décès 25/50 selon situation familiale", () => {
  const com = 300000;
  it("conjoint/PACS (marie=true) → 50 % → 150 000", () => {
    const cap = forfaitaireCapitalDeces(
      FICT_CAVAMAC,
      entree({ tauxInvalidite: 0, commissionsBrutes: com }, { marie: true })
    );
    expect(cap).toBe(150000);
  });
  it("seul (marie=false, 0 enfant) → 25 % → 75 000", () => {
    const cap = forfaitaireCapitalDeces(
      FICT_CAVAMAC,
      entree({ tauxInvalidite: 0, commissionsBrutes: com }, { marie: false, nbEnfantsACharge: 0 })
    );
    expect(cap).toBe(75000);
  });
  it("enfants (marie=false, 2 enfants) → 50 % → 150 000", () => {
    const cap = forfaitaireCapitalDeces(
      FICT_CAVAMAC,
      entree({ tauxInvalidite: 0, commissionsBrutes: com }, { marie: false, nbEnfantsACharge: 2 })
    );
    expect(cap).toBe(150000);
  });
  it("plancher capital : seul, assiette 40 000 → 10 000 < plancher → 24 738", () => {
    const cap = forfaitaireCapitalDeces(
      FICT_CAVAMAC,
      entree({ tauxInvalidite: 0, commissionsBrutes: 40000 }, { marie: false, nbEnfantsACharge: 0 })
    );
    expect(cap).toBe(24738);
  });
});

describe("LOT C — non-régression caisses réelles (capital fixe / invalidité historique)", () => {
  it("CAVOM capital (parDiscriminant) inchangé quel que soit marie", () => {
    const cavom = caisses.CAVOM;
    const seul = forfaitaireCapitalDeces(
      cavom,
      entree({ tauxInvalidite: 0, classeOption: "C" }, { caisse: "CAVOM", marie: false, nbEnfantsACharge: 0 })
    );
    const enCouple = forfaitaireCapitalDeces(
      cavom,
      entree({ tauxInvalidite: 0, classeOption: "C" }, { caisse: "CAVOM", marie: true, nbEnfantsACharge: 3 })
    );
    expect(seul).toBe(70965);
    expect(enCouple).toBe(70965); // marie n'a AUCUN effet (mode parDiscriminant)
  });
  it("CAVOM invalidité (parDiscriminant) inchangée : classe C taux 80 → 33 070/12", () => {
    const cavom = caisses.CAVOM;
    const e = entree({ tauxInvalidite: 80, classeOption: "C" }, { caisse: "CAVOM" });
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(33070 / 12, 2);
  });
  it("CAVEC invalidité (proportionnel) inchangée : taux 70 % C2 → 16 620 × 0,70 / 12", () => {
    const cavec = caisses.CAVEC;
    const e = entree({ tauxInvalidite: 70 }, { revenuTNSAnnuel: 30000, age: 55, caisse: "CAVEC" });
    expect(forfaitaireInvalMensuel(cavec, e)).toBeCloseTo((16620 * 0.70) / 12, 2);
  });
});
