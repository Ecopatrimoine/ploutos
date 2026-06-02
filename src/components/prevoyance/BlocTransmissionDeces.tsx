// ─── BlocTransmissionDeces — saisie des contrats de prévoyance décès PRIVÉS
//     destinés à la TRANSMISSION (capital aux bénéficiaires) ─────────────────
//
// DISTINCT du bloc « Contrats individuels » : ces contrats ne remplacent pas
// un revenu (ils ne sont PAS câblés aux 9 séries de projection), ils
// transmettent un CAPITAL aux bénéficiaires au décès. Saisie + persistance +
// affichage uniquement (Lot 2). La fiscalité 990 I (assiette primes / capital)
// est calculée au Lot 3 par le module succession — rien ici.

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { ContratTransmissionDeces } from "../../types/patrimoine";

type Props = {
  contrats: ContratTransmissionDeces[];
  onChange: (next: ContratTransmissionDeces[]) => void;
};

// Vocabulaire de relation ALIGNÉ sur getSuccessionTaxProfile (succession.ts) :
// le Lot 3 branchera computeAvTax directement, sans conversion. "autre" = tiers
// fiscal (abattement 1 594 € / 60 %), notamment le concubin.
const RELATIONS: Array<{ value: string; label: string }> = [
  { value: "conjoint",        label: "Conjoint (marié)" },
  { value: "pacs_partner",    label: "Partenaire de PACS" },
  { value: "enfant",          label: "Enfant" },
  { value: "petit-enfant",    label: "Petit-enfant" },
  { value: "parent",          label: "Parent (ascendant)" },
  { value: "frereSoeur",      label: "Frère / Sœur" },
  { value: "neveuNiece",      label: "Neveu / Nièce" },
  { value: "enfant_conjoint", label: "Enfant du conjoint" },
  { value: "autre",           label: "Autre / tiers" },
];

function newContrat(): ContratTransmissionDeces {
  return {
    id: `td_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    libelle: "",
    natureAssiette: "primes_avant70",
    capitalTransmis: 0,
    beneficiaires: [],
  };
}

function newBeneficiaire(): ContratTransmissionDeces["beneficiaires"][number] {
  return { name: "", relation: "enfant", share: 0 };
}

export const BlocTransmissionDeces = React.memo(function BlocTransmissionDeces({
  contrats,
  onChange,
}: Props) {
  function updateAt(idx: number, patch: Partial<ContratTransmissionDeces>) {
    onChange(contrats.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeAt(idx: number) {
    onChange(contrats.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...contrats, newContrat()]);
  }

  function updateBenef(
    ci: number,
    bi: number,
    patch: Partial<ContratTransmissionDeces["beneficiaires"][number]>
  ) {
    const contrat = contrats[ci];
    const beneficiaires = contrat.beneficiaires.map((b, i) => (i === bi ? { ...b, ...patch } : b));
    updateAt(ci, { beneficiaires });
  }
  function addBenef(ci: number) {
    updateAt(ci, { beneficiaires: [...contrats[ci].beneficiaires, newBeneficiaire()] });
  }
  function removeBenef(ci: number, bi: number) {
    updateAt(ci, { beneficiaires: contrats[ci].beneficiaires.filter((_, i) => i !== bi) });
  }

  return (
    <div
      className="border rounded-xl p-4 space-y-3"
      style={{ borderColor: SURFACE.border, background: "rgba(81,106,199,0.05)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Transmission décès
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

      <div className="text-xs" style={{ color: BRAND.muted }}>
        Contrats de prévoyance décès dont le capital est versé aux bénéficiaires.
        Ils <strong>transmettent un capital</strong> et ne remplacent pas un revenu —
        distincts des contrats de prévoyance « revenus de remplacement » saisis plus haut.
      </div>

      {contrats.length === 0 && (
        <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          Aucun contrat de transmission renseigné (temporaire décès, contrat avec valeur de rachat…).
        </div>
      )}

      {contrats.map((c, idx) => {
        const isPrimes = c.natureAssiette === "primes_avant70";
        const sommeParts = c.beneficiaires.reduce((s, b) => s + (Number(b.share) || 0), 0);
        const partsIncoherentes = c.beneficiaires.length > 0 && Math.abs(sommeParts - 100) > 0.001;
        return (
          <div
            key={c.id}
            className="rounded-xl p-3 space-y-3"
            style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
          >
            {/* Identité du contrat */}
            <div className="grid gap-3 md:grid-cols-12 items-end">
              <div className="md:col-span-5">
                <Field label="Libellé du contrat">
                  <Input
                    value={c.libelle}
                    onChange={(e) => updateAt(idx, { libelle: e.target.value })}
                    className="rounded-xl"
                    placeholder="ex. Temporaire décès Madelin"
                  />
                </Field>
              </div>
              <div className="md:col-span-5">
                <Field label="Assureur (optionnel)">
                  <Input
                    value={c.assureur ?? ""}
                    onChange={(e) => updateAt(idx, { assureur: e.target.value })}
                    className="rounded-xl"
                    placeholder="ex. compagnie"
                  />
                </Field>
              </div>
              <div className="md:col-span-2 flex justify-end">
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

            {/* Nature de l'assiette fiscale 990 I */}
            <div>
              <div className="text-xs font-bold mb-1.5" style={{ color: BRAND.muted }}>
                Assiette fiscale (990 I)
              </div>
              <div className="flex flex-wrap gap-4">
                {([
                  { value: "primes_avant70", label: "Temporaire décès / fonds perdus" },
                  { value: "capital", label: "Contrat avec valeur de rachat" },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                    style={{ color: BRAND.navy }}
                  >
                    <input
                      type="radio"
                      name={`assiette-${c.id}`}
                      checked={c.natureAssiette === opt.value}
                      onChange={() => updateAt(idx, { natureAssiette: opt.value })}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Montants */}
            <div className="grid gap-3 md:grid-cols-12 items-end">
              <div className="md:col-span-4">
                <Field label="Capital transmis (€)">
                  <Input
                    type="number"
                    min={0}
                    value={c.capitalTransmis}
                    onChange={(e) => updateAt(idx, { capitalTransmis: Number(e.target.value) || 0 })}
                    className="rounded-xl"
                    placeholder="ex. 200000"
                  />
                </Field>
              </div>
              {isPrimes && (
                <div className="md:col-span-4">
                  <Field label="Primes versées avant 70 ans (€)">
                    <Input
                      type="number"
                      min={0}
                      value={c.primesAvant70 ?? 0}
                      onChange={(e) => updateAt(idx, { primesAvant70: Number(e.target.value) || 0 })}
                      className="rounded-xl"
                      placeholder="ex. 30000"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Bénéficiaires */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold" style={{ color: BRAND.muted }}>
                  Bénéficiaires
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addBenef(idx)}
                  className="rounded-xl text-xs h-8 px-3"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Ajouter un bénéficiaire
                </Button>
              </div>

              {c.beneficiaires.length === 0 && (
                <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
                  Aucun bénéficiaire renseigné.
                </div>
              )}

              {c.beneficiaires.map((b, bi) => (
                <div key={bi} className="grid gap-3 md:grid-cols-12 items-end">
                  <div className="md:col-span-5">
                    <Field label="Nom">
                      <Input
                        value={b.name}
                        onChange={(e) => updateBenef(idx, bi, { name: e.target.value })}
                        className="rounded-xl"
                        placeholder="ex. Prénom Nom"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-4">
                    <Field label="Relation">
                      <Select
                        value={b.relation}
                        onValueChange={(v) => updateBenef(idx, bi, { relation: v })}
                      >
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RELATIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Part (%)">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={b.share}
                        onChange={(e) => updateBenef(idx, bi, { share: Number(e.target.value) || 0 })}
                        className="rounded-xl"
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeBenef(idx, bi)}
                      className="rounded-xl h-9 px-3"
                      title="Supprimer ce bénéficiaire"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {partsIncoherentes && (
                <div className="text-xs" style={{ color: BRAND.warning }}>
                  La somme des parts est de {sommeParts.toLocaleString("fr-FR")} % (attendu : 100 %).
                </div>
              )}
            </div>

            {/* Conditions libres */}
            <Field label="Conditions / notes (optionnel)">
              <Input
                value={c.conditions ?? ""}
                onChange={(e) => updateAt(idx, { conditions: e.target.value })}
                className="rounded-xl"
                placeholder="ex. clause bénéficiaire démembrée"
              />
            </Field>
          </div>
        );
      })}
    </div>
  );
});

BlocTransmissionDeces.displayName = "BlocTransmissionDeces";
