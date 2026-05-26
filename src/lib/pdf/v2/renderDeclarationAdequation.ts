// ─── Lot 9 — Assembleur HTML pour la Déclaration d'adéquation v2 (2 pages) ──
import { buildTokens, type Theme, type CouleursCabinet } from "./tokens";
import { coquilleDocument } from "./primitives";
import { pageDeclarationAdequation, type DeclarationAdequationPageData } from "./pages/pageDeclarationAdequation";

export type RenderDeclarationAdequationParams = {
  theme: Theme;
  cabinetColors?: CouleursCabinet;
  data: DeclarationAdequationPageData;
};

export function renderDeclarationAdequation(p: RenderDeclarationAdequationParams): string {
  const t = buildTokens(p.theme, p.cabinetColors);
  const body = pageDeclarationAdequation(t, p.data);
  return coquilleDocument(t, {
    titre: `Déclaration d'adéquation — ${p.data.cabinetNom}`,
    body,
  });
}
