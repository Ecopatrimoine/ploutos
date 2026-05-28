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

function safeNumOr0(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

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
  //
  // ⚠️ REMPLISSAGE CCN : certaines conventions (ex. Syntec) maintiennent
  // à 100 % du net pendant une période — dans ce cas l'égalité
  // maintien + IJ == revenu de référence est LÉGITIME, ce n'est PAS une
  // sur-indemnisation. La borne du test est donc <= (et NON <) : quand
  // une CCN à maintien 100 % sera saisie, le test tolère l'égalité.
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

  // G4c-bis — la pension d'invalidité obligatoire (part REVENU DE
  // REMPLACEMENT) ne dépasse pas le revenu de référence.
  //
  // ⚠️ La majoration tierce personne (cat3, 1298,44 € CPAM) est une
  // prestation de COMPENSATION du handicap, pas un revenu de
  // remplacement : elle peut légitimement porter le total au-dessus du
  // revenu d'activité. On la retranche donc avant de comparer.
  it("G4c-bis — pension invalidité obligatoire (hors MTP) <= revenu de référence (200 profils)", () => {
    const caisses = (referentiels.caisses as any).caisses;
    for (const { entree, categorie } of PROFILS) {
      const r = projeterArretMaladie(entree, categorie, referentiels);
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
  });

  // G4d — ordres de grandeur entre caisses (CIPAV < CARMF, etc.) :
  // à activer quand les IJ journalières seront renseignées.
  it.skip("G4d — ordres de grandeur des plafonds journaliers entre caisses — TO_VERIFY", () => {
    // Ex. attendu après remplissage : IJ CIPAV < IJ CARMF ;
    // capital décès régime général < SSI < CARMF.
    expect(true).toBe(true);
  });
});
