// ─── CadreMadelin — saisie « cotisation déductible Madelin » (Lot B3) ─────────
//
// Cadre PARTAGÉ (contrats individuels ij/invalidite + contrats de transmission
// décès) : une case « Cotisation déductible de l'IR (Madelin) » et, si cochée, le
// montant de la cotisation annuelle. SAISIE uniquement — le plafond et la
// déduction IR sont calculés ailleurs (helpers madelin.ts / computeIR, Lots B1/B2).
//
// Le patch émis ({ deductibleMadelin?, cotisationMadelinAnnuelle? }) est compatible
// avec PayloadContratIndividuel ET ContratTransmissionDeces (mêmes champs B1).

import React from "react";
import { Input } from "@/components/ui/input";
import { Field } from "../shared";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  deductible: boolean;
  cotisation?: number;
  onChange: (patch: { deductibleMadelin?: boolean; cotisationMadelinAnnuelle?: number }) => void;
};

export const CadreMadelin = React.memo(function CadreMadelin({ deductible, cotisation, onChange }: Props) {
  return (
    <div
      className="rounded-xl p-2.5 space-y-2"
      style={{ background: "rgba(227,175,100,0.07)", border: `1px dashed ${SURFACE.border}` }}
    >
      <label className="flex items-center gap-2 cursor-pointer select-none text-xs" style={{ color: BRAND.navy }}>
        <input
          type="checkbox"
          checked={deductible}
          onChange={(e) => onChange({ deductibleMadelin: e.target.checked })}
        />
        <span className="font-medium">Cotisation déductible de l'IR (Madelin)</span>
      </label>

      {deductible && (
        <div className="md:max-w-xs">
          <Field label="Cotisation annuelle (€)">
            <Input
              type="number"
              min={0}
              value={cotisation ?? ""}
              onChange={(e) => onChange({ cotisationMadelinAnnuelle: Number(e.target.value) || 0 })}
              className="rounded-xl"
              placeholder="ex. 1200"
            />
          </Field>
        </div>
      )}
    </div>
  );
});

CadreMadelin.displayName = "CadreMadelin";
