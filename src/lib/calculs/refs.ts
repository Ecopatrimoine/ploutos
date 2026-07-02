// ─── Resolveur partage des references d'actif (placement / bien) ────────────
//
// Resolution d'IDENTITE uniquement — aucune formule de calcul ici.
// Regle : l'id fait foi. Si un id est fourni, on resout par id (et on ne
// retombe PAS sur l'index si l'id est introuvable : une reference explicite
// cassee => null). Repli sur l'index legacy uniquement en l'ABSENCE d'id
// (payloads anciens non encore migres). Introuvable => null.

import type { Placement, Property } from "../../types/patrimoine";

export interface AssetRef {
  id?: string | null;
  index?: number | string | null;
}

function resolveByRef<T extends { id?: string }>(items: readonly T[], ref: AssetRef): T | null {
  if (ref.id) {
    return items.find((it) => it.id === ref.id) ?? null;
  }
  const i = typeof ref.index === "number" ? ref.index : parseInt(String(ref.index ?? ""), 10);
  if (!Number.isFinite(i) || i < 0 || i >= items.length) return null;
  return items[i];
}

export function resolvePlacementRef(placements: readonly Placement[], ref: AssetRef): Placement | null {
  return resolveByRef(placements, ref);
}

export function resolvePropertyRef(properties: readonly Property[], ref: AssetRef): Property | null {
  return resolveByRef(properties, ref);
}
