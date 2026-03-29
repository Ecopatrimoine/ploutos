import React from "react";
import { computeDonation, applyDonationsToData } from "../../lib/calculs/donation";
import { euro as euroFmt } from "../../lib/calculs/utils";
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

// ── Couleurs héritiers ────────────────────────────────────────────────────────
const HEIR_COLORS = [
  { bg: "#EEF2FF", text: "#3730a3", bar: "#3730a3" }, // indigo conjoint
  { bg: "#DCFCE7", text: "#15803d", bar: "#16a34a" }, // vert enfant 1
  { bg: "#FEF9C3", text: "#854d0e", bar: "#ca8a04" }, // jaune enfant 2
  { bg: "#FCE7F3", text: "#9d174d", bar: "#db2777" }, // rose enfant 3
  { bg: "#E0F2FE", text: "#075985", bar: "#0284c7" }, // bleu enfant 4
  { bg: "#FEF3C7", text: "#92400e", bar: "#d97706" }, // amber
];
function getHeirColor(idx: number) { return HEIR_COLORS[idx % HEIR_COLORS.length]; }
function getInitials(name: string) {
  return name.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

// ── TabSuccession ─────────────────────────────────────────────────────────────
const TabSuccession = React.memo(function TabSuccession(props: any) {
  const { data, successionData, setSuccessionData, succession, activeDonations, syncCollectedHeirs, getFamilyMembers, importFamilyToTestament, addTestamentHeir, updateTestamentHeir, removeTestamentHeir, addLegsPrecisItem, addLegsPrecisItemFree, addLegsPrecisItemResidual, updateLegsPrecisItem, removeLegsPrecisItem, addLegataire, updateLegataire, removeLegataire, addContrepartieLegataire, updateContrepartieLegataire, removeContrepartieLegataire, addContrepartie, updateContrepartie, removeContrepartie, addContrepartieGlobal, updateContrepartieGlobal, removeContrepartieGlobal, addContrepartieWithBalance, removeContrepartieWithBalance, legsPickerOpen, setLegsPickerOpen, addFamilyMemberToLegsGlobal, addFamilyMemberToLegsPrecis, loanModalIndex, setLoanModalIndex, addLoan, updateLoan, removeLoan, effectiveSpouseOption, spouseOptions, person1, person2 } = props;

  const [selectedHeir, setSelectedHeir] = React.useState<number | null>(null);
  const [showActifModal, setShowActifModal] = React.useState(false);
  const [showAvModal, setShowAvModal] = React.useState(false);

  // Biens concernés par une donation
  const donatedAssetNames = React.useMemo(() => {
    if (!activeDonations || activeDonations.length === 0) return new Set<string>();
    const names = new Set<string>();
    activeDonations.forEach((don: any) => {
      if (don.assetType === "property" && data?.properties?.[don.assetIndex]) {
        const p = data.properties[don.assetIndex];
        names.add(p.name || p.type || ("Bien " + (don.assetIndex + 1)));
      }
    });
    return names;
  }, [activeDonations, data?.properties]);

  // Héritiers visibles (avec au moins quelque chose)
  const visibleHeirs = React.useMemo(() =>
    (succession.results || []).filter((r: any) =>
      r.grossReceived > 0 || r.nueRawValue > 0 || r.usufructRawValue > 0 || r.avReceived > 0
    ),
    [succession.results]
  );

  // Total net transmis
  const totalNet = visibleHeirs.reduce((s: number, r: any) => s + r.grossReceived + r.nueValue + r.usufructRawValue * (succession.demembrementPct?.usufruct ?? 1) - r.successionDuties + (r.avNetReceived || 0), 0);

  return (
<TabsContent value="succession" className="space-y-4">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={FileText} title="Succession" subtitle="Actif successoral, assurance-vie et droits par héritier." /></CardHeader>
    <CardContent className="space-y-4">

      {/* ── CONFIG : défunt + conjoint ── */}
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <Field label="Décès simulé de" tooltip="Personne dont on simule le décès.">
          <Select value={successionData.deceasedPerson} onValueChange={(v: "person1" | "person2") => setSuccessionData((prev: any) => ({ ...prev, deceasedPerson: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="person1">{person1}</SelectItem><SelectItem value="person2">{person2}</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Option conjoint survivant" tooltip="Usufruit universel, pleine propriété de la quotité disponible, ou 1/4 PP.">
          <Select value={effectiveSpouseOption} onValueChange={(v) => setSuccessionData((prev: any) => ({ ...prev, spouseOption: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{spouseOptions.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="rounded-2xl border px-4 py-3 text-xs text-slate-600 space-y-0.5 self-end" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
          <div>Conjoint survivant : <strong>{successionData.deceasedPerson === "person1" ? person2 : person1}</strong></div>
          <div>Quotité disponible : <strong>{Math.round(succession.quotiteDisponible * 100)} %</strong> · Enfants réservataires : <strong>{succession.reserveChildrenCount}</strong></div>
          {succession.usufruitierAge !== null
            ? <div>Démembrement : <strong>US {Math.round(succession.demembrementPct.usufruct * 100)} % / NP {Math.round(succession.demembrementPct.nuePropriete * 100)} %</strong> ({succession.usufruitierAge} ans)</div>
            : <div className="text-amber-600">Date de naissance du conjoint à renseigner pour le démembrement.</div>}
        </div>
      </div>

      {/* ── TESTAMENT ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-9 rounded-xl px-3 text-sm"
          variant={successionData.useTestament && successionData.legsMode === "global" ? "default" : "outline"}
          onClick={() => setSuccessionData((prev: any) => ({ ...prev, useTestament: true, legsMode: "global" }))}
          style={successionData.useTestament && successionData.legsMode === "global" ? { background: BRAND.navy } : undefined}>
          Legs global
        </Button>
        <Button className="h-9 rounded-xl px-3 text-sm"
          variant={successionData.useTestament && successionData.legsMode === "precis" ? "default" : "outline"}
          onClick={() => setSuccessionData((prev: any) => ({ ...prev, useTestament: true, legsMode: "precis" }))}
          style={successionData.useTestament && successionData.legsMode === "precis" ? { background: BRAND.navy } : undefined}>
          Legs précis
        </Button>
        {successionData.useTestament && (
          <Button variant="outline" className="h-9 rounded-xl px-3 text-sm text-slate-500"
            onClick={() => setSuccessionData((prev: any) => ({ ...prev, useTestament: false }))}>
            Désactiver testament
          </Button>
        )}
      </div>

      {succession.warnings.length > 0 && (
        <div className="space-y-2">
          {succession.warnings.map((w: string, idx: number) => (
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
          {successionData.testamentHeirs.map((heir: TestamentHeir, index: number) => {
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
                      <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Button variant="outline" className="h-8 w-8 rounded-xl p-0" onClick={() => removeTestamentHeir(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid gap-2 grid-cols-[1fr_1fr_1fr]">
                  <MoneyField label="% du patrimoine légué" tooltip="Part du patrimoine successoral total (hors AV) légué à cet héritier." value={heir.shareGlobal} onChange={(e: any) => updateTestamentHeir(index, "shareGlobal", e.target.value)} compact />
                  <Field label="Nature du droit" tooltip="PP = Pleine propriété. NP = Nue-propriété. US = Usufruit.">
                    <Select value={heir.propertyRight || "full"} onValueChange={(v) => {
                      updateTestamentHeir(index, "propertyRight", v);
                      if (v === "full") setSuccessionData((prev: any) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h: any, i: number) => i === index ? { ...h, contreparties: [] } : h) }));
                    }}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Pleine propriété</SelectItem>
                        <SelectItem value="bare">Nue-propriété</SelectItem>
                        <SelectItem value="usufruct">Usufruit</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <MoneyField label="Donations antérieures" tooltip="Donations dans les 15 ans — rappel fiscal." value={heir.priorDonations} onChange={(e: any) => updateTestamentHeir(index, "priorDonations", e.target.value)} compact />
                </div>
                {heir.propertyRight === "usufruct" && age && dePercent && (
                  <div className="text-xs rounded-xl px-3 py-1.5" style={{ background: "rgba(81,106,199,0.06)", color: BRAND.sky }}>
                    📐 Barème Duvergier — âge {age} ans : US = <strong>{Math.round(dePercent.usufruct * 100)}%</strong> / NP = <strong>{Math.round(dePercent.nuePropriete * 100)}%</strong>
                  </div>
                )}
                {heir.propertyRight === "usufruct" && !heir.birthDate && (
                  <div className="text-xs text-amber-600 px-1">⚠️ Date de naissance requise pour le barème Duvergier</div>
                )}
                {(isUS || isNP) && (
                  <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: SURFACE.border, background: "rgba(255,255,255,0.6)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>{isUS ? "Nu-propriétaires liés" : "Usufruitiers liés"}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {familyMembers.map((m: any, mi: number) => (
                          <button key={mi} className="text-xs rounded-lg px-2 py-1 border hover:bg-slate-50 transition-colors" style={{ borderColor: SURFACE.border }}
                            onClick={() => addContrepartieGlobal(index, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}>
                            + {m.firstName}
                          </button>
                        ))}
                        <button className="text-xs rounded-lg px-2 py-1 border border-dashed hover:bg-slate-50 transition-colors" style={{ borderColor: SURFACE.border }} onClick={() => addContrepartieGlobal(index)}>+ Autre</button>
                      </div>
                    </div>
                    {contreparties.length === 0 && <div className="text-xs text-slate-400 italic">Aucune contrepartie — cliquez sur un membre de la famille.</div>}
                    {contreparties.map((cp: DemembrementContrepartie, ci: number) => (
                      <div key={ci} className="grid gap-2 grid-cols-[1fr_0.8fr_0.8fr_0.6fr_auto] items-end">
                        <Field label="Nom"><Input placeholder="Nom" value={cp.heirName} onChange={(e) => updateContrepartieGlobal(index, ci, "heirName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                        <Field label="Lien">
                          <Select value={cp.heirRelation} onValueChange={(v) => updateContrepartieGlobal(index, ci, "heirRelation", v)}>
                            <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Date naissance"><Input type="date" value={cp.heirBirthDate} onChange={(e) => updateContrepartieGlobal(index, ci, "heirBirthDate", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                        <MoneyField label="Quotité (%)" tooltip="Répartition entre les NP." value={cp.sharePercent} onChange={(e: any) => updateContrepartieGlobal(index, ci, "sharePercent", e.target.value)} compact />
                        <Button variant="outline" className="h-8 w-8 rounded-xl p-0 mb-0.5" onClick={() => removeContrepartieGlobal(index, ci)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    {contreparties.length > 0 && (() => {
                      const total = contreparties.reduce((s: number, c: any) => s + parseFloat(c.sharePercent || "0"), 0);
                      const ok = Math.abs(total - 100) < 0.5;
                      return <div className={`text-xs px-2 py-1 rounded-lg`} style={{ color: ok ? BRAND.sky : "#b45309" }}>Total {isUS ? "NP" : "US"} : <strong>{Math.round(total * 10) / 10}%</strong>{!ok && " ⚠️ doit être égal à 100%"}</div>;
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
          ...data.properties.map((p: Property, i: number) => ({ label: `${p.name || p.type} — ${euro(n(p.value))}`, assetType: "property" as const, idx: i, value: n(p.value) })),
          ...data.placements.filter((p: Placement) => !isAV(p.type) && !isPERType(p.type)).map((p: Placement, i: number) => ({ label: `${p.name || p.type} — ${euro(n(p.value))}`, assetType: "placement" as const, idx: i, value: n(p.value) })),
        ];
        const items = successionData.legsPrecisItems || [];
        const familyMembers = getFamilyMembers();
        const migratedItems = items.map((it: any) => {
          if (!it.legataires && (it as any).heirName) {
            return { ...it, legataires: [{ heirName: (it as any).heirName || "", heirRelation: (it as any).heirRelation || "enfant", heirBirthDate: (it as any).heirBirthDate || "", sharePercent: (it as any).sharePercent || "100", propertyRight: (it as any).propertyRight || "full", contreparties: (it as any).contreparties || [] }] };
          }
          return { ...it, legataires: it.legataires || [] };
        });
        const totalBiensExplicites = migratedItems.filter((it: any) => !it.isResidual).reduce((s: number, it: any) => {
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
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addLegsPrecisItem}><Plus className="mr-1.5 h-3.5 w-3.5" />Bien de la collecte</Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addLegsPrecisItemFree}><Plus className="mr-1.5 h-3.5 w-3.5" />Bien libre</Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" style={{ borderColor: BRAND.gold, color: BRAND.gold }} onClick={addLegsPrecisItemResidual}><Plus className="mr-1.5 h-3.5 w-3.5" />Reste du patrimoine</Button>
              </div>
            </div>
            {migratedItems.length === 0 && <div className="text-sm text-slate-500 text-center py-4">Aucun bien défini. Ajoutez un bien ci-dessus.</div>}
            {migratedItems.map((item: any, itemIdx: number) => {
              const legataires = item.legataires || [];
              const totalPP = legataires.filter((l: any) => l.propertyRight === "full").reduce((s: number, l: any) => s + n(l.sharePercent), 0);
              const totalNP = legataires.filter((l: any) => l.propertyRight === "bare").reduce((s: number, l: any) => s + n(l.sharePercent), 0);
              const totalUS = legataires.filter((l: any) => l.propertyRight === "usufruct").reduce((s: number, l: any) => s + n(l.sharePercent), 0);
              const over100PP = totalPP > 100.01; const over100NP = totalNP > 100.01; const over100US = totalUS > 100.01;
              const hasError = over100PP || over100NP || over100US;
              let assetValue = 0;
              if (item.isResidual) { assetValue = residualValue; }
              else if (item.assetType === "free") { assetValue = n(item.freeValue) || 0; }
              else { const asset = item.assetType === "property" ? data.properties[item.propertyIndex] : null; assetValue = item.assetType === "property" ? n(asset?.value) : n(data.placements[item.propertyIndex]?.value); }
              return (
                <div key={itemIdx} className="rounded-xl border p-4 space-y-3" style={{ borderColor: hasError ? "#fca5a5" : SURFACE.border, background: "#fff" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.isResidual ? (
                      <div className="flex-1 rounded-xl px-3 h-8 flex items-center text-sm font-medium" style={{ background: `${BRAND.gold}22`, color: BRAND.navy }}>🏦 Reste du patrimoine — <span className="ml-1 font-bold">{euro(residualValue)}</span></div>
                    ) : item.assetType === "free" ? (
                      <>
                        <input className="flex-1 rounded-xl border px-3 h-8 text-sm focus:outline-none" placeholder="Nom du bien libre" value={item.freeLabel || ""} onChange={(e) => updateLegsPrecisItem(itemIdx, "freeLabel" as any, e.target.value)} style={{ borderColor: SURFACE.border }} />
                        <input className="w-32 rounded-xl border px-3 h-8 text-sm focus:outline-none text-right" placeholder="Valeur (€)" value={item.freeValue || ""} onChange={(e) => updateLegsPrecisItem(itemIdx, "freeValue" as any, e.target.value)} style={{ borderColor: SURFACE.border }} />
                      </>
                    ) : (
                      <div className="flex-1">
                        <select className="w-full rounded-xl border px-3 h-8 text-sm focus:outline-none bg-white" value={`${item.assetType}-${item.propertyIndex}`}
                          onChange={(e) => { const parts = e.target.value.split("-"); const at = parts[0]; const idxStr = parts.slice(1).join("-"); updateLegsPrecisItem(itemIdx, "assetType" as any, at); updateLegsPrecisItem(itemIdx, "propertyIndex" as any, parseInt(idxStr)); }}
                          style={{ borderColor: SURFACE.border }}>
                          {allAssets.map((a: any) => <option key={`${a.assetType}-${a.idx}`} value={`${a.assetType}-${a.idx}`}>{a.label}</option>)}
                        </select>
                      </div>
                    )}
                    <Button variant="outline" className="h-8 w-8 rounded-xl p-0 shrink-0" onClick={() => removeLegsPrecisItem(itemIdx)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-400 mr-1">Ajouter :</span>
                      {familyMembers.map((m: any, mi: number) => (
                        <button key={mi} className="h-7 px-2.5 rounded-full text-xs font-medium border transition-colors hover:opacity-80"
                          style={{ background: m.relation === "conjoint" ? `${BRAND.sky}22` : `${BRAND.navy}15`, borderColor: m.relation === "conjoint" ? BRAND.sky : BRAND.navy, color: m.relation === "conjoint" ? BRAND.sky : BRAND.navy }}
                          onClick={() => addLegataire(itemIdx, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}>{m.firstName}</button>
                      ))}
                      <button className="h-7 px-2.5 rounded-full text-xs font-medium border border-dashed transition-colors hover:bg-slate-50" style={{ borderColor: SURFACE.border, color: "#888" }} onClick={() => addLegataire(itemIdx, { heirName: "", heirRelation: "autre", heirBirthDate: "" })}>+ Extérieur</button>
                    </div>
                    {legataires.length === 0 && <div className="text-xs text-slate-400 italic">Aucun légataire — cliquez sur un prénom ci-dessus.</div>}
                    {legataires.map((leg: any, legIdx: number) => {
                      const isNP = leg.propertyRight === "bare"; const isUS = leg.propertyRight === "usufruct"; const isDismembered = isNP || isUS;
                      const usufructBirthDate = isUS ? leg.heirBirthDate : (leg.contreparties || [])[0]?.heirBirthDate || "";
                      const usAge = usufructBirthDate ? new Date().getFullYear() - new Date(usufructBirthDate).getFullYear() : null;
                      const dePercent = isDismembered && usAge ? getDemembrementPercentages(usAge) : null;
                      const shareVal = n(leg.sharePercent) / 100;
                      const valorisation = dePercent ? (isUS ? assetValue * shareVal * dePercent.usufruct : assetValue * shareVal * dePercent.nuePropriete) : assetValue * shareVal;
                      return (
                        <div key={legIdx} className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                          <div className="grid gap-2 grid-cols-[1fr_0.8fr_0.7fr_0.6fr_auto] items-end">
                            <Field label="Légataire" tooltip="Nom du légataire."><Input placeholder="Nom" value={leg.heirName} onChange={(e) => updateLegataire(itemIdx, legIdx, "heirName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                            <Field label="Lien" tooltip="Lien de parenté avec le défunt.">
                              <Select value={leg.heirRelation} onValueChange={(v) => updateLegataire(itemIdx, legIdx, "heirRelation", v)}>
                                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </Field>
                            <Field label="Droit" tooltip="PP / NP / US">
                              <Select value={leg.propertyRight} onValueChange={(v) => { updateLegataire(itemIdx, legIdx, "propertyRight", v); if (v === "full") updateLegataire(itemIdx, legIdx, "contreparties", []); }}>
                                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="full">PP</SelectItem><SelectItem value="bare">NP</SelectItem><SelectItem value="usufruct">US</SelectItem></SelectContent>
                              </Select>
                            </Field>
                            <Field label="Quotité (%)" tooltip="Part de ce bien attribuée."><Input placeholder="100" value={leg.sharePercent} onChange={(e) => updateLegataire(itemIdx, legIdx, "sharePercent", e.target.value)} className="rounded-xl h-8 text-sm text-right" /></Field>
                            <Button variant="outline" className="h-8 w-8 rounded-xl p-0 mb-0.5" onClick={() => removeLegataire(itemIdx, legIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Field label="Date de naissance" tooltip={isDismembered ? "Requise pour le barème Duvergier." : "Optionnelle."}>
                              <Input type="date" value={leg.heirBirthDate} onChange={(e) => updateLegataire(itemIdx, legIdx, "heirBirthDate", e.target.value)} className="rounded-xl h-8 text-sm w-44" />
                            </Field>
                            {assetValue > 0 && (
                              <div className="text-xs rounded-lg px-2 py-1 mt-4" style={{ background: `${BRAND.gold}20`, color: BRAND.navy }}>
                                {isDismembered && dePercent ? `${isUS ? "US" : "NP"} ${Math.round((isUS ? dePercent.usufruct : dePercent.nuePropriete) * 100)}% → ${euro(valorisation)}` : `PP → ${euro(valorisation)}`}
                              </div>
                            )}
                          </div>
                          {isDismembered && (
                            <div className="rounded-lg border p-2 space-y-2" style={{ borderColor: SURFACE.border, background: "#fff" }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium" style={{ color: BRAND.sky }}>Contrepartie {isUS ? "NP" : "US"}</span>
                                <div className="flex gap-1 flex-wrap">
                                  {familyMembers.map((m: any, mi: number) => (
                                    <button key={mi} className="h-6 px-2 rounded-full text-xs border transition-colors hover:opacity-80" style={{ background: `${BRAND.navy}15`, borderColor: BRAND.navy, color: BRAND.navy }}
                                      onClick={() => addContrepartieLegataire(itemIdx, legIdx, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}>{m.firstName}</button>
                                  ))}
                                  <button className="h-6 px-2 rounded-full text-xs border border-dashed hover:bg-slate-50" style={{ borderColor: SURFACE.border, color: "#888" }} onClick={() => addContrepartieLegataire(itemIdx, legIdx, { heirName: "", heirRelation: "enfant", heirBirthDate: "" })}>+ Extérieur</button>
                                </div>
                              </div>
                              {(leg.contreparties || []).map((cp: any, ci: number) => (
                                <div key={ci} className="grid gap-2 grid-cols-[1fr_0.7fr_0.7fr_0.5fr_auto] items-end">
                                  <Field label="Nom"><Input placeholder="Nom" value={cp.heirName} onChange={(e) => updateContrepartieLegataire(itemIdx, legIdx, ci, "heirName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                                  <Field label="Lien">
                                    <Select value={cp.heirRelation} onValueChange={(v) => updateContrepartieLegataire(itemIdx, legIdx, ci, "heirRelation", v)}>
                                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                                      <SelectContent>{TESTAMENT_RELATION_OPTIONS.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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
                        {Math.abs(totalNP - totalUS) > 0.5 && totalNP > 0 && totalUS > 0 && <span className="text-amber-600">⚠️ NP ≠ US</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Modal picker famille ── */}
      {legsPickerOpen && (() => {
        const members = getFamilyMembers();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setLegsPickerOpen(null)}>
            <div className="rounded-2xl border p-6 space-y-4 w-96 shadow-2xl" style={{ background: "#fff", borderColor: SURFACE.border }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm" style={{ color: BRAND.navy }}>Choisir un légataire</div>
                <button onClick={() => setLegsPickerOpen(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>
              <div className="text-xs text-slate-500">Cliquez sur un membre de la famille ou ajoutez une personne extérieure.</div>
              <div className="space-y-2">
                {members.map((m: any, mi: number) => (
                  <button key={mi} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 border transition-colors" style={{ borderColor: SURFACE.border }}
                    onClick={() => { if (legsPickerOpen === "global") addFamilyMemberToLegsGlobal(m); else addFamilyMemberToLegsPrecis(m); setLegsPickerOpen(null); }}>
                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: m.relation === "conjoint" ? BRAND.sky : BRAND.navy }}>{(m.firstName?.[0] || "?").toUpperCase()}</span>
                    <div><div className="font-medium" style={{ color: BRAND.navy }}>{m.firstName} {m.lastName}</div><div className="text-xs text-slate-500 capitalize">{m.relation}</div></div>
                  </button>
                ))}
                {members.length === 0 && <div className="text-xs text-slate-400 italic">Aucun membre de la famille renseigné dans la collecte.</div>}
                <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm border border-dashed hover:bg-slate-50 transition-colors" style={{ borderColor: SURFACE.border }}
                  onClick={() => {
                    if (legsPickerOpen === "global") { setSuccessionData((prev: any) => ({ ...prev, testamentHeirs: [...prev.testamentHeirs, { firstName: "", lastName: "", birthDate: "", relation: "autre", priorDonations: "0", shareGlobal: "", propertyRight: "full" }] })); }
                    else { setSuccessionData((prev: any) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "property" as const, heirName: "", heirRelation: "autre", heirBirthDate: "", sharePercent: "100", propertyRight: "full", contreparties: [] }] })); }
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

      {/* ── Encart donation ── */}
      {activeDonations && activeDonations.length > 0 && (() => {
        const rappelTotal = activeDonations.reduce((sum: number, don: any) => { try { return sum + computeDonation(don, data).before15.additionalSuccessionTax; } catch { return sum; } }, 0);
        const donationTaxTotal = activeDonations.reduce((sum: number, don: any) => { try { return sum + computeDonation(don, data).totalDonationTax; } catch { return sum; } }, 0);
        return (
          <div style={{ borderRadius: "16px", border: "1.5px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.05)", padding: "14px 18px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ fontSize: "20px", flexShrink: 0 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#dc2626", marginBottom: "4px" }}>Donation active — rappel fiscal possible</div>
              <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>La situation affichée correspond à un <strong>décès après 15 ans</strong> (abattements rechargés, aucun rappel).</div>
              {rappelTotal > 0 && (
                <div style={{ marginTop: "8px", display: "flex", gap: "16px", flexWrap: "wrap" as const }}>
                  <div style={{ fontSize: "12px" }}><span style={{ color: "#888" }}>Droits donation déjà payés : </span><strong style={{ color: "#101B3B" }}>{euroFmt(donationTaxTotal)}</strong></div>
                  <div style={{ fontSize: "12px" }}><span style={{ color: "#888" }}>Rappel succession si &lt; 15 ans : </span><strong style={{ color: "#dc2626" }}>+{euroFmt(rappelTotal)}</strong></div>
                  <div style={{ fontSize: "12px" }}><span style={{ color: "#888" }}>Coût total si décès &lt; 15 ans : </span><strong style={{ color: "#dc2626" }}>{euroFmt(donationTaxTotal + rappelTotal)}</strong></div>
                </div>
              )}
              {rappelTotal === 0 && <div style={{ marginTop: "6px", fontSize: "12px", color: "#059669" }}>✓ Aucun rappel supplémentaire en cas de décès avant 15 ans.</div>}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── RÉSULTATS ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3">
        <div
          onClick={() => setShowActifModal(true)}
          style={{ cursor: "pointer", display: "contents" }}
          title="Cliquer pour le détail"
        >
          <MetricCard
            label="Actif successoral net ↗"
            value={euro(succession.activeNet)}
            hint="Cliquer pour voir le détail du calcul"
          />
        </div>
        <MetricCard label="Droits de succession" value={euro(succession.totalSuccessionRights)} hint="Droits calculés par héritier après abattements légaux et barème progressif" />
        <MetricCard label="Net transmis aux héritiers" value={euro(totalNet)} hint="Total net après droits de succession et fiscalité AV" />
      </div>

      {/* ── Cartes héritiers 3 colonnes cliquables ── */}
      {visibleHeirs.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>
            Héritiers — cliquer pour le détail
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {visibleHeirs.map((heir: any, idx: number) => {
              const clr = getHeirColor(idx);
              const total = visibleHeirs.reduce((s: number, r: any) => s + r.netReceived, 0);
              const heirNetActuel = heir.grossReceived + heir.nueValue + heir.usufructRawValue * (succession.demembrementPct?.usufruct ?? 1) - heir.successionDuties + (heir.avNetReceived || 0);
              const pct = total > 0 ? (heirNetActuel / total) * 100 : 0;
              const isDonated = activeDonations?.some((d: any) => {
                const asset = d.assetType === "property" ? data?.properties?.[d.assetIndex] : null;
                return heir.name && heir.name !== "" && d.heirs?.some((h: any) => h.name === heir.name);
              });
              return (
                <div key={heir.name + idx}
                  onClick={() => setSelectedHeir(idx)}
                  style={{
                    background: "var(--color-background-primary)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    borderRadius: "14px", padding: "16px", cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND.sky; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-tertiary)"; }}
                >
                  {isDonated && (
                    <div style={{ position: "absolute", top: "10px", right: "10px", fontSize: "10px", fontWeight: 600, background: "#dcfce7", color: "#15803d", borderRadius: "6px", padding: "2px 6px", border: "0.5px solid #bbf7d0" }}>
                      Donation
                    </div>
                  )}
                  {/* Avatar */}
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: clr.bg, color: clr.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>
                    {getInitials(heir.name)}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#101B3B", marginBottom: "2px" }}>{heir.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "12px" }}>{heir.relation}</div>
                  {/* Barre de progression */}
                  <div style={{ height: "4px", background: "var(--color-background-secondary)", borderRadius: "2px", marginBottom: "10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: clr.bar, borderRadius: "2px" }} />
                  </div>
                  {/* Montants */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "#101B3B" }}>{euro(heirNetActuel)}</div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>net reçu</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: heir.duties > 0 ? "#dc2626" : "#16a34a", fontWeight: 500 }}>
                        {heir.duties > 0 ? `−${euro(heir.duties)}` : "Exonéré"}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>droits</div>
                    </div>
                  </div>
                  <div style={{ marginTop: "10px", fontSize: "10px", color: "var(--color-text-secondary)", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "8px" }}>
                    Voir le détail →
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section Épargne hors succession ── */}
      {(() => {
        const avCapital = succession.avLines.reduce((s: number, l: any) => s + l.amount, 0);
        const avTax990I = succession.avLines.reduce((s: number, l: any) => s + l.before70Tax, 0);
        const avTax757B = succession.avLines.reduce((s: number, l: any) => s + l.after70Tax, 0);
        const avTaxTotal = avTax990I + avTax757B;
        const avNet = avCapital - avTaxTotal;
        const perPlacements = data.placements.filter((p: Placement) => isPERType(p.type));
        const perTotal = perPlacements.reduce((s: number, p: Placement) => s + n(p.value), 0);
        if (avCapital === 0 && perTotal === 0) return null;
        const defAge = successionData.deceasedPerson === "person1"
          ? (data.person1BirthDate ? getAgeFromBirthDate(data.person1BirthDate) : null)
          : (data.person2BirthDate ? getAgeFromBirthDate(data.person2BirthDate) : null);
        return (
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>
              Épargne hors succession
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: avCapital > 0 && perTotal > 0 ? "2fr 1fr" : "1fr" }}>

              {/* ── Card AV ── */}
              {avCapital > 0 && (
                <div onClick={() => setShowAvModal(true)} style={{
                  borderRadius: "18px", cursor: "pointer", overflow: "hidden",
                  border: "0.5px solid rgba(227,175,100,0.4)",
                  boxShadow: "0 2px 12px rgba(16,27,59,0.07)",
                  transition: "box-shadow 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(16,27,59,0.14)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(16,27,59,0.07)"}
                >
                  {/* Header coloré */}
                  <div style={{ background: "linear-gradient(120deg, #2A3F6F 0%, #3B5499 100%)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Assurances-vie</div>
                      <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginTop: "2px" }}>{euro(avCapital)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px" }}>Net transmis</div>
                      <div style={{ color: avNet >= avCapital * 0.85 ? "#86efac" : "#fcd34d", fontSize: "16px", fontWeight: 700 }}>{euro(avNet)}</div>
                      <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: "6px", padding: "3px 8px", fontSize: "10px", color: "rgba(255,255,255,0.8)", marginTop: "4px", display: "inline-block" }}>Voir le détail ↗</div>
                    </div>
                  </div>
                  {/* Body */}
                  <div style={{ background: "#fff", padding: "12px 18px", display: "flex", gap: "0" }}>
                    {[
                      { label: "Capital", value: euro(avCapital), color: BRAND.navy },
                      { label: "Fiscalité 990I", value: avTax990I > 0 ? "−" + euro(avTax990I) : "Exonéré", color: avTax990I > 0 ? "#d97706" : "#16a34a" },
                      { label: "Fiscalité 757B", value: avTax757B > 0 ? "−" + euro(avTax757B) : "Exonéré", color: avTax757B > 0 ? "#d97706" : "#16a34a" },
                    ].map((item, i) => (
                      <div key={i} style={{ flex: 1, padding: "6px 10px", borderLeft: i > 0 ? "0.5px solid rgba(0,0,0,0.07)" : "none" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "3px" }}>{item.label}</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Card PER ── */}
              {perTotal > 0 && (
                <div style={{
                  borderRadius: "18px", overflow: "hidden",
                  border: "0.5px solid rgba(227,175,100,0.4)",
                  boxShadow: "0 2px 12px rgba(16,27,59,0.07)",
                }}>
                  {/* Header accent doré */}
                  <div style={{ background: "linear-gradient(120deg, #C8873A 0%, #E0A855 100%)", padding: "14px 18px" }}>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Plan Épargne Retraite</div>
                    <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginTop: "2px" }}>{euro(perTotal)}</div>
                  </div>
                  {/* Body */}
                  <div style={{ background: "#fff", padding: "12px 16px" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px" }}>Régime fiscal au décès</div>
                    <div style={{
                      borderRadius: "8px", padding: "8px 10px",
                      background: defAge !== null && defAge < 70 ? "rgba(16,27,59,0.05)" : "rgba(227,175,100,0.1)",
                      border: "0.5px solid " + (defAge !== null && defAge < 70 ? "rgba(16,27,59,0.12)" : "rgba(227,175,100,0.3)"),
                      fontSize: "11px", lineHeight: 1.5,
                      color: defAge !== null && defAge < 70 ? BRAND.navy : "#92400e",
                    }}>
                      {defAge !== null && defAge < 70
                        ? <><strong>Avant 70 ans</strong> → art. 990I · abatt. 152 500 €/bénéf.</>
                        : <><strong>Après 70 ans</strong> → art. 757B · abatt. 30 500 € global</>
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Graphiques ── */}
      {visibleHeirs.length > 0 && (() => {
        const COLORS = [BRAND.navy, BRAND.gold, BRAND.sky, "#8094D4", "#C4A882", "#516AC7"];

        // Data pour bar chart héritiers : gross / droits / net
        const barData = visibleHeirs.map((r: any, i: number) => ({
          name: r.name.split(" ")[0],
          net: Math.round(r.grossReceived + r.nueValue + r.usufructRawValue * (succession.demembrementPct?.usufruct ?? 1) - r.successionDuties + (r.avNetReceived || 0)),
          droits: Math.round(r.duties),
          color: COLORS[i % COLORS.length],
        }));

        // Waterfall actif → droits → net
        const activeNet = succession.activeNet;
        const totalDroits = succession.totalSuccessionRights;
        const totalAvTax = succession.totalAvRights;
        const totalNet = visibleHeirs.reduce((s: number, r: any) => s + r.netReceived, 0);
        const avCapital = succession.avLines.reduce((s: number, l: any) => s + l.amount, 0);

        return (
          <div className="grid gap-4 md:grid-cols-2">

            {/* Graphique 1 : Brut / Droits / Net par héritier */}
            <Card className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm" style={{ color: BRAND.navy }}>Transmission par héritier</CardTitle>
                <div className="text-xs text-slate-400">Actif reçu, droits, net</div>
              </CardHeader>
              <CardContent className="-mt-2">
                <div className="space-y-3">
                  {barData.map((d: any, i: number) => {
                    const gross = d.net + d.droits;
                    const netPct = gross > 0 ? (d.net / gross) * 100 : 100;
                    const droitsPct = 100 - netPct;
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-xs font-semibold" style={{ color: d.color }}>{d.name}</span>
                          <span className="text-xs" style={{ color: BRAND.navy }}>{euro(d.net)} net</span>
                        </div>
                        <div className="h-6 rounded-lg overflow-hidden flex" style={{ background: "#f1f5f9" }}>
                          <div className="h-full flex items-center justify-end pr-1.5 text-xs font-medium text-white" style={{ width: `${netPct}%`, background: d.color, minWidth: netPct > 15 ? undefined : 0 }}>
                            {netPct > 20 ? euro(d.net) : ""}
                          </div>
                          {d.droits > 0 && (
                            <div className="h-full flex items-center justify-center text-xs font-medium" style={{ width: `${droitsPct}%`, background: "rgba(220,38,38,0.15)", color: "#dc2626", minWidth: droitsPct > 5 ? undefined : 0 }}>
                              {droitsPct > 12 ? "−" + euro(d.droits) : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Légende */}
                  <div className="flex gap-4 pt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: BRAND.navy }}></span>Net reçu</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: "rgba(220,38,38,0.3)" }}></span>Droits</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Graphique 2 : Flux actif → net transmis */}
            <Card className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm" style={{ color: BRAND.navy }}>De l'actif au net transmis</CardTitle>
                <div className="text-xs text-slate-400">Vision consolidée succession + AV</div>
              </CardHeader>
              <CardContent className="-mt-2">
                {(() => {
                  const total = activeNet + avCapital;
                  const netSucc = activeNet - totalDroits;
                  const netAv = avCapital - totalAvTax;
                  const steps = [
                    { label: "Actif successoral", value: activeNet, color: BRAND.navy, bar: activeNet / total },
                    { label: "Droits de succession", value: -totalDroits, color: "#dc2626", bar: totalDroits / total },
                    { label: "Net succession", value: netSucc, color: "#16a34a", bar: netSucc / total, separator: true },
                    ...(avCapital > 0 ? [
                      { label: "Capital AV", value: avCapital, color: BRAND.sky, bar: avCapital / total },
                      { label: "Fiscalité AV", value: -totalAvTax, color: "#d97706", bar: totalAvTax / total },
                      { label: "Net AV", value: netAv, color: "#16a34a", bar: netAv / total, separator: true },
                    ] : []),
                    { label: "Total net transmis", value: totalNet, color: BRAND.navy, bar: totalNet / total, total: true },
                  ];
                  return (
                    <div className="space-y-2">
                      {steps.map((s: any, i: number) => (
                        <div key={i}>
                          {s.separator && <div className="h-px my-1" style={{ background: SURFACE.border }} />}
                          <div className="flex items-center gap-2">
                            <div className="w-28 text-xs text-slate-500 shrink-0 text-right">{s.label}</div>
                            <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "#f8f9fa" }}>
                              <div className="h-full rounded" style={{
                                width: `${Math.abs(s.bar) * 100}%`,
                                background: s.value < 0 ? "rgba(220,38,38,0.2)" : s.color,
                                opacity: s.total ? 1 : 0.8,
                                transition: "width 0.3s"
                              }} />
                            </div>
                            <div className="w-24 text-xs font-semibold text-right shrink-0" style={{ color: s.value < 0 ? "#dc2626" : (s.total ? BRAND.navy : "#374151") }}>
                              {s.value < 0 ? "−" : ""}{euro(Math.abs(s.value))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

          </div>
        );
      })()}

    </CardContent>
  </Card>

  {/* ── Modal AV ── */}
  {showAvModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setShowAvModal(false)}>
      <div className="rounded-3xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col" style={{ background: "#ffffff", border: "0.5px solid rgba(0,0,0,0.12)", boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>Assurances-vie au décès</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px" }}>Détail par contrat et par bénéficiaire</div>
          </div>
          <button onClick={() => setShowAvModal(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: "linear-gradient(160deg, #FBECD7 0%, #ffffff 35%, #ffffff 65%, rgba(81,106,199,0.06) 100%)" }}>

          {/* KPIs récap */}
          {(() => {
            const cap = succession.avLines.reduce((s: number, l: any) => s + l.amount, 0);
            const tax990 = succession.avLines.reduce((s: number, l: any) => s + l.before70Tax, 0);
            const tax757 = succession.avLines.reduce((s: number, l: any) => s + l.after70Tax, 0);
            const netAv = cap - tax990 - tax757;
            // Abattement 990I total utilisé
            const abatt990Used = succession.avLines.reduce((s: number, l: any) => s + Math.min(152500, l.amountBefore70Capital), 0);
            const abatt990Max = succession.avLines.filter((l: any) => l.amountBefore70Capital > 0).length * 152500;
            const abatt990Restant = Math.max(0, abatt990Max - abatt990Used);
            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                  {[
                    { label: "Capital total", value: euro(cap), color: BRAND.navy },
                    { label: "Fiscalité totale", value: (tax990 + tax757) > 0 ? "−" + euro(tax990 + tax757) : "Exonéré", color: (tax990 + tax757) > 0 ? "#d97706" : "#16a34a" },
                    { label: "Net transmis", value: euro(netAv), color: "#16a34a" },
                  ].map((k, i) => (
                    <div key={i} style={{ background: "var(--color-background-secondary)", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>{k.label}</div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {abatt990Restant > 0 && (
                  <div style={{ borderRadius: "10px", border: "0.5px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)", padding: "9px 12px", fontSize: "11px", color: "#059669", marginBottom: "14px" }}>
                    Abattement 990I disponible non utilisé : <strong>{euro(abatt990Restant)}</strong> — désigner davantage de bénéficiaires ou rééquilibrer les primes optimiserait la transmission.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Contrats — cards bénéficiaires en grille */}
          {(() => {
            const contracts: Record<string, any[]> = {};
            succession.avLines.forEach((l: any) => { if (!contracts[l.contract]) contracts[l.contract] = []; contracts[l.contract].push(l); });
            return Object.entries(contracts).map(([contract, lines]: [string, any[]]) => {
              const totalCap = lines.reduce((s, l) => s + l.amount, 0);
              const totalTax = lines.reduce((s, l) => s + l.totalTax, 0);
              return (
                <div key={contract} style={{ marginBottom: "16px" }}>
                  {/* Header contrat */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1.5px solid " + BRAND.gold + "44" }}>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: BRAND.navy }}>{contract}</div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: BRAND.navy }}>{euro(totalCap)}</span>
                      <span style={{ fontSize: "11px", color: totalTax > 0 ? "#d97706" : "#16a34a", marginLeft: "8px" }}>{totalTax > 0 ? "−" + euro(totalTax) : "Exonéré"}</span>
                    </div>
                  </div>
                  {/* Grid bénéficiaires */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                    {lines.map((l: any, li: number) => {
                      const abattUsed = Math.min(152500, l.amountBefore70Capital);
                      const abattPct = l.amountBefore70Capital > 0 ? (abattUsed / 152500) * 100 : 0;
                      const abattRestant = Math.max(0, 152500 - abattUsed);
                      const netLine = l.amount - l.totalTax;
                      const initials = l.beneficiary.split(" ").map((w: string) => w[0] || "").join("").toUpperCase().slice(0, 2);
                      const isExo = l.totalTax === 0;
                      return (
                        <div key={li} style={{ borderRadius: "12px", border: "0.5px solid var(--color-border-tertiary)", padding: "12px", background: "#fff" }}>
                          {/* Avatar + nom */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                            <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: BRAND.navy + "18", color: BRAND.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: BRAND.navy }}>{l.beneficiary}</div>
                              <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>{l.sharePct}% du contrat</div>
                            </div>
                          </div>
                          {/* Capital + net */}
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <div>
                              <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Capital</div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: BRAND.navy }}>{euro(l.amount)}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Net reçu</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#16a34a" }}>{euro(netLine)}</div>
                            </div>
                          </div>
                          {/* Droits */}
                          {l.totalTax > 0 ? (
                            <div style={{ fontSize: "11px", color: "#d97706", marginBottom: "8px" }}>Fiscalité : −{euro(l.totalTax)}</div>
                          ) : (
                            <div style={{ fontSize: "11px", color: "#16a34a", marginBottom: "8px" }}>Exonéré</div>
                          )}
                          {/* Barre abattement 990I */}
                          {l.amountBefore70Capital > 0 && (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--color-text-secondary)", marginBottom: "3px" }}>
                                <span>Abatt. 990I utilisé</span>
                                <span style={{ color: abattRestant > 0 ? "#059669" : "#101B3B" }}>{Math.round(abattPct)}%</span>
                              </div>
                              <div style={{ height: "4px", borderRadius: "2px", background: "#e5e7eb", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: abattPct + "%", background: abattPct < 100 ? "#16a34a" : BRAND.navy, borderRadius: "2px" }} />
                              </div>
                              {abattRestant > 0 && (
                                <div style={{ fontSize: "10px", color: "#059669", marginTop: "3px" }}>{euro(abattRestant)} disponible</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  )}

  {/* ── Modal Actif successoral ── */}
  {showActifModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setShowActifModal(false)}>
      <div className="rounded-3xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col" style={{ background: "#ffffff", border: "0.5px solid rgba(0,0,0,0.12)", boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>Actif successoral net</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px" }}>Détail du calcul</div>
          </div>
          <button onClick={() => setShowActifModal(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>

        {/* Corps */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {/* Biens immobiliers */}
          {succession.propertyLines.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Biens immobiliers</div>
              {succession.propertyLines.map((line: any, idx: number) => {
                const isDonated = donatedAssetNames.has(line.name);
                return (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", background: isDonated ? "rgba(16,185,129,0.03)" : undefined }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#101B3B" }}>{line.name}</span>
                        {isDonated && <span style={{ fontSize: "10px", fontWeight: 600, color: "#059669", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "5px", padding: "1px 6px" }}>Donation</span>}
                      </div>
                      {line.note && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{line.note}</div>}
                      {(line.residenceAbatement > 0 || line.debtShare > 0) && (
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                          {line.residenceAbatement > 0 && <span>Abatt. RP −{euro(line.residenceAbatement)} </span>}
                          {line.debtShare > 0 && <span>Dettes −{euro(line.debtShare)} </span>}
                          {line.insuranceCover > 0 && <span style={{ color: "#16a34a" }}>dont ass. DC −{euro(line.insuranceCover)}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: "90px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#101B3B" }}>{euro(line.netEstateValue)}</div>
                      {line.grossEstateValue !== line.netEstateValue && <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>brut {euro(line.grossEstateValue)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Placements hors AV */}
          {succession.placementLines.filter((l: any) => l.netEstateValue > 0).length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Placements hors AV</div>
              {succession.placementLines.filter((l: any) => l.netEstateValue > 0).map((line: any, idx: number) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#101B3B" }}>{line.name}</div>
                    {line.note && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{line.note}</div>}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#101B3B" }}>{euro(line.netEstateValue)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Récapitulatif */}
          <div style={{ borderRadius: "12px", background: "var(--color-background-secondary)", padding: "14px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Récapitulatif</div>
            {[
              { label: "Immobilier net retenu", value: euro(succession.collectedPropertyEstate - succession.furnitureForfait), sub: null },
              { label: "Forfait mobilier 5%", value: euro(succession.furnitureForfait), sub: "évaluation forfaitaire en l'absence d'inventaire" },
              { label: "Placements hors AV", value: euro(succession.placementsSuccession), sub: null },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{row.label}</div>
                  {row.sub && <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", opacity: 0.7 }}>{row.sub}</div>}
                </div>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "#101B3B" }}>{row.value}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", marginTop: "4px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#101B3B" }}>Actif successoral net</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: BRAND.navy }}>{euro(succession.activeNet)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* ── Modal Héritier ── */}
  {selectedHeir !== null && visibleHeirs[selectedHeir] && (() => {
    const heir = visibleHeirs[selectedHeir];
    const clr = getHeirColor(selectedHeir);
    const baseRecue = heir.grossReceived + heir.nueValue; // valeur fiscale démembrée, pas la valeur PP
    const abattementAffiche = Math.min(heir.allowance, Math.max(0, baseRecue));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setSelectedHeir(null)}>
        <div className="rounded-3xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col" style={{ background: "#ffffff", border: "0.5px solid rgba(0,0,0,0.12)", boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={e => e.stopPropagation()}>

          {/* Header modal */}
          <div style={{ padding: "20px 24px 16px", background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 600 }}>
                {getInitials(heir.name)}
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>{heir.name}</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px" }}>{heir.relation}</div>
              </div>
            </div>
            <button onClick={() => setSelectedHeir(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>

          {/* Corps modal */}
          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: "linear-gradient(160deg, #FBECD7 0%, #ffffff 35%, #ffffff 65%, rgba(81,106,199,0.06) 100%)" }}>

            {/* KPIs principaux */}
            {(() => {
              const usPct = succession.demembrementPct?.usufruct ?? 0;
              const actifSuccession = heir.grossReceived + heir.nueValue + heir.usufructRawValue * usPct;
              const netSuccession = actifSuccession - heir.successionDuties;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--color-background-secondary)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                      {heir.usufructRawValue > 0 ? "PP + Usufruit reçu" : heir.nueRawValue > 0 ? "PP + NP reçue" : "Actif reçu"}
                    </div>
                    <div style={{ fontSize: "17px", fontWeight: 600, color: "#101B3B" }}>{euro(actifSuccession)}</div>
                  </div>
                  <div style={{ background: "var(--color-background-secondary)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>Droits succession</div>
                    <div style={{ fontSize: heir.duties > 0 ? "17px" : "14px", fontWeight: 600, color: heir.duties > 0 ? "#dc2626" : "#16a34a", lineHeight: 1.3 }}>
                      {heir.duties > 0 ? "−" + euro(heir.successionDuties) : (
                        <span>Exonéré<span style={{ display: "block", fontSize: "10px", fontWeight: 400, color: "#059669", marginTop: "2px" }}>art. 796-0 bis CGI — conjoint / partenaire PACS</span></span>
                      )}
                    </div>
                  </div>
                  <div style={{ background: "var(--color-background-secondary)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>Net succession</div>
                    <div style={{ fontSize: "17px", fontWeight: 600, color: "#16a34a" }}>{euro(netSuccession)}</div>
                  </div>
                </div>
              );
            })()}

            {/* Démembrement — détail NP/US */}
            {(heir.nueRawValue > 0 || heir.usufructRawValue > 0) && (
              <div style={{ borderRadius: "12px", border: "0.5px solid rgba(81,106,199,0.25)", background: "rgba(81,106,199,0.04)", padding: "12px 14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Démembrement de propriété</div>

                {heir.nueRawValue > 0 && (() => {
                  const npPct = succession.demembrementPct?.nuePropriete ?? 0;
                  return (
                    <div>
                      {([
                        { label: "Quotité NP reçue", value: Math.round(heir.nueFraction * 100) + "% de l'actif", hint: null },
                        { label: "Coefficient Duvergier", value: Math.round(npPct * 100) + "%", hint: "Valorisation fiscale de la NP selon l'âge de l'usufruitier" },
                        { label: "Valeur taxable NP", value: euro(heir.nueValue), color: "#101B3B", bold: true, hint: "Valeur économique × coefficient Duvergier → base taxable" },
                        { label: "Valeur PP au décès de l'usufruitier", value: euro(heir.nueRawValue), color: "#16a34a", bold: true, hint: "Récupère la pleine propriété sans droits supplémentaires" },
                      ] as any[]).map((row, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "0.5px solid rgba(81,106,199,0.1)" }}>
                          <div>
                            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{row.label}</div>
                            {row.hint && <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", opacity: 0.7, maxWidth: "220px" }}>{row.hint}</div>}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: row.bold ? 600 : 400, color: row.color || "var(--color-text-secondary)", marginLeft: "12px", flexShrink: 0 }}>{row.value}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.2)", fontSize: "11px", color: "#059669", lineHeight: 1.5 }}>
                        Avantage fiscal NP : {euro(heir.nueValue)} taxés aujourd'hui vs {euro(heir.nueRawValue)} en PP — économie sur {euro(heir.nueRawValue - heir.nueValue)}.
                      </div>
                    </div>
                  );
                })()}

                {heir.usufructRawValue > 0 && (() => {
                  const usPct = succession.demembrementPct?.usufruct ?? 0;
                  const usValue = heir.usufructRawValue * usPct;
                  return (
                    <div style={{ marginTop: heir.nueRawValue > 0 ? "10px" : "0" }}>
                      {([
                        { label: "Quotité US reçue", value: Math.round(heir.usufructFraction * 100) + "% de l'actif", hint: null },
                        { label: "Coefficient Duvergier", value: Math.round(usPct * 100) + "%", hint: "Valorisation fiscale de l'usufruit selon l'âge de l'usufruitier" },
                        { label: "Valeur de l'usufruit reçu", value: euro(usValue), color: "#101B3B", bold: true, hint: "Valeur PP × quotité × coefficient Duvergier" },
                      ] as any[]).map((row, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "0.5px solid rgba(81,106,199,0.1)" }}>
                          <div>
                            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{row.label}</div>
                            {row.hint && <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", opacity: 0.7 }}>{row.hint}</div>}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: row.bold ? 600 : 400, color: row.color || "var(--color-text-secondary)", marginLeft: "12px", flexShrink: 0 }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Détail calcul droits */}
            {heir.successionTaxable > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Calcul des droits de succession</div>
                {([
                  // Biens en PP si présents
                  ...(heir.grossReceived > 0 ? [{ label: "Biens en pleine propriété", value: euro(heir.grossReceived), hint: "Part de l'actif successoral reçue en PP", separator: false }] : []),
                  // NP si présente
                  ...(heir.nueRawValue > 0 ? [{ label: "Valeur taxable NP", value: euro(heir.nueValue), hint: "Valeur économique NP × coefficient Duvergier", separator: false }] : []),
                  // Sous-total si les deux sont présents
                  ...(heir.grossReceived > 0 && heir.nueRawValue > 0 ? [{ label: "Total base brute", value: euro(baseRecue), hint: null, separator: true }] : []),
                  { label: "Abattement légal", value: "−" + euro(abattementAffiche), color: "#16a34a", hint: null },
                  { label: "Base taxable", value: euro(heir.successionTaxable), bold: true, hint: null },
                  { label: "Droits de succession", value: "−" + euro(heir.successionDuties), color: "#dc2626", bold: true, hint: null },
                ] as any[]).map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", borderTop: row.separator ? "0.5px solid var(--color-border-tertiary)" : undefined }}>
                    <div>
                      <div style={{ fontSize: "12px", color: row.bold ? "#101B3B" : "var(--color-text-secondary)", fontWeight: row.separator ? 500 : 400 }}>{row.label}</div>
                      {row.hint && <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", opacity: 0.7 }}>{row.hint}</div>}
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: row.bold || row.separator ? 600 : 400, color: row.color || "#101B3B", marginLeft: "12px", flexShrink: 0 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* BracketFillChart pour cet héritier */}
            {heir.bracketFill && heir.bracketFill.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <BracketFillChart
                  title={"Barème · " + (heir.graphTitle || heir.relation)}
                  data={heir.bracketFill}
                  referenceValue={heir.successionTaxable}
                  valueLabel="Base taxable"
                />
              </div>
            )}

            {/* AV si applicable */}
            {heir.avReceived > 0 && (
              <div style={{ background: "var(--color-background-secondary)", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Assurance-vie</div>
                {([
                  { label: "Capital AV reçu", value: euro(heir.avReceived) },
                  { label: "Abattement 990I", value: "−" + euro(Math.min(152500, heir.avTaxableBefore70 > 0 ? heir.avReceived : 0)), color: "#16a34a", hint: "152 500 € par bénéficiaire sur primes avant 70 ans" },
                  { label: "Base taxable AV", value: euro(Math.max(0, heir.avTaxableBefore70 + heir.avTaxableAfter70)), hint: "Primes taxables après abattements 990I / 757B" },
                  { label: "Fiscalité AV", value: "−" + euro(heir.avDuties), color: heir.avDuties > 0 ? "#dc2626" : "#16a34a" },
                  { label: "Net AV", value: euro(heir.avNetReceived), bold: true },
                ] as any[]).map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{row.label}</span>
                    <span style={{ fontSize: "12px", fontWeight: row.bold ? 600 : 400, color: row.color || "#101B3B" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  })()}

</TabsContent>
  );
});

TabSuccession.displayName = "TabSuccession";
export { TabSuccession };
