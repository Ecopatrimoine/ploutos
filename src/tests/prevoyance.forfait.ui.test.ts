// ─── LOT CAVOM — Classe par défaut DÉRIVÉE À LA LECTURE (data-driven) ──────
//
// La classe par défaut d'une caisse "classe" (ex. CAVOM classeParDefaut "C")
// est résolue AU MOMENT DU CALCUL par resolveDiscriminant — JAMAIS seedée par
// un effet d'UI. La simple consultation d'un dossier ne le mute pas.
//
// Ordre de résolution (type "classe") :
//   forfait.classeOption explicite > caisseRef.classeParDefaut > grille revenu
//   > dernière ligne de grille / null.
//
// Vérifs :
//   - CAVOM (classeParDefaut "C", PAS de grille) → "C" SANS muter l'entrée ;
//   - CAVOM calcul par défaut (inval / capital décès) ≠ 0, dérivé à la lecture ;
//   - CAVOM choix explicite "A" prioritaire ;
//   - CAVEC NON-RÉGRESSION (pas de classeParDefaut, A une grille) → "3" ;
//   - caisse "classe" fictive sans grille NI défaut → null ;
//   - PURETÉ : resolveDiscriminant ne mute jamais ses entrées.

import { describe, it, expect } from "vitest";
import {
  resolveDiscriminant,
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
} from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;
const cavom = caisses.CAVOM;
const cavec = caisses.CAVEC;

// Entrée minimale TNS-libéral, classe pilotée par forfait.classeOption.
function entree(caisse: string, forfait: ForfaitConfig, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 50,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse,
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

describe("CAVOM — classe par défaut dérivée à la lecture (data-driven)", () => {
  // ── C1 : CAVOM, classeOption vide → "C" via classeParDefaut, SANS mutation ──
  it("C1 — resolveDiscriminant(CAVOM, classeOption:'') === 'C' (classeParDefaut) et ne mute pas l'entrée", () => {
    const e = entree("CAVOM", { tauxInvalidite: 100, classeOption: "" });
    expect(resolveDiscriminant(cavom, e)).toBe("C");
    // Aucune mutation : la consultation ne modifie pas le dossier.
    expect(e.forfait?.classeOption).toBe("");
  });

  // ── C2 : défaut appliqué À LA LECTURE (pas de seed) → inval + capital décès ──
  it("C2 — CAVOM défaut 'C' à la lecture : inval ≈ 33070/12 €/mois et capital décès 70 965 €", () => {
    const e = entree("CAVOM", { tauxInvalidite: 100, classeOption: "" });
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(33070 / 12, 2);
    expect(forfaitaireCapitalDeces(cavom, e)).toBe(70965);
    // Toujours pas de mutation après calcul.
    expect(e.forfait?.classeOption).toBe("");
  });

  // ── C3 : choix explicite "A" prioritaire sur le défaut ──
  it("C3 — CAVOM choix 'A' prioritaire : resolveDiscriminant 'A', inval ≈ 8268/12, capital 17 716 €", () => {
    const e = entree("CAVOM", { tauxInvalidite: 100, classeOption: "A" });
    expect(resolveDiscriminant(cavom, e)).toBe("A");
    expect(forfaitaireInvalMensuel(cavom, e)).toBeCloseTo(8268 / 12, 2);
    expect(forfaitaireCapitalDeces(cavom, e)).toBe(17716);
  });

  // ── C4 : NON-RÉGRESSION CAVEC (pas de classeParDefaut → grille revenu) ──
  it("C4 — CAVEC : pas de classeParDefaut, déduction par grille = '3', clés ['1','2','3','4']", () => {
    expect(cavec.classeParDefaut).toBeUndefined();
    const e = entree("CAVEC", { tauxInvalidite: 100, classeOption: "" }, { revenuTNSAnnuel: 60000 });
    expect(resolveDiscriminant(cavec, e)).toBe("3");
    // Options dérivées CAVEC = ["1","2","3","4"] (identiques à l'ancien dur).
    const keys = Object.keys(cavec.invalidite.montantAnnuel100.valeurs);
    expect(keys).toEqual(["1", "2", "3", "4"]);
    // Valeurs calculées inchangées pour la classe déduite "3".
    const inval3 = forfaitaireInvalMensuel(cavec, e);
    expect(inval3).toBe(forfaitaireInvalMensuel(cavec, entree("CAVEC", { tauxInvalidite: 100, classeOption: "3" }, { revenuTNSAnnuel: 60000 })));
  });

  // ── C5 : beta — caisse "classe" SANS grille NI classeParDefaut → null ──
  it("C5 — caisse fictive sans grilleRevenuClasse ni classeParDefaut : resolveDiscriminant === null", () => {
    const fake = {
      moteur: "forfaitaire",
      discriminant: { type: "classe" }, // pas de grilleRevenuClasse
      invalidite: {
        modeTaux: "binaire",
        seuilTauxMinimal: 66,
        montantAnnuel100: { mode: "parDiscriminant", valeurs: { X: 1000, Y: 2000 } },
      },
      // pas de classeParDefaut
    };
    expect(resolveDiscriminant(fake, entree("FAKE", { tauxInvalidite: 100, classeOption: "" }))).toBeNull();
  });

  // ── C6 : PURETÉ — resolveDiscriminant ne mute jamais ses entrées ──
  it("C6 — resolveDiscriminant est pure : forfait inchangé après appel (CAVOM)", () => {
    const e = entree("CAVOM", { tauxInvalidite: 100, classeOption: "" });
    const snapshot = JSON.parse(JSON.stringify(e.forfait));
    resolveDiscriminant(cavom, e);
    expect(e.forfait).toEqual(snapshot);
    expect(e.forfait?.classeOption).toBe("");
  });
});
