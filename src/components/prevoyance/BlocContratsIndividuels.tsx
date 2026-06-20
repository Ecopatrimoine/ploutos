// ─── BlocContratsIndividuels — saisie liste de contrats perso ─────────

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { NatureContrat, PayloadContratIndividuel } from "../../types/patrimoine";
import {
  splitContratsIndividuels,
  mergeContratsIndividuels,
  categorieDeType,
} from "../../lib/prevoyance/contrats-individuels-split";

type Props = {
  contrats: PayloadContratIndividuel[];
  onChange: (next: PayloadContratIndividuel[]) => void;
};

// Types CRÉABLES (Lot A2) : ce bloc n'édite plus que l'INCAPACITÉ (revenus de
// remplacement) → seuls "ij" et "invalidite" sont créables. Les rentes de
// survivants (deces_rente_*) partent au sous-bloc « Rentes de survivants ».
// ptia/dependance/gav (et deces_capital) sont RETIRÉS de la création mais
// restent LISIBLES, éditables et supprimables si un dossier en porte encore
// (type affiché en item désactivé via le fallback du Select, cf. plus bas).
const TYPES: Array<{ value: PayloadContratIndividuel["type"]; label: string; hint: string }> = [
  { value: "ij",         label: "IJ complémentaires", hint: "IJ journalière (€)" },
  { value: "invalidite", label: "Rente invalidité",   hint: "% du revenu (0-1)" },
];

// Libellés d'AFFICHAGE de TOUS les types lisibles, y compris ceux retirés des
// options de création (legacy) — pour qu'un ancien contrat reste lisible.
const LIBELLES_TOUS: Record<string, { label: string; hint: string }> = {
  deces_capital: { label: "Capital décès",                hint: "Capital (€) versé aux bénéficiaires" },
  ptia:          { label: "PTIA",                         hint: "Capital (€)" },
  dependance:    { label: "Dépendance",                   hint: "Rente mensuelle (€)" },
  gav:           { label: "Garantie accidents de la vie", hint: "Capital (€)" },
  ...Object.fromEntries(TYPES.map((t) => [t.value, { label: t.label, hint: t.hint }])),
};

function typeMeta(t: PayloadContratIndividuel["type"]): { label: string; hint: string } {
  return LIBELLES_TOUS[t] ?? { label: t, hint: "" };
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
  // Ce bloc édite l'INCAPACITÉ (ij + invalidite) ET les garanties LEGACY
  // (ptia/dependance/gav/deces_capital) encore présentes — toutes dans une seule
  // liste éditable. Les rentes de survivants (deces_rente_*) ne sont PAS exposées
  // ici (sous-bloc dédié au Lot A3).
  const parts = splitContratsIndividuels(contrats);
  const vue = [...parts.incapacite, ...parts.legacy];

  // Recompose le tableau complet depuis la VUE éditée : on re-catégorise chaque
  // ligne (un legacy peut être reclassé en ij/invalidite, ou supprimé), puis on
  // merge incapacite' puis legacy'. Les survivants (parts.survivants) ne sont
  // jamais touchés ; l'ordre fixe (incapacite → survivants → legacy) est garanti
  // par l'util A1.
  function commit(vueEditee: PayloadContratIndividuel[]) {
    const incapacitePrime = vueEditee.filter((c) => categorieDeType(c.type) === "incapacite");
    const legacyPrime = vueEditee.filter((c) => categorieDeType(c.type) === "legacy");
    onChange(
      mergeContratsIndividuels(
        mergeContratsIndividuels(contrats, "incapacite", incapacitePrime),
        "legacy",
        legacyPrime,
      ),
    );
  }
  function updateAt(idx: number, patch: Partial<PayloadContratIndividuel>) {
    commit(vue.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeAt(idx: number) {
    commit(vue.filter((_, i) => i !== idx));
  }
  function add() {
    commit([...vue, newContrat()]);
  }

  return (
    <div
      className="border rounded-xl p-4 space-y-3"
      style={{ borderColor: SURFACE.border, background: "rgba(227,175,100,0.05)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
            Incapacité et invalidité
          </div>
          <div className="text-xs mt-0.5" style={{ color: BRAND.muted }}>
            Garanties qui remplacent un revenu (arrêt de travail, invalidité).
          </div>
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

      {vue.length === 0 && (
        <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          Aucun contrat d'incapacité ou d'invalidité saisi.
        </div>
      )}

      {vue.map((c, idx) => {
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
                      {/* Type LEGACY non créable (ex. deces_capital) présent sur un
                          ancien contrat → item DÉSACTIVÉ : il s'affiche correctement
                          mais ne peut pas être re-sélectionné. */}
                      {!TYPES.some((t) => t.value === c.type) && (
                        <SelectItem value={c.type} disabled>{typeMeta(c.type).label}</SelectItem>
                      )}
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
