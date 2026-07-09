import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, FileText, Database, Lightbulb, AlertTriangle, Check } from "lucide-react";
import { useDebouncedAction } from "../../hooks/useDebouncedAction";
import { confirmRemove } from "../../lib/confirmRemove";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, EMPTY_CHARGES_COURANTES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";
import { KpiBandeCollecte, KpiCollecte, ValeurCalculee, ContinuerCollecte, LabelCollecte } from "../collecte/densite";
import { computeBeneficeImposable, resolveBeneficeTns, resolveBeneficeAuReel } from "../../lib/calculs/ir";
import { computeBudget } from "../../lib/calculs/budget";
import { estEligibleMadelin, sommeCotisationsMadelin, plafondMadelinPrevoyance, enveloppeMadelinPrevoyance } from "../../lib/prevoyance/madelin";
import { createEmptyTravail } from "../../lib/prevoyance/utils";
import { referentiels } from "../../data/prevoyance";
import type { PayloadTravailPair } from "../../types/patrimoine";
import { ChargesModal } from "../ChargesModal";


// ── TabRevenus ─────────────────────────────────────────────────────────────────────
const TabRevenus = React.memo(function TabRevenus(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, setData, setChargesDialogOpen, irOptions, setIrOptions, ir, person1, person2, setCollecteSubTab } = props;
  const addPerRente = useDebouncedAction(() => setData(prev => ({ ...prev, perRentes: [...(prev.perRentes || []), { owner: "person1", annualAmount: "", ageAtFirst: "" }] }))); // Lot 8 C2 — anti double-clic

  // ── Madelin (Lot B4) : bénéfice imposable + versements PER par personne, pour
  // alimenter le bloc de synthèse Madelin (lecture/affichage ; le bloc se masque
  // lui-même si la personne n'est pas TNS). ──
  const beneficeMadelin = (which: 1 | 2): number => {
    const groupe = which === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
    const cat = which === 1 ? data.person1Csp : data.person2Csp;
    const isIndep = groupe === "1" || groupe === "2" || isProfessionLiberale(cat);
    if (!isIndep) return 0;
    return computeBeneficeImposable(
      n(which === 1 ? data.ca1 : data.ca2),
      which === 1 ? data.bicType1 : data.bicType2,
      isProfessionLiberale(cat),
      groupe === "1",
      which === 1 ? data.microRegime1 : data.microRegime2,
      n(which === 1 ? data.chargesReelles1 : data.chargesReelles2),
      n(which === 1 ? data.baRevenue1 : data.baRevenue2),
    );
  };
  const versementsPERMadelin = (which: 1 | 2): number =>
    (data.placements || [])
      .filter((p: any) => isPERType(p.type) && p.ownership === (which === 1 ? "person1" : "person2"))
      .reduce((s: number, p: any) => s + n(p.annualContribution || ""), 0);

  // ── Budget du foyer (Lot C) : source UNIQUE = computeBudget. AUCUN recalcul
  // maison ici. useMemo local sur [data, ir] (ir est deja memoise par le parent). ──
  const budget = useMemo(() => computeBudget(data, ir), [data, ir]);

  // Etat local de la modale de detail des charges courantes (UI pure).
  const [chargesModalOpen, setChargesModalOpen] = useState(false);

  // Encart charges courantes : nombre de postes renseignes (barriere douce,
  // "0" compris) pour le badge "total detaille (N postes)".
  const ccDetail = data.chargesCourantesDetail || EMPTY_CHARGES_COURANTES_DETAIL;
  const ccPostesRenseignes = [ccDetail.loyerRP, ccDetail.energie, ccDetail.assurancesPerso, ccDetail.scolarite, ccDetail.transport, ccDetail.autres]
    .filter((v) => String(v ?? "").trim() !== "").length;

  return (
<TabsContent value="revenus" className="space-y-3">
  {/* 1. Bande KPI dense (Lot 10e) : source UNIQUE computeBudget, valeurs ~24px */}
  <KpiBandeCollecte>
    <KpiCollecte label="Revenus /mois"            value={euro(budget.revenusMensuels)}   accent="navy" />
    <KpiCollecte label="Charges /mois"            value={euro(budget.chargesMensuelles)} accent="gold" />
    <KpiCollecte label="Capacité d'épargne /mois" value={euro(budget.capaciteEpargne)}   accent={budget.capaciteEpargne >= 0 ? "green" : "red"} note={budget.hasChargesCourantes ? undefined : "hors charges courantes non renseignées"} />
  </KpiBandeCollecte>

  {/* 2. Cartes personnes — grille 2 colonnes : une par personne (contenu inchange) */}
  <div className="grid gap-3 md:grid-cols-2">
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

    // ── Seconde activite (Lot C cumul salarie + TNS) — champ opt-in type ──
    const sec = (which === 1 ? data.activiteSecondaire1 : data.activiteSecondaire2) ?? "";
    const secKey = which === 1 ? "activiteSecondaire1" : "activiteSecondaire2";
    const secTns = sec === "bic" || sec === "bnc" || sec === "ba";
    const secBa = sec === "ba";
    const secBnc = sec === "bnc";
    // Salaire principal inchange ; le bloc secondaire n'apparait jamais pour un
    // retraite (cumul emploi-retraite = hors perimetre, item Roadmap a creer).
    const montreSalaireSecondaire = isIndep && sec === "salariat";
    const montreTnsSecondaire = !isIndep && !isRetr && secTns;

    // Bloc TNS BIC/BNC EXTRAIT (reutilise en principal ET en secondaire). Nature
    // (isBNCeff) et apercu parametres ; passer les memes noeuds qu'avant => rendu du
    // cas principal strictement identique. Aucune duplication de JSX.
    const renderBicBncBlock = (isBNCeff: boolean, apercuOverride?: React.ReactNode) => {
      const seuilMicro = isBNCeff ? 77700 : (bicTypeVal === "vente" ? 188700 : 77700);
      const depasseSeuil = micro && caNum > 0 && caNum > seuilMicro;
      const detail: ChargesDetail = (which === 1 ? data.chargesDetail1 : data.chargesDetail2) as ChargesDetail || EMPTY_CHARGES_DETAIL;
      const hasDetail = sumChargesDetail(detail) > 0;
      return (
        <>
          {/* Toggle Micro / Réel — switch (ligne compacte) */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: BRAND.muted }}>Régime fiscal</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-medium" style={{ color: micro ? BRAND.sky : BRAND.gold }}>{micro ? "Micro" : "Réel"}</span>
              <button
                role="switch" aria-checked={micro}
                onClick={() => setField(microKey, !micro)}
                className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
                style={{ width: 34, height: 19, background: micro ? BRAND.gold : SURFACE.border, flexShrink: 0 }}
              >
                <span className="absolute rounded-full bg-white shadow transition-all" style={{ width: 15, height: 15, top: 2, left: micro ? 17 : 2 }} />
              </button>
            </label>
          </div>

          {/* Champs en grille (Lot 10e : densite grid) */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 items-end">
            {/* Nature BIC uniquement */}
            {!isBNCeff && (
              <div className="col-span-2">
                <LabelCollecte label="Nature de l'activité BIC" />
                <Select value={bicTypeVal} onValueChange={(v) => setField(bicTypeKey, v)}>
                  <SelectTrigger className="rounded-lg text-sm" style={{ height: 30 }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="services">Prestations de services (abatt. 50%)</SelectItem>
                    <SelectItem value="vente">Achat-revente / commerce (abatt. 71%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* CA / recettes */}
            <div>
              <LabelCollecte
                label={`CA HT${isBNCeff ? " (recettes)" : ""}`}
                tooltip={isBNCeff
                  ? "Recettes brutes HT de l'activité libérale. L'abattement de 34% sera appliqué en régime micro pour obtenir la base imposable."
                  : bicTypeVal === "vente"
                    ? "CA HT annuel. Abattement forfaitaire de 71% en micro pour activités de vente/commerce."
                    : "CA HT annuel. Abattement forfaitaire de 50% en micro pour prestations de services BIC."}
              />
              <Input value={caVal || ""} onChange={(e) => setField(caKey, e.target.value)} className="rounded-lg text-sm" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" />
            </div>
            {/* Charges reelles (regime reel uniquement) */}
            {!micro && (
              <div>
                <LabelCollecte label="Charges pro déductibles" tooltip="Total des charges réelles déductibles. Bouton Détailler : ventilation par nature. Bénéfice imposable = CA − charges." />
                <div className="flex items-stretch gap-1">
                  <Input value={chargesVal || ""} onChange={(e) => setField(chargesKey, e.target.value)} className="rounded-lg text-sm flex-1 min-w-0" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" />
                  <button
                    onClick={() => setChargesDialogOpen(which)}
                    className="flex items-center gap-1 rounded-lg px-2 text-xs font-medium shrink-0"
                    style={{ height: 30, background: hasDetail ? BRAND.navy : "rgba(81,106,199,0.1)", color: hasDetail ? "#fff" : BRAND.sky, border: hasDetail ? "none" : "1px solid rgba(81,106,199,0.2)" }}
                    title="Détailler les charges par nature"
                  >
                    <FileText className="h-3 w-3" />{hasDetail ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : "Détail"}
                  </button>
                </div>
              </div>
            )}
            {/* Benefice (calcule) principal / override secondaire */}
            {apercuOverride !== undefined ? (
              <div className="col-span-2">{apercuOverride}</div>
            ) : (caNum > 0 && abattementInfo) ? (
              <div>
                <LabelCollecte label="Bénéfice imposable" tooltip={abattementInfo} />
                <ValeurCalculee>{beneficeApercu.toLocaleString("fr-FR")} € · calculé</ValeurCalculee>
              </div>
            ) : null}
          </div>

          {depasseSeuil && (
            <div className="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs" style={{ background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.dangerBorder}` }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>CA {caNum.toLocaleString("fr-FR")} € &gt; seuil micro {seuilMicro.toLocaleString("fr-FR")} €. Régime réel obligatoire si dépassement 2 ans consécutifs.</span>
            </div>
          )}
        </>
      );
    };

    // Bloc BA EXTRAIT (idem : reutilise en principal ET en secondaire).
    const renderBaBlock = (apercuOverride?: React.ReactNode) => {
      const caNumBa = n(caVal);
      const depasseBA = micro && caNumBa > 0 && caNumBa > SEUIL_MICRO_BA;
      const apercuBA = micro && caNumBa > 0
        ? `Abattement 87% → base imposable : ${Math.max(0, caNumBa - Math.max(305, caNumBa * 0.87)).toLocaleString("fr-FR")} €`
        : "";
      const apercuNode = apercuOverride !== undefined
        ? apercuOverride
        : (apercuBA ? (
            <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(47,107,58,0.08)", color: BRAND.success, border: "1px dashed #9DBB9A" }}>
              <Lightbulb className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden="true" />{apercuBA}
            </div>
          ) : null);
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
                style={{ width: 34, height: 19, background: micro ? BRAND.gold : SURFACE.border, flexShrink: 0 }}
              >
                <span className="absolute rounded-full bg-white shadow transition-all"
                  style={{ width: 15, height: 15, top: 2, left: micro ? 17 : 2 }} />
              </button>
            </label>
          </div>
          {/* Champ selon régime */}
          {micro ? (
            <>
              <div className="max-w-[240px]">
                <MoneyField
                  label="Recettes HT (année N)"
                  tooltip={`Recettes brutes HT de l'exploitation agricole. Abattement forfaitaire de 87% (min. 305 €). Seuil micro-BA : ${SEUIL_MICRO_BA.toLocaleString("fr-FR")} € (moyenne triennale 2024-2025).`}
                  value={caVal}
                  onChange={(e) => setField(caKey, e.target.value)}
                />
              </div>
              {depasseBA && (
                <div className="flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-xs" style={{ background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.dangerBorder}` }}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Recettes {caNumBa.toLocaleString("fr-FR")} € &gt; seuil micro-BA {SEUIL_MICRO_BA.toLocaleString("fr-FR")} €. Passage au réel obligatoire si dépassement 2 ans consécutifs.</span>
                </div>
              )}
            </>
          ) : (
            <div className="max-w-[240px]">
              <MoneyField
                label="Bénéfice agricole net (BA)"
                tooltip="Bénéfice net de l'exploitation après déduction des charges réelles. Imposable au barème progressif de l'IR."
                value={caVal}
                onChange={(e) => setField(caKey, e.target.value)}
              />
            </div>
          )}
          {apercuNode}
        </>
      );
    };

    // Estimation du benefice imposable pour le bloc TNS secondaire — source unique
    // resolveBeneficeTns (lit deja activiteSecondaire via la garde A du Lot A ;
    // pas de recalcul local). Rien si CA vide/0.
    const estimationSecondaire: React.ReactNode = (() => {
      if (!montreTnsSecondaire) return null;
      const caEff = n(caVal);
      if (caEff <= 0) return null;
      const benef = resolveBeneficeTns(data, which);
      const fmt = benef.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
      const texte = micro
        ? `Abattement micro ${secBa ? 87 : secBnc ? 34 : (bicTypeVal === "vente" ? 71 : 50)} % — bénéfice imposable estimé : ${fmt} €`
        : `Bénéfice imposable estimé : ${fmt} €`;
      return (
        <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(47,107,58,0.08)", color: BRAND.success, border: "1px dashed #9DBB9A" }}>
          <Lightbulb className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden="true" />{texte}
        </div>
      );
    })();

    if (isSansAct) return null; // pas de revenus pro

    // ── Madelin INTEGRE dans la carte personne (Lot 10e) — TNS uniquement. Cotisations
    // + plafonds ; la decomposition Base/Sup (163 quatervicies / 154 bis) + mutualisation
    // 6QR va dans des tooltips riches INTEGRAUX (rien perdu vs l'ancien bloc separe).
    const eurR = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} €`;
    const eligibleMadelin = estEligibleMadelin(data, which);
    const madelinAutre = which === 1 ? data.madelinAutreCotisation1 : data.madelinAutreCotisation2;
    const madelinTotal = eligibleMadelin ? sommeCotisationsMadelin(data, which) : 0;
    const madelinPlafond = eligibleMadelin ? plafondMadelinPrevoyance(beneficeMadelin(which), referentiels.pass.pass.annuel) : 0;
    const madelinEnv = eligibleMadelin ? enveloppeMadelinPrevoyance(madelinTotal, madelinPlafond) : null;
    const plafPER = which === 1 ? (ir.plafondPER1 ?? 0) : (ir.plafondPER2 ?? 0);
    const plafPER163 = which === 1 ? (ir.plafondPER1Base163 ?? 0) : (ir.plafondPER2Base163 ?? 0);
    const plafPER154 = which === 1 ? (ir.plafondPER1Sup154 ?? 0) : (ir.plafondPER2Sup154 ?? 0);
    const perReel = resolveBeneficeAuReel(data, which);
    const versPER = versementsPERMadelin(which);
    const perRestant = Math.max(0, plafPER - versPER);
    const perPct = plafPER > 0 ? Math.min(100, Math.round((versPER / plafPER) * 100)) : 0;
    const persoKeyM = which === 1 ? "p1" : "p2";
    const dejaDeduit = data.travail?.[persoKeyM]?.beneficeDejaDeduitMadelin === true;
    const setDejaDeduit = (next: boolean) => {
      const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs" || data.coupleStatus === "cohab";
      const currentPair: PayloadTravailPair = data.travail ?? { p1: createEmptyTravail(), p2: isCouple ? createEmptyTravail() : null };
      const nextPair: PayloadTravailPair = which === 1
        ? { ...currentPair, p1: { ...currentPair.p1, beneficeDejaDeduitMadelin: next } }
        : { ...currentPair, p2: { ...(currentPair.p2 ?? createEmptyTravail()), beneficeDejaDeduitMadelin: next } };
      setField("travail", nextPair);
    };
    const tipMutualisation = (data.coupleStatus === "married" || data.coupleStatus === "pacs")
      ? " Mutualisation époux/PACS appliquée sur la part revenu global (demande expresse — case 6QR)."
      : "";
    const tipPrevSante = `Enveloppe commune prévoyance-santé (art. 154 bis CGI) : 7 % du PASS + 3,75 % du bénéfice imposable, plafonnée à 3 % de 8 PASS — distincte de l'enveloppe retraite (PER). Plafond ${eurR(madelinPlafond)} · cotisations ${eurR(madelinTotal)}.${madelinEnv?.depasse ? ` Dépassement de ${eurR(madelinEnv.depassement)} : la part au-delà du plafond n'est pas déductible.` : ""}`;
    const tipPER = `Retraite (PER) — pour info (valeurs lues du calcul IR, jamais recalculées ici). Plafond ${eurR(plafPER)} · consommé ${eurR(versPER)}. Décomposition : revenu global — art. 163 quatervicies (versements personnels) ${eurR(plafPER163)}${perReel ? ` ; majoration TNS au réel — art. 154 bis (versements professionnels) ${eurR(plafPER154)}` : " ; régime micro : pas de déduction professionnelle (art. 154 bis) — versements côté personnel uniquement"}.${tipMutualisation} Le plafond personnel (163 quatervicies) se calcule légalement sur les revenus N-1 ; la majoration professionnelle (154 bis) sur le bénéfice N. La majoration TNS (154 bis) reste personnelle : ni mutualisable ni reportable. Reportez-vous à l'avis d'imposition pour le plafond exact (reports des 3 années non modélisés).`;

    // ── Cellules grid4 reutilisables (Lot 10e — format maquette validee) ──
    const detailCharges: ChargesDetail = (which === 1 ? data.chargesDetail1 : data.chargesDetail2) as ChargesDetail || EMPTY_CHARGES_DETAIL;
    const hasDetailCharges = sumChargesDetail(detailCharges) > 0;
    const seuilMicroP = isBNC ? 77700 : (bicTypeVal === "vente" ? 188700 : 77700);
    const depasseSeuilP = isIndep && !isBA && micro && caNum > 0 && caNum > seuilMicroP;
    const inputCls = "rounded-lg text-sm";
    const inputSty = { height: 30, fontWeight: 700 } as const;
    // Seconde activite (selecteur) — cellule de la grille (les sous-blocs restent dessous)
    const secondeCell = !isRetr ? (
      <div>
        <LabelCollecte label="Seconde activité" tooltip="Déclare une seconde source de revenu sur la même personne (cumul salarié + indépendant). Les champs correspondants apparaissent sous la carte ; le calcul IR additionne les deux revenus." />
        <Select value={sec || "none"} onValueChange={(v) => setField(secKey, v === "none" ? "" : v)}>
          <SelectTrigger className="rounded-lg text-sm" style={{ height: 30 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            {isIndep
              ? (<><SelectItem value="none">Aucune</SelectItem><SelectItem value="salariat">Salariat</SelectItem></>)
              : (<><SelectItem value="none">Aucune</SelectItem><SelectItem value="bic">Indépendant — BIC</SelectItem><SelectItem value="bnc">Indépendant — BNC (libéral)</SelectItem><SelectItem value="ba">Exploitant agricole — BA</SelectItem></>)}
          </SelectContent>
        </Select>
      </div>
    ) : <div />;
    // PER : plafond restant + barre (une seule cellule, hauteur alignee sur les inputs)
    const perCell = (
      <div>
        <LabelCollecte label="PER — plafond restant" tooltip={tipPER} />
        <div className="rounded-lg px-2.5 flex flex-col justify-center" style={{ height: 30, background: "rgba(47,107,58,0.08)", border: "1px dashed #9DBB9A" }}>
          <div className="text-[12px] font-semibold leading-none" style={{ color: BRAND.success }}>{eurR(perRestant)}</div>
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "#E9E1CC" }}>
            <div className="h-full" style={{ width: `${perPct}%`, background: BRAND.gold }} />
          </div>
        </div>
      </div>
    );
    // PER versé (lu des placements, lecture seule)
    const perVerseCell = (
      <div>
        <LabelCollecte label="PER — versé" tooltip="Versements PER de l'année, lus des placements (onglet Placements). Réduisent le plafond disponible (art. 163 quatervicies)." />
        <ValeurCalculee>{eurR(versPER)}</ValeurCalculee>
      </div>
    );

    return (
      <div key={which} className="border p-3 space-y-2.5" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 12, boxShadow: SURFACE.cardShadow }}>
        {/* Header : nom + toggle Micro/Réel (TNS) + badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>{personName}</div>
          <div className="flex items-center gap-2">
            {isIndep && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span className="text-[11px] font-medium" style={{ color: micro ? BRAND.sky : BRAND.gold }}>{micro ? (isBA ? "Micro-BA" : "Micro") : "Réel"}</span>
                <button role="switch" aria-checked={micro} onClick={() => setField(microKey, !micro)}
                  className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
                  style={{ width: 32, height: 18, background: micro ? BRAND.gold : SURFACE.border, flexShrink: 0 }}>
                  <span className="absolute rounded-full bg-white shadow transition-all" style={{ width: 14, height: 14, top: 2, left: micro ? 16 : 2 }} />
                </button>
              </label>
            )}
            <div className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isIndep ? "rgba(227,175,100,0.15)" : "rgba(81,106,199,0.1)", color: isIndep ? BRAND.gold : BRAND.sky }}>
              {isBA ? "BA" : isBNC ? "BNC" : isIndep ? "BIC" : isRetr ? "Retraité" : "Salarié"}
            </div>
          </div>
        </div>

        {/* Nature BIC (BIC uniquement) — au-dessus de la grille */}
        {isIndep && !isBA && !isBNC && (
          <div>
            <LabelCollecte label="Nature de l'activité BIC" />
            <Select value={bicTypeVal} onValueChange={(v) => setField(bicTypeKey, v)}>
              <SelectTrigger className="rounded-lg text-sm" style={{ height: 30 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="services">Prestations de services (abatt. 50%)</SelectItem>
                <SelectItem value="vente">Achat-revente / commerce (abatt. 71%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Row 1 grid4 (mise au format maquette) */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-2 items-end">
          {/* SALARIÉ : Salaire | Seconde | PER versé | PER plafond+barre (symétrie carte TNS) */}
          {!isIndep && !isRetr && (<>
            <div>
              <LabelCollecte label="Salaire net imposable" tooltip="Salaire net avant impôt. L'abattement de 10% (ou frais réels) est appliqué dans l'onglet IR." />
              <Input value={salaryVal || ""} onChange={(e) => setField(salaryKey, e.target.value)} className={inputCls} style={inputSty} inputMode="decimal" />
            </div>
            {secondeCell}
            {perVerseCell}
            {perCell}
          </>)}

          {/* RETRAITÉ : Pensions | PER versé | PER plafond+barre */}
          {isRetr && (<>
            <div>
              <LabelCollecte label="Pensions de retraite" tooltip="Total des pensions perçues. Abattement de 10% appliqué automatiquement (plafonné à 4 123 €)." />
              <Input value={data.pensions || ""} onChange={(e) => setField("pensions", e.target.value)} className={inputCls} style={inputSty} inputMode="decimal" />
            </div>
            {perVerseCell}
            {perCell}
            <div />
          </>)}

          {/* TNS BIC/BNC : CA | Charges(réel)/Abattement(micro) | Bénéfice | Seconde */}
          {isIndep && !isBA && (<>
            <div>
              <LabelCollecte label={`CA HT${isBNC ? " (recettes)" : ""}`} tooltip={isBNC ? "Recettes brutes HT de l'activité libérale. Abattement 34% en micro pour la base imposable." : bicTypeVal === "vente" ? "CA HT annuel. Abattement forfaitaire 71% en micro (vente / commerce)." : "CA HT annuel. Abattement forfaitaire 50% en micro (prestations de services BIC)."} />
              <Input value={caVal || ""} onChange={(e) => setField(caKey, e.target.value)} className={inputCls} style={inputSty} inputMode="decimal" />
            </div>
            {!micro ? (
              <div>
                <LabelCollecte label="Charges pro déductibles" tooltip="Total des charges réelles déductibles. Bouton Détail : ventilation par nature. Bénéfice = CA − charges." />
                <div className="flex items-stretch gap-1">
                  <Input value={chargesVal || ""} onChange={(e) => setField(chargesKey, e.target.value)} className="rounded-lg text-sm flex-1 min-w-0" style={inputSty} inputMode="decimal" />
                  <button onClick={() => setChargesDialogOpen(which)} className="flex items-center gap-1 rounded-lg px-2 text-xs font-medium shrink-0" style={{ height: 30, background: hasDetailCharges ? BRAND.navy : "rgba(81,106,199,0.1)", color: hasDetailCharges ? "#fff" : BRAND.sky, border: hasDetailCharges ? "none" : "1px solid rgba(81,106,199,0.2)" }} title="Détailler les charges par nature">
                    <FileText className="h-3 w-3" />{hasDetailCharges ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : "Détail"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <LabelCollecte label="Abattement micro" tooltip={abattementInfo || "Abattement forfaitaire du régime micro."} />
                <ValeurCalculee>{isBNC ? "34 %" : bicTypeVal === "vente" ? "71 %" : "50 %"}</ValeurCalculee>
              </div>
            )}
            <div>
              <LabelCollecte label="Bénéfice imposable" tooltip={abattementInfo || "Bénéfice imposable calculé (CA − charges, ou après abattement en micro)."} />
              <ValeurCalculee>{caNum > 0 ? `${beneficeApercu.toLocaleString("fr-FR")} € · calculé` : "—"}</ValeurCalculee>
            </div>
            {secondeCell}
          </>)}

          {/* BA (agriculteur) : Recettes/Bénéfice | Bénéfice(micro) | Seconde */}
          {isBA && (<>
            <div>
              <LabelCollecte label={micro ? "Recettes HT (N)" : "Bénéfice agricole net"} tooltip={micro ? `Recettes brutes HT. Abattement 87% (min. 305 €). Seuil micro-BA ${SEUIL_MICRO_BA.toLocaleString("fr-FR")} €.` : "Bénéfice net de l'exploitation après charges réelles. Imposable au barème progressif."} />
              <Input value={caVal || ""} onChange={(e) => setField(caKey, e.target.value)} className={inputCls} style={inputSty} inputMode="decimal" />
            </div>
            {micro ? (
              <div>
                <LabelCollecte label="Bénéfice imposable" tooltip="Base imposable = recettes − abattement 87% (min. 305 €)." />
                <ValeurCalculee>{n(caVal) > 0 ? `${Math.max(0, n(caVal) - Math.max(305, n(caVal) * 0.87)).toLocaleString("fr-FR")} € · calculé` : "—"}</ValeurCalculee>
              </div>
            ) : <div />}
            {secondeCell}
          </>)}
        </div>

        {/* Alerte depassement seuil micro (BIC/BNC) — pleine largeur */}
        {depasseSeuilP && (
          <div className="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs" style={{ background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.dangerBorder}` }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>CA {caNum.toLocaleString("fr-FR")} € &gt; seuil micro {seuilMicroP.toLocaleString("fr-FR")} €. Régime réel obligatoire si dépassement 2 ans consécutifs.</span>
          </div>
        )}

        {/* Row 2 grid4 — Madelin (TNS) : cotisation | prévoyance-santé | PER plafond+barre | déjà net */}
        {eligibleMadelin && (
          <div className="pt-2.5 space-y-2" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND.gold }}>Madelin — déduction prévoyance</div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-2 items-end">
              <div>
                <LabelCollecte label="Cotisation Madelin (€)" tooltip="Cotisations Madelin prévoyance-santé de l'année (contrats marqués Madelin + cette saisie), déductibles dans l'enveloppe art. 154 bis CGI." />
                <Input type="number" min={0} value={madelinAutre ?? ""} onChange={(e) => setField("madelinAutreCotisation" + which, Number(e.target.value) || 0)} className="rounded-lg text-sm" style={{ height: 30 }} placeholder="ex. 600" />
              </div>
              <div>
                <LabelCollecte label="Prévoyance-santé déduct." tooltip={tipPrevSante} />
                <ValeurCalculee>{eurR(madelinEnv?.deductible ?? 0)}{madelinEnv?.depasse ? " · plafond" : ""}</ValeurCalculee>
              </div>
              {perCell}
              <div>
                <LabelCollecte label="Bénéfice déjà net ?" tooltip="Cochez si vous avez déjà déduit les cotisations Madelin du bénéfice renseigné — sinon Ploutos applique la déduction (art. 154 bis)." />
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none" style={{ height: 30, color: BRAND.navy }}>
                  <input type="checkbox" checked={dejaDeduit} onChange={(e) => setDejaDeduit(e.target.checked)} />
                  <span>Déjà net</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Blocs secondaires — la seconde activite est selectionnee dans la grille ci-dessus ;
            les champs correspondants apparaissent ici (cumul salarie + TNS). */}
        {!isRetr && montreSalaireSecondaire && (
          <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(81,106,199,0.04)", border: `1px solid ${SURFACE.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND.sky }}>Activité secondaire — Salariat</div>
            <div className="max-w-[240px]">
              <MoneyField label="Salaire net imposable" tooltip="Salaire net avant impôt de l'activité salariée secondaire. L'abattement de 10% (ou frais réels) est appliqué dans l'onglet IR." value={salaryVal} onChange={(e) => setField(salaryKey, e.target.value)} />
            </div>
          </div>
        )}
        {!isRetr && montreTnsSecondaire && (
          <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(227,175,100,0.06)", border: `1px solid ${SURFACE.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND.gold }}>Activité secondaire — {secBa ? "BA" : secBnc ? "BNC" : "BIC"}</div>
            {secBa ? renderBaBlock(estimationSecondaire) : renderBicBncBlock(secBnc, estimationSecondaire)}
          </div>
        )}
      </div>
    );
  })}

  </div>{/* fin grid 2 colonnes */}

  {/* 3. Autres revenus & charges + Budget cote a cote (Lot 10e : format maquette grid2).
      items-stretch => les deux cartes partagent TOUJOURS la meme hauteur (celle de la plus
      haute), hauteur commune variable selon le contenu (demande David : rentes PER, etc.). */}
  <div className="grid gap-3 md:grid-cols-2 items-stretch">

  {/* Colonne gauche : Autres revenus & charges du foyer */}
  <div className="border p-3 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Autres revenus &amp; charges du foyer</div>

    {/* Revenus & charges a plat — grille dense grid4 (labels 11px, inputs 30px). Unites
        dans les libelles (remplace le suffixe EUR des anciens MoneyField). Pensions et
        deductibles regroupees ; aucun champ supprime. */}
    <div className="grid grid-cols-4 gap-x-2 gap-y-2 items-end">
      {!isRetraite(data.person1PcsGroupe) && (
        <div>
          <LabelCollecte label={`Pensions /an — ${person1}`} tooltip="Retraite, pension complémentaire, rente. Abattement de 10% appliqué automatiquement (plafonné à 4 123 €)." />
          <Input value={data.pensions1 || ""} onChange={(e) => setField("pensions1", e.target.value)} className="rounded-lg text-sm" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" placeholder="0" />
        </div>
      )}
      {!isRetraite(data.person2PcsGroupe) && (data.person2FirstName || data.person2LastName) && (
        <div>
          <LabelCollecte label={`Pensions /an — ${person2 || "Personne 2"}`} tooltip="Retraite, pension complémentaire, rente. Abattement de 10% appliqué automatiquement (plafonné à 4 123 €)." />
          <Input value={data.pensions2 || ""} onChange={(e) => setField("pensions2", e.target.value)} className="rounded-lg text-sm" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" placeholder="0" />
        </div>
      )}
      <div>
        <LabelCollecte label="Pension alim. versée /an" tooltip="Pensions alimentaires versées à un enfant majeur ou à un ex-conjoint, déductibles du revenu global sous conditions." />
        <Input value={data.pensionDeductible || ""} onChange={(e) => setField("pensionDeductible", e.target.value)} className="rounded-lg text-sm" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" placeholder="0" />
      </div>
      <div>
        <LabelCollecte label="Autres charges déduct. /an" tooltip="Autres déductions du revenu global : épargne retraite PERP, déduction épargne handicap, etc. Les cotisations Madelin ont leur poste dédié dans les cartes personnes ci-dessus." />
        <Input value={data.otherDeductible || ""} onChange={(e) => setField("otherDeductible", e.target.value)} className="rounded-lg text-sm" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" placeholder="0" />
      </div>
      <div>
        <LabelCollecte label="CSG fonciers N-1 /an (6DE)" tooltip="CSG déductible sur les revenus fonciers de l'année précédente (6,8% des revenus fonciers nets N-1). Ligne 6DE de l'avis d'imposition — à reporter directement." />
        <Input value={data.csgDeductibleFoncier || ""} onChange={(e) => setField("csgDeductibleFoncier", e.target.value)} className="rounded-lg text-sm" style={{ height: 30, fontWeight: 700 }} inputMode="decimal" placeholder="0" />
      </div>
    </div>

    {/* Rentes PER — Phase de rente (sous-bloc, contenu inchange) */}
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest flex items-center" style={{ color: BRAND.sky }}>
          Rentes PER — Phase de rente
          <HelpTooltip label="Rentes PER" text="Les rentes PER sont imposées selon le régime des rentes viagères à titre onéreux (RVTO, art. 158-6 CGI) : seule une fraction est imposable au barème selon l'âge au 1er versement — moins de 50 ans : 70 % · 50-59 ans : 50 % · 60-69 ans : 40 % · 70 ans et plus : 30 %. Les prélèvements sociaux (17,2 %) portent sur cette même fraction." />
        </div>
        <Button variant="outline" className="h-7 rounded-xl px-3 text-xs"
          onClick={addPerRente}>
          <Plus className="mr-1 h-3 w-3" />Ajouter une rente
        </Button>
      </div>
      {(!data.perRentes || data.perRentes.length === 0) && (
        <div className="text-xs text-slate-400 italic">Aucune rente PER déclarée.</div>
      )}
      {(data.perRentes || []).map((rente, ri) => {
        const montant = n(rente.annualAmount || "");
        const age = Math.max(0, n(rente.ageAtFirst || "0"));
        const fraction = fractionRVTO(age);
        const imposable = montant * fraction;
        const ps = imposable * 0.172;
        return (
          <div key={ri} className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
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
                <Button variant="outline" aria-label="Supprimer la rente" className="h-8 w-8 rounded-xl p-0" onClick={() => confirmRemove(!!(rente.annualAmount || rente.ageAtFirst), "la rente", () => setData(prev => ({ ...prev, perRentes: prev.perRentes.filter((_, i) => i !== ri) })))}>
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

    {/* Encart charges courantes : UNE ligne (label + montant/detail + bouton Detailler) */}
    <div className="rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap" style={{ background: "rgba(81,106,199,0.06)", border: "1px solid rgba(81,106,199,0.15)" }}>
      <div className="text-xs font-semibold shrink-0" style={{ color: BRAND.navy }} title="Charges courantes mensuelles du foyer (loyer, énergie, assurances, scolarité, transport…).">Charges courantes (train de vie)</div>
      {ccPostesRenseignes > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(38,66,139,0.1)", color: BRAND.sky }}>
            total détaillé ({ccPostesRenseignes} poste{ccPostesRenseignes > 1 ? "s" : ""})
          </span>
          <span className="text-sm font-bold" style={{ color: BRAND.navy }}>{euro(budget.detail.chargesCourantes)}/mois</span>
        </div>
      ) : (
        <div className="relative" style={{ width: 190 }}>
          <Input
            value={data.chargesCourantes || ""}
            onChange={(e) => setField("chargesCourantes", e.target.value)}
            placeholder="Montant"
            className="rounded-xl h-8 text-sm text-right pr-12"
            style={{ fontWeight: 700 }}
            inputMode="decimal"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">€/mois</span>
        </div>
      )}
      <button
        onClick={() => setChargesModalOpen(true)}
        className="ml-auto shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors"
        style={{ background: ccPostesRenseignes > 0 ? BRAND.navy : "rgba(81,106,199,0.1)", color: ccPostesRenseignes > 0 ? "#fff" : BRAND.sky, border: ccPostesRenseignes > 0 ? "none" : "1px solid rgba(81,106,199,0.2)", whiteSpace: "nowrap" }}
        title="Détailler les charges courantes par poste"
      >
        <FileText className="h-3 w-3" />
        {ccPostesRenseignes > 0 ? <>Détail <Check className="inline-block h-3.5 w-3.5 align-text-bottom" aria-hidden="true" /></> : "Détailler"}
      </button>
    </div>

  </div>{/* fin colonne gauche : Autres revenus & charges */}

  {/* Colonne droite : Budget du foyer — detail du calcul (lecture seule, source computeBudget) */}
  <div className="border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Budget du foyer — détail du calcul</div>
    <div className="text-xs" style={{ color: BRAND.muted }}>Montants mensuels.</div>
    {(() => {
      const d = budget.detail;
      const ligne = (label: string, valeur: number, opts: { total?: boolean; couleur?: string } = {}) => (
        <div key={label} className="flex items-center justify-between py-1" style={opts.total ? { borderTop: `1px solid ${SURFACE.border}`, marginTop: 2, paddingTop: 5 } : undefined}>
          <span className="text-xs" style={{ color: opts.total ? BRAND.navy : BRAND.muted, fontWeight: opts.total ? 700 : 400 }}>{label}</span>
          <span className="text-xs" style={{ color: opts.couleur || BRAND.navy, fontWeight: opts.total ? 700 : 500 }}>{euro(valeur)}</span>
        </div>
      );
      return (
        <div className="grid gap-x-6 md:grid-cols-2">
          {/* Colonne REVENUS */}
          <div className="space-y-0.5">
            {ligne("Salaires + pensions", d.salairesPensions)}
            {ligne("Bénéfice TNS", d.beneficeTns)}
            {ligne("Rentes PER", d.rentesPer)}
            {ligne("Loyers bruts (100 %)", d.loyersBruts)}
            {ligne("Retraits AV / PER", d.retraitsAvPer)}
            {ligne("Revenus du foyer", budget.revenusMensuels, { total: true })}
          </div>
          {/* Colonne CHARGES */}
          <div className="space-y-0.5">
            {ligne("Charges courantes", d.chargesCourantes)}
            {ligne("Charges foncières", d.chargesFoncieres)}
            {ligne("Crédits + assurances", d.creditsAssurances)}
            {ligne("Impôts calculés (IR tout compris)", d.impots)}
            {ligne("Pension versée", d.pensionVersee)}
            {ligne("Charges du foyer", budget.chargesMensuelles, { total: true })}
            {ligne("Capacité d'épargne", budget.capaciteEpargne, { total: true, couleur: budget.capaciteEpargne >= 0 ? BRAND.success : BRAND.danger })}
          </div>
        </div>
      );
    })()}
    {!budget.hasChargesCourantes && (
      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Capacité d'épargne calculée hors charges courantes non renseignées.
      </div>
    )}
  </div>

  </div>{/* fin grid2 : autres revenus & charges + budget */}

  {/* Bouton discret « Continuer -> Immobilier » (Lot 10e) */}
  {setCollecteSubTab && <ContinuerCollecte label="Immobilier" onClick={() => setCollecteSubTab("immobilier")} />}

  {/* Modale de detail des charges courantes (Lot B) */}
  <ChargesModal open={chargesModalOpen} onClose={() => setChargesModalOpen(false)} data={data} setField={setField} />
</TabsContent>

  );
});

TabRevenus.displayName = "TabRevenus";
export { TabRevenus };
