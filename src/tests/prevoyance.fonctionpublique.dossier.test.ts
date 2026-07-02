// ─── LOT D.3 (Fonction publique) — dossier 'fonctionnaire-type' bout en bout ─
//
// Passe le dossier de reference (fixture versionnee) par toute la chaine :
//   mapping (buildEntreePerso) -> projection (IJ statutaire 90/50, aucun maintien
//   employeur prive) -> succession (capital deces statutaire) -> PDF (page perso
//   avec SVG + adaptateur capitaux deces). Verrou de non-regression de l'ensemble
//   des lots 0->D sur un seul foyer realiste.

import { describe, it, expect } from "vitest";
import { buildEntreePerso } from "../lib/prevoyance/mapping";
import { projeterArretMaladie, computeIJObligatoireJournaliere } from "../lib/prevoyance/projection";
import { buildPlafondVariables } from "../lib/prevoyance/formula";
import { computeSuccession } from "../lib/calculs/succession";
import { buildCapitauxDecesData } from "../lib/pdf/v2/adapters/buildCapitauxDecesData";
import { buildPrevoyancePersoData } from "../lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { pagePrevoyancePerso } from "../lib/pdf/v2/pages/pagePrevoyancePerso";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { referentiels } from "../data/prevoyance";
import {
  dossierFonctionnaireTypeData,
  dossierFonctionnaireTypeSuccession,
  REVENU_FONCTIONNAIRE,
  CAPITAL_DECES_ATTENDU,
} from "./__fixtures__/dossierFonctionnaireType";

const vars = buildPlafondVariables(referentiels);
const FP = (referentiels.caisses as any).caisses.FONCTION_PUBLIQUE;
const cabinet = { cabinetName: "EcoPatrimoine Conseil", orias: "25006907" };
const jour1_90 = (REVENU_FONCTIONNAIRE / 365) * 0.9;

describe("Dossier fonctionnaire-type — chaine complete (mapping -> projection -> succession -> PDF)", () => {
  it("mapping : buildEntreePerso route vers FONCTION_PUBLIQUE avec l'assiette declaree", () => {
    const e = buildEntreePerso(dossierFonctionnaireTypeData(), "p1")!;
    expect(e).not.toBeNull();
    expect(e.statutPro).toBe("fonctionnaire");
    expect(e.caisse).toBe("FONCTION_PUBLIQUE");
    expect(e.salaireBrutAnnuel).toBe(REVENU_FONCTIONNAIRE);
  });

  it("projection : IJ statutaire 90 % a J1 et AUCUN maintien employeur prive", () => {
    const e = buildEntreePerso(dossierFonctionnaireTypeData(), "p1")!;
    expect(computeIJObligatoireJournaliere(1, FP, e, vars)).toBeCloseTo(jour1_90, 6);
    const r = projeterArretMaladie(e, "cat2", referentiels);
    expect(r.series.maintienEmployeur.every((v) => v === 0)).toBe(true);
    expect(r.series.ijObligatoire.reduce((a, v) => a + v, 0)).toBeGreaterThan(0);
  });

  it("succession : capital deces statutaire remonte (exonere, code FONCTION_PUBLIQUE)", () => {
    const s = computeSuccession(dossierFonctionnaireTypeSuccession(), dossierFonctionnaireTypeData());
    expect(s.capitalDecesLines.caisses).toHaveLength(1);
    const line = s.capitalDecesLines.caisses[0];
    expect(line.capital).toBeCloseTo(CAPITAL_DECES_ATTENDU, 2);
    expect(line.exonere).toBe(true);
    expect(line.caisseCode).toBe("FONCTION_PUBLIQUE");
  });

  it("PDF : page perso avec SVG + adaptateur capitaux deces expose le meme capital", () => {
    const data = dossierFonctionnaireTypeData();
    const s = computeSuccession(dossierFonctionnaireTypeSuccession(), data);
    const persoData = buildPrevoyancePersoData({ data, cabinet, which: "p1", dateLettre: "2 juillet 2026" });
    expect(persoData.disponible).toBe(true);
    const html = pagePrevoyancePerso(buildTokens("encreOr"), persoData);
    expect(html).toContain("<svg");
    const pdf = buildCapitauxDecesData({ succession: s, data, cabinet: {} });
    expect(pdf.caisses[0].capital).toBeCloseTo(CAPITAL_DECES_ATTENDU, 2);
  });
});
