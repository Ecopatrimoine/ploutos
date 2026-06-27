// ─── LOT — TEST ÉTAGE 1 : non-perte réglementaire (Fiche conseil DDA #3) ──────
//
// Document DDA signé par le client : ZÉRO perte silencieuse. Dossier au PIRE CAS
// (recommandationsGroupees VOLUMINEUX, 11 recos = assez pour déborder), vérifie sur
// le HTML rendu :
//   1. chaque reco en ENTRÉE est RENDUE (compte exact, zéro perte) ;
//   2. slot signature PRÉSENT et ENTIER : ligne ORIAS + 2 cadres (client + cabinet) +
//      mention — la signature qui DISPARAISSAIT sur paged.js (display:none) est de retour
//      sous forme de bloc EN FLUX (break-before:avoid = anti-veuve), APRÈS toutes les recos ;
//   3. mentions obligatoires : ORIAS, « non contractuelle », catégorie IAS + ACPR (ligneOrias) ;
//   4. AUCUN display:none sur du contenu réglementaire ;
//   5. marqueur data-pdf-page="docReg" + marges 44/36 (liseré 1a).
// PAS d'assertion attestation-même-feuille : la Fiche DDA n'a pas de phrase d'attestation.
// GATE du lot au même titre que tsc/vitest.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { pageFicheDDA, type FicheDDAPageData } from "../lib/pdf/v2/pages/pageFicheDDA";
import type { GroupeRecommandationsParDimension } from "../lib/pdf/v2/pages/pageDeclarationAdequation";

const t = buildTokens("encreOr");

const NB_RECOS = 11;
function groupesVolumineux(): GroupeRecommandationsParDimension[] {
  const mk = (n: number) => ({
    libelle: `RECO-${String(n).padStart(2, "0")} libellé unique`,
    justification: `Justification détaillée de la recommandation numéro ${n}, suffisamment longue pour occuper de la hauteur et provoquer un débordement.`,
    besoinLibelle: `Besoin lié ${n}`,
  });
  return [
    { dimensionLabel: "Besoin exprimé",                            recos: [mk(1), mk(2), mk(3)] },
    { dimensionLabel: "Tolérance au risque",                       recos: [mk(4), mk(5), mk(6)] },
    { dimensionLabel: "Préférences en matière de durabilité (ESG)", recos: [mk(7), mk(8)] },
    { dimensionLabel: "Capacité à subir des pertes",               recos: [mk(9), mk(10), mk(11)] },
  ];
}

function dossierFicheDDA(): FicheDDAPageData {
  return {
    cabinetNom: "EcoPatrimoine Conseil",
    cabinetORIAS: "25006907",
    cabinetConseiller: "David Perry",
    cabinetCategorieIas: "Courtier en assurance (COA)",
    cabinetStatut: "courtier / mandataire",
    cabinetModeRemuneration: "commissions / honoraires",
    dateLettre: "25 mai 2026",
    client: {
      person1: { nom: "Hélène Dubreuil", naissance: "15/03/1975" },
      person2: { nom: "Marc Dubreuil", naissance: "22/08/1972" },
      adresse: "12 rue des Lilas, 66000 Perpignan",
    },
    origineDesBesoins: "issu du dossier",
    besoins: [
      { iconeKey: "shieldHeart", texteHtml: "Protéger le foyer en cas de décès." },
      { iconeKey: "activityHeartbeat", texteHtml: "Maintenir le revenu en cas d'invalidité." },
      { iconeKey: "calendarEuro", texteHtml: "Disposer d'une épargne de moyen-long terme." },
    ],
    garanties: [
      { texteHtml: "Contrat de prévoyance avec <strong>capital décès</strong>." },
      { texteHtml: "Garantie <strong>maintien de revenu</strong>." },
      { texteHtml: "Contrat d'<strong>assurance-vie</strong> multisupport." },
    ],
    miseEnRegard: [
      { besoin: "Protection en cas de décès", reponse: "Le capital décès couvre le crédit restant." },
      { besoin: "Maintien du revenu", reponse: "La rente d'invalidité compense la perte de revenu." },
      { besoin: "Épargne & transmission", reponse: "L'assurance-vie valorise et organise la transmission." },
    ],
    voletIbipHtml: "Pour le contrat d'assurance-vie en unités de compte, une <strong>adéquation renforcée</strong> est réalisée (profil, horizon, capacité de perte, préférences ESG).",
    textRemunerationImpartialiteHtml: "La nature et le montant de la rémunération vous sont communiqués avant la souscription.",
    documentsRemisHtml: "<strong>Documents remis</strong> : IPID (non-vie) et DIC (assurance-vie).",
    documents: [
      { type: "ipid", nom: "IPID_Prevoyance_2026.pdf" },
      { type: "dic", nom: "DIC_AssuranceVie.pdf" },
    ],
    recommandationsGroupees: groupesVolumineux(),
    mentionNonContractuelle:
      "Information non contractuelle. Document d'aide à la conformité remis à titre indicatif ; ne constitue ni une attestation de conformité, ni un conseil juridique.",
  };
}

describe("Fiche conseil DDA — non-perte réglementaire (Étage 1)", () => {
  const html = pageFicheDDA(t, dossierFicheDDA());

  it("1. ZÉRO perte : les 11 recos en entrée sont TOUTES rendues (compte exact)", () => {
    for (let n = 1; n <= NB_RECOS; n++) {
      const lib = `RECO-${String(n).padStart(2, "0")} libellé unique`;
      expect(html, `reco ${n} absente du rendu`).toContain(lib);
    }
    const sentinelleCarte = `border-left:3px solid ${t.or};border-radius:6px`;
    const nbCartes = (html.match(new RegExp(sentinelleCarte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    expect(nbCartes, "compte de cartes rendues != compte d'entrée").toBe(NB_RECOS);
  });

  it("2. slot signature PRÉSENT et ENTIER (ligne ORIAS + 2 cadres + mention), en flux, APRÈS les recos", () => {
    // Ligne ORIAS (statut intermédiaire + ACPR).
    expect(html).toContain("Statut d'intermédiaire en assurance");
    expect(html).toContain("ACPR");
    // 2 cadres : client + cabinet (avec le conseiller).
    expect(html).toContain("Le client");
    expect(html).toContain("Le cabinet — David Perry");
    // Mention non contractuelle.
    expect(html).toContain("ne constitue ni une attestation de conformité");
    // Bloc en flux, jamais veuf : break-before:avoid (solidaireAvecPrecedent).
    expect(html).toContain("break-before:avoid");
    // Signature APRÈS la dernière carte de reco (jamais au milieu de l'écoulement).
    const sentinelleCarte = `border-left:3px solid ${t.or};border-radius:6px`;
    expect(html.lastIndexOf(sentinelleCarte)).toBeLessThan(html.indexOf("Le cabinet — David Perry"));
  });

  it("3. mentions obligatoires : ORIAS 25006907, « non contractuelle », catégorie IAS (COA)", () => {
    expect(html).toContain("25006907");
    expect(html).toContain("non contractuelle");
    expect(html).toContain("Courtier en assurance (COA)");
  });

  it("4. AUCUN display:none sur du contenu réglementaire (pas de clip silencieux)", () => {
    expect(html).not.toContain("display:none");
  });

  it("5. marqueur data-pdf-page=\"docReg\" présent (liseré par feuille, LOT 1a) + marges 44/36", () => {
    expect(html).toContain(`data-pdf-page="docReg"`);
    expect(html).toContain("padding:0 36px 0 44px");
  });

  it("6. Volet IBIP (contenu réglementaire) toujours rendu (pas de perte à la migration)", () => {
    expect(html).toContain("Volet assurance-vie (IBIP)");
    expect(html).toContain("adéquation renforcée");
  });

  it("7. marqueur data-pdf-doc présent (numérotation X/N PAR DOCUMENT, libellé DDA)", () => {
    // Le feeder hisse ce marqueur en data-doc ; le DocNumHandler numérote
    // « Fiche conseil DDA · X / N » (compteur propre au document, pas le pack global).
    expect(html).toContain(`data-pdf-doc="Fiche conseil DDA"`);
  });
});
