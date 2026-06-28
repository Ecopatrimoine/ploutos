// ─── LOT 1b — TEST ÉTAGE 1 : non-perte réglementaire (Déclaration d'adéquation) ─
//
// La DA est signée par le client : ZÉRO perte silencieuse tolérée. Ce test pose un
// dossier au PIRE CAS (recommandationsGroupees VOLUMINEUX, 13 recos = assez pour
// déborder), puis vérifie sur le HTML rendu :
//   1. chaque reco en ENTRÉE est RENDUE en sortie (compte exact, zéro perte) ;
//   2. le slot signature est PRÉSENT et ENTIER (2 cadres client+cabinet + mention +
//      ORIAS) — la signature qui DISPARAISSAIT sur paged.js (display:none) est de retour
//      sous forme de bloc EN FLUX (break-before:avoid = anti-veuve) ;
//   3. mentions obligatoires : ORIAS, « non contractuelle », référence légale DA (MIF II) ;
//   4. AUCUN display:none sur du contenu réglementaire ;
//   5. marqueur data-pdf-page="docReg" présent (liseré par feuille, LOT 1a).
// GATE du lot au même titre que tsc/vitest.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import {
  pageDeclarationAdequation,
  type DeclarationAdequationPageData,
  type GroupeRecommandationsParDimension,
} from "../lib/pdf/v2/pages/pageDeclarationAdequation";

const t = buildTokens("encreOr");

// 13 recos réparties en 4 dimensions, libellés UNIQUES "RECO-01".."RECO-13"
// (assez nombreuses pour déborder une feuille A4 et forcer l'écoulement).
const NB_RECOS = 13;
function groupesVolumineux(): GroupeRecommandationsParDimension[] {
  const mk = (n: number) => ({
    libelle: `RECO-${String(n).padStart(2, "0")} libellé unique`,
    justification: `Justification détaillée de la recommandation numéro ${n}, suffisamment longue pour occuper de la hauteur sur la feuille et provoquer un débordement.`,
    besoinLibelle: `Besoin lié ${n}`,
  });
  return [
    { dimensionLabel: "Besoin exprimé",                          recos: [mk(1), mk(2), mk(3), mk(4)] },
    { dimensionLabel: "Tolérance au risque",                     recos: [mk(5), mk(6), mk(7)] },
    { dimensionLabel: "Préférences en matière de durabilité (ESG)", recos: [mk(8), mk(9), mk(10)] },
    { dimensionLabel: "Capacité à subir des pertes",             recos: [mk(11), mk(12), mk(13)] },
  ];
}

function dossierDA(): DeclarationAdequationPageData {
  return {
    cabinetNom: "EcoPatrimoine Conseil",
    cabinetConseiller: "David Perry",
    dateConseil: "25 mai 2026",
    heureConseil: "14h30",
    dateQuestionnaire: "10 mai 2026",
    origineRecommandations: "contenu dossier",
    profil: [
      { label: "Objectif principal", valeurHtml: "Valoriser &amp; transmettre" },
      { label: "Horizon", valeurHtml: "8 ans" },
      { label: "Profil de risque", valeurHtml: "Équilibré" },
      { label: "Capacité à subir des pertes", valeurHtml: "Modérée", puces: ["Coussin liquide 8 mois", "Endettement 25 %"] },
      { label: "Préférences de durabilité (ESG)", valeurHtml: "Souhaitées", pleineLargeur: true },
    ],
    recommandations: [
      { texteHtml: "Allocation cible 60 / 40." },
      { texteHtml: "Versement sur un <strong>PER</strong>." },
    ],
    miseEnRegard: [
      { besoin: "Objectif : valoriser & transmettre", reponse: "Allocation + PER + clause bénéficiaire." },
      { besoin: "Horizon de 8 ans", reponse: "Part d'UC cohérente moyen-long terme." },
    ],
    coutConseilHtml: "honoraires du dossier",
    fraisSupportsHtml: "frais courants / entrée",
    natureConseilHtml: "non indépendant",
    suiviActiveHtml: "est",
    periodiciteSuiviHtml: "annuelle",
    recommandationsGroupees: groupesVolumineux(),
    questionnaireSigne: [
      { question: "Attitude face au risque", reponse: "Équilibre rendement / risque" },
      { question: "Réaction à une baisse de 20 %", reponse: "Maintien des positions" },
      { question: "Connaissances & expérience", reponse: "Fonds €, actions, OPCVM" },
      { question: "Pertes / gains déjà subis", reponse: "Oui, sans changer de stratégie" },
      { question: "Mode de gestion", reponse: "Conseillée" },
      { question: "Préférences ESG", reponse: "Souhaitées — part significative" },
    ],
    mentionNonContractuelle:
      "Simulation non contractuelle ; toute recommandation s'inscrit dans le cadre du devoir de conseil. EcoPatrimoine Conseil — ORIAS n° 25006907 (statuts à confirmer sur www.orias.fr).",
  };
}

describe("Déclaration d'adéquation — non-perte réglementaire (Étage 1)", () => {
  const html = pageDeclarationAdequation(t, dossierDA());

  it("1. ZÉRO perte : les 13 recos en entrée sont TOUTES rendues (compte exact)", () => {
    // (a) chaque libellé unique est présent.
    for (let n = 1; n <= NB_RECOS; n++) {
      const lib = `RECO-${String(n).padStart(2, "0")} libellé unique`;
      expect(html, `reco ${n} absente du rendu`).toContain(lib);
    }
    // (b) compte exact des cartes via la signature CSS propre à une carte de reco.
    const sentinelleCarte = `border-left:3px solid ${t.or};border-radius:6px`;
    const nbCartes = (html.match(new RegExp(sentinelleCarte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    expect(nbCartes, "compte de cartes rendues != compte d'entrée").toBe(NB_RECOS);
  });

  it("2. slot signature PRÉSENT et ENTIER, en flux (anti-veuve), APRÈS toutes les recos", () => {
    // 2 cadres : client + cabinet (avec le conseiller).
    expect(html).toContain("Le client");
    expect(html).toContain("Le cabinet — David Perry");
    // Mention conseil (cadre signature) + mention non contractuelle.
    expect(html).toContain("remis y compris en l'absence de transaction");
    // Bloc en flux, jamais veuf : break-before:avoid (solidaireAvecPrecedent, flag Lot 0).
    expect(html).toContain("break-before:avoid");
    // La signature vient APRÈS la dernière carte de reco (jamais au milieu de l'écoulement).
    const sentinelleCarte = `border-left:3px solid ${t.or};border-radius:6px`;
    expect(html.lastIndexOf(sentinelleCarte)).toBeLessThan(html.indexOf("Le cabinet — David Perry"));
  });

  it("3. mentions obligatoires : ORIAS 25006907, « non contractuelle », MIF II", () => {
    expect(html).toContain("25006907");
    expect(html).toContain("non contractuelle");
    expect(html).toContain("MIF II");
  });

  it("4. AUCUN display:none sur du contenu réglementaire (pas de clip silencieux)", () => {
    expect(html).not.toContain("display:none");
  });

  it("5. marqueur data-pdf-page=\"docReg\" présent (liseré par feuille, LOT 1a) + marges 44/36", () => {
    expect(html).toContain(`data-pdf-page="docReg"`);
    // Divergence docReg PRÉSERVÉE : gauche 44 > droite 36 (place du liseré).
    expect(html).toContain("padding:0 36px 0 44px");
  });

  it("6. cohérence : attestation MIF II et signature dans le MÊME bloc insécable (anti-faux-négatif)", () => {
    // Le client doit voir CE QU'IL ATTESTE en signant. Garantie STRUCTURELLE qui
    // produit le « même feuille physique » (la classe paged.js est runtime-only) :
    // entre la phrase d'attestation et le cadre cabinet, AUCUNE frontière de bloc du
    // contrat (compilerBloc -> <div style="break-inside:avoid…">). Échoue si un futur
    // changement (ou le code AVANT fusion) sépare l'attestation de la signature.
    const att = "vous attestez de l'exactitude";
    const sig = "Le cabinet — David Perry";
    const iAtt = html.indexOf(att);
    const iSig = html.indexOf(sig);
    expect(iAtt, "phrase d'attestation absente").toBeGreaterThan(-1);
    expect(iSig, "cadre cabinet absent").toBeGreaterThan(-1);
    expect(iSig, "la signature doit suivre l'attestation").toBeGreaterThan(iAtt);
    const entreDeux = html.slice(iAtt, iSig);
    expect(entreDeux, "une frontière de bloc sépare l'attestation de la signature").not.toContain('style="break-inside:avoid');
  });

  it("7. marqueur data-pdf-doc présent (numérotation X/N PAR DOCUMENT, libellé DA)", () => {
    // Le feeder hisse ce marqueur en data-doc ; le DocNumHandler numérote
    // « Déclaration d'adéquation · X / N » (compteur propre au document, pas le pack global).
    expect(html).toContain(`data-pdf-doc="Déclaration d'adéquation"`);
  });
});
