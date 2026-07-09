import { describe, it, expect } from "vitest";
import { buildHypothesisDifferenceLines } from "./hypotheses";
import type { PatrimonialData, IrOptions, Property, Placement } from "../types/patrimoine";

// Fabriques minimales : seuls les champs lus par le diff sont fournis.
const prop = (id: string | undefined, over: Partial<Property> = {}): Property =>
  ({ id, name: "", type: "Location nue", propertyRight: "full", ownership: "person1",
     value: "100000", loanCapitalRemaining: "0", rentGrossAnnual: "0", ...over } as unknown as Property);

const data = (properties: Property[], placements: Placement[] = []): PatrimonialData =>
  ({ salary1: "", salary2: "", pensions: "", perDeduction: "", pensionDeductible: "",
     otherDeductible: "", properties, placements } as unknown as PatrimonialData);

const ir = {} as unknown as IrOptions;

const propLines = (lines: { label: string }[]) =>
  lines.filter((l) => /Bien|Valeur ·|Type ·|Droit ·|Propriétaire ·/.test(l.label));

describe("buildHypothesisDifferenceLines — alignement des actifs", () => {
  it("ids des deux cotes : un reordonnancement ne produit AUCUN faux ajoute/supprime/modifie", () => {
    const base = data([prop("p1", { name: "A", value: "100000" }), prop("p2", { name: "B", value: "200000" })]);
    const hypo = data([prop("p2", { name: "B", value: "200000" }), prop("p1", { name: "A", value: "100000" })]);
    const lines = buildHypothesisDifferenceLines(base, ir, hypo, ir);
    expect(propLines(lines)).toHaveLength(0);
    expect(lines.some((l) => l.label.startsWith("Nouveau bien"))).toBe(false);
    expect(lines.some((l) => l.label.startsWith("Bien supprimé"))).toBe(false);
  });

  it("ids des deux cotes : modifie (meme id), ajoute (id nouveau), supprime (id disparu)", () => {
    const base = data([prop("p1", { value: "100000" }), prop("p2", { name: "old" })]);
    const hypo = data([prop("p1", { value: "150000" }), prop("p3", { name: "New", value: "50000" })]);
    const lines = buildHypothesisDifferenceLines(base, ir, hypo, ir);
    // p1 modifie : une ligne Valeur ; p2 supprime ; p3 ajoute
    expect(lines.some((l) => l.label.startsWith("Valeur ·") && l.baseValue.includes("100") && l.hypothesisValue.includes("150"))).toBe(true);
    expect(lines.some((l) => l.label.startsWith("Bien supprimé"))).toBe(true);
    expect(lines.some((l) => l.label.startsWith("Nouveau bien"))).toBe(true);
  });

  it("legacy (aucun id) : comportement POSITIONNEL conserve — un reordonnancement produit encore des faux diffs", () => {
    const base = data([prop(undefined, { name: "A", value: "100000" }), prop(undefined, { name: "B", value: "200000" })]);
    const hypo = data([prop(undefined, { name: "B", value: "200000" }), prop(undefined, { name: "A", value: "100000" })]);
    const lines = buildHypothesisDifferenceLines(base, ir, hypo, ir);
    // Aligne par position 0<->0 et 1<->1 : les valeurs different -> diffs (comportement historique).
    expect(propLines(lines).length).toBeGreaterThan(0);
  });
});

// LOT 10d H1 — le badge « À jour »/« changé depuis » = (diff dossier courant vs capturé
// est vide). On teste la mécanique exacte utilisée par le badge : aucune différence -> à jour.
describe("badge de capture — À jour vs modifié (même diff que le badge)", () => {
  const capture = data([prop("p1", { name: "A", value: "100000" })]);
  it("dossier identique à la capture -> aucune différence -> À JOUR", () => {
    const courant = data([prop("p1", { name: "A", value: "100000" })]);
    expect(buildHypothesisDifferenceLines(courant, ir, capture, ir).length === 0).toBe(true);
  });
  it("dossier modifié depuis la capture -> différences -> MODIFIÉ", () => {
    const courant = data([prop("p1", { name: "A", value: "180000" })]); // valeur changée
    expect(buildHypothesisDifferenceLines(courant, ir, capture, ir).length === 0).toBe(false);
  });
});
