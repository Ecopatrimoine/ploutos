// ─── Tests Lot 6 — module profil (source unique, 4 niveaux, ESG noté) ──────

import { describe, it, expect } from "vitest";
import {
  computeProfilRisque,
  computeScoreRisque,
  computeSousScoreESG,
  profilFromScore,
  SEUILS_PROFIL,
  SOUS_SCORE_ESG,
} from "../lib/conformite/profil";
import { fixtureMission } from "./__fixtures__/pdfFixture";

describe("profilFromScore — mapping 4 niveaux", () => {
  it("pts = 0 → prudent (Sécuritaire est absorbé)", () => {
    expect(profilFromScore(0)).toBe("prudent");
  });
  it("pts = 10 → prudent (ancien Sécuritaire)", () => {
    expect(profilFromScore(10)).toBe("prudent");
  });
  it("pts = 20 → prudent (borne haute)", () => {
    expect(profilFromScore(SEUILS_PROFIL.prudent)).toBe("prudent");
  });
  it("pts = 21 → équilibré", () => {
    expect(profilFromScore(SEUILS_PROFIL.prudent + 1)).toBe("équilibré");
  });
  it("pts = 40 → équilibré (borne haute)", () => {
    expect(profilFromScore(SEUILS_PROFIL.équilibré)).toBe("équilibré");
  });
  it("pts = 41 → dynamique", () => {
    expect(profilFromScore(SEUILS_PROFIL.équilibré + 1)).toBe("dynamique");
  });
  it("pts = 60 → dynamique (borne haute)", () => {
    expect(profilFromScore(SEUILS_PROFIL.dynamique)).toBe("dynamique");
  });
  it("pts = 61 → offensif", () => {
    expect(profilFromScore(SEUILS_PROFIL.dynamique + 1)).toBe("offensif");
  });
  it("pts = 80 (max théorique) → offensif", () => {
    expect(profilFromScore(80)).toBe("offensif");
  });
});

describe("computeScoreRisque — strictement identique à la formule héritée", () => {
  it("fixtureMission → 46 (témoin caractérisation)", () => {
    expect(computeScoreRisque(fixtureMission)).toBe(46);
  });
  it("mission vide → 0 (robustesse aux valeurs manquantes)", () => {
    expect(computeScoreRisque({})).toBe(0);
  });
});

describe("computeSousScoreESG — mapping préférences durabilité", () => {
  it("'oui' → 4", () => { expect(computeSousScoreESG("oui")).toBe(SOUS_SCORE_ESG.oui); });
  it("'partiel' → 2", () => { expect(computeSousScoreESG("partiel")).toBe(SOUS_SCORE_ESG.partiel); });
  it("'non' → 0", () => { expect(computeSousScoreESG("non")).toBe(SOUS_SCORE_ESG.non); });
  it("vide → 0 (équivaut à 'non')", () => { expect(computeSousScoreESG("")).toBe(0); });
  it("null/undefined → 0 (rétrocompat fixtures sans esgPref)", () => {
    expect(computeSousScoreESG(undefined)).toBe(0);
    expect(computeSousScoreESG(null)).toBe(0);
  });
});

describe("computeProfilRisque — invariant clef : ESG ne déplace PAS le profil", () => {
  it("fixture pts=46 : profil = 'dynamique' quelle que soit la préférence ESG", () => {
    const base = computeProfilRisque({ ...fixtureMission, esgPref: "non" });
    const partiel = computeProfilRisque({ ...fixtureMission, esgPref: "partiel" });
    const oui = computeProfilRisque({ ...fixtureMission, esgPref: "oui" });
    expect(base.profil).toBe("dynamique");
    expect(partiel.profil).toBe("dynamique");
    expect(oui.profil).toBe("dynamique");
  });

  it("ESG=oui ajoute 4 au total mais laisse scoreRisque intact", () => {
    const sans = computeProfilRisque({ ...fixtureMission, esgPref: "non" });
    const avec = computeProfilRisque({ ...fixtureMission, esgPref: "oui" });
    expect(avec.scoreRisque).toBe(sans.scoreRisque);  // axe risque inchangé
    expect(avec.sousScoreESG).toBe(SOUS_SCORE_ESG.oui);
    expect(avec.total).toBe(sans.total + SOUS_SCORE_ESG.oui);
  });

  it("totalMax = 84 (80 risque + 4 ESG max)", () => {
    const r = computeProfilRisque(fixtureMission);
    expect(r.totalMax).toBe(80 + SOUS_SCORE_ESG.oui);
  });

  it("invariant général : pour TOUTE mission, le profil ne dépend pas de esgPref", () => {
    const variants = [
      { ...fixtureMission, attitude: 0,  reactionBaisse: 0 },   // bas
      { ...fixtureMission, attitude: 18, reactionBaisse: 18 },  // haut
      { ...fixtureMission, attitude: 12, reactionBaisse: 12 },  // médian
    ];
    for (const m of variants) {
      const p1 = computeProfilRisque({ ...m, esgPref: "non" }).profil;
      const p2 = computeProfilRisque({ ...m, esgPref: "partiel" }).profil;
      const p3 = computeProfilRisque({ ...m, esgPref: "oui" }).profil;
      expect(p2).toBe(p1);
      expect(p3).toBe(p1);
    }
  });
});

describe("computeProfilRisque — compatibilité avec le filet de caractérisation", () => {
  it("fixture : (5 niveaux) Dynamique ↔ (4 niveaux) dynamique", () => {
    // Le filet (profil.caracterisation.test.ts) prouve que pts=46 produit
    // "Dynamique" avec l'ancien mapping. Le nouveau doit produire "dynamique".
    const r = computeProfilRisque(fixtureMission);
    expect(r.profil).toBe("dynamique");
    expect(r.scoreRisque).toBe(46);
  });
});
