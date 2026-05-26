// ─── Lot 9 — Assembleur HTML pour la page IFI v2 ─────────────────────────
//
// Glue qui combine tokens + page IFI dans une coquille HTML complète
// (DOCTYPE + head avec polices + body). Consommé par scripts/generatePdfLocal.ts.

import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageIFI, type IFIPageData } from "./pages/pageIFI";

export type RenderIFIParams = {
  theme: Theme;                       // "encreOr" | "cabinet"
  cabinetColors?: CouleursCabinet;    // requis si theme === "cabinet"
  data: IFIPageData;
};

export function renderIFI(p: RenderIFIParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageIFI(t, p.data);
  return coquilleDocument(t, {
    titre: `IFI — ${p.data.clientName}`,
    body,
  });
}
