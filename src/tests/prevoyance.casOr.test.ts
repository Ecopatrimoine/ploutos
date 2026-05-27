// ─── Tests cas d'or — moteur de projection Prévoyance (Lot 5) ───────────
//
// 4 profils archétypaux issus de la spec §7.1 :
//   A — Mathieu, salarié cadre Syntec (CPAM, IDCC 1486)
//   B — Dr Lefèvre, médecin libéral CARMF (TNS, Madelin)
//   C — Léa, salariée non-cadre Métallurgie (CPAM, IDCC 3248)
//   D — Pierre, gérant majoritaire SSI (TNS, Madelin)
//
// Vu la majorité de TO_VERIFY dans les caisses (à remplir par David
// avant production), les assertions cas d'or sont calibrées comme
// suit (cf. décision Q3 « sanity checks d'abord ») :
//   - Transitions logiques STRICTES (carence respectée, fenêtres de
//     maintien, bascule J1095, fin de plafond IJ).
//   - Étages collectifs et individuels VALEURS PRÉCISES (lus de
//     l'entrée, donc déterministes).
//   - Étages obligatoires : vérification que = 0 quand caisse
//     TO_VERIFY + flag `donneesCaisseIndisponibles` levé.
//
// Au LOT futur où David aura rempli les valeurs caisses, plusieurs
// assertions seront durcies (= valeurs absolues) ; pour l'instant
// elles restent en `toBeGreaterThan` ou `toBeCloseTo` avec tolérance.

import { describe, expect, it } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

// Helper : index d'un jour donné sur l'axe (= -1 si absent).
function idxJour(axe: ReturnType<typeof projeterArretMaladie>["axe"], j: number): number {
  return axe.findIndex((p) => p.jour === j);
}

// Somme verticale de tous les étages au point i (= revenu mensuel à t).
function totalAtIdx(s: ReturnType<typeof projeterArretMaladie>["series"], i: number): number {
  return (
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i]
  );
}

// ────────────────────────────────────────────────────────────────────
// Cas A — Mathieu, salarié cadre Syntec
// ────────────────────────────────────────────────────────────────────

const casA: EntreePerso = {
  age: 35,
  ageRetraite: 64,
  statutPro: "salarie_cadre",
  caisse: "CPAM",
  idccCCN: "1486",
  ancienneteMois: 48,
  salaireBrutAnnuel: 55000,
  salaireNetMensuel: 3575,
  contratsIndividuels: [],
  couvertureCollective: {
    ij: { pctSalaire: 0.80, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" },
    invalidite: {
      cat1: { pctSalaire: 0.40 },
      cat2: { pctSalaire: 0.80 },
      cat3: { pctSalaire: 1.0 },
    },
    capitalDeces: { montant: 55000, baseFormule: "100% T1+T2" },
  },
};

describe("Cas d'or A — Mathieu, salarié cadre Syntec (CPAM / IDCC 1486)", () => {
  const r = projeterArretMaladie(casA, "cat2", referentiels);

  it("revenu de référence = salaire net mensuel saisi (3575 €)", () => {
    expect(r.revenuReferenceMensuel).toBe(3575);
  });

  it("bascule invalidité présente à J1095", () => {
    expect(r.basculeInvaliditeJour).toBe(1095);
    expect(r.rupturesCles.some((rc) => rc.type === "bascule_invalidite")).toBe(true);
  });

  it("Syntec actuellement TO_VERIFY → fallback maintien légal (useLegalDefault=true)", () => {
    expect(r.useLegalDefault).toBe(true);
  });

  it("CPAM avec tauxBrut numérique → IJ obligatoire calculée même sans plafondJournalier renseigné", () => {
    // tauxBrut=0.5 + carenceJours=3 sont numériques dans le ref ;
    // plafondJournalier=TO_VERIFY ne bloque pas le calcul (sans plafond).
    // IJ_obl mensuel ≈ (brut/360) × 0.5 × 30 = brut × (5/120) = 55000 × 5/120 ÷ 12 × 30 / 30
    // Plus simplement : IJ_obl = (55000 / 360) × 0.5 × 30 = 2291,67 €/mois.
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijObligatoire[j30]).toBeCloseTo((55000 / 360) * 0.5 * 30, 0);
    // Pas de flag indisponible pour cas A : CPAM a tout ce qu'il faut.
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });

  it("maintien Mensualisation actif entre J7 (fin carence) et J67 (palier 12 mois)", () => {
    const j7 = idxJour(r.axe, 7);
    const j60 = idxJour(r.axe, 60);
    const j90 = idxJour(r.axe, 90);
    expect(r.series.maintienEmployeur[j7]).toBeGreaterThan(0);
    expect(r.series.maintienEmployeur[j60]).toBeGreaterThan(0);
    // Fin de palier 12 mois à J67 → à J90 le maintien est terminé.
    expect(r.series.maintienEmployeur[j90]).toBe(0);
  });

  it("complémentaire collective Syntec activée après franchise 90j (= J90)", () => {
    const j60 = idxJour(r.axe, 60);
    const j90 = idxJour(r.axe, 90);
    expect(r.series.ijComplementaireCollective[j60]).toBe(0); // avant franchise
    expect(r.series.ijComplementaireCollective[j90]).toBeGreaterThan(0);
  });

  it("rente invalidité collective cat2 = COMPLÉMENT à 80 % du brut (au-dessus de la pension obligatoire)", () => {
    const j1095 = idxJour(r.axe, 1095);
    const brutMensuel = 55000 / 12;
    // pension obl cat2 = brut × 0.5 = 2291,67 ; rente coll complète
    // jusqu'à brut × 0.8 = 3666,67 → rente coll = brut × 0.3 = 1375 €
    const pensionObl = brutMensuel * 0.5;
    const cible80 = brutMensuel * 0.8;
    expect(r.series.renteInvalCollective[j1095]).toBeCloseTo(cible80 - pensionObl, 0);
  });

  it("revenu total à J180 (compl. Syntec activée) ≈ 80 % du brut mensuel", () => {
    const j180 = idxJour(r.axe, 180);
    const brutMensuel = 55000 / 12;
    // maintien=0 (fin J67), IJ_obl + IJ_coll = brut × 0.8 (par construction
    // de la complémentaire qui complète jusqu'à pctSalaire).
    expect(totalAtIdx(r.series, j180)).toBeCloseTo(brutMensuel * 0.8, 0);
  });

  it("revenu total à J1095 (invalidité cat2) ≈ 80 % du brut mensuel", () => {
    const j1095 = idxJour(r.axe, 1095);
    const brutMensuel = 55000 / 12;
    expect(totalAtIdx(r.series, j1095)).toBeCloseTo(brutMensuel * 0.8, 0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Cas B — Dr Lefèvre, médecin libéral CARMF
// ────────────────────────────────────────────────────────────────────

const casB: EntreePerso = {
  age: 48,
  ageRetraite: 64,
  statutPro: "tns_liberal",
  caisse: "CARMF",
  idccCCN: null,
  ancienneteMois: 0,
  salaireBrutAnnuel: 0,
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 95000,
  classeCotisationCaisse: "B",
  contratsIndividuels: [
    { id: "madelin_ij",  type: "ij",            capitalOuMontant: 250,    franchiseJours: 90, plafondJoursIJ: 1095 },
    { id: "madelin_inv", type: "invalidite",    capitalOuMontant: 0,      baseInvalidite: 0.5 },
    { id: "madelin_dc",  type: "deces_capital", capitalOuMontant: 200000 },
  ],
  couvertureCollective: null,
};

describe("Cas d'or B — Dr Lefèvre, médecin libéral CARMF (TNS, Madelin)", () => {
  const r = projeterArretMaladie(casB, "cat2", referentiels);

  it("revenu de référence ≈ TNS mensuel (95 000 / 12)", () => {
    expect(r.revenuReferenceMensuel).toBeCloseTo(95000 / 12, 0);
  });

  it("J0–J89 : revenus à zéro (carence CARMF 90 j + franchise Madelin 90 j) — TROU PÉDAGOGIQUE", () => {
    for (const j of [0, 30, 60]) {
      const i = idxJour(r.axe, j);
      expect(totalAtIdx(r.series, i)).toBe(0);
    }
  });

  it("Madelin IJ activé à J90 = 250 €/j × 30 = 7500 €/mois", () => {
    const j90 = idxJour(r.axe, 90);
    expect(r.series.ijComplementaireIndividuelle[j90]).toBe(7500);
  });

  it("Madelin IJ encore actif à J180 (plafond 1095 jours non atteint)", () => {
    const j180 = idxJour(r.axe, 180);
    expect(r.series.ijComplementaireIndividuelle[j180]).toBe(7500);
  });

  it("bascule invalidité à J1095 + rente Madelin 50 % × TNS mensuel", () => {
    const j1095 = idxJour(r.axe, 1095);
    const tnsMensuel = 95000 / 12;
    expect(r.series.renteInvalIndividuelle[j1095]).toBeCloseTo(tnsMensuel * 0.5, 0);
  });

  it("CARMF TO_VERIFY → IJ obligatoire et pension invalidité à 0 + flag levé", () => {
    expect(r.donneesCaisseIndisponibles).toBe(true);
    for (const v of r.series.ijObligatoire) expect(v).toBe(0);
    for (const v of r.series.pensionInvalObligatoire) expect(v).toBe(0);
  });

  it("pas d'IDCC (TNS) → useLegalDefault=false", () => {
    expect(r.useLegalDefault).toBe(false);
  });

  it("aucun maintien employeur (TNS pur)", () => {
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Cas C — Léa, salariée non-cadre Métallurgie
// ────────────────────────────────────────────────────────────────────

const casC: EntreePerso = {
  age: 28,
  ageRetraite: 64,
  statutPro: "salarie_non_cadre",
  caisse: "CPAM",
  idccCCN: "3248",
  ancienneteMois: 12,
  salaireBrutAnnuel: 28000,
  salaireNetMensuel: 1820,
  contratsIndividuels: [],
  couvertureCollective: null,
};

describe("Cas d'or C — Léa, salariée non-cadre Métallurgie (CPAM / IDCC 3248)", () => {
  const r = projeterArretMaladie(casC, "cat2", referentiels);

  it("revenu de référence = salaire net mensuel saisi (1820 €)", () => {
    expect(r.revenuReferenceMensuel).toBe(1820);
  });

  it("aucune couverture collective → IJ et rente invalidité collectives = 0 partout", () => {
    for (const v of r.series.ijComplementaireCollective) expect(v).toBe(0);
    for (const v of r.series.renteInvalCollective) expect(v).toBe(0);
  });

  it("3248 TO_FILL → fallback maintien légal Mensualisation (useLegalDefault=true)", () => {
    expect(r.useLegalDefault).toBe(true);
  });

  it("ancienneté 12 mois → palier 1 (carence 7 + 30 j à 90 % + 30 j à 66,66 %)", () => {
    const j7 = idxJour(r.axe, 7);
    const j14 = idxJour(r.axe, 14);
    const j30 = idxJour(r.axe, 30);
    const j60 = idxJour(r.axe, 60);
    const j90 = idxJour(r.axe, 90);
    // J7-J37 : maintien 90% actif
    expect(r.series.maintienEmployeur[j7]).toBeGreaterThan(0);
    expect(r.series.maintienEmployeur[j14]).toBeGreaterThan(0);
    expect(r.series.maintienEmployeur[j30]).toBeGreaterThan(0);
    // J37-J67 : maintien 66.66% actif (mais inférieur à 90%)
    expect(r.series.maintienEmployeur[j60]).toBeGreaterThan(0);
    expect(r.series.maintienEmployeur[j60]).toBeLessThan(r.series.maintienEmployeur[j30]);
    // J90 : fin du maintien
    expect(r.series.maintienEmployeur[j90]).toBe(0);
  });

  it("exposition après J67 = IJSS seules (pas de coll/ind), revenu très inférieur au net", () => {
    const j180 = idxJour(r.axe, 180);
    const brutMensuel = 28000 / 12;
    // IJSS seules = brut × 0.5 × 30/360 par jour calendaire → IJ mensuelle
    // = brut × 0.5 × (30/30) = brut × 0.5 si on saisit le calcul mensuel direct.
    // Formule exacte du moteur : (brut_annuel / 360) × tauxBrut × 30
    const ijObligEstime = (28000 / 360) * 0.5 * 30;
    expect(r.series.ijObligatoire[idxJour(r.axe, 180)]).toBeCloseTo(ijObligEstime, 0);
    expect(r.series.ijComplementaireCollective[j180]).toBe(0);
    expect(r.series.ijComplementaireIndividuelle[j180]).toBe(0);
    // Total très inférieur au net mensuel (1820) : c'est l'exposition.
    expect(totalAtIdx(r.series, j180)).toBeLessThan(1820);
    // Approximation : IJSS seules ≈ 50 % du brut sans plafond
    expect(totalAtIdx(r.series, j180)).toBeCloseTo(brutMensuel * 0.5, 0);
  });

  it("bascule invalidité à J1095 : pension obligatoire cat2 ≈ 50 % du brut, aucune coll/ind", () => {
    const j1095 = idxJour(r.axe, 1095);
    const brutMensuel = 28000 / 12;
    expect(r.series.pensionInvalObligatoire[j1095]).toBeCloseTo(brutMensuel * 0.5, 0);
    expect(r.series.renteInvalCollective[j1095]).toBe(0);
    expect(r.series.renteInvalIndividuelle[j1095]).toBe(0);
    // CPAM cat2 a tauxBase=0.5 numérique → pas de flag indisponible pour cas C.
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });

  it("rupture 'fin_maintien_100' (ici 90 %) est présente vers J37", () => {
    const rupture = r.rupturesCles.find((rc) => rc.type === "fin_maintien_100");
    expect(rupture).toBeDefined();
    expect(rupture?.jour).toBe(7 + 30); // carence légale 7 + 30 jours du palier 12 mois
  });
});

// ────────────────────────────────────────────────────────────────────
// Cas D — Pierre, gérant majoritaire SSI
// ────────────────────────────────────────────────────────────────────

const casD: EntreePerso = {
  age: 52,
  ageRetraite: 64,
  statutPro: "gerant_majoritaire",
  caisse: "SSI",
  idccCCN: null,
  ancienneteMois: 0,
  salaireBrutAnnuel: 0,
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 60000,
  contratsIndividuels: [
    { id: "madelin_ij",  type: "ij",             capitalOuMontant: 120, franchiseJours: 30, plafondJoursIJ: 1095 },
    { id: "madelin_inv", type: "invalidite",     capitalOuMontant: 0,   baseInvalidite: 0.6 },
    { id: "madelin_dc",  type: "deces_capital",  capitalOuMontant: 300000 },
    { id: "madelin_rc",  type: "deces_rente_conj", capitalOuMontant: 1500 },
  ],
  couvertureCollective: null,
};

describe("Cas d'or D — Pierre, gérant majoritaire SSI (TNS, Madelin)", () => {
  const r = projeterArretMaladie(casD, "cat2", referentiels);

  it("revenu de référence ≈ TNS mensuel (60 000 / 12 = 5000 €)", () => {
    expect(r.revenuReferenceMensuel).toBeCloseTo(5000, 0);
  });

  it("J0–J2 : revenus à zéro (carence SSI 3 j + franchise Madelin 30 j)", () => {
    for (const j of [0]) {
      const i = idxJour(r.axe, j);
      expect(totalAtIdx(r.series, i)).toBe(0);
    }
  });

  it("Madelin IJ activé à J30 = 120 €/j × 30 = 3600 €/mois", () => {
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijComplementaireIndividuelle[j30]).toBe(3600);
  });

  it("Madelin IJ encore actif à J365 (avant plafond 1095 j)", () => {
    const j365 = idxJour(r.axe, 365);
    expect(r.series.ijComplementaireIndividuelle[j365]).toBe(3600);
  });

  it("bascule invalidité à J1095 + rente Madelin 60 % × TNS mensuel = 3000 €", () => {
    const j1095 = idxJour(r.axe, 1095);
    expect(r.series.renteInvalIndividuelle[j1095]).toBeCloseTo(5000 * 0.6, 0);
  });

  it("SSI TO_VERIFY → IJ obligatoire et pension invalidité à 0 + flag levé", () => {
    expect(r.donneesCaisseIndisponibles).toBe(true);
    for (const v of r.series.ijObligatoire) expect(v).toBe(0);
    for (const v of r.series.pensionInvalObligatoire) expect(v).toBe(0);
  });

  it("pas de couverture collective (TNS) → étages collectifs à 0", () => {
    for (const v of r.series.ijComplementaireCollective) expect(v).toBe(0);
    for (const v of r.series.renteInvalCollective) expect(v).toBe(0);
  });

  it("aucun maintien employeur (TNS pur)", () => {
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Tests de robustesse complémentaires (au-delà de projection.test.ts)
// ────────────────────────────────────────────────────────────────────

describe("Robustesse — variations sur cas A", () => {
  it("cat3 : rente coll cat3 = COMPLÉMENT à 100 % du brut (au-dessus de la pension obligatoire)", () => {
    const r = projeterArretMaladie(casA, "cat3", referentiels);
    const j1095 = idxJour(r.axe, 1095);
    const brutMensuel = 55000 / 12;
    // Pension obligatoire cat3 = brut × 0.5 (tauxBase cat3 dans le ref) ;
    // rente coll cat3 complète jusqu'à brut × 1.0 → rente = brut × 0.5.
    const pensionObl = brutMensuel * 0.5;
    const cible100 = brutMensuel * 1.0;
    expect(r.series.renteInvalCollective[j1095]).toBeCloseTo(cible100 - pensionObl, 0);
    expect(r.categorieInvaliditeProjetee).toBe("cat3");
  });

  it("cumul de 2 contrats IJ individuels — sommation correcte", () => {
    const r = projeterArretMaladie(
      {
        ...casA,
        contratsIndividuels: [
          { id: "ij1", type: "ij", capitalOuMontant: 50,  franchiseJours: 30, plafondJoursIJ: 1095 },
          { id: "ij2", type: "ij", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 },
        ],
      },
      "cat2",
      referentiels
    );
    const j60 = idxJour(r.axe, 60);
    // Deux contrats actifs, total = (50 + 100) × 30 = 4500
    expect(r.series.ijComplementaireIndividuelle[j60]).toBe(4500);
  });

  it("contrat IJ sans franchise (par défaut 0) actif dès J0", () => {
    const r = projeterArretMaladie(
      {
        ...casA,
        contratsIndividuels: [
          { id: "ij1", type: "ij", capitalOuMontant: 50, plafondJoursIJ: 1095 },
        ],
      },
      "cat2",
      referentiels
    );
    const j0 = idxJour(r.axe, 0);
    expect(r.series.ijComplementaireIndividuelle[j0]).toBe(50 * 30);
  });

  it("contrat IJ avec plafond atteint → étage retombe à 0 au-delà", () => {
    const r = projeterArretMaladie(
      {
        ...casA,
        contratsIndividuels: [
          { id: "ij1", type: "ij", capitalOuMontant: 50, franchiseJours: 30, plafondJoursIJ: 60 },
        ],
      },
      "cat2",
      referentiels
    );
    // Actif sur fenêtre [J30, J90] (= franchise + plafond), à J120 c'est terminé.
    const j60 = idxJour(r.axe, 60);
    const j120 = idxJour(r.axe, 120);
    expect(r.series.ijComplementaireIndividuelle[j60]).toBe(1500);
    expect(r.series.ijComplementaireIndividuelle[j120]).toBe(0);
  });

  it("ancienneté 200 mois (palier 132 mois — Mensualisation) → maintien plus long", () => {
    const rPetit = projeterArretMaladie(
      { ...casA, ancienneteMois: 12 },
      "cat2",
      referentiels
    );
    const rGros = projeterArretMaladie(
      { ...casA, ancienneteMois: 200 },
      "cat2",
      referentiels
    );
    // Sommer la durée totale où le maintien est > 0
    const cumulPetit = rPetit.series.maintienEmployeur.filter((v) => v > 0).length;
    const cumulGros = rGros.series.maintienEmployeur.filter((v) => v > 0).length;
    // Plus l'ancienneté est élevée, plus le maintien dure (en nombre de
    // points de l'axe où il est > 0). On vérifie la monotonie.
    expect(cumulGros).toBeGreaterThanOrEqual(cumulPetit);
  });
});
