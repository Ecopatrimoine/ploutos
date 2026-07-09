import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardAccentTop } from "../CardAccentTop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, FileText, Database, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, plur, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge, EmptyState } from "../shared";
import { KpiRoiCard, SectionAccordion, type KpiRoiLine } from "../analysis";
import { buildIfiRoiCard } from "../../lib/analysis/ifiPresentation";
import { ifiEstVide } from "../../lib/gardefous";


// ── TabIFI ─────────────────────────────────────────────────────────────────────
const TabIFI = React.memo(function TabIFI(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, ifi, onGoToCollecte, person1, person2 } = props;

  // Carte-roi (Lot 10b) — décomposition « IFI barème − décote » réconciliée (ZÉRO recalcul).
  const roi = buildIfiRoiCard(ifi);
  const roiLines: KpiRoiLine[] = roi.lines.map((l) => ({
    label: l.label, value: euro(Math.abs(l.value)), detail: l.detail, tooltip: l.tooltip, negative: l.negative,
  }));
  const depasse = ifi.netTaxable >= 1300000;

  return (
<TabsContent value="ifi" className="space-y-4">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60 relative overflow-hidden">
    <CardAccentTop />
    <CardHeader><SectionTitle icon={FileText} title="IFI — Impôt sur la Fortune Immobilière" subtitle="Assiette, passif déductible, décote et barème progressif." /></CardHeader>
    <CardContent className="space-y-4">
      {ifiEstVide(ifi) ? (
        <EmptyState title="Aucun bien immobilier saisi" ctaLabel="Compléter l'onglet Immobilier" onCta={() => onGoToCollecte?.("immobilier")}>
          L'IFI se calcule sur votre patrimoine immobilier net taxable. Renseignez vos biens dans <strong>Collecte patrimoniale → Immobilier</strong> — l'assiette, le passif déductible, la décote et le barème progressif s'afficheront ensuite automatiquement.
        </EmptyState>
      ) : (<>

      {/* ══ ACTE 1 — L'ESSENTIEL ══ Carte-roi « IFI dû » (gauche, dominant) + contexte
           « patrimoine net taxable » et proximité du seuil 1,3 M€ (droite). */}
      <div className="grid gap-4 md:grid-cols-2">
        <KpiRoiCard
          title="IFI dû"
          amount={euro(roi.total)}
          accent={BRAND.danger}
          lines={roiLines}
          tooltip="IFI net dû = IFI au barème − décote. Exigible uniquement au-delà de 1 300 000 € d'actif net taxable."
          note={roi.belowThreshold ? "Patrimoine sous le seuil de 1,3 M€ — IFI non exigible cette année." : undefined}
        />
        {/* Contexte : patrimoine net taxable + proximité du seuil */}
        <div className="rounded-2xl px-5 py-4 flex flex-col justify-center" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: SURFACE.cardShadow }}>
          <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.muted }}>
            Patrimoine net taxable
            <HelpTooltip text="Valeur brute des biens immobiliers − passif déductible − abattement de 30 % sur la résidence principale." label="Patrimoine net taxable" />
          </div>
          <div className="font-black mt-1" style={{ color: BRAND.navy, fontSize: 28, lineHeight: 1.05 }}>{euro(ifi.netTaxable)}</div>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: SURFACE.border }}>
            <div className="flex justify-between text-xs mb-2" style={{ color: BRAND.muted }}>
              <span>0 €</span>
              <span style={{ color: depasse ? BRAND.danger : BRAND.muted, fontWeight: 700 }}>Seuil IFI : 1 300 000 €</span>
            </div>
            <div style={{ height: 8, background: SURFACE.border, borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{
                width: `${Math.min(100, ifi.netTaxable / 1300000 * 100)}%`,
                height: "100%",
                background: depasse
                  ? `linear-gradient(90deg, ${BRAND.gold}, ${BRAND.danger})`
                  : `linear-gradient(90deg, ${BRAND.success}, ${BRAND.gold})`,
                borderRadius: 4,
                transition: "width 0.3s",
              }} />
              {!depasse && <div style={{ position: "absolute", right: 0, top: -2, bottom: -2, width: 2, background: BRAND.danger }} />}
            </div>
            <div className="mt-2 text-xs font-bold" style={{ color: depasse ? BRAND.danger : BRAND.success }}>
              {depasse
                ? <><AlertTriangle className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden="true" />Seuil IFI dépassé de {euro(ifi.netTaxable - 1300000)}</>
                : `↓ ${euro(1300000 - ifi.netTaxable)} sous le seuil — pas d'IFI`}
            </div>
          </div>
        </div>
      </div>

      {/* ══ ACTE 2 — REMPLISSAGE DES TRANCHES ══ */}
      <BracketFillChart title="Barème IFI — remplissage des tranches" data={ifi.bracketFill} referenceValue={ifi.netTaxable} valueLabel="Base taxable" />

      {/* ══ ACTE 3 — LE DÉTAIL ══ (accordéons fermés, résumé chiffré visible) */}
      {/* §1 — Tableau des biens */}
      {ifi.lines.length > 0 && (
        <SectionAccordion title="Le détail des biens" summary={`${plur(ifi.lines.length, "bien")} · assiette ${euro(ifi.netTaxable)}`}>
          <div className="border overflow-hidden" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: BRAND.navy }}>
                    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.white }}>Bien</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.white }}>Droit</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.white }}>Valeur brute</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.white }}>Abattement RP</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.white }}>Passif</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.gold }}>Valeur taxable</th>
                  </tr>
                </thead>
                <tbody>
                  {ifi.lines.map((line, idx) => (
                    <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{line.rightMode}</td>
                      <td className="px-4 py-2.5 text-right">{euro(line.grossValue)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">- {euro(line.residenceAbatement)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">- {euro(line.deductibleDebt)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.taxableNet)}</td>
                    </tr>
                  ))}
                  <tr className="border-t" style={{ background: BRAND.cream, borderColor: SURFACE.borderStrong }}>
                    <td colSpan={5} className="px-4 py-2 text-right text-sm font-bold" style={{ color: BRAND.navy }}>Total assiette IFI</td>
                    <td className="px-4 py-2 text-right text-sm font-bold" style={{ color: BRAND.navy }}>{euro(ifi.netTaxable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </SectionAccordion>
      )}

      {/* §2 — Décote : formule et calcul */}
      <SectionAccordion
        title="Décote — formule et calcul"
        summary={ifi.decote > 0 ? `− ${euro(ifi.decote)} appliquée` : "Non applicable à ce niveau de patrimoine"}
      >
        <div className="text-xs space-y-2" style={{ color: BRAND.muted }}>
          <p>
            La décote atténue l'effet de seuil pour les patrimoines juste au-dessus de 1,3 M€. Elle s'applique
            lorsque l'actif net taxable est compris entre <strong>1 300 000 €</strong> et <strong>1 400 000 €</strong>.
          </p>
          <div className="rounded-xl px-3 py-2 font-mono text-[11px]" style={{ background: SURFACE.app, color: BRAND.navy }}>
            décote = 17 500 − 1,25 % × actif net taxable
          </div>
          {ifi.decote > 0 ? (
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Actif net taxable</span><strong style={{ color: BRAND.navy }}>{euro(ifi.netTaxable)}</strong></div>
              <div className="flex justify-between"><span>IFI au barème</span><strong style={{ color: BRAND.navy }}>{euro(ifi.grossIfi)}</strong></div>
              <div className="flex justify-between"><span>Décote appliquée</span><strong style={{ color: BRAND.success }}>− {euro(ifi.decote)}</strong></div>
              <div className="flex justify-between pt-1 mt-1" style={{ borderTop: `1px solid ${SURFACE.border}` }}><span className="font-semibold" style={{ color: BRAND.navy }}>IFI net dû</span><strong style={{ color: BRAND.danger }}>{euro(ifi.ifi)}</strong></div>
            </div>
          ) : (
            <p style={{ color: BRAND.muted }}>
              {ifi.netTaxable < 1300000
                ? "Actif net taxable sous 1,3 M€ : aucun IFI, donc aucune décote."
                : "Actif net taxable au-delà de 1,4 M€ : la décote ne s'applique plus."}
            </p>
          )}
        </div>
      </SectionAccordion>
      </>)}
    </CardContent>
  </Card>
</TabsContent>

  );
});

TabIFI.displayName = "TabIFI";
export { TabIFI };
