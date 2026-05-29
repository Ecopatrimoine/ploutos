# SPEC PRÉVOYANCE — LOT CIPAV (caisse 2/3 des libérales)

> Toutes les valeurs 2026 vérifiées à la source officielle lacipav.fr (pages
> pension-invalidite, capital-deces, rente-conjoint-enfant) et ameli.fr (IJ
> profession libérale), consultées le 29/05/2026. Les 4 formules ont été
> recalculées et reproduisent les exemples officiels CIPAV au centime près.
> Bloc de données : `bloc-cipav-2026.json`.

---

## 0. Le point le plus important — l'architecture DIFFÈRE de la CARMF

La CARMF a un régime d'IJ **propre** qui prend le relais de J91 à J1095.
**La CIPAV n'a PAS de relais IJ.** Trois phases :

| Phase | Bornes | Régime | Montant |
|---|---|---|---|
| 1 | J4 → J90 | CPAM libéraux | 1/730e RAAM, plafond 197,51 €/j |
| 2 | J91 → reconnaissance invalidité | **AUCUN** | **0 € (le trou)** |
| 3 | invalidité → 62 ans | Pension invalidité CIPAV | forfait + proportionnel |

**Conséquence moteur** : après J90, la courbe IJ CIPAV tombe à zéro et y reste
jusqu'à la bascule invalidité. C'est le constat de sous-couverture central en RDV
(bien plus violent que la CARMF). On ne « remplit » ce trou que par les garanties
individuelles Madelin du client (déjà gérées par le moteur).

**La phase 1 est IDENTIQUE au dispositif J4-J90 de la CARMF** (même barème CPAM
libéraux commun 2021). → Réutiliser le bloc CPAM libéraux déjà codé, ne pas le
redévelopper.

---

## 1. Phase 1 — IJ CPAM libéraux (J4-J90)

Identique à la phase J4-J90 CARMF. Rappel des paramètres 2026 :

- Délai de carence : 3 jours, 1er jour indemnisé = J4, dernier = J90 (87 IJ max
  pour un arrêt continu).
- Formule : `IJ = RAAM / 730` (RAAM = revenu d'activité annuel moyen des 3
  dernières années civiles).
- Plafond RAAM : 144 180 € (3 × PASS 2026).
- IJ max : **197,51 €/jour**. IJ min (plancher) : **26,33 €/jour** (sauf
  micro-entrepreneurs, pas de plancher).
- Éligibilité : revenu annuel ≥ 10 % PASS (≈ 4 806 € en 2026) + affiliation ≥ 1 an.

> Le plafond « 360 IJ sur 3 ans glissants » ne concerne que le cumul de plusieurs
> arrêts NON consécutifs. En projection mono-arrêt continu, seul le plafond 87 j
> s'applique. **Ne pas implémenter le 360/3 ans** (hors périmètre, documenté).

---

## 2. Phase 3 — Pension d'invalidité CIPAV

Réforme 2023 : fin des classes A-H, place au **forfaitaire + proportionnel par
points**. Mécanique de points commune à toutes les prestations invalidité-décès.

### Socle commun « points prévoyance »
```
cotisation_inv_deces = revenu_N1 × 0,005          (0,50 % du revenu)
points               = cotisation_inv_deces / 0,013   (valeur d'achat du point)
```
Valeur de service du point : **3,01 €** (2026).

### Invalidité totale (taux 100 %)
```
forfait_annuel      = 0,05 × PASS = 2 403 €
proportionnel_annuel = (points / 3) × 3,01
pension_totale_annuelle = 2 403 + (points / 3) × 3,01
```
Versée **jusqu'à 62 ans**, puis bascule retraite pour inaptitude.

### Invalidité partielle (taux 66 % à 99 %)
```
pension_partielle = pension_totale_annuelle × (taux / 100)
```
Versée jusqu'à liquidation retraite ou 67 ans.

> **Coquille source signalée** : la page CIPAV écrit dans son exemple partiel
> `(7 717,94 + 2 355)` — le 2 355 est une erreur de leur page. Le bon forfait est
> **2 403 €** (5 % PASS), et c'est bien 2 403 qui redonne leur résultat officiel
> 8 096,75 €. On retient 2 403.

### Seuil d'invalidité
- < 66 % : pas de pension.
- 66 % à 99 % : partielle.
- 100 % : totale.

---

## 3. Capital décès CIPAV

```
forfait        = 0,15 × PASS = 7 209 €
proportionnel  = points × 3,01            (points ENTIERS, pas de division)
capital        = 7 209 + points × 3,01
```
Majoration décès accidentel : **+5 000 points** avant multiplication par 3,01.
Exonéré d'impôt et de prélèvements sociaux, versé en une fois.

> Noter la différence de diviseur entre prestations :
> invalidité = points **/3**, rentes = points **/10**, capital décès = points
> **entiers**. Même socle de points, diviseurs différents.

---

## 4. Rentes conjoint et enfant CIPAV

**Même formule pour les deux** (forfait 1,5 % PASS + 1/10 des points) :
```
forfait_annuel      = 0,015 × PASS = 720,90 €
proportionnel_annuel = (points / 10) × 3,01
rente_annuelle      = 720,90 + (points / 10) × 3,01
```
- Rente conjoint : conjoint marié ou PACS, jusqu'à sa retraite ou remariage.
- Rente enfant : **par enfant**, jusqu'à 21 ans (25 si études), à vie si
  infirmité permanente. Chaque enfant perçoit le montant plein indépendamment.

---

## 5. Conjoint collaborateur

**NON documenté** sur les pages prévoyance CIPAV (contrairement à la CARMF).
→ Par défaut, **ne pas proposer l'option conjoint collaborateur** côté CIPAV tant
que ce n'est pas confirmé à la source. Marqué `_aVerifier` dans le bloc.

---

## 6. Cas d'or proposés (à valider par David)

### Cas F — Architecte CIPAV, le trou type
- Profil : architecte, 45 ans, revenu BNC 60 000 €, marié, 2 enfants, affilié 15 ans.
- Phase 1 (J4-J90) : IJ CPAM = 60 000 / 730 = **82,19 €/j** ≈ 2 466 €/mois (~49 %
  du revenu).
- Phase 2 (J91+) : **0 €** → chute brutale. LE constat choc.
- Invalidité totale : cotisation 300 €, points 23 077 → forfait 2 403 +
  (23 077/3 × 3,01) = 2 403 + 23 154 = **25 557 €/an** ≈ 2 130 €/mois (~43 % du revenu).

### Cas F-jeune — Affiliation < 1 an
- Profil : ostéopathe, 28 ans, installé depuis 8 mois.
- Condition d'affiliation 1 an non remplie → **pas d'IJ CPAM**. Trou total dès J4.
- Le cas critique de conseil pour jeunes installés (équivalent CIPAV du cas E-jeune CARMF).

### Cas F-modeste — Plancher IJ
- Profil : psychologue, revenu 15 000 € (< plancher).
- IJ CPAM = max(15 000/730 ; 26,33) = max(20,55 ; 26,33) = **26,33 €/j** (plancher activé).

> Les 3 montants ci-dessus sont des **projections de calcul** issues des formules
> vérifiées, pas des valeurs publiées par la CIPAV pour ces profils précis. À
> recalculer/figer comme cas de test une fois l'implémentation faite.

---

## 7. Hypothèses à valider (reprises du bloc JSON)

1. **H1** — Phase 2 = chute à 0 (le trou). ✅ déjà validé par David.
2. **H2** — Réutilisation du bloc CPAM libéraux J4-J90 existant. À confirmer
   côté code que le bloc est factorisable (CARMF/CIPAV partagent la phase 1).
3. **H3** — Coquille 2 355 → on retient 2 403 € (vérifié arithmétiquement).
4. **H4** — Seuil éligibilité recalculé 4 806 € (10 % PASS 2026) vs 4 113 €
   (newsletter 2021).
5. **H5** — Conjoint collaborateur CIPAV non implémenté (`_aVerifier`).
6. **H6** — Revenu de référence prestations invalidité-décès = revenu **N-1**
   (« l'année avant le décès/l'invalidité » selon la CIPAV), à distinguer du **N-2**
   utilisé pour les IJ CARMF. À confirmer côté moteur quel champ revenu est branché.
7. **H7** — v1 : prioriser l'**invalidité totale** (cas le plus parlant en RDV) ;
   invalidité partielle (66-99 %) en option, cutoff 67 ans.

---

## 8. Discipline d'intégration (rappel)

- Bloc + spec préparés côté Claude conv. (sourcés), intégration côté Claude Code.
- Un seul commit séparé : `feat(prevoyance): integration referentiel CIPAV`.
- Build OK + tous les tests verts (717 existants + nouveaux CIPAV, ~25 attendus).
- Pas de Co-Authored-By. Pas de push (release 1.4.0 différée).
- `TO_VERIFY` + `it.skip` pour tout ce qui reste `_aVerifier` (H5, H6 si doute).
- Charte navy/gold, réutilisation du squelette UI CARMF (LOT CARMF-UI) pour les
  champs CIPAV.
- STOP + récap attendu/produit/source + liste des hypothèses.
