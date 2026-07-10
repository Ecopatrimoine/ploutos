// Lot D — section "Budget & capacite d'epargne" du bilan endettement PDF.
// Patron des tests d'adapters : appel reel de l'adapter avec la fixture PDF,
// verification que la section budget == computeBudget (source unique), reserve
// conditionnelle, et rendu du bloc dans la page (avant la cascade, tokens).

import { describe, it, expect } from "vitest";
import { pct } from "../lib/calculs/utils";
import { buildBilanEndettementData } from "../lib/pdf/v2/adapters/buildBilanEndettementData";
import { pageBilanEndettement } from "../lib/pdf/v2/pages/pageBilanEndettement";
import { computeBudget } from "../lib/calculs/budget";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { fixtureData, fixtureCabinet, buildFixtureComputed } from "./__fixtures__/pdfFixture";

const { ir } = buildFixtureComputed();
const t = buildTokens("encreOr");
const dateLettre = "25 mai 2026";

describe("buildBilanEndettementData — section budget (Lot D)", () => {
  it("expose budget = computeBudget (source unique, aucun recalcul local)", () => {
    const d = buildBilanEndettementData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre });
    const b = computeBudget(fixtureData as any, ir);
    expect(d.budget).toBeDefined();
    const bg = d.budget!;
    expect(bg.salairesPensions).toBeCloseTo(b.detail.salairesPensions, 6);
    expect(bg.beneficeTns).toBeCloseTo(b.detail.beneficeTns, 6);
    expect(bg.rentesPer).toBeCloseTo(b.detail.rentesPer, 6);
    expect(bg.loyersBruts).toBeCloseTo(b.detail.loyersBruts, 6);
    expect(bg.retraitsAvPer).toBeCloseTo(b.detail.retraitsAvPer, 6);
    expect(bg.revenusMensuels).toBeCloseTo(b.revenusMensuels, 6);
    expect(bg.chargesCourantes).toBeCloseTo(b.detail.chargesCourantes, 6);
    expect(bg.chargesFoncieres).toBeCloseTo(b.detail.chargesFoncieres, 6);
    expect(bg.creditsAssurances).toBeCloseTo(b.detail.creditsAssurances, 6);
    expect(bg.impots).toBeCloseTo(b.detail.impots, 6);
    expect(bg.pensionVersee).toBeCloseTo(b.detail.pensionVersee, 6);
    expect(bg.chargesMensuelles).toBeCloseTo(b.chargesMensuelles, 6);
    expect(bg.capaciteEpargne).toBeCloseTo(b.capaciteEpargne, 6);
    expect(bg.hasChargesCourantes).toBe(b.hasChargesCourantes);
  });

  it("reserve conditionnelle : hasChargesCourantes suit la saisie", () => {
    const sans = buildBilanEndettementData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre });
    expect(sans.budget!.hasChargesCourantes).toBe(false);

    const avec = buildBilanEndettementData({ data: { ...fixtureData, chargesCourantes: "1500" }, cabinet: fixtureCabinet, ir, dateLettre });
    expect(avec.budget!.hasChargesCourantes).toBe(true);
    expect(avec.budget!.chargesCourantes).toBeCloseTo(1500, 6);
  });
});

describe("pageBilanEndettement — rendu du bloc budget (Lot D)", () => {
  it("bloc budget rendu AVANT la cascade, libelles cles + coexistence des 2 bases loyers", () => {
    const html = pageBilanEndettement(t, buildBilanEndettementData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre }));
    expect(html).toContain("Budget et capacité d'épargne");
    expect(html).toContain("Impôts calculés (IR tout compris)");
    expect(html).toContain("Loyers à 100 % (approche budget)"); // approche budget
    expect(html).toContain(`Loyers retenus (${pct(0.70)})`);            // methode bancaire inchangee
    expect(html.indexOf("Budget et capacité d'épargne")).toBeLessThan(html.indexOf("Répartition du patrimoine net"));
  });

  it("reserve affichee quand charges courantes non renseignees", () => {
    const html = pageBilanEndettement(t, buildBilanEndettementData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre }));
    expect(html).toContain("hors charges courantes non renseignées");
  });

  it("teinte du solde via tokens : succes si >=0, danger si <0 (aucun hex en dur)", () => {
    const base = buildBilanEndettementData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre });
    const pos = pageBilanEndettement(t, { ...base, budget: { ...base.budget!, capaciteEpargne: 500 } });
    expect(pos).toContain(`font-weight:700;color:${t.succes}`);
    const neg = pageBilanEndettement(t, { ...base, budget: { ...base.budget!, capaciteEpargne: -500 } });
    expect(neg).toContain(`font-weight:700;color:${t.danger}`);
  });
});
