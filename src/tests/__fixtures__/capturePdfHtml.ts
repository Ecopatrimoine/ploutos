// ─── Helper — capture du HTML produit par les fonctions PDF ─────────────────
// Les fonctions buildAndPrintPdf / buildAndPrintMission appellent window.open
// puis popup.document.write(html). On intercepte le write pour récupérer le HTML.
// On fige aussi Date (sinon les snapshots changent chaque jour).

import { vi } from "vitest";

export function capturePdfHtml(invoke: () => void, frozenDateIso = "2026-05-25T10:00:00Z"): string {
  let captured = "";

  const fakePopup = {
    document: {
      write: (html: string) => { captured = html; },
      close: () => {},
    },
    focus: () => {},
    print: () => {},
  };

  // Sauvegarde de l'éventuel window existant (peu probable en env "node", mais safe).
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = {
    open: () => fakePopup,
    // alert utilisé en fallback si popup === null — pas notre cas.
    alert: () => {},
  };

  // Date figée : new Date() retournera toujours la même valeur dans la fonction.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(frozenDateIso));

  try {
    invoke();
  } finally {
    vi.useRealTimers();
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }
  }

  return captured;
}
