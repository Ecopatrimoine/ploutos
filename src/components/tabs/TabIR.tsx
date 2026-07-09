import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardAccentTop } from "../CardAccentTop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, FileText, Database, AlertTriangle, BarChart3, Lightbulb } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA, SEUIL_MICRO_FONCIER } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, pct, plur, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName, labelDispositifReduction } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge, EmptyState } from "../shared";
import { KpiRoiCard, SectionAccordion, type KpiRoiLine } from "../analysis";
import { buildIrRoiCard } from "../../lib/analysis/irPresentation";
import { irEstVide } from "../../lib/gardefous";
import { computeTmiView } from "../../lib/calculs/tmiEffective";


// ── TabIR ─────────────────────────────────────────────────────────────────────
const TabIR = React.memo(function TabIR(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, ir, irOptions, setIrOptions, concubinPerson, setConcubinPerson, setChargesDialogOpen, onGoToCollecte, person1, person2 } = props;

  // Lot C (mirror B2/B3) — restitution « taux marginal réel » via le helper de vue PARTAGÉ
  // (même source que le PDF, aucun recalcul local). isCouple = marié/pacsé (baseParts).
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const tmiView = computeTmiView(ir, isCouple);
  // Lot 9 C1 — etat vide si AUCUN revenu saisi (barriere douce, non bloquante).
  const irVide = irEstVide(ir);

  // Lot 10b — carte-roi « Impôt total du foyer » : décomposition réconciliée à finalIR
  // (barème net = résidu). ZÉRO recalcul, agrégats moteur seuls.
  const roi = buildIrRoiCard(ir);
  const roiLines: KpiRoiLine[] = roi.lines.map((l) => ({ label: l.label, value: euro(l.value), detail: l.detail, tooltip: l.tooltip }));
  const activeName = concubinPerson === 1 ? person1 : (person2 || "Personne 2");
  const roiTitle = ir.isConcubin ? "IR cumulé — 2 foyers" : "Impôt total du foyer";
  const revenuLabel = ir.isConcubin ? `Revenu net — foyer ${activeName}` : "Revenu net global";

  return (
<TabsContent value="ir" className="space-y-4">
  {irVide ? (
    <EmptyState title="Aucun revenu saisi" ctaLabel="Compléter l'onglet Revenus" onCta={() => onGoToCollecte?.("revenus")}>
      L'impôt sur le revenu se calcule à partir de vos revenus. Renseignez salaires, pensions, BNC/BIC, revenus fonciers ou mobiliers dans <strong>Collecte patrimoniale → Revenus</strong> (et l'activité dans <strong>Travail</strong>) — la base imposable, le barème, le quotient familial et le PFU s'afficheront ensuite automatiquement.
    </EmptyState>
  ) : (<>
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60 relative overflow-hidden">
    <CardAccentTop />
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
            style={{ background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.dangerBorder}` }}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
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
      {irOptions.foncierRegime === "micro" && ir.foncierBrut > SEUIL_MICRO_FONCIER && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.dangerBorder}` }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold">Revenus fonciers bruts ({euro(ir.foncierBrut)}) supérieurs à 15 000 € — </span>
            le régime micro-foncier n'est plus applicable au-delà de ce seuil.
            <span className="text-red-400"> Basculez en régime réel ci-dessous pour un calcul correct.</span>
          </div>
        </div>
      )}

      {/* Note concubinage + switch personne */}
      {ir.isConcubin && (
        <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
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
            {([1, 2] as const).map(p => {
              const irAny = ir as any;
              const isActive = concubinPerson === p;
              const name = p === 1 ? person1 : (person2 || "Personne 2");
              const rev = irAny[`rev${p}`] || 0;
              const parts = irAny[`parts${p}`] || 1;
              const baremeIR = irAny[`ir${p}`] || 0;
              const fonBrut = irAny[`foncierBrut${p}`] || 0;
              const fonTax = irAny[`foncierTaxable${p}`] || 0;
              const plac = irAny[`taxablePlac${p}`] || 0;
              const pfu = irAny[`pfuBase${p}`] || 0;
              const csgFon = irAny[`csgFoncierP${p}`] || 0;
              const finalIR = irAny[`finalIR${p}`] || 0;
              return (
                <div key={p} className="rounded-xl p-3" style={{ background: isActive ? "rgba(81,106,199,0.12)" : "rgba(0,0,0,0.03)", border: `1px solid ${isActive ? "rgba(81,106,199,0.3)" : "transparent"}` }}>
                  <div className="font-semibold mb-2" style={{ color: BRAND.navy }}>{name}</div>
                  {/* Bloc revenus */}
                  <div className="space-y-0.5 mb-2">
                    <div className="text-slate-500">Revenu net : <strong>{euro(rev)}</strong></div>
                    <div className="text-slate-500">Parts : <strong>{parts.toFixed(2).replace(".", ",")}</strong></div>
                  </div>
                  {/* Bloc foncier (si présent) */}
                  {fonBrut > 0 && (() => {
                    const fonPS = irAny[`foncierPS${p}`] || 0;
                    return (
                      <div className="space-y-0.5 mb-2 pt-2 border-t" style={{ borderColor: "rgba(81,106,199,0.15)" }}>
                        <div className="text-slate-500" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: BRAND.muted }}>Foncier</div>
                        <div className="text-slate-500">Brut : <strong>{euro(fonBrut)}</strong></div>
                        <div className="text-slate-500">Taxable : <strong>{euro(fonTax)}</strong></div>
                        {csgFon > 0 && <div className="text-slate-500">CSG déduc. : <strong>− {euro(csgFon)}</strong></div>}
                        {fonPS > 0 && <div className="text-slate-500">PS 17,2 % : <strong style={{ color: BRAND.danger }}>{euro(fonPS)}</strong></div>}
                      </div>
                    );
                  })()}
                  {/* Bloc placements (si présent) */}
                  {(plac > 0 || pfu > 0) && (() => {
                    const pfuFoyer = irAny[`totalPFU${p}`] || 0;
                    return (
                      <div className="space-y-0.5 mb-2 pt-2 border-t" style={{ borderColor: "rgba(81,106,199,0.15)" }}>
                        <div className="text-slate-500" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: BRAND.muted }}>Placements</div>
                        {plac > 0 && <div className="text-slate-500">Barème : <strong>{euro(plac)}</strong></div>}
                        {pfu > 0 && <div className="text-slate-500">Base PFU : <strong>{euro(pfu)}</strong></div>}
                        {pfuFoyer > 0 && <div className="text-slate-500">PFU 31,4 % : <strong style={{ color: BRAND.danger }}>{euro(pfuFoyer)}</strong></div>}
                      </div>
                    );
                  })()}
                  {/* Total IR foyer */}
                  <div className="pt-2 border-t" style={{ borderColor: "rgba(81,106,199,0.25)" }}>
                    <div style={{ color: BRAND.sky }}>IR barème : <strong>{euro(baremeIR)}</strong></div>
                    <div style={{ color: BRAND.danger, fontWeight: 700, marginTop: 2 }}>IR foyer total : {euro(finalIR)}</div>
                  </div>
                </div>
              );
            })}
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
          style={{ background: BRAND.successBg, color: BRAND.success, border: `1px solid ${BRAND.successBorder}` }}>
          <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {data.placements.filter((p) => p.pfuOptOut).map((p) => p.name || "Placement").join(", ")} : option barème IR activée.
            Les revenus de ces placements sont intégrés au revenu global et imposés au barème progressif.
          </span>
        </div>
      )}

      {/* ══ ACTE 1 — L'ESSENTIEL ══ Carte-roi « impôt total » (gauche, dominant) +
           contexte « revenu net · parts / TMI / taux moyen » (droite). Les anciens
           KPI-vitrine disparaissent : leurs textes migrent en tooltips (carte-roi) et
           en accordéons (Acte 3). */}
      <div className="grid gap-4 md:grid-cols-[1.35fr_1fr] items-stretch">
        <KpiRoiCard
          title={roiTitle}
          amount={euro(ir.finalIR)}
          lines={roiLines}
          tooltip={ir.isConcubin
            ? "Somme des impôts des 2 foyers fiscaux (concubinage). Détail par foyer ci-dessus."
            : "Impôt total du foyer, tout compris : barème progressif net des réductions, PFU et prélèvements sociaux. Chaque ligne y contribue et la somme égale ce total."}
          note={ir.finalIR <= 0 ? "Aucun impôt dû cette année sur les revenus saisis." : undefined}
        />
        {/* Contexte (A1) — 3 sous-cards distinctes : revenu net au-dessus, puis TMI et
             taux moyen côte à côte. La colonne s'étire (stretch) à la hauteur de la carte-roi. */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl px-4 py-3 flex-1 flex flex-col justify-center" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: SURFACE.cardShadow }}>
            <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.muted }}>
              {revenuLabel}
              <HelpTooltip text={ir.isConcubin ? "Revenu net imposable du foyer fiscal sélectionné (bascule via le switch ci-dessus)." : "Salaires + revenus fonciers + pensions + BNC/BIC, après déductions (frais pro, PER, charges)."} label={revenuLabel} />
            </div>
            <div className="font-black mt-1" style={{ color: BRAND.navy, fontSize: 24, lineHeight: 1.05 }}>{euro(ir.revenuNetGlobal)}</div>
            <div className="text-[11px] mt-0.5" style={{ color: BRAND.muted }}>· {plur(ir.parts, "part")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl px-4 py-3 flex flex-col justify-center" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: SURFACE.cardShadow }}>
              <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.muted }}>
                TMI
                <HelpTooltip text="Taux Marginal d'Imposition : tranche du barème atteinte par le quotient familial. Sous plafonnement du QF, la tranche réelle de référence s'affiche." label="TMI" />
              </div>
              <div className="font-black mt-1" style={{ color: BRAND.navy, fontSize: 20 }}>{Math.round(tmiView.tmiAffichee * 100)} %</div>
              {tmiView.sousTexteCard && <div className="text-[10.5px] mt-0.5 font-semibold" style={{ color: BRAND.goldText }}>{tmiView.sousTexteCard}</div>}
            </div>
            <div className="rounded-2xl px-4 py-3 flex flex-col justify-center" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: SURFACE.cardShadow }}>
              <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.muted }}>
                Taux moyen
                <HelpTooltip text="Impôt total rapporté au revenu net imposable : le taux effectivement supporté." label="Taux moyen" />
              </div>
              <div className="font-black mt-1" style={{ color: BRAND.navy, fontSize: 20 }}>{pct(ir.averageRate, 1)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Encart « votre taux marginal réel » (Lot C) — visible UNIQUEMENT quand le moteur
          le détecte (plafonnement QF / décote / frontière). Absent sinon. */}
      {tmiView.encart && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: BRAND.warningBg, color: BRAND.navy, border: `1px solid ${BRAND.warningBorder}`, borderLeft: `3px solid ${BRAND.gold}` }}>
          <BarChart3 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold">{tmiView.encart.titre} — </span>
            {tmiView.encart.leadFort && <><strong style={{ color: BRAND.navy }}>{tmiView.encart.leadFort}</strong> </>}
            {tmiView.encart.corps}
          </div>
        </div>
      )}
      {tmiView.tmiCase === "forfaitaire" && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: BRAND.warningBg, color: BRAND.navy, border: `1px solid ${BRAND.warningBorder}`, borderLeft: `3px solid ${BRAND.gold}` }}>
          <BarChart3 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div><span className="font-semibold">Barème 0 % — </span>l'essentiel de votre impôt provient de l'imposition forfaitaire de vos revenus de capitaux (PFU).</div>
        </div>
      )}

      {/* ══ ACTE 2 — CE QUI SE PASSE ══ Remplissage des tranches + comparatif micro/réel foncier. */}
      {/* Barème (Lot C mirror B3) : étiquettes impôt/logés + réconciliation (helper partagé) ;
          bascule sur le calcul de référence (2 parts) quand le QF est plafonné — barres ET
          calcul sur le MÊME référentiel, jamais mélangés. */}
      {(() => {
        const irAny = ir as any;
        const plafonne = !!irAny.plafonnementQfActif && Array.isArray(irAny.bracketFillBaseParts) && irAny.bracketFillBaseParts.length > 0;
        const baseParts = isCouple ? 2 : 1;
        return (
          <BracketFillChart
            title="Barème IR — remplissage des tranches"
            data={plafonne ? irAny.bracketFillBaseParts : ir.bracketFill}
            referenceValue={plafonne ? irAny.quotientBaseParts : ir.quotient}
            valueLabel={plafonne ? `Quotient (référence ${baseParts} parts)` : "Quotient familial"}
            showImpot
            reconLignes={tmiView.reconBaremeLignes}
            note={plafonne ? `Plafonnement du quotient familial actif — lecture au barème de référence à ${baseParts} parts` : undefined}
          />
        );
      })()}

      {/* Comparatif micro vs réel foncier (avec sélecteur de régime) — comportement conservé */}
      {ir.foncierBrut > 0 && (
        <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="md:w-64">
              <Field label="Régime foncier" tooltip="Micro-foncier : abattement forfaitaire de 30 % si revenus fonciers bruts < 15 000 €/an. Régime réel : déduction des charges réelles (intérêts, travaux, assurance…). Le régime réel est souvent plus avantageux en présence d'un emprunt.">
                <Select value={irOptions.foncierRegime} onValueChange={(v: "micro" | "real") => setIrOptions((prev) => ({ ...prev, foncierRegime: v }))}>
                  <SelectTrigger className="rounded-xl bg-white border border-slate-300 shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="micro">Micro-foncier (30 %)</SelectItem><SelectItem value="real">Régime réel</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex-1">
              {/* Comparaison micro vs réel — lit le moteur (foncierChargesTotal inclut l'amortissement Jeanbrun) */}
              {(() => {
                const irAny2: any = ir;
                const chargesTotal = irAny2.foncierChargesTotal ?? ir.foncierCharges; // inclut Jeanbrun (exposé par ir.ts)
                const jeanbrunRetenu = irAny2.jeanbrunRetenu ?? 0;
                const microVal = Math.max(0, ir.foncierBrut * 0.7);
                const reelVal = Math.max(0, ir.foncierBrut - chargesTotal - ir.foncierInterests);
                const isMicro = irOptions.foncierRegime === "micro";
                // Éligibilité micro-foncier (art. 32) : brut <= seuil ET aucun dispositif exigeant le réel.
                const df: any = ir.dispositifsFiscaux;
                const dispositifExigeReel = !!df && (
                  (df.statuts || []).some((s: any) => s.statut === "incompatible")
                  || (df.jeanbrun && df.jeanbrun.parBien && df.jeanbrun.parBien.length > 0)
                  || (df.reductions || []).some((r: any) => String(r.id).startsWith("locavantages"))
                );
                const microDisponible = ir.foncierBrut <= SEUIL_MICRO_FONCIER && !dispositifExigeReel;
                const motifIndispo = ir.foncierBrut > SEUIL_MICRO_FONCIER
                  ? `indisponible : revenus bruts > ${euro(SEUIL_MICRO_FONCIER)}`
                  : "indisponible : dispositif exigeant le régime réel";
                const diff = microVal - reelVal;
                return (
                  <div className="space-y-2">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{
                        background: microDisponible && isMicro ? BRAND.cream : SURFACE.app,
                        border: `1.5px solid ${microDisponible && isMicro ? BRAND.gold : SURFACE.border}`,
                        borderRadius: 10, padding: "10px", textAlign: "center", opacity: microDisponible ? 1 : 0.5,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: microDisponible && isMicro ? BRAND.goldText : BRAND.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Micro-foncier</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: BRAND.navy, marginTop: 4 }}>{euro(microVal)}</div>
                        <div style={{ fontSize: 10, color: BRAND.muted }}>{microDisponible ? "imposable" : motifIndispo}</div>
                      </div>
                      <div style={{
                        background: !isMicro ? BRAND.cream : SURFACE.app,
                        border: `1.5px solid ${!isMicro ? BRAND.gold : SURFACE.border}`,
                        borderRadius: 10, padding: "10px", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: !isMicro ? BRAND.goldText : BRAND.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Régime réel</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: BRAND.navy, marginTop: 4 }}>{euro(reelVal)}</div>
                        <div style={{ fontSize: 10, color: BRAND.muted }}>imposable</div>
                        {jeanbrunRetenu > 0 && <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 2 }}>dont amortissement Jeanbrun − {euro(jeanbrunRetenu)}</div>}
                      </div>
                    </div>
                    {microDisponible && Math.abs(diff) > 10 && (
                      <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", color: diff > 0 ? BRAND.success : BRAND.danger }}>
                        {diff > 0
                          ? <><Lightbulb className="h-3.5 w-3.5 inline-block align-middle mr-1" aria-hidden="true" />Le réel ferait économiser {euro(diff)} de base imposable</>
                          : <><Lightbulb className="h-3.5 w-3.5 inline-block align-middle mr-1" aria-hidden="true" />Le micro est plus avantageux de {euro(-diff)}</>}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══ ACTE 3 — LES MASSES ══ (accordéons fermés, résumé chiffré visible) */}

      {/* §1 — Décomposition additive complète du calcul (waterfall + réductions) */}
      {(ir.revenuNetGlobal > 0 || ir.dispositifsFiscaux) && (
        <SectionAccordion title="Décomposition du calcul" summary={`des revenus bruts à l'impôt total dû (${euro(ir.finalIR)})`}>
          {/* Waterfall fiscal */}
          {ir.revenuNetGlobal > 0 && (() => {
            const revenusTotal = ir.salaries + ir.foncierBrut + (ir.taxablePlacements || 0);
            const fraisPro = ir.retainedExpenses || 0;
            const autresDeductions = ir.deductibleCharges || 0;
            const steps = [
              { label: "Revenus bruts", value: revenusTotal, color: BRAND.navy, type: "add" as const },
              ...(fraisPro > 0 ? [{ label: "Frais pro / abatt. 10%", value: fraisPro, color: "#E3AF64", type: "ded" as const }] : []),
              ...(autresDeductions > 0 ? [{ label: "Versements PER & déd.", value: autresDeductions, color: "#C4A882", type: "ded" as const }] : []),
              { label: "Rev. net imposable", value: ir.revenuNetGlobal, color: BRAND.sky, type: "total" as const },
              { label: "Barème progressif", value: ir.bareme || 0, color: BRAND.danger, type: "tax" as const },
              ...(ir.foncierSocialLevy > 0 ? [{ label: "Prél. sociaux foncier", value: ir.foncierSocialLevy, color: "#f97316", type: "tax" as const }] : []),
              ...(ir.totalPFU > 0 ? [{ label: "PFU placements", value: ir.totalPFU, color: "#f97316", type: "tax" as const }] : []),
              ...(ir.avRachatImpot > 0 ? [{ label: "Fiscalité AV rachat", value: ir.avRachatImpot, color: "#f97316", type: "tax" as const }] : []),
              { label: "IR total dû", value: ir.finalIR, color: "#b91c1c", type: "result" as const },
            ];
            const maxVal = Math.max(...steps.map(s => Math.abs(s.value)));
            return (
              <div className="p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: BRAND.sky }}>Décomposition du calcul fiscal</div>
                <div className="space-y-2">
                  {steps.map((step, i) => {
                    const pctW = maxVal > 0 ? step.value / maxVal * 100 : 0;
                    const isDed = step.type === "ded";
                    const isTax = step.type === "tax";
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="text-xs font-medium w-36 shrink-0 text-right" style={{ color: isDed ? "#92400e" : isTax ? "#c2410c" : "#94a3b8" }}>{step.label}</div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 h-6 rounded-lg overflow-hidden relative" style={{ background: "#f1f5f9" }}>
                            <div className="h-full rounded-lg transition-all" style={{
                              width: `${pctW}%`,
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

          {/* Réductions & dispositifs fiscaux (immobiliers + financiers Lot 3) */}
          {(() => {
            const df: any = ir.dispositifsFiscaux;
            if (!df) return null;
            const reducDispositifs = (df.reductions || []).filter((r: any) => r.id !== "forfait_scolaire" && r.impute > 0);
            const jeanbrunRetenu = df.jeanbrun ? df.jeanbrun.parBien.reduce((s: number, p: any) => s + p.montantRetenu, 0) : 0;
            const statutsNonOk = df.statuts || [];
            const ecretementNiches = n(df.ecretementNiches);
            const ecretementCommun = n(df.ecretementCommun);
            const ecretementMajore = n(df.ecretementMajore);
            if (reducDispositifs.length === 0 && jeanbrunRetenu <= 0 && statutsNonOk.length === 0 && ecretementNiches <= 0) return null;
            const totalReductions = reducDispositifs.reduce((s: number, r: any) => s + n(r.impute), 0);
            return (
              <div className="p-4 border mt-4" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>Réductions &amp; dispositifs fiscaux</div>
                <div className="space-y-1 text-xs">
                  {reducDispositifs.map((r: any, i: number) => (
                    <div key={`r${i}`} className="flex justify-between"><span style={{ color: BRAND.muted }}>Réduction {labelDispositifReduction(r.id)}</span><span className="font-bold" style={{ color: "#0F766E" }}>− {euro(r.impute)}</span></div>
                  ))}
                  {reducDispositifs.length > 1 && (
                    <div className="flex justify-between pt-1 mt-1" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                      <span className="font-semibold" style={{ color: BRAND.navy }}>Total réductions imputées</span>
                      <span className="font-bold" style={{ color: "#0F766E" }}>− {euro(totalReductions)}</span>
                    </div>
                  )}
                  {jeanbrunRetenu > 0 && (
                    <div className="flex justify-between"><span style={{ color: BRAND.muted }}>Amortissement Jeanbrun (déduit du foncier)</span><span className="font-bold" style={{ color: "#0F766E" }}>− {euro(jeanbrunRetenu)}{df.jeanbrun.ecretement > 0 ? ` (écrêté ${euro(df.jeanbrun.ecretement)})` : ""}</span></div>
                  )}
                  {ecretementNiches > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1" style={{ color: BRAND.warning }}>
                        Plafonnement des niches (art. 200-0 A)
                        <HelpTooltip text={`Cumul des réductions au-delà du plafond global des niches (art. 200-0 A CGI).\nEnveloppe commune 10 000 € : ${euro(ecretementCommun)} écrêtés.\nEnveloppe majorée 18 000 € (outre-mer / SOFICA) : ${euro(ecretementMajore)} écrêtés.\nLa fraction écrêtée est définitivement perdue (pas de report).`} />
                      </span>
                      <span className="font-bold" style={{ color: BRAND.warning }}>− {euro(ecretementNiches)} non imputés</span>
                    </div>
                  )}
                </div>
                {statutsNonOk.length > 0 && (
                  <div className="mt-2 text-[11px]" style={{ color: BRAND.muted }}>
                    {statutsNonOk.map((s: any, i: number) => <div key={`s${i}`}><AlertTriangle className="h-3.5 w-3.5 inline-block align-middle mr-1" aria-hidden="true" />{s.dispositif} — {s.motif}</div>)}
                  </div>
                )}
              </div>
            );
          })()}
        </SectionAccordion>
      )}

      {/* §2 — Location meublée / LMNP (PUR AFFICHAGE des sorties moteur ir.meubleDetail) */}
      {(() => {
        const detail: any[] = (ir as any).meubleDetail || [];
        if (detail.length === 0) return null;
        const totalBase = detail.reduce((s: number, d: any) => s + n(d.base), 0);
        const ps = n((ir as any).meubleSocialLevy);
        const SOUS_LABEL: Record<string, string> = { longue_duree: "Longue durée", tourisme_classe: "Tourisme classé", tourisme_non_classe: "Tourisme non classé" };
        return (
          <SectionAccordion title="Location meublée / LMNP" summary={`base imposable ${euro(totalBase)}${ps > 0 ? ` · PS ${euro(ps)}` : ""}`}>
            <div className="p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.goldText }}>Location meublée (BIC)</div>
              <div className="space-y-2 text-xs">
                {detail.map((d: any, i: number) => (
                  <div key={d.idBien || i} className="rounded-lg p-2" style={{ background: "rgba(196,151,61,0.05)", border: `1px solid ${SURFACE.border}` }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold" style={{ color: BRAND.navy }}>{d.nom}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.goldText }}>{d.regime === "micro" ? "Micro-BIC" : "Réel"} · {SOUS_LABEL[d.sousType] || d.sousType}</span>
                    </div>
                    <div className="space-y-0.5" style={{ color: BRAND.muted }}>
                      <div className="flex justify-between"><span>Recettes</span><strong>{euro(d.recettes)}</strong></div>
                      {d.regime === "micro" ? (
                        <div className="flex justify-between"><span>Abattement{d.abattement <= 305 && d.recettes > 0 ? " (plancher 305 €)" : ""}</span><strong>− {euro(d.abattement)}</strong></div>
                      ) : (
                        <>
                          <div className="flex justify-between"><span>Charges retenues</span><strong>− {euro(d.chargesRetenues)}</strong></div>
                          {d.amortDeductible > 0 && <div className="flex justify-between"><span>Amortissement déduit</span><strong>− {euro(d.amortDeductible)}</strong></div>}
                          {d.ard > 0 && <div className="flex justify-between"><span style={{ color: BRAND.sky }}>Amortissement en report (ARD)</span><span style={{ color: BRAND.sky }}>{euro(d.ard)} <span className="opacity-70">· report illimité, art. 39 C</span></span></div>}
                          {d.deficitReportable > 0 && <div className="flex justify-between"><span style={{ color: BRAND.warning }}>Déficit</span><span style={{ color: BRAND.warning }}>{euro(d.deficitReportable)} <span className="opacity-70">· non imputable au revenu global, art. 156 I-1 ter</span></span></div>}
                        </>
                      )}
                      <div className="flex justify-between pt-0.5" style={{ borderTop: `1px solid ${SURFACE.border}` }}><span className="font-semibold" style={{ color: BRAND.navy }}>Base imposable</span><strong style={{ color: BRAND.navy }}>{euro(d.base)}</strong></div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-1" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                  <span className="font-semibold" style={{ color: BRAND.navy }}>Base imposable meublée (total foyer)</span>
                  <strong style={{ color: BRAND.navy }}>{euro(totalBase)}</strong>
                </div>
                {ps > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1" style={{ color: BRAND.muted }}>Prélèvements sociaux revenus du patrimoine (LFSS 2026)<HelpTooltip text="PS 18,6 % sur le bénéfice meublé (revenus du patrimoine, LFSS 2026 — art. L136-8 CSS). Distinct du foncier nu à 17,2 %." /></span>
                    <strong style={{ color: BRAND.danger }}>{euro(ps)}</strong>
                  </div>
                )}
              </div>
            </div>
          </SectionAccordion>
        );
      })()}

      {/* §3 — Traitements, salaires et frais professionnels */}
      <SectionAccordion title="Traitements, salaires et frais professionnels" summary="mode de frais par personne (abattement 10 % ou frais réels)">
        <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </div>
      </SectionAccordion>

      {/* §4 — PFU et prélèvements sociaux : détail ligne à ligne */}
      {(() => {
        const irAny = ir as any;
        const pfuBaseTot = n(ir.pfuBase) + n(irAny.perInteretsPFU);
        const pfuMontant = n(ir.totalPFU);
        const foncierBase = n(irAny.taxableFonciers);
        const foncierPS = n(ir.foncierSocialLevy);
        const meubleBase = n(irAny.beneficeMeuble);
        const meublePS = n(irAny.meubleSocialLevy);
        const perPS = n(irAny.perRentesPS);
        const avRachat = n(ir.avRachatImpot);
        const somme = pfuMontant + foncierPS + meublePS + perPS + avRachat;
        if (somme <= 0.005) return null;
        type Row = { label: string; base?: number; taux: string; montant: number };
        const rows: Row[] = [];
        if (pfuMontant > 0) rows.push({ label: "PFU — capitaux mobiliers & plus-values", base: pfuBaseTot, taux: "31,4 % (12,8 % IR + 18,6 % PS)", montant: pfuMontant });
        if (foncierPS > 0) rows.push({ label: "Prélèvements sociaux foncier nu", base: foncierBase, taux: "17,2 %", montant: foncierPS });
        if (meublePS > 0) rows.push({ label: "Prélèvements sociaux location meublée", base: meubleBase, taux: "18,6 %", montant: meublePS });
        if (perPS > 0) rows.push({ label: "Prélèvements sociaux rentes PER", taux: "18,6 %", montant: perPS });
        if (avRachat > 0) rows.push({ label: "Fiscalité rachat assurance-vie", taux: "forfait / barème + PS", montant: avRachat });
        return (
          <SectionAccordion title="PFU et prélèvements sociaux" summary={`total ${euro(somme)}`}>
            <div className="p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
              <div className="space-y-2 text-xs">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 pb-2" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${SURFACE.border}` : "none" }}>
                    <div className="min-w-0">
                      <div className="font-semibold" style={{ color: BRAND.navy }}>{r.label}</div>
                      <div className="text-[10.5px]" style={{ color: BRAND.muted }}>
                        {r.base != null ? `base ${euro(r.base)} · ` : ""}{r.taux}
                      </div>
                    </div>
                    <div className="font-bold shrink-0" style={{ color: BRAND.danger }}>{euro(r.montant)}</div>
                  </div>
                ))}
                <div className="flex justify-between pt-1">
                  <span className="font-semibold" style={{ color: BRAND.navy }}>Total PFU + prélèvements sociaux</span>
                  <strong style={{ color: BRAND.navy }}>{euro(somme)}</strong>
                </div>
              </div>
            </div>
          </SectionAccordion>
        );
      })()}

      {/* §5 — Quotient familial : mécanique détaillée */}
      <SectionAccordion title="Quotient familial" summary={`${plur(ir.parts, "part")} · quotient ${euro(ir.quotient)}`}>
        <div className="space-y-3">
          <div className="p-4 border" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
            <div className="text-xs space-y-1" style={{ color: BRAND.muted }}>
              <div className="flex justify-between"><span>Revenu net imposable</span><strong style={{ color: BRAND.navy }}>{euro(ir.revenuNetGlobal)}</strong></div>
              <div className="flex justify-between"><span>Nombre de parts</span><strong style={{ color: BRAND.navy }}>{plur(ir.parts, "part")}</strong></div>
              <div className="flex justify-between pt-1 mt-1" style={{ borderTop: `1px solid ${SURFACE.border}` }}><span className="font-semibold" style={{ color: BRAND.navy }}>Quotient familial (revenu ÷ parts)</span><strong style={{ color: BRAND.navy }}>{euro(ir.quotient)}</strong></div>
              {ir.quotientFamilialCapAdjustment > 0 && (
                <div className="flex justify-between items-start pt-1 mt-1" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                  <span className="flex items-center gap-1" style={{ color: BRAND.warning }}>
                    Plafonnement du QF
                    <HelpTooltip text={`Avantage de quotient familial plafonné : +${euro(ir.quotientFamilialCapAdjustment)} d'IR (avantage retenu ${euro(Math.min(ir.qfBenefit, ir.qfCap))} sur ${euro(ir.qfCap)} maximum par demi-part supplémentaire).`} />
                  </span>
                  <strong style={{ color: BRAND.warning }}>+ {euro(ir.quotientFamilialCapAdjustment)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Gauge TMI — position dans les 5 tranches */}
          <div className="border p-3" style={{ borderColor: SURFACE.border, borderRadius: 14, background: SURFACE.card, boxShadow: SURFACE.cardShadow }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.muted }}>Position dans le barème IR</span>
              <span className="text-xs font-black" style={{ color: BRAND.navy }}>TMI {Math.round(tmiView.tmiAffichee * 100)} %</span>
            </div>
            {/* Lot C2 révisé : sous plafonnement, la position suit le barème de référence (tmiAffichee). */}
            {ir.plafonnementQfActif && (
              <div className="text-xs mb-2" style={{ color: BRAND.goldText }}>Position au barème de référence (plafonnement du QF actif).</div>
            )}
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
              {([{ rate: 0, color: "#166534" }, { rate: 0.11, color: "#22c55e" }, { rate: 0.30, color: BRAND.gold }, { rate: 0.41, color: "#f97316" }, { rate: 0.45, color: BRAND.danger }] as const).map((t, i) => (
                <div key={i} style={{ flex: 1, background: t.color, position: "relative", opacity: tmiView.tmiAffichee >= t.rate ? 1 : 0.2 }}>
                  {tmiView.tmiAffichee === t.rate && <div style={{ position: "absolute", top: -2, right: 0, width: 3, height: 12, background: BRAND.navy, borderRadius: 2 }} />}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginTop: 3 }}>
              {([0, 0.11, 0.30, 0.41, 0.45] as const).map((rate, i) => (
                <span key={i} style={{ fontWeight: tmiView.tmiAffichee === rate ? 900 : 400, color: tmiView.tmiAffichee === rate ? BRAND.navy : BRAND.muted }}>
                  {Math.round(rate * 100)} %
                </span>
              ))}
            </div>
          </div>
        </div>
      </SectionAccordion>
    </CardContent>
  </Card>
  </>)}
</TabsContent>

  );
});

TabIR.displayName = "TabIR";
export { TabIR };
