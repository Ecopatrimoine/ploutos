// @vitest-environment jsdom
//
// LOT 1bis point C — bloc "Location meublee (BIC)" dans TabIR. PUR AFFICHAGE des
// sorties moteur (ir.meubleDetail) : on verifie la presence des lignes selon le
// regime, sans recalcul. Meme harnais que TabIR.foncier-card.render.test.tsx.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
const OPTS = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const prop = (o: any): Property => ({
  id: "b", name: "Studio", type: "LMNP", ownership: "person1", propertyRight: "full", usufructAge: "", value: "200000",
  propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false,
  loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "",
  loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "", loans: [], ...o,
} as Property);
const noop = () => {};

function renderTabIR(properties: Property[]) {
  const data = { ...BASE, properties };
  const ir = computeIR(data, OPTS);
  return render(
    <Tabs defaultValue="ir">
      <TabIR data={data} ir={ir} irOptions={OPTS} setIrOptions={noop} concubinPerson={1} setConcubinPerson={noop} setChargesDialogOpen={noop} person1="Moi" person2="Conjoint" />
    </Tabs>
  );
}

describe("TabIR — bloc Location meublee (BIC)", () => {
  it("aucun bien meuble : bloc absent", () => {
    renderTabIR([prop({ type: "Location nue", rentGrossAnnual: "12000" })]);
    expect(screen.queryByText("Location meublée (BIC)")).toBeNull();
  });

  it("micro : recettes / abattement / base + PS 18,6 % revenus du patrimoine", () => {
    renderTabIR([prop({ type: "LMNP", rentGrossAnnual: "12000" })]);
    // Lot 10b : le bloc LMNP est rangé dans l'accordéon §2 (fermé) — on l'ouvre.
    fireEvent.click(screen.getByText("Location meublée / LMNP"));
    expect(screen.getByText("Location meublée (BIC)")).toBeTruthy();
    expect(screen.getByText(/Micro-BIC/)).toBeTruthy();
    expect(screen.getByText("Abattement")).toBeTruthy();
    expect(screen.getAllByText(/Base imposable/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Prélèvements sociaux revenus du patrimoine \(LFSS 2026\)/)).toBeTruthy();
  });

  it("reel deficitaire : ARD (art. 39 C) + deficit non imputable (art. 156 I-1 ter)", () => {
    renderTabIR([prop({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "10000", chargesReelles: "13000", amortissementAnnuelManuel: "5000" })]);
    // Lot 10b : ouvrir l'accordéon §2 « Location meublée / LMNP » (fermé par défaut).
    fireEvent.click(screen.getByText("Location meublée / LMNP"));
    expect(screen.getByText(/Amortissement en report \(ARD\)/)).toBeTruthy();
    expect(screen.getByText(/report illimité, art. 39 C/)).toBeTruthy();
    expect(screen.getByText(/non imputable au revenu global, art. 156 I-1 ter/)).toBeTruthy();
  });
});
