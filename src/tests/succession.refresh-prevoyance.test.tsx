// @vitest-environment jsdom
//
// Anti-régression du bug « contrat décès legacy fantôme » : la succession doit
// se RAFRAÎCHIR quand SEUL data.prevoyance change (références properties/placements
// inchangées — exactement ce que produit setData).
//
// Le filet existant appelait computeSuccession directement, sans passer par la
// mémoïsation de la vue → le trou (deps partielles excluant data.prevoyance)
// n'était pas couvert. Ce test reproduit le pattern de mémoïsation CORRIGÉ d'App
// (useMemo keyé sur `data` entier) et la mutation réelle (nouvelle référence de
// data, mais MÊMES tableaux properties/placements), puis vérifie que le capital
// legacy DISPARAÎT de la succession après suppression.

import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { computeSuccession } from "../lib/calculs/succession";
import type { PatrimonialData, PayloadContratIndividuel, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

function legacyDecesCapital(montant: number): PayloadContratIndividuel {
  return { id: "old_dc", type: "deces_capital", capitalOuMontant: montant } as unknown as PayloadContratIndividuel;
}

function baseData(): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1955-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    prevoyance: {
      version: 1,
      p1: {
        contratsIndividuels: [legacyDecesCapital(200000)],
        couvertureCollective: null,
        categorieInvaliditeProjetee: "cat2",
      },
      p2: null,
    },
  } as unknown as PatrimonialData;
}

const SUCCESSION: SuccessionData = {
  deceasedPerson: "person1", spouseOption: "legal_quarter_full",
  heirs: [], testamentHeirs: [], legsPrecisItems: [], spousePresent: true,
  useTestament: false, legsMode: "global",
} as unknown as SuccessionData;

// Harness reproduisant FIDÈLEMENT le pattern d'App corrigé (deps = data entier)
// + le comportement de setData (spread → nouvelle ref data, properties/placements
// conservés par référence).
function Harness() {
  const [data, setData] = React.useState<PatrimonialData>(baseData);
  const succession = React.useMemo(() => computeSuccession(SUCCESSION, data), [data]);
  return (
    <div>
      <div data-testid="cap">{succession.capitalDecesPriveCapital}</div>
      <button
        onClick={() =>
          setData((prev) => ({
            ...prev, // nouvelle référence de data ; properties/placements INCHANGÉS
            prevoyance: {
              ...prev.prevoyance!,
              p1: { ...prev.prevoyance!.p1, contratsIndividuels: [] },
            },
          }))
        }
      >
        supprimer
      </button>
    </div>
  );
}

describe("succession — rafraîchissement sur changement data.prevoyance", () => {
  it("la suppression d'un contrat décès legacy le fait disparaître de la succession", () => {
    render(<Harness />);
    // Le capital legacy (200000) est agrégé via le pont R2 (Option A).
    expect(screen.getByTestId("cap").textContent).toBe("200000");

    fireEvent.click(screen.getByText("supprimer"));

    // Après suppression : data change UNIQUEMENT sur prevoyance → la vue se
    // recalcule (deps = data) → le capital fantôme a disparu.
    expect(screen.getByTestId("cap").textContent).toBe("0");
  });
});
