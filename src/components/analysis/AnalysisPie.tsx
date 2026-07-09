// LOT 10a — Acte 2b : camembert d'analyse (Recharts). Légende TEXTUELLE (jeton
// couleur + libellé + pourcentage via pct()) — jamais la couleur seule. Réutilisé
// pour le duo « Cadre légal » / « Répartition simulée » (succession civile only).
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { BRAND, CHART_COLORS } from "../../constants";
import { pct } from "../../lib/calculs/utils";
import type { PiePart } from "../../lib/analysis/successionPresentation";

export function AnalysisPie({ title, data, note, valueFormat }: {
  title: string;
  data: PiePart[];
  note?: React.ReactNode;
  valueFormat?: (v: number) => string;   // ex. euro, pour un libellé de montant en légende
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-2xl p-4" style={{ border: `1px solid ${BRAND.muted}22` }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>{title}</div>
      {data.length === 0 || total <= 0 ? (
        <div className="text-xs" style={{ color: BRAND.muted }}>—</div>
      ) : (
        <div className="flex items-center gap-4">
          <div style={{ width: 116, height: 116, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={56} stroke="#fff" strokeWidth={1} isAnimationActive={false}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 min-w-0 space-y-1">
            {data.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 min-w-0" style={{ color: BRAND.navy }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                </span>
                <span className="shrink-0 font-semibold" style={{ color: BRAND.muted }}>
                  {valueFormat ? `${valueFormat(d.value)} · ` : ""}{pct(d.value / total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note != null && <div className="text-[10.5px] mt-2" style={{ color: BRAND.muted, fontStyle: "italic" }}>{note}</div>}
    </div>
  );
}
