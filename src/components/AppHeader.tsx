// ─── AppHeader v4 — "Agence haut de gamme" itéré ──────────────────
//
// Direction validée Option B, itération 4 (retours user) :
//   - Liseré ÉPAIS sur TOUT le pourtour du bandeau (gradient des 4 couleurs
//     cabinet en cadre complet, pas juste en haut/bas).
//   - Boutons agrandis (44px, icônes 20px) pour bonne visibilité.
//   - Logo généreux (110px) avec halo or radial.
//   - Couleur centrale = SURFACE.cardSoft (charte logiciel).
//   - Couleurs cabinet réparties : cadre complet + halo logo + séparateurs
//     + icône édit + hover + HelpMenu + statut.
//
// Pas de bouton Pack PDF (redondant avec TabMission).
// Pas d'admin (retiré du produit).

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Download, Upload, ArrowLeft, LogOut, Pencil, Check } from "lucide-react";
import { HelpMenu } from "./HelpMenu";
import { SURFACE } from "../constants";

type CabinetColors = {
  navy: string;
  gold: string;
  sky: string;
  cream: string;
  blue?: string;
};

export type AppHeaderProps = {
  cabinet: { cabinetName?: string };
  cabColors: CabinetColors;          // couleurs résolues (cabinet ou defaults Encre & Or)
  logoSrc: string;
  defaultLogoSrc: string;
  clientName: string;
  setClientName: (v: string) => void;
  autoSaveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
  onSave: () => void;
  onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBackToDossiers: () => void;
  onSignOut: () => void;
};

export function AppHeader(p: AppHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(p.clientName);
  const [tick, setTick] = useState(0);   // ré-render toutes les 30 s pour rafraîchir "il y a X"

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setDraftName(p.clientName); }, [p.clientName]);

  const commitName = () => {
    const next = draftName.trim();
    if (next && next !== p.clientName) p.setClientName(next);
    else setDraftName(p.clientName);
    setEditingName(false);
  };

  const statutSauvegarde = composeStatutSauvegarde(p.autoSaveStatus, p.lastSavedAt, tick);
  const statutCouleur =
    p.autoSaveStatus === "saved" ? "#2F7D5B"
    : p.autoSaveStatus === "error" ? "#B45309"  // ambre : etat transitoire, nouvelle tentative
    : p.cabColors.sky;

  // Couleur de fallback pour blue (certains cabinets n'ont pas colorBlue)
  const cabBlue = p.cabColors.blue || p.cabColors.sky;

  // Liseré épais sur tout le pourtour : gradient à 4 couleurs cabinet.
  // Réalisé via un wrapper avec le gradient en background + padding =
  // épaisseur du liseré, puis un inner avec le fond clair.
  const LISERE_EPAISSEUR = 8; // px — itéré : 6 → 12 → 8 selon retours user

  // Icône-bouton générique (style cohérent + tooltip) — agrandi à 44px
  const BORDER_REPOS = `${p.cabColors.navy}40`;   // navy 25 % opacité — visible au repos
  const IconBtn = ({ onClick, label, children }: {
    onClick?: () => void; label: string; children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 44, height: 44, borderRadius: 12,
        border: `2px solid ${BORDER_REPOS}`,
        background: "transparent",
        color: p.cabColors.navy, cursor: "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease, transform 0.1s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${p.cabColors.gold}26`;
        e.currentTarget.style.borderColor = p.cabColors.gold;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = BORDER_REPOS;
      }}
    >
      {children}
    </button>
  );

  // Séparateur vertical or
  const Sep = () => (
    <div style={{ width: 1, height: 28, background: `${p.cabColors.gold}66`, margin: "0 8px" }} />
  );

  return (
    <div style={{
      // Wrapper : c'est CE fond qui devient le liseré tout autour
      background: `linear-gradient(135deg, ${p.cabColors.navy} 0%, ${p.cabColors.sky} 33%, ${cabBlue} 66%, ${p.cabColors.gold} 100%)`,
      padding: LISERE_EPAISSEUR,
      borderRadius: 22,
      boxShadow: "0 2px 6px rgba(15,23,42,0.06), 0 10px 32px rgba(15,23,42,0.08)",
    }}>
      <div style={{
        background: SURFACE.cardSoft,
        borderRadius: 22 - LISERE_EPAISSEUR,
        padding: "22px 26px",
        display: "flex", alignItems: "center", gap: 28,
      }}>
        {/* ─── Logo + identité dossier ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, flex: 1, minWidth: 0 }}>
          {/* Logo dans un halo or radial */}
          <div style={{
            position: "relative",
            width: 130, height: 110,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(ellipse at center, ${p.cabColors.gold}1F 0%, ${p.cabColors.gold}00 65%)`,
              pointerEvents: "none",
            }} />
            <img
              src={p.logoSrc || p.defaultLogoSrc}
              alt="Logo cabinet"
              style={{ position: "relative", height: 110, width: "auto", maxWidth: 130, objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).src = p.defaultLogoSrc; }}
            />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            {editingName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Input
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setDraftName(p.clientName); setEditingName(false); } }}
                  autoFocus
                  className="h-11"
                  style={{ background: "#fff", color: p.cabColors.navy, fontFamily: "'Lato', system-ui, sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em" }}
                />
                <button onClick={commitName} aria-label="Valider"
                  style={{ background: p.cabColors.navy, color: "#fff", border: "none", borderRadius: 10, width: 40, height: 40, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Check className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                title="Renommer le dossier"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 12,
                  background: "transparent", border: "none", padding: 0,
                  cursor: "pointer", textAlign: "left", maxWidth: "100%",
                }}
              >
                <span style={{
                  fontFamily: "'Lato', system-ui, sans-serif",
                  fontSize: 28, fontWeight: 700,
                  color: p.cabColors.navy,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.15,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.clientName || "Dossier sans nom"}
                </span>
                <Pencil className="h-5 w-5" style={{ color: `${p.cabColors.gold}CC`, flexShrink: 0 }} />
              </button>
            )}
            <div style={{
              fontSize: 13, color: p.cabColors.sky,
              marginTop: 6, fontFamily: "'Lato', system-ui, sans-serif",
              fontWeight: 500, letterSpacing: "0.01em",
            }}>
              Dossier patrimonial{statutSauvegarde && (
                <>
                  {" · "}
                  <span style={{ color: statutCouleur, fontWeight: 600 }}>{statutSauvegarde}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── Actions à droite ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <IconBtn onClick={p.onBackToDossiers} label="Retour à la liste des dossiers">
            <ArrowLeft className="h-5 w-5" />
          </IconBtn>

          <Sep />

          <IconBtn onClick={p.onSave} label="Sauvegarder le dossier">
            {p.autoSaveStatus === "saving" ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : p.autoSaveStatus === "saved" ? (
              <Check className="h-5 w-5" style={{ color: "#2F7D5B" }} />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </IconBtn>

          <label title="Charger un dossier" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 12,
            border: `2px solid ${BORDER_REPOS}`,
            cursor: "pointer",
            color: p.cabColors.navy,
            transition: "background 0.15s ease, border-color 0.15s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = `${p.cabColors.gold}26`; e.currentTarget.style.borderColor = p.cabColors.gold; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = BORDER_REPOS; }}>
            <Upload className="h-5 w-5" />
            <input type="file" accept="application/json" className="hidden" onChange={p.onLoad} />
          </label>

          <Sep />

          {/* HelpMenu light : cercle or 44px (synchro avec autres boutons) */}
          <HelpMenu
            colorNavy={p.cabColors.navy}
            colorGold={p.cabColors.gold}
            colorSky={p.cabColors.sky}
            cabinetName={p.cabinet.cabinetName || "Conseiller"}
            appVersion="web"
            theme="light"
          />

          <Sep />

          <IconBtn onClick={p.onSignOut} label="Déconnexion">
            <LogOut className="h-5 w-5" />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Helper : "il y a 2 min" / "il y a 1 h" / "à l'instant" / ── ──
function composeStatutSauvegarde(
  status: "idle" | "saving" | "saved" | "error",
  lastSavedAt: Date | null,
  _tick: number,  // forçage ré-render via dépendance externe
): string {
  if (status === "saving") return "Sauvegarde en cours…";
  if (status === "saved")  return "Sauvegardé à l'instant";
  if (status === "error")  return "Non synchronisé — nouvelle tentative…";
  if (!lastSavedAt) return "";
  const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
  if (diffSec < 60)       return "Sauvegardé à l'instant";
  if (diffSec < 3600)     return `Sauvegardé il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)    return `Sauvegardé il y a ${Math.floor(diffSec / 3600)} h`;
  return `Sauvegardé le ${lastSavedAt.toLocaleDateString("fr-FR")}`;
}
