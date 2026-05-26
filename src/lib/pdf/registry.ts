// ─── Registre de sections + presets de documents ──────────────────────────
// Lot 2 : structuration interne. Le rendu HTML reste produit par les fonctions
// existantes dans pdfReport.ts / pdfMission.ts ; ce registre déclare les
// MÉTADONNÉES (id, label, groupe) et l'ORDRE par défaut (preset) de chaque
// document. Il sera consommé par les futures UI de presets et par les
// nouveaux documents (DER, Déclaration d'adéquation, etc.).

// ─── Groupes ───────────────────────────────────────────────────────────────
// Quatre groupes fonctionnels. Ils ne sont PAS rendus visuellement dans le
// PDF actuel — ils servent au regroupement dans l'UI de configuration.
export type Groupe = "Patrimoine" | "Fiscalité" | "Prévoyance" | "Conformité";

// ─── Modèle de section ─────────────────────────────────────────────────────
// La forme déclarative complète prévue par le plan :
//   { id, label, groupe, isAvailable(data), render(data, tokens) }
// Pour ce Lot 2, le render reste dans chaque fichier PDF (pour préserver
// l'accès au scope local — calculs intermédiaires, helpers, etc.). Le
// registre expose ici uniquement les méta-données ; le render est mappé
// par id côté pdfReport.ts / pdfMission.ts.
export interface SectionMeta {
  id: string;
  label: string;
  groupe: Groupe;
}

// ─── Rapport patrimonial — ordre par défaut ────────────────────────────────
// Reproduit l'ordre actuel des sections dans pdfReport.ts (9 sections).
// La couverture (cover) est toujours présente et n'est pas listée ici.
export const REPORT_SECTIONS: SectionMeta[] = [
  { id: "cabinet",    label: "Notre cabinet & démarche",         groupe: "Conformité" },
  { id: "famille",    label: "Composition familiale",            groupe: "Patrimoine" },
  { id: "travail",    label: "Situation professionnelle & revenus", groupe: "Fiscalité" },
  { id: "bilan",      label: "Bilan patrimonial",                groupe: "Patrimoine" },
  { id: "ir",         label: "Impôt sur le revenu",              groupe: "Fiscalité" },
  { id: "ifi",        label: "Impôt sur la fortune immobilière", groupe: "Fiscalité" },
  { id: "succession", label: "Succession",                       groupe: "Patrimoine" },
  { id: "hypos",      label: "Scénarios d'optimisation",         groupe: "Patrimoine" },
  // Lot 7 — section conditionnelle, ne s'affiche que si recommandations non vides.
  { id: "recommandations", label: "Recommandations & plan d'action", groupe: "Conformité" },
  { id: "annexes",    label: "Annexes — détail tableaux",        groupe: "Patrimoine" },
  { id: "mentions",   label: "Notes & mentions légales",         groupe: "Conformité" },
];

// ─── Lettre de mission — ordre par défaut ──────────────────────────────────
// Reproduit l'ordre actuel des sections dans pdfMission.ts (10 sections).
export const MISSION_SECTIONS: SectionMeta[] = [
  { id: "legal",      label: "Informations légales",             groupe: "Conformité" },
  { id: "famille",    label: "Composition familiale",            groupe: "Patrimoine" },
  { id: "travail",    label: "Situation professionnelle & fiscale", groupe: "Fiscalité" },
  { id: "besoins",    label: "Besoins & objectifs",              groupe: "Prévoyance" },
  { id: "bilan",      label: "Bilan patrimonial",                groupe: "Patrimoine" },
  { id: "ir",         label: "Impôt sur le revenu",              groupe: "Fiscalité" },
  { id: "ifi",        label: "Impôt sur la fortune immobilière", groupe: "Fiscalité" },
  { id: "succession", label: "Succession",                       groupe: "Patrimoine" },
  { id: "profil",     label: "Profil investisseur",              groupe: "Prévoyance" },
  { id: "annexes",    label: "Annexes — détail tableaux",        groupe: "Patrimoine" },
  { id: "signature",  label: "Signature & engagements",          groupe: "Conformité" },
];

// ─── DER (Document d'entrée en relation) — Lot 8b ──────────────────────────
// Document court et standardisé du cabinet, INDÉPENDANT du dossier client.
// Sections « assurance » et « cif » sont CONDITIONNELLES aux statuts ORIAS
// (assurance si coa OR mia, cif si cif coché). Les autres sont toujours là.
export const DER_SECTIONS: SectionMeta[] = [
  { id: "identite",     label: "Identité du cabinet",                       groupe: "Conformité" },
  { id: "statuts",      label: "Statuts détenus & autorités de tutelle",    groupe: "Conformité" },
  { id: "assurance",    label: "Volet assurance — liens & rémunération",    groupe: "Conformité" },
  { id: "cif",          label: "Volet CIF — rémunération",                  groupe: "Conformité" },
  { id: "reclamations", label: "Traitement des réclamations & médiation",   groupe: "Conformité" },
  { id: "conflits",     label: "Politique de gestion des conflits d'intérêts", groupe: "Conformité" },
  { id: "rgpd",         label: "Protection des données personnelles (RGPD)", groupe: "Conformité" },
];

// ─── Presets de documents — liste ordonnée des ids ─────────────────────────
// Un preset = la séquence des sections d'un document. Plus tard, l'UI
// permettra à l'utilisateur de cocher/décocher et réordonner ces sections.
export const REPORT_PRESET: readonly string[] = REPORT_SECTIONS.map(s => s.id);
export const MISSION_PRESET: readonly string[] = MISSION_SECTIONS.map(s => s.id);
export const DER_PRESET: readonly string[]     = DER_SECTIONS.map(s => s.id);
