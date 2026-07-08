// ─── BlocCipav — saisie minimale CIPAV (SPEC_PREVOYANCE_CIPAV) ─────────
//
// Affiché uniquement pour les libéraux non réglementés affiliés CIPAV.
// Squelette UI calqué sur BlocCarmf (LOT CARMF-UI) : 3 sections
// thématiques, labels parlants, aides au survol (tooltip « ? ») et
// garde-fous inline doux. UI pure — aucune logique métier ici.
//
// Architecture CIPAV : IJ libéraux J4-J90, puis TROU (0 €) jusqu'à
// l'invalidité, puis pension par points. Un SEUL champ revenu N-2 pour
// tout le module (IJ + points), décision du lot.

import React from "react";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import type { CipavConfig, EntreePerso } from "../../lib/prevoyance/types";

// Config CIPAV par défaut (revenu N-2 repris du revenu TNS de l'onglet
// Travail, ancienneté reprise de la date d'embauche, invalidité totale
// par défaut — le cas le plus parlant en RDV).
export function defaultCipav(entreeBase: EntreePerso): CipavConfig {
  return {
    revenuBNC_N2: entreeBase.revenuTNSAnnuel ?? 0,
    ancienneteAffiliationMois: entreeBase.ancienneteMois ?? 0,
    cumulEmploiRetraite: false,
    tauxInvalidite: 100,
    marie: entreeBase.marie ?? false,
    nbEnfants: entreeBase.nbEnfantsACharge ?? 0,
    decesAccidentel: false,
  };
}

type Props = {
  value: CipavConfig;
  onChange: (next: CipavConfig) => void;
};

// Seuils de garde-fous (alertes douces, non bloquantes).
const SEUIL_ELIGIBILITE_IJ = 4_806; // 10 % PASS 2026
const AFFILIATION_MIN_MOIS = 12; // 1 an
const SEUIL_TAUX_INVALIDITE = 66; // sous ce taux : pas de pension
const REVENU_MIN_PLAUSIBLE = 5_000;
const REVENU_MAX_PLAUSIBLE = 500_000;

// En-tête de sous-section (hiérarchie visuelle sous le titre du bloc).
function SousSection({ titre }: { titre: string }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND.muted }}>
      {titre}
    </div>
  );
}

// Bandeau d'alerte inline doux (tokens warning de la charte).
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

export const BlocCipav = React.memo(function BlocCipav({ value, onChange }: Props) {
  const v = value;
  function patch(p: Partial<CipavConfig>) {
    onChange({ ...v, ...p });
  }
  const cumul = v.cumulEmploiRetraite;

  // Garde-fous — muets en cumul emploi-retraite (régime CIPAV non applicable).
  const affiliationInsuffisante = !cumul && v.ancienneteAffiliationMois < AFFILIATION_MIN_MOIS;
  const revenuSousSeuilIJ = !cumul && v.revenuBNC_N2 > 0 && v.revenuBNC_N2 < SEUIL_ELIGIBILITE_IJ;
  const revenuInhabituel =
    !cumul &&
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
        Paramètres CIPAV (profession libérale non réglementée)
      </div>

      {/* ── Section 1 : Activité CIPAV ─────────────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Activité CIPAV" />

        {cumul && (
          <InlineAlert>Régime CIPAV non applicable en cumul emploi-retraite.</InlineAlert>
        )}

        <div className="grid gap-3 md:grid-cols-12 items-start" style={{ opacity: cumul ? 0.55 : 1 }}>
          <div className="md:col-span-4">
            <Field
              label="Revenu BNC 2024 (déclaration 2042 C-PRO)"
              tooltip="Revenu retenu pour vos IJ libéraux et pour le calcul de vos points de prévoyance (invalidité, décès, rentes)."
              reserveLabel
            >
              <Input
                type="number" min={0} value={v.revenuBNC_N2} disabled={cumul}
                onChange={(e) => patch({ revenuBNC_N2: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
            {revenuSousSeuilIJ && (
              <InlineAlert>
                <AlertTriangle className="inline-block h-3.5 w-3.5 shrink-0 mr-1 align-text-bottom" aria-hidden="true" />Revenu &lt; seuil d'éligibilité IJ (4 806 €) : aucune indemnité journalière versée.
              </InlineAlert>
            )}
            {revenuInhabituel && <InlineAlert>Vérifier la saisie : valeur inhabituelle.</InlineAlert>}
          </div>
          <div className="md:col-span-4">
            <Field
              label="Ancienneté d'affiliation CIPAV (mois)"
              tooltip="Nombre de mois depuis votre 1ʳᵉ affiliation CIPAV. Au moins 12 mois (1 an) sont requis pour ouvrir droit aux IJ libéraux."
              reserveLabel
            >
              <Input
                type="number" min={0} value={v.ancienneteAffiliationMois} disabled={cumul}
                onChange={(e) => patch({ ancienneteAffiliationMois: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
            {affiliationInsuffisante && (
              <InlineAlert>
                <AlertTriangle className="inline-block h-3.5 w-3.5 shrink-0 mr-1 align-text-bottom" aria-hidden="true" />Affiliation &lt; 1 an : pas d'IJ libéraux — trou de couverture dès le 4ᵉ jour d'arrêt.
              </InlineAlert>
            )}
          </div>
          <div className="md:col-span-4">
            <Field
              label="Taux d'invalidité projeté (%)"
              tooltip="100 % = invalidité totale (pension versée jusqu'à 62 ans). 66 à 99 % = partielle (jusqu'à 67 ans). Sous 66 % : pas de pension CIPAV."
              reserveLabel
            >
              <Input
                type="number" min={0} max={100} value={v.tauxInvalidite} disabled={cumul}
                onChange={(e) =>
                  patch({ tauxInvalidite: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                }
                className="rounded-xl"
              />
            </Field>
            {tauxSousSeuil && (
              <InlineAlert>Sous 66 % : pas de pension d'invalidité CIPAV.</InlineAlert>
            )}
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={v.cumulEmploiRetraite}
            onChange={(e) => patch({ cumulEmploiRetraite: e.target.checked })}
          />
          <span>Cumul emploi-retraite</span>
        </label>
      </div>

      {/* Situation familiale (marié/PACS, enfants à charge) : dérivée du
          dossier (onglet Famille), plus de saisie ici. */}

      {/* ── Section 3 : Garanties personnelles ────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Garanties personnelles" />

        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={v.decesAccidentel}
            onChange={(e) => patch({ decesAccidentel: e.target.checked })}
          />
          <span>Hypothèse décès accidentel (majoration capital)</span>
        </label>
      </div>

      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Architecture CIPAV : IJ libéraux du 4ᵉ au 90ᵉ jour (1/730ᵉ du revenu, plafond 197,51 €/j,
        plancher 26,33 €/j), puis aucun relais — la couverture tombe à zéro jusqu'à la reconnaissance
        d'invalidité (le « trou » CIPAV). La pension d'invalidité par points prend ensuite le relais
        jusqu'à 62 ans (totale) ou 67 ans (partielle). Seules les garanties Madelin individuelles
        comblent le trou.
      </div>
    </div>
  );
});

BlocCipav.displayName = "BlocCipav";
