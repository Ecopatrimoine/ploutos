// ─── Lot 9 — Assembleur HTML pour la page Prévoyance collective v2 ─────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pagePrevoyanceColl, type PrevoyanceCollPageData } from "./pages/pagePrevoyanceColl";

export type RenderPrevoyanceCollParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: PrevoyanceCollPageData;
};

export function renderPrevoyanceColl(p: RenderPrevoyanceCollParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pagePrevoyanceColl(t, p.data);
  return coquilleDocument(t, {
    titre: `Audit prévoyance collective — ${p.data.clientName}`,
    body,
  });
}
