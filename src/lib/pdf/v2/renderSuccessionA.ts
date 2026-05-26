// ─── Lot 9 — Assembleur HTML pour la page Succession A v2 ───────────────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageSuccessionA, type SuccessionAPageData } from "./pages/pageSuccessionA";

export type RenderSuccessionAParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: SuccessionAPageData;
};

export function renderSuccessionA(p: RenderSuccessionAParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageSuccessionA(t, p.data);
  return coquilleDocument(t, {
    titre: `Succession (volet 1) — ${p.data.clientName}`,
    body,
  });
}
