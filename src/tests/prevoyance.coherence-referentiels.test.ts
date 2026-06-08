// ─── T5 / Famille G4 — Cohérence inter-référentiels (PLAN_TESTS §G4) ───
//
// Invariants qui croisent plusieurs référentiels. Automatisables même
// avec des caisses TO_VERIFY (les étages obligatoires sortent alors à 0,
// ce qui respecte trivialement les bornes). Le vrai filet est de
// garantir l'absence de sur-indemnisation et le plancher légal.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import { generateProfilsCoherents } from "./__fixtures__/prevoyanceFuzzing";
import type { EntreePerso, ScenarioArret } from "../lib/prevoyance/types";

const EPS = 1; // tolérance €/mois pour les arrondis

function safeNumOr0(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

const PROFILS = generateProfilsCoherents(200, 7777);

// Les invariants anti-sur-indemnisation doivent tenir QUEL QUE SOIT le
// scénario d'arrêt : l'ALD ne fait qu'allonger la durée des IJ (1095 j),
// pas leur montant journalier → la borne ≤ revenu de référence est la
// même chaque jour servi.
const SCENARIOS: ScenarioArret[] = ["maladie_ordinaire", "ald"];

describe("G4 — Cohérence inter-référentiels", () => {
  // G4a — plancher légal : une CCN non documentée retombe sur le
  // maintien légal Mensualisation (jamais en dessous).
  it("G4a — CCN non documentée → useLegalDefault=true (plancher légal appliqué)", () => {
    const e: EntreePerso = {
      age: 35, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
      idccCCN: "9999", ancienneteMois: 120, salaireBrutAnnuel: 30000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const r = projeterArretMaladie(e, "cat2", referentiels);
    expect(r.useLegalDefault).toBe(true);
    // Le maintien légal produit bien un maintien > 0 sur la fenêtre AM
    // (ancienneté 120 mois → palier Mensualisation actif).
    expect(Math.max(...r.series.maintienEmployeur)).toBeGreaterThan(0);
  });

  // G4a-bis — avec le plancher légal (LOT 1a-iii), une CCN documentée offre un
  // maintien EFFECTIF max(CCN, légal) >= maintien légal seul, JOUR PAR JOUR
  // (par construction). Vérifié sur Syntec (1486), seule CCN remplie, pour les
  // deux catégories et plusieurs anciennetés (dont 16 ans, où la durée légale
  // dépasse la durée CCN → le relais légal garantit l'inégalité).
  it("G4a-bis — maintien Syntec (effectif) >= maintien légal seul, jour par jour", () => {
    const cas: Array<{ statutPro: EntreePerso["statutPro"]; ancienneteMois: number }> = [
      { statutPro: "salarie_cadre", ancienneteMois: 12 },
      { statutPro: "salarie_cadre", ancienneteMois: 192 },
      { statutPro: "salarie_non_cadre", ancienneteMois: 24 },
      { statutPro: "salarie_non_cadre", ancienneteMois: 120 },
    ];
    for (const c of cas) {
      const base: EntreePerso = {
        age: 40, ageRetraite: 64, statutPro: c.statutPro, caisse: "CPAM",
        idccCCN: "1486", ancienneteMois: c.ancienneteMois, salaireBrutAnnuel: 60000,
        salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
      };
      const rCcn = projeterArretMaladie(base, "cat2", referentiels);
      const rLegal = projeterArretMaladie({ ...base, idccCCN: null }, "cat2", referentiels);
      // Axes potentiellement différents (marches CCN) → comparer par jour.
      const legalParJour = new Map<number, number>();
      rLegal.axe.forEach((p, i) => legalParJour.set(p.jour, rLegal.series.maintienEmployeur[i]));
      for (let i = 0; i < rCcn.axe.length; i++) {
        if (rCcn.axe[i].phase !== "am") continue;
        const legalVal = legalParJour.get(rCcn.axe[i].jour);
        if (legalVal === undefined) continue; // jour absent de l'axe légal
        expect(rCcn.series.maintienEmployeur[i]).toBeGreaterThanOrEqual(legalVal - EPS);
      }
    }
  });

  // G4b — aucune IJ obligatoire ne dépasse le revenu de référence
  // (on ne gagne pas plus en arrêt qu'en activité).
  it("G4b — IJ obligatoire <= revenu de référence sur 200 profils cohérents (2 scénarios)", () => {
    for (const scenario of SCENARIOS) {
      for (const { entree, categorie } of PROFILS) {
        // MSA exploitant (AMEXA) verse une IJ FORFAITAIRE (paliers_temporels) qui peut
        // légitimement dépasser un faible revenu d'exploitant : l'invariant "IJ <=
        // revenu de référence" suppose une IJ proportionnelle et ne s'applique pas à
        // une IJ forfaitaire à bas revenu. Cas couvert par un test dédié (lot M-2b).
        if (entree.caisse === "MSA") continue;
        const r = projeterArretMaladie(entree, categorie, referentiels, scenario);
        const ref = r.revenuReferenceMensuel;
        if (ref <= 0) continue;
        for (const v of r.series.ijObligatoire) {
          expect(v).toBeLessThanOrEqual(ref + EPS);
        }
      }
    }
  });

  // G4c — pas de sur-indemnisation : maintien employeur + IJSS <= 100 %
  // du revenu de référence (le maintien complète, il ne sur-couvre pas).
  //
  // ⚠️ REMPLISSAGE CCN : certaines conventions (ex. Syntec) maintiennent
  // à 100 % du net pendant une période — dans ce cas l'égalité
  // maintien + IJ == revenu de référence est LÉGITIME, ce n'est PAS une
  // sur-indemnisation. La borne du test est donc <= (et NON <) : quand
  // une CCN à maintien 100 % sera saisie, le test tolère l'égalité.
  it("G4c — maintien employeur + IJ obligatoire <= revenu de référence (200 profils, 2 scénarios)", () => {
    for (const scenario of SCENARIOS) {
      for (const { entree, categorie } of PROFILS) {
        // Cf. G4b : MSA exploitant verse une IJ FORFAITAIRE (AMEXA) qui peut dépasser
        // un faible revenu — invariant proportionnel non applicable (test dédié M-2b).
        if (entree.caisse === "MSA") continue;
        const r = projeterArretMaladie(entree, categorie, referentiels, scenario);
        const ref = r.revenuReferenceMensuel;
        if (ref <= 0) continue;
        for (let i = 0; i < r.axe.length; i++) {
          const cumul = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i];
          expect(cumul).toBeLessThanOrEqual(ref + EPS);
        }
      }
    }
  });

  // G4c-bis — la pension d'invalidité obligatoire (part REVENU DE
  // REMPLACEMENT) ne dépasse pas le revenu de référence.
  //
  // ⚠️ La majoration tierce personne (cat3, 1298,44 € CPAM) est une
  // prestation de COMPENSATION du handicap, pas un revenu de
  // remplacement : elle peut légitimement porter le total au-dessus du
  // revenu d'activité. On la retranche donc avant de comparer.
  it("G4c-bis — pension invalidité obligatoire (hors MTP) <= revenu de référence (200 profils, 2 scénarios)", () => {
    const caisses = (referentiels.caisses as any).caisses;
    for (const scenario of SCENARIOS) {
      for (const { entree, categorie } of PROFILS) {
        const r = projeterArretMaladie(entree, categorie, referentiels, scenario);
        const ref = r.revenuReferenceMensuel;
        if (ref <= 0) continue;
        const mtp =
          categorie === "cat3"
            ? safeNumOr0(
                caisses[entree.caisse as string]?.invalidite?.categories?.cat3
                  ?.majorationTiercePersonneMensuelle
              )
            : 0;
        for (const v of r.series.pensionInvalObligatoire) {
          expect(v - mtp).toBeLessThanOrEqual(ref + EPS);
        }
      }
    }
  });

  // G4d — ordres de grandeur entre caisses. Activable depuis que CPAM et
  // SSI sont documentées (les caisses libérales CARMF/CIPAV restent
  // TO_VERIFY → comparaison étendue différée).
  it("G4d — ordres de grandeur CPAM vs SSI (capital décès, plafond IJ)", () => {
    const caisses = (referentiels.caisses as any).caisses;
    const cpam = caisses.CPAM;
    const ssi = caisses.SSI;
    // Capital décès : régime général (forfait 4009 €) < SSI (20 % PASS = 9612 €).
    expect(cpam.capitalDeces.montant).toBeLessThan(ssi.capitalDeces.montantActifOuInvalide);
    // Plafond IJ journalier : CPAM 41,95 € (1,4 SMIC) < SSI 65,84 € (PASS/730).
    expect(cpam.ij.ijMaxJournaliere).toBeLessThan(ssi.ij.ijMaxJournaliere);
    expect(cpam.ij.ijMaxJournaliere).toBeCloseTo(41.95, 2);
    expect(ssi.ij.ijMaxJournaliere).toBeCloseTo(65.84, 2);
  });
});
