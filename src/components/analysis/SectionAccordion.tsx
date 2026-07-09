// LOT 10a — Acte 3 « Les masses » : section repliable, FERMÉE par défaut, avec un
// titre + un résumé chiffré VISIBLE même fermée (rien n'est caché, tout est rangé).
// Chevron lucide, aria-expanded. Fondation réutilisée aux lots 10b-10e.
import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";

export function SectionAccordion({ title, summary, badge, defaultOpen = false, children }: {
  title: string;
  summary?: React.ReactNode;   // résumé chiffré affiché même quand la section est fermée
  badge?: React.ReactNode;     // pastille affichée sur la ligne de titre (ex. complétude, Lot 10d)
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${SURFACE.border}`, background: SURFACE.card }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A67F32]"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <div className="min-w-0">
          <div className="text-sm font-bold flex items-center flex-wrap gap-2" style={{ color: BRAND.navy }}>
            <span className="min-w-0">{title}</span>{badge}
          </div>
          {summary != null && <div className="text-xs mt-0.5" style={{ color: BRAND.muted }}>{summary}</div>}
        </div>
        <span className="shrink-0" style={{ color: BRAND.muted }} aria-hidden="true">
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t" style={{ borderColor: SURFACE.border }}>
          {children}
        </div>
      )}
    </div>
  );
}
