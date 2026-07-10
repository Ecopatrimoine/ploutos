// LOT 11 G3 — Noms des chiffres-rois IR / IFI alignés sur l'écran 10b (TabIR / TabIFI).
import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { euro } from "../lib/pdf/v2/primitives";
import { pageIR, type IRPageData } from "../lib/pdf/v2/pages/pageIR";
import { pageIFI } from "../lib/pdf/v2/pages/pageIFI";
import { buildIFIData } from "../lib/pdf/v2/adapters/buildIFIData";
import { buildIfiRoiCard } from "../lib/analysis/ifiPresentation";
import { computePatrimoineNet } from "../lib/calculs/patrimoine";
import { pct } from "../lib/calculs/utils";

const t = buildTokens("encreOr");

const dIR: IRPageData = {
  clientName: "TEST", dateStr: "10 juillet 2026",
  impotNetDu: 71_636, trancheMarginale: "30,0 %", tmiAffichee: "41,0 %", tauxMoyen: "27,1 %", quotient: "4 parts",
  bracketFill: [], quotientParPart: 66_072, parts: 4, marginalRate: 0.3,
  salaires: 270_000, fonciers: 16_000, mobiliers: 0, pensionsAutres: 0,
  revenusBruts: 286_000, abattement10pct: 27_000, revenuNetImposable: 264_288,
  notreLecture: "…", pagePosition: "2 / 8", cabinetLibellePied: "Cabinet · Fiscalité — confidentiel",
};

describe("IR — chiffres-rois nommés comme l'écran 10b", () => {
  it("« Impôt total du foyer », « TMI », « Revenu net global » + « N parts » ; anciens libellés absents", () => {
    const html = pageIR(t, dIR);
    expect(html).toContain("Impôt total du foyer");
    expect(html).toContain(">TMI<");
    expect(html).toContain("Revenu net global");
    expect(html).toContain(euro(264_288)); // valeur = revenu net global (pas le nb de parts)
    expect(html).toContain("4 parts");      // sous-titre via plur()
    expect(html).not.toContain("IMPÔT NET DÛ");
    expect(html).not.toContain("TRANCHE MARG.");
    expect(html).not.toContain(">QUOTIENT<");
  });
});

describe("IFI — libellés écran + tuiles Tranche marginale / Taux moyen IFI", () => {
  const ifi = {
    netTaxable: 2_842_210, ifi: 14_112, grossIfi: 14_112, decote: 0,
    bracketFill: [
      { to: 800_000, rate: 0 }, { to: 1_300_000, rate: 0.005 }, { to: 2_570_000, rate: 0.007 },
      { to: 5_000_000, rate: 0.01 }, { to: 10_000_000, rate: 0.0125 }, { to: Infinity, rate: 0.015 },
    ],
    lines: [{ name: "Bien", grossValue: 2_842_210, taxableNet: 2_842_210 }],
  };
  const data = { person1FirstName: "A", person1LastName: "B" };
  const cabinet = { cabinetName: "Cabinet" };

  it("adapter : tranche marginale + taux moyen via buildIfiRoiCard (÷ patrimoine total, repli actif net taxable, garde-fou)", () => {
    // Dossier RICHE : patrimoine total net > actif net taxable → le taux moyen doit diviser par
    // le patrimoine total (décision David), pas par l'actif net taxable.
    const dataRiche = { ...data, properties: [{ type: "autre", value: 4_000_000, loanRemaining: 0 }] };
    const patrimoineNet = computePatrimoineNet(dataRiche).patrimoineNet;
    expect(patrimoineNet).toBeGreaterThan(ifi.netTaxable); // le total dépasse l'assiette IFI
    const d = buildIFIData({ ifi, data: dataRiche, cabinet });
    const roi = buildIfiRoiCard(ifi, { patrimoineNet });
    expect(d.trancheMarginaleIFI).toBe(pct(roi.marginalRate, 2));    // 1 % (tranche 2,57–5 M€)
    expect(d.tauxMoyenIFI).toBe(pct(roi.tauxMoyen, 2));              // ÷ patrimoine total, 2 décimales (écran)
    expect(d.tauxMoyenIFI).not.toBe(pct(buildIfiRoiCard(ifi).tauxMoyen, 2)); // ≠ ÷ actif net taxable
    // Garde-fou : dénominateur ≤ 0 → « — » (aucun actif, aucun patrimoine).
    const dVide = buildIFIData({ ifi: { netTaxable: 0, ifi: 0, bracketFill: [] }, data, cabinet });
    expect(dVide.tauxMoyenIFI).toBe("—");
  });

  it("page : « Actif net taxable » (partout), « Seuil d'imposition », 2 nouvelles tuiles ; anciens absents", () => {
    const html = pageIFI(t, buildIFIData({ ifi, data, cabinet }));
    expect(html).toContain("Actif net taxable");
    expect(html).toContain("Actif net taxable face au seuil d'imposition"); // sous-titre jauge
    expect(html).toContain("Seuil d'imposition");
    expect(html).toContain("Tranche marginale");
    expect(html).toContain("Taux moyen IFI");
    expect(html).not.toContain("Assiette IFI nette");
    expect(html).not.toContain("Assiette immobilière nette");
    expect(html).not.toContain("Seuil d'assujettissement");
  });
});
