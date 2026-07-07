// LOT B/B2 (restitution PDF TMI effective) — chaine reelle computeIR -> buildIRData
// -> pageIR (HTML rendu). Ce fichier ne contient ici que les INVARIANTS (vrais en B
// comme en B2) ; les assertions specifiques B2 (tuile statutaire, encart pedagogique,
// frontiere) sont ajoutees apres la refonte B2 (scaffolding golden-master).
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

describe("Lot B — invariants (vrais en B et B2)", () => {
  it("D1 forfaitaire (Perry) : barème 0 %, impôt forfaitaire ; pas de 'chaque euro'", () => {
    const h = pageOf(D1);
    expect(h).toContain("Barème : 0 %");
    expect(h).toContain("l'essentiel de votre impôt");
    expect(h).toContain("imposition forfaitaire de vos revenus de capitaux");
    expect(h).not.toContain("chaque euro supplémentaire");
  });
  it("normal : 'chaque euro supplémentaire de revenu imposable'", () => {
    expect(pageOf(NORMAL)).toContain("chaque euro supplémentaire de revenu imposable est taxé à ce taux");
  });
  it("normal + forfaitaire : seconde phrase PFU", () => {
    const h = pageOf(NORMAL_PFU);
    expect(h).toContain("Vos revenus de capitaux sont par ailleurs imposés au forfait");
    expect(h).toContain("PFU 31,4 %");
  });
  it("graphe D2 plafonné : annotation + barème de référence", () => {
    const h = pageOf(D2);
    expect(h).toContain("data-chart-annotation");
    expect(h).toContain("Plafonnement du quotient familial actif");
    expect(h).toContain("lecture au barème de référence (2 parts)");
  });
  it("graphe non plafonné (D3, normal) : aucune annotation", () => {
    expect(pageOf(D3)).not.toContain("data-chart-annotation");
    expect(pageOf(NORMAL)).not.toContain("data-chart-annotation");
  });
  it("byte-identité : l'opt annotation absente/undefined ne change RIEN au SVG", () => {
    const fill = computeIR(NORMAL, OPTS).bracketFill;
    const ref = computeIR(NORMAL, OPTS).quotient;
    const sans = renderBracketChartSVG(fill, t, { referenceValue: ref, badgeActif: "TMI", formatBorne: "euro" });
    const undef = renderBracketChartSVG(fill, t, { referenceValue: ref, badgeActif: "TMI", formatBorne: "euro", annotation: undefined });
    expect(undef).toBe(sans);
  });
});
