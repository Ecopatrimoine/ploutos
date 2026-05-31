// ─── LOT D (CAVAMAC, étape 4/4) — tests de VALEURS 2026 (vraie entrée JSON) ──
//
// Lit l'entrée CAVAMAC RÉELLE de caisses-2026.json (pas une caisse fictive) et
// valide les montants 2026 sourcés cavamac.fr (fiche paramètres 2026) :
//   - plafond commissions RID 625 777 € ; plancher 60 000 pts RCO = 24 738 € ;
//   - invalidité 25 % des commissions plafonnées, tranche partielle 3/2 ;
//   - capital décès 25 % (seul) / 50 % (conjoint/PACS ou enfants) ;
//   - arrêt de travail : relais CPAM J4-J90, trou après J90 (aucune IJ caisse).
//
// Toute l'infra moteur vient des lots A/B/C ; ici on ne teste que la donnée.

import { describe, it, expect } from "vitest";
import {
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
  computeIJObligatoireJournaliere,
  projeterArretMaladie,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;
const cavamac = caisses.CAVAMAC;
const vars = buildPlafondVariables(referentiels);

// Agent général d'assurance affilié CAVAMAC. revenuTNSAnnuel sert au relais
// CPAM des 90 premiers jours ; commissionsBrutes est l'assiette des prestations
// CAVAMAC (invalidité / capital). Les deux sont distincts.
function entreeCavamac(forfait: ForfaitConfig, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 50,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse: "CAVAMAC",
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

describe("CAVAMAC 2026 — schéma JSON (fiche paramètres cavamac.fr)", () => {
  it("moteur forfaitaire, discriminant aucun, modes pourcentageRevenu", () => {
    expect(cavamac.moteur).toBe("forfaitaire");
    expect(cavamac.discriminant.type).toBe("aucun");
    expect(cavamac.invalidite.modeTaux).toBe("trancheCavamac");
    expect(cavamac.invalidite.seuilPartiel).toBe(33);
    expect(cavamac.invalidite.seuilPlein).toBe(66);
    expect(cavamac.invalidite.seuilTauxMinimal).toBeUndefined(); // contrainte lot C
    expect(cavamac.invalidite.montantAnnuel100).toEqual({
      mode: "pourcentageRevenu", taux: 0.25, plafond: 625777, plancher: 24738,
    });
    expect(cavamac.invalidite.majorationEnfantAnnuelle).toBeNull();
    expect(cavamac.capitalDeces.tauxBase).toBe(0.25);
    expect(cavamac.capitalDeces.tauxMajoreFamille).toBe(0.5);
    expect(cavamac.ij.phase1.type).toBe("cpam");
    expect(cavamac.ij.plafondDureeJours).toBeNull();
    expect(cavamac.ij.montantJournalier).toEqual({ mode: "uniforme", valeur: 0 });
  });
});

describe("CAVAMAC 2026 — invalidité (commissions 300 000 → totale 75 000/an)", () => {
  const com = 300000;
  it("taux 80 → plein 75 000/12", () => {
    const m = forfaitaireInvalMensuel(cavamac, entreeCavamac({ tauxInvalidite: 80, commissionsBrutes: com }));
    expect(m).toBeCloseTo(75000 / 12, 6);
  });
  it("taux 50 → partiel 75 000 × 1,5 × 0,50 = 56 250/an", () => {
    const m = forfaitaireInvalMensuel(cavamac, entreeCavamac({ tauxInvalidite: 50, commissionsBrutes: com }));
    expect(m * 12).toBeCloseTo(56250, 4);
  });
  it("taux 32 (< 33) → 0", () => {
    const m = forfaitaireInvalMensuel(cavamac, entreeCavamac({ tauxInvalidite: 32, commissionsBrutes: com }));
    expect(m).toBe(0);
  });
});

describe("CAVAMAC 2026 — plafond & plancher invalidité", () => {
  it("commissions 700 000 → plafonnées 625 777 × 0,25 = 156 444,25/an (plein)", () => {
    const m = forfaitaireInvalMensuel(cavamac, entreeCavamac({ tauxInvalidite: 80, commissionsBrutes: 700000 }));
    expect(m * 12).toBeCloseTo(156444.25, 4);
  });
  it("commissions 40 000 → 10 000 < plancher → plein planché 24 738/an", () => {
    const m = forfaitaireInvalMensuel(cavamac, entreeCavamac({ tauxInvalidite: 80, commissionsBrutes: 40000 }));
    expect(m * 12).toBeCloseTo(24738, 6);
  });
  it("commissions 40 000, taux 50 → 24 738 × 1,5 × 0,50 = 18 553,5/an", () => {
    const m = forfaitaireInvalMensuel(cavamac, entreeCavamac({ tauxInvalidite: 50, commissionsBrutes: 40000 }));
    expect(m * 12).toBeCloseTo(18553.5, 4);
  });
});

describe("CAVAMAC 2026 — capital décès 25/50 selon ayant-droit", () => {
  const com = 300000;
  it("conjoint/PACS → 50 % → 150 000", () => {
    const cap = forfaitaireCapitalDeces(cavamac, entreeCavamac({ tauxInvalidite: 0, commissionsBrutes: com }, { marie: true }));
    expect(cap).toBe(150000);
  });
  it("seul (pas de conjoint, 0 enfant) → 25 % → 75 000", () => {
    const cap = forfaitaireCapitalDeces(cavamac, entreeCavamac({ tauxInvalidite: 0, commissionsBrutes: com }, { marie: false, nbEnfantsACharge: 0 }));
    expect(cap).toBe(75000);
  });
  it("enfants (pas de conjoint, 2 enfants) → 50 % → 150 000", () => {
    const cap = forfaitaireCapitalDeces(cavamac, entreeCavamac({ tauxInvalidite: 0, commissionsBrutes: com }, { marie: false, nbEnfantsACharge: 2 }));
    expect(cap).toBe(150000);
  });
});

describe("CAVAMAC 2026 — assiette obligatoire (pas de fallback)", () => {
  it("commissions absentes → invalidité 0 ET capital 0 (force la saisie)", () => {
    const e = entreeCavamac({ tauxInvalidite: 80 }); // commissionsBrutes non renseigné
    expect(forfaitaireInvalMensuel(cavamac, e)).toBe(0);
    expect(forfaitaireCapitalDeces(cavamac, e)).toBe(0);
  });
});

describe("CAVAMAC 2026 — arrêt de travail (relais CPAM, trou après J90)", () => {
  it("J60 relais CPAM > 0 ; J120 trou (0) ; pas de faux 'données indisponibles'", () => {
    const e = entreeCavamac({ tauxInvalidite: 0, commissionsBrutes: 300000 });
    const result = projeterArretMaladie(e, "cat2", referentiels);

    const idx60 = result.axe.findIndex((p: any) => p.jour === 60);
    const idx120 = result.axe.findIndex((p: any) => p.jour === 120);
    expect(idx60).toBeGreaterThanOrEqual(0);
    expect(idx120).toBeGreaterThanOrEqual(0);

    const expected60 = computeIJObligatoireJournaliere(60, caisses.CPAM, e, vars, "ald")! * 30;
    expect(expected60).toBeGreaterThan(0);
    expect(result.series.ijObligatoire[idx60]).toBeCloseTo(expected60, 2);

    expect(result.series.ijObligatoire[idx120]).toBe(0); // trou après J90
    expect(result.donneesCaisseIndisponibles).toBe(false);
  });
});

describe("CAVAMAC 2026 — non-régression caisses voisines", () => {
  it("CAVOM (parDiscriminant) inchangée : capital classe C = 70 965, insensible à marie", () => {
    const cavom = caisses.CAVOM;
    const base: ForfaitConfig = { tauxInvalidite: 0, classeOption: "C" };
    const seul = forfaitaireCapitalDeces(cavom, { ...entreeCavamac(base, { caisse: "CAVOM" }), marie: false, nbEnfantsACharge: 0 });
    const couple = forfaitaireCapitalDeces(cavom, { ...entreeCavamac(base, { caisse: "CAVOM" }), marie: true, nbEnfantsACharge: 3 });
    expect(seul).toBe(70965);
    expect(couple).toBe(70965);
  });
  it("CAVEC (proportionnel) inchangée : taux 70 % C2 → 16 620 × 0,70 / 12", () => {
    const cavec = caisses.CAVEC;
    const e = entreeCavamac({ tauxInvalidite: 70 }, { revenuTNSAnnuel: 30000, age: 55, caisse: "CAVEC" });
    expect(forfaitaireInvalMensuel(cavec, e)).toBeCloseTo((16620 * 0.70) / 12, 2);
  });
});
