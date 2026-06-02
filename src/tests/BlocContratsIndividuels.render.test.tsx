// @vitest-environment jsdom
//
// VOIE A — R3 Volet 1 : "deces_capital" retiré des options de CRÉATION des
// contrats individuels (saisie unique côté Transmission décès), MAIS un ancien
// contrat deces_capital reste lisible (item désactivé).

import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlocContratsIndividuels } from "../components/prevoyance/BlocContratsIndividuels";
import { getContratsTransmissionDecesAvecLegacy } from "../lib/prevoyance/utils";
import type { PayloadContratIndividuel, PayloadPrevoyancePerso } from "../types/patrimoine";

// Polyfills MINIMAUX et LOCAUX pour Radix Select sous jsdom (cf. BlocForfait.render).
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

function ouvrirSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
}

describe("BlocContratsIndividuels — R3 retrait de la saisie du capital décès", () => {
  it("(a) les options de type proposées ne contiennent plus « Capital décès »", async () => {
    const contrat: PayloadContratIndividuel = { id: "c1", type: "ptia", capitalOuMontant: 0 };
    render(<BlocContratsIndividuels contrats={[contrat]} onChange={() => {}} />);
    ouvrirSelect(screen.getByRole("combobox")); // ptia → un seul select (pas de Nature)
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o) => /Capital décès/i.test(o.textContent ?? ""))).toBe(false);
    // Contrôle positif : les autres types restent proposés.
    expect(options.some((o) => /Rente conjoint/i.test(o.textContent ?? ""))).toBe(true);
  });

  it("(b) un contrat deces_capital legacy s'affiche sans crash (item désactivé)", async () => {
    const legacy: PayloadContratIndividuel = { id: "old", type: "deces_capital", capitalOuMontant: 50000 };
    render(<BlocContratsIndividuels contrats={[legacy]} onChange={() => {}} />);
    // Monte sans throw ; le montant saisi est rendu.
    expect(screen.getByDisplayValue("50000")).toBeInTheDocument();
    // Le type legacy est affiché (item présent), et DÉSACTIVÉ (non re-sélectionnable).
    ouvrirSelect(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    const legacyOption = options.find((o) => /Capital décès/i.test(o.textContent ?? ""));
    expect(legacyOption).toBeTruthy();
    expect(legacyOption?.getAttribute("aria-disabled")).toBe("true");
  });

  it("(c) non-régression bridge R2 : un deces_capital legacy reste vu en transmission", () => {
    const perso = {
      contratsIndividuels: [{ id: "old", type: "deces_capital", capitalOuMontant: 50000 }],
      couvertureCollective: null,
      categorieInvaliditeProjetee: "cat2",
    } as unknown as PayloadPrevoyancePerso;
    const ponts = getContratsTransmissionDecesAvecLegacy(perso);
    expect(ponts).toHaveLength(1);
    expect(ponts[0].capitalTransmis).toBe(50000);
  });
});
