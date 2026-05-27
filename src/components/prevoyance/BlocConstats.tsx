// ─── BlocConstats — affichage des constats triés par sévérité ──────────
//
// Le `detail` peut contenir des balises HTML <em>…</em> (phrase
// explicative italique injectée par le moteur de règles pour les
// constats liés à conjointACharge — cf. spec Lot 6 ajustement 2).
// On rend en `dangerouslySetInnerHTML` car la source est notre propre
// code (regles.ts), pas une saisie utilisateur.

import React from "react";
import type { Constat, ConstatSeverite } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  constats: Constat[];
};

const COULEURS: Record<ConstatSeverite, { bg: string; border: string; texte: string; icone: string; label: string }> = {
  non_conformite: { bg: "rgba(220, 38, 38, 0.08)", border: "#DC2626", texte: "#7A1F1F", icone: "⚠", label: "NON-CONFORMITÉ" },
  alerte:         { bg: "rgba(239, 68, 68, 0.07)", border: "#EF4444", texte: "#9B2C2C", icone: "🔴", label: "ALERTE" },
  attention:      { bg: "rgba(245, 158, 11, 0.07)", border: "#F59E0B", texte: "#7C4A04", icone: "🟠", label: "ATTENTION" },
  info:           { bg: "rgba(59, 130, 246, 0.07)", border: "#3B82F6", texte: "#1E3A8A", icone: "ℹ", label: "INFO" },
};

const LIBELLE_AXE: Record<string, string> = {
  deces: "Décès",
  incapacite: "Incapacité",
  invalidite: "Invalidité",
  retraite: "Retraite",
  sante: "Santé",
  dependance: "Dépendance",
  conformite: "Conformité",
};

export const BlocConstats = React.memo(function BlocConstats({ constats }: Props) {
  if (constats.length === 0) {
    return (
      <div
        className="rounded-xl p-4 text-sm"
        style={{
          background: SURFACE.cardSoft,
          border: `1px solid ${SURFACE.border}`,
          color: BRAND.muted,
        }}
      >
        Aucun constat à signaler à ce stade — la couverture en place semble
        cohérente avec la situation déclarée.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {constats.map((c) => {
        const couleur = COULEURS[c.severite];
        return (
          <div
            key={c.id}
            className="rounded-xl p-4"
            style={{
              background: couleur.bg,
              border: `1.5px solid ${couleur.border}`,
            }}
          >
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: couleur.texte, letterSpacing: "0.08em" }}
              >
                {couleur.icone} {couleur.label}
              </span>
              <span className="text-xs" style={{ color: BRAND.muted }}>
                · {LIBELLE_AXE[c.axe] ?? c.axe}
              </span>
            </div>
            <div className="font-bold text-sm mb-2" style={{ color: BRAND.navy }}>
              {c.titre}
            </div>
            <div
              className="text-sm leading-relaxed mb-2"
              style={{ color: BRAND.navy }}
              dangerouslySetInnerHTML={{ __html: c.detail }}
            />
            <div className="text-sm" style={{ color: BRAND.sky, fontWeight: 600 }}>
              → {c.action}
            </div>
            {c.impactChiffre && (
              <div
                className="mt-2 inline-block rounded-lg px-2 py-1 text-xs font-bold"
                style={{ background: "rgba(255,255,255,0.6)", color: couleur.texte }}
              >
                {c.impactChiffre.libelle} : {Math.round(c.impactChiffre.montant).toLocaleString("fr-FR")} €
              </div>
            )}
            {c.reference && (
              <div className="text-xs mt-2" style={{ color: BRAND.muted, fontStyle: "italic" }}>
                Référence : {c.reference}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

BlocConstats.displayName = "BlocConstats";
