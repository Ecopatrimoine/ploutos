// LOT 10e — briques de DENSITÉ de la Collecte (grammaire validée sur maquette 1366px).
// ZÉRO moteur : pur affichage / mise en page. Réutilisées par les 6 sous-onglets
// (Phase 1 Revenus, puis Phase 2). On ne change aucun champ, aucun modèle : on
// ré-organise la saisie pour qu'un sous-onglet tienne ≈ un écran 1366×768.

import React from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BRAND, SURFACE } from "../../constants";
import { HelpTooltip } from "../shared";

// ── Valeurs UNIFIEES de la grammaire collecte (U1) — source unique. Interdiction
// de regler des hauteurs/gaps/tailles en local dans les 6 sous-onglets : on passe
// par les briques ci-dessous. ──
export const INPUT_COLLECTE_H = 32;                 // hauteur unique des champs de saisie
export const INPUT_COLLECTE_CLS = "rounded-lg text-sm w-full";
export const INPUT_COLLECTE_STYLE = { height: INPUT_COLLECTE_H, fontWeight: 700 } as const;

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
      style={{ height: INPUT_COLLECTE_H, background: "rgba(47,107,58,0.08)", border: `1px dashed #9DBB9A`, color: BRAND.success }}
    >
      {children}
    </div>
  );
}

// Barrette catégorielle INTÉRIEURE (Lot 10e, retour David I1) : remplace le liseré
// borderLeft (angles droits) par une barrette verticale ARRONDIE, collée au bord
// gauche intérieur de la carte, hauteur = carte moins padding. La carte parente doit
// être position:relative. Le libellé + la pastille de catégorie restent affichés à part.
export function LisereCategorie({ color, top = 12 }: { color: string; top?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: 8, top, bottom: 12, width: 4, borderRadius: 9999, background: color, pointerEvents: "none" }}
    />
  );
}

// Rangee de champs UNIFIEE (U1) : grille 2/3/4 colonnes, gap unique, alignement bas,
// auto-flow dense (jamais de demi-ligne vide). Remplace les grilles reglees en local.
export function FieldRow({ cols = 4, className = "", children }: { cols?: 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const c = cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4";
  return <div className={`grid ${c} gap-x-2 gap-y-2 items-end grid-flow-row-dense ${className}`}>{children}</div>;
}

// Cellule de saisie UNIFIEE : LabelCollecte (11px) + contenu (input/select fourni).
// Le contenu doit utiliser INPUT_COLLECTE_CLS/STYLE (hauteur 32, rounded-lg).
export function ChampCollecte({ label, tooltip, children, className = "" }: { label: string; tooltip?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <LabelCollecte label={label} tooltip={tooltip} />
      {children}
    </div>
  );
}

// Champ montant/texte UNIFIE (remplace <MoneyField compact> / <Field><Input>) dans la
// collecte : label 11px + input 32px rounded-lg. onChange recoit l'evenement (meme
// signature que MoneyField). Aucun formatage (parse via n() cote moteur).
export function MoneyCollecte({ label, tooltip, value, onChange, placeholder, inputMode = "decimal", type }: {
  label: string;
  tooltip?: string;
  value: string | number | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
  type?: string;
}) {
  return (
    <ChampCollecte label={label} tooltip={tooltip}>
      <Input value={value ?? ""} onChange={onChange} placeholder={placeholder} type={type} inputMode={inputMode as any} className={INPUT_COLLECTE_CLS} style={INPUT_COLLECTE_STYLE} />
    </ChampCollecte>
  );
}

// En-tete de section/carte UNIFIE : xs semibold uppercase tracking-widest. Couleur sky
// par defaut (categorie/liseré passent leur couleur).
export function EnteteSection({ children, color, className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  return <div className={`text-xs font-semibold uppercase tracking-widest ${className}`} style={{ color: color ?? BRAND.sky }}>{children}</div>;
}

// Rangee d'actions compacte UNIFIEE (boutons/chips), gap unique.
export function LigneActions({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

// Invite compacte "Renseignez la personne 2 -> Donnees familiales" (U3) : remplace une
// carte P2 vide quand la situation est un couple mais que P2 n'a pas d'identite.
export function InvitePersonne2({ onGo, titre = "Personne 2" }: { onGo: () => void; titre?: string }) {
  return (
    <button
      type="button"
      onClick={onGo}
      className="flex flex-col items-start justify-center gap-1 rounded-xl border border-dashed p-3 text-left transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#516AC7]"
      style={{ borderColor: SURFACE.border, background: "rgba(81,106,199,0.03)", minHeight: 72 }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>{titre}</span>
      <span className="text-xs font-medium inline-flex items-center gap-1" style={{ color: BRAND.sky }}>
        Renseignez la personne 2 <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> Données familiales
      </span>
    </button>
  );
}

// Note discrete "donnees dormantes" (U3) : carte P2 affichee alors que la situation
// n'est plus un couple.
export function NoteDormante({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] italic mt-1" style={{ color: BRAND.muted }}>{children}</div>;
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
