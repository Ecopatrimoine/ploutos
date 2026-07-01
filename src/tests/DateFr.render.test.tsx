// @vitest-environment jsdom
//
// Composant DateFr : champ masque JJ/MM/AAAA, drop-in du pattern <Input type="date">.
// Contrat : value/onChange parlent ISO "yyyy-mm-dd" ; l'affichage est FR.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateFr } from "../components/ui/DateFr";

describe("DateFr — champ masque JJ/MM/AAAA (drop-in ISO)", () => {
  it("affiche une valeur ISO recue au format FR", () => {
    render(<DateFr value="2000-06-15" onChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toHaveValue("15/06/2000");
  });

  it("insere les / automatiquement pendant la frappe, sans emettre tant que incomplet", () => {
    const onChange = vi.fn();
    render(<DateFr value="" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1506" } });
    expect(input).toHaveValue("15/06");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("saisie complete et valide -> onChange(iso) + affichage FR", () => {
    const onChange = vi.fn();
    render(<DateFr value="" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15062000" } });
    expect(input).toHaveValue("15/06/2000");
    expect(onChange).toHaveBeenCalledWith("2000-06-15");
  });

  it("saisie complete invalide (31 fevrier) -> pas d'onChange + aria-invalid", () => {
    const onChange = vi.fn();
    render(<DateFr value="" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31022000" } });
    expect(input).toHaveValue("31/02/2000");
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("collage d'une ISO complete -> normalise en FR + onChange", () => {
    const onChange = vi.fn();
    render(<DateFr value="" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2000-12-31" } });
    expect(input).toHaveValue("31/12/2000");
    expect(onChange).toHaveBeenCalledWith("2000-12-31");
  });

  it("vider le champ -> onChange('')", () => {
    const onChange = vi.fn();
    render(<DateFr value="2000-06-15" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("passthrough disabled / id / className", () => {
    render(<DateFr value="" onChange={() => {}} disabled id="dateNaissance" className="w-40" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("id", "dateNaissance");
    expect(input.className).toContain("w-40");
  });
});
