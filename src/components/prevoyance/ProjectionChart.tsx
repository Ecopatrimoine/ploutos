// ─── ProjectionChart — graphique aires empilées (Lot 7 + LOT UI-GRAPH) ──
//
// Affiche un ProjectionResult sous forme d'AreaChart Recharts :
//   - séries empilées (maintien, IJ obl/coll/ind, pension inval
//     obl/coll/ind) + salaire d'activité (mi-temps thérapeutique /
//     guérison ; sinon nul, masqué)
//   - ligne référence revenu (pointillés gris)
//   - ligne verticale pointillée gold « bascule invalidité » à J1095
//   - vue par défaut J0→J1095 (3 ans) avec bouton de dépliage jusqu'à la
//     retraite (ne change QUE la fenêtre affichée, pas les données)
//   - tooltip filtré : seuls les étages présents (> 0) + référence + total
//   - palette charte Ploutos (navy / gold / navy clair / bleu-gris / gris)
//
// Lot purement présentation : aucune dépendance au moteur au-delà du
// ProjectionResult reçu.

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
import { HelpTooltip } from "../shared";

type Props = {
  projection: ProjectionResult;
  codeCaisse?: string | null;       // ex. "CARMF"
  publicCaisse?: string | null;     // ex. "Médecins libéraux"
};

// Aide au survol propre au maintien statutaire fonction publique (LOT D.2).
// Le texte n'apparait QUE pour la caisse FONCTION_PUBLIQUE : les autres caisses
// gardent l'entete sans infobulle.
const TOOLTIP_IJ_FONCTION_PUBLIQUE =
  "Fonctionnaire titulaire : maintien statutaire 90 % du revenu pendant 3 mois puis 50 % pendant 9 mois (modèle conservateur territorial/hospitalier). Assiette : revenus déclarés.";

// Palette charte (SPEC_PREVOYANCE_UI_GRAPHIQUE §5). Navy et gold restent
// surchargeables par le thème cabinet ; les teintes intermédiaires sont
// fixes (validées sur maquette). Les couvertures collective/individuelle
// partagent le bleu-gris et sont distinguées par l'opacité.
const COL = {
  salaire: "var(--cab-gold, #E3AF64)",
  maintien: "#5B7FB0",
  obligatoire: "var(--cab-navy, #101B3B)",
  complementaire: "#A9B8D4",
  individuelle: "#B5806B",   // Madelin : terracotta sourd, hors famille bleue (color-blind safe)
  reference: "#888780",
};

function formatLabelX(jour: number, phase: "am" | "invalidite"): string {
  if (phase === "am") {
    if (jour === 0) return "J0";
    if (jour < 30) return `J${jour}`;
    // J91 = relais CARMF : libellé explicite (sinon collision avec J90 → "3 mois").
    if (jour === 91) return "J91";
    if (jour < 365) return `${Math.round(jour / 30)} mois`;
    return `${(jour / 365).toFixed(1)} an${jour >= 365 ? "s" : ""}`;
  }
  return `${Math.round(jour / 365)} ans`;
}

function formatEuro(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} €`;
}

// Qualification SOCIALE qualitative par étage (LOT TOOLTIP-SOCIAL). Explique
// pourquoi le net réellement perçu reste proche du net d'activité : les
// prestations (IJ, rentes) ne supportent que la CSG/CRDS, pas les cotisations
// salariales, alors que le salaire maintenu reste cotisé comme un salaire.
// QUALITATIF, sans aucun taux chiffré. Sources : URSSAF (revenus de
// remplacement), Previssima (régime social de la prévoyance). La clé est l'alias
// dataKey du graphe ; `salaire` n'y figure pas (revenu d'activité, pas une
// prestation) → aucune mention. Toute clé absente → pas de sous-ligne.
const QUALIF_SOCIALE: Record<string, string> = {
  maintien: "Soumis aux cotisations comme un salaire",
  ijObl: "Soumise à CSG/CRDS",
  ijColl: "Soumise à CSG/CRDS",
  ijInd: "Soumise à CSG/CRDS",
  pensionInvalObl: "Soumise à CSG/CRDS",
  renteInvalColl: "Soumise à CSG/CRDS",
  renteInvalInd: "Soumise à CSG/CRDS",
  renteInvalEnfants: "Soumise à CSG/CRDS",
};

// Tooltip filtré (SPEC §4) : n'affiche que les étages > 0 au point survolé,
// puis toujours le revenu de référence et le total avec son pourcentage.
export function TooltipContenu({
  active,
  payload,
  label,
  refMensuel,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  refMensuel: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const pct = refMensuel > 0 ? Math.round((total / refMensuel) * 100) : 0;
  const visibles = payload.filter((p) => (Number(p.value) || 0) > 0);
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BRAND.muted}`,
        borderRadius: 12,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, color: BRAND.navy, marginBottom: 4 }}>{`Échéance : ${label}`}</div>
      {visibles.map((p) => (
        <div key={p.dataKey}>
          <div style={{ color: BRAND.navy, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: p.color, marginRight: 5 }} />
              {p.name}
            </span>
            <span>{formatEuro(Number(p.value))}</span>
          </div>
          {QUALIF_SOCIALE[p.dataKey ?? ""] && (
            <div style={{ fontSize: 10, color: BRAND.muted, fontStyle: "italic", marginTop: 1, marginLeft: 14 }}>
              {QUALIF_SOCIALE[p.dataKey ?? ""]}
            </div>
          )}
        </div>
      ))}
      <div style={{ color: BRAND.muted, display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
        <span>Revenu de référence</span>
        <span>{formatEuro(refMensuel)}</span>
      </div>
      <div style={{ fontWeight: 700, color: BRAND.navy, display: "flex", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${BRAND.muted}`, marginTop: 4, paddingTop: 4 }}>
        <span>Total</span>
        <span>{`${formatEuro(total)} (${pct} %)`}</span>
      </div>
    </div>
  );
}

export const ProjectionChart = React.memo(function ProjectionChart({ projection, codeCaisse, publicCaisse }: Props) {
  const [vueComplete, setVueComplete] = React.useState(false);

  const hasSalaire = projection.series.salaire.some((v) => v > 0);
  const bascule = projection.basculeInvaliditeJour;
  const hasInvalidite = projection.finProjectionJour > bascule;

  const dataComplete = projection.axe.map((point, idx) => ({
    jour: point.jour,
    labelX: formatLabelX(point.jour, point.phase),
    salaire: Math.round(projection.series.salaire[idx]),
    maintien: Math.round(projection.series.maintienEmployeur[idx]),
    ijObl: Math.round(projection.series.ijObligatoire[idx]),
    ijColl: Math.round(projection.series.ijComplementaireCollective[idx]),
    ijInd: Math.round(projection.series.ijComplementaireIndividuelle[idx]),
    pensionInvalObl: Math.round(projection.series.pensionInvalObligatoire[idx]),
    renteInvalColl: Math.round(projection.series.renteInvalCollective[idx]),
    renteInvalInd: Math.round(projection.series.renteInvalIndividuelle[idx]),
    renteInvalEnfants: Math.round(projection.series.renteInvalEnfants[idx]),
  }));

  const hasRenteEnfants = projection.series.renteInvalEnfants.some((v) => v > 0);

  // Fenêtrage (SPEC §2) : la vue 3 ans ne montre que J0→J1095 (bascule
  // incluse). Le dépliage révèle la phase invalidité jusqu'à la retraite.
  // On filtre les points affichés — les données calculées sont intactes.
  const data = vueComplete ? dataComplete : dataComplete.filter((d) => d.jour <= bascule);

  const labelBascule = dataComplete.find((d) => d.jour === bascule)?.labelX;

  // Repères de changement de PAYEUR (relais CPAM → caisse, ou trou de couverture).
  // Idiome identique à la bascule invalidité : on retrouve le labelX du jour de rupture.
  // Les 3 types concernés sont les seules ruptures qui changent le payeur de l'IJ
  // obligatoire (CPAM des 90 premiers jours → caisse/trou ensuite).
  const TYPES_RELAIS_PAYEUR = ["relais_carmf", "trou_cipav", "relais_carpimko"] as const;
  const reperesRelais = projection.rupturesCles
    .filter((r) => (TYPES_RELAIS_PAYEUR as readonly string[]).includes(r.type))
    .map((r) => ({
      labelX: dataComplete.find((d) => d.jour === r.jour)?.labelX,
      // Étiquette courte pour le repère vertical (le libellé complet reste dans la donnée).
      texte:
        r.type === "relais_carmf" ? "relais CARMF" :
        r.type === "trou_cipav" ? "trou CIPAV" :
        "relais CARPIMKO",
    }))
    .filter((x) => x.labelX != null);

  const libelleCaisse =
    codeCaisse
      ? (publicCaisse ? `${codeCaisse} · ${publicCaisse}` : codeCaisse)
      : "Régime non précisé";

  return (
    <div style={{ width: "100%" }}>
      <div className="text-xs mb-2" style={{ color: BRAND.muted }}>
        Régime obligatoire : <strong style={{ color: BRAND.navy }}>{libelleCaisse}</strong>
        {codeCaisse === "FONCTION_PUBLIQUE" && <HelpTooltip text={TOOLTIP_IJ_FONCTION_PUBLIQUE} />}
      </div>
      {hasInvalidite && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
            {vueComplete ? "Projection complète jusqu'à la retraite" : "Arrêt 0 → 3 ans + bascule invalidité"}
          </div>
          <button
            type="button"
            onClick={() => setVueComplete((v) => !v)}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#A67F32]"
            style={{ background: BRAND.navy, color: "#fff", border: "none", cursor: "pointer" }}
          >
            {vueComplete ? "Revenir à la vue 3 ans" : "Voir l'invalidité jusqu'à la retraite"}
          </button>
        </div>
      )}

      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="labelX" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`)}
            />
            <Tooltip content={<TooltipContenu refMensuel={projection.revenuReferenceMensuel} />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

            <ReferenceLine
              y={projection.revenuReferenceMensuel}
              stroke={COL.reference}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Revenu de réf. (${formatEuro(projection.revenuReferenceMensuel)})`,
                fontSize: 11,
                position: "insideTopRight",
                fill: BRAND.muted,
              }}
            />

            {reperesRelais.map((rep, i) => (
              <ReferenceLine
                key={`relais-${i}`}
                x={rep.labelX!}
                stroke="var(--cab-gold, #E3AF64)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: rep.texte,
                  fontSize: 11,
                  angle: -90,
                  position: "insideTopLeft",
                  fill: BRAND.goldText,
                }}
              />
            ))}

            {labelBascule && (
              <ReferenceLine
                x={labelBascule}
                stroke="var(--cab-gold, #E3AF64)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: "bascule invalidité",
                  fontSize: 11,
                  angle: -90,
                  position: "insideTopLeft",
                  fill: BRAND.goldText,
                }}
              />
            )}

            {hasSalaire && (
              <Area type="stepAfter" dataKey="salaire"       stackId="1" name="Salaire (activité)"          fill={COL.salaire}       fillOpacity={0.9} stroke="none" />
            )}
            <Area type="stepAfter" dataKey="maintien"        stackId="1" name="Maintien employeur"          fill={COL.maintien}      fillOpacity={0.9} stroke="none" />
            <Area type="stepAfter" dataKey="ijObl"           stackId="1" name="Régime obligatoire (IJ)"    fill={COL.obligatoire}   fillOpacity={0.9} stroke="none" />
            <Area type="stepAfter" dataKey="ijColl"          stackId="1" name="Prévoyance collective (employeur)" fill={COL.complementaire} fillOpacity={0.95} stroke="none" />
            <Area type="stepAfter" dataKey="ijInd"           stackId="1" name="Prévoyance individuelle (Madelin)" fill={COL.individuelle} fillOpacity={0.65} stroke="none" />
            <Area type="stepAfter" dataKey="pensionInvalObl" stackId="1" name="Régime obligatoire (pension invalidité)" fill={COL.obligatoire} fillOpacity={0.7} stroke="none" />
            <Area type="stepAfter" dataKey="renteInvalColl"  stackId="1" name="Prévoyance collective (rente invalidité)" fill={COL.complementaire} fillOpacity={0.95} stroke="none" />
            <Area type="stepAfter" dataKey="renteInvalInd"   stackId="1" name="Prévoyance individuelle (Madelin, rente)" fill={COL.individuelle} fillOpacity={0.65} stroke="none" />
            {hasRenteEnfants && (
              <Area type="stepAfter" dataKey="renteInvalEnfants" stackId="1" name="Régime obligatoire (rente enfants)" fill={COL.obligatoire} fillOpacity={0.45} stroke="none" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

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
