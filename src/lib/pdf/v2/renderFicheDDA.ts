// ─── Lot 9 — Assembleur HTML pour la Fiche conseil DDA v2 (2 pages) ────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageFicheDDA, type FicheDDAPageData } from "./pages/pageFicheDDA";

export type RenderFicheDDAParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: FicheDDAPageData;
};

export function renderFicheDDA(p: RenderFicheDDAParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageFicheDDA(t, p.data);
  return coquilleDocument(t, {
    titre: `Fiche d'information & de conseil — ${p.data.cabinetNom}`,
    body,
  });
}
