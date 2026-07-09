// @vitest-environment jsdom
//
// LOT 8 — hooks d'interaction/a11y : useEscapeToClose (C1), useDebouncedAction
// (C2), confirmRemove (C3). Tests unitaires purs (pas de rendu d'ecran).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useDebouncedAction } from "../hooks/useDebouncedAction";
import { confirmRemove } from "../lib/confirmRemove";

describe("useEscapeToClose — Echap ferme la modale (C1)", () => {
  it("appelle onClose sur Echap quand enabled", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose, true));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas onClose quand enabled=false (modale fermee)", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose, false));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignore les autres touches", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose, true));
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("retire l'ecouteur au demontage (pas de fuite)", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeToClose(onClose, true));
    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("useDebouncedAction — anti double-clic (C2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("2 appels < 300 ms => 1 seul effet", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useDebouncedAction(action, 300));
    result.current();
    vi.advanceTimersByTime(50);
    result.current(); // second clic rapide -> ignore
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("2e appel apres 300 ms => 2 effets", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useDebouncedAction(action, 300));
    result.current();
    vi.advanceTimersByTime(301);
    result.current();
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("transmet les arguments a l'action", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useDebouncedAction(action, 300));
    result.current("x", 42);
    expect(action).toHaveBeenCalledWith("x", 42);
  });
});

describe("confirmRemove — friction proportionnelle (C3)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ligne VIDE => suppression directe, aucun confirm", () => {
    const remove = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");
    confirmRemove(false, "le credit", remove);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("ligne REMPLIE + confirmation acceptee => suppression", () => {
    const remove = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    confirmRemove(true, "le credit", remove);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("ligne REMPLIE + confirmation annulee => pas de suppression", () => {
    const remove = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    confirmRemove(true, "le credit", remove);
    expect(remove).not.toHaveBeenCalled();
  });
});
