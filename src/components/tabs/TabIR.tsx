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


// ── TabIR ─────────────────────────────────────────────────────────────────────
const TabIR = React.memo(function TabIR(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, ir, irOptions, setIrOptions, concubinPerson, setConcubinPerson, setChargesDialogOpen, person1, person2 } = props;

  return (
<TabsContent value="ir" className="space-y-4">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={FileText} title="Impôt sur le revenu" subtitle="Base imposable, barème, quotient familial et PFU." /></CardHeader>
    <CardContent className="space-y-4">
      {/* ⚠️ Warning seuil micro — uniquement si micro actif ET CA dépasse le seuil
           Le bénéfice micro est utilisé tel quel dans ce calcul IR. */}
      {(() => {
        const alertes = ([1, 2] as const).flatMap((w) => {
          const g   = w === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
          const c   = w === 1 ? data.person1Csp       : data.person2Csp;
          const indep = isIndependant(g) || isProfessionLiberale(c);
          if (!indep) return [];
          const ba    = g === "1";
          const bnc   = isProfessionLiberale(c);
          const bt    = w === 1 ? data.bicType1 : data.bicType2;
          const micro = w === 1 ? data.microRegime1 : data.microRegime2;
          if (!micro) return []; // pas en micro → pas de warning ici
          const seuil = ba ? 120000 : (bnc ? 77700 : (bt === "vente" ? 188700 : 77700));
          const ca    = n(w === 1 ? data.ca1 : data.ca2);
          if (ca <= seuil) return [];
          return [{ nom: w === 1 ? person1 : person2, ca, seuil }];
        });
        if (!alertes.length) return null;
        return (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
            style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.18)" }}>
            <span className="shrink-0 text-sm mt-0.5">⚠️</span>
            <div>
              <span className="font-semibold">Dépassement seuil micro — </span>
              {alertes.map((a, i) => (
                <span key={i}>{a.nom} : CA {a.ca.toLocaleString("fr-FR")} € &gt; {a.seuil.toLocaleString("fr-FR")} €. </span>
              ))}
              <span className="text-red-400">L'IR est calculé avec le régime micro actuel — à corriger si passage au réel confirmé.</span>
            </div>
          </div>
        );
      })()}

      {/* Warning micro-foncier > 15 000 € */}
      {irOptions.foncierRegime === "micro" && ir.foncierBrut > 15000 && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.18)" }}>
          <span className="shrink-0 text-sm mt-0.5">⚠️</span>
          <div>
            <span className="font-semibold">Revenus fonciers bruts ({euro(ir.foncierBrut)}) supérieurs à 15 000 € — </span>
            le régime micro-foncier n'est plus applicable au-delà de ce seuil.
            <span className="text-red-400"> Basculez en régime réel ci-dessous pour un calcul correct.</span>
          </div>
        </div>
      )}

      {/* KPIs principaux sur une ligne */}
      {/* Note concubinage */}
      {/* Note concubinage + switch personne */}
      {ir.isConcubin && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
              Concubinage — 2 déclarations séparées
            </div>
            {/* Switch personne */}
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(81,106,199,0.1)" }}>
              {([1, 2] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setConcubinPerson(p)}
                  className="rounded-lg px-3 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: concubinPerson === p ? BRAND.sky : "transparent",
                    color: concubinPerson === p ? "#fff" : BRAND.sky,
                  }}
                >
                  {p === 1 ? person1 : person2}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl p-3" style={{ background: concubinPerson === 1 ? "rgba(81,106,199,0.12)" : "rgba(0,0,0,0.03)", border: `1px solid ${concubinPerson === 1 ? "rgba(81,106,199,0.3)" : "transparent"}` }}>
              <div className="font-semibold mb-1" style={{ color: BRAND.navy }}>{person1}</div>
              <div className="text-slate-500">Revenu net : <strong>{euro((ir as any).rev1 || 0)}</strong></div>
              <div className="text-slate-500">Parts : <strong>{((ir as any).parts1 || 1).toFixed(2)}</strong></div>
              <div style={{ color: BRAND.sky }}>IR barème : <strong>{euro((ir as any).ir1 || 0)}</strong></div>
            </div>
            <div className="rounded-xl p-3" style={{ background: concubinPerson === 2 ? "rgba(81,106,199,0.12)" : "rgba(0,0,0,0.03)", border: `1px solid ${concubinPerson === 2 ? "rgba(81,106,199,0.3)" : "transparent"}` }}>
              <div className="font-semibold mb-1" style={{ color: BRAND.navy }}>{person2 || "Personne 2"}</div>
              <div className="text-slate-500">Revenu net : <strong>{euro((ir as any).rev2 || 0)}</strong></div>
              <div className="text-slate-500">Parts : <strong>{((ir as any).parts2 || 1).toFixed(2)}</strong></div>
              <div style={{ color: BRAND.sky }}>IR barème : <strong>{euro((ir as any).ir2 || 0)}</strong></div>
            </div>
          </div>
          <div className="text-xs text-slate-500 pt-1">
            Les détails ci-dessous correspondent à la déclaration de <strong>{concubinPerson === 1 ? person1 : (person2 || "Personne 2")}</strong>. Basculez pour voir l'autre foyer.
            Les enfants sont attribués selon leur lien de parenté.
          </div>
        </div>
      )}
      {/* Note option barème */}
      {data.placements.some((p) => p.pfuOptOut) && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "rgba(34,197,94,0.07)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>
          <span className="shrink-0">📊</span>
          <span>
            {data.placements.filter((p) => p.pfuOptOut).map((p) => p.name || "Placement").join(", ")} : option barème IR activée.
            Les revenus de ces placements sont intégrés au revenu global et imposés au barème progressif.
          </span>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="IR total" value={euro(ir.finalIR)} hint="Barème progressif + PFU + prélèvements sociaux fonciers" />
        <MetricCard label="Revenu net global" value={euro(ir.revenuNetGlobal)} hint="Salaires + revenus fonciers + pensions, après déductions" />
        <MetricCard label="TMI" value={`${Math.round(ir.marginalRate * 100)} %`} hint="Taux Marginal d'Imposition : taux de la dernière tranche atteinte" />
        <MetricCard label="Taux moyen" value={`${Math.round(ir.averageRate * 1000) / 10} %`} hint="IR total / revenu net imposable. Taux effectif réellement supporté" />
      </div>

      {/* Détail horizontal */}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Barème progressif" value={euro(ir.bareme)} hint="IR calculé par tranches sur le quotient familial, avant PFU et réductions" />
        <MetricCard label="PFU" value={euro(ir.totalPFU)} hint="Prélèvement Forfaitaire Unique de 31,4 % depuis 2026 (12,8 % IR + 18,6 % PS) sur les revenus de capitaux mobiliers et plus-values" />
        <MetricCard label="Quotient familial" value={euro(ir.quotient)} hint={`${ir.parts} part(s) — Revenu net divisé par le nombre de parts`} />
        <MetricCard label="Plafonnement QF" value={euro(ir.quotientFamilialCapAdjustment)} hint={`Avantage retenu : ${euro(Math.min(ir.qfBenefit, ir.qfCap))} — L'avantage fiscal par demi-part supplémentaire est plafonné à 1 759 € (2024)`} />
      </div>

      {/* Options frais + régime foncier — 2 personnes + 1 col régime côte à côte */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Options de calcul</div>
        <div className="grid gap-4 md:grid-cols-3">
          {/* P1 */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500">{person1}</div>
            {(isIndependant(data.person1PcsGroupe) || isProfessionLiberale(data.person1Csp)) ? (
              <div className="rounded-xl px-3 py-2 text-xs text-slate-400" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}>
                Indépendant — les frais pro sont inclus dans le bénéfice imposable (micro ou réel), pas dans les frais salariaux.
              </div>
            ) : (
            <Field label="Mode de frais" tooltip="Abattement 10 % : déduction forfaitaire de 10 % du salaire brut (min. 504 €, max. 14 426 €). Frais réels : déduction des frais professionnels réels justifiés (transport, repas, etc.). Choisir frais réels si le montant dépasse 10 % du salaire.">
              <Select value={irOptions.expenseMode1} onValueChange={(v: "standard" | "actual") => setIrOptions((prev) => ({ ...prev, expenseMode1: v }))}>
                <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="standard">Abattement 10 %</SelectItem><SelectItem value="actual">Frais réels</SelectItem></SelectContent>
              </Select>
            </Field>
            )}
            {!isIndependant(data.person1PcsGroupe) && !isProfessionLiberale(data.person1Csp) && irOptions.expenseMode1 === "actual" && (
              <div className="grid gap-2 grid-cols-2">
                <MoneyField label="Km professionnels" tooltip="Nombre de kilomètres parcourus à titre professionnel avec votre véhicule personnel. Multipliés par le barème kilométrique fiscal selon la puissance du véhicule." value={irOptions.km1} onChange={(e) => setIrOptions((prev) => ({ ...prev, km1: e.target.value }))} />
                <MoneyField label="CV fiscal" tooltip="Puissance fiscale du véhicule en chevaux-vapeur (CV). Détermine le barème kilométrique applicable : ex. 5 CV = 0,548 €/km jusqu'à 5 000 km." value={irOptions.cv1} onChange={(e) => setIrOptions((prev) => ({ ...prev, cv1: e.target.value }))} />
                <MoneyField label="Nb repas" tooltip="Nombre de repas pris hors domicile pour raison professionnelle. Chaque repas est déductible pour la différence entre son coût réel et la valeur d'un repas à domicile (~5 €)." value={irOptions.mealCount1} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealCount1: e.target.value }))} />
                <MoneyField label="€ / repas" tooltip="Coût moyen d'un repas professionnel. La fraction déductible est : coût réel − valeur repas domicile (environ 5,20 € en 2024)." value={irOptions.mealUnit1} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealUnit1: e.target.value }))} />
                <div className="col-span-2"><MoneyField label="Autres frais" tooltip="Autres frais professionnels réels : abonnement transport, fournitures, formation, cotisations syndicales, etc. À justifier en cas de contrôle." value={irOptions.other1} onChange={(e) => setIrOptions((prev) => ({ ...prev, other1: e.target.value }))} /></div>
                <div className="col-span-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                  IK : <strong>{euro(computeKilometricAllowance(n(irOptions.km1), n(irOptions.cv1)))}</strong> · Repas : <strong>{euro(n(irOptions.mealCount1) * n(irOptions.mealUnit1))}</strong>
                </div>
              </div>
            )}
          </div>
          {/* P2 */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500">{person2}</div>
            {(isIndependant(data.person2PcsGroupe) || isProfessionLiberale(data.person2Csp)) ? (
              <div className="rounded-xl px-3 py-2 text-xs text-slate-400" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}>
                Indépendant — les frais pro sont inclus dans le bénéfice imposable (micro ou réel), pas dans les frais salariaux.
              </div>
            ) : (
            <Field label="Mode de frais" tooltip="Abattement 10 % : déduction forfaitaire de 10 % du salaire brut (min. 504 €, max. 14 426 €). Frais réels : déduction des frais professionnels réels justifiés (transport, repas, etc.). Choisir frais réels si le montant dépasse 10 % du salaire.">
              <Select value={irOptions.expenseMode2} onValueChange={(v: "standard" | "actual") => setIrOptions((prev) => ({ ...prev, expenseMode2: v }))}>
                <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="standard">Abattement 10 %</SelectItem><SelectItem value="actual">Frais réels</SelectItem></SelectContent>
              </Select>
            </Field>
            )}
            {!isIndependant(data.person2PcsGroupe) && !isProfessionLiberale(data.person2Csp) && irOptions.expenseMode2 === "actual" && (
              <div className="grid gap-2 grid-cols-2">
                <MoneyField label="Km professionnels" tooltip="Nombre de kilomètres parcourus à titre professionnel avec votre véhicule personnel. Multipliés par le barème kilométrique fiscal selon la puissance du véhicule." value={irOptions.km2} onChange={(e) => setIrOptions((prev) => ({ ...prev, km2: e.target.value }))} />
                <MoneyField label="CV fiscal" tooltip="Puissance fiscale du véhicule en chevaux-vapeur (CV). Détermine le barème kilométrique applicable : ex. 5 CV = 0,548 €/km jusqu'à 5 000 km." value={irOptions.cv2} onChange={(e) => setIrOptions((prev) => ({ ...prev, cv2: e.target.value }))} />
                <MoneyField label="Nb repas" tooltip="Nombre de repas pris hors domicile pour raison professionnelle. Chaque repas est déductible pour la différence entre son coût réel et la valeur d'un repas à domicile (~5 €)." value={irOptions.mealCount2} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealCount2: e.target.value }))} />
                <MoneyField label="€ / repas" tooltip="Coût moyen d'un repas professionnel. La fraction déductible est : coût réel − valeur repas domicile (environ 5,20 € en 2024)." value={irOptions.mealUnit2} onChange={(e) => setIrOptions((prev) => ({ ...prev, mealUnit2: e.target.value }))} />
                <div className="col-span-2"><MoneyField label="Autres frais" tooltip="Autres frais professionnels réels : abonnement transport, fournitures, formation, cotisations syndicales, etc. À justifier en cas de contrôle." value={irOptions.other2} onChange={(e) => setIrOptions((prev) => ({ ...prev, other2: e.target.value }))} /></div>
                <div className="col-span-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                  IK : <strong>{euro(computeKilometricAllowance(n(irOptions.km2), n(irOptions.cv2)))}</strong> · Repas : <strong>{euro(n(irOptions.mealCount2) * n(irOptions.mealUnit2))}</strong>
                </div>
              </div>
            )}
          </div>
          {/* Foncier */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500">Revenus fonciers</div>
            <Field label="Régime foncier" tooltip="Micro-foncier : abattement forfaitaire de 30 % si revenus fonciers bruts < 15 000 €/an. Régime réel : déduction des charges réelles (intérêts, travaux, assurance…). Le régime réel est souvent plus avantageux en présence d'un emprunt.">
              <Select value={irOptions.foncierRegime} onValueChange={(v: "micro" | "real") => setIrOptions((prev) => ({ ...prev, foncierRegime: v }))}>
                <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="micro">Micro-foncier (30 %)</SelectItem><SelectItem value="real">Régime réel</SelectItem></SelectContent>
              </Select>
            </Field>
            <div className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600 space-y-0.5">
              <div>Foncier brut : <strong>{euro(ir.foncierBrut)}</strong></div>
              <div>Foncier taxable : <strong>{euro(ir.taxableFonciers)}</strong></div>
              <div>Prélèvements sociaux : <strong>{euro(ir.foncierSocialLevy)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Barème */}
      <BracketFillChart title="Barème IR — remplissage des tranches" data={ir.bracketFill} referenceValue={ir.quotient} valueLabel="Quotient familial" />

      {/* ── Waterfall fiscal ── */}
      {ir.revenuNetGlobal > 0 && (() => {
        // Revenus bruts = salaires + BNC/BIC + pensions + foncier brut + placements
        const revenusTotal = ir.salaries + ir.foncierBrut + (ir.taxablePlacements || 0);
        // Détail déductions : frais pro (abatt 10% ou réels) + PER + autres charges
        const fraisPro = ir.retainedExpenses || 0;
        const autresDeductions = ir.deductibleCharges || 0;
        const totalDeductions = fraisPro + autresDeductions;
        const steps = [
          { label: "Revenus bruts", value: revenusTotal, color: BRAND.navy, type: "add" as const },
          ...(fraisPro > 0 ? [{ label: "Frais pro / abatt. 10%", value: fraisPro, color: "#E3AF64", type: "ded" as const }] : []),
          ...(autresDeductions > 0 ? [{ label: "Versements PER & déd.", value: autresDeductions, color: "#C4A882", type: "ded" as const }] : []),
          { label: "Rev. net imposable", value: ir.revenuNetGlobal, color: BRAND.sky, type: "total" as const },
          { label: "Barème progressif", value: ir.bareme || 0, color: "#dc2626", type: "tax" as const },
          ...(ir.foncierSocialLevy > 0 ? [{ label: "Prél. sociaux foncier", value: ir.foncierSocialLevy, color: "#f97316", type: "tax" as const }] : []),
          ...(ir.totalPFU > 0 ? [{ label: "PFU placements", value: ir.totalPFU, color: "#f97316", type: "tax" as const }] : []),
          ...(ir.avRachatImpot > 0 ? [{ label: "Fiscalité AV rachat", value: ir.avRachatImpot, color: "#f97316", type: "tax" as const }] : []),
          { label: "IR total dû", value: ir.finalIR, color: "#b91c1c", type: "result" as const },
        ];
        const maxVal = Math.max(...steps.map(s => Math.abs(s.value)));
        return (
          <div className="rounded-2xl p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: BRAND.sky }}>Décomposition du calcul fiscal</div>
            <div className="space-y-2">
              {steps.map((step, i) => {
                const pct = maxVal > 0 ? step.value / maxVal * 100 : 0;
                const isDed = step.type === "ded";
                const isTax = step.type === "tax";
                const isResult = step.type === "result";
                const isTotal = step.type === "total";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="text-xs font-medium w-36 shrink-0 text-right" style={{ color: isDed ? "#92400e" : isTax ? "#c2410c" : "#94a3b8" }}>{step.label}</div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-6 rounded-lg overflow-hidden relative" style={{ background: "#f1f5f9" }}>
                        <div className="h-full rounded-lg transition-all" style={{
                          width: `${pct}%`,
                          background: step.color,
                          opacity: isDed ? 0.55 : isTax ? 0.8 : 1,
                        }} />
                      </div>
                      <div className="text-xs font-bold w-24 shrink-0" style={{ color: step.color }}>
                        {isDed ? `− ${euro(step.value)}` : euro(step.value)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </CardContent>
  </Card>
</TabsContent>

  );
});

TabIR.displayName = "TabIR";
export { TabIR };
