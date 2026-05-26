// ─── Lot 9 — Assembleur HTML pour la page Profil v2 ─────────────────────
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageProfil, type ProfilPageData } from "./pages/pageProfil";

export type RenderProfilParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: ProfilPageData;
};

export function renderProfil(p: RenderProfilParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageProfil(t, p.data);
  return coquilleDocument(t, {
    titre: `Profil investisseur — ${p.data.clientName}`,
    body,
  });
}
