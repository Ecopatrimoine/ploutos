// @vitest-environment jsdom
//
// Sous-item A — le selecteur de parente enfant (parentLink) est masque quand le
// foyer est mono-adulte (coupleStatus === "single"), et rendu normalement sinon.
// On monte le VRAI TabFamiliale ; le Select Radix est remplace par un <select>
// natif (convention repo : Radix ne se selectionne pas sous jsdom). Recharts est
// neutralise (le graphe n'est pas l'objet du test).

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tabs } from "../components/ui/tabs";
import { TabFamiliale } from "../components/tabs/TabFamiliale";
import { fixtureData } from "./__fixtures__/pdfFixture";
import type { PatrimonialData } from "../types/patrimoine";

vi.mock("@/components/ui/select", async () => {
  const R = await import("react");
  const flat = (n: any): string =>
    n == null || typeof n === "boolean" ? "" :
    typeof n === "string" || typeof n === "number" ? String(n) :
    Array.isArray(n) ? n.map(flat).join("") :
    n?.props?.children != null ? flat(n.props.children) : "";
  return {
    Select: ({ value, onValueChange, children }: any) =>
      R.createElement("select", { value: value ?? "", onChange: (e: any) => onValueChange && onValueChange(e.target.value) }, children),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => R.createElement(R.Fragment, null, children),
    SelectItem: ({ value, children }: any) => R.createElement("option", { value }, flat(children)),
  };
});

// Neutralise recharts (le graphe n'est pas l'objet du test) : chaque export
// utilise par TabFamiliale devient un composant qui ne rend rien. On evite un
// Proxy catch-all qui exposerait un "then" fonction (module vu comme thenable
// -> await import(...) ne se resout jamais -> hang au collect).
vi.mock("recharts", () => {
  const Stub = () => null;
  return {
    __esModule: true,
    ResponsiveContainer: Stub, LineChart: Stub, Line: Stub, XAxis: Stub, YAxis: Stub,
    Tooltip: Stub, PieChart: Stub, Pie: Stub, Cell: Stub, BarChart: Stub, Bar: Stub,
    Legend: Stub, CartesianGrid: Stub, LabelList: Stub,
  };
});

const oneChild = {
  firstName: "Lea", lastName: "Dupont", birthDate: "2010-01-01",
  parentLink: "common_child", custody: "full", rattached: true, handicap: false,
};

function renderTab(coupleStatus: string, updateChild = vi.fn()) {
  const data = { ...fixtureData, coupleStatus, childrenData: [{ ...oneChild }] } as PatrimonialData;
  render(
    <Tabs value="famille">
      <TabFamiliale
        data={data}
        setField={vi.fn()}
        addChild={vi.fn()}
        updateChild={updateChild}
        removeChild={vi.fn()}
        person1="Pierre"
        person2="Sophie"
      />
    </Tabs>
  );
  return updateChild;
}

describe("TabFamiliale — selecteur parentLink selon le foyer", () => {
  it("couple (married) : le select Parente est rendu avec ses 3 options", () => {
    renderTab("married");
    expect(screen.getByText("Enfant commun")).toBeInTheDocument();
    expect(screen.getByText("Pierre uniquement")).toBeInTheDocument();
    expect(screen.getByText("Sophie uniquement")).toBeInTheDocument();
  });

  it("mono-adulte (single) : le select Parente n'est PAS rendu, libelle statique a la place", () => {
    renderTab("single");
    expect(screen.queryByText("Sophie uniquement")).toBeNull();
    expect(screen.queryByText("Pierre uniquement")).toBeNull();
    expect(screen.getByText("Enfant de Pierre")).toBeInTheDocument();
  });

  it("non-regression : passer en single ne reecrit AUCUN parentLink existant", () => {
    const updateChild = renderTab("single");
    expect(updateChild).not.toHaveBeenCalled();
  });
});
