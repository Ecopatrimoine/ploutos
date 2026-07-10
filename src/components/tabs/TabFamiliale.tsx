import React from "react";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings, Users, Accessibility, Check, X, AlertTriangle } from "lucide-react";
import { confirmRemove } from "../../lib/confirmRemove";
import { alerteRattachementEnfant } from "../../lib/gardefous";
import { useDebouncedAction } from "../../hooks/useDebouncedAction";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";
import { AdresseAutocomplete } from "../collecte/AdresseAutocomplete";
import { ContinuerCollecte, ChampCollecte, InvitePersonne2, NoteDormante, INPUT_COLLECTE_CLS, INPUT_COLLECTE_STYLE } from "../collecte/densite";
import { person2Mode, person2Dormant } from "../../lib/collecte/person2";

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
  const { data, setField, addChild, updateChild, removeChild, person1, person2, setCollecteSubTab } = props;
  const addChildDebounced = useDebouncedAction(addChild); // Lot 8 C2 — anti double-clic
  // Foyer mono-adulte (celibataire) : un seul parent -> le choix de parente enfant
  // n'a pas de sens. On masque le selecteur et on affiche un libelle statique.
  const isMonoAdulte = data.coupleStatus === "single";

  // U3 — affichage conditionnel de la carte identite Personne 2. Ici (source de la
  // saisie P2), on montre la carte des que la situation est un couple OU que P2 a une
  // identite (donnees dormantes) ; on ne la masque QUE si seul ET sans identite.
  const p2mode = person2Mode(data);
  const showP2 = p2mode !== "none";

  return (
<TabsContent value="famille" className="space-y-3">
  <Card className="border-0" style={{ borderRadius: 20 }}>
    <CardHeader><SectionTitle icon={Users} title="Données familiales" subtitle="Identité, situation du couple et enfants à charge" /></CardHeader>
    <CardContent className="space-y-4">
  {/* Deux personnes côte à côte — IDENTITE EN PREMIER (C-ADRESSE, Lot 10e). Personne 2
       conditionnelle (U3) : pleine largeur si P2 absente (seul sans identite). */}
  <div className={`grid gap-4 ${showP2 ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
    {/* Personne 1 */}
    <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Personne 1</div>
      <div className="grid gap-3 grid-cols-2">
        <ChampCollecte label="Prénom"><Input value={data.person1FirstName} onChange={(e) => setField("person1FirstName", e.target.value)} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
        <ChampCollecte label="Nom"><Input value={data.person1LastName} onChange={(e) => setField("person1LastName", e.target.value)} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
      </div>
      <ChampCollecte label="Date de naissance">
        <div className="flex items-center gap-2">
          <DateFr value={data.person1BirthDate} onChange={(iso) => setField("person1BirthDate", iso || "")} className="rounded-lg flex-1 h-8 text-sm" />
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
      </ChampCollecte>
      {/* État civil détaillé (Lot 8a — exigence DDA lettre de mission) */}
      <div className="grid gap-3 grid-cols-2">
        <ChampCollecte label="Nom de naissance">
          <Input value={data.person1NomNaissance || ""} onChange={(e) => setField("person1NomNaissance", e.target.value)} placeholder="si différent du nom d'usage" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
        </ChampCollecte>
        <ChampCollecte label="Nationalité">
          <Input value={data.person1Nationalite || ""} onChange={(e) => setField("person1Nationalite", e.target.value)} placeholder="ex : française" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
        </ChampCollecte>
      </div>
      <ChampCollecte label="Lieu de naissance">
        <Input value={data.person1LieuNaissance || ""} onChange={(e) => setField("person1LieuNaissance", e.target.value)} placeholder="ville (département / pays si étranger)" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
      </ChampCollecte>
    </div>
    {/* Personne 2 — conditionnelle (U3) : masquee uniquement si seul ET sans identite */}
    {showP2 && (
    <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Personne 2</div>
      {person2Dormant(data) && (
        <NoteDormante>Situation actuelle « seul » — identité de la personne 2 conservée (non supprimée).</NoteDormante>
      )}
      <div className="grid gap-3 grid-cols-2">
        <ChampCollecte label="Prénom"><Input value={data.person2FirstName} onChange={(e) => setField("person2FirstName", e.target.value)} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
        <ChampCollecte label="Nom"><Input value={data.person2LastName} onChange={(e) => setField("person2LastName", e.target.value)} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
      </div>
      <ChampCollecte label="Date de naissance">
        <div className="flex items-center gap-2">
          <DateFr value={data.person2BirthDate} onChange={(iso) => setField("person2BirthDate", iso || "")} className="rounded-lg flex-1 h-8 text-sm" />
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
      </ChampCollecte>
      {/* État civil détaillé (Lot 8a) */}
      <div className="grid gap-3 grid-cols-2">
        <ChampCollecte label="Nom de naissance">
          <Input value={data.person2NomNaissance || ""} onChange={(e) => setField("person2NomNaissance", e.target.value)} placeholder="si différent du nom d'usage" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
        </ChampCollecte>
        <ChampCollecte label="Nationalité">
          <Input value={data.person2Nationalite || ""} onChange={(e) => setField("person2Nationalite", e.target.value)} placeholder="ex : française" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
        </ChampCollecte>
      </div>
      <ChampCollecte label="Lieu de naissance">
        <Input value={data.person2LieuNaissance || ""} onChange={(e) => setField("person2LieuNaissance", e.target.value)} placeholder="ville (département / pays si étranger)" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
      </ChampCollecte>
    </div>
    )}
  </div>
  {/* Coordonnées du foyer — JUSTE APRES l'identite (C-ADRESSE, Lot 10e). Adresse avec
       autocompletion BAN (non bloquant, saisie manuelle intacte). Utilisee par la fiche
       conseil DDA et les pages de contact des documents reglementaires. */}
  <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Coordonnées du foyer</div>
    <div className="grid gap-3 grid-cols-4">
      <div className="col-span-2">
        <ChampCollecte label="Adresse">
          <AdresseAutocomplete
            value={data.adresse || ""}
            onChange={(v) => setField("adresse", v)}
            onSelect={(a) => { setField("adresse", a.adresse); setField("codePostal", a.codePostal); setField("ville", a.ville); }}
            placeholder="ex : 12 rue des Lilas"
            className="rounded-lg h-8 text-sm w-full"
          />
        </ChampCollecte>
      </div>
      <ChampCollecte label="Code postal"><Input value={data.codePostal || ""} onChange={(e) => setField("codePostal", e.target.value)} placeholder="66000" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
      <ChampCollecte label="Ville"><Input value={data.ville || ""} onChange={(e) => setField("ville", e.target.value)} placeholder="Perpignan" className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
    </div>
  </div>

  {/* Situation couple sur une ligne (4 champs) */}
  <div className="grid gap-4 md:grid-cols-4">
    <ChampCollecte label="Situation de couple">
      <Select value={data.coupleStatus} onValueChange={(v) => setField("coupleStatus", v)}>
        <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
        <SelectContent>{COUPLE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </ChampCollecte>
    <ChampCollecte label="Régime matrimonial">
      <Select value={data.matrimonialRegime} onValueChange={(v) => setField("matrimonialRegime", v)} disabled={data.coupleStatus !== "married"}>
        <SelectTrigger className={`rounded-lg text-sm w-full ${data.coupleStatus !== "married" ? "bg-slate-100 text-slate-400" : ""}`} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
        <SelectContent>{MATRIMONIAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </ChampCollecte>
    <ChampCollecte label="Date de mariage / PACS">
      <DateFr
        value={data.dateMariage ?? ""}
        onChange={(iso) => setField("dateMariage", iso || null)}
        disabled={data.coupleStatus !== "married" && data.coupleStatus !== "pacs"}
        className={`rounded-lg h-8 text-sm ${data.coupleStatus !== "married" && data.coupleStatus !== "pacs" ? "bg-slate-100 text-slate-400" : ""}`}
      />
    </ChampCollecte>
    <ChampCollecte label="Parent isolé">
      <Select value={data.singleParent ? "yes" : "no"} onValueChange={(v) => setField("singleParent", v === "yes")}>
        <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="no">Non</SelectItem><SelectItem value="yes">Oui</SelectItem></SelectContent>
      </Select>
    </ChampCollecte>

  </div>
  {/* Enfants */}
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold" style={{ color: BRAND.navy }}>Enfants</h3>
      <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={addChildDebounced}><Plus className="mr-1.5 h-3.5 w-3.5" />Ajouter</Button>
    </div>
    {data.childrenData.length === 0 && <div className="text-sm" style={{ color: BRAND.muted }}>Aucun enfant saisi.</div>}
    {data.childrenData.map((child, index) => {
      // Lot 9 C3 — alerte DOUCE (non bloquante) sur un rattachement inhabituel.
      // Le calcul IR reste INCHANGE : on signale, on n'exclut jamais l'enfant.
      const alerteRattachement = alerteRattachementEnfant(child, getAgeFromBirthDate(child.birthDate));
      return (
      <React.Fragment key={index}>
      <div className="grid gap-3 border p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_auto]" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
        <ChampCollecte label="Prénom"><Input value={child.firstName} onChange={(e) => updateChild(index, "firstName", e.target.value)} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
        <ChampCollecte label="Nom"><Input value={child.lastName} onChange={(e) => updateChild(index, "lastName", e.target.value)} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} /></ChampCollecte>
        <ChampCollecte label="Date de naissance">
          <div className="flex items-center gap-1.5">
            <DateFr
              value={child.birthDate}
              onChange={(iso) => {
                const v = iso || "";
                updateChild(index, "birthDate", v);
                // Au-dela de 25 ans : de-rattachement auto (reversible via le toggle Foyer fiscal).
                if (doitDeRattacher(v)) updateChild(index, "rattached", false);
              }}
              className="rounded-lg flex-1 h-8 text-sm min-w-0"
            />
            {/* Slot age largeur FIXE (C2) : reserve toujours 24px -> colonnes alignees entre lignes enfants */}
            <span className="text-[11px] font-bold rounded shrink-0 text-center" style={{ width: 24, height: 20, lineHeight: "18px", background: BRAND.cream, color: BRAND.goldText, border: `1px solid ${BRAND.warningBorder}`, visibility: (child.birthDate && getAgeFromBirthDate(child.birthDate) !== null) ? "visible" : "hidden" }}>
              {child.birthDate ? (getAgeFromBirthDate(child.birthDate) ?? "") : ""}
            </span>
          </div>
        </ChampCollecte>
        <ChampCollecte label="Parenté">
          {isMonoAdulte ? (
            <div className="rounded-lg px-2 flex items-center text-xs truncate" style={{ height: 32, color: BRAND.muted }} title={`Enfant de ${person1}`}>Enfant de {person1}</div>
          ) : (
            <Select value={child.parentLink} onValueChange={(v) => updateChild(index, "parentLink", v)}>
              <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
              {/* Libelles courts avec prenoms (C2) — valeurs CHILD_LINKS inchangees */}
              <SelectContent>
                <SelectItem value="common_child">Enfant commun</SelectItem>
                <SelectItem value="person1_only">{person1} uniquement</SelectItem>
                <SelectItem value="person2_only">{person2 || "Personne 2"} uniquement</SelectItem>
              </SelectContent>
            </Select>
          )}
        </ChampCollecte>
        <ChampCollecte label="Garde">
          <Select value={child.custody} onValueChange={(v) => updateChild(index, "custody", v)}>
            <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue /></SelectTrigger>
            <SelectContent>{CUSTODY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </ChampCollecte>
        <ChampCollecte label="Foyer fiscal" tooltip="Enfant rattaché : compte dans les parts fiscales du foyer. Enfant non rattaché (majeur indépendant) : ne génère plus de parts mais peut donner droit à une pension déductible.">
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
        </ChampCollecte>

        <ChampCollecte label="Handicap" tooltip="Carte invalidité / CMI. Impact IR : +0,5 part (0,25 si alternée). Succession : +159 325 € d'abattement cumulable.">
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
        </ChampCollecte>
        <ChampCollecte label="Niveau scolaire" tooltip="Forfait scolaire art. 199 quater B — réduction d'impôt : collège 61 €/an · lycée 153 €/an · supérieur 183 €/an. Uniquement pour les enfants rattachés au foyer fiscal.">
          <Select value={(child.schoolLevel) || "none"} onValueChange={(v) => updateChild(index, "schoolLevel", v === "none" ? "" : v)}>
            <SelectTrigger className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE}><SelectValue placeholder="Non scolarisé" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non scolarisé</SelectItem>
              <SelectItem value="college">Collège (-61 € IR)</SelectItem>
              <SelectItem value="lycee">Lycée (-153 € IR)</SelectItem>
              <SelectItem value="superieur">Supérieur (-183 € IR)</SelectItem>
            </SelectContent>
          </Select>
        </ChampCollecte>
        <div className="flex items-end"><Button variant="outline" aria-label="Supprimer l'enfant" className="h-9 w-9 rounded-xl p-0" onClick={() => confirmRemove(!!(child.firstName || child.lastName || child.birthDate), "l'enfant", () => removeChild(index))}><Trash2 className="h-4 w-4" /></Button></div>
      </div>
      {alerteRattachement && (
        <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-1.5 -mt-1.5" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: "#7C4A04" }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{alerteRattachement}</span>
        </div>
      )}
      </React.Fragment>
      );
    })}
  </div>

  {/* Bouton discret « Continuer -> Travail » (Lot 10e) */}
  {setCollecteSubTab && <ContinuerCollecte label="Travail" onClick={() => setCollecteSubTab("travail")} />}
    </CardContent>
  </Card>
</TabsContent>

  );
});

TabFamiliale.displayName = "TabFamiliale";
export { TabFamiliale };
