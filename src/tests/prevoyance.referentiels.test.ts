// ─── Tests référentiels Prévoyance (Lot 3) ─────────────────────────────
//
// Vérifie que les 3 fichiers JSON (PASS, caisses, CCN) chargent
// correctement via src/data/prevoyance/index.ts, que les structures
// minimales attendues par le moteur Lot 4 sont présentes, et que le
// millésime courant est cohérent avec dateVerification.

import { describe, expect, it } from "vitest";
import { CURRENT_YEAR, referentiels } from "../data/prevoyance";

describe("index.ts millésime", () => {
  it("CURRENT_YEAR vaut 2026", () => {
    expect(CURRENT_YEAR).toBe(2026);
  });

  it("expose les 3 référentiels chargés", () => {
    expect(referentiels.pass).toBeDefined();
    expect(referentiels.caisses).toBeDefined();
    expect(referentiels.ccn).toBeDefined();
  });
});

describe("pass-2026.json", () => {
  const p = referentiels.pass as any;

  it("a un millésime + une date de vérification ISO", () => {
    expect(p.millesime).toBe(2026);
    expect(typeof p.dateVerification).toBe("string");
    expect(p.dateVerification).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("expose un PASS annuel / mensuel / journalier / horaire numériques", () => {
    expect(typeof p.pass.annuel).toBe("number");
    expect(typeof p.pass.mensuel).toBe("number");
    expect(typeof p.pass.journalier).toBe("number");
    expect(typeof p.pass.horaire).toBe("number");
    expect(p.pass.annuel).toBeGreaterThan(0);
  });

  it("définit les tranches T1 et T2 cohérentes", () => {
    expect(p.tranches.T1.min).toBe(0);
    expect(p.tranches.T1.max).toBe(p.pass.annuel);
    expect(p.tranches.T2.min).toBe(p.pass.annuel);
    expect(p.tranches.T2.max).toBe(p.pass.annuel * 8);
  });

  it("expose un bloc IJSS (avec champs TO_VERIFY admis)", () => {
    expect(p.ijss).toBeDefined();
    expect(p.ijss.tauxIJ).toBe(0.5);
    expect(p.ijss.carenceJours).toBe(3);
  });

  it("liste au moins une source", () => {
    expect(Array.isArray(p.sources)).toBe(true);
    expect(p.sources.length).toBeGreaterThan(0);
  });
});

describe("caisses-2026.json", () => {
  const c = referentiels.caisses as any;

  it("a un millésime + une date de vérification ISO", () => {
    expect(c.millesime).toBe(2026);
    expect(c.dateVerification).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("expose les 13 caisses cibles", () => {
    const cibles = [
      "CPAM", "SSI", "MSA",
      "CARMF", "CARCDSF", "CARPV", "CARPIMKO", "CIPAV",
      "CNBF", "CAVOM", "CAVEC", "CAVAMAC", "CRN",
    ];
    for (const code of cibles) {
      expect(c.caisses[code], `caisse manquante : ${code}`).toBeDefined();
      expect(c.caisses[code].nom, `nom manquant : ${code}`).toBeTruthy();
    }
  });

  it("CPAM a une structure IJ + invalidité + capital décès", () => {
    const cpam = c.caisses.CPAM;
    expect(cpam.ij).toBeDefined();
    expect(cpam.ij.carenceJours).toBe(3);
    expect(cpam.invalidite).toBeDefined();
    expect(cpam.invalidite.categories.cat1).toBeDefined();
    expect(cpam.invalidite.categories.cat2).toBeDefined();
    expect(cpam.invalidite.categories.cat3).toBeDefined();
    expect(cpam.capitalDeces).toBeDefined();
  });

  it("CARMF est marquée comme caisse libérale avec carence longue (90j)", () => {
    expect(c.caisses.CARMF.ij.carenceJours).toBe(90);
  });

  it("liste au moins une source", () => {
    expect(Array.isArray(c.sources)).toBe(true);
    expect(c.sources.length).toBeGreaterThan(0);
  });
});

describe("ccn-2026.json", () => {
  const k = referentiels.ccn as any;

  it("a un millésime + une date de vérification ISO", () => {
    expect(k.millesime).toBe(2026);
    expect(k.dateVerification).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("expose le maintien légal Mensualisation (L.1226-1) avec 7 paliers", () => {
    expect(k.maintienLegal).toBeDefined();
    expect(k.maintienLegal.carenceJours).toBe(7);
    expect(Array.isArray(k.maintienLegal.paliers)).toBe(true);
    expect(k.maintienLegal.paliers.length).toBe(7);
    // Les paliers progressent : ancienneté croissante, jours croissants.
    const paliers = k.maintienLegal.paliers;
    for (let i = 1; i < paliers.length; i++) {
      expect(paliers[i].ancienneteMois).toBeGreaterThan(paliers[i - 1].ancienneteMois);
      expect(paliers[i].joursA90Pct).toBeGreaterThan(paliers[i - 1].joursA90Pct);
    }
  });

  it("expose les 10 IDCC Tranche 1 attendus", () => {
    const cibles = ["1486", "3248", "1979", "1597", "1596", "2609", "2420", "1996", "2216", "16"];
    for (const idcc of cibles) {
      expect(k.conventions[idcc], `IDCC manquant : ${idcc}`).toBeDefined();
      expect(k.conventions[idcc].nom, `nom CCN manquant : ${idcc}`).toBeTruthy();
      expect(k.conventions[idcc].idcc).toBe(idcc);
    }
  });

  it("Syntec (1486) impose le taux T1 cadres minimum de 1,50 %", () => {
    expect(k.conventions["1486"].prevoyanceCadres.tauxT1Minimum).toBe(1.5);
  });

  it("liste au moins une source", () => {
    expect(Array.isArray(k.sources)).toBe(true);
    expect(k.sources.length).toBeGreaterThan(0);
  });
});
