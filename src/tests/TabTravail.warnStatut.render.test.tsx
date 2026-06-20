// @vitest-environment jsdom
//
// Lot WARN-STATUT — avertissement d'incohérence entre la situation pro (PCS, qui
// pilote le bénéfice imposable) et le statut professionnel (statutPro, qui pilote
// prévoyance + Madelin). Warning PASSIF : il informe, ne corrige rien.
//
// On rend le VRAI TabTravail ; le wrapper Radix Select est remplacé par un <select>
// natif (même approche que TabTravail.suggestStatut.render.test.tsx) pour un montage
// déterministe sous jsdom. Le warning étant statique (dérivé des données), on
// monte avec des données pré-réglées et on vérifie sa présence/absence.

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { createEmptyTravail } from "../lib/prevoyance/utils";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import type { PatrimonialData, StatutPro } from "../types/patrimoine";

vi.mock("@/components/ui/select", async () => {
  const ReactMod = await import("react");
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

// Import APRES le mock.
import { TabTravail } from "../components/tabs/TabTravail";

const WARN = /ne concordent pas/i;

function baseData(groupe: string, csp: string, statutPro: StatutPro | ""): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1980-01-01",
    person1JobTitle: "", person1Csp: csp, person1PcsGroupe: groupe,
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    travail: { p1: { ...createEmptyTravail(), statutPro }, p2: null },
  } as unknown as PatrimonialData;
}

function renderTab(groupe: string, csp: string, statutPro: StatutPro | "", setField: any = () => {}) {
  return render(
    <Tabs defaultValue="travail">
      <TabTravail data={baseData(groupe, csp, statutPro)} setField={setField} person1="P1" person2="P2" />
    </Tabs>
  );
}

describe("TabTravail — avertissement incohérence PCS / statutPro (Lot WARN-STATUT)", () => {
  it("(a) PCS salarié (groupe 4) + statutPro TNS -> warning (cas David)", () => {
    renderTab("4", "", "tns_liberal");
    expect(screen.getByText(WARN)).toBeInTheDocument();
  });

  it("(b) PCS indépendant (groupe 2) + statutPro TNS -> pas de warning (cohérent)", () => {
    renderTab("2", "", "tns_artisan");
    expect(screen.queryByText(WARN)).toBeNull();
  });

  it("(c) PCS salarié (groupe 4) + statutPro salarié -> pas de warning (cohérent)", () => {
    renderTab("4", "", "salarie_cadre");
    expect(screen.queryByText(WARN)).toBeNull();
  });

  it("(d) president_sas + PCS cadre (groupe 3) -> pas de warning ; + PCS chef d'entreprise (groupe 2) -> warning", () => {
    const { unmount } = renderTab("3", "37", "president_sas");
    expect(screen.queryByText(WARN)).toBeNull();
    unmount();
    renderTab("2", "", "president_sas");
    expect(screen.getByText(WARN)).toBeInTheDocument();
  });

  it("(e) un côté non rempli -> pas de warning (pas de bruit en saisie)", () => {
    const { unmount } = renderTab("", "", "tns_liberal"); // PCS vide
    expect(screen.queryByText(WARN)).toBeNull();
    unmount();
    renderTab("4", "", ""); // statutPro vide
    expect(screen.queryByText(WARN)).toBeNull();
  });

  it("(f) PASSIF : afficher le warning ne déclenche aucun setField", () => {
    const setField = vi.fn();
    renderTab("4", "", "tns_liberal", setField);
    expect(screen.getByText(WARN)).toBeInTheDocument();
    expect(setField).not.toHaveBeenCalled();
  });
});
