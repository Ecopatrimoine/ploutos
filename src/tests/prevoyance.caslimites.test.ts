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
import { createEmptyTravail } from "../lib/prevoyance/utils";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { PatrimonialData } from "../types/patrimoine";

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
    const e = entree({ statutPro: "salarie_cadre", salaireBrutAnnuel: 60000, revenuTNSAnnuel: 200000 });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    // Revenu de référence salarié = brut × coef, PAS basé sur le revenuTNS
    expect(r.revenuReferenceMensuel).toBeCloseTo((60000 * 0.75) / 12, 2);
    // L'IJ obligatoire CPAM est calculée sur le brut (60000/360×0.5), pas sur 200000
    const ij = computeIJObligatoireJournaliere(30, (referentiels.caisses as any).caisses.CPAM, e, vars);
    expect(ij).toBeCloseTo((60000 / 360) * 0.5, 1);
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
  // ⚠️ ÉCART : le moteur applique actuellement la couverture collective
  // quel que soit le statut. À trancher (récap T6) : exclusion moteur
  // pour les statuts TNS purs, OU contrôle en amont dans l'UI de saisie.
  it.skip("H7 — gérant majoritaire (TNS) → couverture collective ignorée [ÉCART à trancher]", () => {
    const r = projeterArretMaladie(
      entree({ statutPro: "gerant_majoritaire", caisse: "SSI", salaireBrutAnnuel: 0, revenuTNSAnnuel: 60000,
        couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 30, plafondJours: 1095, baseCalcul: "T1_T2" } } }),
      "cat2", referentiels
    );
    // Attendu (après décision) : un TNS pur n'a pas de collectif.
    for (const v of r.series.ijComplementaireCollective) expect(v).toBe(0);
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
  it("H9 — autour du plafond IJSS (CPAM patché 41,95 €/j), l'IJ croît puis plafonne sans saut", () => {
    const ref = JSON.parse(JSON.stringify(referentiels));
    ref.caisses.caisses.CPAM.ij.plafondFormule = "1.4 * SMIC_mensuel * 3 / 91.25 * 0.5";
    const v = buildPlafondVariables(ref);
    const cpam = ref.caisses.caisses.CPAM;
    // Seuil où le plafond mord : brut/360 × 0.5 = 41,95 → brut ≈ 30 204 €.
    const ijBas = computeIJObligatoireJournaliere(30, cpam, entree({ salaireBrutAnnuel: 25000 }), v)!;
    const ijSeuil = computeIJObligatoireJournaliere(30, cpam, entree({ salaireBrutAnnuel: 30204 }), v)!;
    const ijHaut = computeIJObligatoireJournaliere(30, cpam, entree({ salaireBrutAnnuel: 80000 }), v)!;
    expect(ijBas).toBeLessThan(ijSeuil + 0.01);     // croissance
    expect(ijSeuil).toBeCloseTo(41.95, 0);          // au seuil = plafond
    expect(ijHaut).toBeCloseTo(41.95, 1);           // plateau (plafonné)
    expect(ijHaut).toBeGreaterThanOrEqual(ijSeuil - 0.01); // pas de chute
  });

  // H10 — invalidité cat3 sans MTP renseignée : ne pas inventer
  it("H10 — cat3 avec majoration tierce personne TO_VERIFY → pension cat3 == cat2 (MTP non inventée)", () => {
    const e = entree({ caisse: "CPAM", salaireBrutAnnuel: 50000 });
    const idxInval = (r: ReturnType<typeof projeterArretMaladie>) => r.axe.findIndex((p) => p.jour >= 1095);
    const r2 = projeterArretMaladie(e, "cat2", referentiels);
    const r3 = projeterArretMaladie(e, "cat3", referentiels);
    // CPAM cat2 et cat3 ont tauxBase 0.50 ; MTP TO_VERIFY non ajoutée.
    expect(r3.series.pensionInvalObligatoire[idxInval(r3)]).toBe(r2.series.pensionInvalObligatoire[idxInval(r2)]);
  });

  // H11 — couverture collective > 100 % du brut : devrait être bornée.
  // ⚠️ ÉCART : le moteur applique pctSalaire tel quel (cible = brut ×
  // pctSalaire), même > 1 → revenu de remplacement > revenu d'activité.
  // À trancher (récap T6) : borner pctSalaire à 1 (règle assurance =
  // pas de sur-indemnisation), dans le moteur OU à la saisie UI.
  it.skip("H11 — couverture collective pctSalaire 1,5 → bornée à 100 % du brut [ÉCART à trancher]", () => {
    const brutMensuel = 60000 / 12;
    const r = projeterArretMaladie(
      entree({ statutPro: "salarie_non_cadre", caisse: "CPAM", salaireBrutAnnuel: 60000, ancienneteMois: 0,
        couvertureCollective: { ij: { pctSalaire: 1.5, franchise: 0, plafondJours: 1095, baseCalcul: "T1_T2" } } }),
      "cat2", referentiels
    );
    const j180 = r.axe.findIndex((p) => p.jour === 180);
    const total = r.series.ijObligatoire[j180] + r.series.ijComplementaireCollective[j180];
    // Attendu (après décision) : total borné à 100 % du brut.
    expect(total).toBeLessThanOrEqual(brutMensuel + 1);
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
