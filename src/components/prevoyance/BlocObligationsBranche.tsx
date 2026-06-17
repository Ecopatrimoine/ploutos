// ─── BlocObligationsBranche — obligations de branche fusionnees + gap (LOT 5) ──
//
// Composant PUREMENT presentationnel. Consomme la vue FUSIONNEE par garantie
// (buildVueObligationsFusionnee, Lots 4/4bis) : une synthese chiffree + un
// tableau UNIQUE (plus de sections par college). N'importe QUE des types depuis
// la vue ; ne produit aucun libelle metier -> rien a verifier cote DDA.
//
// Une ValeurFusionnee { commun } s'affiche en une valeur ; { cadres, nonCadres }
// s'affiche en deux lignes compactes. Idem pour les pastilles de verdict.
// Code couleur des verdicts : memes valeurs que BlocAuditConformite (coherence) ;
// "A etudier" (= indetermine) -> ambre.

import React from "react";
import type {
  VueObligationsFusionnee,
  ValeurFusionnee,
  VerdictFusionne,
} from "../../lib/prevoyance/comparaison-branche-vue";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  vue: VueObligationsFusionnee | null;
};

// Verdict derive des types de la vue (pas d'import supplementaire) ; le Record
// impose l'exhaustivite a la compilation.
type Verdict = Extract<VerdictFusionne, { commun: unknown }>["commun"];

const COULEURS_VERDICT: Record<Verdict, { bg: string; border: string; texte: string }> = {
  conforme:       { bg: "rgba(47, 125, 91, 0.08)",  border: "#2F7D5B", texte: "#1E5238" },
  insuffisant:    { bg: "rgba(220, 38, 38, 0.08)",  border: "#DC2626", texte: "#7A1F1F" },
  indetermine:    { bg: "rgba(245, 158, 11, 0.08)", border: "#F59E0B", texte: "#7C4A04" },
  non_applicable: { bg: "rgba(107, 114, 128, 0.06)", border: "#9CA3AF", texte: "#6B7280" },
};

// Une ValeurFusionnee -> JSX. null -> "—" ; commun -> texte ; split -> 2 lignes.
function renderValeur(v: ValeurFusionnee | null): React.ReactNode {
  if (!v) return <span style={{ color: BRAND.muted }}>—</span>;
  if ("commun" in v) return v.commun;
  return (
    <div className="space-y-0.5">
      <div><span className="font-semibold" style={{ color: BRAND.muted }}>Cadres :</span> {v.cadres}</div>
      <div><span className="font-semibold" style={{ color: BRAND.muted }}>Non-cadres :</span> {v.nonCadres}</div>
    </div>
  );
}

function pastilleVerdict(verdict: Verdict, label: string, prefixe?: string): React.ReactNode {
  const c = COULEURS_VERDICT[verdict];
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-bold"
      style={{ background: "#fff", border: `1px solid ${c.border}`, color: c.texte }}
    >
      {prefixe ? `${prefixe} ` : ""}{label}
    </span>
  );
}

// Verdict fusionne + son libelle (structures paralleles) -> pastille(s).
function renderVerdict(verdict: VerdictFusionne | null, verdictLabel: ValeurFusionnee | null): React.ReactNode {
  if (!verdict) return null;
  if ("commun" in verdict) {
    const label = verdictLabel && "commun" in verdictLabel ? verdictLabel.commun : "";
    return pastilleVerdict(verdict.commun, label);
  }
  const lc = verdictLabel && "cadres" in verdictLabel ? verdictLabel.cadres : "";
  const ln = verdictLabel && "cadres" in verdictLabel ? verdictLabel.nonCadres : "";
  return (
    <div className="flex flex-col items-start gap-1">
      {pastilleVerdict(verdict.cadres, lc, "Cadres :")}
      {pastilleVerdict(verdict.nonCadres, ln, "Non-cadres :")}
    </div>
  );
}

export const BlocObligationsBranche = React.memo(function BlocObligationsBranche({ vue }: Props) {
  if (vue === null) return null;

  const { afficherComparaison, synthese } = vue;
  const thStyle = "text-left text-xs font-semibold uppercase tracking-widest pb-2 pr-3";

  return (
    <div className="space-y-3">
      {/* 1. Titre + statut */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Obligations de prevoyance de branche
        </div>
        <div className="text-xs mt-0.5" style={{ color: BRAND.muted }}>
          {vue.statutLabel}
        </div>
      </div>

      {/* 2. Avertissement donnees partielles */}
      {vue.afficherAvertissementIncomplet && (
        <div
          className="rounded-xl p-2.5 text-xs"
          style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid #F59E0B", color: "#7C4A04" }}
        >
          ⚠ Donnees de branche partiellement documentees : verification manuelle conseillee.
        </div>
      )}

      {/* 3. Etat vide propre : aucune ligne -> statutLabel seul (ci-dessus), pas de tableau. */}
      {vue.lignes.length > 0 && (
        <>
          {/* 4. Synthese chiffree (uniquement si comparaison realisee) */}
          {afficherComparaison && synthese && (
            <div className="flex flex-wrap gap-2">
              {([
                ["conforme", `${synthese.conformes} conformes`],
                ["insuffisant", `${synthese.insuffisants} insuffisante(s)`],
                ["indetermine", `${synthese.aEtudier} a etudier`],
              ] as const).map(([k, texte]) => {
                const c = COULEURS_VERDICT[k];
                return (
                  <span
                    key={k}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.texte }}
                  >
                    {texte}
                  </span>
                );
              })}
            </div>
          )}

          {/* 5. Bandeau "comparaison non realisee" si aucun souscrit */}
          {!afficherComparaison && (
            <div className="text-xs rounded-xl p-2.5" style={{ background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}`, color: BRAND.muted }}>
              Aucune garantie souscrite renseignee — comparaison non realisee.
            </div>
          )}

          {/* 5bis. Tableau unique */}
          <div className="rounded-xl p-3 overflow-x-auto" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${SURFACE.border}` }}>
                  <th className={thStyle} style={{ color: BRAND.sky }}>Garantie</th>
                  <th className={thStyle} style={{ color: BRAND.sky }}>Obligation de branche</th>
                  {afficherComparaison && <th className={thStyle} style={{ color: BRAND.sky }}>Souscrit</th>}
                  {afficherComparaison && <th className={thStyle} style={{ color: BRAND.sky }}>Verdict</th>}
                </tr>
              </thead>
              <tbody>
                {vue.lignes.map((l) => (
                  <tr key={l.garantie} style={{ borderBottom: `1px solid ${SURFACE.border}` }}>
                    <td className="py-2 pr-3 align-top font-bold" style={{ color: BRAND.navy }}>
                      {l.garantieLabel}
                    </td>
                    <td className="py-2 pr-3 align-top" style={{ color: BRAND.navy }}>
                      {renderValeur(l.obligation)}
                    </td>
                    {afficherComparaison && (
                      <td className="py-2 pr-3 align-top" style={{ color: BRAND.navy }}>
                        {l.estReference
                          ? <span className="text-xs italic" style={{ color: BRAND.muted }}>reference</span>
                          : renderValeur(l.souscrit)}
                      </td>
                    )}
                    {afficherComparaison && (
                      <td className="py-2 align-top">
                        {l.estReference ? null : renderVerdict(l.verdict, l.verdictLabel)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 6. Notes de bas : garanties non prevues + maintien deja projete */}
          {vue.nonPrevues.length > 0 && (
            <div className="text-xs space-y-1" style={{ color: BRAND.muted }}>
              <div>
                Non prevue par la branche : {vue.nonPrevues.map((n) => n.garantieLabel).join(", ")}.
              </div>
              <div>
                Le maintien employeur est deja integre a la projection (Prevoyance personnelle).
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

BlocObligationsBranche.displayName = "BlocObligationsBranche";
