// ─── BlocPedagogie — couche pédagogique RDV client (LOT UI-PEDAGO) ─────
//
// Couche PUREMENT PRÉSENTATION posée autour du graphique de projection
// pour la lecture en rendez-vous client. Ne lit que le ProjectionResult
// déjà calculé : aucune dépendance au moteur, aucun recalcul métier, aucune
// valeur inventée. 6 éléments :
//   1. BandeauResumeClient   — bande de synthèse au-dessus du graphique
//   2. LegendeEtages         — légende filtrée (étages réellement présents)
//   3. MontantsRuptures      — €/mois aux ruptures clés
//   4. JaugeCouverture       — taux de couverture en phase invalidité
//   5. EncadresExplicatifs   — encarts déroulables (carence, maintien, …)
//   6. EncartTrou            — alerte rouge si période à 0 € de remplacement
//
// Palette et libellés repris à l'identique de ProjectionChart (LOT UI-GRAPH)
// pour la cohérence visuelle ; seuils couleur repris de TableauJalons.

import React from "react";
import type { ProjectionResult } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";

// Palette charte (miroir de ProjectionChart.COL — SPEC_PREVOYANCE_UI_GRAPHIQUE §5).
const COL = {
  salaire: "var(--cab-gold, #E3AF64)",
  maintien: "#5B7FB0",
  obligatoire: "var(--cab-navy, #101B3B)",
  complementaire: "#A9B8D4",
  reference: "#888780",
};

// Seuils de couleur du taux de couverture (miroir de TableauJalons).
const VERT = "#2F7D5B";
const AMBRE = "#A06A1A";
const ROUGE = "#B0413E";

function euro(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} €`;
}
function euroMois(v: number): string {
  return `${euro(v)}/mois`;
}
function couleurTaux(pct: number): string {
  return pct > 70 ? VERT : pct >= 50 ? AMBRE : ROUGE;
}

// Total mensuel d'un point (somme des 9 étages) — lecture directe des séries.
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

function libelleJour(jour: number, basculeJour: number): string {
  if (jour === 0) return "le 1er jour";
  if (jour === basculeJour) return "la reconnaissance d'invalidité";
  if (jour < 30) return `le ${jour}e jour`;
  if (jour < 365) return `${Math.round(jour / 30)} mois`;
  return `${(jour / 365).toFixed(1)} ans`;
}

// ─────────────────────────────────────────────────────────────────────
// ÉLÉMENT 1 — Bandeau résumé client (au-dessus du graphique)
// ─────────────────────────────────────────────────────────────────────

export function BandeauResumeClient({
  profil,
  caisse,
  revenuRefMensuel,
  scenarioLibelle,
  naturesContrats,
}: {
  profil: string;
  caisse: string | null;
  revenuRefMensuel: number;
  scenarioLibelle: string;
  naturesContrats: string[];
}) {
  const items: Array<{ label: string; value: string }> = [
    { label: "Profil", value: caisse ? `${profil} — ${caisse}` : profil },
    { label: "Revenu de référence", value: euroMois(revenuRefMensuel) },
    { label: "Scénario", value: scenarioLibelle },
    {
      label: "Complémentaire",
      value: naturesContrats.length > 0 ? naturesContrats.join(" / ") : "aucune",
    },
  ];
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-wrap gap-x-8 gap-y-2"
      style={{ background: BRAND.navy, color: "#fff", borderLeft: `4px solid ${BRAND.gold}` }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ minWidth: 120 }}>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
            {it.label}
          </div>
          <div className="text-sm font-bold" style={{ textTransform: it.label === "Complémentaire" ? "capitalize" : "none" }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ÉLÉMENT 2 — Légende des étages (seuls ceux réellement présents)
// ─────────────────────────────────────────────────────────────────────

const ETAGES: Array<{ key: keyof ProjectionResult["series"]; label: string; color: string; opacity: number }> = [
  { key: "salaire", label: "Salaire / mi-temps thérapeutique", color: COL.salaire, opacity: 0.9 },
  { key: "maintienEmployeur", label: "Maintien employeur", color: COL.maintien, opacity: 0.9 },
  { key: "ijObligatoire", label: "IJ régime obligatoire", color: COL.obligatoire, opacity: 0.9 },
  { key: "ijComplementaireCollective", label: "Complémentaire collective (IJ)", color: COL.complementaire, opacity: 0.95 },
  { key: "ijComplementaireIndividuelle", label: "Complémentaire individuelle (IJ)", color: COL.complementaire, opacity: 0.65 },
  { key: "pensionInvalObligatoire", label: "Pension d'invalidité", color: COL.obligatoire, opacity: 0.7 },
  { key: "renteInvalCollective", label: "Rente invalidité collective", color: COL.complementaire, opacity: 0.95 },
  { key: "renteInvalIndividuelle", label: "Rente invalidité individuelle", color: COL.complementaire, opacity: 0.65 },
  { key: "renteInvalEnfants", label: "Rente enfants (invalidité)", color: COL.obligatoire, opacity: 0.45 },
];

function Pastille({ color, opacity, dashed }: { color: string; opacity?: number; dashed?: boolean }) {
  if (dashed) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 14,
          height: 0,
          borderTop: `2px dashed ${color}`,
          marginRight: 6,
          verticalAlign: "middle",
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        width: 11,
        height: 11,
        borderRadius: 3,
        background: color,
        opacity: opacity ?? 1,
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
}

function LegendeEtages({ projection }: { projection: ProjectionResult }) {
  const presents = ETAGES.filter((e) => projection.series[e.key].some((v) => v > 0));
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {presents.map((e) => (
        <span key={e.key} className="inline-flex items-center text-xs" style={{ color: BRAND.navy }}>
          <Pastille color={e.color} opacity={e.opacity} />
          {e.label}
        </span>
      ))}
      <span className="inline-flex items-center text-xs" style={{ color: BRAND.navy }}>
        <Pastille color={COL.reference} dashed />
        Revenu de référence (objectif)
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ÉLÉMENT 4 — Jauge de couverture (phase invalidité = point bas durable)
// ─────────────────────────────────────────────────────────────────────

function JaugeCouverture({ projection }: { projection: ProjectionResult }) {
  const ref = projection.revenuReferenceMensuel;
  const basculeIdx = projection.axe.findIndex((p) => p.jour === projection.basculeInvaliditeJour);
  const instantIdx = basculeIdx >= 0 ? basculeIdx : projection.axe.length - 1;
  const total = instantIdx >= 0 ? totalAtIdx(projection.series, instantIdx) : 0;
  const pct = ref > 0 ? Math.round((total / ref) * 100) : 0;
  const couleur = couleurTaux(pct);
  const instantLibelle = basculeIdx >= 0 ? "en phase d'invalidité" : "en fin de projection";

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>
        Taux de couverture {instantLibelle}
      </div>
      <div className="flex items-center gap-3">
        <div style={{ flex: 1, height: 14, borderRadius: 8, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, pct))}%`,
              background: couleur,
              borderRadius: 8,
              transition: "width 0.3s",
            }}
          />
        </div>
        <span className="text-base font-black" style={{ color: couleur, minWidth: 52, textAlign: "right" }}>
          {pct} %
        </span>
      </div>
      <div className="text-xs mt-1" style={{ color: BRAND.muted }}>
        {euroMois(total)} sur un revenu de référence de {euroMois(ref)}.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ÉLÉMENT 3 — Montants €/mois aux ruptures clés
// ─────────────────────────────────────────────────────────────────────

function MontantsRuptures({ projection }: { projection: ProjectionResult }) {
  const ruptures = projection.rupturesCles
    .filter((r) => r.type !== "donnees_indisponibles")
    .map((r) => {
      const idx = projection.axe.findIndex((p) => p.jour === r.jour);
      return { ...r, total: idx >= 0 ? totalAtIdx(projection.series, idx) : 0, idx };
    })
    .filter((r) => r.idx >= 0)
    .sort((a, b) => a.jour - b.jour);

  if (ruptures.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>
        Montants aux points-clés
      </div>
      <div className="flex flex-col gap-1.5">
        {ruptures.map((r, i) => {
          const ref = projection.revenuReferenceMensuel;
          const pct = ref > 0 ? Math.round((r.total / ref) * 100) : 0;
          return (
            <div
              key={`${r.jour}-${r.type}-${i}`}
              className="flex items-center justify-between gap-3 text-sm"
              style={{ borderBottom: `1px solid ${SURFACE.border}`, paddingBottom: 4 }}
            >
              <span style={{ color: BRAND.navy }}>{r.libelle}</span>
              <span className="whitespace-nowrap">
                <strong style={{ color: BRAND.navy }}>{euroMois(r.total)}</strong>
                <span style={{ color: couleurTaux(pct), fontWeight: 700, marginLeft: 8 }}>{pct} %</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ÉLÉMENT 6 — Encart rouge dédié au « trou » de couverture
// ─────────────────────────────────────────────────────────────────────

// Détecte le premier intervalle à revenu ≈ 0 APRÈS le premier revenu versé
// et AVANT la bascule invalidité (la carence initiale J0-J3 n'est pas un
// trou de couverture). Lecture directe des séries — aucun calcul métier.
function detecterTrou(projection: ProjectionResult): { debutJour: number; finJour: number } | null {
  const { axe, basculeInvaliditeJour: bascule, series } = projection;
  const totals = axe.map((_, i) => totalAtIdx(series, i));
  const SEUIL = 1; // tolérance d'arrondi (€)

  const firstNonZero = totals.findIndex((t) => t > SEUIL);
  if (firstNonZero < 0) return null; // aucun revenu jamais versé → cas « données indisponibles », pas un trou

  let debutIdx = -1;
  for (let i = firstNonZero + 1; i < axe.length; i++) {
    if (axe[i].jour >= bascule) break;
    if (totals[i] <= SEUIL) {
      debutIdx = i;
      break;
    }
  }
  if (debutIdx < 0) return null;

  // Fin du trou = reprise d'un revenu (avant bascule) sinon la bascule.
  let finJour = bascule;
  for (let i = debutIdx + 1; i < axe.length; i++) {
    if (axe[i].jour >= bascule) break;
    if (totals[i] > SEUIL) {
      finJour = axe[i].jour;
      break;
    }
  }
  return { debutJour: axe[debutIdx].jour, finJour };
}

function EncartTrou({ projection }: { projection: ProjectionResult }) {
  const trou = detecterTrou(projection);
  if (!trou) return null;
  const debut = libelleJour(trou.debutJour, projection.basculeInvaliditeJour);
  const fin = libelleJour(trou.finJour, projection.basculeInvaliditeJour);
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: BRAND.dangerBg, border: `1px solid ${BRAND.dangerBorder}`, borderLeft: `4px solid ${BRAND.danger}` }}
    >
      <div className="text-sm font-black flex items-center gap-2" style={{ color: BRAND.danger }}>
        <span aria-hidden>⚠</span> Trou de couverture
      </div>
      <div className="text-sm mt-1" style={{ color: BRAND.navy, lineHeight: 1.5 }}>
        Aucun revenu de remplacement n'est versé entre <strong>{debut}</strong> et <strong>{fin}</strong> d'arrêt.
        Sur cette période, seules vos garanties individuelles (contrat Madelin, prévoyance personnelle) peuvent
        combler ce vide — à défaut, le revenu tombe à zéro.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ÉLÉMENT 5 — Encadrés explicatifs masquables (fermés par défaut)
// ─────────────────────────────────────────────────────────────────────

function Accordeon({ titre, children }: { titre: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ border: `1px solid ${SURFACE.border}`, borderRadius: 10, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm"
        style={{ background: SURFACE.cardSoft, color: BRAND.navy, border: "none", cursor: "pointer", fontWeight: 600 }}
        aria-expanded={open}
      >
        <span>{titre}</span>
        <span style={{ color: BRAND.muted }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 py-2 text-xs" style={{ color: BRAND.muted, lineHeight: 1.6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function EncadresExplicatifs({ projection }: { projection: ProjectionResult }) {
  const aMaintien = projection.series.maintienEmployeur.some((v) => v > 0);
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>
        Comprendre les mécanismes
      </div>
      <div className="flex flex-col gap-2">
        <Accordeon titre="Le délai de carence">
          Les tout premiers jours d'arrêt ne sont pas indemnisés (délai de carence). Aucun revenu de remplacement
          n'est versé pendant cette période : elle reste à votre charge.
        </Accordeon>
        {aMaintien && (
          <Accordeon titre="Le maintien de salaire par l'employeur">
            En tant que salarié, votre employeur complète vos indemnités journalières pendant une durée limitée, qui
            dépend de votre ancienneté et de votre convention collective : d'abord à taux plein, puis à taux réduit,
            avant de s'arrêter.
          </Accordeon>
        )}
        <Accordeon titre="La bascule en invalidité">
          Au terme de la période d'arrêt indemnisé (jusqu'à 3 ans), les indemnités journalières cessent : on bascule
          en invalidité. Une pension prend le relais, le plus souvent nettement inférieure à votre revenu d'activité.
        </Accordeon>
        <Accordeon titre="Le plafond des indemnités journalières">
          Les indemnités du régime obligatoire sont plafonnées : au-delà d'un certain revenu, elles n'augmentent plus.
          L'écart avec votre revenu réel n'est couvert que par une prévoyance complémentaire.
        </Accordeon>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Panneau pédagogique complet (sous le graphique) — éléments 2 à 6
// ─────────────────────────────────────────────────────────────────────

export const BlocPedagogie = React.memo(function BlocPedagogie({
  projection,
}: {
  projection: ProjectionResult;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* ÉL. 2 — légende, directement sous le graphique */}
      <LegendeEtages projection={projection} />

      {/* ÉL. 6 — encart trou (rouge) si période à 0 € */}
      <EncartTrou projection={projection} />

      {/* ÉL. 4 — jauge de couverture */}
      <JaugeCouverture projection={projection} />

      {/* ÉL. 3 — montants aux ruptures */}
      <MontantsRuptures projection={projection} />

      {/* ÉL. 5 — encadrés explicatifs */}
      <EncadresExplicatifs projection={projection} />
    </div>
  );
});

BlocPedagogie.displayName = "BlocPedagogie";
