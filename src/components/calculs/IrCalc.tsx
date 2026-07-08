// ─── Calculette Impôt sur le revenu (barème) — Lot 4 ────────────────────────
// Consomme irSummary (lib/accueil/quickCalc) -> computeBaremeNet + computeIRConcubin
// + getChildrenFiscalParts (moteur). TMI = tmiAffichee (même chemin que la carte IR).

import React, { useState } from "react";
import { Coins } from "lucide-react";
import { parseNum, formatEur, formatPct, irSummary } from "../../lib/accueil/quickCalc";

export function IrCalc({ onClose }: { onClose: () => void }) {
  const [revenu, setRevenu] = useState("35 000");
  const [couple, setCouple] = useState(false);
  const [enfants, setEnfants] = useState("0");

  const r = irSummary(parseNum(revenu), couple, parseNum(enfants));

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Coins /></span>
          Calculette impôt sur le revenu
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette">✕</button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-ir-rev">Revenu net imposable (annuel)</label>
          <input id="qc-ir-rev" className="ploutos-field" inputMode="numeric" value={revenu} onChange={(e) => setRevenu(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-ir-sit">Situation</label>
          <select id="qc-ir-sit" className="ploutos-field" value={couple ? "couple" : "single"} onChange={(e) => setCouple(e.target.value === "couple")}>
            <option value="single">Célibataire</option>
            <option value="couple">Couple (marié / pacsé)</option>
          </select>
        </div>
        <div className="qc-field">
          <label htmlFor="qc-ir-enf">Enfants à charge</label>
          <input id="qc-ir-enf" className="ploutos-field" inputMode="numeric" value={enfants} onChange={(e) => setEnfants(e.target.value)} />
        </div>
      </div>

      <div className="qc-results">
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">Impôt barème</div>
          <div className="qc-kpi-val">{r.valid ? formatEur(r.impot) : "—"}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Tranche marginale (TMI)</div>
          <div className="qc-kpi-val">{r.valid ? formatPct(r.tmi) : "—"}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Taux moyen</div>
          <div className="qc-kpi-val">{r.valid ? formatPct(r.tauxMoyen) : "—"}</div>
        </div>
      </div>

      {r.valid && r.plafonnementActif && (
        <div className="qc-abatt">
          Quotient familial plafonné — à la marge, imposition comme un foyer de {couple ? "2 parts" : "1 part"}.
        </div>
      )}

      <div className="qc-note">
        Barème seul, hors réductions et crédits d'impôt — étude complète dans un dossier. Enfants à charge en garde exclusive.
      </div>
    </div>
  );
}
