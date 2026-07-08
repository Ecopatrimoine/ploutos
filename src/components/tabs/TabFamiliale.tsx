import React from "react";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, Users, Accessibility, Check, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";

// Barriere douce (B1) : au-dela de 25 ans, un enfant est de-rattache automatiquement
// a la saisie de sa date de naissance. SENS UNIQUE (jamais de re-rattachement auto),
// seuil STRICT (> 25 ; 25 pile ne declenche rien) ; date vide/invalide -> false.
export function doitDeRattacher(iso: string): boolean {
  const age = getAgeFromBirthDate(iso);
  return age !== null && age > 25;
}

// ── TabFamiliale ─────────────────────────────────────────────────────────────────────
const TabFamiliale = React.memo(function TabFamiliale(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, addChild, updateChild, removeChild, person1, person2 } = props;
  // Foyer mono-adulte (celibataire) : un seul parent -> le choix de parente enfant
  // n'a pas de sens. On masque le selecteur et on affiche un libelle statique.
  const isMonoAdulte = data.coupleStatus === "single";

  return (
<TabsContent value="famille" className="space-y-6">
  <Card className="border-0" style={{ borderRadius: 20 }}>
    <CardHeader><SectionTitle icon={Users} title="Données familiales" subtitle="Identité, situation du couple et enfants à charge" /></CardHeader>
    <CardContent className="space-y-6">
  {/* ─── Lot Dossier client — Coordonnées du foyer (adresse postale) ──
       Utilisée par la fiche conseil DDA (bandeau identité client) et par
       les pages de contact des documents réglementaires. ─── */}
  <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
    <div className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND.navy }}>Coordonnées du foyer</div>
    <div className="grid gap-3 grid-cols-4">
      <div className="col-span-2">
        <Field label="Adresse"><Input value={data.adresse || ""} onChange={(e) => setField("adresse", e.target.value)} placeholder="ex : 12 rue des Lilas" className="rounded-xl" /></Field>
      </div>
      <Field label="Code postal"><Input value={data.codePostal || ""} onChange={(e) => setField("codePostal", e.target.value)} placeholder="66000" className="rounded-xl" /></Field>
      <Field label="Ville"><Input value={data.ville || ""} onChange={(e) => setField("ville", e.target.value)} placeholder="Perpignan" className="rounded-xl" /></Field>
    </div>
  </div>

  {/* Deux personnes côte à côte */}
  <div className="grid gap-4 md:grid-cols-2">
    {/* Personne 1 */}
    <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND.navy }}>Personne 1</div>
      <div className="grid gap-3 grid-cols-2">
        <Field label="Prénom"><Input value={data.person1FirstName} onChange={(e) => setField("person1FirstName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Nom"><Input value={data.person1LastName} onChange={(e) => setField("person1LastName", e.target.value)} className="rounded-xl" /></Field>
      </div>
      <Field label="Date de naissance">
        <div className="flex items-center gap-2">
          <DateFr value={data.person1BirthDate} onChange={(iso) => setField("person1BirthDate", iso || "")} className="rounded-xl flex-1" />
          {data.person1BirthDate && getAgeFromBirthDate(data.person1BirthDate) !== null && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0" style={{ background: BRAND.cream, color: BRAND.goldText, border: `1px solid ${BRAND.warningBorder}` }}>
              {getAgeFromBirthDate(data.person1BirthDate)} ans
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button role="switch" aria-checked={!!data.person1Handicap}
              title="Handicap (carte invalidité / CMI). Impact IR : abattement + demi-part. Succession : +159 325 €."
              onClick={() => setField("person1Handicap", !data.person1Handicap)}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: data.person1Handicap ? BRAND.gold : SURFACE.border }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: data.person1Handicap ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs whitespace-nowrap" style={{ color: data.person1Handicap ? BRAND.warning : BRAND.muted }}>
              {data.person1Handicap ? <><Accessibility className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Handicap</> : "Handicap"}
            </span>
          </div>
        </div>
      </Field>
      {/* État civil détaillé (Lot 8a — exigence DDA lettre de mission) */}
      <div className="grid gap-3 grid-cols-2">
        <Field label="Nom de naissance">
          <Input value={data.person1NomNaissance || ""} onChange={(e) => setField("person1NomNaissance", e.target.value)} placeholder="si différent du nom d'usage" className="rounded-xl" />
        </Field>
        <Field label="Nationalité">
          <Input value={data.person1Nationalite || ""} onChange={(e) => setField("person1Nationalite", e.target.value)} placeholder="ex : française" className="rounded-xl" />
        </Field>
      </div>
      <Field label="Lieu de naissance">
        <Input value={data.person1LieuNaissance || ""} onChange={(e) => setField("person1LieuNaissance", e.target.value)} placeholder="ville (département / pays si étranger)" className="rounded-xl" />
      </Field>
    </div>
    {/* Personne 2 */}
    <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND.navy }}>Personne 2</div>
      <div className="grid gap-3 grid-cols-2">
        <Field label="Prénom"><Input value={data.person2FirstName} onChange={(e) => setField("person2FirstName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Nom"><Input value={data.person2LastName} onChange={(e) => setField("person2LastName", e.target.value)} className="rounded-xl" /></Field>
      </div>
      <Field label="Date de naissance">
        <div className="flex items-center gap-2">
          <DateFr value={data.person2BirthDate} onChange={(iso) => setField("person2BirthDate", iso || "")} className="rounded-xl flex-1" />
          {data.person2BirthDate && getAgeFromBirthDate(data.person2BirthDate) !== null && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0" style={{ background: BRAND.cream, color: BRAND.goldText, border: `1px solid ${BRAND.warningBorder}` }}>
              {getAgeFromBirthDate(data.person2BirthDate)} ans
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button role="switch" aria-checked={!!data.person2Handicap}
              title="Handicap (carte invalidité / CMI). Impact IR : abattement + demi-part. Succession : +159 325 €."
              onClick={() => setField("person2Handicap", !data.person2Handicap)}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: data.person2Handicap ? BRAND.gold : SURFACE.border }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: data.person2Handicap ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs whitespace-nowrap" style={{ color: data.person2Handicap ? BRAND.warning : BRAND.muted }}>
              {data.person2Handicap ? <><Accessibility className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Handicap</> : "Handicap"}
            </span>
          </div>
        </div>
      </Field>
      {/* État civil détaillé (Lot 8a) */}
      <div className="grid gap-3 grid-cols-2">
        <Field label="Nom de naissance">
          <Input value={data.person2NomNaissance || ""} onChange={(e) => setField("person2NomNaissance", e.target.value)} placeholder="si différent du nom d'usage" className="rounded-xl" />
        </Field>
        <Field label="Nationalité">
          <Input value={data.person2Nationalite || ""} onChange={(e) => setField("person2Nationalite", e.target.value)} placeholder="ex : française" className="rounded-xl" />
        </Field>
      </div>
      <Field label="Lieu de naissance">
        <Input value={data.person2LieuNaissance || ""} onChange={(e) => setField("person2LieuNaissance", e.target.value)} placeholder="ville (département / pays si étranger)" className="rounded-xl" />
      </Field>
    </div>
  </div>
  {/* Situation couple sur une ligne (4 champs) */}
  <div className="grid gap-4 md:grid-cols-4">
    <Field label="Situation de couple">
      <Select value={data.coupleStatus} onValueChange={(v) => setField("coupleStatus", v)}>
        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>{COUPLE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field label="Régime matrimonial">
      <Select value={data.matrimonialRegime} onValueChange={(v) => setField("matrimonialRegime", v)} disabled={data.coupleStatus !== "married"}>
        <SelectTrigger className={`rounded-xl ${data.coupleStatus !== "married" ? "bg-slate-100 text-slate-400" : ""}`}><SelectValue /></SelectTrigger>
        <SelectContent>{MATRIMONIAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field label="Date de mariage / PACS">
      <DateFr
        value={data.dateMariage ?? ""}
        onChange={(iso) => setField("dateMariage", iso || null)}
        disabled={data.coupleStatus !== "married" && data.coupleStatus !== "pacs"}
        className={`rounded-xl ${data.coupleStatus !== "married" && data.coupleStatus !== "pacs" ? "bg-slate-100 text-slate-400" : ""}`}
      />
    </Field>
    <Field label="Parent isolé">
      <Select value={data.singleParent ? "yes" : "no"} onValueChange={(v) => setField("singleParent", v === "yes")}>
        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="no">Non</SelectItem><SelectItem value="yes">Oui</SelectItem></SelectContent>
      </Select>
    </Field>

  </div>
  {/* Enfants */}
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Enfants</h3>
      <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={addChild}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>
    </div>
    {data.childrenData.length === 0 && <div className="text-sm" style={{ color: BRAND.muted }}>Aucun enfant saisi.</div>}
    {data.childrenData.map((child, index) => (
      <div key={index} className="grid gap-3 border p-4 md:grid-cols-[1fr_1fr_1.2fr_1.3fr_1fr_1fr_1fr_auto_auto]" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
        <Field label="Prénom"><Input value={child.firstName} onChange={(e) => updateChild(index, "firstName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Nom"><Input value={child.lastName} onChange={(e) => updateChild(index, "lastName", e.target.value)} className="rounded-xl" /></Field>
        <Field label="Date de naissance">
          <div className="flex items-center gap-1.5">
            <DateFr
              value={child.birthDate}
              onChange={(iso) => {
                const v = iso || "";
                updateChild(index, "birthDate", v);
                // Au-dela de 25 ans : de-rattachement auto (reversible via le toggle Foyer fiscal).
                if (doitDeRattacher(v)) updateChild(index, "rattached", false);
              }}
              className="rounded-xl flex-1"
            />
            {child.birthDate && getAgeFromBirthDate(child.birthDate) !== null && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: BRAND.cream, color: BRAND.goldText, border: `1px solid ${BRAND.warningBorder}` }}>
                {getAgeFromBirthDate(child.birthDate)}
              </span>
            )}
          </div>
        </Field>
        <Field label="Parenté">
          {isMonoAdulte ? (
            <div className="rounded-xl px-2 py-1.5 text-xs" style={{ color: BRAND.muted }}>Enfant de {person1}</div>
          ) : (
            <Select value={child.parentLink} onValueChange={(v) => updateChild(index, "parentLink", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{CHILD_LINKS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Garde">
          <Select value={child.custody} onValueChange={(v) => updateChild(index, "custody", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{CUSTODY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Foyer fiscal" tooltip="Enfant rattaché : compte dans les parts fiscales du foyer. Enfant non rattaché (majeur indépendant) : ne génère plus de parts mais peut donner droit à une pension déductible.">
          <button
            onClick={() => updateChild(index, "rattached", !(child.rattached !== false))}
            className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium w-full"
            style={{
              background: child.rattached !== false ? "rgba(81,106,199,0.1)" : BRAND.dangerBg,
              color: child.rattached !== false ? BRAND.sky : BRAND.danger,
              border: `1px solid ${child.rattached !== false ? "rgba(81,106,199,0.2)" : BRAND.dangerBorder}`,
            }}
          >
            {child.rattached !== false ? <><Check className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Rattaché</> : <><X className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> Non rattaché</>}
          </button>
        </Field>

        <Field label="Handicap" tooltip="Carte invalidité / CMI. Impact IR : +0,5 part (0,25 si alternée). Succession : +159 325 € d'abattement cumulable.">
          <div className="flex items-center gap-1.5 h-9">
            <button role="switch" aria-checked={!!child.handicap}
              onClick={() => updateChild(index, "handicap", !child.handicap)}
              className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
              style={{ background: child.handicap ? BRAND.gold : SURFACE.border }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: child.handicap ? "translateX(13px)" : "translateX(2px)" }} />
            </button>
            <span className="text-xs" style={{ color: child.handicap ? BRAND.warning : BRAND.muted }}>
              {child.handicap ? <Accessibility className="h-3.5 w-3.5 inline-block" aria-hidden="true" /> : "—"}
            </span>
          </div>
        </Field>
        <Field label="Niveau scolaire" tooltip="Forfait scolaire art. 199 quater B — réduction d'impôt : collège 61 €/an · lycée 153 €/an · supérieur 183 €/an. Uniquement pour les enfants rattachés au foyer fiscal.">
          <Select value={(child.schoolLevel) || "none"} onValueChange={(v) => updateChild(index, "schoolLevel", v === "none" ? "" : v)}>
            <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Non scolarisé" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non scolarisé</SelectItem>
              <SelectItem value="college">Collège (-61 € IR)</SelectItem>
              <SelectItem value="lycee">Lycée (-153 € IR)</SelectItem>
              <SelectItem value="superieur">Supérieur (-183 € IR)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end"><Button variant="outline" className="h-9 w-9 rounded-xl p-0" onClick={() => removeChild(index)}><Trash2 className="h-4 w-4" /></Button></div>
      </div>
    ))}
  </div>
    </CardContent>
  </Card>
</TabsContent>

  );
});

TabFamiliale.displayName = "TabFamiliale";
export { TabFamiliale };
