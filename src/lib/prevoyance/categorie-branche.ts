// ─── Aiguillage du COLLÈGE de prévoyance de BRANCHE (CCN) ────────────────────
//
// LOT BTP-0 : certaines conventions ne couvrent qu'UN SEUL collège (ex. BTP :
// IDCC 1596/1597/1702 = ouvriers, 2609/2614 = ETAM, 2420/3212 = cadres). Pour
// ces conventions, le collège est IMPOSÉ par le texte et doit primer sur le
// statut professionnel saisi : sinon un `statutPro` incohérent avec la
// convention (ex. IDCC 2420 « cadres » + statutPro `salarie_non_cadre`)
// aiguille vers `prevoyanceNonCadres = null` → indisponibilité SILENCIEUSE
// (capital décès / IJ / invalidité de branche absents, sans aucune alerte).
//
// Ce module fournit l'aiguilleur unique des RÉSOLVEURS DE BRANCHE : capital
// décès, rente éducation, rente conjoint (cf. succession.ts) et couverture
// IJ / invalidité (cf. projection.ts). Il NE remplace PAS `categorieMaintien`,
// qui reste l'aiguilleur du MAINTIEN DE SALAIRE employeur (sa fonction
// d'origine, comportement inchangé) et sert ici de REPLI.
//
// Lecture défensive (modèle des casts Record des autres résolveurs) :
// `collegeImpose` (champ optionnel convention-level de ccn-2026.json) ne prime
// QUE s'il vaut exactement "cadres" ou "nonCadres". Absent / "TO_VERIFY" /
// valeur inconnue ("ouvriers", nombre, objet…) → repli sur
// categorieMaintien(statutPro). Fonction TOTALE : jamais d'exception.

import type { StatutPro } from "../../types/patrimoine";
import type { Referentiels } from "../../data/prevoyance";
import { categorieMaintien } from "./projection";

// Forme lue dans le référentiel : seul `collegeImpose` nous intéresse ici
// (champ `unknown`, validé localement). Indépendant des blocs prévoyance /
// maintien, qu'on ne touche pas.
type ConventionCollege = { collegeImpose?: unknown };

export function categorieBranche(
  idcc: string | null,
  statutPro: StatutPro | "",
  ref: Referentiels
): "cadres" | "nonCadres" {
  const repliStatut = categorieMaintien(statutPro);
  if (!idcc) return repliStatut;

  const conventions = ref.ccn.conventions as Record<
    string,
    ConventionCollege | undefined
  >;
  const impose = conventions?.[idcc]?.collegeImpose;
  // Seules les deux valeurs exactes priment ; tout le reste → repli statutPro.
  if (impose === "cadres" || impose === "nonCadres") return impose;
  return repliStatut;
}
