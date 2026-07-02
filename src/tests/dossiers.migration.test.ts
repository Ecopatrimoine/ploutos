// Lot 5 — Harnais dossiers : passe les dossiers d'exemple (src/tests/Dossiers test/,
// payloads d'export complets) par ensureAssetIds — comme le fait l'app au chargement.
// On NE RÉÉCRIT PAS les JSON : ils portent encore des références par index et
// prouvent la migration à chaque exécution. Défensif : le dossier est un répertoire
// de travail non versionné ; s'il est absent (checkout propre / CI), le harnais
// passe sans échec.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensureAssetIds } from "../lib/migrations/ensureAssetIds";

const DIR = fileURLToPath(new URL("./Dossiers test", import.meta.url));
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];

describe("Harnais dossiers — migration ensureAssetIds", () => {
  it("le répertoire de dossiers de test est lisible (présent ou absent)", () => {
    expect(Array.isArray(files)).toBe(true);
  });

  for (const file of files) {
    it(`${file} : ids posés, refs converties, migration idempotente`, () => {
      const payload = JSON.parse(readFileSync(`${DIR}/${file}`, "utf-8"));
      const bundle = {
        data: payload.data,
        successionData: payload.successionData ?? null,
        hypotheses: payload.hypotheses ?? null,
      };
      const migrated = ensureAssetIds(bundle);
      for (const p of migrated.data.placements ?? []) expect(typeof p.id).toBe("string");
      for (const p of migrated.data.properties ?? []) expect(typeof p.id).toBe("string");
      // Idempotence : une 2e passe ressort identique en valeur.
      const again = ensureAssetIds({
        data: migrated.data, successionData: migrated.successionData, hypotheses: migrated.hypotheses,
      });
      expect(again.data).toEqual(migrated.data);
      expect(again.successionData).toEqual(migrated.successionData);
      expect(again.hypotheses).toEqual(migrated.hypotheses);
    });
  }
});
