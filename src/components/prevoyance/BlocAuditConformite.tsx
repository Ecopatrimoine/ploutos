// ─── BlocAuditConformite — affichage des 6 contrôles conformité ────────

import React from "react";
import type { AuditConformite, ControleStatut } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  audit: AuditConformite;
};

const COULEURS_STATUT: Record<ControleStatut, { bg: string; border: string; texte: string; icone: string; label: string }> = {
  conforme:        { bg: "rgba(47, 125, 91, 0.08)",  border: "#2F7D5B", texte: "#1E5238", icone: "✓", label: "CONFORME" },
  non_conforme:    { bg: "rgba(220, 38, 38, 0.08)",  border: "#DC2626", texte: "#7A1F1F", icone: "✗", label: "NON CONFORME" },
  vigilance:       { bg: "rgba(245, 158, 11, 0.08)", border: "#F59E0B", texte: "#7C4A04", icone: "⚠", label: "VIGILANCE" },
  non_applicable:  { bg: "rgba(107, 114, 128, 0.06)", border: "#9CA3AF", texte: "#6B7280", icone: "—", label: "NON APPLICABLE" },
};

export const BlocAuditConformite = React.memo(function BlocAuditConformite({ audit }: Props) {
  // Score visualisé : couleur du badge.
  const scoreCouleur =
    audit.scoreGlobal >= 80 ? "#2F7D5B" :
    audit.scoreGlobal >= 50 ? "#A06A1A" :
    "#B0413E";

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl p-3 flex items-center justify-between"
        style={{ background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Audit de conformité
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: BRAND.muted }}>Score</span>
          <span
            className="rounded-lg px-3 py-1 text-sm font-black"
            style={{ background: scoreCouleur, color: "#fff" }}
          >
            {audit.scoreGlobal} %
          </span>
        </div>
      </div>

      {audit.controles.map((c) => {
        const couleur = COULEURS_STATUT[c.statut];
        return (
          <div
            key={c.id}
            className="rounded-xl p-3"
            style={{
              background: couleur.bg,
              border: `1.5px solid ${couleur.border}`,
            }}
          >
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: couleur.texte }}
              >
                {couleur.icone} {couleur.label}
              </span>
              <span className="text-xs" style={{ color: BRAND.muted }}>
                · {c.reference}
              </span>
            </div>
            <div className="font-bold text-sm mb-1" style={{ color: BRAND.navy }}>
              {c.libelle}
            </div>
            <div className="text-sm leading-relaxed" style={{ color: BRAND.navy }}>
              {c.detail}
            </div>
            {c.actionCorrective && (
              <div className="text-sm mt-2" style={{ color: BRAND.sky, fontWeight: 600 }}>
                → {c.actionCorrective}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

BlocAuditConformite.displayName = "BlocAuditConformite";
