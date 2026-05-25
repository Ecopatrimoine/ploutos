// ─── Snapshots HTML — pdfReport (Lot 0, filet refacto) ──────────────────────
// Fige le rendu actuel pour permettre une refacto sans régression silencieuse.

import { describe, it, expect, beforeAll } from "vitest";
import { buildAndPrintPdf } from "../lib/pdf/pdfReport";
import {
  fixtureData,
  fixtureDataCohab,
  fixtureIrOptions,
  fixtureCabinet,
  fixtureCabinetNoColors,
  fixtureHypothesisResults,
  allSectionsReport,
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

// ─── Lot 3 — recipient (mode destinataire) ───────────────────────────────────
describe("pdfReport — recipient (mode destinataire)", () => {
  it("recipient='person1' sur couple → cover sans sous-titre conjoint, en-tête person1", () => {
    const params = { ...baseParams(), recipient: "person1" as const };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toMatchSnapshot();
  });

  it("recipient='person2' sur couple → cover person2, en-tête person2", () => {
    const params = { ...baseParams(), recipient: "person2" as const };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toMatchSnapshot();
  });

  it("recipient='couple' explicite → identique au défaut (preuve tautologique du défaut couple sur married)", () => {
    const defaultHtml = capturePdfHtml(() => buildAndPrintPdf(baseParams()));
    const coupleHtml  = capturePdfHtml(() => buildAndPrintPdf({ ...baseParams(), recipient: "couple" as const }));
    expect(coupleHtml).toBe(defaultHtml);
  });
});

// ─── Lot 3 — preuve mécanique : IR/IFI ignorent recipient ────────────────────
// La SECTION IR (resp. IFI) doit rendre à l'identique quel que soit recipient.
// La différence éventuelle vient UNIQUEMENT de l'en-tête de page (recipient name),
// pas du corps fiscal. On extrait la page de section, on isole le corps (sans
// page-header) et on prouve l'invariance stricte.

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

// Retire le bloc page-header (qui contient recipientName) pour isoler le corps.
// pH produit : <div class="page-header"><div class="page-header-title">...</div><div class="page-header-client">...</div></div>
// → on match le wrapper complet jusqu'à son </div></div> fermant.
function stripPageHeader(section: string): string {
  return section.replace(/<div class="page-header">[\s\S]*?<\/div><\/div>\s*/, "");
}

describe("pdfReport — IR/IFI invariants par rapport à recipient", () => {
  const irOnly = () => ({ ...baseParams(), sections: onlySection(allSectionsReport, "ir") });
  const ifiOnly = () => ({ ...baseParams(), sections: onlySection(allSectionsReport, "ifi") });

  it("section IR : corps strictement identique pour recipient person1 / person2 / couple", () => {
    const sec1 = extractSectionPage(capturePdfHtml(() => buildAndPrintPdf({ ...irOnly(), recipient: "person1" })), "Impôt sur le Revenu");
    const sec2 = extractSectionPage(capturePdfHtml(() => buildAndPrintPdf({ ...irOnly(), recipient: "person2" })), "Impôt sur le Revenu");
    const secc = extractSectionPage(capturePdfHtml(() => buildAndPrintPdf({ ...irOnly(), recipient: "couple"  })), "Impôt sur le Revenu");
    // person1 et couple : même recipientName → page IR strictement identique.
    expect(sec1).toBe(secc);
    // person2 : page-header diffère (recipientName=person2), mais le CORPS reste identique.
    expect(stripPageHeader(sec1)).toBe(stripPageHeader(sec2));
    // Fige le corps de la section IR — toute dérive future déclenchera un diff.
    expect(stripPageHeader(sec1)).toMatchSnapshot();
  });

  it("section IFI : corps strictement identique pour recipient person1 / person2 / couple", () => {
    const sec1 = extractSectionPage(capturePdfHtml(() => buildAndPrintPdf({ ...ifiOnly(), recipient: "person1" })), "Impôt sur la Fortune Immobilière");
    const sec2 = extractSectionPage(capturePdfHtml(() => buildAndPrintPdf({ ...ifiOnly(), recipient: "person2" })), "Impôt sur la Fortune Immobilière");
    const secc = extractSectionPage(capturePdfHtml(() => buildAndPrintPdf({ ...ifiOnly(), recipient: "couple"  })), "Impôt sur la Fortune Immobilière");
    expect(sec1).toBe(secc);
    expect(stripPageHeader(sec1)).toBe(stripPageHeader(sec2));
    expect(stripPageHeader(sec1)).toMatchSnapshot();
  });
});

// ─── Lot 3 — garde-fou visuel concubin + heir conjoint ───────────────────────
describe("pdfReport — garde-fou visuel cohab + heir conjoint", () => {
  it("concubin + heir 'conjoint' dans succession.results → bandeau d'avertissement visible", () => {
    const cohabComputed = buildFixtureComputedCohab();
    const params = {
      sections: { ...allSectionsReport },
      data: fixtureDataCohab,
      ir: cohabComputed.ir,
      ifi: cohabComputed.ifi,
      succession: cohabComputed.succession,
      irOptions: fixtureIrOptions,
      cabinet: fixtureCabinet,
      clientName: "Pierre Dupont",
      notes: "Note de référence du conseiller — fixture test.",
      logoSrc: "",
      hypothesisResults: fixtureHypothesisResults,
    };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toContain("Vérification requise");
    expect(html).toMatchSnapshot();
  });
});
