// ─── Lot 9 (bascule) — Runner DER v2 (pipeline complet pour l'app) ────
//
// Pipeline complet appelable depuis un handler React :
//   1. Mapper cabinet → { theme, cabinetColors } (cf. mapTheme)
//   2. Mapper cabinet → DerPageData (cf. buildDerData)
//   3. Rendre HTML v2 via renderDer
//   4. Ouvrir popup print (printV2 → openPrintPopup v1, comportement
//      utilisateur identique aux boutons v1)
//
// Le runner ne touche pas au DOM React et n'a aucun effet de bord en
// dehors de l'ouverture popup. Sûr à appeler depuis un onClick handler.

import { mapCabinetToThemeV2 } from "../adapters/mapTheme";
import { buildDerData } from "../adapters/buildDerData";
import { renderDer } from "../renderDer";
import { printV2 } from "../printV2";

export type RunDerV2Params = {
  cabinet: Record<string, any>;
  /** Optionnel : forcer une date (par défaut : aujourd'hui). */
  dateLettre?: string;
};

export function runDerV2(params: RunDerV2Params): void {
  const { theme, cabinetColors } = mapCabinetToThemeV2(params.cabinet);
  const data = buildDerData({ cabinet: params.cabinet, dateLettre: params.dateLettre });
  const html = renderDer({ theme, cabinetColors, data });
  printV2(html);
}
