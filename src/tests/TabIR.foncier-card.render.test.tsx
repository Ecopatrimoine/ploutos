// @vitest-environment jsdom
//
// LOT FIX-FONCIER — card comparaison micro/réel de TabIR.
// Radix Select remplacé par un <select> natif (montage déterministe jsdom).
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { computeIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property } from "../types/patrimoine";

vi.mock("@/components/ui/select", async () => {
  const R = await import("react");
  const toText = (n: any): string => n == null || typeof n === "boolean" ? "" : (typeof n === "string" || typeof n === "number") ? String(n) : Array.isArray(n) ? n.map(toText).join("") : n?.props?.children != null ? toText(n.props.children) : "";
  return {
    Select: ({ value, onValueChange, children }: any) => R.createElement("select", { value: value ?? "", onChange: (e: any) => onValueChange && onValueChange(e.target.value) }, children),
    SelectTrigger: () => null, SelectValue: () => null,
    SelectContent: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectItem: ({ value, children }: any) => R.createElement("option", { value }, toText(children)),
  };
});

import { TabIR } from "../components/tabs/TabIR";

const BASE = {
  person1FirstName: "T", person1LastName: "IR", person1BirthDate: "1980-01-01", person1JobTitle: "S", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "60000", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const OPTS = (foncierRegime: string) => ({ expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime, other1: "0", other2: "0" }) as any;
const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "", value: "200000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const noop = () => {};

function renderTabIR(properties: Property[], foncierRegime: string) {
  const data = { ...BASE, properties };
  const irOptions = OPTS(foncierRegime);
  const ir = computeIR(data, irOptions);
  return render(
    <Tabs defaultValue="ir">
      <TabIR data={data} ir={ir} irOptions={irOptions} setIrOptions={noop} concubinPerson={1} setConcubinPerson={noop} setChargesDialogOpen={noop} person1="Moi" person2="Conjoint" />
    </Tabs>
  );
}

const jb = (o: any = {}) => prop({ dispositifFiscal: "jeanbrunRelanceLogement", dispositifAnnee: "2026", dispositifNeufAncien: "neuf", dispositifNiveauLoyer: "social", dispositifBase: "200000", propertyTaxAnnual: "3000", otherChargesAnnual: "2000", ...o });

describe("TabIR — card micro/réel foncier", () => {
  it("Jeanbrun réel, brut 16000 : micro grisée (> seuil), ligne amortissement, PAS de message", () => {
    renderTabIR([jb({ rentGrossAnnual: "16000" })], "real");
    expect(screen.getByText(/indisponible : revenus bruts/)).toBeTruthy();
    expect(screen.getByText(/dont amortissement Jeanbrun/)).toBeTruthy();
    expect(screen.queryByText(/Le micro est plus avantageux/)).toBeNull();
    expect(screen.queryByText(/Le réel ferait économiser/)).toBeNull();
  });

  it("Jeanbrun réel, brut 9000 : micro grisée pour motif dispositif (art. 32)", () => {
    renderTabIR([jb({ rentGrossAnnual: "9000" })], "real");
    expect(screen.getByText(/dispositif exigeant le régime réel/)).toBeTruthy();
    expect(screen.queryByText(/Le micro est plus avantageux/)).toBeNull();
  });

  it("dossier classique brut 9000 sans dispositif : comparaison + message conservés (non-régression M2)", () => {
    renderTabIR([prop({ rentGrossAnnual: "9000", propertyTaxAnnual: "1000" })], "real");
    expect(screen.queryByText(/indisponible/)).toBeNull();
    // micro 6300 < réel 8000 -> message micro plus avantageux
    expect(screen.getByText(/Le micro est plus avantageux/)).toBeTruthy();
    expect(screen.queryByText(/dont amortissement Jeanbrun/)).toBeNull();
  });
});
