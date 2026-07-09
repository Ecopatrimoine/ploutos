import React from "react";
import { computeDonation, applyDonationsToData, mapMembreToDonationRelation, getDonationTaxProfile } from "../../lib/calculs/donation";
import { membresFamille } from "../../lib/prevoyance/membres-famille";
import { euro as euroFmt } from "../../lib/calculs/utils";
import { resolvePlacementRef, resolvePropertyRef } from "../../lib/calculs/refs";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardAccentTop } from "../CardAccentTop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, FileText, Database, Ruler, Landmark, AlertTriangle, Check, X } from "lucide-react";
import { useEscapeToClose } from "../../hooks/useEscapeToClose";
import { useDebouncedAction } from "../../hooks/useDebouncedAction";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, labelPlacement, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, DONATION_RELATIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge, EmptyState } from "../shared";
import { successionEstVide } from "../../lib/gardefous";
import { KpiBand, PersonCard, SectionAccordion, AnalysisPie } from "../analysis";
import { buildSuccessionPresentation } from "../../lib/analysis/successionPresentation";
import { BlocCapitauxDeces } from "../succession/BlocCapitauxDeces";
import { DonationPasseeModal } from "../succession/DonationPasseeModal";
import { patchPrevoyancePair } from "../../lib/prevoyance/utils";

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
  const { onGoToCollecte, data, setField, successionData, setSuccessionData, succession, activeDonations, syncCollectedHeirs, getFamilyMembers, importFamilyToTestament, addTestamentHeir, updateTestamentHeir, removeTestamentHeir, addLegsPrecisItem, addLegsPrecisItemFree, addLegsPrecisItemResidual, updateLegsPrecisItem, removeLegsPrecisItem, addLegataire, updateLegataire, removeLegataire, addContrepartieLegataire, updateContrepartieLegataire, removeContrepartieLegataire, addContrepartie, updateContrepartie, removeContrepartie, addContrepartieGlobal, updateContrepartieGlobal, removeContrepartieGlobal, addContrepartieWithBalance, removeContrepartieWithBalance, legsPickerOpen, setLegsPickerOpen, addFamilyMemberToLegsGlobal, addFamilyMemberToLegsPrecis, loanModalPropertyId, setLoanModalPropertyId, addLoan, updateLoan, removeLoan, effectiveSpouseOption, spouseOptions, person1, person2 } = props;

  const [selectedHeir, setSelectedHeir] = React.useState<number | null>(null);
  const [editingDon, setEditingDon] = React.useState<number | null>(null); // registre donations (pivot E2)
  const [showActifModal, setShowActifModal] = React.useState(false);
  const [showAvModal, setShowAvModal] = React.useState(false);

  // Lot 8 C1 — Echap ferme chaque modale maison de l'onglet succession.
  useEscapeToClose(() => setLegsPickerOpen(null), legsPickerOpen !== null);
  useEscapeToClose(() => setShowAvModal(false), showAvModal);
  useEscapeToClose(() => setShowActifModal(false), showActifModal);
  useEscapeToClose(() => setSelectedHeir(null), selectedHeir !== null);

  // Lot 8 C2 — anti double-clic sur les ajouts de legs precis.
  const addLegsPrecisItemD = useDebouncedAction(addLegsPrecisItem);
  const addLegsPrecisItemFreeD = useDebouncedAction(addLegsPrecisItemFree);
  const addLegsPrecisItemResidualD = useDebouncedAction(addLegsPrecisItemResidual);

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

  // Total net transmis — utilise les valeurs fiscales dérivées du moteur (source unique).
  const totalNet = visibleHeirs.reduce((s: number, r: any) => s + (r.partRecueFiscale - r.successionDuties + (r.avNetReceived || 0)), 0);
  // Lot 10a — couche de PRESENTATION (agrege les sorties moteur, zero recalcul).
  const pres = buildSuccessionPresentation(succession);
  // Lot 9 C1 — etat vide si aucun patrimoine a transmettre (barriere douce, non bloquante).
  const successionVide = successionEstVide(data);

  return (
<TabsContent value="succession" className="space-y-4">
  {successionVide ? (
    <EmptyState title="Aucun patrimoine à transmettre" ctaLabel="Compléter le patrimoine" onCta={() => onGoToCollecte?.("immobilier")}>
      L'analyse successorale répartit votre patrimoine entre les héritiers et estime les droits de mutation. Renseignez vos biens et placements dans <strong>Collecte patrimoniale → Immobilier / Placements</strong> et la composition du foyer dans <strong>Données familiales</strong> — la dévolution, les abattements et les droits s'afficheront ensuite automatiquement.
    </EmptyState>
  ) : (<>
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60 relative overflow-hidden">
    <CardAccentTop />
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
        <div className="border px-4 py-3 text-xs text-slate-600 space-y-0.5 self-end" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
          <div>Conjoint survivant : <strong>{successionData.deceasedPerson === "person1" ? person2 : person1}</strong></div>
          <div>Quotité disponible : <strong>{Math.round(succession.quotiteDisponible * 100)} %</strong> · Enfants réservataires : <strong>{succession.reserveChildrenCount}</strong></div>
          {succession.usufruitierAge !== null
            ? <div>Démembrement : <strong>US {Math.round(succession.demembrementPct.usufruct * 100)} % / NP {Math.round(succession.demembrementPct.nuePropriete * 100)} %</strong> ({succession.usufruitierAge} ans)</div>
            : <div style={{ color: BRAND.warning }}>Date de naissance du conjoint à renseigner pour le démembrement.</div>}
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
            <div key={idx} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: BRAND.warningBorder, background: BRAND.warningBg, color: BRAND.warning }}>{w}</div>
          ))}
        </div>
      )}

      {/* ── LEGS GLOBAL ── */}
      {successionData.useTestament && successionData.legsMode === "global" && (
        <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
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
              <div key={index} className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
                <div className="grid gap-2 grid-cols-[1fr_1fr_1.2fr_1.3fr_auto] items-end">
                  <Field label="Prénom"><Input value={heir.firstName} onChange={(e) => updateTestamentHeir(index, "firstName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                  <Field label="Nom"><Input value={heir.lastName} onChange={(e) => updateTestamentHeir(index, "lastName", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
                  <Field label="Date de naissance"><DateFr value={heir.birthDate} onChange={(iso) => updateTestamentHeir(index, "birthDate", iso || "")} className="rounded-xl h-8 text-sm" /></Field>
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
                    <Ruler className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Barème fiscal (art. 669 CGI) — âge {age} ans : US = <strong>{Math.round(dePercent.usufruct * 100)}%</strong> / NP = <strong>{Math.round(dePercent.nuePropriete * 100)}%</strong>
                  </div>
                )}
                {heir.propertyRight === "usufruct" && !heir.birthDate && (
                  <div className="text-xs px-1" style={{ color: BRAND.warning }}><AlertTriangle className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Date de naissance requise pour le barème fiscal (art. 669 CGI)</div>
                )}
                {(isUS || isNP) && (
                  <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: SURFACE.border, background: "rgba(255,255,255,0.6)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>{isUS ? "Nu-propriétaires liés" : "Usufruitiers liés"}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {familyMembers.map((m: any, mi: number) => (
                          <button key={mi} className="text-xs rounded-lg px-2 py-1 border hover:bg-slate-50 transition-colors" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}
                            onClick={() => addContrepartieGlobal(index, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}>
                            + {m.firstName}
                          </button>
                        ))}
                        <button className="text-xs rounded-lg px-2 py-1 border border-dashed hover:bg-slate-50 transition-colors" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }} onClick={() => addContrepartieGlobal(index)}>+ Autre</button>
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
                        <Field label="Date naissance"><DateFr value={cp.heirBirthDate} onChange={(iso) => updateContrepartieGlobal(index, ci, "heirBirthDate", iso || "")} className="rounded-xl h-8 text-sm" /></Field>
                        <MoneyField label="Quotité (%)" tooltip="Répartition entre les NP." value={cp.sharePercent} onChange={(e: any) => updateContrepartieGlobal(index, ci, "sharePercent", e.target.value)} compact />
                        <Button variant="outline" className="h-8 w-8 rounded-xl p-0 mb-0.5" onClick={() => removeContrepartieGlobal(index, ci)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    {contreparties.length > 0 && (() => {
                      const total = contreparties.reduce((s: number, c: any) => s + parseFloat(c.sharePercent || "0"), 0);
                      const ok = Math.abs(total - 100) < 0.5;
                      return <div className={`text-xs px-2 py-1 rounded-lg`} style={{ color: ok ? BRAND.sky : BRAND.warning }}>Total {isUS ? "NP" : "US"} : <strong>{Math.round(total * 10) / 10}%</strong>{!ok && <> <AlertTriangle className="h-3 w-3 inline-block" aria-hidden="true" /> doit être égal à 100%</>}</div>;
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
          ...data.properties.map((p: Property) => ({ label: `${p.name || p.type} — ${euro(n(p.value))}`, assetType: "property" as const, id: p.id, value: n(p.value) })),
          ...data.placements.filter((p: Placement) => !isAV(p.type) && !isPERType(p.type)).map((p: Placement) => ({ label: `${p.name || labelPlacement(p.type)} — ${euro(n(p.value))}`, assetType: "placement" as const, id: p.id, value: n(p.value) })),
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
          const asset = it.assetType === "property" ? resolvePropertyRef(data.properties, { id: it.assetId, index: it.propertyIndex }) : null;
          const val = it.assetType === "property" ? n(asset?.value) : n(resolvePlacementRef(data.placements, { id: it.assetId, index: it.propertyIndex })?.value);
          return s + val;
        }, 0);
        const activeNet = (succession as any)?.activeNet || 0;
        const residualValue = Math.max(0, activeNet - totalBiensExplicites);
        return (
          <div className="border p-4 space-y-4" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Legs précis</div>
                <div className="text-xs text-slate-500 mt-0.5">Chaque bien peut être réparti entre plusieurs légataires</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addLegsPrecisItemD}><Plus className="mr-1.5 h-3.5 w-3.5" />Bien de la collecte</Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addLegsPrecisItemFreeD}><Plus className="mr-1.5 h-3.5 w-3.5" />Bien libre</Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" style={{ borderColor: BRAND.gold, color: BRAND.gold }} onClick={addLegsPrecisItemResidualD}><Plus className="mr-1.5 h-3.5 w-3.5" />Reste du patrimoine</Button>
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
              else { const asset = item.assetType === "property" ? resolvePropertyRef(data.properties, { id: item.assetId, index: item.propertyIndex }) : null; assetValue = item.assetType === "property" ? n(asset?.value) : n(resolvePlacementRef(data.placements, { id: item.assetId, index: item.propertyIndex })?.value); }
              return (
                <div key={itemIdx} className="rounded-xl border p-4 space-y-3" style={{ borderColor: hasError ? BRAND.dangerBorder : SURFACE.border, background: SURFACE.card }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.isResidual ? (
                      <div className="flex-1 rounded-xl px-3 h-8 flex items-center text-sm font-medium" style={{ background: `${BRAND.gold}22`, color: BRAND.navy }}><Landmark className="h-4 w-4 shrink-0 mr-1.5" aria-hidden="true" /> Reste du patrimoine — <span className="ml-1 font-bold">{euro(residualValue)}</span></div>
                    ) : item.assetType === "free" ? (
                      <>
                        <input className="flex-1 rounded-xl px-3 h-8 text-sm" placeholder="Nom du bien libre" value={item.freeLabel || ""} onChange={(e) => updateLegsPrecisItem(itemIdx, "freeLabel" as any, e.target.value)} style={{ borderRadius: 14 }} />
                        <input className="w-32 rounded-xl px-3 h-8 text-sm text-right" placeholder="Valeur (€)" value={item.freeValue || ""} onChange={(e) => updateLegsPrecisItem(itemIdx, "freeValue" as any, e.target.value)} style={{ borderRadius: 14 }} />
                      </>
                    ) : (
                      <div className="flex-1">
                        <select className="w-full rounded-xl px-3 h-8 text-sm" value={`${item.assetType}-${item.assetId ?? ""}`}
                          onChange={(e) => { const raw = e.target.value; const sep = raw.indexOf("-"); const at = raw.slice(0, sep); const id = raw.slice(sep + 1); updateLegsPrecisItem(itemIdx, "assetType" as any, at); updateLegsPrecisItem(itemIdx, "assetId" as any, id); }}
                          style={{ borderRadius: 14 }}>
                          {allAssets.map((a: any) => <option key={`${a.assetType}-${a.id}`} value={`${a.assetType}-${a.id}`}>{a.label}</option>)}
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
                      <button className="h-7 px-2.5 rounded-full text-xs font-medium border border-dashed transition-colors hover:bg-slate-50" style={{ borderColor: SURFACE.border, color: BRAND.muted }} onClick={() => addLegataire(itemIdx, { heirName: "", heirRelation: "autre", heirBirthDate: "" })}>+ Extérieur</button>
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
                        <div key={legIdx} className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
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
                            <Field label="Date de naissance" tooltip={isDismembered ? "Requise pour le barème fiscal (art. 669 CGI)." : "Optionnelle."}>
                              <DateFr value={leg.heirBirthDate} onChange={(iso) => updateLegataire(itemIdx, legIdx, "heirBirthDate", iso || "")} className="rounded-xl h-8 text-sm w-44" />
                            </Field>
                            {assetValue > 0 && (
                              <div className="text-xs rounded-lg px-2 py-1 mt-4" style={{ background: `${BRAND.gold}20`, color: BRAND.navy }}>
                                {isDismembered && dePercent ? `${isUS ? "US" : "NP"} ${Math.round((isUS ? dePercent.usufruct : dePercent.nuePropriete) * 100)}% → ${euro(valorisation)}` : `PP → ${euro(valorisation)}`}
                              </div>
                            )}
                          </div>
                          {isDismembered && (
                            <div className="rounded-lg border p-2 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.card }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium" style={{ color: BRAND.sky }}>Contrepartie {isUS ? "NP" : "US"}</span>
                                <div className="flex gap-1 flex-wrap">
                                  {familyMembers.map((m: any, mi: number) => (
                                    <button key={mi} className="h-6 px-2 rounded-full text-xs border transition-colors hover:opacity-80" style={{ background: `${BRAND.navy}15`, borderColor: BRAND.navy, color: BRAND.navy }}
                                      onClick={() => addContrepartieLegataire(itemIdx, legIdx, { heirName: `${m.firstName} ${m.lastName}`.trim(), heirRelation: m.relation, heirBirthDate: m.birthDate })}>{m.firstName}</button>
                                  ))}
                                  <button className="h-6 px-2 rounded-full text-xs border border-dashed hover:bg-slate-50" style={{ borderColor: SURFACE.border, color: BRAND.muted }} onClick={() => addContrepartieLegataire(itemIdx, legIdx, { heirName: "", heirRelation: "enfant", heirBirthDate: "" })}>+ Extérieur</button>
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
                                  <Field label="Date naissance"><DateFr value={cp.heirBirthDate} onChange={(iso) => updateContrepartieLegataire(itemIdx, legIdx, ci, "heirBirthDate", iso || "")} className="rounded-xl h-8 text-sm" /></Field>
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
                        {totalPP > 0 && <span style={{ color: over100PP ? BRAND.danger : BRAND.navy }}>PP {Math.round(totalPP)}% {over100PP ? <> <AlertTriangle className="h-3 w-3 inline-block" aria-hidden="true" /> &gt;100%</> : ""}</span>}
                        {totalNP > 0 && <span style={{ color: over100NP ? BRAND.danger : BRAND.sky }}>NP {Math.round(totalNP)}% {over100NP ? <> <AlertTriangle className="h-3 w-3 inline-block" aria-hidden="true" /> &gt;100%</> : ""}</span>}
                        {totalUS > 0 && <span style={{ color: over100US ? BRAND.danger : BRAND.success }}>US {Math.round(totalUS)}% {over100US ? <> <AlertTriangle className="h-3 w-3 inline-block" aria-hidden="true" /> &gt;100%</> : ""}</span>}
                        {Math.abs(totalNP - totalUS) > 0.5 && totalNP > 0 && totalUS > 0 && <span style={{ color: BRAND.warning }}><AlertTriangle className="h-3 w-3 inline-block" aria-hidden="true" /> NP ≠ US</span>}
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
            <div className="border p-6 space-y-4 w-full max-w-[min(920px,92vw)] shadow-2xl" style={{ background: SURFACE.card, borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm" style={{ color: BRAND.navy }}>Choisir un légataire</div>
                <button onClick={() => setLegsPickerOpen(null)} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 leading-none"><X className="h-5 w-5" aria-hidden="true" /></button>
              </div>
              <div className="text-xs text-slate-500">Cliquez sur un membre de la famille ou ajoutez une personne extérieure.</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {members.map((m: any, mi: number) => (
                  <button key={mi} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 border transition-colors" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}
                    onClick={() => { if (legsPickerOpen === "global") addFamilyMemberToLegsGlobal(m); else addFamilyMemberToLegsPrecis(m); setLegsPickerOpen(null); }}>
                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: m.relation === "conjoint" ? BRAND.sky : BRAND.navy }}>{(m.firstName?.[0] || "?").toUpperCase()}</span>
                    <div><div className="font-medium" style={{ color: BRAND.navy }}>{m.firstName} {m.lastName}</div><div className="text-xs text-slate-500 capitalize">{m.relation}</div></div>
                  </button>
                ))}
                {members.length === 0 && <div className="text-xs text-slate-400 italic">Aucun membre de la famille renseigné dans la collecte.</div>}
                <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm border border-dashed hover:bg-slate-50 transition-colors" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}
                  onClick={() => {
                    if (legsPickerOpen === "global") { setSuccessionData((prev: any) => ({ ...prev, testamentHeirs: [...prev.testamentHeirs, { firstName: "", lastName: "", birthDate: "", relation: "autre", priorDonations: "0", shareGlobal: "", propertyRight: "full" }] })); }
                    else { setSuccessionData((prev: any) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "property" as const, assetId: data?.properties?.[0]?.id, heirName: "", heirRelation: "autre", heirBirthDate: "", sharePercent: "100", propertyRight: "full", contreparties: [] }] })); }
                    setLegsPickerOpen(null);
                  }}>
                  <span className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 border" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>+</span>
                  <div className="text-slate-500 text-xs">Personne extérieure <span className="font-medium" style={{ color: BRAND.warning }}>(droits pouvant atteindre 60%)</span></div>
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
            <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0, color: BRAND.danger }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: BRAND.danger, marginBottom: "4px" }}>Donation active — rappel fiscal possible</div>
              <div style={{ fontSize: "12px", color: BRAND.muted, lineHeight: 1.5 }}>La situation affichée correspond à un <strong>décès après 15 ans</strong> (abattements rechargés, aucun rappel).</div>
              {rappelTotal > 0 && (
                <div style={{ marginTop: "8px", display: "flex", gap: "16px", flexWrap: "wrap" as const }}>
                  <div style={{ fontSize: "12px" }}><span style={{ color: BRAND.muted }}>Droits donation déjà payés : </span><strong style={{ color: BRAND.navy }}>{euroFmt(donationTaxTotal)}</strong></div>
                  <div style={{ fontSize: "12px" }}><span style={{ color: BRAND.muted }}>Rappel succession si &lt; 15 ans : </span><strong style={{ color: BRAND.danger }}>+{euroFmt(rappelTotal)}</strong></div>
                  <div style={{ fontSize: "12px" }}><span style={{ color: BRAND.muted }}>Coût total si décès &lt; 15 ans : </span><strong style={{ color: BRAND.danger }}>{euroFmt(donationTaxTotal + rappelTotal)}</strong></div>
                </div>
              )}
              {rappelTotal === 0 && <div style={{ marginTop: "6px", fontSize: "12px", color: BRAND.success }}><Check className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Aucun rappel supplémentaire en cas de décès avant 15 ans.</div>}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── RÉSULTATS ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* KPIs */}
      {/* ══════ ACTE 1 — L'ESSENTIEL : brut → fiscalité → NET (chiffre-roi) ══════ */}
      <KpiBand items={[
        { label: "Transmis brut — tous bénéficiaires", value: euro(pres.kpis.brut), hint: "Actif successoral net + capitaux d'assurance-vie" },
        { label: "Fiscalité totale", value: euro(pres.kpis.fiscalite), hint: "Droits de succession + fiscalité AV (990 I / 757 B)" },
        { label: "Net transmis — tous bénéficiaires", value: euro(pres.kpis.net), hint: "Après droits de succession et fiscalité AV", dominant: true, accent: BRAND.success },
      ]} />

      {/* ══════ ACTE 2a — QUI REÇOIT QUOI : une card par personne qui reçoit ══════ */}
      {/* Héritiers ET bénéficiaires AV non-héritiers (aujourd'hui invisibles). Décomposition
          en lignes DISTINCTES (Succession / Assurance-vie) — jamais deux fiscalités sous un
          même mot. Périmètre succession + AV (capitaux décès rangés en Acte 3, décision David). */}
      {pres.persons.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>
            Qui reçoit quoi
          </div>
          {/* A1 — auto-fill : largeur de card uniforme quel que soit le nombre par ligne
              (une card seule garde la même largeur que dans une ligne pleine). */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {pres.persons.map((person, idx) => {
              const clr = getHeirColor(idx);
              const isDonated = person.isHeir && activeDonations?.some((d: any) => person.name && d.heirs?.some((h: any) => h.name === person.name));
              const cardLines: { label: string; net: string; detail?: string }[] = [];
              if (person.succession) cardLines.push({
                label: "Succession",
                net: euro(person.succession.net),
                detail: `${person.succession.droits > 0 ? `droits ${euro(person.succession.droits)}` : "exonéré"} · ${person.succession.composition}`,
              });
              if (person.av) cardLines.push({
                label: "Assurance-vie",
                net: euro(person.av.net),
                detail: person.av.fiscalite > 0 ? `990 I ${euro(person.av.tax990I)} · 757 B ${euro(person.av.tax757B)}` : "exonérée (990 I / 757 B)",
              });
              return (
                <PersonCard
                  key={person.name + idx}
                  name={person.name}
                  relation={person.isHeir ? person.relation : "bénéficiaire AV"}
                  netLabel={euro(person.net)}
                  lines={cardLines}
                  color={clr}
                  donated={!!isDonated}
                  onDetail={person.heirIndex != null ? () => setSelectedHeir(person.heirIndex as number) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ══════ ACTE 2b — DUO : transmission par personne + cadre légal vs simulé ══════ */}
      {pres.persons.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Graphe à barres compact : net transmis par personne (montants). */}
            <div className="rounded-2xl p-4" style={{ border: `1px solid ${SURFACE.border}`, background: SURFACE.card }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>Transmission par héritier</div>
              <div className="space-y-2.5">
                {(() => {
                  const maxNet = Math.max(1, ...pres.persons.map((p) => p.net));
                  return pres.persons.map((p, i) => {
                    const clr = getHeirColor(i);
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-xs font-semibold" style={{ color: clr.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>{p.name}</span>
                          <span className="text-xs shrink-0" style={{ color: BRAND.navy }}>{euro(p.net)}</span>
                        </div>
                        <div className="h-4 rounded-lg overflow-hidden" style={{ background: SURFACE.app }}>
                          <div className="h-full rounded-lg" style={{ width: `${(p.net / maxNet) * 100}%`, background: clr.bar, transition: "width .3s" }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            {/* Camembert double : cadre légal (réserve/enfant + quotité) vs répartition simulée. */}
            <AnalysisPie title="Cadre légal" data={pres.cadreLegalPie} valueFormat={euro}
              note={<>Quotité disponible <strong>{Math.round(succession.quotiteDisponible * 100)} %</strong> · {succession.reserveChildrenCount} réservataire{succession.reserveChildrenCount > 1 ? "s" : ""}{succession.usufruitierAge !== null ? <> · démembrement US {Math.round(succession.demembrementPct.usufruct * 100)} % / NP {Math.round(succession.demembrementPct.nuePropriete * 100)} % (art. 669 CGI)</> : null}</>} />
            <AnalysisPie title="Répartition simulée" data={pres.repartitionSimuleePie} valueFormat={euro}
              note="Périmètre : succession civile (l'assurance-vie est hors succession) · En cas d'usufruit du conjoint, la réserve s'apprécie en nue-propriété." />
          </div>
          {/* Alerte réserve : UNIQUEMENT si le moteur la détecte (legs précis) — jamais déduite des parts. */}
          {pres.reserveWarning && (
            <div className="rounded-xl border px-4 py-2 text-sm flex items-start gap-1.5" style={{ borderColor: BRAND.warningBorder, background: BRAND.warningBg, color: BRAND.warning }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{pres.reserveWarning}</span>
            </div>
          )}
        </div>
      )}

      {/* ══════ ACTE 3 — LES MASSES (accordéons, fermés par défaut) ══════ */}
      <div className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: BRAND.sky }}>Les masses — le détail rangé</div>

      {/* §1 — Actif successoral net */}
      <SectionAccordion title="Actif successoral net" summary={`${euro(succession.activeNet)} · droits ${euro(succession.totalSuccessionRights)}`}>
        <div className="grid gap-3 md:grid-cols-2 mb-3">
          <MetricCard label="Actif successoral net" value={euro(succession.activeNet)} hint="Biens + placements successoraux, après forfait mobilier 5 %" accent="navy" />
          <MetricCard label="Droits de succession" value={euro(succession.totalSuccessionRights)} hint="Après abattements légaux et barème progressif, par héritier" accent="red" />
        </div>
        <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={() => setShowActifModal(true)}>Détail du calcul de l'actif</Button>
      </SectionAccordion>

      {/* §2 — Épargne hors succession */}
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
          <SectionAccordion title="Épargne hors succession" summary={`${avCapital > 0 ? `${euro(avNet)} net AV` : ""}${avCapital > 0 && perTotal > 0 ? " · " : ""}${perTotal > 0 ? `${euro(perTotal)} PER` : ""}`}>
            {/* A5/A6 — AV + PER fusionnés : BANDEAU supérieur en dégradé incliné marine→or
                (bord lisse, ambiances conservées), hauteur d'en-tête uniforme (min-h commune),
                l'encart « régime fiscal » PER descend dans le corps, aligné avec la rangée AV.
                Repli : empilement sous 600px (chaque zone garde sa couleur pleine). */}
            <div className="rounded-2xl overflow-hidden relative flex flex-col min-[600px]:flex-row min-[600px]:items-stretch" style={{ border: "1px solid rgba(227,175,100,0.4)", boxShadow: "0 2px 12px rgba(16,27,59,0.07)", background: SURFACE.card }}>
              {/* Bandeau dégradé incliné (desktop uniquement) — bord lisse garanti par le fondu 47→53 % */}
              {avCapital > 0 && perTotal > 0 && (
                <div className="hidden min-[600px]:block absolute top-0 left-0 right-0 pointer-events-none" style={{ height: 88, zIndex: 0, background: `linear-gradient(100deg, ${BRAND.navy} 0%, ${BRAND.navy} 62%, ${BRAND.gold} 71%, ${BRAND.gold} 100%)` }} />
              )}
              {/* Zone AV (marine) */}
              {avCapital > 0 && (
                <div onClick={() => setShowAvModal(true)} className="flex-[2] cursor-pointer flex flex-col relative" style={{ zIndex: 1 }}>
                  {/* pr-[12%] en desktop : la fin du texte (net transmis + détails) s'arrête AVANT le début du dégradé */}
                  <div className={`flex items-center justify-between px-[18px] py-[14px] bg-[#0F172A] ${perTotal > 0 ? "min-[600px]:bg-transparent min-[600px]:pr-[12%]" : ""}`} style={{ minHeight: 88 }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Assurances-vie</div>
                      <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginTop: "2px" }}>{euro(avCapital)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>Net transmis</div>
                      <div style={{ color: avNet >= avCapital * 0.85 ? "#86efac" : "#fcd34d", fontSize: "16px", fontWeight: 700 }}>{euro(avNet)}</div>
                      <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "#fff", marginTop: "4px", display: "inline-block" }}>Voir le détail ↗</div>
                    </div>
                  </div>
                  <div className="flex-1" style={{ padding: "12px 18px", display: "flex", gap: "0", background: SURFACE.card }}>
                    {[
                      { label: "Capital", value: euro(avCapital), color: BRAND.navy },
                      { label: "Fiscalité 990I", value: avTax990I > 0 ? "−" + euro(avTax990I) : "Exonéré", color: avTax990I > 0 ? BRAND.warning : BRAND.success },
                      { label: "Fiscalité 757B", value: avTax757B > 0 ? "−" + euro(avTax757B) : "Exonéré", color: avTax757B > 0 ? BRAND.warning : BRAND.success },
                    ].map((item, i) => (
                      <div key={i} style={{ flex: 1, padding: "6px 10px", borderLeft: i > 0 ? "1px solid rgba(0,0,0,0.07)" : "none" }}>
                        <div style={{ fontSize: "11px", color: BRAND.inactive, marginBottom: "3px" }}>{item.label}</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Zone PER (or) */}
              {perTotal > 0 && (
                <div className="flex-1 flex flex-col relative" style={{ zIndex: 1 }}>
                  <div className={`flex flex-col justify-center px-[18px] py-[14px] bg-[#C4973D] ${avCapital > 0 ? "min-[600px]:bg-transparent min-[600px]:pl-[11%]" : ""}`} style={{ minHeight: 88 }}>
                    <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>Plan Épargne Retraite</div>
                    <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginTop: "2px" }}>{euro(perTotal)}</div>
                  </div>
                  <div className={`flex-1 px-[18px] py-[12px] ${avCapital > 0 ? "min-[600px]:pl-[11%]" : ""}`} style={{ background: SURFACE.card }}>
                    <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "8px" }}>Régime fiscal au décès</div>
                    <div style={{
                      borderRadius: "8px", padding: "8px 10px",
                      background: defAge !== null && defAge < 70 ? "rgba(16,27,59,0.05)" : "rgba(227,175,100,0.1)",
                      border: "1px solid " + (defAge !== null && defAge < 70 ? "rgba(16,27,59,0.12)" : "rgba(227,175,100,0.3)"),
                      fontSize: "11px", lineHeight: 1.5,
                      color: defAge !== null && defAge < 70 ? BRAND.navy : BRAND.warning,
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
          </SectionAccordion>
        );
      })()}

      {/* §3 — Capitaux décès des régimes obligatoires + rentes de survie (séparation stricte) */}
      <SectionAccordion title="Capitaux décès des régimes obligatoires + rentes de survie" summary={`${euro((succession.capitalDecesCaisseExonere ?? 0) + (succession.capitalDecesBrancheExonere ?? 0))} exonérés · rentes annuelles comptées à part`}>
      <BlocCapitauxDeces
        caisses={succession.capitalDecesLines?.caisses ?? []}
        prives={succession.capitalDecesLines?.prives ?? []}
        branche={succession.capitalDecesLines?.branche ?? []}
        renteEducationBranche={succession.capitalDecesLines?.renteEducationBranche ?? []}
        renteConjointBranche={succession.capitalDecesLines?.renteConjointBranche ?? []}
        rentes={succession.rentesSurvieAnnuelles ?? []}
        totalCaisseExonere={succession.capitalDecesCaisseExonere ?? 0}
        totalPriveCapital={succession.capitalDecesPriveCapital ?? 0}
        totalPriveDuties={succession.capitalDecesPriveDuties ?? 0}
        surcharge={data.prevoyance?.[successionData.deceasedPerson === "person1" ? "p1" : "p2"]?.capitalDecesCaisseSurcharge ?? null}
        onSurchargeChange={setField ? (next) => {
          const which = successionData.deceasedPerson === "person1" ? "p1" : "p2";
          const hasP2 = data.coupleStatus !== "single";
          setField("prevoyance", patchPrevoyancePair(data.prevoyance, which, { capitalDecesCaisseSurcharge: next ?? undefined }, hasP2));
        } : undefined}
      />
      </SectionAccordion>

      {/* §4 — Donations antérieures — rappel fiscal (art. 784 CGI) */}
      <SectionAccordion title="Donations antérieures — rappel fiscal (art. 784 CGI)" summary={`${(data.donations || []).length} donation${(data.donations || []).length > 1 ? "s" : ""} enregistrée${(data.donations || []).length > 1 ? "s" : ""}`}>
        <div className="flex justify-end mb-2">
          <Button variant="outline" className="h-7 rounded-xl px-3 text-xs" onClick={() => {
            const nouvelle = { id: `don_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, donorPersonKey: "person1", beneficiaireType: "autre", beneficiaireNom: "", beneficiaireRelation: "enfant", date: new Date().toISOString().slice(0, 10), montant: "", type: "simple" };
            const idx = (data.donations || []).length;
            setField("donations", [...(data.donations || []), nouvelle]);
            setEditingDon(idx);
          }}>
            <Plus className="mr-1 h-3 w-3" />Donation
          </Button>
        </div>
        {(!data.donations || data.donations.length === 0) && (
          <div className="text-xs text-slate-400 italic">Aucune donation enregistrée. Les donations simples de moins de 15 ans consenties par le foyer réduisent l'abattement des héritiers (rappel fiscal, art. 784 CGI).</div>
        )}
        <div className="space-y-2">
        {(data.donations || []).map((don: any, i: number) => {
          const donateurNom = don.donorPersonKey === "person2" ? (person2 || "Personne 2") : person1;
          const benef = don.beneficiaireNom || (don.beneficiaireType === "autre" ? "—" : "Bénéficiaire");
          const typeLabel = don.type === "simple" ? "simple" : don.type === "don_familial_790G" ? "790 G" : don.type === "don_790A_bis" ? "790 A bis" : "présent d'usage";
          const horsRappel = don.type !== "simple";
          return (
            <div key={don.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: SURFACE.border }}>
              <div className="text-sm min-w-0" style={{ color: BRAND.navy }}>
                <span className="font-medium">{donateurNom}</span> → {benef}
                <span className="text-xs ml-2" style={{ color: BRAND.muted }}>{don.montant ? euro(don.montant) : "—"} · {String(don.date || "").slice(0, 10) || "date ?"} · <span style={{ color: horsRappel ? BRAND.muted : BRAND.sky }}>{typeLabel}{horsRappel ? " (hors rappel)" : ""}</span></span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" className="h-7 rounded-xl px-2 text-xs" onClick={() => setEditingDon(i)}>Modifier</Button>
                <Button variant="outline" className="h-7 w-7 rounded-xl p-0" onClick={() => setField("donations", (data.donations || []).filter((_: any, j: number) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          );
        })}
        </div>
      </SectionAccordion>



    </CardContent>
  </Card>

  {/* ── Modal AV ── */}
  {showAvModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setShowAvModal(false)}>
      <div className="rounded-3xl w-full max-w-[min(920px,92vw)] max-h-[88vh] overflow-hidden flex flex-col" style={{ background: SURFACE.card, border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>Assurances-vie au décès</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px" }}>Détail par contrat et par bénéficiaire</div>
          </div>
          <button onClick={() => setShowAvModal(false)} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: SURFACE.card }}>

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
                    { label: "Fiscalité totale", value: (tax990 + tax757) > 0 ? "−" + euro(tax990 + tax757) : "Exonéré", color: (tax990 + tax757) > 0 ? BRAND.warning : BRAND.success },
                    { label: "Net transmis — assurances-vie (tous bénéficiaires)", value: euro(netAv), color: BRAND.success },
                  ].map((k, i) => (
                    <div key={i} style={{ background: SURFACE.app, borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "4px" }}>{k.label}</div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {abatt990Restant > 0 && (
                  <div style={{ borderRadius: "10px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)", padding: "9px 12px", fontSize: "11px", color: BRAND.success, marginBottom: "14px" }}>
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
                      <span style={{ fontSize: "11px", color: totalTax > 0 ? BRAND.warning : BRAND.success, marginLeft: "8px" }}>{totalTax > 0 ? "−" + euro(totalTax) : "Exonéré"}</span>
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
                        <div key={li} style={{ borderRadius: "12px", border: `1px solid ${SURFACE.border}`, padding: "12px", background: SURFACE.card }}>
                          {/* Avatar + nom */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                            <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: BRAND.navy + "18", color: BRAND.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: BRAND.navy }}>{l.beneficiary}</div>
                              <div style={{ fontSize: "11px", color: BRAND.muted }}>{l.sharePct}% du contrat</div>
                            </div>
                          </div>
                          {/* Capital + net */}
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <div>
                              <div style={{ fontSize: "11px", color: BRAND.muted }}>Capital</div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: BRAND.navy }}>{euro(l.amount)}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "11px", color: BRAND.muted }}>Net reçu</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: BRAND.success }}>{euro(netLine)}</div>
                            </div>
                          </div>
                          {/* Droits */}
                          {l.totalTax > 0 ? (
                            <div style={{ fontSize: "11px", color: BRAND.warning, marginBottom: "8px" }}>Fiscalité : −{euro(l.totalTax)}</div>
                          ) : (
                            <div style={{ fontSize: "11px", color: BRAND.success, marginBottom: "8px" }}>Exonéré</div>
                          )}
                          {/* Barre abattement 990I */}
                          {l.amountBefore70Capital > 0 && (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: BRAND.muted, marginBottom: "3px" }}>
                                <span>Abatt. 990I utilisé</span>
                                <span style={{ color: abattRestant > 0 ? BRAND.success : BRAND.navy }}>{Math.round(abattPct)}%</span>
                              </div>
                              <div style={{ height: "4px", borderRadius: "2px", background: SURFACE.border, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: abattPct + "%", background: abattPct < 100 ? BRAND.success : BRAND.navy, borderRadius: "2px" }} />
                              </div>
                              {abattRestant > 0 && (
                                <div style={{ fontSize: "11px", color: BRAND.success, marginTop: "3px" }}>{euro(abattRestant)} disponible</div>
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
      <div className="rounded-3xl w-full max-w-[min(920px,92vw)] max-h-[88vh] overflow-hidden flex flex-col" style={{ background: SURFACE.card, border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>Actif successoral net</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px", marginTop: "2px" }}>Détail du calcul</div>
          </div>
          <button onClick={() => setShowActifModal(false)} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X className="h-4 w-4" aria-hidden="true" /></button>
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
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${SURFACE.border}`, background: isDonated ? "rgba(16,185,129,0.03)" : undefined }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: BRAND.navy }}>{line.name}</span>
                        {isDonated && <span style={{ fontSize: "11px", fontWeight: 600, color: BRAND.success, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "5px", padding: "1px 6px" }}>Donation</span>}
                      </div>
                      {line.note && <div style={{ fontSize: "11px", color: BRAND.muted }}>{line.note}</div>}
                      {(line.residenceAbatement > 0 || line.debtShare > 0) && (
                        <div style={{ fontSize: "11px", color: BRAND.muted, marginTop: "2px" }}>
                          {line.residenceAbatement > 0 && <span>Abatt. RP −{euro(line.residenceAbatement)} </span>}
                          {line.debtShare > 0 && <span>Dettes −{euro(line.debtShare)} </span>}
                          {line.insuranceCover > 0 && <span style={{ color: BRAND.success }}>dont ass. DC −{euro(line.insuranceCover)}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: "90px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: BRAND.navy }}>{euro(line.netEstateValue)}</div>
                      {line.grossEstateValue !== line.netEstateValue && <div style={{ fontSize: "11px", color: BRAND.muted }}>brut {euro(line.grossEstateValue)}</div>}
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
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${SURFACE.border}` }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: BRAND.navy }}>{line.name}</div>
                    {line.note && <div style={{ fontSize: "11px", color: BRAND.muted }}>{line.note}</div>}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: BRAND.navy }}>{euro(line.netEstateValue)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Récapitulatif */}
          <div style={{ borderRadius: "12px", background: SURFACE.app, padding: "14px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Récapitulatif</div>
            {[
              { label: "Immobilier net retenu", value: euro(succession.collectedPropertyEstate - succession.furnitureForfait), sub: null },
              { label: "Forfait mobilier 5%", value: euro(succession.furnitureForfait), sub: "évaluation forfaitaire en l'absence d'inventaire" },
              { label: "Placements hors AV", value: euro(succession.placementsSuccession), sub: null },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: `1px solid ${SURFACE.border}` }}>
                <div>
                  <div style={{ fontSize: "12px", color: BRAND.muted }}>{row.label}</div>
                  {row.sub && <div style={{ fontSize: "11px", color: BRAND.muted, opacity: 0.7 }}>{row.sub}</div>}
                </div>
                <div style={{ fontSize: "12px", fontWeight: 500, color: BRAND.navy }}>{row.value}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", marginTop: "4px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: BRAND.navy }}>Actif successoral net</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: BRAND.navy }}>{euro(succession.activeNet)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Modal edition d'une donation passee (pivot E2) — rendu TOP-LEVEL, hors de la
      Card (patron LoanModal/heir) : depuis la CardContent, un ancetre (Card
      relative/overflow, TabsContent) cassait le position:fixed -> centrage sur
      l'espace complet du document + decalage au scroll. Ici : fixed viewport OK. */}
  <DonationPasseeModal
    open={editingDon !== null && !!(data.donations || [])[editingDon]}
    donation={editingDon !== null ? (data.donations || [])[editingDon] : null}
    data={data}
    person1={person1}
    person2={person2 || "Personne 2"}
    upd={(patch: any) => { if (editingDon !== null) setField("donations", (data.donations || []).map((d: any, j: number) => j === editingDon ? { ...d, ...patch } : d)); }}
    onClose={() => setEditingDon(null)}
  />

  {/* ── Modal Héritier ── */}
  {selectedHeir !== null && visibleHeirs[selectedHeir] && (() => {
    const heir = visibleHeirs[selectedHeir];
    const clr = getHeirColor(selectedHeir);
    const baseRecue = heir.grossReceived + heir.nueValue; // valeur fiscale démembrée, pas la valeur PP
    // F3 (affichage seul) : afficher l'abattement RESIDUEL reellement applique par
    // le moteur (allowance - abattementConsomme). rappelApplique.abattementConsomme
    // couvre AUTO (donations rappelees) ET MANUEL (priorDonations saisi). Le plein
    // etait trompeur quand une donation entamait l'abattement.
    const abattementConsomme = Math.max(0, heir.rappelApplique?.abattementConsomme || 0);
    const abattementResiduel = Math.max(0, heir.allowance - abattementConsomme);
    const abattementAffiche = Math.min(abattementResiduel, Math.max(0, baseRecue));
    const abattementDetail = abattementConsomme > 0
      ? `${euro(heir.allowance)} − ${euro(abattementConsomme)} = ${euro(abattementResiduel)}`
      : null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setSelectedHeir(null)}>
        <div className="rounded-3xl w-full max-w-[min(920px,92vw)] max-h-[88vh] overflow-hidden flex flex-col" style={{ background: SURFACE.card, border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={e => e.stopPropagation()}>

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
            <button onClick={() => setSelectedHeir(null)} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>

          {/* Corps modal */}
          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: SURFACE.card }}>

            {/* KPIs principaux — valeurs fiscales dérivées du moteur (source unique) */}
            {(() => {
              const actifSuccession = heir.partRecueFiscale;
              const netSuccession = actifSuccession - heir.successionDuties;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ background: SURFACE.app, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "4px" }}>
                      {heir.usufructRawValue > 0 ? "PP + Usufruit reçu" : heir.nueRawValue > 0 ? "PP + NP reçue" : "Actif reçu"}
                    </div>
                    <div style={{ fontSize: "17px", fontWeight: 600, color: BRAND.navy }}>{euro(actifSuccession)}</div>
                  </div>
                  <div style={{ background: SURFACE.app, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "4px" }}>Droits succession</div>
                    <div style={{ fontSize: heir.duties > 0 ? "17px" : "14px", fontWeight: 600, color: heir.duties > 0 ? BRAND.danger : BRAND.success, lineHeight: 1.3 }}>
                      {heir.duties > 0 ? "−" + euro(heir.successionDuties) : (
                        <span>Exonéré<span style={{ display: "block", fontSize: "11px", fontWeight: 400, color: BRAND.success, marginTop: "2px" }}>art. 796-0 bis CGI — conjoint / partenaire PACS</span></span>
                      )}
                    </div>
                  </div>
                  <div style={{ background: SURFACE.app, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: BRAND.muted, marginBottom: "4px" }}>Net succession</div>
                    <div style={{ fontSize: "17px", fontWeight: 600, color: BRAND.success }}>{euro(netSuccession)}</div>
                  </div>
                </div>
              );
            })()}

            {/* A2 — démembrement | calcul des droits en 2 colonnes quand le démembrement
                est présent (réduit le déroulé vertical). Barème en pleine largeur dessous. */}
            <div className={(heir.nueRawValue > 0 || heir.usufructRawValue > 0) ? "grid gap-4 md:grid-cols-2 items-start" : ""}>
            {/* Démembrement — détail NP/US */}
            {(heir.nueRawValue > 0 || heir.usufructRawValue > 0) && (
              <div style={{ borderRadius: "12px", border: "1px solid rgba(81,106,199,0.25)", background: "rgba(81,106,199,0.04)", padding: "12px 14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Démembrement de propriété</div>

                {heir.nueRawValue > 0 && (() => {
                  const npPct = succession.demembrementPct?.nuePropriete ?? 0;
                  return (
                    <div>
                      {([
                        { label: "Quotité NP reçue", value: Math.round(heir.nueFraction * 100) + "% de l'actif", hint: null },
                        { label: "Barème fiscal de l'usufruit — art. 669 CGI", value: Math.round(npPct * 100) + "%", hint: "Valorisation fiscale de la NP selon l'âge de l'usufruitier" },
                        { label: "Valeur taxable NP", value: euro(heir.nueValue), color: BRAND.navy, bold: true, hint: "Valeur économique × coefficient (art. 669 CGI) → base taxable" },
                        { label: "Valeur PP au décès de l'usufruitier", value: euro(heir.nueRawValue), color: BRAND.success, bold: true, hint: "Récupère la pleine propriété sans droits supplémentaires" },
                      ] as any[]).map((row, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid rgba(81,106,199,0.1)" }}>
                          <div>
                            <div style={{ fontSize: "12px", color: BRAND.muted }}>{row.label}</div>
                            {row.hint && <div style={{ fontSize: "11px", color: BRAND.muted, opacity: 0.7, maxWidth: "220px" }}>{row.hint}</div>}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: row.bold ? 600 : 400, color: row.color || BRAND.muted, marginLeft: "12px", flexShrink: 0 }}>{row.value}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "11px", color: BRAND.success, lineHeight: 1.5 }}>
                        Avantage fiscal NP : {euro(heir.nueValue)} taxés aujourd'hui vs {euro(heir.nueRawValue)} en PP — économie sur {euro(heir.nueRawValue - heir.nueValue)}.
                      </div>
                    </div>
                  );
                })()}

                {heir.usufructRawValue > 0 && (() => {
                  const usPct = succession.demembrementPct?.usufruct ?? 0;
                  return (
                    <div style={{ marginTop: heir.nueRawValue > 0 ? "10px" : "0" }}>
                      {([
                        { label: "Quotité US reçue", value: Math.round(heir.usufructFraction * 100) + "% de l'actif", hint: null },
                        { label: "Barème fiscal de l'usufruit — art. 669 CGI", value: Math.round(usPct * 100) + "%", hint: "Valorisation fiscale de l'usufruit selon l'âge de l'usufruitier" },
                        { label: "Valeur de l'usufruit reçu", value: euro(heir.usufructFiscalValue), color: BRAND.navy, bold: true, hint: "Valeur PP × quotité × coefficient (art. 669 CGI)" },
                      ] as any[]).map((row, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid rgba(81,106,199,0.1)" }}>
                          <div>
                            <div style={{ fontSize: "12px", color: BRAND.muted }}>{row.label}</div>
                            {row.hint && <div style={{ fontSize: "11px", color: BRAND.muted, opacity: 0.7 }}>{row.hint}</div>}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: row.bold ? 600 : 400, color: row.color || BRAND.muted, marginLeft: "12px", flexShrink: 0 }}>{row.value}</span>
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
                  ...(heir.nueRawValue > 0 ? [{ label: "Valeur taxable NP", value: euro(heir.nueValue), hint: "Valeur économique NP × coefficient (art. 669 CGI)", separator: false }] : []),
                  // Sous-total si les deux sont présents
                  ...(heir.grossReceived > 0 && heir.nueRawValue > 0 ? [{ label: "Total base brute", value: euro(baseRecue), hint: null, separator: true }] : []),
                  { label: "Abattement légal", value: "−" + euro(abattementAffiche), color: BRAND.success, hint: abattementDetail },
                  { label: "Base taxable", value: euro(heir.successionTaxable), bold: true, hint: null },
                  { label: "Droits de succession", value: "−" + euro(heir.successionDuties), color: BRAND.danger, bold: true, hint: null },
                ] as any[]).map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: `1px solid ${SURFACE.border}`, borderTop: row.separator ? `1px solid ${SURFACE.border}` : undefined }}>
                    <div>
                      <div style={{ fontSize: "12px", color: row.bold ? BRAND.navy : BRAND.muted, fontWeight: row.separator ? 500 : 400 }}>{row.label}</div>
                      {row.hint && <div style={{ fontSize: "11px", color: BRAND.muted, opacity: 0.7 }}>{row.hint}</div>}
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: row.bold || row.separator ? 600 : 400, color: row.color || BRAND.navy, marginLeft: "12px", flexShrink: 0 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* ── Rappel fiscal des donations (Lot C) ── */}
            {heir.rappelApplique && (heir.rappelApplique.mode !== "aucun" || heir.rappelApplique.aVerifier) && (() => {
              const ra = heir.rappelApplique;
              // Dates derivees du registre (affichage seul ; le calcul vient du moteur).
              const donsHeir = (data.donations || []).filter((d: any) => d.type === "simple" && (
                (d.beneficiaireType === "child" && d.beneficiaireChildId === heir.childId) ||
                (d.beneficiaireType === "conjoint" && (heir.relation === "conjoint" || heir.relation === "pacs_partner"))
              ));
              const annees = donsHeir.map((d: any) => String(d.date || "").slice(0, 4)).filter(Boolean).join(", ");
              return (
                <div style={{ marginBottom: "16px", borderRadius: "10px", padding: "10px 12px", background: ra.aVerifier ? BRAND.warningBg : "rgba(81,106,199,0.06)", border: `1px solid ${ra.aVerifier ? BRAND.warningBorder : "rgba(81,106,199,0.18)"}` }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    Rappel fiscal des donations
                    {ra.mode === "manuel" && <span style={{ fontSize: 10, background: "rgba(0,0,0,0.06)", color: BRAND.muted, borderRadius: 5, padding: "1px 6px", fontWeight: 600 }}>manuel</span>}
                  </div>
                  {ra.mode === "auto" && (
                    <div style={{ fontSize: "12px", color: BRAND.navy, lineHeight: 1.5 }}>
                      Abattement {euro(heir.allowance)} − {euro(ra.abattementConsomme)} donnés{annees ? ` (${annees})` : ""} = <strong>{euro(Math.max(0, heir.allowance - ra.abattementConsomme))} disponible</strong>.
                      {ra.baseTaxeeAnterieure > 0 && <span> Reprise de progressivité sur {euro(ra.baseTaxeeAnterieure)} déjà taxés (art. 784 CGI).</span>}
                    </div>
                  )}
                  {ra.aVerifier && (
                    <div style={{ fontSize: "12px", color: BRAND.warning, marginTop: ra.mode === "auto" ? "4px" : 0 }}><AlertTriangle className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Une donation a été ignorée (date ou montant manquant) — à vérifier.</div>
                  )}
                </div>
              );
            })()}

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
              <div style={{ background: SURFACE.app, borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Assurance-vie</div>
                {([
                  { label: "Capital AV reçu", value: euro(heir.avReceived) },
                  { label: "Abattement 990I", value: "−" + euro(Math.min(152500, heir.avTaxableBefore70 > 0 ? heir.avReceived : 0)), color: BRAND.success, hint: "152 500 € par bénéficiaire sur primes avant 70 ans" },
                  { label: "Base taxable AV", value: euro(Math.max(0, heir.avTaxableBefore70 + heir.avTaxableAfter70)), hint: "Primes taxables après abattements 990I / 757B" },
                  { label: "Fiscalité AV", value: "−" + euro(heir.avDuties), color: heir.avDuties > 0 ? BRAND.danger : BRAND.success },
                  { label: "Net AV", value: euro(heir.avNetReceived), bold: true },
                ] as any[]).map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${SURFACE.border}` }}>
                    <span style={{ fontSize: "12px", color: BRAND.muted }}>{row.label}</span>
                    <span style={{ fontSize: "12px", fontWeight: row.bold ? 600 : 400, color: row.color || BRAND.navy }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  })()}
  </>)}
</TabsContent>
  );
});

TabSuccession.displayName = "TabSuccession";
export { TabSuccession };
