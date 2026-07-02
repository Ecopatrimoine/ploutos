// ─── LOT B (Fonction publique) — invalidite categories base "revenu" ────────
//
// Pension mensuelle = revenu mensuel x taux de la categorie, SANS min/maxMensuel
// ni plafond PASS. plancherTauxSup : si le taux d'invalidite (0-100) >= 60 %, la
// pension ne peut descendre sous 50 % du revenu (relevement de cat1). Reutilise
// le chemin CPAM categories (computeInvalObligatoireMensuel).

import { describe, it, expect } from "vitest";
import { computeInvalObligatoireMensuel } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";

const FP = (referentiels.caisses as any).caisses.FONCTION_PUBLIQUE;
const baseMensuel = 40000 / 12; // revenu mensuel declare

describe("Fonction publique — invalidite categories base revenu (sans plafond) + plancherTauxSup", () => {
  it("cat2 sur 40000 -> 50 % = 1666,67 EUR/mois", () => {
    expect(computeInvalObligatoireMensuel(FP, "cat2", baseMensuel, 0)).toBeCloseTo(1666.67, 2);
  });
  it("cat1 sur 40000 -> 30 % = 1000 EUR/mois (sans taux d'invalidite)", () => {
    expect(computeInvalObligatoireMensuel(FP, "cat1", baseMensuel, 0)).toBeCloseTo(1000, 2);
  });
  it("plancher : cat1 (30 %) avec taux invalidite 65 % >= 60 % -> plancher 50 % = 1666,67", () => {
    expect(computeInvalObligatoireMensuel(FP, "cat1", baseMensuel, 0, 65)).toBeCloseTo(1666.67, 2);
  });
  it("pas de plancher si taux invalidite < seuil : cat1 avec 50 % -> 1000", () => {
    expect(computeInvalObligatoireMensuel(FP, "cat1", baseMensuel, 0, 50)).toBeCloseTo(1000, 2);
  });
  it("aucun plafond PASS : cat2 sur 120000 -> 5000 EUR/mois", () => {
    expect(computeInvalObligatoireMensuel(FP, "cat2", 120000 / 12, 0)).toBeCloseTo(5000, 2);
  });
});
