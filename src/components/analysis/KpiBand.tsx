// LOT 10a — Acte 1 « L'essentiel » : bande de KPI liés par des flèches, lecture
// gauche→droite, le dernier (chiffre-roi) visuellement dominant. Fondation de la
// grammaire d'analyse, réutilisée aux lots 10b-10e.
import React from "react";
import { ArrowRight } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";

export type KpiBandItem = {
  label: string;
  value: string;
  hint?: string;
  dominant?: boolean;   // chiffre-roi : typo plus grande + bordure accent
  accent?: string;      // couleur d'accent (défaut : success pour le dominant, navy sinon)
};

export function KpiBand({ items }: { items: KpiBandItem[] }) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch gap-2">
      {items.map((k, i) => (
        <React.Fragment key={i}>
          <div
            className="flex-1 rounded-2xl px-4 py-3 flex flex-col justify-center"
            style={{
              background: SURFACE.card,
              border: k.dominant ? `2px solid ${k.accent || BRAND.success}` : `1px solid ${SURFACE.border}`,
              boxShadow: k.dominant ? "0 4px 18px rgba(15,23,42,0.10)" : SURFACE.cardShadow,
            }}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND.muted }}>{k.label}</div>
            <div
              className="font-black mt-1"
              style={{
                color: k.dominant ? (k.accent || BRAND.success) : BRAND.navy,
                fontSize: k.dominant ? 30 : 20, lineHeight: 1.1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {k.value}
            </div>
            {k.hint && <div className="text-[11px] mt-1" style={{ color: BRAND.muted }}>{k.hint}</div>}
          </div>
          {i < items.length - 1 && (
            <div className="flex items-center justify-center shrink-0" aria-hidden="true" style={{ color: BRAND.muted }}>
              <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
