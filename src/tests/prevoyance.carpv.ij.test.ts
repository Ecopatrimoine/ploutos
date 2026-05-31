// ─── LOT C-3 (CARPV) — courbe IJ : relais CPAM J4-J90, trou apres J90 ────────
//
// Verrouille la courbe d'indemnites journalieres de CARPV (veterinaires) sur
// l'entree JSON REELLE. CARPV ne verse AUCUNE IJ propre : seule la CPAM
// indemnise (assiette revenuTNSAnnuel, carence 3j) entre J4 et J90 ; rien
// ensuite (trou jusqu'a l'invalidite). Calque exact du test CRN (meme modele :
// phase1 cpam, montantJournalier 0, plafondDureeJours null).

import { describe, it, expect } from "vitest";
import {
  computeIJObligatoireJournaliere,
  projeterArretMaladie,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { ForfaitConfig } from "../types/patrimoine";

const caisses = (referentiels.caisses as any).caisses;
const vars = buildPlafondVariables(referentiels);

// Veterinaire affilie CARPV. revenuTNSAnnuel = assiette du relais CPAM des 90
// premiers jours ; la CARPV ne verse aucune IJ propre.
function entreeCarpv(forfait: ForfaitConfig, over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 67,
    statutPro: "tns_liberal",
    caisse: "CARPV",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 80000,
    contratsIndividuels: [],
    couvertureCollective: null,
    forfait,
    ...over,
  };
}

describe("CARPV 2026 — arret de travail (relais CPAM, trou apres J90)", () => {
  it("J60 relais CPAM > 0 ; J120 trou (0) ; pas de faux 'donnees indisponibles'", () => {
    const e = entreeCarpv({ tauxInvalidite: 0 });
    const result = projeterArretMaladie(e, "cat2", referentiels);

    const idx60 = result.axe.findIndex((p: any) => p.jour === 60);
    const idx120 = result.axe.findIndex((p: any) => p.jour === 120);
    expect(idx60).toBeGreaterThanOrEqual(0);
    expect(idx120).toBeGreaterThanOrEqual(0);

    const expected60 = computeIJObligatoireJournaliere(60, caisses.CPAM, e, vars, "ald")! * 30;
    expect(expected60).toBeGreaterThan(0);
    expect(result.series.ijObligatoire[idx60]).toBeCloseTo(expected60, 2);

    expect(result.series.ijObligatoire[idx120]).toBe(0); // trou apres J90
    expect(result.donneesCaisseIndisponibles).toBe(false);
  });

  it("aucune IJ propre CARPV : montantJournalier uniforme 0 dans la donnee", () => {
    const carpv = caisses.CARPV;
    expect(carpv.ij.phase1.type).toBe("cpam");
    expect(carpv.ij.plafondDureeJours).toBeNull();
    expect(carpv.ij.montantJournalier).toEqual({ mode: "uniforme", valeur: 0 });
  });
});
