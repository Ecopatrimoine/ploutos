// ─── Lot 5.2 — Cartes scenarios pageHypos : asserts structurels ─────────────
//
// Verrouille les 4 sous-fix :
//   FIX 1 : deltaTotal nomme = somme signee des 3 deltas (IR+IFI+Succession).
//   FIX 2 : plus aucun #B0413E en dur (page + adapter) -> token danger.
//   FIX 3 : filet de severite gauche pilote par le signe de deltaTotal.
//   FIX 4 : bar chart sans cap (toutes les barres) + palette qualitative >=6, sans repetition.
//
// Tout est derive de valeurs deja calculees : aucune logique fiscale ici.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildHyposData } from "../lib/pdf/v2/adapters/buildHyposData";
import { pageHypos } from "../lib/pdf/v2/pages/pageHypos";
import { buildTokens } from "../lib/pdf/v2/tokens";

const lireSource = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

// Base fixe ; chaque scenario decline IR/IFI/Succession autour de la base.
const ir = { finalIR: 10_000 };
const ifi = { ifi: 5_000 };
const succession = { totalRights: 20_000 };

const mkHypo = (name: string, o: { ir: number; ifi: number; succ: number }) => ({
  hypothesis: { name, objective: `obj ${name}`, notes: `notes ${name}` },
  ir: { finalIR: o.ir },
  ifi: { ifi: o.ifi },
  succession: { totalRights: o.succ },
});

const hypoGain    = mkHypo("Gain",    { ir: 8_000,  ifi: 4_000, succ: 18_000 }); // deltaTotal -5000
const hypoSurcout = mkHypo("Surcout", { ir: 11_000, ifi: 6_000, succ: 23_000 }); // deltaTotal +5000
const hypoNeutre  = mkHypo("Neutre",  { ir: 10_000, ifi: 5_000, succ: 20_000 }); // deltaTotal 0

const build = (hr: unknown[]) =>
  buildHyposData({ data: {}, cabinet: {}, ir, ifi, succession, hypothesisResults: hr });

describe("pageHypos Lot 5.2 — deltaTotal (FIX 1)", () => {
  it("deltaTotal est present et egal a la somme des 3 deltas par scenario", () => {
    const d = build([hypoGain, hypoSurcout, hypoNeutre]);
    expect(d.scenarios).toHaveLength(3);
    for (const s of d.scenarios) {
      const somme = s.kpis[0].delta + s.kpis[1].delta + s.kpis[2].delta;
      expect(s.deltaTotal).toBe(somme);
      // = aussi la valeur du KPI "Total fiscal" (kpis[3]) : meme source, non modifiee.
      expect(s.deltaTotal).toBe(s.kpis[3].delta);
    }
  });

  it("signe conserve : gain < 0, surcout > 0, neutre === 0", () => {
    const d = build([hypoGain, hypoSurcout, hypoNeutre]);
    expect(d.scenarios[0].deltaTotal).toBe(-5_000);
    expect(d.scenarios[1].deltaTotal).toBe(5_000);
    expect(d.scenarios[2].deltaTotal).toBe(0);
  });
});

describe("pageHypos Lot 5.2 — token danger (FIX 2)", () => {
  it("plus aucun #B0413E en dur dans pageHypos.ts ni buildHyposData.ts", () => {
    expect(lireSource("../lib/pdf/v2/pages/pageHypos.ts")).not.toContain("#B0413E");
    expect(lireSource("../lib/pdf/v2/adapters/buildHyposData.ts")).not.toContain("#B0413E");
  });

  it("t.danger est defini dans les 2 themes (et != ancien #B0413E)", () => {
    for (const theme of ["encreOr", "cabinet"] as const) {
      const t = buildTokens(theme);
      expect(typeof t.danger).toBe("string");
      expect(t.danger).not.toBe("#B0413E");
    }
  });
});

describe("pageHypos Lot 5.2 — filet de severite (FIX 3)", () => {
  const t = buildTokens("encreOr");
  // Signature SPECIFIQUE a la carte scenario (bordureMoyenne + filet) : exclut l'encart
  // "notre lecture" (qui porte aussi un border-left:3px or, mais avec bordureEncart).
  const cardFilet = (couleur: string) => `border:0.5px solid ${t.bordureMoyenne};border-left:3px solid ${couleur}`;

  it("melange : un filet vert (gain), un rouge (surcout), un neutre (or)", () => {
    const html = pageHypos(t, build([hypoGain, hypoSurcout, hypoNeutre]));
    expect(html).toContain(cardFilet(t.succes));
    expect(html).toContain(cardFilet(t.danger));
    expect(html).toContain(cardFilet(t.or));
    // Coin gauche carre (filet = bord plein), coins droits arrondis.
    expect(html).toContain("border-radius:0 10px 10px 0");
  });

  it("gain seul -> filet vert present, rouge absent", () => {
    const html = pageHypos(t, build([hypoGain]));
    expect(html).toContain(cardFilet(t.succes));
    expect(html).not.toContain(cardFilet(t.danger));
  });

  it("surcout seul -> filet rouge present, vert absent", () => {
    const html = pageHypos(t, build([hypoSurcout]));
    expect(html).toContain(cardFilet(t.danger));
    expect(html).not.toContain(cardFilet(t.succes));
  });
});

describe("pageHypos Lot 5.2 — bar chart sans cap + palette (FIX 4)", () => {
  const t = buildTokens("encreOr");
  // 5 scenarios complets (au-dela de l'ancien cap=3).
  const cinq = [1, 2, 3, 4, 5].map(i => mkHypo(`S${i}`, { ir: 9_000 + i * 400, ifi: 4_000 + i * 300, succ: 19_000 + i * 500 }));

  it("trace TOUTES les barres : 3 groupes x (1 base + N scenarios), cap retire", () => {
    const html = pageHypos(t, build(cinq));
    const rects = (html.match(/<rect /g) || []).length;
    expect(rects).toBe(3 * (1 + cinq.length)); // 3*(1+5)=18 (avant cap : 3*(1+3)=12)
  });

  it("plus de note de surplus '+N non affiches'", () => {
    const html = pageHypos(t, build(cinq));
    expect(html).not.toContain("non affich");
  });

  it("palette >=6 teintes uniques, identique dans les 2 themes", () => {
    for (const theme of ["encreOr", "cabinet"] as const) {
      const pal = buildTokens(theme).paletteScenarios;
      expect(pal.length).toBeGreaterThanOrEqual(6);
      expect(new Set(pal).size).toBe(pal.length); // aucune teinte dupliquee
    }
  });

  it("6 scenarios -> les 6 teintes de palette apparaissent (aucune repetition jusqu'a 6)", () => {
    const six = [1, 2, 3, 4, 5, 6].map(i => mkHypo(`S${i}`, { ir: 9_000 + i * 400, ifi: 4_000 + i * 300, succ: 19_000 + i * 500 }));
    const html = pageHypos(t, build(six));
    for (const teinte of t.paletteScenarios) {
      expect(html).toContain(teinte);
    }
  });
});
