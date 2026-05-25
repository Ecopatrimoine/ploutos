// ─── Snapshots HTML — pdfMission (Lot 0, filet refacto) ─────────────────────
// Fige le rendu actuel pour permettre une refacto sans régression silencieuse.

import { describe, it, expect, beforeAll } from "vitest";
import { buildAndPrintMission } from "../lib/pdf/pdfMission";
import {
  fixtureData,
  fixtureDataCohab,
  fixtureIrOptions,
  fixtureCabinet,
  fixtureCabinetNoColors,
  fixtureMission,
  allSectionsMission,
  onlySection,
  buildFixtureComputed,
  buildFixtureComputedCohab,
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

describe("pdfMission — sélecteur palette (pdfPalette = 'encre_or')", () => {
  it("cabinet avec couleurs + pdfPalette='encre_or' → choix utilisateur Encre & Or appliqué (les couleurs cabinet sont ignorées)", () => {
    const params = {
      ...baseParams(),
      cabinet: { ...fixtureCabinet, pdfPalette: "encre_or" },
    };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toMatchSnapshot();
  });
});

// ─── Lot 3 — recipient (mode destinataire) ───────────────────────────────────
describe("pdfMission — recipient (mode destinataire)", () => {
  it("recipient='person1' sur couple → cover sans sous-titre conjoint, en-tête person1", () => {
    const params = { ...baseParams(), recipient: "person1" as const };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toMatchSnapshot();
  });

  it("recipient='person2' sur couple → cover person2, en-tête person2", () => {
    const params = { ...baseParams(), recipient: "person2" as const };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toMatchSnapshot();
  });

  it("recipient='couple' explicite → identique au défaut (preuve tautologique du défaut couple sur married)", () => {
    const defaultHtml = capturePdfHtml(() => buildAndPrintMission(baseParams()));
    const coupleHtml  = capturePdfHtml(() => buildAndPrintMission({ ...baseParams(), recipient: "couple" as const }));
    expect(coupleHtml).toBe(defaultHtml);
  });
});

// ─── Lot 3 — preuve mécanique : IR/IFI ignorent recipient ────────────────────
function extractSectionPage(html: string, headerTitle: string): string {
  const marker = `<div class="page-header-title">${headerTitle}</div>`;
  const idx = html.indexOf(marker);
  if (idx === -1) return "<section-not-found>";
  const pageStart = html.lastIndexOf('<div class="page">', idx);
  const nextPage = html.indexOf('<div class="page">', idx + 1);
  const bodyEnd = html.indexOf('</body>', idx);
  const endIdx = (nextPage !== -1 && (bodyEnd === -1 || nextPage < bodyEnd))
    ? nextPage
    : (bodyEnd !== -1 ? bodyEnd : html.length);
  return html.substring(pageStart, endIdx);
}
function stripPageHeader(section: string): string {
  return section.replace(/<div class="page-header">[\s\S]*?<\/div><\/div>\s*/, "");
}

describe("pdfMission — IR/IFI invariants par rapport à recipient", () => {
  const irOnly = () => ({ ...baseParams(), sections: onlySection(allSectionsMission, "ir") });
  const ifiOnly = () => ({ ...baseParams(), sections: onlySection(allSectionsMission, "ifi") });

  it("section IR : corps strictement identique pour recipient person1 / person2 / couple", () => {
    const sec1 = extractSectionPage(capturePdfHtml(() => buildAndPrintMission({ ...irOnly(), recipient: "person1" })), "Impôt sur le Revenu");
    const sec2 = extractSectionPage(capturePdfHtml(() => buildAndPrintMission({ ...irOnly(), recipient: "person2" })), "Impôt sur le Revenu");
    const secc = extractSectionPage(capturePdfHtml(() => buildAndPrintMission({ ...irOnly(), recipient: "couple"  })), "Impôt sur le Revenu");
    expect(sec1).toBe(secc);
    expect(stripPageHeader(sec1)).toBe(stripPageHeader(sec2));
    expect(stripPageHeader(sec1)).toMatchSnapshot();
  });

  it("section IFI : corps strictement identique pour recipient person1 / person2 / couple", () => {
    const sec1 = extractSectionPage(capturePdfHtml(() => buildAndPrintMission({ ...ifiOnly(), recipient: "person1" })), "IFI");
    const sec2 = extractSectionPage(capturePdfHtml(() => buildAndPrintMission({ ...ifiOnly(), recipient: "person2" })), "IFI");
    const secc = extractSectionPage(capturePdfHtml(() => buildAndPrintMission({ ...ifiOnly(), recipient: "couple"  })), "IFI");
    expect(sec1).toBe(secc);
    expect(stripPageHeader(sec1)).toBe(stripPageHeader(sec2));
    expect(stripPageHeader(sec1)).toMatchSnapshot();
  });
});

// ─── Lot 3 — garde-fou visuel concubin + heir conjoint ───────────────────────
describe("pdfMission — garde-fou visuel cohab + heir conjoint", () => {
  it("concubin + heir 'conjoint' dans succession.results → bandeau d'avertissement visible", () => {
    const cohabComputed = buildFixtureComputedCohab();
    const params = {
      sections: { ...allSectionsMission },
      data: fixtureDataCohab,
      ir: cohabComputed.ir,
      ifi: cohabComputed.ifi,
      succession: cohabComputed.succession,
      irOptions: fixtureIrOptions,
      cabinet: fixtureCabinet,
      clientName: "Pierre Dupont",
      logoSrc: "",
      signatureSrc: "",
      mission: fixtureMission,
    };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toContain("Vérification requise");
    expect(html).toMatchSnapshot();
  });
});
