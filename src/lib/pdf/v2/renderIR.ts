// ─── Lot 9 — Assembleur HTML pour la page IR v2 ──────────────────────────
// Glue identique au pattern renderIFI : tokens + page IR dans la coquille
// HTML complète (DOCTYPE + head + body).

import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageIR, type IRPageData } from "./pages/pageIR";

export type RenderIRParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: IRPageData;
};

export function renderIR(p: RenderIRParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageIR(t, p.data);
  return coquilleDocument(t, {
    titre: `Impôt sur le revenu — ${p.data.clientName}`,
    body,
  });
}
