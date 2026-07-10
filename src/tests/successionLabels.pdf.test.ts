// LOT 11 G2 — Cohérence des LIBELLÉS de périmètre succession (écran↔PDF) + décomposition
// 990 I / 757 B. Règle : un même chiffre porte le même nom des deux côtés ; un nom ne
// s'applique qu'à la valeur qui lui correspond.
import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { euro } from "../lib/pdf/v2/primitives";
import { pageSuccessionA, type SuccessionAPageData } from "../lib/pdf/v2/pages/pageSuccessionA";
import { pageSuccessionB } from "../lib/pdf/v2/pages/pageSuccessionB";
import { buildSuccessionBData } from "../lib/pdf/v2/adapters/buildSuccessionBData";

const t = buildTokens("encreOr");

const dSuccA: SuccessionAPageData = {
  clientName: "TEST", dateStr: "10 juillet 2026",
  masseSuccessoraleNette: 1_974_000, droitsSuccession: 149_842, netTransmis: 1_824_158, tauxMoyen: "7,6 %",
  noteKpi: "Masse civile, hors assurance-vie et PER.",
  devolutionBadge: "Dévolution légale", devolutionDescription: "2 enfants · conjoint",
  reservePct: 67, reserveLabel: "Réserve · 2/3", reserveMontant: 1_322_580,
  quotitePct: 33, quotiteLabel: "Quotité · 1/3", quotiteMontant: 651_420,
  heritiers: [{ nom: "Héritier", lien: "Enfant", partRecue: 900_000, droits: 100_000, net: 800_000 }],
  notreLecture: "…", pagePosition: "4 / 8", cabinetLibellePied: "Cabinet · confidentiel",
};

describe("Succession — libellés de périmètre alignés sur l'écran 10a", () => {
  it("Page A : « Actif successoral net » + « Net transmis — succession civile », plus de libellé nu", () => {
    const html = pageSuccessionA(t, dSuccA);
    expect(html).toContain("Actif successoral net");
    expect(html).toContain("Net transmis — succession civile");
    expect(html).not.toContain("Masse successorale nette");
    // « Net transmis » nu (sans suffixe) ne doit plus exister en page A.
    expect(html).not.toMatch(/>Net transmis<\/div>/);
  });

  it("Page B : net AV et total consolidé portent les libellés écran mot pour mot", () => {
    const d = buildSuccessionBData({
      succession: {
        activeNet: 1_974_000, totalSuccessionRights: 149_842,
        avLines: [{ beneficiary: "Enfant", relation: "enfant", amount: 200_000, amountBefore70Capital: 200_000, before70Tax: 0, after70Tax: 0, totalTax: 0 }],
        results: [],
      },
      data: { person1FirstName: "A", person1LastName: "B", coupleStatus: "married" },
      cabinet: { cabinetName: "Cabinet" },
    });
    expect(d.totalLabelHaut).toBe("Net transmis — tous bénéficiaires");
    const html = pageSuccessionB(t, d);
    expect(html).toContain("Net transmis — assurances-vie (tous bénéficiaires)");
    expect(html).toContain("Net transmis — tous bénéficiaires");
    expect(html).not.toContain("Net aux bénéficiaires");
    expect(html).not.toContain("Total transmis net aux proches");
  });
});

describe("Succession B — abattement selon le régime réel (990 I / 757 B)", () => {
  const mk = () => buildSuccessionBData({
    succession: {
      activeNet: 0, totalSuccessionRights: 0,
      avLines: [
        // 990 I pur (part avant 70 ans) → abattement individuel 152 500 €.
        { beneficiary: "Avant70", relation: "enfant", amount: 200_000, amountBefore70Capital: 200_000, before70Tax: 5_000, after70Tax: 0, totalTax: 5_000 },
        // 757 B pur (part après 70 ans) → PAS d'abattement individuel (global 30 500 €).
        { beneficiary: "Apres70", relation: "enfant", amount: 100_000, amountBefore70Capital: 0, before70Tax: 0, after70Tax: 3_000, totalTax: 3_000 },
        // Mixte → abattement 990 I présent + décomposition visible.
        { beneficiary: "Mixte", relation: "enfant", amount: 300_000, amountBefore70Capital: 150_000, before70Tax: 2_000, after70Tax: 1_000, totalTax: 3_000 },
      ],
      results: [],
    },
    data: { person1FirstName: "A", person1LastName: "B" },
    cabinet: { cabinetName: "Cabinet" },
  });

  it("adapter : tax990I/tax757B propagés ; abattement 990 I = 0 pour un bénéficiaire 757 B pur", () => {
    const d = mk();
    const byName = Object.fromEntries(d.beneficiaires.map((b) => [b.nom, b]));
    expect(byName["Avant70"].abattement990I).toBe(152_500);
    expect(byName["Avant70"].tax990I).toBe(5_000);
    expect(byName["Avant70"].tax757B).toBe(0);
    expect(byName["Apres70"].abattement990I).toBe(0);            // 757 B pur → pas d'abattement individuel
    expect(byName["Apres70"].tax757B).toBe(3_000);
    expect(byName["Mixte"].abattement990I).toBe(152_500);
    expect(byName["Mixte"].tax990I).toBe(2_000);
    expect(byName["Mixte"].tax757B).toBe(1_000);
  });

  it("page : « — » pour le 757 B pur, décomposition pour le mixte, 30 500 € global en note", () => {
    const html = pageSuccessionB(t, mk());
    expect(html).toContain("—");                    // abattement du 757 B pur
    expect(html).toContain(`990 I : ${euro(2_000)} · 757 B : ${euro(1_000)}`); // décomposition du mixte
    // 757 B présenté comme GLOBAL (séparateur de milliers indifférent), jamais par bénéficiaire.
    expect(html).toMatch(/abattement global de 30.500 €/);
    expect(html).not.toMatch(/30.500 € par bénéficiaire/);
  });
});
