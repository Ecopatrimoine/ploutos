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
import {
  projeterArretMaladie,
  computeIJObligatoireJournaliere,
} from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
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

  it("revenu de référence = brut × coef cadre (0.75) / 12 (Décision B : brut prioritaire)", () => {
    // Mathieu a saisi brut 55000 ET net 3575. Décision B : le brut est
    // prioritaire (le coef estime le net depuis le brut). 55000×0.75/12 = 3437,5.
    expect(r.revenuReferenceMensuel).toBeCloseTo((55000 * 0.75) / 12, 2);
  });

  it("bascule invalidité présente à J1095", () => {
    expect(r.basculeInvaliditeJour).toBe(1095);
    expect(r.rupturesCles.some((rc) => rc.type === "bascule_invalidite")).toBe(true);
  });

  it("Syntec (1486) documenté → maintien CCN appliqué (useLegalDefault=false)", () => {
    expect(r.useLegalDefault).toBe(false);
  });

  it("CPAM : IJ obligatoire plafonnée à 41,95 €/j (×30 ≈ 1258,5 €/mois) car brut > 1,4 SMIC", () => {
    // Mathieu (brut 55 000 → 4583 €/mois) dépasse le plafond 1,4 SMIC
    // (2552,24 €) → SJB plafonné, IJ = 41,95 €/j, soit ≈ 1258,5 €/mois.
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijObligatoire[j30]).toBeCloseTo(41.95 * 30, 0);
    // Borne supérieure absolue (50 % du brut sans plafond) : l'IJ
    // plafonnée reste bien en dessous.
    const ijObligNonBornee = (55000 / 360) * 0.5 * 30;
    expect(r.series.ijObligatoire[j30]).toBeLessThan(ijObligNonBornee);
    // CPAM entièrement documenté → pas de flag indisponible.
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });

  it("maintien Syntec cadres : 100 % sur 90 jours (carence 0), terminé à J90", () => {
    const j7 = idxJour(r.axe, 7);
    const j60 = idxJour(r.axe, 60);
    const j90 = idxJour(r.axe, 90);
    // Syntec cadres : 90 j à 100 % dès 1 an, carence 0 → maintien complémentaire
    // (cible 100 % du revenu de référence − IJ obligatoire plafonnée ≈ 1258,5 €).
    expect(r.series.maintienEmployeur[j7]).toBeGreaterThan(0);
    // Même taux (100 %) à J7 et J60 : plus de marche 90 → 66,66 % (la CCN
    // domine le légal sur toute la fenêtre).
    expect(r.series.maintienEmployeur[j60]).toBeCloseTo(r.series.maintienEmployeur[j7], 2);
    // J90 : fin des 90 jours Syntec ; à l'ancienneté de Mathieu (48 mois) le
    // légal s'est arrêté avant (palier 12 mois → J67) → plus de maintien.
    expect(r.series.maintienEmployeur[j90]).toBe(0);
  });

  it("complémentaire collective Syntec activée après franchise 90j (= J90)", () => {
    const j60 = idxJour(r.axe, 60);
    const j90 = idxJour(r.axe, 90);
    expect(r.series.ijComplementaireCollective[j60]).toBe(0); // avant franchise
    expect(r.series.ijComplementaireCollective[j90]).toBeGreaterThan(0);
  });

  it("rente invalidité collective cat2 = COMPLÉMENT à 80 % du revenu de référence (au-dessus de la pension obligatoire)", () => {
    const j1095 = idxJour(r.axe, 1095);
    // LOT BRUT-NET-i : cible = 80 % du revenu de référence (plus du brut).
    const cible80 = r.revenuReferenceMensuel * 0.8;
    // Relation invariante : rente coll = max(0, cible − pension obligatoire).
    // On LIT la pension obligatoire du résultat (au lieu de la recalculer)
    // pour rester résilient aux évolutions du référentiel (plafond renseigné).
    const pensionObl = r.series.pensionInvalObligatoire[j1095];
    // Pension obligatoire cat2 = 50 % du SAM plafonné PASS = 50 % × 4005
    // = 2002,50 € (brut 55 000 → 4583 €/mois > PMSS 4005). INCHANGÉE (sur brut).
    expect(pensionObl).toBeCloseTo(2002.50, 1);
    expect(r.series.renteInvalCollective[j1095]).toBeCloseTo(Math.max(0, cible80 - pensionObl), 0);
  });

  it("revenu total à J180 (compl. Syntec activée) ≈ 80 % du revenu de référence", () => {
    const j180 = idxJour(r.axe, 180);
    // maintien=0 (fin J67), IJ_obl + IJ_coll = revenuRef × 0.8 (par construction
    // de la complémentaire qui complète jusqu'à pctSalaire du revenu de référence).
    expect(totalAtIdx(r.series, j180)).toBeCloseTo(r.revenuReferenceMensuel * 0.8, 0);
  });

  it("revenu total à J1095 (invalidité cat2) ≈ 80 % du revenu de référence", () => {
    const j1095 = idxJour(r.axe, 1095);
    expect(totalAtIdx(r.series, j1095)).toBeCloseTo(r.revenuReferenceMensuel * 0.8, 0);
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

  it("revenu de référence = brut × coef non-cadre (0.78) / 12 ≈ 1820 € (Décision B)", () => {
    // Léa : brut 28000 + net 1820. Décision B → brut prioritaire :
    // 28000 × 0.78 / 12 = 1820 (coïncide avec le net saisi ici).
    expect(r.revenuReferenceMensuel).toBeCloseTo((28000 * 0.78) / 12, 2);
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

  it("exposition après J67 = IJSS seules (pas de coll/ind), revenu inférieur au net", () => {
    const j180 = idxJour(r.axe, 180);
    // Léa (brut 28 000 → 2333 €/mois) est SOUS le plafond 1,4 SMIC
    // (2552 €) → IJ proportionnelle : SJB = 2333,33×3/91,25 = 76,71 €/j,
    // IJ = 38,36 €/j, soit ≈ 1150,7 €/mois (non plafonnée).
    expect(r.series.ijObligatoire[j180]).toBeCloseTo(38.356 * 30, 0);
    expect(r.series.ijComplementaireCollective[j180]).toBe(0);
    expect(r.series.ijComplementaireIndividuelle[j180]).toBe(0);
    expect(r.series.maintienEmployeur[j180]).toBe(0);
    // Total = IJ_obl seul → inférieur au net mensuel saisi (1820) :
    // c'est précisément le constat d'exposition pédagogique.
    expect(totalAtIdx(r.series, j180)).toBeLessThan(1820);
    expect(totalAtIdx(r.series, j180)).toBe(r.series.ijObligatoire[j180]);
  });

  it("bascule invalidité à J1095 : pension obligatoire cat2 = 50 % SAM (sous plafond), aucune coll/ind", () => {
    const j1095 = idxJour(r.axe, 1095);
    const brutMensuel = 28000 / 12;
    // SAM (2333 €/mois) < PASS mensuel (4005) → pas de plafonnement :
    // pension cat2 = 50 % × 2333,33 = 1166,67 €, bornée [338,31 ; 2002,50]
    // → 1166,67 € (le plafond ne mord pas).
    expect(r.series.pensionInvalObligatoire[j1095]).toBeCloseTo(brutMensuel * 0.5, 1);
    expect(r.series.pensionInvalObligatoire[j1095]).toBeCloseTo(1166.67, 1);
    expect(r.series.renteInvalCollective[j1095]).toBe(0);
    expect(r.series.renteInvalIndividuelle[j1095]).toBe(0);
    // CPAM cat2 documenté (taux 0,5) → pas de flag indisponible pour cas C.
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
  // Madelin IJ + invalidité en FORFAITAIRE (décision David, 2026-05-28) :
  // garde Pierre comme démonstration de sur-couverture (IJ 111 % à J30,
  // invalidité 110 % à J1095). En indemnitaire, ces étages seraient bornés
  // à 100 %. Cf. SPEC_PREVOYANCE_SURCOUVERTURE §2.3.
  contratsIndividuels: [
    { id: "madelin_ij",  type: "ij",             nature: "forfaitaire", capitalOuMontant: 120, franchiseJours: 30, plafondJoursIJ: 1095 },
    { id: "madelin_inv", type: "invalidite",     nature: "forfaitaire", capitalOuMontant: 0,   baseInvalidite: 0.6 },
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

  it("SSI documenté : IJ obligatoire RAAM/730 plafonnée + pension PITD, pas de flag", () => {
    expect(r.donneesCaisseIndisponibles).toBe(false);
    // IJ obligatoire AM : RAAM 60 000 ≥ PASS → plafonné, 48060/730 ≈ 65,84 €/j
    // → ≈ 1975 €/mois.
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijObligatoire[j30]).toBeCloseTo((48060 / 730) * 30, 0);
    // Pension invalidité PITD (cat2) = 50 % du revenu TNS mensuel (5000) = 2500,
    // plafonnée à 50 % PMSS = 2002,50 € (maxMensuel confirmé ameli 2026, vérifié 30/05/2026).
    const j1095 = idxJour(r.axe, 1095);
    expect(r.series.pensionInvalObligatoire[j1095]).toBeCloseTo(2002.50, 0);
  });

  it("jalons SSI J3/J30/J90/J1095 (IJ obl. + Madelin)", () => {
    const ijOblMensuel = (48060 / 730) * 30; // ≈ 1975 €
    // J3 : fin carence SSI, IJ obl. servie ; Madelin IJ encore en franchise (30 j).
    const j3 = idxJour(r.axe, 3);
    expect(r.series.ijObligatoire[j3]).toBeCloseTo(ijOblMensuel, 0);
    expect(r.series.ijComplementaireIndividuelle[j3]).toBe(0);
    expect(totalAtIdx(r.series, j3)).toBeCloseTo(ijOblMensuel, 0);
    // J30 et J90 : IJ obl. + Madelin IJ 3600 €.
    for (const j of [30, 90]) {
      const i = idxJour(r.axe, j);
      expect(totalAtIdx(r.series, i)).toBeCloseTo(ijOblMensuel + 3600, 0);
    }
    // J1095 : bascule invalidité → pension PITD plafonnée 2002,50 + rente Madelin 3000.
    const j1095 = idxJour(r.axe, 1095);
    expect(totalAtIdx(r.series, j1095)).toBeCloseTo(2002.50 + 3000, 0);
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

// ────────────────────────────────────────────────────────────────────
// LOT ALD — scénario maladie ordinaire vs affection longue durée
// ────────────────────────────────────────────────────────────────────

describe("LOT ALD — Léa (cas C, CPAM sans complémentaire) : trou J361-J1095 en ordinaire, comblé en ALD", () => {
  const vars = buildPlafondVariables(referentiels);
  const cpam = (referentiels.caisses as any).caisses.CPAM;

  // Léa = casC déjà défini plus haut (brut 28 000, non-cadre, sans coll.).
  const rOrd = projeterArretMaladie(casC, "cat2", referentiels, "maladie_ordinaire");
  const rAld = projeterArretMaladie(casC, "cat2", referentiels, "ald");

  it("boundary J360/J361 (fonction réglementaire) : ordinaire coupe à 360, ALD maintient", () => {
    // IJ journalière Léa = SJB 76,71 → 38,36 €/j (sous plafond).
    expect(computeIJObligatoireJournaliere(360, cpam, casC, vars, "maladie_ordinaire")).toBeCloseTo(38.36, 1);
    expect(computeIJObligatoireJournaliere(361, cpam, casC, vars, "maladie_ordinaire")).toBe(0);
    expect(computeIJObligatoireJournaliere(361, cpam, casC, vars, "ald")).toBeCloseTo(38.36, 1);
    expect(computeIJObligatoireJournaliere(1095, cpam, casC, vars, "ald")).toBeCloseTo(38.36, 1);
    expect(computeIJObligatoireJournaliere(1096, cpam, casC, vars, "ald")).toBe(0);
  });

  it("J90 identique dans les deux scénarios (≈ 1150,7 €/mois, IJSS seules)", () => {
    const j90 = idxJour(rOrd.axe, 90);
    expect(rOrd.series.ijObligatoire[j90]).toBeCloseTo(38.356 * 30, 0);
    expect(rAld.series.ijObligatoire[idxJour(rAld.axe, 90)]).toBeCloseTo(38.356 * 30, 0);
  });

  it("au-delà de J360 (axe J365/J730/J912) : ordinaire = 0 (trou), ALD = IJSS maintenues", () => {
    for (const j of [365, 730, 912]) {
      const iOrd = idxJour(rOrd.axe, j);
      const iAld = idxJour(rAld.axe, j);
      expect(rOrd.series.ijObligatoire[iOrd]).toBe(0);
      // Léa n'a aucune complémentaire → en ordinaire, revenu total nul.
      expect(totalAtIdx(rOrd.series, iOrd)).toBe(0);
      expect(rAld.series.ijObligatoire[iAld]).toBeCloseTo(38.356 * 30, 0);
      expect(totalAtIdx(rAld.series, iAld)).toBeCloseTo(38.356 * 30, 0);
    }
  });

  it("J1095 (bascule invalidité cat2) : pension 1166,67 € identique dans les deux scénarios", () => {
    const pOrd = rOrd.series.pensionInvalObligatoire[idxJour(rOrd.axe, 1095)];
    const pAld = rAld.series.pensionInvalObligatoire[idxJour(rAld.axe, 1095)];
    expect(pOrd).toBeCloseTo(1166.67, 1);
    expect(pAld).toBeCloseTo(1166.67, 1);
  });
});

describe("LOT ALD — Mathieu (cas A, collective Syntec jusqu'à 1095) : total inchangé, recomposition interne", () => {
  const rOrd = projeterArretMaladie(casA, "cat2", referentiels, "maladie_ordinaire");
  const rAld = projeterArretMaladie(casA, "cat2", referentiels, "ald");

  it("au-delà de J360, le total reste à 80 % du revenu de référence (la collective absorbe l'écart d'IJ obl.)", () => {
    for (const j of [365, 730, 912]) {
      const iOrd = idxJour(rOrd.axe, j);
      const iAld = idxJour(rAld.axe, j);
      // IJ obligatoire : 0 en ordinaire (>360), maintenue en ALD.
      expect(rOrd.series.ijObligatoire[iOrd]).toBe(0);
      expect(rAld.series.ijObligatoire[iAld]).toBeGreaterThan(0);
      // Total identique : la complémentaire Syntec complète jusqu'à 80 % du revenuRef.
      expect(totalAtIdx(rOrd.series, iOrd)).toBeCloseTo(rOrd.revenuReferenceMensuel * 0.8, 0);
      expect(totalAtIdx(rAld.series, iAld)).toBeCloseTo(rAld.revenuReferenceMensuel * 0.8, 0);
    }
  });
});

describe("Robustesse — variations sur cas A", () => {
  it("cat3 : rente coll cat3 = COMPLÉMENT à 100 % du revenu de référence (au-dessus de la pension obligatoire)", () => {
    const r = projeterArretMaladie(casA, "cat3", referentiels);
    const j1095 = idxJour(r.axe, 1095);
    // LOT BRUT-NET-i : cible = 100 % du revenu de référence (plus du brut).
    const cible100 = r.revenuReferenceMensuel * 1.0;
    // Relation invariante : rente coll = max(0, cible − pension obligatoire).
    // Pension lue du résultat (résilient aux évolutions du référentiel).
    const pensionObl = r.series.pensionInvalObligatoire[j1095];
    expect(r.series.renteInvalCollective[j1095]).toBeCloseTo(Math.max(0, cible100 - pensionObl), 0);
    expect(r.categorieInvaliditeProjetee).toBe("cat3");
  });

  it("cumul de 2 contrats IJ individuels — sommation correcte", () => {
    const r = projeterArretMaladie(
      {
        ...casA,
        contratsIndividuels: [
          { id: "ij1", type: "ij", nature: "forfaitaire", capitalOuMontant: 50,  franchiseJours: 30, plafondJoursIJ: 1095 },
          { id: "ij2", type: "ij", nature: "forfaitaire", capitalOuMontant: 100, franchiseJours: 30, plafondJoursIJ: 1095 },
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
    // Syntec cadre couvre déjà 100 % dès J0 (carence 0) ; un contrat IJ
    // FORFAITAIRE sans franchise est néanmoins versé en plein dès J0 (les
    // forfaitaires se cumulent au-delà de 100 % — cf. SURCOUV). On vérifie ici
    // la prise en compte de la franchise par défaut (0 → actif à J0).
    const r = projeterArretMaladie(
      {
        ...casA,
        contratsIndividuels: [
          { id: "ij1", type: "ij", nature: "forfaitaire", capitalOuMontant: 50, plafondJoursIJ: 1095 },
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
          { id: "ij1", type: "ij", nature: "forfaitaire", capitalOuMontant: 50, franchiseJours: 30, plafondJoursIJ: 60 },
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
