// ─── TableauJalons — récap des points clés du ProjectionResult ─────────

import React from "react";
import type { ProjectionResult } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  projection: ProjectionResult;
};

const POINTS_CLES = [0, 3, 7, 30, 90, 180, 365, 1095];

function totalAtIdx(s: ProjectionResult["series"], i: number): number {
  return (
    s.salaire[i] +
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i] +
    s.renteInvalEnfants[i]
  );
}

function libelleJour(jour: number): string {
  if (jour === 0) return "J0 (début arrêt)";
  if (jour < 30) return `J${jour}`;
  if (jour < 365) return `${Math.round(jour / 30)} mois`;
  if (jour === 1095) return "3 ans (invalidité)";
  return `${(jour / 365).toFixed(1)} ans`;
}

function detailJour(jour: number, s: ProjectionResult["series"], i: number): string {
  const parts: string[] = [];
  if (s.salaire[i] > 0) parts.push("salaire (activité)");
  if (s.maintienEmployeur[i] > 0) parts.push("maintien employeur");
  if (s.ijObligatoire[i] > 0) parts.push("IJ régime obl.");
  if (s.ijComplementaireCollective[i] > 0) parts.push("IJ coll.");
  if (s.ijComplementaireIndividuelle[i] > 0) parts.push("IJ ind.");
  if (s.pensionInvalObligatoire[i] > 0) parts.push("pension inval. obl.");
  if (s.renteInvalCollective[i] > 0) parts.push("rente inval. coll.");
  if (s.renteInvalIndividuelle[i] > 0) parts.push("rente inval. ind.");
  if (s.renteInvalEnfants[i] > 0) parts.push("rente enfants");
  if (parts.length === 0) return jour < 7 ? "carence — aucun revenu" : "aucun revenu de remplacement";
  return parts.join(" + ");
}

export const TableauJalons = React.memo(function TableauJalons({ projection }: Props) {
  const ref = projection.revenuReferenceMensuel;
  const lignes = POINTS_CLES.map((j) => {
    const idx = projection.axe.findIndex((p) => p.jour === j);
    if (idx < 0) return null;
    const total = totalAtIdx(projection.series, idx);
    const pct = ref > 0 ? Math.round((total / ref) * 100) : 0;
    return {
      jour: j,
      libelle: libelleJour(j),
      revenu: total,
      pct,
      detail: detailJour(j, projection.series, idx),
    };
  }).filter(Boolean) as Array<{ jour: number; libelle: string; revenu: number; pct: number; detail: string }>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: SURFACE.cardSoft, borderBottom: `2px solid ${SURFACE.border}` }}>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.navy }}>Jalon</th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.navy }}>Revenu mensuel</th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.navy }}>% référence</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.navy }}>Composition</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            // Coloration discrète : rouge si < 50 %, ambre si 50-70 %, sinon neutre.
            const couleurPct = l.pct < 50 ? "#B0413E" : l.pct < 70 ? "#A06A1A" : "#2F7D5B";
            return (
              <tr key={l.jour} style={{ borderBottom: `1px solid ${SURFACE.border}` }}>
                <td className="px-3 py-2" style={{ color: BRAND.navy, fontWeight: 600 }}>{l.libelle}</td>
                <td className="px-3 py-2 text-right">{Math.round(l.revenu).toLocaleString("fr-FR")} €</td>
                <td className="px-3 py-2 text-right" style={{ color: couleurPct, fontWeight: 700 }}>{l.pct} %</td>
                <td className="px-3 py-2 text-xs" style={{ color: BRAND.muted }}>{l.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

TableauJalons.displayName = "TableauJalons";
