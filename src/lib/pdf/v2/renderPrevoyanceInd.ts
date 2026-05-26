// ─── Lot 9 — Assembleur HTML pour la page Prévoyance individuelle v2 ───
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pagePrevoyanceInd, type PrevoyanceIndPageData } from "./pages/pagePrevoyanceInd";

export type RenderPrevoyanceIndParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: PrevoyanceIndPageData;
};

export function renderPrevoyanceInd(p: RenderPrevoyanceIndParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pagePrevoyanceInd(t, p.data);
  return coquilleDocument(t, {
    titre: `Prévoyance individuelle — ${p.data.clientName}`,
    body,
  });
}
