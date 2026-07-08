// ─── AccueilCalculs — overlay "Calculs rapides" (Lot 3) ──────────────────────
//
// Rendu par-dessus l'accueil (activeClient === null). Structure reprise de
// maquette-accueil-v2-it2.html (.calc-modal / .tile / .calc-panel / .kpi).
// Les calculettes CONSOMMENT les fonctions pures du moteur (via lib/accueil/
// quickCalc.ts) ; aucune logique fiscale ici.
//
// Focus : envoyé sur le bouton Fermer à l'ouverture, rendu à l'élément
// précédemment focalisé (le bouton header) à la fermeture. Fermeture par X,
// clic extérieur et Échap.

import React, { useEffect, useRef } from "react";
import { Landmark, Coins, Building2, Gauge, Users, Shield } from "lucide-react";
import { BRAND, SURFACE, FIELD } from "../constants";
import { CreditCalc } from "./calculs/CreditCalc";
import { PvImmoCalc } from "./calculs/PvImmoCalc";
import { IrCalc } from "./calculs/IrCalc";
import { EndettementCalc } from "./calculs/EndettementCalc";
import { DmtgCalc } from "./calculs/DmtgCalc";
import { PrevoyanceCalc } from "./calculs/PrevoyanceCalc";

export type QuickCalcId = "credit" | "pvImmo" | "ir" | "endettement" | "dmtg" | "prevoyance";

type Tile = {
  id: QuickCalcId | null; // null => à venir (Lot 4)
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Ordre de la maquette. Les 4 tuiles à venir (id null) sont grisées.
const TILES: Tile[] = [
  { id: "credit", name: "Crédit", desc: "Mensualité et coût total d'un emprunt à partir du capital, du taux et de la durée.", icon: Landmark },
  { id: "ir", name: "Impôt sur le revenu", desc: "Barème, TMI et taux moyen à partir du revenu imposable et de la situation.", icon: Coins },
  { id: "pvImmo", name: "Plus-value immobilière", desc: "PV nette, abattements de durée, IR et prélèvements sociaux sur une cession.", icon: Building2 },
  { id: "endettement", name: "Capacité d'endettement", desc: "Taux d'effort et mensualité maximale à partir des revenus et charges.", icon: Gauge },
  { id: "dmtg", name: "Donation & succession", desc: "Abattements par lien de parenté et droits (DMTG) sur un montant transmis.", icon: Users },
  { id: "prevoyance", name: "Prévoyance obligatoire", desc: "IJ, invalidité et capital décès du régime obligatoire selon la caisse et le revenu.", icon: Shield },
];

type Props = {
  onClose: () => void;
  activeCalc: QuickCalcId | null;
  setActiveCalc: (id: QuickCalcId | null) => void;
};

export function AccueilCalculs({ onClose, activeCalc, setActiveCalc }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);

  // Focus dans le panneau à l'ouverture, rendu au déclencheur à la fermeture.
  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => { (restoreRef.current as HTMLElement | null)?.focus?.(); };
  }, []);

  // Fermeture par Échap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qcVars = {
    ["--qc-bg" as any]: SURFACE.app,
    ["--qc-card" as any]: SURFACE.card,
    ["--qc-cardsoft" as any]: SURFACE.cardSoft,
    ["--qc-border" as any]: SURFACE.border,
    ["--qc-navy" as any]: BRAND.navy,
    ["--qc-gold" as any]: BRAND.gold,
    ["--qc-gold-deep" as any]: FIELD.borderFocus,
    ["--qc-muted" as any]: BRAND.muted,
    ["--qc-shadow" as any]: SURFACE.cardShadow,
    ["--qc-shadow-hover" as any]: SURFACE.cardShadowHover,
  } as React.CSSProperties;

  return (
    <div
      className="qc-overlay"
      style={qcVars}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="qc-modal" role="dialog" aria-modal="true" aria-label="Calculs rapides">
        <div className="qc-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 17, fontWeight: 900, color: "var(--qc-navy)", minWidth: 0 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--qc-gold)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} style={{ width: 16, height: 16, stroke: "var(--qc-navy)" }}>
                <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="11" x2="8.01" y2="11" /><line x1="12" y1="11" x2="12.01" y2="11" />
                <line x1="16" y1="11" x2="16.01" y2="11" /><line x1="8" y1="15" x2="8.01" y2="15" />
                <line x1="12" y1="15" x2="12.01" y2="15" /><line x1="16" y1="15" x2="16" y2="18" />
              </svg>
            </span>
            Calculs rapides <span style={{ color: "var(--qc-muted)", fontWeight: 700, fontSize: 15 }}>— sans ouvrir de dossier</span>
          </div>
          <button ref={closeRef} className="qc-close" onClick={onClose} title="Fermer" aria-label="Fermer">✕</button>
        </div>

        <div className="qc-grid">
          {TILES.map((t, i) => {
            const soon = t.id === null;
            const active = t.id !== null && activeCalc === t.id;
            const Icon = t.icon;
            return (
              <button
                key={i}
                className={`qc-tile${active ? " on" : ""}`}
                disabled={soon}
                onClick={() => { if (t.id) setActiveCalc(active ? null : t.id); }}
              >
                <div className="qc-tile-head">
                  <span className="qc-tile-ico"><Icon /></span>
                  <span className="qc-tile-name">{t.name}</span>
                </div>
                <div className="qc-tile-desc">{t.desc}</div>
                {soon ? <div className="qc-tile-soon">Bientôt disponible</div> : <div className="qc-tile-go">Ouvrir →</div>}
              </button>
            );
          })}

          {/* Panneaux calculettes */}
          {activeCalc === "credit" && <CreditCalc onClose={() => setActiveCalc(null)} />}
          {activeCalc === "pvImmo" && <PvImmoCalc onClose={() => setActiveCalc(null)} />}
          {activeCalc === "ir" && <IrCalc onClose={() => setActiveCalc(null)} />}
          {activeCalc === "endettement" && <EndettementCalc onClose={() => setActiveCalc(null)} />}
          {activeCalc === "dmtg" && <DmtgCalc onClose={() => setActiveCalc(null)} />}
          {activeCalc === "prevoyance" && <PrevoyanceCalc onClose={() => setActiveCalc(null)} />}
        </div>
      </div>
    </div>
  );
}
