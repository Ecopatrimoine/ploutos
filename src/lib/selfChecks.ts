// Self-checks
import type { PatrimonialData, IrOptions, SuccessionData } from '../types/patrimoine';
import { computeIR } from './calculs/ir';
import { computeIFI } from './calculs/ifi';
import { computeSuccession } from './calculs/succession';
import { buildHypothesisDifferenceLines } from './hypotheses';
import { deepClone, getBaseFiscalParts, getChildrenFiscalParts } from './calculs/utils';
import { EMPTY_CHARGES_DETAIL } from '../constants';

// ─── SELF-CHECKS ──────────────────────────────────────────────────────────────

export function runSelfChecks() {
  const sample: PatrimonialData = {
    person1FirstName: "A", person1LastName: "B", person1BirthDate: "1980-01-01",
    person1JobTitle: "Cadre", person1Csp: "37", person1PcsGroupe: "3",
    person2FirstName: "C", person2LastName: "D", person2BirthDate: "1982-01-01",
    person2JobTitle: "Salarié", person2Csp: "47", person2PcsGroupe: "4",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [
      { firstName: "E", lastName: "B", birthDate: "2010-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
      { firstName: "F", lastName: "B", birthDate: "2012-01-01", parentLink: "common_child", custody: "alternate", rattached: true, handicap: false },
      { firstName: "G", lastName: "B", birthDate: "2015-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
    ],
    salary1: "40000", salary2: "30000", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: {...EMPTY_CHARGES_DETAIL},
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: {...EMPTY_CHARGES_DETAIL},
    properties: [{
      name: "Locatif", type: "Location nue", ownership: "person1", propertyRight: "full",
      usufructAge: "", value: "300000", propertyTaxAnnual: "1000", rentGrossAnnual: "12000",
      insuranceAnnual: "300", worksAnnual: "500", otherChargesAnnual: "200",
      loanEnabled: true, loanType: "amortissable", loanAmount: "200000", loanRate: "3.5", loanDuration: "20", loanStartDate: "2020-01-01", loanCapitalRemaining: "50000", loanInterestAnnual: "1500", loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "",
    }],
    placements: [
      { name: "CT", type: "Compte à terme", ownership: "person1", value: "20000", annualIncome: "", taxableIncome: "", deathValue: "20000", openDate: "", pfuEligible: true, pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [] },
      { name: "AV", type: "Assurance-vie fonds euros", ownership: "person1", value: "100000", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "", pfuEligible: false, pfuOptOut: false, totalPremiumsNet: "100000", premiumsBefore70: "70000", premiumsAfter70: "30000", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [{ name: "E B", relation: "enfant", share: "100" }] },
    ],
    otherLoans: [],
  };
  const sampleIr: IrOptions = {
    expenseMode1: "standard", expenseMode2: "standard",
    km1: "0", km2: "0", cv1: "0", cv2: "0",
    mealCount1: "0", mealCount2: "0", mealUnit1: "5.35", mealUnit2: "5.35",
    other1: "0", other2: "0", foncierRegime: "micro",
  };
  const sampleSuccession: SuccessionData = {
    deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
    useTestament: false, legsMode: "global", heirs: [], testamentHeirs: [], legsPrecisItems: [],
  };

  const ir = computeIR(sample, sampleIr);
  const ifi = computeIFI(sample);
  const succession = computeSuccession(sampleSuccession, sample);
  const diff = buildHypothesisDifferenceLines(sample, sampleIr, { ...sample, perDeduction: "1000" }, sampleIr);
  const clone = deepClone(sample);

  if (!Number.isFinite(ir.finalIR)) throw new Error("IR self-check failed");
  if (!Number.isFinite(ifi.ifi)) throw new Error("IFI self-check failed");
  if (!Number.isFinite(succession.totalRights)) throw new Error("Succession self-check failed");
  if (diff.length === 0) throw new Error("Diff self-check failed");
  if (clone.salary1 !== sample.salary1) throw new Error("deepClone self-check failed");

  // Vérification parts fiscales : 3 enfants (full, alternate, full) = 0.5 + 0.25 + 1 = 1.75
  const expectedParts = getBaseFiscalParts(sample) + getChildrenFiscalParts(sample.childrenData);
  if (Math.abs(expectedParts - 3.75) > 0.001) throw new Error(`Parts fiscales incorrectes : ${expectedParts}`);

  // Vérification FIX #2 : le conjoint marié est exonéré de droits de succession (CGI art. 796-0 bis).
  // Sa base taxable PEUT être non nulle (ex: 1/4 PP reçu), mais ses droits de succession doivent être nuls.
  // Ce qu'on vérifie aussi : usufructTaxValue n'entre plus dans successionTaxable — testé via
  // un scénario usufruit total où la base taxable du conjoint doit rester à 0 (aucune PP reçue).
  const conjointResult = succession.results.find((r) => r.relation === "conjoint");
  if (conjointResult && conjointResult.successionDuties > 0.01)
    throw new Error(`FIX #2 échec — conjoint marié a des droits de succession non nuls : ${conjointResult.successionDuties}`);

  // Vérification spécifique usufruit : avec usufruit total, la base taxable du conjoint doit être nulle
  const successionUsufruit = computeSuccession({ deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_usufruct_total", useTestament: false, legsMode: "global", heirs: [], testamentHeirs: [], legsPrecisItems: [] }, { ...sample, childrenData: [sample.childrenData[0]] });
  const conjointUsufruit = successionUsufruit.results.find((r) => r.relation === "conjoint");
  if (conjointUsufruit && conjointUsufruit.successionTaxable > 0.01)
    throw new Error(`FIX #2 échec — conjoint usufruitier a une base taxable non nulle : ${conjointUsufruit.successionTaxable}`);
}

runSelfChecks();
