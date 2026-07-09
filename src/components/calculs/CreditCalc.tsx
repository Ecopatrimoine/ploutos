// ─── Calculette Crédit (Lot 3) — panneau de l'overlay Calculs rapides ────────
// Consomme creditSummary (lib/accueil/quickCalc) -> calcMonthlyPayment (moteur).

import React, { useState } from "react";
import { Landmark, X } from "lucide-react";
import { parseNum, formatEur, creditSummary } from "../../lib/accueil/quickCalc";

export function CreditCalc({ onClose }: { onClose: () => void }) {
  const [capital, setCapital] = useState("");
  const [taux, setTaux] = useState("");
  const [duree, setDuree] = useState("");

  const r = creditSummary(parseNum(capital), parseNum(taux), parseNum(duree));
  const kpi = (v: number, suffix = "") => (r.valid ? `${formatEur(v)}${suffix}` : "—");

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Landmark /></span>
          Calculette crédit
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-cap">Capital emprunté</label>
          <input id="qc-cap" className="ploutos-field" inputMode="numeric" placeholder="ex. 250 000" value={capital} onChange={(e) => setCapital(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-taux">Taux annuel (%)</label>
          <input id="qc-taux" className="ploutos-field" inputMode="decimal" placeholder="ex. 3,4" value={taux} onChange={(e) => setTaux(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-duree">Durée (années)</label>
          <input id="qc-duree" className="ploutos-field" inputMode="numeric" placeholder="ex. 20" value={duree} onChange={(e) => setDuree(e.target.value)} />
        </div>
      </div>

      <div className="qc-results">
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">Mensualité</div>
          <div className="qc-kpi-val">{kpi(r.mensualite, " / mois")}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Coût total du crédit</div>
          <div className="qc-kpi-val">{kpi(r.coutTotal)}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Total remboursé</div>
          <div className="qc-kpi-val">{kpi(r.totalRembourse)}</div>
        </div>
      </div>

      <div className="qc-note">
        Hors assurance emprunteur et frais annexes. Calcul indicatif — pour une étude complète, ouvrez un dossier client.
      </div>
    </div>
  );
}
