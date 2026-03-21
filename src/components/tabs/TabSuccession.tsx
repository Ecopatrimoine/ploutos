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


// ── TabSuccession ─────────────────────────────────────────────────────────────────────
const TabSuccession = React.memo(function TabSuccession(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, successionData, setSuccessionData, succession, syncCollectedHeirs, getFamilyMembers, importFamilyToTestament, addTestamentHeir, updateTestamentHeir, removeTestamentHeir, addLegsPrecisItem, addLegsPrecisItemFree, addLegsPrecisItemResidual, updateLegsPrecisItem, removeLegsPrecisItem, addLegataire, updateLegataire, removeLegataire, addContrepartieLegataire, updateContrepartieLegataire, removeContrepartieLegataire, addContrepartie, updateContrepartie, removeContrepartie, addContrepartieGlobal, updateContrepartieGlobal, removeContrepartieGlobal, addContrepartieWithBalance, removeContrepartieWithBalance, legsPickerOpen, setLegsPickerOpen, addFamilyMemberToLegsGlobal, addFamilyMemberToLegsPrecis, loanModalIndex, setLoanModalIndex, addLoan, updateLoan, removeLoan, effectiveSpouseOption, spouseOptions, person1, person2 } = props;

  return (
<TabsContent value="succession" className="space-y-4">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={FileText} title="Succession" subtitle="Actif successoral, assurance-vie et droits par héritier." /></CardHeader>
    <CardContent className="space-y-4">

      {/* Paramètres + KPIs sur une même zone */}
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <Field label="Décès simulé de" tooltip="Personne dont on simule le décès. Détermine qui est le défunt et qui est le conjoint survivant, ainsi que la composition de la masse successorale.">
          <Select value={successionData.deceasedPerson} onValueChange={(v: "person1" | "person2") => setSuccessionData((prev) => ({ ...prev, deceasedPerson: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="person1">{person1}</SelectItem><SelectItem value="person2">{person2}</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Option conjoint survivant" tooltip="Le conjoint survivant peut choisir entre : Usufruit universel (usage de tous les biens), Pleine propriété de la quotité disponible (en pleine propriété, selon le nombre d'enfants), ou 1/4 en pleine propriété. L'option usufruit est souvent avantageuse fiscalement.">
          <Select value={effectiveSpouseOption} onValueChange={(v) => setSuccessionData((prev) => ({ ...prev, spouseOption: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{spouseOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="rounded-2xl border px-4 py-3 text-xs text-slate-600 space-y-0.5 self-end" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
          <div>Conjoint survivant : <strong>{succession.survivorKey === "person1" ? person1 : person2}</strong></div>
          <div>Quotité disponible : <strong>{Math.round(succession.quotiteDisponible * 100)} %</strong> · Enfants réservataires : <strong>{succession.reserveChildrenCount}</strong></div>
          {succession.usufruitierAge !== null
            ? <div>Démembrement : <strong>US {Math.round(succession.demembrementPct.usufruct * 100)} % / NP {Math.round(succession.demembrementPct.nuePropriete * 100)} %</strong> ({succession.usufruitierAge} ans)</div>
            : <div className="text-amber-600">Date de naissance du conjoint à renseigner pour le démembrement.</div>}
        </div>
      </div>

      {/* Actions + Testament */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Boutons testament */}
        <Button className="h-9 rounded-xl px-3 text-sm"
          variant={successionData.useTestament && successionData.legsMode === "global" ? "default" : "outline"}
          onClick={() => setSuccessionData((prev) => ({ ...prev, useTestament: true, legsMode: "global" }))}
          style={successionData.useTestament && successionData.legsMode === "global" ? { background: BRAND.navy } : undefined}>
          Legs global
        </Button>
        <Button className="h-9 rounded-xl px-3 text-sm"
          variant={successionData.useTestament && successionData.legsMode === "precis" ? "default" : "outline"}
          onClick={() => setSuccessionData((prev) => ({ ...prev, useTestament: true, legsMode: "precis" }))}
          style={successionData.useTestament && successionData.legsMode === "precis" ? { background: BRAND.navy } : undefined}>
          Legs précis
        </Button>
        {successionData.useTestament && (
          <Button variant="outline" className="h-9 rounded-xl px-3 text-sm text-slate-500"
            onClick={() => setSuccessionData((prev) => ({ ...prev, useTestament: false }))}>
            Désactiver testament
          </Button>
        )}
      </div>

      {succession.warnings.length > 0 && (
        <div className="space-y-2">
          {succession.warnings.map((w, idx) => (
            <div key={idx} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">{w}</div>
          ))}
        </div>
      )}

      {/* ── LEGS GLOBAL ── */}
      {successionData.useTestament && successionData.legsMode === "global" && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Legs global</div>
              <div className="text-xs text-slate-500 mt-0.5">Répartition en % du patrimoine total (hors AV) — PP, NP ou US par héritier</div>
            </div>
            <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={() => setLegsPickerOpen("global")}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter un légataire</Button>
          </div>
          {successionData.testamentHeirs.length === 0 && <div className="text-sm text-slate-500">Aucun légataire saisi. Importez la famille ou ajoutez manuellement.</div>}
          {successionData.testamentHeirs.map((heir, index) => {
            const birthY = heir.birthDate ? new Date(heir.birthDate).getFullYear() : 0;
            const age = birthY > 0 ? new Date().getFullYear() - birthY : null;
            const dePercent = heir.propertyRight === "usufruct" && age ? getDemembrementPercentages(age) : null;
            const isUS = heir.propertyRight === "usufruct";
            const isNP = heir.propertyRight === "bare";
            const contreparties = ((heir as any).contreparties || []) as DemembrementContrepartie[];
            const familyMembers = getFamilyMembers();
            return (
              <div key={index} className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: SURFACE.border }}>
                <div className="grid gap-2 grid-cols-[1fr_1fr_1.2fr_1.3fr_auto] items-end">
                  <Field label="Prénom"><Input value={heir.firstName} onChange={(e) => updateTestamentHeir(index, "firstName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                  <Field label="Nom"><Input value={heir.lastName} onChange={(e) => updateTestamentHeir(index, "lastName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                  <Field label="Date de naissance"><Input type="date" value={heir.birthDate} onChange={(e) => updateTestamentHeir(index, "birthDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                  <Field label="Lien de parenté">
                    <Select value={heir.relation} onValueChange={(v) => updateTestamentHeir(index, "relation", v)}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => removeTestamentHeir(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid gap-2 grid-cols-[1fr_1fr_1fr]">
                  <MoneyField label="% du patrimoine légué" tooltip="Part du patrimoine successoral total (hors AV) légué à cet héritier." value={heir.shareGlobal} onChange={(e) => updateTestamentHeir(index, "shareGlobal", e.target.value)} compact />
                  <Field label="Nature du droit" tooltip="PP = Pleine propriété. NP = Nue-propriété. US = Usufruit. Le barème Duvergier valorise l'usufruit selon l'âge.">
                    <Select value={heir.propertyRight || "full"} onValueChange={(v) => {
                      updateTestamentHeir(index, "propertyRight", v);
                      if (v === "full") setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h, i) => i === index ? { ...h, contreparties: [] } : h) }));
                    }}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Pleine propriété</SelectItem>
                        <SelectItem value="bare">Nue-propriété</SelectItem>
                        <SelectItem value="usufruct">Usufruit</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <MoneyField label="Donations antérieures" tooltip="Donations dans les 15 ans — rappel fiscal." value={heir.priorDonations} onChange={(e) => updateTestamentHeir(index, "priorDonations", e.target.value)} compact />
                </div>
                {/* Info Duvergier usufruit */}
                {heir.propertyRight === "usufruct" && age && dePercent && (
                  <div className="text-xs rounded-xl px-3 py-1.5" style={{ background: "rgba(81,106,199,0.06)", color: BRAND.sky }}>
                    📐 Barème Duvergier — âge {age} ans : US = <strong>{Math.round(dePercent.usufruct * 100)}%</strong> / NP = <strong>{Math.round(dePercent.nuePropriete * 100)}%</strong>
                  </div>
                )}
                {heir.propertyRight === "usufruct" && !heir.birthDate && (
                  <div className="text-xs text-amber-600 px-1">⚠️ Date de naissance requise pour le barème Duvergier</div>
                )}
                {/* Contreparties démembrement (US → NP liés, NP → US lié) */}
                {(isUS || isNP) && (
                  <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: SURFACE.border, background: "rgba(255,255,255,0.6)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>
                        {isUS ? "Nu-propriétaires liés" : "Usufruitiers liés"}
                      </span>
                      <div className="flex gap-1.5 flex-wrap">
                        {familyMembers.map((m, mi) => (
                          <button key={mi} className="text-xs rounded-lg px-2 py-1 border hover:bg-slate-50 transition-colors"
                            style={{ borderColor: SURFACE.border }}
                            onClick={() => addContrepartieGlobal(index, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}>
                            + {m.firstName}
                          </button>
                        ))}
                        <button className="text-xs rounded-lg px-2 py-1 border border-dashed hover:bg-slate-50 transition-colors"
                          style={{ borderColor: SURFACE.border }}
                          onClick={() => addContrepartieGlobal(index)}>
                          + Autre
                        </button>
                      </div>
                    </div>
                    {contreparties.length === 0 && (
                      <div className="text-xs text-slate-400 italic">Aucune contrepartie — cliquez sur un membre de la famille.</div>
                    )}
                    {contreparties.map((cp, ci) => (
                      <div key={ci} className="grid gap-2 grid-cols-[1fr_0.8fr_0.8fr_0.6fr_auto] items-end">
                        <Field label="Nom"><Input placeholder="Nom" value={cp.heirName} onChange={(e) => updateContrepartieGlobal(index, ci, "heirName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                        <Field label="Lien">
                          <Select value={cp.heirRelation} onValueChange={(v) => updateContrepartieGlobal(index, ci, "heirRelation", v)}>
                            <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Date naissance"><Input type="date" value={cp.heirBirthDate} onChange={(e) => updateContrepartieGlobal(index, ci, "heirBirthDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                        <MoneyField label="Quotité (%)" tooltip="Répartition auto-équilibrée entre les NP. Modifiable manuellement." value={cp.sharePercent} onChange={(e) => updateContrepartieGlobal(index, ci, "sharePercent", e.target.value)} compact />
                        <Button variant="outline" className="h-8 w-8 rounded-xl p-0 mb-0.5" onClick={() => removeContrepartieGlobal(index, ci)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    {/* Total contreparties */}
                    {contreparties.length > 0 && (() => {
                      const total = contreparties.reduce((s, c) => s + parseFloat(c.sharePercent || "0"), 0);
                      const ok = Math.abs(total - 100) < 0.5;
                      return (
                        <div className={`text-xs px-2 py-1 rounded-lg ${ok ? "" : "text-amber-700"}`} style={{ color: ok ? BRAND.sky : undefined }}>
                          Total {isUS ? "NP" : "US"} : <strong>{Math.round(total * 10) / 10}%</strong>
                          {!ok && " ⚠️ doit être égal à 100%"}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LEGS PRÉCIS ── */}
      {successionData.useTestament && successionData.legsMode === "precis" && (() => {
        const allAssets = [
          ...data.properties.map((p, i) => ({ label: `${p.name || p.type} — ${euro(n(p.value))}`, assetType: "property" as const, idx: i, value: n(p.value) })),
          ...data.placements.filter(p => !isAV(p.type) && !isPERType(p.type)).map((p, i) => ({ label: `${p.name || p.type} — ${euro(n(p.value))}`, assetType: "placement" as const, idx: i, value: n(p.value) })),
        ];
        const items = successionData.legsPrecisItems || [];
        const familyMembers = getFamilyMembers();

        const migratedItems = items.map(it => {
          if (!it.legataires && (it as any).heirName) {
            return {
              ...it,
              legataires: [{
                heirName: (it as any).heirName || "",
                heirRelation: (it as any).heirRelation || "enfant",
                heirBirthDate: (it as any).heirBirthDate || "",
                sharePercent: (it as any).sharePercent || "100",
                propertyRight: (it as any).propertyRight || "full",
                contreparties: (it as any).contreparties || [],
              }]
            };
          }
          return { ...it, legataires: it.legataires || [] };
        });

        const totalBiensExplicites = migratedItems.filter(it => !it.isResidual).reduce((s, it) => {
          if (it.assetType === "free") return s + (n(it.freeValue) || 0);
          const asset = it.assetType === "property" ? data.properties[it.propertyIndex] : null;
          const val = it.assetType === "property" ? n(asset?.value) : n(data.placements[it.propertyIndex]?.value);
          return s + val;
        }, 0);
        const activeNet = (succession as any)?.activeNet || 0;
        const residualValue = Math.max(0, activeNet - totalBiensExplicites);

        return (
          <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Legs précis</div>
                <div className="text-xs text-slate-500 mt-0.5">Chaque bien peut être réparti entre plusieurs légataires</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addLegsPrecisItem}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Bien de la collecte
                </Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addLegsPrecisItemFree}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Bien libre
                </Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" style={{ borderColor: BRAND.gold, color: BRAND.gold }} onClick={addLegsPrecisItemResidual}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Reste du patrimoine
                </Button>
              </div>
            </div>

            {migratedItems.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">Aucun bien défini. Ajoutez un bien ci-dessus.</div>
            )}

            {migratedItems.map((item, itemIdx) => {
              const legataires = item.legataires || [];
              const totalPP = legataires.filter(l => l.propertyRight === "full").reduce((s, l) => s + n(l.sharePercent), 0);
              const totalNP = legataires.filter(l => l.propertyRight === "bare").reduce((s, l) => s + n(l.sharePercent), 0);
              const totalUS = legataires.filter(l => l.propertyRight === "usufruct").reduce((s, l) => s + n(l.sharePercent), 0);
              const over100PP = totalPP > 100.01;
              const over100NP = totalNP > 100.01;
              const over100US = totalUS > 100.01;
              const hasError = over100PP || over100NP || over100US;

              let assetValue = 0;
              if (item.isResidual) {
                assetValue = residualValue;
              } else if (item.assetType === "free") {
                assetValue = n(item.freeValue) || 0;
              } else {
                const asset = item.assetType === "property" ? data.properties[item.propertyIndex] : null;
                assetValue = item.assetType === "property" ? n(asset?.value) : n(data.placements[item.propertyIndex]?.value);
              }

              return (
                <div key={itemIdx} className="rounded-xl border p-4 space-y-3" style={{ borderColor: hasError ? "#fca5a5" : SURFACE.border, background: "#fff" }}>

                  {/* En-tête du bien */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.isResidual ? (
                      <div className="flex-1 rounded-xl px-3 h-8 flex items-center text-sm font-medium" style={{ background: `${BRAND.gold}22`, color: BRAND.navy }}>
                        🏦 Reste du patrimoine — <span className="ml-1 font-bold">{euro(residualValue)}</span>
                      </div>
                    ) : item.assetType === "free" ? (
                      <>
                        <input
                          className="flex-1 rounded-xl border px-3 h-8 text-sm focus:outline-none"
                          placeholder="Nom du bien libre (ex: tableaux, bijoux…)"
                          value={item.freeLabel || ""}
                          onChange={(e) => updateLegsPrecisItem(itemIdx, "freeLabel" as any, e.target.value)}
                          style={{ borderColor: SURFACE.border }}
                        />
                        <input
                          className="w-32 rounded-xl border px-3 h-8 text-sm focus:outline-none text-right"
                          placeholder="Valeur (€)"
                          value={item.freeValue || ""}
                          onChange={(e) => updateLegsPrecisItem(itemIdx, "freeValue" as any, e.target.value)}
                          style={{ borderColor: SURFACE.border }}
                        />
                      </>
                    ) : (
                      <div className="flex-1">
                        <select
                          className="w-full rounded-xl border px-3 h-8 text-sm focus:outline-none bg-white"
                          value={`${item.assetType}-${item.propertyIndex}`}
                          onChange={(e) => {
                            const parts = e.target.value.split("-"); const at = parts[0]; const idxStr = parts.slice(1).join("-");
                            updateLegsPrecisItem(itemIdx, "assetType" as any, at);
                            updateLegsPrecisItem(itemIdx, "propertyIndex" as any, parseInt(idxStr));
                          }}
                          style={{ borderColor: SURFACE.border }}
                        >
                          {allAssets.map((a) => (
                            <option key={`${a.assetType}-${a.idx}`} value={`${a.assetType}-${a.idx}`}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <Button variant="outline" className="h-8 w-8 rounded-xl p-0 shrink-0" onClick={() => removeLegsPrecisItem(itemIdx)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>

                  {/* Légataires */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-400 mr-1">Ajouter :</span>
                      {familyMembers.map((m, mi) => (
                        <button
                          key={mi}
                          className="h-7 px-2.5 rounded-full text-xs font-medium border transition-colors hover:opacity-80"
                          style={{ background: m.relation === "conjoint" ? `${BRAND.sky}22` : `${BRAND.navy}15`, borderColor: m.relation === "conjoint" ? BRAND.sky : BRAND.navy, color: m.relation === "conjoint" ? BRAND.sky : BRAND.navy }}
                          onClick={() => addLegataire(itemIdx, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}
                        >
                          {m.firstName}
                        </button>
                      ))}
                      <button
                        className="h-7 px-2.5 rounded-full text-xs font-medium border border-dashed transition-colors hover:bg-slate-50"
                        style={{ borderColor: SURFACE.border, color: "#888" }}
                        onClick={() => addLegataire(itemIdx, { heirName: "", heirRelation: "autre", heirBirthDate: "" })}
                      >
                        + Extérieur
                      </button>
                    </div>

                    {legataires.length === 0 && (
                      <div className="text-xs text-slate-400 italic">Aucun légataire — cliquez sur un prénom ci-dessus.</div>
                    )}

                    {legataires.map((leg, legIdx) => {
                      const isNP = leg.propertyRight === "bare";
                      const isUS = leg.propertyRight === "usufruct";
                      const isDismembered = isNP || isUS;
                      const usufructBirthDate = isUS ? leg.heirBirthDate : (leg.contreparties||[])[0]?.heirBirthDate || "";
                      const usAge = usufructBirthDate ? new Date().getFullYear() - new Date(usufructBirthDate).getFullYear() : null;
                      const dePercent = isDismembered && usAge ? getDemembrementPercentages(usAge) : null;
                      const shareVal = n(leg.sharePercent) / 100;
                      const valorisation = dePercent
                        ? (isUS ? assetValue * shareVal * dePercent.usufruct : assetValue * shareVal * dePercent.nuePropriete)
                        : assetValue * shareVal;

                      return (
                        <div key={legIdx} className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                          <div className="grid gap-2 grid-cols-[1fr_0.8fr_0.7fr_0.6fr_auto] items-end">
                            <Field label="Légataire" tooltip="Nom du légataire. Doit correspondre exactement à celui renseigné dans la collecte familiale pour un calcul correct.">
                              <Input placeholder="Nom" value={leg.heirName} onChange={(e) => updateLegataire(itemIdx, legIdx, "heirName", e.target.value)} className="rounded-xl h-8 text-sm" />
                            </Field>
                            <Field label="Lien" tooltip="Lien de parenté avec le défunt. Détermine l'abattement (enfant = 100 000 €, frère/sœur = 15 932 €, tiers = 1 594 €) et le barème des droits.">
                              <Select value={leg.heirRelation} onValueChange={(v) => updateLegataire(itemIdx, legIdx, "heirRelation", v)}>
                                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </Field>
                            <Field label="Droit" tooltip="PP = Pleine propriété. NP = Nue-propriété. US = Usufruit. Le démembrement est valorisé via le barème Duvergier selon l'âge de l'usufruitier.">
                              <Select value={leg.propertyRight} onValueChange={(v) => {
                                updateLegataire(itemIdx, legIdx, "propertyRight", v);
                                if (v === "full") updateLegataire(itemIdx, legIdx, "contreparties", []);
                              }}>
                                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full">PP</SelectItem>
                                  <SelectItem value="bare">NP</SelectItem>
                                  <SelectItem value="usufruct">US</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field label="Quotité (%)" tooltip="Part de ce bien attribuée à ce légataire. Répartie automatiquement entre les légataires, modifiable manuellement. La somme ne doit pas dépasser 100%.">
                              <Input placeholder="100" value={leg.sharePercent} onChange={(e) => updateLegataire(itemIdx, legIdx, "sharePercent", e.target.value)} className="rounded-xl h-8 text-sm text-right" />
                            </Field>
                            <Button variant="outline" className="h-8 w-8 rounded-xl p-0 mb-0.5" onClick={() => removeLegataire(itemIdx, legIdx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <Field label="Date de naissance" tooltip={isDismembered ? "Requise pour le barème Duvergier — détermine la valeur économique de l'usufruit et de la nue-propriété." : "Optionnelle pour la pleine propriété."}>
                              <Input type="date" value={leg.heirBirthDate} onChange={(e) => updateLegataire(itemIdx, legIdx, "heirBirthDate", e.target.value)} className="rounded-xl h-8 text-sm w-44" />
                            </Field>
                            {assetValue > 0 && (
                              <div className="text-xs rounded-lg px-2 py-1 mt-4" style={{ background: `${BRAND.gold}20`, color: BRAND.navy }}>
                                {isDismembered && dePercent
                                  ? `${isUS ? "US" : "NP"} ${Math.round((isUS ? dePercent.usufruct : dePercent.nuePropriete) * 100)}% → ${euro(valorisation)}`
                                  : `PP → ${euro(valorisation)}`}
                              </div>
                            )}
                          </div>

                          {isDismembered && (
                            <div className="rounded-lg border p-2 space-y-2" style={{ borderColor: SURFACE.border, background: "#fff" }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium" style={{ color: BRAND.sky }}>Contrepartie {isUS ? "NP" : "US"}</span>
                                <div className="flex gap-1 flex-wrap">
                                  {familyMembers.map((m, mi) => (
                                    <button key={mi}
                                      className="h-6 px-2 rounded-full text-xs border transition-colors hover:opacity-80"
                                      style={{ background: `${BRAND.navy}15`, borderColor: BRAND.navy, color: BRAND.navy }}
                                      onClick={() => addContrepartieLegataire(itemIdx, legIdx, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}
                                    >{m.firstName}</button>
                                  ))}
                                  <button className="h-6 px-2 rounded-full text-xs border border-dashed hover:bg-slate-50" style={{ borderColor: SURFACE.border, color: "#888" }}
                                    onClick={() => addContrepartieLegataire(itemIdx, legIdx, { heirName: "", heirRelation: "enfant", heirBirthDate: "" })}>+ Extérieur</button>
                                </div>
                              </div>
                              {(leg.contreparties || []).map((cp, ci) => (
                                <div key={ci} className="grid gap-2 grid-cols-[1fr_0.7fr_0.7fr_0.5fr_auto] items-end">
                                  <Field label="Nom"><Input placeholder="Nom" value={cp.heirName} onChange={(e) => updateContrepartieLegataire(itemIdx, legIdx, ci, "heirName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                                  <Field label="Lien">
                                    <Select value={cp.heirRelation} onValueChange={(v) => updateContrepartieLegataire(itemIdx, legIdx, ci, "heirRelation", v)}>
                                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                      <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </Field>
                                  <Field label="Date naissance"><Input type="date" value={cp.heirBirthDate} onChange={(e) => updateContrepartieLegataire(itemIdx, legIdx, ci, "heirBirthDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                                  <Field label="Quotité (%)"><Input placeholder="100" value={cp.sharePercent} onChange={(e) => updateContrepartieLegataire(itemIdx, legIdx, ci, "sharePercent", e.target.value)} className="rounded-xl h-8 text-sm text-right" /></Field>
                                  <Button variant="outline" className="h-8 w-8 rounded-xl p-0 mb-0.5" onClick={() => removeContrepartieLegataire(itemIdx, legIdx, ci)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {legataires.length > 0 && (
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        {totalPP > 0 && <span style={{ color: over100PP ? "#dc2626" : BRAND.navy }}>PP {Math.round(totalPP)}% {over100PP ? "⚠️ >100%" : ""}</span>}
                        {totalNP > 0 && <span style={{ color: over100NP ? "#dc2626" : BRAND.sky }}>NP {Math.round(totalNP)}% {over100NP ? "⚠️ >100%" : ""}</span>}
                        {totalUS > 0 && <span style={{ color: over100US ? "#dc2626" : "#16a34a" }}>US {Math.round(totalUS)}% {over100US ? "⚠️ >100%" : ""}</span>}
                        {Math.abs(totalNP - totalUS) > 0.5 && totalNP > 0 && totalUS > 0 && (
                          <span className="text-amber-600">⚠️ NP ≠ US</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
            {/* ── Modal picker famille (légataires) ── */}

      {legsPickerOpen && (() => {
        const members = getFamilyMembers();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setLegsPickerOpen(null)}>
            <div className="rounded-2xl border p-6 space-y-4 w-96 shadow-2xl" style={{ background: "#fff", borderColor: SURFACE.border }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm" style={{ color: BRAND.navy }}>Choisir un légataire</div>
                <button onClick={() => setLegsPickerOpen(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>
              <div className="text-xs text-slate-500">Cliquez sur un membre de la famille ou ajoutez une personne extérieure.</div>
              <div className="space-y-2">
                {members.map((m, mi) => (
                  <button key={mi} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 border transition-colors"
                    style={{ borderColor: SURFACE.border }}
                    onClick={() => {
                      if (legsPickerOpen === "global") addFamilyMemberToLegsGlobal(m);
                      else addFamilyMemberToLegsPrecis(m);
                      setLegsPickerOpen(null);
                    }}>
                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: m.relation === "conjoint" ? BRAND.sky : BRAND.navy }}>
                      {(m.firstName?.[0] || "?").toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium" style={{ color: BRAND.navy }}>{m.firstName} {m.lastName}</div>
                      <div className="text-xs text-slate-500 capitalize">{m.relation}</div>
                    </div>
                  </button>
                ))}
                {members.length === 0 && <div className="text-xs text-slate-400 italic">Aucun membre de la famille renseigné dans la collecte.</div>}
                <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm border border-dashed hover:bg-slate-50 transition-colors"
                  style={{ borderColor: SURFACE.border }}
                  onClick={() => {
                    if (legsPickerOpen === "global") {
                      setSuccessionData((prev) => ({ ...prev, testamentHeirs: [...prev.testamentHeirs, { firstName: "", lastName: "", birthDate: "", relation: "autre", priorDonations: "0", shareGlobal: "", propertyRight: "full" }] }));
                    } else {
                      setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "property" as const, heirName: "", heirRelation: "autre", heirBirthDate: "", sharePercent: "100", propertyRight: "full", contreparties: [] }] }));
                    }
                    setLegsPickerOpen(null);
                  }}>
                  <span className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 border" style={{ borderColor: SURFACE.border }}>+</span>
                  <div className="text-slate-500 text-xs">Personne extérieure <span className="text-amber-600 font-medium">(droits pouvant atteindre 60%)</span></div>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* KPIs succession en 2 lignes de 3 */}
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Actif successoral net" value={euro(succession.activeNet)} hint="Immobilier + placements hors AV + mobilier 5 % − dettes" />
        <MetricCard label="Droits de succession" value={euro(succession.totalSuccessionRights)} hint="Droits calculés par héritier après abattements légaux et barème progressif" />
        <MetricCard label="Fiscalité AV" value={euro(succession.totalAvRights)} hint={`Total combiné : ${euro(succession.totalRights)} — Taxation des primes AV selon art. 990 I (primes < 70 ans) et art. 757 B (primes ≥ 70 ans)`} />
        <MetricCard label="Immobilier retenu" value={euro(succession.collectedPropertyEstate)} hint="Part des biens immobiliers du défunt intégrée à la masse successorale" />
        <MetricCard label="Placements retenus" value={euro(succession.placementsSuccession)} hint="Valeur des placements hors assurance-vie (CTO, PEA, PER…) intégrés à la succession" />
        <MetricCard label="Forfait mobilier 5 %" value={euro(succession.furnitureForfait)} hint="Évaluation forfaitaire du mobilier meublant à 5 % de l'actif brut successoral, en l'absence d'inventaire notarial" />
      </div>

      {/* Tables compactes côte à côte */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Biens */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Biens immobiliers</div>
          {succession.propertyLines.length === 0
            ? <div className="px-4 py-4 text-sm text-slate-400">Aucun bien retenu.</div>
            : <table className="w-full text-xs">
                <thead><tr style={{ background: SURFACE.tableHead }}>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Bien</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Valeur brute</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Déductions</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Net</th>
                </tr></thead>
                <tbody>
                  {succession.propertyLines.map((line, idx) => (
                    <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                      <td className="px-3 py-2">
                        <div className="font-medium" style={{ color: BRAND.navy }}>{line.name}</div>
                        <div className="text-slate-400">{line.note}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{euro(line.grossEstateValue)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        - {euro(line.residenceAbatement + line.debtShare)}
                        {line.insuranceCover > 0 && (
                          <div className="text-xs text-green-600">dont ass. DC : -{euro(line.insuranceCover)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.netEstateValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>

        {/* Placements hors AV */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Placements hors AV</div>
          {succession.placementLines.filter(l => l.netEstateValue > 0).length === 0
            ? <div className="px-4 py-4 text-sm text-slate-400">Aucun placement retenu.</div>
            : <table className="w-full text-xs">
                <thead><tr style={{ background: SURFACE.tableHead }}>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Placement</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Note</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Net retenu</th>
                </tr></thead>
                <tbody>
                  {succession.placementLines.map((line, idx) => (
                    <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                      <td className="px-3 py-2 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                      <td className="px-3 py-2 text-slate-400">{line.note}</td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.netEstateValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      </div>

      {/* AV compacte */}
      {succession.avLines.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Assurance-vie au décès</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: SURFACE.tableHead }}>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Contrat</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Bénéficiaire</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Capital</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Cap. av. 70 ans</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Primes ap. 70 ans</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Taxe 990I</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Taxe 757B</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>Fiscalité AV</th>
              </tr></thead>
              <tbody>
                {succession.avLines.map((line, idx) => (
                  <tr key={line.contract + line.beneficiary + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                    <td className="px-3 py-2 font-medium" style={{ color: BRAND.navy }}>{line.contract}</td>
                    <td className="px-3 py-2">{line.beneficiary} <span className="text-slate-400">({line.sharePct} %)</span></td>
                    <td className="px-3 py-2 text-right">{euro(line.amount)}</td>
                    <td className="px-3 py-2 text-right">{euro(line.amountBefore70Capital)}</td>
                    <td className="px-3 py-2 text-right">{euro(line.amountAfter70Premiums)}</td>
                    <td className="px-3 py-2 text-right">{euro(line.before70Tax)}</td>
                    <td className="px-3 py-2 text-right">{euro(line.after70Tax)}</td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: BRAND.navy }}>{euro(line.totalTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barème + camemberts côte à côte */}
      {succession.bracketFill.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <BracketFillChart
            title={`Barème · ${succession.graphReferenceTitle}`}
            data={succession.bracketFill}
            referenceValue={succession.graphTaxableBase}
            valueLabel={`Base taxable (${succession.graphReferenceName})`}
          />
          <div className="space-y-4">
            <Card className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ color: BRAND.navy }}>Réserve et quotité disponible</CardTitle></CardHeader>
              <CardContent className="-mt-2">
                {succession.pieData.length > 0 ? (() => {
                  const total = succession.pieData.reduce((s: number, d: any) => s + d.value, 0);
                  return (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        {succession.pieData.map((d: any, i: number) => (
                          <div key={i} className="flex-1 rounded-xl p-3 text-center" style={{ background: i === 0 ? `${BRAND.navy}12` : `${BRAND.gold}18` }}>
                            <div className="text-xs font-semibold mb-1 truncate" style={{ color: i === 0 ? BRAND.navy : BRAND.gold }}>{d.name}</div>
                            <div className="text-base font-black" style={{ color: i === 0 ? BRAND.navy : BRAND.gold }}>{euro(d.value)}</div>
                            <div className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</div>
                          </div>
                        ))}
                      </div>
                      <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "#e5e7eb" }}>
                        {succession.pieData.map((d: any, i: number) => (
                          <div key={i} className="h-full transition-all" style={{ width: `${total > 0 ? d.value / total * 100 : 0}%`, background: i === 0 ? BRAND.navy : BRAND.gold }} />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: "#94a3b8" }}>
                        <span>{succession.pieData[0]?.name}</span>
                        <span>{succession.pieData[1]?.name}</span>
                      </div>
                    </div>
                  );
                })() : <div className="text-sm text-slate-400 pt-4">Pas de données.</div>}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ color: BRAND.navy }}>Répartition reçue par héritier</CardTitle></CardHeader>
              <CardContent className="-mt-2">
                {succession.receivedPieData.length > 0 ? (() => {
                  const total = succession.receivedPieData.reduce((s: number, d: any) => s + d.value, 0);
                  const colors = [BRAND.navy, BRAND.gold, BRAND.sky, "#8094D4", "#C4A882", "#516AC7"];
                  return (
                    <div className="space-y-2">
                      {succession.receivedPieData.map((d: any, i: number) => {
                        const pct = total > 0 ? d.value / total * 100 : 0;
                        const color = colors[i % colors.length];
                        return (
                          <div key={i} className="space-y-0.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold truncate max-w-[60%]" style={{ color }}>{d.name}</span>
                              <span className="font-bold" style={{ color: BRAND.navy }}>{euro(d.value)} <span className="text-slate-400 font-normal">({Math.round(pct)}%)</span></span>
                            </div>
                            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : <div className="text-sm text-slate-400 pt-4">Pas de données.</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Détail héritiers — table compacte */}
      {succession.results.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: SURFACE.border }}>
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ background: SURFACE.tableHead, color: BRAND.sky }}>Détail par héritier</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: SURFACE.tableHead }}>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Héritier</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Lien</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">Actif reçu <HelpTooltip text="Valeur brute reçue dans la succession : pleine propriété + nue-propriété économique + usufruit économique. C'est la valeur avant droits de succession et hors AV." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">NP économique <HelpTooltip text="Valeur économique de la nue-propriété reçue (valeur de la pleine propriété × % nue-propriété Duvergier). La nue-propriété n'entre pas dans la base taxable aux droits de succession." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">Abattement <HelpTooltip text="Abattement légal selon le lien de parenté : enfant = 100 000 €, frère/sœur = 15 932 €, neveu/nièce = 7 967 €, tiers = 1 594 €. Cumulable avec l'abattement handicap (+159 325 €)." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">Base taxable <HelpTooltip text="Assiette des droits de succession = (Actif reçu en PP) − abattement légal − donations antérieures rappelées fiscalement. La nue-propriété et l'usufruit sont exclus de la base taxable." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">Droits succession <HelpTooltip text="Droits calculés sur la base taxable après application du barème progressif (en ligne directe : 5% à 45% ; frère/sœur : 35%/45% ; tiers : 60%)." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">AV reçue <HelpTooltip text="Capital d'assurance-vie transmis hors succession. Imposé selon art. 990 I (primes avant 70 ans : abattement 152 500 €/bénéf., puis 20%/31,25%) ou art. 757 B (primes après 70 ans : abattement global 30 500 €)." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">Fiscalité AV <HelpTooltip text="Taxe sur les primes AV après abattements 990 I ou 757 B. Le conjoint survivant est exonéré." /></span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-600" style={{ color: BRAND.navy }}>
                  <span className="inline-flex items-center gap-1">Net global <HelpTooltip text="Montant net après droits de succession et fiscalité AV : (Actif reçu succession − droits succession) + (AV reçue − fiscalité AV)." /></span>
                </th>
              </tr></thead>
              <tbody>
                {succession.results
                  .filter(line => line.grossReceived > 0 || line.nueRawValue > 0 || line.usufructRawValue > 0 || line.avReceived > 0)
                  .map((line, idx) => {
                    // Abattement réel = min(abattement légal, base reçue)
                    const baseRecue = line.grossReceived + line.nueRawValue;
                    const abattementAffiche = Math.min(line.allowance, Math.max(0, baseRecue));
                    return (
                      <tr key={line.name + idx} className="border-t" style={{ borderColor: SURFACE.border }}>
                        <td className="px-3 py-2.5 font-medium" style={{ color: BRAND.navy }}>{line.name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{line.relation}</td>
                        <td className="px-3 py-2.5 text-right">{euro(line.grossReceived + line.usufructRawValue + line.nueRawValue)}</td>
                        <td className="px-3 py-2.5 text-right">{euro(line.nueRawValue)}</td>
                        <td className="px-3 py-2.5 text-right">{euro(abattementAffiche)}</td>
                        <td className="px-3 py-2.5 text-right">{euro(line.successionTaxable)}</td>
                        <td className="px-3 py-2.5 text-right">{euro(line.successionDuties)}</td>
                        <td className="px-3 py-2.5 text-right">{euro(line.avReceived)}</td>
                        <td className="px-3 py-2.5 text-right">{euro(line.avDuties)}</td>
                        <td className="px-3 py-2.5 text-right font-bold" style={{ color: BRAND.navy }}>{euro(line.netReceived)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>

  );
});

TabSuccession.displayName = "TabSuccession";
export { TabSuccession };
