// Tests purs de computeBudget (Lot A budget). Fonction pure -> pas de montage
// composant. Fixtures minimales castees (seuls les champs lus sont fournis).
// Valeurs verifiees a la main : tout est annuel /12, charges courantes MENSUELLES
// utilisees telles quelles.

import { describe, it, expect } from "vitest";
import { computeBudget } from "../lib/calculs/budget";
import { computeBeneficeImposable } from "../lib/calculs/ir";
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

// Bien locatif : loyers bruts + charges foncieres, SANS credit (loanEnabled false).
function bienLocatif(over: Record<string, any> = {}) {
  return {
    loanEnabled: false, rentGrossAnnual: "24000",
    propertyTaxAnnual: "1200", insuranceAnnual: "600", worksAnnual: "0", otherChargesAnnual: "600",
    ...over,
  };
}

describe("computeBudget — cas nominal complet (valeurs a la main)", () => {
  // person1 salarie 36000 ; person2 micro-BIC services CA 24000 -> benefice 12000.
  const benef2 = computeBeneficeImposable(24000, "services", false, false, true, 0, 0);
  const data = mkData({
    person1PcsGroupe: "4", salary1: "36000",
    person2PcsGroupe: "2", person2Csp: "", ca2: "24000", bicType2: "services", microRegime2: true,
    pensions1: "6000", pensions2: "",
    perRentes: [{ owner: "person1", annualAmount: "12000", ageAtFirst: "65" }],
    properties: [bienLocatif()],
    placements: [
      { type: "AV", annualWithdrawal: "6000" },
      { type: "PER assurantiel", perWithdrawal: "3600" },
    ],
    otherLoans: [{ monthlyPayment: "500", hasInsurance: false, insurancePremium: "0" }],
    chargesCourantes: "2000",
    pensionDeductible: "3600",
  });
  const r = computeBudget(data, { finalIR: 18000 });

  it("benefice TNS micro-BIC services = 12000 (cross-check)", () => {
    expect(benef2).toBe(12000);
  });

  it("detail des revenus mensuels", () => {
    expect(r.detail.salairesPensions).toBeCloseTo(3500, 6); // (36000 + 6000)/12
    expect(r.detail.beneficeTns).toBeCloseTo(1000, 6);      // 12000/12
    expect(r.detail.rentesPer).toBeCloseTo(1000, 6);        // 12000/12
    expect(r.detail.loyersBruts).toBeCloseTo(2000, 6);      // 24000/12 (100 %)
    expect(r.detail.retraitsAvPer).toBeCloseTo(800, 6);     // (6000 + 3600)/12
  });

  it("detail des charges mensuelles", () => {
    expect(r.detail.chargesCourantes).toBeCloseTo(2000, 6); // global, mensuel tel quel
    expect(r.detail.chargesCourantesIsDetail).toBe(false);
    expect(r.detail.chargesFoncieres).toBeCloseTo(200, 6);  // (1200+600+0+600)/12
    expect(r.detail.creditsAssurances).toBeCloseTo(500, 6); // 500 x12 /12
    expect(r.detail.impots).toBeCloseTo(1500, 6);           // 18000/12
    expect(r.detail.pensionVersee).toBeCloseTo(300, 6);     // 3600/12
  });

  it("agregats + capacite d'epargne", () => {
    expect(r.revenusMensuels).toBeCloseTo(8300, 6);   // 3500+1000+1000+2000+800
    expect(r.chargesMensuelles).toBeCloseTo(4500, 6); // 2000+200+500+1500+300
    expect(r.capaciteEpargne).toBeCloseTo(3800, 6);   // 8300 - 4500
    expect(r.hasChargesCourantes).toBe(true);
  });

  it("invariant : somme du detail == agregats", () => {
    const dr = r.detail;
    const sommeRev = dr.salairesPensions + dr.beneficeTns + dr.rentesPer + dr.loyersBruts + dr.retraitsAvPer;
    const sommeChg = dr.chargesCourantes + dr.chargesFoncieres + dr.creditsAssurances + dr.impots + dr.pensionVersee;
    expect(sommeRev).toBeCloseTo(r.revenusMensuels, 9);
    expect(sommeChg).toBeCloseTo(r.chargesMensuelles, 9);
  });
});

describe("computeBudget — charges courantes : detail vs global (barriere douce)", () => {
  it("aucun poste + global renseigne -> global (isDetail=false)", () => {
    const r = computeBudget(mkData({ chargesCourantes: "1500" }), { finalIR: 0 });
    expect(r.detail.chargesCourantes).toBe(1500);
    expect(r.detail.chargesCourantesIsDetail).toBe(false);
    expect(r.hasChargesCourantes).toBe(true);
  });

  it(">= 1 poste renseigne -> somme du detail prime sur le global", () => {
    const r = computeBudget(mkData({
      chargesCourantes: "9999", // doit etre IGNORE
      chargesCourantesDetail: { ...EMPTY_CHARGES_COURANTES_DETAIL, loyerRP: "800", energie: "200" },
    }), { finalIR: 0 });
    expect(r.detail.chargesCourantes).toBe(1000); // 800 + 200, PAS 9999
    expect(r.detail.chargesCourantesIsDetail).toBe(true);
  });

  it("poste '0' = renseigne -> detail (somme 0), global ignore", () => {
    const r = computeBudget(mkData({
      chargesCourantes: "9999",
      chargesCourantesDetail: { ...EMPTY_CHARGES_COURANTES_DETAIL, loyerRP: "0" },
    }), { finalIR: 0 });
    expect(r.detail.chargesCourantes).toBe(0);    // "0" est une valeur, prime sur 9999
    expect(r.detail.chargesCourantesIsDetail).toBe(true);
    expect(r.hasChargesCourantes).toBe(true);
  });

  it("rien de renseigne -> 0, hasChargesCourantes=false", () => {
    const r = computeBudget(mkData({}), { finalIR: 0 });
    expect(r.detail.chargesCourantes).toBe(0);
    expect(r.detail.chargesCourantesIsDetail).toBe(false);
    expect(r.hasChargesCourantes).toBe(false);
  });
});

describe("computeBudget — flux mobiliers : seuls les retraits comptent", () => {
  it("aucun retrait -> retraitsAvPer=0 ; taxableIncome present est IGNORE", () => {
    const r = computeBudget(mkData({
      salary1: "24000",
      placements: [
        { type: "PEA", taxableIncome: "5000", annualIncome: "9999" }, // aucun retrait
        { type: "AV", annualWithdrawal: "", perWithdrawal: "" },
      ],
    }), { finalIR: 0 });
    expect(r.detail.retraitsAvPer).toBe(0);
    // Le revenu mensuel = seulement le salaire (24000/12 = 2000) : taxableIncome exclu.
    expect(r.revenusMensuels).toBeCloseTo(2000, 6);
  });

  it("retraits AV + PER comptes ; taxableIncome du meme placement toujours ignore", () => {
    const r = computeBudget(mkData({
      placements: [{ type: "AV", annualWithdrawal: "6000", taxableIncome: "5000" }],
    }), { finalIR: 0 });
    expect(r.detail.retraitsAvPer).toBeCloseTo(500, 6); // 6000/12, le 5000 est ignore
    expect(r.revenusMensuels).toBeCloseTo(500, 6);
  });
});

describe("computeBudget — pensions : meme regle de fallback que l'IR", () => {
  it("nominatifs priment (jamais la somme des 3)", () => {
    const r = computeBudget(mkData({
      pensions1: "12000", pensions2: "6000", pensions: "99999",
    }), { finalIR: 0 });
    // (12000 + 6000)/12 = 1500, PAS (12000+6000+99999)/12
    expect(r.detail.salairesPensions).toBeCloseTo(1500, 6);
  });

  it("fallback sur le global si nominatifs vides", () => {
    const r = computeBudget(mkData({ pensions: "24000", pensions1: "", pensions2: "" }), { finalIR: 0 });
    expect(r.detail.salairesPensions).toBeCloseTo(2000, 6); // 24000/12
  });

  it("un seul nominatif renseigne -> nominatifs (global ignore)", () => {
    const r = computeBudget(mkData({ pensions1: "12000", pensions2: "", pensions: "99999" }), { finalIR: 0 });
    expect(r.detail.salairesPensions).toBeCloseTo(1000, 6); // 12000/12, PAS le global
  });
});

describe("computeBudget — capacite d'epargne", () => {
  it("peut etre NEGATIVE (pas de clamp)", () => {
    // Revenus faibles, gros impot + charges courantes -> deficit.
    const r = computeBudget(mkData({
      salary1: "12000",           // 1000/mois
      chargesCourantes: "1500",   // 1500/mois
    }), { finalIR: 6000 });       // 500/mois
    // revenus 1000 - charges (1500 + 500) = -1000
    expect(r.revenusMensuels).toBeCloseTo(1000, 6);
    expect(r.chargesMensuelles).toBeCloseTo(2000, 6);
    expect(r.capaciteEpargne).toBeCloseTo(-1000, 6);
    expect(r.capaciteEpargne).toBeLessThan(0);
  });

  it("impots = ir.finalIR / 12 (finalIR deja tout-compris, pas de double-compte PFU/PS)", () => {
    const r = computeBudget(mkData({ salary1: "0" }), { finalIR: 12000, totalPFU: 5000, foncierSocialLevy: 2000 });
    // Seul finalIR compte : 12000/12 = 1000 ; totalPFU/foncierSocialLevy NON reajoutes.
    expect(r.detail.impots).toBeCloseTo(1000, 6);
    expect(r.chargesMensuelles).toBeCloseTo(1000, 6);
  });
});
