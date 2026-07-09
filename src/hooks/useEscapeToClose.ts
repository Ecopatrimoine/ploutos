import { useEffect, useRef } from "react";

// Lot 8 C1 — ferme une modale maison (non-Radix) à la touche Échap.
// `enabled` attache l'écouteur uniquement quand la modale est ouverte
// (modales inline gardées par un état, ou composants montés avec `open`).
// Les modales déjà montées/démontées à l'ouverture laissent `enabled` à true.
// onClose est stocké dans une ref : l'écouteur n'est ré-attaché que lorsque
// `enabled` change (ouverture/fermeture), pas à chaque rendu.
export function useEscapeToClose(onClose: () => void, enabled = true): void {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cb.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
