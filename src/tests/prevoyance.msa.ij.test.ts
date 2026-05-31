// ─── LOT M-1 (MSA) — regle IJ "paliers_temporels" (AMEXA exploitant) ────────
//
// Valide le NOUVEAU mode IJ a paliers temporels (montant qui change selon le jour
// d'arret t) sur une caisseRef FICTIVE en dur — MSA n'est PAS encore encodee (JSON
// = lot M-2), le referentiel n'est pas touche.
// Bareme MSA exploitant (source msa.fr / Legifrance) : carence 3j, 26 €/j du J4 au
// J28, 34,66 €/j a partir du J29.

import { describe, it, expect } from "vitest";
import { computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

const vars = buildPlafondVariables(referentiels);

// Caisse FICTIVE MSA-like : IJ paliers temporels, plafond duree null (pas de
// coupure haute cote IJ ; l'invalidite prendra le relais).
const FICT_MSA: any = {
  ij: {
    regle: "paliers_temporels",
    carenceJours: 3,
    paliers: [
      { jusquaJour: 28, montant: 26 },
      { jusquaJour: null, montant: 34.66 },
    ],
    plafondDureeJours: null,
    plafondDureeJoursALD: null,
  },
};

// Exploitant agricole TNS. Le revenu n'intervient PAS dans l'IJ forfaitaire MSA :
// on le laisse a 0 pour verrouiller l'independance au revenu.
function entreeExploitant(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse: "MSA",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 0,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

describe("MSA — IJ paliers temporels (AMEXA exploitant)", () => {
  const e = entreeExploitant();
  it("carence : J2 -> 0", () => {
    expect(computeIJObligatoireJournaliere(2, FICT_MSA, e, vars)).toBe(0);
  });
  it("J3 (carence = 3, t < carence faux a t=3) -> 1er palier 26", () => {
    // carence 3 => t < 3 renvoie 0 ; a t=3, t<carence est faux -> palier applique
    expect(computeIJObligatoireJournaliere(3, FICT_MSA, e, vars)).toBe(26);
  });
  it("J20 -> 26 (1er palier)", () => {
    expect(computeIJObligatoireJournaliere(20, FICT_MSA, e, vars)).toBe(26);
  });
  it("J28 (borne haute 1er palier incluse) -> 26", () => {
    expect(computeIJObligatoireJournaliere(28, FICT_MSA, e, vars)).toBe(26);
  });
  it("J29 -> 34,66 (2e palier)", () => {
    expect(computeIJObligatoireJournaliere(29, FICT_MSA, e, vars)).toBe(34.66);
  });
  it("J400 (palier terminal jusquaJour null, plafond duree null) -> 34,66", () => {
    expect(computeIJObligatoireJournaliere(400, FICT_MSA, e, vars)).toBe(34.66);
  });
  it("independance au revenu : meme resultat avec revenu eleve", () => {
    const eRiche = entreeExploitant({ revenuTNSAnnuel: 90000 });
    expect(computeIJObligatoireJournaliere(20, FICT_MSA, eRiche, vars)).toBe(26);
  });
});

describe("MSA — non-regression regles IJ existantes (caisses reelles)", () => {
  const caisses = (referentiels.caisses as any).caisses;
  it("CPAM carence 3j inchangee : J2 -> 0, J3 -> > 0", () => {
    const eSal: EntreePerso = {
      age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 24, salaireBrutAnnuel: 40000,
      salaireNetMensuel: 0, revenuTNSAnnuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    expect(computeIJObligatoireJournaliere(2, caisses.CPAM, eSal, vars)).toBe(0);
    expect(computeIJObligatoireJournaliere(3, caisses.CPAM, eSal, vars)!).toBeGreaterThan(0);
  });
});
