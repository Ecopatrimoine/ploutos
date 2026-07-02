import React from "react";
import { BRAND, SURFACE } from "../constants";

// Modale d'ajout d'actif générique et 100% data-driven (placements OU biens).
// Même squelette que LoanModal (overlay sombre + carte blanche + en-tête titre/
// croix). Sections empilées, une par groupe (point de couleur + libellé), chacune
// avec une grille de tuiles (fond clair groupe + texte foncé groupe). Clic tuile
// -> onPick(value) (le parent ajoute + ferme). Fermeture par croix, Échap, clic
// overlay. Retour de focus au bouton d'ouverture géré par le parent (via onClose).
// AUCUNE logique par nature en dur : tout vient des `groups` passés en prop.
export interface AssetPickerGroup {
  label: string;
  color: { solid: string; fill: string };
  items: { value: string; label: string }[];
}

interface Props {
  open: boolean;
  title: string;
  groups: AssetPickerGroup[];
  onClose: () => void;
  onPick: (value: string) => void;
}

export function AssetPickerModal({ open, title, groups, onClose, onPick }: Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus(); // focus le panneau a l'ouverture
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none"
        style={{ borderRadius: 14, background: "#fff", borderColor: SURFACE.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tete */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: SURFACE.border }}>
          <div className="font-bold text-base" style={{ color: BRAND.navy }}>{title}</div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#26428B]"
          >
            ✕
          </button>
        </div>

        {/* Sections par groupe */}
        <div className="p-5 space-y-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: group.color.solid }} aria-hidden="true" />
                <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>{group.label}</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    title={`Ajouter : ${item.label}`}
                    onClick={() => onPick(item.value)}
                    className="text-left rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#26428B]"
                    style={{ background: group.color.fill, borderColor: group.color.solid, color: group.color.solid }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
