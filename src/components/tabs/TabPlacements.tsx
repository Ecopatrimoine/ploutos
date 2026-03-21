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


// ── TabPlacements ─────────────────────────────────────────────────────────────────────
const TabPlacements = React.memo(function TabPlacements(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, placementFamily, setPlacementFamily, addPlacement, updatePlacementStr, updatePlacementBool, removePlacement, addPlacementBeneficiary, updatePlacementBeneficiary, removePlacementBeneficiary, importFamilyBeneficiaries, setField, setData, ownerOptions, ir, irOptions, person1, person2 } = props;

  return (
<TabsContent value="placements" className="space-y-4">
  <div className="flex items-center justify-between gap-4">
    <h3 className="font-semibold" style={{ color: BRAND.navy }}>Placements et comptes</h3>
    <div className="flex items-center gap-2">
      <Select value={placementFamily} onValueChange={setPlacementFamily}>
        <SelectTrigger className="h-9 rounded-xl w-52 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{PLACEMENT_FAMILIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select onValueChange={(v) => { if (v) addPlacement(v); }}>
        <SelectTrigger className="h-9 rounded-xl w-52 text-sm"><SelectValue placeholder="Ajouter un produit…" /></SelectTrigger>
        <SelectContent>{(PLACEMENT_TYPES_BY_FAMILY[placementFamily] || []).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </div>
  {data.placements.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border }}>Aucun placement saisi. Sélectionnez une famille puis un produit.</div>}
  {data.placements.map((placement, index) => {
    const fiscal = placementFiscalSummary(placement.type);
    const totalShare = placement.beneficiaries.reduce((s, b) => s + n(b.share), 0);
    const shareOverflow = totalShare > 100.0001;
    const isAVType = isAV(placement.type);
    const isCash = isCashPlacement(placement.type);
    const isUCorCapi = placement.type === "Assurance-vie unités de compte" || placement.type === "Contrat de capitalisation";
    return (
      <Card key={index} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
        <CardContent className="p-4 space-y-2">
          {/* Ligne identité + suppression compacte */}
          <div className="flex items-end gap-2">
            <div className="flex-1 grid gap-2 grid-cols-[1fr_1.8fr_0.9fr_1fr]">
              <Field label="Nom"><Input value={placement.name} onChange={(e) => updatePlacementStr(index, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
              <Field label="Type">
                <Select value={placement.type} onValueChange={(v) => updatePlacementStr(index, "type", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_PLACEMENTS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Titulaire">
                <Select value={placement.ownership} onValueChange={(v) => updatePlacementStr(index, "ownership", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ownerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <MoneyField label="Encours" tooltip="Valeur actuelle du placement (valeur de rachat pour une assurance-vie, solde pour un compte). Utilisée pour le calcul du patrimoine net et de l'IFI le cas échéant." value={placement.value} onChange={(e) => updatePlacementStr(index, "value", e.target.value)} compact />
            </div>
            <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => removePlacement(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>

          {/* Badges fiscaux + nantissement */}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${BRAND.gold}22`, color: BRAND.navy }}>IR : {fiscal.ir}</span>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${BRAND.sky}15`, color: BRAND.sky }}>Succession : {fiscal.succession}</span>
            {(() => {
              // Vérifier si ce placement est nanti par un crédit in fine
              const pledgingProp = data.properties.find(
                p => p.loanEnabled && p.loanType === "in_fine" && +(p.loanPledgedPlacementIndex ?? "-1") === index
              );
              if (!pledgingProp) return null;
              const lv = resolveLoanValuesMulti(pledgingProp);
              return (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1" style={{ background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>
                  🔒 Nanti — {pledgingProp.name || pledgingProp.type} ({euro(lv.capital)})
                </span>
              );
            })()}
          </div>

          {/* Champs selon type — grille dense sans divs vides */}
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
            {!isAVType && !isCash && !isPERType(placement.type) && <MoneyField label="Revenu annuel" tooltip="Revenus générés par le placement sur l'année (coupons, dividendes, intérêts). Utilisés dans le calcul de l'impôt sur le revenu." value={placement.annualIncome} onChange={(e) => updatePlacementStr(index, "annualIncome", e.target.value)} compact />}
            {placementNeedsTaxableIncome(placement.type) && !isPERType(placement.type) && <MoneyField label="Part taxable" tooltip="Fraction des revenus soumise à l'impôt après abattements éventuels. Pour les dividendes : abattement de 40% en régime au barème. À saisir après abattement." value={placement.taxableIncome} onChange={(e) => updatePlacementStr(index, "taxableIncome", e.target.value)} compact />}
            {!isAVType && !isCash && !isPERType(placement.type) && <MoneyField label="Valeur au décès" tooltip="Valeur du placement retenue pour le calcul de la succession. Peut différer de l'encours (ex : contrat de capitalisation transmis par testament)." value={placement.deathValue} onChange={(e) => updatePlacementStr(index, "deathValue", e.target.value)} compact />}
            {!isAVType && placementNeedsOpenDate(placement.type) && (
              <Field label="Date d'ouverture"><Input type="date" value={placement.openDate} onChange={(e) => updatePlacementStr(index, "openDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
            )}
            {!isAVType && !isCash && placementNeedsPFU(placement.type) && (
              <Field label="PFU">
                <Select value={placement.pfuEligible ? "yes" : "no"} onValueChange={(v) => updatePlacementBool(index, v === "yes")}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="yes">Oui</SelectItem><SelectItem value="no">Non</SelectItem></SelectContent>
                </Select>
              </Field>
            )}
            {!isAVType && !isCash && placement.pfuEligible && (
              <Field label="Régime fiscal" tooltip="PFU (flat tax 31,4%) : taux forfaitaire depuis 2026 (12,8% IR + 18,6% PS). Option barème IR : avantageux si votre TMI est inférieure à 30% (tranches 0% ou 11%). Comparez avec votre taux marginal affiché dans l'onglet IR.">
                <button
                  onClick={() => setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, pfuOptOut: !p.pfuOptOut } : p) }))}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium w-full"
                  style={{
                    background: placement.pfuOptOut ? "rgba(81,106,199,0.1)" : "rgba(81,106,199,0.06)",
                    color: BRAND.sky,
                    border: `1px solid rgba(81,106,199,0.2)`,
                  }}
                >
                  {placement.pfuOptOut ? "📊 Option barème IR" : "📋 PFU 31,4%"}
                </button>
              </Field>
            )}
            {(isAVType || isPERType(placement.type)) && <MoneyField label="Primes nettes" tooltip="Total des versements effectués sur le contrat nets de retraits partiels. Sert de base au calcul de la fiscalité succession 990I/757B." value={placement.totalPremiumsNet} onChange={(e) => updatePlacementStr(index, "totalPremiumsNet", e.target.value)} compact />}
            {(isAVType || isPERType(placement.type)) && <MoneyField label="Primes < 70 ans" tooltip="Versements avant les 70 ans de l'assuré. Abattement 152 500 € par bénéficiaire hors succession (art. 990 I CGI) — même régime que l'AV pour les PER assurantiels." value={placement.premiumsBefore70} onChange={(e) => updatePlacementStr(index, "premiumsBefore70", e.target.value)} compact />}
            {(isAVType || isPERType(placement.type)) && <MoneyField label="Primes ≥ 70 ans" tooltip="Versements après les 70 ans de l'assuré. Abattement global 30 500 € (art. 757 B CGI) — même régime pour les PER assurantiels et Madelin." value={placement.premiumsAfter70} onChange={(e) => updatePlacementStr(index, "premiumsAfter70", e.target.value)} compact />}
            {isAVType && placementNeedsOpenDate(placement.type) && (
              <Field label="Date d'ouverture"><Input type="date" value={placement.openDate} onChange={(e) => updatePlacementStr(index, "openDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
            )}
            {(isAVType || isPERType(placement.type)) && <MoneyField label="Capital exonéré succ." tooltip="Capital transmis hors succession via la clause bénéficiaire (art. 990 I pour primes < 70 ans). Même régime AV/PER assurantiel/Madelin." value={placement.exemptFromSuccession} onChange={(e) => updatePlacementStr(index, "exemptFromSuccession", e.target.value)} compact />}
            {isUCorCapi && (
              <Field label="Part UC (%)">
                <Input type="number" min="0" max="100" placeholder="ex: 70" value={placement.ucRatio} onChange={(e) => updatePlacementStr(index, "ucRatio", e.target.value)} className="rounded-xl h-8 text-sm" />
              </Field>
            )}
            {/* PER : versement annuel + switch déductible + part UC dans la grille */}
            {isPERType(placement.type) && (
              <>
                <MoneyField
                  label="Versement annuel (€)"
                  tooltip="Versements annuels sur ce PER. Activez le switch 'Déductible IR' pour que ce montant réduise votre revenu imposable."
                  value={placement.annualContribution || ""}
                  onChange={(e) => updatePlacementStr(index, "annualContribution", e.target.value)}
                  compact
                />
                <Field label="Déductible IR" tooltip="ON = versement déduit du revenu imposable (dans la limite du plafond). OFF = versement non déductible (plafond épuisé, abondement employeur, etc.)">
                  <div className="flex items-center gap-2 h-8">
                    <button
                      role="switch"
                      aria-checked={placement.perDeductible !== false}
                      onClick={() => setData(prev => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, perDeductible: !(p.perDeductible !== false) } : p) }))}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
                      style={{ background: placement.perDeductible !== false ? BRAND.sky : "#d1d5db" }}
                    >
                      <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
                        style={{ transform: placement.perDeductible !== false ? "translateX(18px)" : "translateX(2px)" }} />
                    </button>
                    <span className="text-xs font-medium" style={{ color: placement.perDeductible !== false ? BRAND.sky : "#9ca3af" }}>
                      {placement.perDeductible !== false ? "Oui" : "Non"}
                    </span>
                  </div>
                </Field>
                <Field label="Part UC (%)">
                  <Input type="number" min="0" max="100" placeholder="ex: 30" value={placement.ucRatio} onChange={(e) => updatePlacementStr(index, "ucRatio", e.target.value)} className="rounded-xl h-8 text-sm" />
                </Field>
              </>
            )}
          </div>

          {/* Warning plafond PER par personne */}
          {isPERType(placement.type) && (() => {
            const versement = n(placement.annualContribution || "");
            const deductible = placement.perDeductible !== false;
            const isP1 = placement.ownership === "person1";
            const isP2 = placement.ownership === "person2";
            const plafond = isP1 ? (ir as any).plafondPER1 : isP2 ? (ir as any).plafondPER2 : 0;
            const totalDeduit = isP1 ? (ir as any).perP1Deductible : isP2 ? (ir as any).perP2Deductible : 0;
            const titulaire = isP1 ? person1 : isP2 ? person2 : "";
            if (!deductible && versement > 0) return (
              <div className="text-xs rounded-xl px-3 py-1.5" style={{ background: "rgba(156,163,175,0.1)", color: "#9ca3af" }}>
                Versement non déductible — aucun impact sur l'IR
              </div>
            );
            if (!deductible || versement === 0 || plafond === 0) return null;
            const depasse = totalDeduit > plafond;
            return (
              <div className="rounded-xl px-3 py-2 text-xs" style={{
                background: depasse ? "rgba(220,38,38,0.06)" : "rgba(34,197,94,0.06)",
                color: depasse ? "#dc2626" : "#16a34a",
                border: `1px solid ${depasse ? "rgba(220,38,38,0.2)" : "rgba(34,197,94,0.2)"}`,
              }}>
                {depasse
                  ? <>⚠️ <strong>Plafond dépassé {titulaire && `(${titulaire})`}</strong> — Total déductible : {euro(totalDeduit)} / Plafond : {euro(plafond)}. Excédent non déductible.</>
                  : <>✓ {titulaire && <strong>{titulaire} — </strong>}Plafond restant : <strong>{euro(Math.max(0, plafond - totalDeduit))}</strong> · Économie IR estimée : <strong>{euro(Math.min(versement, Math.max(0, plafond - totalDeduit + versement)) * ir.marginalRate)}</strong></>
                }
              </div>
            );
          })()}

          {/* ── Retrait PER en capital ── */}
          {isPERType(placement.type) && (() => {
            const retrait = n(placement.perWithdrawal || "");
            const capital = n(placement.perWithdrawalCapital || "");
            const interets = n(placement.perWithdrawalInterest || "");
            const anticipe = placement.perAnticiped === true;
            // Calcul auto si ventilation non renseignée
            const encours = n(placement.value);
            const versements = n(placement.annualContribution || "");
            const ratioCapAuto = encours > 0 && versements > 0 ? Math.min(1, versements / encours) : 0.5;
            const capAff = capital > 0 ? capital : retrait > 0 ? retrait * ratioCapAuto : 0;
            const intAff = interets > 0 ? interets : retrait > 0 ? retrait * (1 - ratioCapAuto) : 0;
            return retrait > 0 || capital > 0 || interets > 0 ? (
              <div className="space-y-2">
                {/* Ligne 1 : montants */}
                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
                  <MoneyField label="Retrait annuel (€)" tooltip="Montant total retiré du PER par an en sortie capital. Le capital (versements) est imposé au barème IR, les intérêts au PFU 31,4%." value={placement.perWithdrawal || ""} onChange={(e) => updatePlacementStr(index, "perWithdrawal", e.target.value)} compact />
                  <MoneyField label="dont Capital (€)" tooltip="Part capital des versements déductibles dans le retrait. Si non renseigné, calculé automatiquement selon le ratio encours/versements." value={placement.perWithdrawalCapital || ""} onChange={(e) => updatePlacementStr(index, "perWithdrawalCapital", e.target.value)} compact />
                  <MoneyField label="dont Intérêts (€)" tooltip="Part des intérêts/plus-values dans le retrait. Taxés au PFU 31,4%. Si non renseigné, calculé automatiquement." value={placement.perWithdrawalInterest || ""} onChange={(e) => updatePlacementStr(index, "perWithdrawalInterest", e.target.value)} compact />
                  {/* Switch déblocage anticipé */}
                  <Field label="Anticipé" tooltip="Déblocage anticipé (cas exceptionnel : invalidité, décès conjoint, fin droits chômage, liquidation, achat RP). Le capital est alors exonéré d'IR, seuls les intérêts sont taxés au PFU.">
                    <div className="flex items-center h-8 gap-1.5">
                      <button role="switch" aria-checked={anticipe}
                        onClick={() => setData(prev => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, perAnticiped: !anticipe } : p) }))}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
                        style={{ background: anticipe ? "#f59e0b" : "#d1d5db" }}>
                        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                          style={{ transform: anticipe ? "translateX(18px)" : "translateX(2px)" }} />
                      </button>
                      <span className="text-xs" style={{ color: anticipe ? "#b45309" : "#9ca3af" }}>{anticipe ? "Oui" : "Non"}</span>
                    </div>
                  </Field>
                </div>
                {/* Ligne 2 : simulation fiscale */}
                {retrait > 0 && (
                  <div className="rounded-xl px-3 py-2 text-xs grid grid-cols-2 gap-x-4 gap-y-1"
                    style={{ background: "rgba(81,106,199,0.06)", border: "1px solid rgba(81,106,199,0.15)" }}>
                    <span className="text-slate-500 col-span-2 font-semibold" style={{ color: BRAND.sky }}>
                      Simulation fiscale retrait {anticipe ? "— Déblocage anticipé" : "— Retraite"}
                    </span>
                    {anticipe ? (
                      <>
                        <span className="text-slate-500">Capital exonéré :</span>
                        <span className="font-medium text-right">{euro(capAff)} <span className="text-green-600 text-xs">✓ Exonéré</span></span>
                        <span className="text-slate-500">Intérêts PFU 31,4% :</span>
                        <span className="font-medium text-right">{euro(intAff * 0.314)}</span>
                        <span className="text-slate-600 font-semibold">Impact fiscal total :</span>
                        <span className="font-semibold text-right" style={{ color: BRAND.sky }}>{euro(intAff * 0.314)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500">Capital au barème ({Math.round(ir.marginalRate * 100)}% TMI) :</span>
                        <span className="font-medium text-right">{euro(capAff * ir.marginalRate)}</span>
                        <span className="text-slate-500">Intérêts PFU 31,4% :</span>
                        <span className="font-medium text-right">{euro(intAff * 0.314)}</span>
                        <span className="text-slate-600 font-semibold">Impact fiscal total :</span>
                        <span className="font-semibold text-right" style={{ color: BRAND.sky }}>{euro(capAff * ir.marginalRate + intAff * 0.314)}</span>
                      </>
                    )}
                    {(capital === 0 || interets === 0) && retrait > 0 && (
                      <span className="col-span-2 text-xs text-slate-400 italic">
                        Ventilation auto : {Math.round(ratioCapAuto * 100)}% capital / {Math.round((1 - ratioCapAuto) * 100)}% intérêts. Saisissez les montants pour affiner.
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Champ retrait visible même si vide */
              <MoneyField label="Retrait annuel (€)" tooltip="Montant annuel retiré du PER en sortie capital. Capital taxé au barème IR, intérêts au PFU 31,4%." value={placement.perWithdrawal || ""} onChange={(e) => updatePlacementStr(index, "perWithdrawal", e.target.value)} compact />
            );
          })()}

          {/* Retrait annuel AV + simulateur fiscal */}
          {isAVType && (() => {
            const retrait = n(placement.annualWithdrawal || "");
            const valeur = n(placement.value);
            const primesNettes = n(placement.totalPremiumsNet);
            const plusValues = Math.max(0, valeur - primesNettes);
            const ratioGain = valeur > 0 ? plusValues / valeur : 0;
            const gainBrut = retrait * ratioGain;
            const dateOuv = placement.openDate ? new Date(placement.openDate) : null;
            const ageAns = dateOuv ? (Date.now() - dateOuv.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
            const over8 = ageAns >= 8;
            const isCoupleForme = data.coupleStatus === "married" || data.coupleStatus === "pacs";
            const abattement = over8 ? (isCoupleForme ? 9200 : 4600) : 0;
            const gainNetAbatt = Math.max(0, gainBrut - abattement);
            const above150k = primesNettes > 150000;
            return (
              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
                <MoneyField label="Retrait annuel (€)" tooltip="Montant du retrait annuel programmé. Permet d'estimer la fiscalité des rachats partiels et l'impact sur l'encours projeté." value={placement.annualWithdrawal || ""} onChange={(e) => updatePlacementStr(index, "annualWithdrawal", e.target.value)} compact />
                {retrait > 0 && (
                  <div className="col-span-full rounded-xl border px-3 py-2.5 text-xs space-y-1.5" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                    <div className="font-semibold" style={{ color: BRAND.sky }}>Simulation fiscale rachat</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-600">
                      <span>Gain brut dans le retrait :</span>
                      <span className="font-medium text-right">{euro(gainBrut)}</span>
                      <span>Abattement {over8 ? (isCoupleForme ? "(9 200 € couple)" : "(4 600 € célibataire)") : "(0 — contrat < 8 ans)"} :</span>
                      <span className="font-medium text-right">{over8 ? `− ${euro(abattement)}` : "—"}</span>
                      <span>Gain imposable net :</span>
                      <span className="font-medium text-right" style={{ color: gainNetAbatt > 0 ? "#b45309" : "#16a34a" }}>{euro(gainNetAbatt)}</span>
                      <span>Versements &gt; 150 000 € :</span>
                      <span className={"font-medium text-right " + (above150k ? "text-amber-600" : "text-slate-500")}>{above150k ? "Oui → taux majoré 31,4%" : "Non → taux réduit 7,5%"}</span>
                      <span>Fiscalité applicable :</span>
                      <span className="font-medium text-right text-slate-700">{!placement.openDate ? "⚠ Date ouverture manquante" : over8 ? (above150k ? "PFU 31,4% (excédent 150k) + PFLi 7,5%/PS 18,6%" : "PFLi 7,5% + PS 18,6%") : "PFU 31,4% (< 8 ans)"}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bénéficiaires AV + PER (même régime 990I/757B) */}
          {(isAVType || isPERType(placement.type)) && (
            <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
                  Bénéficiaires {isPERType(placement.type) ? "— Clause bénéficiaire PER (990I/757B)" : ""}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" className="h-6 rounded-lg px-2 text-xs" onClick={() => importFamilyBeneficiaries(index)}>Importer famille</Button>
                  <Button variant="outline" className="h-6 rounded-lg px-2 text-xs" onClick={() => addPlacementBeneficiary(index)}><Plus className="mr-1 h-3 w-3" />Ajouter</Button>
                </div>
              </div>
              {isPERType(placement.type) && (
                <div className="text-xs text-slate-500 italic px-1">
                  Même régime que l'AV : primes &lt; 70 ans → art. 990 I (abattement 152 500 € / bénéficiaire) · primes ≥ 70 ans → art. 757 B (abattement 30 500 € global). Applicable aux PER assurantiels et Madelin.
                </div>
              )}
              <div className={"rounded-lg border px-2 py-1 text-xs " + (shareOverflow ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white/60 text-slate-600")}>
                Total : <strong>{Math.round(totalShare * 100) / 100} %</strong>{shareOverflow ? " — dépasse 100 %." : ""}
              </div>
              {placement.beneficiaries.map((beneficiary, bIndex) => (
                <div key={bIndex} className="grid gap-2 grid-cols-[1fr_1fr_0.6fr_auto] items-end">
                  <Field label="Nom"><Input value={beneficiary.name} onChange={(e) => updatePlacementBeneficiary(index, bIndex, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                  <Field label="Lien">
                    <Select value={beneficiary.relation || "autre"} onValueChange={(v) => updatePlacementBeneficiary(index, bIndex, "relation", v)}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{BENEFICIARY_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <MoneyField label="% part" value={beneficiary.share} onChange={(e) => updatePlacementBeneficiary(index, bIndex, "share", e.target.value)} compact />
                  <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => removePlacementBeneficiary(index, bIndex)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  })}

  {/* Widget exposition aux marchés */}
  {data.placements.length > 0 && (() => {
    let sec = 0; let dyn = 0;
    for (const p of data.placements) {
      const val = n(p.value);
      if (PLACEMENT_TYPES_BY_FAMILY.cash.includes(p.type)) { sec += val; }
      else if (p.type === "Assurance-vie fonds euros") { sec += val; }
      else if (p.type === "Assurance-vie unités de compte" || p.type === "Contrat de capitalisation") {
        const uc = Math.min(100, Math.max(0, n(p.ucRatio) || (p.type === "Assurance-vie unités de compte" ? 100 : 0)));
        dyn += val * uc / 100; sec += val * (100 - uc) / 100;
      } else { dyn += val; }
    }
    const tot = sec + dyn;
    if (tot <= 0) return null;
    const secPct = Math.round(sec / tot * 100);
    const dynPct = 100 - secPct;
    return (
      <div className="rounded-2xl p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>Exposition aux marchés financiers</div>
        {/* Barre segmentée */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: BRAND.navy }}>
            <span>Sécurisé — {secPct}%</span>
            <span>Dynamique — {dynPct}%</span>
          </div>
          <div className="h-5 rounded-full overflow-hidden flex" style={{ background: "#e5e7eb" }}>
            <div className="h-full transition-all flex items-center justify-center text-xs text-white font-bold" style={{ width: `${secPct}%`, background: BRAND.navy, minWidth: secPct > 5 ? undefined : 0 }}>
              {secPct > 15 ? `${secPct}%` : ""}
            </div>
            <div className="h-full transition-all flex items-center justify-center text-xs font-bold" style={{ width: `${dynPct}%`, background: BRAND.gold, color: BRAND.navy, minWidth: dynPct > 5 ? undefined : 0 }}>
              {dynPct > 15 ? `${dynPct}%` : ""}
            </div>
          </div>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="rounded-xl p-3 text-center" style={{ background: `${BRAND.navy}08` }}>
            <div className="text-xs mb-1" style={{ color: "#94a3b8" }}>Sécurisé</div>
            <div className="font-black text-sm" style={{ color: BRAND.navy }}>{euro(sec)}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: `${BRAND.gold}18` }}>
            <div className="text-xs mb-1" style={{ color: "#94a3b8" }}>Dynamique</div>
            <div className="font-black text-sm" style={{ color: BRAND.gold }}>{euro(dyn)}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: `${BRAND.sky}10` }}>
            <div className="text-xs mb-1" style={{ color: "#94a3b8" }}>Total</div>
            <div className="font-black text-sm" style={{ color: BRAND.navy }}>{euro(tot)}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400 italic">Sécurisé : livrets, fonds euros, comptes. Dynamique : PEA, CTO, PER, UC des AV/capitalisation.</div>
      </div>
    );
  })()}

</TabsContent>

  );
});

TabPlacements.displayName = "TabPlacements";
export { TabPlacements };
