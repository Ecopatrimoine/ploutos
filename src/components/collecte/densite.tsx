// LOT 10e — briques de DENSITÉ de la Collecte (grammaire validée sur maquette 1366px).
// ZÉRO moteur : pur affichage / mise en page. Réutilisées par les 6 sous-onglets
// (Phase 1 Revenus, puis Phase 2). On ne change aucun champ, aucun modèle : on
// ré-organise la saisie pour qu'un sous-onglet tienne ≈ un écran 1366×768.

import React from "react";
import { ArrowRight } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import { HelpTooltip } from "../shared";

type Accent = "navy" | "gold" | "green" | "red";
const ACCENT: Record<Accent, string> = {
  navy: BRAND.navy,
  gold: BRAND.gold,
  green: BRAND.success,
  red: BRAND.danger,
};

// KPI compact : bordure-haut accentuée, libellé + valeur sur UNE ligne (baseline).
// Valeur ~24px (« un cran plus grosse que la maquette », retour David).
export function KpiCollecte({ label, value, note, accent = "navy" }: {
  label: string;
  value: string;
  note?: string;
  accent?: Accent;
}) {
  return (
    <div
      className="rounded-xl px-4 py-2.5 flex items-baseline gap-2.5 flex-wrap"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderTop: `3px solid ${ACCENT[accent]}`, boxShadow: SURFACE.cardShadow }}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-wider shrink-0" style={{ color: BRAND.muted }}>{label}</span>
      <span className="font-black" style={{ color: BRAND.navy, fontSize: 24, lineHeight: 1.1 }}>{value}</span>
      {note && <span className="text-[10.5px] shrink" style={{ color: BRAND.muted }}>{note}</span>}
    </div>
  );
}

export function KpiBandeCollecte({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1.3fr" }}>{children}</div>;
}

// Étiquette de champ compacte (11px, gras, muted) avec « ? » d'aide riche optionnel.
// Miroir de Field mais dense (marge réduite) pour les grilles grid3/grid4.
export function LabelCollecte({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-0.5 mb-1 text-[11px] font-bold leading-tight" style={{ color: BRAND.muted }}>
      <span>{label}</span>
      {tooltip && <HelpTooltip text={tooltip} label={label} />}
    </div>
  );
}

// Valeur CALCULÉE (non saisissable) : fond vert pâle, bordure pointillée — distincte
// visuellement des inputs. « X € · calculé ».
export function ValeurCalculee({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center rounded-lg px-2.5 text-[12.5px] font-semibold"
      style={{ height: 34, background: "rgba(47,107,58,0.08)", border: `1px dashed #9DBB9A`, color: BRAND.success }}
    >
      {children}
    </div>
  );
}

// Bouton discret « Continuer → [sous-onglet suivant] », aligné à droite en bas de page.
export function ContinuerCollecte({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#A67F32]"
        style={{ background: BRAND.navy, color: "#fff", border: "none", cursor: "pointer" }}
      >
        Continuer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </button>
    </div>
  );
}
