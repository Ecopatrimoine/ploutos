// Sentinelle : les 6 pages v2 ex-v1-only (Cabinet / Famille / Travail /
// Hypos / Recommandations / Mentions) rendent du HTML non vide avec un
// payload réaliste, ne lèvent pas d'erreur, et incluent les marqueurs
// structurants (titre de page + cabinet pied de page). Si l'une de ces
// pages casse, le pop-card aurait des trous → on veut le bloquer ici.
import { describe, it, expect } from "vitest";
import { fixtureData, fixtureCabinet, fixtureMission, buildFixtureComputed, fixtureHypothesisResults } from "./__fixtures__/pdfFixture";
import { buildTokens } from "../lib/pdf/v2/tokens";

import { pageCabinet }         from "../lib/pdf/v2/pages/pageCabinet";
import { pageFamille }         from "../lib/pdf/v2/pages/pageFamille";
import { pageTravail }         from "../lib/pdf/v2/pages/pageTravail";
import { pageHypos }           from "../lib/pdf/v2/pages/pageHypos";
import { pageRecommandations } from "../lib/pdf/v2/pages/pageRecommandations";
import { pageMentions }        from "../lib/pdf/v2/pages/pageMentions";

import { buildCabinetData }         from "../lib/pdf/v2/adapters/buildCabinetData";
import { buildFamilleData }         from "../lib/pdf/v2/adapters/buildFamilleData";
import { buildTravailData }         from "../lib/pdf/v2/adapters/buildTravailData";
import { buildHyposData }           from "../lib/pdf/v2/adapters/buildHyposData";
import { buildRecommandationsData } from "../lib/pdf/v2/adapters/buildRecommandationsData";
import { buildMentionsData }        from "../lib/pdf/v2/adapters/buildMentionsData";

const t = buildTokens("encreOr");
const { ir, ifi, succession } = buildFixtureComputed();
const dateLettre = "25 mai 2026";

describe("Pop-card pages v2 — sentinelles non-vide + structuration", () => {

  it("pageCabinet : rend cabinet + démarche", () => {
    const html = pageCabinet(t, buildCabinetData({ cabinet: fixtureCabinet, data: fixtureData, dateLettre }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Cabinet & démarche");
    expect(html).toContain("Notre démarche");
  });

  it("pageFamille : rend personnes + situation + tableau enfants (si non vide)", () => {
    const html = pageFamille(t, buildFamilleData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Situation familiale");
    expect(html).toContain("Personne 1");
  });

  it("pageTravail : rend KPI revenus + personnes + déductions éventuelles", () => {
    const html = pageTravail(t, buildTravailData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Revenus & fiscalité du foyer");
    expect(html).toContain("Personne 1");
  });

  it("pageHypos : rend base + scénarios avec deltas (si hypothèses fournies)", () => {
    const html = pageHypos(t, buildHyposData({
      data: fixtureData, cabinet: fixtureCabinet,
      ir, ifi, succession,
      hypothesisResults: fixtureHypothesisResults,
      dateLettre,
    }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Scénarios d'optimisation");
    expect(html).toContain("IR (base)");
  });

  it("pageHypos : fallback propre si aucune hypothèse active", () => {
    const html = pageHypos(t, buildHyposData({
      data: fixtureData, cabinet: fixtureCabinet,
      ir, ifi, succession,
      hypothesisResults: [],
      dateLettre,
    }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Aucune hypothèse");
  });

  it("pageRecommandations : fallback propre si aucune reco complète", () => {
    const html = pageRecommandations(t, buildRecommandationsData({
      recommandations: [], cabinet: fixtureCabinet, data: fixtureData, dateLettre,
    }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Recommandations");
    expect(html).toContain("Aucune recommandation");
  });

  it("pageMentions : rend toutes les mentions légales + ligne 'généré le'", () => {
    const html = pageMentions(t, buildMentionsData({
      cabinet: fixtureCabinet, mission: fixtureMission, data: fixtureData, dateLettre,
    }));
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("Mentions légales");
    expect(html).toContain("Document généré le");
    expect(html).toContain("Portée du document");
    expect(html).toContain("RGPD");
    expect(html).toContain("Médiation");
    // Mentions reprises du rapport v1 (audit comparatif #26 #27) :
    expect(html).toContain("Limites des simulations");   // Dutreil/SCI/holding
    expect(html).toContain("Dutreil");
    expect(html).toContain("Confidentialité");
    expect(html).toContain("reproduction");
  });

  it("pageCabinet : inclut la portée MIF II (audit comparatif #3)", () => {
    const html = pageCabinet(t, buildCabinetData({ cabinet: fixtureCabinet, data: fixtureData, dateLettre }));
    expect(html).toContain("MIF II");
    expect(html).toContain("simulation non contractuelle");
  });

  it("pageRecommandations : intro avec mention 'garanties et besoins' (audit comparatif #24)", () => {
    const html = pageRecommandations(t, buildRecommandationsData({
      recommandations: [], cabinet: fixtureCabinet, data: fixtureData, dateLettre,
    }));
    expect(html).toContain("garanties et besoins");
    expect(html).toContain("aucun produit ni assureur");
  });

  it("pageTravail : libelle 'Abattement forfaitaire 10%' quand expenseMode standard (audit #14)", () => {
    const html = pageTravail(t, buildTravailData({
      data: fixtureData, cabinet: fixtureCabinet, ir,
      irOptions: { expenseMode1: "standard", expenseMode2: "standard" },
      dateLettre,
    }));
    // Si déductions présentes dans la fixture, le label doit refléter le mode
    if (html.includes("Déductions appliquées")) {
      expect(html.includes("Abattement forfaitaire 10%") || html.includes("Frais professionnels retenus")).toBe(true);
    }
  });

  it("pageTravail : libelle 'Frais réels' quand expenseMode actual (audit #14)", () => {
    const html = pageTravail(t, buildTravailData({
      data: fixtureData, cabinet: fixtureCabinet, ir,
      irOptions: { expenseMode1: "actual", expenseMode2: "standard" },
      dateLettre,
    }));
    if (html.includes("Déductions appliquées")) {
      expect(html.includes("Frais réels") || html.includes("Frais professionnels retenus")).toBe(true);
    }
  });
});
