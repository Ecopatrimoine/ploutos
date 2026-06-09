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
  RenteEducationBrancheLine,
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

  it("répartition par défaut (clause Syntec) → libellé + bénéficiaire + montant exonéré", () => {
    const branche: CapitalDecesBrancheLine = {
      source: "Syntec", capital: 163404, categorie: "cadres",
      exonere: true, donneeIndisponible: false, beneficiairesAuContrat: true,
      repartition: [{ beneficiaire: "Marie Martin", relation: "conjoint", montant: 163404, origine: "capital_principal", source: "auto" }],
    };
    const { container, getByText } = render(<BlocCapitauxDeces {...EMPTY} branche={[branche]} />);
    expect(getByText(/clause type Syntec/)).toBeInTheDocument();
    const t = norm(container.textContent);
    expect(t).toContain(norm("Marie Martin"));
    expect(t).toContain("163404€");
    expect(t).toContain("exonéré".replace(/\s/g, ""));
  });

  it("répartition personnalisée (surcharge) → libellé « répartition personnalisée »", () => {
    const branche: CapitalDecesBrancheLine = {
      source: "Syntec", capital: 163404, categorie: "cadres",
      exonere: true, donneeIndisponible: false, beneficiairesAuContrat: true,
      repartition: [{ beneficiaire: "Fondation Y", relation: "autre", montant: 163404, origine: "capital_principal", source: "manuel" }],
    };
    const { getByText } = render(<BlocCapitauxDeces {...EMPTY} branche={[branche]} />);
    expect(getByText(/répartition personnalisée/)).toBeInTheDocument();
    expect(getByText(/Fondation Y/)).toBeInTheDocument();
  });
});

describe("BlocCapitauxDeces — sous-section rente éducation de branche (LOT DECES-B-ii)", () => {
  const brancheCapital: CapitalDecesBrancheLine = {
    source: "Syntec", capital: 163404, categorie: "cadres",
    exonere: true, donneeIndisponible: false, beneficiairesAuContrat: true,
    repartition: [],
  };

  it("1 enfant à charge → prénom, montant courant, projection des phases, cumul + exonéré", () => {
    const rente: RenteEducationBrancheLine = {
      enfantPrenom: "Léa", ageActuel: 10, montantAnnuelCourant: 11534.4,
      phases: [
        { deAge: 0, aAge: 18, montantAnnuel: 11534.4 },
        { deAge: 18, aAge: 26, montantAnnuel: 14418 },
      ],
      donneeIndisponible: false, exonere: true, source: "Syntec",
    };
    const { container, getByText } = render(
      <BlocCapitauxDeces {...EMPTY} branche={[brancheCapital]} renteEducationBranche={[rente]} />
    );
    expect(getByText(/Rente éducation de branche/)).toBeInTheDocument();
    expect(getByText(/Léa/)).toBeInTheDocument();
    const t = norm(container.textContent);
    expect(t).toContain("11534"); // montant courant (phase active 0-18)
    expect(t).toContain(norm("jusqu'à 18 ans"));
    expect(t).toContain(norm("jusqu'à 26 ans"));
    expect(t).toContain(norm("cumulative avec le capital"));
  });

  it("enfant > 18 → seule la phase restante (jusqu'à 26 ans) est projetée", () => {
    const rente: RenteEducationBrancheLine = {
      enfantPrenom: "Tom", ageActuel: 20, montantAnnuelCourant: 14418,
      phases: [
        { deAge: 0, aAge: 18, montantAnnuel: 11534.4 },
        { deAge: 18, aAge: 26, montantAnnuel: 14418 },
      ],
      donneeIndisponible: false, exonere: true, source: "Syntec",
    };
    const { container } = render(
      <BlocCapitauxDeces {...EMPTY} branche={[brancheCapital]} renteEducationBranche={[rente]} />
    );
    const t = norm(container.textContent);
    expect(t).toContain(norm("jusqu'à 26 ans"));
    expect(t).not.toContain(norm("jusqu'à 18 ans")); // phase 0-18 écoulée → masquée
  });

  it("donneeIndisponible (âge inconnu) → mention neutre, jamais « 0 € »", () => {
    const rente: RenteEducationBrancheLine = {
      enfantPrenom: "Sans", ageActuel: null, montantAnnuelCourant: null,
      phases: [], donneeIndisponible: true, exonere: true, source: "Syntec",
    };
    const { container, getByText } = render(
      <BlocCapitauxDeces {...EMPTY} branche={[brancheCapital]} renteEducationBranche={[rente]} />
    );
    expect(getByText(/Donnée de branche non disponible/)).toBeInTheDocument();
    expect(norm(container.textContent)).not.toContain("0€/an");
  });
});

describe("BlocCapitauxDeces — libellés CCN dynamiques (LOT LABEL-CCN)", () => {
  const NOM_HCR = "Hôtels, cafés, restaurants (HCR)";

  it("dossier HCR → clause de dévolution + titre rente portent le nom HCR, jamais « Syntec »", () => {
    const branche: CapitalDecesBrancheLine = {
      source: NOM_HCR, capital: 45000, categorie: "nonCadres",
      exonere: true, donneeIndisponible: false, beneficiairesAuContrat: true,
      repartition: [{ beneficiaire: "Lea Perry", relation: "enfant", montant: 45000, origine: "capital_principal", source: "auto" }],
    };
    const rente: RenteEducationBrancheLine = {
      enfantPrenom: "Lea", ageActuel: 6, montantAnnuelCourant: 3600,
      phases: [{ deAge: 0, aAge: 8, montantAnnuel: 3600 }, { deAge: 8, aAge: 26, montantAnnuel: 5400 }],
      donneeIndisponible: false, exonere: true, source: NOM_HCR,
    };
    const { container } = render(
      <BlocCapitauxDeces {...EMPTY} branche={[branche]} renteEducationBranche={[rente]} />
    );
    const t = norm(container.textContent);
    // Clause de dévolution dynamique : "clause type Hôtels..." (et plus le Syntec figé).
    expect(t).toContain(norm("clause type Hôtels"));
    // Titre du poste rente éducation : nom HCR injecté.
    expect(t).toContain(norm("Rente éducation de branche (Hôtels"));
    // Aucune trace du libellé figé d'avant.
    expect(t).not.toContain("Syntec");
  });

  it("source de branche vide → titre rente éducation SANS parenthèse (garde défensive)", () => {
    const branche: CapitalDecesBrancheLine = {
      source: "", capital: null, categorie: "nonCadres",
      exonere: true, donneeIndisponible: true, beneficiairesAuContrat: true,
      repartition: [],
    };
    const rente: RenteEducationBrancheLine = {
      enfantPrenom: "Lea", ageActuel: 6, montantAnnuelCourant: 3600,
      phases: [{ deAge: 0, aAge: 8, montantAnnuel: 3600 }],
      donneeIndisponible: false, exonere: true, source: "",
    };
    const { container, getByText } = render(
      <BlocCapitauxDeces {...EMPTY} branche={[branche]} renteEducationBranche={[rente]} />
    );
    expect(getByText(/Rente éducation de branche/)).toBeInTheDocument();
    // Pas de parenthèse vide accolée au titre ("... branche (" interdit).
    expect(norm(container.textContent)).not.toContain(norm("Rente éducation de branche ("));
  });
});
