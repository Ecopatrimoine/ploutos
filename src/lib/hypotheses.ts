// Diff hypothèses
import type { PatrimonialData, IrOptions, SuccessionData, DifferenceLine } from '../types/patrimoine';
import { euro, n, isAV } from './calculs/utils';
import { PLACEMENT_TYPES_BY_FAMILY } from '../constants';
import { computeIR } from './calculs/ir';
import { computeIFI } from './calculs/ifi';
import { computeSuccession } from './calculs/succession';

// ─── DIFF HYPOTHÈSES ──────────────────────────────────────────────────────────

export function moneyDiffLine(label: string, baseRaw: number, hypoRaw: number, fiscalArea: string): DifferenceLine | null {
  if (Math.round(baseRaw) === Math.round(hypoRaw)) return null;
  return {
    label,
    baseValue: euro(baseRaw),
    hypothesisValue: euro(hypoRaw),
    impact: hypoRaw > baseRaw ? "up" : "down",
    fiscalArea,
  };
}

export function textDiffLine(label: string, baseValue: string, hypoValue: string, fiscalArea: string): DifferenceLine | null {
  const a = (baseValue || "").trim() || "—";
  const b = (hypoValue || "").trim() || "—";
  if (a === b) return null;
  return { label, baseValue: a, hypothesisValue: b, impact: "neutral", fiscalArea };
}

export function buildHypothesisDifferenceLines(
  baseData: PatrimonialData | null,
  baseIrOptions: IrOptions | null,
  hypothesisData: PatrimonialData | null,
  hypothesisIrOptions: IrOptions | null,
): DifferenceLine[] {
  if (!baseData || !baseIrOptions || !hypothesisData || !hypothesisIrOptions) return [];
  const lines: DifferenceLine[] = [];
  const push = (l: DifferenceLine | null) => { if (l) lines.push(l); };

  // Revenus
  push(moneyDiffLine("Salaire personne 1", n(baseData.salary1), n(hypothesisData.salary1), "IR"));
  push(moneyDiffLine("Salaire personne 2", n(baseData.salary2), n(hypothesisData.salary2), "IR"));
  push(moneyDiffLine("Pensions", n(baseData.pensions), n(hypothesisData.pensions), "IR"));
  push(moneyDiffLine("Versements PER déductibles", n(baseData.perDeduction), n(hypothesisData.perDeduction), "IR"));
  push(moneyDiffLine("Pensions déductibles", n(baseData.pensionDeductible), n(hypothesisData.pensionDeductible), "IR"));
  push(moneyDiffLine("Autres charges déductibles", n(baseData.otherDeductible), n(hypothesisData.otherDeductible), "IR"));

  // Options IR
  push(textDiffLine("Mode frais P1", baseIrOptions.expenseMode1 === "actual" ? "Frais réels" : "Abattement 10 %", hypothesisIrOptions.expenseMode1 === "actual" ? "Frais réels" : "Abattement 10 %", "IR"));
  push(textDiffLine("Mode frais P2", baseIrOptions.expenseMode2 === "actual" ? "Frais réels" : "Abattement 10 %", hypothesisIrOptions.expenseMode2 === "actual" ? "Frais réels" : "Abattement 10 %", "IR"));
  push(textDiffLine("Régime foncier", baseIrOptions.foncierRegime === "real" ? "Réel" : "Micro-foncier", hypothesisIrOptions.foncierRegime === "real" ? "Réel" : "Micro-foncier", "IR"));
  push(moneyDiffLine("Km P1", n(baseIrOptions.km1), n(hypothesisIrOptions.km1), "IR"));
  push(moneyDiffLine("Km P2", n(baseIrOptions.km2), n(hypothesisIrOptions.km2), "IR"));
  push(moneyDiffLine("Repas P1", n(baseIrOptions.mealCount1) * n(baseIrOptions.mealUnit1), n(hypothesisIrOptions.mealCount1) * n(hypothesisIrOptions.mealUnit1), "IR"));
  push(moneyDiffLine("Repas P2", n(baseIrOptions.mealCount2) * n(baseIrOptions.mealUnit2), n(hypothesisIrOptions.mealCount2) * n(hypothesisIrOptions.mealUnit2), "IR"));

  // Immobilier
  const maxProp = Math.max(baseData.properties.length, hypothesisData.properties.length);
  for (let i = 0; i < maxProp; i++) {
    const bp = baseData.properties[i];
    const hp = hypothesisData.properties[i];
    const label = hp?.name || bp?.name || `Bien ${i + 1}`;
    if (!bp && hp) { push({ label: `Nouveau bien · ${label}`, baseValue: "Absent", hypothesisValue: `${hp.type} · ${euro(hp.value)}`, impact: "up", fiscalArea: "IFI / Succession" }); continue; }
    if (bp && !hp) { push({ label: `Bien supprimé · ${label}`, baseValue: `${bp.type} · ${euro(bp.value)}`, hypothesisValue: "Absent", impact: "down", fiscalArea: "IFI / Succession" }); continue; }
    if (bp && hp) {
      push(textDiffLine(`Type · ${label}`, bp.type, hp.type, "IFI / Succession"));
      push(textDiffLine(`Droit · ${label}`, bp.propertyRight, hp.propertyRight, "IFI / Succession"));
      push(textDiffLine(`Propriétaire · ${label}`, bp.ownership, hp.ownership, "IFI / Succession"));
      push(moneyDiffLine(`Valeur · ${label}`, n(bp.value), n(hp.value), "IFI / Succession"));
      push(moneyDiffLine(`Capital restant dû · ${label}`, n(bp.loanCapitalRemaining), n(hp.loanCapitalRemaining), "IFI / Succession"));
      push(moneyDiffLine(`Loyer brut · ${label}`, n(bp.rentGrossAnnual), n(hp.rentGrossAnnual), "IR"));
    }
  }

  // Placements
  const maxPlac = Math.max(baseData.placements.length, hypothesisData.placements.length);
  for (let i = 0; i < maxPlac; i++) {
    const bl = baseData.placements[i];
    const hl = hypothesisData.placements[i];
    const label = hl?.name || bl?.name || `Placement ${i + 1}`;
    if (!bl && hl) { push({ label: `Nouveau placement · ${label}`, baseValue: "Absent", hypothesisValue: `${hl.type} · ${euro(hl.value)}`, impact: "up", fiscalArea: isAV(hl.type) ? "Succession / AV" : "IR / Succession" }); continue; }
    if (bl && !hl) { push({ label: `Placement supprimé · ${label}`, baseValue: `${bl.type} · ${euro(bl.value)}`, hypothesisValue: "Absent", impact: "down", fiscalArea: isAV(bl.type) ? "Succession / AV" : "IR / Succession" }); continue; }
    if (bl && hl) {
      const area = isAV(bl.type) || isAV(hl.type) ? "Succession / AV" : "IR / Succession";
      push(textDiffLine(`Type · ${label}`, bl.type, hl.type, area));
      push(textDiffLine(`Titulaire · ${label}`, bl.ownership, hl.ownership, area));
      push(moneyDiffLine(`Valeur · ${label}`, n(bl.value), n(hl.value), area));
      push(moneyDiffLine(`Revenu taxable · ${label}`, n(bl.taxableIncome), n(hl.taxableIncome), "IR"));
      push(moneyDiffLine(`Valeur décès · ${label}`, n(bl.deathValue), n(hl.deathValue), "Succession"));
      push(moneyDiffLine(`Primes avant 70 ans · ${label}`, n(bl.premiumsBefore70), n(hl.premiumsBefore70), "Succession / AV"));
      push(moneyDiffLine(`Primes après 70 ans · ${label}`, n(bl.premiumsAfter70), n(hl.premiumsAfter70), "Succession / AV"));
    }
  }

  return lines;
}
