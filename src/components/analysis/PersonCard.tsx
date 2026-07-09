// LOT 10a — Acte 2 « Qui reçoit quoi » : card par personne qui reçoit (héritier OU
// bénéficiaire AV non-héritier). Nom + badge de lien, net reçu en gros, puis une
// décomposition en LIGNES DISTINCTES (Succession / Assurance-vie / Capitaux décès)
// — jamais deux fiscalités fusionnées sous un même mot.
import React from "react";
import { ArrowRight } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";

export type PersonCardColor = { bar: string; bg: string; text: string };

export type PersonCardLine = {
  label: string;      // "Succession", "Assurance-vie", "Capitaux décès"
  net: string;        // net reçu sur cette ligne (formaté)
  detail?: string;    // ex. "droits 10 000 € · PP 150 000 €" ou "990 I / 757 B : 8 000 €"
};

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

export function PersonCard({ name, relation, netLabel, lines, color, donated, onDetail }: {
  name: string;
  relation: string;
  netLabel: string;
  lines: PersonCardLine[];
  color: PersonCardColor;
  donated?: boolean;
  onDetail?: () => void;
}) {
  return (
    <div
      className="rounded-2xl relative"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderLeft: `4px solid ${color.bar}`, padding: 16, boxShadow: SURFACE.cardShadow }}
    >
      {donated && (
        <div className="absolute" style={{ top: 10, right: 10, fontSize: 11, fontWeight: 600, background: BRAND.successBg, color: BRAND.success, borderRadius: 6, padding: "2px 6px", border: `1px solid ${BRAND.successBorder}` }}>
          Donation
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: color.bg, color: color.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {initials(name)}
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 mt-0.5" style={{ background: `${color.bar}1F`, color: color.text }}>{relation}</span>
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.navy, lineHeight: 1.1 }}>{netLabel}</div>
      <div className="text-[11px] mb-2" style={{ color: BRAND.muted }}>net reçu</div>
      <div className="space-y-1.5 border-t pt-2" style={{ borderColor: SURFACE.border }}>
        {lines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold" style={{ color: BRAND.navy }}>{l.label}</div>
              {l.detail && <div className="text-[10.5px]" style={{ color: BRAND.muted }}>{l.detail}</div>}
            </div>
            <div className="text-xs font-bold shrink-0" style={{ color: BRAND.navy }}>{l.net}</div>
          </div>
        ))}
      </div>
      {onDetail && (
        <button
          type="button"
          onClick={onDetail}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#A67F32] rounded"
          style={{ color: BRAND.goldText, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Voir le détail <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
