// Phase 3 — tests BUILDER de pagePrevoyanceColl (flux unique, contrat de page) :
//  - FLUX UNIQUE : un seul conteneur `pdf-contrat`, AUCUNE boite A4
//    (width:210mm;height:297mm), AUCUN slot signature absolu (bottom:42px),
//    AUCUNE region de centrage (flex:1 1 0). paged.js pagine seul.
//  - 2 tables ecoulables (audit + obligations) -> 2x `data-pdf-tbl`.
//  - DDA en QueueEpinglee (`pdf-queue`), exactement une fois, APRES le contenu.
//  - aucun contenu perdu : tous les libelles de controles + tous les garantieLabel.
//
// Dossiers SYNTHETIQUES (counts deterministes) ; le rendu visuel reel est valide
// a part (validation David).

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
// Plus aucune boite A4 ni slot absolu en flux contrat : ces compteurs doivent
// rester a zero / absents (sentinelle anti-regression du mecanisme).
const nbFeuilles = (html: string) => html.split("width:210mm;height:297mm").length - 1;
const nbOcc = (html: string, s: string) => html.split(s).length - 1;

describe("pagePrevoyanceColl — flux unique (builder)", () => {
  it("contenu court -> flux unique (pdf-contrat), 2 tables ecoulables, DDA en queue, rien perdu", () => {
    const d = dColl({ controles: [ctrl(1), ctrl(2)], vueObligations: vue(2) });
    const html = pagePrevoyanceColl(t, d);
    // flux unique : un seul conteneur contrat, AUCUNE boite A4 ni slot/centrage
    expect(html).toContain('class="pdf-contrat"');
    expect(nbFeuilles(html)).toBe(0);
    expect(html).not.toContain("bottom:42px");
    expect(html).not.toContain("flex:1 1 0");
    // 2 tables ecoulables (audit + obligations)
    expect(nbOcc(html, "data-pdf-tbl")).toBe(2);
    // DDA exactement une fois, en QueueEpinglee, APRES le contenu (audit)
    expect(nbOcc(html, "L.521-4")).toBe(1);
    expect(html).toContain('class="pdf-queue"');
    expect(html.indexOf("L.521-4")).toBeGreaterThan(html.indexOf("Audit de conformité"));
    // aucun contenu perdu
    expect(html).toContain("Controle numero 1");
    expect(html).toContain("Controle numero 2");
    expect(html).toContain("Garantie numero 1");
    expect(html).toContain("Garantie numero 2");
  });

  it("contenu lourd (CCN longue + 12 controles + 16 obligations) -> flux unique, rien perdu", () => {
    const d = dColl({
      controles: Array.from({ length: 12 }, (_, i) => ctrl(i + 1)),
      champApplicationCCN: CONVENTION_LONGUE,
      vueObligations: vue(16, { synthese: true }),
    });
    const html = pagePrevoyanceColl(t, d);
    // plus de scission 2-feuilles : un seul flux, pas de boite A4 ni centrage
    expect(nbFeuilles(html)).toBe(0);
    expect(html).not.toContain("flex:1 1 0");
    expect(html).toContain("Audit de conformité");
    // 2 tables ecoulables ; comparaison active -> colonne Verdict
    expect(nbOcc(html, "data-pdf-tbl")).toBe(2);
    expect(html).toContain("Verdict");
    // DDA exactement une fois, en queue, APRES les obligations
    expect(nbOcc(html, "L.521-4")).toBe(1);
    expect(html).toContain('class="pdf-queue"');
    expect(html.indexOf("L.521-4")).toBeGreaterThan(html.indexOf("Obligations de prevoyance de branche"));
    // aucun contenu perdu : 12 controles + 16 garanties
    for (let i = 1; i <= 12; i++) expect(html).toContain(`Controle numero ${i}`);
    for (let i = 1; i <= 16; i++) expect(html).toContain(`Garantie numero ${i}`);
  });

  it("module inactif -> flux unique : header + message + DDA en queue, pas d'audit", () => {
    const d = dColl({ active: false });
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain('class="pdf-contrat"');
    expect(nbFeuilles(html)).toBe(0);
    expect(html).toContain("Activer le module Prévoyance collective");
    expect(html).not.toContain("flex:1 1 0");
    expect(html).not.toContain("Audit de conformité");
    expect(html).not.toContain("data-pdf-tbl");   // aucune table
    expect(nbOcc(html, "L.521-4")).toBe(1);
    expect(html).not.toContain("bottom:42px");
    expect(html).toContain('class="pdf-queue"');   // DDA en queue
  });
});
