// ─── AppHeader v2 — "Agence haut de gamme" ─────────────────────────
//
// Refonte de l'en-tête de l'application (remplace le header inline d'App.tsx).
// Direction Option B : fond crème palette cabinet + accent navy 4px à gauche
// + nom client en titre serif + sous-ligne statut sauvegarde + 5 icônes
// navy à droite. Aligné sur la palette "Encre & Or" des PDFs.
//
// Plus de bouton Pack PDF dans le header (redondant avec TabMission).
// Plus de bouton Admin (admin retiré du produit).

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Download, Upload, ArrowLeft, LogOut, Pencil, Check } from "lucide-react";
import { HelpMenu } from "./HelpMenu";

type CabinetColors = {
  navy: string;
  gold: string;
  sky: string;
  cream: string;
};

export type AppHeaderProps = {
  cabinet: { cabinetName?: string };
  cabColors: CabinetColors;          // couleurs résolues (cabinet ou defaults Encre & Or)
  logoSrc: string;
  defaultLogoSrc: string;
  clientName: string;
  setClientName: (v: string) => void;
  autoSaveStatus: "idle" | "saving" | "saved";
  lastSavedAt: Date | null;
  onSave: () => void;
  onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBackToDossiers: () => void;
  onSignOut: () => void;
};

export function AppHeader(p: AppHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(p.clientName);
  const [tick, setTick] = useState(0);   // ré-render toutes les 30s pour rafraîchir "il y a X"

  // Tick pour rafraîchir le "il y a X" sans recharger le composant
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Sync draftName si clientName change depuis l'extérieur
  useEffect(() => { setDraftName(p.clientName); }, [p.clientName]);

  const commitName = () => {
    const next = draftName.trim();
    if (next && next !== p.clientName) p.setClientName(next);
    else setDraftName(p.clientName);
    setEditingName(false);
  };

  const statutSauvegarde = composeStatutSauvegarde(p.autoSaveStatus, p.lastSavedAt, tick);

  // Icône-bouton générique (style cohérent + tooltip)
  const IconBtn = ({ onClick, label, children, accent }: {
    onClick?: () => void; label: string; children: React.ReactNode; accent?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, borderRadius: 10, border: "none",
        background: accent ? `${p.cabColors.navy}0F` : "transparent",
        color: p.cabColors.navy, cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = `${p.cabColors.navy}18`)}
      onMouseLeave={e => (e.currentTarget.style.background = accent ? `${p.cabColors.navy}0F` : "transparent")}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      position: "relative",
      background: p.cabColors.cream || "#FBF8F1",
      borderRadius: 18,
      boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 4px 24px rgba(15,23,42,0.05)",
      overflow: "hidden",
    }}>
      {/* Accent navy 4px à gauche (signature visuelle) */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: p.cabColors.navy,
      }} />

      <div style={{ padding: "18px 22px 18px 28px", display: "flex", alignItems: "center", gap: 20 }}>
        {/* ─── Logo + identité dossier ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
          <img
            src={p.logoSrc || p.defaultLogoSrc}
            alt="Logo cabinet"
            style={{ height: 48, width: "auto", objectFit: "contain", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).src = p.defaultLogoSrc; }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            {editingName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Input
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setDraftName(p.clientName); setEditingName(false); } }}
                  autoFocus
                  className="h-9 text-base font-semibold"
                  style={{ background: "#fff", color: p.cabColors.navy, fontFamily: "'Fraunces', Georgia, serif" }}
                />
                <button onClick={commitName} aria-label="Valider"
                  style={{ background: p.cabColors.navy, color: "#fff", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                title="Renommer le dossier"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "transparent", border: "none", padding: 0,
                  cursor: "pointer", textAlign: "left", maxWidth: "100%",
                }}
              >
                <span style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: 22, fontWeight: 600, color: p.cabColors.navy,
                  letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.clientName || "Dossier sans nom"}
                </span>
                <Pencil className="h-3.5 w-3.5" style={{ color: `${p.cabColors.navy}66`, flexShrink: 0 }} />
              </button>
            )}
            {statutSauvegarde && (
              <div style={{
                fontSize: 11, color: `${p.cabColors.navy}99`,
                marginTop: 2, fontFamily: "Lato, system-ui, sans-serif",
              }}>
                Dossier patrimonial · {statutSauvegarde}
              </div>
            )}
          </div>
        </div>

        {/* ─── Actions à droite ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <IconBtn onClick={p.onBackToDossiers} label="Retour à la liste des dossiers">
            <ArrowLeft className="h-4 w-4" />
          </IconBtn>

          <div style={{ width: 1, height: 24, background: `${p.cabColors.navy}1F`, margin: "0 4px" }} />

          <IconBtn onClick={p.onSave} label="Sauvegarder" accent={p.autoSaveStatus === "saved"}>
            {p.autoSaveStatus === "saving" ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : p.autoSaveStatus === "saved" ? (
              <Check className="h-4 w-4" style={{ color: "#2F7D5B" }} />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </IconBtn>

          <label title="Charger un dossier" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, borderRadius: 10, cursor: "pointer",
            color: p.cabColors.navy, transition: "background 0.15s ease",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = `${p.cabColors.navy}18`)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <Upload className="h-4 w-4" />
            <input type="file" accept="application/json" className="hidden" onChange={p.onLoad} />
          </label>

          <HelpMenu
            colorNavy={p.cabColors.navy}
            colorGold={p.cabColors.gold}
            colorSky={p.cabColors.sky}
            cabinetName={p.cabinet.cabinetName || "Conseiller"}
            appVersion="web"
          />

          <div style={{ width: 1, height: 24, background: `${p.cabColors.navy}1F`, margin: "0 4px" }} />

          <IconBtn onClick={p.onSignOut} label="Déconnexion">
            <LogOut className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Helper : "il y a 2 min" / "il y a 1 h" / "à l'instant" / ── ──
function composeStatutSauvegarde(
  status: "idle" | "saving" | "saved",
  lastSavedAt: Date | null,
  _tick: number,  // forçage ré-render via dépendance externe
): string {
  if (status === "saving") return "Sauvegarde en cours…";
  if (status === "saved")  return "Sauvegardé à l'instant";
  if (!lastSavedAt) return "";
  const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
  if (diffSec < 60)       return "Sauvegardé à l'instant";
  if (diffSec < 3600)     return `Sauvegardé il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)    return `Sauvegardé il y a ${Math.floor(diffSec / 3600)} h`;
  return `Sauvegardé le ${lastSavedAt.toLocaleDateString("fr-FR")}`;
}
