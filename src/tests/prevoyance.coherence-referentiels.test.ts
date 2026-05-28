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
import type { EntreePerso } from "../lib/prevoyance/types";

const EPS = 1; // tolérance €/mois pour les arrondis

const PROFILS = generateProfilsCoherents(200, 7777);

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

  // G4a-bis — comparaison paliers CCN >= légal : à activer quand une CCN
  // aura des paliers fermes dans ccn-2026.json (aujourd'hui TO_VERIFY/TO_FILL).
  it.skip("G4a-bis — toute CCN documentée offre un maintien >= maintien légal — TO_VERIFY (paliers CCN à remplir)", () => {
    // À activer après remplissage des paliers Syntec/Métallurgie/etc.
    expect(true).toBe(true);
  });

  // G4b — aucune IJ obligatoire ne dépasse le revenu de référence
  // (on ne gagne pas plus en arrêt qu'en activité).
  it("G4b — IJ obligatoire <= revenu de référence sur 200 profils cohérents", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const ref = r.revenuReferenceMensuel;
      if (ref <= 0) continue;
      for (const v of r.series.ijObligatoire) {
        expect(v).toBeLessThanOrEqual(ref + EPS);
      }
    }
  });

  // G4c — pas de sur-indemnisation : maintien employeur + IJSS <= 100 %
  // du revenu de référence (le maintien complète, il ne sur-couvre pas).
  it("G4c — maintien employeur + IJ obligatoire <= revenu de référence (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const ref = r.revenuReferenceMensuel;
      if (ref <= 0) continue;
      for (let i = 0; i < r.axe.length; i++) {
        const cumul = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i];
        expect(cumul).toBeLessThanOrEqual(ref + EPS);
      }
    }
  });

  // G4c-bis — la pension d'invalidité obligatoire seule ne dépasse pas
  // le revenu de référence.
  it("G4c-bis — pension invalidité obligatoire <= revenu de référence (200 profils)", () => {
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
      const ref = r.revenuReferenceMensuel;
      if (ref <= 0) continue;
      for (const v of r.series.pensionInvalObligatoire) {
        expect(v).toBeLessThanOrEqual(ref + EPS);
      }
    }
  });

  // G4d — ordres de grandeur entre caisses (CIPAV < CARMF, etc.) :
  // à activer quand les IJ journalières seront renseignées.
  it.skip("G4d — ordres de grandeur des plafonds journaliers entre caisses — TO_VERIFY", () => {
    // Ex. attendu après remplissage : IJ CIPAV < IJ CARMF ;
    // capital décès régime général < SSI < CARMF.
    expect(true).toBe(true);
  });
});
