// ─── LOT D.1 (Fonction publique) — pas de maintien employeur PRIVE ──────────
//
// Le predicat isSalarieMaintienPrive exclut le fonctionnaire titulaire du
// maintien employeur prive (Code du travail + CCN). Son maintien statutaire
// (90 % puis 50 %) est deja porte par l'etage IJ obligatoire (regle
// pourcentage_revenu_paliers, LOT A) : laisser le maintien prive s'ajouter
// serait un DOUBLE COMPTE. Ce test verrouille l'exclusion (bande maintien = 0
// partout) tout en prouvant qu'un salarie prive de meme profil garde, lui, un
// maintien non nul (l'exclusion est ciblee, pas une regression globale).

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

function entree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 64,
    statutPro: "fonctionnaire",
    caisse: "FONCTION_PUBLIQUE",
    idccCCN: null,
    ancienneteMois: 120,
    salaireBrutAnnuel: 40000,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 0,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

describe("Fonction publique — maintien employeur prive exclu (pas de double compte)", () => {
  it("fonctionnaire : bande maintienEmployeur = 0 sur tout l'axe", () => {
    const r = projeterArretMaladie(entree(), "cat2", referentiels);
    expect(r.series.maintienEmployeur.every((v) => v === 0)).toBe(true);
  });

  it("fonctionnaire : l'IJ obligatoire porte bien la prestation (statutaire non nul)", () => {
    const r = projeterArretMaladie(entree(), "cat2", referentiels);
    const totalIJ = r.series.ijObligatoire.reduce((a, v) => a + v, 0);
    expect(totalIJ).toBeGreaterThan(0);
  });

  it("aucune rupture 'fin du maintien employeur' pour un fonctionnaire", () => {
    const r = projeterArretMaladie(entree(), "cat2", referentiels);
    const maintienRuptures = r.rupturesCles.filter((x) =>
      /maintien employeur/i.test(x.libelle)
    );
    expect(maintienRuptures).toHaveLength(0);
  });

  it("controle : un salarie non cadre de meme profil garde un maintien non nul", () => {
    const r = projeterArretMaladie(
      entree({ statutPro: "salarie_non_cadre", caisse: "CPAM" }),
      "cat2",
      referentiels
    );
    expect(r.series.maintienEmployeur.some((v) => v > 0)).toBe(true);
  });
});
