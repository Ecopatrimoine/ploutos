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


// ── TabMission ─────────────────────────────────────────────────────────────────────
const TabMission = React.memo(function TabMission(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, mission, updateMission, cabinet, logoSrc, signatureSrc, showPdfMissionModal, person1, person2 } = props;

  return (
<TabsContent value="mission" className="space-y-6">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={FileText} title="Lettre de mission" subtitle="Besoins client, profil investisseur et obligations fiscales pour la fiche réglementaire." /></CardHeader>
    <CardContent className="space-y-6">
      {/* Besoins */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>BESOINS EXPRIMÉS</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Santé</div>
            {([["besoinSante_depenses","Dépenses de santé, optique, dentaire"],["besoinSante_hospit","Hospitalisation seule"],["besoinSante_depasse","Dépassements d'honoraires"],["besoinSante_surcompl","Sur-complémentaire"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Prévoyance</div>
            {([["besoinPrev_arret","Maintenir rémunération (arrêt travail, invalidité)"],["besoinPrev_deces","Protéger la famille en cas de décès"],["besoinPrev_fraisGen","Couvrir frais généraux professionnels"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Retraite</div>
            {([["besoinRetraite_capital","Capital pour revenus complémentaires"],["besoinRetraite_rente","Capital retraite à convertir en rente"],["besoinRetraite_moderniser","Moderniser un contrat existant"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="rounded-2xl border-2 p-4 space-y-2" style={{ borderColor: "#dc2626" }}>
            <div className="text-sm font-bold text-center mb-3">Besoin Épargne</div>
            {([["besoinEpargne_valoriser","Valoriser un capital"],["besoinEpargne_transmettre","Transmettre via assurance-vie"],["besoinEpargne_completer","Compléter les revenus"],["besoinEpargne_projet","Épargner pour un projet"]] as [keyof typeof mission, string][]).map(([k, label]) => (
              <label key={String(k)} className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={mission[k] as boolean} onChange={e => updateMission(k, e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#26428B]" />
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
        <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Q1 — Quelles variations pouvez-vous accepter ?</div>
          <div className="grid grid-cols-2 gap-6 items-start">
            {/* Radio options */}
            <div className="space-y-2">
              {([["0","Portefeuille A — Sécurisé"],["8","Portefeuille B — Prudent"],["12","Portefeuille C — Équilibré"],["18","Portefeuille D — Dynamique"]] as [string, string][]).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="attitude" checked={mission.attitude === Number(val)} onChange={() => updateMission("attitude", Number(val) as 0|8|12|18)} className="h-4 w-4 accent-[#26428B]" />
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
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND.sky }}>Q2 — Réaction face à une baisse</div>
          {([["0","Je récupèrerais mon investissement (0 pt)"],["6","J'attendrais — si ça ne s'améliore pas, je vends (6 pts)"],["12","Cela ne me pose pas de problème (12 pts)"],["18","J'augmenterais mon investissement ! (18 pts)"]] as [string, string][]).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="reactionBaisse" checked={mission.reactionBaisse === Number(val)} onChange={() => updateMission("reactionBaisse", Number(val) as 0|6|12|18)} className="h-4 w-4 accent-[#26428B]" />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* Q3 - Connaissances tableau */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
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
                <tr key={String(kC)} className="border-t border-white/50">
                  <td className="py-1.5 pr-3">{label}</td>
                  <td className="text-center"><input type="checkbox" checked={mission[kC] as boolean} onChange={e => updateMission(kC, e.target.checked)} className="h-4 w-4 accent-[#26428B]" /></td>
                  <td className="text-center"><label className="flex items-center justify-center gap-1 cursor-pointer"><input type="checkbox" checked={mission[kI] as boolean} onChange={e => updateMission(kI, e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span className="text-xs text-slate-500">{pts}</span></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Q4 - Pertes/Gains */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-red-700">Q4a — Pertes déjà subies</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.aSubiPertes} onChange={e => updateMission("aSubiPertes", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
              <span>Oui, j'ai subi des pertes</span>
            </label>
            {mission.aSubiPertes && (
              <div className="mt-2 space-y-1.5">
                <div className="text-xs text-slate-500 mb-1">Ampleur :</div>
                {([[-5,"De 0 à -5%"],[-10,"De -6% à -10%"],[-20,"De -11% à -20%"],[-99,"Supérieure à -20%"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="ampleurPertes" checked={mission.ampleurPertes === v} onChange={() => updateMission("ampleurPertes", v)} className="h-3.5 w-3.5 accent-[#26428B]" />
                    <span>{l}</span>
                  </label>
                ))}
                <div className="text-xs text-slate-500 mt-2 mb-1">Réaction :</div>
                {([[1,"J'ai vendu (1 pt)"],[2,"J'ai attendu (2 pts)"],[3,"J'ai réinvesti (3 pts)"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="reactionPertes" checked={mission.reactionPertes === v} onChange={() => updateMission("reactionPertes", v as 0|1|2|3)} className="h-3.5 w-3.5 accent-[#26428B]" />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-green-700">Q4b — Gains déjà réalisés</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.aRealiseGains} onChange={e => updateMission("aRealiseGains", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
              <span>Oui, j'ai réalisé des gains</span>
            </label>
            {mission.aRealiseGains && (
              <div className="mt-2 space-y-1.5">
                <div className="text-xs text-slate-500 mb-1">Ampleur :</div>
                {([[5,"De 0% à 5%"],[10,"De +6% à 10%"],[20,"De +11% à 20%"],[99,"Supérieure à 20%"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="ampleurGains" checked={mission.ampleurGains === v} onChange={() => updateMission("ampleurGains", v)} className="h-3.5 w-3.5 accent-[#26428B]" />
                    <span>{l}</span>
                  </label>
                ))}
                <div className="text-xs text-slate-500 mt-2 mb-1">Réaction :</div>
                {([[1,"J'ai tout vendu (1 pt)"],[2,"J'ai attendu (2 pts)"],[3,"J'ai réinvesti (3 pts)"]] as [number,string][]).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="radio" name="reactionGains" checked={mission.reactionGains === v} onChange={() => updateMission("reactionGains", v as 0|1|2|3)} className="h-3.5 w-3.5 accent-[#26428B]" />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Q5 - Mode gestion */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q5 — Mode de gestion retenu</div>
          <div className="space-y-2">
            {([["pilote","Gestion pilotée — je délègue à des professionnels (2 pts)"],["libre","Gestion libre — je gère moi-même (4 pts)"]] as [string,string][]).map(([v,l]) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="modeGestion" checked={mission.modeGestion === v} onChange={() => updateMission("modeGestion", v)} className="h-4 w-4 accent-[#26428B]" />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Q6 - Connaissances théoriques */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Q6 — Connaissances financières (2 pts chacune)</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.savoirUCRisque} onChange={e => updateMission("savoirUCRisque", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
              <span>Un support en UC présente un risque de perte en capital (Oui = 2 pts)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.savoirHorizonUC} onChange={e => updateMission("savoirHorizonUC", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
              <span>Plus l'horizon est long, plus la part en UC peut être élevée (Oui = 2 pts)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={mission.savoirRisqueRendement} onChange={e => updateMission("savoirRisqueRendement", e.target.checked)} className="h-4 w-4 accent-[#26428B]" />
              <span>Plus le risque est élevé, plus l'espérance de rendement est élevée (Oui = 2 pts)</span>
            </label>
          </div>
        </div>

        {/* Horizon */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: BRAND.sky }}>Horizon de placement</div>
          <div className="flex gap-6 flex-wrap">
            {([["0-4","0 à 4 ans (0 pt)"],["5-8","5 à 8 ans (4 pts)"],["9-15","9 à 15 ans (8 pts)"],["15+","+ de 15 ans (16 pts)"]] as [string, string][]).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="horizon" checked={mission.horizon === val} onChange={() => updateMission("horizon", val)} className="h-4 w-4 accent-[#26428B]" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Score */}
        {(() => {
          const pts = mission.attitude + mission.reactionBaisse +
            (mission.connaitFondsEuros?1:0)+(mission.investiFondsEuros?1:0)+
            (mission.connaitActions?1:0)+(mission.investiActions?3:0)+
            (mission.connaitOPCVM?1:0)+(mission.investiOPCVM?3:0)+
            (mission.connaitImmo?1:0)+(mission.investiImmo?2:0)+
            (mission.connaitTrackers?1:0)+(mission.investiTrackers?3:0)+
            (mission.connaitStructures?1:0)+(mission.investiStructures?4:0)+
            (mission.reactionPertes||0)+(mission.reactionGains||0)+
            (mission.modeGestion==="pilote"?2:mission.modeGestion==="libre"?4:0)+
            (mission.savoirUCRisque?2:0)+(mission.savoirHorizonUC?2:0)+(mission.savoirRisqueRendement?2:0);
          const profil = pts<=10?"Sécuritaire":pts<=20?"Prudent":pts<=40?"Équilibré":pts<=60?"Dynamique":"Offensif";
          const horizonLabel: Record<string, string> = { "0-4": "court terme (0–4 ans)", "5-8": "moyen terme (5–8 ans)", "9-15": "long terme (9–15 ans)", "15+": "très long terme (+ 15 ans)" };
          const profilDesc: Record<string, string> = {
            "Sécuritaire": "La préservation du capital est votre priorité absolue. Votre portefeuille est composé quasi-exclusivement d'actifs sans risque (fonds euros, obligations). Vous acceptez une rentabilité faible en échange d'une garantie du capital.",
            "Prudent": "Vous acceptez une légère exposition aux marchés pour améliorer le rendement, mais la stabilité reste primordiale. Une majorité d'actifs obligataires (70–80%) avec une petite poche actions (20–30%).",
            "Équilibré": "Vous recherchez un compromis entre sécurité et performance. Votre allocation cible est 50/50 entre actifs obligataires et actions. Vous acceptez des fluctuations modérées sur le moyen terme.",
            "Dynamique": "La croissance de votre patrimoine est votre objectif principal. Vous tolérez des variations significatives à court terme pour viser une performance supérieure à long terme. Allocation majoritairement actions (60–80%).",
            "Offensif": "Vous êtes orienté performance maximale et acceptez des variations importantes de votre portefeuille. Une allocation très largement actions (80–100%), avec une vision long terme et une forte tolérance à la volatilité.",
          };
          const profilHorizonNote: Record<string, string> = {
            "Sécuritaire": "Ce profil est adapté à tout horizon, y compris court terme.",
            "Prudent": "Ce profil convient à un horizon de placement d'au moins 3 à 5 ans.",
            "Équilibré": "Ce profil nécessite un horizon de placement d'au moins 5 à 7 ans pour lisser les fluctuations.",
            "Dynamique": "Ce profil est adapté à un horizon long terme de 8 ans minimum pour absorber la volatilité.",
            "Offensif": "Ce profil requiert un horizon très long terme (10 ans et plus) pour optimiser le rapport risque/rendement.",
          };
          const horizonStr = mission.horizon ? horizonLabel[mission.horizon] || "" : "";
          const horizonNote = horizonStr ? ` Avec un horizon de placement ${horizonStr}, ${profil === "Sécuritaire" || profil === "Prudent" ? "ce profil est cohérent avec votre durée d'investissement." : profil === "Équilibré" ? "un profil équilibré est bien adapté à votre durée d'investissement." : "veillez à vous assurer que vous n'aurez pas besoin de ces fonds avant la fin de l'horizon prévu."}` : "";
          return (
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${BRAND.sky}` }}>
              <div className="flex items-center gap-4 px-5 py-3 text-sm font-semibold" style={{ background: BRAND.navy, color: "#E3AF64" }}>
                <span>Score : {pts} pts</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
                <span>Profil déterminé : <strong>{profil}</strong></span>
              </div>
              <div className="px-5 py-4 space-y-2" style={{ background: "rgba(251,236,215,0.25)" }}>
                <p className="text-sm" style={{ color: BRAND.navy }}>{profilDesc[profil]}</p>
                {horizonNote && <p className="text-sm font-medium" style={{ color: BRAND.sky }}>{horizonNote}</p>}
                <p className="text-xs text-slate-500 italic">{profilHorizonNote[profil]}</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Rémunération */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>MODE DE RÉMUNÉRATION</h3>
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
          <p className="text-xs text-slate-500">Sélectionner le mode applicable à cette mission (art. L521-2 code des assurances)</p>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mission.remuCommission} onChange={e => updateMission("remuCommission", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#26428B]" />
            <span>Commission (rémunération incluse dans la prime d'assurance)</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mission.remuHonoraire} onChange={e => updateMission("remuHonoraire", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#26428B]" />
            <span>Honoraire payé directement par le client</span>
          </label>
          {mission.remuHonoraire && (
            <div className="flex items-center gap-2 ml-6">
              <span className="text-sm text-slate-600">Montant / mode de calcul :</span>
              <input type="text" value={mission.remuHonoraireMontant} onChange={e => updateMission("remuHonoraireMontant", e.target.value)}
                placeholder="Ex : 500 € ou 1% du capital"
                className="rounded-lg border px-2 py-1 text-sm flex-1"
                style={{ borderColor: "rgba(227,175,100,0.4)", background: "rgba(255,255,255,0.98)" }} />
            </div>
          )}
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mission.remuMixte} onChange={e => updateMission("remuMixte", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#26428B]" />
            <span>Combinaison honoraire + commission</span>
          </label>
        </div>
      </div>

      {/* Obligations fiscales */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>OBLIGATIONS FISCALES & CONFORMITÉ</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: BRAND.sky }}>Résidence fiscale France</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residenceFranceIR} onChange={e => updateMission("residenceFranceIR", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Imposé à l'IR en France</span></label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residenceFranceIFI} onChange={e => updateMission("residenceFranceIFI", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Imposé à l'IFI en France</span></label>
          </div>
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: BRAND.sky }}>FATCA & PPE</div>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.nationaliteUS} onChange={e => updateMission("nationaliteUS", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Nationalité américaine</span></label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.residentFiscalUS} onChange={e => updateMission("residentFiscalUS", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Résident fiscal USA</span></label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={mission.ppe} onChange={e => updateMission("ppe", e.target.checked)} className="h-4 w-4 accent-[#26428B]" /><span>Personne politiquement exposée</span></label>
          </div>
        </div>
      </div>

      {/* Lieu signature */}
      <div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: BRAND.sky }}>SIGNATURE — LIEU</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm">Fait à :</span>
          <input type="text" value={mission.lieuSignature} onChange={e => updateMission("lieuSignature", e.target.value)}
            className="rounded-xl border px-3 py-1.5 text-sm w-48"
            style={{ borderColor: "rgba(227,175,100,0.4)", background: "rgba(255,255,255,0.98)" }} />
        </div>
      </div>

      <Button className="rounded-xl px-5 py-2 text-sm font-medium shadow-md" style={{ background: BRAND.navy, color: "#fff" }} onClick={showPdfMissionModal}>
        <Download className="mr-2 h-4 w-4" />Générer PDF Lettre de mission
      </Button>

    </CardContent>
  </Card>
</TabsContent>

  );
});

TabMission.displayName = "TabMission";
export { TabMission };
