// LOT 11 — Graphe prévoyance PDF (aire empilée en escalier). Trois familles de tests :
//   1. géométrie PURE d'une couche en escalier sur cas connu (stepAreaPoints),
//   2. liste de PREUVE des ticks (ticksPdf) = la fonction réellement rendue, + anti-collision pt,
//   3. formats (euroCompactFr virgule FR, libelleJalon « 1 an » et non « 1.0 ans »).
import { describe, it, expect } from "vitest";
import type { ProjectionResult, SerieEmpilee } from "../lib/prevoyance/types";
import {
  stepAreaPoints,
  ticksPdf,
  euroCompactFr,
  renderProjectionSVG,
} from "../lib/pdf/v2/prevoyanceChart";
import { libelleJalon } from "../lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { axeTemps } from "../lib/presentation/echelleTemps";

const arr = (n: number) => Array(n).fill(0);

// Frise minimale : on ne pilote que l'IJ obligatoire (les ruptures qu'on veut) ; les autres
// étages restent nuls. La forme est celle attendue par axeTemps / buildTicksTemps / ticksPdf.
function makeProjection(opts: {
  jours: number[];
  oblig?: number[];
  collective?: number[];
  individuelle?: number[];
  bascule: number;
  retraite: number;
  ref?: number;
}): ProjectionResult {
  const n = opts.jours.length;
  const series = {
    salaire: arr(n),
    maintienEmployeur: arr(n),
    ijObligatoire: opts.oblig ?? arr(n),
    ijComplementaireCollective: opts.collective ?? arr(n),
    ijComplementaireIndividuelle: opts.individuelle ?? arr(n),
    pensionInvalObligatoire: arr(n),
    renteInvalCollective: arr(n),
    renteInvalIndividuelle: arr(n),
    renteInvalEnfants: arr(n),
  } as unknown as SerieEmpilee;
  const axe = opts.jours.map((j) => ({
    jour: j,
    date: "2026-01-01",
    phase: (j >= opts.bascule ? "invalidite" : "am") as "am" | "invalidite",
  }));
  return {
    axe,
    series,
    revenuReferenceMensuel: opts.ref ?? 3000,
    rupturesCles: [],
    basculeInvaliditeJour: opts.bascule,
    finProjectionJour: opts.retraite,
  } as unknown as ProjectionResult;
}

describe("stepAreaPoints — géométrie pure d'une couche en escalier", () => {
  it("cas connu : marches stepAfter, frontière haute puis basse inversée, polygone fermé", () => {
    const pts = stepAreaPoints([0, 10, 20], [0, 4, 6], [0, 0, 0]);
    expect(pts).toEqual([
      // frontière HAUTE, gauche → droite (palier horizontal puis marche verticale)
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 20, y: 4 },
      { x: 20, y: 6 },
      // frontière BASSE, droite → gauche
      { x: 20, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it("le premier point de la frontière haute porte bien la valeur du 1er point (pas de marche fantôme)", () => {
    const pts = stepAreaPoints([5, 15], [2, 7], [1, 1]);
    expect(pts[0]).toEqual({ x: 5, y: 2 });
    // frontiere(n=2) = 3 pts (1er point + 2 pts de marche) → haute + basse = 6 pts.
    expect(pts.length).toBe(6);
  });
});

describe("ticksPdf — liste de preuve = fonction rendue", () => {
  it("chaque rupture d'étage → tick niveau 1 libellé au jour exact ; position en pt croissante", () => {
    // ruptures IJ obl à J3·J7·J47·J87·J365·J1095 (profil type Erika CPAM salarié).
    const proj = makeProjection({
      jours: [0, 3, 7, 47, 87, 365, 1095],
      oblig: [0, 10, 20, 30, 40, 50, 0],
      bascule: 1095,
      retraite: 7300,
    });
    const ticks = ticksPdf(proj);
    const n1 = ticks.filter((t) => t.niveau === 1);
    expect(n1.map((t) => t.jour)).toEqual([3, 7, 47, 87, 365, 1095]);
    expect(n1.map((t) => t.label)).toEqual(["J3", "J7", "J47", "J87", "1 an", "3 ans"]);
    // À ces écarts, aucun chevauchement → tout sur la ligne 0.
    expect(n1.every((t) => t.ligne === 0)).toBe(true);
    // Positions strictement croissantes et dans le cadre du plot (34 pt → 526 pt).
    const xs = ticks.map((t) => t.xPt);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(34 - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(538 - 12 + 1e-6);
  });

  it("profil David SSI (maladie ordinaire) : J3 · 1 an · 3 ans en niveau 1", () => {
    const proj = makeProjection({
      jours: [0, 3, 365, 1095],
      oblig: [0, 30, 20, 0],
      bascule: 1095,
      retraite: 7300,
    });
    const n1 = ticksPdf(proj).filter((t) => t.niveau === 1);
    expect(n1.map((t) => t.label)).toEqual(["J3", "1 an", "3 ans"]);
  });

  it("anti-collision recalibrée en pt : deux ruptures proches → 2 lignes, aucune supprimée", () => {
    const proj = makeProjection({
      jours: [0, 7, 900, 950, 1095],
      oblig: [0, 40, 35, 30, 0],
      bascule: 1095,
      retraite: 7300,
    });
    const ticks = ticksPdf(proj);
    const t900 = ticks.find((t) => t.jour === 900)!;
    const t950 = ticks.find((t) => t.jour === 950)!;
    expect(t900).toBeDefined();
    expect(t950).toBeDefined();
    expect(t900.ligne).not.toBe(t950.ligne); // décalées sur deux lignes
  });
});

describe("cohérence écran↔PDF — le contrôle du lot", () => {
  // La liste de ticks PDF (ticksPdf) doit être identique, AU LIBELLÉ ET AU NIVEAU PRÈS, à la
  // liste écran (axeTemps, fonction de production consommée par ProjectionChart) sur la même
  // projection : seules les positions diffèrent (% compressé écran vs pt PDF). Toute divergence
  // de jalon = bug de cohérence. Fixture riche : ruptures rapprochées + repères niveau 2.
  it("mêmes jalons · libellés · niveaux que la liste écran (positions à part)", () => {
    const proj = makeProjection({
      jours: [0, 3, 7, 37, 67, 365, 1095],
      oblig: [0, 1259, 1259, 1259, 1259, 0, 0],
      collective: [0, 0, 2251, 1341, 0, 0, 0], // profil « maintien » type Erika
      bascule: 1095,
      retraite: 7300,
      ref: 3900,
    });
    const key = (t: { jour: number; label: string; niveau: number }) => `${t.jour}|${t.label}|${t.niveau}`;
    const ecran = axeTemps(proj, false).ticks.map(key);
    const pdf = ticksPdf(proj).map(key);
    expect(pdf).toEqual(ecran);
  });
});

describe("formats", () => {
  it("euroCompactFr : virgule FR, k€, zéro décimal superflu retiré", () => {
    expect(euroCompactFr(3500)).toBe("3,5 k€");
    expect(euroCompactFr(3000)).toBe("3 k€");
    expect(euroCompactFr(12000)).toBe("12 k€");
    expect(euroCompactFr(1050)).toBe("1,1 k€");
    expect(euroCompactFr(999)).toBe("999 €");
  });

  it("libelleJalon : « 1 an » / « 2 ans », jamais « 1.0 ans »", () => {
    expect(libelleJalon(365)).toBe("1 an");
    expect(libelleJalon(730)).toBe("2 ans");
    expect(libelleJalon(365)).not.toMatch(/\d\.\d\s*ans?/);
  });
});

describe("renderProjectionSVG — rendu SVG + légende PAYEURS", () => {
  it("émet un SVG et une légende aux libellés PAYEURS des familles présentes", () => {
    const t = buildTokens("encreOr");
    const proj = makeProjection({
      jours: [0, 7, 90, 365, 1095],
      oblig: [0, 800, 800, 700, 600],
      collective: [0, 400, 400, 400, 300],
      individuelle: [0, 200, 200, 200, 200],
      bascule: 1095,
      retraite: 7300,
      ref: 2500,
    });
    const svg = renderProjectionSVG(proj, t);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Régime obligatoire");
    expect(svg).toContain("Prévoyance collective");
    expect(svg).toContain("Prévoyance individuelle (Madelin)");
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
  });
});
