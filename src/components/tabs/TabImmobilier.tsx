import React from "react";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_GROUPS, PROPERTY_GROUP_COLORS, PROPERTY_RIGHTS, DISPOSITIFS_FISCAUX, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan, DismemberCounterpart } from "../../types/patrimoine";
import { n, euro, pct, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, dispositifsPourNature, safeFilePart, buildExportFileName, isBienMeuble, isSet } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { resolvePropertyRef } from "../../lib/calculs/refs";
// Location meublee (LMNP/LMP) — Lot 1 UI. Imports LECTURE SEULE du moteur :
// aucune fonction de calcul n'est modifiee ici (locationMeublee.ts / ir.ts).
import { computeMicroBicMeuble, amortissementAuto, detectLmp, type SousTypeMeuble } from "../../lib/calculs/locationMeublee";
import { collecteRevenusActiviteFoyer } from "../../lib/calculs/ir";
import refMeuble from "../../data/location-meublee.json";
import { AssetPickerModal } from "../AssetPickerModal";
import { AmortissementModal } from "../AmortissementModal";
import { ProjectionMeubleModal } from "../ProjectionMeubleModal";
import { PvCessionModal } from "../PvCessionModal";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";


// ── TabImmobilier ─────────────────────────────────────────────────────────────────────
const TabImmobilier = React.memo(function TabImmobilier(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, addProperty, updateProperty, removeProperty, addLoan, updateLoan, removeLoan, loanModalPropertyId, setLoanModalPropertyId, ownerOptions, person1, person2, activeDonations, restoreBaseSnapshot } = props;

  // Indices des biens concernés par une donation active
  const donatedPropertyIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (!activeDonations || activeDonations.length === 0) return ids;
    for (const d of activeDonations as any[]) {
      if (d.assetType !== "property") continue;
      const prop = resolvePropertyRef(data.properties, { id: d.assetId, index: d.assetIndex });
      if (prop?.id) ids.add(prop.id);
    }
    return ids;
  }, [activeDonations, data.properties]);

  // Modale d'ajout de bien (pivot UI, symetrique aux placements). Etat local ;
  // focus rendu au bouton d'ouverture a la fermeture. Groupes 100% data-driven.
  const [addPropModalOpen, setAddPropModalOpen] = React.useState(false);
  // Modal "Detail de l'amortissement" (Lot 1bis) : id du bien meuble ouvert.
  const [amortModalPropertyId, setAmortModalPropertyId] = React.useState<string | null>(null);
  // Modal "Projete 10 ans" (Lot 2, ecran seul) : id du bien meuble reel ouvert.
  const [projModalPropertyId, setProjModalPropertyId] = React.useState<string | null>(null);
  // Modal "Plus-value de cession" (Lot 2quater, foncier nu, ecran seul).
  const [pvCessionModalPropertyId, setPvCessionModalPropertyId] = React.useState<string | null>(null);
  const addPropBtnRef = React.useRef<HTMLButtonElement>(null);
  const closeAddPropModal = React.useCallback(() => {
    setAddPropModalOpen(false);
    addPropBtnRef.current?.focus();
  }, []);
  const pickProperty = React.useCallback((type: string) => {
    addProperty(type);
    closeAddPropModal();
  }, [addProperty, closeAddPropModal]);
  const propertyGroups = PROPERTY_GROUPS.map((g) => ({
    label: g.label,
    color: PROPERTY_GROUP_COLORS[g.value],
    items: g.types.map((t) => ({ value: t, label: t })),
  }));

  // ── Location meublee — agregats FOYER (lecture seule, moteur intouche) ──
  // recettes d'un bien meuble = recettesAnnuelles saisi, sinon loyers existants
  // (meme defaut que baseBicMeuble, ir.ts). Sert au constat LMP (niveau dossier)
  // et a l'alerte cotisations tourisme (courte duree).
  const recettesBienMeuble = (p: any) => (isSet(p.recettesAnnuelles) ? n(p.recettesAnnuelles) : n(p.rentGrossAnnual));
  const biensMeubles = (data.properties as any[]).filter((p) => isBienMeuble(p));
  const recettesMeubleesFoyer = biensMeubles.reduce((s, p) => s + recettesBienMeuble(p), 0);
  const recettesTourismeFoyer = biensMeubles
    .filter((p) => p.sousType === "tourisme_classe" || p.sousType === "tourisme_non_classe")
    .reduce((s, p) => s + recettesBienMeuble(p), 0);
  const revenusActiviteFoyer = collecteRevenusActiviteFoyer(data);
  const detectLmpTrue = detectLmp(recettesMeubleesFoyer, revenusActiviteFoyer);
  const lmpProbable = detectLmpTrue || biensMeubles.some((p) => p.type === "LMP");

  return (
<TabsContent value="immobilier" className="space-y-4">
  <div className="flex items-center justify-between gap-4">
    <h3 className="font-semibold" style={{ color: BRAND.navy }}>Immobilier</h3>
    <button
      ref={addPropBtnRef}
      type="button"
      onClick={() => setAddPropModalOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#26428B]"
      style={{ background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" }}
    >
      <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
      Ajouter un bien
    </button>
  </div>

  <AssetPickerModal open={addPropModalOpen} title="Ajouter un bien" groups={propertyGroups} onClose={closeAddPropModal} onPick={pickProperty} />
  {amortModalPropertyId != null && (() => {
    const p = (data.properties as any[]).find((x) => x.id === amortModalPropertyId);
    return p ? <AmortissementModal property={p} updateProperty={updateProperty} onClose={() => setAmortModalPropertyId(null)} /> : null;
  })()}
  {projModalPropertyId != null && (() => {
    const p = (data.properties as any[]).find((x) => x.id === projModalPropertyId);
    return p ? <ProjectionMeubleModal property={p} updateProperty={updateProperty} onClose={() => setProjModalPropertyId(null)} /> : null;
  })()}
  {pvCessionModalPropertyId != null && (() => {
    const p = (data.properties as any[]).find((x) => x.id === pvCessionModalPropertyId);
    return p ? <PvCessionModal property={p} updateProperty={updateProperty} onClose={() => setPvCessionModalPropertyId(null)} /> : null;
  })()}
  {data.properties.length === 0 && <div className="border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>Aucun bien immobilier saisi. Cliquez « Ajouter un bien » pour commencer.</div>}
  {/* ── Constat LMP (niveau dossier) — carte constat, patron severite douce. Aucun
       calcul modifie : lecture de detectLmp / collecteRevenusActiviteFoyer (ir.ts). */}
  {lmpProbable && (
    <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}` }}>
      <span style={{ fontSize: 16, lineHeight: "18px" }} aria-hidden="true">🟠</span>
      <div className="text-xs" style={{ color: BRAND.warning }}>
        <div className="font-bold uppercase tracking-wider mb-1">Statut LMP probable</div>
        <div>
          {detectLmpTrue
            ? `Recettes meublees du foyer ${euro(recettesMeubleesFoyer)} superieures a 23 000 € ET aux revenus d'activite du foyer (${euro(revenusActiviteFoyer)}).`
            : `Un bien est saisi en LMP.`}{" "}
          Consequences non modelisees : deficit imputable au revenu global, cotisations SSI, plus-values professionnelles, exoneration IFI possible (art. 975 V CGI).{" "}
          <strong>Modelisation LMNP conservee (sens conservateur).</strong>
        </div>
      </div>
    </div>
  )}
  {data.properties.map((property, index) => {
    const isDonated = property.id != null && donatedPropertyIds.has(property.id);
    // Dispositifs éligibles pour la nature courante (matrice data-driven). Si un
    // dispositif saisi devient incohérent (nature changée après coup), on le
    // conserve comme option marquée — jamais d'effacement ni de blocage.
    const dispoIds = dispositifsPourNature(property.type);
    const dispoCurrent = property.dispositifFiscal;
    const dispoIncoherent = !!dispoCurrent && !dispoIds.includes(dispoCurrent);
    const dispoOptions: { value: string; label: string }[] = [
      ...DISPOSITIFS_FISCAUX.filter((d) => d.value === "aucun" || dispoIds.includes(d.value)).map((d) => ({ value: d.value as string, label: d.label as string })),
      ...(dispoIncoherent ? [{ value: dispoCurrent as string, label: ((DISPOSITIFS_FISCAUX.find((d) => d.value === dispoCurrent)?.label as string) ?? dispoCurrent) + " (incoherent avec la nature du bien)" }] : []),
    ];
    return (
    <Card key={property.id} className="border " style={{ borderColor: isDonated ? "rgba(227,175,100,0.6)" : SURFACE.border, position: "relative", overflow: "hidden" }}>
      {/* Badge donation active */}
      {isDonated && (
        <div style={{
          background: "linear-gradient(120deg, rgba(227,175,100,0.15) 0%, rgba(251,236,215,0.4) 100%)",
          borderBottom: "0.5px solid rgba(227,175,100,0.4)",
          padding: "8px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>🎁</span>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: BRAND.warning }}>Donation active sur ce bien</span>
              <span style={{ fontSize: "11px", color: BRAND.warning, marginLeft: "8px" }}>— Champs verrouillés</span>
            </div>
          </div>
          <button
            onClick={restoreBaseSnapshot}
            style={{
              fontSize: "11px", fontWeight: 600, color: BRAND.warning,
              background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`,
              borderRadius: "8px", padding: "4px 10px", cursor: "pointer",
            }}>
            Recharger la situation de base →
          </button>
        </div>
      )}
      {/* Overlay semi-transparent hachuré pour bloquer les clics si donation active — textes restent lisibles */}
      {isDonated && (
        <div style={{
          position: "absolute", inset: 0,
          top: "37px",
          zIndex: 10,
          background: "rgba(255,255,255,0.45)",
          backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(200,195,185,0.18) 8px, rgba(200,195,185,0.18) 9px)",
          cursor: "not-allowed",
          borderRadius: "0 0 14px 14px",
        }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        />
      )}
      <CardContent className="p-4 space-y-3">
        {/* Identité + suppression */}
        <div className="flex items-end gap-2">
          <div className="flex-1 grid gap-2 grid-cols-[1.4fr_1.6fr_1fr_1fr]">
            <Field label="Nom"><Input value={property.name} onChange={(e) => updateProperty(property.id, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
            <Field label="Nature">
              <Select value={property.type} onValueChange={(v) => updateProperty(property.id, "type", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Propriétaire">
              <Select value={property.ownership} onValueChange={(v) => updateProperty(property.id, "ownership", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ownerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Droit">
              <Select value={property.propertyRight} onValueChange={(v) => updateProperty(property.id, "propertyRight", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_RIGHTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          {n(property.rentGrossAnnual) > 0 && n(property.value) > 0 && (() => {
            const rdt = Math.round(n(property.rentGrossAnnual) / n(property.value) * 1000) / 10;
            return (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mb-0.5"
                style={{ background: rdt >= 8 ? BRAND.successBg : BRAND.cream,
                         color: rdt >= 8 ? BRAND.success : BRAND.goldText,
                         border: `1px solid ${rdt >= 8 ? BRAND.successBorder : BRAND.warningBorder}` }}>
                {pct(rdt / 100, 1)} brut
              </span>
            );
          })()}
          <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => removeProperty(property.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        {/* ── Dispositif fiscal (natures locatives éligibles) — SAISIE SEULE, aucun
             calcul branché (Lot D). Pattern conditionnel impératif (comme démembrement /
             indivision). Bascule vers « Aucun » : masque les sous-champs SANS effacer
             les données (barrière douce ; onChange ne touche que dispositifFiscal). */}
        {dispoIds.length > 0 && (
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          <Field label="Dispositif fiscal">
            <Select value={property.dispositifFiscal || "aucun"} onValueChange={(v) => updateProperty(property.id, "dispositifFiscal", v === "aucun" ? "" : v)}>
              <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{dispoOptions.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {(property.dispositifFiscal === "pinel" || property.dispositifFiscal === "pinelPlus" || property.dispositifFiscal === "denormandie") && (
            <>
              <Field label="Année d'investissement"><Input value={property.dispositifAnnee || ""} onChange={(e) => updateProperty(property.id, "dispositifAnnee", e.target.value)} className="rounded-xl h-8 text-sm" inputMode="numeric" /></Field>
              <MoneyField label="Base (prix de revient, €)" tooltip="Prix de revient retenu pour la réduction (plafonné par la réglementation). Montant SAISI, pas la valeur actuelle du bien." value={property.dispositifBase || ""} onChange={(e) => updateProperty(property.id, "dispositifBase", e.target.value)} compact />
              <Field label="Engagement">
                <Select value={property.dispositifEngagementAns || ""} onValueChange={(v) => updateProperty(property.id, "dispositifEngagementAns", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="6">6 ans</SelectItem><SelectItem value="9">9 ans</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Prorogation">
                <Select value={property.dispositifProrogation || ""} onValueChange={(v) => updateProperty(property.id, "dispositifProrogation", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="0">Aucune</SelectItem><SelectItem value="1">1re période</SelectItem><SelectItem value="2">2e période</SelectItem></SelectContent>
                </Select>
              </Field>
            </>
          )}
          {property.dispositifFiscal === "censiBouvard" && (
            <>
              <Field label="Année"><Input value={property.dispositifAnnee || ""} onChange={(e) => updateProperty(property.id, "dispositifAnnee", e.target.value)} className="rounded-xl h-8 text-sm" inputMode="numeric" /></Field>
              <MoneyField label="Base (€, engagement 9 ans)" tooltip="Censi-Bouvard : engagement de location de 9 ans. Base = prix de revient plafonné (SAISI)." value={property.dispositifBase || ""} onChange={(e) => updateProperty(property.id, "dispositifBase", e.target.value)} compact />
            </>
          )}
          {property.dispositifFiscal === "locavantages" && (
            <>
              <Field label="Année prise d'effet" tooltip="Année de prise d'effet de la convention ANAH (Loc'Avantages)."><Input value={property.dispositifAnnee || ""} onChange={(e) => updateProperty(property.id, "dispositifAnnee", e.target.value)} className="rounded-xl h-8 text-sm" inputMode="numeric" /></Field>
              <Field label="Niveau de loyer">
                <Select value={property.dispositifNiveauLoyer || ""} onValueChange={(v) => updateProperty(property.id, "dispositifNiveauLoyer", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="loc1">Loc1</SelectItem><SelectItem value="loc2">Loc2</SelectItem><SelectItem value="loc3">Loc3</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Intermédiation" tooltip="Intermédiation locative : gestion confiée à un organisme agréé (bonus de réduction Loc'Avantages).">
                <label className="flex items-center gap-2 h-8 text-sm">
                  <input type="checkbox" checked={!!property.dispositifIntermediation} onChange={(e) => updateProperty(property.id, "dispositifIntermediation", e.target.checked)} className="h-4 w-4 rounded accent-[#0F172A]" />
                  <span style={{ color: BRAND.muted }}>Oui</span>
                </label>
              </Field>
            </>
          )}
          {property.dispositifFiscal === "jeanbrunRelanceLogement" && (
            <>
              <Field label="Année d'acquisition"><Input value={property.dispositifAnnee || ""} onChange={(e) => updateProperty(property.id, "dispositifAnnee", e.target.value)} className="rounded-xl h-8 text-sm" inputMode="numeric" /></Field>
              <MoneyField label="Base (prix + travaux, €)" tooltip="Prix d'acquisition, majoré des travaux le cas échéant (ancien réhabilité). Montant SAISI." value={property.dispositifBase || ""} onChange={(e) => updateProperty(property.id, "dispositifBase", e.target.value)} compact />
              <Field label="Neuf / Ancien réhabilité">
                <Select value={property.dispositifNeufAncien || ""} onValueChange={(v) => updateProperty(property.id, "dispositifNeufAncien", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="neuf">Neuf</SelectItem><SelectItem value="ancien">Ancien réhabilité</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Niveau de loyer">
                <Select value={property.dispositifNiveauLoyer || ""} onValueChange={(v) => updateProperty(property.id, "dispositifNiveauLoyer", v)}>
                  <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="intermediaire">Intermédiaire</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="tresSocial">Très social</SelectItem></SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
        )}
        {/* Valeurs financières — grille adaptative, sans divs vides */}
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
          <MoneyField label={property.propertyRight === "full" ? "Valeur estimée" : "Valeur PP"} tooltip="Valeur vénale actuelle du bien. En pleine propriété, c'est la valeur retenue pour l'IFI et la succession. En démembrement, seule la valeur de la pleine propriété est saisie ici." value={property.value} onChange={(e) => updateProperty(property.id, "value", e.target.value)} compact />
          {property.propertyRight !== "full" && (() => {
            const familyOptions = [
              { key: "person1", label: person1, birthDate: data.person1BirthDate, relation: "conjoint" },
              { key: "person2", label: person2, birthDate: data.person2BirthDate, relation: "conjoint" },
              ...(data.childrenData || []).map((c: any, ci: number) => ({
                key: `child_${ci}`,
                label: `${c.firstName} ${c.lastName}`.trim() || `Enfant ${ci + 1}`,
                birthDate: c.birthDate,
                relation: "enfant",
              })),
              { key: "other", label: "Autre personne", birthDate: "", relation: "tiers" },
            ];
            const isNP = property.propertyRight === "bare";
            const isCommon = property.ownership === "common" || property.ownership === "indivision";

            // Helper : sélecteur contrepartie pour une personne donnée
            const renderContrepartie = (
              personLabel: string,
              currentKey: string,
              currentBirthDate: string,
              ownerBirthDate: string,
              onSelect: (key: string, bd: string, rel: string, name: string) => void,
              onBirthDate: (bd: string) => void,
              rightLabel: string,
              onRight: (v: string) => void,
              currentRight: string,
            ) => {
              const sel = familyOptions.find(f => f.key === currentKey);
              const usufBD = currentRight === "bare"
                ? (sel?.birthDate || currentBirthDate || "")
                : ownerBirthDate;
              const usufAge = usufBD ? getAgeFromBirthDate(usufBD) : null;
              const demer = usufAge !== null ? getDemembrementPercentages(usufAge) : null;
              return (
                <div style={{ flex: 1, minWidth: "220px", borderRadius: "12px", border: "0.5px solid rgba(81,106,199,0.2)", padding: "10px 12px", background: "rgba(81,106,199,0.03)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{personLabel}</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "0 0 auto", minWidth: "130px" }}>
                      <Field label="Droit">
                        <Select value={currentRight} onValueChange={onRight}>
                          <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Pleine propriété</SelectItem>
                            <SelectItem value="bare">Nue-propriété</SelectItem>
                            <SelectItem value="usufruct">Usufruit</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {currentRight !== "full" && (
                      <div style={{ flex: 1, minWidth: "160px" }}>
                        <Field label={currentRight === "bare" ? "Usufruitier" : "Nu-propriétaire"}>
                          <Select value={currentKey || ""} onValueChange={(v) => {
                            const found = familyOptions.find(f => f.key === v);
                            onSelect(v, found?.birthDate || "", found?.relation || "tiers", found?.label || "");
                          }}>
                            <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                            <SelectContent>
                              {familyOptions.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    )}
                    {currentRight !== "full" && currentKey === "other" && (
                      <div style={{ flex: "0 0 auto" }}>
                        <Field label="Date naissance">
                          <DateFr value={currentBirthDate || ""} onChange={(iso) => onBirthDate(iso || "")} className="rounded-xl h-8 text-sm w-36" />
                        </Field>
                      </div>
                    )}
                    {currentRight !== "full" && demer && (
                      <div style={{ fontSize: "11px", color: BRAND.sky, background: "rgba(81,106,199,0.08)", borderRadius: "8px", padding: "4px 8px", whiteSpace: "nowrap", alignSelf: "flex-end", marginBottom: "2px" }}>
                        {usufAge} ans · {currentRight === "bare" ? `NP=${Math.round(demer.nuePropriete*100)}%` : `US=${Math.round(demer.usufruct*100)}%`}
                      </div>
                    )}
                    {currentRight !== "full" && !demer && (
                      <div style={{ fontSize: "11px", color: "#d97706", alignSelf: "flex-end", marginBottom: "4px" }}>⚠️ Âge manquant</div>
                    )}
                  </div>
                </div>
              );
            };

            // Helper pour ajouter/modifier/supprimer une contrepartie dans la liste
            const mkDismember = (pKey: "dismemberP1" | "dismemberP2", current: any, right: string, counterparts: DismemberCounterpart[]) =>
              updateProperty(property.id, pKey, { propertyRight: right, counterparts });

            if (isCommon) {
              const defaultRight = property.propertyRight;
              const dp1 = { propertyRight: property.dismemberP1?.propertyRight || defaultRight, counterparts: property.dismemberP1?.counterparts || [] };
              const dp2 = { propertyRight: property.dismemberP2?.propertyRight || defaultRight, counterparts: property.dismemberP2?.counterparts || [] };

              const renderPersonBlock = (
                pLabel: string, pKey: "dismemberP1" | "dismemberP2",
                dp: { propertyRight: string; counterparts: DismemberCounterpart[] },
                ownerBD: string
              ) => {
                const pRight = dp.propertyRight || "full";
                const safeCounterparts = dp.counterparts || [];
                // Pour le barème : si NP → âge du 1er usufruitier ; si US → âge du owner
                const firstCp = safeCounterparts[0];
                const usufBD = pRight === "bare" ? (firstCp?.birthDate || "") : ownerBD;
                const usufAge = usufBD ? getAgeFromBirthDate(usufBD) : null;
                const demer = usufAge !== null ? getDemembrementPercentages(usufAge) : null;

                return (
                  <div style={{ flex: 1, minWidth: "240px", borderRadius: "12px", border: "0.5px solid rgba(81,106,199,0.2)", padding: "12px", background: "rgba(81,106,199,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.8px" }}>{pLabel}</div>
                      {demer && (
                        <div style={{ fontSize: "11px", color: BRAND.sky, background: "rgba(81,106,199,0.1)", borderRadius: "6px", padding: "2px 8px" }}>
                          {usufAge} ans · US={Math.round(demer.usufruct*100)}% · NP={Math.round(demer.nuePropriete*100)}%
                        </div>
                      )}
                    </div>
                    {/* Droit */}
                    <div style={{ marginBottom: "10px" }}>
                      <Field label="Droit de propriété">
                        <Select value={pRight} onValueChange={(v) => mkDismember(pKey, dp, v, dp.counterparts)}>
                          <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Pleine propriété</SelectItem>
                            <SelectItem value="bare">Nue-propriété</SelectItem>
                            <SelectItem value="usufruct">Usufruit</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {/* Contreparties */}
                    {pRight !== "full" && (
                      <div className="space-y-2">
                        <div style={{ fontSize: "10px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {pRight === "bare" ? "Usufruitier(s)" : "Nu-propriétaire(s)"}
                        </div>
                        {safeCounterparts.map((cp, ci) => (
                          <div key={cp.id} style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                            <div style={{ flex: 2 }}>
                              <Select value={cp.key || ""} onValueChange={(v) => {
                                const found = familyOptions.find(f => f.key === v);
                                const updated = dp.counterparts.map((c, i) => i === ci ? { ...c, key: v, birthDate: found?.birthDate || c.birthDate, relation: found?.relation || "tiers", name: found?.label || c.name } : c);
                                mkDismember(pKey, dp, pRight, updated);
                              }}>
                                <SelectTrigger className="rounded-xl h-7 text-xs"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                                <SelectContent>
                                  {familyOptions.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {cp.key === "other" && (
                              <DateFr value={cp.birthDate} onChange={(iso) => {
                                const updated = dp.counterparts.map((c, i) => i === ci ? { ...c, birthDate: iso || "" } : c);
                                mkDismember(pKey, dp, pRight, updated);
                              }} className="rounded-xl h-7 text-xs w-32" />
                            )}
                            {safeCounterparts.length > 1 && (
                              <input type="number" placeholder="%" min="0" max="100" value={cp.sharePercent}
                                onChange={(e) => {
                                  const updated = dp.counterparts.map((c, i) => i === ci ? { ...c, sharePercent: e.target.value } : c);
                                  mkDismember(pKey, dp, pRight, updated);
                                }}
                                style={{ width: "50px", borderRadius: "8px", padding: "0 6px", height: "28px", fontSize: "12px" }}
                              />
                            )}
                            <button onClick={() => {
                              mkDismember(pKey, dp, pRight, safeCounterparts.filter((_, i) => i !== ci));
                            }} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "14px", paddingBottom: "2px" }}>✕</button>
                          </div>
                        ))}
                        <button onClick={() => {
                          const newCp: DismemberCounterpart = { id: Date.now().toString(), key: "", birthDate: "", relation: "enfant", name: "", sharePercent: "" };
                          mkDismember(pKey, dp, pRight, [...safeCounterparts, newCp]);
                        }} style={{ fontSize: "11px", color: BRAND.sky, background: "none", border: "0.5px dashed rgba(81,106,199,0.4)", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", marginTop: "2px" }}>
                          + {pRight === "bare" ? "Usufruitier" : "Nu-propriétaire"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "11px", color: BRAND.sky, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>Démembrement par personne</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {renderPersonBlock(person1, "dismemberP1", dp1, data.person1BirthDate)}
                    {renderPersonBlock(person2, "dismemberP2", dp2, data.person2BirthDate)}
                  </div>
                </div>
              );
            }

            // Mode simple — bien propre
            const selectedPerson = familyOptions.find(f => f.key === property.counterpartKey);
            const ownerBirthDate = property.ownership === "person2" ? data.person2BirthDate : data.person1BirthDate;
            const usufructBirthDate = isNP ? (selectedPerson?.birthDate || property.counterpartBirthDate || "") : ownerBirthDate;
            const counterpartAge = usufructBirthDate ? getAgeFromBirthDate(usufructBirthDate) : null;
            const demer = counterpartAge !== null ? getDemembrementPercentages(counterpartAge) : null;
            return (
              <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
                <div style={{ minWidth: "200px", flex: "1" }}>
                  <Field label={isNP ? "Usufruitier (contrepartie NP)" : "Nu-propriétaire (contrepartie US)"} tooltip="Personne qui détient l'autre partie du bien.">
                    <Select value={property.counterpartKey || ""} onValueChange={(v) => {
                      const found = familyOptions.find(f => f.key === v);
                      updateProperty(property.id, "counterpartKey", v);
                      updateProperty(property.id, "counterpartBirthDate", found?.birthDate || "");
                      updateProperty(property.id, "counterpartRelation", found?.relation || "tiers");
                      updateProperty(property.id, "counterpartName", found?.label || "");
                    }}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>
                        {familyOptions.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {property.counterpartKey === "other" && (
                  <div style={{ minWidth: "160px", flex: "1" }}>
                    <Field label="Date de naissance">
                      <DateFr value={property.counterpartBirthDate || ""} onChange={(iso) => updateProperty(property.id, "counterpartBirthDate", iso || "")} className="rounded-xl h-8 text-sm" />
                    </Field>
                  </div>
                )}
                {demer && (
                  <div className="text-xs rounded-xl px-3 py-1.5 self-end mb-0.5" style={{ background: "rgba(81,106,199,0.07)", color: BRAND.sky, whiteSpace: "nowrap" }}>
                    {isNP ? "Usufruitier" : "Vous"} · {counterpartAge} ans · {isNP ? `NP = ${Math.round(demer.nuePropriete * 100)}%` : `US = ${Math.round(demer.usufruct * 100)}%`}
                  </div>
                )}
                {!demer && (
                  <div className="text-xs text-amber-600 self-end mb-1">
                    {isNP && !property.counterpartKey ? "⚠️ Sélectionnez l'usufruitier" : "⚠️ Date de naissance manquante"}
                  </div>
                )}
              </div>
            );
          })()}
          {propertyNeedsPropertyTax(property.type) && <MoneyField label="Taxe foncière/an" tooltip="Montant annuel de la taxe foncière. Déductible des revenus fonciers en régime réel." value={property.propertyTaxAnnual} onChange={(e) => updateProperty(property.id, "propertyTaxAnnual", e.target.value)} compact />}
          {/* Meuble (LMNP/LMP) : loyer + autres charges saisis dans le bloc "Location
              meublee" (recettes / charges reelles), source unique - masques ici. */}
          {propertyNeedsRent(property.type) && !isBienMeuble(property) && <MoneyField label="Loyer brut/an" tooltip="Total des loyers encaissés sur l'année, avant déduction des charges. Utilisé pour calculer le revenu foncier net imposable." value={property.rentGrossAnnual} onChange={(e) => updateProperty(property.id, "rentGrossAnnual", e.target.value)} compact />}
          {propertyNeedsInsurance(property.type) && <MoneyField label="Assurance/an" tooltip="Prime d'assurance habitation annuelle du bien locatif. Déductible des revenus fonciers en régime réel." value={property.insuranceAnnual} onChange={(e) => updateProperty(property.id, "insuranceAnnual", e.target.value)} compact />}
          {propertyNeedsWorks(property.type) && <MoneyField label="Travaux/an" tooltip="Dépenses de travaux d'entretien et de réparation annuelles. Déductibles des revenus fonciers en régime réel. Les travaux de construction ou d'agrandissement ne sont pas déductibles." value={property.worksAnnual} onChange={(e) => updateProperty(property.id, "worksAnnual", e.target.value)} compact />}
          {propertyNeedsRent(property.type) && !isBienMeuble(property) && <MoneyField label="Autres charges/an" tooltip="Autres charges déductibles : frais de gestion locative, charges de copropriété non récupérables, frais comptables, etc." value={property.otherChargesAnnual} onChange={(e) => updateProperty(property.id, "otherChargesAnnual", e.target.value)} compact />}
          {/* ── Bloc crédit ── */}
          </div>
          {/* ── Plus-value de cession (Lot 2quater) — foncier nu du groupe locatif +
               residence secondaire. RP exoneree (art. 150 U II-1). Ecran seul. ── */}
          {["Location nue", "SCPI", "Résidence secondaire"].includes(property.type) && (
            <div className="mt-1">
              <button type="button" onClick={() => setPvCessionModalPropertyId(property.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B6914]" style={{ background: "rgba(196,151,61,0.1)", borderColor: "rgba(196,151,61,0.35)", color: BRAND.goldText }}>
                📊 Plus-value de cession
              </button>
            </div>
          )}
          {property.type === "Résidence principale" && (
            <div className="text-[11px] mt-1 font-medium" style={{ color: BRAND.success }}>✓ Cession exonérée de plus-value (résidence principale, art. 150 U II-1).</div>
          )}
          {/* ── Location meublee (LMNP/LMP) — SAISIE SEULE. Tout le calcul vient du
               moteur (locationMeublee.ts / ir.ts) : ici on ne fait que lire (affichage
               live) et ecrire les champs Property. Le regime effectif est le MIROIR de
               baseBicMeuble (micro de droit seulement si eligible, sinon reel). */}
          {isBienMeuble(property) && (() => {
            const recettes = recettesBienMeuble(property);
            const sousType = (property.sousType || "longue_duree") as SousTypeMeuble;
            const seuilMicro = sousType === "tourisme_non_classe" ? refMeuble.microBic.tourismeNonClasse.seuil : refMeuble.microBic.residuel.seuil;
            const micro = computeMicroBicMeuble(recettes, sousType);
            // Miroir EXACT de baseBicMeuble (ir.ts) — ne pas diverger.
            const regimeChoisi = property.regimeMeuble || (recettes <= seuilMicro ? "micro" : "reel");
            const microChoisiSurSeuil = regimeChoisi === "micro" && !micro.eligible;
            const regimeEffectif = regimeChoisi === "micro" && micro.eligible ? "micro" : "reel";
            const loyersRepris = !isSet(property.recettesAnnuelles) && n(property.rentGrossAnnual) > 0;
            // Amortissement auto (barriere douce : '0' saisi = 0 ; vide = auto).
            const partTerrainFrac = isSet(property.partTerrain) ? n(property.partTerrain) : refMeuble.amortissement.partTerrainDefaut;
            const hasOverrides = !!property.amortissementComposants && Object.keys(property.amortissementComposants).length > 0;
            const autoAmort = isSet(property.prixAcquisition) ? amortissementAuto(n(property.prixAcquisition), partTerrainFrac, n(property.valeurMobilier), property.amortissementComposants) : null;
            const amortSaisi = isSet(property.amortissementAnnuelManuel);
            const COMPO_LABEL: Record<string, string> = { grosOeuvre: "Gros oeuvre", toiture: "Toiture", installationsTechniques: "Installations techniques", facadeEtancheite: "Facade / etancheite", agencements: "Agencements" };
            const amortTooltip = autoAmort
              ? "Methode par composants, durees d'usage BOFiP - convention indicative, ajustable. " +
                autoAmort.detail.map((d) => `${COMPO_LABEL[d.composant] || d.composant} ${euro(d.dotation)}`).join(" · ") +
                (autoAmort.mobilier > 0 ? ` · Mobilier ${euro(autoAmort.mobilier)}/an (${refMeuble.amortissement.dureeMobilier} ans)` : "") +
                `. Total ${euro(autoAmort.total)}/an. '0' saisi = aucun amortissement ; vide = ce calcul auto.`
              : "Saisissez le prix d'acquisition pour le calcul automatique par composants. '0' = aucun amortissement voulu ; vide = auto.";
            return (
              <div className="mt-2 rounded-xl p-3 space-y-3" style={{ background: "rgba(196,151,61,0.05)", border: `1px solid ${BRAND.warningBorder}` }}>
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: BRAND.goldText }}>
                  Location meublee (BIC)
                  {property.type === "LMP" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: BRAND.cream, color: BRAND.goldText, border: `1px solid ${BRAND.warningBorder}` }}>LMP</span>}
                </div>
                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(165px,1fr))]">
                  <Field label="Type de location" tooltip="Chambres d'hotes = regime du tourisme classe (seuil 83 600 €, abattement 50 %).">
                    <Select value={sousType} onValueChange={(v) => updateProperty(property.id, "sousType", v)}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="longue_duree">Longue duree</SelectItem>
                        <SelectItem value="tourisme_classe">Meuble de tourisme classe</SelectItem>
                        <SelectItem value="tourisme_non_classe">Meuble de tourisme non classe</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div>
                    <MoneyField label="Recettes annuelles" tooltip="Recettes locatives meublees encaissees sur l'annee. Preremplies depuis le loyer saisi ; modifiables." value={isSet(property.recettesAnnuelles) ? property.recettesAnnuelles : (n(property.rentGrossAnnual) > 0 ? property.rentGrossAnnual : "")} onChange={(e) => updateProperty(property.id, "recettesAnnuelles", e.target.value)} compact />
                    {loyersRepris && <div className="text-[10px] mt-0.5" style={{ color: BRAND.muted }}>↩ reprise des loyers saisis</div>}
                  </div>
                  <div>
                    <Field label="Regime fiscal" tooltip="Micro-BIC : abattement forfaitaire. Reel : charges reelles + amortissement. Au-dessus du seuil, le reel s'applique de plein droit (art. 50-0 CGI).">
                      <Select value={regimeChoisi} onValueChange={(v) => updateProperty(property.id, "regimeMeuble", v)}>
                        <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="micro">Micro-BIC</SelectItem>
                          <SelectItem value="reel">Reel</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {microChoisiSurSeuil && <div className="text-[10px] mt-0.5 font-semibold" style={{ color: BRAND.warning }}>Regime applique : reel</div>}
                  </div>
                </div>
                {/* Alerte 1 : seuil micro depasse (bien) */}
                {microChoisiSurSeuil && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
                    <span aria-hidden="true">🟠</span>
                    <span>Seuil micro-BIC depasse ({euro(recettes)} &gt; {euro(seuilMicro)}) — le regime reel s'applique de plein droit (art. 50-0 CGI).</span>
                  </div>
                )}
                {/* Micro : lecture seule abattement + base estimee (live) */}
                {regimeEffectif === "micro" && (
                  <div className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(196,151,61,0.07)", color: BRAND.muted }}>
                    Abattement {sousType === "tourisme_non_classe" ? "30" : "50"} % : <strong>− {euro(micro.abattement)}</strong> · Base imposable estimee : <strong style={{ color: BRAND.navy }}>{euro(micro.base)}</strong> <span className="opacity-70">(+ PS 18,6 %)</span>
                  </div>
                )}
                {/* Reel : charges + bloc amortissement */}
                {regimeEffectif === "reel" && (
                  <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                    <MoneyField label="Charges reelles/an" tooltip="Charges deductibles hors amortissement ET hors taxe fonciere / assurance saisies ci-dessus (comptees a part, pour eviter le double-compte) : interets d'emprunt, gestion, copropriete non recuperable, comptable..." value={property.chargesReelles || ""} onChange={(e) => updateProperty(property.id, "chargesReelles", e.target.value)} compact />
                    <MoneyField label="Prix d'acquisition" tooltip="Prix de revient de l'immeuble, base de l'amortissement par composants (hors terrain)." value={property.prixAcquisition || ""} onChange={(e) => updateProperty(property.id, "prixAcquisition", e.target.value)} compact />
                    <Field label="Part terrain (%)" tooltip="Fraction non amortissable du prix (terrain). Defaut 15 %. Saisie en pourcentage.">
                      <Input value={isSet(property.partTerrain) ? String(Math.round(n(property.partTerrain) * 1000) / 10) : ""} placeholder="15" onChange={(e) => { const v = e.target.value.trim(); updateProperty(property.id, "partTerrain", v === "" ? "" : String(n(v) / 100)); }} className="rounded-xl h-8 text-sm" style={{ fontWeight: 700 }} inputMode="decimal" />
                    </Field>
                    <MoneyField label="Valeur mobilier" tooltip={`Valeur du mobilier, amorti lineairement sur ${refMeuble.amortissement.dureeMobilier} ans.`} value={property.valeurMobilier || ""} onChange={(e) => updateProperty(property.id, "valeurMobilier", e.target.value)} compact />
                    <div>
                      <MoneyField label="Amortissement annuel" tooltip={amortTooltip} value={amortSaisi ? property.amortissementAnnuelManuel : (autoAmort ? String(Math.round(autoAmort.total * 100) / 100) : "")} onChange={(e) => updateProperty(property.id, "amortissementAnnuelManuel", e.target.value)} compact />
                      <div className="flex items-center gap-2 mt-0.5">
                        {(amortSaisi || autoAmort) && (
                          <span className="text-[10px] font-semibold" style={{ color: amortSaisi ? BRAND.sky : hasOverrides ? BRAND.sky : BRAND.success }}>
                            {amortSaisi ? "✎ saisi" : hasOverrides ? "⚙ ajuste" : "⚙ calcule"}
                          </span>
                        )}
                        {isSet(property.prixAcquisition) && (
                          <button type="button" onClick={() => setAmortModalPropertyId(property.id)} className="text-[10px] font-semibold underline" style={{ color: BRAND.sky }}>Detail</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Bouton projete 10 ans (Lot 2) — visible au reel resolu, ecran seul. */}
                {regimeEffectif === "reel" && (
                  <div>
                    <button type="button" onClick={() => setProjModalPropertyId(property.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#26428B]" style={{ background: "rgba(38,66,139,0.08)", borderColor: "rgba(38,66,139,0.25)", color: BRAND.sky }}>
                      📈 Projection sur 10 ans
                    </button>
                  </div>
                )}
                {/* Garde-fou conformite : Censi-Bouvard exclut l'amortissement sur la
                    fraction ayant ouvert droit a la reduction (art. 199 sexvicies VII).
                    Alerte douce, ZERO impact calcul : le CGP ajuste via Detail / manuel. */}
                {regimeEffectif === "reel" && property.dispositifFiscal === "censiBouvard" && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
                    <span aria-hidden="true">🟠</span>
                    <span>Censi-Bouvard : l'amortissement est exclu sur la fraction du prix ayant ouvert droit a la reduction (art. 199 sexvicies VII) — ajustez le plan via « Detail » ou le champ manuel.</span>
                  </div>
                )}
                {/* Alerte 3 : cotisations sociales tourisme courte duree (foyer) */}
                {(sousType === "tourisme_classe" || sousType === "tourisme_non_classe") && recettesTourismeFoyer > refMeuble.lmp.seuilRecettes && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
                    <span aria-hidden="true">🟠</span>
                    <span>Affiliation sociale des loueurs de courte duree (art. L611-1 CSS) : cotisations sociales non modelisees.</span>
                  </div>
                )}
              </div>
            );
          })()}
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
                    setLoanModalPropertyId(property.id);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium border transition-colors hover:opacity-90"
                  style={{
                    background: loanCount > 0 ? "rgba(38,66,139,0.08)" : "rgba(229,231,235,0.5)",
                    borderColor: loanCount > 0 ? "rgba(38,66,139,0.25)" : SURFACE.border,
                    color: loanCount > 0 ? BRAND.sky : BRAND.muted,
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
              <MoneyField label={`% ${person1}`} tooltip={`Quote-part de propriété de ${person1} dans l'indivision. La somme des deux parts (foyer + co-indivisaires extérieurs s'il y en a) doit égaler 100%.`} value={property.indivisionShare1} onChange={(e) => updateProperty(property.id, "indivisionShare1", e.target.value)} compact />
              <MoneyField label={`% ${person2}`} tooltip={`Quote-part de propriété de ${person2} dans l'indivision. La somme des deux parts (foyer + co-indivisaires extérieurs s'il y en a) doit égaler 100%.`} value={property.indivisionShare2} onChange={(e) => updateProperty(property.id, "indivisionShare2", e.target.value)} compact />
            </>
          )}
        </div>

        {/* ─── Co-propriétaires / co-associés extérieurs au foyer ────────
             Pertinent pour : indivision (partagée avec tiers) ou SCI
             familiale étendue / SCI avec amis / SCI avec associés. */}
        {(property.ownership === "indivision" || property.type === "SCI IR" || property.type === "SCI IS") && (() => {
          const externals = property.externalShares || [];
          const s1 = n(property.indivisionShare1);
          const s2 = n(property.indivisionShare2);
          const sExt = externals.reduce((sum, e) => sum + n(e.sharePercent), 0);
          const totalSomme = s1 + s2 + sExt;
          const ecartSomme = 100 - totalSomme;
          const addExternal = () => {
            const next = [...externals, { id: `ext-${Date.now()}`, name: "", relation: "Associé", sharePercent: "0" }];
            updateProperty(property.id, "externalShares", next);
          };
          const updateExternal = (extIdx: number, field: "name" | "relation" | "sharePercent", value: string) => {
            const next = externals.map((e, i) => i === extIdx ? { ...e, [field]: value } : e);
            updateProperty(property.id, "externalShares", next);
          };
          const removeExternal = (extIdx: number) => {
            const next = externals.filter((_, i) => i !== extIdx);
            updateProperty(property.id, "externalShares", next);
          };
          return (
            <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(81,106,199,0.04)", border: `1px solid rgba(81,106,199,0.15)` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.sky }}>
                  Co-propriétaires extérieurs au foyer
                </div>
                <Button onClick={addExternal} variant="outline" className="h-7 rounded-lg px-2 text-xs">
                  <Plus className="mr-1 h-3 w-3" />Ajouter
                </Button>
              </div>
              {externals.length === 0 ? (
                <div className="text-xs italic" style={{ color: BRAND.mutedLight }}>
                  Ajoutez des co-indivisaires ou co-associés de SCI extérieurs à votre foyer (frère, ami, partenaire d'affaires…). Leurs parts sont déclarées par eux, pas par votre foyer.
                </div>
              ) : (
                <div className="space-y-2">
                  {externals.map((ext, extIdx) => (
                    <div key={ext.id} className="grid gap-2 items-end" style={{ gridTemplateColumns: "2fr 1.4fr 80px 32px" }}>
                      <Field label={extIdx === 0 ? "Nom complet" : undefined}>
                        <Input value={ext.name} onChange={(e) => updateExternal(extIdx, "name", e.target.value)} placeholder="ex: Jean Martin" className="h-8 text-sm rounded-lg" />
                      </Field>
                      <Field label={extIdx === 0 ? "Relation" : undefined}>
                        <Select value={ext.relation} onValueChange={(v) => updateExternal(extIdx, "relation", v)}>
                          <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Associé">Associé / Partenaire d'affaires</SelectItem>
                            <SelectItem value="Frère/Sœur">Frère / Sœur</SelectItem>
                            <SelectItem value="Parent">Parent (père / mère)</SelectItem>
                            <SelectItem value="Cousin">Cousin / Cousine</SelectItem>
                            <SelectItem value="Oncle/Tante">Oncle / Tante</SelectItem>
                            <SelectItem value="Neveu/Nièce">Neveu / Nièce</SelectItem>
                            <SelectItem value="Ami">Ami</SelectItem>
                            <SelectItem value="Ex-conjoint">Ex-conjoint</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={extIdx === 0 ? "% parts" : undefined}>
                        <Input type="number" value={ext.sharePercent} onChange={(e) => updateExternal(extIdx, "sharePercent", e.target.value)} placeholder="0" className="h-8 text-sm rounded-lg text-right" />
                      </Field>
                      <Button onClick={() => removeExternal(extIdx)} variant="outline" className="h-8 w-8 rounded-lg p-0" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" style={{ color: BRAND.danger }} />
                      </Button>
                    </div>
                  ))}
                  {/* Synthèse somme */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t" style={{ borderColor: "rgba(81,106,199,0.15)" }}>
                    <span className="text-xs" style={{ color: BRAND.muted }}>
                      Somme : <strong style={{ color: BRAND.navy }}>{(s1 + s2).toFixed(0)} % foyer + {sExt.toFixed(0)} % extérieurs = {totalSomme.toFixed(0)} %</strong>
                    </span>
                    {Math.abs(ecartSomme) > 0.5 && (
                      <span className="text-xs font-bold" style={{ color: ecartSomme > 0 ? BRAND.warning : BRAND.danger }}>
                        {ecartSomme > 0 ? `⚠ Manque ${ecartSomme.toFixed(0)} %` : `⚠ Dépasse de ${(-ecartSomme).toFixed(0)} %`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
    );
  })}
</TabsContent>

  );
});

TabImmobilier.displayName = "TabImmobilier";
export { TabImmobilier };
