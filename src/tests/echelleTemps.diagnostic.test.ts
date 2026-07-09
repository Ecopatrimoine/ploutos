// LOT 10c A4-bis — DIAGNOSTIC : liste les ticks calculés pour David (SSI) et Erika
// (CPAM) sur de VRAIES projections. Jour exact + libellé + position compressée en %.
// Sortie console vérifiable sur papier avant de regarder l'écran.
import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso, ProjectionResult } from "../lib/prevoyance/types";
import { compress, buildTicksTemps } from "../lib/presentation/echelleTemps";

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

function listeTicks(nom: string, proj: ProjectionResult, maxJour: number) {
  const maxX = compress(maxJour) || 1;
  const ticks = buildTicksTemps(proj, maxJour);
  const lignes = ticks.map((t) => `  N${t.niveau}${t.ligne ? "'" : " "} J${String(t.jour).padStart(4)}  "${t.label}"  @ ${((t.x / maxX) * 100).toFixed(1).padStart(5)} %`);
  // eslint-disable-next-line no-console
  console.log(`\n=== TICKS ${nom} (maxJour=${maxJour}) ===\n${lignes.join("\n")}`);
  return ticks;
}

describe("A4-bis DIAGNOSTIC — ticks David (SSI) / Erika (CPAM)", () => {
  it("liste les ticks (vue 3 ans = jusqu'à la bascule) et (vue complète)", () => {
    const pD = projeterArretMaladie(davidSSI, "cat2", referentiels, "ald");
    const pE = projeterArretMaladie(erikaCPAM, "cat2", referentiels, "ald");

    // eslint-disable-next-line no-console
    console.log(`\nDAVID SSI : bascule=${pD.basculeInvaliditeJour} retraite=${pD.finProjectionJour} ref=${Math.round(pD.revenuReferenceMensuel)}`);
    listeTicks("DAVID SSI — vue 3 ans", pD, pD.basculeInvaliditeJour);
    listeTicks("DAVID SSI — vue complète", pD, pD.finProjectionJour);

    // eslint-disable-next-line no-console
    console.log(`\nERIKA CPAM : bascule=${pE.basculeInvaliditeJour} retraite=${pE.finProjectionJour} ref=${Math.round(pE.revenuReferenceMensuel)}`);
    listeTicks("ERIKA CPAM — vue 3 ans", pE, pE.basculeInvaliditeJour);
    listeTicks("ERIKA CPAM — vue complète", pE, pE.finProjectionJour);

    // Diagnostic : au moins un jalon niveau 1 (rupture) dans chaque vue 3 ans, tous libellés.
    const tD = buildTicksTemps(pD, pD.basculeInvaliditeJour);
    const tE = buildTicksTemps(pE, pE.basculeInvaliditeJour);
    expect(tD.some((t) => t.niveau === 1)).toBe(true);
    expect(tE.some((t) => t.niveau === 1)).toBe(true);
    expect(tD.filter((t) => t.niveau === 1).every((t) => t.label.length > 0)).toBe(true); // aucune muette
  });
});
