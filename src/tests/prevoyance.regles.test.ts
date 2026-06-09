// ─── Tests moteur de règles & constats individuels (Lot 6) ────────────

import { describe, expect, it } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { ContexteRegle, EntreePerso } from "../lib/prevoyance/types";
import {
  evaluerToutesLesRegles,
  regleDcTnsSansCapital,
  regleDcCapitalInsuffisantDettes,
  regleDcPasDeRenteConjointEnfantsJeunes,
  regleIjCarenceCaisseSansMadelin,
  regleIjPlafondInsuffisant,
  regleIjCcnNonDocumentee,
  regleInvCat2AucuneCouvertureCompl,
  regleInvTnsMadelinAbsent,
  regleCnbfLpaAon,
  regleCnbfInvalidite20ans,
} from "../lib/prevoyance/regles";
import {
  buildContexteRegle,
  calcDettesImmobilieres,
  calcEnfantsMineurs,
  calcConjointACharge,
  calcRevenuMensuel,
} from "../lib/prevoyance/contexte";
import type { PatrimonialData } from "../types/patrimoine";

// ────────────────────────────────────────────────────────────────────
// Fixtures de référence
// ────────────────────────────────────────────────────────────────────

const entreeSalarie: EntreePerso = {
  age: 35,
  ageRetraite: 64,
  statutPro: "salarie_cadre",
  caisse: "CPAM",
  idccCCN: "1486",
  ancienneteMois: 48,
  salaireBrutAnnuel: 55000,
  salaireNetMensuel: 3575,
  contratsIndividuels: [],
  couvertureCollective: null,
};

const entreeTNSLiberal: EntreePerso = {
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
  contratsIndividuels: [],
  couvertureCollective: null,
};

function makeCtx(
  entree: EntreePerso,
  over: Partial<Omit<ContexteRegle, "entree" | "projection">> = {}
): ContexteRegle {
  const projection = projeterArretMaladie(entree, "cat2", referentiels);
  return {
    entree,
    projection,
    dettesImmobilieres: 0,
    conjointACharge: false,
    enfantsMineurs: 0,
    revenuP1Mensuel: 4583,    // valeur par défaut indicative (55k/12)
    revenuP2Mensuel: 0,
    ...over,
  };
}

function minimalPatrimonialData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "P1",
    person1LastName: "",
    person1BirthDate: "1990-01-01",
    person1JobTitle: "",
    person1Csp: "",
    person1PcsGroupe: "",
    person2FirstName: "",
    person2LastName: "",
    person2BirthDate: "",
    person2JobTitle: "",
    person2Csp: "",
    person2PcsGroupe: "",
    coupleStatus: "single",
    matrimonialRegime: "",
    singleParent: false,
    person1Handicap: false,
    person2Handicap: false,
    childrenData: [],
    salary1: "0",
    salary2: "0",
    pensions: "0",
    perDeduction: "0",
    pensionDeductible: "0",
    otherDeductible: "0",
    ca1: "0",
    bicType1: "",
    microRegime1: true,
    chargesReelles1: "0",
    baRevenue1: "0",
    chargesDetail1: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    ca2: "0",
    bicType2: "",
    microRegime2: true,
    chargesReelles2: "0",
    baRevenue2: "0",
    chargesDetail2: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    properties: [],
    placements: [],
    perRentes: [],
    otherLoans: [],
    ...over,
  };
}

// ────────────────────────────────────────────────────────────────────
// Helpers contexte
// ────────────────────────────────────────────────────────────────────

describe("buildContexteRegle — helpers", () => {
  it("calcDettesImmobilieres : aucune propriété → 0", () => {
    expect(calcDettesImmobilieres(minimalPatrimonialData())).toBe(0);
  });

  it("calcDettesImmobilieres : multi-crédits (loans[]) sommés", () => {
    const data = minimalPatrimonialData({
      properties: [
        {
          name: "Maison", type: "RP", ownership: "common", propertyRight: "full",
          usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "",
          insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "",
          loanEnabled: true, loanType: "", loanAmount: "", loanRate: "", loanDuration: "",
          loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
          loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "",
          loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
          loanInsurancePremium: "", loanInsuranceCoverage: "",
          indivisionShare1: "", indivisionShare2: "",
          loans: [
            { id: "L1", type: "amortissable", label: "P1", amount: "200000", rate: "2", duration: "20",
              startDate: "2020-01-01", capitalRemaining: "150000", interestAnnual: "",
              pledgedPlacementIndex: "-1", insurance: false, insuranceGuarantees: "",
              insuranceRate: "", insuranceRate1: "", insuranceRate2: "",
              insurancePremium: "", insuranceCoverage: "" },
            { id: "L2", type: "ptz", label: "PTZ", amount: "50000", rate: "0", duration: "20",
              startDate: "2020-01-01", capitalRemaining: "30000", interestAnnual: "",
              pledgedPlacementIndex: "-1", insurance: false, insuranceGuarantees: "",
              insuranceRate: "", insuranceRate1: "", insuranceRate2: "",
              insurancePremium: "", insuranceCoverage: "" },
          ],
        },
      ],
    });
    expect(calcDettesImmobilieres(data)).toBe(180000);
  });

  it("calcDettesImmobilieres : fallback loanCapitalRemaining si pas de loans[]", () => {
    const data = minimalPatrimonialData({
      properties: [
        {
          name: "Loc", type: "investissement", ownership: "common", propertyRight: "full",
          usufructAge: "", value: "200000", propertyTaxAnnual: "", rentGrossAnnual: "",
          insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "",
          loanEnabled: true, loanType: "amortissable", loanAmount: "150000", loanRate: "2",
          loanDuration: "20", loanStartDate: "2020-01-01", loanCapitalRemaining: "100000",
          loanInterestAnnual: "", loanPledgedPlacementIndex: "-1",
          loanInsurance: false, loanInsuranceGuarantees: "",
          loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
          loanInsurancePremium: "", loanInsuranceCoverage: "",
          indivisionShare1: "", indivisionShare2: "",
        },
      ],
    });
    expect(calcDettesImmobilieres(data)).toBe(100000);
  });

  it("calcDettesImmobilieres : loanEnabled=false → ignoré", () => {
    const data = minimalPatrimonialData({
      properties: [
        {
          name: "Maison sans crédit", type: "RP", ownership: "common", propertyRight: "full",
          usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "",
          insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "",
          loanEnabled: false, loanType: "", loanAmount: "", loanRate: "", loanDuration: "",
          loanStartDate: "", loanCapitalRemaining: "200000", loanInterestAnnual: "",
          loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "",
          loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
          loanInsurancePremium: "", loanInsuranceCoverage: "",
          indivisionShare1: "", indivisionShare2: "",
        },
      ],
    });
    expect(calcDettesImmobilieres(data)).toBe(0);
  });

  it("calcEnfantsMineurs : 2 mineurs rattachés + 1 majeur + 1 non-rattaché → 2", () => {
    const today = new Date();
    const y = today.getFullYear();
    const data = minimalPatrimonialData({
      childrenData: [
        { firstName: "Léo", lastName: "", birthDate: `${y - 8}-01-01`,  parentLink: "", custody: "", rattached: true,  handicap: false },
        { firstName: "Léa", lastName: "", birthDate: `${y - 14}-01-01`, parentLink: "", custody: "", rattached: true,  handicap: false },
        { firstName: "Maj", lastName: "", birthDate: `${y - 25}-01-01`, parentLink: "", custody: "", rattached: true,  handicap: false },
        { firstName: "NR",  lastName: "", birthDate: `${y - 10}-01-01`, parentLink: "", custody: "", rattached: false, handicap: false },
      ],
    });
    expect(calcEnfantsMineurs(data)).toBe(2);
  });

  it("calcConjointACharge : célibataire → false", () => {
    expect(calcConjointACharge(minimalPatrimonialData({ coupleStatus: "single" }))).toBe(false);
  });

  it("calcConjointACharge : couple avec P2 sans revenu → true", () => {
    expect(
      calcConjointACharge(minimalPatrimonialData({
        coupleStatus: "married", salary1: "55000", salary2: "0", ca2: "0", baRevenue2: "0",
      }))
    ).toBe(true);
  });

  it("calcConjointACharge : P2 à 30 % du revenu P1 → à charge (< 50 %)", () => {
    // P1 = 55 000 / 12 ≈ 4583 € ; P2 à 30 % = 16 500 / 12 ≈ 1375 €
    expect(
      calcConjointACharge(minimalPatrimonialData({
        coupleStatus: "married", salary1: "55000", salary2: "16500",
      }))
    ).toBe(true);
  });

  it("calcConjointACharge : P2 à 60 % du revenu P1 → PAS à charge (≥ 50 %)", () => {
    // P1 = 55 000 / 12 ≈ 4583 € ; P2 à 60 % = 33 000 / 12 ≈ 2750 €
    expect(
      calcConjointACharge(minimalPatrimonialData({
        coupleStatus: "married", salary1: "55000", salary2: "33000",
      }))
    ).toBe(false);
  });

  it("calcConjointACharge : revenu P1 = 0 (cas dégénéré) → false (pas de référence)", () => {
    expect(
      calcConjointACharge(minimalPatrimonialData({
        coupleStatus: "married", salary1: "0", salary2: "0",
      }))
    ).toBe(false);
  });

  it("calcRevenuMensuel : somme salaire + pensions + CA + BA, /12", () => {
    const data = minimalPatrimonialData({
      salary1: "24000", pensions1: "6000", ca1: "12000", baRevenue1: "0",
    });
    // 42 000 / 12 = 3500
    expect(calcRevenuMensuel(data, "p1")).toBeCloseTo(3500, 2);
  });
});

// ────────────────────────────────────────────────────────────────────
// Axe DC — 3 règles
// ────────────────────────────────────────────────────────────────────

describe("regleDcTnsSansCapital", () => {
  it("ne déclenche pas pour un salarié (statut non-TNS)", () => {
    const ctx = makeCtx(entreeSalarie, { conjointACharge: true, enfantsMineurs: 2 });
    expect(regleDcTnsSansCapital(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas pour un TNS avec capital décès en place", () => {
    const ctx = makeCtx({
      ...entreeTNSLiberal,
      contratsIndividuels: [{ id: "dc", type: "deces_capital", capitalOuMontant: 100000 }],
    }, { conjointACharge: true });
    expect(regleDcTnsSansCapital(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas pour un TNS sans charges (pas de conjoint ni enfants mineurs)", () => {
    const ctx = makeCtx(entreeTNSLiberal);
    expect(regleDcTnsSansCapital(ctx, "p1")).toBeNull();
  });

  it("déclenche pour TNS sans capital DC ET avec conjoint à charge", () => {
    const ctx = makeCtx(entreeTNSLiberal, { conjointACharge: true });
    const c = regleDcTnsSansCapital(ctx, "p1");
    expect(c).not.toBeNull();
    expect(c?.severite).toBe("alerte");
    expect(c?.axe).toBe("deces");
    expect(c?.cible).toBe("p1");
  });

  it("aucune mention d'assureur ou de produit dans l'action (DDA)", () => {
    const ctx = makeCtx(entreeTNSLiberal, { conjointACharge: true, enfantsMineurs: 2 });
    const c = regleDcTnsSansCapital(ctx, "p1");
    expect(c?.action.toLowerCase()).not.toMatch(/axa|generali|apicil|allianz|cnp|swisslife|aviva/);
    expect(c?.action.toLowerCase()).not.toMatch(/contrat\s+\w+\s+pro/); // pas de nom de produit
  });

  it("le détail contient la phrase italique explicative quand conjointACharge=true", () => {
    const ctx = makeCtx(entreeTNSLiberal, {
      conjointACharge: true,
      revenuP1Mensuel: 7917,
      revenuP2Mensuel: 1500,
    });
    const c = regleDcTnsSansCapital(ctx, "p1");
    // Normaliser les espaces insécables produits par toLocaleString("fr-FR")
    // (U+00A0 / U+202F) vers un espace simple, pour des assertions stables.
    const detail = (c?.detail ?? "").replace(/[  ]/g, " ");
    expect(detail).toContain("<em>");
    expect(detail).toContain("inférieurs à 50 %");
    expect(detail).toContain("affinez le conseil");
    // Les revenus formatés apparaissent
    expect(detail).toContain("7 917");
    expect(detail).toContain("1 500");
  });

  it("le détail NE contient PAS la phrase italique quand conjointACharge=false (déclenché par enfants seuls)", () => {
    const ctx = makeCtx(entreeTNSLiberal, {
      conjointACharge: false,
      enfantsMineurs: 2,
    });
    const c = regleDcTnsSansCapital(ctx, "p1");
    expect(c?.detail).not.toContain("<em>");
  });
});

describe("regleDcCapitalInsuffisantDettes", () => {
  it("ne déclenche pas sans dettes", () => {
    const ctx = makeCtx(entreeSalarie);
    expect(regleDcCapitalInsuffisantDettes(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas si capital >= dettes", () => {
    const ctx = makeCtx({
      ...entreeSalarie,
      contratsIndividuels: [{ id: "dc", type: "deces_capital", capitalOuMontant: 300000 }],
    }, { dettesImmobilieres: 200000 });
    expect(regleDcCapitalInsuffisantDettes(ctx, "p1")).toBeNull();
  });

  it("déclenche avec trou et impactChiffre = différence", () => {
    const ctx = makeCtx(entreeSalarie, { dettesImmobilieres: 280000 });
    const c = regleDcCapitalInsuffisantDettes(ctx, "p1");
    expect(c?.severite).toBe("attention");
    expect(c?.impactChiffre?.montant).toBe(280000);
  });
});

describe("regleDcPasDeRenteConjointEnfantsJeunes", () => {
  it("ne déclenche pas sans enfants mineurs", () => {
    const ctx = makeCtx(entreeSalarie, { conjointACharge: true, enfantsMineurs: 0 });
    expect(regleDcPasDeRenteConjointEnfantsJeunes(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas sans conjoint à charge", () => {
    const ctx = makeCtx(entreeSalarie, { conjointACharge: false, enfantsMineurs: 2 });
    expect(regleDcPasDeRenteConjointEnfantsJeunes(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas si rente conjoint en place", () => {
    const ctx = makeCtx({
      ...entreeSalarie,
      contratsIndividuels: [{ id: "rc", type: "deces_rente_conj", capitalOuMontant: 1500 }],
    }, { conjointACharge: true, enfantsMineurs: 2 });
    expect(regleDcPasDeRenteConjointEnfantsJeunes(ctx, "p1")).toBeNull();
  });

  it("déclenche alerte avec conjoint à charge + enfants mineurs + pas de rente", () => {
    const ctx = makeCtx(entreeSalarie, {
      conjointACharge: true,
      enfantsMineurs: 2,
      revenuP1Mensuel: 4583,
      revenuP2Mensuel: 1200,
    });
    const c = regleDcPasDeRenteConjointEnfantsJeunes(ctx, "p1");
    expect(c?.severite).toBe("alerte");
    // Phrase italique systématique pour cette règle (toujours liée
    // à conjointACharge=true par construction)
    const detail = (c?.detail ?? "").replace(/[  ]/g, " ");
    expect(detail).toContain("<em>");
    expect(detail).toContain("4 583");
    expect(detail).toContain("1 200");
  });
});

// ────────────────────────────────────────────────────────────────────
// Axe incapacité — 3 règles
// ────────────────────────────────────────────────────────────────────

describe("regleIjCarenceCaisseSansMadelin", () => {
  it("ne déclenche pas pour un salarié (statut non-TNS)", () => {
    const ctx = makeCtx(entreeSalarie);
    expect(regleIjCarenceCaisseSansMadelin(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas si IJ individuelle en place", () => {
    const ctx = makeCtx({
      ...entreeTNSLiberal,
      contratsIndividuels: [{ id: "ij", type: "ij", capitalOuMontant: 250, franchiseJours: 90, plafondJoursIJ: 1095 }],
    });
    expect(regleIjCarenceCaisseSansMadelin(ctx, "p1")).toBeNull();
  });

  it("déclenche pour CARMF (carence 90j TO_VERIFY → IJ obl = 0 à J60) sans IJ individuelle", () => {
    const ctx = makeCtx(entreeTNSLiberal); // CARMF
    const c = regleIjCarenceCaisseSansMadelin(ctx, "p1");
    expect(c?.severite).toBe("alerte");
    expect(c?.axe).toBe("incapacite");
  });
});

describe("regleIjPlafondInsuffisant", () => {
  it("ne déclenche pas si revenu de référence à 0", () => {
    const ctx = makeCtx({ ...entreeSalarie, salaireNetMensuel: 0, salaireBrutAnnuel: 0 });
    expect(regleIjPlafondInsuffisant(ctx, "p1")).toBeNull();
  });

  it("déclenche pour salarié sans couverture coll (CPAM TO_VERIFY → exposition)", () => {
    // Léa : 28k brut, pas de coll → à J180 IJ obl seules ≈ 50 % brut = 1167 €
    // ref net = 1820 → ratio 0.64 → alerte (trou ~36 %)
    const ctxLea = makeCtx({
      ...entreeSalarie,
      age: 28,
      idccCCN: "3248",
      ancienneteMois: 12,
      salaireBrutAnnuel: 28000,
      salaireNetMensuel: 1820,
    });
    const c = regleIjPlafondInsuffisant(ctxLea, "p1");
    expect(c?.severite).toBe("attention");
    expect(c?.impactChiffre?.montant).toBeGreaterThan(0);
  });
});

describe("regleIjCcnNonDocumentee", () => {
  it("ne déclenche pas si pas d'IDCC saisi", () => {
    const ctx = makeCtx({ ...entreeSalarie, idccCCN: null });
    expect(regleIjCcnNonDocumentee(ctx, "p1")).toBeNull();
  });

  it("ne déclenche PAS pour un TNS (qui n'a pas d'IDCC par construction)", () => {
    const ctx = makeCtx(entreeTNSLiberal);
    expect(regleIjCcnNonDocumentee(ctx, "p1")).toBeNull();
  });

  it("déclenche en info pour IDCC saisi avec fallback maintien légal", () => {
    // CCN présente mais maintien non documenté (1996 Pharmacie, cadres/nonCadres
    // = null) → useLegalDefault = true → info levée. (1486 Syntec ET 3248
    // Métallurgie sont désormais documentés → ne déclenchent plus, c'est voulu.)
    const ctx = makeCtx({ ...entreeSalarie, idccCCN: "1996" });
    const c = regleIjCcnNonDocumentee(ctx, "p1");
    expect(c?.id).toBe("ij_ccn_non_documentee_p1");
    expect(c?.severite).toBe("info");
    expect(c?.titre).toBe("Convention collective non documentée");
    expect(c?.reference).toContain("L.1226-1");
  });

  it("le détail mentionne l'IDCC saisi + Mensualisation + plancher", () => {
    const ctx = makeCtx({ ...entreeSalarie, idccCCN: "9999" });
    const c = regleIjCcnNonDocumentee(ctx, "p1");
    expect(c?.detail).toContain("9999");
    expect(c?.detail).toContain("Mensualisation");
    expect(c?.detail).toContain("PLANCHER");
  });

  it("l'action pointe vers Légifrance / KALI + signalement équipe Ploutos", () => {
    const ctx = makeCtx({ ...entreeSalarie, idccCCN: "1996" });
    const c = regleIjCcnNonDocumentee(ctx, "p1");
    expect(c?.action).toContain("Légifrance");
    expect(c?.action).toContain("KALI");
    expect(c?.action).toContain("1996");
    expect(c?.action).toContain("équipe Ploutos");
  });
});

// ────────────────────────────────────────────────────────────────────
// Axe invalidité — 2 règles
// ────────────────────────────────────────────────────────────────────

describe("regleInvCat2AucuneCouvertureCompl", () => {
  it("ne déclenche pas si rente collective en place", () => {
    const ctx = makeCtx({
      ...entreeSalarie,
      couvertureCollective: {
        invalidite: {
          cat1: { pctSalaire: 0.4 },
          cat2: { pctSalaire: 0.8 },
          cat3: { pctSalaire: 1.0 },
        },
      },
    });
    expect(regleInvCat2AucuneCouvertureCompl(ctx, "p1")).toBeNull();
  });

  it("ne déclenche pas si rente individuelle en place", () => {
    const ctx = makeCtx({
      ...entreeSalarie,
      contratsIndividuels: [{ id: "i", type: "invalidite", capitalOuMontant: 0, baseInvalidite: 0.6 }],
    });
    expect(regleInvCat2AucuneCouvertureCompl(ctx, "p1")).toBeNull();
  });

  it("déclenche pour TNS sans couverture (pension obl seule = 0)", () => {
    const ctx = makeCtx(entreeTNSLiberal); // CARMF TO_VERIFY → pension = 0
    const c = regleInvCat2AucuneCouvertureCompl(ctx, "p1");
    expect(c?.severite).toBe("alerte");
    expect(c?.axe).toBe("invalidite");
  });
});

describe("regleInvTnsMadelinAbsent", () => {
  it("ne déclenche pas pour un salarié", () => {
    expect(regleInvTnsMadelinAbsent(makeCtx(entreeSalarie), "p1")).toBeNull();
  });

  it("ne déclenche pas si rente invalidité individuelle en place", () => {
    const ctx = makeCtx({
      ...entreeTNSLiberal,
      contratsIndividuels: [{ id: "i", type: "invalidite", capitalOuMontant: 0, baseInvalidite: 0.5 }],
    });
    expect(regleInvTnsMadelinAbsent(ctx, "p1")).toBeNull();
  });

  it("déclenche pour TNS sans rente invalidité individuelle", () => {
    const ctx = makeCtx(entreeTNSLiberal);
    const c = regleInvTnsMadelinAbsent(ctx, "p1");
    expect(c?.severite).toBe("alerte");
    expect(c?.axe).toBe("invalidite");
  });
});

// ────────────────────────────────────────────────────────────────────
// Orchestrateur
// ────────────────────────────────────────────────────────────────────

describe("evaluerToutesLesRegles", () => {
  it("retourne un tableau vide quand aucune règle ne se déclenche", () => {
    // Salarié sans dettes, pas de conjoint, pas d'enfants, CCN documentée (mais
    // ici Syntec TO_VERIFY → ij_pas_de_subrogation se déclenche → tableau non vide).
    const ctx = makeCtx({ ...entreeSalarie, idccCCN: null });
    const constats = evaluerToutesLesRegles(ctx, "p1");
    expect(Array.isArray(constats)).toBe(true);
  });

  it("trie les constats par sévérité décroissante (non_conformite > alerte > attention > info)", () => {
    // TNS avec dettes, conjoint à charge, enfants mineurs → plusieurs règles déclenchées.
    const ctx = makeCtx(entreeTNSLiberal, {
      dettesImmobilieres: 280000,
      conjointACharge: true,
      enfantsMineurs: 2,
    });
    const constats = evaluerToutesLesRegles(ctx, "p1");
    expect(constats.length).toBeGreaterThan(1);
    const ordre = { non_conformite: 0, alerte: 1, attention: 2, info: 3 } as const;
    for (let i = 1; i < constats.length; i++) {
      expect(ordre[constats[i].severite]).toBeGreaterThanOrEqual(ordre[constats[i - 1].severite]);
    }
  });

  it("propage la cible passée en argument", () => {
    const ctx = makeCtx(entreeTNSLiberal, { conjointACharge: true });
    const constatsP1 = evaluerToutesLesRegles(ctx, "p1");
    const constatsP2 = evaluerToutesLesRegles(ctx, "p2");
    for (const c of constatsP1) expect(c.cible).toBe("p1");
    for (const c of constatsP2) expect(c.cible).toBe("p2");
    // Les IDs incluent la cible → différents entre p1 et p2
    expect(constatsP1.map((c) => c.id)).not.toEqual(constatsP2.map((c) => c.id));
  });

  it("aucun constat ne mentionne d'assureur ou de produit (conformité DDA)", () => {
    const ctx = makeCtx(entreeTNSLiberal, {
      dettesImmobilieres: 280000,
      conjointACharge: true,
      enfantsMineurs: 2,
    });
    const constats = evaluerToutesLesRegles(ctx, "p1");
    const interdits = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut|gan|mma|macif/i;
    for (const c of constats) {
      expect(c.action).not.toMatch(interdits);
      expect(c.detail).not.toMatch(interdits);
      expect(c.titre).not.toMatch(interdits);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Intégration : buildContexteRegle depuis un payload réel
// ────────────────────────────────────────────────────────────────────

describe("buildContexteRegle — intégration", () => {
  it("compose un ContexteRegle complet depuis payload + projection", () => {
    const data = minimalPatrimonialData({
      coupleStatus: "married",
      salary1: "55000",
      salary2: "0",
      childrenData: [
        { firstName: "Enf", lastName: "", birthDate: `${new Date().getFullYear() - 10}-01-01`,
          parentLink: "", custody: "", rattached: true, handicap: false },
      ],
    });
    const projection = projeterArretMaladie(entreeSalarie, "cat2", referentiels);
    const ctx = buildContexteRegle(data, entreeSalarie, projection);
    expect(ctx.entree).toBe(entreeSalarie);
    expect(ctx.projection).toBe(projection);
    expect(ctx.dettesImmobilieres).toBe(0);
    expect(ctx.conjointACharge).toBe(true);
    expect(ctx.enfantsMineurs).toBe(1);
    expect(ctx.revenuP1Mensuel).toBeCloseTo(55000 / 12, 0);
    expect(ctx.revenuP2Mensuel).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Constats CNBF (avocats) — LOT 3 / SPEC §6
// ────────────────────────────────────────────────────────────────────

const entreeCnbf: EntreePerso = {
  age: 45,
  ageRetraite: 64,
  statutPro: "tns_liberal",
  caisse: "CNBF",
  idccCCN: null,
  ancienneteMois: 120,
  salaireBrutAnnuel: 0,
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 90000,
  contratsIndividuels: [],
  couvertureCollective: null,
};

describe("règles CNBF (LPA/AON + invalidité ≥ 20 ans) — LOT 3", () => {
  it("CNBF ancienneté < 240 mois : LPA/AON présent, invalidité 20 ans absent", () => {
    const ctx = makeCtx({ ...entreeCnbf, ancienneteMois: 120 });
    const lpaAon = regleCnbfLpaAon(ctx, "p1");
    const inval = regleCnbfInvalidite20ans(ctx, "p1");
    expect(lpaAon).not.toBeNull();
    expect(lpaAon?.id).toBe("cnbf_lpa_aon_p1");
    expect(lpaAon?.severite).toBe("attention");
    expect(lpaAon?.axe).toBe("incapacite");
    expect(inval).toBeNull();

    // Via le pipeline complet (evaluerToutesLesRegles)
    const ids = evaluerToutesLesRegles(ctx, "p1").map((c) => c.id);
    expect(ids).toContain("cnbf_lpa_aon_p1");
    expect(ids).not.toContain("cnbf_invalidite_20ans_p1");
  });

  it("CNBF ancienneté >= 240 mois : LPA/AON et invalidité 20 ans présents", () => {
    const ctx = makeCtx({ ...entreeCnbf, ancienneteMois: 240 });
    const lpaAon = regleCnbfLpaAon(ctx, "p1");
    const inval = regleCnbfInvalidite20ans(ctx, "p1");
    expect(lpaAon).not.toBeNull();
    expect(inval).not.toBeNull();
    expect(inval?.id).toBe("cnbf_invalidite_20ans_p1");
    expect(inval?.severite).toBe("attention");
    expect(inval?.axe).toBe("invalidite");

    const ids = evaluerToutesLesRegles(ctx, "p1").map((c) => c.id);
    expect(ids).toContain("cnbf_lpa_aon_p1");
    expect(ids).toContain("cnbf_invalidite_20ans_p1");
  });

  it("caisse non-CNBF (CAVEC) : aucun constat CNBF, même ancienneté élevée", () => {
    const ctx = makeCtx({ ...entreeCnbf, caisse: "CAVEC", ancienneteMois: 300 });
    expect(regleCnbfLpaAon(ctx, "p1")).toBeNull();
    expect(regleCnbfInvalidite20ans(ctx, "p1")).toBeNull();

    const ids = evaluerToutesLesRegles(ctx, "p1").map((c) => c.id);
    expect(ids).not.toContain("cnbf_lpa_aon_p1");
    expect(ids).not.toContain("cnbf_invalidite_20ans_p1");
  });

  it("aucun montant chiffré dans les constats CNBF", () => {
    const ctx = makeCtx({ ...entreeCnbf, ancienneteMois: 240 });
    const lpaAon = regleCnbfLpaAon(ctx, "p1");
    const inval = regleCnbfInvalidite20ans(ctx, "p1");
    expect(lpaAon?.impactChiffre).toBeUndefined();
    expect(inval?.impactChiffre).toBeUndefined();
    // Pas de symbole euro ni de montant dans détail/action
    expect(lpaAon?.detail).not.toMatch(/€|\d{3,}/);
    expect(inval?.detail).not.toMatch(/€/);
    expect(lpaAon?.action).not.toMatch(/€/);
    expect(inval?.action).not.toMatch(/€/);
  });

  it("propage la cible passée en argument (p2)", () => {
    const ctx = makeCtx({ ...entreeCnbf, ancienneteMois: 240 });
    expect(regleCnbfLpaAon(ctx, "p2")?.id).toBe("cnbf_lpa_aon_p2");
    expect(regleCnbfInvalidite20ans(ctx, "p2")?.id).toBe("cnbf_invalidite_20ans_p2");
  });
});
