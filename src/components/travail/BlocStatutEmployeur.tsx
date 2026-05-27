// ─── Bloc Statut professionnel + Employeur (module Prévoyance v1.4.0) ───
//
// Saisie pour UNE personne (P1 ou P2) :
//   - Statut pro + caisse d'affiliation
//   - Bloc Employeur (SIRET + auto-résolution → IDCC + nom + NAF…)
//   - Date d'embauche, temps de travail, salaire brut, prime
//   - Champs TNS conditionnels (BNC/BIC, Madelin)
//
// Le composant est purement contrôlé : il reçoit la valeur courante
// `value: PayloadTravail` et un setter `onChange(patch)` qui merge
// dans le parent. Pas d'état métier interne.

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { PayloadTravail, EmployeurInfo, StatutPro, CodeCaisse } from "../../types/patrimoine";
import { resolveSiret, validateSiret, createEmptyEmployeur } from "../../lib/prevoyance/utils";

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
  { value: "SSI",       label: "SSI (Sécurité sociale des indépendants)" },
  { value: "MSA",       label: "MSA (régime agricole)" },
  { value: "CARMF",     label: "CARMF (médecins libéraux)" },
  { value: "CARCDSF",   label: "CARCDSF (dentistes / sages-femmes)" },
  { value: "CARPV",     label: "CARPV (vétérinaires)" },
  { value: "CARPIMKO",  label: "CARPIMKO (kinés / infirmiers / orthophonistes…)" },
  { value: "CIPAV",     label: "CIPAV (libéraux non réglementés)" },
  { value: "CNBF",      label: "CNBF (avocats)" },
  { value: "CAVOM",     label: "CAVOM (officiers ministériels)" },
  { value: "CAVEC",     label: "CAVEC (experts-comptables / CAC)" },
  { value: "CAVAMAC",   label: "CAVAMAC (agents généraux d'assurance)" },
  { value: "CRN",       label: "CRN (notaires)" },
];

const TNS_STATUS: StatutPro[] = ["tns_liberal", "tns_commercant", "tns_artisan", "gerant_majoritaire"];
const SALARIE_STATUS: StatutPro[] = [
  "salarie_non_cadre", "salarie_cadre", "president_sas", "eurl_unique", "fonctionnaire",
];

function isTNS(s: StatutPro | ""): boolean {
  return TNS_STATUS.includes(s as StatutPro);
}
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
  const isTns = isTNS(statut);
  const isSal = isSalarieLike(statut);

  function patchEmployeur(patch: Partial<EmployeurInfo>) {
    const next: EmployeurInfo = { ...(employeur ?? createEmptyEmployeur()), ...patch };
    onChange({ employeur: next });
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
    <div className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND.navy }}>
        {personLabel}
      </div>

      {/* Statut + caisse */}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Statut professionnel">
          <Select
            value={statut || ""}
            onValueChange={(v) => onChange({ statutPro: v as StatutPro })}
          >
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner un statut…" /></SelectTrigger>
            <SelectContent>
              {STATUTS_PRO.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Caisse d'affiliation (assurance maladie / vieillesse)">
          <Select
            value={value.caisseAffiliation ?? ""}
            onValueChange={(v) => onChange({ caisseAffiliation: (v || null) as CodeCaisse | null })}
          >
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner une caisse…" /></SelectTrigger>
            <SelectContent>
              {CAISSES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Bloc Employeur — visible pour salariés et dirigeants assimilés.
          Affiché aussi pour TNS si SIRET utile (entreprise individuelle). */}
      <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: SURFACE.border, background: "rgba(81,106,199,0.04)" }}>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Employeur {isTns ? "/ entreprise" : ""}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="SIRET (14 chiffres)">
            <div className="flex gap-2">
              <Input
                value={employeur?.siret ?? ""}
                onChange={(e) => patchEmployeur({ siret: e.target.value.replace(/\s+/g, "") })}
                className="rounded-xl"
                inputMode="numeric"
                placeholder="14 chiffres"
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
            </div>
          </Field>

          <Field label="Effectif (tranche)">
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
            />
          </Field>
        </div>
      </div>

      {/* Date d'embauche + temps de travail */}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Date d'embauche">
          <Input
            type="date"
            value={value.dateEmbauche ?? ""}
            onChange={(e) => onChange({ dateEmbauche: e.target.value || null })}
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

        {value.tempsTravail.type === "partiel" && (
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
        )}
      </div>

      {/* Revenus — salaire brut ou TNS selon statut */}
      {isSal && (
        <div className="grid gap-3 md:grid-cols-2">
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
            />
          </Field>
        </div>
      )}

      {isTns && (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Revenu BNC annuel (€)">
            <Input
              type="number"
              min={0}
              value={value.revenuBNC ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                onChange({ revenuBNC: Number.isFinite(v as number) ? (v as number) : null });
              }}
              className="rounded-xl"
            />
          </Field>
          <Field label="Revenu BIC annuel (€)">
            <Input
              type="number"
              min={0}
              value={value.revenuBIC ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                onChange({ revenuBIC: Number.isFinite(v as number) ? (v as number) : null });
              }}
              className="rounded-xl"
            />
          </Field>
          <Field label="Contrat Madelin">
            <Select
              value={value.optionMadelin ? "oui" : "non"}
              onValueChange={(v) => onChange({ optionMadelin: v === "oui" })}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="non">Non</SelectItem>
                <SelectItem value="oui">Oui</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
});

BlocStatutEmployeur.displayName = "BlocStatutEmployeur";
