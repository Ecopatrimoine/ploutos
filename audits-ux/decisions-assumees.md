# Décisions assumées — couche présentation

**2026-07-10** · complément à `RAPPORT-UX-Ploutos.md` (2026-07-07) et `findings-2026-07-10.json`

Une *décision assumée* (DA) est un écart délibéré à une règle générale (ergonomie, sobriété,
accessibilité) que l'on choisit de conserver, avec sa raison. Elle n'est pas un constat en attente :
elle sort du périmètre de remédiation. Toute DA est révocable, mais son coût doit être re-payé.

> **Statut d'ancrage** : chaque DA indique si elle est *ancrée* (rattachée à du code identifié)
> ou *déclarative* (posée par David, sans point d'ancrage retrouvé lors de cette passe).

---

## DA-1 · Les points MIF2 restent visibles

**Décision.** Les mentions réglementaires MIF2 restent affichées dans les livrables clients,
même quand elles alourdissent la page.

**Pourquoi.** Ploutos produit des documents opposables. Ces mentions ne sont pas de l'ornement
informatif : elles matérialisent le devoir de conseil. Les masquer derrière un dépliant ou une
note de bas de page ferait porter au CGP le risque d'une information réputée non délivrée.
La densité est le prix de la conformité.

**Ce qu'on renonce à faire.** Réduire la charge informationnelle de ces blocs (grief §7
« densité »), les replier, ou les déplacer en annexe.

**Ancrage.** `src/lib/pdf/v2/pages/pageCabinet.ts`, `src/lib/pdf/v2/adapters/buildCabinetData.ts`.

**Révocation.** Uniquement sur avis de conformité (skill `conformite-cgp`), pas sur un motif
esthétique.

---

## DA-2 · Périmètre restreint des KPI héritiers

**Décision.** Les cartes-clés de l'écran Succession n'exposent qu'un sous-ensemble d'indicateurs
par héritier, et non l'intégralité de la dévolution calculée par le moteur.

**Pourquoi.** Le moteur successoral produit davantage de grandeurs que ce qu'un écran peut porter
sans devenir un tableur. Le choix est de garder l'écran comme une *lecture*, et de renvoyer
l'exhaustivité au PDF, qui est le document de référence. Un KPI de plus à l'écran, c'est un chiffre
de plus à défendre en rendez-vous sans le contexte qui l'accompagne dans le rapport.

**Ce qu'on renonce à faire.** Aligner un pour un les KPI écran sur les blocs du PDF.

**Ancrage.** *Déclarative* — je n'ai pas retrouvé, dans cette passe, le point de code qui matérialise
la restriction (aucun marqueur explicite dans `TabSuccession.tsx`). À rattacher.

**Conséquence à tenir.** Cette DA ne dispense pas de la cohérence *des chiffres communs* :
un montant présent des deux côtés doit être identique. C'est précisément l'objet du lot 11
(cohérence écran↔PDF). La DA porte sur le **périmètre**, jamais sur la **valeur**.

---

## DA-3 · Axe temporel à deux niveaux

**Décision.** L'axe des temps des projections de prévoyance n'est pas linéaire : il est compressé
par paliers, avec une graduation à deux niveaux (jalons de rupture + échéances lisibles).

**Pourquoi.** Une projection va de J+0 à la retraite. En linéaire, les premières semaines — là où
se jouent la franchise, les indemnités journalières, le passage en invalidité — sont écrasées à
quelques pixels, alors que ce sont les ruptures que le client doit voir. La compression par paliers
rend le graphe fidèle à la *structure* du risque plutôt qu'à la durée calendaire.

**Ce qu'on renonce à faire.** La lecture proportionnelle des durées : deux segments de même largeur
à l'écran ne représentent pas la même durée. C'est un écart assumé à une convention de dataviz,
qui **doit** rester signalé par la graduation.

**Ancrage.** `src/lib/presentation/echelleTemps.ts` (`compress`, `axeTemps`, `TickTemps`) —
source unique, consommée par `ProjectionChart.tsx:35,173,193` **et** par le PDF (`ticksPdf`,
lot 11 G5-E). Le fait que l'écran et le PDF partagent la même échelle est ce qui rend la DA tenable.

**Révocation.** Impossible sans revoir conjointement l'écran et le PDF : l'échelle est partagée.

---

## DA-4 · Notes de lecture conservées

**Décision.** Les notes de lecture (commentaires explicatifs accompagnant un tableau ou un graphe)
sont conservées dans les livrables, malgré le grief de densité.

**Pourquoi.** Un chiffre fiscal sans sa note se lit mal et se cite mal. La note est ce qui distingue
un rapport de CGP d'un export de tableur : elle porte l'hypothèse, le barème appliqué, la date de
valeur. La retirer allégerait la page en transférant la charge sur la mémoire du conseiller.

**Ce qu'on renonce à faire.** Le gain de densité visé au §7 du rapport sur ces blocs.

**Ancrage.** *Déclarative* — aucun identifiant `noteLecture` / `note de lecture` retrouvé dans `src/`
lors de cette passe. Soit la notion porte un autre nom dans le code, soit elle est diffuse dans les
gabarits PDF. À rattacher avant de pouvoir la défendre en revue.

---

## Ce que ces DA ne couvrent pas

Aucune de ces quatre décisions ne justifie les constats **ouverts** de `findings-2026-07-10.json`.
En particulier, aucune DA ne couvre :

- l'échec de contraste AA du `gold` sur un **montant** (`TabPlacements.tsx:623`) ;
- la troncature silencieuse des montants (`shared.tsx:108`) ;
- l'absence d'état d'erreur de saisie (`shared.tsx`, `MoneyField`) ;
- les palettes non color-blind-safe (`constants:408-410`).

Densité assumée et accessibilité dégradée sont deux choses différentes. Les DA autorisent la
première ; elles ne rachètent pas la seconde.
