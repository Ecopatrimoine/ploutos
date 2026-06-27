// ─── TEST DE RÈGLE — Page IR : graphe « barème par tranche (par part) » ──────
//
// Chaîne : fixture brute (forme computeIR) → buildIRData → pageIR. bracketFill est
// calculé PAR PART (sur le quotient). Asserts structurels sur data-* du SVG + note.
//
//   1. Bloc présent, 5 barres (= 5 tranches IR).
//   2. Couleur indexée sur le RANG ABSOLU (T5 = rouge profond, indépendant du remplissage).
//   3. Active = tranche du quotient (TMI), marquée CONTOUR or + badge « TMI », fill = couleur
//      de rampe (ni navy ni or).
//   4. Labels = impôt PAR PART (1 par tranche à tax>0) ; note de réconciliation cite « × parts »,
//      décote et plafonnement du quotient familial, et précise que la somme des barres ≠ impôt net.
//   5. Aucune chaîne « 75 % » (ça, c'est l'IFI — et absent de toute façon).

import { describe, it, expect } from "vitest";
import { buildTokens, echantillonnerRampe } from "../lib/pdf/v2/tokens";
import { pageIR } from "../lib/pdf/v2/pages/pageIR";
import { buildIRData } from "../lib/pdf/v2/adapters/buildIRData";
import type { FilledBracket } from "../types/patrimoine";

const t = buildTokens("encreOr");

type Barre = { type: "filled" | "empty"; index: number; color: string; active: boolean };
function lireBarres(html: string): Barre[] {
  const re = /<rect data-bar="(filled|empty)" data-bar-index="(\d+)" data-bar-color="([^"]+)"( data-bar-active="true")?/g;
  const out: Barre[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push({ type: m[1] as Barre["type"], index: Number(m[2]), color: m[3], active: Boolean(m[4]) });
  return out;
}
const compte = (html: string, re: RegExp) => (html.match(re) || []).length;
const rougeProfond = (n: number) => echantillonnerRampe(t.rampeBareme, n - 1, n);

// Décomposition par tranche sur le quotient — miroir de computeTaxFromBrackets (IR 5 tranches).
function brackets(quotient: number): FilledBracket[] {
  const defs = [
    { label: "0 %", from: 0, to: 11_600, rate: 0 },
    { label: "11 %", from: 11_600, to: 29_579, rate: 0.11 },
    { label: "30 %", from: 29_579, to: 84_577, rate: 0.30 },
    { label: "41 %", from: 84_577, to: 181_917, rate: 0.41 },
    { label: "45 %", from: 181_917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
  ];
  return defs.map(d => {
    const cap = Number.isFinite(d.to) ? d.to : quotient;
    const filled = Math.max(0, Math.min(quotient, cap) - d.from);
    return { label: d.label, from: d.from, to: cap, filled, tax: Math.round(filled * d.rate), rate: d.rate };
  });
}

function rendre(o: { quotient: number; parts: number; marginalRate: number }): string {
  const d = buildIRData({
    ir: { quotient: o.quotient, parts: o.parts, marginalRate: o.marginalRate, bracketFill: brackets(o.quotient), finalIR: 0 },
    data: {},
    cabinet: { cabinetName: "Cabinet Test" },
    clientName: "Test",
    dateLettre: "25 mai 2026",
    notreLecture: "Lecture neutre pour le test, sans levier evoque.",
  });
  return pageIR(t, d);
}

describe("pageIR — graphe barème par tranche (par part)", () => {
  it("(1) bloc présent avec 5 barres (= 5 tranches IR)", () => {
    const html = rendre({ quotient: 45_000, parts: 2, marginalRate: 0.30 });
    expect(html).toContain("data-bracket-chart");
    expect(html).toContain("Barème IR");
    expect(html).toContain("par part");
    expect(compte(html, /data-bar="/g)).toBe(5);
  });

  it("(2) couleur indexée sur le rang absolu : T5 = rouge profond, indépendant du remplissage", () => {
    const html = rendre({ quotient: 45_000, parts: 2, marginalRate: 0.30 }); // T4 (45 %) vide
    const barres = lireBarres(html);
    for (const b of barres) expect(b.color).toBe(echantillonnerRampe(t.rampeBareme, b.index, 5));
    const t5 = barres.find(b => b.index === 4)!;
    expect(t5.type).toBe("empty");
    expect(t5.color).toBe(rougeProfond(5));
    expect(barres[0].color).not.toBe(t5.color);
  });

  it("(3) active = tranche du quotient (TMI), contour or + badge TMI, fill = couleur de rampe", () => {
    const html = rendre({ quotient: 45_000, parts: 2, marginalRate: 0.30 });
    const actives = lireBarres(html).filter(b => b.active);
    expect(actives).toHaveLength(1);
    const active = actives[0];
    expect(active.index).toBe(2);                 // tranche 30 % contient le quotient 45 000
    expect(active.color).toBe(echantillonnerRampe(t.rampeBareme, 2, 5));
    expect(active.color).not.toBe(t.navy.toLowerCase());
    expect(active.color).not.toBe(t.or.toLowerCase());
    expect(html).toContain("data-active-badge");
    expect(compte(html, /data-active-badge/g)).toBe(1);
    expect(html).toContain(">TMI<");
    expect(html).toMatch(new RegExp(`data-bar-active="true"[^>]*stroke="${t.or}"`));
  });

  it("(3b) le badge TMI suit le quotient : TMI 41 % -> tranche active = index 3", () => {
    const html = rendre({ quotient: 100_000, parts: 2, marginalRate: 0.41 });
    const active = lireBarres(html).find(b => b.active)!;
    expect(active.index).toBe(3);
  });

  it("(4) labels = impôt par part (1 par tranche à tax>0) ; note de réconciliation qualitative", () => {
    const html = rendre({ quotient: 45_000, parts: 2, marginalRate: 0.30 });
    // tranches 11 % et 30 % ont un impôt > 0 -> 2 labels montant ; 0 % et vides -> aucun
    expect(compte(html, /data-bar-amount/g)).toBe(2);
    expect(html).toContain("× 2 parts");          // "x 2 parts" (multiplication)
    expect(html).toContain("décote");             // decote
    expect(html).toContain("plafonnement du quotient familial");
    expect(html).toContain("n'est donc pas l'impôt net");
  });

  it("(5) aucune chaîne 75 % (plafonnement IFI, hors sujet IR)", () => {
    const html = rendre({ quotient: 45_000, parts: 2, marginalRate: 0.30 });
    expect(html).not.toMatch(/75\s*%/);
    expect(html).not.toMatch(/plafonnement IFI/i);
  });
});
