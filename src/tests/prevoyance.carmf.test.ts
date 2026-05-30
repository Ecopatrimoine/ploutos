// ─── LOT CARMF — médecins libéraux (SPEC_PREVOYANCE_CARMF §7) ──────────
//
// Architecture 2 étages : IJ CPAM J4-J90 (inchangée) → IJ CARMF J91-J1095
// → pension d'invalidité CARMF jusqu'au 62e anniversaire.
//
// ⚠️ Tranche de revenu intermédiaire : la CARMF ne publie pas de formule
// exacte. HYPOTHÈSE DE TRAVAIL retenue (documentée ici) : IJ = revenuN2/730,
// pension = interpolation LINÉAIRE entre 23 662 € et 31 549 €. À remplacer
// si la CARMF publie la formule officielle.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie, computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import {
  ijCarmfBrute,
  computeIjCarmfJournaliere,
  anneeIndemnisationCarmf,
  pensionInvaliditeBaseAnnuelle,
  pensionInvaliditeTotaleAnnuelle,
  renteEnfantsInvaliditeAnnuelle,
  jourFinInvaliditeCarmf,
  capitalDecesCarmf,
} from "../lib/prevoyance/carmf";
import { evaluerToutesLesRegles } from "../lib/prevoyance/regles";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { CarmfConfig, ContexteRegle, EntreePerso, ProjectionResult } from "../lib/prevoyance/types";

const carmfRef = referentiels.carmf;
const vars = buildPlafondVariables(referentiels);

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

function carmfCfg(over: Partial<CarmfConfig> = {}): CarmfConfig {
  return {
    statut: "medecin_titulaire",
    revenuBNC_N2: 95000,
    ancienneteAffiliationTrimestres: 56, // 14 ans → IJ pleines
    cumulEmploiRetraite: false,
    marie: false,
    anneesMariage: 0,
    ressourcesConjoint: 0,
    besoinTiercePersonne: false,
    ...over,
  };
}

function medecin(over: Partial<EntreePerso> = {}, carmfOver: Partial<CarmfConfig> = {}): EntreePerso {
  return {
    age: 42, ageRetraite: 64, statutPro: "tns_liberal", caisse: "CARMF",
    idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: 95000, nbEnfantsACharge: 0,
    contratsIndividuels: [], couvertureCollective: null,
    carmf: carmfCfg(carmfOver),
    ...over,
  };
}

function ctx(e: EntreePerso, projection: ProjectionResult, over: Partial<ContexteRegle> = {}): ContexteRegle {
  return {
    entree: e, projection, dettesImmobilieres: 0, conjointACharge: false,
    enfantsMineurs: 0, revenuP1Mensuel: 0, revenuP2Mensuel: 0, ...over,
  };
}

// ────────────────────────────────────────────────────────────────────
// §7.1 — Barèmes IJ
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.1 — barèmes IJ", () => {
  it("< 62 ans : 3 tranches (forfait bas / proportionnel / forfait haut)", () => {
    expect(ijCarmfBrute(carmfRef, 45, 40000, 1)).toBeCloseTo(65.84, 2); // ≤ 48060
    expect(ijCarmfBrute(carmfRef, 45, 95000, 1)).toBeCloseTo(95000 / 730, 2); // intermédiaire (hypothèse 1/730)
    expect(ijCarmfBrute(carmfRef, 45, 150000, 1)).toBeCloseTo(197.51, 2); // ≥ 144179
  });

  it("62-69 ans : dégressif 100 % / 75 % / 50 % selon l'année d'indemnisation", () => {
    const normal = 95000 / 730;
    expect(ijCarmfBrute(carmfRef, 65, 95000, 1)).toBeCloseTo(normal, 4);
    expect(ijCarmfBrute(carmfRef, 65, 95000, 2)).toBeCloseTo(normal * 0.75, 4);
    expect(ijCarmfBrute(carmfRef, 65, 95000, 3)).toBeCloseTo(normal * 0.5, 4);
  });

  it("≥ 70 ans : 50 % du taux normal", () => {
    expect(ijCarmfBrute(carmfRef, 72, 95000, 1)).toBeCloseTo((95000 / 730) * 0.5, 4);
  });

  it("anneeIndemnisation : 1 (J91-455), 2 (J456-820), 3 (J821-1095), bornée", () => {
    expect(anneeIndemnisationCarmf(91)).toBe(1);
    expect(anneeIndemnisationCarmf(455)).toBe(1);
    expect(anneeIndemnisationCarmf(456)).toBe(2);
    expect(anneeIndemnisationCarmf(900)).toBe(3);
    expect(anneeIndemnisationCarmf(1095)).toBe(3);
  });

  it("conjoint collaborateur : prorata 1/4 et 1/2", () => {
    const q = computeIjCarmfJournaliere(carmfRef, carmfCfg({ statut: "conjoint_collaborateur", optionConjointCollaborateur: "quart" }), 45, 91);
    const m = computeIjCarmfJournaliere(carmfRef, carmfCfg({ statut: "conjoint_collaborateur", optionConjointCollaborateur: "moitie" }), 45, 91);
    expect(q).toBeCloseTo((95000 / 730) * 0.25, 4);
    expect(m).toBeCloseTo((95000 / 730) * 0.5, 4);
  });
});

// ────────────────────────────────────────────────────────────────────
// §7.3 — Carences et exclusions
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.3 — carence d'affiliation, antériorité, cumul E-R", () => {
  it("carence d'affiliation < 8 trimestres → IJ = 0", () => {
    expect(computeIjCarmfJournaliere(carmfRef, carmfCfg({ ancienneteAffiliationTrimestres: 6 }), 45, 91)).toBe(0);
  });

  it("antériorité : 8-15 trim → ×2/3 de réduction (facteur 1/3), 16-23 → facteur 2/3, ≥24 → plein", () => {
    const normal = 95000 / 730;
    expect(computeIjCarmfJournaliere(carmfRef, carmfCfg({ ancienneteAffiliationTrimestres: 10 }), 45, 91)).toBeCloseTo(normal * (1 / 3), 4);
    expect(computeIjCarmfJournaliere(carmfRef, carmfCfg({ ancienneteAffiliationTrimestres: 20 }), 45, 91)).toBeCloseTo(normal * (2 / 3), 4);
    expect(computeIjCarmfJournaliere(carmfRef, carmfCfg({ ancienneteAffiliationTrimestres: 30 }), 45, 91)).toBeCloseTo(normal, 4);
  });

  it("cumul emploi-retraite → IJ et pension = 0", () => {
    const cfg = carmfCfg({ cumulEmploiRetraite: true });
    expect(computeIjCarmfJournaliere(carmfRef, cfg, 45, 91)).toBe(0);
    expect(pensionInvaliditeBaseAnnuelle(carmfRef, cfg)).toBe(0);
  });

  it("hors fenêtre J91-J1095 → IJ CARMF = 0", () => {
    expect(computeIjCarmfJournaliere(carmfRef, carmfCfg(), 42, 90)).toBe(0);
    expect(computeIjCarmfJournaliere(carmfRef, carmfCfg(), 42, 1096)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §7.4 — Invalidité et majorations
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.4 — pension d'invalidité, majorations, rentes enfants", () => {
  it("pension de base par tranche (forfait bas / interpolation / forfait haut)", () => {
    expect(pensionInvaliditeBaseAnnuelle(carmfRef, carmfCfg({ revenuBNC_N2: 40000 }))).toBeCloseTo(23662, 0);
    expect(pensionInvaliditeBaseAnnuelle(carmfRef, carmfCfg({ revenuBNC_N2: 160000 }))).toBeCloseTo(31549, 0);
    // Interpolation linéaire (HYPOTHÈSE de travail, pas une donnée officielle CARMF).
    const mid = 23662 + (31549 - 23662) * ((95000 - 48060) / (144179 - 48060));
    expect(pensionInvaliditeBaseAnnuelle(carmfRef, carmfCfg({ revenuBNC_N2: 95000 }))).toBeCloseTo(mid, 1);
  });

  it("+35 % conjoint avec écrêtement au plafond de ressources", () => {
    // Sophie : base 27514, ressources conjoint 28000 → maj pleine 9630 dépasse
    // le plafond 31252 → écrêtée à 31252 - 28000 = 3252.
    const cfg = carmfCfg({ marie: true, anneesMariage: 12, ressourcesConjoint: 28000 });
    const base = pensionInvaliditeBaseAnnuelle(carmfRef, cfg);
    const total = pensionInvaliditeTotaleAnnuelle(carmfRef, cfg, 0);
    expect(total - base).toBeCloseTo(3252, 0);
  });

  it("+35 % conjoint pleine si pas de dépassement", () => {
    const cfg = carmfCfg({ revenuBNC_N2: 40000, marie: true, anneesMariage: 5, ressourcesConjoint: 0 });
    const base = pensionInvaliditeBaseAnnuelle(carmfRef, cfg); // 23662
    expect(pensionInvaliditeTotaleAnnuelle(carmfRef, cfg, 0) - base).toBeCloseTo(base * 0.35, 0);
  });

  it("+35 % tierce personne et +10 % ≥3 enfants, cumulables", () => {
    const cfg = carmfCfg({ revenuBNC_N2: 40000, besoinTiercePersonne: true });
    const base = 23662;
    expect(pensionInvaliditeTotaleAnnuelle(carmfRef, cfg, 0) - base).toBeCloseTo(base * 0.35, 0); // tierce
    expect(pensionInvaliditeTotaleAnnuelle(carmfRef, cfg, 3) - base).toBeCloseTo(base * 0.35 + base * 0.10, 0); // tierce + bonif
  });

  it("rentes enfants : 8 788,52 €/enfant (médecin), prorata conjoint collaborateur", () => {
    expect(renteEnfantsInvaliditeAnnuelle(carmfRef, carmfCfg(), 3)).toBeCloseTo(3 * 8788.52, 2);
    expect(renteEnfantsInvaliditeAnnuelle(carmfRef, carmfCfg({ statut: "conjoint_collaborateur", optionConjointCollaborateur: "moitie" }), 2)).toBeCloseTo(2 * 4394.26, 2);
    expect(renteEnfantsInvaliditeAnnuelle(carmfRef, carmfCfg({ ancienneteAffiliationTrimestres: 4 }), 3)).toBe(0); // pas de droit
  });

  it("durée : pension jusqu'au 62e anniversaire (cutoff en jours depuis J0)", () => {
    expect(jourFinInvaliditeCarmf(42)).toBe(20 * 365);
    expect(jourFinInvaliditeCarmf(60)).toBe(2 * 365);
    expect(jourFinInvaliditeCarmf(63)).toBe(0); // déjà > 62 → aucune pension CARMF
  });
});

// ────────────────────────────────────────────────────────────────────
// §7.2 + §7.5 — Architecture 2 étages & cas d'or
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.5 — Cas E (Dr Sophie, médecin titulaire)", () => {
  const e = medecin(
    { age: 42, revenuTNSAnnuel: 95000, nbEnfantsACharge: 3 },
    { revenuBNC_N2: 95000, ancienneteAffiliationTrimestres: 56, marie: true, anneesMariage: 12, ressourcesConjoint: 28000 }
  );
  const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");

  it("revenu de référence = 95 000 / 12 ≈ 7 916,67 €", () => {
    expect(r.revenuReferenceMensuel).toBeCloseTo(95000 / 12, 1);
  });

  it("J90 = étage CPAM (plafonné), J91 = relais CARMF (= 95000/730×30) — rupture nette", () => {
    const ijCpamJ90 = computeIJObligatoireJournaliere(90, (referentiels.caisses as any).caisses.CPAM, e, vars, "maladie_ordinaire")! * 30;
    expect(r.series.ijObligatoire[idxJour(r.axe, 90)]).toBeCloseTo(ijCpamJ90, 0);
    expect(r.series.ijObligatoire[idxJour(r.axe, 91)]).toBeCloseTo((95000 / 730) * 30, 0); // ≈ 3904,11 €
    // Les deux étages diffèrent → relais visible.
    expect(r.series.ijObligatoire[idxJour(r.axe, 91)]).not.toBeCloseTo(ijCpamJ90, 0);
    expect(r.rupturesCles.some((rc) => rc.type === "relais_carmf" && rc.jour === 91)).toBe(true);
  });

  it("J547 : IJ CARMF maintenue ≈ 3 904 €/mois (≈ 49 % du revenu → sous-couverture)", () => {
    const ij = r.series.ijObligatoire[idxJour(r.axe, 547)];
    expect(ij).toBeCloseTo((95000 / 730) * 30, 0);
    expect(ij / r.revenuReferenceMensuel).toBeLessThan(0.5);
  });

  it("J1095 : invalidité = pension (base+maj écrêtée+bonif)/12 + rentes enfants/12 ≈ 4 990 €", () => {
    const i = idxJour(r.axe, 1095);
    const base = pensionInvaliditeBaseAnnuelle(carmfRef, e.carmf!);
    const pensionAttendue = (base + 3252 + base * 0.10) / 12; // maj conjoint écrêtée 3252 + bonif 10 %
    expect(r.series.pensionInvalObligatoire[i]).toBeCloseTo(pensionAttendue, 0);
    expect(r.series.renteInvalEnfants[i]).toBeCloseTo((3 * 8788.52) / 12, 0);
    expect(totalAtIdx(r.series, i)).toBeCloseTo(4990, 0);
  });

  it("constats : invalidité s'arrête à 62 ans + majoration conjoint écrêtée ; pas de carence", () => {
    const constats = evaluerToutesLesRegles(ctx(e, r), "p1");
    expect(constats.some((c) => c.id.startsWith("carmf_invalidite_stop_62"))).toBe(true);
    expect(constats.some((c) => c.id.startsWith("carmf_plafond_conjoint"))).toBe(true);
    expect(constats.some((c) => c.id.startsWith("carmf_carence_affiliation"))).toBe(false);
  });
});

describe("CARMF §7.5 — Cas E-jeune (Dr Lucas, carence d'affiliation)", () => {
  const e = medecin(
    { age: 32, revenuTNSAnnuel: 65000 },
    { revenuBNC_N2: 65000, ancienneteAffiliationTrimestres: 6 }
  );
  const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");

  it("J90 CPAM servi, mais J91-J1095 CARMF = 0 (carence d'affiliation)", () => {
    expect(r.series.ijObligatoire[idxJour(r.axe, 90)]).toBeGreaterThan(0);
    for (const j of [91, 180, 547, 912]) {
      expect(r.series.ijObligatoire[idxJour(r.axe, j)]).toBe(0);
    }
  });

  it("invalidité = 0 (même condition de carence)", () => {
    expect(r.series.pensionInvalObligatoire[idxJour(r.axe, 1095)]).toBe(0);
    expect(r.series.renteInvalEnfants[idxJour(r.axe, 1095)]).toBe(0);
  });

  it("constat majeur : carence d'affiliation CARMF (alerte)", () => {
    const constats = evaluerToutesLesRegles(ctx(e, r), "p1");
    const c = constats.find((c) => c.id.startsWith("carmf_carence_affiliation"));
    expect(c?.severite).toBe("alerte");
    expect(c?.detail).toContain("90 premiers jours");
  });
});

describe("CARMF §7.5 — Cas E-conjoint (Mme Léa, conjoint collaborateur option moitié)", () => {
  const e = medecin(
    { age: 38, revenuTNSAnnuel: 47500, nbEnfantsACharge: 2 },
    {
      statut: "conjoint_collaborateur", optionConjointCollaborateur: "moitie",
      revenuBNC_N2: 95000, ancienneteAffiliationTrimestres: 56,
      marie: true, anneesMariage: 8, ressourcesConjoint: 95000, // ressources du médecin > plafond → pas de maj
    }
  );
  const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");

  it("IJ CARMF moitié à J91 = (95000/730)×0,5×30 ≈ 1 952 €", () => {
    expect(r.series.ijObligatoire[idxJour(r.axe, 91)]).toBeCloseTo((95000 / 730) * 0.5 * 30, 0);
  });

  it("invalidité moitié à J1095 : pension ≈ 1 146 € + 2 rentes enfants option moitié ≈ 732 €", () => {
    const i = idxJour(r.axe, 1095);
    const baseMid = 23662 + (31549 - 23662) * ((95000 - 48060) / (144179 - 48060));
    expect(r.series.pensionInvalObligatoire[i]).toBeCloseTo((baseMid * 0.5) / 12, 0); // pas de majoration (ressources > plafond, <3 enfants)
    expect(r.series.renteInvalEnfants[i]).toBeCloseTo((2 * 4394.26) / 12, 0);
    expect(totalAtIdx(r.series, i)).toBeCloseTo(1879, 0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §7.6 — Interaction CARMF × SURCOUV
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.6 — interaction avec le bornage SURCOUV", () => {
  it("Madelin IJ indemnitaire surdimensionné → borné à 100 % du revenu (95000/12)", () => {
    const e = medecin(
      { contratsIndividuels: [{ id: "m", type: "ij", nature: "indemnitaire", capitalOuMontant: 300, franchiseJours: 0, plafondJoursIJ: 1095 }] },
      {}
    );
    const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");
    const i = idxJour(r.axe, 91);
    // IJ CARMF 3904,11 + Madelin borné → cumul = revenu de référence (7916,67).
    expect(totalAtIdx(r.series, i)).toBeCloseTo(95000 / 12, 0);
    expect(r.surCouvertureIndemnitaireBornee).toBe(true);
  });

  it("Madelin IJ forfaitaire dépassant le besoin → constat sur-couverture forfaitaire", () => {
    const e = medecin(
      { contratsIndividuels: [{ id: "m", type: "ij", nature: "forfaitaire", capitalOuMontant: 300, franchiseJours: 0, plafondJoursIJ: 1095 }] },
      {}
    );
    const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");
    expect(r.surCouvertureForfaitaire).toBe(true);
    const constats = evaluerToutesLesRegles(ctx(e, r), "p1");
    expect(constats.some((c) => c.id.startsWith("sur_couverture_forfaitaire"))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// §7.7 — Décès (capital + rentes)
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.7 — capital et rentes décès", () => {
  it("capital décès : médecin 71 500 €, conjoint collaborateur 17 875 € (¼) / 35 750 € (½)", () => {
    expect(capitalDecesCarmf(carmfRef, carmfCfg())).toBe(71500);
    expect(capitalDecesCarmf(carmfRef, carmfCfg({ statut: "conjoint_collaborateur", optionConjointCollaborateur: "quart" }))).toBe(17875);
    expect(capitalDecesCarmf(carmfRef, carmfCfg({ statut: "conjoint_collaborateur", optionConjointCollaborateur: "moitie" }))).toBe(35750);
  });

  it("rentes survivants (référentiel) : conjoint min 8 557,20 / max 17 114,40 ; orphelin 10 078,48 / 17 114,40", () => {
    const rc = carmfRef.deces.renteConjointSurvivant;
    expect(rc.minimumAnnuel).toBe(8557.20);
    expect(rc.maximumAnnuel).toBe(17114.40);
    const ro = carmfRef.deces.renteOrphelins;
    expect(ro.orphelinPereOuMere.annuel).toBe(10078.48);
    expect(ro.orphelinPereEtMere.annuel).toBe(17114.40);
  });

  it("capital décès CARMF pris en compte face aux dettes immobilières", () => {
    const e = medecin();
    const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");
    // Dettes 60 000 € < capital CARMF 71 500 € → pas de constat d'insuffisance.
    const sansTrou = evaluerToutesLesRegles(ctx(e, r, { dettesImmobilieres: 60000 }), "p1");
    expect(sansTrou.some((c) => c.id.startsWith("dc_capital_insuffisant_dettes"))).toBe(false);
    // Dettes 200 000 € > capital → constat présent.
    const avecTrou = evaluerToutesLesRegles(ctx(e, r, { dettesImmobilieres: 200000 }), "p1");
    expect(avecTrou.some((c) => c.id.startsWith("dc_capital_insuffisant_dettes"))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// §7.8 — Régression : pas de faux « données indisponibles » (branche dédiée)
// ────────────────────────────────────────────────────────────────────
describe("CARMF §7.8 — faux warning données indisponibles", () => {
  const e = medecin();

  it("CARMF en ALD → donneesCaisseIndisponibles = false (branche dédiée, stub générique ignoré)", () => {
    const r = projeterArretMaladie(e, "cat2", referentiels, "ald");
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });

  it("CARMF en maladie ordinaire → inchangé (false) — non-régression", () => {
    const r = projeterArretMaladie(e, "cat2", referentiels, "maladie_ordinaire");
    expect(r.donneesCaisseIndisponibles).toBe(false);
  });
});
