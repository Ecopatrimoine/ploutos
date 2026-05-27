// ─── Types moteur de projection Prévoyance (Lot 4) ───────────────────────
//
// Types partagés par projection.ts, regles.ts (Lot 6), audit-collectif.ts
// et les adapters Pack PDF v2 (Lot 9). Toutes les valeurs monétaires
// sont en EUROS / MOIS (sauf indication contraire dans les commentaires).

import type { CodeCaisse, StatutPro } from "../../types/patrimoine";

// Catégorie d'invalidité retenue pour la projection.
//   cat1 : capable d'exercer une activité réduite (taux base ~30 %)
//   cat2 : incapable d'exercer (taux base ~50 %)
//   cat3 : incapable + besoin d'une tierce personne (taux ~50 % + MTP)
export type CategorieInvalidite = "cat1" | "cat2" | "cat3";

// Contrat individuel souscrit par la personne (Madelin TNS, contrat
// santé/prévoyance perso, GAV…). Pour cette projection, on s'intéresse
// aux types qui produisent des revenus de remplacement.
export type ContratIndividuel = {
  id: string;
  type:
    | "deces_capital"      // capital décès
    | "deces_rente_conj"   // rente conjoint
    | "deces_rente_educ"   // rente éducation
    | "ij"                 // indemnités journalières complémentaires
    | "invalidite"
    | "ptia"
    | "dependance"
    | "gav";
  capitalOuMontant: number;  // capital DC (€), ou IJ jour (€), ou rente mensuelle (€)
  franchiseJours?: number;   // IJ : franchise contrat (en jours)
  plafondJoursIJ?: number;   // IJ : plafond de durée du versement
  baseInvalidite?: number;   // invalidité : % de revenu remplacé (0-1)
  conditions?: string;       // texte libre (affichage seulement)
};

// Couverture collective (contrat d'entreprise) déclarée par le client
// à partir de sa notice.
export type CouvertureCollective = {
  ij?: {
    pctSalaire: number;        // ex 0.80 = 80 % du brut
    franchise: number;         // jours
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
    baseFormule?: string;
  };
};

// Données d'entrée du moteur pour UNE personne.
export type EntreePerso = {
  age: number;                              // âge actuel (années)
  ageRetraite: number;                      // âge légal retraite (clamp invalidité)
  statutPro: StatutPro | "";
  caisse: CodeCaisse | null;
  idccCCN: string | null;
  ancienneteMois: number;
  salaireBrutAnnuel: number;                // salarié
  salaireNetMensuel: number;                // approximé brut × 0.78 / 12 (affichage)
  revenuTNSAnnuel?: number;                 // TNS
  classeCotisationCaisse?: string;          // CARMF : "A" | "B" | "C"
  nbEnfantsACharge?: number;                // pour majoration CPAM J31
  contratsIndividuels: ContratIndividuel[];
  couvertureCollective: CouvertureCollective | null;
};

// Série empilée — chaque tableau est aligné sur axe[]. Tous les
// montants sont des revenus MENSUELS estimés au point t de l'axe.
export type SerieEmpilee = {
  salaire: number[];                          // toujours 0 pendant l'arrêt
  maintienEmployeur: number[];
  ijObligatoire: number[];
  ijComplementaireCollective: number[];
  ijComplementaireIndividuelle: number[];
  pensionInvalObligatoire: number[];
  renteInvalCollective: number[];
  renteInvalIndividuelle: number[];
};

export type RuptureType =
  | "fin_maintien_100"
  | "fin_maintien_6666"
  | "fin_palier_ij_obl"
  | "fin_palier_ij_compl"
  | "bascule_invalidite"
  | "fin_invalidite"
  | "donnees_indisponibles"
  | "autre";

export type RuptureCle = {
  jour: number;
  libelle: string;
  impactNet: number;        // delta de revenu mensuel à ce jour (signé)
  type: RuptureType;
};

export type AxePoint = {
  jour: number;                  // jour depuis J0 (début arrêt)
  date: string;                  // ISO date approximée (référence J0 = today)
  phase: "am" | "invalidite";
};

// ─── Moteur de règles & constats (Lot 6) ────────────────────────────────

export type ConstatSeverite = "info" | "attention" | "alerte" | "non_conformite";
export type ConstatAxe =
  | "deces"
  | "incapacite"
  | "invalidite"
  | "retraite"
  | "sante"
  | "dependance"
  | "conformite";
export type ConstatCible = "p1" | "p2" | "entreprise";

export type Constat = {
  id: string;                       // identifiant stable pour les tests
  severite: ConstatSeverite;
  axe: ConstatAxe;
  cible: ConstatCible;
  titre: string;                    // court — affiché en gras
  detail: string;                   // explication argumentée — 1 à 3 phrases
  reference?: string;               // "art. L.911-7 CSS" ou "CCN Syntec art. 11"
  action: string;                   // proposition CGP — JAMAIS d'assureur ni de produit nommé (DDA)
  impactChiffre?: {
    montant: number;
    libelle: string;                // "Trou de revenu mensuel à J180"
  };
};

// Données utilisées par les règles. Construit par buildContexteRegle()
// (cf. contexte.ts) à partir du payload Ploutos + ProjectionResult.
export type ContexteRegle = {
  entree: EntreePerso;
  projection: ProjectionResult;
  dettesImmobilieres: number;       // somme des capitaux restants dûs
  conjointACharge: boolean;
  enfantsMineurs: number;           // nb d'enfants < 18 ans rattachés au foyer
  // Revenus mensuels pondérés (salaire + pensions + CA TNS + revenus
  // fonciers/agricoles). Utilisés par les règles qui s'appuient sur
  // conjointACharge pour formuler la phrase explicative (cf. spec
  // Lot 6 ajustement 2 du 2026-05-27).
  revenuP1Mensuel: number;
  revenuP2Mensuel: number;
};

export type Regle = (ctx: ContexteRegle, cible: "p1" | "p2") => Constat | null;

// ─── Audit conformité collective (Lot 8) ────────────────────────────────

export type ControleStatut = "conforme" | "non_conforme" | "vigilance" | "non_applicable";

export type ControleAxe =
  | "sante"
  | "prevoyance"
  | "categories_objectives"
  | "retraite_supp"
  | "ccn"
  | "forfait_social";

export type ControleConformite = {
  id: string;                       // identifiant stable (c_*)
  axe: ControleAxe;
  libelle: string;
  statut: ControleStatut;
  reference: string;
  detail: string;
  actionCorrective?: string;
};

export type AuditConformite = {
  controles: ControleConformite[];
  scoreGlobal: number;              // 0-100, % de contrôles conformes sur applicables
};

export type ProjectionResult = {
  axe: AxePoint[];
  series: SerieEmpilee;
  revenuReferenceMensuel: number;          // salaire net mensuel ou TNS mensuel
  rupturesCles: RuptureCle[];
  basculeInvaliditeJour: number;           // typiquement 1095
  finProjectionJour: number;               // (ageRetraite - age) × 365
  categorieInvaliditeProjetee: CategorieInvalidite;
  // Marqueurs de qualité des données — si true, l'UI doit alerter
  // que la projection s'appuie sur des défauts ou des trous.
  useLegalDefault: boolean;                // IDCC inconnu → maintien légal
  donneesCaisseIndisponibles: boolean;     // caisse TO_FILL ou TO_VERIFY critique
};
