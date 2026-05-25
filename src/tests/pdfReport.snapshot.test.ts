// ─── Snapshots HTML — pdfReport (Lot 0, filet refacto) ──────────────────────
// Fige le rendu actuel pour permettre une refacto sans régression silencieuse.

import { describe, it, expect, beforeAll } from "vitest";
import { buildAndPrintPdf } from "../lib/pdf/pdfReport";
import {
  fixtureData,
  fixtureIrOptions,
  fixtureCabinet,
  fixtureCabinetNoColors,
  fixtureHypothesisResults,
  allSectionsReport,
  onlySection,
  buildFixtureComputed,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";

let computed: ReturnType<typeof buildFixtureComputed>;

beforeAll(() => {
  computed = buildFixtureComputed();
});

const baseParams = () => ({
  sections: { ...allSectionsReport },
  data: fixtureData,
  ir: computed.ir,
  ifi: computed.ifi,
  succession: computed.succession,
  irOptions: fixtureIrOptions,
  cabinet: fixtureCabinet,
  clientName: "Pierre Dupont",
  notes: "Note de référence du conseiller — fixture test.",
  logoSrc: "",
  hypothesisResults: fixtureHypothesisResults,
});

describe("pdfReport — snapshot complet (toutes sections actives)", () => {
  it("génère le HTML attendu avec toutes les sections", () => {
    const html = capturePdfHtml(() => buildAndPrintPdf(baseParams()));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfReport — snapshots section par section", () => {
  const sectionsKeys = [
    "cabinet", "famille", "travail", "bilan",
    "ir", "ifi", "succession", "hypos", "mentions",
  ] as const;

  for (const key of sectionsKeys) {
    it(`section seule : ${key}`, () => {
      const params = {
        ...baseParams(),
        sections: onlySection(allSectionsReport, key),
      };
      const html = capturePdfHtml(() => buildAndPrintPdf(params));
      expect(html).toMatchSnapshot();
    });
  }
});

describe("pdfReport — variantes structurelles", () => {
  it("aucune section sélectionnée → uniquement la cover", () => {
    const params = {
      ...baseParams(),
      sections: Object.fromEntries(
        Object.keys(allSectionsReport).map(k => [k, false])
      ) as Record<string, boolean>,
    };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfReport — repli Encre & Or (cabinet sans couleurs)", () => {
  it("cabinet sans aucune couleur définie → defaults Encre & Or appliqués", () => {
    const params = {
      ...baseParams(),
      cabinet: fixtureCabinetNoColors,
    };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfReport — sélecteur palette (pdfPalette = 'encre_or')", () => {
  it("cabinet avec couleurs + pdfPalette='encre_or' → choix utilisateur Encre & Or appliqué (les couleurs cabinet sont ignorées)", () => {
    const params = {
      ...baseParams(),
      cabinet: { ...fixtureCabinet, pdfPalette: "encre_or" },
    };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toMatchSnapshot();
  });
});
