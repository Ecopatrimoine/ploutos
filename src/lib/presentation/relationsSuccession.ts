// ─── Présentation — libellé du lien de parenté (succession & AV) ──────────────
//
// SOURCE UNIQUE des libellés « Lien » des tableaux succession (héritiers page A,
// bénéficiaires AV page B) — écran ET PDF. Avant : chaque adaptateur PDF avait sa
// PROPRE table `relationLabel`, divergente et incomplète (l'une oubliait
// `enfant_conjoint` → clé brute imprimée « enfant_conjoint » ; l'autre encore plus ;
// et une clé morte « frere-soeur » en tiret qui ne matchait jamais le `frereSoeur`
// réellement émis par le moteur). Lot 11 G5-D : un seul mapping partagé, pas de copie.
//
// Les CLÉS couvrent exactement le vocabulaire du select écran
// (TESTAMENT_RELATION_OPTIONS / BENEFICIARY_RELATION_OPTIONS) PLUS les relations
// émises par le moteur mais absentes du select (`pacs_partner`, `ascendant`). Un test
// verrouille l'inclusion « toute valeur du select écran a un libellé ici ».
import { TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS } from "../../constants";

// Libellés CONCIS (colonne étroite « Lien » d'un tableau), forme humaine alignée sur
// l'intention de l'écran sans les parenthèses de désambiguïsation du select de saisie.
const LIBELLES: Record<string, string> = {
  conjoint: "Conjoint",
  pacs_partner: "Partenaire de PACS",
  enfant: "Enfant",
  enfant_conjoint: "Enfant du conjoint",
  "petit-enfant": "Petit-enfant",
  frereSoeur: "Frère / sœur",
  neveuNiece: "Neveu / nièce",
  ascendant: "Ascendant",
  parent: "Père / mère",
  autre: "Autre / tiers",
};

/** Vocabulaire du select écran (héritiers + bénéficiaires AV), pour le test d'inclusion. */
export const RELATIONS_ECRAN: readonly string[] = Array.from(
  new Set([...TESTAMENT_RELATION_OPTIONS, ...BENEFICIARY_RELATION_OPTIONS].map((o) => o.value)),
);

/**
 * Libellé humain d'un lien de parenté succession/AV.
 * @param relation clé moteur/écran (ex. "enfant_conjoint").
 * @param fallbackVide libellé si `relation` est vide/absent (contexte : « Héritier » ou « Bénéficiaire »).
 * @returns le libellé concis ; en dernier recours (clé inconnue non vide) la clé brute, jamais masquée.
 */
export function labelRelationSuccession(relation?: string, fallbackVide = "—"): string {
  const k = String(relation ?? "").trim();
  if (!k) return fallbackVide;
  return LIBELLES[k] ?? LIBELLES[k.toLowerCase()] ?? k;
}
