// ─── Snapshots HTML — pdfMission (Lot 0, filet refacto) ─────────────────────
// Fige le rendu actuel pour permettre une refacto sans régression silencieuse.

import { describe, it, expect, beforeAll } from "vitest";
import { buildAndPrintMission } from "../lib/pdf/pdfMission";
import {
  fixtureData,
  fixtureIrOptions,
  fixtureCabinet,
  fixtureCabinetNoColors,
  fixtureMission,
  allSectionsMission,
  onlySection,
  buildFixtureComputed,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";

let computed: ReturnType<typeof buildFixtureComputed>;

beforeAll(() => {
  computed = buildFixtureComputed();
});

const baseParams = () => ({
  sections: { ...allSectionsMission },
  data: fixtureData,
  ir: computed.ir,
  ifi: computed.ifi,
  succession: computed.succession,
  irOptions: fixtureIrOptions,
  cabinet: fixtureCabinet,
  clientName: "Pierre Dupont",
  logoSrc: "",
  signatureSrc: "",
  mission: fixtureMission,
});

describe("pdfMission — snapshot complet (toutes sections actives)", () => {
  it("génère le HTML attendu avec toutes les sections", () => {
    const html = capturePdfHtml(() => buildAndPrintMission(baseParams()));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfMission — snapshots section par section", () => {
  const sectionsKeys = [
    "legal", "famille", "travail", "besoins",
    "bilan", "ir", "ifi", "succession",
    "profil", "signature",
  ] as const;

  for (const key of sectionsKeys) {
    it(`section seule : ${key}`, () => {
      const params = {
        ...baseParams(),
        sections: onlySection(allSectionsMission, key),
      };
      const html = capturePdfHtml(() => buildAndPrintMission(params));
      expect(html).toMatchSnapshot();
    });
  }
});

describe("pdfMission — variantes structurelles", () => {
  it("aucune section sélectionnée → uniquement la cover", () => {
    const params = {
      ...baseParams(),
      sections: Object.fromEntries(
        Object.keys(allSectionsMission).map(k => [k, false])
      ) as Record<string, boolean>,
    };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfMission — repli Encre & Or (cabinet sans couleurs)", () => {
  it("cabinet sans aucune couleur définie → defaults Encre & Or appliqués", () => {
    const params = {
      ...baseParams(),
      cabinet: fixtureCabinetNoColors,
    };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toMatchSnapshot();
  });
});
