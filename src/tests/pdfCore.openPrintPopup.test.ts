// ─── Tests openPrintPopup — impression apres chargement des polices (Lot 9bis) ─
// On mocke window.open -> faux popup (document.write/close, print espionne) et on
// pilote document.fonts.ready + les timers (faux timers) pour verifier QUAND
// popup.print() est appele.

import { describe, it, expect, vi, afterEach } from "vitest";
import { openPrintPopup } from "../lib/pdf/pdfCore";

function mockWindow(popup: any): () => void {
  const prev = (globalThis as any).window;
  (globalThis as any).window = { open: () => popup, alert: vi.fn() };
  return () => {
    if (prev === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = prev;
  };
}

// fonts === undefined -> document SANS FontFaceSet (cas repli).
function fakePopup(fonts?: unknown) {
  return {
    document: { write: vi.fn(), close: vi.fn(), ...(fonts !== undefined ? { fonts } : {}) },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

afterEach(() => { vi.useRealTimers(); });

describe("openPrintPopup — attente des polices (Lot 9bis)", () => {
  it("imprime quand document.fonts.ready est resolue", async () => {
    vi.useFakeTimers();
    const popup = fakePopup({ ready: Promise.resolve() });
    const restore = mockWindow(popup);
    try {
      openPrintPopup("<html></html>");
      await vi.advanceTimersByTimeAsync(200); // microtask fonts.ready + delai de grace
      expect(popup.print).toHaveBeenCalledTimes(1);
    } finally { restore(); }
  });

  it("imprime au plus tard apres le timeout de secours si fonts.ready ne resout jamais", async () => {
    vi.useFakeTimers();
    const popup = fakePopup({ ready: new Promise(() => {}) }); // jamais resolue
    const restore = mockWindow(popup);
    try {
      openPrintPopup("<html></html>");
      await vi.advanceTimersByTimeAsync(500);
      expect(popup.print).not.toHaveBeenCalled(); // avant le timeout de secours (3 s)
      await vi.advanceTimersByTimeAsync(3000);     // depasse le secours + grace
      expect(popup.print).toHaveBeenCalledTimes(1);
    } finally { restore(); }
  });

  it("repli : imprime quand FontFaceSet est absent (document.fonts undefined)", async () => {
    vi.useFakeTimers();
    const popup = fakePopup(); // pas de document.fonts
    const restore = mockWindow(popup);
    try {
      openPrintPopup("<html></html>");
      await vi.advanceTimersByTimeAsync(300); // delai de repli (200 ms)
      expect(popup.print).toHaveBeenCalledTimes(1);
    } finally { restore(); }
  });

  it("popup bloquee (null) -> alerte, pas d'impression, pas d'exception", () => {
    const prev = (globalThis as any).window;
    const alert = vi.fn();
    (globalThis as any).window = { open: () => null, alert };
    try {
      expect(() => openPrintPopup("<html></html>")).not.toThrow();
      expect(alert).toHaveBeenCalledTimes(1);
    } finally {
      if (prev === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = prev;
    }
  });
});
