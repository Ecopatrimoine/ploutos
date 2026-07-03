// LOT 2 — capacitePerte : la dette immobilière = CRD RÉSOLU (amorti auto si non
// saisi), plus jamais le capital INITIAL. Aligné sur endettement/IFI/succession.
import { describe, it, expect } from "vitest";
import { computeCapacitePerte } from "../lib/conformite/capacitePerte";
import { resolveLoanValuesMulti } from "../lib/calculs/credit";

const loan = (o: any = {}) => ({
  id: "l1", type: "amortissable", label: "Prêt", amount: "200000", rate: "3", duration: "20",
  startDate: "2015-01-01", capitalRemaining: "", interestAnnual: "", pledgedPlacementIndex: "-1",
  insurance: false, insuranceGuarantees: "dc", insuranceRate: "", insuranceRate1: "", insuranceRate2: "",
  insurancePremium: "", insuranceCoverage: "banque", ...o,
});
const dossier = (property: any) => ({
  properties: [property], placements: [], otherLoans: [], childrenData: [],
  salary1: "60000", salary2: "0", pensions: "0", pensions1: "", pensions2: "", ca1: "", ca2: "",
}) as any;

describe("capacitePerte — dette immo = CRD amorti, pas le capital initial", () => {
  it("crédit CRD vide (auto) -> endettement = CRD résolu (< capital initial)", () => {
    const property: any = { id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", value: "300000", loans: [loan()] };
    const crdResolu = resolveLoanValuesMulti(property).capital;
    expect(crdResolu).toBeGreaterThan(0);
    expect(crdResolu).toBeLessThan(200000); // amorti depuis 2015

    const cap = computeCapacitePerte(dossier(property));
    // patrimoineTotal = 300 000 (aucun placement) -> endettementRatio x 300 000 = dette totale
    expect(cap.endettementRatio * 300000).toBeCloseTo(crdResolu, 0);
    // et surtout : PAS le capital initial (200 000 / 300 000 = 0,667)
    expect(cap.endettementRatio).toBeLessThan(200000 / 300000);
  });

  it("CRD SAISI -> override respecté (barrière douce, valeur exacte)", () => {
    const property: any = { id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", value: "300000", loans: [loan({ capitalRemaining: "180000" })] };
    const cap = computeCapacitePerte(dossier(property));
    expect(cap.endettementRatio * 300000).toBeCloseTo(180000, 0);
  });
});
