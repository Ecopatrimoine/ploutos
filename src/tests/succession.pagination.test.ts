// Lot débordement Succession A/B — pagination par COMPTAGE.
//
// Cible : repartirLignesEnFeuilles (PUR, paginationListe.ts) + placement de la queue
// via paginerLignesSurFeuilles (primitives.ts). Aucune mesure DOM/Playwright.
//
// Géométrie de référence = celle de Succession A (constantes FIGÉES) :
//   HAUTEUR_FEUILLE=1122  PADDING_HAUT=32  RESERVE_PIED=30  H_TABLE_ENTETE=28
//   MARGE_SECURITE=120    H_LIGNE_LISTE=30
//   regionFeuille1 (rows) = 656  -> budget net = 656-120 = 536
//   regionContinuation     = 926 -> budget net = 926-120 = 806
//   hauteurBlocQueue       = 212  (foot-note + encart)
// Seuil feuille 1 (rows mono + queue) : 30*N + 212 <= 536  <=>  N <= 10,8  -> 10 rows.

import { describe, it, expect } from "vitest";
import {
  repartirLignesEnFeuilles,
  type RepartitionListeOpts,
} from "../lib/pdf/v2/paginationListe";
import { paginerLignesSurFeuilles } from "../lib/pdf/v2/primitives";
import { buildTokens } from "../lib/pdf/v2/tokens";

// Géométrie de référence (Succession A) pour repartirLignesEnFeuilles.
function geomA(over: Partial<RepartitionListeOpts> = {}): RepartitionListeOpts {
  return {
    hauteurLignePx: 30,
    regionFeuille1Px: 656,
    regionContinuationPx: 926,
    hauteurBlocQueuePx: 212,
    margeSecuritePx: 120,
    ...over,
  };
}
const mono = (n: number): number[] => Array.from({ length: n }, () => 1);

describe("repartirLignesEnFeuilles — seuils de découpage", () => {
  it("N=10 (cas témoin) -> 1 feuille (10*30+212 = 512 <= 536)", () => {
    const f = repartirLignesEnFeuilles(mono(10), geomA());
    expect(f.length).toBe(1);
    expect(f[0].length).toBe(10);
  });

  it("N=18 -> >=2 feuilles (540 > 536 : la table déborde la feuille 1)", () => {
    const f = repartirLignesEnFeuilles(mono(18), geomA());
    expect(f.length).toBeGreaterThanOrEqual(2);
    // Aucune row perdue : la concaténation des feuilles couvre tous les indices.
    expect(f.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i));
  });

  it("MONOTONIE : aucune row n'est jamais perdue, quel que soit N", () => {
    for (let n = 0; n <= 60; n++) {
      const f = repartirLignesEnFeuilles(mono(n), geomA());
      const indices = f.flat();
      expect(indices.length).toBe(n); // tous les indices présents, aucun doublon par construction
      expect(new Set(indices).size).toBe(n);
    }
  });
});

describe("repartirLignesEnFeuilles — la composition (poids 2) bascule le seuil", () => {
  it("N=10 tout mono -> 1 feuille ; N=10 avec UNE row composition -> >=2 feuilles", () => {
    const toutMono = repartirLignesEnFeuilles(mono(10), geomA());
    expect(toutMono.length).toBe(1);

    // Une row composition (poids 2) : 11 unités-ligne -> 330 ; 330+212 = 542 > 536.
    const avecComposition = [2, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const f = repartirLignesEnFeuilles(avecComposition, geomA());
    expect(f.length).toBeGreaterThanOrEqual(2);
  });

  it("poids douteux (0 / NaN / négatif) compte comme 2 (conservateur)", () => {
    // 9 mono + 1 poids douteux : doit se comporter comme 9 mono + 1 composition.
    const ref = repartirLignesEnFeuilles([2, 1, 1, 1, 1, 1, 1, 1, 1, 1], geomA());
    for (const douteux of [0, NaN, -1, undefined as unknown as number]) {
      const poids = [douteux, 1, 1, 1, 1, 1, 1, 1, 1, 1];
      expect(repartirLignesEnFeuilles(poids, geomA()).length).toBe(ref.length);
    }
  });
});

describe("repartirLignesEnFeuilles — listes courtes / vides (pas de crash)", () => {
  it("liste vide -> 1 feuille (vide, portera la queue)", () => {
    const f = repartirLignesEnFeuilles([], geomA());
    expect(f).toEqual([[]]);
  });
  it("1 élément -> 1 feuille", () => {
    const f = repartirLignesEnFeuilles([1], geomA());
    expect(f.length).toBe(1);
    expect(f[0]).toEqual([0]);
  });
});

describe("repartirLignesEnFeuilles — biais conservateur (jamais de troncature)", () => {
  it("région NaN -> jamais de crash, jamais de perte (1 row/feuille + queue isolée)", () => {
    const f = repartirLignesEnFeuilles(mono(3), geomA({ regionFeuille1Px: NaN }));
    expect(f.flat().filter((i) => typeof i === "number").sort()).toEqual([0, 1, 2]);
    expect(f.length).toBeGreaterThanOrEqual(3); // une feuille par row au minimum
  });
  it("région <= 0 -> 1 row/feuille (pas de division par budget négatif silencieuse)", () => {
    const f = repartirLignesEnFeuilles(mono(4), geomA({ regionContinuationPx: -50 }));
    expect(f.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(f.length).toBeGreaterThanOrEqual(4);
  });
  it("hauteur de ligne non saine -> conservateur, aucune perte", () => {
    const f = repartirLignesEnFeuilles(mono(5), geomA({ hauteurLignePx: NaN }));
    expect(f.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });
});

// ─── Placement de la QUEUE via paginerLignesSurFeuilles (HTML) ───────────────────
describe("paginerLignesSurFeuilles — la queue est sur la dernière feuille, une seule fois", () => {
  const t = buildTokens("encreOr");
  const cols = [
    { label: "A", align: "left" as const },
    { label: "B", align: "right" as const },
  ];
  const QUEUE = "<!--QUEUE_MARKER-->";
  // zoneHaute1=376 -> regionFeuille1 = 1122-32-376-30-28 = 656 ; zoneHauteCont=106 -> 926.
  function paginer(n: number) {
    return paginerLignesSurFeuilles<number>({
      t,
      lignes: Array.from({ length: n }, (_, i) => i),
      cols,
      rendreLigne: (i) => [{ value: `n${i}` }, { value: "x", align: "right" }],
      poidsLigne: () => 1,
      blocQueueHTML: QUEUE,
      zoneHaute1Px: 376,
      zoneHauteContPx: 106,
      hauteurBlocQueuePx: 212,
    });
  }

  it("N=18 (déborde) : >=2 fragments, marqueur de queue exactement 1 fois, sur le dernier", () => {
    const frags = paginer(18);
    expect(frags.length).toBeGreaterThanOrEqual(2);
    const total = frags.join("");
    expect(total.split(QUEUE).length - 1).toBe(1); // exactement une occurrence
    expect(frags[frags.length - 1]).toContain(QUEUE);
    frags.slice(0, -1).forEach((f) => expect(f).not.toContain(QUEUE));
    // thead (en-tête de colonnes) répété : présent sur chaque fragment portant une table.
    expect(total.split("<thead>").length - 1).toBe(frags.filter((f) => f.includes("<table")).length);
  });

  it("N=3 (tient) : 1 fragment, contient la table ET la queue", () => {
    const frags = paginer(3);
    expect(frags.length).toBe(1);
    expect(frags[0]).toContain(QUEUE);
    expect(frags[0]).toContain("<table");
  });
});
