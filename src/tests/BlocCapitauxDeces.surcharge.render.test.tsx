// @vitest-environment jsdom
//
// P3 Volet B — éditeur de surcharge manuelle de la dévolution + persistance.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlocCapitauxDeces } from "../components/succession/BlocCapitauxDeces";
import { patchPrevoyancePair } from "../lib/prevoyance/utils";
import type { CapitalDecesCaisseLine } from "../lib/calculs/succession";
import type { CapitalDecesCaisseSurcharge } from "../types/patrimoine";

// Polyfills MINIMAUX pour Radix Select sous jsdom (éditeur manuel).
beforeAll(() => {
  const noop = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = noop;
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = noop;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = noop;
  if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});

const EMPTY = { prives: [], rentes: [], totalPriveCapital: 0, totalPriveDuties: 0 };

function caisse(): CapitalDecesCaisseLine {
  return {
    source: "CPAM", capital: 4009, nbEnfants: 0, donneeIndisponible: false, exonere: true,
    repartition: [{ beneficiaire: "Marie", relation: "conjoint", montant: 4009, origine: "capital_principal", source: "auto" }],
  };
}

describe("BlocCapitauxDeces — éditeur de surcharge (Volet B)", () => {
  it("sans onSurchargeChange → lecture seule (pas d'éditeur)", () => {
    render(<BlocCapitauxDeces {...EMPTY} caisses={[caisse()]} totalCaisseExonere={4009} />);
    expect(screen.queryByText(/Dévolution du capital/i)).not.toBeInTheDocument();
  });

  it("mode auto par défaut + bascule en manuel via le toggle", () => {
    const onChange = vi.fn();
    render(
      <BlocCapitauxDeces {...EMPTY} caisses={[caisse()]} totalCaisseExonere={4009}
        surcharge={null} onSurchargeChange={onChange} />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect((radios[0] as HTMLInputElement).checked).toBe(true); // Automatique
    fireEvent.click(radios[1]); // Manuelle
    expect(onChange).toHaveBeenCalledWith({ beneficiaires: [] });
  });

  it("mode manuel : affiche les bénéficiaires et permet d'en ajouter", () => {
    const onChange = vi.fn();
    const surcharge: CapitalDecesCaisseSurcharge = {
      beneficiaires: [{ name: "Jean Concubin", relation: "autre", montant: 4009 }],
    };
    render(
      <BlocCapitauxDeces {...EMPTY} caisses={[caisse()]} totalCaisseExonere={4009}
        surcharge={surcharge} onSurchargeChange={onChange} />
    );
    expect(screen.getByDisplayValue("Jean Concubin")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Ajouter un bénéficiaire/i));
    expect(onChange).toHaveBeenCalledWith({
      beneficiaires: [
        { name: "Jean Concubin", relation: "autre", montant: 4009 },
        { name: "", relation: "autre", montant: 0 },
      ],
    });
  });

  it("retour au mode auto → onSurchargeChange(null)", () => {
    const onChange = vi.fn();
    render(
      <BlocCapitauxDeces {...EMPTY} caisses={[caisse()]} totalCaisseExonere={4009}
        surcharge={{ beneficiaires: [] }} onSurchargeChange={onChange} />
    );
    const radios = screen.getAllByRole("radio");
    expect((radios[1] as HTMLInputElement).checked).toBe(true); // Manuelle actif
    fireEvent.click(radios[0]); // Automatique
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("persistance de la surcharge dans data.prevoyance", () => {
  it("round-trip JSON sans perte", () => {
    const surcharge: CapitalDecesCaisseSurcharge = {
      beneficiaires: [{ name: "Jean", relation: "autre", montant: 1000 }],
    };
    const prevoyance = patchPrevoyancePair(undefined, "p1", { capitalDecesCaisseSurcharge: surcharge }, false);
    const reloaded = JSON.parse(JSON.stringify({ prevoyance }));
    expect(reloaded.prevoyance.p1.capitalDecesCaisseSurcharge).toEqual(surcharge);
  });
});
