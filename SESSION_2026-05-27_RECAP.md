# Session 2026-05-27 — Récapitulatif

> Document de référence pour reprendre le contexte des prochaines sessions.
> Toutes les évolutions, décisions et conventions établies pendant la session
> du 27 mai 2026 sur le projet Ploutos.

---

## 🎯 Vue d'ensemble

Session marathon couvrant **3 grands chantiers** + **4 releases publiées** :

1. **Lot Dossier client #77** : finalisation (pop-card v2 complet) + bascule franche v1 → v2 (suppression ~10 000 lignes de code v1)
2. **Refonte UI** : header de l'application (Option B "agence haut de gamme") + accent cabinet sur les Cards racine des tabs
3. **Audit IR concubins** : corrections de calcul + refonte affichage + ajout co-propriétaires SCI + fix logo cabinet sur la couverture du rapport

---

## 📦 Releases publiées

| Version | Tag | Titre | Contenu majeur |
|---|---|---|---|
| **1.3.0** | `v1.3.0` | Pack PDF universel & pipeline PDF v2 | Pop-card universel, 16 pages v2, 10 "Notre lecture" interprétatives, refactor succession |
| **1.3.1** | `v1.3.1` | Refonte header & cards | Header agence haut de gamme, accent en L cabinet sur cards, suppression admin |
| **1.3.3** | `v1.3.3` | IR concubins + co-propriétaires SCI | Fix calcul concubins, affichage par foyer, co-propriétaires extérieurs |
| **1.3.4** | `v1.3.4` | Logo cabinet + refonte couverture | Fix logo non affiché, logo XL, bandeau couverture refondu |

GitHub : https://github.com/Ecopatrimoine/ploutos/releases

> **Note auto-update Electron** : aucun workflow CI/CD. Pour publier les binaires Windows, lancer `npm run release` localement (electron-builder + publish:github).

---

## 🏗️ Architecture établie

### Pipeline PDF v2 unifié

```
App.tsx
  ├── computeIR / computeIFI / computeSuccession (calculs mémorisés)
  └── PopcardImpression (sélection multi-docs + overrides)
        └── generatePack (concatPack.ts)
              ├── renderItemBody — switch sur 17 sections
              │     ├── 4 docs réglementaires : lettre / DER / DDA / adéquation
              │     └── 13 sections bilan : couverture / cabinet / famille / travail
              │                              / IR / IFI / bilan endettement / successionA
              │                              / successionB / profil / prévoyance ind+coll
              │                              / hypos / recos / mentions
              └── coquilleDocument (HTML wrapper + fonts + CSS v2)
                    └── openPrintPopup (window.open + print)
```

Chaque section a un `buildXxxData` (adapter pur) + une `pageXxx` (rendu HTML).
Les adapters reçoivent `pagePosition = "X / N"` calculé par concatPack.

### Source unique succession

`computeSuccession()` enrichit chaque `result` avec :
- `partRecueFiscale` = `grossReceived + nueValue + usufructRawValue × usPct`
- `netFiscal` = `max(0, partRecueFiscale - successionDuties) + avNetReceived`
- `usufructFiscalValue`
- `compositionFiscale` (string lisible)

Consommé identiquement par TabSuccession.tsx (UI) et buildSuccessionAData.ts (PDF). Plus de divergence possible.

Helper exporté `formatCompositionFiscale()` pour réutilisation.

### CSS vars cabinet

Injectées au `document.documentElement` par `App.tsx` :
```ts
useEffect(() => {
  const root = document.documentElement;
  root.style.setProperty("--cab-navy", CAB.navy || BRAND.navy);
  root.style.setProperty("--cab-sky",  CAB.sky  || BRAND.sky);
  root.style.setProperty("--cab-gold", CAB.gold || BRAND.gold);
}, [CAB.navy, CAB.sky, CAB.gold]);
```

Consommées par `CardAccentTop`, `AppHeader`, et tout futur composant qui veut les couleurs cabinet sans propagation de props.

---

## 🆕 Composants / fichiers créés

| Fichier | Rôle |
|---|---|
| `src/components/AppHeader.tsx` | Header v2 "agence haut de gamme" (logo XL + ORIAS + identité + actions) |
| `src/components/CardAccentTop.tsx` | Filet en L (top + gauche) 6px gradient `--cab-navy → --cab-sky → --cab-gold` sur les Cards racine |
| `src/lib/pdf/v2/pages/pageCabinet.ts` | Page À propos cabinet + démarche en 5 étapes |
| `src/lib/pdf/v2/pages/pageFamille.ts` | Page composition foyer + tableau enfants |
| `src/lib/pdf/v2/pages/pageTravail.ts` | Page revenus pros + revenus du foyer (foncier / mobilier) + déductions |
| `src/lib/pdf/v2/pages/pageHypos.ts` | Page scénarios + bar chart SVG comparatif IR/IFI/Succession |
| `src/lib/pdf/v2/pages/pageRecommandations.ts` | Page recos groupées par dimension du profil |
| `src/lib/pdf/v2/pages/pageMentions.ts` | Page annexe légale (notes + 6 paragraphes de mentions) |
| `src/lib/pdf/v2/adapters/buildCabinetData.ts` | Adapter |
| `src/lib/pdf/v2/adapters/buildFamilleData.ts` | Adapter (mappe parentLink/custody clés réelles) |
| `src/lib/pdf/v2/adapters/buildTravailData.ts` | Adapter (ventile revenus actifs / foyer / déductions) |
| `src/lib/pdf/v2/adapters/buildHyposData.ts` | Adapter (calcule deltas + scénario gagnant) |
| `src/lib/pdf/v2/adapters/buildRecommandationsData.ts` | Adapter (réutilise `filterComplete` + `groupRecommandationsByDimension`) |
| `src/lib/pdf/v2/adapters/buildMentionsData.ts` | Adapter (mentions légales composées : Portée, Limites, Statuts, RGPD, Médiation, Confidentialité) |
| `src/tests/popcardPages.snapshot.test.ts` | 13 sentinelles : présence SVG, mentions légales clés, mode frais, etc. |
| `SESSION_2026-05-27_RECAP.md` | Ce document |

---

## 🗑️ Fichiers supprimés

### Pipeline PDF v1 (bascule franche)
- `src/lib/pdf/pdfReport.ts` (~697 lignes)
- `src/lib/pdf/pdfMission.ts`
- `src/lib/pdf/pdfDER.ts`
- `src/lib/pdf/pdfFicheDDA.ts`
- `src/lib/pdf/pdfAdequation.ts`
- `src/lib/pdf/registry.ts`
- `src/lib/pdf/v2/runners/` (4 fichiers : runDerV2, runLettreMissionV2, runFicheDDAV2, runDeclarationAdequationV2 — aperçus individuels retirés)
- Tests v1 : `pdfReport.snapshot`, `pdfReport.recommandations.snapshot`, `pdfMission.snapshot`, `pdfMission.cifAllumage`, `pdfDER.snapshot`, `pdfFicheDDA.snapshot`, `pdfFicheDDA.ipidDynamique`, `pdfAdequation.snapshot` (+ leurs snapshots `.snap`)

### Admin
- `src/hooks/useAdmin.ts`
- `src/components/AdminDashboard.tsx`

### Code mort post-bascule
- Composant `PdfModal` (était défini dans App.tsx, réservé aux PDFs v1)
- Helpers v1 de `pdfCore.ts` (kpi, sec, tbl, hbar, segB, summarizeBy, PAGINATION_THRESHOLD, resolveCabinetColors, resolveRecipient, ENCRE_OR) — réduit à `openPrintPopup` + type `Recipient` uniquement

**Bilan code mort retiré** : ~10 000 lignes + 117 tests v1.

---

## 🔧 Bug fixes notables

### Succession — divergence UI / PDF
- **Avant** : la formule fiscale héritier était recalculée à 6 endroits (5 dans TabSuccession.tsx, 1 dans buildSuccessionAData.ts) → risque de divergence permanente.
- **Après** : enrichissement de `computeSuccession()` (4 champs dérivés), TabSuccession et adapter lisent les mêmes champs.
- 8 tests sentinelles ajoutés à `succession.test.ts`.

### IR concubins — ownership "Communauté"
- **Avant** : option "Communauté" disponible pour tous les statuts → calcul fiscalement faux pour les concubins (pas de communauté de biens sans mariage/PACS).
- **Après** : `ownerOptions` (App.tsx) filtre selon `coupleStatus` (visible pour married/pacs uniquement). Indivision reste disponible pour couples.

### IR concubins — CSG foncier ventilée
- **Avant** : `csgDeductibleFoncier` réparti 50/50 forcé entre concubins, même si un bien locatif était détenu en propre.
- **Après** : ventilée au prorata du foncier net imposable de chaque foyer (fallback 50/50 si aucun foncier). 2 sentinelles ajoutés à `ir.test.ts`.

### Logo cabinet absent sur couverture PDF
- **Bug** : le state `logoSrc` d'App.tsx n'était jamais propagé au pipeline pop-card.
- **Fix** : ajout `logoSrc?` sur `PopcardImpressionProps`, `PackPayload`, `BuildCouvertureDataParams`. Chaîne complète : `App.tsx → PopcardImpression → generatePack → buildCouvertureData → pageCouverture`.
- Fallback chain : `p.logoSrc → cabinet.logoSrc → cabinet.logo → undefined` (initiales en placeholder).

### TabIR concubins — affichage opaque
- **Avant** : KPIs globaux (IR total, Revenu net global, TMI, Taux moyen) → confusion sur ce qui est agrégé / par foyer.
- **Après** : labels contextualisés (`IR cumulé 2 foyers`, `Revenu net du foyer [Prénom]`, `TMI [Prénom]`, etc.). En concubinage, PFU et PS foncier basculent par foyer avec le switch P1/P2. Card concubinage enrichie avec décomposition par foyer (foncier brut/taxable/CSG/PS + placements barème/PFU + IR total foyer).
- Nouveaux champs exposés dans `ir` : `foncierBrut1/2`, `foncierCharges1/2`, `foncierInterests1/2`, `foncierTaxable1/2`, `foncierPS1/2`, `taxablePlac1/2`, `pfuBase1/2`, `perInteretsPFU1/2`, `totalPFU1/2`, `csgFoncierP1/2`, `finalIR1/2`.

### Audit comparatif v1 ↔ v2 (9 corrections critiques)
- Mentions MIF II (Cabinet)
- Mapping `parentLink` / `custody` corrigés (clés réelles depuis `src/constants/index.ts`)
- KPI Revenus bruts Travail aligné v1 (sans pensions)
- Label dynamique "Frais réels" / "Abattement 10 %" selon `expenseMode`
- "Autres déductions = max(0, deductibleCharges − perDeductionCalc)" (fin double comptage)
- Pensions ventilées correctement (legacy `pensions` vs `pensions1/2`)
- Mention conformité "garanties et besoins, aucun produit nommé" (Recos)
- Limites Dutreil/SCI/holding + Confidentialité (Mentions)

---

## ✨ Nouvelles fonctionnalités

### Co-propriétaires extérieurs au foyer (SCI / indivision)
- Nouveau type `ExternalShareholder` dans `types/patrimoine.ts` : `{ id, name, relation, sharePercent }`
- 9 relations : Associé, Frère/Sœur, Parent, Cousin, Oncle/Tante, Neveu/Nièce, Ami, Ex-conjoint, Autre
- UI dans TabImmobilier visible si `ownership === "indivision"` OU `type === "SCI IR" / "SCI IS"`
- Synthèse "X % foyer + Y % extérieurs = Z %" avec alerte ⚠ si != 100 %
- **Calcul inchangé** : le foyer ne déclare que sa quote-part (chaque extérieur déclare la sienne)

### Sélecteur destinataire (concubinage)
- Apparaît dans le pop-card si `coupleStatus === "cohab"` ET couverture cochée
- 3 options : Couple / Personne 1 / Personne 2 (avec prénoms réels)
- Route le nom affiché sur la couverture v2 (foyers fiscaux séparés en concubinage)

### Bar chart Hypos
- Bar chart vertical groupé SVG inline (IR / IFI / Succession × Base + scénarios)
- Max 3 scénarios affichés, surplus signalé en italique
- Valeurs au-dessus des barres en format compact (12 k€ / 1,2 M€)

### Pagination calculée
- `concatPack` calcule `"X / N"` (N = total sections du pack) et passe à chaque adapter
- La couverture n'utilise pas le champ (mention pied custom)

### Notes "Notre lecture" interprétatives (10 pages)
Format masque uniforme sur toutes les pages bilan :
- `<p>` cadrage métier (la mécanique, ce qui compte)
- `<ul>` composition factuelle (chiffres clés)
- `<p>` italique "Leviers" / "Points d'attention" (déductifs selon situation)

Exemples de leviers déductifs :
- IR : si TMI ≥ 30 % → suggère PER
- IFI : si > seuil → mentionne plafonnement 75 % + démembrement
- Bilan endettement : position vs HCSF 35 %
- Profil : alerte si dissonance profil ↔ capacité ≥ 2 niveaux
- Prévoyance : déficits chiffrés en années de revenus

### Profil v2 enrichi
- Encart "Notre lecture" interprétatif avec allocation cible indicative
- **Vocabulaire COA strict** : "support en euros" / "unités de compte" uniquement. Pas d'instruments financiers nommés (ETF, actions, structurés). Pas de produit ni d'assureur cité.
- Allocation unique par profil (pas de fourchette) : "environ 50 % support en euros + 50 % UC diversifiées" pour équilibré
- Mention "indicative, à appliquer sur l'ensemble de vos placements financiers (AV, PER, contrat de capitalisation), à affiner avec votre conseiller"

---

## 🎨 Refonte UI Header & Cards

### Header `AppHeader.tsx` (4 itérations validées)
- **Fond** : `SURFACE.cardSoft` (#FDFCFA, charte logiciel)
- **Cadre 8px** complet en gradient diagonal `navy → sky → blue → gold` (les 4 couleurs cabinet sur tout le pourtour)
- **Logo** : 110px + halo or radial subtil
- **Titre du dossier client** : Lato bold 28px navy, édition inline au clic (Enter/Échap)
- **Statut sauvegarde dynamique** : "Sauvegardé à l'instant" / "il y a 2 min" / etc., refresh 30 s
- **Actions** : 4 boutons 44×44 bordure 2px (hover gold), icônes 20px, séparateurs verticaux or
- **HelpMenu** : nouvelle prop `theme="light"` (cercle or visible sur fond clair)
- **Suppressions** : bouton "PDF Rapport" v1 (renommé "Pack PDF" → pop-card), bouton "PDF Mission" header, bouton Admin, input nom dossier (remplacé par titre éditable)

### `CardAccentTop` sur les Cards racine
- Filet en L (top 6px + gauche 6px), gradient `--cab-navy → --cab-sky → --cab-gold`
- Coin top-left arrondi (radius par défaut 14, matche `Card` shadcn default)
- Appliqué sur 8 cards : Collecte patrimoniale, Rapport client, TabIFI, TabIR, TabMission, TabParametres, TabSuccession, TabHypotheses

### Refonte Couverture PDF
- Logo XL 130×130 (sans cercle, sans bordure)
- Bandeau identité refondu : logo gauche + ORIAS droite agrandi (label 14px + n° 20px navy)
- Nom du cabinet déplacé en pied de page (style "signature de document")

---

## 📋 Conventions / décisions

### Commit & release
- **Pas de `Co-Authored-By: Claude …`** dans les messages de commit (préférence explicite user)
- **Pas de push sans validation UI** : sur les refontes UI, attendre validation visuelle avant commit/push. Les fixes calcul/tests peuvent être commit dès tests verts.
- Commits structurés : `feat(scope) / fix(scope) / refactor(scope) / chore(release)` + body explicatif
- Tags annotés (`git tag -a vX.Y.Z -m "..."`)
- GitHub Release via `gh release create vX.Y.Z --title ... --notes ...`
- Pour le binaire Windows : `npm run release` local (electron-builder + publish:github)

### Conformité COA (cabinet Ecopatrimoine)
- Vocabulaire purement assurance-vie : "support en euros", "unités de compte"
- **Jamais** d'instrument financier nommé en direct (ETF, actions, structurés) → relève du CIF, hors périmètre
- **Jamais** de produit ni d'assureur nommé
- Mentions légales obligatoires sur tout livrable (portée, limites, RGPD, médiation, confidentialité, statuts ORIAS)
- Allocations indicatives "à valider avec votre conseiller"

### Conventions UI
- Couleurs cabinet via CSS vars (`--cab-navy`, `--cab-sky`, `--cab-gold`) + `BRAND` fallback
- Polices : Lato (sans-serif par défaut), Fraunces (serif, non chargé en web — utiliser Lato bold pour les titres)
- Cards shadcn : radius effectif 14 (le style inline du composant override les classes `rounded-3xl`)
- Code couleur : `#2F7D5B` succès vert, `#B0413E` rouge bordeaux pour danger

### Mémoire persistante
- `feedback_no_coauthor.md` : pas de Co-Authored-By
- `feedback_donnees_cabinet_paramètres.md` : ORIAS/SIRET/RCP viennent du payload Paramètres (Lot 5), pas de fetch web
- `feedback_no_push_sans_validation.md` : pas de push sans validation UI sur les refontes visuelles

---

## 📈 Tests

- **300/300 verts** en fin de session (vs 418 au début — différence = 117 tests v1 supprimés + 8 nouveaux sentinelles succession + 2 nouveaux CSG + 13 sentinelles popcard − retraits)
- `tsc --noEmit` clean
- Sentinelles ajoutés : 
  - `succession.test.ts` : 8 tests verrouillage source unique (partRecueFiscale, composition)
  - `ir.test.ts` : 2 tests CSG ventilée (100 % propriétaire seul / prorata 2 biens)
  - `popcardPages.snapshot.test.ts` : 13 tests (présence SVG, mentions légales Dutreil/Confidentialité, MIF II Cabinet, "garanties et besoins" Recos, labels mode frais)

---

## ⏭️ Tâches reportées / à creuser

### Champs collecte manquants (concubins)
- **`pensionDeductible`** et **`otherDeductible`** : pas de champ "payeur" → réparti 50/50 forcé en concubinage. Devrait être ventilable par foyer (à ajouter dans la collecte UI).

### Sélecteur recipient (concubinage) non câblé en UI App
- Le pipeline supporte `recipient` mais le sélecteur dans la pop-card est local au composant.
- Pour le routage complet (IR / Succession recalculés selon recipient en concubinage), il faudrait câbler `recipient` depuis App.tsx avec un state global.

### Détail foncier global dans TabIR (concubins)
- Le micro/réel, le foncier brut, le waterfall affichent encore des totaux `ir.foncierBrut` globaux (somme P1+P2).
- Pour pousser plus loin la séparation par foyer, ces zones pourraient afficher la décomposition.

### Autres pages PDF v1-only à reprendre
Aucune. Toutes les sections v1 ont été refondues en v2.

### Tests E2E
Pas de tests E2E (Playwright). Les snapshots et sentinelles couvrent la logique métier + les briques visuelles unitaires.

### Workflow CI/CD GitHub Actions
Pas de workflow. Les releases Electron Windows se font localement via `npm run release` (electron-builder + publish:github).

---

## 🔑 Points d'entrée pour reprendre

### Génération PDF
1. **Pop-card universel** : bouton "Pack PDF" du header (haut-droite) OU "Générer un document PDF" dans TabMission. Ouvre `PopcardImpression` qui appelle `generatePack` (concatPack.ts).
2. **Ouvrir un PDF de test rapide** : pas d'aperçu individuel (les runners v2 ont été supprimés). Passer par le pop-card.

### Architecture des calculs
- `computeIR(data, irOptions, concubinPerson?)` → ir.ts (foyer commun OU 2 foyers concubins)
- `computeIFI(data)` → ifi.ts
- `computeSuccession(successionData, data)` → succession.ts (avec champs dérivés source unique)
- `computeProfilRisque(mission)` + `computeCapacitePerte(data)` → conformite/profil.ts + capacitePerte.ts

### Structure des composants visuels PDF v2
- `src/lib/pdf/v2/primitives.ts` : tous les blocs HTML réutilisables (header, bandeKPI, tableauTitresDores, encartNotreLecture, piedPage, coquillePage, etc.)
- `src/lib/pdf/v2/tokens.ts` : palette `encreOr` (default) + couleurs cabinet via `buildTokens(theme, cabinetColors)`
- `src/lib/pdf/v2/pages/` : 17 fichiers (1 par section)
- `src/lib/pdf/v2/adapters/` : 17 fichiers (1 par section, calculs → PageData)
- `src/lib/pdf/v2/popcard/concatPack.ts` : assembleur (sélecteur `renderItemBody` + check complétude)

### Audit et conformité
- `src/lib/conformite/referencesLegales.ts` : références CMF / CdA / AMF dynamiques
- `src/lib/conformite/vocabulaire.ts` : vocabulaire écran + PDF selon statuts cabinet
- `src/lib/conformite/profil.ts` : score MIF II
- `src/lib/conformite/capacitePerte.ts` : capacité de perte (situation financière objective)
- `src/lib/conformite/recommandations.ts` : modèle Recommandation + dimensions
- `src/lib/conformite/piecesJointes.ts` : IPID / DIC

---

## 🔗 Référentiel

- **GitHub** : https://github.com/Ecopatrimoine/ploutos
- **Releases** : https://github.com/Ecopatrimoine/ploutos/releases
- **Stack** : React 19 + Vite + TypeScript 5 + Tailwind + Shadcn UI + Supabase + Electron + electron-builder
- **Tests** : Vitest (300/300 verts en fin de session)
- **Cabinet** : Ecopatrimoine Conseil (ORIAS 25006907) — COA seul, vocabulaire DDA

---

*Document généré en fin de session 2026-05-27 pour servir de point de départ aux futures sessions.*
