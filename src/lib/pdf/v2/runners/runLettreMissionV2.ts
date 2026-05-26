// ─── Lot 9 (bascule) — Runner Lettre de mission v2 ────────────────────
import { mapCabinetToThemeV2 } from "../adapters/mapTheme";
import { buildLettreMissionData } from "../adapters/buildLettreMissionData";
import { renderLettreMission } from "../renderLettreMission";
import { printV2 } from "../printV2";

export type RunLettreMissionV2Params = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  data: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
};

export function runLettreMissionV2(params: RunLettreMissionV2Params): void {
  const { theme, cabinetColors } = mapCabinetToThemeV2(params.cabinet);
  const data = buildLettreMissionData({
    cabinet: params.cabinet,
    mission: params.mission,
    data: params.data,
    clientName: params.clientName,
    dateLettre: params.dateLettre,
  });
  const html = renderLettreMission({ theme, cabinetColors, data });
  printV2(html);
}
