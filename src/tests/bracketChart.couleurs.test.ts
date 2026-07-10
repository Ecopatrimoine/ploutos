// ─── TEST DE RÈGLE — Palette du graphe de barème (bracketChart) ──────────────
//
// C2 : la couleur de chaque barre suit l'ÉCRAN — palette CATÉGORIELLE or/bleu
// (t.paletteBareme = CHART_COLORS), cyclée sur le RANG ABSOLU de la tranche,
// indépendamment du remplissage. L'« active » est marquée par CONTOUR or + badge,
// jamais par un fill différent (daltonien-safe). En N&B, les valeurs affichées
// (taux + impôt) distinguent deux teintes voisines devenues proches en gris.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { renderBracketChartSVG } from "../lib/pdf/v2/bracketChart";
import type { FilledBracket } from "../types/patrimoine";

const t = buildTokens("encreOr");
const couleurRang = (i: number) => t.paletteBareme[i % t.paletteBareme.length];

type Barre = { type: "filled" | "empty"; index: number; color: string; active: boolean };

function lireBarres(html: string): Barre[] {
  const re = /<rect data-bar="(filled|empty)" data-bar-index="(\d+)" data-bar-color="([^"]+)"( data-bar-active="true")?/g;
  const out: Barre[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ type: m[1] as Barre["type"], index: Number(m[2]), color: m[3], active: Boolean(m[4]) });
  }
  return out;
}

// Fabrique n tranches ; remplies[i] pilote filled/tax (couleur indépendante de tout ça).
function brackets(n: number, remplies: boolean[]): FilledBracket[] {
  return Array.from({ length: n }, (_, i) => ({
    label: `${i} %`,
    from: i * 1_000_000,
    to: (i + 1) * 1_000_000,
    filled: remplies[i] ? 100_000 * (i + 1) : 0,
    tax: remplies[i] && i > 0 ? 1_000 * i : 0,
    rate: i / 100,
  }));
}

describe("bracketChart — palette catégorielle par rang absolu (miroir écran)", () => {
  it("(1) chaque barre prend la teinte catégorielle de son rang ; T0 != T5", () => {
    const html = renderBracketChartSVG(brackets(6, Array(6).fill(true)), t);
    const barres = lireBarres(html);
    expect(barres).toHaveLength(6);
    for (const b of barres) expect(b.color).toBe(couleurRang(b.index));
    expect(barres[0].color).not.toBe(barres[5].color); // teintes distinctes
  });

  it("(2) le mapping ne dépend PAS du remplissage : T2 remplie / T6 vide gardent leur teinte de rang", () => {
    const html = renderBracketChartSVG(brackets(6, [true, true, false, false, false, false]), t);
    const barres = lireBarres(html);
    const t2 = barres.find(b => b.index === 1)!;
    const t6 = barres.find(b => b.index === 5)!;
    expect(t2.type).toBe("filled");
    expect(t6.type).toBe("empty");          // vide mais colorée
    expect(t2.color).toBe(couleurRang(1));
    expect(t6.color).toBe(couleurRang(5));  // couleur = rang absolu, pas remplissage
  });

  it("(3) l'active est marquée par contour or + badge, son fill reste la teinte de palette", () => {
    const html = renderBracketChartSVG(brackets(6, [true, true, true, false, false, false]), t);
    const barres = lireBarres(html);
    const actives = barres.filter(b => b.active);
    expect(actives).toHaveLength(1);
    const active = actives[0];
    expect(active.index).toBe(2);                 // dernière remplie
    expect(active.color).toBe(couleurRang(2));    // fill = palette, PAS un fill spécial
    expect(active.color).not.toBe(t.navy.toLowerCase());
    // marqueurs non chromatiques : contour or + badge chevron
    expect(html).toContain("data-active-badge");
    expect(compteActiveBadge(html)).toBe(1);
    expect(html).toMatch(new RegExp(`data-bar-active="true"[^>]*stroke="${t.or}"`));
  });

  it("(4) générique n=5 et n=6 : teinte par rang, identique à rang égal, cyclée sur la palette", () => {
    const b6 = lireBarres(renderBracketChartSVG(brackets(6, Array(6).fill(true)), t));
    const b5 = lireBarres(renderBracketChartSVG(brackets(5, Array(5).fill(true)), t));
    expect(b6).toHaveLength(6);
    expect(b5).toHaveLength(5);
    expect(b5[0].color).toBe(b6[0].color);   // rang 0 identique quel que soit n
    expect(b5[4].color).toBe(b6[4].color);   // rang 4 identique
    expect(b6[5].color).toBe(couleurRang(5)); // rang 5 = 6e teinte de la palette
  });

  it("(5) N&B : chaque barre porte sa valeur (taux + impôt) → distinction sans couleur", () => {
    const html = renderBracketChartSVG(brackets(6, Array(6).fill(true)), t);
    for (let i = 0; i < 6; i++) expect(html).toContain(`>${i} %<`);         // taux de chaque tranche
    expect((html.match(/data-bar-amount/g) || []).length).toBeGreaterThan(0); // impôt affiché
  });
});

function compteActiveBadge(html: string): number {
  return (html.match(/data-active-badge/g) || []).length;
}
