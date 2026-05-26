// ─── Tests Lot 6 → 6bis — module profil (4 niveaux, ESG, HORIZON intégré) ──

import { describe, it, expect } from "vitest";
import {
  computeProfilRisque,
  computeScoreRisque,
  computeSousScoreESG,
  profilFromScore,
  SEUILS_PROFIL,
  SOUS_SCORE_ESG,
  PONDERATION_HORIZON,
  MAX_RISQUE,
  MAX_TOTAL,
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

describe("computeScoreRisque — Lot 6bis : intègre l'horizon", () => {
  it("fixtureMission (horizon '9-15' = +8) → 54", () => {
    // Ancien comportement (Lot 6) = 46 — voir profil.caracterisation.test.ts pour le témoin.
    expect(computeScoreRisque(fixtureMission)).toBe(46 + PONDERATION_HORIZON["9-15"]);
    expect(computeScoreRisque(fixtureMission)).toBe(54);
  });
  it("mission vide → 0 (robustesse aux valeurs manquantes)", () => {
    expect(computeScoreRisque({})).toBe(0);
  });
  it("horizon absent / inconnu → 0 pt horizon (rétrocompat)", () => {
    expect(computeScoreRisque({ ...fixtureMission, horizon: undefined })).toBe(46);
    expect(computeScoreRisque({ ...fixtureMission, horizon: "" })).toBe(46);
    expect(computeScoreRisque({ ...fixtureMission, horizon: "valeur_inconnue" })).toBe(46);
  });
  it("différentiel horizon : '15+' (16) − '0-4' (0) = 16 sur la même mission", () => {
    const court = computeScoreRisque({ ...fixtureMission, horizon: "0-4" });
    const long  = computeScoreRisque({ ...fixtureMission, horizon: "15+" });
    expect(long - court).toBe(16);
  });
});

describe("PONDERATION_HORIZON — barème paramétrable", () => {
  it("4 paliers '0-4' / '5-8' / '9-15' / '15+' avec 0/4/8/16", () => {
    expect(PONDERATION_HORIZON["0-4"]).toBe(0);
    expect(PONDERATION_HORIZON["5-8"]).toBe(4);
    expect(PONDERATION_HORIZON["9-15"]).toBe(8);
    expect(PONDERATION_HORIZON["15+"]).toBe(16);
  });
  it("MAX_RISQUE = 96 (80 base + 16 horizon max)", () => {
    expect(MAX_RISQUE).toBe(96);
  });
  it("MAX_TOTAL = 100 (96 risque + 4 ESG max)", () => {
    expect(MAX_TOTAL).toBe(100);
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
  it("fixture (scoreRisque=54 avec horizon) : profil = 'dynamique' quel que soit ESG", () => {
    const base = computeProfilRisque({ ...fixtureMission, esgPref: "non" });
    const partiel = computeProfilRisque({ ...fixtureMission, esgPref: "partiel" });
    const oui = computeProfilRisque({ ...fixtureMission, esgPref: "oui" });
    expect(base.profil).toBe("dynamique");
    expect(partiel.profil).toBe("dynamique");
    expect(oui.profil).toBe("dynamique");
    expect(base.scoreRisque).toBe(54);
  });

  it("ESG=oui ajoute 4 au total mais laisse scoreRisque intact", () => {
    const sans = computeProfilRisque({ ...fixtureMission, esgPref: "non" });
    const avec = computeProfilRisque({ ...fixtureMission, esgPref: "oui" });
    expect(avec.scoreRisque).toBe(sans.scoreRisque);  // axe risque inchangé
    expect(avec.sousScoreESG).toBe(SOUS_SCORE_ESG.oui);
    expect(avec.total).toBe(sans.total + SOUS_SCORE_ESG.oui);
  });

  it("totalMax = 100 (96 risque + 4 ESG max, Lot 6bis)", () => {
    const r = computeProfilRisque(fixtureMission);
    expect(r.totalMax).toBe(MAX_TOTAL);
    expect(r.totalMax).toBe(100);
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

describe("computeProfilRisque — Lot 6bis : l'horizon PEUT déplacer le profil", () => {
  // Construit une mission dont le scoreRisque hors horizon est juste sous la
  // borne équilibré (40). Avec horizon "15+" (+16), pts = 54 → "dynamique".
  // Sans horizon, pts = 38 → "équilibré". Preuve directe que l'horizon agit.
  it("scoreRisque pré-horizon = 38 + horizon '15+' → bascule équilibré → dynamique", () => {
    // 38 pts = attitude(18) + reactionBaisse(12) + reactionPertes(3) + reactionGains(3) + savoirUCRisque(2)
    const m = {
      ...fixtureMission,
      attitude: 18, reactionBaisse: 12,
      connaitFondsEuros: false, investiFondsEuros: false,
      connaitActions: false, investiActions: false,
      connaitOPCVM: false, investiOPCVM: false,
      connaitImmo: false, investiImmo: false,
      connaitTrackers: false, investiTrackers: false,
      connaitStructures: false, investiStructures: false,
      reactionPertes: 3, reactionGains: 3,
      modeGestion: "" as any,
      savoirUCRisque: true, savoirHorizonUC: false, savoirRisqueRendement: false,
      esgPref: "non" as any,
    };
    const sansHorizon = computeProfilRisque({ ...m, horizon: "0-4" });
    const avecHorizon = computeProfilRisque({ ...m, horizon: "15+" });
    expect(sansHorizon.scoreRisque).toBe(38);
    expect(sansHorizon.profil).toBe("équilibré");
    expect(avecHorizon.scoreRisque).toBe(54);
    expect(avecHorizon.profil).toBe("dynamique");
  });

  it("scoreRisque pré-horizon = 56 + horizon '15+' → bascule dynamique → offensif", () => {
    // 56 pts pré-horizon : attitude(18) + reactionBaisse(18) + investiFondsEuros(1)
    //  + investiActions(3) + investiOPCVM(3) + reactionPertes(3) + reactionGains(3)
    //  + savoirUCRisque(2) + savoirHorizonUC(2) + savoirRisqueRendement(2) +
    //  + (connaitFondsEuros 1) = 56. Construit explicitement.
    const m56 = {
      ...fixtureMission,
      attitude: 18, reactionBaisse: 18,
      connaitFondsEuros: true,  investiFondsEuros: true,
      connaitActions: false,    investiActions: true,
      connaitOPCVM: false,      investiOPCVM: true,
      connaitImmo: false,       investiImmo: false,
      connaitTrackers: false,   investiTrackers: false,
      connaitStructures: false, investiStructures: false,
      reactionPertes: 3, reactionGains: 3,
      modeGestion: "" as any,
      savoirUCRisque: true, savoirHorizonUC: true, savoirRisqueRendement: true,
      esgPref: "non" as any,
    };
    const sansHorizon = computeProfilRisque({ ...m56, horizon: "0-4" });
    const avecHorizon = computeProfilRisque({ ...m56, horizon: "15+" });
    expect(sansHorizon.scoreRisque).toBe(56);
    expect(sansHorizon.profil).toBe("dynamique");
    expect(avecHorizon.scoreRisque).toBe(72);
    expect(avecHorizon.profil).toBe("offensif");
  });
});
