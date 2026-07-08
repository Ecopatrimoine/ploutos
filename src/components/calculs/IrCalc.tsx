// ─── Calculette Impôt sur le revenu (barème) — Lot 4 ────────────────────────
// Consomme irSummary (lib/accueil/quickCalc) -> computeBaremeNet + computeIRConcubin
// + getChildrenFiscalParts (moteur). TMI = tmiAffichee (même chemin que la carte IR).

import React, { useState } from "react";
import { Coins } from "lucide-react";
import { parseNum, formatEur, formatPct, irSummary } from "../../lib/accueil/quickCalc";
import { BRAND } from "../../constants";

// Jauge « position dans le barème IR » — même patron (et mêmes couleurs de tranche)
// que la carte IR du dossier (TabIR). Pilotée par la TMI issue du moteur (r.tmi) ;
// aucune donnée de barème recalculée ici.
const IR_TRANCHES: { rate: number; color: string }[] = [
  { rate: 0, color: BRAND.success },
  { rate: 0.11, color: "#22c55e" },
  { rate: 0.3, color: BRAND.gold },
  { rate: 0.41, color: "#f97316" },
  { rate: 0.45, color: BRAND.danger },
];

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

      {r.valid && (
        <div style={{ marginTop: 16, border: `1px solid var(--qc-border)`, borderRadius: 14, padding: 12, background: "var(--qc-card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--qc-muted)" }}>Position dans le barème IR</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "var(--qc-navy)" }}>TMI {Math.round(r.tmi * 100)} %</span>
          </div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
            {IR_TRANCHES.map((t, i) => (
              <div key={i} style={{ flex: 1, background: t.color, position: "relative", opacity: r.tmi >= t.rate ? 1 : 0.2 }}>
                {r.tmi === t.rate && <div style={{ position: "absolute", top: -2, right: 0, width: 3, height: 12, background: BRAND.navy, borderRadius: 2 }} />}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginTop: 3 }}>
            {IR_TRANCHES.map((t, i) => (
              <span key={i} style={{ fontWeight: r.tmi === t.rate ? 900 : 400, color: r.tmi === t.rate ? BRAND.navy : BRAND.muted }}>
                {Math.round(t.rate * 100)} %
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="qc-note">
        Barème seul, hors réductions et crédits d'impôt — étude complète dans un dossier. Enfants à charge en garde exclusive.
      </div>
    </div>
  );
}
