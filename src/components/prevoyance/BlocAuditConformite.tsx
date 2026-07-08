// ─── BlocAuditConformite — affichage des 6 contrôles conformité ────────

import React from "react";
import { Check, X, AlertTriangle, Minus, ArrowRight } from "lucide-react";
import type { AuditConformite, ControleStatut } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  audit: AuditConformite;
};

const COULEURS_STATUT: Record<ControleStatut, { bg: string; border: string; texte: string; icone: React.ComponentType<{ className?: string }>; label: string }> = {
  conforme:        { bg: "rgba(47, 125, 91, 0.08)",  border: "#2F7D5B", texte: "#1E5238", icone: Check, label: "CONFORME" },
  non_conforme:    { bg: "rgba(220, 38, 38, 0.08)",  border: "#DC2626", texte: "#7A1F1F", icone: X, label: "NON CONFORME" },
  vigilance:       { bg: "rgba(245, 158, 11, 0.08)", border: "#F59E0B", texte: "#7C4A04", icone: AlertTriangle, label: "VIGILANCE" },
  non_applicable:  { bg: "rgba(107, 114, 128, 0.06)", border: "#9CA3AF", texte: "#6B7280", icone: Minus, label: "NON APPLICABLE" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {audit.controles.map((c) => {
        const couleur = COULEURS_STATUT[c.statut];
        const Icone = couleur.icone;
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
                className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest"
                style={{ color: couleur.texte }}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden="true" /> {couleur.label}
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
            {(c.actionCorrective || c.statut === "non_conforme" || c.statut === "vigilance") && (
              <div className="flex items-start gap-1 text-sm mt-2" style={{ color: BRAND.sky, fontWeight: 600 }}>
                <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {c.actionCorrective ?? "Vérifier la conformité du dispositif déclaré et le formaliser au regard de la référence légale citée."}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
});

BlocAuditConformite.displayName = "BlocAuditConformite";
