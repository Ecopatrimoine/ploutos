import { describe, it, expect } from "vitest";
import { ensureAssetIds } from "./ensureAssetIds";
import type {
  Placement,
  Property,
  Loan,
  PatrimonialData,
  SuccessionData,
  Hypothesis,
  LegsPrecisItem,
  DonationItem,
} from "../../types/patrimoine";

// ─── Fabrique d'id déterministe (injectée) ─────────────────────────────────
function counter() {
  let i = 0;
  return () => `id${++i}`;
}

// ─── Fabriques minimales (tous les champs requis) ──────────────────────────
function placement(over: Partial<Placement> = {}): Placement {
  return {
    name: "", type: "PEA", ownership: "person1", value: "0", annualIncome: "",
    taxableIncome: "", deathValue: "", openDate: "", pfuEligible: false,
    pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "",
    exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "",
    perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "",
    perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [],
    ...over,
  };
}

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: "loanX", type: "in_fine", label: "Prêt", amount: "", rate: "", duration: "",
    startDate: "", capitalRemaining: "", interestAnnual: "", pledgedPlacementIndex: "-1",
    insurance: false, insuranceGuarantees: "dc", insuranceRate: "", insuranceRate1: "",
    insuranceRate2: "", insurancePremium: "", insuranceCoverage: "banque",
    ...over,
  };
}

function property(over: Partial<Property> = {}): Property {
  return {
    name: "", type: "Location nue", ownership: "person1", propertyRight: "full",
    usufructAge: "", value: "0", propertyTaxAnnual: "", rentGrossAnnual: "",
    insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
    loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "",
    loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
    loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc",
    loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "",
    loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "",
    indivisionShare2: "",
    ...over,
  };
}

function data(over: Partial<PatrimonialData> = {}): PatrimonialData {
  // Les tests n'exercent que properties/placements ; le reste de PatrimonialData
  // n'est pas pertinent pour la migration.
  return { properties: [], placements: [], ...over } as unknown as PatrimonialData;
}

function legs(over: Partial<LegsPrecisItem> = {}): LegsPrecisItem {
  return { propertyIndex: 0, assetType: "property", legataires: [], ...over };
}

function succession(items: LegsPrecisItem[]): SuccessionData {
  return {
    deceasedPerson: "person1", spousePresent: false, spouseOption: "", useTestament: true,
    legsMode: "precis", heirs: [], testamentHeirs: [], legsPrecisItems: items,
  };
}

function donation(over: Partial<DonationItem> = {}): DonationItem {
  return {
    id: "don1", assetType: "property", assetIndex: 0, freeLabel: "", freeValue: "",
    donationType: "full", sharePercent: "100", donorAge: "60", donationDate: "",
    heirs: [], ...over,
  };
}

function hypothesis(donations: DonationItem[]): Hypothesis {
  return {
    id: 1, name: "H", notes: "", objective: "", savedAt: null, data: null,
    successionData: null, irOptions: null, donations,
  };
}

describe("ensureAssetIds", () => {
  it("payload sans placements ni properties : ne casse pas, arrays vides", () => {
    const res = ensureAssetIds({ data: data() }, counter());
    expect(res.data.placements).toEqual([]);
    expect(res.data.properties).toEqual([]);
    expect(res.successionData).toBeNull();
    expect(res.hypotheses).toEqual([]);
    expect(res.unresolved).toEqual([]);
  });

  it("pose un id sur chaque placement/property qui n'en a pas, préserve les ids existants", () => {
    const res = ensureAssetIds(
      {
        data: data({
          placements: [placement(), placement({ id: "keep" })],
          properties: [property()],
        }),
      },
      counter(),
    );
    expect(res.data.placements[0].id).toBe("id1");
    expect(res.data.placements[1].id).toBe("keep");
    expect(res.data.properties[0].id).toBe("id2");
  });

  it("convertit Loan.pledgedPlacementIndex et Property.loanPledgedPlacementIndex (cas nominal)", () => {
    const res = ensureAssetIds(
      {
        data: data({
          placements: [placement({ type: "Assurance-vie fonds euros" }), placement()],
          properties: [
            property({
              loanEnabled: true, loanType: "in_fine", loanPledgedPlacementIndex: "0",
              loans: [loan({ pledgedPlacementIndex: "1" })],
            }),
          ],
        }),
      },
      counter(),
    );
    const av = res.data.placements[0];
    const pea = res.data.placements[1];
    expect(res.data.properties[0].loanPledgedPlacementId).toBe(av.id);
    expect(res.data.properties[0].loans![0].pledgedPlacementId).toBe(pea.id);
    expect(res.unresolved).toEqual([]);
  });

  it("convertit LegsPrecisItem.propertyIndex et DonationItem.assetIndex selon assetType", () => {
    const bundle = {
      data: data({
        properties: [property()],
        placements: [placement()],
      }),
      successionData: succession([
        legs({ assetType: "property", propertyIndex: 0 }),
        legs({ assetType: "placement", propertyIndex: 0 }),
        legs({ assetType: "free", propertyIndex: 0, freeLabel: "libre" }),
      ]),
      hypotheses: [
        hypothesis([
          donation({ id: "dP", assetType: "property", assetIndex: 0 }),
          donation({ id: "dPl", assetType: "placement", assetIndex: 0 }),
          donation({ id: "dF", assetType: "free", assetIndex: 0 }),
        ]),
      ],
    };
    const res = ensureAssetIds(bundle, counter());
    const propId = res.data.properties[0].id;
    const placId = res.data.placements[0].id;
    const items = res.successionData!.legsPrecisItems;
    expect(items[0].assetId).toBe(propId);
    expect(items[1].assetId).toBe(placId);
    expect(items[2].assetId).toBeUndefined(); // free -> aucune cible
    const dons = res.hypotheses[0].donations!;
    expect(dons[0].assetId).toBe(propId);
    expect(dons[1].assetId).toBe(placId);
    expect(dons[2].assetId).toBeUndefined();
  });

  it('index "-1" / vide -> aucun id cible, pas de log', () => {
    const res = ensureAssetIds(
      {
        data: data({
          placements: [placement()],
          properties: [
            property({ loanPledgedPlacementIndex: "-1", loans: [loan({ pledgedPlacementIndex: "" })] }),
          ],
        }),
      },
      counter(),
    );
    expect(res.data.properties[0].loanPledgedPlacementId).toBeUndefined();
    expect(res.data.properties[0].loans![0].pledgedPlacementId).toBeUndefined();
    expect(res.unresolved).toEqual([]);
  });

  it("index hors bornes -> aucun id cible + consigné dans unresolved", () => {
    const res = ensureAssetIds(
      {
        data: data({
          placements: [placement()], // taille 1 -> index 5 hors bornes
          properties: [property({ loanEnabled: true, loanType: "in_fine", loanPledgedPlacementIndex: "5" })],
        }),
        successionData: succession([legs({ assetType: "placement", propertyIndex: 9 })]),
      },
      counter(),
    );
    expect(res.data.properties[0].loanPledgedPlacementId).toBeUndefined();
    expect(res.successionData!.legsPrecisItems[0].assetId).toBeUndefined();
    expect(res.unresolved.length).toBe(2);
    expect(res.unresolved.some((u) => u.includes("index 5"))).toBe(true);
    expect(res.unresolved.some((u) => u.includes("index 9"))).toBe(true);
  });

  it("legs sur un placement avec AV en tête de tableau : fige la sémantique LECTURE (liste complète)", () => {
    // data.placements = [AV, PEA]. Un legs stocké propertyIndex=0 pointait,
    // via le bug d'index filtré, vers le 1er placement NON-AV (PEA) à l'écran ;
    // mais l'écran LIT data.placements[0] = AV. On fige donc l'AV (ce qui est
    // affiché aujourd'hui), pas le PEA.
    const res = ensureAssetIds(
      {
        data: data({
          properties: [],
          placements: [
            placement({ type: "Assurance-vie fonds euros", name: "AV" }),
            placement({ type: "PEA", name: "PEA" }),
          ],
        }),
        successionData: succession([legs({ assetType: "placement", propertyIndex: 0 })]),
      },
      counter(),
    );
    const avId = res.data.placements[0].id;
    expect(res.successionData!.legsPrecisItems[0].assetId).toBe(avId);
  });

  it("est idempotente : un payload déjà migré ressort identique (en valeur)", () => {
    const bundle = {
      data: data({
        properties: [property({ loanEnabled: true, loanType: "in_fine", loanPledgedPlacementIndex: "0", loans: [loan({ pledgedPlacementIndex: "1" })] })],
        placements: [placement({ type: "Assurance-vie fonds euros" }), placement()],
      }),
      successionData: succession([legs({ assetType: "property", propertyIndex: 0 }), legs({ assetType: "placement", propertyIndex: 1 })]),
      hypotheses: [hypothesis([donation({ assetType: "placement", assetIndex: 0 })])],
    };
    const first = ensureAssetIds(bundle, counter());
    const second = ensureAssetIds(
      { data: first.data, successionData: first.successionData, hypotheses: first.hypotheses },
      counter(),
    );
    expect(second.data).toEqual(first.data);
    expect(second.successionData).toEqual(first.successionData);
    expect(second.hypotheses).toEqual(first.hypotheses);
  });

  it("ne mute pas l'entrée", () => {
    const bundle = {
      data: data({
        properties: [property({ loanPledgedPlacementIndex: "0" })],
        placements: [placement()],
      }),
      successionData: succession([legs({ assetType: "property", propertyIndex: 0 })]),
      hypotheses: [hypothesis([donation({ assetType: "property", assetIndex: 0 })])],
    };
    const snapshot = JSON.parse(JSON.stringify(bundle));
    ensureAssetIds(bundle, counter());
    expect(bundle).toEqual(snapshot);
  });
});
