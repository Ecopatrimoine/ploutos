// @vitest-environment jsdom
//
// LOT UX-COLLECTE sub-lot 2 — cablage du pre-remplissage statutPro depuis la CSP.
//
// On rend le VRAI TabTravail (le onValueChange reel s'execute), mais on remplace
// le Select Radix par un <select> natif : la selection d'une option dans Radix
// n'est pas fiable sous jsdom (selection sur pointerup, jamais exercee dans le
// reste de la suite). Le <select> natif rend fireEvent.change deterministe.
//
// (a) CSP 31 saisie avec statutPro vide        -> tns_liberal pose
// (b) CSP 31 saisie avec statutPro president_sas -> inchange (jamais ecrase)

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { createEmptyTravail } from "../lib/prevoyance/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData, PayloadTravail, StatutPro } from "../types/patrimoine";

// Remplace le wrapper Radix par un <select> natif (selection deterministe).
// onValueChange est fidelement relaye : le cablage de TabTravail est bien teste.
vi.mock("@/components/ui/select", async () => {
  const ReactMod = await import("react");
  // Aplatit les enfants JSX d'un SelectItem en texte (les items PCS contiennent
  // un <span>, interdit dans <option>) — on garde le libelle pour getByRole.
  const toText = (node: any): string => {
    if (node == null || node === false || node === true) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(toText).join("");
    if (node?.props?.children != null) return toText(node.props.children);
    return "";
  };
  return {
    Select: ({ value, onValueChange, children }: any) =>
      ReactMod.createElement(
        "select",
        { value: value ?? "", onChange: (e: any) => onValueChange && onValueChange(e.target.value) },
        children
      ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => ReactMod.createElement(ReactMod.Fragment, null, children),
    SelectItem: ({ value, children }: any) => ReactMod.createElement("option", { value }, toText(children)),
  };
});

// TabTravail importe @/components/ui/select -> mock applique. Import APRES le mock.
import { TabTravail } from "../components/tabs/TabTravail";

function travail(statutPro: StatutPro | ""): PayloadTravail {
  return { ...createEmptyTravail(), statutPro };
}

// Dossier 1 personne, PCS groupe "3" deja choisi, catégorie vide : le select de
// catégorie est rendu (groupe 3 a des catégories, dont "31 Professions liberales").
function baseData(statutP1: StatutPro | ""): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1980-01-01",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "3",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: true,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    travail: { p1: travail(statutP1), p2: null },
  } as unknown as PatrimonialData;
}

function Harness({ statutP1 }: { statutP1: StatutPro | "" }) {
  const [data, setData] = React.useState<PatrimonialData>(() => baseData(statutP1));
  const setField = (k: keyof PatrimonialData, v: unknown) =>
    setData((prev) => ({ ...prev, [k]: v }) as PatrimonialData);
  return (
    <Tabs defaultValue="travail">
      <div data-testid="statut">{data.travail?.p1?.statutPro || "VIDE"}</div>
      <TabTravail data={data} setField={setField} person1="P1" person2="P2" />
    </Tabs>
  );
}

// Selectionne la catégorie "31 - Professions liberales" dans le select de CSP.
function saisirCsp31() {
  const option = screen.getByRole("option", { name: /Professions libérales/i });
  const select = option.closest("select") as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "31" } });
}

describe("TabTravail — pre-remplissage statutPro depuis la CSP (sub-lot 2)", () => {
  it("(a) CSP 31 avec statutPro vide -> tns_liberal pose", () => {
    render(<Harness statutP1="" />);
    expect(screen.getByTestId("statut").textContent).toBe("VIDE");
    saisirCsp31();
    expect(screen.getByTestId("statut").textContent).toBe("tns_liberal");
  });

  it("(b) CSP 31 avec statutPro deja president_sas -> inchange", () => {
    render(<Harness statutP1="president_sas" />);
    expect(screen.getByTestId("statut").textContent).toBe("president_sas");
    saisirCsp31();
    expect(screen.getByTestId("statut").textContent).toBe("president_sas");
  });
});
