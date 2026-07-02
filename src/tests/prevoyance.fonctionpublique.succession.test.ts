// ─── LOT C (Fonction publique) — integration capital deces -> succession + PDF ─
//
// Verifie qu'un dossier fonctionnaire (caisse FONCTION_PUBLIQUE) voit son capital
// deces statutaire remonter par le chemin EXISTANT (succession.ts:1240,
// resolveCapitauxDeces) dans le resultat succession ET dans les donnees PDF
// capitaux deces. Aucun second chemin. Dossier = fixture 'fonctionnaire-type'
// (source unique, LOT D.3).

import { describe, it, expect } from "vitest";
import { computeSuccession } from "../lib/calculs/succession";
import { buildCapitauxDecesData } from "../lib/pdf/v2/adapters/buildCapitauxDecesData";
import {
  dossierFonctionnaireTypeData,
  dossierFonctionnaireTypeSuccession,
  CAPITAL_DECES_ATTENDU,
} from "./__fixtures__/dossierFonctionnaireType";

describe("Integration Fonction publique — capital deces remonte (succession + PDF)", () => {
  it("succession : capital = un an de remuneration + majoration enfants (41768,66), exonere", () => {
    const s = computeSuccession(dossierFonctionnaireTypeSuccession(), dossierFonctionnaireTypeData());
    expect(s.capitalDecesLines.caisses).toHaveLength(1);
    const line = s.capitalDecesLines.caisses[0];
    expect(line.capital).toBeCloseTo(CAPITAL_DECES_ATTENDU, 2); // 40000 x 1.00 + 2 x 884,33
    expect(line.exonere).toBe(true);
    expect(s.capitalDecesCaisseExonere).toBeCloseTo(CAPITAL_DECES_ATTENDU, 2);
  });

  it("PDF capitaux deces : le meme capital est expose dans les donnees d'adaptateur", () => {
    const s = computeSuccession(dossierFonctionnaireTypeSuccession(), dossierFonctionnaireTypeData());
    const pdf = buildCapitauxDecesData({ succession: s, data: dossierFonctionnaireTypeData(), cabinet: {} });
    expect(pdf.caisses).toHaveLength(1);
    expect(pdf.caisses[0].capital).toBeCloseTo(CAPITAL_DECES_ATTENDU, 2);
  });
});
