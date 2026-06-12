// @vitest-environment jsdom
//
// LOT ANCIEN-UI (fix alignement) — Rendu 2 personnes de TabPrevoyancePerso.
//
// Constat David : en mode 2 personnes, si UNE SEULE personne declenche l'alerte
// d'anciennete, le contenu sous l'encart se decalait entre P1/P2. Le fix place
// l'encart DANS la carte recap (piste 1 du subgrid, deja egalisee via xl:h-full),
// de sorte que le corps de colonne reste aligne quel que soit le declenchement.
//
// Ce test ne valide PAS l'alignement pixel (visuel) : il prouve que, sur un
// dossier 2 personnes ou seul P1 a une date d'embauche manquante, l'encart est
// rendu DANS la carte recap de P1 et ABSENT de celle de P2.
//
// ProjectionChart est mocke (-> null) : il s'appuie sur Recharts/ResponsiveContainer
// (mesure DOM) sans rapport avec l'alerte. Le reste du tab se monte normalement.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { TabPrevoyancePerso } from "../components/tabs/TabPrevoyancePerso";
import { createEmptyTravail, defaultPrevoyancePerso } from "../lib/prevoyance/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData, PayloadTravail } from "../types/patrimoine";

// Le graphe Recharts n'a aucun role ici et exige des mesures DOM absentes en jsdom.
vi.mock("../components/prevoyance/ProjectionChart", () => ({
  ProjectionChart: () => null,
}));

// Polyfills jsdom minimaux/defensifs (memes que BlocForfait.render) : evitent tout
// throw purement technique au montage de Radix / d'un eventuel observer.
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

const TEXTE_ALERTE = /maintien de salaire employeur/i;

// PayloadTravail salarie non-cadre (CPAM) ; seule la date d'embauche varie.
function travailSalarie(over: Partial<PayloadTravail>): PayloadTravail {
  return {
    ...createEmptyTravail(),
    statutPro: "salarie_non_cadre",
    caisseAffiliation: "CPAM",
    salaireBrutAnnuel: 30000,
    ...over,
  };
}

// Dossier 2 personnes minimal mais valide : P1 sans date d'embauche (alerte
// attendue, maintien legal a paliers > 0), P2 avec date saisie (pas d'alerte).
function data2Personnes(): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1980-01-01",
    person1JobTitle: "", person1Csp: "54", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1982-01-01",
    person2JobTitle: "", person2Csp: "54", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    dateMariage: "2010-06-15",
    childrenData: [],
    salary1: "30000", salary2: "30000", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    travail: {
      p1: travailSalarie({ dateEmbauche: null }),         // -> alerte
      p2: travailSalarie({ dateEmbauche: "2010-01-01" }), // -> pas d'alerte
    },
    prevoyance: { version: 1, p1: defaultPrevoyancePerso(), p2: defaultPrevoyancePerso() },
  } as unknown as PatrimonialData;
}

describe("TabPrevoyancePerso — alignement alerte anciennete 2 personnes (LOT ANCIEN-UI)", () => {
  it("rend l'encart dans la carte recap de P1 (date absente) et pas dans celle de P2 (date saisie)", () => {
    render(
      <Tabs defaultValue="prevoyance">
        <TabPrevoyancePerso
          data={data2Personnes()}
          setField={() => {}}
          person1="Personne 1"
          person2="Personne 2"
        />
      </Tabs>
    );

    // Les deux colonnes sont rendues.
    const p1Label = screen.getByText("Personne 1");
    const p2Label = screen.getByText("Personne 2");

    // Un SEUL encart dans tout l'onglet.
    expect(screen.getAllByText(TEXTE_ALERTE)).toHaveLength(1);

    // L'encart est DANS la carte recap de P1 (egalisee), absent de celle de P2.
    const cardP1 = p1Label.closest("div.rounded-xl") as HTMLElement;
    const cardP2 = p2Label.closest("div.rounded-xl") as HTMLElement;
    expect(within(cardP1).getByText(TEXTE_ALERTE)).toBeInTheDocument();
    expect(within(cardP2).queryByText(TEXTE_ALERTE)).toBeNull();
  });
});
