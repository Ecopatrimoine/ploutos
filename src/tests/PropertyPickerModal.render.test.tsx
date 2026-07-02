// @vitest-environment jsdom
//
// LOT D : meme fenetre d'ajout pour les BIENS immobiliers (composant generique
// AssetPickerModal). On rend le VRAI TabImmobilier (dossier vide) et on verifie :
//   1. la modale s'ouvre au clic sur « Ajouter un bien » ;
//   2. 4 groupes (regions) + 11 natures (tuiles) rendus ;
//   3. cliquer une tuile appelle addProperty avec la VALEUR INTERNE puis ferme ;
//   4. Echap ferme.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { TabImmobilier } from "../components/tabs/TabImmobilier";

function renderTab(addProperty = vi.fn()) {
  render(
    <Tabs value="immobilier">
      <TabImmobilier data={{ properties: [], placements: [] }} addProperty={addProperty} activeDonations={[]} />
    </Tabs>,
  );
  return { addProperty };
}

const openModal = () => fireEvent.click(screen.getByRole("button", { name: /Ajouter un bien/ }));

describe("AssetPickerModal (biens) — modale d'ajout de bien", () => {
  it("s'ouvre au clic sur « Ajouter un bien »", () => {
    renderTab();
    expect(screen.queryByRole("dialog")).toBeNull();
    openModal();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("rend 4 groupes (sections) et 11 natures (tuiles)", () => {
    renderTab();
    openModal();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("region")).toHaveLength(4); // 4 groupes
    const tiles = within(dialog).getAllByRole("button").filter((b) => b.getAttribute("aria-label") !== "Fermer");
    expect(tiles).toHaveLength(11); // 2 + 4 + 2 + 3
    for (const label of ["Usage personnel", "Locatif", "Structures", "Autres"]) {
      expect(within(dialog).getByText(label)).toBeTruthy();
    }
  });

  it("cliquer une tuile appelle addProperty avec la VALEUR INTERNE puis ferme", () => {
    const { addProperty } = renderTab();
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "SCPI" }));
    expect(addProperty).toHaveBeenCalledTimes(1);
    expect(addProperty).toHaveBeenCalledWith("SCPI"); // valeur interne PROPERTY_TYPES
    expect(screen.queryByRole("dialog")).toBeNull(); // fermeture
  });

  it("Echap ferme la modale", () => {
    renderTab();
    openModal();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
