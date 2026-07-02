// ─── Bloc Statut professionnel + Employeur (module Prévoyance v1.4.0) ───
//
// Saisie pour UNE personne (P1 ou P2) :
//   - Statut pro + caisse d'affiliation (caisse auto-suggérée depuis
//     le statut, modifiable manuellement)
//   - Bloc Employeur (SIRET + auto-résolution → IDCC + nom + NAF…)
//   - Date d'embauche, temps de travail
//   - Pour salariés / assimilés : salaire brut + prime annuels
//
// Les revenus TNS (BNC/BIC) et l'option Madelin ne sont pas saisis
// ici : ils sont déjà collectés dans l'onglet Revenus et dans les
// placements. Le moteur Prévoyance les lira directement depuis là.
//
// Le composant est purement contrôlé : il reçoit la valeur courante
// `value: PayloadTravail` et un setter `onChange(patch)` qui merge
// dans le parent. Pas d'état métier interne.

import React from "react";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { PayloadTravail, EmployeurInfo, StatutPro, CodeCaisse } from "../../types/patrimoine";
import {
  resolveSiret,
  validateSiret,
  createEmptyEmployeur,
  suggestCaisseFromStatut,
} from "../../lib/prevoyance/utils";
import { STATUTS_TNS } from "../../lib/prevoyance/constants";

const STATUTS_PRO: Array<{ value: StatutPro; label: string }> = [
  { value: "salarie_non_cadre",   label: "Salarié non-cadre" },
  { value: "salarie_cadre",       label: "Salarié cadre" },
  { value: "tns_liberal",         label: "TNS — profession libérale" },
  { value: "tns_commercant",      label: "TNS — commerçant" },
  { value: "tns_artisan",         label: "TNS — artisan" },
  { value: "gerant_majoritaire",  label: "Gérant majoritaire (SARL / EURL)" },
  { value: "president_sas",       label: "Président SAS / SASU (assimilé salarié)" },
  { value: "eurl_unique",         label: "EURL gérant non majoritaire (assimilé salarié)" },
  { value: "fonctionnaire",       label: "Fonctionnaire" },
  { value: "retraite",            label: "Retraité" },
  { value: "sans_activite",       label: "Sans activité" },
];

const CAISSES: Array<{ value: CodeCaisse; label: string }> = [
  { value: "CPAM",      label: "CPAM (régime général)" },
  { value: "SSI",       label: "SSI (indépendants)" },
  { value: "MSA",       label: "MSA — exploitant agricole" },
  { value: "CPAM_AGRI" as CodeCaisse, label: "Salarié agricole (MSA → régime général)" },
  { value: "CARMF",     label: "CARMF (médecins)" },
  { value: "CARCDSF",   label: "CARCDSF (dentistes / sages-femmes)" },
  { value: "CARPV",     label: "CARPV (vétérinaires)" },
  { value: "CARPIMKO",  label: "CARPIMKO (paramédicaux)" },
  { value: "CIPAV",     label: "CIPAV (libéraux non réglementés)" },
  { value: "CNBF",      label: "CNBF (avocats)" },
  { value: "CAVOM",     label: "CAVOM (officiers ministériels)" },
  { value: "CAVEC",     label: "CAVEC (experts-comptables)" },
  { value: "CAVAMAC",   label: "CAVAMAC (agents d'assurance)" },
  { value: "CRN",       label: "CRN (notaires)" },
  { value: "FONCTION_PUBLIQUE", label: "Fonction publique (titulaire)" },
];

const SALARIE_STATUS: StatutPro[] = [
  "salarie_non_cadre", "salarie_cadre", "president_sas", "eurl_unique", "fonctionnaire",
];

function isSalarieLike(s: StatutPro | ""): boolean {
  return SALARIE_STATUS.includes(s as StatutPro);
}

type Props = {
  personLabel: string;
  value: PayloadTravail;
  onChange: (patch: Partial<PayloadTravail>) => void;
};

export const BlocStatutEmployeur = React.memo(function BlocStatutEmployeur({
  personLabel,
  value,
  onChange,
}: Props) {
  const [siretLoading, setSiretLoading] = React.useState(false);
  const [siretError, setSiretError] = React.useState<string | null>(null);
  const employeur = value.employeur;
  const statut = value.statutPro;
  const isSal = isSalarieLike(statut);
  const isTNS = STATUTS_TNS.includes(statut as StatutPro);

  function patchEmployeur(patch: Partial<EmployeurInfo>) {
    const next: EmployeurInfo = { ...(employeur ?? createEmptyEmployeur()), ...patch };
    onChange({ employeur: next });
  }

  // Au changement de statut, on suggère la caisse SI elle n'est pas
  // déjà renseignée. Si l'utilisateur a déjà saisi une caisse, on
  // respecte son choix (override manuel).
  function handleStatutChange(v: StatutPro) {
    const patch: Partial<PayloadTravail> = { statutPro: v };
    if (!value.caisseAffiliation) {
      const suggested = suggestCaisseFromStatut(v);
      if (suggested) patch.caisseAffiliation = suggested;
    }
    onChange(patch);
  }

  async function handleResolveSiret() {
    const siret = (employeur?.siret ?? "").replace(/\s+/g, "");
    setSiretError(null);
    if (!validateSiret(siret)) {
      setSiretError("SIRET invalide (14 chiffres attendus).");
      return;
    }
    setSiretLoading(true);
    try {
      const res = await resolveSiret(siret);
      if (res.ok === true) {
        onChange({ employeur: { ...res.data, sourceCCN: res.data.idccCCN ? "auto" : "non_defini" } });
      } else if (res.ok === false && res.reason === "not_found") {
        setSiretError("SIRET non trouvé dans la base entreprises.");
      } else if (res.ok === false && res.reason === "invalid_format") {
        setSiretError("SIRET invalide (14 chiffres attendus).");
      } else {
        setSiretError("Réponse réseau indisponible — réessayez dans un instant.");
      }
    } finally {
      setSiretLoading(false);
    }
  }

  return (
    <div className="border p-4 space-y-4" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND.navy }}>
        {personLabel}
      </div>

      {/* Statut + caisse — 2 colonnes alignées, labels sur 1 ligne. */}
      <div className="grid gap-3 md:grid-cols-2 items-start">
        <Field label="Statut professionnel">
          <Select
            value={statut || ""}
            onValueChange={(v) => handleStatutChange(v as StatutPro)}
          >
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {STATUTS_PRO.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Caisse d'affiliation">
          <Select
            value={value.caisseAffiliation ?? ""}
            onValueChange={(v) => {
              // "CPAM_AGRI" est une étiquette d'affichage (salarié agricole MSA) qui route
              // vers le régime général : on normalise vers "CPAM" avant de propager (zéro
              // duplication, CodeCaisse reste l'union fermée, le moteur ne voit que "CPAM").
              const code = v === "CPAM_AGRI" ? "CPAM" : v;
              onChange({ caisseAffiliation: (code || null) as CodeCaisse | null });
            }}
          >
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {CAISSES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Bloc Employeur — encart visuellement distinct. SIRET prend
          2/3 de la largeur du grid pour rester lisible, Effectif occupe
          la 3e colonne. Les autres champs sont en 2 colonnes propres. */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: "rgba(81,106,199,0.04)" }}>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Employeur / entreprise
        </div>

        {/* Ligne 1 : SIRET (large) + Effectif */}
        <div className="grid gap-3 md:grid-cols-3 items-start">
          <div className="md:col-span-2">
            <Field label="SIRET (14 chiffres)">
              <div className="flex gap-2">
                <Input
                  value={employeur?.siret ?? ""}
                  onChange={(e) => patchEmployeur({ siret: e.target.value.replace(/\s+/g, "") })}
                  className="rounded-xl flex-1"
                  inputMode="numeric"
                  placeholder="ex. 78404636300040"
                  maxLength={14}
                />
                <Button
                  type="button"
                  onClick={handleResolveSiret}
                  disabled={siretLoading || !validateSiret(employeur?.siret ?? null)}
                  className="rounded-xl whitespace-nowrap"
                  style={{ background: BRAND.navy }}
                >
                  {siretLoading ? "…" : "Résoudre"}
                </Button>
              </div>
              {siretError && (
                <div className="text-xs mt-1" style={{ color: "#B0413E" }}>{siretError}</div>
              )}
            </Field>
          </div>

          <Field label="Effectif">
            <Input
              value={employeur?.effectif ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                const n = v === "" ? null : Number(v);
                patchEmployeur({ effectif: Number.isFinite(n as number) ? (n as number) : null });
              }}
              className="rounded-xl"
              type="number"
              min={0}
              placeholder="—"
            />
          </Field>
        </div>

        {/* Ligne 2 : Nom + Forme juridique */}
        <div className="grid gap-3 md:grid-cols-2 items-start">
          <Field label="Nom de l'employeur">
            <Input
              value={employeur?.nom ?? ""}
              onChange={(e) => patchEmployeur({ nom: e.target.value || null })}
              className="rounded-xl"
              placeholder="Raison sociale"
            />
          </Field>

          <Field label="Forme juridique">
            <Input
              value={employeur?.formeJuridique ?? ""}
              onChange={(e) => patchEmployeur({ formeJuridique: e.target.value || null })}
              className="rounded-xl"
              placeholder="SARL, SAS, SCI…"
            />
          </Field>
        </div>

        {/* Ligne 3 : Code NAF + IDCC */}
        <div className="grid gap-3 md:grid-cols-2 items-start">
          <Field label="Code NAF / APE">
            <Input
              value={employeur?.codeNAF ?? ""}
              onChange={(e) => patchEmployeur({ codeNAF: e.target.value || null })}
              className="rounded-xl"
              placeholder="ex. 6201Z"
            />
          </Field>

          <Field label="IDCC (convention collective)">
            <div className="space-y-1">
              <Input
                value={employeur?.idccCCN ?? ""}
                onChange={(e) => {
                  const next = e.target.value.trim() || null;
                  patchEmployeur({
                    idccCCN: next,
                    sourceCCN: next ? "manuel" : "non_defini",
                  });
                }}
                className="rounded-xl"
                placeholder="ex. 1486"
                inputMode="numeric"
              />
              {employeur?.idccCCN && (
                <div className="text-xs" style={{
                  color: employeur.sourceCCN === "auto" ? "#2F7D5B" : BRAND.muted,
                }}>
                  {employeur.sourceCCN === "auto" && "CCN auto-résolue depuis le SIRET"}
                  {employeur.sourceCCN === "manuel" && "CCN saisie manuellement"}
                  {employeur.sourceCCN === "non_defini" && "CCN non définie"}
                  {employeur.nomCCN ? ` — ${employeur.nomCCN}` : ""}
                </div>
              )}
              {employeur?.idccListe && employeur.idccListe.length > 1 && (
                <div className="text-xs" style={{ color: BRAND.warning }}>
                  ⚠ Plusieurs conventions détectées pour ce SIRET : {employeur.idccListe.join(", ")}. Vérifiez la convention applicable.
                </div>
              )}
            </div>
          </Field>
        </div>
      </div>

      {/* Date embauche + temps travail — salariés / assimilés salariés uniquement.
          Pour les TNS (libéraux, gérant majoritaire), « date d'embauche » et
          « temps de travail » n'ont pas de sens : on affiche à la place le champ
          « Début d'activité / affiliation » ci-dessous. */}
      {isSal && (
      <div className="grid gap-3 md:grid-cols-3 items-start">
        <Field label="Date d'embauche">
          <DateFr
            value={value.dateEmbauche ?? ""}
            onChange={(iso) => onChange({ dateEmbauche: iso || null })}
            className="rounded-xl"
          />
        </Field>

        <Field label="Temps de travail">
          <Select
            value={value.tempsTravail.type}
            onValueChange={(v) =>
              onChange({
                tempsTravail: {
                  type: v as "plein" | "partiel",
                  pourcentage: v === "plein" ? undefined : (value.tempsTravail.pourcentage ?? 80),
                },
              })
            }
          >
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="plein">Temps plein</SelectItem>
              <SelectItem value="partiel">Temps partiel</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {value.tempsTravail.type === "partiel" ? (
          <Field label="Quotité (%)">
            <Input
              type="number"
              min={1}
              max={99}
              value={value.tempsTravail.pourcentage ?? ""}
              onChange={(e) => {
                const pct = Number(e.target.value);
                onChange({
                  tempsTravail: {
                    type: "partiel",
                    pourcentage: Number.isFinite(pct) ? pct : undefined,
                  },
                });
              }}
              className="rounded-xl"
            />
          </Field>
        ) : (
          // colonne vide pour conserver l'alignement de la grille
          <div className="hidden md:block" />
        )}
      </div>
      )}

      {/* Début d'activité / 1ʳᵉ affiliation — TNS uniquement (pas de date
          d'embauche : l'ancienneté d'affiliation en découle, cf. mapping). */}
      {isTNS && (
        <div className="grid gap-3 md:grid-cols-2 items-start">
          <Field
            label="Début d'activité / 1ʳᵉ affiliation à la caisse"
            tooltip="Date de début d'activité libérale ou de 1ʳᵉ affiliation à votre caisse (CIPAV, CARMF…). Sert à calculer votre ancienneté d'affiliation."
          >
            <DateFr
              value={value.dateDebutActivite ?? ""}
              onChange={(iso) => onChange({ dateDebutActivite: iso || null })}
              className="rounded-xl"
            />
          </Field>
        </div>
      )}

      {/* Salaire brut + prime — uniquement pour salariés / assimilés.
          Pour les TNS, les revenus sont saisis dans l'onglet Revenus
          (CA, BNC/BIC, régime micro/réel) et lus par le moteur. */}
      {isSal && (
        <div className="grid gap-3 md:grid-cols-2 items-start">
          <Field label="Salaire brut annuel (€)">
            <Input
              type="number"
              min={0}
              value={value.salaireBrutAnnuel || ""}
              onChange={(e) => onChange({ salaireBrutAnnuel: Number(e.target.value) || 0 })}
              className="rounded-xl"
              placeholder="ex. 55000"
            />
          </Field>
          <Field label="Prime annuelle (€)">
            <Input
              type="number"
              min={0}
              value={value.primeAnnuelle ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                onChange({ primeAnnuelle: Number.isFinite(v as number) ? (v as number) : null });
              }}
              className="rounded-xl"
              placeholder="0"
            />
          </Field>
        </div>
      )}
    </div>
  );
});

BlocStatutEmployeur.displayName = "BlocStatutEmployeur";
