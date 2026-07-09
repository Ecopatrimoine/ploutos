// LOT 10c A4-bis — DIAGNOSTIC : liste les ticks calculés pour David (SSI) et Erika
// (CPAM) sur de VRAIES projections. Jour exact + libellé + position compressée en %.
// Sortie console vérifiable sur papier avant de regarder l'écran.
import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, ProjectionResult } from "../lib/prevoyance/types";
import { axeTemps } from "../lib/presentation/echelleTemps";
import type { ScenarioArret } from "../types/patrimoine";

const davidSSI: EntreePerso = {
  age: 44, ageRetraite: 64, statutPro: "tns_artisan", caisse: "SSI",
  idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
  revenuTNSAnnuel: 60000, nbEnfantsACharge: 0, contratsIndividuels: [], couvertureCollective: null,
} as unknown as EntreePerso;

const erikaCPAM: EntreePerso = {
  age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
  idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 42000, salaireNetMensuel: 2700,
  revenuTNSAnnuel: 0, nbEnfantsACharge: 0, contratsIndividuels: [], couvertureCollective: null,
} as unknown as EntreePerso;

// La preuve utilise EXACTEMENT la fonction de production axeTemps (même que le rendu).
function listeTicks(nom: string, proj: ProjectionResult, vueComplete: boolean) {
  const { maxX, ticks } = axeTemps(proj, vueComplete);
  const lignes = ticks.map((t) => `  N${t.niveau}${t.ligne ? "'" : " "} J${String(t.jour).padStart(4)}  "${t.label}"  @ ${((t.x / (maxX || 1)) * 100).toFixed(1).padStart(5)} %`);
  // eslint-disable-next-line no-console
  console.log(`\n=== ${nom} (${vueComplete ? "vue complète" : "vue 3 ans"}) ===\n${lignes.join("\n")}`);
  return ticks;
}

describe("DIAGNOSTIC ticks — même code que le rendu (axeTemps), 2 personnes × 2 scénarios × 2 vues", () => {
  it("génère la liste de preuve et vérifie la rupture fin-IJ (J365 « 1 an ») en maladie ordinaire", () => {
    const cas = [["DAVID SSI", davidSSI], ["ERIKA CPAM", erikaCPAM]] as const;
    const scenarios: ScenarioArret[] = ["ald", "maladie_ordinaire"];
    for (const [nom, e] of cas) {
      for (const sc of scenarios) {
        const p = projeterArretMaladie(e, "cat2", referentiels, sc);
        // eslint-disable-next-line no-console
        console.log(`\n### ${nom} — scénario ${sc} (bascule ${p.basculeInvaliditeJour} · retraite ${p.finProjectionJour} · réf ${Math.round(p.revenuReferenceMensuel)})`);
        listeTicks(nom, p, false);
        listeTicks(nom, p, true);
      }
    }
    // C3a — en maladie ordinaire, la fin des IJ (365 j = palier « 1 an » de la frise)
    // est bien un tick niveau 1 « 1 an » pour les DEUX personnes (via axeTemps de production).
    for (const [, e] of cas) {
      const p = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");
      const t = axeTemps(p, false).ticks.find((x) => x.jour === 365);
      expect(t).toBeDefined();
      expect(t!.label).toBe("1 an");
      expect(t!.niveau).toBe(1);
    }
    // En ALD, pas de rupture à 365 (IJ jusqu'à 3 ans) — cohérent avec l'écran.
    const pAld = projeterArretMaladie(davidSSI, "cat2", referentiels, "ald");
    expect(axeTemps(pAld, false).ticks.find((x) => x.jour === 365)).toBeUndefined();
  });
});
