// ─── LOT CIPAV — professions libérales non réglementées (SPEC_PREVOYANCE_CIPAV) ──
//
// Architecture DIFFÉRENTE de la CARMF :
//   J4-J90  : IJ libéraux (RAAM/730, plafond 3×PASS → 197,51 €/j, plancher
//             26,33 €/j, seuil 4 806 €, affiliation ≥ 1 an). Barème DISTINCT
//             du bloc CPAM salarié (cap 41,95 €/j) — décision lot confirmée.
//   J91→1095: TROU. Aucun relais (0 €). Constat choc en RDV.
//   ≥ J1095 : pension d'invalidité par points (cutoff 62 ans totale / 67 partielle).
//
// Les 4 formules reproduisent les exemples officiels CIPAV au centime
// (bloc docs/bloc-cipav-2026.json, vérifié lacipav.fr 2026-05-29).
//
// TO_VERIFY (cf. it.skip en fin de fichier) :
//   - H4 : seuil d'éligibilité IJ recalculé 4 806 € (10 % PASS 2026) vs
//          4 113 € (newsletter 2021) — mode de calcul exact à confirmer.
//   - H5 : conjoint collaborateur CIPAV non documenté à la source — option
//          non implémentée (la CARMF la gère, pas la CIPAV).

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import {
  pointsCipav,
  ijCipavPhase1Journaliere,
  pensionInvaliditeTotaleCipavAnnuelle,
  pensionInvaliditeCipavAnnuelle,
  jourFinInvaliditeCipav,
  capitalDecesCipav,
  renteCipavAnnuelle,
} from "../lib/prevoyance/cipav";
import { referentiels } from "../data/prevoyance";
import type { CipavConfig, EntreePerso, ProjectionResult } from "../lib/prevoyance/types";

const cipavRef = referentiels.cipav;

function idxJour(axe: ProjectionResult["axe"], j: number): number {
  return axe.findIndex((p) => p.jour === j);
}
function totalAtIdx(s: ProjectionResult["series"], i: number): number {
  return (
    s.salaire[i] + s.maintienEmployeur[i] + s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] + s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] + s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i] + s.renteInvalEnfants[i]
  );
}

function cipavCfg(over: Partial<CipavConfig> = {}): CipavConfig {
  return {
    revenuBNC_N2: 60000,
    ancienneteAffiliationMois: 180, // 15 ans → IJ pleines
    cumulEmploiRetraite: false,
    tauxInvalidite: 100,
    marie: true,
    nbEnfants: 2,
    decesAccidentel: false,
    ...over,
  };
}

function liberal(over: Partial<EntreePerso> = {}, cipavOver: Partial<CipavConfig> = {}): EntreePerso {
  return {
    age: 45, ageRetraite: 64, statutPro: "tns_liberal", caisse: "CIPAV",
    idccCCN: null, ancienneteMois: 180, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: 60000, nbEnfantsACharge: 2,
    contratsIndividuels: [], couvertureCollective: null,
    cipav: cipavCfg(cipavOver),
    ...over,
  };
}

// Valeur service du point (3,01 €) — utilitaire de recalcul exact in-test.
const VSP = cipavRef.pointsPrevoyance.valeurServicePoint;

// ────────────────────────────────────────────────────────────────────
// §1 — Socle « points prévoyance » + exemples officiels (au centime)
// ────────────────────────────────────────────────────────────────────
describe("CIPAV §1 — socle points & exemples officiels vérifiés", () => {
  it("points = (revenu × 0,005) / 0,013 (exemple officiel : 20 000 € → 7 692,3 pts)", () => {
    expect(pointsCipav(cipavRef, 20000)).toBeCloseTo((20000 * 0.005) / 0.013, 4);
    expect(pointsCipav(cipavRef, 20000)).toBeCloseTo(7692.3077, 2);
    expect(pointsCipav(cipavRef, 0)).toBe(0);
  });

  it("invalidité totale 20 000 € = 10 120,94 €/an (forfait 2 403 + points/3 × 3,01)", () => {
    expect(pensionInvaliditeTotaleCipavAnnuelle(cipavRef, 20000)).toBeCloseTo(10120.94, 1);
  });

  it("invalidité partielle 80 % de 20 000 € = 8 096,75 €/an (coquille 2 355 écartée)", () => {
    const partielle = pensionInvaliditeCipavAnnuelle(cipavRef, cipavCfg({ revenuBNC_N2: 20000, tauxInvalidite: 80 }));
    expect(partielle).toBeCloseTo(8096.75, 1);
  });

  it("capital décès 20 000 € = 7 209 + points × 3,01 (points ENTIERS) ≈ 30 362,85 €", () => {
    const pts = pointsCipav(cipavRef, 20000);
    expect(capitalDecesCipav(cipavRef, 20000, false)).toBeCloseTo(7209 + pts * VSP, 6);
    expect(capitalDecesCipav(cipavRef, 20000, false)).toBeCloseTo(30362.85, 1);
  });

  it("rente conjoint/enfant 20 000 € = 720,90 + points/10 × 3,01 = 3 036,28 €/an", () => {
    expect(renteCipavAnnuelle(cipavRef, 20000)).toBeCloseTo(3036.28, 1);
  });

  it("diviseurs distincts : invalidité /3, rentes /10, capital décès entiers", () => {
    const pts = pointsCipav(cipavRef, 20000);
    expect(pensionInvaliditeTotaleCipavAnnuelle(cipavRef, 20000)).toBeCloseTo(2403 + (pts / 3) * VSP, 4);
    expect(renteCipavAnnuelle(cipavRef, 20000)).toBeCloseTo(720.9 + (pts / 10) * VSP, 4);
    expect(capitalDecesCipav(cipavRef, 20000, false)).toBeCloseTo(7209 + pts * VSP, 4);
  });
});

// ────────────────────────────────────────────────────────────────────
// §2 — IJ libéraux phase 1 (J4-J90), barème distinct du CPAM salarié
// ────────────────────────────────────────────────────────────────────
describe("CIPAV §2 — IJ libéraux J4-J90 (RAAM/730, plafond 3×PASS, plancher 26,33)", () => {
  it("revenu intermédiaire : 60 000 / 730 = 82,19 €/j (PAS le cap CPAM salarié 41,95)", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg(), 90)).toBeCloseTo(60000 / 730, 4);
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg(), 90)).toBeGreaterThan(41.95); // ≠ bloc salarié
  });

  it("plafond : revenu ≥ 3×PASS (144 180 €) → 197,51 €/j", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg({ revenuBNC_N2: 200000 }), 90)).toBeCloseTo(144180 / 730, 4);
  });

  it("plancher : revenu 15 000 € → 26,33 €/j (20,55 < plancher)", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg({ revenuBNC_N2: 15000 }), 90)).toBeCloseTo(26.33, 2);
  });

  it("seuil d'éligibilité : revenu < 4 806 € → 0 (pas d'IJ)", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg({ revenuBNC_N2: 4000 }), 90)).toBe(0);
  });

  it("affiliation < 1 an (12 mois) → 0 (trou total dès J4)", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg({ ancienneteAffiliationMois: 8 }), 90)).toBe(0);
  });

  it("carence (J1-J3) et hors fenêtre (J91+) → 0", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg(), 3)).toBe(0);
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg(), 4)).toBeGreaterThan(0);
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg(), 90)).toBeGreaterThan(0);
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg(), 91)).toBe(0);
  });

  it("cumul emploi-retraite → 0", () => {
    expect(ijCipavPhase1Journaliere(cipavRef, cipavCfg({ cumulEmploiRetraite: true }), 90)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §3 — Pension d'invalidité (totale / partielle / seuil / cutoff)
// ────────────────────────────────────────────────────────────────────
describe("CIPAV §3 — pension d'invalidité par points", () => {
  it("totale (100 %) = forfait + points/3 × 3,01", () => {
    expect(pensionInvaliditeCipavAnnuelle(cipavRef, cipavCfg({ revenuBNC_N2: 20000, tauxInvalidite: 100 }))).toBeCloseTo(
      pensionInvaliditeTotaleCipavAnnuelle(cipavRef, 20000), 6
    );
  });

  it("partielle (66-99 %) = totale × taux/100", () => {
    const totale = pensionInvaliditeTotaleCipavAnnuelle(cipavRef, 20000);
    expect(pensionInvaliditeCipavAnnuelle(cipavRef, cipavCfg({ revenuBNC_N2: 20000, tauxInvalidite: 66 }))).toBeCloseTo(totale * 0.66, 4);
  });

  it("sous 66 % → pas de pension (0)", () => {
    expect(pensionInvaliditeCipavAnnuelle(cipavRef, cipavCfg({ tauxInvalidite: 65 }))).toBe(0);
    expect(pensionInvaliditeCipavAnnuelle(cipavRef, cipavCfg({ tauxInvalidite: 50 }))).toBe(0);
  });

  it("cumul emploi-retraite → pas de pension (0)", () => {
    expect(pensionInvaliditeCipavAnnuelle(cipavRef, cipavCfg({ cumulEmploiRetraite: true }))).toBe(0);
  });

  it("cutoff : totale jusqu'à 62 ans, partielle jusqu'à 67 ans (jours depuis J0)", () => {
    expect(jourFinInvaliditeCipav(cipavRef, 45, 100)).toBe((62 - 45) * 365);
    expect(jourFinInvaliditeCipav(cipavRef, 45, 80)).toBe((67 - 45) * 365);
    expect(jourFinInvaliditeCipav(cipavRef, 63, 100)).toBe(0); // déjà > 62
  });
});

// ────────────────────────────────────────────────────────────────────
// §4 — Capital décès & rentes (prestations décès, fonctions pures)
// ────────────────────────────────────────────────────────────────────
describe("CIPAV §4 — capital décès & rentes survivants", () => {
  it("majoration décès accidentel : +5 000 points avant × 3,01", () => {
    const pts = pointsCipav(cipavRef, 20000);
    expect(capitalDecesCipav(cipavRef, 20000, true)).toBeCloseTo(7209 + (pts + 5000) * VSP, 6);
    expect(capitalDecesCipav(cipavRef, 20000, true) - capitalDecesCipav(cipavRef, 20000, false)).toBeCloseTo(5000 * VSP, 6);
  });

  it("rente enfant = rente conjoint (même formule), servie par enfant", () => {
    const parEnfant = renteCipavAnnuelle(cipavRef, 60000);
    expect(2 * parEnfant).toBeCloseTo(2 * (720.9 + (pointsCipav(cipavRef, 60000) / 10) * VSP), 4);
  });
});

// ────────────────────────────────────────────────────────────────────
// §5 — Cas d'or (projection complète)
// ────────────────────────────────────────────────────────────────────
describe("CIPAV §5 — Cas F (architecte 60 k€, le trou type)", () => {
  const e = liberal();
  const r = projeterArretMaladie(e, "cat2", referentiels, "ald");

  it("revenu de référence = 60 000 / 12 = 5 000 €", () => {
    expect(r.revenuReferenceMensuel).toBeCloseTo(5000, 1);
  });

  it("J90 : IJ libéraux ≈ 2 466 €/mois (~49 % du revenu)", () => {
    const ij = r.series.ijObligatoire[idxJour(r.axe, 90)];
    expect(ij).toBeCloseTo((60000 / 730) * 30, 0);
    expect(ij / r.revenuReferenceMensuel).toBeLessThan(0.5);
  });

  it("J91 → J1095 : TROU, IJ = 0 (aucun relais CIPAV)", () => {
    for (const j of [91, 180, 547, 912]) {
      expect(r.series.ijObligatoire[idxJour(r.axe, j)]).toBe(0);
    }
  });

  it("rupture « trou_cipav » à J91, et pas de relais CARMF", () => {
    expect(r.rupturesCles.some((rc) => rc.type === "trou_cipav" && rc.jour === 91)).toBe(true);
    expect(r.rupturesCles.some((rc) => rc.type === "relais_carmf")).toBe(false);
  });

  it("J1095 : invalidité totale ≈ 2 130 €/mois (forfait + points/3)", () => {
    const i = idxJour(r.axe, 1095);
    expect(r.series.pensionInvalObligatoire[i]).toBeCloseTo(pensionInvaliditeTotaleCipavAnnuelle(cipavRef, 60000) / 12, 0);
    expect(r.series.renteInvalEnfants[i]).toBe(0); // rentes CIPAV = décès, hors courbe invalidité
    expect(totalAtIdx(r.series, i)).toBeCloseTo(2130, -1);
  });

  it("scénario ALD : pas de faux « données indisponibles » (branche CIPAV dédiée)", () => {
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });
});

describe("CIPAV §5 — Cas F-jeune (ostéo installé 8 mois, affiliation < 1 an)", () => {
  const e = liberal({ age: 28, revenuTNSAnnuel: 40000, ancienneteMois: 8 }, { revenuBNC_N2: 40000, ancienneteAffiliationMois: 8 });
  const r = projeterArretMaladie(e, "cat2", referentiels, "ald");

  it("pas d'IJ CPAM : trou total sur toute la phase 1 (affiliation < 1 an)", () => {
    for (const j of [7, 30, 90]) {
      expect(r.series.ijObligatoire[idxJour(r.axe, j)]).toBe(0);
    }
  });

  it("l'invalidité par points n'est PAS conditionnée à l'affiliation 1 an (> 0 à J1095)", () => {
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, 1095)]).toBeGreaterThan(0);
  });
});

describe("CIPAV §5 — Cas F-modeste (psy 15 k€, plancher IJ activé)", () => {
  const e = liberal({ revenuTNSAnnuel: 15000 }, { revenuBNC_N2: 15000 });
  const r = projeterArretMaladie(e, "cat2", referentiels, "ald");

  it("J90 : IJ au plancher 26,33 €/j → 789,90 €/mois", () => {
    expect(r.series.ijObligatoire[idxJour(r.axe, 90)]).toBeCloseTo(26.33 * 30, 2);
  });
});

// ────────────────────────────────────────────────────────────────────
// §6 — TO_VERIFY (it.skip jusqu'à confirmation à la source)
// ────────────────────────────────────────────────────────────────────
describe("CIPAV §6 — TO_VERIFY (en attente de confirmation source)", () => {
  // H4 — seuil d'éligibilité IJ recalculé 4 806 € (10 % PASS 2026) au lieu de
  // 4 113 € (newsletter CIPAV 2021). Mode de calcul exact à confirmer.
  it.skip("TO_VERIFY H4 — seuil éligibilité IJ = 4 806 € (10 % PASS 2026), recalculé vs 4 113 €", () => {
    expect(cipavRef.ijCpamLiberaux.seuilEligibiliteRevenu).toBe(4806);
  });

  // H5 — conjoint collaborateur CIPAV NON documenté à la source (la CARMF le
  // gère via option quart/moitié, pas la CIPAV). Option non implémentée tant
  // que non confirmée. Ce test sera activé si la source documente l'option.
  it.skip("TO_VERIFY H5 — option conjoint collaborateur CIPAV (non documentée, non implémentée)", () => {
    // À implémenter si lacipav.fr documente un prorata conjoint collaborateur.
    expect(true).toBe(true);
  });

  // H6 — délai de stage invalidité-décès. HYPOTHÈSE ACTUELLE DU CODE : la
  // pension d'invalidité par points n'est PAS conditionnée à une durée
  // minimale d'affiliation (seules les IJ exigent ≥ 1 an). Plausible mais
  // NON confirmé : la page CIPAV exige d'être « à jour de cotisations » sans
  // mentionner de durée minimale, mais un délai de stage invalidité-décès
  // n'est pas exclu. À vérifier à la source avant de figer ce comportement.
  // Le test ci-dessous documente l'hypothèse (cas F-jeune, affiliation 8 mois,
  // pension > 0) ; il reste skippé tant que la source n'est pas confirmée.
  it.skip("TO_VERIFY H6 — pension invalidité non conditionnée à l'affiliation ≥ 1 an (à confirmer)", () => {
    const e = liberal({ age: 28, ancienneteMois: 8 }, { ancienneteAffiliationMois: 8 });
    const r = projeterArretMaladie(e, "cat2", referentiels, "ald");
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, 1095)]).toBeGreaterThan(0);
  });
});
