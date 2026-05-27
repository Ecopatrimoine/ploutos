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
// ─── Lot 6 — source unique du profil + capacité de perte + vocabulaire ESG ──
import { computeProfilRisque } from "../../lib/conformite/profil";
import { computeCapacitePerte } from "../../lib/conformite/capacitePerte";
import { vocabulaireReglementaire, type VocabulaireReglementaire } from "../../lib/conformite/vocabulaire";
import type { StatutFlags } from "../../lib/conformite/referencesLegales";
// ─── Lot 7 — modèle Recommandation + libellés des dimensions ───────────────
import { DIMENSIONS_LABEL, DIMENSIONS_ORDER, type Recommandation, type DimensionRecommandation } from "../../lib/conformite/recommandations";
// ─── Lot 8e — pièces jointes IPID/DIC (rattachement, pas génération) ───────
import { PIECE_TYPE_LABELS, formatTaille, type PieceJointe, type PieceJointeType } from "../../lib/conformite/piecesJointes";


// ── TabMission ─────────────────────────────────────────────────────────────────────
const TabMission = React.memo(function TabMission(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, mission, updateMission, cabinet, logoSrc, signatureSrc, person1, person2 } = props;

  return (
<TabsContent value="mission" className="space-y-6">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={FileText} title="Lettre de mission" subtitle="Besoins client, profil investisseur et obligations fiscales pour la fiche réglementaire." /></CardHeader>
    <CardContent className="space-y-6">
      {/* Besoins */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>BESOINS EXPRIMÉS</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="border-2 p-4 space-y-2" style={{ borderRadius: 14, borderColor: SURFACE.border, borderLeft: `4px solid ${BRAND.gold}` }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Santé</div>
            {([["besoinSante_depenses","Dépenses de santé, optique, dentaire"],["besoinSante_hospit","Hospitalisation seule"],["besoinSante_depasse","Dépassements d'honoraires"],["besoinSante_surcompl","Sur-complémentaire"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#0F172A]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="border-2 p-4 space-y-2" style={{ borderRadius: 14, borderColor: SURFACE.border, borderLeft: `4px solid ${BRAND.gold}` }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Prévoyance</div>
            {([["besoinPrev_arret","Maintenir rémunération (arrêt travail, invalidité)"],["besoinPrev_deces","Protéger la famille en cas de décès"],["besoinPrev_fraisGen","Couvrir frais généraux professionnels"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#0F172A]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="border-2 p-4 space-y-2" style={{ borderRadius: 14, borderColor: SURFACE.border, borderLeft: `4px solid ${BRAND.gold}` }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Retraite</div>
            {([["besoinRetraite_capital","Capital pour revenus complémentaires"],["besoinRetraite_rente","Capital retraite à convertir en rente"],["besoinRetraite_moderniser","Moderniser un contrat existant"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#0F172A]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="border-2 p-4 space-y-2" style={{ borderRadius: 14, borderColor: SURFACE.border, borderLeft: `4px solid ${BRAND.gold}` }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Épargne</div>
            {([["besoinEpargne_valoriser","Valoriser un capital"],["besoinEpargne_transmettre","Transmettre via assurance-vie"],["besoinEpargne_completer","Compléter les revenus"],["besoinEpargne_projet","Épargner pour un projet"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#0F172A]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Profil investisseur */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>PROFIL INVESTISSEUR</h3>

        {/* Q1 - Attitude risque + graphique */}
        <div className="p-4 space-y-4" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Q1 — Quelles variations pouvez-vous accepter ?</div>
          <div className="grid grid-cols-2 gap-6 items-start">
            {/* Radio options */}
            <div className="space-y-2">
              {([["0","Portefeuille A — Sécurisé"],["8","Portefeuille B — Prudent"],["12","Portefeuille C — Équilibré"],["18","Portefeuille D — Dynamique"]] as [string, string][]).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="attitude" checked={mission.attitude === Number(val)} onChange={() => updateMission("attitude", Number(val) as 0|8|12|18)} className="h-4 w-4 accent-[#0F172A]" />
                  <span className={mission.attitude === Number(val) ? "font-semibold" : ""}>{label}</span>
                </label>
              ))}
            </div>
            {/* Graphique rendement/risque — axe 0 central */}
            <div>
              <div className="text-xs text-slate-500 mb-2 text-center font-medium">Rendement annuel potentiel</div>
              {(() => {
                // Data: max above 0 and min below 0
                const bars = [
                  { label: "A", maxUp: 4, maxDown: 0, color: "#60a5fa", pts: 0 },
                  { label: "B", maxUp: 13, maxDown: 2, color: "#34d399", pts: 8 },
                  { label: "C", maxUp: 20, maxDown: 7, color: "#fbbf24", pts: 12 },
                  { label: "D", maxUp: 28, maxDown: 13, color: "#f87171", pts: 18 },
                ];
                const maxUp = 28; // scale reference
                const maxDown = 13;
                const totalH = 120; // px total height
                const upH = Math.round(totalH * maxUp / (maxUp + maxDown)); // ~81px for positives
                const downH = totalH - upH; // ~39px for negatives
                return (
                  <div style={{ position: "relative" }}>
                    <div className="flex items-stretch gap-2 justify-center" style={{ height: `${totalH}px` }}>
                      {bars.map((b) => {
                        const active = mission.attitude === b.pts;
                        const barUpH = Math.round(upH * b.maxUp / maxUp);
                        const barDownH = Math.round(downH * b.maxDown / maxDown) || 0;
                        return (
                          <div key={b.label} className="flex flex-col items-center" style={{ flex: 1, height: "100%" }}>
                            {/* Positive zone */}
                            <div style={{ height: `${upH}px`, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", alignItems: "center" }}>
                              <div className="text-xs font-bold mb-0.5" style={{ color: active ? b.color : "#aaa" }}>+{b.maxUp}%</div>
                              <div style={{
                                width: "70%", height: `${barUpH}px`,
                                background: active ? b.color : `${b.color}44`,
                                borderRadius: "4px 4px 0 0",
                                border: active ? `2px solid ${b.color}` : "none",
                                borderBottom: "none",
                                transition: "all 0.2s",
                                minHeight: "4px",
                              }} />
                            </div>
                            {/* Zero line label */}
                            <div style={{ height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div className="text-xs font-bold" style={{ color: active ? BRAND.navy : "#999" }}>{b.label}</div>
                            </div>
                            {/* Negative zone */}
                            <div style={{ height: `${downH}px`, display: "flex", flexDirection: "column", justifyContent: "flex-start", width: "100%", alignItems: "center" }}>
                              <div style={{
                                width: "70%", height: `${barDownH}px`,
                                background: active ? `${b.color}99` : `${b.color}33`,
                                borderRadius: "0 0 4px 4px",
                                border: active ? `2px solid ${b.color}` : "none",
                                borderTop: "none",
                                transition: "all 0.2s",
                                minHeight: b.maxDown > 0 ? "4px" : "0",
                              }} />
                              {b.maxDown > 0 && <div className="text-xs font-bold mt-0.5" style={{ color: active ? b.color : "#aaa" }}>−{b.maxDown}%</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Ligne zéro */}
                    <div style={{
                      position: "absolute",
                      top: `${upH + 8}px`,
                      left: 0, right: 0,
                      borderTop: "2px dashed rgba(0,0,0,0.18)",
                    }}>
                      <span style={{ position: "absolute", right: 0, top: "-9px", fontSize: "9px", color: "#999", background: "transparent", paddingLeft: "4px" }}>0%</span>
                    </div>
                  </div>
                );
              })()}
              <div className="text-xs text-slate-400 text-center mt-1">Variations annuelles potentielles max</div>
            </div>
          </div>
        </div>

        {/* Q2 - Réaction baisse */}
        <div className="p-4 space-y-2" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND.sky }}>Q2 — Réaction face à une baisse</div>
          {([["0","Je récupèrerais mon investissement (0 pt)"],["6","J'attendrais — si ça ne s'améliore pas, je vends (6 pts)"],["12","Cela ne me pose pas de problème (12 pts)"],["18","J'augmenterais mon investissement ! (18 pts)"]] as [string, string][]).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="reactionBaisse" checked={mission.reactionBaisse === Number(val)} onChange={() => updateMission("reactionBaisse", Number(val) as 0|6|12|18)} className="h-4 w-4 accent-[#0F172A]" />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* Q3 - Connaissances tableau */}
        <div className="p-4" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q3 — Expérience et connaissances financières</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left pb-2 font-semibold" style={{ color: BRAND.navy }}></th>
                <th className="text-center pb-2 font-semibold w-32" style={{ color: BRAND.navy }}>Je connais (1 pt)</th>
                <th className="text-center pb-2 font-semibold w-32" style={{ color: BRAND.navy }}>Déjà investi (+pts)</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["connaitFondsEuros","investiFondsEuros","Fonds euros","1 pt"],
                ["connaitActions","investiActions","Actions / obligations","3 pts"],
                ["connaitOPCVM","investiOPCVM","OPCVM (fonds actions, mixtes)","3 pts"],
                ["connaitImmo","investiImmo","Immobilier (SCPI, OPCI, SCI)","2 pts"],
                ["connaitTrackers","investiTrackers","Trackers / ETF (fonds indiciels)","3 pts"],
                ["connaitStructures","investiStructures","Produits structurés (EMTN…)","4 pts"],
              ] as [keyof typeof mission, keyof typeof mission, string, string][]).map(([kC, kI, label, pts]) => (
                <tr key={String(kC)} className="border-t" style={{ borderTopColor: SURFACE.border }}>
                  <td className="py-1.5 pr-3">{label}</td>
                  <td className="text-center"><input type="checkbox" checked={mission[kC] as boolean} onChange={e => updateMission(kC, e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /></td>
                  <td className="text-center"><label className="flex items-center justify-center gap-1 cursor-pointer"><input type="checkbox" checked={mission[kI] as boolean} onChange={e => updateMission(kI, e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /><span className="text-xs text-slate-500">{pts}</span></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Q4 - Pertes/Gains */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 space-y-2" style={{ borderRadius: 14, background: BRAND.dangerBg, border: `1px solid ${BRAND.dangerBorder}` }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND.danger }}>Q4a — Pertes déjà subies</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.aSubiPertes} onChange={e => updateMission("aSubiPertes", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" />
              <span>Oui, j'ai subi des pertes</span>
            </label>
            {mission.aSubiPertes && (
              <div className="mt-2 space-y-1.5">
                <div className="text-xs text-slate-500 mb-1">Ampleur :</div>
                {([[-5,"De 0 à -5%"],[-10,"De -6% à -10%"],[-20,"De -11% à -20%"],[-99,"Supérieure à -20%"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="ampleurPertes" checked={mission.ampleurPertes === v} onChange={() => updateMission("ampleurPertes", v)} className="h-3.5 w-3.5 accent-[#0F172A]" />
                    <span>{l}</span>
                  </label>
                ))}
                <div className="text-xs text-slate-500 mt-2 mb-1">Réaction :</div>
                {([[1,"J'ai vendu (1 pt)"],[2,"J'ai attendu (2 pts)"],[3,"J'ai réinvesti (3 pts)"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="reactionPertes" checked={mission.reactionPertes === v} onChange={() => updateMission("reactionPertes", v as 0|1|2|3)} className="h-3.5 w-3.5 accent-[#0F172A]" />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 space-y-2" style={{ borderRadius: 14, background: BRAND.successBg, border: `1px solid ${BRAND.successBorder}` }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND.success }}>Q4b — Gains déjà réalisés</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.aRealiseGains} onChange={e => updateMission("aRealiseGains", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" />
              <span>Oui, j'ai réalisé des gains</span>
            </label>
            {mission.aRealiseGains && (
              <div className="mt-2 space-y-1.5">
                <div className="text-xs text-slate-500 mb-1">Ampleur :</div>
                {([[5,"De 0% à 5%"],[10,"De +6% à 10%"],[20,"De +11% à 20%"],[99,"Supérieure à 20%"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="ampleurGains" checked={mission.ampleurGains === v} onChange={() => updateMission("ampleurGains", v)} className="h-3.5 w-3.5 accent-[#0F172A]" />
                    <span>{l}</span>
                  </label>
                ))}
                <div className="text-xs text-slate-500 mt-2 mb-1">Réaction :</div>
                {([[1,"J'ai tout vendu (1 pt)"],[2,"J'ai attendu (2 pts)"],[3,"J'ai réinvesti (3 pts)"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="reactionGains" checked={mission.reactionGains === v} onChange={() => updateMission("reactionGains", v as 0|1|2|3)} className="h-3.5 w-3.5 accent-[#0F172A]" />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Q5 - Mode gestion */}
        <div className="p-4" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q5 — Mode de gestion retenu</div>
          <div className="space-y-2">
            {([["pilote","Gestion pilotée — je délègue à des professionnels (2 pts)"],["libre","Gestion libre — je gère moi-même (4 pts)"]] as [string,string][]).map(([v,l]) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="modeGestion" checked={mission.modeGestion === v} onChange={() => updateMission("modeGestion", v)} className="h-4 w-4 accent-[#0F172A]" />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Q6 - Connaissances théoriques */}
        <div className="p-4" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q6 — Connaissances financières (2 pts chacune)</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.savoirUCRisque} onChange={e => updateMission("savoirUCRisque", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" />
              <span>Un support en UC présente un risque de perte en capital (Oui = 2 pts)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.savoirHorizonUC} onChange={e => updateMission("savoirHorizonUC", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" />
              <span>Plus l'horizon est long, plus la part en UC peut être élevée (Oui = 2 pts)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.savoirRisqueRendement} onChange={e => updateMission("savoirRisqueRendement", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" />
              <span>Plus le risque est élevé, plus l'espérance de rendement est élevée (Oui = 2 pts)</span>
            </label>
          </div>
        </div>

        {/* Horizon */}
        <div className="p-4" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Horizon de placement</div>
          <div className="flex gap-6 flex-wrap">
            {([["0-4","0 à 4 ans (0 pt)"],["5-8","5 à 8 ans (4 pts)"],["9-15","9 à 15 ans (8 pts)"],["15+","+ de 15 ans (16 pts)"]] as [string, string][]).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="horizon" checked={mission.horizon === val} onChange={() => updateMission("horizon", val)} className="h-4 w-4 accent-[#0F172A]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Q7 — ESG (préférences de durabilité, Lot 6) ─ libellé via helper vocabulaire (Lot 5) */}
        {(() => {
          const statuts: StatutFlags = {
            coa:    !!cabinet?.statutCoa,
            mia:    !!cabinet?.statutMia,
            iobsp:  !!cabinet?.statutIobsp,
            cif:    !!cabinet?.statutCif,
            carteT: !!cabinet?.statutCarteT,
          };
          const voc: VocabulaireReglementaire = vocabulaireReglementaire(statuts);
          const cadreSuffix = voc.cadreReglementaire !== "—" ? ` — ${voc.cadreReglementaire}` : "";
          return (
            <div className="p-4" style={{ borderRadius: 14, background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND.sky }}>
                Q7 — Préférences en matière de durabilité (ESG){cadreSuffix}
              </div>
              <p className="text-xs text-slate-500 mb-2">Souhaitez-vous intégrer des critères ESG dans vos investissements ?</p>
              <div className="space-y-1.5">
                {([["oui","Oui, de façon prioritaire (4 pts)"],["partiel","Partiellement (2 pts)"],["non","Non / Pas de préférence (0 pt)"]] as [string,string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="esgPref" checked={mission.esgPref === v} onChange={() => updateMission("esgPref", v)} className="h-4 w-4 accent-[#0F172A]" />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Score & Profil (Lot 6 — source unique, 4 niveaux, ESG noté en sous-score) */}
        {(() => {
          const r = computeProfilRisque(mission);
          const capacite = computeCapacitePerte(data);
          // Première lettre en majuscule pour l'affichage ; clés du module en minuscules.
          const profilLabel = r.profil.charAt(0).toUpperCase() + r.profil.slice(1);
          const profilDesc: Record<string, string> = {
            "prudent":   "Vous acceptez une légère exposition aux marchés pour améliorer le rendement, mais la stabilité reste primordiale. Une majorité d'actifs obligataires (70–80%) avec une petite poche actions (20–30%).",
            "équilibré": "Vous recherchez un compromis entre sécurité et performance. Votre allocation cible est 50/50 entre actifs obligataires et actions. Vous acceptez des fluctuations modérées sur le moyen terme.",
            "dynamique": "La croissance de votre patrimoine est votre objectif principal. Vous tolérez des variations significatives à court terme pour viser une performance supérieure à long terme. Allocation majoritairement actions (60–80%).",
            "offensif":  "Vous êtes orienté performance maximale et acceptez des variations importantes de votre portefeuille. Une allocation très largement actions (80–100%), avec une vision long terme et une forte tolérance à la volatilité.",
          };
          const profilHorizonNote: Record<string, string> = {
            "prudent":   "Ce profil convient à un horizon de placement d'au moins 3 à 5 ans (adapté à tout horizon en cas de coussin liquide important).",
            "équilibré": "Ce profil nécessite un horizon de placement d'au moins 5 à 7 ans pour lisser les fluctuations.",
            "dynamique": "Ce profil est adapté à un horizon long terme de 8 ans minimum pour absorber la volatilité.",
            "offensif":  "Ce profil requiert un horizon très long terme (10 ans et plus) pour optimiser le rapport risque/rendement.",
          };
          const horizonLabel: Record<string, string> = { "0-4": "court terme (0–4 ans)", "5-8": "moyen terme (5–8 ans)", "9-15": "long terme (9–15 ans)", "15+": "très long terme (+ 15 ans)" };
          const horizonStr = mission.horizon ? horizonLabel[mission.horizon] || "" : "";
          const horizonNote = horizonStr
            ? ` Avec un horizon de placement ${horizonStr}, ${r.profil === "prudent" ? "ce profil est cohérent avec votre durée d'investissement." : r.profil === "équilibré" ? "un profil équilibré est bien adapté à votre durée d'investissement." : "veillez à vous assurer que vous n'aurez pas besoin de ces fonds avant la fin de l'horizon prévu."}`
            : "";
          return (
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${BRAND.sky}` }}>
              <div className="flex items-center gap-3 flex-wrap px-5 py-3 text-sm font-semibold" style={{ background: BRAND.navy, color: BRAND.gold }}>
                <span>Risque : {r.scoreRisque} pts</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
                <span>ESG : {r.sousScoreESG} pts</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
                <span>Total : {r.total} / {r.totalMax} pts</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
                <span>Profil : <strong>{profilLabel}</strong></span>
              </div>
              <div className="px-5 py-4 space-y-3" style={{ background: SURFACE.card }}>
                <p className="text-sm" style={{ color: BRAND.navy }}>{profilDesc[r.profil]}</p>
                {horizonNote && <p className="text-sm font-medium" style={{ color: BRAND.sky }}>{horizonNote}</p>}
                <p className="text-xs text-slate-500 italic">{profilHorizonNote[r.profil]}</p>

                {/* Capacité de perte — distincte de la tolérance (Lot 6) */}
                <div className="mt-2 pt-3" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: BRAND.sky }}>
                    Capacité à subir des pertes (dérivée du patrimoine)
                  </div>
                  <p className="text-sm" style={{ color: BRAND.navy }}>
                    Niveau : <strong>{capacite.niveau}</strong>
                  </p>
                  <ul className="text-xs text-slate-600 list-disc ml-5 mt-1 space-y-0.5">
                    {capacite.justification.map((j, i) => <li key={i}>{j}</li>)}
                  </ul>
                  <p className="text-xs text-slate-400 italic mt-1">
                    Distincte de la tolérance au risque (calculée sur les questions d'attitude).
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Recommandations / plan d'action (Lot 7) ─ source unique des recos consommée par le rapport + Lot 8 */}
      {(() => {
        const recos: Recommandation[] = Array.isArray(props.recommandations) ? props.recommandations : [];
        const setRecos: (next: Recommandation[]) => void = props.setRecommandations || (() => {});
        const updateOne = (id: string, patch: Partial<Recommandation>) =>
          setRecos(recos.map(r => r.id === id ? { ...r, ...patch } : r));
        const removeOne = (id: string) => setRecos(recos.filter(r => r.id !== id));
        const addOne = () => {
          const id = (typeof crypto !== "undefined" && crypto.randomUUID)
            ? crypto.randomUUID()
            : `reco_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
          setRecos([...recos, { id, libelle: "", justification: "", dimension: "besoin" }]);
        };
        return (
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>RECOMMANDATIONS & PLAN D'ACTION</h3>
            <div className="p-4 space-y-3" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 14 }}>
              <p className="text-xs text-slate-500">
                Chaque recommandation se rattache à une <strong>dimension du profil</strong> (besoin exprimé, tolérance au risque, ESG, capacité à subir des pertes). Raisonner <strong>garantie / besoin</strong> — ne pas nommer de produit ni d'assureur.
              </p>
              {recos.length === 0 && (
                <div className="text-xs text-slate-400 italic py-2">
                  Aucune recommandation pour ce dossier. La section « Recommandations » du rapport ne s'affichera pas tant qu'aucune n'est saisie.
                </div>
              )}
              {recos.map((r, idx) => (
                <div key={r.id} className="p-3 rounded-lg" style={{ background: "#fff", border: `1px solid ${SURFACE.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: BRAND.sky }}>Reco #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeOne(r.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                      title="Supprimer cette recommandation"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.muted }}>Libellé</Label>
                      <Input
                        value={r.libelle}
                        onChange={e => updateOne(r.id, { libelle: e.target.value })}
                        placeholder="ex : Renforcer la part obligataire / Souscrire une garantie ITT"
                        className="rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.muted }}>Dimension</Label>
                      <select
                        value={r.dimension}
                        onChange={e => updateOne(r.id, { dimension: e.target.value as DimensionRecommandation })}
                        className="w-full rounded-lg px-2 py-1.5 text-sm border"
                        style={{ borderColor: SURFACE.border, background: "#fff" }}
                      >
                        {DIMENSIONS_ORDER.map(d => (
                          <option key={d} value={d}>{DIMENSIONS_LABEL[d]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.muted }}>Justification (rattachée à la dimension)</Label>
                      <Textarea
                        value={r.justification}
                        onChange={e => updateOne(r.id, { justification: e.target.value })}
                        placeholder="ex : Cohérent avec un profil prudent et un horizon court terme"
                        className="rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addOne}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: BRAND.navy, color: "#fff" }}
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une recommandation
              </button>
            </div>
          </div>
        );
      })()}

      {/* Pièces jointes IPID/DIC (Lot 8e — rattachement, jamais génération) */}
      {(() => {
        const pieces: PieceJointe[] = Array.isArray(props.piecesJointes) ? props.piecesJointes : [];
        const setPieces: (next: PieceJointe[]) => void = props.setPiecesJointes || (() => {});
        const updateOne = (id: string, patch: Partial<PieceJointe>) =>
          setPieces(pieces.map(p => p.id === id ? { ...p, ...patch } : p));
        const removeOne = (id: string) => setPieces(pieces.filter(p => p.id !== id));
        const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            alert("Fichier trop volumineux (> 5 Mo). Préférez le stockage local Electron (à venir).");
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result;
            if (typeof dataUrl !== "string") return;
            const id = (typeof crypto !== "undefined" && crypto.randomUUID)
              ? crypto.randomUUID()
              : `piece_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
            const piece: PieceJointe = {
              id,
              type: "ipid",
              nom: file.name,
              mimeType: file.type || "application/octet-stream",
              taille: file.size,
              uploadedAt: new Date().toISOString(),
              dataUrl,
            };
            setPieces([...pieces, piece]);
          };
          reader.readAsDataURL(file);
          // Reset l'input pour permettre de re-sélectionner le même fichier
          e.target.value = "";
        };
        return (
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>PIÈCES JOINTES — IPID / DIC</h3>
            <div className="p-4 space-y-3" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 14 }}>
              <div className="text-xs text-slate-600" style={{ background: "rgba(146,64,14,0.05)", border: "1px solid rgba(146,64,14,0.25)", padding: "8px 10px", borderRadius: 6 }}>
                <strong style={{ color: "#92400E" }}>Important :</strong> Ploutos <strong>ne génère pas</strong> d'IPID ni de DIC. Ces documents sont fournis <strong>par l'assureur</strong> (règlement UE 2017/1469 pour l'IPID, règlement 1286/2014 PRIIPs pour le DIC). Le cabinet les <strong>rattache</strong> au dossier et la fiche DDA les <strong>référence</strong>.
              </div>
              {pieces.length === 0 && (
                <div className="text-xs text-slate-400 italic py-2">
                  Aucune pièce jointe rattachée à ce dossier. La fiche DDA affichera « IPID à remettre ».
                </div>
              )}
              {pieces.map((p, idx) => (
                <div key={p.id} className="p-3 rounded-lg" style={{ background: "#fff", border: `1px solid ${SURFACE.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: BRAND.sky }}>Pièce #{idx + 1} — {formatTaille(p.taille)}</span>
                    <button
                      type="button"
                      onClick={() => removeOne(p.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                      title="Supprimer cette pièce jointe"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.muted }}>Type</Label>
                      <select
                        value={p.type}
                        onChange={e => updateOne(p.id, { type: e.target.value as PieceJointeType })}
                        className="w-full rounded-lg px-2 py-1.5 text-sm border"
                        style={{ borderColor: SURFACE.border, background: "#fff" }}
                      >
                        {(Object.keys(PIECE_TYPE_LABELS) as PieceJointeType[]).map(t => (
                          <option key={t} value={t}>{PIECE_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.muted }}>Nom du fichier (fourni par l'assureur)</Label>
                      <Input
                        value={p.nom}
                        onChange={e => updateOne(p.id, { nom: e.target.value })}
                        className="rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.muted }}>Contrat ou garantie liée (optionnel)</Label>
                      <Input
                        value={p.contratLie || ""}
                        onChange={e => updateOne(p.id, { contratLie: e.target.value })}
                        placeholder="ex : Garantie ITT — police n°12345"
                        className="rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <label className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer" style={{ background: BRAND.navy, color: "#fff" }}>
                <Plus className="h-3.5 w-3.5" /> Ajouter une pièce jointe (PDF / image)
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>
        );
      })()}

      {/* Rémunération */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>MODE DE RÉMUNÉRATION</h3>
        <div className="p-4 space-y-3" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <p className="text-xs text-slate-500">Sélectionner le mode applicable à cette mission (art. L521-2 code des assurances)</p>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mission.remuCommission} onChange={e => updateMission("remuCommission", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0F172A]" />
            <span>Commission (rémunération incluse dans la prime d'assurance)</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mission.remuHonoraire} onChange={e => updateMission("remuHonoraire", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0F172A]" />
            <span>Honoraire payé directement par le client</span>
          </label>
          {mission.remuHonoraire && (
            <div className="flex items-center gap-2 ml-6">
              <span className="text-sm text-slate-600">Montant / mode de calcul :</span>
              <input type="text" value={mission.remuHonoraireMontant} onChange={e => updateMission("remuHonoraireMontant", e.target.value)}
                placeholder="Ex : 500 € ou 1% du capital"
                className="rounded-lg px-2 py-1 text-sm flex-1" />
            </div>
          )}
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mission.remuMixte} onChange={e => updateMission("remuMixte", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0F172A]" />
            <span>Combinaison honoraire + commission</span>
          </label>
        </div>
      </div>

      {/* Obligations fiscales */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>OBLIGATIONS FISCALES & CONFORMITÉ</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 space-y-2" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
            <div className="text-xs font-semibold mb-2" style={{ color: BRAND.sky }}>Résidence fiscale France</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residenceFranceIR} onChange={e => updateMission("residenceFranceIR", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /><span>Imposé à l'IR en France</span></label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residenceFranceIFI} onChange={e => updateMission("residenceFranceIFI", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /><span>Imposé à l'IFI en France</span></label>
          </div>
          <div className="p-4 space-y-2" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
            <div className="text-xs font-semibold mb-2" style={{ color: BRAND.sky }}>FATCA & PPE</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.nationaliteUS} onChange={e => updateMission("nationaliteUS", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /><span>Nationalité américaine</span></label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residentFiscalUS} onChange={e => updateMission("residentFiscalUS", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /><span>Résident fiscal USA</span></label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.ppe} onChange={e => updateMission("ppe", e.target.checked)} className="h-4 w-4 accent-[#0F172A]" /><span>Personne politiquement exposée</span></label>
          </div>
        </div>
      </div>

      {/* Lieu signature */}
      <div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: BRAND.sky }}>SIGNATURE — LIEU</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm">Fait à :</span>
          <input type="text" value={mission.lieuSignature} onChange={e => updateMission("lieuSignature", e.target.value)}
            className="rounded-xl px-3 py-1.5 text-sm w-48" />
        </div>
      </div>

      {/* ─── Lot Dossier client — bouton unique « Générer un document PDF »
           ouvre la pop-card universelle (panier multi-docs + overrides +
           check complétude). Les boutons v1 sont conservés sous une
           section « ancien flux » jusqu'à la bascule franche. ─── */}
      {props.onOpenPopcardImpression && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg, rgba(196,151,61,.08) 0%, rgba(196,151,61,.02) 100%)", border: `1.5px solid ${BRAND.gold}` }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-bold mb-1" style={{ color: BRAND.navy }}>📄 Génération de documents PDF</div>
              <div className="text-xs" style={{ color: BRAND.muted }}>
                Panier multi-documents : combinez librement sections du bilan patrimonial + documents réglementaires.
                1 seul PDF final.
              </div>
            </div>
            <Button
              className="rounded-xl px-6 py-3 text-sm font-bold shadow-md"
              style={{ background: `linear-gradient(135deg, ${BRAND.goldText} 0%, ${BRAND.gold} 100%)`, color: "#fff" }}
              onClick={props.onOpenPopcardImpression}
            >
              <Download className="mr-2 h-4 w-4" />Générer un document PDF
            </Button>
          </div>
        </div>
      )}

    </CardContent>
  </Card>
</TabsContent>

  );
});

TabMission.displayName = "TabMission";
export { TabMission };
