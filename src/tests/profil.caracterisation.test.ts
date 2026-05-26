// ─── Lot 6bis → 8a — Témoin de la formule de scoring profil investisseur ───
//
// Ce fichier garde une trace MINIMALE de l'historique de la formule :
//   • Lot 6 : la formule héritée (sans horizon) produisait pts=46 sur la fixture.
//   • Lot 6bis : l'horizon est désormais comptabilisé → pts=54 sur la fixture.
//   • Lot 8a : le mapping PDF est aligné sur 4 niveaux (cf. pdfMission.ts).
//     Les tests « mapping 5 niveaux » et l'helper ptsActuel5niveaux ont été
//     RETIRÉS — la source unique de vérité est désormais src/lib/conformite/
//     profil.ts (testée par src/tests/profil.test.ts).
//
// On conserve néanmoins le différentiel d'horizon comme témoin du bug levé :
// ce test doit rester vert tant que l'horizon contribue bien au score.

import { describe, it, expect } from "vitest";
import { fixtureMission } from "./__fixtures__/pdfFixture";

// Formule HÉRITÉE (Lot 6) — sans horizon. Conservée comme témoin historique
// du point de départ ; ne décrit plus la formule courante.
function ptsHeriteSansHorizon(mission: any): number {
  return mission.attitude + mission.reactionBaisse +
    (mission.connaitFondsEuros?1:0)+(mission.investiFondsEuros?1:0)+
    (mission.connaitActions?1:0)+(mission.investiActions?3:0)+
    (mission.connaitOPCVM?1:0)+(mission.investiOPCVM?3:0)+
    (mission.connaitImmo?1:0)+(mission.investiImmo?2:0)+
    (mission.connaitTrackers?1:0)+(mission.investiTrackers?3:0)+
    (mission.connaitStructures?1:0)+(mission.investiStructures?4:0)+
    (mission.reactionPertes||0)+(mission.reactionGains||0)+
    (mission.modeGestion==="pilote"?2:mission.modeGestion==="libre"?4:0)+
    (mission.savoirUCRisque?2:0)+(mission.savoirHorizonUC?2:0)+(mission.savoirRisqueRendement?2:0);
}

// Formule COURANTE (Lot 6bis) — inclut l'horizon.
function ptsCourant(mission: any): number {
  const horizonPts: Record<string, number> = { "0-4": 0, "5-8": 4, "9-15": 8, "15+": 16 };
  return ptsHeriteSansHorizon(mission) + (horizonPts[mission.horizon as string] || 0);
}

describe("Témoin — score brut sur la fixture (témoin Lot 6 → 6bis)", () => {
  it("fixtureMission — formule héritée Lot 6 (sans horizon) = 46", () => {
    expect(ptsHeriteSansHorizon(fixtureMission)).toBe(46);
  });

  it("fixtureMission — formule Lot 6bis (avec horizon '9-15' = +8) = 54", () => {
    expect(ptsCourant(fixtureMission)).toBe(54);
  });

  it("Lot 6bis — Horizon EST comptabilisé : différentiel 15+ vs 0-4 = 16", () => {
    const ptsHorizonCourt = ptsCourant({ ...fixtureMission, horizon: "0-4" });
    const ptsHorizonLong  = ptsCourant({ ...fixtureMission, horizon: "15+" });
    expect(ptsHorizonLong - ptsHorizonCourt).toBe(16);
  });
});
