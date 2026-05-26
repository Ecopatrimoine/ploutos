// ─── Lot 9 — Assembleur HTML pour la Lettre de mission v2 (2 pages) ────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageLettreMission, type LettreMissionPageData } from "./pages/pageLettreMission";

export type RenderLettreMissionParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: LettreMissionPageData;
};

export function renderLettreMission(p: RenderLettreMissionParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageLettreMission(t, p.data);
  return coquilleDocument(t, {
    titre: `Lettre de mission — ${p.data.clientNom}`,
    body,
  });
}
