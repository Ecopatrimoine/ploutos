// ─── T6 / Famille H — Cas limites & pièges métier (PLAN_TESTS §H) ──────
//
// Cas tordus tirés de l'expérience CGP. Les cas dépendant des valeurs
// caisses s'appuient sur computeIJObligatoireJournaliere (avec patch
// mémoire du référentiel quand la valeur réelle est encore TO_VERIFY).
// Deux cas en it.skip = ÉCARTS MÉTIER à trancher (cf. récap T6).

import { describe, it, expect } from "vitest";
import { projeterArretMaladie, computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import { buildEntreePerso } from "../lib/prevoyance/mapping";
import { calcConjointACharge, calcEnfantsMineurs } from "../lib/prevoyance/contexte";
import { evaluerToutesLesRegles } from "../lib/prevoyance/regles";
import { createEmptyTravail } from "../lib/prevoyance/utils";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { ContexteRegle, EntreePerso, ProjectionResult } from "../lib/prevoyance/types";
import type { PatrimonialData } from "../types/patrimoine";

// ContexteRegle minimal pour vérifier la présence d'un constat lié à
// un flag de la projection (sur-couverture, collective TNS ignorée).
function ctxFromProjection(e: EntreePerso, projection: ProjectionResult): ContexteRegle {
  return {
    entree: e, projection,
    dettesImmobilieres: 0, conjointACharge: false, enfantsMineurs: 0,
    revenuP1Mensuel: 0, revenuP2Mensuel: 0,
  };
}

function entree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 50000,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

function minimalData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "", person1LastName: "", person1BirthDate: "1985-01-01",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: false,
    person1Handicap: false, person2Handicap: false, childrenData: [],
    salary1: "0", salary2: "0", pensions: "0", perDeduction: "0",
    pensionDeductible: "0", otherDeductible: "0",
    ca1: "0", bicType1: "", microRegime1: true, chargesReelles1: "0", baRevenue1: "0",
    chargesDetail1: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    ca2: "0", bicType2: "", microRegime2: true, chargesReelles2: "0", baRevenue2: "0",
    chargesDetail2: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    properties: [], placements: [], perRentes: [], otherLoans: [],
    ...over,
  };
}

const vars = buildPlafondVariables(referentiels);

describe("Famille H — Cas limites & pièges métier", () => {
  // H1 — multi-statut : un seul statut/caisse traité (limite v1)
  it("H1 — salarié avec revenuTNS parasite → base IJ et revenu réf sur le BRUT (un seul statut)", () => {
    // Brut SOUS le plafond 1,4 SMIC (2552 €/mois) → IJ proportionnelle,
    // ce qui rend le test discriminant : si le moteur utilisait le
    // revenuTNS parasite (200 000 €), l'IJ saturerait à 41,95 €/j.
    const e = entree({ statutPro: "salarie_cadre", salaireBrutAnnuel: 24000, revenuTNSAnnuel: 200000 });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    // Revenu de référence salarié = brut × coef, PAS basé sur le revenuTNS
    expect(r.revenuReferenceMensuel).toBeCloseTo((24000 * 0.75) / 12, 2);
    // IJ CPAM sur le brut : SJB = (24000/12)×3/91,25 = 65,75 → IJ = 32,88 €/j
    // (proportionnelle, < 41,95), et NON saturée comme le ferait le TNS.
    const ij = computeIJObligatoireJournaliere(30, (referentiels.caisses as any).caisses.CPAM, e, vars);
    expect(ij).toBeCloseTo(32.88, 1);
    expect(ij!).toBeLessThan(41.95);
  });

  // H2 — cumul emploi-retraite : retraité → projection minimale, pas de maintien
  it("H2 — statut retraité → aucun maintien employeur, projection sans crash", () => {
    const r = projeterArretMaladie(entree({ statutPro: "retraite", caisse: "CPAM" }), "cat2", referentiels);
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });

  // H3 — salarié < 1 an d'ancienneté → aucun maintien (palier min 12 mois)
  it("H3 — ancienneté 6 mois → aucun maintien employeur (seuil Mensualisation 1 an)", () => {
    const r = projeterArretMaladie(entree({ ancienneteMois: 6 }), "cat2", referentiels);
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });

  // H4 — cadre décès-only (1,50 % T1 = décès, PAS invalidité auto)
  it("H4 — couverture IJ collective SANS bloc invalidité → renteInvalCollective = 0", () => {
    const r = projeterArretMaladie(
      entree({ couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" } } }),
      "cat2", referentiels
    );
    // Pas de bloc invalidite saisi → le moteur ne suppose AUCUNE rente invalidité collective
    for (const v of r.series.renteInvalCollective) expect(v).toBe(0);
  });

  // H5 — conjoint à charge au seuil 49 / 51 %
  it("H5 — P2 à 49 % du revenu P1 → à charge ; 51 % → pas à charge", () => {
    expect(calcConjointACharge(minimalData({ coupleStatus: "married", salary1: "100000", salary2: "49000" }))).toBe(true);
    expect(calcConjointACharge(minimalData({ coupleStatus: "married", salary1: "100000", salary2: "51000" }))).toBe(false);
  });

  // H6 — enfant qui atteint 18 ans pendant la projection : âge figé à la
  // date d'analyse (pas de vieillissement dans la projection — limite v1)
  it("H6 — enfantsMineurs est figé à la date d'analyse (pas de vieillissement projeté)", () => {
    const y = new Date().getFullYear();
    const enfant17 = `${y - 17}-01-01`;
    const data = minimalData({
      childrenData: [{ firstName: "E", lastName: "", birthDate: enfant17, parentLink: "", custody: "", rattached: true, handicap: false }],
    });
    // Compté mineur aujourd'hui ; ce nombre reste constant pour toute la
    // durée de la projection (le moteur ne fait pas vieillir les enfants).
    expect(calcEnfantsMineurs(data)).toBe(1);
  });

  // H7 — Dirigeant TNS (gérant majoritaire) avec couverture collective
  // saisie : un TNS pur n'a PAS accès au collectif de son entreprise.
  // Décision H7 appliquée : le moteur IGNORE la couverture collective
  // pour les statuts TNS purs (étages collectifs = 0) + constat attention.
  it("H7 — gérant majoritaire (TNS) → couverture collective ignorée + flag + constat", () => {
    const e = entree({ statutPro: "gerant_majoritaire", caisse: "SSI", salaireBrutAnnuel: 0, revenuTNSAnnuel: 60000,
      couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 30, plafondJours: 1095, baseCalcul: "T1_T2" },
        invalidite: { cat1: { pctSalaire: 0.4 }, cat2: { pctSalaire: 0.8 }, cat3: { pctSalaire: 1.0 } } } });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    // Un TNS pur n'a pas de collectif → étages collectifs nuls.
    for (const v of r.series.ijComplementaireCollective) expect(v).toBe(0);
    for (const v of r.series.renteInvalCollective) expect(v).toBe(0);
    expect(r.couvertureCollectiveIgnoreeTNS).toBe(true);
    // Constat attention présent
    const constats = evaluerToutesLesRegles(ctxFromProjection(e, r), "p1");
    expect(constats.some((c) => c.id.startsWith("collective_tns_ignoree"))).toBe(true);
  });

  it("H7 — président SAS (assimilé salarié) → couverture collective CONSERVÉE", () => {
    const e = entree({ statutPro: "president_sas", caisse: "CPAM", salaireBrutAnnuel: 60000, ancienneteMois: 0,
      couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 0, plafondJours: 1095, baseCalcul: "T1_T2" } } });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    expect(r.couvertureCollectiveIgnoreeTNS).toBe(false);
    expect(Math.max(...r.series.ijComplementaireCollective)).toBeGreaterThan(0);
  });

  // H8 — Président SAS (assimilé salarié) → accès au collectif + maintien
  it("H8 — président SAS (assimilé salarié) → maintien employeur possible + collectif appliqué", () => {
    const r = projeterArretMaladie(
      entree({ statutPro: "president_sas", caisse: "CPAM", salaireBrutAnnuel: 60000, ancienneteMois: 120,
        couvertureCollective: { ij: { pctSalaire: 0.9, franchise: 0, plafondJours: 1095, baseCalcul: "T1_T2" } } }),
      "cat2", referentiels
    );
    expect(Math.max(...r.series.maintienEmployeur)).toBeGreaterThan(0);
    expect(Math.max(...r.series.ijComplementaireCollective)).toBeGreaterThan(0);
  });

  // H9 — salaire pile au plafond IJSS : pas d'effet de bord (continuité)
  it("H9 — autour du plafond IJSS (1,4 SMIC), l'IJ croît puis plafonne à 41,95 €/j sans saut", () => {
    const v = buildPlafondVariables(referentiels);
    const cpam = (referentiels.caisses as any).caisses.CPAM;
    // Le plafond mord quand le salaire mensuel atteint 1,4 × SMIC = 2552,24 €,
    // soit brut annuel ≈ 30 627 €. Au-delà, SJB plafonné → IJ = 41,95 €/j.
    const ijBas = computeIJObligatoireJournaliere(30, cpam, entree({ salaireBrutAnnuel: 25000 }), v)!;
    const ijSeuil = computeIJObligatoireJournaliere(30, cpam, entree({ salaireBrutAnnuel: 30627 }), v)!;
    const ijHaut = computeIJObligatoireJournaliere(30, cpam, entree({ salaireBrutAnnuel: 80000 }), v)!;
    expect(ijBas).toBeLessThan(ijSeuil + 0.01);     // croissance
    expect(ijSeuil).toBeCloseTo(41.95, 0);          // au seuil = plafond
    expect(ijHaut).toBeCloseTo(41.95, 1);           // plateau (plafonné)
    expect(ijHaut).toBeGreaterThanOrEqual(ijSeuil - 0.01); // pas de chute
  });

  // H10 — invalidité cat3 : la MTP sourcée (1298,44 €) est ajoutée ;
  // si une caisse ne la renseigne PAS, le moteur ne l'invente jamais.
  it("H10 — cat3 = cat2 + MTP 1298,44 € (CPAM) ; MTP absente → cat3 == cat2 (non inventée)", () => {
    const e = entree({ caisse: "CPAM", salaireBrutAnnuel: 50000 });
    const idxInval = (r: ReturnType<typeof projeterArretMaladie>) => r.axe.findIndex((p) => p.jour >= 1095);
    const r2 = projeterArretMaladie(e, "cat2", referentiels);
    const r3 = projeterArretMaladie(e, "cat3", referentiels);
    const p2 = r2.series.pensionInvalObligatoire[idxInval(r2)];
    const p3 = r3.series.pensionInvalObligatoire[idxInval(r3)];
    // brut 50 000 → SAM plafonné PASS : cat2 = 2002,50 ; cat3 = 2002,50 + 1298,44.
    expect(p3 - p2).toBeCloseTo(1298.44, 1);

    // Caisse sans MTP renseignée → le moteur n'ajoute rien (cat3 retombe
    // sur 50 % SAM borné = cat2 pour ce niveau de salaire).
    const ref = JSON.parse(JSON.stringify(referentiels));
    delete ref.caisses.caisses.CPAM.invalidite.categories.cat3.majorationTiercePersonneMensuelle;
    const r3SansMtp = projeterArretMaladie(e, "cat3", ref);
    expect(r3SansMtp.series.pensionInvalObligatoire[idxInval(r3SansMtp)]).toBeCloseTo(p2, 2);
  });

  // H11 — couverture collective > 100 % du brut : bornée (principe
  // indemnitaire). Décision H11 appliquée : clamp pctSalaire à 1.0.
  it("H11 — couverture collective pctSalaire 1,5 → bornée à 100 % du brut + flag + constat", () => {
    const brutMensuel = 60000 / 12;
    const e = entree({ statutPro: "salarie_non_cadre", caisse: "CPAM", salaireBrutAnnuel: 60000, ancienneteMois: 0,
      couvertureCollective: { ij: { pctSalaire: 1.5, franchise: 0, plafondJours: 1095, baseCalcul: "T1_T2" } } });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const j180 = r.axe.findIndex((p) => p.jour === 180);
    const total = r.series.ijObligatoire[j180] + r.series.ijComplementaireCollective[j180];
    // Total borné à 100 % du brut (pctSalaire 1.5 traité comme 1.0).
    expect(total).toBeLessThanOrEqual(brutMensuel + 1);
    expect(total).toBeCloseTo(brutMensuel, 0);
    expect(r.surCouvertureBornee).toBe(true);
    // Constat info présent
    const constats = evaluerToutesLesRegles(ctxFromProjection(e, r), "p1");
    expect(constats.some((c) => c.id.startsWith("couverture_bornee_100"))).toBe(true);
  });

  it("H11 — contrat individuel invalidité baseInvalidite 1,2 → borné à 100 %", () => {
    const e = entree({ statutPro: "tns_liberal", caisse: "CARMF", salaireBrutAnnuel: 0, revenuTNSAnnuel: 80000,
      contratsIndividuels: [{ id: "inv", type: "invalidite", capitalOuMontant: 0, baseInvalidite: 1.2 }] });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const j1095 = r.axe.findIndex((p) => p.jour >= 1095);
    const baseMensuelle = 80000 / 12;
    // baseInvalidite 1.2 clampé à 1.0 → rente = 100 % de la base.
    expect(r.series.renteInvalIndividuelle[j1095]).toBeCloseTo(baseMensuelle, 0);
    expect(r.surCouvertureBornee).toBe(true);
  });

  // H12 — très haut revenu TNS : pas d'overflow
  it("H12 — TNS 300 000 € → projection finie, pas de NaN/Infinity", () => {
    const r = projeterArretMaladie(
      entree({ statutPro: "tns_liberal", caisse: "CARMF", salaireBrutAnnuel: 0, revenuTNSAnnuel: 300000 }),
      "cat2", referentiels
    );
    expect(Number.isFinite(r.revenuReferenceMensuel)).toBe(true);
    expect(r.revenuReferenceMensuel).toBeCloseTo(300000 / 12, 0);
    for (const key of Object.keys(r.series) as Array<keyof typeof r.series>) {
      for (const v of r.series[key]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  // H13 — jeune actif 18 ans : projection longue, pas de timeout/explosion
  it("H13 — age 18 (projection ~46 ans) : exécution rapide, axe fini, pas de crash", () => {
    const t0 = performance.now();
    const r = projeterArretMaladie(entree({ age: 18, ageRetraite: 64 }), "cat2", referentiels);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
    expect(r.finProjectionJour).toBe((64 - 18) * 365);
    expect(r.axe.length).toBeLessThan(80); // borné (paliers AM + ~46 points annuels)
    expect(r.axe[r.axe.length - 1].jour).toBe(r.finProjectionJour);
  });

  // H14 — embauche aujourd'hui : ancienneté 0 → pas de maintien
  it("H14 — date d'embauche = aujourd'hui → ancienneté 0, aucun maintien", () => {
    const tr = createEmptyTravail();
    tr.statutPro = "salarie_cadre"; tr.caisseAffiliation = "CPAM"; tr.salaireBrutAnnuel = 50000;
    tr.dateEmbauche = new Date().toISOString().slice(0, 10);
    const e = buildEntreePerso(minimalData({ salary1: "39000", travail: { p1: tr, p2: null } }), "p1")!;
    expect(e.ancienneteMois).toBe(0);
    const r = projeterArretMaladie(e, "cat2", referentiels);
    for (const v of r.series.maintienEmployeur) expect(v).toBe(0);
  });
});
