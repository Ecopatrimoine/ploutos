// @vitest-environment jsdom
//
// LOT 2 — Test de rendu du bloc ecran obligations de branche + verdicts gap.
// Composant purement presentationnel : on lui passe une ComparaisonBrancheVue
// synthetique (forme reelle des types du Lot 1) et on verifie le rendu.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlocObligationsBranche } from "../components/prevoyance/BlocObligationsBranche";
import type { ComparaisonBrancheVue } from "../lib/prevoyance/comparaison-branche-vue";

const REGEX_ASSUREURS = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut/i;

// Vue Syntec synthetique : un college avec un verdict insuffisant ET un indetermine.
const vueSyntec: ComparaisonBrancheVue = {
  statut: "branche_documentee",
  statutLabel: "Obligations de branche documentees",
  afficherAvertissementIncomplet: false,
  souscritRenseigne: false,
  idcc: "1486",
  nomCCN: "Syntec",
  colleges: [
    {
      libelle: "Cadres",
      verdictGlobal: "insuffisant",
      verdictGlobalLabel: "Insuffisant",
      lignes: [
        {
          garantie: "capitalDC",
          garantieLabel: "Capital deces",
          obligationResume: "Capital deces : 1,7x salaire de reference",
          presente: true,
          donneeIndisponible: false,
          verdict: "insuffisant",
          verdictLabel: "Insuffisant",
          motif: "Capital souscrit 1 < obligation 1,7 (fraction du salaire de reference).",
        },
        {
          garantie: "renteEducation",
          garantieLabel: "Rente education",
          obligationResume: "Rente education : 12 % [0-26 ans]",
          presente: true,
          donneeIndisponible: false,
          verdict: "indetermine",
          verdictLabel: "A etudier",
          motif: "Bareme conventionnel a paliers/situations : comparaison manuelle requise.",
        },
      ],
    },
  ],
  tauxT1: { taux: 1.5, label: "1,5 % T1", donneeIndisponible: false },
  sante: { presente: false, label: "Aucun regime sante de branche documente" },
};

// Vue etat vide : aucune convention reconnue.
const vueVide: ComparaisonBrancheVue = {
  statut: "idcc_absent",
  statutLabel: "Aucune convention de branche renseignee",
  afficherAvertissementIncomplet: false,
  souscritRenseigne: false,
  idcc: null,
  nomCCN: null,
  colleges: [],
  tauxT1: null,
  sante: null,
};

describe("BlocObligationsBranche — rendu (LOT 2)", () => {
  it("(a) rend les libelles garantie et les verdicts insuffisant + indetermine", () => {
    render(<BlocObligationsBranche vue={vueSyntec} />);
    expect(screen.getByText("Capital deces")).toBeInTheDocument();
    expect(screen.getByText("Rente education")).toBeInTheDocument();
    // "Insuffisant" apparait au moins une fois (badge college + badge ligne).
    expect(screen.getAllByText("Insuffisant").length).toBeGreaterThanOrEqual(1);
    // "A etudier" : badge de la ligne renteEducation (relabel LOT 4).
    expect(screen.getByText("A etudier")).toBeInTheDocument();
    // Le motif distingue "comparaison manuelle requise" -> rendu.
    expect(screen.getByText(/comparaison manuelle requise/i)).toBeInTheDocument();
  });

  it("(b) colleges vides -> etat vide propre (statutLabel), aucun crash", () => {
    render(<BlocObligationsBranche vue={vueVide} />);
    // statutLabel rendu (sous-titre + etat vide).
    expect(screen.getAllByText("Aucune convention de branche renseignee").length).toBeGreaterThanOrEqual(1);
  });

  it("(c) vue null -> ne rend rien (pas de crash)", () => {
    const { container } = render(<BlocObligationsBranche vue={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("(d) aucune chaine rendue ne nomme un assureur (DDA)", () => {
    const { container } = render(<BlocObligationsBranche vue={vueSyntec} />);
    expect(container.textContent ?? "").not.toMatch(REGEX_ASSUREURS);
  });
});
