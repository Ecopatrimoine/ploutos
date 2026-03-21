import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, FileText, Database } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";


// ── TabIFI ─────────────────────────────────────────────────────────────────────
const TabIFI = React.memo(function TabIFI(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, ifi, person1, person2 } = props;

  return (
<TabsContent value="ifi" className="space-y-4">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={FileText} title="IFI — Impôt sur la Fortune Immobilière" subtitle="Assiette, passif déductible, décote et barème progressif." /></CardHeader>
    <CardContent className="space-y-4">
      {/* KPIs + barème côte à côte */}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-1">
            <MetricCard label="Actif net taxable IFI" value={euro(ifi.netTaxable)} hint="Valeur brute des biens − passif déductible − abattement RP 30 %" />
            <MetricCard label="IFI brut" value={euro(ifi.grossIfi)} hint="IFI calculé par le barème progressif avant décote" />
            <MetricCard label="Décote" value={euro(ifi.decote)} hint="Réduction appliquée si l'actif net taxable est entre 1,3 M€ et 1,4 M€. Calcul : 17 500 − 1,25 % × actif net" />
            <MetricCard label="IFI net dû" value={euro(ifi.ifi)} hint="IFI brut − décote. Exigible uniquement si l'actif net taxable dépasse 1 300 000 €" />
          </div>
        </div>
        <BracketFillChart title="Barème IFI" data={ifi.bracketFill} referenceValue={ifi.netTaxable} valueLabel="Base taxable" />
      </div>

      {/* Table des biens compacte */}
      {ifi.lines.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>
            Biens retenus dans l'assiette IFI
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: SURFACE.tableHead }}>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Bien</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Droit</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Valeur brute</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Abatt. RP</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Passif</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Valeur taxable</th>
                </tr>
              </thead>
              <tbody>
                {ifi.lines.map((line, idx) => (
                  <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{line.rightMode}</td>
                    <td className="px-4 py-2.5 text-right">{euro(line.grossValue)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">- {euro(line.residenceAbatement)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">- {euro(line.deductibleDebt)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.taxableNet)}</td>
                  </tr>
                ))}
                <tr className="border-t" style={{ background: SURFACE.tableHead, borderColor: SURFACE.borderStrong }}>
                  <td colSpan={5} className="px-4 py-2 text-right text-sm font-semibold" style={{ color: BRAND.sky }}>Total assiette IFI</td>
                  <td className="px-4 py-2 text-right text-sm font-bold" style={{ color: BRAND.navy }}>{euro(ifi.netTaxable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {ifi.lines.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun bien immobilier saisi dans la collecte.</div>}
    </CardContent>
  </Card>
</TabsContent>

  );
});

TabIFI.displayName = "TabIFI";
export { TabIFI };
