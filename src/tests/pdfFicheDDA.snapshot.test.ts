// ─── Lot 8c — Snapshots + assertions de la Fiche d'information et de conseil
//
// Document orienté assurance (volet COA/MIA), DÉPEND du dossier client :
// consomme data (identité), mission (besoins + ESG), recommandations (Lot 7).
//
// Architecture « qui peut le plus qui peut le moins » (poursuit 8a/8b) :
//   • Cabinet COA seul → cadre = "DDA" ; bloc références = code assurances.
//   • Cabinet CIF coché → cadre = "MIF II + DDA" ; bloc références allume
//     RG AMF / MIF II / L.541-1 — contenu assurance inchangé.
//   • Cabinet sans coa ni mia → avertissement « non applicable » pédagogique
//     (le document reste généré).
//
// 3 snapshots (COA + recos / CIF coché + recos / dossier vide) + ~17
// assertions toContain. 0 régénération des snapshots existants.

import { describe, it, expect } from "vitest";
import { buildAndPrintFicheDDA } from "../lib/pdf/pdfFicheDDA";
import {
  fixtureData,
  fixtureMission,
  fixtureCabinet,
  fixtureCabinetCifCoche,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";
import type { Recommandation } from "../lib/conformite/recommandations";

// Fixture locale de recommandations (5 recos, 4 dimensions, 2 avec besoinKey)
const fixtureRecommandationsDDA: Recommandation[] = [
  {
    id: "reco-1",
    libelle: "Souscrire une garantie ITT renforcée",
    justification: "Couvre l'arrêt de travail au-delà du régime obligatoire — besoin prévoyance prioritaire.",
    dimension: "besoin",
    besoinKey: "besoinPrev_arret",
  },
  {
    id: "reco-2",
    libelle: "Compléter la couverture décès toutes causes",
    justification: "Capital actuel insuffisant pour maintenir le train de vie 5 ans.",
    dimension: "besoin",
    besoinKey: "besoinPrev_deces",
  },
  {
    id: "reco-3",
    libelle: "Réajuster l'allocation cible vers une part actions plus élevée",
    justification: "Profil dynamique avec horizon 9-15 ans — la part actions actuelle est en-deçà.",
    dimension: "risque",
  },
  {
    id: "reco-4",
    libelle: "Diversifier en supports labellisés ISR sur l'assurance-vie",
    justification: "Cohérent avec la préférence ESG partielle exprimée.",
    dimension: "esg",
  },
  {
    id: "reco-5",
    libelle: "Constituer une réserve liquide complémentaire",
    justification: "Coussin actuel inférieur à 12 mois de revenus — viser un horizon de 18 mois.",
    dimension: "capacitePerte",
  },
];

const baseParams = (cabinet: typeof fixtureCabinet, recos: Recommandation[] = fixtureRecommandationsDDA) => ({
  cabinet,
  data: fixtureData,
  mission: fixtureMission,
  recommandations: recos,
  clientName: "Pierre Dupont & Sophie Dupont",
  logoSrc: "",
});

// ─── Snapshots ──────────────────────────────────────────────────────────────
describe("pdfFicheDDA — snapshot COA seul + recommandations (fixture David)", () => {
  it("génère la fiche DDA pour un cabinet COA seul avec 5 recommandations", () => {
    const html = capturePdfHtml(() =>
      buildAndPrintFicheDDA(baseParams(fixtureCabinet))
    );
    expect(html).toMatchSnapshot();
  });
});

describe("pdfFicheDDA — snapshot CIF coché + recommandations (sur-ensemble allumé)", () => {
  it("génère la fiche DDA avec cadre 'MIF II + DDA' et bloc références AMF + L.541-1", () => {
    const html = capturePdfHtml(() =>
      buildAndPrintFicheDDA(baseParams(fixtureCabinetCifCoche))
    );
    expect(html).toMatchSnapshot();
  });
});

describe("pdfFicheDDA — snapshot dossier vide (aucune reco, aucun besoin coché)", () => {
  it("fige le rendu dégradé avec messages 'aucune reco' / 'aucun besoin'", () => {
    const missionVide: Record<string, any> = {
      // Tous les besoins à false explicitement
      besoinSante_depenses: false, besoinSante_hospit: false, besoinSante_depasse: false, besoinSante_surcompl: false,
      besoinPrev_arret: false, besoinPrev_deces: false, besoinPrev_fraisGen: false,
      besoinRetraite_capital: false, besoinRetraite_rente: false, besoinRetraite_moderniser: false,
      besoinEpargne_valoriser: false, besoinEpargne_transmettre: false, besoinEpargne_completer: false, besoinEpargne_projet: false,
      esgPref: "non",
    };
    const html = capturePdfHtml(() =>
      buildAndPrintFicheDDA({
        cabinet: fixtureCabinet,
        data: fixtureData,
        mission: missionVide,
        recommandations: [],
        clientName: "Pierre Dupont",
        logoSrc: "",
      })
    );
    expect(html).toMatchSnapshot();
  });
});

// ─── Invariants COA seul ────────────────────────────────────────────────────
describe("pdfFicheDDA — invariants COA seul", () => {
  const html = () => capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinet)));

  it("contient l'identité du client (P1 + P2 si couple)", () => {
    const h = html();
    expect(h).toContain("Pierre Dupont");
    expect(h).toContain("Sophie Dupont");
  });

  it("affiche les besoins cochés et NE liste PAS les besoins non cochés", () => {
    const h = html();
    // Cochés (fixtureMission) : hospitalisation, arrêt travail, décès…
    expect(h).toContain("Hospitalisation");
    expect(h).toContain("Arrêt de travail / invalidité");
    expect(h).toContain("Décès");
    expect(h).toContain("Capital retraite");
    // Non cochés : dépassements (false), frais généraux pro (false), compléter revenus (false)
    expect(h).not.toContain("Dépassements d'honoraires");
    expect(h).not.toContain("Frais généraux pro");
  });

  it("affiche les 5 recommandations groupées par dimension", () => {
    const h = html();
    expect(h).toContain("Souscrire une garantie ITT renforcée");
    expect(h).toContain("Compléter la couverture décès toutes causes");
    expect(h).toContain("Réajuster l'allocation cible vers une part actions plus élevée");
    expect(h).toContain("Diversifier en supports labellisés ISR sur l'assurance-vie");
    expect(h).toContain("Constituer une réserve liquide complémentaire");
    // 4 dimensions visibles (au moins les 3 qui ont au moins une reco)
    expect(h).toContain("Besoin exprimé");
    expect(h).toContain("Tolérance au risque");
    expect(h).toContain("Préférences en matière de durabilité");
    expect(h).toContain("Capacité à subir des pertes");
  });

  it("contient la référence IPID — wording dynamique 'à remettre' (fixture sans pièce jointe)", () => {
    // Lot 8e — sans piecesJointes IPID dans la fixture, le wording est
    // « IPID à remettre » (pas « joint en annexe »). La fonction reflète
    // l'état réel des pièces rattachées.
    const h = html();
    expect(h).toContain("IPID");
    expect(h).toContain("IPID à remettre");
    expect(h).not.toContain("joint en annexe");
  });

  it("le cadre réglementaire affiché est 'DDA' (pas 'MIF II')", () => {
    const h = html();
    expect(h).toContain("obligations DDA");
    expect(h).not.toContain("obligations MIF II");
    expect(h).not.toContain("MIF II");
  });

  it("contient le pied 'Portée du document — Ploutos (Ecopatrimoine)'", () => {
    expect(html()).toContain("Portée du document — Ploutos (Ecopatrimoine)");
  });

  it("contient les références code des assurances (L.511-1, L.521-x à confirmer)", () => {
    const h = html();
    expect(h).toContain("L.511-1 et s.");
    expect(h).toContain("L.521-x");
    expect(h).toMatch(/L\.521-x[^]*à confirmer/i);
  });
});

// ─── Lien reco ↔ besoin (besoinKey) ────────────────────────────────────────
describe("pdfFicheDDA — lien reco ↔ besoin (besoinKey du Lot 7)", () => {
  it("une reco avec besoinKey affiche 'Lié au besoin : <libellé humain>'", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinet)));
    expect(html).toContain("Lié au besoin : Prévoyance — Arrêt de travail / invalidité");
    expect(html).toContain("Lié au besoin : Prévoyance — Décès");
  });

  it("une reco SANS besoinKey n'affiche pas de lien", () => {
    const recosSansLien: Recommandation[] = [{
      id: "x", libelle: "Reco sans lien", justification: "Justif", dimension: "risque",
      // pas de besoinKey
    }];
    const html = capturePdfHtml(() =>
      buildAndPrintFicheDDA(baseParams(fixtureCabinet, recosSansLien))
    );
    expect(html).toContain("Reco sans lien");
    expect(html).not.toContain("Lié au besoin :");
  });
});

// ─── ESG / durabilité (vie/IBIP) ───────────────────────────────────────────
describe("pdfFicheDDA — ESG / durabilité (volet vie/IBIP)", () => {
  it("esgPref='partiel' (fixture par défaut) → mention intégration partielle", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinet)));
    expect(html).toContain("Intégration");
    expect(html).toContain("partielle");
  });

  it("esgPref='non' → 'Aucune préférence ESG exprimée'", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA({
      ...baseParams(fixtureCabinet),
      mission: { ...fixtureMission, esgPref: "non" },
    }));
    expect(html).toContain("Aucune préférence ESG exprimée");
  });

  it("esgPref='oui' → 'Intégration prioritaire des critères ESG'", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA({
      ...baseParams(fixtureCabinet),
      mission: { ...fixtureMission, esgPref: "oui" },
    }));
    expect(html).toContain("prioritaire");
  });
});

// ─── Invariants CIF coché (sur-ensemble) ───────────────────────────────────
describe("pdfFicheDDA — invariants CIF coché", () => {
  const html = () => capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinetCifCoche)));

  it("le cadre réglementaire passe à 'MIF II + DDA'", () => {
    expect(html()).toContain("obligations MIF II + DDA");
  });

  it("le bloc références allume RG AMF, MIF II, L.541-1 et s.", () => {
    const h = html();
    expect(h).toContain("L.541-1 et s.");
    expect(h).toContain("RG AMF");
    expect(h).toContain("MIF II");
  });

  it("conserve les références code des assurances (sur-ensemble n'efface pas)", () => {
    const h = html();
    expect(h).toContain("L.511-1 et s.");
    expect(h).toContain("L.521-x");
  });

  it("contenu assurance inchangé : besoins + recommandations + IPID", () => {
    const h = html();
    expect(h).toContain("Hospitalisation");
    expect(h).toContain("Souscrire une garantie ITT renforcée");
    expect(h).toContain("IPID");
  });

  it("autorité AMF citée en plus de l'ACPR", () => {
    const h = html();
    expect(h).toContain("ACPR");
    expect(h).toContain("AMF");
  });
});

// ─── Avertissement « ni coa ni mia » ───────────────────────────────────────
describe("pdfFicheDDA — avertissement cabinet sans statut assurance", () => {
  it("cabinet sans coa ni mia → avertissement pédagogique présent", () => {
    const cabinetSansAssurance: Record<string, any> = {
      cabinetName: "Test cabinet",
      // pas de statutCoa ni statutMia (false implicite)
    };
    const html = capturePdfHtml(() => buildAndPrintFicheDDA({
      cabinet: cabinetSansAssurance,
      data: fixtureData,
      mission: fixtureMission,
      recommandations: fixtureRecommandationsDDA,
      clientName: "Pierre Dupont",
      logoSrc: "",
    }));
    expect(html).toContain("Document non applicable en l'état");
    expect(html).toContain("statuts ORIAS");
  });

  it("cabinet avec coa coché → pas d'avertissement", () => {
    const html = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinet)));
    expect(html).not.toContain("Document non applicable en l'état");
  });
});

// ─── Garde-fou conformité (les deux fixtures) ──────────────────────────────
describe("pdfFicheDDA — garde-fou conformité : aucun produit / aucun assureur nommé", () => {
  it("ni la version COA seul ni la version CIF coché ne citent un produit ou un assureur", () => {
    const htmlCoa = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinet)));
    const htmlCif = capturePdfHtml(() => buildAndPrintFicheDDA(baseParams(fixtureCabinetCifCoche)));
    const interdits = /\b(predica|generali|axa|allianz|swisslife|spirica|cardif|nortia|primonial|amundi)\b/i;
    expect(htmlCoa.match(interdits)).toBeNull();
    expect(htmlCif.match(interdits)).toBeNull();
  });
});
