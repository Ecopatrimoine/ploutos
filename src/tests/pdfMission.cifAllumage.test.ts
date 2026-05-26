// ─── Lot 8a — Preuve d'allumage du sur-ensemble CIF dans la lettre de mission
//
// Principe « qui peut le plus qui peut le moins » : tous les documents sont
// pilotés par les interrupteurs de statut (Lot 5). Aujourd'hui, David n'a que
// le statut COA — donc le PDF par défaut NE doit PAS citer le RG AMF, MIF II,
// ni l'article L.541-1 et s. Demain, si CIF est coché dans Paramètres, ces
// références s'allument AUTOMATIQUEMENT (sans modification de pdfMission.ts).
//
// Ce test utilise la fixture additionnelle `fixtureCabinetCifCoche` pour
// vérifier l'allumage par assertions `toContain` — pas de snapshot dédié
// pour rester léger (le snapshot par défaut couvre déjà le rendu COA seul).

import { describe, it, expect, beforeAll } from "vitest";
import { buildAndPrintMission } from "../lib/pdf/pdfMission";
import {
  fixtureData,
  fixtureIrOptions,
  fixtureCabinet,
  fixtureCabinetCifCoche,
  fixtureMission,
  allSectionsMission,
  onlySection,
  buildFixtureComputed,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";

let computed: ReturnType<typeof buildFixtureComputed>;
beforeAll(() => { computed = buildFixtureComputed(); });

const baseParams = (cabinet: typeof fixtureCabinet) => ({
  sections: { ...allSectionsMission },
  data: fixtureData,
  ir: computed.ir,
  ifi: computed.ifi,
  succession: computed.succession,
  irOptions: fixtureIrOptions,
  cabinet,
  clientName: "Pierre Dupont",
  logoSrc: "",
  signatureSrc: "",
  mission: fixtureMission,
});

describe("Lot 8a — Lettre de mission : COA seul (par défaut)", () => {
  const html = (() => capturePdfHtml(() => buildAndPrintMission(baseParams(fixtureCabinet))));

  it("contient les références du Code des assurances (COA)", () => {
    expect(html()).toContain("L.511-1 et s.");
    expect(html()).toContain("L.521-1 et s.");
    expect(html()).toContain("L.522-1 et s.");
  });

  it("ne contient PLUS de mention 'à confirmer' sur les articles L.521/L.522 (refacto wording)", () => {
    expect(html()).not.toMatch(/L\.521[^]{0,80}à confirmer/i);
  });

  it("affiche 'Courtier en assurance (COA)' dans les statuts ORIAS", () => {
    expect(html()).toContain("Courtier en assurance (COA)");
  });

  it("NE contient PAS RG AMF, MIF II, L.541-1 et s. (CIF éteint)", () => {
    const h = html();
    expect(h).not.toContain("RG AMF");
    expect(h).not.toContain("MIF II");
    expect(h).not.toContain("L.541-1 et s.");
  });

  it("le cadre réglementaire affiché est 'DDA' (pas 'MIF II + DDA')", () => {
    const h = html();
    expect(h).toContain("obligations DDA");
    expect(h).not.toContain("obligations MIF II");
    expect(h).not.toContain("obligations MIF2");
  });
});

describe("Lot 8a — Lettre de mission : CIF coché (sur-ensemble allumé automatiquement)", () => {
  const html = (() => capturePdfHtml(() => buildAndPrintMission(baseParams(fixtureCabinetCifCoche))));

  it("allume le bloc CIF : L.541-1 et s.", () => {
    expect(html()).toContain("L.541-1 et s.");
  });

  it("allume RG AMF avec mention 'Livre III' (refacto wording, plus de 'à confirmer')", () => {
    const h = html();
    expect(h).toContain("RG AMF");
    expect(h).toContain("Livre III");
  });

  it("allume MIF II dans le bloc références (sans inventer un numéro d'article)", () => {
    expect(html()).toContain("MIF II");
  });

  it("affiche le statut 'Conseiller en investissements financiers (CIF)' dans les statuts ORIAS", () => {
    expect(html()).toContain("Conseiller en investissements financiers (CIF)");
  });

  it("affiche l'AMF comme autorité de tutelle pour le volet CIF", () => {
    expect(html()).toContain("AMF");
    expect(html()).toContain("17 place de la Bourse");
  });

  it("affiche l'association CIF de rattachement renseignée", () => {
    expect(html()).toContain("ANACOFI-CIF");
  });

  it("le cadre réglementaire affiché passe à 'MIF II + DDA' (sur-ensemble)", () => {
    expect(html()).toContain("obligations MIF II + DDA");
  });

  it("conserve les références COA (le sur-ensemble n'efface pas le sous-ensemble)", () => {
    const h = html();
    expect(h).toContain("L.511-1 et s.");
    expect(h).toContain("L.521-1 et s.");
  });
});

describe("Lot 8a — Garde-fou conformité : aucun produit / aucun assureur nommé", () => {
  it("ni la version COA seul ni la version CIF coché ne citent un produit ou un assureur", () => {
    const htmlCoa = capturePdfHtml(() => buildAndPrintMission(baseParams(fixtureCabinet)));
    const htmlCif = capturePdfHtml(() => buildAndPrintMission(baseParams(fixtureCabinetCifCoche)));
    const interdits = /\b(predica|generali|axa|allianz|swisslife|spirica|cardif|nortia|primonial|amundi)\b/i;
    expect(htmlCoa.match(interdits)).toBeNull();
    expect(htmlCif.match(interdits)).toBeNull();
  });
});

describe("Lot 8a — Section legal : section seule (vérification de la composition)", () => {
  it("section legal contient le bloc Références légales applicables", () => {
    const params = { ...baseParams(fixtureCabinet), sections: onlySection(allSectionsMission, "legal") };
    const html = capturePdfHtml(() => buildAndPrintMission(params));
    expect(html).toContain("Références légales applicables");
    expect(html).toContain("Portée du document — Ploutos");
  });
});
