// @vitest-environment jsdom
//
// BlocTransmissionDeces — montage RTL (Lot 2) + picker « depuis la famille » (Lot P2).
//
// Montages : se monte vide / avec bénéficiaires / champ primes conditionnel.
// Picker P2 : puces des membres de la famille, pré-remplissage name+relation
// (éditable ensuite), anti-doublon, dégradation gracieuse sans famille. On NE
// touche PAS le calcul succession : le picker ne fait qu'écrire name/relation.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlocTransmissionDeces } from "../components/prevoyance/BlocTransmissionDeces";
import type { Child, ContratTransmissionDeces, PatrimonialData } from "../types/patrimoine";

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

function contratVide(over: Partial<ContratTransmissionDeces> = {}): ContratTransmissionDeces {
  return {
    id: "td_v",
    libelle: "Contrat",
    natureAssiette: "capital",
    capitalTransmis: 100000,
    beneficiaires: [],
    ...over,
  };
}

const LABEL_PRIMES = /Primes versées avant 70 ans/i;

// Dossier minimal : seuls les champs lus par le picker, le reste casté.
function makeData(over: Partial<PatrimonialData>): PatrimonialData {
  return {
    coupleStatus: "single",
    person1FirstName: "Pierre",
    person1LastName: "Martin",
    person2FirstName: "",
    person2LastName: "",
    childrenData: [],
    ...over,
  } as unknown as PatrimonialData;
}

function makeChild(over: Partial<Child>): Child {
  return {
    firstName: "",
    lastName: "",
    birthDate: "",
    parentLink: "common_child",
    custody: "full",
    rattached: true,
    handicap: false,
    ...over,
  } as Child;
}

// Dossier « famille » : marié + conjoint Marie + 1 enfant commun Léa.
function familleMariee(): PatrimonialData {
  return makeData({
    coupleStatus: "married",
    person2FirstName: "Marie",
    person2LastName: "Martin",
    childrenData: [makeChild({ firstName: "Léa", lastName: "Martin", parentLink: "common_child" })],
  });
}

describe("BlocTransmissionDeces — montage RTL", () => {
  it("monte sans crash, vide", () => {
    render(<BlocTransmissionDeces contrats={[]} onChange={() => {}} />);
    expect(screen.getByText("Capital décès")).toBeInTheDocument();
    expect(screen.getByText(/Aucun contrat de transmission/i)).toBeInTheDocument();
  });

  it("monte sans crash avec 1 contrat + 2 bénéficiaires", () => {
    render(<BlocTransmissionDeces contrats={[contratPrimes()]} onChange={() => {}} />);
    // Sans data -> pas de picker ; 2 combobox = les 2 Select relation.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByDisplayValue("Temporaire décès")).toBeInTheDocument();
  });

  it("affiche le champ primes uniquement en natureAssiette=primes_avant70", () => {
    const { rerender } = render(
      <BlocTransmissionDeces contrats={[contratPrimes()]} onChange={() => {}} />
    );
    expect(screen.getByText(LABEL_PRIMES)).toBeInTheDocument();

    rerender(
      <BlocTransmissionDeces
        contrats={[contratPrimes({ natureAssiette: "capital" })]}
        onChange={() => {}}
      />
    );
    expect(screen.queryByText(LABEL_PRIMES)).not.toBeInTheDocument();
  });
});

describe("BlocTransmissionDeces — picker « depuis la famille » (Lot P2)", () => {
  it("liste les membres de la famille en puces (noms)", () => {
    render(
      <BlocTransmissionDeces contrats={[contratVide()]} onChange={() => {}} data={familleMariee()} whichDefunt={1} />
    );
    expect(screen.getByText("Depuis la famille :")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marie Martin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Léa Martin/i })).toBeInTheDocument();
  });

  it("clic puce conjoint -> bénéficiaire pré-rempli { name, relation: 'conjoint', share: 0 }", () => {
    const onChange = vi.fn();
    render(
      <BlocTransmissionDeces contrats={[contratVide()]} onChange={onChange} data={familleMariee()} whichDefunt={1} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Marie Martin/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ContratTransmissionDeces[];
    expect(next[0].beneficiaires).toEqual([{ name: "Marie Martin", relation: "conjoint", share: 0 }]);
  });

  it("clic puce enfant -> relation 'enfant'", () => {
    const onChange = vi.fn();
    render(
      <BlocTransmissionDeces contrats={[contratVide()]} onChange={onChange} data={familleMariee()} whichDefunt={1} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Léa Martin/i }));
    const next = onChange.mock.calls[0][0] as ContratTransmissionDeces[];
    expect(next[0].beneficiaires[0]).toMatchObject({ name: "Léa Martin", relation: "enfant", share: 0 });
  });

  it("après pré-remplissage : le Select relation est présent et éditable", () => {
    const contrat = contratVide({ beneficiaires: [{ name: "Marie Martin", relation: "conjoint", share: 0 }] });
    render(
      <BlocTransmissionDeces contrats={[contrat]} onChange={() => {}} data={familleMariee()} whichDefunt={1} />
    );
    const combos = screen.getAllByRole("combobox"); // Select relation du bénéficiaire
    expect(combos.length).toBeGreaterThanOrEqual(1);
    combos.forEach((cb) => expect(cb).not.toBeDisabled());
  });

  it("anti-doublon : la puce d'un membre déjà bénéficiaire est désactivée", () => {
    const contrat = contratVide({ beneficiaires: [{ name: "Marie Martin", relation: "conjoint", share: 0 }] });
    render(
      <BlocTransmissionDeces contrats={[contrat]} onChange={() => {}} data={familleMariee()} whichDefunt={1} />
    );
    expect(screen.getByRole("button", { name: /Marie Martin/i })).toBeDisabled();
    // l'enfant pas encore ajouté reste actif
    expect(screen.getByRole("button", { name: /Léa Martin/i })).not.toBeDisabled();
  });

  it("dossier sans famille -> aucune puce, saisie libre fonctionne", () => {
    const onChange = vi.fn();
    render(
      <BlocTransmissionDeces contrats={[contratVide()]} onChange={onChange} data={makeData({ coupleStatus: "single" })} whichDefunt={1} />
    );
    expect(screen.queryByText("Depuis la famille :")).not.toBeInTheDocument();
    // Le chemin « Autre / hors famille » (saisie libre) reste fonctionnel.
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un bénéficiaire/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ContratTransmissionDeces[];
    expect(next[0].beneficiaires).toHaveLength(1);
  });
});
