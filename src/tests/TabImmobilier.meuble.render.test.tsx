// @vitest-environment jsdom
//
// LOT 1 LMNP/LMP — Saisie UI de la section "Location meublee" dans TabImmobilier.
// Meme harnais que TabImmobilier.dispositif.render.test.tsx : vrai composant,
// Radix Select remplace par un <select> natif pour un montage deterministe.
// On verifie la CONDITIONNALITE d'affichage (fields / alertes / constat), pas les
// montants (le calcul est couvert par ir.locationMeublee.test.ts).
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
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

function renderImmo(property: any) {
  return render(
    <Tabs defaultValue="immobilier">
      <TabImmobilier
        data={{ properties: [property] }}
        setField={noop} addProperty={noop} updateProperty={noop} removeProperty={noop}
        addLoan={noop} updateLoan={noop} removeLoan={noop}
        loanModalPropertyId={null} setLoanModalPropertyId={noop}
        ownerOptions={[{ value: "person1", label: "Moi" }]}
        person1="Moi" person2="Conjoint" activeDonations={[]} restoreBaseSnapshot={noop}
      />
    </Tabs>
  );
}

describe("TabImmobilier — section Location meublee", () => {
  it("Location nue : AUCUNE section meublee", () => {
    renderImmo(mkProp({ type: "Location nue" }));
    expect(screen.queryByText("Location meublee (BIC)")).toBeNull();
  });

  it("LMNP : section presente + champs sousType/recettes/regime + reprise des loyers", () => {
    renderImmo(mkProp({ type: "LMNP", rentGrossAnnual: "12000" }));
    expect(screen.getByText("Location meublee (BIC)")).toBeTruthy();
    expect(screen.getByText("Type de location")).toBeTruthy();
    expect(screen.getByText("Recettes annuelles")).toBeTruthy();
    expect(screen.getByText("Regime fiscal")).toBeTruthy();
    expect(screen.getByText(/reprise des loyers saisis/)).toBeTruthy();
  });

  it("LMNP micro eligible : lecture seule abattement + base estimee", () => {
    renderImmo(mkProp({ type: "LMNP", rentGrossAnnual: "12000" }));
    expect(screen.getByText(/Base imposable estimee/)).toBeTruthy();
    // Pas de bloc reel en micro.
    expect(screen.queryByText("Prix d'acquisition")).toBeNull();
  });

  it("LMNP micro choisi AU-DESSUS du seuil : badge reel + alerte seuil + bloc reel", () => {
    renderImmo(mkProp({ type: "LMNP", regimeMeuble: "micro", recettesAnnuelles: "90000" }));
    expect(screen.getByText("Regime applique : reel")).toBeTruthy();
    expect(screen.getByText(/Seuil micro-BIC depasse/)).toBeTruthy();
    expect(screen.getByText("Prix d'acquisition")).toBeTruthy(); // reel de plein droit
  });

  it("LMNP reel + prix saisi : bloc amortissement + badge calcule", () => {
    renderImmo(mkProp({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "20000", prixAcquisition: "300000" }));
    expect(screen.getByText("Charges reelles/an")).toBeTruthy();
    expect(screen.getByText("Amortissement annuel")).toBeTruthy();
    expect(screen.getByText("Part terrain (%)")).toBeTruthy();
    expect(screen.getByText(/calcule/)).toBeTruthy();
  });

  it("LMNP reel + amortissement manuel : badge saisi", () => {
    renderImmo(mkProp({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "20000", amortissementAnnuelManuel: "5000" }));
    expect(screen.getByText(/saisi/)).toBeTruthy();
  });

  it("LMP : constat 'Statut LMP probable' (niveau dossier) des que type = LMP", () => {
    renderImmo(mkProp({ type: "LMP", rentGrossAnnual: "12000" }));
    expect(screen.getByText("Statut LMP probable")).toBeTruthy();
    // La section meublee s'affiche aussi pour un LMP (meme circuit BIC).
    expect(screen.getByText("Location meublee (BIC)")).toBeTruthy();
  });

  it("Tourisme non classe recettes > 23000 : alerte cotisations sociales courte duree", () => {
    renderImmo(mkProp({ type: "LMNP", sousType: "tourisme_non_classe", regimeMeuble: "reel", recettesAnnuelles: "30000" }));
    expect(screen.getByText(/Affiliation sociale des loueurs de courte duree/)).toBeTruthy();
  });

  // ── Lot 1bis point B : epuration du doublon ──
  it("LMNP : 'Loyer brut/an' et 'Autres charges/an' masques (bloc meuble = source unique)", () => {
    renderImmo(mkProp({ type: "LMNP", rentGrossAnnual: "12000" }));
    expect(screen.queryByText("Loyer brut/an")).toBeNull();
    expect(screen.queryByText("Autres charges/an")).toBeNull();
  });
  it("Location nue : 'Loyer brut/an' present (non regresse)", () => {
    renderImmo(mkProp({ type: "Location nue", rentGrossAnnual: "12000" }));
    expect(screen.getByText("Loyer brut/an")).toBeTruthy();
  });

  // ── Lot 1bis point A : modal Detail amortissement ──
  it("LMNP reel + prix saisi : bouton 'Detail' de l'amortissement present", () => {
    renderImmo(mkProp({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "20000", prixAcquisition: "300000" }));
    expect(screen.getByText("Detail")).toBeTruthy();
  });

  // ── Lot 1bis amendement : garde-fou Censi-Bouvard x amortissement ──
  it("LMNP reel + Censi-Bouvard : alerte conformite amortissement", () => {
    renderImmo(mkProp({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "20000", dispositifFiscal: "censiBouvard" }));
    expect(screen.getByText(/Censi-Bouvard : l'amortissement est exclu/)).toBeTruthy();
  });

  // ── Lot 2 : bouton "Projete 10 ans" (visible au reel resolu seulement) ──
  it("LMNP reel : bouton 'Projete 10 ans' present", () => {
    renderImmo(mkProp({ type: "LMNP", regimeMeuble: "reel", recettesAnnuelles: "20000" }));
    expect(screen.getByText(/Projete 10 ans/)).toBeTruthy();
  });
  it("LMNP micro : pas de bouton 'Projete 10 ans'", () => {
    renderImmo(mkProp({ type: "LMNP", rentGrossAnnual: "12000" }));
    expect(screen.queryByText(/Projete 10 ans/)).toBeNull();
  });
});
