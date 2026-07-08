// ─── Calculette IFI (impôt sur la fortune immobilière) — Lot 5 ──────────────
// Consomme ifiSummary -> computeIFI (moteur) via une propriété construite.
// L'abattement 30 % résidence principale est appliqué par computeIFI.

import React, { useState } from "react";
import { Gem } from "lucide-react";
import { parseNum, formatEur, formatPct, ifiSummary } from "../../lib/accueil/quickCalc";
import { BracketFillChart } from "../shared";

export function IfiCalc({ onClose }: { onClose: () => void }) {
  const [patrimoine, setPatrimoine] = useState("2 000 000");
  const [rp, setRp] = useState("");

  const r = ifiSummary(parseNum(patrimoine), parseNum(rp));

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Gem /></span>
          Calculette IFI
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette">✕</button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-ifi-pat">Patrimoine immobilier net (après dettes)</label>
          <input id="qc-ifi-pat" className="ploutos-field" inputMode="numeric" value={patrimoine} onChange={(e) => setPatrimoine(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-ifi-rp">dont résidence principale (optionnel)</label>
          <input id="qc-ifi-rp" className="ploutos-field" inputMode="numeric" value={rp} onChange={(e) => setRp(e.target.value)} />
        </div>
      </div>

      <div className="qc-results">
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">IFI dû</div>
          <div className="qc-kpi-val">{!r.valid ? "—" : r.assujetti ? formatEur(r.ifi) : "0 €"}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Taux moyen sur le patrimoine</div>
          <div className="qc-kpi-val">{r.valid && r.assujetti ? formatPct(r.tauxMoyen) : "—"}</div>
        </div>
      </div>

      {r.valid && !r.assujetti && (
        <div className="qc-abatt">
          Non assujetti à l'IFI (patrimoine net taxable inférieur à 1 300 000 €).
        </div>
      )}
      {r.valid && r.assujetti && r.decote > 0 && (
        <div className="qc-abatt">
          Décote appliquée : {formatEur(r.decote)} (patrimoine net taxable entre 1,3 et 1,4 M€).
        </div>
      )}

      {r.valid && r.bracketFill.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <BracketFillChart
            title="Position dans le barème IFI"
            data={r.bracketFill}
            referenceValue={r.netTaxable}
            valueLabel="Patrimoine net taxable"
          />
        </div>
      )}

      <div className="qc-note">
        Hors passifs, exonérations et plafonnement — étude complète dans un dossier.
      </div>
    </div>
  );
}
