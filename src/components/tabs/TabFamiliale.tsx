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


// ── TabFamiliale ─────────────────────────────────────────────────────────────────────
const TabFamiliale = React.memo(function TabFamiliale(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, addChild, updateChild, removeChild, person1, person2 } = props;

  return (
<TabsContent value="famille" className="space-y-6">
  {/* Deux personnes côte à côte */}
  <div className="grid gap-4 md:grid-cols-2">
    {/* Personne 1 */}
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Personne 1</div>
      <div className="grid gap-3 grid-cols-2">
        <Field label="Prénom"><Input value={data.person1FirstName} onChange={(e) => setField("person1FirstName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Nom"><Input value={data.person1LastName} onChange={(e) => setField("person1LastName", e.target.value)} className="rounded-xl" /></Field>
      </div>
      <Field label="Date de naissance">
        <div className="flex items-center gap-2">
          <Input type="date" value={data.person1BirthDate} onChange={(e) => setField("person1BirthDate", e.target.value)} className="rounded-xl flex-1" />
          <div className="flex items-center gap-1 shrink-0">
            <button role="switch" aria-checked={!!data.person1Handicap}
              title="Handicap (carte invalidité / CMI). Impact IR : abattement + demi-part. Succession : +159 325 €."
              onClick={() => setField("person1Handicap", !data.person1Handicap)}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: data.person1Handicap ? "#b45309" : "#d1d5db" }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: data.person1Handicap ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs whitespace-nowrap" style={{ color: data.person1Handicap ? "#b45309" : "#9ca3af" }}>
              {data.person1Handicap ? "♿ Handi." : "Handi."}
            </span>
          </div>
        </div>
      </Field>
    </div>
    {/* Personne 2 */}
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Personne 2</div>
      <div className="grid gap-3 grid-cols-2">
        <Field label="Prénom"><Input value={data.person2FirstName} onChange={(e) => setField("person2FirstName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Nom"><Input value={data.person2LastName} onChange={(e) => setField("person2LastName", e.target.value)} className="rounded-xl" /></Field>
      </div>
      <Field label="Date de naissance">
        <div className="flex items-center gap-2">
          <Input type="date" value={data.person2BirthDate} onChange={(e) => setField("person2BirthDate", e.target.value)} className="rounded-xl flex-1" />
          <div className="flex items-center gap-1 shrink-0">
            <button role="switch" aria-checked={!!data.person2Handicap}
              title="Handicap (carte invalidité / CMI). Impact IR : abattement + demi-part. Succession : +159 325 €."
              onClick={() => setField("person2Handicap", !data.person2Handicap)}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: data.person2Handicap ? "#b45309" : "#d1d5db" }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: data.person2Handicap ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs whitespace-nowrap" style={{ color: data.person2Handicap ? "#b45309" : "#9ca3af" }}>
              {data.person2Handicap ? "♿ Handi." : "Handi."}
            </span>
          </div>
        </div>
      </Field>
    </div>
  </div>
  {/* Situation couple sur une ligne */}
  <div className="grid gap-4 md:grid-cols-3">
    <Field label="Situation de couple">
      <Select value={data.coupleStatus} onValueChange={(v) => setField("coupleStatus", v)}>
        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>{COUPLE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field label="Régime matrimonial">
      <Select value={data.matrimonialRegime} onValueChange={(v) => setField("matrimonialRegime", v)} disabled={data.coupleStatus !== "married"}>
        <SelectTrigger className={`rounded-xl ${data.coupleStatus !== "married" ? "bg-slate-100 text-slate-400" : ""}`}><SelectValue /></SelectTrigger>
        <SelectContent>{MATRIMONIAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field label="Parent isolé">
      <Select value={data.singleParent ? "yes" : "no"} onValueChange={(v) => setField("singleParent", v === "yes")}>
        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="no">Non</SelectItem><SelectItem value="yes">Oui</SelectItem></SelectContent>
      </Select>
    </Field>

  </div>
  {/* Enfants */}
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Enfants</h3>
      <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={addChild}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>
    </div>
    {data.childrenData.length === 0 && <div className="text-sm text-slate-500">Aucun enfant saisi.</div>}
    {data.childrenData.map((child, index) => (
      <div key={index} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_1.2fr_1.3fr_1fr_1fr_1fr_auto_auto]" style={{ borderColor: SURFACE.border }}>
        <Field label="Prénom"><Input value={child.firstName} onChange={(e) => updateChild(index, "firstName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Nom"><Input value={child.lastName} onChange={(e) => updateChild(index, "lastName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Date de naissance">
          <Input type="date" value={child.birthDate} onChange={(e) => updateChild(index, "birthDate", e.target.value)} className="rounded-xl" />
        </Field>
        <Field label="Parenté">
          <Select value={child.parentLink} onValueChange={(v) => updateChild(index, "parentLink", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{CHILD_LINKS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Garde">
          <Select value={child.custody} onValueChange={(v) => updateChild(index, "custody", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{CUSTODY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Foyer fiscal" tooltip="Enfant rattaché : compte dans les parts fiscales du foyer. Enfant non rattaché (majeur indépendant) : ne génère plus de parts mais peut donner droit à une pension déductible.">
          <button
            onClick={() => updateChild(index, "rattached", !(child.rattached !== false))}
            className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium w-full"
            style={{
              background: child.rattached !== false ? "rgba(81,106,199,0.1)" : "rgba(220,38,38,0.08)",
              color: child.rattached !== false ? BRAND.sky : "#dc2626",
              border: `1px solid ${child.rattached !== false ? "rgba(81,106,199,0.2)" : "rgba(220,38,38,0.2)"}`,
            }}
          >
            {child.rattached !== false ? "✓ Rattaché" : "✗ Non rattaché"}
          </button>
        </Field>

        <Field label="Handicap" tooltip="Carte invalidité / CMI. Impact IR : +0,5 part (0,25 si alternée). Succession : +159 325 € d'abattement cumulable.">
          <div className="flex items-center gap-1.5 h-9">
            <button role="switch" aria-checked={!!child.handicap}
              onClick={() => updateChild(index, "handicap", !child.handicap)}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: child.handicap ? "#b45309" : "#d1d5db" }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: child.handicap ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs" style={{ color: child.handicap ? "#b45309" : "#9ca3af" }}>
              {child.handicap ? "♿" : "—"}
            </span>
          </div>
        </Field>
        <Field label="Niveau scolaire" tooltip="Forfait scolaire art. 199 quater B — réduction d'impôt : collège 61 €/an · lycée 153 €/an · supérieur 183 €/an. Uniquement pour les enfants rattachés au foyer fiscal.">
          <Select value={(child.schoolLevel) || "none"} onValueChange={(v) => updateChild(index, "schoolLevel", v === "none" ? "" : v)}>
            <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Non scolarisé" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non scolarisé</SelectItem>
              <SelectItem value="college">Collège (-61 € IR)</SelectItem>
              <SelectItem value="lycee">Lycée (-153 € IR)</SelectItem>
              <SelectItem value="superieur">Supérieur (-183 € IR)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end"><Button variant="outline" className="h-9 w-9 rounded-xl p-0" onClick={() => removeChild(index)}><Trash2 className="h-4 w-4" /></Button></div>
      </div>
    ))}
  </div>
</TabsContent>

  );
});

TabFamiliale.displayName = "TabFamiliale";
export { TabFamiliale };
