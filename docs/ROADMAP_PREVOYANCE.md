# Roadmap module Prévoyance — points à reprendre

Points identifiés en cours de développement v1.4.0, à traiter
ultérieurement.

## Règles

- **Vraie règle `ij_pas_de_subrogation`** : à implémenter quand
  les CCN du référentiel auront le champ `subrogation: boolean`
  rempli. Déclencher quand IDCC documenté ET `subrogation=false`
  ET salaire > plafond IJSS. Aujourd'hui remplacée par
  `ij_ccn_non_documentee` qui signale juste l'absence de la CCN
  dans le référentiel.
- **Affinage de `calcConjointACharge`** : aujourd'hui seuil unique
  à 50 %. Pistes : pondération par nombre d'enfants, seuil ajusté
  sur cohérence géographique (coût de la vie), prise en compte
  du patrimoine de P2 (s'il a un capital propre suffisant, il
  n'est pas "à charge" même avec revenus faibles).
- **Règles de conformité collective** (livrées au LOT 8) :
  `conf_cadres_15_t1`, `conf_ani_sante_obligatoire`,
  `conf_categories_objectives_invalides`,
  `conf_ccn_branche_obligatoire_non_respectee`.
- **`conf_forfait_social_a_auditer`** : constat ajouté hors spec
  initiale au Lot 8. Rappelle d'auditer le forfait social en DSN.
  À reconsidérer : soit le promouvoir en contrôle à part entière
  avec calcul du taux réel, soit le fusionner dans une note de
  synthèse.

## Référentiels

- **Remplissage TO_VERIFY / TO_FILL** : voir récap LOT 3 pour la
  liste détaillée par caisse et par CCN.
- **Tranche 2 de CCN** (20 IDCC supplémentaires) : voir spec §12.2.
- **Tranche 3 de CCN** (50 IDCC verticales métier) : voir spec §12.3.
- **Script de vérification automatique PASS via API Légifrance / PISTE** :
  cf. discussion mai 2026, hors périmètre v1.4.0.

## Moteur

- **Sync Kleios → contrats individuels** : aujourd'hui saisie
  manuelle dans le tab. Différé à la refonte Kleios.
- **Multi-employeurs** : un seul employeur par personne en v1.
  Si besoin remonté, ajouter `employeurs[]` dans `PayloadTravail`.
- **Âge légal de retraite par génération** : aujourd'hui `AGE_RETRAITE_DEFAUT = 64`
  en dur dans `src/lib/prevoyance/mapping.ts`. À affiner via la date
  de naissance pour respecter la réforme 2023 (62 → 64 ans progressif
  selon génération).
- **Salaire net mensuel — affinage** : aujourd'hui fallback brut × 0.78 / 12
  dans `mapping.ts` quand `salary*` non saisi. Affiner via le calcul
  IR réel (CSG/CRDS, prélèvements salariaux) déjà présent dans
  `lib/calculs/ir.ts`.
- **Plafond IJSS via formule** : `plafondFormule` supporté
  (cf. `src/lib/prevoyance/formula.ts`). Reste à ajouter le champ
  `"plafondFormule": "1.4 * SMIC_mensuel * 3 / 91.25 * 0.5"` aux
  caisses concernées dans `caisses-2026.json`.

## Pack PDF

- **Nettoyage anciens fichiers prévoyance génériques** : `pagePrevoyanceInd.ts`,
  `buildPrevoyanceIndData.ts` et `renderPrevoyanceInd.ts` ne sont plus dans le
  pipeline pack (remplacés au Lot 9 par `pagePrevoyancePerso` /
  `buildPrevoyancePersoData`). Ils restent utilisés par l'aperçu standalone
  `scripts/generatePdfLocal.ts` (+ script npm `pdf:prevoyanceInd`). À supprimer
  quand l'aperçu standalone sera migré ou retiré, avec `renderPrevoyanceColl.ts`
  si l'aperçu collective standalone n'est plus utile.
- **SVG projection PDF** : `renderProjectionSVG` regroupe les 7 étages du moteur
  en 4 catégories pour la lisibilité print. Si besoin du détail des 7 étages en
  PDF, enrichir le helper.

## UI

- **Carte concubinage / régime matrimonial** : aujourd'hui aucune
  adaptation spécifique en fonction du régime matrimonial dans le
  module prévoyance. Voir s'il y a un usage métier qui justifie
  une variation.
- **Affichage "Notre lecture" interprétatif** : à ajouter à la page
  Pack PDF Prévoyance v2 (LOT 9), pour cohérence avec les autres
  pages bilan.
