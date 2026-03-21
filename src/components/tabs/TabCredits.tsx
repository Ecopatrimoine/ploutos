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


// ── TabCredits ─────────────────────────────────────────────────────────────────────
const TabCredits = React.memo(function TabCredits(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, setData, person1, person2 } = props;

  return (
<TabsContent value="credits" className="space-y-4">
  <div className="flex items-center justify-between gap-4">
    <div>
      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Autres crédits</h3>
      <p className="text-xs text-slate-500 mt-0.5">Crédits consommation, personnels, LOA, etc. Intégrés au bilan patrimonial (passif). Aucun impact IR/IFI.</p>
    </div>
    <Button variant="outline" className="h-9 rounded-xl px-3 text-sm"
      onClick={() => setData(prev => ({ ...prev, otherLoans: [...(prev.otherLoans || []), { name: "", loanType: "personnel", owner: "person1", capitalRemaining: "", monthlyPayment: "", rate: "", durationRemaining: "", purpose: "", hasInsurance: false, insuranceGuarantees: "dc", insurancePremium: "" }] }))}>
      <Plus className="mr-1.5 h-4 w-4" />Ajouter un crédit
    </Button>
  </div>
  {(!data.otherLoans || data.otherLoans.length === 0) && (
    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun autre crédit renseigné.</div>
  )}
  {(data.otherLoans || []).map((loan, li) => (
    <Card key={li} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 grid gap-2 grid-cols-[1fr_1.2fr_0.9fr_1.1fr]">
            <Field label="Nom"><Input value={loan.name} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, name: e.target.value } : l) }))} className="rounded-xl h-8 text-sm" placeholder="ex: Crédit auto" /></Field>
            <Field label="Type">
              <Select value={loan.loanType} onValueChange={(v) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, loanType: v } : l) }))}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conso">Crédit consommation</SelectItem>
                  <SelectItem value="personnel">Prêt personnel</SelectItem>
                  <SelectItem value="loa">LOA / Leasing</SelectItem>
                  <SelectItem value="employeur">Prêt employeur</SelectItem>
                  <SelectItem value="revolving">Crédit renouvelable</SelectItem>
                  <SelectItem value="familial">Prêt familial</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Titulaire">
              <Select value={loan.owner} onValueChange={(v) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, owner: v } : l) }))}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person1">{person1}</SelectItem>
                  <SelectItem value="person2">{person2 || "Personne 2"}</SelectItem>
                  <SelectItem value="common">Commun</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <MoneyField label="Capital restant dû (€)" value={loan.capitalRemaining} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, capitalRemaining: e.target.value } : l) }))} compact />
          </div>
          <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.filter((_, i) => i !== li) }))}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
          <MoneyField label="Mensualité (€)" value={loan.monthlyPayment} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, monthlyPayment: e.target.value } : l) }))} compact />
          <Field label="Taux (%)"><Input type="number" step="0.01" placeholder="4.5" value={loan.rate} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, rate: e.target.value } : l) }))} className="rounded-xl h-8 text-sm" /></Field>
          <Field label="Durée restante (mois)"><Input type="number" placeholder="36" value={loan.durationRemaining} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, durationRemaining: e.target.value } : l) }))} className="rounded-xl h-8 text-sm" /></Field>
          <Field label="Objet"><Input placeholder="ex: Véhicule" value={loan.purpose} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, purpose: e.target.value } : l) }))} className="rounded-xl h-8 text-sm" /></Field>
        </div>
        <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: SURFACE.border }}>
          <div className="flex items-center gap-2">
            <button role="switch" aria-checked={loan.hasInsurance}
              onClick={() => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, hasInsurance: !l.hasInsurance } : l) }))}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: loan.hasInsurance ? BRAND.sky : "#d1d5db" }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: loan.hasInsurance ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Assurance emprunteur</span>
          </div>
          {loan.hasInsurance && (
            <div className="grid gap-2 grid-cols-2">
              <Field label="Garanties">
                <Select value={loan.insuranceGuarantees || "dc"} onValueChange={(v) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, insuranceGuarantees: v } : l) }))}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dc">Décès (DC)</SelectItem>
                    <SelectItem value="dc_ptia">DC + PTIA</SelectItem>
                    <SelectItem value="dc_ptia_itt">DC + PTIA + ITT</SelectItem>
                    <SelectItem value="dc_ptia_itt_ipp">DC + PTIA + ITT + IPP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <MoneyField label="Prime annuelle (€)" value={loan.insurancePremium} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, insurancePremium: e.target.value } : l) }))} compact />
            </div>
          )}
        </div>
        {loan.loanType === "familial" && (
          <div className="text-xs rounded-xl px-3 py-1.5" style={{ background: "rgba(245,158,11,0.08)", color: "#b45309", border: "1px solid rgba(245,158,11,0.2)" }}>
            ⚠️ Prêt familial : non déductible de l'IFI (art. 974 III CGI)
          </div>
        )}
      </CardContent>
    </Card>
  ))}
  {(data.otherLoans || []).length > 0 && (() => {
    const totalPassif = (data.otherLoans || []).reduce((s, l) => s + n(l.capitalRemaining), 0);
    const totalMensualites = (data.otherLoans || []).reduce((s, l) => s + n(l.monthlyPayment), 0);
    return (
      <div className="rounded-2xl border p-4 grid grid-cols-2 gap-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
        <div><div className="text-xs text-slate-500">Total passif autres crédits</div><div className="text-lg font-bold" style={{ color: BRAND.navy }}>{euro(totalPassif)}</div></div>
        <div><div className="text-xs text-slate-500">Total mensualités</div><div className="text-lg font-bold" style={{ color: BRAND.sky }}>{euro(totalMensualites)}/mois</div></div>
      </div>
    );
  })()}
</TabsContent>

  );
});

TabCredits.displayName = "TabCredits";
export { TabCredits };
