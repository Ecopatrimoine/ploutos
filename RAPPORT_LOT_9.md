# Lot 9 — Refonte visuelle des PDFs (déroulé complet)

**Période** : mai 2026
**Cabinet** : EcoPatrimoine Conseil (David Perry, COA seul aujourd'hui)
**Périmètre** : refonte complète du rendu PDF v2 (Chromium headless via Playwright, local Windows), 12 pages livrées en deux séries de commits.

---

## Objectif initial

Câbler la refonte visuelle des PDFs **déjà validée en maquettes** mais jamais branchée, et la livrer **page par page sous validation visuelle** — pas de commit avant feu vert, pas de page suivante avant celle-ci.

Source de vérité visuelle : 15 maquettes HTML statiques dans `revue-preview/pdf/`, designées et acceptées en amont.

---

## Architecture mise en place

### Stack technique
- **Playwright** + Chromium headless (local) — pipeline `HTML → PDF A4` via `page.setContent` + `page.pdf`
- **TypeScript strict** + `tsx` pour l'exécution des scripts
- **Fontsource CDN** (Fraunces serif + Lato sans-serif) — chargé dans la coquille HTML
- **Token-driven design** : aucune couleur en dur dans les pages, tout passe par `buildTokens(theme, cabinetColors?)`

### Arborescence créée

```
src/lib/pdf/v2/
├── tokens.ts                      ← thèmes encreOr / cabinet + dérivés algorithmiques (mix/darken)
├── primitives.ts                  ← 30+ primitives partagées (header, KPI, encadrés, signatures…)
├── pages/                         ← 12 fichiers, un par page A4
│   ├── pageCouverture.ts
│   ├── pageIR.ts
│   ├── pageIFI.ts
│   ├── pageSuccessionA.ts
│   ├── pageSuccessionB.ts
│   ├── pageProfil.ts
│   ├── pagePrevoyanceInd.ts
│   ├── pagePrevoyanceColl.ts
│   ├── pageBilanEndettement.ts
│   ├── pageLettreMission.ts
│   ├── pageDer.ts
│   ├── pageFicheDDA.ts
│   └── pageDeclarationAdequation.ts
└── render*.ts                     ← 1 assembleur par page (tokens + body + coquille)

scripts/
└── generatePdfLocal.ts            ← pipeline local + fixtures figées par page
```

### Deux thèmes, mêmes pages
- **encreOr** (défaut) : couleurs exactes maquette — navy `#0F172A`, or `#C4973D`, crème
- **cabinet** : palette client (navy/or/cream/sky) avec **dérivés algorithmiques** (mix/darken hex pour les variantes pâles/sombres) → on garantit la cohérence visuelle sans figer chaque variante dans Paramètres

### Convention pagination (manuelle)
Chaque container A4 = 1 page A4 fixe (`overflow:hidden`), zones safe documentées :
- sans signature : ~35px bas (pied seul)
- avec signature : ~170px bas (slot signature + pied)

Pour les documents 2-pages (lettre mission, DER, fiche DDA, déclaration adéquation) : **deux containers A4 séquentiels**, signature uniquement sur le dernier dans un **slot absolu bas** (convention non négociable validée sur page Profil et étendue partout).

---

## Pages livrées (12)

### Rapport patrimonial (8 pages)
| # | Page | Maquette | Caractéristiques |
|---|------|----------|------------------|
| 1 | Couverture | `refonte_pdf_couverture_C_retouchee` | Cartel ORIAS + arcs décoratifs en bas droite |
| 2 | Bilan & endettement | `refonte_pdf_bilan_taux_endettement_methode_bancaire` | KPI 25 % + encart calcul détaillé (revenus/charges) ajouté à ta demande |
| 3 | Impôt sur le revenu | `refonte_pdf_page_fiscalite_A4_graphique_corrige` | Cascade revenus + barre répartition |
| 4 | IFI | `refonte_pdf_page_theme_ifi_A4` | Barre rail/seuil + biens immobiliers |
| 5 | Succession A | `refonte_pdf_succession_pageA_corrige_hauteur` | Barre dévolution + héritiers + masse civile |
| 6 | Succession B | `refonte_pdf_succession_pageB_consolide_deux_lignes` | Assurance-vie 990 I + bandeau navy total transmis |
| 7 | Profil & adéquation | `refonte_pdf_profil_conformite_4niveaux_esg` | Échelle 4 niveaux + questionnaire MIF II + **encart signature bas** |
| 8a | Prévoyance individuelle | `refonte_pdf_page_theme_prevoyance_individuelle_A4` | Liste barres besoin-vs-couverture |
| 8b | Prévoyance collective | `refonte_pdf_page_theme_prevoyance_collective_premier_jet` | Matrice conformité + pills sémantiques |

### Documents réglementaires (4 documents × 2 pages = 8 pages)
| # | Document | Maquette | Mentions / conformité |
|---|----------|----------|----------------------|
| 9 | Lettre de mission | `refonte_pdf_lettre_de_mission_2pages` | **Refondue post-audit conformité** (skill `conformite-cgp`) : intro DDA conditionnelle CIF, RCP avec garanties chiffrées (arrêté 29/10/2024), niveau de conseil, comment exerçons-nous (L.521-2 II 1°b), médiateur intégré |
| 10 | DER | `refonte_pdf_der_document_entree_en_relation_2pages` | Conditionnel par statut CIF/IAS/IOBSP — marqueurs ✓ vérifié / ⚠ à confirmer |
| 11 | Fiche conseil DDA | `refonte_pdf_fiche_conseil_dda_2pages` | Besoins icônés (shield-heart, activity, calendar-euro) + IBIP/ESG + IPID/DIC |
| 12 | Déclaration d'adéquation | `refonte_pdf_declaration_adequation_2pages` | Profil retenu + mise en regard 5 lignes + suivi périodique |

---

## Primitives partagées (30+)

Toutes pilotées par tokens (aucune couleur en dur), réutilisées entre pages :

### Structure de page
- `coquilleDocument`, `coquillePage`, `coquillePageDocReg` (avec slot signature absolu)
- `piedPage`, `piedPageDocReg`
- `header`, `headerDocReg` (support `\n` + `dateValeurHtml` composite)
- `cssCommun`

### Composition graphique
- `bandeKPI` (compact/large + `valueFontSize` par item)
- `barreRailFill`, `barreRepartition`, `barreDevolution`
- `cascadeRevenus` (5 types : revenu / déduction / netImposable / impot / total ; option `sansEncadre`)
- `tableauTitresDores`, `tableauBesoinReponse`, `matriceConformite`
- `listeBarresBesoinCouverture`, `listeQA`, `listeCasesPrestations`
- `echelleSegments` (curseur ▲ sur segment actif)
- `bandeauConsolide`, `bandeauInfo`

### Encarts et notes
- `encartNotreLecture`, `encartMentionPortee`, `encartAdequation`, `encartSignature`
- `noteIconee` (3 styles : neutre / discrete / conseil)
- `pill` (success/warning/info — **couleurs sémantiques invariantes** à travers les thèmes)
- `badge`, `sousTitreSection` (majuscules / serif)

### Documents réglementaires (Lot 9 spécifique)
- `champCabinet` (varc beige bordé doré) et `champMission` (varm bleu pâle)
- `legendeChampsDocReg` (avec option `seulementCabinet`)
- `encadreDocReg` (titre serif Fraunces intégré)
- `cadresSignatureDocReg` (override `mentionFaitHtml` + `masquerMentionFait`)
- `marqueurVerifie` (✓ vert daté) / `marqueurAConfirmer` (⚠ orange)

### Icônes (registre SVG inline, pas de CDN)
`circleCheck`, `fileText`, `shieldCheck`, `infoCircle`, `check`, `alertTriangle`, `helpCircle`, `userShield`, `shieldHeart`, `activityHeartbeat`, `calendarEuro`, `paperclip`, `motifArcsBasDroit` (décoratif couverture)

---

## Décisions de conception clés

### 1. Signature en bas absolu — convention non négociable
Établie sur la page Profil, étendue à tous les documents réglementaires : la signature est calée au même endroit (slot `signature?` de `coquillePage`/`coquillePageDocReg`) quel que soit le volume de contenu au-dessus. **Impact** : si une page risque de déborder, on bascule en deux containers A4 séquentiels et la signature reste sur le dernier.

### 2. Pas de fetch web pour les données cabinet
Tu as explicitement coupé ORIAS/SIRET/RCP/médiateur du fetch web. **Décision actée** : ces données viennent du payload Paramètres (Lot 5). Le PDF n'invente rien et marque clairement les champs encore vides via `champCabinet` (varc) + marqueurs `⚠ à confirmer`.

### 3. Pilotage par statuts ORIAS
DER et lettre de mission s'adaptent automatiquement aux statuts cochés (CIF / IAS / IOBSP). Pour ton cas actuel (COA seul) : AMF + association CIF + médiateur AMF + rémunération CIF sont masqués. Si tu cocheras CIF demain → ces blocs s'allument tout seuls — sur-ensemble exact de la v1.

### 4. Couleurs sémantiques invariantes
Les pills (success/warning/info), les marqueurs (✓ vert, ⚠ orange) et l'encart adéquation gardent **les mêmes couleurs** sur les 2 thèmes. La signalétique conformité prime sur l'identité visuelle.

### 5. Synthèse questionnaire MIF II vs renvoi déclaration adéquation
Sur ta demande, on a gardé les 6 lignes complètes du questionnaire MIF II sur la page Profil (au lieu des 3 lignes que j'avais simplifiées), tout en maintenant le renvoi explicite à la Déclaration d'adéquation (qui détaille en page #12).

---

## Audit conformité de la lettre de mission

Via la skill `conformite-cgp` (Mode 3 — audit / détection d'écart), comparaison v2 vs v1 + 3 autres docs réglementaires v1 :

**2 bloquants corrigés** :
- B1 : intro RG AMF incorrecte pour cabinet COA seul → conditionnée sur `statutCif`
- B2 : adresse AMF affichée sans condition → conditionnée sur `statutCif`

**6 mentions ajoutées** :
- M1 : encart RCP avec garanties chiffrées (1 564 610 €/sinistre, 2 315 610 €/an — arrêté 29/10/2024)
- M2 : niveau de conseil délivré
- M3 : comment exerçons-nous (L.521-2 II 1°b CMF)
- M4 : mention ≥10 % capital
- M5 : médiateur intégré dans Statuts
- M6 : tel/email cabinet dans Les parties

**Sources externes vérifiées** : ACPR (4 place de Budapest CS 92459, 75436 Paris Cedex 09), AMF (17 place de la Bourse, 75082 Paris cedex 02), Médiateur Assurance (TSA 50110 75441 Paris Cedex 09 + mediation-assurance.org), Arrêté RCP 29/10/2024 — tous confirmés à la source.

---

## Comment utiliser

### Générer un PDF en local
```powershell
npm run pdf:couverture           # → out/couverture-encreOr.pdf + out/couverture-cabinet.pdf
npm run pdf:ir                   # idem IR
npm run pdf:ifi                  # idem IFI
npm run pdf:successionA          # …
npm run pdf:successionB
npm run pdf:profil
npm run pdf:prevoyanceInd
npm run pdf:prevoyanceColl
npm run pdf:bilanEndettement
npm run pdf:lettreMission
npm run pdf:der
npm run pdf:ficheDDA
npm run pdf:declarationAdequation
```

Chaque cible génère **2 PDFs** : `<nom>-encreOr.pdf` (couleurs maquette) et `<nom>-cabinet.pdf` (palette cabinet de test).

### Fixtures
Toutes les fixtures sont dans `scripts/generatePdfLocal.ts` (`dataMaquette*`). Elles reproduisent les valeurs visibles dans les maquettes HTML. Quand le pipeline sera branché à l'app, ces fixtures laisseront place aux données réelles du dossier client courant.

---

## Reste à faire (hors Lot 9)

1. **Pages Paramètres #13/#14** (UI app, pas PDF) — différé en concertation, à traiter en Lot dédié UI Paramètres
2. **Branchement app → pipeline PDF v2** — actuellement les `render*.ts` sont autonomes ; à câbler aux données dossier réel quand on attaquera ce sujet
3. **Pagination automatique Chromium** (`@page` + `page-break-inside:avoid`) — réservée aux contenus fortement variables (annexes biens, tableaux d'hypothèses), hors socle Lot 9
4. **Renderer prod** (vs `scripts/generatePdfLocal.ts` qui est dev-only) — quand on remplace le pipeline PDF v1 en production

---

## Métriques

- **12 pages PDF** (8 thématiques + 4 documents réglementaires)
- **30+ primitives** partagées, toutes token-driven
- **2 thèmes** (encreOr + cabinet) → 24 PDFs générés par série de tests
- **~1200 lignes** ajoutées sur `primitives.ts` + `scripts/generatePdfLocal.ts` (extensions Lot 9)
- **~3000 lignes** dans `src/lib/pdf/v2/pages/*` et `src/lib/pdf/v2/render*` (nouveaux fichiers)
- **0 dépendance ajoutée** (Playwright + tsx déjà présents avant ce lot)
- **Pipeline complet** : HTML → Chromium → PDF, exécution locale Windows, ~3s par PDF
