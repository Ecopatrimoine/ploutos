// ─── Lot 9 — Assembleur HTML pour la page Succession B v2 ───────────────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageSuccessionB, type SuccessionBPageData } from "./pages/pageSuccessionB";

export type RenderSuccessionBParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: SuccessionBPageData;
};

export function renderSuccessionB(p: RenderSuccessionBParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageSuccessionB(t, p.data);
  return coquilleDocument(t, {
    titre: `Succession (volet 2) — ${p.data.clientName}`,
    body,
  });
}
