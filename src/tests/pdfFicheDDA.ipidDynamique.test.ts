// ─── Lot 8e — Tests : la fiche DDA reflète l'état réel des pièces IPID/DIC
//
// Vérifie le wording dynamique de la section IPID :
//   • 0 IPID rattachée → « IPID à remettre » (état non joint)
//   • ≥ 1 IPID         → « IPID joint en annexe — N pièce(s) : <noms> »
//
// Garde-fou : le contenu hors section IPID est INCHANGÉ entre les deux cas
// (preuve que seule la section ipid est dynamique).

import { describe, it, expect } from "vitest";
import { buildAndPrintFicheDDA } from "../lib/pdf/pdfFicheDDA";
import {
  fixtureData,
  fixtureMission,
  fixtureCabinet,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";
import type { Recommandation } from "../lib/conformite/recommandations";
import type { PieceJointe } from "../lib/conformite/piecesJointes";

const recos: Recommandation[] = [
  { id: "r1", libelle: "Souscrire une garantie ITT", justification: "...", dimension: "besoin", besoinKey: "besoinPrev_arret" },
];

const ipid1: PieceJointe = {
  id: "p1", type: "ipid", nom: "ipid-itt-2026.pdf",
  mimeType: "application/pdf", taille: 128_456,
  uploadedAt: "2026-05-26T10:00:00.000Z",
  contratLie: "Garantie ITT — police 12345",
  dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
};

const ipid2: PieceJointe = {
  id: "p2", type: "ipid", nom: "ipid-deces-2026.pdf",
  mimeType: "application/pdf", taille: 95_120,
  uploadedAt: "2026-05-26T10:15:00.000Z",
  dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
};

const dic1: PieceJointe = {
  id: "p3", type: "dic", nom: "dic-uc-equilibre.pdf",
  mimeType: "application/pdf", taille: 64_888,
  uploadedAt: "2026-05-26T10:30:00.000Z",
  dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
};

const baseParams = (pieces: PieceJointe[] = []) => ({
  cabinet: fixtureCabinet,
  data: fixtureData,
  mission: fixtureMission,
  recommandations: recos,
  piecesJointes: pieces,
  clientName: "Pierre Dupont",
  logoSrc: "",
});

describe("pdfFicheDDA — section IPID dynamique (Lot 8e)", () => {
  it("0 IPID rattachée → wording 'IPID à remettre' (état non joint)", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([])));
    expect(html).toContain("IPID à remettre");
    expect(html).toContain("non joint à ce jour");
    expect(html).not.toContain("joint en annexe");
  });

  it("1 IPID rattachée → wording 'IPID joint en annexe — 1 pièce : <nom>'", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([ipid1])));
    expect(html).toContain("IPID joint en annexe");
    expect(html).toContain("1 pièce");
    expect(html).toContain("ipid-itt-2026.pdf");
    expect(html).not.toContain("IPID à remettre");
  });

  it("2 IPID rattachées → wording '2 pièces' + les 2 noms listés", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([ipid1, ipid2])));
    expect(html).toContain("IPID joint en annexe");
    expect(html).toContain("2 pièces");
    expect(html).toContain("ipid-itt-2026.pdf");
    expect(html).toContain("ipid-deces-2026.pdf");
  });

  it("DIC seules (pas d'IPID) → wording 'IPID à remettre' (DIC n'allume PAS l'IPID)", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([dic1])));
    expect(html).toContain("IPID à remettre");
    expect(html).not.toContain("IPID joint en annexe");
  });

  it("mélange IPID + DIC → IPID compté (DIC ignoré pour ce wording)", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([ipid1, dic1])));
    expect(html).toContain("IPID joint en annexe");
    expect(html).toContain("1 pièce");
    // Le DIC n'apparaît PAS dans la section IPID (filtré par type)
    expect(html).not.toContain("dic-uc-equilibre.pdf");
  });
});

describe("pdfFicheDDA — invariant Lot 8e : le contenu hors section IPID est inchangé", () => {
  // On extrait le HTML hors de la section IPID puis on compare entre 0 et 1 pièce.
  const extractHorsIpid = (html: string): string => {
    // La section "Documents IPID — assurance non-vie" est encadrée par un
    // <div class="section"> jusqu'au prochain <div class="section">.
    // Approximation suffisante : on retire toute la balise contenant
    // "Documents IPID" jusqu'au prochain section-title.
    return html.replace(
      /<div class="section">\s*<div class="section-title">Documents IPID[\s\S]*?<\/div>\s*<\/div>/,
      ""
    );
  };

  it("avec 0 IPID vs 1 IPID : tout le reste du document est strictement identique", () => {
    const htmlSansIpid = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([])));
    const htmlAvecIpid = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([ipid1])));
    expect(extractHorsIpid(htmlSansIpid)).toBe(extractHorsIpid(htmlAvecIpid));
  });
});

describe("pdfFicheDDA — garde-fou Lot 8e : un nom d'assureur dans nom de pièce ne déclenche pas le code interdit", () => {
  it("nom de pièce avec marque d'assureur (saisie utilisateur) → autorisé dans le rendu", () => {
    const pieceAvecMarque: PieceJointe = {
      ...ipid1,
      nom: "ipid-garantie-prevoyance-axa-2026.pdf",  // saisie utilisateur
    };
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams([pieceAvecMarque])));
    // Le rendu CONTIENT le nom (c'est le nom du fichier de l'utilisateur)
    expect(html).toContain("ipid-garantie-prevoyance-axa-2026.pdf");
    // Mais aucun produit/assureur n'est CODÉ EN DUR dans le code Ploutos (garde-fou différent)
  });
});
