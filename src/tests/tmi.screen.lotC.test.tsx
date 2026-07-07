// @vitest-environment jsdom
// LOT C (écran TabIR, miroir B2/B3) — le helper de vue PARTAGÉ computeTmiView est la
// SOURCE UNIQUE écran/PDF. On teste : (1) l'encart conditionnel par cas (pure), (2)
// l'équivalence écran = PDF sur les mêmes données (buildIRData délègue au helper), (3)
// le rendu écran du bloc réconciliation + note (BracketFillChart, hors ResponsiveContainer).
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { computeIR } from "../lib/calculs/ir";
import { computeTmiView } from "../lib/calculs/tmiEffective";
import { buildIRData } from "../lib/pdf/v2/adapters/buildIRData";
import { BracketFillChart, MetricCard } from "../components/shared";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const OPTS = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const base = (o: any = {}) => ({
  person1FirstName: "A", person1LastName: "T", person1BirthDate: "1975-01-01", person1Csp: "47", person1PcsGroupe: "4", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false, person1Handicap: false, person2Handicap: false,
  childrenData: [], salary1: "0", salary2: "0", pensions: "0", perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [], ...o,
} as any);
const child = (b: string) => ({ schoolLevel: "", custody: "full", handicap: false, lastName: "K", birthDate: b, firstName: "E", rattached: true, parentLink: "common_child" });
const cto = (ti: string) => ({ id: "cto", name: "CTO", type: "Compte-titres", ownership: "person1", value: "80000", annualIncome: "", taxableIncome: ti, pfuEligible: true, pfuOptOut: false, beneficiaries: [] });
const isCoupleOf = (d: any) => d.coupleStatus === "married" || d.coupleStatus === "pacs";
const viewOf = (d: any) => computeTmiView(computeIR(d, OPTS), isCoupleOf(d));

const D1 = base({ salary1: "12000", placements: [cto("9740")] });                                             // forfaitaire
const D2 = base({ coupleStatus: "married", salary1: "120000", childrenData: [child("2016-01-01"), child("2012-01-01"), child("2009-01-01")] }); // plafonnement
const D3 = base({ salary1: "25000" });                                                                        // decote
const NORMAL = base({ salary1: "60000" });
const FRONTIERE = base({ salary1: "93900" });

describe("Lot C — computeTmiView (encart conditionnel par cas, source partagée)", () => {
  it("normal : aucun encart", () => {
    expect(viewOf(NORMAL).tmiCase).toBe("normal");
    expect(viewOf(NORMAL).encart).toBeUndefined();
  });
  it("forfaitaire : aucun encart (mention PFU gérée à part)", () => {
    expect(viewOf(D1).tmiCase).toBe("forfaitaire");
    expect(viewOf(D1).encart).toBeUndefined();
  });
  it("decote : encart mini-calcul (lead 15,98 %, barème + décote perdue)", () => {
    const e = viewOf(D3).encart!;
    expect(viewOf(D3).tmiCase).toBe("decote");
    expect(e.titre).toBe("Votre taux marginal réel");
    expect(e.leadFort).toBe("15,98 %");
    expect(e.corps).toContain("(et non 11 %)");
    expect(e.corps).toContain("+11,00 € de barème");
    expect(e.corps).toContain("de décote perdue");
  });
  it("plafonnement : encart 'foyer de 2 parts'", () => {
    const e = viewOf(D2).encart!;
    expect(viewOf(D2).tmiCase).toBe("plafonnement");
    expect(e.leadFort).toBe("30 %");
    expect(e.corps).toContain("est plafonné");
    expect(e.corps).toContain("foyer de 2 parts");
  });
  it("frontiere : encart proximité, sans lead (pas de taux hybride)", () => {
    const e = viewOf(FRONTIERE).encart!;
    expect(viewOf(FRONTIERE).tmiCase).toBe("frontiere");
    expect(e.titre).toBe("Vous approchez d'une tranche");
    expect(e.leadFort).toBeUndefined();
    expect(e.corps).toContain("du passage dans la tranche à 41 %");
  });
});

describe("Lot C — équivalence écran = PDF (mêmes données, buildIRData délègue au helper)", () => {
  it("réconciliation D2 : buildIRData == computeTmiView", () => {
    const pdf = buildIRData({ ir: computeIR(D2, OPTS), data: D2, cabinet: {}, clientName: "T" });
    expect(pdf.reconBaremeLignes).toEqual(viewOf(D2).reconBaremeLignes);
  });
  it("encart D3 : le texteHtml PDF se compose de leadFort/corps du helper", () => {
    const pdf = buildIRData({ ir: computeIR(D3, OPTS), data: D3, cabinet: {}, clientName: "T" });
    const e = viewOf(D3).encart!;
    expect(pdf.tmiEncart?.texteHtml).toBe(`<strong>${e.leadFort}</strong> ${e.corps}`);
  });
});

describe("Lot C2 révisé — tmiAffichee + sousTexteCard (source unique card/tuile)", () => {
  it("tmiAffichee : plafonnement -> tranche de référence (0.30) ; sinon tranche statutaire", () => {
    expect(viewOf(D2).tmiAffichee).toBe(0.30);   // plafonnement -> réf-2-parts (et non 0.11)
    expect(viewOf(D3).tmiAffichee).toBe(0.11);   // décote -> statutaire
    expect(viewOf(NORMAL).tmiAffichee).toBe(0.30);
  });
  it("sousTexteCard par cas : plafonnement/decote/frontiere ; absent en normal/forfaitaire", () => {
    expect(viewOf(D2).sousTexteCard).toBe("plafonnement du QF actif — tranche sur le quotient : 11 %");
    expect(viewOf(D3).sousTexteCard).toBe("taux réel : 15,98 % (effet décote) — voir encadré");
    expect(viewOf(FRONTIERE).sousTexteCard).toBe("à 67 € de la tranche à 41 %");
    expect(viewOf(NORMAL).sousTexteCard).toBeUndefined();
    expect(viewOf(D1).sousTexteCard).toBeUndefined();
  });
  it("cohérence écran = PDF : card sousTexteCard == tuile trancheMargSousLabel ; tmiAffichee identique", () => {
    const pdf2 = buildIRData({ ir: computeIR(D2, OPTS), data: D2, cabinet: {}, clientName: "T" });
    const pdf4 = buildIRData({ ir: computeIR(NORMAL, OPTS), data: NORMAL, cabinet: {}, clientName: "T" });
    expect(pdf2.trancheMargSousLabel).toBe(viewOf(D2).sousTexteCard);
    expect(pdf2.tmiAffichee).toBe("30,0 %");                          // tuile PDF = card écran (30 %)
    expect(pdf4.trancheMargSousLabel).toBeUndefined();                // normal : pas de sous-texte
    expect(pdf4.tmiAffichee).toBe(pdf4.trancheMarginale);             // byte-identique
  });
  it("card écran : MetricCard rend valeur principale + sous-texte", () => {
    const { container } = render(
      <MetricCard label="TMI" value={`${Math.round(viewOf(D2).tmiAffichee * 100)} %`} hint="Taux Marginal d'Imposition : tranche du barème sur le quotient" sousTexte={viewOf(D2).sousTexteCard} accent="gold" />,
    );
    const txt = container.textContent || "";
    expect(txt).toContain("30 %");                                    // valeur principale = tranche réelle
    expect(txt).toContain("tranche sur le quotient : 11 %");          // sous-texte
    expect(txt).toContain("tranche du barème sur le quotient");       // libellé permanent
  });
});

describe("Lot C — rendu écran BracketFillChart (réconciliation + note hors chart)", () => {
  it("reconLignes + note rendus (dernière ligne = impôt barème net)", () => {
    const recon = viewOf(D2).reconBaremeLignes;
    const { container } = render(
      <BracketFillChart title="Barème IR" data={[]} referenceValue={0} valueLabel="Quotient (référence 2 parts)" showImpot reconLignes={recon} note="Plafonnement du quotient familial actif — lecture au barème de référence à 2 parts" />,
    );
    const txt = container.textContent || "";
    expect(txt).toContain("Plafonnement du quotient familial actif");
    expect(txt).toContain("= impôt barème net");
    expect(txt).toContain("référence 2 parts");
  });
});
