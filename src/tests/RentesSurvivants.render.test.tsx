// @vitest-environment jsdom
//
// Lot A3b — RentesSurvivants : carte CRUD minimaliste éditant le sous-ensemble
// "survivants" (deces_rente_conj / deces_rente_educ) de contratsIndividuels.
//  - 2 types seulement, label de montant + mention contextuels ;
//  - merge util A1 : éditer les survivants ne touche ni l'incapacité ni le legacy.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RentesSurvivants } from "../components/prevoyance/RentesSurvivants";
import type { PayloadContratIndividuel } from "../types/patrimoine";

// Polyfills MINIMAUX et LOCAUX pour Radix Select sous jsdom (cf. BlocForfait.render).
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

function ouvrirSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
}

function contrat(id: string, type: string, capitalOuMontant = 0): PayloadContratIndividuel {
  return { id, type, capitalOuMontant } as unknown as PayloadContratIndividuel;
}

describe("RentesSurvivants — Lot A3b", () => {
  it("(a) le Select de type ne propose que 2 options (conjoint + éducation)", async () => {
    render(<RentesSurvivants contrats={[contrat("b", "deces_rente_conj")]} onChange={() => {}} />);
    ouvrirSelect(screen.getByRole("combobox")); // 1 seul select (type) par ligne
    const options = await screen.findAllByRole("option");
    const labels = options.map((o) => o.textContent ?? "");
    expect(options).toHaveLength(2);
    expect(labels.some((l) => /Rente de conjoint/i.test(l))).toBe(true);
    expect(labels.some((l) => /Rente éducation/i.test(l))).toBe(true);
  });

  it("(b) label montant contextuel : « par enfant » pour éducation, absent pour conjoint", () => {
    const { rerender } = render(
      <RentesSurvivants contrats={[contrat("e", "deces_rente_educ")]} onChange={() => {}} />
    );
    expect(screen.getByText(/par enfant/i)).toBeInTheDocument();

    rerender(<RentesSurvivants contrats={[contrat("c", "deces_rente_conj")]} onChange={() => {}} />);
    expect(screen.queryByText(/par enfant/i)).not.toBeInTheDocument();
  });

  it("(c) mention automatique contextuelle par type", () => {
    const { rerender } = render(
      <RentesSurvivants contrats={[contrat("e", "deces_rente_educ")]} onChange={() => {}} />
    );
    expect(screen.getByText(/chaque enfant à charge/i)).toBeInTheDocument();

    rerender(<RentesSurvivants contrats={[contrat("c", "deces_rente_conj")]} onChange={() => {}} />);
    expect(screen.getByText(/conjoint survivant/i)).toBeInTheDocument();
  });

  it("(d) ANTI-PERTE symétrique : ajouter une rente préserve incapacité + legacy", () => {
    const onChange = vi.fn();
    const initial = [
      contrat("a", "ij", 100),
      contrat("b", "deces_rente_conj", 500),
      contrat("z", "gav", 20000),
    ];
    render(<RentesSurvivants contrats={initial} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une rente/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as PayloadContratIndividuel[];
    // incapacité + legacy préservés
    expect(next.find((x) => x.id === "a")?.type).toBe("ij");
    expect(next.find((x) => x.id === "z")?.type).toBe("gav");
    // rente initiale conservée + 1 nouvelle (deces_rente_conj par défaut)
    expect(next.find((x) => x.id === "b")?.type).toBe("deces_rente_conj");
    expect(next).toHaveLength(initial.length + 1);
    // ordre fixe : incapacite → survivants → legacy
    expect(next.map((x) => x.type)).toEqual([
      "ij",
      "deces_rente_conj",
      "deces_rente_conj",
      "gav",
    ]);
  });

  it("(e) SUPPRESSION : supprimer la rente laisse l'incapacité intacte", () => {
    const onChange = vi.fn();
    const initial = [contrat("a", "ij", 100), contrat("b", "deces_rente_conj", 500)];
    render(<RentesSurvivants contrats={initial} onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Supprimer cette rente"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as PayloadContratIndividuel[];
    expect(next.map((x) => x.id)).toEqual(["a"]);
    expect(next.find((x) => x.id === "a")?.type).toBe("ij");
  });

  it("(f) la vue ne rend QUE les survivants (1 ligne pour [ij, deces_rente_conj])", () => {
    render(
      <RentesSurvivants
        contrats={[contrat("a", "ij", 100), contrat("b", "deces_rente_conj", 500)]}
        onChange={() => {}}
      />
    );
    // une seule ligne survivant rendue → une seule poubelle, un seul select de type
    expect(screen.getAllByTitle("Supprimer cette rente")).toHaveLength(1);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});
