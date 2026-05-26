// ─── Lot 9 — Assembleur HTML pour la page Couverture v2 ─────────────────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageCouverture, type CouverturePageData } from "./pages/pageCouverture";

export type RenderCouvertureParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: CouverturePageData;
};

export function renderCouverture(p: RenderCouvertureParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageCouverture(t, p.data);
  return coquilleDocument(t, {
    titre: `${p.data.titreDocument.replace(/\n/g, " ")} — ${p.data.clientName}`,
    body,
  });
}
