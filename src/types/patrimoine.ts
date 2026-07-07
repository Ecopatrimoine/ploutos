// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Child = {
  // Identifiant stable, posé à la migration (ensureAssetIds). Optionnel : les
  // payloads antérieurs n'en ont pas avant migration au chargement (patron
  // exact Placement/Property, refonte v1.27.0).
  id?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  parentLink: string;
  custody: string;
  rattached: boolean; // true = rattaché au foyer fiscal (défaut), false = non rattaché (enfant majeur indépendant)
  handicap: boolean;  // titulaire carte d'invalidité / CMI-invalidité → +0,5 part IR (0,25 si alternée) + abattement succession 159 325 €
  // Niveau scolaire → réduction d'impôt forfait scolaire art. 199 quater B CGI
  // college = 61 €/an | lycee = 153 €/an | superieur = 183 €/an
  schoolLevel?: string; // "" | "college" | "lycee" | "superieur" — optionnel pour rétrocompatibilité
};

// ── Crédit immobilier (nouveau : multi-crédits par bien) ──────────────────
export type Loan = {
  id: string;
  type: string;           // "amortissable"|"in_fine"|"ptz"|"pel"|"travaux"
  label: string;          // "Prêt principal", "PTZ", "PEL"…
  amount: string;         // montant initial
  rate: string;           // taux annuel %
  duration: string;       // durée en années
  startDate: string;
  capitalRemaining: string;   // vide = auto-calculé
  interestAnnual: string;     // vide = auto-calculé
  /** @deprecated Cible par index (position dans data.placements). Conservé pour lire
   *  les payloads anciens ; remplacé par pledgedPlacementId après ensureAssetIds. */
  pledgedPlacementIndex: string; // AV nantie pour in_fine (-1 = aucune)
  pledgedPlacementId?: string;   // id stable de l'AV nantie (posé par ensureAssetIds)
  insurance: boolean;
  insuranceGuarantees: string; // "dc"|"dc_ptia"|...
  insuranceRate: string;       // bien propre ou mono
  insuranceRate1: string;      // couple/indivision P1
  insuranceRate2: string;      // couple/indivision P2
  insurancePremium: string;    // vide = auto-calculé (montant * rate / 100 / 12 * 12)
  insuranceCoverage: string;   // "banque"|"delegation"
};

export type DismemberCounterpart = {
  id: string;
  key: string;            // "person1"|"person2"|"child_0"|...|"other"
  birthDate: string;
  relation: string;
  name: string;
  sharePercent: string;   // % de la contrepartie (utile si plusieurs)
};

export type Property = {
  // Identifiant stable, posé à la migration (ensureAssetIds). Optionnel : les
  // payloads antérieurs à la refonte n'en ont pas avant migration au chargement.
  id?: string;
  name: string;
  type: string;
  ownership: string;
  propertyRight: string;
  usufructAge: string;       // conservé pour rétrocompatibilité — préférer counterpartBirthDate
  // ── Contrepartie démembrement (bien propre ou global) ────────────────────
  counterpartKey?: string;        // "person1"|"person2"|"child_0"|"child_1"|...|"other"
  counterpartBirthDate?: string;  // date naissance usufruitier/nu-propriétaire
  counterpartRelation?: string;   // lien familial (pour succession)
  counterpartName?: string;       // nom libre si "other"
  // ── Démembrement dissocié par personne (bien commun/indivision) ───────────
  dismemberP1?: {
    propertyRight: "full" | "bare" | "usufruct";
    counterparts: DismemberCounterpart[];  // plusieurs contreparties possibles
  };
  dismemberP2?: {
    propertyRight: "full" | "bare" | "usufruct";
    counterparts: DismemberCounterpart[];
  };
  value: string;
  propertyTaxAnnual: string;
  rentGrossAnnual: string;
  insuranceAnnual: string;
  worksAnnual: string;
  otherChargesAnnual: string;
  // ── Crédit ──────────────────────────────────────────
  loanEnabled: boolean;
  loanType: string;             // "amortissable"|"in_fine"|"relais"|"ptz"|"travaux"
  loanAmount: string;
  loanRate: string;
  loanDuration: string;
  loanStartDate: string;
  loanCapitalRemaining: string;
  loanInterestAnnual: string;
  /** @deprecated Cible par index (position dans data.placements), legacy mono-crédit.
   *  Conservé pour lire les payloads anciens ; remplacé par loanPledgedPlacementId. */
  loanPledgedPlacementIndex: string; // index AV nantie (-1 = aucune)
  loanPledgedPlacementId?: string;   // id stable de l'AV nantie (posé par ensureAssetIds)
  // ── Assurance ────────────────────────────────────────
  loanInsurance: boolean;
  loanInsuranceGuarantees: string;  // "dc"|"dc_ptia"|"dc_ptia_itt"|"dc_ptia_itt_ipp"
  loanInsuranceRate: string;
  loanInsuranceRate1: string;
  loanInsuranceRate2: string;
  loanInsurancePremium: string;
  loanInsuranceCoverage: string;    // "banque"|"delegation"
  indivisionShare1: string;
  indivisionShare2: string;
  // ── Co-propriétaires / co-associés extérieurs au foyer ──────────────────
  // Pour les biens en indivision avec des tiers (ex: SCI familiale étendue,
  // SCI avec amis/associés, indivision successorale partagée avec d'autres).
  // Les revenus du foyer = (indivisionShare1 + indivisionShare2) × revenus
  // bruts. Les parts externes ne sont pas comptabilisées dans la déclaration
  // du foyer (chaque externe déclare sa propre quote-part).
  externalShares?: ExternalShareholder[];
  // ── Multi-crédits (nouveau) ───────────────────────────────────────────────
  // Priorité sur les anciens champs loan* si présent et non vide
  loans?: Loan[];
  // ── Dispositif fiscal immobilier (saisie Lot C ; calcul branché au Lot D) ──
  // Tous optionnels : un bien sans dispositif = undefined ⇒ « Aucun » à l'affichage.
  // Les montants suivent la convention du fichier (string, comme value / rentGrossAnnual).
  dispositifFiscal?: "pinel" | "pinelPlus" | "denormandie" | "censiBouvard" | "locavantages" | "jeanbrunRelanceLogement";
  dispositifAnnee?: string;             // millésime investissement / souscription / prise d'effet convention
  dispositifBase?: string;              // prix de revient ou souscription SAISI (≠ valeur actuelle du bien)
  dispositifEngagementAns?: "6" | "9";  // pinel / pinelPlus / denormandie
  dispositifProrogation?: "0" | "1" | "2";
  dispositifNiveauLoyer?: "intermediaire" | "social" | "tresSocial" | "loc1" | "loc2" | "loc3";
  dispositifIntermediation?: boolean;   // locavantages
  dispositifNeufAncien?: "neuf" | "ancien"; // jeanbrunRelanceLogement
  // ── Location meublee (LMNP/LMP) — Lot 0 moteur BIC ────────────────────────
  // Champs OPTIONNELS, ZERO migration : un bien type "LMNP"/"LMP" sans ces
  // champs est calcule avec des defauts conservateurs (cf. computeIR +
  // src/lib/calculs/locationMeublee.ts). Convention string comme value /
  // rentGrossAnnual. Le bien passe par le circuit BIC meuble, jamais foncier
  // (predicat isBienMeuble). Saisie UI = lot suivant (feat/lmnp).
  sousType?: "longue_duree" | "tourisme_classe" | "tourisme_non_classe";
  recettesAnnuelles?: string;      // vide => reutilise rentGrossAnnual du bien
  regimeMeuble?: "micro" | "reel"; // vide => micro si recettes <= seuil du sous-type, sinon reel
  chargesReelles?: string;         // regime reel : charges deductibles hors amortissement
  prixAcquisition?: string;        // base de l'amortissement auto (hors terrain)
  partTerrain?: string;            // fraction terrain non amortissable ; vide => 0.15 (referentiel)
  valeurMobilier?: string;         // base de l'amortissement mobilier
  amortissementAnnuelManuel?: string; // barriere douce : "0" saisi = 0 voulu ; vide => amortissement auto
  // Overrides par composant de l'amortissement (modal "Detail", Lot 1bis). Cle =
  // slug de composant (grosOeuvre, toiture, installationsTechniques,
  // facadeEtancheite, agencements). part en FRACTION (comme la grille du
  // referentiel), duree en annees ; champ absent = valeur du referentiel.
  // Optionnel/vide = grille par defaut. Consomme par amortissementAuto (moteur).
  amortissementComposants?: Record<string, { part?: number; duree?: number }>;
};

export type ExternalShareholder = {
  id: string;
  name: string;         // nom complet de la personne tierce
  relation: string;     // ex: "Associé", "Frère/Sœur", "Ami", "Cousin", "Autre"
  sharePercent: string; // "0" à "100"
};

export type Beneficiary = {
  name: string;
  relation: string;
  share: string;
};

export type Placement = {
  // Identifiant stable, posé à la migration (ensureAssetIds). Optionnel : les
  // payloads antérieurs à la refonte n'en ont pas avant migration au chargement.
  id?: string;
  name: string;
  type: string;
  ownership: string;
  value: string;
  annualIncome: string;
  taxableIncome: string;
  deathValue: string;
  openDate: string;
  pfuEligible: boolean;
  pfuOptOut: boolean;   // true = option barème IR au lieu du PFU (avantageux si TMI < 30%)
  totalPremiumsNet: string;
  premiumsBefore70: string;
  premiumsAfter70: string;
  exemptFromSuccession: string;
  ucRatio: string; // % investi en UC (reste = fonds euros), uniquement pour AV UC
  annualWithdrawal: string; // retrait annuel AV — déclenche calcul fiscalité rachat
  annualContribution: string; // versement annuel PER/Madelin — base déduction IR
  perDeductible: boolean;      // true = versement déductible IR (défaut), false = non déductible
  perWithdrawal: string;       // retrait annuel PER (capital + intérêts)
  perWithdrawalCapital: string; // dont capital (imposable au barème)
  perWithdrawalInterest: string; // dont intérêts (PFU 31,4%)
  perAnticiped: boolean;       // true = déblocage anticipé (cas exceptionnel)
  beneficiaries: Beneficiary[];
  // ── Défiscalisation financière (Lot 1 — saisie au Lot 2) ────────────────────
  // Bloc OPTIONNEL : présent ⇒ le placement ouvre droit à une réduction d'IR
  // l'année où dateInvestissement tombe dans une fenêtre active du référentiel
  // (src/data/fiscal/dispositifs-financiers.json). Montants en string (convention).
  defiscalisation?: DefiscalisationPlacement;
};

// Dispositifs financiers de défiscalisation (réductions d'IR, art. 199 ...).
export type DispositifFinancier =
  | 'irpme' | 'fcpi' | 'fcpiJei' | 'fipMetropole' | 'fipCorse'
  | 'fipOutreMer' | 'sofica' | 'girardinIndustriel';

export type DefiscalisationPlacement = {
  dispositif: DispositifFinancier;
  montantSouscrit: string;            // versement (sauf girardin : réduction saisie directe)
  dateInvestissement: string;         // ISO — l'année de cette date pilote l'ouverture du droit
  dateSortiePrevue?: string;          // ISO — sert l'alerte « sortie avant fin d'engagement »
  tauxSofica?: '30' | '36' | '48';    // SOFICA : taux selon engagements (défaut 48)
  regimeGirardin?: 'pleinDroit' | 'agrement'; // Girardin : pilote la fractionPlafond
  montantReductionGirardin?: string;  // Girardin : montant de réduction (attestation opérateur)
  reductionJeiDejaConsommee?: string; // FCPI JEI : réduction déjà consommée (plafond propre 50 000 € 2024-2028)
};

// ── Détail des charges professionnelles par nature ─────────────────────────
export type ChargesDetail = {
  loyer: string;          // Loyer / bureau
  materiel: string;       // Matériel & équipements
  deplacements: string;   // Déplacements (km + transport)
  repas: string;          // Repas professionnels
  tns: string;            // Cotisations TNS (URSSAF, retraite...)
  bancaires: string;      // Frais bancaires
  comptable: string;      // Honoraires comptable
  autres: string;         // Autres charges
};

// ── Détail des charges courantes du foyer par poste (Lot budget) ────────────
// Postes MENSUELS (train de vie), au niveau FOYER. Même philosophie détail vs
// global que ChargesDetail (charges pro TNS) : le total du détail prime sur le
// champ global `chargesCourantes` si au moins un poste est renseigné.
export type ChargesCourantesDetail = {
  loyerRP: string;          // Loyer de la résidence principale (si le foyer est locataire)
  energie: string;          // Énergie (électricité, gaz, eau, chauffage)
  assurancesPerso: string;  // Assurances personnelles (habitation, auto, santé, prévoyance...)
  scolarite: string;        // Scolarité / garde d'enfants
  transport: string;        // Transport (carburant, abonnements)
  autres: string;           // Autres charges courantes
};

// ── Autre crédit (consommation, personnel, LOA…) ──────────────────────
export type OtherLoan = {
  name: string;
  loanType: string;       // "conso"|"personnel"|"loa"|"employeur"|"revolving"|"familial"
  owner: string;          // "person1"|"person2"|"common"
  capitalRemaining: string;
  monthlyPayment: string;
  rate: string;
  durationRemaining: string; // mois restants
  purpose: string;
  hasInsurance: boolean;
  insuranceGuarantees: string;
  insurancePremium: string;
};

// Activite secondaire (Lot A cumul salarie + TNS) : declare qu'une personne a,
// EN PLUS de son statut principal (PCS/CSP), une seconde source de revenu.
// '' = aucune (comportement historique strict). 'salariat' = salaire en plus
// d'une activite TNS principale ; 'bic'/'bnc'/'ba' = activite TNS en plus d'un
// salaire principal. Optionnel/retro-compat : absent => aucun changement.
export type ActiviteSecondaire = '' | 'salariat' | 'bic' | 'bnc' | 'ba';

export type PatrimonialData = {
  person1FirstName: string;
  person1LastName: string;
  person1BirthDate: string;
  person1JobTitle: string;
  person1Csp: string;
  person1PcsGroupe: string;
  // ── État civil détaillé (Lot 8a — exigence DDA / lettre de mission) ──
  person1NomNaissance?: string;     // nom de naissance (si différent du nom d'usage)
  person1LieuNaissance?: string;    // ville + département / pays
  person1Nationalite?: string;
  person2FirstName: string;
  person2LastName: string;
  person2BirthDate: string;
  person2JobTitle: string;
  person2Csp: string;
  person2PcsGroupe: string;
  person2NomNaissance?: string;
  person2LieuNaissance?: string;
  person2Nationalite?: string;
  coupleStatus: string;
  matrimonialRegime: string;
  // Date de mariage / PACS (ISO), optionnelle. Source unique pour l'ancienneté
  // de mariage utilisée par les prestations prévoyance (majoration conjoint).
  dateMariage?: string | null;
  singleParent: boolean;
  // ─── Lot Dossier client — Adresse du foyer (utilisée par la fiche DDA
  //     dans le bandeau identité client et par les pages de contact PDF). ─
  adresse?: string;
  codePostal?: string;
  ville?: string;
  person1Handicap: boolean;  // personne 1 handicapée → abattement revenu 2 627 € + plafond QF +1 785 €
  person2Handicap: boolean;  // personne 2 handicapée → idem
  childrenData: Child[];
  // Registre des donations passees (Lot A1) — optionnel/retro-compat, migre par
  // normalizeClientData -> []. Consomme par le rappel fiscal (Lot B, moteur succession).
  donations?: DonationPassee[];
  salary1: string;
  salary2: string;
  // Activite secondaire par personne (Lot A cumul salarie + TNS). Optionnel /
  // retro-compat : absent => comportement historique inchange (SOIT salarie SOIT
  // TNS). Consomme par le moteur IR (resolveBeneficeTns + gardes salaire).
  activiteSecondaire1?: ActiviteSecondaire;
  activiteSecondaire2?: ActiviteSecondaire;
  // Retraites / pensions — nominatives par personne (remplace le champ global pensions)
  pensions1?: string;  // retraite / pension personne 1 — optionnel pour rétrocompatibilité
  pensions2?: string;  // retraite / pension personne 2 — optionnel pour rétrocompatibilité
  pensions: string;   // champ global — conservé pour rétrocompatibilité (migration automatique)
  // CSG déductible sur revenus fonciers de l'année précédente
  csgDeductibleFoncier?: string; // optionnel pour rétrocompatibilité
  perDeduction: string;
  pensionDeductible: string;
  otherDeductible: string;
  // ── Charges courantes du foyer (Lot budget) — train de vie MENSUEL, niveau
  // FOYER. Optionnels/rétrocompat (patron csgDeductibleFoncier) : dossiers
  // existants migrés par normalizeClientData. `chargesCourantes` = montant
  // global mensuel ; `chargesCourantesDetail` = ventilation par poste (le total
  // du détail prime sur le global si au moins un poste est renseigné). ──
  chargesCourantes?: string;
  chargesCourantesDetail?: ChargesCourantesDetail;
  // ── Madelin prévoyance (Lot B) — case « autre cotisation » libre par personne,
  // additionnée aux cotisations lues en prévoyance par le helper madelin.ts.
  // Optionnel/additif (number, pas string : agrégé numériquement). Absent → 0.
  madelinAutreCotisation1?: number;
  madelinAutreCotisation2?: number;
  // ── Revenus indépendants personne 1 ──
  ca1: string;               // Chiffre d'affaires
  bicType1: string;          // "vente" | "services" (pour BIC)
  microRegime1: boolean;     // true = micro, false = réel
  chargesReelles1: string;   // Charges déductibles réelles (régime réel) — somme du détail
  baRevenue1: string;        // Bénéfice agricole (groupe 1)
  chargesDetail1: ChargesDetail; // Détail par nature
  // ── Revenus indépendants personne 2 ──
  ca2: string;
  bicType2: string;
  microRegime2: boolean;
  chargesReelles2: string;
  baRevenue2: string;
  chargesDetail2: ChargesDetail; // Détail par nature
  properties: Property[];
  placements: Placement[];
  perRentes: PERRente[];    // rentes PER en phase de rente
  otherLoans: OtherLoan[];  // autres crédits (conso, personnel, LOA…)
  // ── Lot module Prévoyance v1.4.0 — situation professionnelle détaillée
  //    par personne (statut + caisse + employeur). Optionnel : les
  //    anciens dossiers sans `travail` continuent de fonctionner.
  travail?: PayloadTravailPair;
  // ── Lot module Prévoyance v1.4.0 — saisie prévoyance individuelle
  //    (contrats individuels, couverture collective, catégorie
  //    d'invalidité projetée). Optionnel : les anciens dossiers
  //    affichent un état vide invitant à compléter.
  prevoyance?: PayloadPrevoyance;
};

// ─── Module Prévoyance (v1.4.0) — types partagés ────────────────────────────

export type StatutPro =
  | "salarie_non_cadre"
  | "salarie_cadre"
  | "tns_liberal"
  | "tns_commercant"
  | "tns_artisan"
  | "gerant_majoritaire"   // SARL / EURL gérant majoritaire (TNS)
  | "president_sas"        // SAS / SASU président (assimilé salarié)
  | "eurl_unique"          // EURL gérant non majoritaire (assimilé salarié)
  | "fonctionnaire"
  | "retraite"
  | "sans_activite";

export type CodeCaisse =
  | "CPAM"
  | "SSI"
  | "MSA"
  | "CARMF"
  | "CARCDSF"
  | "CARPV"
  | "CARPIMKO"
  | "CIPAV"
  | "CNBF"
  | "CAVOM"
  | "CAVEC"
  | "CAVAMAC"
  | "CRN"
  | "FONCTION_PUBLIQUE";

export type EmployeurInfo = {
  siret: string | null;
  siren: string | null;
  nom: string | null;
  formeJuridique: string | null;
  codeNAF: string | null;
  idccCCN: string | null;
  nomCCN: string | null;
  // Liste COMPLETE des IDCC retournes par l'API pour ce SIRET (multi-conventions).
  // Additif/optionnel : idccCCN reste le 1er, pre-rempli. Absent des dossiers anterieurs.
  idccListe?: string[];
  sourceCCN: "auto" | "manuel" | "non_defini";
  effectif: number | null;
  adresseEtablissement: string | null;
  dateCreation: string | null;       // ISO date
};

export type PayloadTravail = {
  statutPro: StatutPro | "";
  caisseAffiliation: CodeCaisse | null;
  employeur: EmployeurInfo | null;
  dateEmbauche: string | null;       // ISO date — salariés / assimilés salariés
  // Date de début d'activité / 1ʳᵉ affiliation à la caisse (TNS), optionnel.
  // Sert d'assiette à l'ancienneté d'affiliation pour les TNS (qui n'ont pas
  // de date d'embauche). Distinct de dateEmbauche, jamais confondu.
  dateDebutActivite?: string | null; // ISO date — TNS
  tempsTravail: {
    type: "plein" | "partiel";
    pourcentage?: number;            // 0-100, utilisé si type=partiel
  };
  salaireBrutAnnuel: number;         // distinct de salary1/salary2 (qui sont nets imposables)
  primeAnnuelle: number | null;
  // Spécifique TNS
  revenuBNC: number | null;
  revenuBIC: number | null;
  optionMadelin: boolean;
  // ── Madelin prévoyance (Lot B) — toggle GLOBAL par personne sur la nature du
  // bénéfice saisi. Absent/false = le bénéfice saisi est « AVANT déduction
  // Madelin » → Ploutos applique la déduction (DÉFAUT). true = bénéfice déjà net
  // de Madelin → Ploutos ne re-déduit pas. Additif, rétro-compatible.
  beneficeDejaDeduitMadelin?: boolean;
};

export type PayloadTravailPair = {
  p1: PayloadTravail;
  p2: PayloadTravail | null;
};

// ─── Lot module Prévoyance v1.4.0 — persistance des saisies UI ─────────
//
// Note volontaire : on duplique ici les types fonctionnels du moteur
// (ContratIndividuel / CouvertureCollective définis dans
// src/lib/prevoyance/types.ts) plutôt que d'importer pour ne pas
// créer de cycle types ↔ moteur. Les structures sont identiques.
// Si elles divergent un jour, ajouter une fonction d'adaptation.

export type CategorieInvalidite = "cat1" | "cat2" | "cat3";

// Scénario d'arrêt projeté : une maladie ordinaire plafonne les IJ
// obligatoires à 360 jours, une affection longue durée (ALD) les
// maintient jusqu'à 1095 jours. Défaut = "ald" (cf. SPEC_ALD_TPT §1).
export type ScenarioArret = "maladie_ordinaire" | "ald";

// Nature d'un contrat individuel de revenu de remplacement (IJ /
// invalidité). Indemnitaire = prestation plafonnée au complément jusqu'à
// 100 % du revenu de référence (cas le plus fréquent). Forfaitaire =
// montant souscrit versé en plein (le cumul peut dépasser 100 %).
// Défaut = "indemnitaire" (cf. SPEC_PREVOYANCE_SURCOUVERTURE §1).
export type NatureContrat = "indemnitaire" | "forfaitaire";

// Configuration d'une reprise en mi-temps thérapeutique (TPT). Le moteur
// ne manipule que des jours depuis J0 (debutJour / finJour) ; la
// conversion date↔jour se fait côté UI. pctTempsTravaille = part du
// temps travaillé (0.5 = mi-temps). apresTpt : après finJour, retour en
// arrêt total OU guérison. Cf. SPEC_ALD_TPT §5.1.
export type TptConfig = {
  actif: boolean;
  debutJour: number;
  finJour: number;
  pctTempsTravaille: number; // 0.2 à 1.0
  apresTpt: "retour_arret_total" | "guerison";
};

// Paramètres spécifiques CARMF (médecins libéraux). Architecture à 2
// étages : IJ CPAM J4-J90 puis CARMF J91-J1095, invalidité jusqu'au 62e
// anniversaire. Cf. SPEC_PREVOYANCE_CARMF §2. revenuBNC_N2 = revenu non
// salarié année N-2 (assiette des prestations 2026).
export type CarmfConfig = {
  statut: "medecin_titulaire" | "conjoint_collaborateur" | "medecin_remplacant";
  optionConjointCollaborateur?: "quart" | "moitie"; // si conjoint collaborateur
  revenuBNC_N2: number;
  ancienneteAffiliationTrimestres: number; // carence d'affiliation : 8 trim = 2 ans
  cumulEmploiRetraite: boolean; // si true → exclu du régime ID CARMF
  // Majorations invalidité / rente conjoint :
  marie: boolean;
  anneesMariage: number;
  ressourcesConjoint: number; // plafond 31 252 € pour la majoration conjoint
  besoinTiercePersonne: boolean;
};

// Paramètres CIPAV (professions libérales non réglementées). Architecture
// distincte de la CARMF : IJ libéraux J4-J90, puis trou (0 €) jusqu'à
// l'invalidité, puis pension par points. Décision lot CIPAV : un SEUL
// champ revenu N-2 pour tout le module (IJ + points), prudence fiscale.
export type CipavConfig = {
  revenuBNC_N2: number;              // revenu N-2 — champ unique (IJ libéraux + points prévoyance)
  ancienneteAffiliationMois: number; // affiliation ≥ 12 mois requise pour les IJ libéraux
  cumulEmploiRetraite: boolean;      // si true → exclu des IJ + pension CIPAV
  tauxInvalidite: number;            // 100 = totale (cutoff 62 ans) ; 66-99 = partielle (cutoff 67) ; < 66 = pas de pension
  marie: boolean;                    // ouvre la rente conjoint (prestation décès)
  nbEnfants: number;                 // rente enfant servie PAR enfant (prestation décès)
  decesAccidentel: boolean;          // majoration capital décès (+5 000 points)
};

// Paramètres CARPIMKO (auxiliaires médicaux libéraux). Architecture proche
// CARMF (relais IJ propre J91) mais prestations entièrement FORFAITAIRES :
// le revenu n'intervient QUE dans la phase 1 CPAM (revenu N-2). Formulaire
// simplifié — pas de champ revenu pour les prestations.
export type CarpimkoConfig = {
  revenuBNC_N2: number;              // revenu N-2 — utilisé UNIQUEMENT pour les IJ CPAM phase 1
  tauxInvalidite: number;            // 100 = totale / 66-99 = partielle / < 66 = pas de rente
  nbEnfants: number;                 // majoration IJ descendant + rente éducation décès
  besoinTiercePersonne: boolean;     // majoration IJ (et invalidité totale, TO_VERIFY)
  marie: boolean;                    // capital décès / rente conjoint (prestations décès, hors courbe)
};

// Config commune aux caisses FORFAITAIRES (CNBF, CARCDSF, CAVEC…), pilotées
// par le moteur générique (caisseRef.moteur === "forfaitaire") plutôt que par
// une branche dédiée. Un seul type partagé : le discriminant pertinent dépend
// de la caisse (anciennete CNBF, sous-profession CARCDSF, classe CAVEC).
// Cf. SPEC_PREVOYANCE_CAISSES_FORFAITAIRES §5.4. Câblage UI = lot 2.
export type ForfaitConfig = {
  revenuBNC_N2?: number;             // seed revenu (pattern des autres *Config)
  tauxInvalidite: number;            // 0-100 (mode taux binaire/proportionnel)
  sousProfession?: "dentiste" | "sage_femme"; // CARCDSF (discriminant profession)
  classeOption?: string;            // CAVEC : classe forcée si option supérieure
  commissionsBrutes?: number;        // assiette annuelle des caisses en mode
                                     // "pourcentageRevenu" (ex. CAVAMAC : 25 %
                                     // des commissions brutes plafonnées)
  cumulEmploiRetraite?: boolean;
};

export type PayloadContratIndividuel = {
  id: string;
  // "deces_capital" RETIRÉ des types créables (VOIE A — R4) : le capital décès se
  // saisit en « Transmission décès ». La valeur historique reste LISIBLE en base
  // (cf. TYPE_DECES_CAPITAL_LEGACY + pont R2) ; on ne la propose simplement plus.
  type:
    | "deces_rente_conj"
    | "deces_rente_educ"
    | "ij"
    | "invalidite"
    | "ptia"
    | "dependance"
    | "gav";
  capitalOuMontant: number;
  franchiseJours?: number;
  plafondJoursIJ?: number;
  baseInvalidite?: number;
  // Nature du contrat (IJ / invalidité) : indemnitaire (borné, défaut)
  // ou forfaitaire (versé en plein). Optionnel → rétrocompatible.
  nature?: NatureContrat;
  conditions?: string;
  // ── Madelin prévoyance (Lot B) — additif, rétro-compatible (optionnel). N'a de
  // sens fiscal que sur les types "ij" et "invalidite" (incapacité/invalidité) ;
  // le helper madelin.ts ignore tout autre type même marqué. Absent → contrat
  // NON déductible Madelin.
  deductibleMadelin?: boolean;
  cotisationMadelinAnnuelle?: number;  // cotisation annuelle (€) déductible Madelin
};

export type PayloadCouvertureCollective = {
  ij?: {
    pctSalaire: number;
    franchise: number;
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

export type PayloadPrevoyancePerso = {
  contratsIndividuels: PayloadContratIndividuel[];
  couvertureCollective: PayloadCouvertureCollective | null;
  categorieInvaliditeProjetee: CategorieInvalidite;
  // Scénario d'arrêt retenu pour la projection (défaut "ald"). Optionnel
  // pour les dossiers antérieurs à l'extension ALD → le lecteur applique
  // "ald" par défaut.
  scenarioArret?: ScenarioArret;
  // Reprise en mi-temps thérapeutique (optionnel, défaut inactif). Absent
  // → projection sans TPT (cf. SPEC_ALD_TPT §5).
  tpt?: TptConfig;
  // Paramètres CARMF (médecins libéraux), optionnel — présent seulement
  // pour les clients affiliés CARMF (cf. SPEC_PREVOYANCE_CARMF §2).
  carmf?: CarmfConfig;
  // Paramètres CIPAV (professions libérales non réglementées), optionnel —
  // présent seulement pour les clients affiliés CIPAV (cf. SPEC_PREVOYANCE_CIPAV).
  cipav?: CipavConfig;
  // Paramètres CARPIMKO (auxiliaires médicaux), optionnel — présent seulement
  // pour les clients affiliés CARPIMKO (prestations forfaitaires).
  carpimko?: CarpimkoConfig;
  // Paramètres des caisses FORFAITAIRES (CNBF, CARCDSF, CAVEC…), optionnel —
  // présent seulement pour les clients affiliés à une caisse pilotée par le
  // moteur forfaitaire générique (cf. SPEC_PREVOYANCE_CAISSES_FORFAITAIRES).
  forfait?: ForfaitConfig;
  // Contrats de prévoyance décès PRIVÉS destinés à la TRANSMISSION (capital
  // versé aux bénéficiaires au décès). DISTINCTS des contratsIndividuels
  // deces_* (qui alimentent les 9 séries de revenus de remplacement) : ces
  // contrats-ci ne remplacent pas un revenu, ils transmettent un capital. Lus
  // par le module succession (Lot 3, fiscalité 990 I). Absent → [] (les vieux
  // dossiers restent valides). Cf. module « Capitaux décès dans la succession ».
  contratsTransmissionDeces?: ContratTransmissionDeces[];
  // Surcharge MANUELLE de la dévolution du capital décès des CAISSES (régimes
  // obligatoires). Per-personne : le décès de CETTE personne déclenche le
  // versement. Absent → dévolution AUTOMATIQUE en cascade légale (art. L361-4
  // CSS : conjoint/PACS, à défaut enfants à charge, à défaut ascendants).
  // Présente → REMPLACE la cascade auto (le CGP connaît le cas, ex. concubin).
  capitalDecesCaisseSurcharge?: CapitalDecesCaisseSurcharge;
  // Surcharge MANUELLE de la dévolution du capital décès de PRÉVOYANCE DE
  // BRANCHE (CCN). MÊME modèle que la surcharge caisse (réutilise le type), mais
  // CASCADE DISTINCTE : clause type Syntec (art. 3.3, 27/03/1997) — conjoint, à
  // défaut PACS/concubin notoire, à défaut enfants, à défaut ascendants, à
  // défaut héritiers (cf. LOT DECES-A bis). Absent → cascade par défaut.
  // Présente → REMPLACE la cascade (le salarié a modifié la clause au contrat).
  capitalDecesBrancheSurcharge?: CapitalDecesCaisseSurcharge;
};

// Lien du bénéficiaire d'un capital décès caisse (purement descriptif —
// AUCUNE fiscalité : ces capitaux sont exonérés et hors succession).
export type CapitalDecesCaisseRelation =
  | "conjoint" | "pacs_partner" | "enfant" | "ascendant" | "autre";

export type CapitalDecesCaisseSurchargeBeneficiaire = {
  name: string;
  relation: CapitalDecesCaisseRelation;
  montant: number;        // € attribué (exonéré)
};

export type CapitalDecesCaisseSurcharge = {
  beneficiaires: CapitalDecesCaisseSurchargeBeneficiaire[];
};

// Bénéficiaire d'un contrat de transmission décès. Même forme que Beneficiary
// (placements AV) — {name, relation, share} — mais `share` est numérique
// (convention du payload Prévoyance, qui stocke des nombres et non des chaînes
// de formulaire). `relation` reprend le MÊME vocabulaire que
// getSuccessionTaxProfile (succession.ts) pour un branchement direct au Lot 3.
export type ContratTransmissionDecesBeneficiaire = {
  name: string;
  relation: string;     // "conjoint" | "pacs_partner" | "enfant" | "parent" |
                        // "petit-enfant" | "frereSoeur" | "neveuNiece" |
                        // "enfant_conjoint" | "autre" (vocab. succession.ts)
  share: number;        // quote-part en % (0-100)
};

// Contrat de prévoyance décès privé destiné à la transmission. Saisi dans le
// bloc « Transmission décès » (TabPrevoyancePerso), persisté dans
// data.prevoyance.{p1|p2}. AUCUNE fiscalité calculée ici (Lot 2 = saisie +
// affichage) : l'assiette 990 I est tranchée au Lot 3 via computeAvTax.
export type ContratTransmissionDeces = {
  id: string;
  libelle: string;              // nom du contrat (affichage)
  assureur?: string;            // optionnel, affichage
  // Assiette fiscale du prélèvement 990 I :
  //   "primes_avant70" : temporaire décès / fonds perdus → assiette = primes
  //     versées avant 70 ans (souvent < abattement 152 500 € → exonéré).
  //   "capital"        : contrat avec valeur de rachat → assiette = capital
  //     transmis aux bénéficiaires.
  natureAssiette: "primes_avant70" | "capital";
  capitalTransmis: number;      // capital versé aux bénéficiaires au décès (€)
  primesAvant70?: number;       // requis si natureAssiette === "primes_avant70"
  beneficiaires: ContratTransmissionDecesBeneficiaire[];
  conditions?: string;          // texte libre, affichage
  // ── Madelin prévoyance (Lot B) — additif, rétro-compatible (optionnel).
  // Absent → contrat NON déductible Madelin.
  deductibleMadelin?: boolean;
  cotisationMadelinAnnuelle?: number;  // cotisation annuelle (€) déductible Madelin
};

// ─── Lot 8 — Prévoyance collective d'entreprise (audit conformité) ────

// Critère objectif de catégorie au sens de l'art. R.242-1-1 CSS (décret
// n° 2021-1002 du 30/07/2021). Sélecteur fermé : SEULS ces 5 critères licites
// sont autorisés (les critères interdits — temps de travail, nature du contrat,
// âge, ancienneté hors sous-critère 4, discriminatoire — ne figurent pas).
export type CritereR242 =
  | "cadres_non_cadres"
  | "seuil_pass"
  | "classifications"
  | "sous_categories"
  | "regime_obligatoire_usages";

// Données entreprise saisies/auto-résolues pour l'audit collectif.
export type EntrepriseAudit = {
  siret: string | null;
  nom: string | null;
  formeJuridique: string | null;
  effectif: number | null;
  idccCCN: string | null;
  nomCCN: string | null;
  // Liste complete des IDCC detectes pour ce SIRET (additif/optionnel, retro-compatible).
  idccListe?: string[];
  codeNAF: string | null;
  // Déclarations couverture en place (saisies par le client)
  santeCollectiveEnPlace: boolean;
  participationEmployeurSante: number;     // 0-1
  prevoyanceCadresEnPlace: boolean;
  tauxT1Cadres: number;                    // % (0-2)
  prevoyanceNonCadresEnPlace: boolean;
  categoriesObjectivesDeclarees: string;   // libellé/texte libre
  // Catégories objectives VALIDÉES contractuellement (lecture du contrat + actes de
  // mise en place faite au regard des 5 critères du décret 2021-1002). Additif/
  // optionnel, rétro-compatible (absent des dossiers antérieurs) : absent/false →
  // la déclaration seule reste en « vigilance » (vérification à faire) ; true →
  // l'audit passe le contrôle « conforme ». Sans effet si rien n'est déclaré
  // (l'absence de déclaration reste prioritaire → « non conforme »).
  categoriesObjectivesValidees?: boolean;
  // Critère R.242-1-1 sélectionné via le sélecteur fermé (MVP). Additif/optionnel,
  // rétro-compatible (absent des dossiers antérieurs). Purement informatif côté
  // saisie : l'audit (controleCategoriesObjectives) reste piloté par
  // categoriesObjectivesDeclarees + categoriesObjectivesValidees — ce champ n'est
  // lu par AUCUNE logique d'audit.
  critereR242?: CritereR242;
  retraiteSuppEnPlace: boolean;
  // Détail OPTIONNEL des garanties réellement souscrites (Lot SOUSCRIT) — additif,
  // rétro-compatible (absent des dossiers antérieurs). N'influence AUCUN calcul.
  garantiesSouscrites?: GarantiesSouscrites;
};

// ─── Lot SOUSCRIT — détail OPTIONNEL des garanties souscrites ─────────────────
// Miroir structurel des obligations de branche (cf. ObligationItem), par collège.
// MÊMES UNITÉS que les obligations : taux/pct en FRACTIONS (ex. 2.0 = 200 %,
// 0.80 = 80 %), JAMAIS en centièmes (piège 100 vs 1.0). franchiseJours en JOURS.
// Tout champ absent = « non renseigné par le client » (et surtout PAS 0).
export type GarantiesSouscritesCollege = {
  capitalDC?: { tauxSalaireRef?: number };               // fraction (× salaire de référence)
  renteEducation?: { tauxSalaireRefParEnfant?: number }; // fraction
  renteConjoint?: { tauxSalaireRef?: number };           // fraction
  ij?: { pctSalaire?: number; franchiseJours?: number }; // pctSalaire = fraction ; franchiseJours = jours
  invalidite?: { cat1?: number; cat2?: number; cat3?: number }; // fractions
};
export type GarantiesSouscrites = {
  cadres?: GarantiesSouscritesCollege;
  nonCadres?: GarantiesSouscritesCollege;
};

// Source du contexte entreprise.
export type PrevoyanceCollectiveSource = "dirigeant_p1" | "dirigeant_p2" | "analyse_externe";

export type PayloadPrevoyanceCollective = {
  active: boolean;
  source: PrevoyanceCollectiveSource;
  entreprise: EntrepriseAudit;
};

export type PayloadPrevoyance = {
  version: 1;
  p1: PayloadPrevoyancePerso;
  p2: PayloadPrevoyancePerso | null;
  collective?: PayloadPrevoyanceCollective | null;
};

// ── Rente PER (sortie en rente — onglet Revenus) ─────────────────────────
export type PERRente = {
  owner: string;          // "person1" | "person2"
  annualAmount: string;   // rente annuelle brute (€)
  ageAtFirst: string;     // âge au 1er versement (détermine la fraction imposable)
};

export type Heir = {
  name: string;
  relation: string;
  share: string;
  priorDonations: string;
  childLink: string | null;
  // Ref stable vers l'enfant source (Child.id, Lot 0) — pour le rappel fiscal
  // (match donation<->heritier par id, JAMAIS par nom). Optionnel/retro-compat.
  childId?: string;
};

export type TestamentHeir = {
  firstName: string;
  lastName: string;
  birthDate: string;
  relation: string;
  priorDonations: string;
  // Legs global
  shareGlobal: string;        // % du patrimoine total légué
  propertyRight: string;      // "full"|"bare"|"usufruct"
};

// Contrepartie d'un démembrement (l'autre côté NP/US)
export type DemembrementContrepartie = {
  heirName: string;
  heirRelation: string;
  heirBirthDate: string;
  sharePercent: string;  // quotité de cette contrepartie
};

// Légataire dans un legs précis (centré sur le bien)
export type LegsPrecisLegataire = {
  heirName: string;
  heirRelation: string;
  heirBirthDate: string;
  sharePercent: string;     // % du bien attribué à ce légataire
  propertyRight: string;    // "full"|"bare"|"usufruct"
  contreparties: DemembrementContrepartie[];
};

// Legs précis : centré sur le BIEN — un bien peut avoir plusieurs légataires
export type LegsPrecisItem = {
  /** @deprecated Cible par index selon assetType (data.properties[i] / data.placements[i]).
   *  Conservé pour lire les payloads anciens ; remplacé par assetId après ensureAssetIds. */
  propertyIndex: number;
  assetId?: string;    // id stable du bien/placement légué (posé par ensureAssetIds)
  assetType: "property" | "placement" | "free";
  freeLabel?: string;       // si bien libre (assetType="free")
  freeValue?: string;       // valeur estimée du bien libre
  isResidual?: boolean;     // "reste du patrimoine" = patrimoine total - autres biens en legs précis
  legataires: LegsPrecisLegataire[];
  // Rétrocompatibilité — champs ancienne structure (migration auto au chargement)
  heirName?: string;
  heirRelation?: string;
  heirBirthDate?: string;
  sharePercent?: string;
  propertyRight?: string;
  contreparties?: DemembrementContrepartie[];
};

export type SuccessionData = {
  deceasedPerson: "person1" | "person2";
  spousePresent: boolean;
  spouseOption: string;
  useTestament: boolean;
  legsMode: "global" | "precis";  // mode testament
  heirs: Heir[];
  testamentHeirs: TestamentHeir[];
  legsPrecisItems: LegsPrecisItem[];
};

export type IrOptions = {
  expenseMode1: "standard" | "actual";
  expenseMode2: "standard" | "actual";
  km1: string;
  km2: string;
  cv1: string;
  cv2: string;
  mealCount1: string;
  mealCount2: string;
  mealUnit1: string;
  mealUnit2: string;
  other1: string;
  other2: string;
  foncierRegime: "micro" | "real";
};

// ─── DONATION ────────────────────────────────────────────────────────────────

export type DonationHeir = {
  id: string;
  name: string;
  relation: string;
  sharePercent: string;    // % de la donation attribué à ce donataire
  priorDonations: string;  // donations antérieures pour rappel abattement
};

export type DonationItem = {
  id: string;
  assetType: "property" | "placement" | "free";
  /** @deprecated Cible par index selon assetType (data.properties[i] / data.placements[i]).
   *  Conservé pour lire les payloads anciens ; remplacé par assetId après ensureAssetIds. */
  assetIndex: number;
  assetId?: string;    // id stable du bien/placement donné (posé par ensureAssetIds)
  freeLabel: string;
  freeValue: string;
  donationType: "full" | "dismembered"; // pleine propriété ou démembrement NP/US
  sharePercent: string;   // % du bien donné (100 = totalité)
  donorAge: string;       // âge donateur pour barème Duvergier
  donorPersonKey?: string; // "person1"|"person2" — pour quote-part indivision
  donationDate: string;   // date de la donation (pour calcul délai 15 ans)
  heirs: DonationHeir[];
};

// ─── Registre des donations PASSEES (Lot A1 donations-famille) ────────────────
// Donations DEJA consenties par le foyer (distinctes des DonationItem, qui sont
// des SIMULATIONS prospectives dans les hypotheses). Servent au rappel fiscal
// des 15 ans (art. 784 CGI) — cf. lib/calculs/rappelFiscal.ts.
export type DonationPassee = {
  id: string;
  donorPersonKey: "person1" | "person2";
  beneficiaireType: "child" | "conjoint" | "autre";
  beneficiaireChildId?: string;   // si beneficiaireType === "child" : ref Child.id (Lot 0)
  beneficiaireNom?: string;
  beneficiaireRelation?: string;  // pour "autre" : petit-enfant, neveuNiece... (vocab DONATION_RELATIONS)
  date: string;                   // ISO — date de la donation (fenetre 15 ans)
  montant: string;
  // "simple" = donation rapportable ; les 3 autres sont HORS rappel (art. 790 G
  // don familial de sommes d'argent, 790 A bis, present d'usage art. 852 CC).
  type: "simple" | "don_familial_790G" | "don_790A_bis" | "present_usage";
};

export type Hypothesis = {
  id: number;
  name: string;
  notes: string;
  objective: string;
  savedAt: string | null;
  data: PatrimonialData | null;
  successionData: SuccessionData | null;
  irOptions: IrOptions | null;
  donations?: DonationItem[];  // simulations de donation dans cette hypothèse
};

export type BaseSnapshot = {
  savedAt: string | null;
  data: PatrimonialData | null;
  successionData: SuccessionData | null;
  irOptions: IrOptions | null;
};

export type TaxBracket = { from: number; to: number; rate: number };

export type FilledBracket = {
  label: string;
  from: number;
  to: number;
  filled: number;
  tax: number;
  rate: number;
};

export type SuccessionResult = {
  name: string;
  relation: string;
  fraction: number;
  nueFraction: number;
  usufructFraction: number;
  grossReceived: number;
  nueRawValue: number;
  nueValue: number;
  usufructRawValue: number;
  avReceived: number;
  successionTaxable: number;
  successionDuties: number;
  avDuties: number;
  duties: number;
  netReceived: number;
  successionNetReceived: number;
  avNetReceived: number;
  avTaxableBefore70: number;
  avTaxableAfter70: number;
  bracketFill: FilledBracket[];
  graphTitle: string;
  allowance: number;
  indicatorPct: number;
  visualMax: number;
  currentBracketLabel: string;
  effectiveReceived: number;
  // ── Valeurs fiscales dérivées (source unique pour UI + PDF) ──
  // partRecueFiscale = grossReceived + nueValue + usufructRawValue × usPct
  //   (formule fiscale taxable, CGI art. 669 pour Duvergier)
  // netFiscal       = max(0, partRecueFiscale - successionDuties) + avNetReceived
  // compositionFiscale = "PP X € + NP fiscale Y € + US fiscal Z € (V € × U%)"
  // usufructFiscalValue = usufructRawValue × usPct (déjà arrondi)
  partRecueFiscale: number;
  netFiscal: number;
  usufructFiscalValue: number;
  compositionFiscale: string;
};

export type SuccessionPropertyLine = {
  name: string;
  grossEstateValue: number;
  residenceAbatement: number;
  debtShare: number;
  debtShareGross: number;
  insuranceCover: number;
  insuranceRate: number;
  netEstateValue: number;
  note: string;
};

export type SuccessionPlacementLine = {
  name: string;
  netEstateValue: number;
  note: string;
};

export type SuccessionAvLine = {
  contract: string;
  beneficiary: string;
  relation: string;
  sharePct: number;
  amount: number;
  amountBefore70Capital: number;
  amountAfter70Premiums: number;
  amountAfter70TaxableShare: number;
  before70Tax: number;
  after70Tax: number;
  totalTax: number;
};

export type PieDatum = { name: string; holder: string; value: number };

export type DifferenceLine = {
  label: string;
  baseValue: string;
  hypothesisValue: string;
  impact: "up" | "down" | "neutral";
  fiscalArea: string;
};

export type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};
