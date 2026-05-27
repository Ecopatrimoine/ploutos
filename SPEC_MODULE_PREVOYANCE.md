# SPEC_MODULE_PREVOYANCE — Ploutos

> **Document de spécification** du module Prévoyance (personnelle + collective) à intégrer dans Ploutos.
> Rédigé à l'issue d'une session de brainstorming avec David Perry — toutes les décisions ci-dessous sont **tranchées et ne doivent pas être rouvertes** sans validation explicite.
>
> **Destinataire** : Claude Code en mode session longue dans `C:\Users\davla\Ploutos\`.
> **Date de rédaction** : 27 mai 2026.
> **Version cible Ploutos** : 1.4.0 (mineure : ajout fonctionnalité majeure).
> **Conventions Ploutos applicables** : voir section 16.

---

## Table des matières

0. [Métadonnées et règles de session](#0-métadonnées-et-règles-de-session)
1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture cible](#2-architecture-cible)
3. [Lot 1 — Suppression de l'onglet Rapport client](#3-lot-1--suppression-de-longlet-rapport-client)
4. [Lot 2 — Enrichissement de l'onglet Travail](#4-lot-2--enrichissement-de-longlet-travail)
5. [Lot 3 — Référentiels versionnés](#5-lot-3--référentiels-versionnés)
6. [Lot 4 — Moteur de projection (arrêt maladie + invalidité)](#6-lot-4--moteur-de-projection-arrêt-maladie--invalidité)
7. [Lot 5 — Tests Vitest (cas d'or)](#7-lot-5--tests-vitest-cas-dor)
8. [Lot 6 — Moteur de règles & constats](#8-lot-6--moteur-de-règles--constats)
9. [Lot 7 — UI TabPrevoyancePerso](#9-lot-7--ui-tabprevoyanceperso)
10. [Lot 8 — UI TabPrevoyanceCollective](#10-lot-8--ui-tabprevoyancecollective)
11. [Lot 9 — Câblage Pack PDF v2](#11-lot-9--câblage-pack-pdf-v2)
12. [CCN à inclure (Tranches 1, 2, 3)](#12-ccn-à-inclure-tranches-1-2-3)
13. [Conformité DDA — règles non négociables](#13-conformité-dda--règles-non-négociables)
14. [Mise à jour annuelle](#14-mise-à-jour-annuelle)
15. [Mentions légales du PDF](#15-mentions-légales-du-pdf)
16. [Conventions projet à respecter](#16-conventions-projet-à-respecter)
17. [Annexes](#17-annexes)

---

## 0. Métadonnées et règles de session

### Périmètre

Module composé de deux onglets dans l'application Ploutos :

- **TabPrevoyancePerso** — protection sociale individuelle de chaque membre du foyer (P1 et P2 traités indépendamment).
- **TabPrevoyanceCollective** — protection sociale au niveau de l'entreprise (dirigeants + analyse externe RH/audit).

Le module se compose d'un moteur de projection temporelle (arrêt maladie + invalidité jusqu'à l'âge légal), d'un moteur de règles produisant des constats, et de référentiels JSON versionnés par millésime.

### Principes structurants

1. **Aucune recommandation produit** — DDA / art. L.521-4 C. assurances. Le module produit des **besoins** et des **trous**, jamais un assureur ou un produit nommé.
2. **P1 et P2 sont indépendants** quel que soit leur statut marital. Chacun a sa caisse, son statut, son employeur, ses contrats.
3. **Aucune valeur de référentiel inventée**. Tout chiffre (IJ, plafond, taux) provient d'une source officielle datée. Si non vérifiable : marqué `"TO_VERIFY"` dans le JSON et signalé en commentaire.
4. **Tests Vitest verts à chaque incrément** — Ploutos = calculateur fiscal à haut risque, donc même rigueur sur la prévoyance.
5. **Discipline d'incrément** : un lot = tests + build verts → commit séparé réversible → STOP et attente de validation utilisateur avant le lot suivant.

### Stack technique

- React 19 + Vite + TypeScript 5
- Recharts (déjà installé) pour le graphique de projection
- Vitest pour les tests
- Pas de nouvelle dépendance npm sans validation explicite

### Sources autoritaires pour le remplissage des référentiels

- **Légifrance / KALI** : textes des conventions collectives
- **BOSS** (Bulletin officiel de la Sécurité sociale)
- **URSSAF** : forfait social, réintégration sociale
- **Sites des caisses libérales** : carmf.fr, cipav-retraite.fr, carpimko.com, etc.
- **service-public.fr** : règles pour le grand public
- **L.1226-1 C. trav.** et **D.1226-1 et s.** : maintien légal de salaire (loi Mensualisation)
- **API publique** : `https://recherche-entreprises.api.gouv.fr/search?q={siret}` pour la résolution automatique IDCC

---

## 1. Vue d'ensemble

### 1.1 Décisions tranchées (brainstorming 27 mai 2026)

| Décision | Choix retenu |
|---|---|
| Onglet Rapport client | Supprimé (générateur PDF déjà migré dans le header v1.3.x) |
| Sélecteur destinataire P1/P2/couple | Supprimé. P1 et P2 toujours indépendants dans le module prévoyance |
| Sync Kleios | Différée (refonte Kleios à venir) |
| Persistance | `payload.prevoyance` séparée, versionnée par millésime |
| Volume CCN | Cible 80 IDCC pour couvrir ~90 % des salariés |
| Profondeur projection | Arrêt maladie J0→J1095 + invalidité J1095→âge légal retraite |
| SIRET demandé pour | TOUS les salariés (pas seulement les dirigeants) |
| Toggle Collective | Activé pour dirigeants. Toggle « analyse externe » pour salariés (RH/audit) |
| Forme graphique | Aires empilées avec deux échelles X bout à bout (paliers à gauche, années à droite) |
| Sélecteur catégorie invalidité | Radio « Cat 1 / Cat 2 / Cat 3 » au-dessus du graphique |

### 1.2 Bénéfices visés

- **Pour le CGP** : visuel client immédiat, audit conformité collective, conseil structuré.
- **Pour le client** : voir en un coup d'œil le trou financier à 6 mois, 3 ans et au-delà.
- **Pour le cabinet** : module différenciant face à Harvest / Simulabox / Wealthcome qui n'ont pas de projection visuelle équivalente.

---

## 2. Architecture cible

### 2.1 Arborescence des fichiers à créer

```
src/
├── data/
│   └── prevoyance/
│       ├── pass-2026.json
│       ├── caisses-2026.json
│       ├── ccn-2026.json
│       └── index.ts              -- charge le millésime courant (CURRENT_YEAR)
├── lib/
│   └── prevoyance/
│       ├── types.ts              -- tous les types partagés
│       ├── projection.ts         -- moteur de projection AM + invalidité
│       ├── regles.ts             -- moteur de règles & constats
│       ├── besoins.ts            -- calcul des besoins théoriques (DC, rente conjoint, éducation)
│       ├── audit-collectif.ts    -- audit conformité 1,50%, ANI, catégories objectives
│       └── utils.ts              -- helpers communs
├── components/
│   ├── TabPrevoyancePerso.tsx
│   ├── TabPrevoyanceCollective.tsx
│   └── prevoyance/
│       ├── BlocStatutCaisse.tsx          -- saisie statut + caisse + employeur (P1 ou P2)
│       ├── BlocContratsIndividuels.tsx   -- liste des contrats perso
│       ├── ProjectionChart.tsx           -- graphique Recharts aires empilées
│       ├── TableauJalons.tsx             -- tableau des points clés
│       ├── BlocConstats.tsx              -- affichage des constats hardcodés
│       ├── BlocEntreprise.tsx            -- saisie/résolution SIRET
│       ├── BlocCouvertureCollective.tsx  -- saisie couverture en place
│       └── BlocAuditConformite.tsx       -- audit 1,50% + ANI + catégories objectives
└── lib/pdf/v2/
    ├── adapters/
    │   ├── buildPrevoyancePersoData.ts
    │   └── buildPrevoyanceCollectiveData.ts
    └── pages/
        ├── pagePrevoyancePerso.ts
        └── pagePrevoyanceCollective.ts

src/__tests__/
└── prevoyance/
    ├── projection.test.ts        -- 30+ tests, dont les 4 cas d'or
    ├── regles.test.ts            -- un test par règle
    ├── besoins.test.ts
    └── audit-collectif.test.ts
```

### 2.2 Schéma `payload` étendu

Ajouts à `payload.data` (à n'effectuer qu'au moment de la première saisie pour limiter la migration) :

```typescript
type PayloadData = {
  // ... champs existants

  travail?: {
    p1: PayloadTravail;
    p2: PayloadTravail | null;
  };

  prevoyance?: {
    version: 1;            // pour migration future
    p1: PayloadPrevoyancePerso;
    p2: PayloadPrevoyancePerso | null;
    collective: PayloadPrevoyanceCollective | null;
  };
};
```

Les anciens dossiers sans `travail` ni `prevoyance` continuent de fonctionner ; les onglets affichent un état vide invitant à compléter.

### 2.3 Flot de données

```
Saisie onglet Travail (SIRET, statut, salaire)
    ↓
Auto-résolution SIRET → IDCC (recherche-entreprises.api.gouv.fr)
    ↓
payload.data.travail.{p1|p2}
    ↓
TabPrevoyancePerso lit travail + saisit contrats individuels
    ↓
moteur projection.ts (caisses-2026.json + ccn-2026.json + pass-2026.json)
    ↓
ProjectionResult { axe, series, rupturesCles, basculeInvalidite }
    ↓
ProjectionChart (Recharts) + TableauJalons + BlocConstats
    ↓
Pack PDF v2 (buildPrevoyancePersoData → pagePrevoyancePerso)
```

---

## 3. Lot 1 — Suppression de l'onglet Rapport client

### 3.1 État actuel (post v1.3.x)

Depuis la bascule pop-card v2 (v1.3.0 / 27 mai 2026), la génération du Pack PDF se fait depuis le bouton « Pack PDF » du header (`AppHeader.tsx` → `PopcardImpression`). L'onglet « Rapport client » qui reste est devenu une carte vestigiale.

### 3.2 Actions

1. Identifier le `TabRapportClient` (ou nom équivalent) dans `App.tsx` et dans la nav latérale.
2. Supprimer :
   - L'entrée de menu dans la sidebar
   - Le composant `TabRapportClient.tsx`
   - L'import et le rendu dans `App.tsx`
   - L'éventuel state dédié (`activeTab === "rapport"` etc.)
3. Vérifier qu'aucune fonctionnalité orpheline ne disparaît (le sélecteur de palette de couleurs doit déjà être ailleurs — sinon, le reloger dans `TabParametres`).
4. Vérifier que le bouton « Pack PDF » du header reste fonctionnel après suppression.

### 3.3 Critère « fait »

- Build OK, 300+ tests verts
- L'onglet n'apparaît plus dans la sidebar
- Le Pack PDF reste accessible depuis le header
- Commit isolé, message : `refactor(ui): retrait onglet Rapport client (Pack PDF migré dans le header)`

---

## 4. Lot 2 — Enrichissement de l'onglet Travail

### 4.1 Type `PayloadTravail`

```typescript
type StatutPro =
  | "salarie_non_cadre"
  | "salarie_cadre"
  | "tns_liberal"
  | "tns_commercant"
  | "tns_artisan"
  | "gerant_majoritaire"        // SARL / EURL gérant majoritaire
  | "president_sas"             // SAS / SASU président
  | "eurl_unique"               // EURL gérant non majoritaire (assimilé salarié)
  | "fonctionnaire"
  | "retraite"
  | "sans_activite";

type CodeCaisse =
  | "CPAM" | "SSI" | "MSA"
  | "CARMF" | "CARCDSF" | "CARPV" | "CARPIMKO" | "CIPAV"
  | "CNBF" | "CAVOM" | "CAVEC" | "CAVAMAC" | "CRN";

type EmployeurInfo = {
  siret: string | null;
  siren: string | null;
  nom: string | null;
  formeJuridique: string | null;
  codeNAF: string | null;
  idccCCN: string | null;
  nomCCN: string | null;
  sourceCCN: "auto" | "manuel" | "non_defini";
  effectif: number | null;
  adresseEtablissement: string | null;
  dateCreation: string | null;       // ISO date
};

type PayloadTravail = {
  statutPro: StatutPro;
  caisseAffiliation: CodeCaisse | null;

  employeur: EmployeurInfo | null;

  dateEmbauche: string | null;       // ISO date — calcul d'ancienneté
  tempsTravail: {
    type: "plein" | "partiel";
    pourcentage?: number;             // si partiel
  };

  salaireBrut: number;                // annuel
  primeAnnuelle: number | null;

  // Spécifique TNS
  revenuBNC: number | null;
  revenuBIC: number | null;
  optionMadelin: boolean;
};
```

### 4.2 UI du bloc « Employeur »

Champs affichés (P1 et P2 chacun leur bloc) :

| Champ | Type | Comportement |
|---|---|---|
| SIRET (14 chiffres) | input | Onblur → appel API, peuple les autres champs |
| Nom employeur | input | Préempli par API, modifiable |
| Forme juridique | input | Préempli, modifiable |
| Code NAF | input | Préempli, modifiable |
| IDCC | input + autocomplete depuis ccn-2026.json | Préempli si `liste_idcc` renvoyé. Badge vert « CCN auto-résolue » ou gris « CCN saisie manuellement » |
| Effectif | input numérique | Préempli si dispo |
| Date d'embauche | date picker | Saisie manuelle uniquement |

### 4.3 Résolution SIRET — implémentation

```typescript
// src/lib/prevoyance/utils.ts

export async function resolveSiret(siret: string): Promise<EmployeurInfo | null> {
  if (!/^\d{14}$/.test(siret)) return null;

  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    // Privilégier matching_etablissements[].liste_idcc, fallback complements.liste_idcc
    const etab = result.matching_etablissements?.[0];
    const idccList =
      etab?.liste_idcc ?? result.complements?.liste_idcc ?? [];
    const idccCCN = idccList[0] ?? null;

    return {
      siret,
      siren: siret.substring(0, 9),
      nom: result.nom_complet ?? result.nom_raison_sociale ?? null,
      formeJuridique: result.nature_juridique ?? null,
      codeNAF: etab?.activite_principale ?? result.activite_principale ?? null,
      idccCCN,
      nomCCN: idccCCN ? lookupCCNName(idccCCN) : null,
      sourceCCN: idccCCN ? "auto" : "non_defini",
      effectif:
        Number(etab?.tranche_effectif_salarie ?? result.tranche_effectif_salarie) || null,
      adresseEtablissement: etab?.adresse ?? null,
      dateCreation: result.date_creation ?? null,
    };
  } catch {
    return null;
  }
}
```

`lookupCCNName(idcc)` lit `ccn-2026.json` pour retourner le libellé.

### 4.4 Cohérence avec l'existant

- Si `salaireBrut` existait déjà ailleurs (par exemple dans un onglet Revenus), **fusionner** : `payload.data.travail.p1.salaireBrut` devient la source unique, l'ancien champ est migré (script de migration `src/lib/migrations/v140_travail.ts` à créer).
- Garder les champs existants `person1Csp`, `person2Csp` (CSP INSEE) car utilisés ailleurs (Kleios, IR…).

### 4.5 Critère « fait »

- Onglet Travail enrichi des nouveaux champs
- Résolution SIRET fonctionnelle (testée manuellement sur 3 entreprises connues)
- Migration des dossiers existants sans casse (tests de non-régression)
- Commit : `feat(travail): saisie statut pro + employeur + SIRET (auto-résolution IDCC)`

---

## 5. Lot 3 — Référentiels versionnés

### 5.1 Principe

Trois fichiers JSON par millésime, mise à jour annuelle manuelle. Chaque fichier porte son année et la date de vérification de ses valeurs.

```
src/data/prevoyance/
├── pass-2026.json
├── caisses-2026.json
├── ccn-2026.json
└── index.ts
```

### 5.2 `index.ts` — point d'entrée

```typescript
import pass from "./pass-2026.json";
import caisses from "./caisses-2026.json";
import ccn from "./ccn-2026.json";

export const CURRENT_YEAR = 2026;

export type PassReferentiel = typeof pass;
export type CaissesReferentiel = typeof caisses;
export type CcnReferentiel = typeof ccn;

export const referentiels = { pass, caisses, ccn };

// Garde-fou : si l'année courante du système dépasse le millésime de plus d'un an,
// on log un warning au démarrage.
if (new Date().getFullYear() > CURRENT_YEAR + 1) {
  console.warn(
    `[prevoyance] Référentiels datés de ${CURRENT_YEAR}. ` +
    `Vérifier les mises à jour annuelles (PASS, IJSS, CCN).`
  );
}
```

### 5.3 Schéma `pass-2026.json`

```json
{
  "millesime": 2026,
  "dateVerification": "2026-05-27",
  "sources": [
    "URSSAF — Plafond de la sécurité sociale 2026",
    "BOSS — chapitre 'Assiette générale'"
  ],
  "pass": {
    "annuel": 48060,
    "mensuel": 4005,
    "journalier": 222,
    "horaire": 30
  },
  "tranches": {
    "T1": { "min": 0, "max": 48060 },
    "T2": { "min": 48060, "max": 384480 }
  },
  "ijss": {
    "plafondSalaireBrutMensuel": 12015,
    "tauxIJ": 0.5,
    "carenceJours": 3,
    "plafondJournalier": "TO_VERIFY",
    "majorationApres30JoursAvecEnfants": "TO_VERIFY"
  },
  "exonerationsSociales": {
    "prevoyanceSante": {
      "formule": "6% PASS + 1.5% rémunération",
      "plafondAnnuel": "calcule_par_personne"
    },
    "retraiteSupplementaire": {
      "formule": "8% rémunération dans la limite de 8 PASS",
      "plafondAnnuel": "calcule_par_personne"
    }
  },
  "forfaitSocial": {
    "tauxStandard": 0.20,
    "tauxReduitMoinsDe11Salaries": 0,
    "tauxReduitEpargneSalariale": 0.16
  }
}
```

> **Important** : les valeurs marquées `"TO_VERIFY"` doivent être renseignées par David avant la première mise en production. Le moteur ne doit **pas** charger un référentiel contenant des `TO_VERIFY` sur des champs critiques sans alerter.

### 5.4 Schéma `caisses-2026.json`

```json
{
  "millesime": 2026,
  "dateVerification": "2026-05-27",
  "sources": [
    "carmf.fr (vérifié 2026-05-27)",
    "cipav-retraite.fr",
    "secu-independants.fr",
    "carpimko.com",
    "ameli.fr (IJSS)"
  ],
  "caisses": {
    "CPAM": {
      "nom": "Caisse primaire d'assurance maladie (régime général)",
      "publicConcerne": "Salariés du privé",
      "ij": {
        "regle": "tranche_revenu",
        "carenceJours": 3,
        "tauxBrut": 0.5,
        "formule": "0.5 * salaire_journalier_base (moyenne 3 derniers mois)",
        "plafondJournalier": "TO_VERIFY",
        "plafondDureeJours": 1095,
        "majorationFamilleApresJ31": {
          "active": true,
          "tauxMajore": 0.6633,
          "conditions": "À partir du 31e jour si 3 enfants à charge ou plus"
        }
      },
      "invalidite": {
        "calculBase": "SAM_10_meilleures_annees",
        "categories": {
          "cat1": {
            "definition": "Capable d'exercer une activité réduite",
            "tauxBase": 0.30,
            "plafondMensuel": "TO_VERIFY"
          },
          "cat2": {
            "definition": "Incapable d'exercer une activité",
            "tauxBase": 0.50,
            "plafondMensuel": "TO_VERIFY"
          },
          "cat3": {
            "definition": "Incapable + besoin d'une tierce personne",
            "tauxBase": 0.50,
            "majorationTiercePersonneMensuelle": "TO_VERIFY",
            "plafondMensuel": "TO_VERIFY"
          }
        },
        "ageBascule": 62
      },
      "capitalDeces": {
        "type": "montant_fixe",
        "montant": "TO_VERIFY",
        "conditions": "Versé aux ayants droit, sous conditions d'ouverture des droits"
      }
    },
    "SSI": {
      "nom": "Sécurité sociale des indépendants (ex-RSI, intégré au régime général depuis 2020)",
      "publicConcerne": "TNS commerçants, artisans, auto-entrepreneurs",
      "ij": {
        "regle": "tranche_revenu",
        "carenceJours": 3,
        "carenceJoursAccidentTravail": 0,
        "carenceJoursHospitalisation": 0,
        "formule": "1/730 du revenu annuel moyen des 3 dernières années",
        "plafondJournalier": "TO_VERIFY",
        "plancherJournalier": "TO_VERIFY",
        "conditionsEligibilite": "1 an d'affiliation minimum",
        "plafondDureeJours": 360
      },
      "invalidite": {
        "categories": {
          "totale_definitive": { "tauxBase": "TO_VERIFY" },
          "partielle_metier": { "tauxBase": "TO_VERIFY" }
        }
      },
      "capitalDeces": {
        "type": "forfaitaire",
        "montantActif": "TO_VERIFY",
        "montantRetraite": "TO_VERIFY"
      }
    },
    "CARMF": {
      "nom": "Caisse autonome de retraite des médecins de France",
      "publicConcerne": "Médecins libéraux",
      "ij": {
        "regle": "uniforme_par_classe",
        "carenceJours": 90,
        "carenceReductibleConventionMedicale": {
          "active": true,
          "carenceReduiteSecteur1": "TO_VERIFY",
          "conditions": "Médecins conventionnés secteur 1 ou secteur 2 OPTAM"
        },
        "classes": {
          "A": { "ijJournaliere": "TO_VERIFY" },
          "B": { "ijJournaliere": "TO_VERIFY" },
          "C": { "ijJournaliere": "TO_VERIFY" }
        },
        "plafondDureeJours": 1095
      },
      "invalidite": {
        "categories": {
          "totale": { "tauxBase": "TO_VERIFY" },
          "partielle": { "tauxBase": "TO_VERIFY" }
        }
      },
      "capitalDeces": {
        "type": "forfaitaire_par_classe",
        "montants": "TO_VERIFY"
      },
      "notes": "La couverture CARMF de base est notoirement insuffisante. Le contrat Madelin individuel est quasi systématiquement requis."
    },
    "CIPAV": {
      "nom": "Caisse interprofessionnelle de prévoyance et d'assurance vieillesse",
      "publicConcerne": "Architectes, géomètres, ingénieurs-conseils, professions libérales non réglementées (jusqu'à 2018 puis nouveaux statuts vers SSI)",
      "ij": {
        "regle": "introduit_en_2021",
        "carenceJours": 3,
        "formule": "1/730 du revenu annuel moyen des 3 dernières années",
        "plafondJournalier": "TO_VERIFY",
        "plafondDureeJours": 87
      },
      "invalidite": {
        "categories": {
          "totale_definitive": { "tauxBase": "TO_VERIFY" }
        }
      },
      "capitalDeces": {
        "type": "forfaitaire",
        "montant": "TO_VERIFY"
      },
      "notes": "IJ très récentes (2021) et de durée limitée. Contrat individuel quasi indispensable."
    },
    "CARPIMKO": {
      "nom": "Caisse autonome de retraite et de prévoyance des infirmiers, masseurs-kinés, pédicures, orthophonistes et orthoptistes",
      "publicConcerne": "Infirmiers libéraux, kinés, pédicures-podologues, orthophonistes, orthoptistes",
      "ij": {
        "regle": "uniforme",
        "carenceJours": 90,
        "ijJournaliere": "TO_VERIFY",
        "plafondDureeJours": 1095
      },
      "invalidite": {
        "categories": {
          "totale": { "tauxBase": "TO_VERIFY" }
        }
      },
      "capitalDeces": {
        "type": "forfaitaire",
        "montant": "TO_VERIFY"
      }
    },
    "MSA": {
      "nom": "Mutualité sociale agricole",
      "publicConcerne": "Exploitants et salariés agricoles",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CARCDSF": {
      "nom": "Caisse autonome de retraite des chirurgiens-dentistes et sages-femmes",
      "publicConcerne": "Chirurgiens-dentistes, sages-femmes",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CARPV": {
      "nom": "Caisse autonome de retraite et de prévoyance des vétérinaires",
      "publicConcerne": "Vétérinaires libéraux",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CNBF": {
      "nom": "Caisse nationale des barreaux français",
      "publicConcerne": "Avocats",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CAVOM": {
      "nom": "Caisse d'assurance vieillesse des officiers ministériels",
      "publicConcerne": "Huissiers, commissaires-priseurs, etc.",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CAVEC": {
      "nom": "Caisse d'assurance vieillesse des experts-comptables et commissaires aux comptes",
      "publicConcerne": "Experts-comptables, commissaires aux comptes",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CAVAMAC": {
      "nom": "Caisse d'allocation vieillesse des agents généraux d'assurance",
      "publicConcerne": "Agents généraux d'assurance",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    },
    "CRN": {
      "nom": "Caisse de retraite des notaires",
      "publicConcerne": "Notaires (en complément du régime de base et CARCDSF)",
      "ij": { "TO_FILL": true },
      "invalidite": { "TO_FILL": true },
      "capitalDeces": { "TO_FILL": true }
    }
  }
}
```

> Les `TO_VERIFY` / `TO_FILL` sont volontaires : la rédaction de cette spec **ne doit pas inventer** de valeurs précises. David remplit le fichier sur la base des sources officielles avant mise en production. Le moteur tolère les `TO_VERIFY` (renvoie un constat « caisse non documentée », n'invente pas).

### 5.5 Schéma `ccn-2026.json`

```json
{
  "millesime": 2026,
  "dateVerification": "2026-05-27",
  "sources": [
    "Légifrance / base KALI",
    "Service-public.fr — Maintien légal de salaire L.1226-1 C. trav.",
    "Décret 2021-1002 — catégories objectives"
  ],
  "maintienLegal": {
    "description": "Loi Mensualisation, L.1226-1 et D.1226-1 et s. C. trav.",
    "carenceJours": 7,
    "anciennetePivot": {
      "min": 1,
      "max": 30
    },
    "paliers": [
      { "ancienneteMois": 12,  "joursA90Pct": 30,  "joursA6666Pct": 30 },
      { "ancienneteMois": 72,  "joursA90Pct": 40,  "joursA6666Pct": 40 },
      { "ancienneteMois": 132, "joursA90Pct": 50,  "joursA6666Pct": 50 },
      { "ancienneteMois": 192, "joursA90Pct": 60,  "joursA6666Pct": 60 },
      { "ancienneteMois": 252, "joursA90Pct": 70,  "joursA6666Pct": 70 },
      { "ancienneteMois": 312, "joursA90Pct": 80,  "joursA6666Pct": 80 },
      { "ancienneteMois": 372, "joursA90Pct": 90,  "joursA6666Pct": 90 }
    ],
    "note": "Maintien LÉGAL minimal — toute CCN qui fixe mieux s'applique en priorité."
  },
  "conventions": {
    "1486": {
      "idcc": "1486",
      "nom": "Bureaux d'études techniques, cabinets d'ingénieurs-conseils et sociétés de conseils (Syntec)",
      "datesVerification": "2026-05-27",
      "maintienEmployeur": {
        "carenceJours": 0,
        "subrogation": true,
        "paliers": [
          { "ancienneteMois": 12, "joursA100Pct": 30, "joursA6666Pct": 60 },
          { "ancienneteMois": 60, "joursA100Pct": 45, "joursA6666Pct": 75 },
          { "ancienneteMois": 120, "joursA100Pct": 60, "joursA6666Pct": 90 }
        ],
        "note": "TO_VERIFY — barème à vérifier dans la CCN à jour"
      },
      "prevoyanceCadres": {
        "tauxT1Minimum": 1.50,
        "garantiesMinimum": {
          "capitalDC": "TO_VERIFY",
          "renteConjoint": "TO_VERIFY",
          "renteEducation": "TO_VERIFY",
          "ij": "TO_VERIFY",
          "invalidite": "TO_VERIFY"
        }
      },
      "prevoyanceNonCadres": null,
      "santeMinimum": {
        "panier": "ANI",
        "participationEmployeur": "TO_VERIFY"
      },
      "retraiteSupplementaire": null
    },
    "3248": {
      "idcc": "3248",
      "nom": "Métallurgie (CCN unifiée)",
      "datesVerification": "2026-05-27",
      "maintienEmployeur": {
        "carenceJours": "TO_VERIFY",
        "subrogation": "TO_VERIFY",
        "paliers": [
          { "ancienneteMois": "TO_VERIFY", "joursA100Pct": "TO_VERIFY", "joursA6666Pct": "TO_VERIFY" }
        ],
        "note": "TO_FILL — CCN unifiée 2024, barèmes par classes A à I"
      },
      "prevoyanceCadres": { "TO_FILL": true },
      "prevoyanceNonCadres": { "TO_FILL": true },
      "santeMinimum": { "TO_FILL": true }
    },
    "1979": {
      "idcc": "1979",
      "nom": "Hôtels, cafés, restaurants (HCR)",
      "datesVerification": "2026-05-27",
      "maintienEmployeur": { "TO_FILL": true },
      "prevoyanceCadres": null,
      "prevoyanceNonCadres": { "TO_FILL": true },
      "santeMinimum": { "TO_FILL": true }
    }
  }
}
```

Pour la liste complète des CCN à inclure, voir **section 12**.

### 5.6 Critère « fait »

- Trois fichiers JSON présents et valides (`JSON.parse` OK)
- `index.ts` charge correctement, type inféré
- Pour Tranche 1 (10 CCN les plus fréquentes), au moins les **paliers de maintien employeur** sont remplis (le reste peut rester `TO_FILL` et sera complété au fil de l'eau)
- Pour Tranche 1 (12 caisses), au moins **IJ + invalidité cat 2 + capital décès** sont remplis
- PASS 2026 entièrement rempli
- Aucune valeur inventée — toutes les valeurs sont accompagnées de leur source dans le bloc `sources` du JSON

---

## 6. Lot 4 — Moteur de projection (arrêt maladie + invalidité)

### 6.1 Types

```typescript
// src/lib/prevoyance/types.ts

export type CategorieInvalidite = "cat1" | "cat2" | "cat3";

export type ContratIndividuel = {
  id: string;
  type:
    | "deces_capital"      // capital décès
    | "deces_rente_conj"   // rente conjoint
    | "deces_rente_educ"   // rente éducation
    | "ij"                 // indemnités journalières (complémentaires)
    | "invalidite"
    | "ptia"
    | "dependance"
    | "gav";
  capitalOuMontant: number;  // capital DC, ou IJ jour, ou rente mensuelle invalidité
  franchiseJours?: number;   // pour IJ : franchise du contrat
  plafondJoursIJ?: number;
  baseInvalidite?: number;   // % de revenu remplacé (pour invalidité)
  conditions?: string;       // texte libre, juste pour affichage
};

export type CouvertureCollective = {
  // Renseigné par le client à partir de sa notice
  ij?: {
    pctSalaire: number;        // ex 80% du brut
    franchise: number;         // en jours
    plafondJours: number;
    baseCalcul: "T1_T2" | "T1_seul" | "brut_total";
  };
  invalidite?: {
    cat1: { pctSalaire: number };
    cat2: { pctSalaire: number };
    cat3: { pctSalaire: number };
  };
  capitalDeces?: {
    montant: number;
    baseFormule?: string;    // "100% T1+T2"
  };
};

export type EntreePerso = {
  age: number;
  statutPro: StatutPro;
  caisse: CodeCaisse;
  idccCCN: string | null;
  ancienneteMois: number;
  salaireBrutAnnuel: number;
  salaireNetMensuel: number;        // approximé pour affichage : brut * 0.78 par défaut
  revenuTNSAnnuel?: number;          // si TNS
  classeCotisationCaisse?: string;   // pour CARMF : "A" | "B" | "C"
  contratsIndividuels: ContratIndividuel[];
  couvertureCollective: CouvertureCollective | null;
};

export type SerieEmpilee = {
  // Tableau aligné sur axe[]
  salaire: number[];
  maintienEmployeur: number[];
  ijObligatoire: number[];
  ijComplementaireCollective: number[];
  ijComplementaireIndividuelle: number[];
  pensionInvalObligatoire: number[];
  renteInvalCollective: number[];
  renteInvalIndividuelle: number[];
};

export type RuptureCle = {
  jour: number;
  libelle: string;
  impactNet: number;      // delta de revenu mensuel à ce jour
  type: "fin_maintien" | "fin_palier_ij" | "bascule_invalidite" | "fin_invalidite" | "autre";
};

export type ProjectionResult = {
  axe: Array<{ jour: number; date: string; phase: "am" | "invalidite" }>;
  series: SerieEmpilee;
  revenuReferenceMensuel: number;
  rupturesCles: RuptureCle[];
  basculeInvaliditeJour: number;       // typiquement 1095
  finProjectionJour: number;            // âge légal retraite × 365
  categorieInvaliditeProjetee: CategorieInvalidite;
};
```

### 6.2 Algorithme — vue haut niveau

```
INPUT : EntreePerso + categorieInvaliditeProjetee + referentiels (pass, caisses, ccn)
OUTPUT : ProjectionResult

ETAPE 1 — Construire l'axe temporel
  Axe de paliers fins en phase AM (J0, J3, J7, J14, J30, J60, J90, J120,
    J180, J365, J547, J730, J912, J1095)
  Puis annuel en phase invalidité (année 4, 5, ... jusqu'à l'âge légal)
  finProjectionJour = (ageRetraite - age) * 365

ETAPE 2 — Pour chaque jour t de l'axe AM (0 ≤ t < 1095) :
  2a. Salaire normal = 0 (le client est arrêté)
  2b. Maintien employeur (salariés) :
      lire ccn[idcc].maintienEmployeur (ou maintienLegal si pas de CCN)
      déterminer le palier applicable selon ancienneteMois
      calculer fenêtreA100, fenêtreA6666 (en jours, partant de t=carence)
      si t < fenêtreA100 : maintien = salaireMensuelNet * (1 - %ij/salaireMensuel)
      si fenêtreA100 ≤ t < fenêtreA100 + fenêtreA6666 : maintien = salaireMensuelNet * 0.6666
      sinon : maintien = 0
      (rappel : maintien employeur est en COMPLEMENT des IJSS, il complète)
  2c. IJ régime obligatoire :
      lire caisses[caisse].ij
      si t < carenceJours : 0
      sinon : ij_journaliere * 30 (mensuel)
      tenir compte du plafondJournalier et plafondDureeJours
  2d. IJ complémentaire collective :
      si couvertureCollective.ij existe :
        si t < franchise collective : 0
        sinon : pctSalaire * baseCalcul - (IJ obligatoire + maintien employeur)
        (la collective complète ce qui manque jusqu'à pctSalaire du brut)
      borné à 0 (jamais négatif)
  2e. IJ complémentaire individuelle :
      pour chaque contrat type "ij" :
        si t < contrat.franchiseJours : 0
        sinon : contrat.capitalOuMontant (par jour) * 30
        tenir compte du plafondJoursIJ

ETAPE 3 — Pour chaque jour t de l'axe invalidité (t ≥ 1095) :
  3a. Pension invalidité obligatoire :
      catégorie = categorieInvaliditeProjetee
      lire caisses[caisse].invalidite.categories[cat].tauxBase
      pension = salaireBrutAnnuel * tauxBase / 12   (mensuel)
      borner par plafondMensuel si défini
      si cat3 : ajouter majorationTiercePersonne
      arrêter à ageRetraite (passage en retraite)
  3b. Rente invalidité collective :
      si couvertureCollective.invalidite[cat] existe :
        rente = pctSalaire * salaireBrutMensuel - pensionInvalObligatoire
        bornée à 0
  3c. Rente invalidité individuelle :
      pour chaque contrat type "invalidite" :
        rente = (contrat.baseInvalidite ?? 0.5) * (salaireBrutMensuel ou revenuTNSMensuel)

ETAPE 4 — Détecter et annoter les ruptures
  Repérer chaque transition (fin maintien 100%, fin maintien 66%, bascule invalidité,
    fin plafond IJ, etc.) et créer un RuptureCle avec impactNet calculé.

ETAPE 5 — Retourner ProjectionResult
```

### 6.3 Signature publique

```typescript
// src/lib/prevoyance/projection.ts

export function projeterArretMaladie(
  entree: EntreePerso,
  categorie: CategorieInvalidite = "cat2",
  referentiels: typeof import("../../data/prevoyance").referentiels
): ProjectionResult;
```

### 6.4 Cas particuliers à gérer

| Cas | Comportement attendu |
|---|---|
| Caisse `TO_FILL` dans le référentiel | Retourner un `ProjectionResult` partiel avec `series` à 0 pour les étages indisponibles + ajouter une `RuptureCle` type "autre" libellée « Données régime obligatoire non disponibles, à compléter » |
| CCN inconnue (IDCC absent du référentiel) | Tomber sur le maintien LÉGAL (L.1226-1) avec un flag `useLegalDefault: true` dans le résultat |
| Salarié sans ancienneté suffisante (< 1 an chez Mensualisation) | Aucun maintien employeur, IJSS seules |
| TNS sans Madelin et caisse à 90 jours de carence | Les 3 premiers mois doivent ressortir à zéro de revenu — c'est le but pédagogique |
| Catégorie invalidité 3 | Inclure la majoration tierce personne quand renseignée |
| Âge proche retraite | Arrêter la projection à `ageRetraite * 365` jours (clamp final) |

### 6.5 Critère « fait »

- Fonction `projeterArretMaladie` exportée et typée
- 30+ tests Vitest passent (cf. Lot 5)
- Aucun `NaN` ni `undefined` dans la série retournée
- Performances : < 50 ms pour un cas standard (mesuré dans un test de perf)

---

## 7. Lot 5 — Tests Vitest (cas d'or)

### 7.1 Les 4 cas d'or

#### Cas A — Mathieu, salarié cadre Syntec

```typescript
const casA: EntreePerso = {
  age: 35,
  statutPro: "salarie_cadre",
  caisse: "CPAM",
  idccCCN: "1486",          // Syntec
  ancienneteMois: 48,        // 4 ans
  salaireBrutAnnuel: 55000,
  salaireNetMensuel: 3575,   // approximé 55000 * 0.78 / 12
  contratsIndividuels: [],
  couvertureCollective: {
    ij: { pctSalaire: 0.80, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" },
    invalidite: {
      cat1: { pctSalaire: 0.40 },
      cat2: { pctSalaire: 0.80 },
      cat3: { pctSalaire: 1.00 }
    },
    capitalDeces: { montant: 55000, baseFormule: "100% T1+T2" }
  }
};
```

**Valeurs attendues** (à valider par David avant de figer les tests) :
- J0 : revenu de référence ~3575 €/mois (salaire net)
- J7 : revenu = maintien Syntec 100% (subrogation, pas de carence) → ~3575 €
- J45 : encore en maintien 100% → ~3575 €
- J90 : transition maintien 100% → maintien 66% + complémentaire prévoyance (sans franchise dépassée pour la complémentaire si franchise = 90j → tout juste activée)
- J180 : fin maintien employeur, prévoyance collective Syntec → 80% du brut
- J1095 : bascule invalidité cat 2 → 80% du salaire (rente collective complète l'IJSS cat 2 à 50%)

#### Cas B — Dr Lefèvre, médecin libéral CARMF

```typescript
const casB: EntreePerso = {
  age: 48,
  statutPro: "tns_liberal",
  caisse: "CARMF",
  idccCCN: null,
  ancienneteMois: 0,
  salaireBrutAnnuel: 0,       // pas salarié
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 95000,
  classeCotisationCaisse: "B", // classe moyenne CARMF
  contratsIndividuels: [
    {
      id: "madelin_ij",
      type: "ij",
      capitalOuMontant: 250,
      franchiseJours: 90,
      plafondJoursIJ: 1095
    },
    {
      id: "madelin_inv",
      type: "invalidite",
      capitalOuMontant: 0,
      baseInvalidite: 0.50
    },
    {
      id: "madelin_dc",
      type: "deces_capital",
      capitalOuMontant: 200000
    }
  ],
  couvertureCollective: null
};
```

**Valeurs attendues** :
- J0 à J89 : revenu = 0 (CARMF franchise 90j, Madelin IJ franchise 90j aussi) → **trou massif** pédagogique
- J90 à J1095 : IJ CARMF classe B + IJ Madelin 250×30 = 7500 €/mois
- J1095 → invalidité cat totale CARMF + rente Madelin 50% BNC
- Capital décès en cas de DC : 200k Madelin + capital CARMF par classe

#### Cas C — Léa, salariée non-cadre Métallurgie

```typescript
const casC: EntreePerso = {
  age: 28,
  statutPro: "salarie_non_cadre",
  caisse: "CPAM",
  idccCCN: "3248",          // Métallurgie unifiée
  ancienneteMois: 12,        // 1 an
  salaireBrutAnnuel: 28000,
  salaireNetMensuel: 1820,
  contratsIndividuels: [],
  couvertureCollective: null
};
```

**Valeurs attendues** :
- J0 à J6 : revenu = 0 (carence employeur Métallurgie + carence IJSS 3j)
- J7 à J36 : IJSS + maintien Métallurgie palier 1 an (30j à ~90%)
- J37 à J90 : IJSS seules (fin maintien à 1 an d'ancienneté pour Métallurgie)
- J90 : exposition au plafond IJSS ~50% salaire brut → ~933 €/mois
- J1095 : invalidité cat 2 CPAM → 50% SAM, plafonné, **sans complémentaire** → exposition maximale

#### Cas D — Pierre, gérant majoritaire SSI

```typescript
const casD: EntreePerso = {
  age: 52,
  statutPro: "gerant_majoritaire",
  caisse: "SSI",
  idccCCN: null,
  ancienneteMois: 0,
  salaireBrutAnnuel: 0,
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 60000,
  contratsIndividuels: [
    {
      id: "madelin_ij",
      type: "ij",
      capitalOuMontant: 120,
      franchiseJours: 30,
      plafondJoursIJ: 1095
    },
    {
      id: "madelin_inv",
      type: "invalidite",
      capitalOuMontant: 0,
      baseInvalidite: 0.60
    },
    {
      id: "madelin_dc",
      type: "deces_capital",
      capitalOuMontant: 300000
    },
    {
      id: "madelin_rente_conj",
      type: "deces_rente_conj",
      capitalOuMontant: 1500
    }
  ],
  couvertureCollective: null
};
```

**Valeurs attendues** :
- J0 à J2 : 0 (carence SSI 3j)
- J3 à J29 : IJ SSI seules
- J30 à J1094 : IJ SSI + Madelin 120×30 = 3600 €/mois
- J1095 → invalidité totale définitive SSI + rente Madelin 60% TNS

### 7.2 Structure des tests

```typescript
// src/__tests__/prevoyance/projection.test.ts

import { describe, expect, it } from "vitest";
import { projeterArretMaladie } from "../../lib/prevoyance/projection";
import { referentiels } from "../../data/prevoyance";
import { casA, casB, casC, casD } from "./fixtures";

describe("Projection arrêt maladie + invalidité", () => {
  describe("Cas A — Salarié cadre Syntec", () => {
    const result = projeterArretMaladie(casA, "cat2", referentiels);

    it("revenu de référence ≈ salaire net", () => {
      expect(result.revenuReferenceMensuel).toBeCloseTo(3575, -1);
    });

    it("maintien Syntec 100% à J45", () => {
      const idxJ45 = result.axe.findIndex(j => j.jour === 45);
      const total =
        result.series.maintienEmployeur[idxJ45] +
        result.series.ijObligatoire[idxJ45] +
        result.series.ijComplementaireCollective[idxJ45];
      expect(total).toBeCloseTo(3575, 0);
    });

    it("bascule invalidité à J1095", () => {
      expect(result.basculeInvaliditeJour).toBe(1095);
      const rupture = result.rupturesCles.find(r => r.type === "bascule_invalidite");
      expect(rupture).toBeDefined();
    });

    // ... 6-8 tests par cas
  });

  // Cas B, C, D : même structure
});
```

### 7.3 Tests de robustesse

En plus des cas d'or, tester :

- Caisse `TO_FILL` → retourne projection partielle sans crash
- IDCC inconnu → fallback maintien légal
- Salaire = 0 → projection à 0 sans NaN
- Âge = 64 (proche retraite) → projection clamp à âge légal
- Catégorie invalidité 3 → majoration tierce personne incluse
- Ancienneté = 0 → pas de maintien employeur

### 7.4 Critère « fait »

- Au moins 30 tests passent, dont les 4 cas d'or × 6-8 assertions chacun
- 100 % des branches du moteur sont couvertes (vérifié avec `vitest --coverage`)
- Aucun warning React/TS

---

## 8. Lot 6 — Moteur de règles & constats

### 8.1 Type `Constat`

```typescript
// src/lib/prevoyance/types.ts

export type Constat = {
  id: string;                     // identifiant stable pour les tests
  severite: "info" | "attention" | "alerte" | "non_conformite";
  axe: "deces" | "incapacite" | "invalidite" | "retraite" | "sante" | "dependance" | "conformite";
  cible: "p1" | "p2" | "entreprise";
  titre: string;                  // court — affiché en gras
  detail: string;                 // explication argumentée — 1 à 3 phrases
  reference?: string;             // "art. L.911-7 CSS" ou "CCN Syntec art. 11"
  action: string;                 // ce que le CGP propose — sans nommer d'assureur
  impactChiffre?: {
    montant: number;
    libelle: string;              // "Trou de revenu mensuel à J180"
  };
};
```

### 8.2 Catalogue de règles (minimum à livrer en v1)

**Sur l'axe DC** :
- `dc_tns_sans_capital` — TNS sans capital décès individuel : alerte rouge si conjoint à charge ou enfants mineurs.
- `dc_capital_insuffisant_dettes` — Capital DC < dettes immobilières : attention orange avec montant du trou.
- `dc_pas_de_rente_conjoint_enfants_jeunes` — Pas de rente conjoint et enfants < 16 ans : alerte rouge.

**Sur l'axe incapacité** :
- `ij_carence_caisse_sans_madelin` — TNS caisse à franchise ≥ 60j sans IJ individuelle : alerte rouge (cf. cas B et D).
- `ij_plafond_insuffisant` — Trou > 30 % du revenu de référence à J180 : attention orange.
- `ij_pas_de_subrogation` — CCN sans subrogation et IJSS plafonnées : info.

**Sur l'axe invalidité** :
- `inv_cat2_aucune_couverture_compl` — Rente invalidité cat 2 < 60 % du revenu sans couverture complémentaire : alerte rouge.
- `inv_tns_madelin_absent` — TNS sans rente invalidité individuelle : alerte rouge.

**Sur l'axe conformité collective** (TabPrevoyanceCollective) :
- `conf_cadres_15_t1` — Cadres dans l'entreprise et `tauxT1Cadres < 1.50` : **non-conformité** (art. 7 AGIRC abrogé, reprise CCN cadres + ANI 17 nov 2017).
- `conf_ani_sante_obligatoire` — Salariés présents et pas de complémentaire santé collective : **non-conformité** (art. L.911-7 CSS).
- `conf_categories_objectives_invalides` — Catégorie non conforme au décret 2021-1002 : **non-conformité**.
- `conf_ccn_branche_obligatoire_non_respectee` — Plancher de branche non atteint : **non-conformité**.

### 8.3 Exemple d'implémentation d'une règle

```typescript
// src/lib/prevoyance/regles.ts

import type { Constat, EntreePerso, ProjectionResult } from "./types";

type ContexteRegle = {
  entree: EntreePerso;
  projection: ProjectionResult;
  // accès aux dettes du foyer pour le check capital DC
  dettesImmobilieres: number;
  conjointACharge: boolean;
  enfantsMineurs: number;
};

export type Regle = (ctx: ContexteRegle, cible: "p1" | "p2") => Constat | null;

export const regleDcCapitalInsuffisantDettes: Regle = (ctx, cible) => {
  const capitalDC = ctx.entree.contratsIndividuels
    .filter(c => c.type === "deces_capital")
    .reduce((s, c) => s + c.capitalOuMontant, 0);

  // + capital décès régime obligatoire (lu depuis le référentiel via projection)
  // → omis ici pour la lisibilité, voir l'implémentation

  if (capitalDC >= ctx.dettesImmobilieres) return null;

  const trou = ctx.dettesImmobilieres - capitalDC;
  return {
    id: `dc_capital_insuffisant_dettes_${cible}`,
    severite: "attention",
    axe: "deces",
    cible,
    titre: "Capital décès insuffisant pour apurer les dettes immobilières",
    detail:
      `Le capital décès cumulé (régime obligatoire + contrats individuels) ` +
      `est de ${capitalDC.toLocaleString("fr-FR")} € alors que les dettes ` +
      `immobilières en cours s'élèvent à ${ctx.dettesImmobilieres.toLocaleString("fr-FR")} €.`,
    action:
      `Évaluer le besoin de souscription d'un capital décès additionnel d'environ ` +
      `${trou.toLocaleString("fr-FR")} €, ou réviser à la baisse le besoin si une ` +
      `assurance emprunteur DC est en place sur la dette.`,
    impactChiffre: { montant: trou, libelle: "Trou de capital décès" }
  };
};
```

### 8.4 Orchestration

```typescript
export function evaluerToutesLesRegles(ctx: ContexteRegle): Constat[] {
  const regles: Regle[] = [
    regleDcCapitalInsuffisantDettes,
    regleIjCarenceCaisseSansMadelin,
    // ...
  ];

  const constats: Constat[] = [];
  for (const cible of ["p1", "p2"] as const) {
    for (const regle of regles) {
      const c = regle(ctx, cible);
      if (c) constats.push(c);
    }
  }
  return constats.sort(comparerSeverite);
}
```

### 8.5 Critère « fait »

- Tous les constats du catalogue v1 implémentés
- Un test Vitest par règle (cas positif + cas négatif)
- Constats triés par sévérité (non_conformité > alerte > attention > info)
- Aucune référence à un assureur ou produit nommé dans les `action`

---

## 9. Lot 7 — UI TabPrevoyancePerso

### 9.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ TabPrevoyancePerso                                       │
│                                                          │
│  ┌──────────────────────┐ ┌──────────────────────┐      │
│  │  Personne 1          │ │  Personne 2          │      │
│  │  ────────────        │ │  ────────────        │      │
│  │  [BlocStatutCaisse]  │ │  [BlocStatutCaisse]  │      │
│  │  [BlocContratsInd]   │ │  [BlocContratsInd]   │      │
│  │  ┌────────────────┐  │ │  ┌────────────────┐  │      │
│  │  │ PROJECTION     │  │ │  │ PROJECTION     │  │      │
│  │  │ ○ Cat1         │  │ │  │ ○ Cat1         │  │      │
│  │  │ ● Cat2         │  │ │  │ ● Cat2         │  │      │
│  │  │ ○ Cat3         │  │ │  │ ○ Cat3         │  │      │
│  │  │ [graphique]    │  │ │  │ [graphique]    │  │      │
│  │  │ [tableau]      │  │ │  │ [tableau]      │  │      │
│  │  └────────────────┘  │ │  └────────────────┘  │      │
│  │  [BlocConstats]      │ │  [BlocConstats]      │      │
│  └──────────────────────┘ └──────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

Sur écran < 1280 px, les deux colonnes s'empilent verticalement.
Si pas de P2, une seule colonne en pleine largeur (centrée).

### 9.2 Composant `ProjectionChart.tsx`

```tsx
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
         Tooltip, Legend, ReferenceLine, ReferenceArea } from "recharts";

type Props = {
  projection: ProjectionResult;
  themeColors: { navy: string; gold: string; sky: string; sand: string; cream: string };
};

export function ProjectionChart({ projection, themeColors }: Props) {
  // Transformer projection.axe + projection.series en data Recharts
  const data = projection.axe.map((point, idx) => ({
    jour: point.jour,
    labelX: formatLabelX(point.jour, point.phase),
    salaire: projection.series.salaire[idx],
    maintien: projection.series.maintienEmployeur[idx],
    ijObl: projection.series.ijObligatoire[idx],
    ijColl: projection.series.ijComplementaireCollective[idx],
    ijInd: projection.series.ijComplementaireIndividuelle[idx],
    pensionInvalObl: projection.series.pensionInvalObligatoire[idx],
    renteInvalColl: projection.series.renteInvalCollective[idx],
    renteInvalInd: projection.series.renteInvalIndividuelle[idx],
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={data}>
        <XAxis dataKey="labelX" />
        <YAxis tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {/* Référence : revenu de référence en ligne pointillée */}
        <ReferenceLine
          y={projection.revenuReferenceMensuel}
          stroke={themeColors.navy}
          strokeDasharray="4 4"
          label="Revenu de référence"
        />

        {/* Bascule AM → invalidité */}
        <ReferenceLine
          x={formatLabelX(projection.basculeInvaliditeJour, "am")}
          stroke={themeColors.gold}
          strokeWidth={2}
          label="Reconnaissance invalidité"
        />

        <Area dataKey="maintien"        stackId="1" fill={themeColors.navy} name="Maintien employeur" />
        <Area dataKey="ijObl"           stackId="1" fill={themeColors.sky}  name="IJ régime obligatoire" />
        <Area dataKey="ijColl"          stackId="1" fill={themeColors.sand} name="IJ prévoyance collective" />
        <Area dataKey="ijInd"           stackId="1" fill={themeColors.gold} name="IJ prévoyance individuelle" />
        <Area dataKey="pensionInvalObl" stackId="1" fill={themeColors.sky}  name="Pension invalidité (régime obligatoire)" />
        <Area dataKey="renteInvalColl"  stackId="1" fill={themeColors.sand} name="Rente invalidité collective" />
        <Area dataKey="renteInvalInd"   stackId="1" fill={themeColors.gold} name="Rente invalidité individuelle" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatLabelX(jour: number, phase: "am" | "invalidite"): string {
  if (phase === "am") {
    if (jour === 0) return "J0";
    if (jour < 30) return `J${jour}`;
    if (jour < 365) return `${Math.round(jour / 30)} mois`;
    return `${(jour / 365).toFixed(1)} an${jour > 365 ? "s" : ""}`;
  }
  return `${(jour / 365).toFixed(0)} ans`;
}
```

### 9.3 Composant `TableauJalons.tsx`

Affiche un tableau récap des jalons clés :

| Jalon | Revenu mensuel | % du revenu de référence | Détail |
|---|---|---|---|
| J7 | 3 575 € | 100 % | Maintien Syntec 100 % |
| J90 | 3 575 € | 100 % | Maintien Syntec 100 % (dernier jour) |
| J91 | 2 530 € | 71 % | Maintien 66 % + IJSS + prévoyance coll. (franchise atteinte) |
| J180 | 2 860 € | 80 % | Prévoyance collective Syntec 80 % |
| 3 ans (invalidité cat 2) | 2 860 € | 80 % | Bascule invalidité — rente coll. + pension Sécu |
| 10 ans | 2 860 € | 80 % | Maintenu jusqu'à âge légal |

### 9.4 Composant `BlocConstats.tsx`

Liste des constats triés par sévérité, chaque constat affiché en carte :

```
┌────────────────────────────────────────────────────────┐
│ 🔴 ALERTE — DC | Capital décès insuffisant pour les   │
│              dettes immobilières                       │
│                                                         │
│ Le capital décès cumulé est de 0 € alors que les       │
│ dettes immobilières en cours s'élèvent à 280 000 €.    │
│                                                         │
│ → Évaluer le besoin d'un capital décès additionnel     │
│   d'environ 280 000 €.                                 │
│                                                         │
│ Trou identifié : 280 000 €                             │
└────────────────────────────────────────────────────────┘
```

Couleurs par sévérité :
- `non_conformite` : rouge (#DC2626) avec icône ⚠️
- `alerte` : rouge plus doux (#EF4444)
- `attention` : orange (#F59E0B)
- `info` : bleu (#3B82F6)

### 9.5 Critère « fait »

- Onglet ajouté à la nav (icône cœur 🛡️ ou similaire)
- P1 et P2 affichés indépendamment
- Graphique Recharts fonctionne avec les 4 cas d'or
- Tableau jalons mis à jour à chaque modification
- Constats triés par sévérité
- Aucune dépendance npm ajoutée

---

## 10. Lot 8 — UI TabPrevoyanceCollective

### 10.1 Affichage conditionnel

```typescript
// Logique d'affichage de l'onglet
const isDirigeant = (statut: StatutPro) =>
  ["gerant_majoritaire", "president_sas", "eurl_unique"].includes(statut);

const p1EstDirigeant = isDirigeant(payload.travail?.p1?.statutPro);
const p2EstDirigeant = isDirigeant(payload.travail?.p2?.statutPro);
const auMoinsUnDirigeant = p1EstDirigeant || p2EstDirigeant;

if (auMoinsUnDirigeant) {
  // Onglet actif, contexte "votre entreprise"
} else {
  // Onglet grisé avec toggle "Activer (analyse externe RH/audit)"
}
```

### 10.2 Layout en mode dirigeant

```
┌─────────────────────────────────────────────────────────┐
│ TabPrevoyanceCollective                                  │
│ Dirigeant analysé : Pierre (P2) — SARL DUPONT           │
│                                                          │
│  [BlocEntreprise]                                       │
│    SIRET, raison sociale, IDCC, effectif...             │
│                                                          │
│  [BlocCouvertureCollective]                             │
│    Santé en place ? Prévoyance cadres ? Retraite supp ? │
│                                                          │
│  [BlocAuditConformite]                                  │
│    ✅ Santé ANI conforme (panier de soins respecté)      │
│    ❌ NON-CONFORMITÉ — Cadres présents, taux T1 < 1,50% │
│    ✅ Catégories objectives conformes décret 2021-1002  │
│    ⚠️  CCN Syntec — plancher capital décès non atteint   │
│                                                          │
│  [BlocConstats — axe entreprise]                        │
│    Mêmes constats type que TabPerso, mais "cible:       │
│    entreprise"                                          │
└─────────────────────────────────────────────────────────┘
```

### 10.3 Layout en mode « analyse externe »

```
┌─────────────────────────────────────────────────────────┐
│ TabPrevoyanceCollective                                  │
│ ⚠️ MODE ANALYSE EXTERNE — Cette analyse concerne        │
│    l'entreprise d'un tiers (employeur du client en       │
│    contexte RH, audit, ou conseil non personnel).        │
│                                                          │
│ ┌─ Saisie ─────────────────────────────────────┐        │
│ │ SIRET de l'entreprise à analyser : [______]  │        │
│ │ [Résoudre]                                    │        │
│ └────────────────────────────────────────────────┘       │
│                                                          │
│ Puis mêmes blocs que mode dirigeant.                    │
└─────────────────────────────────────────────────────────┘
```

### 10.4 Audit conformité — détail

```typescript
// src/lib/prevoyance/audit-collectif.ts

export type AuditConformite = {
  entreprise: EntrepriseAudit;
  controles: ControleConformite[];
  scoreGlobal: number;          // 0-100, indicatif
};

export type ControleConformite = {
  id: string;
  axe: "sante" | "prevoyance" | "categories_objectives" | "retraite_supp" | "ccn";
  libelle: string;
  statut: "conforme" | "non_conforme" | "vigilance" | "non_applicable";
  reference: string;            // article CSS / CCN
  detail: string;
  actionCorrective?: string;
};
```

**Contrôles minimum à implémenter** :

1. `c_sante_ani_obligatoire` — Si effectif > 0 et secteur privé : la santé collective est-elle déclarée ? art. L.911-7 CSS.
2. `c_cadres_15_t1` — Si présence cadres : taux T1 prévoyance ≥ 1,50 % ? (reprise CCN cadres + ANI 17 nov 2017).
3. `c_categories_objectives` — Catégorie déclarée conforme décret 2021-1002 (CSP, cadres/non-cadres, sous-catégorie objective) ?
4. `c_ccn_branche_prevoyance` — Si CCN identifiée et impose une prévoyance : minimum atteint ?
5. `c_ccn_branche_sante` — Si CCN impose un panier > ANI : minimum atteint ?
6. `c_forfait_social_correctement_applique` — Effectif < 11 → 0 %, sinon 20 % standard.

### 10.5 Critère « fait »

- Onglet affiché correctement selon le statut
- Toggle « analyse externe » fonctionnel
- Audit produit au moins 6 contrôles
- Constats remontés au format `Constat` partagé avec TabPerso
- Toute non-conformité a une `actionCorrective` libellée sans nom d'assureur

---

## 11. Lot 9 — Câblage Pack PDF v2

### 11.1 Adapters

```typescript
// src/lib/pdf/v2/adapters/buildPrevoyancePersoData.ts

import type { ProjectionResult, Constat } from "../../../prevoyance/types";

export type PrevoyancePersoPageData = {
  pagePosition: string;       // "X / N" calculé par concatPack
  personneLibelle: string;    // "Mathieu DUPONT"
  statutLibelle: string;      // "Salarié cadre"
  caisseLibelle: string;      // "CPAM (régime général)"
  ccnLibelle: string | null;  // "Syntec (IDCC 1486)"
  revenuReference: number;
  projection: ProjectionResult;
  graphiqueSVG: string;       // SVG inline généré côté React puis sérialisé
  jalons: Array<{
    libelle: string;
    revenuMensuel: number;
    pctReference: number;
    detail: string;
  }>;
  constats: Constat[];
};

export function buildPrevoyancePersoData(
  // ... inputs
): PrevoyancePersoPageData {
  // ...
}
```

### 11.2 Rendu HTML de page

```typescript
// src/lib/pdf/v2/pages/pagePrevoyancePerso.ts

import { coquillePage, encartNotreLecture, tableauTitresDores } from "../primitives";

export function pagePrevoyancePerso(data: PrevoyancePersoPageData): string {
  return coquillePage({
    pagePosition: data.pagePosition,
    titre: `Prévoyance personnelle — ${data.personneLibelle}`,
    contenu: `
      <div class="bloc-identite">
        <div><strong>Statut</strong> : ${data.statutLibelle}</div>
        <div><strong>Régime</strong> : ${data.caisseLibelle}</div>
        ${data.ccnLibelle ? `<div><strong>CCN</strong> : ${data.ccnLibelle}</div>` : ""}
        <div><strong>Revenu de référence</strong> : ${euro(data.revenuReference)} / mois</div>
      </div>

      <h3>Projection en cas d'arrêt de travail</h3>
      <div class="graphique">${data.graphiqueSVG}</div>

      <h3>Points clés</h3>
      ${tableauTitresDores({
        entetes: ["Jalon", "Revenu mensuel", "% référence", "Détail"],
        lignes: data.jalons.map(j => [
          j.libelle,
          euro(j.revenuMensuel),
          `${j.pctReference} %`,
          j.detail
        ])
      })}

      ${encartNotreLecture({
        texte: redigerLectureProjection(data)
      })}

      <h3>Constats et pistes</h3>
      ${data.constats.map(rendreConstatHTML).join("")}
    `
  });
}
```

### 11.3 SVG inline depuis Recharts

Recharts produit du SVG nativement. Pour l'export PDF, l'approche est :

1. Au moment de générer le PDF, le composant `ProjectionChart` est rendu hors écran dans un container caché.
2. On lit `containerRef.current.innerHTML` pour récupérer le SVG.
3. On le sérialise et l'embarque dans la page HTML générée.

Alternative : utiliser `renderToStaticMarkup` de `react-dom/server` pour générer le SVG sans monter le composant. À tester.

### 11.4 Section dans concatPack.ts

Le pipeline a déjà la section `prévoyance ind+coll` (point 11 sur 17 dans `concatPack.ts`). Il faut :

- La séparer en deux entrées de pop-card : « Prévoyance personnelle (P1) », « Prévoyance personnelle (P2) », « Prévoyance collective ».
- Chacune peut être incluse/exclue indépendamment.
- L'ordre dans le pack PDF reste fixe (perso avant collective).

### 11.5 Critère « fait »

- Trois sections cochables dans la pop-card
- PDF généré incluant graphique en SVG inline (visible à l'impression)
- Mentions DDA présentes en bas de chaque page prévoyance
- Tableau et constats correctement paginés (pas de coupure milieu de cellule)

---

## 12. CCN à inclure (Tranches 1, 2, 3)

### 12.1 Tranche 1 — Cœur (10 IDCC, ~50 % salariés du privé)

| IDCC | Nom | Priorité |
|---|---|---|
| 1486 | Syntec — Bureaux d'études, sociétés de conseils | ★★★ |
| 3248 | Métallurgie (CCN unifiée 2024) | ★★★ |
| 1979 | Hôtels, cafés, restaurants (HCR) | ★★★ |
| 1597 | Bâtiment — ouvriers > 10 salariés | ★★★ |
| 1596 | Bâtiment — ouvriers ≤ 10 salariés | ★★★ |
| 2609 | Bâtiment — ETAM | ★★★ |
| 2420 | Bâtiment — cadres | ★★★ |
| 1996 | Pharmacie d'officine | ★★ |
| 2216 | Commerce de détail et de gros alimentaire | ★★ |
| 16 | Transports routiers et activités auxiliaires du transport | ★★ |

### 12.2 Tranche 2 — Extension (+20 IDCC, ~25 % salariés)

| IDCC | Nom |
|---|---|
| 2128 | Mutualité |
| 1672 | Assurance — sociétés d'assurance |
| 1090 | Services de l'automobile |
| 2378 | Boulangerie-pâtisserie (entreprises artisanales) |
| 2727 | Coiffure et professions connexes |
| 1413 | Animation |
| 1351 | Prévention et de sécurité |
| 3043 | Propreté (entreprises) |
| 2941 | Aide, accompagnement, soins et services à domicile |
| 2120 | Banque (AFB) |
| 1505 | Commerce de détail des fruits et légumes |
| 1411 | Négoce des matériaux de construction |
| 7026 | Régime social des indépendants — convention notariale |
| 1747 | Activités industrielles boulangerie-pâtisserie |
| 1043 | Gardiens, concierges et employés d'immeubles |
| 1518 | Animation socio-culturelle |
| 1517 | Magasins de bricolage |
| 1606 | Bois (négoce et importation) |
| 2098 | Personnels prestataires de services |
| 2511 | Sport |

### 12.3 Tranche 3 — Optionnelle (50 IDCC, +15 % couverture)

Liste à étendre selon retours clients. Non bloquante pour la v1.4.0.

### 12.4 Méthode de remplissage

Pour chaque CCN :

1. Aller sur Légifrance, base KALI, identifier la convention.
2. Lire les articles « Maladie », « Maintien de salaire », « Prévoyance » (cadres et non-cadres si séparation).
3. Renseigner dans le JSON les paliers de maintien employeur (en jours).
4. Renseigner les minima de prévoyance (taux T1 cadres, garanties minimum).
5. Renseigner la santé si plancher de branche > ANI.
6. Citer la source précise et la date de vérification dans le bloc `sources`.

**Ne jamais inventer** : si une donnée est ambiguë (texte d'une CCN difficile à lire), marquer `TO_VERIFY` et signaler à David.

---

## 13. Conformité DDA — règles non négociables

### 13.1 Ce que le module FAIT

- Quantifie les **besoins** (capital DC nécessaire, IJ nécessaires, etc.)
- Quantifie les **trous** (différence besoin – couverture en place)
- Cite les **obligations légales et conventionnelles**
- Propose des **pistes d'action** en termes de besoin (« évaluer la souscription d'un capital décès additionnel d'environ X € »)

### 13.2 Ce que le module NE FAIT JAMAIS

- Nommer un assureur (Generali, AXA, Apicil, etc.)
- Nommer un produit commercial (« Pack Pro+ », « Prévoyance Sérénité »)
- Affirmer qu'une solution est meilleure qu'une autre
- Conseiller la souscription d'un contrat précis

### 13.3 Mentions obligatoires dans le PDF

Sur **chaque page** de la section prévoyance, pied de page :

> *« Document remis à titre indicatif — analyse non contractuelle. Ne constitue ni un conseil en investissement au sens de l'art. L.541-1 et s. CMF, ni un conseil en distribution d'assurance au sens de l'art. L.521-4 C. ass. Toute mise en place de couverture doit faire l'objet d'un devoir de conseil formalisé et d'une recommandation personnalisée par un intermédiaire habilité. EcoPatrimoine Conseil — ORIAS n° 25006907. »*

### 13.4 Comportement des constats

Reformulation systématique : remplacer toute formulation ressemblant à une recommandation de produit par une formulation en besoin.

| À éviter | À utiliser |
|---|---|
| « Souscrire un contrat AXA Prévoyance » | « Évaluer l'opportunité d'une couverture complémentaire IJ » |
| « Le contrat Apicil est plus adapté » | « Cette garantie n'est pas couverte ; étudier la mise en place d'une rente conjoint » |
| « Choisir un capital DC de 200 000 € » | « Un besoin de capital décès de ~200 000 € apparaît au regard des dettes et des revenus à remplacer » |

---

## 14. Mise à jour annuelle

### 14.1 Cycle

Chaque année (idéalement en janvier après publication du PASS et des barèmes IJSS) :

1. **Copier** `pass-{N}.json` → `pass-{N+1}.json`, idem pour caisses et CCN.
2. **Mettre à jour** les valeurs (PASS, IJSS, plafonds invalidité, éventuelles évolutions CCN).
3. **Modifier** `CURRENT_YEAR` dans `src/data/prevoyance/index.ts`.
4. **Mettre à jour** les imports dans `index.ts`.
5. **Lancer** les tests Vitest — les cas d'or doivent rester verts (les valeurs attendues ont été calibrées avec une fourchette de tolérance autour des valeurs 2026, mais une vérification visuelle reste nécessaire).
6. **Commit** : `chore(prevoyance): mise à jour référentiels millésime {N+1}`.

### 14.2 Script de vérification

Créer `scripts/check-referentiel-version.ts` :

```typescript
import { CURRENT_YEAR } from "../src/data/prevoyance";

const annéeSysteme = new Date().getFullYear();
const ecart = annéeSysteme - CURRENT_YEAR;

if (ecart >= 1) {
  console.warn(
    `\x1b[33m⚠️  ATTENTION : référentiels datés de ${CURRENT_YEAR}, ` +
    `année courante ${annéeSysteme}. Pensez à mettre à jour.\x1b[0m`
  );
  if (ecart >= 2) {
    process.exit(1);
  }
}
```

Lancé via `npm run check:referentiel` et idéalement intégré au `prebuild`.

### 14.3 Documentation de mise à jour

Créer `docs/MISE-A-JOUR-PREVOYANCE.md` listant :

- Les sources à consulter pour chaque type de valeur
- Les URLs canoniques
- L'ordre des opérations
- La checklist de validation

---

## 15. Mentions légales du PDF

Ces mentions sont déjà gérées par le pipeline PDF v2 (`pagementionsLegales`). Vérifier qu'elles incluent un paragraphe spécifique au module prévoyance :

> **« Module Prévoyance »**
>
> L'analyse de prévoyance présentée s'appuie sur les référentiels publics (régimes obligatoires, conventions collectives, BOSS, URSSAF) à jour au {dateVerification du référentiel}. Les valeurs des plafonds d'indemnisation, des taux de cotisation et des minima conventionnels sont susceptibles d'évoluer ; toute décision doit être confirmée au regard des textes en vigueur au moment de sa mise en œuvre.
>
> Cette analyse n'a pas vocation à se substituer au devoir de conseil et à la recommandation personnalisée formalisés par un intermédiaire en assurance habilité dans le cadre de la Directive sur la Distribution d'Assurance (DDA, art. L.521-1 et s. C. ass.).

---

## 16. Conventions projet à respecter

### 16.1 PowerShell / Windows

- Séparateur de commandes : `;` jamais `&&`.
- Pour déployer une Edge Function Supabase : `Rename-Item .env .env.bak` avant, `Rename-Item .env.bak .env` après.
- Toujours `--no-verify-jwt` sur les déploiements.

### 16.2 Tests

- 300+ tests Vitest doivent rester verts à chaque commit.
- Le module prévoyance ajoute au minimum 30 tests, cible 50.

### 16.3 Commits

- Pas de `Co-Authored-By: Claude` dans les commits.
- Un lot = un commit séparé et réversible. Stop et validation avant le lot suivant.
- Format : `feat(prevoyance): ...` ou `refactor(ui): ...`.

### 16.4 Style UI

- Inline styles cohérents avec l'existant (`SURFACE.cardSoft`, `--cab-navy`, etc.).
- Recharts pour les graphiques (déjà installé).
- Pas de nouvelle dépendance sans validation explicite.

### 16.5 Persistance

- Toute donnée du module → `payload.data.prevoyance` (séparé de `payload.data.placements`, etc.).
- Pas de localStorage non scopé par `userId`.
- Sauvegarde automatique via le système existant (debounce ~2 s).

### 16.6 Supabase

- Le projet partagé `ysbgfiqsuvdwzkcsiqir` retourne MCP -32600 ; tout DDL doit être fait à la main par David via Dashboard SQL Editor.
- Pour ce module, **aucun DDL n'est nécessaire** — tout est dans `payload` (jsonb).

---

## 17. Annexes

### 17.1 Plan de livraison récapitulatif

| Lot | Titre | Effort estimé | Commit type |
|---|---|---|---|
| 1 | Suppression onglet Rapport client | 1h | `refactor(ui)` |
| 2 | Enrichissement onglet Travail (SIRET, statut, CCN) | 4h | `feat(travail)` |
| 3 | Référentiels JSON v1 (PASS + caisses + 10 CCN) | 6h (dont vérif sources) | `feat(prevoyance)` |
| 4 | Moteur projection (AM + invalidité) | 8h | `feat(prevoyance)` |
| 5 | Tests Vitest cas d'or (30+) | 4h | `test(prevoyance)` |
| 6 | Moteur règles & constats | 4h | `feat(prevoyance)` |
| 7 | UI TabPrevoyancePerso | 6h | `feat(prevoyance)` |
| 8 | UI TabPrevoyanceCollective | 4h | `feat(prevoyance)` |
| 9 | Câblage Pack PDF v2 | 4h | `feat(prevoyance)` |
| **Total** | | **~41h** | |

Chaque lot doit être livré avec :
- Tests verts (300+ existants + nouveaux)
- Build OK
- Pas de warning TS/React
- Validation manuelle de David sur un cas concret avant de passer au lot suivant

### 17.2 Glossaire

- **AM** : Arrêt maladie
- **ANI** : Accord National Interprofessionnel (ici, ANI 2013 sur la santé collective obligatoire et ANI 2017 sur la prévoyance cadres)
- **BOSS** : Bulletin Officiel de la Sécurité Sociale
- **CCN** : Convention collective nationale
- **DDA** : Directive sur la Distribution d'Assurance
- **IDCC** : Identifiant de convention collective (numéro)
- **IJ / IJSS** : Indemnités journalières (de la Sécurité Sociale)
- **MTP** : Majoration pour Tierce Personne
- **PASS** : Plafond Annuel de la Sécurité Sociale (48 060 € en 2026)
- **SAM** : Salaire annuel moyen (base de calcul invalidité)
- **T1 / T2** : Tranche 1 (0 → 1 PASS) et Tranche 2 (1 → 8 PASS) du salaire
- **TNS** : Travailleur Non Salarié

### 17.3 Références juridiques principales

| Source | Sujet |
|---|---|
| Art. L.911-1 et s. CSS | Régimes complémentaires d'entreprise |
| Art. L.911-7 CSS | Généralisation complémentaire santé (ANI 2013) |
| Art. L.521-1 et s. C. ass. | Devoir de conseil DDA |
| Art. L.1226-1 et s. C. trav. | Maintien légal de salaire |
| Décret 2021-1002 | Catégories objectives |
| ANI 17 novembre 2017 | Reprise des dispositions cadres post-AGIRC |

### 17.4 Liens utiles

- Légifrance — base KALI (CCN) : https://www.legifrance.gouv.fr/liste/idcc
- BOSS : https://boss.gouv.fr
- URSSAF : https://www.urssaf.fr
- Recherche entreprises : https://recherche-entreprises.api.gouv.fr
- ameli.fr (IJSS) : https://www.ameli.fr
- CARMF : https://www.carmf.fr
- CIPAV : https://www.cipav-retraite.fr
- CARPIMKO : https://www.carpimko.com
- SSI : https://www.secu-independants.fr

---

**Fin du document**

*Spécification rédigée par Claude (Opus 4.7) à l'issue de la session de brainstorming du 27 mai 2026 avec David Perry. Document destiné à servir de contrat de réalisation pour Claude Code dans le cadre du chantier de module Prévoyance Ploutos v1.4.0.*
