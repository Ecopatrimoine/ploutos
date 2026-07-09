// ─── BlocConstats — affichage des constats triés par sévérité ──────────
//
// Le `detail` peut contenir des balises <em>…</em> (phrase explicative
// italique injectée par le moteur de règles pour les constats liés à
// conjointACharge — cf. spec Lot 6 ajustement 2). On rend en React
// natif via le helper renderDetail() — pas de dangerouslySetInnerHTML,
// donc aucun risque d'injection même si une source future devenait
// moins fiable.

import React from "react";
import { ShieldAlert, AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import type { Constat, ConstatSeverite } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";

// Convention : <em>…</em> uniquement, pas de nesting, pas d'autres
// balises. Helper qui split la string en alternance texte / <em>
// et rend en React.Fragment + <em>. Robuste aux balises mal fermées
// (rendu en texte brut dans ce cas).
function renderDetail(detail: string): React.ReactNode {
  if (!detail.includes("<em>")) return detail;
  const parts: React.ReactNode[] = [];
  let remaining = detail;
  let key = 0;
  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("<em>");
    if (openIdx === -1) {
      parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }
    if (openIdx > 0) {
      parts.push(<React.Fragment key={key++}>{remaining.slice(0, openIdx)}</React.Fragment>);
    }
    const afterOpen = remaining.slice(openIdx + 4);
    const closeIdx = afterOpen.indexOf("</em>");
    if (closeIdx === -1) {
      // Balise <em> non fermée → on rend le reste en texte brut.
      parts.push(<React.Fragment key={key++}>{afterOpen}</React.Fragment>);
      break;
    }
    parts.push(<em key={key++}>{afterOpen.slice(0, closeIdx)}</em>);
    remaining = afterOpen.slice(closeIdx + 5);
  }
  return parts;
}

type Props = {
  constats: Constat[];
};

// Palette sémantique alignée sur les tokens de charte Ploutos (BRAND.*),
// déjà utilisés partout ailleurs dans le module. non_conformite et alerte
// partagent la teinte danger ; la hiérarchie passe par la bordure (pleine
// vs légère), l'icône et le libellé (jamais la couleur seule).
const COULEURS: Record<ConstatSeverite, { bg: string; border: string; texte: string; icone: React.ComponentType<{ className?: string }>; label: string }> = {
  non_conformite: { bg: BRAND.dangerBg, border: BRAND.danger, texte: BRAND.danger, icone: ShieldAlert, label: "NON-CONFORMITÉ" },
  alerte:         { bg: BRAND.dangerBg, border: BRAND.dangerBorder, texte: BRAND.danger, icone: AlertCircle, label: "ALERTE" },
  attention:      { bg: BRAND.warningBg, border: BRAND.warningBorder, texte: BRAND.warning, icone: AlertTriangle, label: "ATTENTION" },
  info:           { bg: "rgba(38,66,139,0.06)", border: BRAND.sky, texte: BRAND.sky, icone: Info, label: "INFO" },
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
        const Icone = couleur.icone;
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
                className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest"
                style={{ color: couleur.texte, letterSpacing: "0.08em" }}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden="true" /> {couleur.label}
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
            >
              {renderDetail(c.detail)}
            </div>
            <div className="flex items-start gap-1 text-sm" style={{ color: BRAND.sky, fontWeight: 600 }}>
              <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {c.action}
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
