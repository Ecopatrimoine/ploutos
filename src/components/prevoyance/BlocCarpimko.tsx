// ─── BlocCarpimko — saisie minimale CARPIMKO (auxiliaires médicaux) ────
//
// Affiché uniquement pour les auxiliaires médicaux affiliés CARPIMKO.
// Squelette UI calqué sur BlocCarmf / BlocCipav, mais PLUS SIMPLE : les
// prestations CARPIMKO sont FORFAITAIRES (indépendantes du revenu). Le
// revenu N-2 ne sert qu'à la phase 1 CPAM. UI pure — aucune logique métier.
//
// Architecture : IJ libéraux J4-J90, relais allocation journalière
// forfaitaire J91→fin 3e année, puis rente d'invalidité forfaitaire.

import React from "react";
import { Input } from "@/components/ui/input";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { CarpimkoConfig, EntreePerso } from "../../lib/prevoyance/types";

// Config CARPIMKO par défaut (revenu N-2 repris du revenu TNS, invalidité
// totale par défaut — cas le plus parlant en RDV).
export function defaultCarpimko(entreeBase: EntreePerso): CarpimkoConfig {
  return {
    revenuBNC_N2: entreeBase.revenuTNSAnnuel ?? 0,
    tauxInvalidite: 100,
    nbEnfants: entreeBase.nbEnfantsACharge ?? 0,
    besoinTiercePersonne: false,
    marie: entreeBase.marie ?? false,
  };
}

type Props = {
  value: CarpimkoConfig;
  onChange: (next: CarpimkoConfig) => void;
};

// Seuils de garde-fous (alertes douces, non bloquantes).
const SEUIL_ELIGIBILITE_IJ = 4_806; // 10 % PASS 2026
const SEUIL_TAUX_INVALIDITE = 66;
const REVENU_MIN_PLAUSIBLE = 5_000;
const REVENU_MAX_PLAUSIBLE = 500_000;

function SousSection({ titre }: { titre: string }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND.muted }}>
      {titre}
    </div>
  );
}

function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-1.5 rounded-lg px-2.5 py-1.5 text-xs"
      style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}
    >
      {children}
    </div>
  );
}

export const BlocCarpimko = React.memo(function BlocCarpimko({ value, onChange }: Props) {
  const v = value;
  function patch(p: Partial<CarpimkoConfig>) {
    onChange({ ...v, ...p });
  }

  const revenuSousSeuilIJ = v.revenuBNC_N2 > 0 && v.revenuBNC_N2 < SEUIL_ELIGIBILITE_IJ;
  const revenuInhabituel =
    !revenuSousSeuilIJ &&
    v.revenuBNC_N2 > 0 &&
    (v.revenuBNC_N2 < REVENU_MIN_PLAUSIBLE || v.revenuBNC_N2 > REVENU_MAX_PLAUSIBLE);
  const tauxSousSeuil = v.tauxInvalidite > 0 && v.tauxInvalidite < SEUIL_TAUX_INVALIDITE;

  return (
    <div
      className="rounded-xl p-3 space-y-4"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
        Paramètres CARPIMKO (auxiliaire médical)
      </div>

      {/* ── Section 1 : Activité CARPIMKO ──────────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Activité CARPIMKO" />

        <div className="grid gap-3 md:grid-cols-12 items-start">
          <div className="md:col-span-4">
            <Field
              label="Revenu BNC 2024 (déclaration 2042 C-PRO)"
              tooltip="Utilisé UNIQUEMENT pour vos IJ CPAM des 90 premiers jours. Les prestations CARPIMKO (allocation, invalidité, décès) sont forfaitaires, indépendantes du revenu."
            >
              <Input
                type="number" min={0} value={v.revenuBNC_N2}
                onChange={(e) => patch({ revenuBNC_N2: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
            {revenuSousSeuilIJ && (
              <InlineAlert>
                ⚠ Revenu &lt; seuil d'éligibilité IJ (4 806 €) : aucune indemnité journalière CPAM.
              </InlineAlert>
            )}
            {revenuInhabituel && <InlineAlert>Vérifier la saisie : valeur inhabituelle.</InlineAlert>}
          </div>
          <div className="md:col-span-4">
            <Field
              label="Taux d'invalidité projeté (%)"
              tooltip="100 % = invalidité totale (rente forfaitaire 20 160 €/an). 66 à 99 % = partielle (10 080 €/an, montant unique). Sous 66 % : aucune rente."
            >
              <Input
                type="number" min={0} max={100} value={v.tauxInvalidite}
                onChange={(e) =>
                  patch({ tauxInvalidite: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                }
                className="rounded-xl"
              />
            </Field>
            {tauxSousSeuil && (
              <InlineAlert>Sous 66 % : aucune rente d'invalidité CARPIMKO.</InlineAlert>
            )}
          </div>
        </div>
      </div>

      {/* Situation familiale (marié/PACS, descendants à charge) : dérivée du
          dossier (onglet Famille), plus de saisie ici. */}

      {/* ── Section 3 : Garanties personnelles ────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Garanties personnelles" />

        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={v.besoinTiercePersonne}
            onChange={(e) => patch({ besoinTiercePersonne: e.target.checked })}
          />
          <span>Besoin d'une tierce personne (majore l'allocation journalière +20,16 €/j)</span>
        </label>
      </div>

      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Architecture CARPIMKO : IJ CPAM du 4ᵉ au 90ᵉ jour (liées au revenu), puis relais d'une
        allocation journalière forfaitaire (55,44 €/j, + majorations enfants et tierce personne)
        jusqu'à la fin de la 3ᵉ année, enfin rente d'invalidité forfaitaire (10 080 €/an partielle,
        20 160 €/an totale). Toutes les prestations CARPIMKO sont forfaitaires, indépendantes du revenu.
      </div>
    </div>
  );
});

BlocCarpimko.displayName = "BlocCarpimko";
