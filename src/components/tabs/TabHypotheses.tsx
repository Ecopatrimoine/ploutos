import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";
import { computeIR } from "../../lib/calculs/ir";
import { computeIFI } from "../../lib/calculs/ifi";
import { computeSuccession } from "../../lib/calculs/succession";
import { buildHypothesisDifferenceLines } from "../../lib/hypotheses";


// ── TabHypotheses ─────────────────────────────────────────────────────────────────────
const TabHypotheses = React.memo(function TabHypotheses(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, irOptions, successionData, hypotheses, baseSnapshot, ir, ifi, succession, baseReference, renameHypothesis, updateHypothesisNotes, updateHypothesisObjective, saveBaseSnapshot, restoreBaseSnapshot, saveHypothesis, loadHypothesis, clearHypothesis, person1, person2 } = props;

  // Calculer les résultats de chaque hypothèse localement
  const hypothesisResults = React.useMemo(() =>
    hypotheses.map((hypothesis: Hypothesis) => {
      if (!hypothesis.data || !hypothesis.irOptions || !hypothesis.successionData) {
        return { hypothesis, ir: null, ifi: null, succession: null, differences: [] as DifferenceLine[] };
      }
      return {
        hypothesis,
        ir: computeIR(hypothesis.data, hypothesis.irOptions),
        ifi: computeIFI(hypothesis.data),
        succession: computeSuccession(hypothesis.successionData, hypothesis.data),
        differences: buildHypothesisDifferenceLines(baseSnapshot.data, baseSnapshot.irOptions, hypothesis.data, hypothesis.irOptions),
      };
    }),
    [hypotheses, baseSnapshot]
  );

  return (
<TabsContent value="hypotheses">
  <div className="space-y-4">

    {/* Barre de base — compacte sur une ligne */}
    <Card className="rounded-2xl border-0 shadow-md" style={{ background: SURFACE.cardSoft }}>
      <CardContent className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Base de référence</div>
              <div className="text-xs text-slate-500 mt-0.5">{baseSnapshot.savedAt ? `Figée le ${new Date(baseSnapshot.savedAt).toLocaleString("fr-FR")}` : "Aucune base figée"}</div>
            </div>
            <div className="flex gap-3 text-sm">
              {[
                { label: "IR", value: baseReference.ir.finalIR },
                { label: "IFI", value: baseReference.ifi.ifi },
                { label: "Succession", value: baseReference.succession.totalRights },
                { label: "Actif successoral", value: baseReference.succession.activeNet },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border px-3 py-1.5 text-xs" style={{ borderColor: SURFACE.border, background: "white" }}>
                  <span className="text-slate-500">{label} : </span><strong style={{ color: BRAND.navy }}>{euro(value)}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="h-8 rounded-xl px-3 text-sm" style={{ background: BRAND.navy }} onClick={saveBaseSnapshot}>Figer la base actuelle</Button>
            <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={restoreBaseSnapshot} disabled={!baseSnapshot.data}>Recharger</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Situation courante vs base */}
    <div className="rounded-2xl border px-5 py-3" style={{ borderColor: SURFACE.border, background: "white" }}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Situation courante</div>
        {[
          { label: "IR", value: ir.finalIR, base: baseReference.ir.finalIR },
          { label: "IFI", value: ifi.ifi, base: baseReference.ifi.ifi },
          { label: "Succession", value: succession.totalRights, base: baseReference.succession.totalRights },
          { label: "Actif successoral", value: succession.activeNet, base: baseReference.succession.activeNet },
        ].map(({ label, value, base }) => {
          const diff = value - base;
          return (
            <div key={label} className="flex items-baseline gap-2 rounded-xl border px-3 py-1.5 text-xs" style={{ borderColor: SURFACE.border }}>
              <span className="text-slate-500">{label} : </span>
              <strong style={{ color: BRAND.navy }}>{euro(value)}</strong>
              {baseSnapshot.data && (
                <span className={`text-xs font-medium ${Math.abs(diff) < 1 ? "text-slate-400" : diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {diff >= 0 ? "+" : ""}{euro(diff)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* 3 cartes hypothèses */}
    <div className="grid gap-4 md:grid-cols-3">
      {hypothesisResults.map((item) => (
        <Card key={item.hypothesis.id} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
          <CardContent className="p-4 space-y-3">
            {/* Nom + boutons */}
            <div className="flex items-center gap-2">
              <Input
                value={item.hypothesis.name}
                onChange={(e) => renameHypothesis(item.hypothesis.id, e.target.value)}
                className="h-8 flex-1 rounded-xl text-sm font-semibold"
                style={{ color: BRAND.navy }}
              />
              <Button className="h-8 w-8 rounded-xl p-0" style={{ background: BRAND.navy }} onClick={() => saveHypothesis(item.hypothesis.id)} title="Enregistrer">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => loadHypothesis(item.hypothesis.id)} disabled={!item.hypothesis.data} title="Charger">
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => clearHypothesis(item.hypothesis.id)} title="Effacer">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Field label="Hypothèse"><Textarea value={item.hypothesis.notes} onChange={(e) => updateHypothesisNotes(item.hypothesis.id, e.target.value)} className="rounded-xl min-h-[64px] text-sm" /></Field>
            <Field label="Objectifs"><Textarea value={item.hypothesis.objective || ""} onChange={(e) => updateHypothesisObjective(item.hypothesis.id, e.target.value)} className="rounded-xl min-h-[64px] text-sm" /></Field>

            <div className="text-xs text-slate-400">{item.hypothesis.savedAt ? `Capturée : ${new Date(item.hypothesis.savedAt).toLocaleString("fr-FR")}` : "Aucune capture."}</div>

            {item.ir && item.ifi && item.succession ? (
              <div className="space-y-2">
                {/* KPIs avec écart coloré */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "IR", value: item.ir.finalIR, base: baseReference.ir.finalIR },
                    { label: "IFI", value: item.ifi.ifi, base: baseReference.ifi.ifi },
                    { label: "Succession", value: item.succession.totalRights, base: baseReference.succession.totalRights },
                    { label: "Actif succ.", value: item.succession.activeNet, base: baseReference.succession.activeNet },
                  ].map(({ label, value, base }) => {
                    const diff = value - base;
                    return (
                      <div key={label} className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: SURFACE.border }}>
                        <div className="text-slate-500">{label}</div>
                        <div className="font-semibold" style={{ color: BRAND.navy }}>{euro(value)}</div>
                        <div className={`text-xs ${Math.abs(diff) < 1 ? "text-slate-400" : diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                          {diff >= 0 ? "+" : ""}{euro(diff)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Modifications détaillées */}
                {item.differences.length > 0 && (
                  <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Modifications vs base</div>
                    {item.differences.map((diff, i) => (
                      <div key={diff.label + i} className="flex items-start justify-between gap-2 text-xs">
                        <div className="flex-1">
                          <div className="font-medium text-slate-700">{diff.label}</div>
                          <div className="text-slate-400">{diff.baseValue} → <strong>{diff.hypothesisValue}</strong></div>
                        </div>
                        <DifferenceBadge impact={diff.impact} />
                      </div>
                    ))}
                  </div>
                )}
                {item.differences.length === 0 && baseSnapshot.data && (
                  <div className="text-xs text-slate-400">Aucune différence détectée vs la base.</div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-3 py-4 text-xs text-center text-slate-400" style={{ borderColor: SURFACE.border }}>
                Enregistre la situation courante pour comparer.
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
</TabsContent>

  );
});

TabHypotheses.displayName = "TabHypotheses";
export { TabHypotheses };
