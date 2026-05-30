// ─── LOT 2 — Mapping → moteur pour les caisses FORFAITAIRES (CNBF, CARCDSF,
// CAVEC) ─────────────────────────────────────────────────────────────────
//
// Test NET-NEUF (lot 2). Vérifie que la saisie UI (data.prevoyance.{p}.forfait)
// est bien recopiée par buildEntreePerso dans entree.forfait, puis que le
// pipeline complet mapping → projeterArretMaladie produit les MÊMES montants
// que les cas d'or du moteur (lot 1) : un dossier saisi via l'UI doit donner
// exactement les mêmes chiffres que les tests de valeurs directs.
//
// Aucun test existant n'est modifié. Cf. SPEC_PREVOYANCE_CAISSES_FORFAITAIRES
// §5.4 / §8 (point 5 : mapping → moteur).

import { describe, it, expect } from "vitest";
import { buildEntreePerso } from "../lib/prevoyance/mapping";
import {
  projeterArretMaladie,
  forfaitaireInvalMensuel,
  forfaitaireCapitalDeces,
  resolveDiscriminant,
} from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { PatrimonialData, ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;

// Construit un PatrimonialData minimal pour une personne TNS libérale affiliée
// à une caisse forfaitaire, avec un revenu BNC piloté (CA réel = bénéfice) et
// une config forfaitaire saisie. PCS 2/26 = libéral non agricole (BNC) ; le
// bénéfice imposable d'un réel sans charges = le CA.
function dataForfait(
  caisse: string,
  revenuBNC: number,
  forfait: ForfaitConfig,
  birthYearOffset = 50 // âge ≈ 50 ans
): PatrimonialData {
  const annee = new Date().getFullYear();
  return {
    coupleStatus: "single",
    person1BirthDate: `${annee - birthYearOffset}-06-15`,
    person1PcsGroupe: "2",
    person1Csp: "26",
    person1JobTitle: "",
    ca1: revenuBNC,
    bicType1: undefined,
    microRegime1: false,
    chargesReelles1: 0,
    childrenData: [],
    dateMariage: null,
    travail: {
      p1: {
        statutPro: "tns_liberal",
        caisseAffiliation: caisse,
        employeur: null,
        dateEmbauche: null,
        dateDebutActivite: `${annee - 10}-01-01`, // ~120 mois d'ancienneté
        tempsTravail: { type: "plein" },
        salaireBrutAnnuel: 0,
        primeAnnuelle: null,
        revenuBNC: null,
        revenuBIC: null,
        optionMadelin: false,
      },
      p2: null,
    },
    prevoyance: {
      version: 1,
      p1: {
        contratsIndividuels: [],
        couvertureCollective: null,
        categorieInvaliditeProjetee: "cat2",
        scenarioArret: "ald",
        forfait,
      },
      p2: null,
    },
  } as unknown as PatrimonialData;
}

// IJ obligatoire MENSUELLE servie au jour t (lue dans la projection, plateau
// J91→J1095 ; ageRetraite forcé haut via âge bas pour tenir la fenêtre).
function ijObligAtJour(entree: any, jour: number): number {
  const r = projeterArretMaladie(entree, "cat2", referentiels);
  const idx = r.axe.findIndex((p) => p.jour === jour);
  if (idx >= 0) return r.series.ijObligatoire[idx];
  const cand = r.axe.filter((p) => p.jour >= 90 && p.jour < 1095);
  return cand.length ? r.series.ijObligatoire[r.axe.indexOf(cand[0])] : 0;
}

describe("LOT 2 — mapping UI → moteur forfaitaire (CNBF, CARCDSF, CAVEC)", () => {
  it("buildEntreePerso recopie forfait (sous-profession, taux, classeOption) dans entree.forfait", () => {
    const forfait: ForfaitConfig = {
      tauxInvalidite: 70,
      sousProfession: "dentiste",
      classeOption: "4",
    };
    const entree = buildEntreePerso(dataForfait("CARCDSF", 50000, forfait), "p1");
    expect(entree).not.toBeNull();
    expect(entree!.forfait).toBeDefined();
    expect(entree!.forfait!.tauxInvalidite).toBe(70);
    expect(entree!.forfait!.sousProfession).toBe("dentiste");
    expect(entree!.forfait!.classeOption).toBe("4");
    // Le revenu TNS doit aussi remonter (déduction de classe CAVEC).
    expect(entree!.revenuTNSAnnuel).toBe(50000);
  });

  it("CNBF : IJ 90 €/j (mensuel ×30) via le pipeline mapping → projection", () => {
    const entree = buildEntreePerso(
      dataForfait("CNBF", 80000, { tauxInvalidite: 100 }),
      "p1"
    );
    expect(ijObligAtJour(entree, 180)).toBeCloseTo(90 * 30, 2);
  });

  it("CNBF : invalidité ancienneté < 20 ans & taux > 66 → 9 577/12 €/mois", () => {
    const entree = buildEntreePerso(
      dataForfait("CNBF", 80000, { tauxInvalidite: 100 }),
      "p1"
    );
    expect(forfaitaireInvalMensuel(caisses.CNBF, entree!)).toBeCloseTo(9577 / 12, 2);
    expect(forfaitaireCapitalDeces(caisses.CNBF, entree!)).toBe(50000);
  });

  it("CARCDSF dentiste : IJ 113,22 €/j + invalidité 31 824,20/12 €/mois", () => {
    const entree = buildEntreePerso(
      dataForfait("CARCDSF", 90000, { tauxInvalidite: 100, sousProfession: "dentiste" }),
      "p1"
    );
    expect(ijObligAtJour(entree, 180)).toBeCloseTo(113.22 * 30, 2);
    expect(forfaitaireInvalMensuel(caisses.CARCDSF, entree!)).toBeCloseTo(31824.2 / 12, 2);
    expect(forfaitaireCapitalDeces(caisses.CARCDSF, entree!)).toBe(19220);
  });

  it("CAVEC : classe déduite du revenu 50 000 → C3 ; IJ 130 €/j ; invalidité 100 % C3 → 33 240/12 €/mois", () => {
    const entree = buildEntreePerso(
      dataForfait("CAVEC", 50000, { tauxInvalidite: 100 }),
      "p1"
    );
    expect(resolveDiscriminant(caisses.CAVEC, entree!)).toBe("3");
    expect(ijObligAtJour(entree, 180)).toBeCloseTo(130 * 30, 2);
    expect(forfaitaireInvalMensuel(caisses.CAVEC, entree!)).toBeCloseTo(33240 / 12, 2);
  });

  it("CAVEC : option classe supérieure (C3 déduite → C4) honorée via forfait.classeOption", () => {
    const entree = buildEntreePerso(
      dataForfait("CAVEC", 50000, { tauxInvalidite: 100, classeOption: "4" }),
      "p1"
    );
    expect(resolveDiscriminant(caisses.CAVEC, entree!)).toBe("4");
    expect(forfaitaireCapitalDeces(caisses.CAVEC, entree!)).toBe(290850);
  });
});
