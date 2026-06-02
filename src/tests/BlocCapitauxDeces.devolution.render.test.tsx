// @vitest-environment jsdom
//
// P3 Volet C — affichage de la dévolution du capital décès caisse (qui perçoit).

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BlocCapitauxDeces } from "../components/succession/BlocCapitauxDeces";
import type { CapitalDecesCaisseLine } from "../lib/calculs/succession";

function norm(t: string | null): string {
  return (t ?? "").replace(/\s/g, "");
}

const EMPTY = {
  caisses: [] as CapitalDecesCaisseLine[],
  prives: [],
  rentes: [],
  totalCaisseExonere: 0,
  totalPriveCapital: 0,
  totalPriveDuties: 0,
};

function ligne(over: Partial<CapitalDecesCaisseLine> = {}): CapitalDecesCaisseLine {
  return {
    source: "CPAM", capital: 4009, nbEnfants: 0,
    donneeIndisponible: false, exonere: true, repartition: [],
    ...over,
  };
}

describe("BlocCapitauxDeces — affichage de la dévolution", () => {
  it("dévolution légale (conjoint) → bénéficiaire + montant exonéré affichés", () => {
    const caisse = ligne({
      repartition: [{ beneficiaire: "Marie Martin", relation: "conjoint", montant: 4009, origine: "capital_principal", source: "auto" }],
    });
    const { container, getByText } = render(
      <BlocCapitauxDeces {...EMPTY} caisses={[caisse]} totalCaisseExonere={4009} />
    );
    expect(getByText(/dévolution légale/i)).toBeInTheDocument();
    expect(getByText(/Marie Martin/)).toBeInTheDocument();
    expect(norm(container.textContent)).toContain("4009€");
  });

  it("capital orphelin → mention « orphelin » par enfant", () => {
    const caisse = ligne({
      source: "SSI", capital: 9612, capitalParEnfant: 2403, nbEnfants: 2, capitalOrphelinTotal: 4806,
      repartition: [
        { beneficiaire: "Marie", relation: "conjoint", montant: 9612, origine: "capital_principal", source: "auto" },
        { beneficiaire: "Léa", relation: "enfant", montant: 2403, origine: "capital_orphelin", source: "auto" },
        { beneficiaire: "Tom", relation: "enfant", montant: 2403, origine: "capital_orphelin", source: "auto" },
      ],
    });
    const { getAllByText } = render(<BlocCapitauxDeces {...EMPTY} caisses={[caisse]} totalCaisseExonere={9612} />);
    expect(getAllByText(/orphelin/i).length).toBeGreaterThanOrEqual(2);
  });

  it("surcharge manuelle → mention « désignation manuelle »", () => {
    const caisse = ligne({
      repartition: [{ beneficiaire: "Jean Concubin", relation: "autre", montant: 4009, origine: "capital_principal", source: "manuel" }],
    });
    const { getByText } = render(<BlocCapitauxDeces {...EMPTY} caisses={[caisse]} totalCaisseExonere={4009} />);
    expect(getByText(/désignation manuelle/i)).toBeInTheDocument();
    expect(getByText(/Jean Concubin/)).toBeInTheDocument();
  });

  it("aucun bénéficiaire (répartition vide) → « bénéficiaire à déterminer », pas « 0 € »", () => {
    const caisse = ligne({ repartition: [] });
    const { container, getByText } = render(<BlocCapitauxDeces {...EMPTY} caisses={[caisse]} totalCaisseExonere={4009} />);
    expect(getByText(/à déterminer/i)).toBeInTheDocument();
    expect(norm(container.textContent)).not.toContain("0€");
  });
});
