// ─── Lot 9 (bascule) — Runner Fiche conseil DDA v2 ────────────────────
import { mapCabinetToThemeV2 } from "../adapters/mapTheme";
import { buildFicheDDAData } from "../adapters/buildFicheDDAData";
import { renderFicheDDA } from "../renderFicheDDA";
import { printV2 } from "../printV2";
import type { Recommandation } from "../../../conformite/recommandations";

export type RunFicheDDAV2Params = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  recommandations?: ReadonlyArray<Recommandation>;
  dateLettre?: string;
};

export function runFicheDDAV2(params: RunFicheDDAV2Params): void {
  const { theme, cabinetColors } = mapCabinetToThemeV2(params.cabinet);
  const data = buildFicheDDAData({
    cabinet: params.cabinet,
    mission: params.mission,
    recommandations: params.recommandations,
    dateLettre: params.dateLettre,
  });
  const html = renderFicheDDA({ theme, cabinetColors, data });
  printV2(html);
}
