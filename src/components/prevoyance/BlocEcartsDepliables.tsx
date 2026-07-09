// LOT 10c-bis — ACTE 2 : les écarts en lignes dépliables « Que faire ▾ ». Le contenu
// détaillé des verdicts d'audit (référence, detail, action corrective) migre ICI,
// intégralement. L'écart cadres porte en plus le risque « 3 PASS » — chiffre RÉEL mais
// affiché avec sa CONDITION explicite (jamais comme certitude). <details> natif = a11y.

import React from "react";
import { X, AlertTriangle, ChevronDown, ArrowRight, Check } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import type { EcartCollectif } from "../../lib/presentation/prevoyanceCollective";

const ROUGE = "#B0413E";
const AMBRE = "#A06A1A";

export const BlocEcartsDepliables = React.memo(function BlocEcartsDepliables({
  ecarts,
}: {
  ecarts: EcartCollectif[];
}) {
  if (ecarts.length === 0) {
    return (
      <div
        className="rounded-xl p-3 flex items-start gap-2 text-sm"
        style={{ background: "rgba(47,125,91,0.06)", border: "1px solid rgba(47,125,91,0.25)", color: "#1E5238" }}
      >
        <Check className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>Aucun écart détecté sur les contrôles applicables à la couverture déclarée.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ecarts.map((e) => {
        const nc = e.severite === "non_conforme";
        const coul = nc ? ROUGE : AMBRE;
        const Pastille = nc ? X : AlertTriangle;
        return (
          <details
            key={e.id}
            className="group rounded-xl overflow-hidden"
            style={{ border: `1.5px solid ${coul}`, background: nc ? "rgba(176,65,62,0.05)" : "rgba(160,106,26,0.05)" }}
          >
            <summary className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              <Pastille className="h-4 w-4 shrink-0" style={{ color: coul }} aria-hidden="true" />
              <span className="font-bold text-sm min-w-0 flex-1" style={{ color: BRAND.navy }}>{e.titre}</span>
              <span className="text-[10.5px] uppercase tracking-wide font-bold shrink-0" style={{ color: coul }}>
                {nc ? "Non conforme" : "Vigilance"}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: BRAND.sky }}>
                Que faire <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
              <div className="text-[11px] pt-2" style={{ color: BRAND.muted }}>{e.reference}</div>
              <div className="text-sm leading-relaxed" style={{ color: BRAND.navy }}>{e.detail}</div>
              <div className="flex items-start gap-1.5 text-sm" style={{ color: BRAND.sky, fontWeight: 600 }}>
                <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {e.actionCorrective}
              </div>
              {e.risqueConditionnel && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "rgba(176,65,62,0.06)", border: "1px solid rgba(176,65,62,0.25)", color: "#7A1F1F" }}
                >
                  <span className="font-bold">Risque employeur ≈ {e.risqueConditionnel.montantLabel}</span>{" "}
                  <span>par cadre décédé non couvert — {e.risqueConditionnel.condition}.</span>
                  <div className="text-[11px] mt-0.5" style={{ color: BRAND.muted }}>{e.risqueConditionnel.base}</div>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
});

BlocEcartsDepliables.displayName = "BlocEcartsDepliables";
