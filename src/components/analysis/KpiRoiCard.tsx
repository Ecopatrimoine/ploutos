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

// A2 (addendum 10b) : le ROUGE est réservé aux alertes — un total (impôt, etc.) n'en
// est pas un. Défaut = accent NEUTRE (encre navy) pour la bordure ; le chiffre-roi est
// en couleur de TEXTE principale. La carte-roi domine par la hiérarchie typographique,
// pas par la taille de sa boîte (A4 : montant ~28px, lignes compactes 13px).
export function KpiRoiCard({ title, amount, accent = BRAND.navy, lines, note, tooltip }: {
  title: string;
  amount: string;          // total formaté (le chiffre-roi)
  accent?: string;         // couleur de la BORDURE d'accent (neutre par défaut : navy)
  lines: KpiRoiLine[];
  note?: React.ReactNode;  // affiché sous les lignes (ou à leur place si aucune ligne)
  tooltip?: string;        // aide sur le titre
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5 flex flex-col"
      style={{ background: SURFACE.card, border: `2px solid ${accent}`, boxShadow: "0 4px 18px rgba(15,23,42,0.10)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.muted }}>
        {title}{tooltip && <HelpTooltip text={tooltip} label={title} />}
      </div>
      <div className="font-black mt-1" style={{ color: BRAND.navy, fontSize: 28, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {amount}
      </div>
      {lines.length > 0 && (
        <div className="mt-2.5 pt-2.5 space-y-1.5 border-t" style={{ borderColor: SURFACE.border }}>
          {lines.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold flex items-center" style={{ color: BRAND.navy, fontSize: 13 }}>
                  {l.label}{l.tooltip && <HelpTooltip text={l.tooltip} label={l.label} />}
                </div>
                {l.detail && <div className="text-[10.5px]" style={{ color: BRAND.muted }}>{l.detail}</div>}
              </div>
              <div className="font-bold shrink-0" style={{ color: l.negative ? BRAND.muted : BRAND.navy, fontSize: 13 }}>
                {l.negative ? `− ${l.value}` : l.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {note != null && <div className="text-[11px] mt-2.5" style={{ color: BRAND.muted, fontStyle: "italic" }}>{note}</div>}
    </div>
  );
}
