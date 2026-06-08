// @vitest-environment jsdom
//
// Lot 4 — Test de montage RTL du bloc présentationnel BlocCapitauxDeces.
// Composant PUR (divs only, pas de Radix) : montage direct, sans polyfill.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BlocCapitauxDeces } from "../components/succession/BlocCapitauxDeces";
import type {
  CapitalDecesCaisseLine,
  CapitalDecesPriveLine,
  CapitalDecesBrancheLine,
  RenteSurvieAnnuelle,
} from "../lib/calculs/succession";

// euro() insère des espaces fins insécables (U+202F / U+00A0), tous couverts par
// \s : on normalise en retirant toute espace pour des assertions robustes.
function norm(text: string | null): string {
  return (text ?? "").replace(/\s/g, "");
}

const EMPTY = {
  caisses: [] as CapitalDecesCaisseLine[],
  prives: [] as CapitalDecesPriveLine[],
  rentes: [] as RenteSurvieAnnuelle[],
  totalCaisseExonere: 0,
  totalPriveCapital: 0,
  totalPriveDuties: 0,
};

describe("BlocCapitauxDeces — montage", () => {
  it("dossier sans capitaux décès → ne rend rien (rétrocompat)", () => {
    const { container } = render(<BlocCapitauxDeces {...EMPTY} />);
    expect(container.firstChild).toBeNull();
  });

  it("1 caisse exonérée + 1 rente annuelle → les deux apparaissent, rente en €/an, capital non sommé", () => {
    const caisse: CapitalDecesCaisseLine = {
      source: "CARPV", capital: 113955, nbEnfants: 0,
      donneeIndisponible: false, exonere: true,
    };
    const rente: RenteSurvieAnnuelle = { source: "CARPV", type: "conjoint", montantAnnuel: 14445 };
    const { container, getByText } = render(
      <BlocCapitauxDeces {...EMPTY} caisses={[caisse]} rentes={[rente]} totalCaisseExonere={113955} />
    );
    const t = norm(container.textContent);
    expect(t).toContain("113955€");          // capital exonéré
    expect(getByText(/Rente de survie du conjoint/)).toBeInTheDocument();
    expect(t).toContain("14445€/an");         // rente ANNUELLE marquée /an
    // Le capital affiché reste 113955 (jamais 113955 + 14445 = 128400).
    expect(t).not.toContain("128400€");
    expect(getByText(/annuelles/i)).toBeInTheDocument();
  });

  it("donneeIndisponible=true → mention neutre, jamais « 0 € »", () => {
    const caisse: CapitalDecesCaisseLine = {
      source: "CARMF", capital: null, nbEnfants: 0,
      donneeIndisponible: true, exonere: true,
    };
    const { container, getByText } = render(
      <BlocCapitauxDeces {...EMPTY} caisses={[caisse]} totalCaisseExonere={0} />
    );
    expect(getByText(/Donnée régime non disponible/)).toBeInTheDocument();
    // Aucun montant nul trompeur (ni en-tête, ni ligne).
    expect(norm(container.textContent)).not.toContain("0€");
  });

  it("1 contrat privé taxable → capital, assiette, abattement, base taxable et droits 990 I", () => {
    const prive: CapitalDecesPriveLine = {
      contrat: "Temporaire décès", beneficiary: "Enfant Martin", relation: "enfant",
      sharePct: 100, montant: 200000, natureAssiette: "capital",
      assiette990I: 200000, before70Taxable: 47500, duties: 9500,
    };
    const { container, getByText, getAllByText } = render(
      <BlocCapitauxDeces {...EMPTY} prives={[prive]} totalPriveCapital={200000} totalPriveDuties={9500} />
    );
    const t = norm(container.textContent);
    expect(getByText(/Contrats de prévoyance décès/)).toBeInTheDocument();
    expect(t).toContain("200000€");   // capital transmis
    expect(t).toContain("47500€");    // base taxable après abattement
    expect(t).toContain("9500€");     // droits 990 I
    expect(t).toContain("152500€");   // abattement utilisé (200000 − 47500)
    expect(getAllByText(/Net transmis/).length).toBeGreaterThan(0);
  });
});

describe("BlocCapitauxDeces — sous-bloc prévoyance collective de branche (LOT DECES-A)", () => {
  it("capital de branche exonéré → libellé, montant et badge exonéré", () => {
    const branche: CapitalDecesBrancheLine = {
      source: "Syntec", capital: 163404, categorie: "cadres",
      exonere: true, donneeIndisponible: false, beneficiairesAuContrat: true,
    };
    const { container, getByText } = render(<BlocCapitauxDeces {...EMPTY} branche={[branche]} />);
    expect(getByText(/Prévoyance collective de branche/)).toBeInTheDocument();
    const t = norm(container.textContent);
    expect(t).toContain("163404€");
    expect(t).toContain(norm("Versé aux bénéficiaires désignés au contrat"));
  });

  it("branche donneeIndisponible=true → mention neutre, jamais « 0 € »", () => {
    const branche: CapitalDecesBrancheLine = {
      source: "Métallurgie", capital: null, categorie: "nonCadres",
      exonere: true, donneeIndisponible: true, beneficiairesAuContrat: true,
    };
    const { container, getByText } = render(<BlocCapitauxDeces {...EMPTY} branche={[branche]} />);
    expect(getByText(/Donnée de branche non disponible/)).toBeInTheDocument();
    expect(norm(container.textContent)).not.toContain("0€");
  });
});
