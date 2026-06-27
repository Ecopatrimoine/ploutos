// ─── TEST DE RÈGLE — Page IFI : graphe « barème par tranche » (PUR AFFICHAGE) ─
//
// Chaîne exercée : fixture brute (forme computeIFI) → adapter buildIFIData →
// pageIFI. Assertions STRUCTURELLES sur le HTML (marqueurs data-*), pas de
// snapshot, pas d'égalité sur des chaînes euro (espaces fines fr-FR fragiles).
//
//   1. Le bloc barème est présent et rend EXACTEMENT 1 barre par tranche (6).
//   2. Les tranches à filled=0 sont rendues (trait fin) MAIS sans label montant ;
//      une tranche pleine à tax=0 (1re tranche à 0 %) n'a pas non plus de montant.
//   3. La note de réconciliation cite la décote quand decote>0, et indique
//      « aucune décote applicable » sinon.
//   4. Le bloc barème n'invente AUCUN plafonnement (75 %) — absent du moteur.
//
// La note « Notre lecture » est surchargée (texte neutre) pour isoler le bloc
// barème : l'encart par défaut de buildIFIData mentionne, lui, le plafonnement
// 75 % comme levier au-dessus du seuil — ce qui est hors périmètre de ce test.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { pageIFI } from "../lib/pdf/v2/pages/pageIFI";
import { buildIFIData } from "../lib/pdf/v2/adapters/buildIFIData";
import type { FilledBracket } from "../types/patrimoine";

const t = buildTokens("encreOr");

function compte(html: string, motif: RegExp): number {
  return (html.match(motif) || []).length;
}

// Rend la page IFI à partir d'une décomposition par tranche brute (notreLecture
// neutralisée pour ne pas polluer les assertions « plafonnement »).
function rendre(opts: {
  netTaxable: number;
  grossIfi: number;
  decote: number;
  ifi: number;
  bracketFill: FilledBracket[];
}): string {
  const d = buildIFIData({
    ifi: { netTaxable: opts.netTaxable, ifi: opts.ifi, grossIfi: opts.grossIfi, decote: opts.decote, bracketFill: opts.bracketFill, lines: [] },
    data: {},
    cabinet: { cabinetName: "Cabinet Test" },
    clientName: "Test",
    dateLettre: "25 mai 2026",
    notreLecture: "Lecture neutre pour le test, sans aucun levier evoque.",
  });
  return pageIFI(t, d);
}

// ── Fixture « chargée » : assiette 3 M€, au-dessus du seuil, décote=0 ──
// Tranches 1-4 pleines (la 1re à 0 %), 5-6 vides. Impôt par tranche : 2,3,4.
const fillCharge: FilledBracket[] = [
  { label: "0 %",   from: 0,          to: 800_000,    filled: 800_000,   tax: 0,    rate: 0 },
  { label: "0,5 %", from: 800_000,    to: 1_300_000,  filled: 500_000,   tax: 2_500, rate: 0.005 },
  { label: "0,7 %", from: 1_300_000,  to: 2_570_000,  filled: 1_270_000, tax: 8_890, rate: 0.007 },
  { label: "1 %",   from: 2_570_000,  to: 3_000_000,  filled: 430_000,   tax: 4_300, rate: 0.01 },
  { label: "1,3 %", from: 5_000_000,  to: 10_000_000, filled: 0,         tax: 0,    rate: 0.0125 },
  { label: "1,5 %", from: 10_000_000, to: 3_000_000,  filled: 0,         tax: 0,    rate: 0.015 }, // to ramené à la base (infini)
];

// ── Fixture « décote » : assiette 1,35 M€ (zone 1,3-1,4 M€) ──
const fillDecote: FilledBracket[] = [
  { label: "0 %",   from: 0,          to: 800_000,    filled: 800_000, tax: 0,     rate: 0 },
  { label: "0,5 %", from: 800_000,    to: 1_300_000,  filled: 500_000, tax: 2_500, rate: 0.005 },
  { label: "0,7 %", from: 1_300_000,  to: 1_350_000,  filled: 50_000,  tax: 350,   rate: 0.007 },
  { label: "1 %",   from: 2_570_000,  to: 5_000_000,  filled: 0,       tax: 0,     rate: 0.01 },
  { label: "1,3 %", from: 5_000_000,  to: 10_000_000, filled: 0,       tax: 0,     rate: 0.0125 },
  { label: "1,5 %", from: 10_000_000, to: 1_350_000,  filled: 0,       tax: 0,     rate: 0.015 },
];

describe("pageIFI — graphe barème par tranche", () => {
  it("(1) rend le bloc barème avec exactement 1 barre par tranche (6)", () => {
    const html = rendre({ netTaxable: 3_000_000, grossIfi: 15_690, decote: 0, ifi: 15_690, bracketFill: fillCharge });
    expect(html).toContain("data-bracket-chart");
    expect(html).toContain("Barème IFI");
    expect(compte(html, /data-bar="/g)).toBe(6);
    expect(compte(html, /data-bar="filled"/g)).toBe(4);
    expect(compte(html, /data-bar="empty"/g)).toBe(2);
  });

  it("(2) tranches filled=0 et tranche à tax=0 rendues SANS label de montant", () => {
    const html = rendre({ netTaxable: 3_000_000, grossIfi: 15_690, decote: 0, ifi: 15_690, bracketFill: fillCharge });
    // 3 tranches ont un impôt (>0) -> 3 labels montant ; la 1re (0 %) et les 2 vides -> aucun.
    expect(compte(html, /data-bar-amount/g)).toBe(3);
  });

  it("(3) note de réconciliation : cite la décote quand decote>0", () => {
    const html = rendre({ netTaxable: 1_350_000, grossIfi: 2_850, decote: 625, ifi: 2_225, bracketFill: fillDecote });
    expect(html).toContain("après décote");
    expect(html).not.toContain("aucune décote applicable");
  });

  it("(3b) note : indique l'absence de décote quand decote=0", () => {
    const html = rendre({ netTaxable: 3_000_000, grossIfi: 15_690, decote: 0, ifi: 15_690, bracketFill: fillCharge });
    expect(html).toContain("aucune décote applicable");
    expect(html).not.toContain("après décote");
  });

  it("(4) le bloc barème n'invente aucun plafonnement IFI (75 %)", () => {
    const html = rendre({ netTaxable: 3_000_000, grossIfi: 15_690, decote: 0, ifi: 15_690, bracketFill: fillCharge });
    expect(html).not.toMatch(/plafonnement/i);
    expect(html).not.toMatch(/75\s*%/);
  });

  it("(5) sous le seuil : barème rendu, aucune tranche n'affiche de montant (tax=0 partout)", () => {
    const fillSousSeuil: FilledBracket[] = [
      { label: "0 %",   from: 0,          to: 800_000,    filled: 588_400, tax: 0, rate: 0 },
      { label: "0,5 %", from: 800_000,    to: 1_300_000,  filled: 0,       tax: 0, rate: 0.005 },
      { label: "0,7 %", from: 1_300_000,  to: 2_570_000,  filled: 0,       tax: 0, rate: 0.007 },
      { label: "1 %",   from: 2_570_000,  to: 5_000_000,  filled: 0,       tax: 0, rate: 0.01 },
      { label: "1,3 %", from: 5_000_000,  to: 10_000_000, filled: 0,       tax: 0, rate: 0.0125 },
      { label: "1,5 %", from: 10_000_000, to: 588_400,    filled: 0,       tax: 0, rate: 0.015 },
    ];
    const html = rendre({ netTaxable: 588_400, grossIfi: 0, decote: 0, ifi: 0, bracketFill: fillSousSeuil });
    expect(html).toContain("data-bracket-chart");
    expect(compte(html, /data-bar="/g)).toBe(6);
    expect(compte(html, /data-bar-amount/g)).toBe(0);
  });
});
