// LOT 10c-bis — ACTE 1 (contexte) : deux cards latérales de la carte-roi.
// ① Convention collective (IDCC + nom + « via SIRET »). ② Santé collective ANI
// (statut du contrôle c_sante_ani_obligatoire). Purement présentationnel.

import React from "react";
import { Building2, HeartPulse, Check, X, AlertTriangle, Minus } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import type { ControleStatut } from "../../lib/prevoyance/types";
import type { SanteAniInfo } from "../../lib/presentation/prevoyanceCollective";

const STATUT_COUL: Record<ControleStatut, { c: string; Icone: React.ComponentType<{ className?: string }> }> = {
  conforme: { c: "#1E5238", Icone: Check },
  non_conforme: { c: "#7A1F1F", Icone: X },
  vigilance: { c: "#7C4A04", Icone: AlertTriangle },
  non_applicable: { c: "#6B7280", Icone: Minus },
};

const cardStyle = { background: SURFACE.card, border: `1px solid ${SURFACE.border}` } as const;

export const BlocContexteCollectif = React.memo(function BlocContexteCollectif({
  idcc,
  nomCCN,
  santeAni,
}: {
  idcc: string | null;
  nomCCN: string | null;
  santeAni: SanteAniInfo;
}) {
  const sante = santeAni ? STATUT_COUL[santeAni.statut] : null;
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ① Convention collective */}
      <div className="rounded-2xl px-4 py-3" style={cardStyle}>
        <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: BRAND.muted }}>
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Convention collective
        </div>
        {nomCCN ? (
          <>
            <div className="font-bold mt-1 text-sm leading-snug" style={{ color: BRAND.navy }}>{nomCCN}</div>
            {idcc && (
              <div className="text-[11px] mt-0.5" style={{ color: BRAND.muted }}>IDCC {idcc} · via SIRET</div>
            )}
          </>
        ) : (
          <div className="font-semibold mt-1 text-sm" style={{ color: BRAND.muted }}>Non renseignée</div>
        )}
      </div>

      {/* ② Santé collective (ANI) */}
      <div className="rounded-2xl px-4 py-3" style={cardStyle}>
        <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: BRAND.muted }}>
          <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" /> Santé collective (ANI 2013)
        </div>
        {santeAni && sante ? (
          <>
            <div className="font-bold mt-1 inline-flex items-center gap-1.5 text-sm" style={{ color: sante.c }}>
              <sante.Icone className="h-4 w-4" aria-hidden="true" /> {santeAni.label}
            </div>
            <div className="text-[11px] mt-1 leading-snug" style={{ color: BRAND.muted }}>{santeAni.detail}</div>
          </>
        ) : (
          <div className="font-semibold mt-1 text-sm" style={{ color: BRAND.muted }}>—</div>
        )}
      </div>
    </div>
  );
});

BlocContexteCollectif.displayName = "BlocContexteCollectif";
