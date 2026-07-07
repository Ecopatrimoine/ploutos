// LOT 1bis (point B) — rebranchement budget / endettement pour les biens meubles.
// Loyers retenus = recettes resolues (meme resolver que le moteur BIC) ; charges
// budget du meuble = chargesReelles + taxe + assurance. Non-regression : iso
// avant/apres saisie du champ recettes quand recettes = ancien loyer brut ;
// dossier sans meuble = iso strict.
import { describe, it, expect } from "vitest";
import { computeTauxEndettement } from "../lib/calculs/endettement";
import { computeBudget } from "../lib/calculs/budget";
import { EMPTY_CHARGES_COURANTES_DETAIL } from "../constants";
import type { PatrimonialData } from "../types/patrimoine";

function mkData(over: Record<string, any>): PatrimonialData {
  return {
    salary1: "0", salary2: "0", pensions: "0", pensions1: "", pensions2: "",
    person1PcsGroupe: "", person2PcsGroupe: "", person1Csp: "", person2Csp: "",
    ca1: "0", ca2: "0", bicType1: "", bicType2: "",
    microRegime1: false, microRegime2: false,
    chargesReelles1: "0", chargesReelles2: "0", baRevenue1: "0", baRevenue2: "0",
    properties: [], otherLoans: [], placements: [], perRentes: [],
    pensionDeductible: "0",
    chargesCourantes: "", chargesCourantesDetail: { ...EMPTY_CHARGES_COURANTES_DETAIL },
    ...over,
  } as unknown as PatrimonialData;
}
const meuble = (over: Record<string, any> = {}) => ({ type: "LMNP", loanEnabled: false, rentGrossAnnual: "10000", ...over });
const nue = (over: Record<string, any> = {}) => ({ type: "Location nue", loanEnabled: false, rentGrossAnnual: "10000", ...over });
const IR = { finalIR: 0 } as any;

describe("Meuble 1bis — endettement (loyers via recettes resolues)", () => {
  it("iso avant/apres saisie recettes = ancien loyer brut (10000)", () => {
    const avant = computeTauxEndettement(mkData({ properties: [meuble()] }));
    const apres = computeTauxEndettement(mkData({ properties: [meuble({ recettesAnnuelles: "10000" })] }));
    expect(avant.denominateurAnnuel).toBe(7000); // 10000 x 0,70 (fallback loyer)
    expect(apres.denominateurAnnuel).toBe(7000); // recettes = loyer -> iso
  });
  it("recettes differentes -> loyers suivent les recettes", () => {
    const r = computeTauxEndettement(mkData({ properties: [meuble({ recettesAnnuelles: "15000" })] }));
    expect(r.denominateurAnnuel).toBe(10500); // 15000 x 0,70
  });
  it("bien NON meuble : iso strict (rentGrossAnnual)", () => {
    const r = computeTauxEndettement(mkData({ properties: [nue()] }));
    expect(r.denominateurAnnuel).toBe(7000);
  });
});

describe("Meuble 1bis — budget (loyers + charges resolus)", () => {
  it("loyers : iso avant/apres saisie recettes = ancien loyer brut", () => {
    const avant = computeBudget(mkData({ properties: [meuble({ propertyTaxAnnual: "1000", insuranceAnnual: "500" })] }), IR);
    const apres = computeBudget(mkData({ properties: [meuble({ recettesAnnuelles: "10000", propertyTaxAnnual: "1000", insuranceAnnual: "500" })] }), IR);
    expect(avant.detail.loyersBruts).toBeCloseTo(10000 / 12, 6);
    expect(apres.detail.loyersBruts).toBeCloseTo(10000 / 12, 6);
  });
  it("charges meuble = chargesReelles + taxe + assurance (otherCharges ignore)", () => {
    const r = computeBudget(mkData({ properties: [meuble({ chargesReelles: "2000", propertyTaxAnnual: "1000", insuranceAnnual: "500", otherChargesAnnual: "9999" })] }), IR);
    expect(r.detail.chargesFoncieres).toBeCloseTo(3500 / 12, 6); // 2000 + 1000 + 500, PAS 9999
  });
  it("bien NON meuble : charges generiques inchangees", () => {
    const r = computeBudget(mkData({ properties: [nue({ propertyTaxAnnual: "1000", insuranceAnnual: "500", worksAnnual: "300", otherChargesAnnual: "200" })] }), IR);
    expect(r.detail.chargesFoncieres).toBeCloseTo(2000 / 12, 6); // 1000+500+300+200
  });
});
