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


// ── TabParametres ─────────────────────────────────────────────────────────────────────
const TabParametres = React.memo(function TabParametres(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { cabinet, updateCabinet, logoSrc, setLogoSrc, signatureSrc, setSignatureSrc, handleLogoUpload, handleSignatureUpload } = props;

  return (
<TabsContent value="parametres" className="space-y-6">
  <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
    <CardHeader><SectionTitle icon={Settings} title="Paramètres cabinet" subtitle="Identité, coordonnées légales, visuels et couleurs pour tous les documents PDF." /></CardHeader>
    <CardContent className="space-y-6">

      {/* ── Logo & Signature ── */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>IDENTITÉ VISUELLE</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Logo du cabinet</div>
            <label className="cursor-pointer group relative inline-block" title="Cliquer pour changer le logo">
              <img src={logoSrc} alt="Logo" className="h-20 w-auto object-contain rounded-lg transition-opacity group-hover:opacity-60" style={{ background: "#fff", padding: "6px", border: "1px solid #eee" }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: BRAND.navy, color: "#fff" }}>
                  <Upload className="inline h-3 w-3 mr-1" />Changer
                </div>
              </div>
              <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
            </label>
            <p className="text-xs text-slate-400">Cliquez sur le logo pour le remplacer</p>
          </div>
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8f6f7", border: "1px solid rgba(227,175,100,0.22)" }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.sky }}>Signature du conseiller</div>
            <div className="flex items-center gap-4">
              {signatureSrc
                ? <img src={signatureSrc} alt="Signature" className="h-14 w-auto object-contain rounded-lg" style={{ background: "#fff", padding: "4px", border: "1px solid #eee" }} />
                : <div className="h-14 w-32 rounded-lg flex items-center justify-center text-xs text-slate-400" style={{ background: "#fff", border: "1px dashed #ccc" }}>Aucune signature</div>
              }
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition hover:opacity-90"
                style={{ background: BRAND.sky, color: "#fff" }}>
                <Upload className="h-4 w-4" />Charger signature
                <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleSignatureUpload} />
              </label>
              {signatureSrc && (
                <button onClick={() => setSignatureSrc("")} className="text-xs text-red-500 hover:text-red-700">Supprimer</button>
              )}
            </div>
            <p className="text-xs text-slate-400">Formats acceptés : PNG, JPEG, SVG, WebP — fond transparent recommandé</p>
          </div>
        </div>
      </div>

      {/* ── Couleurs ── */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>COULEURS DU CABINET (PDF)</h3>
        <div className="grid grid-cols-5 gap-3">
          {([
            ["colorNavy","Couleur principale (navy)"],
            ["colorSky","Couleur secondaire (sky)"],
            ["colorBlue","Accent bleu"],
            ["colorGold","Or / accent"],
            ["colorCream","Fond clair"],
          ] as [string, string][]).map(([key, label]) => (
            <div key={String(key)} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-md" style={{ background: cabinet[key] }} />
              <label className="text-xs text-center text-slate-600 cursor-pointer">
                {label}
                <input type="color" value={cabinet[key]} onChange={e => updateCabinet(key, e.target.value)} className="sr-only" />
              </label>
              <input type="text" value={cabinet[key]} onChange={e => updateCabinet(key, e.target.value)}
                className="w-20 text-center rounded-lg border px-1 py-0.5 text-xs font-mono"
                style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }} />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Ces couleurs sont utilisées dans les en-têtes et éléments graphiques des PDF générés.</p>
      </div>

      {/* ── Coordonnées légales ── */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: BRAND.sky }}>COORDONNÉES & MENTIONS LÉGALES</h3>
        <div className="grid grid-cols-2 gap-4">
          {([
            ["nom","Nom du cabinet"],["forme","Forme juridique"],
            ["rcs","Numéro RCS"],["villeRcs","Ville RCS"],
            ["adresse","Adresse"],["codePostal","Code postal"],
            ["ville","Ville"],["tel","Téléphone"],
            ["email","Email"],["conseiller","Nom du conseiller"],
            ["orias","Numéro ORIAS"],["rcpAssureur","Assureur RCP"],
            ["rcpContrat","N° contrat RCP"],
          ] as [string, string][]).map(([key, label]) => (
            <div key={String(key)}>
              <Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>{label}</Label>
              <Input value={cabinet[key]} onChange={e => updateCabinet(key, e.target.value)} className="rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>Partenaires assurance</Label>
            <Input value={cabinet.partenaires} onChange={e => updateCabinet("partenaires", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
          <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>Médiateur</Label>
            <Input value={cabinet.mediateur} onChange={e => updateCabinet("mediateur", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
          <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>URL médiateur</Label>
            <Input value={cabinet.mediateurUrl} onChange={e => updateCabinet("mediateurUrl", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
          <div><Label className="text-xs font-semibold tracking-wide mb-1 block" style={{ color: BRAND.sky }}>Adresse postale médiateur</Label>
            <Input value={cabinet.mediateurAdresse} onChange={e => updateCabinet("mediateurAdresse", e.target.value)} className="rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(227,175,100,0.28)" }} /></div>
        </div>
      </div>

      <div className="rounded-2xl p-4 text-sm" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
        <p className="font-semibold mb-2" style={{ color: BRAND.navy }}>💡 Ces paramètres alimentent automatiquement :</p>
        <ul className="list-disc ml-4 space-y-1 text-sm" style={{ color: "#555" }}>
          <li>Page de couverture de tous les PDFs (logo)</li>
          <li>Page "Qui sommes-nous ?" de la Lettre de mission</li>
          <li>Section réclamation et médiation</li>
          <li>Politique de confidentialité RGPD</li>
          <li>Page de signature (conseiller + signature visuelle)</li>
          <li>Couleurs des en-têtes et éléments graphiques PDF</li>
        </ul>
      </div>

    </CardContent>
  </Card>
</TabsContent>

  );
});

TabParametres.displayName = "TabParametres";
export { TabParametres };
