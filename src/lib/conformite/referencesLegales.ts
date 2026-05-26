// ─── Helper conformité — références légales dynamiques (Lot 5) ───────────────
//
// Renvoie les références légales applicables au cabinet selon ses statuts ORIAS
// actifs. Conçu pour alimenter les documents réglementaires (lettre de mission,
// fiche de conseil, mentions légales) au Lot 8.
//
// Règles critiques :
// - JAMAIS de RG AMF ni de MIF II tant que `statuts.cif` n'est pas coché.
// - Les numéros précis (L.521-x, RG AMF) restent paramétrables : ils ne sont
//   pas figés en dur. Tant qu'ils ne sont pas calés sur le référentiel validé
//   par l'association CIF du cabinet, ils sont marqués « à confirmer ».
// - Socle daté au 25/05/2026 (cf. prompt-claude-code-ploutos-lot5.md).

export type StatutFlags = {
  /** Courtier en assurance (ORIAS COA). */
  coa: boolean;
  /** Mandataire d'intermédiaire en assurance. */
  mia: boolean;
  /** Intermédiaire en opérations de banque et services de paiement. */
  iobsp: boolean;
  /** Conseiller en investissements financiers. */
  cif: boolean;
  /** Carte T (transactions immobilières — loi Hoguet). */
  carteT: boolean;
};

export type ReferenceLegale = {
  /** Autorité de tutelle ou source : ACPR, AMF, DGCCRF/CCI, ACPR/UE, AMF/UE. */
  regulateur: string;
  /** Code ou texte de rattachement (Code des assurances, CMF, Directive…). */
  code: string;
  /** Référence d'article (« L.521-x », « — » si texte non articulé). */
  article: string;
  /** Libellé court du domaine couvert. */
  libelle: string;
  /** Statut qui déclenche cette référence (sert au filtrage/affichage). */
  statut: keyof StatutFlags;
  /** Marqueur « à confirmer » pour tout numéro paramétrable non figé. */
  note?: string;
};

/**
 * Calcule les références légales applicables.
 *
 * Le paramètre `prestations` est optionnel et réservé à un futur lot : il
 * permettra d'appliquer (statuts ∩ prestations) quand `TabMission` exposera
 * des cases « prestations à fournir ». Aujourd'hui il n'a pas d'effet.
 */
export function referencesLegales(
  statuts: StatutFlags,
  _prestations?: ReadonlyArray<string>,
): ReferenceLegale[] {
  const refs: ReferenceLegale[] = [];

  // ── COA / MIA → ACPR — Code des assurances + DDA ─────────────────────────
  if (statuts.coa || statuts.mia) {
    const s: keyof StatutFlags = statuts.coa ? "coa" : "mia";
    refs.push({
      regulateur: "ACPR",
      code: "Code des assurances",
      article: "L.511-1 et s.",
      libelle: "Conditions d'exercice de l'intermédiation en assurance",
      statut: s,
    });
    refs.push({
      regulateur: "ACPR",
      code: "Code des assurances",
      article: "L.521-1 et s.",
      libelle: "Devoir d'information et de conseil — DDA transposée en droit français",
      statut: s,
    });
    refs.push({
      regulateur: "ACPR",
      code: "Code des assurances",
      article: "L.522-1 et s.",
      libelle: "Règles spécifiques aux contrats d'assurance-vie et unités de compte (IBIP)",
      statut: s,
    });
    refs.push({
      regulateur: "ACPR/UE",
      code: "Directive UE 2016/97 (DDA)",
      article: "—",
      libelle: "Distribution d'assurance",
      statut: s,
    });
  }

  // ── IOBSP → ACPR — CMF + MCD ─────────────────────────────────────────────
  if (statuts.iobsp) {
    refs.push({
      regulateur: "ACPR",
      code: "CMF",
      article: "L.519-1 et s.",
      libelle: "Intermédiation en opérations de banque et services de paiement",
      statut: "iobsp",
    });
    refs.push({
      regulateur: "ACPR/UE",
      code: "Directive 2014/17 (MCD)",
      article: "—",
      libelle: "Crédit immobilier",
      statut: "iobsp",
    });
  }

  // ── CIF → AMF — CMF + RG AMF + MIF II ────────────────────────────────────
  // Strictement aucun de ces éléments si statuts.cif est faux.
  if (statuts.cif) {
    refs.push({
      regulateur: "AMF",
      code: "CMF",
      article: "L.541-1 et s.",
      libelle: "Conseil en investissements financiers",
      statut: "cif",
    });
    refs.push({
      regulateur: "AMF",
      code: "RG AMF",
      article: "Livre III",
      libelle: "Règles de bonne conduite et obligations professionnelles applicables aux CIF",
      statut: "cif",
    });
    refs.push({
      regulateur: "AMF/UE",
      code: "Directive MIF II",
      article: "—",
      libelle: "Marchés d'instruments financiers",
      statut: "cif",
    });
  }

  // ── Carte T → DGCCRF / CCI — loi Hoguet + décret d'application ──────────
  if (statuts.carteT) {
    refs.push({
      regulateur: "DGCCRF/CCI",
      code: "Loi Hoguet n° 70-9",
      article: "—",
      libelle: "Transactions immobilières",
      statut: "carteT",
    });
    refs.push({
      regulateur: "DGCCRF/CCI",
      code: "Décret n° 72-678",
      article: "—",
      libelle: "Mise en œuvre de la loi Hoguet",
      statut: "carteT",
    });
  }

  return refs;
}
