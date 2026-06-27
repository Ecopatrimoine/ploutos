// ─── TEST DE RÈGLE — Rampe de couleur du graphe de barème (bracketChart) ─────
//
// La couleur de chaque barre est échantillonnée sur le RANG ABSOLU de la tranche
// dans la rampe de sévérité crème → rouge (t.rampeBareme), indépendamment du
// remplissage. L'« active » est marquée par CONTOUR + badge, jamais par un fill
// différent (daltonien-safe). Asserts structurels sur data-* du SVG.

import { describe, it, expect } from "vitest";
import { buildTokens, echantillonnerRampe } from "../lib/pdf/v2/tokens";
import { renderBracketChartSVG } from "../lib/pdf/v2/bracketChart";
import type { FilledBracket } from "../types/patrimoine";

const t = buildTokens("encreOr");

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

const rougeProfond = (n: number) => echantillonnerRampe(t.rampeBareme, n - 1, n); // dernier arrêt

describe("bracketChart — rampe de sévérité par rang absolu", () => {
  it("(1) chaque barre prend la couleur de rampe de son index ; T1 != T6 ; T6 = rouge profond", () => {
    const html = renderBracketChartSVG(brackets(6, Array(6).fill(true)), t);
    const barres = lireBarres(html);
    expect(barres).toHaveLength(6);
    for (const b of barres) {
      expect(b.color).toBe(echantillonnerRampe(t.rampeBareme, b.index, 6));
    }
    const c0 = barres[0].color, c5 = barres[5].color;
    expect(c0).not.toBe(c5);
    expect(c5).toBe(rougeProfond(6));
  });

  it("(2) le mapping ne dépend PAS du remplissage : T1-T2 seules remplies -> T2 n'est pas rouge, T6 reste rouge", () => {
    const html = renderBracketChartSVG(brackets(6, [true, true, false, false, false, false]), t);
    const barres = lireBarres(html);
    const t2 = barres.find(b => b.index === 1)!;
    const t6 = barres.find(b => b.index === 5)!;
    expect(t2.type).toBe("filled");
    expect(t6.type).toBe("empty");          // vide mais colorée
    expect(t2.color).not.toBe(rougeProfond(6));
    expect(t6.color).toBe(rougeProfond(6)); // couleur = rang absolu, pas remplissage
  });

  it("(3) l'active est marquée par contour or + badge, son fill reste la couleur de rampe (pas navy/or)", () => {
    const html = renderBracketChartSVG(brackets(6, [true, true, true, false, false, false]), t);
    const barres = lireBarres(html);
    const actives = barres.filter(b => b.active);
    expect(actives).toHaveLength(1);
    const active = actives[0];
    expect(active.index).toBe(2);                 // dernière remplie
    // fill = couleur de rampe de son index, surtout PAS un fill spécial (navy/or)
    expect(active.color).toBe(echantillonnerRampe(t.rampeBareme, 2, 6));
    expect(active.color).not.toBe(t.navy.toLowerCase());
    expect(active.color).not.toBe(t.or.toLowerCase());
    // marqueurs non chromatiques : contour or + badge chevron
    expect(html).toContain("data-active-badge");
    expect(compteActiveBadge(html)).toBe(1);
    expect(html).toMatch(new RegExp(`data-bar-active="true"[^>]*stroke="${t.or}"`));
  });

  it("(4) générique : n=5 et n=6 -> la dernière tranche tombe sur le rouge profond dans les deux cas", () => {
    const html6 = renderBracketChartSVG(brackets(6, Array(6).fill(true)), t);
    const html5 = renderBracketChartSVG(brackets(5, Array(5).fill(true)), t);
    const b6 = lireBarres(html6), b5 = lireBarres(html5);
    expect(b6).toHaveLength(6);
    expect(b5).toHaveLength(5);
    expect(b6[5].color).toBe(rougeProfond(6));
    expect(b5[4].color).toBe(rougeProfond(5));
    expect(b5[4].color).toBe(b6[5].color);        // même rouge final quel que soit n
    // et le 1er palier reste la crème dans les deux cas
    expect(b5[0].color).toBe(b6[0].color);
  });

  it("(5) rampe : luminance strictement monotone décroissante (ordre lisible en niveaux de gris)", () => {
    const Ls = t.rampeBareme.map(luminanceL);
    for (let i = 1; i < Ls.length; i++) {
      expect(Ls[i]).toBeLessThan(Ls[i - 1]);
    }
  });
});

function compteActiveBadge(html: string): number {
  return (html.match(/data-active-badge/g) || []).length;
}

// L* approx (sRGB -> XYZ -> Lab) pour le contrôle de monotonie de luminance.
function luminanceL(hex: string): number {
  const h = hex.replace("#", "");
  const lin = [0, 2, 4].map(i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return Y > (6 / 29) ** 3 ? 116 * Math.cbrt(Y) - 16 : 116 * (Y / (3 * (6 / 29) ** 2) + 4 / 29) - 16;
}
