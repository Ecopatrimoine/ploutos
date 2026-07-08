// ─── Calculette Prévoyance obligatoire — Lot 4 / régimes étendus Lot 5b R3 ────
// Consomme prevoyanceSummary : régimes génériques CPAM / SSI / MSA / FONCTION_
// PUBLIQUE (fonctions pures exportées + EntreePerso minimal) + briques dédiées
// CARMF / CIPAV / CARPIMKO. Les 7 caisses forfaitaires à IJ non exportée restent
// reportées.

import React, { useState } from "react";
import { Shield } from "lucide-react";
import { parseNum, formatEur, prevoyanceSummary, prevoyanceProjection, PREVOYANCE_CAISSES, type PrevoyanceCaisse } from "../../lib/accueil/quickCalc";
import { BRAND } from "../../constants";
import { ProjectionChart } from "../prevoyance/ProjectionChart";

export function PrevoyanceCalc({ onClose }: { onClose: () => void }) {
  const [caisse, setCaisse] = useState<PrevoyanceCaisse>("CPAM");
  const [revenu, setRevenu] = useState("40 000");
  const [age, setAge] = useState("45");

  const r = prevoyanceSummary(caisse, parseNum(revenu), parseNum(age));
  const proj = prevoyanceProjection(caisse, parseNum(revenu), parseNum(age));

  return (
    <div className="qc-panel">
      <div className="qc-panel-head">
        <div className="qc-panel-title">
          <span className="qc-tile-ico"><Shield /></span>
          Calculette prévoyance obligatoire
        </div>
        <button className="qc-close" onClick={onClose} title="Fermer la calculette" aria-label="Fermer la calculette">✕</button>
      </div>

      <div className="qc-body">
        <div className="qc-field">
          <label htmlFor="qc-prev-caisse">Caisse</label>
          <select id="qc-prev-caisse" className="ploutos-field" value={caisse} onChange={(e) => setCaisse(e.target.value as PrevoyanceCaisse)}>
            {PREVOYANCE_CAISSES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="qc-field">
          <label htmlFor="qc-prev-rev">Revenu annuel</label>
          <input id="qc-prev-rev" className="ploutos-field" inputMode="numeric" value={revenu} onChange={(e) => setRevenu(e.target.value)} />
        </div>
        <div className="qc-field">
          <label htmlFor="qc-prev-age">Âge</label>
          <input id="qc-prev-age" className="ploutos-field" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
      </div>

      {/* Comparaison visuelle des 3 prestations (accents distincts, style MetricCard) —
          pas de barre commune : les unités diffèrent (€/jour, €/an, € unique). */}
      <div className="qc-results">
        <div className="qc-kpi" style={{ borderTopColor: BRAND.navy }}>
          <div className="qc-kpi-lab">Indemnité journalière</div>
          <div className="qc-kpi-val">{r.valid ? `${formatEur(r.ijJour)} / jour` : "—"}</div>
        </div>
        <div className="qc-kpi" style={{ borderTopColor: BRAND.sky }}>
          <div className="qc-kpi-lab">Invalidité totale</div>
          <div className="qc-kpi-val">{r.valid ? `${formatEur(r.invaliditeAn)} / an` : "—"}</div>
        </div>
        <div className="qc-kpi" style={{ borderTopColor: BRAND.gold }}>
          <div className="qc-kpi-lab">Capital décès</div>
          <div className="qc-kpi-val">{r.valid ? formatEur(r.capitalDeces) : "—"}</div>
        </div>
      </div>

      {proj && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--qc-muted)", marginBottom: 8 }}>
            Indemnisation obligatoire dans le temps
          </div>
          <ProjectionChart projection={proj} codeCaisse={caisse} />
        </div>
      )}

      <div className="qc-abatt">
        Profil retenu : invalidité totale (catégorie 2), IJ à 30 jours d'arrêt, célibataire sans enfant.
      </div>
      <div className="qc-note">
        Régime obligatoire seul, hors convention collective et contrats facultatifs — étude complète dans un dossier.
      </div>
    </div>
  );
}
