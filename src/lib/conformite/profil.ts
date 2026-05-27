// ─── Source unique du scoring profil investisseur (Lot 6 → 6bis) ───────────
//
// Lot 6 :  4 niveaux + sous-score ESG (axe risque indépendant de l'ESG).
// Lot 6bis : réintégration de l'HORIZON dans le scoring de risque (le bloc
//            Horizon — saisi à l'écran avec un barème 0/4/8/16 — était
//            historiquement non comptabilisé, bug latent corrigé ici).
//
// Source unique partagée écran + PDF v2 (pageProfil + buildProfilData).
//
// Invariants :
// - À réponses identiques (risque + horizon), l'ESG ne déplace PAS le profil
//   — il produit un sous-score séparé qui entre dans le total mais pas dans
//   la catégorisation.
// - L'horizon est intégré au scoreRisque : un long horizon PEUT pousser un
//   profil d'un cran (équilibré → dynamique → offensif), conformément à
//   l'attendu pédagogique de la grille de profil.

export type Profil = "prudent" | "équilibré" | "dynamique" | "offensif";

export type EsgPref = "oui" | "partiel" | "non" | "";

export type ScoreProfil = {
  /** Score de risque (attitude + connaissance + expérience + HORIZON).
   *  C'est lui (et lui seul) qui détermine le profil. Borné [0, MAX_RISQUE]. */
  scoreRisque: number;
  /** Sous-score ESG (préférences de durabilité). Entre dans le total mais
   *  ne modifie PAS le profil. */
  sousScoreESG: number;
  /** Total affiché : scoreRisque + sousScoreESG. */
  total: number;
  /** Dénominateur du total = MAX_RISQUE + max ESG = 96 + 4 = 100 (Lot 6bis). */
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
 * Pondération du bloc Horizon de placement (Lot 6bis).
 * Barème strictement identique aux libellés déjà affichés à l'écran dans
 * TabMission (radios "0-4 (0 pt)", "5-8 (4 pts)", "9-15 (8 pts)", "15+ (16 pts)").
 * Paramétrable : modifier ces valeurs UNIQUEMENT en cohérence avec les
 * libellés UI.
 */
export const PONDERATION_HORIZON = {
  "0-4":  0,
  "5-8":  4,
  "9-15": 8,
  "15+":  16,
} as const;

/** Max théorique du scoreRisque (Lot 6bis : 80 base + 16 horizon = 96). */
export const MAX_RISQUE = 96;

/** Max théorique total (risque + ESG). */
export const MAX_TOTAL = MAX_RISQUE + SOUS_SCORE_ESG.oui;  // 100

function ptsHorizon(horizon: unknown): number {
  if (typeof horizon !== "string") return 0;
  return (PONDERATION_HORIZON as Record<string, number>)[horizon] || 0;
}

/**
 * Calcule le score de risque (Lot 6bis : INCLUT l'horizon). Borné [0, 96].
 * Lot 6 historique : la formule omettait l'horizon (bug latent). La
 * réintégration corrige le bug et peut faire basculer un dossier d'un cran
 * de profil — voir src/tests/profil.test.ts pour les preuves.
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
    (mission?.savoirUCRisque?2:0)+(mission?.savoirHorizonUC?2:0)+(mission?.savoirRisqueRendement?2:0)+
    ptsHorizon(mission?.horizon);
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

/** Source unique consommée par l'écran (TabMission) et le PDF v2 (buildProfilData). */
export function computeProfilRisque(mission: any): ScoreProfil {
  const scoreRisque  = computeScoreRisque(mission);
  const sousScoreESG = computeSousScoreESG(mission?.esgPref);
  return {
    scoreRisque,
    sousScoreESG,
    total: scoreRisque + sousScoreESG,
    totalMax: MAX_TOTAL,
    profil: profilFromScore(scoreRisque),
  };
}
