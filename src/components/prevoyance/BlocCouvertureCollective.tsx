// ─── BlocCouvertureCollective — saisie de la notice prévoyance ────────
//
// Le client lit sa notice et saisit ici les garanties effectives :
//   - IJ collective (pctSalaire / franchise / plafondJours / baseCalcul)
//   - Invalidité collective cat1/cat2/cat3 (pctSalaire pour chaque)
//   - Capital décès (montant fixe ou formule textuelle)
//
// Toggle global "Couverture collective en place ?" : si non,
// onChange(null) → la projection n'utilise aucun étage collectif.

import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { PayloadCouvertureCollective } from "../../types/patrimoine";

type Props = {
  value: PayloadCouvertureCollective | null;
  onChange: (next: PayloadCouvertureCollective | null) => void;
};

function defaultCouv(): PayloadCouvertureCollective {
  return {
    ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" },
    invalidite: {
      cat1: { pctSalaire: 0.4 },
      cat2: { pctSalaire: 0.8 },
      cat3: { pctSalaire: 1.0 },
    },
    capitalDeces: { montant: 0 },
  };
}

export const BlocCouvertureCollective = React.memo(function BlocCouvertureCollective({
  value,
  onChange,
}: Props) {
  const active = value !== null;

  function patch(partial: Partial<PayloadCouvertureCollective>) {
    onChange({ ...(value ?? defaultCouv()), ...partial });
  }
  function patchIJ(partial: Partial<NonNullable<PayloadCouvertureCollective["ij"]>>) {
    const base = value?.ij ?? defaultCouv().ij!;
    patch({ ij: { ...base, ...partial } });
  }
  function patchInv(cat: "cat1" | "cat2" | "cat3", pct: number) {
    const base = value?.invalidite ?? defaultCouv().invalidite!;
    patch({ invalidite: { ...base, [cat]: { pctSalaire: pct } } });
  }
  function patchDC(montant: number) {
    patch({ capitalDeces: { ...(value?.capitalDeces ?? { montant: 0 }), montant } });
  }

  return (
    <div
      className="border rounded-xl p-4 space-y-3"
      style={{ borderColor: SURFACE.border, background: "rgba(81,106,199,0.04)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Couverture collective d'entreprise
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onChange(e.target.checked ? defaultCouv() : null)}
          />
          <span>En place</span>
        </label>
      </div>

      {!active && (
        <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          Aucune couverture collective renseignée. Activez la case ci-dessus
          puis renseignez les garanties depuis la notice de l'entreprise.
        </div>
      )}

      {active && value && (
        <>
          {/* IJ collective */}
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: BRAND.navy }}>
              Indemnités journalières
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="% du salaire">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1.5}
                  value={value.ij?.pctSalaire ?? 0.8}
                  onChange={(e) => patchIJ({ pctSalaire: Number(e.target.value) || 0 })}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Franchise (jours)">
                <Input
                  type="number"
                  min={0}
                  value={value.ij?.franchise ?? 90}
                  onChange={(e) => patchIJ({ franchise: Number(e.target.value) || 0 })}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Plafond (jours)">
                <Input
                  type="number"
                  min={0}
                  value={value.ij?.plafondJours ?? 1095}
                  onChange={(e) => patchIJ({ plafondJours: Number(e.target.value) || 0 })}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Base de calcul">
                <Select
                  value={value.ij?.baseCalcul ?? "T1_T2"}
                  onValueChange={(v) => patchIJ({ baseCalcul: v as "T1_T2" | "T1_seul" | "brut_total" })}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T1_T2">T1 + T2</SelectItem>
                    <SelectItem value="T1_seul">T1 seule</SelectItem>
                    <SelectItem value="brut_total">Brut total</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* Invalidité */}
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: BRAND.navy }}>
              Rentes invalidité (% du salaire par catégorie)
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Cat 1 (activité réduite)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1.5}
                  value={value.invalidite?.cat1.pctSalaire ?? 0.4}
                  onChange={(e) => patchInv("cat1", Number(e.target.value) || 0)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Cat 2 (incapable)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1.5}
                  value={value.invalidite?.cat2.pctSalaire ?? 0.8}
                  onChange={(e) => patchInv("cat2", Number(e.target.value) || 0)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Cat 3 (+ tierce personne)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1.5}
                  value={value.invalidite?.cat3.pctSalaire ?? 1.0}
                  onChange={(e) => patchInv("cat3", Number(e.target.value) || 0)}
                  className="rounded-xl"
                />
              </Field>
            </div>
          </div>

          {/* Capital décès */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Capital décès (€)">
              <Input
                type="number"
                min={0}
                value={value.capitalDeces?.montant ?? 0}
                onChange={(e) => patchDC(Number(e.target.value) || 0)}
                className="rounded-xl"
                placeholder="ex. 100000"
              />
            </Field>
          </div>
        </>
      )}
    </div>
  );
});

BlocCouvertureCollective.displayName = "BlocCouvertureCollective";
