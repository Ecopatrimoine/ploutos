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
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { TabPlacements } from "../components/tabs/TabPlacements";

// Polyfills jsdom minimaux et locaux (au cas ou un enfant Radix en aurait besoin).
beforeAll(() => {
  const noop = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = noop;
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
