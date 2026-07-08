// ─── AccueilHeader — header cabinet unifié de l'écran d'accueil (Lot 2) ──────
//
// Rendu UNIQUEMENT en tête de l'accueil (activeClient === null). Le header
// intra-dossier (AppHeader) n'est pas touché. Structure reprise de
// maquette-accueil-v2-it2.html (bloc .header-frame / .header) : cadre gradient
// 4 couleurs cabinet (mêmes couleurs résolues que AppHeader, pour la cohérence),
// logo (repli initiales sur fond or si absent), nom + sous-titre
// « Conseiller · ORIAS … », puis les actions.
//
// Couleurs cabinet (dynamiques) passées inline / via custom properties --ah-* ;
// aucune couleur codée en dur.

import React, { useState } from "react";
import { Calculator, Settings, CreditCard, LogOut, Download } from "lucide-react";
import { BRAND, SURFACE, FIELD } from "../constants";

export type AccueilHeaderProps = {
  cabColors: { navy: string; sky: string; blue?: string; gold: string; cream: string };
  cabinetName: string;
  conseiller?: string;
  orias?: string;
  logoSrc?: string;
  onOpenCalc?: () => void;   // absent => bouton "Calculs rapides" désactivé
  onOpenParametres: () => void;
  onAbonnement?: () => void; // absent => bouton Abonnement masqué
  abonnementBadge?: string;  // ex. "Essai · 12 j" pendant l'essai
  onSignOut?: () => void;
  isInstallable?: boolean;
  onInstall?: () => void;
};

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((w) => w[0]).join("");
  return (letters || "?").toUpperCase();
}

export function AccueilHeader({
  cabColors,
  cabinetName,
  conseiller,
  orias,
  logoSrc,
  onOpenCalc,
  onOpenParametres,
  onAbonnement,
  abonnementBadge,
  onSignOut,
  isInstallable = false,
  onInstall,
}: AccueilHeaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const blue = cabColors.blue || cabColors.sky;
  const showLogo = !!logoSrc && !logoFailed;

  // Sous-titre « Conseiller · ORIAS … » — chaque morceau absent est masqué,
  // jamais de séparateur orphelin.
  const subtitleParts: string[] = [];
  if (conseiller && conseiller.trim()) subtitleParts.push(conseiller.trim());
  if (orias && orias.trim()) subtitleParts.push(`ORIAS ${orias.trim()}`);
  const subtitle = subtitleParts.join(" · ");

  const ahVars = {
    ["--ah-navy" as any]: cabColors.navy,
    ["--ah-gold" as any]: cabColors.gold,
    ["--ah-cream" as any]: cabColors.cream,
    ["--ah-cardsoft" as any]: SURFACE.cardSoft,
    ["--ah-card" as any]: SURFACE.card,
    ["--ah-border" as any]: SURFACE.border,
    ["--ah-muted" as any]: BRAND.muted,
    ["--ah-gold-deep" as any]: FIELD.borderFocus,
    ["--ah-danger" as any]: BRAND.danger,
    ["--ah-shadow" as any]: SURFACE.cardShadow,
  } as React.CSSProperties;

  return (
    <div
      className="ah-frame"
      style={{
        ...ahVars,
        background: `linear-gradient(120deg, ${cabColors.navy} 0%, ${cabColors.sky} 38%, ${blue} 62%, ${cabColors.gold} 100%)`,
      }}
    >
      <div className="ah-bar">
        <div className="ah-id">
          {showLogo ? (
            <img
              className="ah-logo-img"
              src={logoSrc}
              alt={cabinetName || "Logo cabinet"}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div
              className="ah-logo-fallback"
              style={{ background: `radial-gradient(circle at 35% 30%, ${cabColors.cream}, ${cabColors.gold} 70%)` }}
            >
              <span>{initialsOf(cabinetName)}</span>
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="ah-name">{cabinetName || "Cabinet"}</div>
            {subtitle && <div className="ah-sub">{subtitle}</div>}
          </div>
        </div>

        <div className="ah-actions">
          {isInstallable && onInstall && (
            <button className="ah-btn" onClick={onInstall} title="Installer l'application">
              <Download /> Installer
            </button>
          )}
          <button
            className="ah-btn ah-calc"
            onClick={onOpenCalc}
            disabled={!onOpenCalc}
            title={onOpenCalc ? "Calculs rapides — sans ouvrir de dossier" : "Disponible prochainement"}
          >
            <Calculator /> Calculs rapides
          </button>
          <div className="ah-sep" />
          <button className="ah-btn" onClick={onOpenParametres} title="Paramètres du cabinet">
            <Settings /> Paramètres cabinet
          </button>
          {onAbonnement && (
            <button className="ah-btn" onClick={onAbonnement} title="Gérer l'abonnement">
              <CreditCard /> Abonnement
              {abonnementBadge && <span className="ah-badge">{abonnementBadge}</span>}
            </button>
          )}
          {onSignOut && (
            <>
              <div className="ah-sep" />
              <button className="ah-btn ah-quit" onClick={onSignOut} title="Se déconnecter">
                <LogOut /> Déconnexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
