// ─── BlocCarmf — saisie minimale CARMF (SPEC_PREVOYANCE_CARMF §2) ──────
//
// Affiché uniquement pour les médecins libéraux affiliés CARMF. Renseigne
// les paramètres propres au régime (statut, option conjoint collaborateur,
// revenu N-2, ancienneté d'affiliation, situation conjoint/tierce personne).
// Le moteur applique alors l'architecture 2 étages et l'invalidité CARMF.

import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { CarmfConfig, EntreePerso } from "../../lib/prevoyance/types";

// Config CARMF par défaut pour un médecin affilié (revenu N-2 repris du
// revenu TNS de l'onglet Travail, affiliation supposée pleine — à ajuster).
export function defaultCarmf(entreeBase: EntreePerso): CarmfConfig {
  return {
    statut: "medecin_titulaire",
    revenuBNC_N2: entreeBase.revenuTNSAnnuel ?? 0,
    ancienneteAffiliationTrimestres: 24,
    cumulEmploiRetraite: false,
    marie: false,
    anneesMariage: 0,
    ressourcesConjoint: 0,
    besoinTiercePersonne: false,
  };
}

type Props = {
  value: CarmfConfig;
  onChange: (next: CarmfConfig) => void;
};

export const BlocCarmf = React.memo(function BlocCarmf({ value, onChange }: Props) {
  const v = value;
  function patch(p: Partial<CarmfConfig>) {
    onChange({ ...v, ...p });
  }
  const estConjoint = v.statut === "conjoint_collaborateur";

  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
        Paramètres CARMF (médecin libéral)
      </div>

      <div className="grid gap-3 md:grid-cols-12 items-end">
        <div className="md:col-span-4">
          <Field label="Statut CARMF">
            <Select value={v.statut} onValueChange={(s) => patch({ statut: s as CarmfConfig["statut"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="medecin_titulaire">Médecin titulaire</SelectItem>
                <SelectItem value="conjoint_collaborateur">Conjoint collaborateur</SelectItem>
                <SelectItem value="medecin_remplacant">Médecin remplaçant</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {estConjoint && (
          <div className="md:col-span-4">
            <Field label="Option conjoint">
              <Select
                value={v.optionConjointCollaborateur ?? "moitie"}
                onValueChange={(o) => patch({ optionConjointCollaborateur: o as "quart" | "moitie" })}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quart">Quart</SelectItem>
                  <SelectItem value="moitie">Moitié</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        <div className="md:col-span-4">
          <Field label="Revenu BNC N-2 (€)">
            <Input
              type="number" min={0} value={v.revenuBNC_N2}
              onChange={(e) => patch({ revenuBNC_N2: Math.max(0, Number(e.target.value) || 0) })}
              className="rounded-xl"
            />
          </Field>
        </div>
        <div className="md:col-span-4">
          <Field label="Ancienneté affiliation (trimestres)">
            <Input
              type="number" min={0} value={v.ancienneteAffiliationTrimestres}
              onChange={(e) => patch({ ancienneteAffiliationTrimestres: Math.max(0, Number(e.target.value) || 0) })}
              className="rounded-xl"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: BRAND.navy }}>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={v.cumulEmploiRetraite} onChange={(e) => patch({ cumulEmploiRetraite: e.target.checked })} />
          <span>Cumul emploi-retraite</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={v.marie} onChange={(e) => patch({ marie: e.target.checked })} />
          <span>Marié(e)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={v.besoinTiercePersonne} onChange={(e) => patch({ besoinTiercePersonne: e.target.checked })} />
          <span>Besoin tierce personne (invalidité)</span>
        </label>
      </div>

      {v.marie && (
        <div className="grid gap-3 md:grid-cols-12 items-end">
          <div className="md:col-span-4">
            <Field label="Années de mariage">
              <Input
                type="number" min={0} value={v.anneesMariage}
                onChange={(e) => patch({ anneesMariage: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Ressources du conjoint (€)">
              <Input
                type="number" min={0} value={v.ressourcesConjoint}
                onChange={(e) => patch({ ressourcesConjoint: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
          </div>
        </div>
      )}

      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Architecture 2 étages : indemnités CPAM les 90 premiers jours, puis relais CARMF jusqu'à 3 ans,
        enfin pension d'invalidité jusqu'au 62e anniversaire. 8 trimestres d'affiliation (2 ans) sont
        requis pour les droits pleins.
      </div>
    </div>
  );
});

BlocCarmf.displayName = "BlocCarmf";
