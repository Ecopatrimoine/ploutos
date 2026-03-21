// Calcul IFI — assiette, abattements, barème
import type { PatrimonialData, TaxBracket } from '../../types/patrimoine';
import { n, computeTaxFromBrackets } from './utils';
import { resolveLoanValuesMulti } from './credit';

// ─── CALCUL IFI ───────────────────────────────────────────────────────────────

export function computeIFI(data: PatrimonialData) {
  const nonRattachedChildIfi = new Set(
    data.childrenData
      .map((c, i) => c.rattached === false ? `child_${i}` : null)
      .filter(Boolean)
  );
  const lines = data.properties
    .filter(p => !nonRattachedChildIfi.has(p.ownership)) // exclure biens enfants non rattachés
    .map((property) => {
    const fullValue = Math.max(0, n(property.value));
    const loanVals = resolveLoanValuesMulti(property);
    const rawDebt = loanVals.ifiDeduction;
    // Taux assurance DC pour IFI : prendre le taux le plus bas (couverture sur propre part)
    const insuranceRateIfi = (() => {
      const loans = property.loans;
      if (loans && loans.length > 0) {
        // Somme pondérée des assurances DC sur les crédits avec assurance
        const totalCapital = loanVals.capital;
        if (totalCapital <= 0) return 0;
        let coveredCapital = 0;
        for (const loan of loans) {
          if (!loan.insurance) continue;
          const lv = loanVals.loans.find(r => r.loan.id === loan.id);
          const cap = lv?.capital || 0;
          const rate = Math.min(100, Math.max(0, n(loan.insuranceRate)));
          coveredCapital += cap * rate / 100;
        }
        return totalCapital > 0 ? Math.min(100, coveredCapital / totalCapital * 100) : 0;
      }
      return property.loanInsurance ? Math.min(100, Math.max(0, n(property.loanInsuranceRate))) : 0;
    })();
    const debt = rawDebt;
    const netDebt = Math.max(0, debt * (1 - insuranceRateIfi / 100));
    const residenceAbatement = property.type === "Résidence principale" ? fullValue * 0.3 : 0;
    const taxableGross = Math.max(0, fullValue - residenceAbatement);
    const deductibleDebt = Math.min(netDebt, taxableGross);
    const included = property.propertyRight !== "bare";
    const taxableNet = included ? Math.max(0, taxableGross - deductibleDebt) : 0;
    return {
      name: property.name || property.type,
      type: property.type,
      rightMode: property.propertyRight === "usufruct"
        ? "Usufruit imposable en pleine propriété"
        : property.propertyRight === "bare"
          ? "Nue-propriété non retenue"
          : "Pleine propriété",
      taxableNet,
      grossValue: fullValue,
      residenceAbatement,
      deductibleDebt: included ? deductibleDebt : 0,
    };
  });

  const netTaxable = lines.reduce((sum, l) => sum + l.taxableNet, 0);
  const brackets: TaxBracket[] = [
    { from: 0, to: 800000, rate: 0 },
    { from: 800000, to: 1300000, rate: 0.005 },
    { from: 1300000, to: 2570000, rate: 0.007 },
    { from: 2570000, to: 5000000, rate: 0.01 },
    { from: 5000000, to: 10000000, rate: 0.0125 },
    { from: 10000000, to: Number.POSITIVE_INFINITY, rate: 0.015 },
  ];

  const grossIfiCalc = computeTaxFromBrackets(netTaxable, brackets);
  const grossIfi = grossIfiCalc.tax;
  const decote = netTaxable >= 1300000 && netTaxable < 1400000 ? Math.max(0, 17500 - 0.0125 * netTaxable) : 0;
  const ifi = netTaxable > 1300000 ? Math.max(0, grossIfi - decote) : 0;
  const currentBracket = grossIfiCalc.fill.find((s) => netTaxable <= s.to) || grossIfiCalc.fill[grossIfiCalc.fill.length - 1];
  const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(netTaxable, 1);
  const indicatorPct = visualMax > 0 ? Math.min(100, Math.max(0, (netTaxable / visualMax) * 100)) : 0;

  return {
    lines, netTaxable, grossIfi, decote, ifi,
    bracketFill: grossIfiCalc.fill,
    currentBracketLabel: currentBracket.label,
    indicatorPct, visualMax,
  };
}
