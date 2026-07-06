// LOT 2 — UI défiscalisation financière : prédicats catalogue + round-trip UI -> moteur.
// La card affiche une valeur DÉRIVÉE DU MOTEUR (reductionFinanciereCard) : on prouve
// que le montant affiché == celui calculé par computeIR pour un cas FCPI (C3) et Girardin (C6).
import { describe, it, expect } from "vitest";
import { dispositifsFinanciersPourType, reductionFinanciereCard } from "../lib/calculs/utils";
import { resolveReductionFinanciere } from "../lib/fiscal/dispositifs-financiers-resolveur";
import { SOUS_TYPES_DEFISC_DEDIES } from "../constants";
import { computeIR } from "../lib/calculs/ir";
import { EMPTY_CHARGES_DETAIL } from "../constants";
import { referentiels } from "../data/prevoyance";
import type { Placement } from "../types/patrimoine";

const ANNEE = referentiels.pass.millesime; // 2026

// ─── Prédicats catalogue ──────────────────────────────────────────────────────
describe("catalogue défiscalisation — dispositifsFinanciersPourType", () => {
  it("PEA : AUCUN bloc (incompatibilité légale 199 terdecies-0 A)", () => {
    expect(dispositifsFinanciersPourType("PEA")).toEqual([]);
  });
  it("OPCVM / ETF : aucun bloc", () => {
    expect(dispositifsFinanciersPourType("OPCVM / ETF")).toEqual([]);
  });
  it("les 4 sous-types dédiés portent leurs dispositifs", () => {
    expect(dispositifsFinanciersPourType("FCPI")).toEqual(["fcpi", "fcpiJei"]);
    expect(dispositifsFinanciersPourType("FIP")).toEqual(["fipMetropole", "fipCorse", "fipOutreMer"]);
    expect(dispositifsFinanciersPourType("SOFICA")).toEqual(["sofica"]);
    expect(dispositifsFinanciersPourType("Girardin industriel")).toEqual(["girardinIndustriel"]);
  });
  it("Actions non cotées : IR-PME en OPTION (pas dans les sous-types dédiés)", () => {
    expect(dispositifsFinanciersPourType("Actions non cotées")).toEqual(["irpme"]);
    expect(SOUS_TYPES_DEFISC_DEDIES).not.toContain("Actions non cotées"); // opt-in, pas dédié
  });
  it("les 4 dédiés sont bien marqués dédiés (bloc toujours visible)", () => {
    expect(SOUS_TYPES_DEFISC_DEDIES).toEqual(["FCPI", "FIP", "SOFICA", "Girardin industriel"]);
  });
});

// ─── Round-trip UI -> moteur ──────────────────────────────────────────────────
const BASE_DATA = {
  person1FirstName: "Test", person1LastName: "IR", person1BirthDate: "1980-01-01",
  person1JobTitle: "Salarié", person1Csp: "47", person1PcsGroupe: "4",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
} as any;
const MICRO = { expenseMode1: "standard", expenseMode2: "standard", km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9", km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9", foncierRegime: "micro", other1: "0", other2: "0" } as any;
const plac = (o: any): Placement => ({
  id: "x", name: "P", type: "Compte-titres", ownership: "person1", value: "0",
  annualIncome: "", taxableIncome: "", deathValue: "", openDate: "",
  pfuEligible: false, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "",
  premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "",
  annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "",
  perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [], ...o,
} as Placement);

describe("round-trip saisie -> Placement.defiscalisation -> moteur (card = moteur)", () => {
  it("FCPI 25 % (C3) : la card affiche 3000 = réduction du moteur", () => {
    const p = plac({ id: "f", type: "FCPI", defiscalisation: { dispositif: "fcpi", montantSouscrit: "15000", dateInvestissement: "2026-01-15" } });
    const ir = computeIR({ ...BASE_DATA, salary1: "100000", placements: [p] }, MICRO);
    const card = reductionFinanciereCard(ir, p, ANNEE)!;
    expect(card.statut).toBe("active");
    expect(card.montant).toBeCloseTo(3000, 2); // base 12000 x 0.25
    const entry = ir.dispositifsFiscaux.reductions.find((r: any) => r.id === `fcpi_${p.id}`);
    expect(card.montant).toBeCloseTo(entry.impute, 6); // la card lit STRICTEMENT le moteur
  });

  it("Girardin (C6) : la card affiche 11500 = réduction du moteur", () => {
    const p = plac({ id: "g", type: "Girardin industriel", value: "0", defiscalisation: { dispositif: "girardinIndustriel", montantReductionGirardin: "11500", regimeGirardin: "pleinDroit", dateInvestissement: "2026-06-01", montantSouscrit: "" } });
    const ir = computeIR({ ...BASE_DATA, salary1: "100000", placements: [p] }, MICRO);
    const card = reductionFinanciereCard(ir, p, ANNEE)!;
    expect(card.statut).toBe("active");
    expect(card.montant).toBeCloseTo(11500, 2);
    const entry = ir.dispositifsFiscaux.reductions.find((r: any) => r.id === `girardinIndustriel_${p.id}`);
    expect(card.montant).toBeCloseTo(entry.impute, 6);
  });

  it("millésime différent : la card annonce « aucune réduction » sans erreur", () => {
    const p = plac({ id: "old", type: "FCPI", defiscalisation: { dispositif: "fcpi", montantSouscrit: "15000", dateInvestissement: "2024-06-15" } });
    const ir = computeIR({ ...BASE_DATA, salary1: "100000", placements: [p] }, MICRO);
    const card = reductionFinanciereCard(ir, p, ANNEE)!;
    expect(card.statut).toBe("autre_annee");
    expect(card.anneeInvestissement).toBe(2024);
    expect(card.montant).toBe(0);
  });
});

// ─── Valeur "0" saisie respectée (?? garde le zéro) ───────────────────────────
describe("reductionJeiDejaConsommee : « 0 » saisi respecté (?? jamais ||)", () => {
  it("dejaConsommee « 0 » -> réduction pleine 12000 ; « 40000 » -> plafonnée 10000", () => {
    const zero = resolveReductionFinanciere({ dispositif: "fcpiJei", montantSouscrit: "40000", dateInvestissement: "2026-06-01", reductionJeiDejaConsommee: "0" }, ANNEE, { couple: true, rng: 80000 });
    expect(zero!.montant).toBeCloseTo(12000, 2);   // 0 déjà consommé -> plein 0.30 x 40000
    const partiel = resolveReductionFinanciere({ dispositif: "fcpiJei", montantSouscrit: "40000", dateInvestissement: "2026-06-01", reductionJeiDejaConsommee: "40000" }, ANNEE, { couple: true, rng: 80000 });
    expect(partiel!.montant).toBeCloseTo(10000, 2); // reste propre 50000 - 40000
  });
});
