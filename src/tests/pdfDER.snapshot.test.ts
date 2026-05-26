// ─── Lot 8b — Snapshots + assertions du DER (Document d'Entrée en Relation)
//
// Architecture « qui peut le plus qui peut le moins » :
//   • Fixture COA seul (fixtureCabinet) → sous-ensemble (assurances/DDA, pas
//     de volet AMF/CIF, pas d'association).
//   • Fixture CIF coché (fixtureCabinetCifCoche) → sur-ensemble : volet CIF +
//     AMF + association s'allument AUTOMATIQUEMENT sans modifier pdfDER.ts.
//
// 2 snapshots (un par fixture) + ~15 assertions toContain pour figer les
// invariants conformité. Aucune régénération des snapshots existants attendue
// (le DER est un document neuf, indépendant).

import { describe, it, expect } from "vitest";
import { buildAndPrintDER } from "../lib/pdf/pdfDER";
import {
  fixtureCabinet,
  fixtureCabinetCifCoche,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";

// ─── Snapshot complet COA seul ───────────────────────────────────────────────
describe("pdfDER — snapshot COA seul (fixture par défaut David)", () => {
  it("génère le DER avec sous-ensemble assurances (pas de volet AMF/CIF)", () => {
    const html = capturePdfHtml(() =>
      buildAndPrintDER({ cabinet: fixtureCabinet, clientName: "Pierre Dupont" })
    );
    expect(html).toMatchSnapshot();
  });
});

// ─── Snapshot complet CIF coché ─────────────────────────────────────────────
describe("pdfDER — snapshot CIF coché (allumage du sur-ensemble)", () => {
  it("génère le DER avec volet AMF + association + référence MIF II", () => {
    const html = capturePdfHtml(() =>
      buildAndPrintDER({ cabinet: fixtureCabinetCifCoche, clientName: "Pierre Dupont" })
    );
    expect(html).toMatchSnapshot();
  });
});

// ─── Invariants COA seul ─────────────────────────────────────────────────────
describe("pdfDER — invariants COA seul (sous-ensemble)", () => {
  const html = () => capturePdfHtml(() =>
    buildAndPrintDER({ cabinet: fixtureCabinet, clientName: "Pierre Dupont" })
  );

  it("contient l'identité du cabinet et l'ORIAS", () => {
    const h = html();
    expect(h).toContain("EcoPatrimoine Conseil");
    expect(h).toContain("25006907");  // ORIAS David
    expect(h).toContain("www.orias.fr");
  });

  it("affiche le statut Courtier en assurance (COA)", () => {
    expect(html()).toContain("Courtier en assurance (COA)");
  });

  it("cite l'ACPR avec son adresse vérifiée", () => {
    const h = html();
    expect(h).toContain("ACPR");
    expect(h).toContain("4 place de Budapest");
  });

  it("ne cite ni AMF, ni MIF II, ni RG AMF, ni L.541-1 (CIF éteint)", () => {
    const h = html();
    expect(h).not.toContain("AMF");
    expect(h).not.toContain("MIF II");
    expect(h).not.toContain("RG AMF");
    expect(h).not.toContain("L.541-1");
  });

  it("ne contient ni section 'Volet CIF', ni mention 'Lettre de mission CIF'", () => {
    const h = html();
    expect(h).not.toContain("Volet CIF");
    expect(h).not.toContain("Lettre de mission CIF à venir");
  });

  it("ne cite aucune association CIF (ANACOFI ou autre)", () => {
    const h = html();
    expect(h).not.toContain("ANACOFI");
    expect(h).not.toContain("Association professionnelle CIF");
  });

  it("le cadre réglementaire affiché est DDA (pas MIF II)", () => {
    const h = html();
    expect(h).toContain("obligations DDA");
    expect(h).not.toContain("obligations MIF II");
  });

  it("contient le pied 'Portée du document — Ploutos (Ecopatrimoine)'", () => {
    expect(html()).toContain("Portée du document — Ploutos (Ecopatrimoine)");
  });

  it("contient le bloc 'Références légales applicables — calculées d'après les statuts'", () => {
    const h = html();
    expect(h).toContain("Références légales applicables");
    expect(h).toContain("L.511-1 et s.");
    expect(h).toContain("L.521-x");
    expect(h).toMatch(/L\.521-x[^]*à confirmer/i);
  });
});

// ─── Invariants CIF coché (sur-ensemble allumé automatiquement) ────────────
describe("pdfDER — invariants CIF coché (sur-ensemble allumé)", () => {
  const html = () => capturePdfHtml(() =>
    buildAndPrintDER({ cabinet: fixtureCabinetCifCoche, clientName: "Pierre Dupont" })
  );

  it("allume le statut Conseiller en investissements financiers (CIF)", () => {
    expect(html()).toContain("Conseiller en investissements financiers (CIF)");
  });

  it("allume l'AMF (17 place de la Bourse) comme autorité de tutelle", () => {
    const h = html();
    expect(h).toContain("AMF");
    expect(h).toContain("17 place de la Bourse");
  });

  it("affiche l'association CIF renseignée (ANACOFI-CIF)", () => {
    expect(html()).toContain("ANACOFI-CIF");
  });

  it("allume le volet CIF avec rémunération + mention 'Lettre de mission CIF à venir'", () => {
    const h = html();
    expect(h).toContain("Volet CIF");
    expect(h).toContain("Lettre de mission CIF à venir");
  });

  it("le bloc références allume RG AMF (avec 'à confirmer') et MIF II + L.541-1 et s.", () => {
    const h = html();
    expect(h).toContain("L.541-1 et s.");
    expect(h).toContain("RG AMF");
    expect(h).toMatch(/RG AMF[^]*à confirmer/i);
    expect(h).toContain("MIF II");
  });

  it("le cadre réglementaire affiché passe à 'MIF II + DDA'", () => {
    expect(html()).toContain("obligations MIF II + DDA");
  });

  it("conserve les références COA (le sur-ensemble n'efface pas le sous-ensemble)", () => {
    const h = html();
    expect(h).toContain("L.511-1 et s.");
    expect(h).toContain("Courtier en assurance (COA)");
    expect(h).toContain("ACPR");
  });

  it("affiche le Médiateur de l'AMF comme recours additionnel pour le volet CIF", () => {
    expect(html()).toContain("Médiateur de l'AMF");
  });
});

// ─── Garde-fou conformité (les deux fixtures) ─────────────────────────────
describe("pdfDER — garde-fou conformité : aucun produit / aucun assureur nommé", () => {
  it("ni la version COA seul ni la version CIF coché ne citent un produit ou un assureur", () => {
    const htmlCoa = capturePdfHtml(() => buildAndPrintDER({ cabinet: fixtureCabinet, clientName: "Pierre Dupont" }));
    const htmlCif = capturePdfHtml(() => buildAndPrintDER({ cabinet: fixtureCabinetCifCoche, clientName: "Pierre Dupont" }));
    const interdits = /\b(predica|generali|axa|allianz|swisslife|spirica|cardif|nortia|primonial|amundi)\b/i;
    expect(htmlCoa.match(interdits)).toBeNull();
    expect(htmlCif.match(interdits)).toBeNull();
  });
});

// ─── Mentions « à confirmer » pour les champs cabinet vides ─────────────────
describe("pdfDER — marqueurs 'à confirmer' pour les champs cabinet vides (cabinet partiel)", () => {
  it("cabinet sans SIREN/capital affiche 'à confirmer' (jamais inventé)", () => {
    const cabinetPartiel: Record<string, any> = {
      cabinetName: "Test cabinet",
      statutCoa: true,
      // siren / capital / mediateur / associationCif absents
    };
    const html = capturePdfHtml(() =>
      buildAndPrintDER({ cabinet: cabinetPartiel, clientName: "Test client" })
    );
    expect(html).toContain("à confirmer");
    expect(html).not.toMatch(/SIREN[^]*\d{9}/);  // pas de SIREN inventé
  });
});
