// ─── Lot 6 — Source unique du scoring profil investisseur ───────────────────
//
// 🔴 Périmètre ÉCRAN UNIQUEMENT en Lot 6.
// Le PDF lettre de mission (pdfMission.ts) garde son scoring interne à 5
// niveaux jusqu'au Lot 8 (refonte PDF dédiée, avec régénération coordonnée
// des snapshots). Divergence temporaire assumée.
//
// Invariant principal : à réponses de risque identiques, le profil n'est PAS
// déplacé par l'ajout du sous-score ESG. L'axe risque reste calculé sur les
// seules questions de risque ; l'ESG produit un sous-score séparé qui entre
// dans le total affiché mais ne change pas la catégorie de profil.

export type Profil = "prudent" | "équilibré" | "dynamique" | "offensif";

export type EsgPref = "oui" | "partiel" | "non" | "";

export type ScoreProfil = {
  /** Score de risque calculé sur les questions d'attitude/connaissance/expérience.
   *  C'est lui (et lui seul) qui détermine le profil. */
  scoreRisque: number;
  /** Sous-score ESG (préférences de durabilité). Entre dans le total mais
   *  ne modifie PAS le profil. */
  sousScoreESG: number;
  /** Total affiché : scoreRisque + sousScoreESG. */
  total: number;
  /** Dénominateur du total (max théorique : 80 risque + 4 ESG = 84). */
  totalMax: number;
  /** Profil à 4 niveaux dérivé de scoreRisque uniquement. */
  profil: Profil;
};

/**
 * Bornes du mapping à 4 niveaux. Mêmes seuils 20/40/60 que l'ancien mapping
 * à 5, sauf que la tranche "Sécuritaire" (pts ≤ 10) est absorbée dans
 * "prudent". Garantit que pour pts > 10, le label de profil est strictement
 * conservé après bascule 5→4 niveaux.
 */
export const SEUILS_PROFIL = {
  prudent:   20,   // pts ≤ 20 → prudent
  équilibré: 40,   // 20 < pts ≤ 40 → équilibré
  dynamique: 60,   // 40 < pts ≤ 60 → dynamique
  // pts > 60 → offensif
} as const;

/** Points alloués à la question ESG selon la préférence de durabilité. */
export const SOUS_SCORE_ESG = {
  oui:     4,   // intégration prioritaire des critères ESG
  partiel: 2,
  non:     0,
} as const;

/**
 * Calcule le score de risque pur (sans ESG). Formule strictement identique
 * à celle utilisée dans TabMission.tsx et pdfMission.ts avant le Lot 6 — voir
 * src/tests/profil.caracterisation.test.ts pour le filet qui fige ce calcul.
 * Borné [0, 80] (max théorique).
 */
export function computeScoreRisque(mission: any): number {
  return (mission?.attitude || 0) + (mission?.reactionBaisse || 0) +
    (mission?.connaitFondsEuros?1:0)+(mission?.investiFondsEuros?1:0)+
    (mission?.connaitActions?1:0)+(mission?.investiActions?3:0)+
    (mission?.connaitOPCVM?1:0)+(mission?.investiOPCVM?3:0)+
    (mission?.connaitImmo?1:0)+(mission?.investiImmo?2:0)+
    (mission?.connaitTrackers?1:0)+(mission?.investiTrackers?3:0)+
    (mission?.connaitStructures?1:0)+(mission?.investiStructures?4:0)+
    (mission?.reactionPertes||0)+(mission?.reactionGains||0)+
    (mission?.modeGestion==="pilote"?2:mission?.modeGestion==="libre"?4:0)+
    (mission?.savoirUCRisque?2:0)+(mission?.savoirHorizonUC?2:0)+(mission?.savoirRisqueRendement?2:0);
}

export function computeSousScoreESG(esgPref: EsgPref | undefined | null): number {
  if (esgPref === "oui") return SOUS_SCORE_ESG.oui;
  if (esgPref === "partiel") return SOUS_SCORE_ESG.partiel;
  return SOUS_SCORE_ESG.non;
}

export function profilFromScore(scoreRisque: number): Profil {
  if (scoreRisque <= SEUILS_PROFIL.prudent)   return "prudent";
  if (scoreRisque <= SEUILS_PROFIL.équilibré) return "équilibré";
  if (scoreRisque <= SEUILS_PROFIL.dynamique) return "dynamique";
  return "offensif";
}

/** Source unique consommée par l'écran (TabMission). */
export function computeProfilRisque(mission: any): ScoreProfil {
  const scoreRisque  = computeScoreRisque(mission);
  const sousScoreESG = computeSousScoreESG(mission?.esgPref);
  // Dénominateur : 80 (max risque, cohérent avec la jauge PDF "max=80") + 4 (max ESG).
  const totalMax = 80 + SOUS_SCORE_ESG.oui;
  return {
    scoreRisque,
    sousScoreESG,
    total: scoreRisque + sousScoreESG,
    totalMax,
    profil: profilFromScore(scoreRisque),
  };
}
