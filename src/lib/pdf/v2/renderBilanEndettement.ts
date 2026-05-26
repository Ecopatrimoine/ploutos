// ─── Lot 9 — Assembleur HTML pour la page Bilan endettement v2 ─────────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageBilanEndettement, type BilanEndettementPageData } from "./pages/pageBilanEndettement";

export type RenderBilanEndettementParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: BilanEndettementPageData;
};

export function renderBilanEndettement(p: RenderBilanEndettementParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageBilanEndettement(t, p.data);
  return coquilleDocument(t, {
    titre: `Bilan patrimonial — ${p.data.clientName}`,
    body,
  });
}
