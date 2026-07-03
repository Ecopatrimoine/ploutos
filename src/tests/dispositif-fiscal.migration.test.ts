// LOT C — Champ dispositif fiscal : migration / round-trip.
//
// Vérifie que ensureAssetIds (la brique qui reconstruit les objets Property à la
// migration, en amont via normalizeClientData) PRÉSERVE les nouveaux champs
// optionnels par simple spread {...p}, et qu'un dossier ancien sans ces champs
// se charge intact (dispositif undefined = « Aucun » à l'affichage).
import { describe, it, expect } from "vitest";
import { ensureAssetIds } from "../lib/migrations/ensureAssetIds";
import type { Property } from "../types/patrimoine";

const baseProp = (over: Partial<Property>): Property => ({
  id: "p1", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full",
  usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "12000",
  insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "",
  loanEnabled: false, loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "",
  loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "", loanPledgedPlacementIndex: "-1",
  loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque",
  indivisionShare1: "", indivisionShare2: "", loans: [], ...over,
});

const migrate = (prop: Property) =>
  ensureAssetIds({ data: { properties: [prop] } as any, successionData: null, hypotheses: [] })
    .data.properties![0];

describe("dispositif fiscal — migration / round-trip", () => {
  it("dossier v1 SANS champ dispositif : chargé intact, dispositif undefined", () => {
    const prop = baseProp({});
    delete (prop as any).id; // payload ancien : pas d'id stable
    const p = migrate(prop);
    expect(typeof p.id).toBe("string");          // id stable posé par la migration
    expect(p.dispositifFiscal).toBeUndefined();  // aucun défaut imposé = « Aucun »
    expect(p.value).toBe("300000");              // le reste du bien intact
    expect(p.rentGrossAnnual).toBe("12000");
  });

  it("dossier AVEC dispositif complet : round-trip export/import sans perte", () => {
    const prop = baseProp({
      dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000",
      dispositifEngagementAns: "9", dispositifProrogation: "1",
      dispositifNiveauLoyer: "intermediaire", dispositifIntermediation: true, dispositifNeufAncien: "neuf",
    });
    // Simule un export -> import réel : sérialisation JSON puis migration.
    const bundle = JSON.parse(JSON.stringify({ data: { properties: [prop] }, successionData: null, hypotheses: [] }));
    const p = ensureAssetIds(bundle).data.properties![0];
    expect(p.dispositifFiscal).toBe("pinel");
    expect(p.dispositifAnnee).toBe("2023");
    expect(p.dispositifBase).toBe("250000");
    expect(p.dispositifEngagementAns).toBe("9");
    expect(p.dispositifProrogation).toBe("1");
    expect(p.dispositifNiveauLoyer).toBe("intermediaire");
    expect(p.dispositifIntermediation).toBe(true);
    expect(p.dispositifNeufAncien).toBe("neuf");
    expect(p.id).toBe("p1"); // id conservé
  });

  it("ensureAssetIds idempotent sur les champs dispositif (2e passe identique)", () => {
    const once = ensureAssetIds({ data: { properties: [baseProp({ dispositifFiscal: "denormandie", dispositifBase: "180000" })] } as any, successionData: null, hypotheses: [] });
    const twice = ensureAssetIds({ data: once.data, successionData: null, hypotheses: [] });
    expect(twice.data.properties).toEqual(once.data.properties);
  });
});
