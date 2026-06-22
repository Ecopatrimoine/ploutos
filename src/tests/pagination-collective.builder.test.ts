// Lot pagination collective — tests BUILDER de pagePrevoyanceColl :
//  - fusion (contenu court) -> 1 feuille ; CCN lourde -> 2 feuilles ; inactif -> 1.
//  - DDA exactement une fois, en bande ancree (bottom:42px) sur la derniere feuille.
//  - chemin 2-feuilles : marqueur de centrage (entretoise region flex 1:2) present
//    sur la feuille 1, ABSENT de la feuille 2.
//  - aucun contenu perdu : tous les libelles de controles + tous les garantieLabel
//    presents (fusion ET 2-feuilles).
//
// Dossiers SYNTHETIQUES (counts deterministes) pour piloter exactement la decision
// de fusion ; le rendu visuel reel est validee a part (validation David).

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { pagePrevoyanceColl, type PrevoyanceCollPageData } from "../lib/pdf/v2/pages/pagePrevoyanceColl";
import type { ControleConformite } from "../lib/prevoyance/types";
import type { VueObligationsFusionnee } from "../lib/prevoyance/comparaison-branche-vue";

const t = buildTokens("encreOr");

function ctrl(i: number): ControleConformite {
  return { id: `c${i}`, libelle: `Controle numero ${i}`, statut: "conforme", reference: `art. ${i}` } as unknown as ControleConformite;
}

function ligneObl(i: number) {
  return {
    garantie: `g${i}`,
    garantieLabel: `Garantie numero ${i}`,
    estReference: false,
    obligation: { commun: `Obl ${i}` },
    souscrit: null,
    verdict: null,
    verdictLabel: null,
    motif: null,
  };
}

function vue(nbLignes: number, opts: { synthese?: boolean } = {}): VueObligationsFusionnee {
  return {
    statutLabel: "CCN de test",
    afficherComparaison: !!opts.synthese,
    afficherAvertissementIncomplet: false,
    lignes: Array.from({ length: nbLignes }, (_, i) => ligneObl(i + 1)),
    nonPrevues: [],
    synthese: opts.synthese ? { conformes: 1, insuffisants: 0, aEtudier: 0 } : null,
    idcc: "1486",
    nomCCN: "CCN Test",
  } as unknown as VueObligationsFusionnee;
}

function dColl(over: Partial<PrevoyanceCollPageData>): PrevoyanceCollPageData {
  return {
    active: true,
    clientName: "Client Test",
    dateStr: "21 juin 2026",
    sousTitre: "Dirigeant analyse",
    scoreGlobal: "67 %",
    effectifLibelle: "10 salaries",
    entrepriseLibelle: "SARL TEST",
    ccnLibelle: "IDCC 1486",
    controles: [],
    champApplicationCCN: null,
    vueObligations: null,
    mentionDDA: "Document non contractuel — art. L.521-4 du Code des assurances.",
    pagePosition: "3 / 12",
    cabinetLibellePied: "Cabinet — confidentiel",
    ...over,
  };
}

const CONVENTION_LONGUE = "X".repeat(600);
const nbFeuilles = (html: string) => html.split("width:210mm;height:297mm").length - 1;
const nbOcc = (html: string, s: string) => html.split(s).length - 1;

describe("pagePrevoyanceColl — pagination adaptative (builder)", () => {
  it("contenu court -> FUSION en 1 feuille pleine (pas de centrage), DDA en pied, rien perdu", () => {
    const d = dColl({ controles: [ctrl(1), ctrl(2)], vueObligations: vue(2) });
    const html = pagePrevoyanceColl(t, d);
    expect(nbFeuilles(html)).toBe(1);
    // pas de region de centrage sur la feuille fusionnee (feuille PLEINE)
    expect(html).not.toContain("flex:1 1 0");
    // DDA exactement une fois, ancree bottom:42px, et apres le contenu
    expect(nbOcc(html, "L.521-4")).toBe(1);
    expect(html).toContain("bottom:42px");
    expect(html.indexOf("L.521-4")).toBeGreaterThan(html.indexOf("bottom:42px"));
    // aucun contenu perdu
    expect(html).toContain("Controle numero 1");
    expect(html).toContain("Controle numero 2");
    expect(html).toContain("Garantie numero 1");
    expect(html).toContain("Garantie numero 2");
  });

  it("CCN lourde -> 2 feuilles : feuille 1 audit CENTRE, feuille 2 obligations + DDA, rien perdu", () => {
    const d = dColl({
      controles: Array.from({ length: 12 }, (_, i) => ctrl(i + 1)),
      champApplicationCCN: CONVENTION_LONGUE,
      vueObligations: vue(16, { synthese: true }),
    });
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    expect(feuilles.length).toBe(2);
    const [f1, f2] = feuilles;
    // centrage : la region (entretoises flex 1:2) est sur la feuille 1, pas la feuille 2
    expect(f1).toContain("flex:1 1 0");
    expect(f2).not.toContain("flex:1 1 0");
    expect(f1).toContain("Audit de conformité");
    // DDA exactement une fois, sur la DERNIERE feuille, ancree bottom:42px
    expect(nbOcc(html, "L.521-4")).toBe(1);
    expect(f1).not.toContain("L.521-4");
    expect(f2).toContain("bottom:42px");
    expect(f2.indexOf("L.521-4")).toBeGreaterThan(f2.indexOf("bottom:42px"));
    // aucun contenu perdu : 12 controles (feuille 1) + 16 garanties (feuille 2)
    for (let i = 1; i <= 12; i++) expect(html).toContain(`Controle numero ${i}`);
    for (let i = 1; i <= 16; i++) expect(html).toContain(`Garantie numero ${i}`);
  });

  it("module inactif -> 1 feuille : message centre, DDA en pied, pas d'audit", () => {
    const d = dColl({ active: false });
    const html = pagePrevoyanceColl(t, d);
    expect(nbFeuilles(html)).toBe(1);
    expect(html).toContain("Activer le module Prévoyance collective");
    expect(html).toContain("flex:1 1 0");          // message centre (region)
    expect(html).not.toContain("Audit de conformité");
    expect(nbOcc(html, "L.521-4")).toBe(1);
    expect(html).toContain("bottom:42px");
    expect(html.indexOf("L.521-4")).toBeGreaterThan(html.indexOf("bottom:42px"));
  });
});
