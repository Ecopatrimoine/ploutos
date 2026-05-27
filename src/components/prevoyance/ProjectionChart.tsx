// ─── ProjectionChart — graphique aires empilées (Lot 7) ──────────────
//
// Affiche un ProjectionResult sous forme d'AreaChart Recharts :
//   - 7 séries empilées (maintien, IJ obl/coll/ind, pension inval
//     obl/coll/ind)
//   - ligne référence revenu (pointillés)
//   - ligne verticale "bascule invalidité" à J1095
//   - palette cabinet via CSS vars --cab-*

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { ProjectionResult } from "../../lib/prevoyance/types";
import { BRAND } from "../../constants";

type Props = {
  projection: ProjectionResult;
};

function formatLabelX(jour: number, phase: "am" | "invalidite"): string {
  if (phase === "am") {
    if (jour === 0) return "J0";
    if (jour < 30) return `J${jour}`;
    if (jour < 365) return `${Math.round(jour / 30)} mois`;
    return `${(jour / 365).toFixed(1)} an${jour >= 365 ? "s" : ""}`;
  }
  return `${Math.round(jour / 365)} ans`;
}

function formatEuro(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} €`;
}

export const ProjectionChart = React.memo(function ProjectionChart({ projection }: Props) {
  const data = projection.axe.map((point, idx) => ({
    jour: point.jour,
    labelX: formatLabelX(point.jour, point.phase),
    maintien: Math.round(projection.series.maintienEmployeur[idx]),
    ijObl: Math.round(projection.series.ijObligatoire[idx]),
    ijColl: Math.round(projection.series.ijComplementaireCollective[idx]),
    ijInd: Math.round(projection.series.ijComplementaireIndividuelle[idx]),
    pensionInvalObl: Math.round(projection.series.pensionInvalObligatoire[idx]),
    renteInvalColl: Math.round(projection.series.renteInvalCollective[idx]),
    renteInvalInd: Math.round(projection.series.renteInvalIndividuelle[idx]),
  }));

  const labelBascule = formatLabelX(projection.basculeInvaliditeJour, "am");

  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="labelX" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`)}
          />
          <Tooltip
            formatter={(value: number) => formatEuro(value)}
            labelFormatter={(label: string) => `Échéance : ${label}`}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

          <ReferenceLine
            y={projection.revenuReferenceMensuel}
            stroke="var(--cab-navy, #101B3B)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Revenu de réf. (${formatEuro(projection.revenuReferenceMensuel)})`,
              fontSize: 10,
              position: "insideTopRight",
              fill: "var(--cab-navy, #101B3B)",
            }}
          />

          <ReferenceLine
            x={labelBascule}
            stroke="var(--cab-gold, #E3AF64)"
            strokeWidth={2}
            label={{
              value: "Bascule invalidité",
              fontSize: 10,
              angle: -90,
              position: "insideTopLeft",
              fill: "var(--cab-gold, #E3AF64)",
            }}
          />

          <Area type="stepAfter" dataKey="maintien"        stackId="1" name="Maintien employeur"           fill="var(--cab-navy, #101B3B)" fillOpacity={0.85} stroke="none" />
          <Area type="stepAfter" dataKey="ijObl"           stackId="1" name="IJ régime obligatoire"        fill="var(--cab-sky, #26428B)"  fillOpacity={0.75} stroke="none" />
          <Area type="stepAfter" dataKey="ijColl"          stackId="1" name="IJ prévoyance collective"     fill="#A98551" fillOpacity={0.8} stroke="none" />
          <Area type="stepAfter" dataKey="ijInd"           stackId="1" name="IJ prévoyance individuelle"   fill="var(--cab-gold, #E3AF64)" fillOpacity={0.9} stroke="none" />
          <Area type="stepAfter" dataKey="pensionInvalObl" stackId="1" name="Pension inval. obligatoire"   fill="var(--cab-sky, #26428B)"  fillOpacity={0.55} stroke="none" />
          <Area type="stepAfter" dataKey="renteInvalColl"  stackId="1" name="Rente inval. collective"      fill="#A98551" fillOpacity={0.6} stroke="none" />
          <Area type="stepAfter" dataKey="renteInvalInd"   stackId="1" name="Rente inval. individuelle"    fill="var(--cab-gold, #E3AF64)" fillOpacity={0.7} stroke="none" />
        </AreaChart>
      </ResponsiveContainer>
      {projection.donneesCaisseIndisponibles && (
        <div className="text-xs mt-1" style={{ color: BRAND.muted, fontStyle: "italic" }}>
          ⚠ Données du régime obligatoire incomplètes : la courbe affiche
          uniquement les couches connues. Les valeurs caisses TO_VERIFY /
          TO_FILL seront ajoutées dans une future mise à jour du référentiel.
        </div>
      )}
    </div>
  );
});

ProjectionChart.displayName = "ProjectionChart";
