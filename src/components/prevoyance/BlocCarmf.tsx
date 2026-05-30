// ─── BlocCarmf — saisie minimale CARMF (SPEC_PREVOYANCE_CARMF §2) ──────
//
// Affiché uniquement pour les médecins libéraux affiliés CARMF. Renseigne
// les paramètres propres au régime (statut, option conjoint collaborateur,
// revenu N-2, ancienneté d'affiliation, situation conjoint/tierce personne).
// Le moteur applique alors l'architecture 2 étages et l'invalidité CARMF.
//
// Squelette UI réutilisé tel quel par CIPAV et CARPIMKO (lots ultérieurs) :
// 3 sections thématiques, labels parlants, aides au survol (tooltip « ? »)
// et garde-fous inline doux. UI pure — aucune logique métier ici.

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
    marie: entreeBase.marie ?? false,
    anneesMariage: entreeBase.anneesMariage ?? 0,
    ressourcesConjoint: entreeBase.ressourcesConjointAnnuelles ?? 0,
    besoinTiercePersonne: false,
  };
}

type Props = {
  value: CarmfConfig;
  onChange: (next: CarmfConfig) => void;
};

// Seuils de garde-fous de saisie (alertes douces, non bloquantes).
const REVENU_BNC_MIN = 5_000;
const REVENU_BNC_MAX = 500_000;
const ANCIENNETE_MIN_DROITS_PLEINS = 8; // trimestres = 2 ans

// En-tête de sous-section : hiérarchie visuelle sous le titre du bloc.
function SousSection({ titre }: { titre: string }) {
  return (
    <div
      className="text-[11px] font-bold uppercase tracking-wider"
      style={{ color: BRAND.muted }}
    >
      {titre}
    </div>
  );
}

// Bandeau d'alerte inline doux (réutilise les tokens warning de la charte —
// même grammaire visuelle que le warning micro-TNS de l'onglet).
function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-1.5 rounded-lg px-2.5 py-1.5 text-xs"
      style={{
        background: BRAND.warningBg,
        border: `1px solid ${BRAND.warningBorder}`,
        color: BRAND.warning,
      }}
    >
      {children}
    </div>
  );
}

export const BlocCarmf = React.memo(function BlocCarmf({ value, onChange }: Props) {
  const v = value;
  function patch(p: Partial<CarmfConfig>) {
    onChange({ ...v, ...p });
  }
  const estConjoint = v.statut === "conjoint_collaborateur";
  const cumul = v.cumulEmploiRetraite;

  // Garde-fous (Niveau 2) — muets en cumul emploi-retraite : le régime IJ
  // CARMF n'y est pas applicable, les contrôles d'activité deviennent moot.
  const ancienneteInsuffisante = !cumul && v.ancienneteAffiliationTrimestres < ANCIENNETE_MIN_DROITS_PLEINS;
  const revenuInhabituel =
    !cumul && v.revenuBNC_N2 > 0 && (v.revenuBNC_N2 < REVENU_BNC_MIN || v.revenuBNC_N2 > REVENU_BNC_MAX);

  return (
    <div
      className="rounded-xl p-3 space-y-4"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
        Paramètres CARMF (médecin libéral)
      </div>

      {/* ── Section 1 : Activité CARMF ─────────────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Activité CARMF" />

        {cumul && (
          <InlineAlert>Régime IJ CARMF non applicable en cumul emploi-retraite.</InlineAlert>
        )}

        <div
          className="grid gap-3 md:grid-cols-12 items-start"
          style={{ opacity: cumul ? 0.55 : 1 }}
        >
          <div className="md:col-span-4">
            <Field label="Statut CARMF">
              <Select
                value={v.statut}
                disabled={cumul}
                onValueChange={(s) => patch({ statut: s as CarmfConfig["statut"] })}
              >
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
              <Field label="Option conjoint collaborateur">
                <Select
                  value={v.optionConjointCollaborateur ?? "moitie"}
                  disabled={cumul}
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
            <Field
              label="Revenu BNC 2024 (déclaration 2042 C-PRO)"
              tooltip="Revenu retenu par la CARMF pour calculer vos IJ 2026."
            >
              <Input
                type="number" min={0} value={v.revenuBNC_N2} disabled={cumul}
                onChange={(e) => patch({ revenuBNC_N2: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
            {revenuInhabituel && (
              <InlineAlert>Vérifier la saisie : valeur inhabituelle.</InlineAlert>
            )}
          </div>
          <div className="md:col-span-4">
            <Field
              label="Ancienneté d'affiliation CARMF (trimestres)"
              tooltip="Nombre de trimestres depuis votre 1ʳᵉ affiliation CARMF (défaut 24 = ≥ 6 ans, taux plein)."
            >
              <Input
                type="number" min={0} value={v.ancienneteAffiliationTrimestres} disabled={cumul}
                onChange={(e) => patch({ ancienneteAffiliationTrimestres: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
            {ancienneteInsuffisante && (
              <InlineAlert>
                ⚠ Affiliation &lt; 2 ans : pas de droits aux IJ CARMF pleines pendant cette période.
              </InlineAlert>
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

      {/* Situation familiale (marié, années de mariage, ressources du conjoint) :
          dérivée du dossier (onglet Famille + revenus), plus de saisie ici. */}

      {/* ── Section 3 : Garanties personnelles ────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Garanties personnelles" />

        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={v.besoinTiercePersonne}
            onChange={(e) => patch({ besoinTiercePersonne: e.target.checked })}
          />
          <span>Besoin d'une tierce personne (invalidité)</span>
        </label>
      </div>

      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Architecture 2 étages : indemnités CPAM les 90 premiers jours, puis relais CARMF jusqu'à 3 ans,
        enfin pension d'invalidité jusqu'au 62e anniversaire. 8 trimestres d'affiliation (2 ans) sont
        requis pour les droits pleins.
      </div>
    </div>
  );
});

BlocCarmf.displayName = "BlocCarmf";
