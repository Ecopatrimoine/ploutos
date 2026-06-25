// ─── TEST DE RÈGLE — Scission DER : section principale (signature terminale) + annexe ─
//
// Migration du DER au contrat moteur (engine/contrat.ts), patron pageFicheDDA.
// Vérifie sur le HTML rendu (assertions STRUCTURELLES, pas de snapshot) :
//   1. pageDer : data-pdf-doc=DOC_DER, signature DER conservée, AUCUN contenu d'annexe ;
//   2. pageDer : la signature est TERMINALE (après le dernier encadré métier, RGPD) ;
//   3. pageDerAnnexe : MÊME data-pdf-doc (égalité octet-pour-octet → compteur X/N commun),
//      contenu d'annexe présent, AUCUNE signature ;
//   4. enveloppe docReg commune (data-pdf-page="docReg" + marges 44/36) ; pas de display:none.
//
// L'assertion 1 (« pageDer NE contient PLUS le contenu d'annexe ») AURAIT ÉCHOUÉ sur
// l'ancien pageDer monolithique (page1+page2+page3, les références APRÈS la signature)
// → elle prouve la scission.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { pageDer, DOC_DER, type DerPageData } from "../lib/pdf/v2/pages/pageDer";
import { pageDerAnnexe } from "../lib/pdf/v2/pages/pageDerAnnexe";

const t = buildTokens("encreOr");

// Cabinet multi-statuts (CIF + COA + IOBSP) → l'annexe Références est NON vide
// (referencesLegales : 4 ACPR/COA + 2 IOBSP + 3 AMF/CIF = 9 lignes).
function dossierDer(): DerPageData {
  return {
    cabinetNom: "EcoPatrimoine Conseil",
    cabinetAdresse: "12 rue des Lilas, 66000 Perpignan",
    cabinetORIAS: "25006907",
    cabinetConseiller: "David Perry",
    statutCif: true,
    statutIas: true,
    statutCoa: true,
    statutMia: false,
    statutIobsp: true,
    statutCarteT: false,
    natureConseil: "indépendant",
    dateLettre: "25 mai 2026",
    mentionNonContractuelle:
      "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique.",
  };
}

const htmlDer = pageDer(t, dossierDer());
const htmlAnnexe = pageDerAnnexe(t, dossierDer());

// Sentinelles partagées.
const TITRE_ANNEXE = "Cadre légal calculé d'après vos statuts";
const REF_COA = "Conditions d'exercice de l'intermédiation en assurance"; // libellé referencesLegales (COA)
const SIG_LU = "lu et approuvé";
const SIG_EXEMPLAIRES = "deux exemplaires";

describe("DER — section principale (pageDer)", () => {
  it("1. porte data-pdf-doc=DOC_DER (libellé lisible, pas le PACK_LABEL)", () => {
    expect(htmlDer).toContain(`data-pdf-doc="${DOC_DER}"`);
    expect(DOC_DER).toBe("Document d'entrée en relation");
  });

  it("2. conserve la signature DER (variante « lu et approuvé » + « deux exemplaires »)", () => {
    expect(htmlDer).toContain(SIG_LU);
    expect(htmlDer).toContain(SIG_EXEMPLAIRES);
    // Cadre client variante DER (libellé spécifique).
    expect(htmlDer).toContain("Le client — nom & signature");
  });

  it("3. NE contient PLUS le contenu d'annexe (preuve de scission ; échouait sur le monolithe)", () => {
    expect(htmlDer).not.toContain(TITRE_ANNEXE);
    expect(htmlDer).not.toContain(REF_COA);
  });

  it("4. signature TERMINALE : placée APRÈS le dernier encadré métier (RGPD)", () => {
    const posRgpd = htmlDer.indexOf("Protection des données (RGPD)");
    const posSig = htmlDer.indexOf(SIG_LU);
    expect(posRgpd).toBeGreaterThan(-1);
    expect(posSig).toBeGreaterThan(posRgpd);
    // Bloc terminal en flux, jamais veuf : break-before:avoid (solidaireAvecPrecedent).
    expect(htmlDer).toContain("break-before:avoid");
  });
});

describe("DER — annexe Références (pageDerAnnexe)", () => {
  it("5. porte le MÊME data-pdf-doc que pageDer (égalité → compteur X/N commun)", () => {
    const re = /data-pdf-doc="([^"]+)"/;
    const docMain = htmlDer.match(re)?.[1];
    const docAnnexe = htmlAnnexe.match(re)?.[1];
    expect(docMain).toBe(DOC_DER);
    expect(docAnnexe).toBe(DOC_DER);
    expect(docAnnexe).toBe(docMain); // octet-pour-octet
  });

  it("6. contient le contenu d'annexe (encadré unique + références)", () => {
    expect(htmlAnnexe).toContain(TITRE_ANNEXE);
    expect(htmlAnnexe).toContain(REF_COA);
    // Encadré UNIQUE (non éclaté par régulateur) : filet anti-clip break-inside:auto.
    expect(htmlAnnexe).toContain("break-inside:auto");
  });

  it("7. NE contient PAS la signature (elle reste dans la section principale)", () => {
    expect(htmlAnnexe).not.toContain(SIG_LU);
    expect(htmlAnnexe).not.toContain("Le client — nom & signature");
  });
});

describe("DER — enveloppe docReg commune", () => {
  it("8. les 2 sections portent data-pdf-page=\"docReg\" + marges 44/36", () => {
    for (const html of [htmlDer, htmlAnnexe]) {
      expect(html).toContain(`data-pdf-page="docReg"`);
      expect(html).toContain("padding:30px 36px 0 44px");
    }
  });

  it("9. aucun display:none (pas de clip silencieux de contenu réglementaire)", () => {
    expect(htmlDer).not.toContain("display:none");
    expect(htmlAnnexe).not.toContain("display:none");
  });
});
