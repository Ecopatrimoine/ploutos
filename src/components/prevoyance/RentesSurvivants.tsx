// ─── RentesSurvivants — saisie minimaliste des rentes de survivants ──────────
//
// Édite UNIQUEMENT le sous-ensemble "survivants" (deces_rente_conj /
// deces_rente_educ) du tableau contratsIndividuels. Rentes versées aux
// survivants au décès ; bénéficiaires déterminés automatiquement (aucune saisie
// de bénéficiaire, pas de 990 I, pas de nature, pas de franchise). Le calcul
// (regles.ts) lit ces contrats INCHANGÉS.
//
// La prop `contrats` reste le tableau COMPLET ; le split/merge (util A1) garantit
// qu'aucune autre catégorie (incapacité, legacy) n'est perdue à l'édition.

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { PayloadContratIndividuel } from "../../types/patrimoine";
import { splitContratsIndividuels, mergeContratsIndividuels } from "../../lib/prevoyance/contrats-individuels-split";

type Props = {
  contrats: PayloadContratIndividuel[];
  onChange: (next: PayloadContratIndividuel[]) => void;
};

// Les 2 SEULS types de la catégorie "survivants" (cf. categorieDeType, util A1).
// Pas d'item legacy : par construction, cette catégorie ne contient que ces 2 types.
const TYPES: Array<{ value: PayloadContratIndividuel["type"]; label: string }> = [
  { value: "deces_rente_conj", label: "Rente de conjoint" },
  { value: "deces_rente_educ", label: "Rente éducation" },
];

function newRente(): PayloadContratIndividuel {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "deces_rente_conj",
    capitalOuMontant: 0,
  };
}

export const RentesSurvivants = React.memo(function RentesSurvivants({
  contrats,
  onChange,
}: Props) {
  // Vue éditable = sous-ensemble survivants. incapacité + legacy ne sont ni
  // affichés ni modifiés par ce composant.
  const survivants = splitContratsIndividuels(contrats).survivants;

  // Toute édition ne recompose QUE la catégorie survivants : incapacité et legacy
  // présents dans `contrats` sont préservés à l'identique (util A1).
  function commit(nouvelleListe: PayloadContratIndividuel[]) {
    onChange(mergeContratsIndividuels(contrats, "survivants", nouvelleListe));
  }
  function updateAt(idx: number, patch: Partial<PayloadContratIndividuel>) {
    commit(survivants.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeAt(idx: number) {
    commit(survivants.filter((_, i) => i !== idx));
  }
  function add() {
    commit([...survivants, newRente()]);
  }

  return (
    <div
      className="border rounded-xl p-4 space-y-3"
      style={{ borderColor: SURFACE.border, background: "rgba(81,106,199,0.05)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Rentes de survivants
        </div>
        <Button
          type="button"
          onClick={add}
          className="rounded-xl text-xs h-8 px-3"
          style={{ background: BRAND.navy }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une rente
        </Button>
      </div>

      {survivants.length === 0 && (
        <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          Aucune rente de survivant saisie.
        </div>
      )}

      {survivants.map((c, idx) => {
        const isEduc = c.type === "deces_rente_educ";
        return (
          <div
            key={c.id}
            className="rounded-xl p-3 space-y-2"
            style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
          >
            <div className="grid gap-3 md:grid-cols-12 items-end">
              <div className="md:col-span-5">
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
              <div className="md:col-span-5">
                <Field label={isEduc ? "Montant (€/mois, par enfant)" : "Montant (€/mois)"}>
                  <Input
                    type="number"
                    min={0}
                    value={c.capitalOuMontant}
                    onChange={(e) => updateAt(idx, { capitalOuMontant: Number(e.target.value) || 0 })}
                    className="rounded-xl"
                    placeholder="ex. 1000"
                  />
                </Field>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeAt(idx)}
                  className="rounded-xl h-9 px-3"
                  title="Supprimer cette rente"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
              {isEduc
                ? "Versée à chaque enfant à charge — bénéficiaires déterminés automatiquement."
                : "Versée au conjoint survivant — bénéficiaire déterminé automatiquement."}
            </div>
          </div>
        );
      })}
    </div>
  );
});

RentesSurvivants.displayName = "RentesSurvivants";
