// ─── Lot 9 (bascule) — Runner Fiche conseil DDA v2 ────────────────────
import { mapCabinetToThemeV2 } from "../adapters/mapTheme";
import { buildFicheDDAData } from "../adapters/buildFicheDDAData";
import { renderFicheDDA } from "../renderFicheDDA";
import { printV2 } from "../printV2";
import type { Recommandation } from "../../../conformite/recommandations";
import type { PieceJointe } from "../../../conformite/piecesJointes";

export type RunFicheDDAV2Params = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  /** Données dossier client (pour identité client en page 1). */
  data?: Record<string, any>;
  recommandations?: ReadonlyArray<Recommandation>;
  /** Pièces jointes IPID/DIC du dossier (Lot 8e). */
  piecesJointes?: ReadonlyArray<PieceJointe>;
  dateLettre?: string;
};

export function runFicheDDAV2(params: RunFicheDDAV2Params): void {
  const { theme, cabinetColors } = mapCabinetToThemeV2(params.cabinet);
  const data = buildFicheDDAData({
    cabinet: params.cabinet,
    mission: params.mission,
    data: params.data,
    recommandations: params.recommandations,
    piecesJointes: params.piecesJointes,
    dateLettre: params.dateLettre,
  });
  const html = renderFicheDDA({ theme, cabinetColors, data });
  printV2(html);
}
