// LOT 10b — Acte 1 « L'essentiel » : carte-roi d'un total COMPOSÉ. Le chiffre-roi
// domine (bordure accent, grande typo) ; sous un filet, sa décomposition en lignes
// libellé / montant qui, par construction, SOMMENT au total (réconciliation testée).
// Chaque libellé peut porter une aide (HelpTooltip) — les textes pédagogiques des
// anciens KPI-vitrine migrent ici. Fondation réutilisée aux lots 10c-10e.
import React from "react";
import { BRAND, SURFACE } from "../../constants";
import { HelpTooltip } from "../shared";

export type KpiRoiLine = {
  label: string;
  value: string;        // montant formaté (déjà en euros)
  detail?: string;      // sous-libellé discret (ex. « foncier 17,2 % · meublé 18,6 % »)
  tooltip?: string;     // aide pédagogique sur le libellé
  negative?: boolean;   // ligne en négatif (ex. décote, réduction) : rendue « − X », muted
};

export function KpiRoiCard({ title, amount, accent = BRAND.danger, lines, note, tooltip }: {
  title: string;
  amount: string;          // total formaté (le chiffre-roi)
  accent?: string;         // couleur d'accent (bordure + chiffre-roi) — défaut danger
  lines: KpiRoiLine[];
  note?: React.ReactNode;  // affiché sous les lignes (ou à leur place si aucune ligne)
  tooltip?: string;        // aide sur le titre
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col"
      style={{ background: SURFACE.card, border: `2px solid ${accent}`, boxShadow: "0 4px 18px rgba(15,23,42,0.10)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.muted }}>
        {title}{tooltip && <HelpTooltip text={tooltip} label={title} />}
      </div>
      <div className="font-black mt-1" style={{ color: accent, fontSize: 34, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {amount}
      </div>
      {lines.length > 0 && (
        <div className="mt-3 pt-3 space-y-2 border-t" style={{ borderColor: SURFACE.border }}>
          {lines.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold flex items-center" style={{ color: BRAND.navy }}>
                  {l.label}{l.tooltip && <HelpTooltip text={l.tooltip} label={l.label} />}
                </div>
                {l.detail && <div className="text-[10.5px]" style={{ color: BRAND.muted }}>{l.detail}</div>}
              </div>
              <div className="text-xs font-bold shrink-0" style={{ color: l.negative ? BRAND.muted : BRAND.navy }}>
                {l.negative ? `− ${l.value}` : l.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {note != null && <div className="text-[11px] mt-3" style={{ color: BRAND.muted, fontStyle: "italic" }}>{note}</div>}
    </div>
  );
}
