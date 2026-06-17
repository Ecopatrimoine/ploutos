// ─── BlocObligationsBranche — checklist obligations de branche + verdicts gap ──
//
// Composant PUREMENT presentationnel (LOT 2). Recoit la vue calculee en amont
// (resolveComparaisonBranche -> mapBrancheEnVue) ; n'importe QUE des types depuis
// la vue (jamais les fonctions). Calque le pattern audit (BlocAuditConformite).
//
// PERIMETRE (decision actee) : rend la PREVOYANCE de branche + verdicts gap par
// college. Ne pioche PAS vue.sante ni vue.tauxT1 — deja couverts par la matrice
// d'audit (controles c_ccn_branche_sante et c_cadres_15_t1) ; on evite le doublon.
// Ces champs restent dans la vue pour le PDF.
//
// Code couleur des verdicts : memes valeurs que COULEURS_STATUT de
// BlocAuditConformite (coherence, theme-aware via constants), mappees verdict ->
// statut (conforme=conforme, insuffisant=non_conforme, indetermine=vigilance,
// non_applicable=non_applicable). Le composant NE PRODUIT aucun libelle : il rend
// les chaines de la vue (source unique) -> rien a verifier cote DDA.

import React from "react";
import type { ComparaisonBrancheVue, LigneGarantieVue } from "../../lib/prevoyance/comparaison-branche-vue";
import { BRAND, SURFACE } from "../../constants";

type Props = {
  vue: ComparaisonBrancheVue | null;
};

// Verdict derive des types de la vue (pas d'import supplementaire) ; le Record
// impose l'exhaustivite a la compilation.
type Verdict = LigneGarantieVue["verdict"];

const COULEURS_VERDICT: Record<Verdict, { bg: string; border: string; texte: string }> = {
  conforme:       { bg: "rgba(47, 125, 91, 0.08)",  border: "#2F7D5B", texte: "#1E5238" },
  insuffisant:    { bg: "rgba(220, 38, 38, 0.08)",  border: "#DC2626", texte: "#7A1F1F" },
  indetermine:    { bg: "rgba(245, 158, 11, 0.08)", border: "#F59E0B", texte: "#7C4A04" },
  non_applicable: { bg: "rgba(107, 114, 128, 0.06)", border: "#9CA3AF", texte: "#6B7280" },
};

export const BlocObligationsBranche = React.memo(function BlocObligationsBranche({ vue }: Props) {
  if (vue === null) return null;

  return (
    <div className="space-y-3">
      {/* 1. Titre + statut */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Obligations de prevoyance de branche
        </div>
        <div className="text-xs" style={{ color: BRAND.muted }}>
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

      {/* 3. Etat vide propre : aucun college a afficher */}
      {vue.colleges.length === 0 ? (
        <div className="text-sm" style={{ color: BRAND.muted }}>
          {vue.statutLabel}
        </div>
      ) : (
        vue.colleges.map((col) => {
          const cg = COULEURS_VERDICT[col.verdictGlobal];
          return (
            <div
              key={col.libelle}
              className="rounded-xl p-3 space-y-2"
              style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
            >
              {/* En-tete college + verdict global */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-bold" style={{ color: BRAND.navy }}>
                  {col.libelle}
                </div>
                <span
                  className="rounded-lg px-2.5 py-0.5 text-xs font-bold"
                  style={{ background: cg.bg, border: `1px solid ${cg.border}`, color: cg.texte }}
                >
                  {col.verdictGlobalLabel}
                </span>
              </div>

              {/* Lignes par garantie */}
              <div className="space-y-2">
                {col.lignes.map((l) => {
                  const cv = COULEURS_VERDICT[l.verdict];
                  return (
                    <div
                      key={l.garantie}
                      className="rounded-lg p-2.5"
                      style={{ background: cv.bg, border: `1px solid ${cv.border}` }}
                    >
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: BRAND.navy }}>
                          {l.garantieLabel}
                        </span>
                        <span
                          className="rounded px-2 py-0.5 text-xs font-bold"
                          style={{ background: "#fff", border: `1px solid ${cv.border}`, color: cv.texte }}
                        >
                          {l.verdictLabel}
                        </span>
                      </div>
                      <div className="text-sm mt-1 leading-relaxed" style={{ color: BRAND.navy }}>
                        {l.obligationResume}
                      </div>
                      {l.motif && (
                        <div className="text-xs mt-1" style={{ color: BRAND.muted }}>
                          {l.motif}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
});

BlocObligationsBranche.displayName = "BlocObligationsBranche";
