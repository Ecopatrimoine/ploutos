// ─── LOT B (CAVAMAC, étape 2/4) — mode "pourcentageRevenu" + assiette ──────
//
// Valide l'extension RÉTRO-COMPATIBLE de resolveMontant (via les fonctions
// publiques forfaitaireInvalMensuel / forfaitaireCapitalDeces) :
//   - nouveau mode "pourcentageRevenu" = taux × min(commissions, plafond) +
//     plancher, alimenté par forfait.commissionsBrutes (champ dédié, sans
//     fallback revenuTNSAnnuel) ;
//   - invariance stricte des modes "uniforme" / "parDiscriminant" : l'assiette
//     ne change RIEN à leur résultat (avec ou sans commissionsBrutes) ;
//   - non-régression sur deux caisses réelles (CAVOM parDiscriminant, CAVEC
//     proportionnel) — valeurs inchangées.
//
// On n'encode PAS CAVAMAC : la validation passe par des caisseRef FICTIVES en
// dur, sans toucher caisses-2026.json.

import { describe, it, expect } from "vitest";
import {
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
  resolveDiscriminant,
} from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;

// Entrée minimale TNS-libéral. La caisse est passée à part (caisseRef), donc
// `caisse` reste indicatif. forfait porte taux + (commissions | classe).
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

// ── Caisse FICTIVE en mode pourcentageRevenu (ne pollue pas le référentiel) ──
// modeTaux absent → pension = base en plein (la base EST déjà le 100 %).
const FICT_PCT: any = {
  moteur: "forfaitaire",
  invalidite: {
    seuilTauxMinimal: 0,
    montantAnnuel100: { mode: "pourcentageRevenu", taux: 0.25, plafond: 625777, plancher: 24738 },
  },
  capitalDeces: { mode: "pourcentageRevenu", taux: 0.25, plafond: 625777, plancher: 24738 },
};

// ── Caisses FICTIVES uniforme / parDiscriminant (invariance) ──
const FICT_UNIF: any = {
  invalidite: { seuilTauxMinimal: 0, montantAnnuel100: { mode: "uniforme", valeur: 12000 } },
  capitalDeces: { mode: "uniforme", valeur: 50000 },
};
const FICT_DISC: any = {
  discriminant: { type: "classe" },
  invalidite: {
    seuilTauxMinimal: 0,
    montantAnnuel100: { mode: "parDiscriminant", valeurs: { A: 8000, B: 16000 } },
  },
};

describe("LOT B — resolveMontant rétro-compatible (via fonctions publiques)", () => {
  // ── B5a : invariance uniforme / parDiscriminant, avec ET sans assiette ──
  it("uniforme : identique avec ou sans commissionsBrutes (assiette ignorée)", () => {
    const sans = forfaitaireInvalMensuel(FICT_UNIF, entree({ tauxInvalidite: 100 }));
    const avec = forfaitaireInvalMensuel(
      FICT_UNIF,
      entree({ tauxInvalidite: 100, commissionsBrutes: 300000 })
    );
    expect(sans).toBeCloseTo(12000 / 12, 6);
    expect(avec).toBe(sans); // l'assiette ne déplace pas le résultat uniforme
    expect(forfaitaireCapitalDeces(FICT_UNIF, entree({ tauxInvalidite: 100 }))).toBe(50000);
  });

  it("parDiscriminant : identique avec ou sans commissionsBrutes (assiette ignorée)", () => {
    const sans = forfaitaireInvalMensuel(FICT_DISC, entree({ tauxInvalidite: 100, classeOption: "B" }));
    const avec = forfaitaireInvalMensuel(
      FICT_DISC,
      entree({ tauxInvalidite: 100, classeOption: "B", commissionsBrutes: 300000 })
    );
    expect(sans).toBeCloseTo(16000 / 12, 6);
    expect(avec).toBe(sans);
  });

  // ── B5b : pourcentageRevenu (invalidité) ──
  it("pourcentageRevenu : 300 000 × 0,25 = 75 000/an → 6 250 €/mois", () => {
    const m = forfaitaireInvalMensuel(FICT_PCT, entree({ tauxInvalidite: 100, commissionsBrutes: 300000 }));
    expect(m).toBeCloseTo(75000 / 12, 6);
    expect(m).toBeCloseTo(6250, 6);
  });

  it("pourcentageRevenu : 700 000 plafonnées à 625 777 → 156 444,25/an", () => {
    const m = forfaitaireInvalMensuel(FICT_PCT, entree({ tauxInvalidite: 100, commissionsBrutes: 700000 }));
    expect(m * 12).toBeCloseTo(156444.25, 4);
  });

  it("pourcentageRevenu : 40 000 × 0,25 = 10 000 < plancher → relevé à 24 738/an", () => {
    const m = forfaitaireInvalMensuel(FICT_PCT, entree({ tauxInvalidite: 100, commissionsBrutes: 40000 }));
    expect(m * 12).toBeCloseTo(24738, 6);
  });

  it("pourcentageRevenu : commissions absentes → 0 (trou visible, pas de plancher fantôme)", () => {
    const m = forfaitaireInvalMensuel(FICT_PCT, entree({ tauxInvalidite: 100 }));
    expect(m).toBe(0);
  });

  // ── B5c : pourcentageRevenu (capital décès) ──
  it("capital décès pourcentageRevenu : 300 000 × 0,25 = 75 000", () => {
    const cap = forfaitaireCapitalDeces(FICT_PCT, entree({ tauxInvalidite: 0, commissionsBrutes: 300000 }));
    expect(cap).toBe(75000);
  });

  // ── B5d : non-régression caisses réelles ──
  it("CAVOM (parDiscriminant) inchangée : classe C taux 80 → 33 070/12", () => {
    const cavom = caisses.CAVOM;
    const e = entree({ tauxInvalidite: 80, classeOption: "C" }, { caisse: "CAVOM", commissionsBrutes: 300000 });
    // commissionsBrutes présent NE doit RIEN changer (mode parDiscriminant).
    expect(resolveDiscriminant(cavom, e)).toBe("C");
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(33070 / 12, 2);
  });

  it("CAVEC (proportionnel) inchangée : taux 70 % C2 → 16 620 × 0,70 / 12", () => {
    const cavec = caisses.CAVEC;
    const e = entree(
      { tauxInvalidite: 70, commissionsBrutes: 999999 },
      { revenuTNSAnnuel: 30000, age: 55, caisse: "CAVEC" }
    );
    expect(resolveDiscriminant(cavec, e)).toBe("2");
    expect(forfaitaireInvalMensuel(cavec, e)).toBeCloseTo((16620 * 0.70) / 12, 2);
  });
});
