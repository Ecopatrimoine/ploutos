// @vitest-environment jsdom
//
// LOT TOOLTIP-SOCIAL — qualification sociale par ligne dans le tooltip du graphe
// de projection. Composant présentationnel pur (divs) : montage direct du
// TooltipContenu exporté, sans Recharts (qui ne rend pas en jsdom).

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TooltipContenu } from "../components/prevoyance/ProjectionChart";

// euro() / toLocaleString insèrent des espaces fins insécables : on normalise.
function norm(text: string | null): string {
  return (text ?? "").replace(/\s/g, "");
}

type PItem = { name?: string; value?: number; color?: string; dataKey?: string };
function renderTooltip(payload: PItem[], refMensuel = 2500) {
  return render(<TooltipContenu active payload={payload} label="3 mois" refMensuel={refMensuel} />);
}

describe("TooltipContenu — qualification sociale par ligne", () => {
  it("maintien + IJ obligatoire → mentions distinctes sous chaque ligne", () => {
    const { getByText, container } = renderTooltip([
      { name: "Maintien employeur", value: 1500, color: "#5B7FB0", dataKey: "maintien" },
      { name: "Régime obligatoire (IJ)", value: 500, color: "#101B3B", dataKey: "ijObl" },
    ]);
    expect(getByText("Soumis aux cotisations comme un salaire")).toBeInTheDocument();
    expect(getByText("Soumise à CSG/CRDS")).toBeInTheDocument();
    // Les montants et le libellé restent affichés (rendu inchangé).
    const t = norm(container.textContent);
    expect(t).toContain("1500€");
    expect(t).toContain("500€");
    expect(t).toContain(norm("Maintien employeur"));
  });

  it("toutes les prestations (IJ/rentes) portent « Soumise à CSG/CRDS »", () => {
    const { getAllByText } = renderTooltip([
      { name: "Régime obligatoire (IJ)", value: 400, color: "#101B3B", dataKey: "ijObl" },
      { name: "Prévoyance collective (employeur)", value: 300, color: "#A9B8D4", dataKey: "ijColl" },
      { name: "Prévoyance individuelle (Madelin)", value: 200, color: "#B5806B", dataKey: "ijInd" },
      { name: "Régime obligatoire (pension invalidité)", value: 100, color: "#101B3B", dataKey: "pensionInvalObl" },
    ]);
    expect(getAllByText("Soumise à CSG/CRDS")).toHaveLength(4);
  });

  it("salaire seul (TPT) → AUCUNE sous-ligne de qualification", () => {
    const { queryByText } = renderTooltip([
      { name: "Salaire (activité)", value: 2500, color: "#E3AF64", dataKey: "salaire" },
    ]);
    expect(queryByText(/Soumise à CSG\/CRDS/)).toBeNull();
    expect(queryByText(/Soumis aux cotisations/)).toBeNull();
  });

  it("dataKey inconnu ou undefined → aucune sous-ligne, aucun crash", () => {
    const { queryByText, getByText } = renderTooltip([
      { name: "Inconnu", value: 100, color: "#000", dataKey: "xyz" },
      { name: "Sans clé", value: 100, color: "#000", dataKey: undefined },
    ]);
    expect(queryByText(/Soumis/)).toBeNull();
    // La ligne montant elle-même s'affiche toujours (pas d'erreur).
    expect(getByText("Inconnu")).toBeInTheDocument();
  });

  it("NON-RÉGRESSION : total, % et filtrage des séries à 0 inchangés", () => {
    const { container, queryByText, getAllByText } = renderTooltip([
      { name: "Maintien employeur", value: 1500, color: "#5B7FB0", dataKey: "maintien" },
      { name: "Régime obligatoire (IJ)", value: 500, color: "#101B3B", dataKey: "ijObl" },
      { name: "Prévoyance individuelle (Madelin)", value: 0, color: "#B5806B", dataKey: "ijInd" },
    ], 2500);
    const t = norm(container.textContent);
    // Total = 2000, pct = 2000/2500 = 80 % (la série à 0 est filtrée, n'entre pas).
    expect(t).toContain("2000€");
    expect(t).toContain("(80%)");
    expect(t).toContain(norm("Revenu de référence"));
    // Série à 0 filtrée : ni sa ligne, ni sa qualification.
    expect(queryByText("Prévoyance individuelle (Madelin)")).toBeNull();
    expect(getAllByText("Soumise à CSG/CRDS")).toHaveLength(1); // seul ijObl visible
  });
});
