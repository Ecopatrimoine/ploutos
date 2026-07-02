// @vitest-environment jsdom
//
// Barre d'ajout de placements (Design B) : familles en onglets + produits en
// pastilles cliquables, toujours visibles. On rend le VRAI TabPlacements (avec un
// dossier vide -> seules l'en-tete et la barre sont rendues) et on verifie :
//   1. les 4 familles sont rendues ;
//   2. les produits de la famille active (cash au depart) sont rendus ;
//   3. cliquer un produit appelle addPlacement avec le bon type ;
//   4. changer de famille change la rangee de produits.

import { describe, it, expect, vi, beforeAll } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { TabPlacements } from "../components/tabs/TabPlacements";
import type { Placement } from "../types/patrimoine";

// Polyfills jsdom minimaux et locaux (au cas ou un enfant Radix en aurait besoin).
beforeAll(() => {
  const noop = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = noop;
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = noop;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = noop;
  if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function renderPicker(addPlacement = vi.fn()) {
  const props = { data: { placements: [], properties: [] }, addPlacement };
  render(
    <Tabs value="placements">
      <TabPlacements {...props} />
    </Tabs>,
  );
  return { addPlacement };
}

describe("TabPlacements — barre d'ajout familles + produits", () => {
  it("rend les 4 familles (onglets)", () => {
    renderPicker();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /Liquidités/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Marchés/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Épargne assurantielle/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Retraite/ })).toBeTruthy();
  });

  it("famille active initiale = Liquidités (aria-pressed) et rend ses produits", () => {
    renderPicker();
    expect(screen.getByRole("tab", { name: /Liquidités/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Livret A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "PEL" })).toBeTruthy();
    // un produit d'une autre famille n'est PAS rendu
    expect(screen.queryByRole("button", { name: "PEA" })).toBeNull();
  });

  it("cliquer un produit appelle addPlacement avec le bon type", () => {
    const { addPlacement } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Livret A" }));
    expect(addPlacement).toHaveBeenCalledTimes(1);
    expect(addPlacement).toHaveBeenCalledWith("Livret A");
  });

  it("changer de famille change la rangee de produits + aria-pressed", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("tab", { name: /Marchés/ }));
    expect(screen.getByRole("button", { name: "PEA" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compte-titres" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Livret A" })).toBeNull();
    expect(screen.getByRole("tab", { name: /Marchés/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("tab", { name: /Liquidités/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

// Placement minimal valide (tous les champs requis).
function fullPlacement(over: Partial<Placement> = {}): Placement {
  return {
    id: "x", name: "", type: "Livret A", ownership: "person1", value: "", annualIncome: "",
    taxableIncome: "", deathValue: "", openDate: "", pfuEligible: false, pfuOptOut: false,
    totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "",
    ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: true,
    perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false,
    beneficiaries: [], ...over,
  } as Placement;
}

// Hote a etat qui reproduit l'insertion EN TETE d'App.addPlacement ([nouveau, ...prev]).
function Host() {
  const [placements, setPlacements] = React.useState<Placement[]>([
    fullPlacement({ id: "p-exist", name: "EXISTANT", type: "PEA" }),
  ]);
  const addPlacement = (type: string) =>
    setPlacements((prev) => [fullPlacement({ id: `p-new-${prev.length}`, name: "", type }), ...prev]);
  return (
    <Tabs value="placements">
      <TabPlacements
        data={{ placements, properties: [] }}
        addPlacement={addPlacement}
        removePlacement={() => {}}
        updatePlacementStr={() => {}}
        updatePlacementBool={() => {}}
        addPlacementBeneficiary={() => {}}
        updatePlacementBeneficiary={() => {}}
        removePlacementBeneficiary={() => {}}
        importFamilyBeneficiaries={() => {}}
        setData={() => {}}
        setField={() => {}}
        ownerOptions={[{ value: "person1", label: "P1" }, { value: "person2", label: "P2" }]}
        ir={{ marginalRate: 0.3 }}
        irOptions={{}}
        person1="P1"
        person2="P2"
      />
    </Tabs>
  );
}

describe("TabPlacements — nouveau placement insere en tete", () => {
  it("cliquer un produit fait apparaitre le nouveau placement en POSITION 0", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Livret A" }));
    // Le nouveau Livret A porte le badge fiscal "IR : Exonéré" (unique) ; l'ancien est le PEA "EXISTANT".
    const newBadge = screen.getByText(/Exonéré/);
    const existing = screen.getByDisplayValue("EXISTANT");
    // Le nouveau est rendu AVANT l'ancien -> il est en tete.
    expect(newBadge.compareDocumentPosition(existing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
