// ─── Lot 6 — Filet de caractérisation du scoring profil investisseur ────────
//
// Capture du STATU QUO avant la bascule du profil à 4 niveaux et l'ajout du
// sous-score ESG. Ce fichier sert de TÉMOIN pour :
//   1. documenter la formule actuelle de calcul de `pts` (dupliquée à
//      l'identique dans TabMission.tsx:316 et pdfMission.ts:80) ;
//   2. figer le mapping à 5 niveaux qui sera remplacé par 4 niveaux côté
//      écran (le PDF reste à 5 niveaux jusqu'au Lot 8 — refonte dédiée) ;
//   3. prouver l'invariant clef du Lot 6 : à réponses de risque identiques,
//      le label de profil ne change pas (la fixture pts=46 reste "Dynamique"
//      après bascule 5→4 niveaux).
//
// Les tests sont écrits SANS dépendance au code de production : ils
// dupliquent volontairement la formule pour figer l'état d'avant. Si le
// scoring change un jour, ce fichier devra être mis à jour explicitement.

import { describe, it, expect } from "vitest";
import { fixtureMission } from "./__fixtures__/pdfFixture";

// ─── Formule de scoring actuel (copie EXACTE de TabMission.tsx:305-315
//     et pdfMission.ts:70-79 — les deux sont strictement identiques) ──────────
function ptsActuel(mission: any): number {
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

// Mapping ACTUEL à 5 niveaux (à figer pour comparaison future).
function profilActuel5(pts: number): string {
  return pts<=10?"Sécuritaire":pts<=20?"Prudent":pts<=40?"Équilibré":pts<=60?"Dynamique":"Offensif";
}

// Mapping CIBLE à 4 niveaux du Lot 6 (Sécuritaire est absorbé dans Prudent).
function profilCible4(pts: number): string {
  return pts<=20?"prudent":pts<=40?"équilibré":pts<=60?"dynamique":"offensif";
}

describe("Lot 6 — caractérisation : score brut sur la fixture", () => {
  it("fixtureMission produit pts = 46 (figé)", () => {
    expect(ptsActuel(fixtureMission)).toBe(46);
  });

  it("Horizon n'est PAS comptabilisé dans pts (bug latent documenté, hors périmètre Lot 6)", () => {
    // Modifier horizon ne doit pas changer pts avec la formule actuelle.
    const ptsAvec = ptsActuel({ ...fixtureMission, horizon: "15+" });
    const ptsSans = ptsActuel({ ...fixtureMission, horizon: "0-4" });
    expect(ptsAvec).toBe(ptsSans);
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
    const pts = ptsActuel(fixtureMission);
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
