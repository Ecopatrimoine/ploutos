// ─── Lot 9 — Assembleur HTML pour le DER v2 (2 pages) ──────────────────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageDer, type DerPageData } from "./pages/pageDer";

export type RenderDerParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: DerPageData;
};

export function renderDer(p: RenderDerParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageDer(t, p.data);
  return coquilleDocument(t, {
    titre: `Document d'entrée en relation — ${p.data.cabinetNom}`,
    body,
  });
}
