// @vitest-environment jsdom
//
// LOT C — Saisie UI du dispositif fiscal dans TabImmobilier.
//
// On rend le VRAI TabImmobilier ; le wrapper Radix Select est remplacé par un
// <select> natif (même approche que TabTravail.*.render.test.tsx) pour un montage
// déterministe sous jsdom. La conditionnalité étant dérivée des données (pattern
// impératif), on monte avec des propriétés pré-réglées et on vérifie présence /
// absence des champs ; la bascule vers « Aucun » est pilotée sur le <select> natif.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";

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

// Import APRÈS le mock.
import { TabImmobilier } from "../components/tabs/TabImmobilier";

const noop = () => {};
const mkProp = (over: any) => ({
  id: "p1", name: "Bien test", type: "Location nue", ownership: "person1", propertyRight: "full",
  usufructAge: "", value: "300000", propertyTaxAnnual: "", rentGrossAnnual: "12000",
  insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "",
  loanEnabled: false, loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "",
  loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "", loanPledgedPlacementIndex: "-1",
  loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "",
  loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque",
  indivisionShare1: "", indivisionShare2: "", loans: [], ...over,
});

function renderImmo(property: any, updateProperty: any = noop) {
  return render(
    <Tabs defaultValue="immobilier">
      <TabImmobilier
        data={{ properties: [property] }}
        setField={noop} addProperty={noop} updateProperty={updateProperty} removeProperty={noop}
        addLoan={noop} updateLoan={noop} removeLoan={noop}
        loanModalPropertyId={null} setLoanModalPropertyId={noop}
        ownerOptions={[{ value: "person1", label: "Moi" }]}
        person1="Moi" person2="Conjoint" activeDonations={[]} restoreBaseSnapshot={noop}
      />
    </Tabs>
  );
}

describe("TabImmobilier — saisie dispositif fiscal", () => {
  it("Résidence principale : PAS de sélecteur Dispositif fiscal", () => {
    renderImmo(mkProp({ type: "Résidence principale" }));
    expect(screen.queryByText("Dispositif fiscal")).toBeNull();
  });

  it("Location nue sans dispositif : sélecteur présent, AUCUN sous-champ, Censi-Bouvard hors options", () => {
    renderImmo(mkProp({ type: "Location nue" }));
    expect(screen.getByText("Dispositif fiscal")).toBeTruthy();
    expect(screen.queryByText("Année d'investissement")).toBeNull();
    expect(screen.queryByText("Engagement")).toBeNull();
    // Options filtrées par nature : Pinel / Loc'Avantages / Jeanbrun présents, Censi-Bouvard ABSENT.
    expect(screen.getByText("Pinel")).toBeTruthy();
    expect(screen.getByText("Loc'Avantages")).toBeTruthy();
    expect(screen.getByText("Jeanbrun Relance logement")).toBeTruthy();
    expect(screen.queryByText("Censi-Bouvard")).toBeNull();
  });

  it("Location nue + Pinel : sous-champs pinel visibles (année, base, engagement, prorogation)", () => {
    renderImmo(mkProp({ type: "Location nue", dispositifFiscal: "pinel", dispositifAnnee: "2023", dispositifBase: "250000", dispositifEngagementAns: "9" }));
    expect(screen.getByText("Année d'investissement")).toBeTruthy();
    expect(screen.getByText(/Base \(prix de revient/)).toBeTruthy();
    expect(screen.getByText("Engagement")).toBeTruthy();
    expect(screen.getByText("Prorogation")).toBeTruthy();
    expect(screen.getByDisplayValue("250000")).toBeTruthy(); // base saisie affichée
    expect(screen.getByDisplayValue("2023")).toBeTruthy();
  });

  it("SCPI + Denormandie : sélecteur présent ; Loc'Avantages hors options, Jeanbrun présent", () => {
    renderImmo(mkProp({ type: "SCPI", dispositifFiscal: "denormandie" }));
    expect(screen.getByText("Dispositif fiscal")).toBeTruthy();
    expect(screen.getByText("Année d'investissement")).toBeTruthy();
    expect(screen.getByText("Denormandie")).toBeTruthy();
    expect(screen.getByText("Jeanbrun Relance logement")).toBeTruthy();
    expect(screen.queryByText("Loc'Avantages")).toBeNull();
    expect(screen.queryByText("Censi-Bouvard")).toBeNull();
  });

  it("SCI IR : sélecteur présent (SCI translucide à l'IR)", () => {
    renderImmo(mkProp({ type: "SCI IR", dispositifFiscal: "pinel" }));
    expect(screen.getByText("Dispositif fiscal")).toBeTruthy();
    expect(screen.getByText("Année d'investissement")).toBeTruthy();
  });

  it("LMNP : sélecteur présent, options = Aucun + Censi-Bouvard SEUL", () => {
    renderImmo(mkProp({ type: "LMNP" }));
    expect(screen.getByText("Dispositif fiscal")).toBeTruthy();
    expect(screen.getByText("Aucun")).toBeTruthy();
    expect(screen.getByText("Censi-Bouvard")).toBeTruthy();
    expect(screen.queryByText("Pinel")).toBeNull();
    expect(screen.queryByText("Denormandie")).toBeNull();
    expect(screen.queryByText("Loc'Avantages")).toBeNull();
    expect(screen.queryByText("Jeanbrun Relance logement")).toBeNull();
  });

  it("LMP : AUCUN sélecteur dispositif (nature non éligible, liste vide)", () => {
    renderImmo(mkProp({ type: "LMP" }));
    expect(screen.queryByText("Dispositif fiscal")).toBeNull();
  });

  it("Nature incohérente (Pinel sur un LMNP) : option conservée + suffixe, valeur non effacée", () => {
    renderImmo(mkProp({ type: "LMNP", dispositifFiscal: "pinel", dispositifBase: "250000" }));
    // Le dispositif Pinel (hors matrice LMNP) reste affiché, marqué incohérent et sélectionné.
    expect(screen.getByText(/Pinel \(incoherent avec la nature du bien\)/)).toBeTruthy();
    const dispoSelect = screen.getAllByRole("combobox").find((s: any) => s.value === "pinel");
    expect(dispoSelect).toBeTruthy(); // valeur "pinel" conservée, jamais effacée
    // L'option cohérente de la nature (Censi-Bouvard) reste proposée à côté.
    expect(screen.getByText("Censi-Bouvard")).toBeTruthy();
  });

  it("Bascule vers « Aucun » : onChange ne touche QUE dispositifFiscal (non destructif)", () => {
    const calls: any[] = [];
    const updateProperty = (id: string, key: string, value: any) => calls.push([id, key, value]);
    renderImmo(mkProp({ type: "Location nue", dispositifFiscal: "pinel", dispositifBase: "250000" }), updateProperty);
    // Le <select> Dispositif fiscal (mock natif) a pour valeur courante "pinel".
    const dispoSelect = screen.getAllByRole("combobox").find((s: any) => s.value === "pinel");
    expect(dispoSelect).toBeTruthy();
    fireEvent.change(dispoSelect!, { target: { value: "aucun" } });
    // "aucun" est mappé vers "" et SEUL dispositifFiscal est modifié.
    expect(calls).toContainEqual(["p1", "dispositifFiscal", ""]);
    expect(calls.every(([, key]) => key !== "dispositifBase")).toBe(true); // base JAMAIS effacée
  });
});
