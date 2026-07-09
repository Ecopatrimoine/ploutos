// LOT 10c — source unique du style de sévérité des constats + rendu du détail.
// Extrait de BlocConstats pour être partagé par la vue compacte (acte 2) et la carte
// « Points de vigilance » (acte 1). Pastilles lucide, jamais la couleur seule.
import React from "react";
import { ShieldAlert, AlertCircle, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { ConstatSeverite } from "../../lib/prevoyance/types";
import { BRAND } from "../../constants";

export const COULEURS_SEVERITE: Record<ConstatSeverite, { bg: string; border: string; texte: string; icone: LucideIcon; label: string }> = {
  non_conformite: { bg: BRAND.dangerBg, border: BRAND.danger, texte: BRAND.danger, icone: ShieldAlert, label: "NON-CONFORMITÉ" },
  alerte:         { bg: BRAND.dangerBg, border: BRAND.dangerBorder, texte: BRAND.danger, icone: AlertCircle, label: "ALERTE" },
  attention:      { bg: BRAND.warningBg, border: BRAND.warningBorder, texte: BRAND.warning, icone: AlertTriangle, label: "ATTENTION" },
  info:           { bg: "rgba(38,66,139,0.06)", border: BRAND.sky, texte: BRAND.sky, icone: Info, label: "INFO" },
};

export const LIBELLE_AXE: Record<string, string> = {
  deces: "Décès",
  incapacite: "Incapacité",
  invalidite: "Invalidité",
  retraite: "Retraite",
  sante: "Santé",
  dependance: "Dépendance",
  conformite: "Conformité",
};

// Le `detail` d'un constat peut contenir des <em>…</em> (injectés par le moteur de
// règles). Rendu React natif (pas de dangerouslySetInnerHTML), robuste aux balises
// mal fermées (rendu en texte brut alors).
export function renderDetail(detail: string): React.ReactNode {
  if (!detail.includes("<em>")) return detail;
  const parts: React.ReactNode[] = [];
  let remaining = detail;
  let key = 0;
  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("<em>");
    if (openIdx === -1) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
    if (openIdx > 0) parts.push(<React.Fragment key={key++}>{remaining.slice(0, openIdx)}</React.Fragment>);
    const afterOpen = remaining.slice(openIdx + 4);
    const closeIdx = afterOpen.indexOf("</em>");
    if (closeIdx === -1) { parts.push(<React.Fragment key={key++}>{afterOpen}</React.Fragment>); break; }
    parts.push(<em key={key++}>{afterOpen.slice(0, closeIdx)}</em>);
    remaining = afterOpen.slice(closeIdx + 5);
  }
  return parts;
}
