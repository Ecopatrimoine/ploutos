// P3 — Dévolution du capital décès des CAISSES (art. L361-4 CSS) : cascade
// EXCLUSIVE conjoint/PACS → enfants à charge → ascendants, + capital orphelin
// par enfant (hors cascade), + surcharge manuelle prioritaire.

import { describe, it, expect } from "vitest";
import { computeSuccession, devolutionCapitalDecesCaisse } from "../lib/calculs/succession";
import type {
  CapitalDecesDevolutionContexte,
} from "../lib/calculs/succession";
import type { PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

function ctx(over: Partial<CapitalDecesDevolutionContexte> = {}): CapitalDecesDevolutionContexte {
  return { conjointPresent: false, enfantsACharge: [], ...over };
}

// ─── Dévolution pure (cascade L361-4 CSS) ────────────────────────────────────

describe("devolutionCapitalDecesCaisse — cascade exclusive", () => {
  it("conjoint présent → tout le capital principal au conjoint (exclut les enfants)", () => {
    const r = devolutionCapitalDecesCaisse(4009, undefined, ctx({
      conjointPresent: true, conjointNom: "Marie", conjointRelation: "conjoint",
      enfantsACharge: ["Enfant A", "Enfant B"],
    }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Marie", relation: "conjoint", montant: 4009, origine: "capital_principal" });
  });

  it("PACS → relation pacs_partner", () => {
    const r = devolutionCapitalDecesCaisse(4009, undefined, ctx({
      conjointPresent: true, conjointNom: "Alex", conjointRelation: "pacs_partner",
    }));
    expect(r[0].relation).toBe("pacs_partner");
  });

  it("sans conjoint, 2 enfants à charge → parts égales", () => {
    const r = devolutionCapitalDecesCaisse(4009, undefined, ctx({ enfantsACharge: ["A", "B"] }));
    expect(r).toHaveLength(2);
    expect(r[0].montant).toBe(2004.5);
    expect(r[1].montant).toBe(2004.5);
    expect(r.every((l) => l.origine === "capital_principal")).toBe(true);
  });

  it("SSI marié, 3 enfants : conjoint prend le principal, chaque enfant le capital orphelin (en plus)", () => {
    const r = devolutionCapitalDecesCaisse(9612, 2403, ctx({
      conjointPresent: true, conjointNom: "Marie", conjointRelation: "conjoint",
      enfantsACharge: ["A", "B", "C"],
    }));
    const principal = r.filter((l) => l.origine === "capital_principal");
    const orphelin = r.filter((l) => l.origine === "capital_orphelin");
    expect(principal).toHaveLength(1);
    expect(principal[0]).toMatchObject({ beneficiaire: "Marie", montant: 9612 });
    expect(orphelin).toHaveLength(3);
    expect(orphelin.every((l) => l.montant === 2403 && l.relation === "enfant")).toBe(true);
  });

  it("concubin (ni marié ni PACS), aucun enfant → aucun bénéficiaire automatique", () => {
    const r = devolutionCapitalDecesCaisse(4009, undefined, ctx({ conjointPresent: false }));
    expect(r).toEqual([]);
  });

  it("à défaut de conjoint et d'enfants → ascendants (parts égales)", () => {
    const r = devolutionCapitalDecesCaisse(3000, undefined, ctx({ ascendants: ["Père", "Mère"] }));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ relation: "ascendant", montant: 1500 });
  });

  it("surcharge manuelle → remplace toute la dévolution auto", () => {
    const r = devolutionCapitalDecesCaisse(4009, 2403, ctx({
      conjointPresent: true, conjointNom: "Marie",
      enfantsACharge: ["A"],
      surcharge: { beneficiaires: [{ name: "Concubin", relation: "autre", montant: 4009 }] },
    }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Concubin", relation: "autre", montant: 4009, source: "manuel" });
  });

  it("capital null + capital orphelin → seules les parts orphelin sont produites", () => {
    const r = devolutionCapitalDecesCaisse(null, 2403, ctx({ enfantsACharge: ["A", "B"] }));
    expect(r).toHaveLength(2);
    expect(r.every((l) => l.origine === "capital_orphelin")).toBe(true);
  });
});

// ─── Intégration computeSuccession (wiring + persistance surcharge) ──────────

function travailPair(caisse: string, statut: string): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: caisse, employeur: null,
      dateEmbauche: "2000-01-01", dateDebutActivite: "2000-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: 50000,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}

function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1955-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [
      { firstName: "Léa", lastName: "Martin", birthDate: "2010-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
      { firstName: "Tom", lastName: "Martin", birthDate: "2012-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
    ],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    ...over,
  } as unknown as PatrimonialData;
}

function baseSuccession(): SuccessionData {
  return {
    deceasedPerson: "person1", spouseOption: "legal_quarter_full",
    heirs: [], testamentHeirs: [], legsPrecisItems: [], spousePresent: true,
    useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

describe("computeSuccession — répartition du capital caisse", () => {
  it("défunt CPAM marié, 2 enfants → tout le capital (4009) au conjoint survivant", () => {
    const data = baseData({ travail: travailPair("CPAM", "salarie_cadre") });
    const s = computeSuccession(baseSuccession(), data);
    const rep = s.capitalDecesLines.caisses[0].repartition;
    expect(rep).toHaveLength(1);
    expect(rep[0]).toMatchObject({ relation: "conjoint", montant: 4009, source: "auto" });
    expect(rep[0].beneficiaire).toContain("Marie");
    // Exonéré, hors actif : non-régression de la masse.
    expect(s.activeNet).toBe(computeSuccession(baseSuccession(), baseData()).activeNet);
  });

  it("surcharge persistée dans data.prevoyance → prime sur la cascade", () => {
    const data = baseData({
      travail: travailPair("CPAM", "salarie_cadre"),
      prevoyance: {
        version: 1,
        p1: {
          contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2",
          capitalDecesCaisseSurcharge: { beneficiaires: [{ name: "Jean Concubin", relation: "autre", montant: 4009 }] },
        },
        p2: null,
      } as unknown as PatrimonialData["prevoyance"],
    });
    const s = computeSuccession(baseSuccession(), data);
    const rep = s.capitalDecesLines.caisses[0].repartition;
    expect(rep).toHaveLength(1);
    expect(rep[0]).toMatchObject({ beneficiaire: "Jean Concubin", source: "manuel" });
  });
});
