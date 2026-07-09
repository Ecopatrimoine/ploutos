// LOT 10c-bis — ACTE 1 : carte-roi « Conformité prévoyance collective ».
// Verdict QUALITATIF (décision David) : verte « Conforme » ou rouge « N écarts
// détectés » — jamais de chiffre-roi (aucun écart ne porte de montant calculé). La
// décomposition liste un écart par ligne avec sa pastille de sévérité. Même famille
// visuelle que KpiRoiCard (bordure accent 2px, titre dominant, filet + lignes).

import React from "react";
import { ShieldCheck, ShieldAlert, X, AlertTriangle } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import type { VerdictConformite, EcartCollectif } from "../../lib/presentation/prevoyanceCollective";

const VERT = "#2F7D5B";
const ROUGE = "#B0413E";
const AMBRE = "#A06A1A";

export const CarteRoiConformite = React.memo(function CarteRoiConformite({
  verdict,
  ecarts,
}: {
  verdict: VerdictConformite;
  ecarts: EcartCollectif[];
}) {
  const accent = verdict.conforme ? VERT : ROUGE;
  const Icone = verdict.conforme ? ShieldCheck : ShieldAlert;

  return (
    <div
      className="rounded-2xl px-4 py-3.5 flex flex-col"
      style={{ background: SURFACE.card, border: `2px solid ${accent}`, boxShadow: "0 4px 18px rgba(15,23,42,0.10)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND.muted }}>
        Conformité prévoyance collective
      </div>
      <div className="font-black mt-1 flex items-center gap-2" style={{ color: accent, fontSize: 26, lineHeight: 1.1 }}>
        <Icone className="h-6 w-6 shrink-0" aria-hidden="true" />
        {verdict.titre}
      </div>

      {verdict.conforme ? (
        <div className="text-[11px] mt-2.5" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          Aucun écart réglementaire sur les contrôles applicables à la couverture déclarée.
        </div>
      ) : (
        <div className="mt-2.5 pt-2.5 space-y-1.5 border-t" style={{ borderColor: SURFACE.border }}>
          {ecarts.map((e) => {
            const nc = e.severite === "non_conforme";
            const Pastille = nc ? X : AlertTriangle;
            const coul = nc ? ROUGE : AMBRE;
            return (
              <div key={e.id} className="flex items-baseline justify-between gap-3">
                <div className="font-semibold flex items-center gap-1.5 min-w-0" style={{ color: BRAND.navy, fontSize: 13 }}>
                  <Pastille className="h-3.5 w-3.5 shrink-0 self-center" style={{ color: coul }} aria-hidden="true" />
                  <span className="truncate">{e.titre}</span>
                </div>
                <span className="font-bold shrink-0 text-[10.5px] uppercase tracking-wide" style={{ color: coul }}>
                  {nc ? "Non conforme" : "Vigilance"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

CarteRoiConformite.displayName = "CarteRoiConformite";
