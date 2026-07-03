// @vitest-environment jsdom
//
// Lot C — refonte layout TabRevenus : bandeau budget (3 MetricCards) + table
// "Budget du foyer — detail du calcul" + encart charges courantes. Test de rendu
// LEGER (l'infra jsdom + mock Select existe deja) : on verifie la presence des
// nouveaux blocs et la PURETE UI (aucun setField au montage). Le calcul lui-meme
// est couvert par budget.test.ts.

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData } from "../types/patrimoine";

vi.mock("@/components/ui/select", async () => {
  const ReactMod = await import("react");
  const toText = (node: any): string => {
    if (node == null || node === false || node === true) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(toText).join("");
    if (node?.props?.children != null) return toText(node.props.children);
    return "";
  };
  return {
    Select: ({ value, onValueChange, children }: any) =>
      ReactMod.createElement("select", { value: value ?? "", onChange: (e: any) => onValueChange && onValueChange(e.target.value) }, children),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => ReactMod.createElement(ReactMod.Fragment, null, children),
    SelectItem: ({ value, children }: any) => ReactMod.createElement("option", { value }, toText(children)),
  };
});

// Import APRES le mock.
import { TabRevenus } from "../components/tabs/TabRevenus";

function baseData(over: Record<string, any> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1980-01-01",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "4",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "24000", salary2: "0", pensions: "0", pensions1: "", pensions2: "",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", csgDeductibleFoncier: "", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    ...over,
  } as unknown as PatrimonialData;
}

const irStub = { marginalRate: 0.3, plafondPER1: 0, plafondPER2: 0, finalIR: 0, totalPFU: 0, foncierSocialLevy: 0 };

function renderTab(data: PatrimonialData, setField: any = () => {}) {
  return render(
    <Tabs defaultValue="revenus">
      <TabRevenus
        data={data} setField={setField} setData={() => {}} setChargesDialogOpen={() => {}}
        irOptions={{}} setIrOptions={() => {}} ir={irStub} person1="Pierre" person2=""
      />
    </Tabs>
  );
}

describe("TabRevenus — bandeau budget + table (Lot C)", () => {
  it("les 3 MetricCards budget sont rendues", () => {
    renderTab(baseData());
    expect(screen.getByText(/Revenus du foyer \/mois/)).toBeInTheDocument();
    expect(screen.getByText(/Charges du foyer \/mois/)).toBeInTheDocument();
    expect(screen.getByText(/Capacité d'épargne \/mois/)).toBeInTheDocument();
  });

  it("la table 'Budget du foyer' expose la ligne impots libellee 'IR tout compris'", () => {
    renderTab(baseData());
    expect(screen.getByText(/Budget du foyer — détail du calcul/)).toBeInTheDocument();
    expect(screen.getByText(/Impôts calculés \(IR tout compris\)/)).toBeInTheDocument();
  });

  it("charges courantes non renseignees -> bouton Detailler + mention 'hors charges courantes'", () => {
    renderTab(baseData());
    expect(screen.getByText(/Détailler/)).toBeInTheDocument();
    expect(screen.getAllByText(/hors charges courantes non renseignées/).length).toBeGreaterThan(0);
  });

  it("detail charges renseigne (>=1 poste, '0' compris) -> badge 'total détaillé'", () => {
    renderTab(baseData({ chargesCourantesDetail: { loyerRP: "0", energie: "", assurancesPerso: "", scolarite: "", transport: "", autres: "" } }));
    expect(screen.getByText(/total détaillé \(1 poste\)/)).toBeInTheDocument();
  });

  it("PURETE : le montage ne declenche aucun setField", () => {
    const setField = vi.fn();
    renderTab(baseData(), setField);
    expect(setField).not.toHaveBeenCalled();
  });
});
