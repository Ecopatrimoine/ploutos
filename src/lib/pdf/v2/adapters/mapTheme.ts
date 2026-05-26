// ─── Lot 9 (bascule) — Mapping cabinet → tokens v2 ────────────────────
//
// Convertit l'objet cabinet de l'app (Paramètres → Documents) vers le
// format attendu par les render*.ts v2 : `{ theme, cabinetColors? }`.
//
// Règle alignée sur `resolveCabinetColors()` v1 (pdfCore.ts:76) :
//  1. `pdfPalette === "encre_or"` → theme "encreOr" pur, sans cabinetColors
//  2. Sinon (défaut "cabinet") :
//     - si AU MOINS UNE colorXxx définie → theme "cabinet" + cabinetColors
//       (fallback per-couleur sur Encre & Or via buildTokens)
//     - sinon (cabinet 100 % vide) → theme "encreOr" (sécurité « pas de PDF vide »)
//
// Ainsi le sélecteur Paramètres → Documents déjà en place pilote
// transparent les 2 thèmes du pipeline v2 sans refacto UI.

import type { Theme, CouleursCabinet } from "../tokens";

export type ThemeV2 = { theme: Theme; cabinetColors?: CouleursCabinet };

export function mapCabinetToThemeV2(cabinet: Record<string, any>): ThemeV2 {
  const wantsEncreOr = cabinet?.pdfPalette === "encre_or";
  if (wantsEncreOr) return { theme: "encreOr" };

  const hasAny =
    !!cabinet?.colorNavy ||
    !!cabinet?.colorGold ||
    !!cabinet?.colorSky  ||
    !!cabinet?.colorCream;
  if (!hasAny) return { theme: "encreOr" };

  const cc: CouleursCabinet = {
    navy:  cabinet.colorNavy  || "#0F172A",
    or:    cabinet.colorGold  || "#C4973D",
    cream: cabinet.colorCream || "#FDF6E8",
    sky:   cabinet.colorSky   || "#5B7089",
  };
  return { theme: "cabinet", cabinetColors: cc };
}
