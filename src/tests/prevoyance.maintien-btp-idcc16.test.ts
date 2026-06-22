// ─── LOT #4 — Maintien employeur conventionnel : BTP (7 IDCC) + Transports 16 ──
//
// DATA PURE : ce lot pose les paliers de maintien dans ccn-2026.json. Aucun
// changement moteur (le schema { ancienneteMois, carenceJours bucket, segments }
// encaisse deja, cf RECON_MAINTIEN_22juin2026.md). Ces tests valident la DONNEE :
//   A. integrite des paliers poses (deterministe) ;
//   B. taux CCN aux jours annonces + ancrage sur le moteur reel (taux effectif
//      recupere depuis series.maintienEmployeur) ;
//   C. carence (anti-sur-estimation) ;
//   D. garde-fou plancher legal : le maintien reel >= maintien legal partout.
//
// BTP = mono-college : la MEME valeur est posee dans cadres ET nonCadres du meme
// IDCC (getMaintienParams route par categorieMaintien(statutPro), qui ignore
// collegeImpose). IDCC 16 = multi-college (cadres != nonCadres).
//
// NOTE DE DIVERGENCE (surfacee au lot, non corrigee en aveugle) : la consigne
// annoncait "IDCC16 cadres anc 48 mois, jour 70 : 100pct". Or le palier cadres
// retenu a 48 mois est le palier 36 (60 j a 100 % puis 60 j a 75 %) : la fenetre
// 100 % court J0-J60, donc a J70 le taux conventionnel est 75 %, pas 100 %. Le
// test asserte la valeur REELLE de la donnee posee (J70 = 75 %) et prouve la
// fenetre 100 % a J50. Cf rapport de lot.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie, getMaintienParams } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

type Cat = "cadres" | "nonCadres";

// ── Re-implementation locale du segment-walk (pattern plancher-legal.test.ts) ──
// Reproduit la lecture documentee de projection.ts (findPalierMaintien +
// tauxMaintienJour) pour evaluer le taux a un jour QUELCONQUE (les jours annonces
// 10/20/50/70/100 ne sont pas tous des points d'axe). Tie-back au moteur reel
// assure par le bloc B2 (taux effectif recupere depuis la projection).
type Params = ReturnType<typeof getMaintienParams>;

function findPalier(params: Params, anc: number) {
  let best: Params["paliers"][number] | null = null;
  for (const p of params.paliers) {
    if (anc >= p.ancienneteMois && (!best || p.ancienneteMois > best.ancienneteMois)) best = p;
  }
  return best;
}

function tauxJour(params: Params, anc: number, t: number): number {
  const pal = findPalier(params, anc);
  if (!pal || t < params.carenceJours) return 0;
  let tEff = t - params.carenceJours;
  let deb = 0;
  for (const s of pal.segments) {
    if (tEff < deb + s.jours) return s.pct / 100;
    deb += s.jours;
  }
  return 0;
}

const ccnParams = (idcc: string, cat: Cat) => getMaintienParams(idcc, referentiels, cat);
const legalParams = (cat: Cat) => getMaintienParams(null, referentiels, cat);

// Taux CCN seul (la donnee posee).
const tauxCcn = (idcc: string, cat: Cat, anc: number, t: number) => tauxJour(ccnParams(idcc, cat), anc, t);
// Taux LEGAL seul (Mensualisation, plancher d'ordre public).
const tauxLegal = (cat: Cat, anc: number, t: number) => tauxJour(legalParams(cat), anc, t);
// Taux EFFECTIF = max(CCN, legal) jour par jour (comme tauxMaintienEffectif).
const tauxEff = (idcc: string, cat: Cat, anc: number, t: number) =>
  Math.max(tauxCcn(idcc, cat, anc, t), tauxLegal(cat, anc, t));

function baseEntree(over: Partial<EntreePerso>): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 30000,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

// Les 4 dossiers de controle (salaire + anciennete fixes).
const D = {
  etam2609: baseEntree({ statutPro: "salarie_non_cadre", idccCCN: "2609", ancienneteMois: 24, salaireBrutAnnuel: 32000 }),
  ouv1597: baseEntree({ statutPro: "salarie_non_cadre", idccCCN: "1597", ancienneteMois: 24, salaireBrutAnnuel: 28000 }),
  trans16nc: baseEntree({ statutPro: "salarie_non_cadre", idccCCN: "16", ancienneteMois: 48, salaireBrutAnnuel: 30000 }),
  trans16cad: baseEntree({ statutPro: "salarie_cadre", idccCCN: "16", ancienneteMois: 48, salaireBrutAnnuel: 60000 }),
};

// ─────────────────────────────────────────────────────────────────────────────
// A. INTEGRITE DATA — paliers poses exactement
// ─────────────────────────────────────────────────────────────────────────────
describe("LOT #4 — A. integrite data (paliers poses)", () => {
  const conv = (idcc: string) => (referentiels.ccn as any).conventions[idcc].maintienEmployeur;

  it("BTP ouvriers 1597 : carence 3, palier unique 3 mois [45@100, 42@75], mono-college", () => {
    const m = conv("1597");
    const attendu = { carenceJours: 3, paliers: [{ ancienneteMois: 3, segments: [{ jours: 45, pct: 100 }, { jours: 42, pct: 75 }] }] };
    expect({ carenceJours: m.nonCadres.carenceJours, paliers: m.nonCadres.paliers }).toEqual(attendu);
    expect({ carenceJours: m.cadres.carenceJours, paliers: m.cadres.paliers }).toEqual(attendu);
  });

  it("BTP ETAM 2609 : carence 0, palier 12 mois [90@100], mono-college", () => {
    const m = conv("2609");
    const attendu = { carenceJours: 0, paliers: [{ ancienneteMois: 12, segments: [{ jours: 90, pct: 100 }] }] };
    expect({ carenceJours: m.nonCadres.carenceJours, paliers: m.nonCadres.paliers }).toEqual(attendu);
    expect({ carenceJours: m.cadres.carenceJours, paliers: m.cadres.paliers }).toEqual(attendu);
  });

  it("BTP cadres 2420 : carence 0, palier 12 mois [90@100], mono-college", () => {
    const m = conv("2420");
    const attendu = { carenceJours: 0, paliers: [{ ancienneteMois: 12, segments: [{ jours: 90, pct: 100 }] }] };
    expect({ carenceJours: m.cadres.carenceJours, paliers: m.cadres.paliers }).toEqual(attendu);
    expect({ carenceJours: m.nonCadres.carenceJours, paliers: m.nonCadres.paliers }).toEqual(attendu);
  });

  it("Transports 16 : nonCadres carence 5 + cadres carence 0, 3 paliers chacun (multi-college)", () => {
    const m = conv("16");
    expect(m.nonCadres.carenceJours).toBe(5);
    expect(m.nonCadres.paliers).toEqual([
      { ancienneteMois: 36, segments: [{ jours: 30, pct: 100 }, { jours: 60, pct: 75 }] },
      { ancienneteMois: 60, segments: [{ jours: 60, pct: 100 }, { jours: 90, pct: 75 }] },
      { ancienneteMois: 120, segments: [{ jours: 90, pct: 100 }, { jours: 120, pct: 75 }] },
    ]);
    expect(m.cadres.carenceJours).toBe(0);
    expect(m.cadres.paliers).toEqual([
      { ancienneteMois: 36, segments: [{ jours: 60, pct: 100 }, { jours: 60, pct: 75 }] },
      { ancienneteMois: 60, segments: [{ jours: 90, pct: 100 }, { jours: 90, pct: 75 }] },
      { ancienneteMois: 120, segments: [{ jours: 120, pct: 100 }, { jours: 120, pct: 75 }] },
    ]);
  });

  it("source 'ccn' resolue pour les 4 dossiers (sortie du fallback legal)", () => {
    expect(ccnParams("2609", "nonCadres").source).toBe("ccn");
    expect(ccnParams("1597", "nonCadres").source).toBe("ccn");
    expect(ccnParams("16", "nonCadres").source).toBe("ccn");
    expect(ccnParams("16", "cadres").source).toBe("ccn");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. TAUX CCN aux jours annonces (niveau donnee)
// ─────────────────────────────────────────────────────────────────────────────
describe("LOT #4 — B. taux CCN aux jours annonces", () => {
  it("ETAM 2609, anc 24, J30 = 100%", () => {
    expect(tauxCcn("2609", "nonCadres", 24, 30)).toBe(1);
  });

  it("Ouvrier 1597, anc 24, J10 = 100% ; J60 = 75%", () => {
    expect(tauxCcn("1597", "nonCadres", 24, 10)).toBe(1);
    expect(tauxCcn("1597", "nonCadres", 24, 60)).toBe(0.75);
  });

  it("IDCC16 nonCadres, anc 48, J20 = 100% ; J60 = 75%", () => {
    expect(tauxCcn("16", "nonCadres", 48, 20)).toBe(1);
    expect(tauxCcn("16", "nonCadres", 48, 60)).toBe(0.75);
  });

  it("IDCC16 cadres, anc 48, J50 = 100% (fenetre J0-J60) ; J70 = 75% ; J100 = 75%", () => {
    // DIVERGENCE consigne : annonce J70=100% ; reel = 75% (palier 36 = 60 j @ 100%).
    expect(tauxCcn("16", "cadres", 48, 50)).toBe(1);
    expect(tauxCcn("16", "cadres", 48, 70)).toBe(0.75);
    expect(tauxCcn("16", "cadres", 48, 100)).toBe(0.75);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B2. ANCRAGE MOTEUR — taux effectif recupere depuis la projection reelle
//     taux_effectif(t) = (maintienEmployeur[t] + ijObligatoire[t]) / revenuRef,
//     valable tant que la cible n'est pas bornee a 0 (vrai a 75-100 %).
// ─────────────────────────────────────────────────────────────────────────────
describe("LOT #4 — B2. taux effectif via moteur (max CCN/legal) == reimpl", () => {
  const at = (r: ReturnType<typeof projeterArretMaladie>, jour: number) => r.axe.findIndex((p) => p.jour === jour);
  const tauxMoteur = (r: ReturnType<typeof projeterArretMaladie>, i: number) =>
    (r.series.maintienEmployeur[i] + r.series.ijObligatoire[i]) / r.revenuReferenceMensuel;

  const cas: Array<{ nom: string; e: EntreePerso; cat: Cat; jour: number; attendu: number }> = [
    { nom: "ETAM 2609 anc24 J30", e: D.etam2609, cat: "nonCadres", jour: 30, attendu: 1 },
    { nom: "Ouvrier 1597 anc24 J60", e: D.ouv1597, cat: "nonCadres", jour: 60, attendu: 0.75 },
    { nom: "IDCC16 nonCadres anc48 J60", e: D.trans16nc, cat: "nonCadres", jour: 60, attendu: 0.75 },
    { nom: "IDCC16 cadres anc48 J90", e: D.trans16cad, cat: "cadres", jour: 90, attendu: 0.75 },
  ];

  for (const c of cas) {
    it(`${c.nom} : taux moteur == reimpl == ${c.attendu}`, () => {
      const r = projeterArretMaladie(c.e, "cat2", referentiels);
      const i = at(r, c.jour);
      expect(i).toBeGreaterThan(-1);
      const moteur = tauxMoteur(r, i);
      expect(moteur).toBeCloseTo(c.attendu, 3);
      expect(moteur).toBeCloseTo(tauxEff(c.e.idccCCN!, c.cat, c.e.ancienneteMois, c.jour), 3);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// C. CARENCE (anti-sur-estimation)
// ─────────────────────────────────────────────────────────────────────────────
describe("LOT #4 — C. carence : contribution CCN nulle pendant la franchise", () => {
  it("Ouvrier 1597 J2 : CCN = 0 (carence 3) et effectif = 0 (legal en carence aussi), pas 100%", () => {
    expect(tauxCcn("1597", "nonCadres", 24, 2)).toBe(0);
    expect(tauxEff("1597", "nonCadres", 24, 2)).toBe(0);
  });

  it("IDCC16 nonCadres J3 : CCN = 0 (franchise 5) — donnee ET moteur", () => {
    expect(tauxCcn("16", "nonCadres", 48, 3)).toBe(0);
    expect(tauxEff("16", "nonCadres", 48, 3)).toBe(0);
    // Verification moteur : J3 est un point d'axe -> maintien servi nul.
    const r = projeterArretMaladie(D.trans16nc, "cat2", referentiels);
    const i = r.axe.findIndex((p) => p.jour === 3);
    expect(i).toBeGreaterThan(-1);
    expect(r.series.maintienEmployeur[i]).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. GARDE-FOU — maintien reel (CCN) >= maintien legal partout (moteur reel)
//    Compare le maintien servi par la projection au PLANCHER legal calcule
//    independamment (taux legal x ref - IJ obligatoire du meme jour).
// ─────────────────────────────────────────────────────────────────────────────
describe("LOT #4 — D. plancher legal jamais enfonce (4 dossiers)", () => {
  const cas: Array<{ nom: string; e: EntreePerso; cat: Cat }> = [
    { nom: "ETAM 2609", e: D.etam2609, cat: "nonCadres" },
    { nom: "Ouvrier 1597", e: D.ouv1597, cat: "nonCadres" },
    { nom: "IDCC16 nonCadres", e: D.trans16nc, cat: "nonCadres" },
    { nom: "IDCC16 cadres", e: D.trans16cad, cat: "cadres" },
  ];

  for (const c of cas) {
    it(`${c.nom} : maintien servi >= plancher legal en chaque point AM`, () => {
      const r = projeterArretMaladie(c.e, "cat2", referentiels);
      const ref = r.revenuReferenceMensuel;
      let vuStrict = false;
      for (let i = 0; i < r.axe.length; i++) {
        if (r.axe[i].phase !== "am") continue;
        const tl = tauxLegal(c.cat, c.e.ancienneteMois, r.axe[i].jour);
        const plancher = Math.max(0, tl * ref - r.series.ijObligatoire[i]);
        expect(r.series.maintienEmployeur[i]).toBeGreaterThanOrEqual(plancher - 0.01);
        // CCN strictement plus favorable quelque part (test non vacant).
        if (tauxCcn(c.e.idccCCN!, c.cat, c.e.ancienneteMois, r.axe[i].jour) > tl + 1e-9) vuStrict = true;
      }
      expect(vuStrict).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tableau de validation visuelle (gate step 3) — taux effectif aux jours testes.
// ─────────────────────────────────────────────────────────────────────────────
describe("LOT #4 — tableau taux de maintien effectif (validation visuelle)", () => {
  it("imprime le taux effectif (max CCN/legal) aux jours testes", () => {
    const lignes: Array<{ dossier: string; cat: Cat; idcc: string; anc: number; jours: number[] }> = [
      { dossier: "ETAM 2609", cat: "nonCadres", idcc: "2609", anc: 24, jours: [2, 10, 30, 60, 90] },
      { dossier: "Ouvrier 1597", cat: "nonCadres", idcc: "1597", anc: 24, jours: [2, 10, 30, 60, 90] },
      { dossier: "Transp16 NC", cat: "nonCadres", idcc: "16", anc: 48, jours: [3, 20, 60, 90, 120] },
      { dossier: "Transp16 CAD", cat: "cadres", idcc: "16", anc: 48, jours: [50, 70, 100, 120, 130] },
    ];
    const rows = lignes.map((l) => {
      const cells: Record<string, string> = { dossier: l.dossier, anc: `${l.anc}m` };
      for (const j of l.jours) cells[`J${j}`] = `${Math.round(tauxEff(l.idcc, l.cat, l.anc, j) * 100)}%`;
      return cells;
    });
    // eslint-disable-next-line no-console
    console.log("\n[LOT #4] Taux de maintien EFFECTIF (max CCN/legal) aux jours testes :");
    // eslint-disable-next-line no-console
    console.table(rows);
    expect(rows.length).toBe(4);
  });
});
