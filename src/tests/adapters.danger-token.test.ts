// ─── Dette #B0413E -> SEMANTIC_DANGER : garde-fou de tokenisation (2 adapters PDF) ──
//
// Verrouille que buildProfilData (span « Dissonance profil ↔ capacité ») et
// buildBilanEndettementData (span « au-dessus du seuil … refinancement contraint »)
// n'embarquent PLUS l'ancien rouge #B0413E en dur, mais référencent le token
// SEMANTIC_DANGER (#992F2D, AAA, daltonisme-safe). Patron : pageHypos.lot52 (FIX 2).
//
// Test au niveau SOURCE (et non via un appel complet aux builders) : forcer les
// branches « dissonance » / « dépassement de seuil » exigerait des fixtures fragiles ;
// le grep-source est stable et suffit à empêcher un re-hardcodage du hex.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SEMANTIC_DANGER } from "../lib/pdf/v2/tokens";

const lireSource = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const ADAPTERS = [
  "../lib/pdf/v2/adapters/buildProfilData.ts",
  "../lib/pdf/v2/adapters/buildBilanEndettementData.ts",
];

describe("Tokenisation danger — adapters PDF (dette #B0413E)", () => {
  it("SEMANTIC_DANGER vaut bien le rouge AAA #992F2D", () => {
    expect(SEMANTIC_DANGER).toBe("#992F2D");
  });

  for (const rel of ADAPTERS) {
    it(`${rel} : plus aucun #B0413E en dur, et danger porté par le token`, () => {
      const src = lireSource(rel);
      expect(src).not.toContain("#B0413E");
      // L'élément danger référence le token (template string), pas un hex en dur.
      expect(src).toContain("color:${SEMANTIC_DANGER}");
    });
  }
});
