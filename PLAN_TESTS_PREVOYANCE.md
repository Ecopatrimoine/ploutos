# PLAN DE TESTS EXHAUSTIF — Module Prévoyance Ploutos

> Objectif : compléter les 524 tests existants (qui vérifient surtout « le code fait ce qu'on lui a dit ») par une batterie de tests qui vérifient « ce qu'on lui a dit est juste » — sur les plans **mathématique**, **logique métier**, **juridique** et **robustesse technique**.
>
> Méthode de validation : Claude Code écrit les tests par familles. Pour chaque famille, David colle les résultats à Claude (conversationnel), qui vérifie les valeurs attendues auprès de toutes les sources accessibles (BOSS, URSSAF, Légifrance, ameli.fr, sites des caisses) avant de figer.
>
> Date : 28 mai 2026. Référence : SPEC_MODULE_PREVOYANCE.md, ROADMAP_PREVOYANCE.md.

---

## Principe directeur

Les tests sont rangés en **8 familles**. Chaque famille a un but distinct. On ne mélange pas « le calcul est mathématiquement cohérent » (famille B) avec « le résultat correspond au droit positif 2026 » (famille G) : ce sont deux validations différentes, faites par des moyens différents.

Important : tant que les référentiels contiennent des `TO_VERIFY`/`TO_FILL`, les tests des familles G (exactitude juridique) ne peuvent être que **partiels**. On les écrit quand même, en les marquant `it.skip` ou `it.todo`, pour qu'ils deviennent actifs dès que les chiffres officiels sont saisis. C'est une dette de test **traçable**, pas oubliée.

---

## FAMILLE A — Invariants structurels (techniques, automatisables à 100 %)

Ces tests ne dépendent d'aucune valeur officielle. Ils vérifient que la sortie du moteur est toujours bien formée, quelles que soient les entrées. Ils doivent passer même avec un référentiel entièrement `TO_VERIFY`.

| # | Test | Attendu |
|---|---|---|
| A1 | Aucune valeur de série n'est `NaN`, `null`, `undefined` ou `Infinity` | Pour 200 entrées aléatoires générées (fuzzing) |
| A2 | Aucune valeur de série n'est négative | idem |
| A3 | `axe.length === series.salaire.length` (et pour les 7 séries) | Alignement strict des tableaux |
| A4 | L'axe est strictement croissant en `jour` | Pas de doublon, pas de régression |
| A5 | `basculeInvaliditeJour === 1095` systématiquement | Constante métier |
| A6 | `finProjectionJour === (ageRetraite - age) * 365` et ≥ 1095 | Sauf si age ≥ ageRetraite → clamp documenté |
| A7 | La phase de chaque point d'axe est cohérente : `jour < 1095 → "am"`, `jour >= 1095 → "invalidite"` | Pas de point mal étiqueté |
| A8 | `revenuReferenceMensuel >= 0` | Jamais négatif |
| A9 | Toutes les `rupturesCles` ont un `jour` présent dans l'axe | Pas de rupture orpheline |
| A10 | Les `rupturesCles` sont triées par `jour` croissant | Ordre stable |
| A11 | Performance : une projection < 50 ms (moyenne sur 100 runs) | Conforme spec §6.5 |
| A12 | Idempotence : deux appels identiques → résultats strictement égaux | Pas d'aléa caché, pas de mutation d'état |
| A13 | Immuabilité : l'objet `EntreePerso` passé en entrée n'est pas muté | Fonction pure |
| A14 | Avec référentiel `TO_VERIFY` complet → `donneesCaisseIndisponibles === true` + au moins une rupture `donnees_indisponibles` | Tolérance des trous |

**Technique de fuzzing pour A1-A2** : générer aléatoirement âge (18-66), salaire (0-300 000), ancienneté (0-480 mois), statut (tous), caisse (toutes), 0-5 contrats individuels aléatoires, couverture collective présente ou non. 200 itérations. Aucune ne doit produire NaN/négatif/crash.

---

## FAMILLE B — Cohérence mathématique interne (automatisable à 100 %)

Vérifie que les relations entre les grandeurs sont respectées, indépendamment des valeurs absolues. Ces tests survivent au remplissage des `TO_VERIFY`.

| # | Test | Attendu |
|---|---|---|
| B1 | Monotonie ancienneté : à entrée égale, plus l'ancienneté est élevée, plus la durée de maintien employeur est longue (ou égale) | Jamais l'inverse |
| B2 | Monotonie carence : le revenu pendant la carence (avant le 1er versement) ≤ revenu juste après la fin de carence | La carence est un creux, pas un pic |
| B3 | Empilement : à chaque jour, la somme des 7 étages = revenu total affiché dans le tableau jalons | Pas de double comptage ni d'oubli |
| B4 | Effet franchise contrat IJ : un contrat avec `franchiseJours = 30` produit 0 sur [0,29] puis sa valeur à partir de J30 | Transition nette |
| B5 | Effet plafond contrat IJ : au-delà de `plafondJoursIJ`, l'étage individuel retombe à 0 | Borne supérieure respectée |
| B6 | Additivité contrats : 2 contrats IJ de 100 €/j → étage individuel = 200 €/j (à franchise commune) | Sommation correcte |
| B7 | Complémentaire collective = complément : `ijColl = max(0, cible_pct × brut − (ijObl + maintien))` | Jamais de sur-couverture, jamais négatif |
| B8 | Catégorie invalidité croissante : revenu invalidité cat3 ≥ cat2 ≥ cat1 (à couverture égale) | Cohérence des catégories |
| B9 | Effet salaire nul : `salaireBrut = 0` et pas de TNS → toutes séries à 0, pas de crash | Cas dégénéré |
| B10 | Effet âge proche retraite : age = 63 → phase invalidité courte (1 an), pas de série au-delà de 64 | Clamp |
| B11 | Cohérence TNS : pour un TNS, `maintienEmployeur` = 0 partout (un TNS n'a pas d'employeur) | Pas de maintien fantôme |
| B12 | Cohérence salarié sans contrat ni collective : seuls `maintienEmployeur` + `ijObligatoire` sont non nuls en phase AM | Pas d'étage individuel/collectif fantôme |
| B13 | Continuité à la bascule J1095 : pas de saut absurde (division par zéro, valeur × 1000) entre J1094 et J1095 | Transition contrôlée |
| B14 | Le revenu de référence est cohérent avec le salaire : `revenuRef ≈ salaireBrut × coef_net / 12` pour un salarié | Vérifier le coefficient utilisé (0.78 ?) |

---

## FAMILLE C — Logique métier des règles/constats (automatisable à 100 %)

Vérifie que chaque règle se déclenche exactement quand elle doit, et pas autrement. Un test positif + un test négatif + un test de bordure par règle.

| # | Règle | Test positif | Test négatif | Bordure |
|---|---|---|---|---|
| C1 | `dc_tns_sans_capital` | TNS, 0 capital DC, conjoint à charge → déclenche | TNS avec capital DC → ne déclenche pas | TNS célibataire sans enfant → ne déclenche pas |
| C2 | `dc_capital_insuffisant_dettes` | Capital 50k < dettes 200k → déclenche, impactChiffre = 150k | Capital 250k > dettes 200k → ne déclenche pas | Capital = dettes exactement → ne déclenche pas |
| C3 | `dc_pas_de_rente_conjoint_enfants_jeunes` | Conjoint à charge + enfant 5 ans + pas de rente → déclenche | Pas d'enfant mineur → ne déclenche pas | Enfant 17 ans 11 mois → déclenche ; 18 ans → ne déclenche pas |
| C4 | `ij_carence_caisse_sans_madelin` | TNS CARMF (IJ obl 0 à J60) sans Madelin → déclenche | TNS avec Madelin IJ → ne déclenche pas | Salarié (jamais concerné) → ne déclenche pas |
| C5 | `ij_plafond_insuffisant` | Trou > 30 % du revenu réf à J180 → déclenche | Trou < 30 % → ne déclenche pas | Trou = 30 % exactement → définir le comportement (>, ≥ ?) |
| C6 | `ij_ccn_non_documentee` | IDCC saisi + useLegalDefault=true → déclenche (info) | IDCC dans le référentiel → ne déclenche pas | TNS sans IDCC → ne déclenche pas |
| C7 | `inv_cat2_aucune_couverture_compl` | Pension cat2 < 60 % réf + aucune compl → déclenche | Avec rente collective → ne déclenche pas | Pension cat2 = 60 % pile → bordure |
| C8 | `inv_tns_madelin_absent` | TNS sans rente invalidité ind → déclenche | TNS avec rente invalidité → ne déclenche pas | Salarié → ne déclenche pas |
| C9 | `conjointACharge` seuil 50 % | P2 à 30 % du revenu P1 → à charge | P2 à 60 % → pas à charge | P2 à 49,9 % → à charge ; 50,1 % → pas à charge |
| C10 | Tri des constats | Mix de sévérités → ordre non_conformite > alerte > attention > info | — | Liste vide → pas de crash |
| C11 | Propagation P1/P2 | Constat P1 ne pollue pas P2 et inversement | — | P2 absent → pas de constat P2 |

---

## FAMILLE D — Conformité collective (automatisable à 100 % pour la logique)

| # | Contrôle | Test positif | Test négatif | N.A. |
|---|---|---|---|---|
| D1 | `c_sante_ani_obligatoire` | Effectif 5, pas de santé → non_conforme | Effectif 5 + santé en place → conforme | Effectif 0 → non_applicable |
| D2 | `c_cadres_15_t1` | Cadres + tauxT1 1,2 → non_conforme | Cadres + tauxT1 1,5 → conforme | Pas de cadres → vigilance ou N.A. (à trancher) |
| D3 | `c_categories_objectives` | Catégorie vide → non_conforme | Catégorie déclarée → vigilance | — |
| D4 | `c_ccn_branche_prevoyance` | IDCC avec plancher → vigilance | — | Pas d'IDCC → non_applicable |
| D5 | `c_ccn_branche_sante` | IDCC panier > ANI → vigilance | — | Pas d'IDCC ou panier = ANI → non_applicable |
| D6 | `c_forfait_social` (nouveau) | Effectif ≥ 11 → vigilance (20 %) | — | Effectif < 11 → non_applicable (0 %) ; null → vigilance |
| D7 | scoreGlobal | % conformes sur applicables uniquement (exclut les N.A.) | Vérifier le calcul exact sur un cas à 3 conformes / 1 non_conforme / 2 N.A. = 75 % | — |
| D8 | mapAuditEnConstats | Chaque non_conforme → 1 constat de bonne sévérité et bon ID | — | Aucun non_conforme → aucun constat critique |

---

## FAMILLE E — Conformité DDA (automatisable, CRITIQUE)

Ces tests sont un filet de sécurité réglementaire. Ils doivent passer sur **tous** les constats produits par **toutes** les combinaisons.

| # | Test | Attendu |
|---|---|---|
| E1 | Regex assureurs interdits sur titre + détail + action de TOUS les constats | 0 occurrence. Liste : AXA, Generali, Apicil, Allianz, CNP, SwissLife/Swiss Life, Aviva, MAAF, Matmut, GAN, MMA, Macif, Groupama, Malakoff, Humanis, AG2R, Harmonie, April, Abeille, Entoria, Kereis, Alptis, Cardif, Prévoir, Gerber, Metlife, Klesia, Probtp, Pro BTP |
| E2 | Regex produits commerciaux génériques sur les actions | Pas de « Pack », « Sérénité », « Confort », « Premium », « Formule » suivis d'une majuscule (nom de gamme) |
| E3 | Toutes les `action` commencent par un verbe d'analyse | « Évaluer », « Vérifier », « Étudier », « Analyser », « Quantifier ». Jamais « Souscrire », « Choisir », « Prendre » |
| E4 | Test génératif E1 sur fuzzing | Produire 200 profils aléatoires, agréger TOUS les constats, vérifier 0 assureur cité |
| E5 | Mentions légales présentes | Chaque page PDF prévoyance contient la mention DDA §13.3 avec ORIAS 25006907 |

> Note : la liste E1 doit être maintenue. L'ajouter dans un fichier `src/lib/prevoyance/__fixtures__/assureurs-interdits.ts` exporté, pour réutilisation dans tous les tests et facilité de mise à jour.

---

## FAMILLE F — Intégration & non-régression (automatisable à 100 %)

| # | Test | Attendu |
|---|---|---|
| F1 | `buildEntreePerso` : payload vide → null | Pas de crash |
| F2 | `buildEntreePerso` : payload P1 complet → EntreePerso valide, tous champs mappés | Vérifier chaque champ |
| F3 | `buildEntreePerso` : pas de dateEmbauche → ancienneteMois = 0 | Défaut sûr |
| F4 | `calcAncienneteMois` : embauche il y a 4 ans → 48 (±1) | Calcul de date correct |
| F5 | `calcAncienneteMois` : date future → 0 (pas négatif) | Garde-fou |
| F6 | Migration : ancien payload sans `travail` ni `prevoyance` → l'app charge sans crash, onglets en état vide | Rétrocompatibilité |
| F7 | Migration : payload `loanCapitalRemaining` legacy (sans `loans[]`) → dettesImmobilieres lues correctement | Fallback legacy |
| F8 | PDF : générer un pack avec les 3 sections cochées → 0 exception, SVG présent dans le HTML | Sentinelle |
| F9 | PDF : 1 seule section cochée → seule celle-ci dans le HTML | Indépendance des toggles |
| F10 | PDF : P2 absent → section P2 non générée, pas de page blanche | Cas P1 seul |
| F11 | Les 524 tests existants restent verts après ajout des nouveaux | Aucune régression |
| F12 | Le chart SVG (`renderProjectionSVG`) produit un SVG valide (parsable) pour les 4 cas d'or | Pas de SVG cassé |

---

## FAMILLE G — Exactitude juridique & chiffrée 2026 (semi-automatisable, validation humaine + sources)

C'est ici que David colle les résultats et que je vérifie chaque chiffre à la source. Ces tests sont écrits en `it.skip`/`it.todo` tant que le référentiel correspondant est `TO_VERIFY`, puis activés au remplissage.

### G1 — Paramètres socle 2026 (vérifiables immédiatement)

| Paramètre | Valeur à tester | Source de vérification |
|---|---|---|
| PASS annuel | 48 060 € | Arrêté 22/12/2025, JORFTEXT000053143451 |
| PMSS | 4 005 € | idem |
| PASS journalier | 220 € | idem (art. D.242-17) |
| SMIC mensuel | 1 823,03 € | au 1/1/2026 |
| IJSS maladie max | 41,95 €/j (arrêts ≥ 1/02/2026) | décret 2025-160, ameli.fr |
| Plafond SJB IJSS | 2 552,24 €/mois (1,4 SMIC) | service-public F3053 |
| IJSS AT/MP max | 240,49 €/j (J1-28), 320,66 €/j (J29+) | éditions Tissot |
| Sanction 1,50 % cadres | 144 180 € (3 PASS) | ANI 2017, prévoyance-collective skill |
| Exonération 6 % PASS | 2 883,60 € | BOSS |
| Plafond exo 12 % PASS | 5 767,20 € | BOSS |
| Forfait social | 8 % prévoyance ≥ 11 sal. | BOSS / URSSAF |

### G2 — Régimes obligatoires par caisse (à activer caisse par caisse)

Pour CHAQUE caisse remplie, tester les valeurs charnières. Exemple structure pour CPAM (à dupliquer) :

```
describe.skip("CPAM 2026 — à activer après remplissage", () => {
  it("carence 3 jours : IJ = 0 sur [J0,J2], > 0 à partir de J3")
  it("IJ plafonnée à 41,95 €/j pour salaire > 2552 €/mois")
  it("IJ proportionnelle pour salaire < 2552 €/mois (50% SJB)")
  it("invalidité cat1 = 30% SAM, plafonnée à 50% PASS mensuel")
  it("invalidité cat2 = 50% SAM")
  it("invalidité cat3 = cat2 + majoration tierce personne")
  it("capital décès = montant forfaitaire 2026 (à vérifier ameli)")
})
```

Caisses à couvrir (par priorité) : **CPAM** (tous salariés), **SSI** (TNS commerçants/artisans), **CARMF** (médecins), **CIPAV** (PL non régl.), **CARPIMKO** (auxiliaires médicaux), puis les 7 autres.

Points de vigilance métier identifiés (à tester explicitement) :
- **CARMF carence 90 jours** : IJ obl = 0 sur [J0, J89], première valeur à J90. C'est LE trou pédagogique.
- **CIPAV ≈ 22 €/j** : niveau très faible, durée limitée (87 j historiquement) — vérifier la durée 2026.
- **SSI plancher/plafond** : IJ entre ~5,63 €/j (plancher bas revenu) et ~64 €/j (plafond 3 PASS).
- **SSI durée maladie 87 j** (hors ALD 360 j) — à vérifier.
- **Capital décès régime général dérisoire** (~3 910 €) vs SSI (9 612 € = 20 % PASS) vs CARMF (71 500 € forfait).

### G3 — Conventions collectives (à activer CCN par CCN)

Pour chaque CCN remplie, tester :
- Carence employeur (0 pour Syntec avec subrogation, 7 j légal sinon)
- Paliers de maintien selon ancienneté (jours à 100 %/90 %, jours à 66 %)
- Taux T1 prévoyance cadres ≥ 1,50 %
- Cohérence avec le maintien légal Mensualisation (la CCN ne peut pas être MOINS favorable)

### G4 — Cohérence inter-référentiels

| # | Test | Attendu |
|---|---|---|
| G4a | Toute CCN du référentiel offre un maintien ≥ maintien légal Mensualisation | Une CCN ne peut pas être sous le plancher légal |
| G4b | Aucune IJ obligatoire ne dépasse le revenu de référence | On ne gagne pas plus en arrêt qu'en activité |
| G4c | Maintien employeur + IJSS ≤ 100 % du net (sauf CCN à 100 %) | Pas de sur-indemnisation |
| G4d | Les plafonds journaliers des caisses sont cohérents entre eux (CIPAV < CARMF, etc.) | Sanity check ordre de grandeur |

---

## FAMILLE H — Cas limites & pièges métier (semi-automatisable)

Cas tordus tirés de l'expérience CGP, à tester explicitement.

| # | Cas | Comportement attendu |
|---|---|---|
| H1 | Multi-statut : salarié + activité libérale accessoire | Le moteur traite un seul statut/caisse (limite v1). Vérifier qu'il ne mélange pas |
| H2 | Cumul emploi-retraite | Statut retraité → projection minimale, pas de maintien |
| H3 | Salarié < 1 an d'ancienneté | Aucun maintien employeur (seuil Mensualisation), IJSS seules |
| H4 | Cadre couvert décès mais pas invalidité (1,50 % = décès only) | La projection invalidité ne doit pas supposer une couverture invalidité collective si non saisie |
| H5 | Conjoint avec revenu = 49 % vs 51 % du P1 | Bascule du flag conjointACharge au seuil exact |
| H6 | Enfant qui passe 18 ans pendant la projection | Pris en compte à la date d'analyse (pas de vieillissement dans la projection) — comportement à documenter |
| H7 | Dirigeant TNS avec DUE (couverture collective de SA PROPRE entreprise) | Vérifier que le TNS est bien exclu du collectif (sauf assimilé salarié) |
| H8 | Président SAS (assimilé salarié) | A accès au collectif → maintien possible si entreprise couvre |
| H9 | Salaire exactement au plafond IJSS (2 552 €/mois) | Pas d'effet de bord au point de bascule plafonné/non plafonné |
| H10 | Invalidité cat3 sans majoration tierce personne renseignée | Ne pas inventer la majoration, signaler donnée manquante |
| H11 | Couverture collective saisie SUPÉRIEURE à 100 % du brut | Borner à 100 %, ne pas afficher un revenu > revenu d'activité |
| H12 | Très haut revenu (300 k€) TNS | Pas d'overflow, plafonds caisses appliqués |
| H13 | Age = 18 (jeune actif) | Projection longue (46 ans d'invalidité), pas de timeout/explosion mémoire |
| H14 | Date d'embauche = aujourd'hui | ancienneté 0, pas de maintien |

---

## Plan de livraison des tests (pour Claude Code)

On procède **famille par famille**, pas tout d'un coup, pour que David puisse me faire valider les résultats par paliers.

| Lot test | Familles | Automatisable seul ? | Validation |
|---|---|---|---|
| T1 | A (invariants) + B (cohérence math) | Oui, 100 % | Claude Code livre, David colle, je vérifie la logique |
| T2 | C (règles) + D (conformité collective) | Oui, 100 % | idem |
| T3 | E (DDA) + F (intégration) | Oui, 100 % | idem |
| T4 | G1 (socle 2026) | Oui mais valeurs à vérifier | **Je vérifie chaque chiffre à la source** |
| T5 | G2/G3/G4 (caisses + CCN) | Partiellement (it.skip tant que TO_VERIFY) | Au fil du remplissage |
| T6 | H (cas limites) | Oui pour la logique | Je vérifie la pertinence métier |

Critère « fait » par lot test : tests verts (ou it.skip documentés pour G), commit séparé, récap des valeurs attendues que je dois vérifier.

---

## Ce que David colle à Claude pour validation

Après chaque lot test, le récap doit inclure, pour les tests à valeur chiffrée :
- La valeur **attendue** codée dans le test
- La valeur **produite** par le moteur
- La **source** présumée (si Claude Code en a une)

Ainsi je peux croiser chaque chiffre avec BOSS / ameli / Légifrance / sites caisses et confirmer ou corriger avant qu'on fige.

---

*Plan rédigé le 28 mai 2026. À déposer dans le repo Ploutos sous docs/PLAN_TESTS_PREVOYANCE.md.*
