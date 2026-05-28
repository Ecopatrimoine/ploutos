// ─── Tests mapping PatrimonialData → EntreePerso (Lot 6 → pont LOT 7) ──

import { describe, expect, it } from "vitest";
import {
  buildEntreePerso,
  calcAncienneteMois,
  calcAgeFromBirth,
} from "../lib/prevoyance/mapping";
import { createEmptyTravail } from "../lib/prevoyance/utils";
import type { PatrimonialData } from "../types/patrimoine";

function minimalData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "P1", person1LastName: "",
    person1BirthDate: "1990-01-01",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "",
    person2FirstName: "", person2LastName: "",
    person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "0", salary2: "0",
    pensions: "0", perDeduction: "0",
    pensionDeductible: "0", otherDeductible: "0",
    ca1: "0", bicType1: "", microRegime1: true, chargesReelles1: "0", baRevenue1: "0",
    chargesDetail1: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    ca2: "0", bicType2: "", microRegime2: true, chargesReelles2: "0", baRevenue2: "0",
    chargesDetail2: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    properties: [], placements: [], perRentes: [], otherLoans: [],
    ...over,
  };
}

describe("calcAncienneteMois", () => {
  it("renvoie 0 pour une date d'embauche absente", () => {
    expect(calcAncienneteMois(null)).toBe(0);
    expect(calcAncienneteMois(undefined)).toBe(0);
    expect(calcAncienneteMois("")).toBe(0);
  });

  it("renvoie 0 pour une date invalide", () => {
    expect(calcAncienneteMois("pas une date")).toBe(0);
  });

  it("calcule un nombre de mois positif pour une date dans le passé", () => {
    const today = new Date();
    const il_y_a_2_ans = new Date(today.getFullYear() - 2, today.getMonth(), 1);
    const iso = il_y_a_2_ans.toISOString().slice(0, 10);
    const m = calcAncienneteMois(iso);
    // Approximativement 24 mois (à +/- 1 pour les arrondis de jours)
    expect(m).toBeGreaterThanOrEqual(23);
    expect(m).toBeLessThanOrEqual(25);
  });

  it("renvoie 0 pour une date d'embauche dans le futur", () => {
    const futur = new Date();
    futur.setFullYear(futur.getFullYear() + 1);
    const iso = futur.toISOString().slice(0, 10);
    expect(calcAncienneteMois(iso)).toBe(0);
  });
});

describe("calcAgeFromBirth", () => {
  it("renvoie 0 pour une date de naissance absente ou invalide", () => {
    expect(calcAgeFromBirth(null)).toBe(0);
    expect(calcAgeFromBirth(undefined)).toBe(0);
    expect(calcAgeFromBirth("")).toBe(0);
    expect(calcAgeFromBirth("pas une date")).toBe(0);
  });

  it("calcule un âge cohérent pour une date de naissance dans le passé", () => {
    const today = new Date();
    const il_y_a_30_ans = new Date(today.getFullYear() - 30, 0, 1);
    const iso = il_y_a_30_ans.toISOString().slice(0, 10);
    const age = calcAgeFromBirth(iso);
    expect(age).toBeGreaterThanOrEqual(29);
    expect(age).toBeLessThanOrEqual(30);
  });
});

describe("buildEntreePerso", () => {
  it("retourne null si data.travail est absent (dossier non migré)", () => {
    const data = minimalData();
    expect(buildEntreePerso(data, "p1")).toBeNull();
    expect(buildEntreePerso(data, "p2")).toBeNull();
  });

  it("retourne null si data.travail.p2 est null (cas célibataire)", () => {
    const data = minimalData({
      travail: { p1: createEmptyTravail(), p2: null },
    });
    expect(buildEntreePerso(data, "p2")).toBeNull();
    expect(buildEntreePerso(data, "p1")).not.toBeNull();
  });

  it("construit un EntreePerso complet pour P1 avec data.travail rempli", () => {
    const t = createEmptyTravail();
    t.statutPro = "salarie_cadre";
    t.caisseAffiliation = "CPAM";
    t.salaireBrutAnnuel = 55000;
    t.dateEmbauche = new Date(new Date().getFullYear() - 4, 0, 1).toISOString().slice(0, 10);
    t.employeur = {
      siret: "12345678901234", siren: "123456789", nom: "ACME",
      formeJuridique: null, codeNAF: null,
      idccCCN: "1486", nomCCN: "Syntec",
      sourceCCN: "auto", effectif: null,
      adresseEtablissement: null, dateCreation: null,
    };
    const data = minimalData({
      person1BirthDate: `${new Date().getFullYear() - 35}-06-15`,
      salary1: "42900",
      travail: { p1: t, p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    expect(entree).not.toBeNull();
    expect(entree!.age).toBeGreaterThanOrEqual(34);
    expect(entree!.statutPro).toBe("salarie_cadre");
    expect(entree!.caisse).toBe("CPAM");
    expect(entree!.idccCCN).toBe("1486");
    expect(entree!.salaireBrutAnnuel).toBe(55000);
    expect(entree!.salaireNetMensuel).toBeCloseTo(42900 / 12, 0);
    expect(entree!.ancienneteMois).toBeGreaterThanOrEqual(47);
    expect(entree!.contratsIndividuels).toEqual([]);
    expect(entree!.couvertureCollective).toBeNull();
  });

  it("salaireNetMensuel : fallback brut × 0.78 / 12 si salary* non saisi", () => {
    const t = createEmptyTravail();
    t.salaireBrutAnnuel = 55000;
    const data = minimalData({
      salary1: "0",
      travail: { p1: t, p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    expect(entree!.salaireNetMensuel).toBeCloseTo((55000 * 0.78) / 12, 0);
  });

  it("revenuTNSAnnuel : bénéfice professionnel (CA - charges) en régime réel", () => {
    const t = createEmptyTravail();
    t.statutPro = "tns_liberal";
    t.caisseAffiliation = "CARMF";
    const data = minimalData({
      person1PcsGroupe: "3",
      person1Csp: "31",        // profession libérale → BNC
      ca1: "95000",
      microRegime1: false,     // régime réel
      chargesReelles1: "20000",
      travail: { p1: t, p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    // Bénéfice = CA - charges = 95000 - 20000 = 75000 (assiette IR,
    // via computeBeneficeImposable — pas le CA brut).
    expect(entree!.revenuTNSAnnuel).toBe(75000);
  });

  it("revenuTNSAnnuel : micro BNC → CA - abattement 34%", () => {
    const t = createEmptyTravail();
    t.statutPro = "tns_liberal";
    t.caisseAffiliation = "CARMF";
    const data = minimalData({
      person1PcsGroupe: "3",
      person1Csp: "31",        // profession libérale → BNC (abattement 34%)
      ca1: "77000",
      microRegime1: true,
      travail: { p1: t, p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    // Bénéfice = 77000 - max(305, 77000 × 0.34) = 77000 - 26180 = 50820
    expect(entree!.revenuTNSAnnuel).toBe(50820);
  });

  it("revenuTNSAnnuel : undefined si ca* à zéro", () => {
    const t = createEmptyTravail();
    t.statutPro = "salarie_cadre";
    const data = minimalData({
      ca1: "0",
      travail: { p1: t, p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    expect(entree!.revenuTNSAnnuel).toBeUndefined();
  });

  it("ancienneteMois = 0 si dateEmbauche absente", () => {
    const t = createEmptyTravail();
    // dateEmbauche reste null
    const data = minimalData({
      travail: { p1: t, p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    expect(entree!.ancienneteMois).toBe(0);
  });

  it("ageRetraite défaut 64 (à raffiner par génération — cf. ROADMAP)", () => {
    const data = minimalData({
      travail: { p1: createEmptyTravail(), p2: null },
    });
    const entree = buildEntreePerso(data, "p1");
    expect(entree!.ageRetraite).toBe(64);
  });
});
