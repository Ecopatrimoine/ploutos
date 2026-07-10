# Revue UX/UI — Ploutos
**Audit de la couche présentation** · 2026-07-07 · skill `revue-ui`

> Périmètre : 69 fichiers de présentation (`src/components/**`, `src/App.tsx`, CSS globaux, `src/constants/index.ts`).
> Méthode : mesure automatisée (inventaire + audit WCAG/homogénéité) **puis** lecture manuelle experte de tous les écrans, grille Bastien & Scapin + Nielsen + WCAG 2.2, pondérée par la criticité (Casey — outil fiscal à enjeu).
> Aucune correction n'a été appliquée. Ce rapport est fait pour être validé **lot par lot** (voir §7). Rien ne touche la logique métier (calculs, règles fiscales).

---

## 1. Score et verdict

| Pilier | Score outil | Lecture corrigée |
|---|---|---|
| Contraste | 100 | **~85** — palette de fond saine, mais `gold` sert de texte (échec AA) et du `slate-400` sert de texte courant (sous AA) à ~40 endroits. Le « 100 » ne portait que sur 1 paire résoluble. |
| Daltonisme | 0 | **~55** — le 0 est un artefact (l'outil compare *toutes* les couleurs 2 à 2, même jamais côte à côte). Vrais problèmes bornés : graphiques (§5) et feu tricolore sans libellé. |
| Guidage | 100 | **~70** — en-têtes d'écran incohérents, hiérarchie typographique plate, jargon dev exposé. |
| Homogénéité | 66 | **~66** — un vrai système de jetons existe (`BRAND`/`FIELD`) mais Tailwind n'est pas câblé et beaucoup de couleurs/composants le court-circuitent. |
| Gestion erreurs | 100 | **~55** — champs de saisie sans état d'erreur visuel dans un calculateur fiscal ; échecs réseau silencieux. |
| Charge | 88 | **~80** — quelques écrans très denses (bien immobilier, ligne enfant). |

**Global : ~81/100 (outil) → lecture experte ~68/100.** Bon socle graphique et identité soignée, mais des **failles d'accessibilité (contraste, clavier, daltonisme)** et un **manque d'homogénéité** qui, sur un outil manipulant des montants, méritent une passe ciblée.

> **Le socle est bon** : palette réfléchie, ratios documentés dans `constants`, jetons `FIELD` centralisés et miroir CSS, focus clavier soigné sur les champs. Les constats ci-dessous corrigent des écarts, ils ne remettent pas en cause la direction artistique.

---

## 2. Ce qu'on a bien lu (modèle d'interface)

- **Forme** : React + TypeScript + Tailwind (+ Radix/shadcn). Calculateur fiscal & prévoyance pour CGP.
- **Système de couleurs** : mature, dans `src/constants/index.ts` — `BRAND` (navy/gold/sky/blue + sémantiques success/danger/warning avec ratios documentés), `FIELD` (champs, miroir CSS dans `index.css`), `SURFACE`, palettes de graphiques.
- **Signaux d'interaction** : 156 boutons, 214 champs, focus clavier chartré **sur les champs** (anneau or, `index.css:45`), onglet actif chartré (dégradé or, `index.css:94`).
- **Criticité** : 936 indices de contexte à enjeu (euro, capital, calcul, impôt…) → toute faille de saisie/signifiance pèse plus lourd.
- **Homogénéité mesurée** : 49 fichiers référencent bien les jetons `BRAND`/`FIELD`, mais **304 lignes de hex en dur** subsistent dans les composants et le thème Tailwind est vide (`theme.extend:{}`).

---

## 3. Constats CRITIQUES et MAJEURS-HAUTS (à traiter en priorité)

> Sévérité 4 = bloque l'usage ou risque d'erreur à conséquence (montants, accessibilité légale) ; 3 = entrave une tâche.

### 3.1 · [4] `gold` (#C4973D) utilisé comme couleur de texte → échec de contraste AA
`#C4973D` = **2,68:1 sur blanc** (échec même pour du grand texte). Or il est utilisé en **couleur de texte et de montant** : montant € `TabPlacements.tsx:587`, en-tête `TabIFI.tsx:80`, libellés `TabRevenus.tsx:142/251/325/405`, `TabImmobilier.tsx:584`. Le jeton `goldText` (#8B6914, **5,09:1**) existe précisément pour ça et le commentaire de `constants` interdit déjà `gold` en texte.
**Correction** : remplacer `color: BRAND.gold` → `BRAND.goldText` **là où le fond est clair** (à vérifier par site : sur fond navy, `gold` reste correct). Présentation pure, sans risque.

### 3.2 · [4] Champs de saisie sans état d'erreur visuel
`MoneyField` (`shared.tsx:80-88`) ne montre **aucune erreur** (pas de bordure rouge, pas de message, pas de `aria-invalid`) sur une saisie non numérique, vide ou aberrante. Sur un calculateur fiscal, une valeur mal saisie fausse tout en silence. Idem âge hors bornes `TabRevenus.tsx:478`.
**Correction** : état visuel d'erreur (bordure `BRAND.danger` + micro-message). ⚠️ *Touche la validation de saisie → à faire sous la discipline `revue-code`, pas en pure présentation.*

### 3.3 · [4] Montants tronqués en silence dans les cartes-clés
`MetricCard` (`shared.tsx:107`) rend la valeur en `nowrap + overflow:hidden + text-overflow:ellipsis` : un montant à 7 chiffres (IR, actif successoral) peut être **coupé sans avertissement**.
**Correction** : pas d'ellipsis sur les montants (réduction dynamique de la taille plutôt qu'une troncature).

### 3.4 · [3→4] Menu déroulant Select sans fond + options sans surlignage
Le thème Tailwind est vide et **aucun token shadcn** (`--popover`, `--accent`, `--muted`, `--ring`) n'est défini → les classes de `select.tsx` sont **inertes** :
- `bg-popover` (`select.tsx:66`) → le panneau déroulant n'a **pas de fond opaque** (se superpose au contenu).
- `focus:bg-accent` (`select.tsx:120`) → l'option **survolée ou naviguée au clavier n'est pas surlignée**. Sur un choix fiscal (« Micro-foncier 30 % » vs « Régime réel »), le risque de cliquer la mauvaise ligne est réel → criticité +1.
- `bg-muted` (`select.tsx:141`) → séparateur d'options invisible.
**Correction** : fond explicite `SURFACE.card`/blanc sur `SelectContent`, `focus:bg-[#F6F4EF]` sur `SelectItem`. *(À confirmer visuellement dans l'app en marche.)*

### 3.5 · [3] Graphique prévoyance : 9 séries, 5 couleurs, 2 paires identiques
`ProjectionChart.tsx:287-294` — deux séries strictement identiques (`#A9B8D4`, même opacité) l.288/291 ; deux autres identiques (`#B5806B`) l.289/292 ; un **navy triplé** distingué par la seule opacité (0.9/0.7/0.45) l.287/290/294, alors que la légende Recharts rend l'icône à pleine opacité → **plusieurs pastilles jumelles**, illisibles pour tout le monde.
**Correction** : teintes franchement distinctes ou motifs (hachures/bordure) ; réserver le gold aux marqueurs d'événement (double sens actuel, l.50/254).

### 3.6 · [3] Chiffres financiers pastel illisibles (graphe risque)
`TabMission.tsx:126,152` — « +20 % » / « −13 % » peints avec la couleur pastel de la barre sur fond blanc : `#fbbf24` ≈ **1,7:1**, `#34d399` ≈ 1,8:1. Des chiffres de rendement quasi invisibles.
**Correction** : chiffres en navy/foncé, pastel réservé à la barre. Relever aussi les états inactifs `#aaa/#999` (~2,3:1) à un gris AA.

### 3.7 · [3] Actions clés inatteignables au clavier
- « Charger un dossier » = `<label>` autour d'un `<input type=file class="hidden">` → hors ordre de tabulation (`AppHeader.tsx:221-233`).
- Aide « ? » en `tabIndex={-1}`, infobulle au hover seul → contenu explicatif inatteignable clavier/tactile (`shared.tsx:33`).
- Cartes héritier + KPI « Actif net » = `div onClick` sans `role`/`tabIndex`/`onKeyDown` → détail successoral inaccessible clavier (`TabSuccession.tsx:527, 495-499`).
**Correction** : déclencheurs focusables (`sr-only` au lieu de `hidden`), gestion `onKeyDown`, `role="button"`/`tabIndex`.

---

## 4. Constats MAJEURS (sévérité 3)

| # | Fichier:ligne | Dimension | Constat | Correction |
|---|---|---|---|---|
| M1 | `TableauJalons.tsx:79-85` | Daltonisme | Statut par feu **rouge-vert** sur le seul chiffre `%` (pire cas protan/deutan), sans libellé | Doubler d'un mot/picto (« insuffisant / à surveiller / suffisant ») |
| M2 | `constants:396-398` | Daltonisme | Palettes de graphiques 8 séries : **2 paires confondues** par palette en deutan/protan (bleus clairs, ocres clairs) → ~6 séries perçues (voir §5) | Écarter les luminosités + double-encodage (libellés directs/motifs) |
| M3 | `TabImmobilier:87`, `TabRevenus:64`, `TabHypotheses` | Cohérence/Guidage | En-tête d'écran incohérent : `SectionTitle` riche (IR, Familiale) vs `<h3>` nu (Immo/Placements) vs **aucun titre** (Revenus ouvre sur des KPI sans contexte) | Un patron d'en-tête unique sur les 7 onglets |
| M4 | `TabHypotheses:454`, `HelpMenu:241-341`, `TabMission:616`, `TabSuccession:323` | Cohérence/Contrôle | Modales et champs **hors design system** : DonationModal en HTML natif, HelpMenu = overlay maison (pas d'Échap, pas de piège de focus, pas de `role=dialog`), `<input>` bruts | Composants partagés `Dialog`/`Input`/`Select` |
| M5 | `TabParametres:73-75,239,322,358,375` | Guidage/Signifiance | **Jargon dev exposé au CGP** : « clé renommée », « legacy `remuneration` … rétrocompat builders », noms de clés en `<code>` | Retirer ou déplacer hors de la vue utilisateur |
| M6 | `TabIR:307,474,519,562` | Hiérarchie | Tous les titres de section au **même style** (`text-xs uppercase tracking-widest`) : aucun niveau visuel entre sections et sous-blocs | 2 niveaux typographiques distincts |
| M7 | `TabImmobilier:186-796` | Densité/Groupement | La carte d'un bien empile identité + fiscalité + valeurs + démembrement + meublé + crédits + indivision **sans intertitres** | Sous-sections titrées/séparées |
| M8 | `HelpMenu:323-336` | Erreurs | Bouton « Envoyer » `disabled` mais **au style actif** (dégradé plein, `cursor:pointer`) → paraît cliquable | Style désactivé visible (opacité/gris + `not-allowed`) |
| M9 | `button.tsx:10` | Guidage/Homogénéité | CTA sans `:hover` effectif ni **focus chartré** (retombe sur l'anneau natif du navigateur, incohérent avec l'anneau or des champs) | `hover` + `focus-visible:ring` or par variante |

---

## 5. Analyse daltonisme des graphiques (détail vérifié)

Simulation Viénot 1999 (protanopie/deutéranopie) sur les palettes réellement utilisées **ensemble** dans une légende. Résultat : chaque palette de 8 couleurs a **exactement 2 paires confondues** → un graphique à 8 séries n'en montre que **~6 distinctes** pour ~8 % des hommes.

| Palette | Paires qui se confondent (deutan/protan) |
|---|---|
| `CHART_COLORS` | `#A0B4E8`≈`#8CA2F0` (périwinkles clairs) · `#D4A96A`≈`#C8956E` (ocres) |
| `RECEIVED_COLORS` | `#6B8DD6`≈`#7D95E8` · `#D4A96A`≈`#C8956E` |
| `LEGUE_COLORS` | `#A0B4E8`≈`#8CA2F0` · `#D4A96A`≈`#C8956E` |

**Correction** (déléguée à `contraste-wcag`/`harmonie-couleurs`) : recomposer 6–8 teintes à luminosités échelonnées et color-blind-safe, **et** ne jamais coder une série par la couleur seule (libellés directs sur le graphe, motifs, ou marqueurs distincts). C'est la vraie distillation des 477 « collisions » remontées par l'outil.

---

## 6. Contraste — table de vérification

| Paire | Ratio | Verdict | Note |
|---|---|---|---|
| navy `#0F172A` / parchemin `#F0EDE6` | 15,3:1 | AAA | ✅ excellent (texte principal) |
| `field-text` / `field-fill` | 16,2:1 | AAA | ✅ champs |
| `goldText` #8B6914 / blanc | 5,09:1 | AA | ✅ conforme à l'annonce |
| `muted` #637896 / blanc | 4,51:1 | AA | ✅ texte secondaire |
| navy / onglet actif (gold gradient) | 6,7 → 4,5:1 | AA | ✅ sur toute la plage du dégradé |
| `danger`/`warning`/`success` sur leur fond teinté | 5,9 / 6,8 / 6,8:1 | AA | ⚠️ **pas AAA** — `constants` annonce 7,1–7,5 (valables sur *blanc*, pas sur le fond teinté réel) |
| **`gold` #C4973D / blanc** | **2,68:1** | **ÉCHEC** | ❌ ne jamais utiliser en texte (cf. §3.1) |
| `#94A3B8` (slate-400) / blanc | 3,3:1 | Échec texte | ❌ utilisé comme **texte courant** ~40× ; `constants` le réserve au *désactivé* |
| placeholder `#8C8678` / field-fill | 3,3:1 | UI seul | ⚠️ limite pour du placeholder (toléré) |

---

## 7. Constats MINEURS & COSMÉTIQUES (regroupés en lots)

**Couleurs / jetons** — [2] `slate-400`/`#94A3B8` comme texte courant (~40 occ., sous AA) → `BRAND.muted` · [2] 3 triplets rouge/ambre/vert divergents cohabitent (`BlocAuditConformite:11-16` hex, `LicenceBanner:45` `#991B1B`, `button.tsx:21` danger `#991B1B` ≠ `BRAND.danger #B91C1C`) → aligner sur `BRAND.*` · [2] rgba de surface répétés en dur (`TabRevenus:132,241,311…`) → créer `SURFACE.infoTint` · [2] hex hors palette (`TabIR:249,522` : `#22c55e/#f97316/#0F766E`) → les nommer dans `constants`.

**Cohérence composants** — [2] switches « maison » de 3 tailles (`TabRevenus:149` 34×19, `TabCredits:91` h-4/w-7, `TabPlacements:230` h-5/w-9) → composant `Switch` unique · [2] 20 glyphes `✕/×` de fermeture vs icône `Trash2`/`X` lucide → uniformiser · [2] icônes d'alerte hétérogènes (🟠/⚠️/🔴/ℹ) → jeu unique · [2] `HelpTooltip` dupliqué (`shared.tsx` vs `primitives.tsx`, l'un chartré l'autre en rgba dur) → factoriser · [1] `card.tsx:6` bordure 2px vs 1px ailleurs + hover-lift sur card non cliquable · [2] `AmortissementModal:129-132` boutons de pied inline vs composant `Button`.

**Unités & signifiance de saisie** — [3] `MoneyField` sans « € » intégré → suffixe incohérent selon les libellés · [2] `%` saisi via `MoneyField` (style montant) `TabPlacements:546`, `TabImmobilier:635` → champ pourcentage dédié · [2] `(€)` présent sur certains libellés, absent sur d'autres au même écran → une seule règle.

**Accessibilité fine** — [2] cible tactile « ? » 15×15 px < 24×24 (WCAG 2.5.8) · [1] `<th>` sans `scope="col"`, tables sans `<caption>` (`TableauJalons`, `AmortissementModal`) · [1] statut « sauvegardé » `AppHeader:209` sans `aria-live` · [2] `HelpMenu` labels sans `htmlFor`/champs sans `id`.

**Robustesse / feedback** — [2] `LicenceBanner:26-36` échec portail Stripe seulement en `console.error` (contexte paiement) → message visible + reset du bouton.

**Ménage (cosmétique)** — [1] **`src/App.css` ≈ 90 % de gabarit Vite mort** (`.hero`, `.framework`, `.vite`, `#next-steps`, `#docs`, `#spacer`, `.ticks`, `.counter` — 0 usage réel) → supprimer · [1] `constants` sur-annonce l'AAA des sémantiques (cf. §6) → corriger les commentaires · [1] ponctuation des placeholders incohérente (« ex : » vs « ex: ») · [1] `reserveLabel` de `Field` jamais utilisé → désalignements verticaux de rangées.

---

## 8. Lots d'application proposés (à valider un par un)

> Discipline `revue-ui` : sauvegarde d'abord (le repo est versionné), un lot à la fois, diff montré, re-vérification, réversible. **Rien touchant la logique n'est fait sans bascule explicite sous `revue-code`.**

| Lot | Contenu | Effort | Risque | Gain |
|---|---|---|---|---|
| **A — Contraste texte** | `gold`→`goldText` sur fonds clairs (§3.1) ; `slate-400`→`muted` pour le texte ; chiffres pastel `TabMission` en navy | faible | très faible | ❗ lève des échecs AA sur des montants |
| **B — Select & tokens shadcn** | Fond opaque + surlignage d'option `select.tsx` ; câbler les quelques tokens manquants ou les remplacer par des valeurs `SURFACE`/`BRAND` (§3.4, M9, ring focus) | moyen | faible | ❗ supprime un risque d'erreur de saisie |
| **C — Daltonisme** | Palettes de graphiques color-blind-safe + double-encodage ; feu tricolore `TableauJalons` doublé d'un libellé ; légende `ProjectionChart` (§5, 3.5, M1) | moyen | faible | accessibilité + lisibilité client |
| **D — Cohérence composants** | Switch unique, icônes de suppression/alerte, `HelpTooltip` factorisé, cards/boutons de modale sur les primitives, couleurs sémantiques alignées | moyen | faible | homogénéité |
| **E — Guidage & densité** | Patron d'en-tête d'écran unique, 2 niveaux de titres, sous-sections de la carte « bien », retrait du jargon dev `TabParametres` | moyen | faible | clarté |
| **F — Ménage** | Supprimer `App.css` mort, corriger les commentaires AAA de `constants`, `scope`/`caption`, `aria-live` | faible | nul | propreté |
| **⚠ Hors présentation** | États d'erreur de saisie `MoneyField` (§3.2), anti-troncature montants (§3.3), accessibilité clavier (§3.7), feedback échec Stripe | — | — | **à traiter sous `revue-code`** (touche comportement/validation) |

---

### Artefacts joints
- `model.json` — modèle d'interface extrait (couleurs, jetons, interaction, criticité).
- `findings.json` — constats bruts de l'outil (480, dont 477 daltonisme naïfs, à lire avec §5).
- `RAPPORT.txt` — rapport texte brut de l'outil.
- Un **rapport visuel HTML** (nuanciers avant/après, jauge) peut être généré sur demande.
