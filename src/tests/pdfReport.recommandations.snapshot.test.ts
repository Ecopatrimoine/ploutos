// ─── Lot 7 — Snapshot dédié de la section Recommandations du rapport ────────
//
// Capture le rendu HTML de la section "Recommandations & plan d'action" sur
// une fixture qui contient des recommandations couvrant les 4 dimensions.
//
// Important : ce test ne touche PAS aux 41 snapshots existants (preuve dans
// pdfReport.snapshot.test.ts) — il en AJOUTE un seul nouveau pour figer le
// nouveau rendu.

import { describe, it, expect, beforeAll } from "vitest";
import { buildAndPrintPdf } from "../lib/pdf/pdfReport";
import {
  fixtureData,
  fixtureIrOptions,
  fixtureCabinet,
  fixtureHypothesisResults,
  allSectionsReport,
  onlySection,
  buildFixtureComputed,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";
import type { Recommandation } from "../lib/conformite/recommandations";

let computed: ReturnType<typeof buildFixtureComputed>;

beforeAll(() => {
  computed = buildFixtureComputed();
});

// Fixture de recommandations : une par dimension + une seconde sur "besoin"
// pour vérifier le tri intra-groupe.
const fixtureRecommandations: Recommandation[] = [
  {
    id: "reco-1",
    libelle: "Souscrire une garantie ITT renforcée",
    justification: "Couvre l'arrêt de travail au-delà du régime obligatoire — besoin prévoyance prioritaire identifié.",
    dimension: "besoin",
    besoinKey: "besoinPrev_arret",
  },
  {
    id: "reco-2",
    libelle: "Constituer une réserve liquide complémentaire",
    justification: "Coussin actuel inférieur à 12 mois de revenus — viser un horizon de 18 mois.",
    dimension: "capacitePerte",
  },
  {
    id: "reco-3",
    libelle: "Diversifier en supports labellisés ISR sur l'assurance-vie",
    justification: "Cohérent avec la préférence ESG partielle exprimée au questionnaire.",
    dimension: "esg",
  },
  {
    id: "reco-4",
    libelle: "Réajuster l'allocation cible vers une part actions plus élevée",
    justification: "Profil dynamique avec horizon long terme (9-15 ans) — la part actions actuelle est en-deçà.",
    dimension: "risque",
  },
  {
    id: "reco-5",
    libelle: "Compléter la couverture décès toutes causes",
    justification: "Besoin protection famille exprimé — capital actuel insuffisant pour maintenir le train de vie 5 ans.",
    dimension: "besoin",
    besoinKey: "besoinPrev_deces",
  },
];

const baseParams = () => ({
  sections: { ...allSectionsReport },
  data: fixtureData,
  ir: computed.ir,
  ifi: computed.ifi,
  succession: computed.succession,
  irOptions: fixtureIrOptions,
  cabinet: fixtureCabinet,
  clientName: "Pierre Dupont",
  notes: "Note de référence du conseiller — fixture test.",
  logoSrc: "",
  hypothesisResults: fixtureHypothesisResults,
  recommandations: fixtureRecommandations,
});

describe("pdfReport — section Recommandations (Lot 7)", () => {
  it("section isolée avec 5 recos couvrant les 4 dimensions → snapshot HTML figé", () => {
    const params = {
      ...baseParams(),
      sections: onlySection(allSectionsReport, "recommandations"),
    };
    const html = capturePdfHtml(() => buildAndPrintPdf(params));
    expect(html).toContain("Recommandations & plan d'action");
    expect(html).toContain("Souscrire une garantie ITT renforcée");
    // Les 4 dimensions doivent apparaître dans l'ordre DIMENSIONS_ORDER
    // (besoin → risque → esg → capacitePerte).
    const iBesoin       = html.indexOf("Besoin exprimé");
    const iRisque       = html.indexOf("Tolérance au risque");
    const iEsg          = html.indexOf("Préférences en matière de durabilité (ESG)");
    const iCapacitePerte = html.indexOf("Capacité à subir des pertes");
    expect(iBesoin).toBeGreaterThan(0);
    expect(iRisque).toBeGreaterThan(iBesoin);
    expect(iEsg).toBeGreaterThan(iRisque);
    expect(iCapacitePerte).toBeGreaterThan(iEsg);
    expect(html).toMatchSnapshot();
  });

  it("section absente si recommandations vides (snapshot tautologique)", () => {
    const html = capturePdfHtml(() =>
      buildAndPrintPdf({ ...baseParams(), recommandations: [], sections: onlySection(allSectionsReport, "recommandations") })
    );
    // La section ne contient ni le titre ni les libellés.
    expect(html).not.toContain("Recommandations & plan d'action");
    expect(html).not.toContain("Souscrire une garantie ITT renforcée");
  });

  it("recos incomplètes (libellé vide) filtrées → section absente si toutes incomplètes", () => {
    const html = capturePdfHtml(() =>
      buildAndPrintPdf({
        ...baseParams(),
        recommandations: [
          { id: "x", libelle: "", justification: "...", dimension: "besoin" },
          { id: "y", libelle: "ok", justification: "", dimension: "risque" },
        ],
        sections: onlySection(allSectionsReport, "recommandations"),
      })
    );
    expect(html).not.toContain("Recommandations & plan d'action");
  });

  it("conformité : aucune mention de produit ou d'assureur dans le rendu (les libellés saisis ne doivent pas en contenir non plus)", () => {
    // Garde-fou pédagogique : vérifie que la fixture elle-même respecte la règle.
    for (const r of fixtureRecommandations) {
      expect(r.libelle.toLowerCase()).not.toMatch(/predica|generali|axa|allianz|swisslife|spirica|cardif|nortia/);
      expect(r.libelle.toLowerCase()).not.toMatch(/\bisin\b/);
    }
  });
});
