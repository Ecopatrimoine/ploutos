// ─── Calculette Plus-value immobilière (Lot 3) — foncier nu, art. 150 U CGI ──
// Consomme pvImmoSummary (lib/accueil/quickCalc) -> computePvImmobiliere (moteur).
// Durée de détention saisie DIRECTEMENT en années (cohérent avec la signature ;
// pas de dates en v1). Aucune règle fiscale recalculée ici.

import React, { useState } from "react";
import { Building2 } from "lucide-react";
import { parseNum, formatEur, formatPct, pvImmoSummary } from "../../lib/accueil/quickCalc";

export function PvImmoCalc({ onClose }: { onClose: () => void }) {
  const [acq, setAcq] = useState("200 000");
  const [cession, setCession] = useState("300 000");
  const [duree, setDuree] = useState("10");

  const r = pvImmoSummary(parseNum(acq), parseNum(cession), parseNum(duree));
  const kpi = (v: number) => (r.valid ? formatEur(v) : "—");

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Building2 /></span>
          Calculette plus-value immobilière
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette">✕</button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-pv-acq">Prix d'acquisition</label>
          <input id="qc-pv-acq" className="ploutos-field" inputMode="numeric" value={acq} onChange={(e) => setAcq(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-pv-cess">Prix de cession</label>
          <input id="qc-pv-cess" className="ploutos-field" inputMode="numeric" value={cession} onChange={(e) => setCession(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-pv-duree">Durée de détention (années)</label>
          <input id="qc-pv-duree" className="ploutos-field" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} />
        </div>
      </div>

      <div className="qc-results">
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">PV imposable IR</div>
          <div className="qc-kpi-val">{kpi(r.baseIr)}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Impôt IR</div>
          <div className="qc-kpi-val">{kpi(r.impotIr)}</div>
        </div>
        <div className="qc-kpi">
          <div className="qc-kpi-lab">Prélèvements sociaux</div>
          <div className="qc-kpi-val">{kpi(r.impotPs)}</div>
        </div>
        <div className="qc-kpi navy">
          <div className="qc-kpi-lab">Coût fiscal total</div>
          <div className="qc-kpi-val">{kpi(r.impotTotal)}</div>
        </div>
      </div>

      {r.valid && (
        r.moinsValue ? (
          <div className="qc-exo">Moins-value — aucune imposition.</div>
        ) : (
          <>
            <div className="qc-abatt">
              Abattement durée : {formatPct(r.abattementIr)} IR · {formatPct(r.abattementPs)} PS
            </div>
            {r.exonereIr && <div className="qc-exo">Exonéré d'IR au-delà de 22 ans de détention.</div>}
            {r.exonerePs && <div className="qc-exo">Exonéré de prélèvements sociaux au-delà de 30 ans de détention.</div>}
          </>
        )
      )}

      <div className="qc-note">
        Foncier nu (art. 150 U CGI). Hors surtaxe sur plus-values élevées. Calcul indicatif — pour une étude complète, ouvrez un dossier client.
      </div>
    </div>
  );
}
