// ─── TEST DE RÈGLE — Migration Lettre de mission sur le contrat moteur ────────────
//
// Dernier docReg migré au contrat (engine/contrat.ts), patron DER/DDA. Vérifie sur
// le HTML rendu (assertions STRUCTURELLES, pas de snapshot) :
//   1. data-pdf-doc="Lettre de mission" (numérotation X/N PAR DOCUMENT) ;
//   2. signature = VARIANTE PAR DÉFAUT (« Fait à » + « lu et approuvé » présents),
//      PAS la variante DER (« un par partie » absent) ;
//   3. signature TERMINALE (après le dernier encadré métier, médiation) ;
//   4. plus de pied codé en dur « 1 / 2 » (ancien découpage retiré) ;
//   5. enveloppe docReg (data-pdf-page="docReg" + marges 44/36) ; pas de display:none.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { pageLettreMission, type LettreMissionPageData } from "../lib/pdf/v2/pages/pageLettreMission";
import type { CasePrestation } from "../lib/pdf/v2/primitives";

const t = buildTokens("encreOr");

function prestations(): CasePrestation[] {
  return [
    { label: "Bilan patrimonial global",        cochee: true },
    { label: "Optimisation fiscale (IR / IFI)", cochee: true },
    { label: "Stratégie de transmission",       cochee: true },
    { label: "Analyse prévoyance & protection", cochee: false },
    { label: "Préparation de la retraite",      cochee: true },
    { label: "Allocation d'actifs / placements", cochee: false },
  ];
}

function dossierLettre(): LettreMissionPageData {
  return {
    cabinetNom: "EcoPatrimoine Conseil",
    cabinetAdresse: "6 rue Victor Mirabeau, 66000 Perpignan",
    cabinetTel: "04 68 00 00 00",
    cabinetEmail: "contact@ecopatrimoine.fr",
    cabinetORIAS: "25006907",
    cabinetStatuts: "Courtier en assurance (COA)",
    cabinetConseiller: "David Perry",
    cabinetNiveauConseil: "1",
    statutCif: false,
    clientNom: "Hélène Dubreuil",
    clientAdresse: "12 rue des Lilas, 66000 Perpignan",
    clientContact: "06 12 34 56 78",
    dateLettre: "25 mai 2026",
    prestations: prestations(),
    remunerationMode: "Honoraires payés directement par le client",
    natureConseil: "non indépendant",
    dureeMission: "12 mois renouvelables",
    delaiPreavis: "30 jours",
    villeSignature: "Perpignan",
    mentionNonContractuelle:
      "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique.",
  };
}

const html = pageLettreMission(t, dossierLettre());

const TITRE_MEDIATION = "Statuts, autorités de contrôle & médiation";
const SIG_FAIT = "Fait à";
const SIG_LU = "lu et approuvé";
const DER_VARIANTE = "un par partie";

describe("Lettre de mission — migration contrat (section unique)", () => {
  it("1. porte data-pdf-doc=\"Lettre de mission\" (numérotation X/N par document)", () => {
    expect(html).toContain(`data-pdf-doc="Lettre de mission"`);
  });

  it("2. signature = variante PAR DÉFAUT (Fait à + lu et approuvé), PAS la variante DER", () => {
    expect(html).toContain(SIG_FAIT);
    expect(html).toContain(SIG_LU);
    expect(html).toContain("Le client");
    // NE doit PAS reprendre les overrides DER.
    expect(html).not.toContain(DER_VARIANTE);
  });

  it("3. signature TERMINALE : après le dernier encadré métier (médiation)", () => {
    const posMediation = html.indexOf(TITRE_MEDIATION);
    const posSig = html.indexOf(SIG_FAIT);
    expect(posMediation).toBeGreaterThan(-1);
    expect(posSig).toBeGreaterThan(posMediation);
    // Bloc terminal en flux, jamais veuf : break-before:avoid (solidaireAvecPrecedent).
    expect(html).toContain("break-before:avoid");
  });

  it("4. NE contient PLUS de pied codé en dur « 1 / 2 » (ancien découpage retiré)", () => {
    expect(html).not.toContain("1 / 2");
    expect(html).not.toContain("2 / 2");
  });

  it("5. enveloppe docReg (data-pdf-page + marges 44/36) ; aucun display:none", () => {
    expect(html).toContain(`data-pdf-page="docReg"`);
    expect(html).toContain("padding:30px 36px 0 44px");
    expect(html).not.toContain("display:none");
  });
});
