import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, AlertTriangle, Check } from "lucide-react";
import { confirmRemove } from "../../lib/confirmRemove";
import { useDebouncedAction } from "../../hooks/useDebouncedAction";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { computeTauxEndettement } from "../../lib/calculs/endettement";
import { resolveOtherLoan } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";
import { KpiBandeCollecte, KpiCollecte, ChampCollecte, MoneyCollecte, INPUT_COLLECTE_CLS, INPUT_COLLECTE_STYLE } from "../collecte/densite";


// ── TabCredits ─────────────────────────────────────────────────────────────────────
const TabCredits = React.memo(function TabCredits(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, setData, person1, person2 } = props;
  const addOtherLoan = useDebouncedAction(() => setData(prev => ({ ...prev, otherLoans: [...(prev.otherLoans || []), { name: "", loanType: "personnel", owner: "person1", capitalRemaining: "", monthlyPayment: "", rate: "", durationRemaining: "", purpose: "", hasInsurance: false, insuranceGuarantees: "dc", insurancePremium: "" }] }))); // Lot 8 C2 — anti double-clic

  return (
<TabsContent value="credits" className="space-y-3">
  <div className="flex items-center justify-between gap-4">
    <div>
      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Autres crédits</h3>
      <p className="text-xs text-slate-500 mt-0.5">Crédits consommation, personnels, LOA, etc. Intégrés au bilan patrimonial (passif). Aucun impact IR/IFI.</p>
    </div>
    <Button variant="outline" className="h-9 rounded-xl px-3 text-sm"
      onClick={addOtherLoan}>
      <Plus className="mr-1.5 h-4 w-4" />Ajouter un crédit
    </Button>
  </div>
  {(!data.otherLoans || data.otherLoans.length === 0) && (
    <div className="border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>Aucun autre crédit renseigné.</div>
  )}
  {(data.otherLoans || []).map((loan, li) => (
    <Card key={li} className="border " style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 grid gap-2 grid-cols-[1fr_1.2fr_0.9fr_1.1fr]">
            <ChampCollecte label="Nom"><Input value={loan.name} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, name: e.target.value } : l) }))} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} placeholder="ex: Crédit auto" /></ChampCollecte>
            <ChampCollecte label="Type">
              <Select value={loan.loanType} onValueChange={(v) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, loanType: v } : l) }))}>
                <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conso">Crédit consommation</SelectItem>
                  <SelectItem value="personnel">Prêt personnel</SelectItem>
                  <SelectItem value="loa">LOA / Leasing</SelectItem>
                  <SelectItem value="employeur">Prêt employeur</SelectItem>
                  <SelectItem value="revolving">Crédit renouvelable</SelectItem>
                  <SelectItem value="familial">Prêt familial</SelectItem>
                </SelectContent>
              </Select>
            </ChampCollecte>
            <ChampCollecte label="Titulaire">
              <Select value={loan.owner} onValueChange={(v) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, owner: v } : l) }))}>
                <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person1">{person1}</SelectItem>
                  <SelectItem value="person2">{person2 || "Personne 2"}</SelectItem>
                  <SelectItem value="common">Commun</SelectItem>
                </SelectContent>
              </Select>
            </ChampCollecte>
            <MoneyCollecte label="Capital restant dû (€)" value={loan.capitalRemaining} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, capitalRemaining: e.target.value } : l) }))} />
          </div>
          <Button variant="outline" aria-label="Supprimer le credit" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => confirmRemove(!!(loan.name || loan.capitalRemaining || loan.monthlyPayment), "le credit", () => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.filter((_, i) => i !== li) })))}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
          <MoneyCollecte label="Mensualité (€)" value={loan.monthlyPayment} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, monthlyPayment: e.target.value } : l) }))} />
          <ChampCollecte label="Taux (%)"><Input type="number" step="0.01" placeholder="4.5" value={loan.rate} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, rate: e.target.value } : l) }))} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
          <ChampCollecte label="Durée restante (mois)"><Input type="number" placeholder="36" value={loan.durationRemaining} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, durationRemaining: e.target.value } : l) }))} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
          <ChampCollecte label="Objet"><Input placeholder="ex: Véhicule" value={loan.purpose} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, purpose: e.target.value } : l) }))} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
        </div>
        {/* Mensualité auto-calculée (barrière douce) : badge lecture seule seulement si NON saisie. */}
        {/* Badge lecture seule du champ DÉDUIT (un seul à la fois selon autoField). */}
        {(() => {
          const auto = resolveOtherLoan(loan);
          if (auto.autoField === 'monthlyPayment') return <div className="text-xs" style={{ color: BRAND.sky }}>Mensualité calculée : <strong>{euro(auto.monthlyPayment)}</strong>/mois</div>;
          if (auto.autoField === 'capitalRemaining') return <div className="text-xs" style={{ color: BRAND.sky }}>Capital restant dû calculé : <strong>{euro(auto.capitalRemaining)}</strong></div>;
          if (auto.autoField === 'durationRemaining') return <div className="text-xs" style={{ color: BRAND.sky }}>Durée restante calculée : <strong>{auto.durationRemaining} mois</strong></div>;
          return null;
        })()}
        <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
          <div className="flex items-center gap-2">
            <button role="switch" aria-checked={loan.hasInsurance}
              onClick={() => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, hasInsurance: !l.hasInsurance } : l) }))}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: loan.hasInsurance ? BRAND.gold : SURFACE.border }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: loan.hasInsurance ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Assurance emprunteur</span>
          </div>
          {loan.hasInsurance && (
            <div className="grid gap-2 grid-cols-2">
              <ChampCollecte label="Garanties">
                <Select value={loan.insuranceGuarantees || "dc"} onValueChange={(v) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, insuranceGuarantees: v } : l) }))}>
                  <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dc">Décès (DC)</SelectItem>
                    <SelectItem value="dc_ptia">DC + PTIA</SelectItem>
                    <SelectItem value="dc_ptia_itt">DC + PTIA + ITT</SelectItem>
                    <SelectItem value="dc_ptia_itt_ipp">DC + PTIA + ITT + IPP</SelectItem>
                  </SelectContent>
                </Select>
              </ChampCollecte>
              <MoneyCollecte label="Prime annuelle (€)" value={loan.insurancePremium} onChange={(e) => setData(prev => ({ ...prev, otherLoans: prev.otherLoans.map((l, i) => i === li ? { ...l, insurancePremium: e.target.value } : l) }))} />
            </div>
          )}
        </div>
        {loan.loanType === "familial" && (
          <div className="text-xs rounded-xl px-3 py-1.5" style={{ background: BRAND.warningBg, color: BRAND.warning, border: `1px solid ${BRAND.warningBorder}` }}>
            <AlertTriangle className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden="true" />Prêt familial : non déductible de l'IFI (art. 974 III CGI)
          </div>
        )}
      </CardContent>
    </Card>
  ))}
  {(() => {
    // Recap credit : s'affiche des qu'il existe une charge de credit (immo OU autre).
    // Le taux vient de la source unique computeTauxEndettement (meme chiffre que le PDF).
    const res = computeTauxEndettement(data);
    if (res.numerateurAnnuel <= 0) return null;
    const totalPassif = (data.otherLoans || []).reduce((s, l) => s + Math.max(0, resolveOtherLoan(l).capitalRemaining), 0); // CRD résolu (saisi ou déduit)
    const chargesMensuelles = Math.round(res.numerateurAnnuel / 12);
    const over = res.tauxPct > 35;
    // Recap dense (Lot 10e) : bande KPI de la meme grammaire que Revenus.
    return (
      <KpiBandeCollecte>
        <KpiCollecte label="Total passif autres crédits" value={euro(totalPassif)} accent="navy" />
        <KpiCollecte label="Charges de crédit /mois" value={`${euro(chargesMensuelles)}`} accent="gold" />
        {res.denominateurAnnuel > 0 ? (
          <KpiCollecte
            label="Taux d'endettement"
            value={`${res.tauxPct} %`}
            accent={over ? "red" : "green"}
            note={over ? "Seuil HCSF : 35 % dépassé" : "Sous le seuil HCSF (35 %)"}
          />
        ) : <div />}
      </KpiBandeCollecte>
    );
  })()}
</TabsContent>

  );
});

TabCredits.displayName = "TabCredits";
export { TabCredits };
