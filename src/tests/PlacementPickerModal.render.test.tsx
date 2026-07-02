// @vitest-environment jsdom
//
// Pivot UI : bouton "Ajouter un placement" -> modale a 4 sections (familles) et
// tuiles produits. On rend le VRAI TabPlacements (dossier vide) qui cable
// l'ouverture/fermeture/selection, et on verifie :
//   1. la modale s'ouvre au clic ;
//   2. 4 familles (regions) + 17 produits (tuiles) rendus ;
//   3. les libelles AV monosupport/multisupport sont affiches (pas les valeurs internes) ;
//   4. cliquer une tuile appelle addPlacement avec la VALEUR INTERNE puis ferme ;
//   5. Echap ferme.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { TabPlacements } from "../components/tabs/TabPlacements";

function renderTab(addPlacement = vi.fn()) {
  render(
    <Tabs value="placements">
      <TabPlacements data={{ placements: [], properties: [] }} addPlacement={addPlacement} />
    </Tabs>,
  );
  return { addPlacement };
}

const openModal = () => fireEvent.click(screen.getByRole("button", { name: /Ajouter un placement/ }));

describe("PlacementPickerModal — modale d'ajout", () => {
  it("s'ouvre au clic sur « Ajouter un placement »", () => {
    renderTab();
    expect(screen.queryByRole("dialog")).toBeNull();
    openModal();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("rend 4 familles (sections) et 17 produits (tuiles)", () => {
    renderTab();
    openModal();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("region")).toHaveLength(4); // 4 familles
    const tiles = within(dialog).getAllByRole("button").filter((b) => b.getAttribute("aria-label") !== "Fermer");
    expect(tiles).toHaveLength(17); // 7 + 4 + 3 + 3
    // libelles de familles
    for (const label of ["Liquidités", "Marchés", "Épargne assurantielle", "Retraite"]) {
      expect(within(dialog).getByText(label)).toBeTruthy();
    }
  });

  it("affiche les libelles AV monosupport/multisupport, jamais les valeurs internes", () => {
    renderTab();
    openModal();
    expect(screen.getByRole("button", { name: "Assurance-vie monosupport" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assurance-vie multisupport" })).toBeTruthy();
    expect(screen.queryByText("Assurance-vie fonds euros")).toBeNull();
    expect(screen.queryByText("Assurance-vie unités de compte")).toBeNull();
  });

  it("cliquer une tuile appelle addPlacement avec la VALEUR INTERNE puis ferme", () => {
    const { addPlacement } = renderTab();
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Assurance-vie monosupport" }));
    expect(addPlacement).toHaveBeenCalledTimes(1);
    expect(addPlacement).toHaveBeenCalledWith("Assurance-vie fonds euros"); // valeur interne, pas le libelle
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
