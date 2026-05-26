// ─── Lot 6 → 6bis — Filet de caractérisation du scoring profil ─────────────
//
// Lot 6 : capture du statu quo avant la bascule 5→4 niveaux et l'ajout du
// sous-score ESG. Les helpers `ptsActuel5niveaux` et `profilActuel5` sont
// gardés comme témoins de la formule pré-bascule, pour documenter la
// fusion Sécuritaire→prudent.
//
// Lot 6bis : la formule de scoring AJOUTE désormais l'horizon (bloc qui
// était auparavant saisi à l'écran mais jamais comptabilisé — bug latent
// figé puis levé). Le test « Horizon n'est PAS comptabilisé » a été REMPLACÉ
// par son contraire : « Horizon EST comptabilisé ».
//
// Les tests dupliquent volontairement les formules pour rester indépendants
// du code de production : si le scoring change un jour, ce fichier devra
// être mis à jour explicitement.

import { describe, it, expect } from "vitest";
import { fixtureMission } from "./__fixtures__/pdfFixture";

// ─── Formule HÉRITÉE (Lot 6 et avant) — n'inclut PAS l'horizon ─────────────
//     Gardée comme témoin de la fusion 5→4 niveaux. Ne décrit plus la
//     formule courante (cf. ptsCourant ci-dessous, Lot 6bis).
function ptsActuel5niveaux(mission: any): number {
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

// ─── Formule COURANTE (Lot 6bis) — inclut l'horizon ──────────────────────
function ptsCourant(mission: any): number {
  const horizonPts: Record<string, number> = { "0-4": 0, "5-8": 4, "9-15": 8, "15+": 16 };
  return ptsActuel5niveaux(mission) + (horizonPts[mission.horizon as string] || 0);
}

// Mapping ACTUEL à 5 niveaux (à figer pour comparaison future).
function profilActuel5(pts: number): string {
  return pts<=10?"Sécuritaire":pts<=20?"Prudent":pts<=40?"Équilibré":pts<=60?"Dynamique":"Offensif";
}

// Mapping CIBLE à 4 niveaux du Lot 6 (Sécuritaire est absorbé dans Prudent).
function profilCible4(pts: number): string {
  return pts<=20?"prudent":pts<=40?"équilibré":pts<=60?"dynamique":"offensif";
}

describe("Lot 6 → 6bis — caractérisation : score brut sur la fixture", () => {
  it("fixtureMission — formule héritée (sans horizon) = 46 (témoin)", () => {
    expect(ptsActuel5niveaux(fixtureMission)).toBe(46);
  });

  it("fixtureMission — formule Lot 6bis (avec horizon '9-15' = +8) = 54", () => {
    expect(ptsCourant(fixtureMission)).toBe(54);
  });

  it("Lot 6bis — Horizon EST désormais comptabilisé dans pts (bug levé)", () => {
    const ptsHorizonCourt = ptsCourant({ ...fixtureMission, horizon: "0-4" });
    const ptsHorizonLong  = ptsCourant({ ...fixtureMission, horizon: "15+" });
    // Différence attendue = max - min = 16 - 0 = 16.
    expect(ptsHorizonLong - ptsHorizonCourt).toBe(16);
  });
});

describe("Lot 6 — caractérisation : mapping à 5 niveaux (statu quo)", () => {
  it("pts = 0 → Sécuritaire", () => { expect(profilActuel5(0)).toBe("Sécuritaire"); });
  it("pts = 10 → Sécuritaire (borne haute)", () => { expect(profilActuel5(10)).toBe("Sécuritaire"); });
  it("pts = 11 → Prudent", () => { expect(profilActuel5(11)).toBe("Prudent"); });
  it("pts = 20 → Prudent (borne haute)", () => { expect(profilActuel5(20)).toBe("Prudent"); });
  it("pts = 21 → Équilibré", () => { expect(profilActuel5(21)).toBe("Équilibré"); });
  it("pts = 40 → Équilibré (borne haute)", () => { expect(profilActuel5(40)).toBe("Équilibré"); });
  it("pts = 41 → Dynamique", () => { expect(profilActuel5(41)).toBe("Dynamique"); });
  it("pts = 46 (fixture) → Dynamique", () => { expect(profilActuel5(46)).toBe("Dynamique"); });
  it("pts = 60 → Dynamique (borne haute)", () => { expect(profilActuel5(60)).toBe("Dynamique"); });
  it("pts = 61 → Offensif", () => { expect(profilActuel5(61)).toBe("Offensif"); });
  it("pts = 80 (max théorique) → Offensif", () => { expect(profilActuel5(80)).toBe("Offensif"); });
});

describe("Lot 6 — invariant clef : passage 5→4 niveaux conserve le label sur la fixture", () => {
  it("fixture pts=46 : 5 niveaux → 'Dynamique' / 4 niveaux → 'dynamique' (même catégorie)", () => {
    const pts = ptsActuel5niveaux(fixtureMission);
    expect(profilActuel5(pts).toLowerCase()).toBe(profilCible4(pts));
  });

  it("pts dans (20;40] : Équilibré (5) ↔ équilibré (4)", () => {
    for (const p of [21, 30, 40]) {
      expect(profilActuel5(p).toLowerCase()).toBe(profilCible4(p));
    }
  });

  it("pts dans (40;60] : Dynamique (5) ↔ dynamique (4)", () => {
    for (const p of [41, 50, 60]) {
      expect(profilActuel5(p).toLowerCase()).toBe(profilCible4(p));
    }
  });

  it("pts > 60 : Offensif (5) ↔ offensif (4)", () => {
    for (const p of [61, 70, 80]) {
      expect(profilActuel5(p).toLowerCase()).toBe(profilCible4(p));
    }
  });

  it("pts ≤ 10 : Sécuritaire (5) est absorbé dans prudent (4) — fusion documentée", () => {
    for (const p of [0, 5, 10]) {
      expect(profilActuel5(p)).toBe("Sécuritaire");
      expect(profilCible4(p)).toBe("prudent");
    }
  });

  it("pts dans (10;20] : Prudent (5) ↔ prudent (4) — inchangé", () => {
    for (const p of [11, 15, 20]) {
      expect(profilActuel5(p).toLowerCase()).toBe(profilCible4(p));
    }
  });
});
