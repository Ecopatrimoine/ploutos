// @vitest-environment jsdom
// LOT 10e (C-ADRESSE) — autocompletion BAN : debounce, remplissage des 3 champs a la
// selection, degradation silencieuse si le reseau echoue, saisie manuelle intacte.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AdresseAutocomplete } from "../components/collecte/AdresseAutocomplete";

const BAN_RESPONSE = {
  features: [
    { properties: { label: "8 Boulevard du Port 80000 Amiens", name: "8 Boulevard du Port", postcode: "80000", city: "Amiens" } },
  ],
};

const fetchOk = (json: unknown) => vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(json) });

describe("AdresseAutocomplete (BAN, Lot 10e)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("debounce : < 4 caracteres -> aucun fetch ; >= 4 -> fetch apres 300 ms", async () => {
    const fetchMock = fetchOk(BAN_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);
    render(<AdresseAutocomplete value="" onChange={() => {}} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "8 b" } });          // 3 caracteres
    act(() => { vi.advanceTimersByTime(400); });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "8 bou" } });        // 5 caracteres
    expect(fetchMock).not.toHaveBeenCalled();                        // debounce pas encore ecoule
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=8%20bou");
  });

  it("selection -> remplit adresse + code postal + ville en une fois", async () => {
    vi.stubGlobal("fetch", fetchOk(BAN_RESPONSE));
    const onSelect = vi.fn();
    render(<AdresseAutocomplete value="" onChange={() => {}} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "8 boulevard" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    const opt = screen.getByRole("option");
    fireEvent.mouseDown(opt);
    expect(onSelect).toHaveBeenCalledWith({ adresse: "8 Boulevard du Port", codePostal: "80000", ville: "Amiens" });
  });

  it("fetch rejete -> degradation silencieuse (aucune liste, pas d'exception)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<AdresseAutocomplete value="" onChange={() => {}} onSelect={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "8 boulevard" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("saisie manuelle intacte : onChange a chaque frappe (adresse etrangere, lieu-dit...)", () => {
    vi.stubGlobal("fetch", fetchOk(BAN_RESPONSE));
    const onChange = vi.fn();
    render(<AdresseAutocomplete value="" onChange={onChange} onSelect={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Flat 2, 10 Downing St" } });
    expect(onChange).toHaveBeenCalledWith("Flat 2, 10 Downing St");
  });
});
