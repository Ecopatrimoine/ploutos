// LOT 10c — Acte 2, vue « Tableau € » : payeur × jalon, cellules en €/mois.
// Lignes = payeurs, colonnes = jalons, ligne TOTAL avec % du revenu de référence.
// MÊMES données que le graphe (buildTableauEuro réconcilie Σ cellules = total).
import React from "react";
import type { ProjectionResult } from "../../lib/prevoyance/types";
import { buildTableauEuro } from "../../lib/presentation/prevoyancePerso";
import { BRAND, SURFACE } from "../../constants";

const fmtEuro = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;

export const TableauEuroPayeurs = React.memo(function TableauEuroPayeurs({ projection }: { projection: ProjectionResult }) {
  const t = buildTableauEuro(projection);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: SURFACE.cardSoft, borderBottom: `2px solid ${SURFACE.border}` }}>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.navy }}>Payeur</th>
            {t.cols.map((c) => (
              <th key={c.jour} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.navy }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.famille} style={{ borderBottom: `1px solid ${SURFACE.border}` }}>
              <td className="px-3 py-2" style={{ color: BRAND.navy, fontWeight: 600 }}>
                <span className="inline-block h-2.5 w-2.5 rounded-sm mr-2 align-middle" style={{ background: r.color }} aria-hidden="true" />
                {r.label}
              </td>
              {r.cells.map((v, i) => (
                <td key={i} className="px-3 py-2 text-right" style={{ color: v > 0 ? BRAND.navy : BRAND.muted }}>{v > 0 ? fmtEuro(v) : "—"}</td>
              ))}
            </tr>
          ))}
          <tr style={{ background: BRAND.cream, borderTop: `2px solid ${SURFACE.borderStrong}` }}>
            <td className="px-3 py-2 text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.navy }}>Total · % réf.</td>
            {t.totals.map((tot, i) => {
              const couleurPct = t.pcts[i] < 50 ? "#B0413E" : t.pcts[i] < 70 ? "#A06A1A" : "#2F7D5B";
              return (
                <td key={i} className="px-3 py-2 text-right" style={{ color: BRAND.navy }}>
                  <div className="font-bold">{fmtEuro(tot)}</div>
                  <div className="text-xs font-bold" style={{ color: couleurPct }}>{t.pcts[i]} %</div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
});

TableauEuroPayeurs.displayName = "TableauEuroPayeurs";
