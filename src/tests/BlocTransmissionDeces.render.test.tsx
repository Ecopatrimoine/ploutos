// @vitest-environment jsdom
//
// Lot 2 — Test de montage RTL de BlocTransmissionDeces.
//
// Vérifie que le bloc :
//   1. se monte sans throw, vide ;
//   2. se monte sans throw avec 1 contrat + 2 bénéficiaires (Select Radix inclus) ;
//   3. n'affiche le champ « Primes versées avant 70 ans » qu'en
//      natureAssiette === "primes_avant70" (masqué pour "capital").
//
// On NE touche pas le composant : test pur de montage / affichage conditionnel.

import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlocTransmissionDeces } from "../components/prevoyance/BlocTransmissionDeces";
import type { ContratTransmissionDeces } from "../types/patrimoine";

// Polyfills MINIMAUX et LOCAUX pour Radix Select sous jsdom (cf.
// BlocForfait.render.test.tsx — jamais dans setup.ts global).
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

function contratPrimes(over: Partial<ContratTransmissionDeces> = {}): ContratTransmissionDeces {
  return {
    id: "td_1",
    libelle: "Temporaire décès",
    assureur: "Compagnie X",
    natureAssiette: "primes_avant70",
    capitalTransmis: 200000,
    primesAvant70: 30000,
    beneficiaires: [
      { name: "Conjoint", relation: "conjoint", share: 50 },
      { name: "Enfant", relation: "enfant", share: 50 },
    ],
    ...over,
  };
}

const LABEL_PRIMES = /Primes versées avant 70 ans/i;

describe("BlocTransmissionDeces — montage RTL", () => {
  it("monte sans crash, vide", () => {
    render(<BlocTransmissionDeces contrats={[]} onChange={() => {}} />);
    expect(screen.getByText("Capital décès")).toBeInTheDocument();
    expect(screen.getByText(/Aucun contrat de transmission/i)).toBeInTheDocument();
  });

  it("monte sans crash avec 1 contrat + 2 bénéficiaires", () => {
    render(<BlocTransmissionDeces contrats={[contratPrimes()]} onChange={() => {}} />);
    // Preuve de montage : combobox de relation présents (un par bénéficiaire).
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByDisplayValue("Temporaire décès")).toBeInTheDocument();
  });

  it("affiche le champ primes uniquement en natureAssiette=primes_avant70", () => {
    const { rerender } = render(
      <BlocTransmissionDeces contrats={[contratPrimes()]} onChange={() => {}} />
    );
    expect(screen.getByText(LABEL_PRIMES)).toBeInTheDocument();

    // Bascule sur "capital" : le champ primes disparaît.
    rerender(
      <BlocTransmissionDeces
        contrats={[contratPrimes({ natureAssiette: "capital" })]}
        onChange={() => {}}
      />
    );
    expect(screen.queryByText(LABEL_PRIMES)).not.toBeInTheDocument();
  });
});
