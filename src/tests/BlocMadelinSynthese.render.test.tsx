// @vitest-environment jsdom
//
// Lot B4 — BlocMadelinSynthese : 2 enveloppes (prévoyance-santé active + PER pour
// info), total, alerte de dépassement, saisie « autre cotisation », toggle
// « bénéfice déjà net ». Masqué si la personne n'est pas TNS. Affichage + saisie
// seulement — aucun calcul IR.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlocMadelinSynthese } from "../components/prevoyance/BlocMadelinSynthese";
import type { PatrimonialData } from "../types/patrimoine";

function ci(id: string, type: string, over: Record<string, unknown> = {}): any {
  return { id, type, capitalOuMontant: 0, ...over };
}
function perso(over: Record<string, unknown> = {}): any {
  return { contratsIndividuels: [], contratsTransmissionDeces: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2", ...over };
}
function makeData(over: Record<string, unknown> = {}): PatrimonialData {
  return {
    coupleStatus: "single",
    travail: { p1: { statutPro: "tns_artisan" }, p2: null },
    prevoyance: { version: 1, p1: perso(), p2: null },
    ...over,
  } as unknown as PatrimonialData;
}

describe("BlocMadelinSynthese — Lot B4", () => {
  it("personne TNS : affiche les DEUX enveloppes + le total des cotisations", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 })],
      }), p2: null },
    });
    render(<BlocMadelinSynthese data={data} which={1} benefice={80000} plafondPER={37680} versementsPER={5000} setField={() => {}} />);
    expect(screen.getByText("Prévoyance-santé")).toBeInTheDocument();
    expect(screen.getByText("Retraite (PER)")).toBeInTheDocument();
    expect(screen.getByText("pour info")).toBeInTheDocument();
    // total prévoyance-santé = 1000 (1 cotisation, pas d'autre) -> "1 000 €"
    // (séparateur de milliers fr-FR = espace insécable -> regex tolérante)
    expect(screen.getAllByText(/1\s?000\s?€/).length).toBeGreaterThan(0);
  });

  it("cotisations > plafond -> alerte de dépassement visible", () => {
    // benefice 0 -> plafond = 0,07*48060 = 3364,2 ; cotisation 5000 > plafond
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 5000 })],
      }), p2: null },
    });
    render(<BlocMadelinSynthese data={data} which={1} benefice={0} plafondPER={37680} versementsPER={0} setField={() => {}} />);
    expect(screen.getByText(/Dépassement de/i)).toBeInTheDocument();
  });

  it("pas d'alerte si cotisations <= plafond", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 })],
      }), p2: null },
    });
    render(<BlocMadelinSynthese data={data} which={1} benefice={80000} plafondPER={37680} versementsPER={0} setField={() => {}} />);
    expect(screen.queryByText(/Dépassement de/i)).toBeNull();
  });

  it("saisir « autre cotisation » -> setField(madelinAutreCotisation1, number)", () => {
    const setField = vi.fn();
    render(<BlocMadelinSynthese data={makeData()} which={1} benefice={50000} plafondPER={37680} versementsPER={0} setField={setField} />);
    fireEvent.change(screen.getByPlaceholderText("ex. 600"), { target: { value: "600" } });
    expect(setField).toHaveBeenCalledWith("madelinAutreCotisation1", 600);
  });

  it("toggle -> écrit data.travail.p1.beneficeDejaDeduitMadelin = true", () => {
    const setField = vi.fn();
    render(<BlocMadelinSynthese data={makeData()} which={1} benefice={50000} plafondPER={37680} versementsPER={0} setField={setField} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(setField).toHaveBeenCalledTimes(1);
    const [field, pair] = setField.mock.calls[0];
    expect(field).toBe("travail");
    expect((pair as any).p1.beneficeDejaDeduitMadelin).toBe(true);
  });

  it("personne NON-TNS -> bloc absent (null)", () => {
    const data = makeData({ travail: { p1: { statutPro: "salarie_cadre" }, p2: null } });
    const { container } = render(<BlocMadelinSynthese data={data} which={1} benefice={80000} plafondPER={37680} versementsPER={0} setField={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Prévoyance-santé")).toBeNull();
  });
});
