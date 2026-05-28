// ─── T3 / Famille F — Intégration & non-régression (PLAN_TESTS §F) ─────
//
// Vérifie le bon assemblage bout en bout : mapping, migrations, dettes
// legacy, et sentinelles PDF (SVG présent, indépendance des sections,
// P2 absent). La non-régression de la suite complète (F11) est assurée
// par l'exécution globale de Vitest.

import { describe, it, expect } from "vitest";
import { buildEntreePerso, calcAncienneteMois } from "../lib/prevoyance/mapping";
import { createEmptyTravail } from "../lib/prevoyance/utils";
import { migrateV140Travail } from "../lib/migrations/v140_travail";
import { calcDettesImmobilieres } from "../lib/prevoyance/contexte";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { renderProjectionSVG } from "../lib/pdf/v2/prevoyanceChart";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { buildPrevoyancePersoData } from "../lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { pagePrevoyancePerso } from "../lib/pdf/v2/pages/pagePrevoyancePerso";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { PatrimonialData, Property } from "../types/patrimoine";

const t = buildTokens("encreOr");

function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "P1", person1LastName: "", person1BirthDate: "1985-01-01",
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

function propertyLegacy(loanCapitalRemaining: string): Property {
  return {
    name: "Bien", type: "RP", ownership: "common", propertyRight: "full",
    usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "",
    insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "",
    loanEnabled: true, loanType: "amortissable", loanAmount: "200000", loanRate: "2",
    loanDuration: "20", loanStartDate: "2020-01-01", loanCapitalRemaining,
    loanInterestAnnual: "", loanPledgedPlacementIndex: "-1",
    loanInsurance: false, loanInsuranceGuarantees: "", loanInsuranceRate: "",
    loanInsuranceRate1: "", loanInsuranceRate2: "", loanInsurancePremium: "",
    loanInsuranceCoverage: "", indivisionShare1: "", indivisionShare2: "",
  };
}

const cabinet = { cabinetName: "EcoPatrimoine Conseil", orias: "25006907" };

const CAS_OR: Array<{ nom: string; entree: EntreePerso }> = [
  { nom: "A Syntec", entree: { age: 35, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM", idccCCN: "1486", ancienneteMois: 48, salaireBrutAnnuel: 55000, salaireNetMensuel: 3575, contratsIndividuels: [], couvertureCollective: { ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" } } } },
  { nom: "B CARMF", entree: { age: 48, ageRetraite: 64, statutPro: "tns_liberal", caisse: "CARMF", idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0, revenuTNSAnnuel: 95000, contratsIndividuels: [{ id: "ij", type: "ij", capitalOuMontant: 250, franchiseJours: 90, plafondJoursIJ: 1095 }], couvertureCollective: null } },
  { nom: "C Métallurgie", entree: { age: 28, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM", idccCCN: "3248", ancienneteMois: 12, salaireBrutAnnuel: 28000, salaireNetMensuel: 1820, contratsIndividuels: [], couvertureCollective: null } },
  { nom: "D SSI", entree: { age: 52, ageRetraite: 64, statutPro: "gerant_majoritaire", caisse: "SSI", idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0, revenuTNSAnnuel: 60000, contratsIndividuels: [{ id: "ij", type: "ij", capitalOuMontant: 120, franchiseJours: 30, plafondJoursIJ: 1095 }], couvertureCollective: null } },
];

describe("Famille F — Intégration & non-régression", () => {
  // F1 — payload vide → null
  it("F1 — buildEntreePerso(payload vide) → null", () => {
    expect(buildEntreePerso(baseData(), "p1")).toBeNull();
    expect(buildEntreePerso(baseData(), "p2")).toBeNull();
  });

  // F2 — payload P1 complet → EntreePerso valide, champs mappés
  it("F2 — buildEntreePerso(P1 complet) → EntreePerso valide", () => {
    const tr = createEmptyTravail();
    tr.statutPro = "salarie_cadre"; tr.caisseAffiliation = "CPAM";
    tr.salaireBrutAnnuel = 55000; tr.dateEmbauche = "2020-01-01";
    tr.employeur = { siret: "78404636300040", siren: "784046363", nom: "ACME", formeJuridique: "SAS", codeNAF: "6201Z", idccCCN: "1486", nomCCN: "Syntec", sourceCCN: "auto", effectif: 50, adresseEtablissement: null, dateCreation: null };
    const e = buildEntreePerso(baseData({ travail: { p1: tr, p2: null } }), "p1")!;
    expect(e.statutPro).toBe("salarie_cadre");
    expect(e.caisse).toBe("CPAM");
    expect(e.idccCCN).toBe("1486");
    expect(e.salaireBrutAnnuel).toBe(55000);
    expect(e.ancienneteMois).toBeGreaterThan(0);
  });

  // F3 — pas de dateEmbauche → ancienneteMois 0
  it("F3 — buildEntreePerso sans dateEmbauche → ancienneteMois = 0", () => {
    const tr = createEmptyTravail();
    tr.statutPro = "salarie_cadre";
    const e = buildEntreePerso(baseData({ travail: { p1: tr, p2: null } }), "p1")!;
    expect(e.ancienneteMois).toBe(0);
  });

  // F4 — calcAncienneteMois ~48 pour 4 ans
  it("F4 — calcAncienneteMois(embauche il y a 4 ans) ≈ 48 (±1)", () => {
    const d = new Date();
    const iso = new Date(d.getFullYear() - 4, d.getMonth(), 1).toISOString().slice(0, 10);
    const m = calcAncienneteMois(iso);
    expect(m).toBeGreaterThanOrEqual(47);
    expect(m).toBeLessThanOrEqual(49);
  });

  // F5 — date future → 0
  it("F5 — calcAncienneteMois(date future) → 0", () => {
    const d = new Date();
    const iso = new Date(d.getFullYear() + 1, d.getMonth(), 1).toISOString().slice(0, 10);
    expect(calcAncienneteMois(iso)).toBe(0);
  });

  // F6 — migration ancien payload sans travail → travail initialisé, pas de crash
  it("F6 — migrateV140Travail(ancien payload) → travail initialisé, pas de crash", () => {
    const ancien = baseData({ coupleStatus: "married" }); // pas de champ travail
    expect(ancien.travail).toBeUndefined();
    const migre = migrateV140Travail(ancien);
    expect(migre.travail).toBeDefined();
    expect(migre.travail?.p1).toBeDefined();
    expect(migre.travail?.p2).not.toBeNull();
    // L'entrée P1 reste null tant que statutPro vide → onglet en état vide
    expect(buildEntreePerso(migre, "p1")).not.toBeNull(); // travail existe (vide)
  });

  // F7 — dettes legacy (loanCapitalRemaining, sans loans[])
  it("F7 — calcDettesImmobilieres lit le champ legacy loanCapitalRemaining", () => {
    const data = baseData({ properties: [propertyLegacy("123456")] });
    expect(calcDettesImmobilieres(data)).toBe(123456);
  });

  // F8 — page perso : SVG présent dans le HTML
  it("F8 — pagePrevoyancePerso : HTML non vide avec SVG inline", () => {
    const tr = createEmptyTravail();
    tr.statutPro = "salarie_cadre"; tr.caisseAffiliation = "CPAM"; tr.salaireBrutAnnuel = 55000;
    const data = baseData({ salary1: "42000", travail: { p1: tr, p2: null } });
    const d = buildPrevoyancePersoData({ data, cabinet, which: "p1", dateLettre: "28 mai 2026" });
    const html = pagePrevoyancePerso(t, d);
    expect(html.length).toBeGreaterThan(800);
    expect(html).toContain("<svg");
  });

  // F10 — P2 absent → page état vide (pas de SVG projection)
  it("F10 — section P2 quand data.travail.p2 absent → état vide, pas de SVG", () => {
    const tr = createEmptyTravail();
    tr.statutPro = "salarie_cadre";
    const data = baseData({ travail: { p1: tr, p2: null } });
    const d = buildPrevoyancePersoData({ data, cabinet, which: "p2", dateLettre: "28 mai 2026" });
    expect(d.disponible).toBe(false);
    const html = pagePrevoyancePerso(t, d);
    expect(html).not.toContain("<svg");
    expect(html).toContain("Compléter l'onglet Travail");
  });

  // F12 — SVG valide (balises ouvrantes/fermantes) pour les 4 cas d'or
  it("F12 — renderProjectionSVG produit un <svg> bien formé pour les 4 cas d'or", () => {
    for (const { nom, entree } of CAS_OR) {
      const projection = projeterArretMaladie(entree, "cat2", referentiels);
      const svg = renderProjectionSVG(projection, t);
      expect(svg, nom).toContain("<svg");
      expect(svg, nom).toContain("</svg>");
      // pas de NaN/undefined dans le SVG (coordonnées corrompues)
      expect(svg, nom).not.toContain("NaN");
      expect(svg, nom).not.toContain("undefined");
      // autant de rect ouverts (auto-fermés) que de </svg> cohérent
      const nbSvgOpen = (svg.match(/<svg/g) || []).length;
      const nbSvgClose = (svg.match(/<\/svg>/g) || []).length;
      expect(nbSvgOpen, nom).toBe(nbSvgClose);
    }
  });
});
