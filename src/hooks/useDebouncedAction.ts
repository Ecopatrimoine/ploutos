import { useCallback, useRef } from "react";

// Lot 8 C2 — anti double-clic sur les actions d'ajout (append de ligne).
// Retourne un wrapper qui IGNORE tout second appel survenant moins de
// `delayMs` après le premier — un double-clic rapide ne crée donc qu'une
// seule ligne. `action` est stockée dans une ref : l'identité du wrapper
// reste stable entre les rendus.
export function useDebouncedAction<T extends unknown[]>(
  action: (...args: T) => void,
  delayMs = 300,
): (...args: T) => void {
  const lastRef = useRef(Number.NEGATIVE_INFINITY);
  const cb = useRef(action);
  cb.current = action;
  return useCallback(
    (...args: T) => {
      const now = Date.now();
      if (now - lastRef.current < delayMs) return;
      lastRef.current = now;
      cb.current(...args);
    },
    [delayMs],
  );
}
