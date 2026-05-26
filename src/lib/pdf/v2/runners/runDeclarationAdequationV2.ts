// ─── Lot 9 (bascule) — Runner Déclaration d'adéquation v2 ─────────────
import { mapCabinetToThemeV2 } from "../adapters/mapTheme";
import { buildAdequationData } from "../adapters/buildDeclarationAdequationData";
import { renderDeclarationAdequation } from "../renderDeclarationAdequation";
import { printV2 } from "../printV2";
import type { Recommandation } from "../../../conformite/recommandations";
import type { PatrimonialData } from "../../../../types/patrimoine";

export type RunDeclarationAdequationV2Params = {
  cabinet: Record<string, any>;
  data: PatrimonialData;
  mission: Record<string, any>;
  recommandations?: ReadonlyArray<Recommandation>;
};

export function runDeclarationAdequationV2(params: RunDeclarationAdequationV2Params): void {
  const { theme, cabinetColors } = mapCabinetToThemeV2(params.cabinet);
  const data = buildAdequationData({
    cabinet: params.cabinet,
    data: params.data,
    mission: params.mission,
    recommandations: params.recommandations,
  });
  const html = renderDeclarationAdequation({ theme, cabinetColors, data });
  printV2(html);
}
