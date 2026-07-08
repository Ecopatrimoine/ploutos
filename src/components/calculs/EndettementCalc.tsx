// ─── Calculette Capacité d'endettement — Lot 4 ──────────────────────────────
// Arithmétique pure (endettementSummary) : taux d'effort = charges / revenus.

import React, { useState } from "react";
import { Gauge, X } from "lucide-react";
import { parseNum, formatEur, formatPct, endettementSummary, HCSF_TAUX_EFFORT_MAX } from "../../lib/accueil/quickCalc";

export function EndettementCalc({ onClose }: { onClose: () => void }) {
  const [revenus, setRevenus] = useState("4 000");
  const [charges, setCharges] = useState("800");
  const [projet, setProjet] = useState("");

  const r = endettementSummary(parseNum(revenus), parseNum(charges), parseNum(projet));
  const depasse = r.valid && ((r.tauxEffortProjet ?? r.tauxEffortActuel) > HCSF_TAUX_EFFORT_MAX);

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Gauge /></span>
          Calculette capacité d'endettement
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-end-rev">Revenus nets mensuels du foyer</label>
          <input id="qc-end-rev" className="ploutos-field" inputMode="numeric" value={revenus} onChange={(e) => setRevenus(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-end-cha">Charges de crédits en cours (mensuel)</label>
          <input id="qc-end-cha" className="ploutos-field" inputMode="numeric" value={charges} onChange={(e) => setCharges(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-end-pro">Mensualité du projet (optionnel)</label>
          <input id="qc-end-pro" className="ploutos-field" inputMode="numeric" value={projet} onChange={(e) => setProjet(e.target.value)} />
        </div>
      </div>

      <div className="qc-results">
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">Taux d'effort actuel</div>
          <div className="qc-kpi-val">{r.valid ? formatPct(r.tauxEffortActuel) : "—"}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Taux d'effort avec projet</div>
          <div className="qc-kpi-val">{r.valid && r.tauxEffortProjet !== null ? formatPct(r.tauxEffortProjet) : "—"}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Mensualité max. (35 %)</div>
          <div className="qc-kpi-val">{r.valid ? formatEur(r.mensualiteMax35) : "—"}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Reste à vivre</div>
          <div className="qc-kpi-val">{r.valid ? formatEur(r.resteAVivre) : "—"}</div>
        </div>
      </div>

      {depasse && <div className="qc-exo">Au-delà de la norme HCSF (35 %).</div>}

      <div className="qc-note">Norme HCSF : 35 % assurance comprise, indicatif.</div>
    </div>
  );
}
