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


// ── TabImmobilier ─────────────────────────────────────────────────────────────────────
const TabImmobilier = React.memo(function TabImmobilier(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, addProperty, updateProperty, removeProperty, addLoan, updateLoan, removeLoan, loanModalIndex, setLoanModalIndex, ownerOptions, person1, person2 } = props;

  return (
<TabsContent value="immobilier" className="space-y-4">
  <div className="flex items-center justify-between gap-4">
    <h3 className="font-semibold" style={{ color: BRAND.navy }}>Immobilier</h3>
    <div className="flex items-end gap-2">
      <Select onValueChange={(v) => { if (v) addProperty(v); }}>
        <SelectTrigger className="h-9 rounded-xl min-w-[240px] text-sm"><SelectValue placeholder="Ajouter un bien…" /></SelectTrigger>
        <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </div>
  {data.properties.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun bien immobilier saisi. Choisissez une nature dans le menu ci-dessus.</div>}
  {data.properties.map((property, index) => (
    <Card key={index} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
      <CardContent className="p-4 space-y-3">
        {/* Identité + suppression */}
        <div className="flex items-end gap-2">
          <div className="flex-1 grid gap-2 grid-cols-[1.4fr_1.6fr_1fr_1fr]">
            <Field label="Nom"><Input value={property.name} onChange={(e) => updateProperty(index, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
            <Field label="Nature">
              <Select value={property.type} onValueChange={(v) => updateProperty(index, "type", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Propriétaire">
              <Select value={property.ownership} onValueChange={(v) => updateProperty(index, "ownership", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ownerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Droit">
              <Select value={property.propertyRight} onValueChange={(v) => updateProperty(index, "propertyRight", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_RIGHTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => removeProperty(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        {/* Valeurs financières — grille adaptative, sans divs vides */}
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
          <MoneyField label={property.propertyRight === "full" ? "Valeur estimée" : "Valeur PP"} tooltip="Valeur vénale actuelle du bien. En pleine propriété, c'est la valeur retenue pour l'IFI et la succession. En démembrement, seule la valeur de la pleine propriété est saisie ici." value={property.value} onChange={(e) => updateProperty(index, "value", e.target.value)} compact />
          {property.propertyRight !== "full" && <MoneyField label="Âge usufruitier" tooltip="Âge de l'usufruitier utilisé pour calculer la valeur de l'usufruit et de la nue-propriété selon le barème fiscal (art. 669 CGI). Ex : 60 ans → usufruit = 40 %, nue-propriété = 60 %." value={property.usufructAge} onChange={(e) => updateProperty(index, "usufructAge", e.target.value)} compact />}
          {propertyNeedsPropertyTax(property.type) && <MoneyField label="Taxe foncière/an" tooltip="Montant annuel de la taxe foncière. Déductible des revenus fonciers en régime réel." value={property.propertyTaxAnnual} onChange={(e) => updateProperty(index, "propertyTaxAnnual", e.target.value)} compact />}
          {propertyNeedsRent(property.type) && <MoneyField label="Loyer brut/an" tooltip="Total des loyers encaissés sur l'année, avant déduction des charges. Utilisé pour calculer le revenu foncier net imposable." value={property.rentGrossAnnual} onChange={(e) => updateProperty(index, "rentGrossAnnual", e.target.value)} compact />}
          {propertyNeedsInsurance(property.type) && <MoneyField label="Assurance/an" tooltip="Prime d'assurance habitation annuelle du bien locatif. Déductible des revenus fonciers en régime réel." value={property.insuranceAnnual} onChange={(e) => updateProperty(index, "insuranceAnnual", e.target.value)} compact />}
          {propertyNeedsWorks(property.type) && <MoneyField label="Travaux/an" tooltip="Dépenses de travaux d'entretien et de réparation annuelles. Déductibles des revenus fonciers en régime réel. Les travaux de construction ou d'agrandissement ne sont pas déductibles." value={property.worksAnnual} onChange={(e) => updateProperty(index, "worksAnnual", e.target.value)} compact />}
          {propertyNeedsRent(property.type) && <MoneyField label="Autres charges/an" tooltip="Autres charges déductibles : frais de gestion locative, charges de copropriété non récupérables, frais comptables, etc." value={property.otherChargesAnnual} onChange={(e) => updateProperty(index, "otherChargesAnnual", e.target.value)} compact />}
          {/* ── Bloc crédit ── */}
          </div>
          {/* ── Multi-crédits : bouton ouvre modale ── */}
          {(() => {
            const loanCount = (property.loans || []).length || (property.loanEnabled ? 1 : 0);
            const totalCapital = property.loans && property.loans.length > 0
              ? resolveLoanValuesMulti(property).capital
              : (property.loanEnabled ? n(property.loanCapitalRemaining) || resolveLoanValuesMulti(property).capital : 0);
            return (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => {
                    setLoanModalIndex(index);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium border transition-colors hover:opacity-90"
                  style={{
                    background: loanCount > 0 ? "rgba(38,66,139,0.08)" : "rgba(229,231,235,0.5)",
                    borderColor: loanCount > 0 ? "rgba(38,66,139,0.25)" : SURFACE.border,
                    color: loanCount > 0 ? BRAND.sky : "#9ca3af",
                  }}>
                  <span>{loanCount > 0 ? `💳 ${loanCount} crédit${loanCount > 1 ? "s" : ""}` : "💳 Ajouter un crédit"}</span>
                  {totalCapital > 0 && <span className="text-xs opacity-70">— {euro(totalCapital)} restant</span>}
                </button>
              </div>
            );
          })()}
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
          {property.ownership === "indivision" && (
            <>
              <MoneyField label={`% ${person1}`} tooltip={`Quote-part de propriété de ${person1} dans l'indivision. La somme des deux parts doit égaler 100%.`} value={property.indivisionShare1} onChange={(e) => updateProperty(index, "indivisionShare1", e.target.value)} compact />
              <MoneyField label={`% ${person2}`} tooltip={`Quote-part de propriété de ${person2} dans l'indivision. La somme des deux parts doit égaler 100%.`} value={property.indivisionShare2} onChange={(e) => updateProperty(index, "indivisionShare2", e.target.value)} compact />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  ))}
</TabsContent>

  );
});

TabImmobilier.displayName = "TabImmobilier";
export { TabImmobilier };
