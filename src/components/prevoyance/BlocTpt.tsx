// ─── BlocTpt — saisie du mi-temps thérapeutique (SPEC_ALD_TPT §5.6) ────

import React from "react";
import { Input } from "@/components/ui/input";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import { defaultTpt, tptInputError } from "../../lib/prevoyance/tpt";
import type { TptConfig } from "../../types/patrimoine";

type Props = {
  value: TptConfig | undefined;
  carenceJours: number;
  onChange: (next: TptConfig) => void;
};

export const BlocTpt = React.memo(function BlocTpt({ value, carenceJours, onChange }: Props) {
  const tpt = value ?? defaultTpt();
  const erreur = tpt.actif
    ? tptInputError(tpt.debutJour, tpt.finJour, tpt.pctTempsTravaille, carenceJours)
    : null;

  function patch(p: Partial<TptConfig>) {
    onChange({ ...tpt, ...p });
  }

  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
    >
      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
        <input type="checkbox" checked={tpt.actif} onChange={(e) => patch({ actif: e.target.checked })} />
        <span className="font-semibold uppercase tracking-widest text-xs" style={{ color: BRAND.sky }}>
          Reprise en mi-temps thérapeutique
        </span>
      </label>

      {tpt.actif && (
        <>
          <div className="grid gap-3 md:grid-cols-12 items-end">
            <div className="md:col-span-3">
              <Field label="Début (jours après l'arrêt)">
                <Input
                  type="number"
                  min={0}
                  value={tpt.debutJour}
                  onChange={(e) => patch({ debutJour: Math.max(0, Number(e.target.value) || 0) })}
                  className="rounded-xl"
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Fin (jours après l'arrêt)">
                <Input
                  type="number"
                  min={0}
                  value={tpt.finJour}
                  onChange={(e) => patch({ finJour: Math.max(0, Number(e.target.value) || 0) })}
                  className="rounded-xl"
                />
              </Field>
            </div>
            <div className="md:col-span-6">
              <Field label={`Temps travaillé : ${Math.round(tpt.pctTempsTravaille * 100)} %`}>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={tpt.pctTempsTravaille}
                  onChange={(e) => patch({ pctTempsTravaille: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
              Après la fin
            </div>
            {(["retour_arret_total", "guerison"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
                <input
                  type="radio"
                  name="apres-tpt"
                  checked={tpt.apresTpt === opt}
                  onChange={() => patch({ apresTpt: opt })}
                />
                <span>{opt === "retour_arret_total" ? "Retour en arrêt total" : "Guérison (reprise temps plein)"}</span>
              </label>
            ))}
          </div>

          <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
            En mi-temps, le salaire partiel réapparaît et l'indemnité journalière comble la perte de
            revenu sans jamais dépasser le salaire à temps plein.
          </div>

          {erreur && (
            <div
              className="rounded-xl p-2 text-xs"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid #F59E0B", color: "#7C4A04" }}
            >
              {erreur}
            </div>
          )}
        </>
      )}
    </div>
  );
});

BlocTpt.displayName = "BlocTpt";
