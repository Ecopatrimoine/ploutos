// ─── BlocContratsIndividuels — saisie liste de contrats perso ─────────

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { NatureContrat, PayloadContratIndividuel } from "../../types/patrimoine";

type Props = {
  contrats: PayloadContratIndividuel[];
  onChange: (next: PayloadContratIndividuel[]) => void;
};

const TYPES: Array<{ value: PayloadContratIndividuel["type"]; label: string; hint: string }> = [
  { value: "deces_capital",    label: "Capital décès",                hint: "Capital (€) versé aux bénéficiaires" },
  { value: "deces_rente_conj", label: "Rente conjoint (décès)",       hint: "Rente mensuelle (€) au conjoint" },
  { value: "deces_rente_educ", label: "Rente éducation (décès)",      hint: "Rente mensuelle (€) par enfant" },
  { value: "ij",               label: "IJ complémentaires",           hint: "IJ journalière (€)" },
  { value: "invalidite",       label: "Rente invalidité",             hint: "% du revenu (0-1)" },
  { value: "ptia",             label: "PTIA",                         hint: "Capital (€)" },
  { value: "dependance",       label: "Dépendance",                   hint: "Rente mensuelle (€)" },
  { value: "gav",              label: "Garantie accidents de la vie", hint: "Capital (€)" },
];

function typeMeta(t: PayloadContratIndividuel["type"]): { label: string; hint: string } {
  return TYPES.find((x) => x.value === t) ?? { label: t, hint: "" };
}

function newContrat(): PayloadContratIndividuel {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "ij",
    capitalOuMontant: 0,
  };
}

export const BlocContratsIndividuels = React.memo(function BlocContratsIndividuels({
  contrats,
  onChange,
}: Props) {
  function updateAt(idx: number, patch: Partial<PayloadContratIndividuel>) {
    onChange(contrats.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeAt(idx: number) {
    onChange(contrats.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...contrats, newContrat()]);
  }

  return (
    <div
      className="border rounded-xl p-4 space-y-3"
      style={{ borderColor: SURFACE.border, background: "rgba(227,175,100,0.05)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Contrats individuels
        </div>
        <Button
          type="button"
          onClick={add}
          className="rounded-xl text-xs h-8 px-3"
          style={{ background: BRAND.navy }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un contrat
        </Button>
      </div>

      {contrats.length === 0 && (
        <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          Aucun contrat individuel renseigné (Madelin, GAV, prévoyance individuelle…).
        </div>
      )}

      {contrats.map((c, idx) => {
        const meta = typeMeta(c.type);
        const isIJ = c.type === "ij";
        const isInvalidite = c.type === "invalidite";
        return (
          <div
            key={c.id}
            className="rounded-xl p-3 space-y-2"
            style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
          >
            <div className="grid gap-3 md:grid-cols-12 items-end">
              <div className="md:col-span-4">
                <Field label="Type">
                  <Select
                    value={c.type}
                    onValueChange={(v) => updateAt(idx, { type: v as PayloadContratIndividuel["type"] })}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label={isInvalidite ? "% revenu (ex. 0.5)" : "Montant (€)"}>
                  <Input
                    type="number"
                    min={0}
                    step={isInvalidite ? 0.01 : 1}
                    value={isInvalidite ? c.baseInvalidite ?? 0 : c.capitalOuMontant}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      if (isInvalidite) updateAt(idx, { baseInvalidite: v });
                      else updateAt(idx, { capitalOuMontant: v });
                    }}
                    className="rounded-xl"
                    placeholder={isInvalidite ? "0.5" : "ex. 100000"}
                  />
                </Field>
              </div>
              {isIJ && (
                <>
                  <div className="md:col-span-2">
                    <Field label="Franchise (j)">
                      <Input
                        type="number"
                        min={0}
                        value={c.franchiseJours ?? 0}
                        onChange={(e) => updateAt(idx, { franchiseJours: Number(e.target.value) || 0 })}
                        className="rounded-xl"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Plafond (j)">
                      <Input
                        type="number"
                        min={0}
                        value={c.plafondJoursIJ ?? 1095}
                        onChange={(e) => updateAt(idx, { plafondJoursIJ: Number(e.target.value) || 0 })}
                        className="rounded-xl"
                      />
                    </Field>
                  </div>
                </>
              )}
              <div className={`md:col-span-${isIJ ? 1 : 5} flex justify-end`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeAt(idx)}
                  className="rounded-xl h-9 px-3"
                  title="Supprimer ce contrat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {(isIJ || isInvalidite) && (
              <div className="grid gap-3 md:grid-cols-12 items-end">
                <div className="md:col-span-4">
                  <Field label="Nature">
                    <Select
                      value={c.nature ?? "indemnitaire"}
                      onValueChange={(v) => updateAt(idx, { nature: v as NatureContrat })}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indemnitaire">Indemnitaire (plafonnée au revenu)</SelectItem>
                        <SelectItem value="forfaitaire">Forfaitaire (versée en plein)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="md:col-span-8 text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
                  Indemnitaire : la prestation est plafonnée à votre revenu réel (cas le plus fréquent).
                  Forfaitaire : le montant souscrit est versé intégralement. Vérifiez vos conditions générales.
                </div>
              </div>
            )}
            <div className="text-xs" style={{ color: BRAND.muted }}>
              {meta.hint}
            </div>
          </div>
        );
      })}
    </div>
  );
});

BlocContratsIndividuels.displayName = "BlocContratsIndividuels";
