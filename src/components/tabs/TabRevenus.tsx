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


// ── TabRevenus ─────────────────────────────────────────────────────────────────────
const TabRevenus = React.memo(function TabRevenus(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, setData, setChargesDialogOpen, irOptions, setIrOptions, ir, person1, person2 } = props;

  return (
<TabsContent value="revenus" className="space-y-4">
  {/* Grille 2 colonnes : une par personne */}
  <div className="grid gap-4 md:grid-cols-2">
  {([1, 2] as const).map((which) => {
    const groupe = which === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
    const cat = which === 1 ? data.person1Csp : data.person2Csp;
    const personName = which === 1 ? person1 : person2;
    const isIndep = groupe === "1" || groupe === "2" || isProfessionLiberale(cat);
    const isBA = groupe === "1";
    const isBNC = isProfessionLiberale(cat);
    const isRetr = isRetraite(groupe);
    const isSansAct = isSansActivite(groupe);
    const micro = which === 1 ? data.microRegime1 : data.microRegime2;
    const caKey = which === 1 ? "ca1" : "ca2";
    const bicTypeKey = which === 1 ? "bicType1" : "bicType2";
    const microKey = which === 1 ? "microRegime1" : "microRegime2";
    const chargesKey = which === 1 ? "chargesReelles1" : "chargesReelles2";
    const baKey = which === 1 ? "baRevenue1" : "baRevenue2";
    const salaryKey = which === 1 ? "salary1" : "salary2";
    const caVal = which === 1 ? data.ca1 : data.ca2;
    const bicTypeVal = which === 1 ? data.bicType1 : data.bicType2;
    const chargesVal = which === 1 ? data.chargesReelles1 : data.chargesReelles2;
    const baVal = which === 1 ? data.baRevenue1 : data.baRevenue2;
    const salaryVal = which === 1 ? data.salary1 : data.salary2;

    // Calcul aperçu bénéfice
    const caNum = n(caVal);
    let abattementInfo = "";
    let beneficeApercu = 0;
    if (isIndep && !isBA && caNum > 0) {
      if (micro) {
        const rate = isBNC ? 0.34 : (bicTypeVal === "vente" ? 0.71 : 0.50);
        const abatt = Math.max(305, caNum * rate);
        beneficeApercu = Math.max(0, caNum - abatt);
        abattementInfo = `Abattement ${Math.round(rate * 100)}% = ${abatt.toLocaleString("fr-FR")} € → Base imposable : ${beneficeApercu.toLocaleString("fr-FR")} €`;
      } else {
        beneficeApercu = Math.max(0, caNum - n(chargesVal));
        abattementInfo = `Bénéfice net imposable : ${beneficeApercu.toLocaleString("fr-FR")} €`;
      }
    }

    if (isSansAct) return null; // pas de revenus pro

    return (
      <div key={which} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>{personName}</div>
          <div className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
            background: isIndep ? "rgba(227,175,100,0.15)" : isRetr ? "rgba(81,106,199,0.1)" : "rgba(81,106,199,0.1)",
            color: isIndep ? BRAND.gold : BRAND.sky,
          }}>
            {isBA ? "BA" : isBNC ? "BNC" : isIndep ? "BIC" : isRetr ? "Retraité" : "Salarié"}
          </div>
        </div>

        {/* Salarié / fonctionnaire */}
        {!isIndep && !isRetr && (
          <MoneyField
            label={`Salaire net imposable`}
            tooltip="Salaire net avant impôt. Pour les salariés, l'abattement de 10% (ou frais réels) sera appliqué dans l'onglet IR."
            value={salaryVal}
            onChange={(e) => setField(salaryKey, e.target.value)}
          />
        )}

        {/* Retraité */}
        {isRetr && (
          <MoneyField
            label="Pensions de retraite"
            tooltip="Total des pensions perçues. Abattement de 10% appliqué automatiquement (plafonné à 4 123 €)."
            value={data.pensions}
            onChange={(e) => setField("pensions", e.target.value)}
          />
        )}

        {/* Agriculteur — BA avec toggle Micro / Réel */}
        {isBA && (() => {
          const caNum = n(caVal);
          const depasseBA = micro && caNum > 0 && caNum > SEUIL_MICRO_BA;
          const apercuBA = micro && caNum > 0
            ? `Abattement 87% → base imposable : ${Math.max(0, caNum - Math.max(305, caNum * 0.87)).toLocaleString("fr-FR")} €`
            : "";
          return (
            <>
              {/* Switch Micro / Réel */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Régime fiscal</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs font-medium" style={{ color: micro ? BRAND.sky : BRAND.gold }}>
                    {micro ? "Micro-BA" : "Réel"}
                  </span>
                  <button
                    role="switch" aria-checked={micro}
                    onClick={() => setField(microKey, !micro)}
                    className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
                    style={{ width: 34, height: 19, background: micro ? BRAND.sky : "#d1d5db", flexShrink: 0 }}
                  >
                    <span className="absolute rounded-full bg-white shadow transition-all"
                      style={{ width: 15, height: 15, top: 2, left: micro ? 17 : 2 }} />
                  </button>
                </label>
              </div>
              {/* Champ selon régime */}
              {micro ? (
                <>
                  <MoneyField
                    label="Recettes HT (année N)"
                    tooltip={`Recettes brutes HT de l'exploitation agricole. Abattement forfaitaire de 87% (min. 305 €). Seuil micro-BA : ${SEUIL_MICRO_BA.toLocaleString("fr-FR")} € (moyenne triennale 2024-2025).`}
                    value={caVal}
                    onChange={(e) => setField(caKey, e.target.value)}
                  />
                  {depasseBA && (
                    <div className="flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-xs" style={{ background: "rgba(220,38,38,0.07)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>
                      <span className="shrink-0">⚠️</span>
                      <span>Recettes {caNum.toLocaleString("fr-FR")} € &gt; seuil micro-BA {SEUIL_MICRO_BA.toLocaleString("fr-FR")} €. Passage au réel obligatoire si dépassement 2 ans consécutifs.</span>
                    </div>
                  )}
                  {apercuBA && (
                    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(81,106,199,0.08)", color: BRAND.sky, border: "1px solid rgba(81,106,199,0.15)" }}>
                      💡 {apercuBA}
                    </div>
                  )}
                </>
              ) : (
                <MoneyField
                  label="Bénéfice agricole net (BA)"
                  tooltip="Bénéfice net de l'exploitation après déduction des charges réelles. Imposable au barème progressif de l'IR."
                  value={caVal}
                  onChange={(e) => setField(caKey, e.target.value)}
                />
              )}
            </>
          );
        })()}

        {/* Indépendant BIC / BNC */}
        {isIndep && !isBA && (
          <>
            {/* Toggle Micro / Réel — switch */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Régime fiscal</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-medium" style={{ color: micro ? BRAND.sky : BRAND.gold }}>
                  {micro ? "Micro" : "Réel"}
                </span>
                <button
                  role="switch" aria-checked={micro}
                  onClick={() => setField(microKey, !micro)}
                  className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
                  style={{ width: 34, height: 19, background: micro ? BRAND.sky : "#d1d5db", flexShrink: 0 }}
                >
                  <span
                    className="absolute rounded-full bg-white shadow transition-all"
                    style={{ width: 15, height: 15, top: 2, left: micro ? 17 : 2 }}
                  />
                </button>
              </label>
            </div>

            {/* Type BIC uniquement */}
            {!isBNC && (
              <Field label="Nature de l'activité BIC">
                <Select value={bicTypeVal} onValueChange={(v) => setField(bicTypeKey, v)}>
                  <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="services">Prestations de services (abatt. 50%)</SelectItem>
                    <SelectItem value="vente">Achat-revente / commerce (abatt. 71%)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {/* CA */}
            {(() => {
              const seuilMicro = isBNC ? 77700 : (bicTypeVal === "vente" ? 188700 : 77700);
              const depasseSeuil = micro && caNum > 0 && caNum > seuilMicro;
              return (
                <>
                  <MoneyField
                    label={`Chiffre d'affaires HT${isBNC ? " (recettes)" : ""}`}
                    tooltip={isBNC
                      ? "Recettes brutes HT de l'activité libérale. L'abattement de 34% sera appliqué en régime micro pour obtenir la base imposable."
                      : bicTypeVal === "vente"
                        ? "CA HT annuel. Abattement forfaitaire de 71% en micro pour activités de vente/commerce."
                        : "CA HT annuel. Abattement forfaitaire de 50% en micro pour prestations de services BIC."
                    }
                    value={caVal}
                    onChange={(e) => setField(caKey, e.target.value)}
                  />
                  {depasseSeuil && (
                    <div className="flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-xs" style={{ background: "rgba(220,38,38,0.07)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>
                      <span className="shrink-0">⚠️</span>
                      <span>CA {caNum.toLocaleString("fr-FR")} € &gt; seuil micro {seuilMicro.toLocaleString("fr-FR")} €. Régime réel obligatoire si dépassement 2 ans consécutifs.</span>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Charges réelles (régime réel uniquement) */}
            {!micro && (() => {
              const detail: ChargesDetail = (which === 1 ? data.chargesDetail1 : data.chargesDetail2) as ChargesDetail || EMPTY_CHARGES_DETAIL;
              const hasDetail = sumChargesDetail(detail) > 0;
              return (
                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <MoneyField
                      label="Charges professionnelles déductibles"
                      tooltip="Total des charges réelles déductibles. Cliquez sur le bouton détail pour ventiler par nature. Bénéfice imposable = CA − Charges."
                      value={chargesVal}
                      onChange={(e) => setField(chargesKey, e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => setChargesDialogOpen(which)}
                    className="mb-0.5 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: hasDetail ? BRAND.navy : "rgba(81,106,199,0.1)",
                      color: hasDetail ? "#fff" : BRAND.sky,
                      border: hasDetail ? "none" : "1px solid rgba(81,106,199,0.2)",
                      whiteSpace: "nowrap",
                    }}
                    title="Détailler les charges par nature"
                  >
                    <FileText className="h-3 w-3" />
                    {hasDetail ? "Détail ✓" : "Détailler"}
                  </button>
                </div>
              );
            })()}

            {/* Aperçu bénéfice imposable */}
            {caNum > 0 && abattementInfo && (
              <div className="rounded-xl px-3 py-2 text-xs" style={{
                background: "rgba(81,106,199,0.08)",
                color: BRAND.sky,
                border: "1px solid rgba(81,106,199,0.15)",
              }}>
                💡 {abattementInfo}
              </div>
            )}
          </>
        )}
      </div>
    );
  })}

  </div>{/* fin grid 2 colonnes */}

  {/* ── Pensions nominatives ── */}
  {(!isRetraite(data.person1PcsGroupe) || !isRetraite(data.person2PcsGroupe)) && (
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Autres revenus</div>
      <div className="grid gap-3 md:grid-cols-2">
        {!isRetraite(data.person1PcsGroupe) && (
          <MoneyField
            label={`Pensions / retraites — ${person1}`}
            tooltip="Retraite, pension complémentaire, rente. Abattement de 10% appliqué automatiquement (plafonné à 4 123 €)."
            value={data.pensions1 || ""}
            onChange={(e) => setField("pensions1", e.target.value)}
          />
        )}
        {!isRetraite(data.person2PcsGroupe) && (data.person2FirstName || data.person2LastName) && (
          <MoneyField
            label={`Pensions / retraites — ${person2 || "Personne 2"}`}
            tooltip="Retraite, pension complémentaire, rente. Abattement de 10% appliqué automatiquement (plafonné à 4 123 €)."
            value={data.pensions2 || ""}
            onChange={(e) => setField("pensions2", e.target.value)}
          />
        )}
      </div>
    </div>
  )}

  {/* ── Rentes PER ── */}
  <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
    <div className="flex items-center justify-between">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Rentes PER — Phase de rente</div>
      <Button variant="outline" className="h-7 rounded-xl px-3 text-xs"
        onClick={() => setData(prev => ({ ...prev, perRentes: [...(prev.perRentes || []), { owner: "person1", annualAmount: "", ageAtFirst: "" }] }))}>
        <Plus className="mr-1 h-3 w-3" />Ajouter une rente
      </Button>
    </div>
    {(!data.perRentes || data.perRentes.length === 0) && (
      <div className="text-xs text-slate-400 italic">Aucune rente PER. Les rentes PER sont imposées selon le régime des rentes viagères à titre onéreux (RVTO, art. 158-6 CGI) : seule une fraction est imposable au barème selon l'âge au 1er versement.</div>
    )}
    {(data.perRentes || []).map((rente, ri) => {
      const montant = n(rente.annualAmount || "");
      const age = Math.max(0, n(rente.ageAtFirst || "0"));
      const fraction = fractionRVTO(age);
      const imposable = montant * fraction;
      const ps = imposable * 0.172;
      return (
        <div key={ri} className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border }}>
          {/* Ligne 1 : titulaire + montant + âge */}
          <div className="grid gap-2 grid-cols-[1fr_1.2fr_1fr_auto]">
            <Field label="Titulaire">
              <Select value={rente.owner} onValueChange={(v) => setData(prev => ({ ...prev, perRentes: prev.perRentes.map((r, i) => i === ri ? { ...r, owner: v } : r) }))}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person1">{person1}</SelectItem>
                  <SelectItem value="person2">{person2 || "Personne 2"}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <MoneyField label="Rente annuelle brute (€)" tooltip="Montant annuel brut de la rente PER perçue. La fraction imposable est calculée automatiquement selon l'âge au 1er versement." value={rente.annualAmount} onChange={(e) => setData(prev => ({ ...prev, perRentes: prev.perRentes.map((r, i) => i === ri ? { ...r, annualAmount: e.target.value } : r) }))} compact />
            <Field label="Âge au 1er versement" tooltip="Âge au moment du 1er versement de rente. Détermine la fraction imposable : <50 ans = 70%, 50-59 = 50%, 60-69 = 40%, ≥70 = 30%.">
              <Input type="number" min="18" max="100" placeholder="ex: 65" value={rente.ageAtFirst} onChange={(e) => setData(prev => ({ ...prev, perRentes: prev.perRentes.map((r, i) => i === ri ? { ...r, ageAtFirst: e.target.value } : r) }))} className="rounded-xl h-8 text-sm" />
            </Field>
            <div className="flex items-end pb-0.5">
              <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => setData(prev => ({ ...prev, perRentes: prev.perRentes.filter((_, i) => i !== ri) }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {/* Ligne 2 : simulation fiscale */}
          {montant > 0 && age > 0 && (
            <div className="rounded-xl px-3 py-2 text-xs grid grid-cols-2 gap-x-4 gap-y-1"
              style={{ background: "rgba(81,106,199,0.06)", border: "1px solid rgba(81,106,199,0.15)" }}>
              <span className="font-semibold col-span-2" style={{ color: BRAND.sky }}>RVTO — Fraction imposable {Math.round(fraction * 100)}% (âge {age} ans)</span>
              <span className="text-slate-500">Fraction imposable au barème :</span>
              <span className="font-medium text-right">{euro(imposable)}</span>
              <span className="text-slate-500">IR estimé ({Math.round(ir.marginalRate * 100)}% TMI) :</span>
              <span className="font-medium text-right">{euro(imposable * ir.marginalRate)}</span>
              <span className="text-slate-500">PS 17,2% sur fraction :</span>
              <span className="font-medium text-right">{euro(ps)}</span>
              <span className="font-semibold text-slate-600">Total estimé :</span>
              <span className="font-semibold text-right" style={{ color: BRAND.sky }}>{euro(imposable * ir.marginalRate + ps)}</span>
            </div>
          )}
        </div>
      );
    })}
  </div>

  {/* ── Charges déductibles ── */}
  <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Charges déductibles du revenu global</div>
    {/* Versements PER déplacés dans l'onglet Placements */}
    <MoneyField label="Pensions alimentaires déductibles" tooltip="Pensions alimentaires versées à un enfant majeur ou à un ex-conjoint, déductibles sous conditions." value={data.pensionDeductible} onChange={(e) => setField("pensionDeductible", e.target.value)} />
    <MoneyField label="Autres charges déductibles" tooltip="Autres déductions du revenu global : épargne retraite PERP, cotisations Madelin, etc." value={data.otherDeductible} onChange={(e) => setField("otherDeductible", e.target.value)} />
    <MoneyField
      label="CSG déductible — revenus fonciers N-1 (ligne 6DE)"
      tooltip="CSG déductible sur les revenus fonciers de l'année précédente. Correspond à 6,8% des revenus fonciers nets N-1. Montant indiqué sur votre avis d'imposition à la ligne 6DE — à reporter directement ici."
      value={data.csgDeductibleFoncier || ""}
      onChange={(e) => setField("csgDeductibleFoncier", e.target.value)}
    />
  </div>
</TabsContent>

  );
});

TabRevenus.displayName = "TabRevenus";
export { TabRevenus };
