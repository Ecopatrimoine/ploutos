// ─── Calculette Donation & succession (DMTG) — Lot 4 ────────────────────────
// Consomme dmtgSummary -> getDonationTaxProfile + computeTaxFromBrackets (moteur).
// Liens de parenté = DONATION_RELATIONS (constants), tous gérés par le profil.

import React, { useState } from "react";
import { Users, X } from "lucide-react";
import { parseNum, formatEur, dmtgSummary } from "../../lib/accueil/quickCalc";
import { DONATION_RELATIONS, BRAND } from "../../constants";

export function DmtgCalc({ onClose }: { onClose: () => void }) {
  const [montant, setMontant] = useState("");
  const [relation, setRelation] = useState("enfant");

  const r = dmtgSummary(parseNum(montant), relation);
  const kpi = (v: number) => (r.valid ? formatEur(v) : "—");

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Users /></span>
          Calculette donation &amp; succession
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-dmtg-mnt">Montant transmis</label>
          <input id="qc-dmtg-mnt" className="ploutos-field" inputMode="numeric" placeholder="ex. 100 000" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </div>
        <div className="qc-field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="qc-dmtg-rel">Lien de parenté</label>
          <select id="qc-dmtg-rel" className="ploutos-field" value={relation} onChange={(e) => setRelation(e.target.value)}>
            {DONATION_RELATIONS.map((rel) => (
              <option key={rel.value} value={rel.value}>{rel.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="qc-results">
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Abattement appliqué</div>
          <div className="qc-kpi-val">{kpi(r.abattementApplique)}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Base taxable</div>
          <div className="qc-kpi-val">{kpi(r.baseTaxable)}</div>
        </div>
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">Droits (DMTG)</div>
          <div className="qc-kpi-val">{kpi(r.droits)}</div>
        </div>
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">Net transmis</div>
          <div className="qc-kpi-val">{kpi(r.netTransmis)}</div>
        </div>
      </div>

      {r.valid && (() => {
        // Répartition du montant transmis (somme = montant) : abattement (non taxé)
        // + net après droits + droits. Patron div-bar de la restitution succession.
        const total = r.abattementApplique + r.baseTaxable;
        const netApresDroits = Math.max(0, r.baseTaxable - r.droits);
        const pct = (v: number) => (total > 0 ? `${(v / total) * 100}%` : "0%");
        const segs = [
          { label: "Abattement", value: r.abattementApplique, color: BRAND.inactive },
          { label: "Net après droits", value: netApresDroits, color: BRAND.success },
          { label: "Droits (DMTG)", value: r.droits, color: BRAND.danger },
        ];
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--qc-muted)", marginBottom: 8 }}>
              Répartition du montant transmis
            </div>
            <div style={{ display: "flex", height: 20, borderRadius: 6, overflow: "hidden", background: "var(--qc-cardsoft)" }}>
              {segs.map((s, i) => (s.value > 0 ? <div key={i} style={{ width: pct(s.value), background: s.color }} title={`${s.label} : ${formatEur(s.value)}`} /> : null))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontSize: 12, color: "var(--qc-muted)" }}>
              {segs.map((s, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
                  {s.label} — {formatEur(s.value)}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="qc-note">
        Abattement plein — hors donations antérieures de moins de 15 ans et cas particuliers.
      </div>
    </div>
  );
}
