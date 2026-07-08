import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardAccentTop } from "../CardAccentTop";
import { TabsContent } from "@/components/ui/tabs";
import { Upload, Settings, RotateCcw, Undo2 } from "lucide-react";
import { BRAND, CABINET_COLOR_DEFAULTS } from "../../constants";
import { SectionTitle } from "../shared";

// R4 — Couleurs cabinet : libellés de ROLE stables (mapping 1-1 sur les clés
// existantes, ordre inchangé — on ne réordonne pas les valeurs stockées).
const CABINET_COLOR_ROLES: { key: string; label: string }[] = [
  { key: "colorNavy", label: "Couleur principale" },
  { key: "colorSky", label: "Couleur secondaire" },
  { key: "colorBlue", label: "Accent" },
  { key: "colorGold", label: "Accent chaud" },
  { key: "colorCream", label: "Fond clair" },
];

// ─── TabParametres v2 — Cabinet refondu (Lot Paramètres v2) ──────────────────
//
// Architecture validée en maquette (revue-preview/parametres_cabinet_v2_lot1.html) :
//  • 3 onglets internes : Statuts & conformité / Identité / Apparence
//  • Cards détails (assurance/CIF/IOBSP) conditionnelles selon statuts ORIAS
//  • Layout adaptatif : 1 card visible = pleine largeur ; 2 = grille 2 cols ;
//    3 = 2+1 (la 3ème pleine largeur pour éviter l'orphelin)
//  • Toggles catégories (assurance + IOBSP) au lieu de texte libre
//  • Nouveaux champs : rcpMontants, mediateurAmf, remunerationCif/Ias,
//    niveauConseil, categAss*, categIobsp*
//  • Saisie ORIAS unique côté Identité juridique (pas dans Statuts)
//  • Médiation cabinet toujours présente + médiateur AMF complémentaire si CIF
//  • Onglet Documents supprimé (palette PDF migre vers pop-card impression)
//
// Synchro remunerationType ↔ remuneration : gérée dans updateCabinet (App.tsx).
// La maquette HTML reste la source de vérité visuelle pour ajustements futurs.

const TabParametres = React.memo(function TabParametres(props: any) {
  const { cabinet, updateCabinet, logoSrc, signatureSrc, setSignatureSrc, handleLogoUpload, handleSignatureUpload } = props;

  const [activeTab, setActiveTab] = useState<"statuts" | "identite" | "apparence">("statuts");

  // R4 — Snapshot des 5 couleurs pris a l'ouverture de la vue (montage du composant :
  // vue autonome ET onglet intra-dossier remontent a chaque ouverture). Les modifs
  // etant auto-sauvegardees, ce snapshot = dernier etat sauvegarde a l'ouverture.
  const [colorSnapshot] = useState<Record<string, string>>(() => {
    const snap: Record<string, string> = {};
    for (const { key } of CABINET_COLOR_ROLES) snap[key] = cabinet[key];
    return snap;
  });
  const colorsDirty = CABINET_COLOR_ROLES.some(({ key }) => cabinet[key] !== colorSnapshot[key]);
  const resetColorsToSnapshot = () =>
    CABINET_COLOR_ROLES.forEach(({ key }) => updateCabinet(key, colorSnapshot[key]));

  // ─── Cards détails conditionnelles + layout adaptatif ─────────────────
  const showAssurance = !!cabinet.statutCoa || !!cabinet.statutMia;
  const showCif = !!cabinet.statutCif;
  const showIobsp = !!cabinet.statutIobsp;
  const visibleCount = (showAssurance ? 1 : 0) + (showCif ? 1 : 0) + (showIobsp ? 1 : 0);
  const showPlaceholder = visibleCount === 0;

  // Classe Tailwind à appliquer pour le span en grille — 1 visible = pleine largeur,
  // 3 visibles = la 3ème pleine largeur (l'orphelin reste centré, pas à gauche seule).
  const classFor = (which: "ass" | "cif" | "iobsp"): string => {
    if (visibleCount === 1) return "col-span-2";
    if (visibleCount === 3 && which === "iobsp") return "col-span-2";
    return "";
  };

  // ─── Helper toggle générique avec libellé + description optionnelle ──
  const ToggleRow = ({ ckKey, label, desc, compact }: { ckKey: string; label: string; desc?: string; compact?: boolean }) => (
    <label className={`flex items-start gap-3 cursor-pointer ${compact ? "py-1" : "py-1.5"}`}>
      <span className="relative inline-block w-9 h-5 flex-none mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={!!cabinet[ckKey]}
          onChange={e => updateCabinet(ckKey, e.target.checked)}
        />
        <span className="absolute inset-0 bg-slate-300 rounded-full transition-colors peer-checked:bg-[#C4973D]" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="flex-1 text-sm leading-snug">
        <strong className="block font-bold text-slate-900">{label}</strong>
        {desc && <span className="block text-xs text-slate-500 font-normal mt-0.5">{desc}</span>}
      </span>
    </label>
  );

  // ─── Helper input field standard ─────────────────────────────────────
  const Field = ({ ckKey, label, placeholder, hint, badge, disabled }: { ckKey: string; label: string; placeholder?: string; hint?: string; badge?: "new" | "preserved" | "renamed"; disabled?: boolean }) => (
    <div>
      <Label className="text-xs font-bold tracking-wide mb-1.5 block text-slate-600">
        {label}
        {badge === "new" && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">nouveau</span>}
        {badge === "preserved" && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5">existant</span>}
        {badge === "renamed" && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">clé renommée</span>}
      </Label>
      <Input
        value={cabinet[ckKey] || ""}
        onChange={e => updateCabinet(ckKey, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded-xl text-sm"
      />
      {hint && <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5 leading-snug">{hint}</div>}
    </div>
  );

  // ─── Helper card subtitle ────────────────────────────────────────────
  const CardSub = ({ children }: { children: React.ReactNode }) => (
    <div className="text-xs text-slate-500 mt-1 leading-snug">{children}</div>
  );

  // ─── Bandeau onglet ─────────────────────────────────────────────────
  const TabBtn = ({ value, label, count }: { value: "statuts" | "identite" | "apparence"; label: string; count?: number }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-5 py-2.5 text-sm font-semibold relative transition-colors ${activeTab === value ? "text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-2 text-[10px] font-bold rounded-md px-1.5 py-0.5 ${activeTab === value ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{count}</span>
      )}
      {activeTab === value && <span className="absolute left-3.5 right-3.5 -bottom-px h-0.5 bg-amber-500 rounded-t" />}
    </button>
  );

  // ─── Card wrapper (Shadcn rounded-2xl, fond cardSoft) ───────────────
  const SubCard = ({ children, fullSpan, conditional, className }: { children: React.ReactNode; fullSpan?: boolean; conditional?: boolean; className?: string }) => (
    <div className={`bg-[#FDFCFA] border border-[#D8D2C6] rounded-2xl p-5 ${fullSpan ? "col-span-2" : ""} ${conditional ? "bg-gradient-to-b from-amber-50/40 to-[#FDFCFA] border-l-[3px] border-l-amber-600" : ""} ${className || ""}`}>
      {children}
    </div>
  );

  // ─── Header card (titre + sous-titre + badge optionnel) ──────────────
  const CardHead = ({ title, sub, badgeText }: { title: string; sub: React.ReactNode; badgeText?: string }) => (
    <div className="flex justify-between items-start gap-3 mb-3">
      <div>
        <div className="text-sm font-extrabold text-slate-900 leading-tight">{title}</div>
        <CardSub>{sub}</CardSub>
      </div>
      {badgeText && (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 rounded px-2 py-1 whitespace-nowrap">{badgeText}</span>
      )}
    </div>
  );

  // ─── Helper radio group ──────────────────────────────────────────────
  const RadioGroup = ({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: { v: string; label: string; em?: string }[] }) => (
    <div className="space-y-1">
      {options.map(opt => (
        <label key={opt.v} className="flex items-start gap-2 cursor-pointer text-sm hover:bg-slate-50 rounded-lg px-2.5 py-1.5 transition-colors">
          <input
            type="radio"
            name={name}
            checked={value === opt.v}
            onChange={() => onChange(opt.v)}
            className="mt-1 h-3.5 w-3.5 accent-[#0F172A] flex-none"
          />
          <span>
            <strong className="font-bold text-slate-900">{opt.label}</strong>
            {opt.em && <span className="block text-xs text-slate-500 mt-0.5">{opt.em}</span>}
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <TabsContent value="parametres" className="space-y-6">
      <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60 relative overflow-hidden">
        <CardAccentTop />
        <CardHeader>
          <SectionTitle
            icon={Settings}
            title="Paramètres cabinet"
            subtitle="Identité, coordonnées légales, statuts ORIAS, visuels et couleurs des documents PDF."
          />
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ─── 3 onglets internes ─── */}
          <div className="flex border-b border-[#D8D2C6] gap-0.5">
            <TabBtn value="statuts" label="Statuts & conformité" count={6} />
            <TabBtn value="identite" label="Identité" count={2} />
            <TabBtn value="apparence" label="Apparence" count={3} />
          </div>


          {/* ════════════════ ONGLET 1 — STATUTS & CONFORMITÉ ════════════════ */}
          {activeTab === "statuts" && (
            <div className="grid grid-cols-2 gap-4">

              {/* Card 1 — Statuts ORIAS */}
              <SubCard fullSpan>
                <CardHead
                  title="Statuts ORIAS détenus"
                  sub="Cocher / décocher un statut affiche ou masque sa card de détails ci-dessous. Pilote la page « Références légales » du DER et toutes les conditionnelles documents."
                />
                <div className="grid grid-cols-5 gap-2.5">
                  {([
                    ["statutCoa", "COA", "Courtier en assurance"],
                    ["statutMia", "MIA", "Mandataire d'intermédiaire en assurance"],
                    ["statutCif", "CIF", "Conseiller en investissements financiers"],
                    ["statutIobsp", "IOBSP", "Intermédiaire en op. de banque"],
                    ["statutCarteT", "Carte T", "Transactions immobilières (Hoguet)"],
                  ] as [string, string, string][]).map(([key, short, desc]) => {
                    const isActive = !!cabinet[key];
                    return (
                      <label
                        key={key}
                        className={`bg-white border rounded-xl p-3 cursor-pointer transition-all ${isActive ? "border-slate-900 ring-2 ring-slate-900/5" : "border-[#D8D2C6] hover:border-[#CCC5B8]"}`}
                      >
                        <span className="relative inline-block w-8 h-5 mb-2">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={e => updateCabinet(key, e.target.checked)}
                          />
                          <span className="absolute inset-0 bg-slate-300 rounded-full transition-colors peer-checked:bg-[#C4973D]" />
                          <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3" />
                        </span>
                        <div className="text-sm font-extrabold text-slate-900">{short}</div>
                        <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{desc}</div>
                      </label>
                    );
                  })}
                </div>
              </SubCard>

              {/* Placeholder si aucun statut détaillé requis */}
              {showPlaceholder && (
                <div className="col-span-2 bg-[#E8E3D9]/40 border border-dashed border-[#D8D2C6] rounded-2xl p-5 text-center text-sm text-slate-500 leading-relaxed">
                  <strong className="block text-slate-900 font-bold mb-1">Aucun statut détaillé requis</strong>
                  Cocher COA, MIA, CIF ou IOBSP ci-dessus pour afficher les cards de détails correspondantes.
                </div>
              )}

              {/* Card 2 — Détails assurance (conditionnel COA/MIA) */}
              {showAssurance && (
                <SubCard conditional className={classFor("ass")}>
                  <CardHead
                    title="Détails assurance"
                    sub={<>Catégories distribuées, encaissement, RCP. Inclut <code className="bg-slate-100 rounded px-1 text-[10px]">rcpMontants</code> nouveau (affiché DER + Lettre M1).</>}
                    badgeText="si COA / MIA"
                  />
                  <div className="mb-3">
                    <Label className="text-xs font-bold tracking-wide mb-2 block text-slate-600">
                      Catégories d'assurance distribuées
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">nouveau</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      <ToggleRow ckKey="categAssVie" label="Vie & capitalisation" desc="AV, capitalisation, retraite" compact />
                      <ToggleRow ckKey="categAssPrev" label="Prévoyance & santé" desc="Décès, invalidité, mutuelle" compact />
                      <ToggleRow ckKey="categAssIard" label="IARD (dommages)" desc="Auto, habitation, MRH" compact />
                      <ToggleRow ckKey="categAssPro" label="Risques professionnels" desc="RC pro, MRH ent., flotte" compact />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5">
                      Remplace en saisie le champ texte legacy <code className="bg-slate-100 rounded px-1">categorieAssurance</code> (toujours lu en fallback affichage).
                    </div>
                  </div>

                  <div className="border-t border-[#E8E3D9] pt-3 mt-3">
                    <ToggleRow ckKey="encaisseFonds" label="Encaissement de fonds pour le compte de clients" desc="Active la garantie financière obligatoire ci-dessous." />
                  </div>

                  <div className="mt-3">
                    <Field
                      ckKey="garantieFinanciere"
                      label="Garantie financière (si encaissement)"
                      placeholder="ex: 115 000 € Lloyd's"
                      disabled={!cabinet.encaisseFonds}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field ckKey="rcpAssureur" label="Assureur RC pro" placeholder="ex: AIG, MMA…" />
                    <Field ckKey="rcpContrat" label="N° de police RCP" placeholder="ex: RC-2024-12345" />
                  </div>

                  <div className="mt-3">
                    <Field
                      ckKey="rcpMontants"
                      label="Montants de garantie RCP"
                      badge="new"
                      placeholder="ex: 1 564 610 € / sinistre · 2 315 610 € / an (arrêté 29/10/2024)"
                      hint="Affiché page 1 du DER (encadré RCP) et en M1 de la lettre de mission. Sans cette valeur, ces 2 documents affichent « à confirmer »."
                    />
                  </div>
                </SubCard>
              )}

              {/* Card 3 — Détails CIF (conditionnel CIF) */}
              {showCif && (
                <SubCard conditional className={classFor("cif")}>
                  <CardHead
                    title="Détails CIF"
                    sub="Préserve associationCif. Ajoute remunerationCif + mediateurAmf."
                    badgeText="si CIF"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field ckKey="associationCif" label="Association CIF agréée AMF" placeholder="ex: ANACOFI-CIF, CNCGP, La Compagnie des CGP…" />
                    <Field ckKey="remunerationCif" label="Mode de rémunération CIF" badge="new" placeholder="ex: honoraires / rétrocessions — barème" hint="Affiché en page 2 du DER." />
                  </div>
                  <div className="mt-3">
                    <Field
                      ckKey="mediateurAmf"
                      label="Médiateur AMF / association"
                      badge="new"
                      placeholder="ex: Médiateur AMF, 17 place de la Bourse, 75082 Paris"
                      hint="Complémentaire du médiateur cabinet (Card Médiation ci-dessous) — pas un remplacement. Le client peut saisir l'un ou l'autre selon la nature du litige. Affiché en page 2 du DER si CIF actif."
                    />
                  </div>
                </SubCard>
              )}

              {/* Card 4 — Détails IOBSP (conditionnel IOBSP) */}
              {showIobsp && (
                <SubCard conditional className={classFor("iobsp")}>
                  <CardHead
                    title="Détails IOBSP"
                    sub="Catégorie IOBSP — nouvelle saisie en toggles."
                    badgeText="si IOBSP"
                  />
                  <Label className="text-xs font-bold tracking-wide mb-2 block text-slate-600">
                    Catégorie IOBSP
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">nouveau</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                    <ToggleRow ckKey="categIobspCobsp" label="COBSP" desc="Courtier en op. de banque" compact />
                    <ToggleRow ckKey="categIobspMiobsp" label="MIOBSP" desc="Mandataire d'intermédiaire" compact />
                  </div>
                  <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 leading-snug">
                    Affiché page 1 du DER si IOBSP coché.
                  </div>
                </SubCard>
              )}

              {/* Card 5 — Conseil & rémunération (toujours pleine largeur) */}
              <SubCard fullSpan>
                <CardHead
                  title={<>Conseil &amp; rémunération <span className="ml-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5">existant + nouveau</span></> as any}
                  sub={<>Pilote la mention « Nature du conseil » et la grille tarifaire dans Mission / DER / Adéquation. Inclut maintenant les <strong>partenaires assurance</strong> (reclassé depuis Réglementation).</>}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold tracking-wide mb-2 block text-slate-600">Nature du conseil</Label>
                    <RadioGroup
                      name="natureConseil"
                      value={cabinet.natureConseil || ""}
                      onChange={v => updateCabinet("natureConseil", v)}
                      options={[
                        { v: "non_independant", label: "Non indépendant", em: "Rémunérations de tiers possibles (commissions assureurs)." },
                        { v: "independant", label: "Indépendant", em: "Analyse impartiale, sans rémunération de tiers." },
                      ]}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold tracking-wide mb-2 block text-slate-600">
                      Niveau de conseil délivré
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">nouveau</span>
                    </Label>
                    <RadioGroup
                      name="niveauConseil"
                      value={cabinet.niveauConseil || ""}
                      onChange={v => updateCabinet("niveauConseil", v)}
                      options={[
                        { v: "1", label: "Niveau 1", em: "Conseil simple — analyse des besoins." },
                        { v: "2", label: "Niveau 2", em: "Conseil personnalisé — recommandation argumentée." },
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="text-xs font-bold tracking-wide mb-2 block text-slate-600">
                    Mode de rémunération principal
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">clé renommée</span>
                  </Label>
                  <div className="flex gap-4 flex-wrap">
                    {([["commission", "Commission"], ["honoraire", "Honoraires"], ["mixte", "Mixte"]] as [string, string][]).map(([v, l]) => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-slate-50 rounded-lg px-3 py-1.5">
                        <input
                          type="radio"
                          name="remunerationType"
                          checked={(cabinet.remunerationType || "") === v}
                          onChange={() => updateCabinet("remunerationType", v)}
                          className="h-3.5 w-3.5 accent-[#0F172A]"
                        />
                        <strong>{l}</strong>
                      </label>
                    ))}
                  </div>
                  <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5 leading-snug">
                    Saisi sous la clé canonique <code className="bg-amber-100 rounded px-1">remunerationType</code>. La clé legacy <code className="bg-amber-100 rounded px-1">remuneration</code> est maintenue en miroir automatique (rétrocompat builders).
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Field ckKey="baremeHonoraires" label="Barème d'honoraires" placeholder="ex: 1 % du capital · 200 €/h · forfait" />
                  <Field ckKey="remunerationIas" label="Mode rémunération IAS" badge="new" placeholder="ex: courtier · commissions / honoraires" />
                </div>

                <div className="mt-3">
                  <Field ckKey="partenaires" label="Partenaires assurance & placement" placeholder="liste libre ou « voir registre conflits d'intérêts »" />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Déplacé depuis Coordonnées→Réglementation pour cohérence avec la transparence des conflits d'intérêts.
                  </div>
                </div>

                {/* ─── Lot Dossier client — modèle de mission par défaut ─── */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#E8E3D9]">
                  <Field ckKey="dureeMission" label="Durée de la mission par défaut" badge="new" placeholder="ex: ponctuelle / annuelle reconductible" />
                  <Field ckKey="delaiPreavis" label="Délai de préavis de résiliation" badge="new" placeholder="ex: 30 jours" />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Modèle par défaut appliqué à toutes les lettres de mission générées. Override per-dossier prévu plus tard (pop-card d'impression).
                </div>
              </SubCard>

              {/* Card 6 — Médiation cabinet (toujours pleine largeur) */}
              <SubCard fullSpan>
                <CardHead
                  title="Médiation cabinet (litiges)"
                  sub={<><strong>Toujours présent</strong> — médiateur cabinet pour litiges courants (typiquement Médiateur de l'Assurance pour un IAS). Le <strong>médiateur AMF</strong> spécifique au volet CIF se renseigne dans la card « Détails CIF » ci-dessus (apparaît seulement si CIF coché). Les 2 sont complémentaires, non doublons.</>}
                />
                <div className="grid grid-cols-3 gap-3">
                  <Field ckKey="mediateur" label="Médiateur compétent" placeholder="ex: Médiateur de l'Assurance" />
                  <Field ckKey="mediateurAdresse" label="Adresse postale" placeholder="ex: TSA 50110, 75441 Paris Cedex 09" />
                  <Field ckKey="mediateurUrl" label="Site web" placeholder="ex: www.mediation-assurance.org" />
                </div>
              </SubCard>

            </div>
          )}


          {/* ════════════════ ONGLET 2 — IDENTITÉ ════════════════ */}
          {activeTab === "identite" && (
            <div className="grid grid-cols-2 gap-4">

              {/* Card 7 — Identité juridique */}
              <SubCard>
                <CardHead
                  title="Identité juridique"
                  sub="Affichée dans l'encadré « Le cabinet » de tous les documents réglementaires. Le SIREN sert également de numéro d'immatriculation RCS sur les PDFs."
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field ckKey="nom" label="Dénomination" placeholder="ex: EcoPatrimoine Conseil" />
                  <Field ckKey="conseiller" label="Conseiller" placeholder="ex: David Perry" />
                  <Field ckKey="forme" label="Forme juridique" placeholder="ex: SAS, SARL, EURL" />
                  <Field ckKey="capital" label="Capital social" placeholder="ex: 10 000 €" />
                  <Field ckKey="siren" label="SIREN" placeholder="ex: 123 456 789" />
                  <Field ckKey="orias" label="N° ORIAS" placeholder="ex: 25006907" />
                </div>
              </SubCard>

              {/* Card 8 — Coordonnées */}
              <SubCard>
                <CardHead
                  title="Coordonnées"
                  sub="Adresse postale et contacts. Affichés en pied des PDFs + dans la section RGPD."
                />
                <Field ckKey="adresse" label="Adresse" placeholder="ex: 6 rue Victor Mirabeau" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field ckKey="codePostal" label="Code postal" placeholder="66000" />
                  <Field ckKey="ville" label="Ville" placeholder="Perpignan" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field ckKey="tel" label="Téléphone" placeholder="04 68 …" />
                  <Field ckKey="email" label="Email" placeholder="contact@…" />
                </div>
              </SubCard>

            </div>
          )}


          {/* ════════════════ ONGLET 3 — APPARENCE ════════════════ */}
          {activeTab === "apparence" && (
            <div className="grid grid-cols-2 gap-4">

              {/* Card 10 — Logo */}
              <SubCard>
                <CardHead title="Logo du cabinet" sub="Affiché sur la couverture et les en-têtes de page de tous les PDFs." />
                <div className="flex items-center gap-3 bg-white border border-dashed border-[#D8D2C6] rounded-xl p-3">
                  <img src={logoSrc} alt="Logo" className="h-12 w-auto object-contain rounded-lg bg-slate-50 p-1 border border-slate-200 flex-none" />
                  <div className="flex-1 text-xs text-slate-500 leading-snug">PNG · SVG · JPG · WebP — max 2 Mo</div>
                  <label className="cursor-pointer bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />Téléverser
                    <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
              </SubCard>

              {/* Card 11 — Signature */}
              <SubCard>
                <CardHead title="Signature du conseiller" sub="Affichée sur la page signature des documents réglementaires." />
                <div className="flex items-center gap-3 bg-white border border-dashed border-[#D8D2C6] rounded-xl p-3">
                  {signatureSrc ? (
                    <img src={signatureSrc} alt="Signature" className="h-12 w-auto object-contain rounded-lg bg-slate-50 p-1 border border-slate-200 flex-none" />
                  ) : (
                    <div className="h-12 w-20 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 flex-none">Sign.</div>
                  )}
                  <div className="flex-1 text-xs text-slate-500 leading-snug">PNG transparent ou JPG · max 1 Mo</div>
                  <label className="cursor-pointer bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />Téléverser
                    <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleSignatureUpload} />
                  </label>
                  {signatureSrc && (
                    <button onClick={() => setSignatureSrc("")} className="text-xs text-red-600 hover:text-red-800 font-bold">× Supprimer</button>
                  )}
                </div>
              </SubCard>

              {/* Card 12 — 5 couleurs cabinet (pleine largeur) — R4 : roles, annuler, reset */}
              <SubCard fullSpan>
                <div className="flex justify-between items-start gap-3">
                  <CardHead
                    title="Couleurs du cabinet (5 couleurs)"
                    sub={<>Saisie de référence des couleurs cabinet. Sera utilisée par la <strong>pop-card d'impression</strong> (Dossier client, à venir) quand le toggle palette y est positionné sur « Couleurs du cabinet ». Pas de toggle ici — la saisie reste un paramètre cabinet, le choix d'usage est per-document.</>}
                  />
                  {colorsDirty && (
                    <button
                      onClick={resetColorsToSnapshot}
                      title="Restaurer les couleurs telles qu'à l'ouverture"
                      className="flex-none inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5 border border-[#D8D2C6] bg-white hover:border-[#C4973D] transition-colors"
                      style={{ color: BRAND.navy }}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Annuler les modifications
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-3 mt-2">
                  {CABINET_COLOR_ROLES.map(({ key, label }) => {
                    const isDefault = (cabinet[key] || "").toLowerCase() === CABINET_COLOR_DEFAULTS[key].toLowerCase();
                    return (
                      <div key={key} className="flex flex-col items-center text-center">
                        <label className="relative cursor-pointer">
                          <div className="w-11 h-11 rounded-xl border border-[#D8D2C6] shadow-sm mb-1.5" style={{ background: cabinet[key] }} />
                          <input
                            type="color"
                            value={cabinet[key]}
                            onChange={e => updateCabinet(key, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </label>
                        <input
                          type="text"
                          value={cabinet[key]}
                          onChange={e => updateCabinet(key, e.target.value)}
                          className="w-18 text-center rounded-lg px-1 py-1 text-[11px] font-mono border border-[#E8E3D9]"
                        />
                        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold leading-tight">{label}</div>
                        <button
                          onClick={() => updateCabinet(key, CABINET_COLOR_DEFAULTS[key])}
                          disabled={isDefault}
                          title={isDefault ? "Déjà à la valeur par défaut" : "Réinitialiser à la charte"}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Défaut
                        </button>
                      </div>
                    );
                  })}
                </div>
              </SubCard>

            </div>
          )}


          {/* Encart pédagogique final (préservé) */}
          <div className="rounded-2xl p-4 text-sm" style={{ background: "rgba(251,236,215,0.4)", border: "1px solid rgba(227,175,100,0.3)" }}>
            <p className="font-semibold mb-2" style={{ color: BRAND.navy }}>💡 Ces paramètres alimentent automatiquement :</p>
            <ul className="list-disc ml-4 space-y-1 text-sm text-slate-600">
              <li>Page de couverture de tous les PDFs (logo)</li>
              <li>Encadré « Le cabinet » des documents réglementaires (identité juridique)</li>
              <li>Page 3 du DER « Références légales » (calculée d'après les statuts ORIAS)</li>
              <li>Encadrés conditionnels Mission, DER, Fiche DDA, Adéquation (selon statuts)</li>
              <li>Section réclamation et médiation</li>
              <li>Page de signature (conseiller + signature visuelle)</li>
              <li>Couleurs des en-têtes et éléments graphiques PDF (toggle palette par dossier dans la pop-card d'impression — à venir)</li>
            </ul>
          </div>

        </CardContent>
      </Card>
    </TabsContent>
  );
});

TabParametres.displayName = "TabParametres";
export { TabParametres };
