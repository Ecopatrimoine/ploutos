// LOT B2 (restitution PDF pédagogique) — chaine reelle computeIR -> buildIRData ->
// pageIR (HTML rendu). Tuile KPI = tranche STATUTAIRE ("TRANCHE MARG.") ; la TMI
// effective vit dans un ENCART "votre taux marginal reel" (patron alerte douce), present
// SEULEMENT en cas de divergence, toujours avec son mini-calcul. 1 test par cas :
// normal (sans encart) / decote / plafonnement / cumul / frontiere / forfaitaire.
import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { computeIR } from "../lib/calculs/ir";
import { buildIRData } from "../lib/pdf/v2/adapters/buildIRData";
import { pageIR } from "../lib/pdf/v2/pages/pageIR";
import { renderBracketChartSVG } from "../lib/pdf/v2/bracketChart";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const t = buildTokens("encreOr");
const OPTS = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const base = (o: any = {}) => ({
  person1FirstName: "A", person1LastName: "Test", person1BirthDate: "1975-01-01", person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "0", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [], ...o,
} as any);
const child = (b: string) => ({ schoolLevel: "", custody: "full", handicap: false, lastName: "K", birthDate: b, firstName: "E", rattached: true, parentLink: "common_child" });
const cto = (ti: string) => ({ id: "cto", name: "CTO", type: "Compte-titres", ownership: "person1", value: "80000", annualIncome: "", taxableIncome: ti, deathValue: "", openDate: "", pfuEligible: true, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: false, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [] });

const dataOf = (d: any) => buildIRData({ ir: computeIR(d, OPTS), data: d, cabinet: {}, clientName: "Test" });
const pageOf = (d: any) => pageIR(t, dataOf(d));

const D1 = base({ salary1: "12000", placements: [cto("9740")] });                                             // forfaitaire (Perry)
const D2 = base({ coupleStatus: "married", salary1: "120000", childrenData: [child("2016-01-01"), child("2012-01-01"), child("2009-01-01")] }); // plafonnement QF
const D3 = base({ salary1: "25000" });                                                                        // decote
const NORMAL = base({ salary1: "60000" });                                                                    // effective == tranche
const NORMAL_PFU = base({ salary1: "60000", placements: [cto("5000")] });                                     // normal + forfaitaire
const FRONTIERE = base({ salary1: "93900" });                                                                 // quotient 84 510 -> +100 franchit 84 577

describe("Lot B2 — tuile KPI reste la tranche statutaire", () => {
  it("D2 : tuile 'TRANCHE MARG.' = 11,0 % (statutaire), PAS 'TAUX MARGINAL'", () => {
    expect(dataOf(D2).trancheMarginale).toBe("11,0 %");
    const h = pageOf(D2);
    expect(h).toContain("TRANCHE MARG.");
    expect(h).not.toContain("TAUX MARGINAL");
  });
});

describe("Lot B2 — encart 'votre taux marginal reel' (1 par cas)", () => {
  it("normal : AUCUN encart, phrase 'chaque euro'", () => {
    expect(dataOf(NORMAL).tmiCase).toBe("normal");
    expect(dataOf(NORMAL).tmiEncart).toBeUndefined();
    const h = pageOf(NORMAL);
    expect(h).not.toContain("Votre taux marginal réel");
    expect(h).toContain("chaque euro supplémentaire de revenu imposable est taxé à ce taux");
  });
  it("decote : encart avec mini-calcul (barème + décote perdue)", () => {
    const d = dataOf(D3);
    expect(d.tmiCase).toBe("decote");
    const h = pageOf(D3);
    expect(h).toContain("Votre taux marginal réel");
    expect(h).toContain("15,98 %");
    expect(h).toContain("et non 11 %");
    expect(h).toContain("+11,00 € de barème");
    expect(h).toContain("de décote perdue");
    expect(h).toContain("= 15,98 €");
    expect(h).toContain("voir l'encadré"); // Notre lecture renvoie a l'encart
  });
  it("plafonnement : encart 'foyer de 2 parts', graphe plafonné conservé", () => {
    const d = dataOf(D2);
    expect(d.tmiCase).toBe("plafonnement");
    const h = pageOf(D2);
    expect(h).toContain("Votre taux marginal réel");
    expect(h).toContain("30 %</strong> (et non 11 %)");
    expect(h).toContain("avantage de quotient familial est plafonné");
    expect(h).toContain("foyer de 2 parts");
    expect(h).toContain("data-chart-annotation"); // graphe Lot B conservé
  });
  it("frontiere : pas de taux hybride, distance au seuil + tranche suivante", () => {
    const d = dataOf(FRONTIERE);
    expect(d.tmiCase).toBe("frontiere");
    const h = pageOf(FRONTIERE);
    expect(h).toContain("Vous approchez d'une tranche");
    expect(h).toContain("du passage dans la tranche à 41 %");
    expect(h).not.toContain("Votre taux marginal réel"); // titre distinct, pas de taux reel affiche
  });
  it("forfaitaire (Perry) : PAS d'encart, message PFU conservé", () => {
    const d = dataOf(D1);
    expect(d.tmiCase).toBe("forfaitaire");
    expect(d.tmiEncart).toBeUndefined();
    const h = pageOf(D1);
    expect(h).not.toContain("Votre taux marginal réel");
    expect(h).toContain("Barème : 0 %");
    expect(h).toContain("imposition forfaitaire de vos revenus de capitaux");
  });
  it("cumul (synthétique) : plafonnement + incise décote", () => {
    const mockIr = { finalIR: 5000, bareme: 500, marginalRate: 0.11, marginalRateEffectif: 0.16, decoteMontant: 200, plafonnementQfActif: true, quotientFamilialCapAdjustment: 1500, totalPFU: 0, averageRate: 0.05, quotient: 25000, parts: 3, bracketFill: [] };
    const d = buildIRData({ ir: mockIr, data: { coupleStatus: "married" }, cabinet: {}, clientName: "Test" });
    expect(d.tmiCase).toBe("cumul");
    expect(d.tmiEncart?.texteHtml).toContain("plafonné");
    expect(d.tmiEncart?.texteHtml).toMatch(/écrêtement 1.500 €/);          // 1 500 (espace insécable)
    expect(d.tmiEncart?.texteHtml).toContain("s'y ajoute la décote (200 €)");
    expect(d.tmiEncart?.texteHtml).toContain("foyer de 2 parts");
  });
});

describe("Lot B3 — histogramme (étiquettes + réconciliation)", () => {
  it("étiquettes barres IR : 'd'impôt' au-dessus, 'logés' sous les bornes, en-tête reformulé", () => {
    const h = pageOf(NORMAL);
    expect(h).toContain("d'impôt");
    expect(h).toContain("logés");
    expect(h).toContain("Chaque barre");
  });
  it("réconciliation D4 normal : ligne unique 'impôt barème net … (aucune décote ni plafonnement)'", () => {
    const d = dataOf(NORMAL);
    expect(d.reconBaremeLignes?.length).toBe(1);
    expect(d.reconBaremeLignes?.[0]).toMatch(/= impôt barème net 9.304 € \(aucune décote ni plafonnement\)/);
  });
  it("réconciliation D3 décote : somme × parts − décote = impôt barème net", () => {
    const j = (dataOf(D3).reconBaremeLignes || []).join("\n");
    expect(j).toContain("Somme des tranches");
    expect(j).toContain("× 1 part");
    expect(j).toMatch(/décote 354 €/);
    expect(j).toMatch(/= impôt barème net 845 €/);
  });
  it("réconciliation D2 plafonnement : part de la référence 2 parts moins le plafond (cohérent barres)", () => {
    const j = (dataOf(D2).reconBaremeLignes || []).join("\n");
    expect(j).toMatch(/Somme des tranches \(référence 2 parts\) 9.304 € × 2 = 18.608 €/);
    expect(j).toContain("plafonnement du quotient familial");
    expect(j).toMatch(/= impôt barème net 11.380 €/); // 18 608 − 7 228 = 11 380
  });
});

describe("Lot B2 — invariants restitution (forfaitaire, PFU, graphe, byte-identité)", () => {
  it("normal + forfaitaire : seconde phrase PFU en sus", () => {
    const h = pageOf(NORMAL_PFU);
    expect(h).toContain("chaque euro supplémentaire de revenu imposable est taxé à ce taux");
    expect(h).toContain("Vos revenus de capitaux sont par ailleurs imposés au forfait");
    expect(h).toContain("PFU 31,4 %");
  });
  it("graphe non plafonné : aucune annotation ; byte-identité de l'opt annotation", () => {
    expect(pageOf(D3)).not.toContain("data-chart-annotation");
    const fill = computeIR(NORMAL, OPTS).bracketFill;
    const ref = computeIR(NORMAL, OPTS).quotient;
    const sans = renderBracketChartSVG(fill, t, { referenceValue: ref, badgeActif: "TMI", formatBorne: "euro" });
    const undef = renderBracketChartSVG(fill, t, { referenceValue: ref, badgeActif: "TMI", formatBorne: "euro", annotation: undefined });
    expect(undef).toBe(sans);
  });
});
