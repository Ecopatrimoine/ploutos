# SPEC PRÉVOYANCE — LOT CARPIMKO (caisse 3/3 des libérales)

> Valeurs 2026 vérifiées : IJ + cotisation sur les pages officielles
> carpimko.com (consultées 29/05/2026) ; invalidité/décès/rentes recoupées sur
> 4+ agrégateurs spécialisés concordants (APICIL, MetLife, CapMedical, philtr,
> caduceeconseil) car les pages officielles CARPIMKO (CMS DNN) renvoient un HTML
> saturé par le menu. Tous les montants recoupés au centime, y compris l'exemple
> chiffré APICIL. Bloc : `bloc-carpimko-2026.json`.

---

## 0. La spécificité CARPIMKO — tout est FORFAITAIRE

Différence majeure avec les deux autres caisses libérales :
- **CARMF** : IJ liées au revenu (1/730e du BNC).
- **CIPAV** : prestations proportionnelles par points.
- **CARPIMKO** : **prestations FORFAITAIRES**, identiques quel que soit le revenu.
  Le revenu n'intervient QUE dans la phase 1 CPAM (J4-J90).

Architecture (proche CARMF — relais propre à J91) :

| Phase | Bornes | Régime | Montant |
|---|---|---|---|
| 1 | J4 → J90 | CPAM libéraux | 1/730e RAAM, plafond 197,51 €/j (lié au revenu) |
| 2 | J91 → fin 3e année | Allocation journalière CARPIMKO | **55,44 €/j forfaitaire** |
| 3 | début 4e année → ... | Rente invalidité CARPIMKO | **forfaitaire** (10 080 / 20 160 €/an) |

---

## 1. Phase 1 — IJ CPAM libéraux (J4-J90)

Identique CARMF/CIPAV. Réutiliser le bloc CPAM libéraux. Paramètres 2026 :
carence 3 j, J4→J90 (87 IJ max), `IJ = RAAM/730`, plafond RAAM 144 180 €,
IJ max 197,51 €/j, plancher 26,33 €/j. Revenu de référence **N-2** (cohérence
module). C'est la SEULE phase où le revenu du client joue.

---

## 2. Phase 2 — Allocation journalière CARPIMKO (J91 → fin 3e année)

```
IJ_carpimko_base = 55,44 €/j   (FORFAITAIRE, indépendant du revenu)
+ 8,06 €/j   par descendant à charge
+ 20,16 €/j  si tierce personne nécessaire
```
- Début : **J91** (carence de 90 j d'arrêt total).
- Fin : **dernier jour de la 3e année d'incapacité** (≈ J1095).
- **Majoration conjoint à charge SUPPRIMÉE au 01/01/2025** → NE PAS l'inclure.
- Conditions : demande dans les 6 mois, à jour de toutes cotisations CARPIMKO.

> **TO_VERIFY (H5)** : la durée exacte diverge selon les sources secondaires
> (1095 vs 1005 j). La page officielle dit « fin de la 3e année ». Retenu : fin
> de la 3e année (≈ J1095). À confirmer au jour près.

---

## 3. Phase 3 — Rente d'invalidité CARPIMKO (forfaitaire)

Débute **au 1er jour de la 4e année** suivant l'incapacité (succède à
l'allocation journalière).

```
Invalidité partielle (taux 66-99%) : 10 080 €/an  (840 €/mois)
Invalidité totale    (taux 100%)   : 20 160 €/an  (1 680 €/mois)
Sous 66%                            : 0 € (vide de couverture)
```
Majorations sur invalidité **totale** :
```
+ 6 048 €/an  tierce personne
+ 3 024 €/an  par enfant à charge
```
> **TO_VERIFY (H4)** : divergence sources sur la majoration enfant (3 024 vs
> 6 048 €/an). Retenu provisoirement : tierce personne 6 048 €/an, enfant
> 3 024 €/an. À confirmer (page invalidité officielle illisible via fetch).

---

## 4. Capital décès (forfaitaire)

```
36 288 €  conjoint/PACS sans descendant à charge
54 432 €  conjoint/PACS avec un ou plusieurs descendants à charge
18 144 €  ascendant ou descendant, sans ayant droit à charge
```
Garanties décès étendues aux couples PACSés depuis juillet 2024.

---

## 5. Rentes de survie (forfaitaires)

```
Rente conjoint   : 10 080 €/an   (2 520 €/trimestre)
Rente éducation  :  7 560 €/an PAR enfant  (1 890 €/trimestre)
```
> **TO_VERIFY (H7)** : borne d'âge rente éducation (18/21 ans, 25 si études)
> selon sources. À confirmer.

---

## 6. Cas d'or proposés

### Cas G — IDEL (infirmière) type
- Profil : infirmière libérale, 40 ans, revenu 45 000 €, mariée, 1 enfant, 12 ans
  d'affiliation.
- Phase 1 (J4-J90) : IJ CPAM = 45 000/730 = **61,64 €/j** (~1 849 €/mois, ~49 %).
- Phase 2 (J91→3 ans) : 55,44 + 8,06 (1 enfant) = **63,50 €/j** (~1 905 €/mois) —
  forfaitaire, ne dépend plus du revenu. Chute nette pour un bon revenu.
- Phase 3 (invalidité totale) : 20 160 + 3 024 (1 enfant) = **23 184 €/an**
  (~1 932 €/mois, ~51 % du revenu).

### Cas G-haut-revenu — l'effet forfait
- Profil : kiné, revenu 90 000 €.
- Phase 1 : IJ CPAM = 90 000/730 = **123,29 €/j** (~3 699 €/mois).
- Phase 2 : **55,44 €/j** (~1 663 €/mois) → chute de ~55 %. Le forfait CARPIMKO
  pénalise fortement les hauts revenus : c'est LE constat de conseil.

### Cas G-modeste — le forfait protège
- Profil : orthophoniste, revenu 25 000 €.
- Phase 1 : IJ CPAM = 25 000/730 = **34,25 €/j**.
- Phase 2 : **55,44 €/j** → la prestation forfaitaire est SUPÉRIEURE à la phase 1.
  Cas où le forfait joue en faveur du client modeste.

> Montants = projections issues des formules vérifiées, à figer comme cas de test
> après implémentation.

---

## 7. Hypothèses (reprises du bloc, à valider)

1. **H1** — Phase 1 = bloc CPAM libéraux réutilisé (identique CARMF/CIPAV).
2. **H2** — Phase 2 forfait 55,44 €/j + majorations descendant 8,06 / tierce
   20,16 ; conjoint supprimé (01/01/2025).
3. **H3** — Phase 3 invalidité 10 080 / 20 160 / 0 selon taux, début 4e année.
4. **H4 — TO_VERIFY** : majoration enfant invalidité (3 024 vs 6 048).
5. **H5 — TO_VERIFY** : durée IJ phase 2 (fin 3e année ≈ 1095 vs 1005 j).
6. **H6** — capital décès 36 288 / 54 432 / 18 144.
7. **H7 — TO_VERIFY** : rente conjoint 10 080, éducation 7 560/enfant, borne d'âge.
8. **H8** — revenu N-2 (phase 1 CPAM uniquement ; le reste est forfaitaire).
9. **H9 — TO_VERIFY** : conjoint collaborateur CARPIMKO (statut existant, droits
   prévoyance non détaillés ; ne pas implémenter sans vérif).

---

## 8. Discipline d'intégration

- Branche CARPIMKO dédiée (comme CARMF/CIPAV) → zéro régression sur l'existant.
- Un commit séparé : `feat(prevoyance): integration referentiel CARPIMKO`
  (pas de Co-Authored-By, pas de push, release 1.4.0 différée).
- Build OK + tous les tests verts (746 actuels + ~25-30 CARPIMKO).
- `TO_VERIFY` + `it.skip` pour H4, H5, H7, H9.
- UI : réutiliser le squelette CARMF-UI/CIPAV (section « Activité CARPIMKO »,
  champ profession, garde-fous inline). Comme les prestations sont forfaitaires,
  le formulaire CARPIMKO est plus simple : pas de champ revenu pour les
  prestations (sauf revenu N-2 pour la phase 1 CPAM), mais cases descendants à
  charge / tierce personne / taux d'invalidité.
- Correctif ALD (comme CIPAV) : vérifier que `donneesIndisponibles` ignore le
  stub CARPIMKO.
- Bloc + spec dans `docs/`.
- STOP + récap attendu/produit/source + hypothèses. David fait la revue visuelle.

---

## 9. Après ce lot — les 3 caisses seront complètes

Une fois CARPIMKO clos, le triptyque libéral (CARMF / CIPAV / CARPIMKO) est
terminé. Restent :
- **Checklist de vérification source unique** (tous les TO_VERIFY accumulés
  CARMF + CIPAV + CARPIMKO) à lever en un appel groupé avant release.
- **LOT UI-PEDAGO** (niveaux 3+4 : vue RDV, pédagogie).
- **LOT POLISH-UI** (niveau 5).
- **Release 1.4.0** (push des commits accumulés).
