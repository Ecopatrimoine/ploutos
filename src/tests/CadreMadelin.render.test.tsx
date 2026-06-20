// @vitest-environment jsdom
//
// Lot B3 — CadreMadelin : case « déductible » + champ cotisation conditionnel.
// Saisie pure : on vérifie l'affichage conditionnel et les patchs remontés.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CadreMadelin } from "../components/prevoyance/CadreMadelin";

describe("CadreMadelin — Lot B3", () => {
  it("déductible=false -> case décochée, pas de champ cotisation", () => {
    render(<CadreMadelin deductible={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.queryByText(/Cotisation annuelle/i)).toBeNull();
    expect(screen.queryByPlaceholderText("ex. 1200")).toBeNull();
  });

  it("déductible=true -> champ cotisation visible avec sa valeur", () => {
    render(<CadreMadelin deductible={true} cotisation={1200} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText(/Cotisation annuelle/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("1200")).toBeInTheDocument();
  });

  it("cocher -> onChange({ deductibleMadelin: true })", () => {
    const onChange = vi.fn();
    render(<CadreMadelin deductible={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith({ deductibleMadelin: true });
  });

  it("décocher -> onChange({ deductibleMadelin: false })", () => {
    const onChange = vi.fn();
    render(<CadreMadelin deductible={true} cotisation={1000} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith({ deductibleMadelin: false });
  });

  it("saisir la cotisation -> onChange({ cotisationMadelinAnnuelle: n })", () => {
    const onChange = vi.fn();
    render(<CadreMadelin deductible={true} cotisation={0} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("ex. 1200"), { target: { value: "1500" } });
    expect(onChange).toHaveBeenCalledWith({ cotisationMadelinAnnuelle: 1500 });
  });
});
