// @vitest-environment jsdom
//
// LOT 3 — Trio IR : le bloc « Réductions & dispositifs fiscaux » intègre les
// réductions FINANCIÈRES (libellé court) et la ligne d'écrêtement double enveloppe.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { computeIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { Property, Placement } from "../types/patrimoine";

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
  childrenData: [], salary1: "100000", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const OPTS = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const prop = (o: any): Property => ({
  id: "b", name: "Bien", type: "Location nue", ownership: "person1", propertyRight: "full", usufructAge: "", value: "300000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const plac = (o: any): Placement => ({
  id: "x", name: "P", type: "SOFICA", ownership: "person1", value: "0", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "",
  pfuEligible: false, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "",
  annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [], ...o,
} as Placement);
const pinel = (id: string) => prop({ id, dispositifFiscal: "pinel", dispositifAnnee: "2020", dispositifBase: "300000", dispositifEngagementAns: "9" });
const noop = () => {};

function renderWith(data: any) {
  const ir = computeIR(data, OPTS);
  return render(
    <Tabs defaultValue="ir">
      <TabIR data={data} ir={ir} irOptions={OPTS} setIrOptions={noop} concubinPerson={1} setConcubinPerson={noop} setChargesDialogOpen={noop} person1="Moi" person2="Conjoint" />
    </Tabs>
  );
}

describe("TabIR — trio réductions financières (Lot 3)", () => {
  it("une réduction SOFICA apparaît avec son libellé court", () => {
    const sofica = plac({ id: "s", defiscalisation: { dispositif: "sofica", montantSouscrit: "18000", dateInvestissement: "2026-06-01", tauxSofica: "48" } });
    renderWith({ ...BASE, salary1: "100000", placements: [sofica] });
    // Lot 10b : le bloc réductions est rangé dans l'accordéon §1 (fermé) — on l'ouvre.
    fireEvent.click(screen.getByText("Décomposition du calcul"));
    expect(screen.getByText(/dispositifs fiscaux/i)).toBeTruthy();
    expect(screen.getByText("Réduction SOFICA")).toBeTruthy();
  });

  it("l'écrêtement double enveloppe s'affiche (2 Pinel + SOFICA, communs saturés)", () => {
    const sofica = plac({ id: "s", defiscalisation: { dispositif: "sofica", montantSouscrit: "18000", dateInvestissement: "2026-06-01", tauxSofica: "48" } });
    renderWith({ ...BASE, salary1: "200000", properties: [pinel("pa"), pinel("pb")], placements: [sofica] });
    // Lot 10b : ouvrir l'accordéon §1 « Décomposition du calcul » (fermé par défaut).
    fireEvent.click(screen.getByText("Décomposition du calcul"));
    expect(screen.getByText(/Plafonnement des niches/)).toBeTruthy();
    expect(screen.getByText(/2\s*640\s*€\s*non imputés/)).toBeTruthy();
  });
});
