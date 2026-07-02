import React from "react";
import { BRAND, SURFACE, PLACEMENT_FAMILIES, FAMILY_COLORS, PLACEMENT_TYPES_BY_FAMILY, labelPlacement } from "../constants";

// Modale d'ajout de placement (pivot UI). Meme squelette que LoanModal (overlay
// sombre + carte blanche + en-tete avec titre et croix). 4 sections empilees,
// une par famille (point de couleur + libelle), chacune avec une grille de tuiles
// produits (fond clair famille + texte fonce famille, couples AA du chantier
// precedent). Clic tuile -> onPick(type) (le parent ajoute + ferme). Fermeture
// par croix, Echap, clic overlay. Le retour de focus au bouton d'ouverture est
// gere par le parent (via onClose).
interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (type: string) => void;
}

export function PlacementPickerModal({ open, onClose, onPick }: Props) {
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
        aria-label="Ajouter un placement"
        className="border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none"
        style={{ borderRadius: 14, background: "#fff", borderColor: SURFACE.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tete */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: SURFACE.border }}>
          <div className="font-bold text-base" style={{ color: BRAND.navy }}>Ajouter un placement</div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#26428B]"
          >
            ✕
          </button>
        </div>

        {/* Sections par famille */}
        <div className="p-5 space-y-5">
          {PLACEMENT_FAMILIES.map((fam) => {
            const c = FAMILY_COLORS[fam.value];
            return (
              <section key={fam.value} aria-label={fam.label}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.solid }} aria-hidden="true" />
                  <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>{fam.label}</span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {(PLACEMENT_TYPES_BY_FAMILY[fam.value] || []).map((type) => (
                    <button
                      key={type}
                      type="button"
                      title={`Ajouter : ${labelPlacement(type)}`}
                      onClick={() => onPick(type)}
                      className="text-left rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#26428B]"
                      style={{ background: c.fill, borderColor: c.solid, color: c.solid }}
                    >
                      {labelPlacement(type)}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
