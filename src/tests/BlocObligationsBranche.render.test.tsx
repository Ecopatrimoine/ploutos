// @vitest-environment jsdom
//
// LOT 5 — Test de rendu du bloc ecran obligations FUSIONNEES (synthese + tableau
// unique). On passe une VueObligationsFusionnee synthetique (forme reelle des
// types Lots 4/4bis) et on verifie le rendu.

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BlocObligationsBranche } from "../components/prevoyance/BlocObligationsBranche";
import type { VueObligationsFusionnee } from "../lib/prevoyance/comparaison-branche-vue";

const REGEX_ASSUREURS = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut/i;

// Vue avec garanties souscrites renseignees (comparaison realisee).
const vueComparee: VueObligationsFusionnee = {
  statut: "branche_documentee",
  statutLabel: "Obligations de branche documentees",
  afficherAvertissementIncomplet: false,
  souscritRenseigne: true,
  afficherComparaison: true,
  idcc: "1486",
  nomCCN: "Syntec",
  lignes: [
    {
      garantie: "capitalDC",
      garantieLabel: "Capital deces",
      estReference: false,
      obligation: { cadres: "1,7x salaire de reference (min 3,4 PASS)", nonCadres: "1,7x salaire de reference (min 1,7 PASS)" },
      souscrit: { commun: "1,0x salaire de reference" },
      verdict: { commun: "insuffisant" },
      verdictLabel: { commun: "Insuffisant" },
      motif: { commun: "Capital souscrit 1 < obligation 1,7 (fraction du salaire de reference)." },
    },
    {
      garantie: "ij",
      garantieLabel: "Indemnites journalieres",
      estReference: false,
      obligation: { commun: "80 % (franchise 90 j)" },
      souscrit: { commun: "80 % (franchise 90 j)" },
      verdict: { commun: "indetermine" },
      verdictLabel: { commun: "A etudier" },
      motif: { commun: "Bareme conventionnel a paliers/situations : comparaison manuelle requise." },
    },
    {
      garantie: "maintienEmployeur",
      garantieLabel: "Maintien de salaire employeur",
      estReference: true,
      obligation: { commun: "Maintien employeur CCN : 1 palier" },
      souscrit: null,
      verdict: null,
      verdictLabel: null,
      motif: null,
    },
  ],
  nonPrevues: [{ garantie: "renteConjoint", garantieLabel: "Rente de conjoint" }],
  synthese: { conformes: 0, insuffisants: 1, aEtudier: 1 },
};

// Vue sans souscrit (comparaison non realisee).
const vueSansSouscrit: VueObligationsFusionnee = {
  statut: "branche_documentee",
  statutLabel: "Obligations de branche documentees",
  afficherAvertissementIncomplet: false,
  souscritRenseigne: false,
  afficherComparaison: false,
  idcc: "1486",
  nomCCN: "Syntec",
  lignes: [
    {
      garantie: "capitalDC",
      garantieLabel: "Capital deces",
      estReference: false,
      obligation: { commun: "1,7x salaire de reference" },
      souscrit: null,
      verdict: null,
      verdictLabel: null,
      motif: null,
    },
  ],
  nonPrevues: [],
  synthese: null,
};

// Vue etat vide (aucune ligne).
const vueVide: VueObligationsFusionnee = {
  statut: "idcc_absent",
  statutLabel: "Aucune convention de branche renseignee",
  afficherAvertissementIncomplet: false,
  souscritRenseigne: false,
  afficherComparaison: false,
  idcc: null,
  nomCCN: null,
  lignes: [],
  nonPrevues: [],
  synthese: null,
};

describe("BlocObligationsBranche — vue fusionnee (LOT 5)", () => {
  it("1. comparaison : obligation split rendue en 2 lignes, verdicts + synthese, tableau unique", () => {
    const { container } = render(<BlocObligationsBranche vue={vueComparee} />);
    // obligation split capitalDC -> deux lignes Cadres / Non-cadres
    expect(screen.getAllByText("Cadres :").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/min 3,4 PASS/)).toBeInTheDocument();
    expect(screen.getByText(/min 1,7 PASS/)).toBeInTheDocument();
    // verdicts
    expect(screen.getByText("Insuffisant")).toBeInTheDocument();
    expect(screen.getByText("A etudier")).toBeInTheDocument();
    // synthese : 3 compteurs
    expect(screen.getByText("0 conformes")).toBeInTheDocument();
    expect(screen.getByText("1 insuffisante(s)")).toBeInTheDocument();
    expect(screen.getByText("1 a etudier")).toBeInTheDocument();
    // un SEUL tableau (plus de sections par college)
    expect(container.querySelectorAll("table").length).toBe(1);
  });

  it("2. pas de souscrit : bandeau 'comparaison non realisee', pas de colonnes Souscrit/Verdict", () => {
    render(<BlocObligationsBranche vue={vueSansSouscrit} />);
    expect(screen.getByText(/comparaison non realisee/i)).toBeInTheDocument();
    // colonnes absentes
    expect(screen.queryByText("Souscrit")).toBeNull();
    expect(screen.queryByText("Verdict")).toBeNull();
    // les obligations restent affichees
    expect(screen.getByText("1,7x salaire de reference")).toBeInTheDocument();
  });

  it("3. lignes vides -> etat vide propre (statutLabel), pas de tableau, pas de crash", () => {
    const { container } = render(<BlocObligationsBranche vue={vueVide} />);
    expect(screen.getByText("Aucune convention de branche renseignee")).toBeInTheDocument();
    expect(container.querySelectorAll("table").length).toBe(0);
  });

  it("4. nonPrevues non vide -> note de bas (garantie non prevue + maintien deja projete)", () => {
    render(<BlocObligationsBranche vue={vueComparee} />);
    expect(screen.getByText(/Non prevue par la branche : Rente de conjoint/)).toBeInTheDocument();
    expect(screen.getByText(/maintien employeur est deja integre a la projection/i)).toBeInTheDocument();
  });

  it("5. ligne maintien (reference) -> mention 'reference', aucune pastille de verdict", () => {
    render(<BlocObligationsBranche vue={vueComparee} />);
    const cell = screen.getByText("Maintien de salaire employeur");
    const row = cell.closest("tr")!;
    expect(within(row).getByText("reference")).toBeInTheDocument();
    expect(within(row).queryByText("Insuffisant")).toBeNull();
    expect(within(row).queryByText("A etudier")).toBeNull();
    expect(within(row).queryByText("Conforme")).toBeNull();
  });

  it("6. DDA : aucune chaine rendue ne nomme un assureur", () => {
    const { container } = render(<BlocObligationsBranche vue={vueComparee} />);
    expect(container.textContent ?? "").not.toMatch(REGEX_ASSUREURS);
  });
});
