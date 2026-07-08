// ─── Calculette Donation & succession (DMTG) — Lot 4 ────────────────────────
// Consomme dmtgSummary -> getDonationTaxProfile + computeTaxFromBrackets (moteur).
// Liens de parenté = DONATION_RELATIONS (constants), tous gérés par le profil.

import React, { useState } from "react";
import { Users } from "lucide-react";
import { parseNum, formatEur, dmtgSummary } from "../../lib/accueil/quickCalc";
import { DONATION_RELATIONS } from "../../constants";

export function DmtgCalc({ onClose }: { onClose: () => void }) {
  const [montant, setMontant] = useState("100 000");
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
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette">✕</button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-dmtg-mnt">Montant transmis</label>
          <input id="qc-dmtg-mnt" className="ploutos-field" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />
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

      <div className="qc-note">
        Abattement plein — hors donations antérieures de moins de 15 ans et cas particuliers.
      </div>
    </div>
  );
}
