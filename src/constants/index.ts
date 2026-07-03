import type { ChargesDetail } from '../types/patrimoine';

// ─── BRAND & SURFACE ─────────────────────────────────────────────────────────
// Palette Encre & Or × Classique Vivant — validée contraste-wcag

export const BRAND = {
  white: "#F8F7F4",
  cream: "#FDF6E8",
  gold: "#C4973D",
  goldLight: "#E3AF64",    // accent décoratif (rubans, gradients) — pas pour texte sur fond clair
  goldText: "#8B6914",     // or accessible pour texte sur fond clair (5.09:1 sur blanc)
  navy: "#0F172A",
  navyLight: "#1E293B",
  sky: "#26428B",
  blue: "#516AC7",
  muted: "#637896",        // texte secondaire — AA 4.51:1 sur blanc
  mutedLight: "#7E8F9F",   // tirets, placeholders — AA UI 3.32:1 sur blanc
  inactive: "#94A3B8",     // éléments UI désactivés (icônes, pas du texte courant)
  danger: "#B91C1C",       // texte alerte / erreur — AAA 7.1:1 sur blanc
  dangerBg: "#FEF2F2",    // fond bandeau danger
  dangerBorder: "#FECACA", // bordure bandeau danger
  warning: "#92400E",      // texte avertissement — AAA 7.5:1 sur blanc
  warningBg: "#FEF9EE",   // fond bandeau warning
  warningBorder: "#F5D78E", // bordure bandeau warning
  success: "#166534",      // texte positif — AAA 7.1:1 sur blanc
  successBg: "#F0FDF4",   // fond bandeau succès
  successBorder: "#BBF7D0", // bordure bandeau succès
};

export const SURFACE = {
  app: "#E8E3D9",          // fond parchemin — cards blanches ressortent franchement
  hero: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 38%, ${BRAND.blue} 68%, ${BRAND.gold} 100%)`,
  accent: `linear-gradient(90deg, ${BRAND.gold} 0%, ${BRAND.cream} 55%, #fff7ea 100%)`,
  ribbon: `linear-gradient(90deg, ${BRAND.goldLight} 0%, ${BRAND.cream} 100%)`,       // ruban or en haut des cards
  ribbonNavy: `linear-gradient(90deg, ${BRAND.navy} 0%, ${BRAND.navyLight} 100%)`,    // ruban navy variante
  card: "#FFFFFF",
  cardSoft: "#FDFCFA",
  cardShadow: "0 1px 3px rgba(15,23,42,0.06), 0 6px 20px rgba(15,23,42,0.08), 0 12px 40px rgba(15,23,42,0.04)",
  cardShadowHover: "0 2px 6px rgba(15,23,42,0.08), 0 12px 32px rgba(15,23,42,0.12), 0 20px 50px rgba(15,23,42,0.06)",
  border: "#D8D2C6",               // bordure card — visible sur fond parchemin
  borderStrong: "#CCC5B8",         // bordure appuyée
  input: "#FFFFFF",
  inputBorder: "#E8E3D9",
  inputFocus: "0 0 0 3px rgba(196,151,61,0.15)",
  tableHead: BRAND.navy,           // en-tête tableau navy plein
};

// ─── FIELD — Champs de saisie (parchemin clair, bordure franche, focus or solide) ──
// Source unique de vérité partagée avec les variables CSS --field-* dans index.css.
// Toute modification doit être répercutée des deux côtés.
export const FIELD = {
  fill: "#F6F4EF",                // murmure de parchemin, à peine teinté
  fillDisabled: "#E6E6E6",        // gris FROID — distingue un champ verrouillé d'un champ éditable
  border: "#A29377",              // taupe, 1px
  borderFocus: "#A67F32",         // or (anneau solide 2px au focus)
  borderDisabled: "#CFCFCF",      // gris froid (cohérent avec fillDisabled)
  text: BRAND.navy,               // texte saisi
  textDisabled: "#6B7280",        // gris froid lisible
  placeholder: "#8C8678",         // gris chaud lisible
} as const;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const PROPERTY_TYPES = [
  "Résidence principale",
  "Résidence secondaire",
  "Location nue",
  "LMNP",
  "LMP",
  "SCI IR",
  "SCI IS",
  "SCPI",
  "Terrain",
  "Local professionnel",
  "Autre",
] as const;

export const PROPERTY_RIGHTS = [
  { value: "full", label: "Pleine propriété" },
  { value: "bare", label: "Nue-propriété" },
  { value: "usufruct", label: "Usufruit" },
] as const;

// ─── Couleurs par GROUPE de biens immobiliers ────────────────────────────────
// 4 teintes DISTINCTES des familles de placements (aucune confusion bien/placement
// dans les futurs contours de cards). `solid` = point/bordure/texte de tuile,
// `fill` = fond de tuile. Ratios texte `solid` sur `fill` (fond clair) :
// usage 6.04:1, locatif 5.43:1, structures 6.05:1, autres 5.64:1 — tous AA.
export const PROPERTY_GROUP_COLORS: Record<string, { solid: string; fill: string }> = {
  usage:      { solid: "#993C1D", fill: "#FAECE7" }, // corail
  locatif:    { solid: "#3B6D11", fill: "#EAF3DE" }, // vert
  structures: { solid: "#993556", fill: "#FBEAF0" }, // rose
  autres:     { solid: "#5F5E5A", fill: "#F1EFE8" }, // gris
};

// Groupement d'AFFICHAGE des 11 natures de PROPERTY_TYPES (valeurs internes
// INCHANGÉES ; orthogonal au futur champ « dispositif fiscal »). 100% data-driven :
// la fenêtre d'ajout de biens se construit entièrement d'ici.
export const PROPERTY_GROUPS = [
  { value: "usage",      label: "Usage personnel", types: ["Résidence principale", "Résidence secondaire"] },
  { value: "locatif",    label: "Locatif",         types: ["Location nue", "LMNP", "LMP", "SCPI"] },
  { value: "structures", label: "Structures",      types: ["SCI IR", "SCI IS"] },
  { value: "autres",     label: "Autres",          types: ["Terrain", "Local professionnel", "Autre"] },
] as const;

// ─── Dispositifs fiscaux immobiliers (saisie Lot C ; calcul branché au Lot D) ─
// `value` ASCII (stockée dans Property.dispositifFiscal) ; `label` affiché (accents
// OK). "aucun" en tête = absence de dispositif (Property.dispositifFiscal undefined
// ou "" ⇒ « Aucun » à l'affichage). Ordre figé, orthogonal à PROPERTY_TYPES.
export const DISPOSITIFS_FISCAUX = [
  { value: "aucun",                   label: "Aucun" },
  { value: "pinel",                   label: "Pinel" },
  { value: "pinelPlus",               label: "Pinel+" },
  { value: "denormandie",             label: "Denormandie" },
  { value: "censiBouvard",            label: "Censi-Bouvard" },
  { value: "locavantages",            label: "Loc'Avantages" },
  { value: "jeanbrunRelanceLogement", label: "Jeanbrun Relance logement" },
] as const;

// Matrice juridique : nature de bien -> dispositifs éligibles (filtre la saisie).
// _comment source : "matrice juridique - Pinel/Denormandie/Loc'A/Jeanbrun =
// location nue ; Censi 199 sexvicies = LMNP direct uniquement (SCPI et societes
// exclues) ; SCPI/SCI IR = societes non IS eligibles (199 novovicies, 199 tricies
// I.B, art. 47 LF 2026). Sourcing 03/07/2026." Natures absentes de la map = []
// (aucun dispositif proposé).
export const DISPOSITIFS_PAR_NATURE: Record<string, string[]> = {
  "Location nue": ["pinel", "pinelPlus", "denormandie", "locavantages", "jeanbrunRelanceLogement"],
  "LMNP":         ["censiBouvard"],
  "LMP":          [],
  "SCPI":         ["pinel", "pinelPlus", "denormandie", "jeanbrunRelanceLogement"],
  "SCI IR":       ["pinel", "pinelPlus", "denormandie", "locavantages", "jeanbrunRelanceLogement"],
};

// Seuil légal du régime micro-foncier (art. 32 CGI) : revenus fonciers BRUTS
// annuels. Au-delà, le micro-foncier est inaccessible (régime réel obligatoire).
// Source unique consommée par le warning ET la comparaison micro/réel de TabIR.
export const SEUIL_MICRO_FONCIER = 15000;

export const CHILD_LINKS = [
  { value: "common_child", label: "Enfant commun" },
  { value: "person1_only", label: "Enfant de personne 1 uniquement" },
  { value: "person2_only", label: "Enfant de personne 2 uniquement" },
] as const;

export const CUSTODY_OPTIONS = [
  { value: "full", label: "Classique" },
  { value: "alternate", label: "Alternée" },
] as const;

// ─── PCS 2003 (INSEE) ────────────────────────────────────────────────────────

export const PCS_GROUPES = [
  { code: "1", label: "Agriculteurs exploitants" },
  { code: "2", label: "Artisans, commerçants et chefs d'entreprise" },
  { code: "3", label: "Cadres et professions intellectuelles supérieures" },
  { code: "4", label: "Professions intermédiaires" },
  { code: "5", label: "Employés" },
  { code: "6", label: "Ouvriers" },
  { code: "7", label: "Retraités" },
  { code: "8", label: "Autres personnes sans activité professionnelle" },
] as const;

export const PCS_CATEGORIES: Record<string, { code: string; label: string }[]> = {
  "1": [
    { code: "11", label: "Agriculteurs sur petite exploitation" },
    { code: "12", label: "Agriculteurs sur moyenne exploitation" },
    { code: "13", label: "Agriculteurs sur grande exploitation" },
  ],
  "2": [
    { code: "21", label: "Artisans" },
    { code: "22", label: "Commerçants et assimilés" },
    { code: "23", label: "Chefs d'entreprise de 10 salariés ou plus" },
  ],
  "3": [
    { code: "31", label: "Professions libérales" },
    { code: "33", label: "Cadres de la fonction publique" },
    { code: "34", label: "Professeurs, professions scientifiques" },
    { code: "35", label: "Professions de l'information, des arts et des spectacles" },
    { code: "37", label: "Cadres administratifs et commerciaux d'entreprise" },
    { code: "38", label: "Ingénieurs et cadres techniques d'entreprise" },
  ],
  "4": [
    { code: "42", label: "Professeurs des écoles, instituteurs et assimilés" },
    { code: "43", label: "Professions intermédiaires de la santé et du travail social" },
    { code: "44", label: "Clergé, religieux" },
    { code: "45", label: "Professions intermédiaires administratives de la fonction publique" },
    { code: "46", label: "Professions intermédiaires administratives et commerciales des entreprises" },
    { code: "47", label: "Techniciens" },
    { code: "48", label: "Contremaîtres, agents de maîtrise" },
  ],
  "5": [
    { code: "52", label: "Employés civils et agents de service de la fonction publique" },
    { code: "53", label: "Policiers et militaires" },
    { code: "54", label: "Employés administratifs d'entreprise" },
    { code: "55", label: "Employés de commerce" },
    { code: "56", label: "Personnels des services directs aux particuliers" },
  ],
  "6": [
    { code: "62", label: "Ouvriers qualifiés de type industriel" },
    { code: "63", label: "Ouvriers qualifiés de type artisanal" },
    { code: "64", label: "Chauffeurs" },
    { code: "65", label: "Ouvriers qualifiés de la manutention, du magasinage et du transport" },
    { code: "67", label: "Ouvriers non qualifiés de type industriel" },
    { code: "68", label: "Ouvriers non qualifiés de type artisanal" },
    { code: "69", label: "Ouvriers agricoles" },
  ],
  "7": [
    { code: "71", label: "Anciens agriculteurs exploitants" },
    { code: "72", label: "Anciens artisans, commerçants et chefs d'entreprise" },
    { code: "74", label: "Anciens cadres" },
    { code: "75", label: "Anciennes professions intermédiaires" },
    { code: "77", label: "Anciens employés" },
    { code: "78", label: "Anciens ouvriers" },
  ],
  "8": [
    { code: "81", label: "Chômeurs n'ayant jamais travaillé" },
    { code: "83", label: "Militaires du contingent" },
    { code: "84", label: "Élèves, étudiants" },
    { code: "85", label: "Personnes sans activité professionnelle de moins de 60 ans" },
    { code: "86", label: "Personnes sans activité professionnelle de 60 ans et plus" },
  ],
};

// Helpers fiscaux basés sur la PCS
export function isIndependant(groupeCode: string): boolean {
  return groupeCode === "1" || groupeCode === "2";
}
export function isProfessionLiberale(categorieCode: string): boolean {
  return categorieCode === "31";
}
export function isArtisanCommerçant(groupeCode: string, categorieCode: string): boolean {
  return groupeCode === "2" && (categorieCode === "21" || categorieCode === "22");
}
export function isChefEntreprise(categorieCode: string): boolean {
  return categorieCode === "23";
}
export function isRetraite(groupeCode: string): boolean {
  return groupeCode === "7";
}
export function isSansActivite(groupeCode: string): boolean {
  return groupeCode === "8";
}
export function isFonctionnaire(categorieCode: string): boolean {
  return ["33", "45", "52", "53"].includes(categorieCode);
}
export function getGroupeLabel(groupeCode: string): string {
  return PCS_GROUPES.find(g => g.code === groupeCode)?.label ?? "";
}
export function getCategorieLabel(categorieCode: string): string {
  for (const cats of Object.values(PCS_CATEGORIES)) {
    const found = cats.find(c => c.code === categorieCode);
    if (found) return found.label;
  }
  return "";
}

// Compatibilité legacy — utilisé dans les PDFs
export const CSP_OPTIONS = PCS_GROUPES.map(g => g.label) as unknown as readonly string[];

export const COUPLE_STATUS_OPTIONS = [
  { value: "married", label: "Marié" },
  { value: "pacs", label: "PACS" },
  { value: "cohab", label: "Concubinage" },
  { value: "single", label: "Célibataire" },
  { value: "divorced", label: "Divorcé / séparé" },
] as const;

export const MATRIMONIAL_OPTIONS = [
  { value: "communaute_legale", label: "Communauté légale" },
  { value: "separation_biens", label: "Séparation de biens" },
  { value: "participation_acquets", label: "Participation aux acquêts" },
  { value: "communaute_universelle", label: "Communauté universelle" },
] as const;

export const PLACEMENT_FAMILIES = [
  { value: "cash", label: "Liquidités" },
  { value: "market", label: "Marchés" },
  { value: "wrapper", label: "Épargne assurantielle" },
  { value: "retirement", label: "Retraite" },
] as const;

// ─── Couleurs par famille de placement ───────────────────────────────────────
// Source UNIQUE réutilisable (servira aussi aux contours de cards lors de la
// grande passe UI). Par famille : `solid` (point + bordure + texte de la pastille
// ACTIVE) calibré AA sur fond clair, et `fill` (fond de la pastille de famille
// ACTIVE uniquement). L'information de famille ne repose JAMAIS sur la couleur
// seule : le libellé (PLACEMENT_FAMILIES) est toujours affiché à côté du point.
// Ratios texte `solid` sur `fill` (fond clair) : cash 5.47:1, market 5.70:1,
// wrapper 5.87:1, retirement 6.00:1 — tous AA.
export const FAMILY_COLORS: Record<string, { solid: string; fill: string }> = {
  cash:       { solid: "#0F6E56", fill: "#E1F5EE" }, // vert
  market:     { solid: "#185FA5", fill: "#E6F1FB" }, // bleu
  wrapper:    { solid: "#854F0B", fill: "#FAEEDA" }, // ambre
  retirement: { solid: "#534AB7", fill: "#EEEDFE" }, // violet
};

export const PLACEMENT_TYPES_BY_FAMILY: Record<string, string[]> = {
  cash: ["Compte courant", "Compte à terme", "PEL", "CEL", "Livret A", "LDDS", "LEP"],
  market: ["PEA", "Compte-titres", "Actions non cotées", "OPCVM / ETF"],
  wrapper: ["Assurance-vie fonds euros", "Assurance-vie unités de compte", "Contrat de capitalisation"],
  retirement: ["PER bancaire", "PER assurantiel", "Madelin"],
};

export const ALL_PLACEMENTS = Object.values(PLACEMENT_TYPES_BY_FAMILY).flat();

// ─── Libellés d'AFFICHAGE des types de placement ─────────────────────────────
// Mapping type interne (valeur persistée, inchangée) -> libellé montré à l'écran
// et dans les PDF. Seuls les 2 types AV sont renommés (monosupport/multisupport) ;
// tout autre type s'affiche tel quel via labelPlacement(). AUCUN prédicat, AUCUNE
// fixture, AUCUNE migration ne dépend de ce mapping — affichage pur.
export const PLACEMENT_TYPE_LABELS: Record<string, string> = {
  "Assurance-vie fonds euros": "Assurance-vie monosupport",
  "Assurance-vie unités de compte": "Assurance-vie multisupport",
};
export function labelPlacement(type: string): string {
  return PLACEMENT_TYPE_LABELS[type] ?? type;
}
export const AV_TYPES = ["Assurance-vie fonds euros", "Assurance-vie unités de compte"];

export const TESTAMENT_RELATION_OPTIONS = [
  { value: "conjoint", label: "Conjoint / PACS" },
  { value: "enfant", label: "Enfant (biologique / adopté)" },
  { value: "enfant_conjoint", label: "Enfant du conjoint (non adopté)" },
  { value: "petit-enfant", label: "Petit-enfant" },
  { value: "frereSoeur", label: "Frère / sœur" },
  { value: "neveuNiece", label: "Neveu / nièce" },
  { value: "parent", label: "Père / mère" },
  { value: "autre", label: "Autre / tiers" },
] as const;

export const BENEFICIARY_RELATION_OPTIONS = [
  { value: "conjoint", label: "Conjoint / PACS" },
  { value: "enfant", label: "Enfant (biologique / adopté)" },
  { value: "enfant_conjoint", label: "Enfant du conjoint (non adopté)" },
  { value: "petit-enfant", label: "Petit-enfant" },
  { value: "parent", label: "Père / mère" },
  { value: "frereSoeur", label: "Frère / sœur" },
  { value: "neveuNiece", label: "Neveu / nièce" },
  { value: "autre", label: "Autre / tiers" },
] as const;

export const CHART_COLORS = [BRAND.gold, BRAND.sky, BRAND.blue, "#6B8DD6", "#A0B4E8", "#D4A96A", "#8CA2F0", "#C8956E"];
export const RECEIVED_COLORS = [BRAND.sky, BRAND.blue, BRAND.gold, "#6B8DD6", "#D4A96A", "#A0B4E8", "#C8956E", "#7D95E8"];
export const LEGUE_COLORS = [BRAND.gold, "#D4A96A", BRAND.blue, "#6B8DD6", BRAND.sky, "#C8956E", "#A0B4E8", "#8CA2F0"];


export const EMPTY_CHARGES_DETAIL: ChargesDetail = {
  loyer: "", materiel: "", deplacements: "", repas: "",
  tns: "", bancaires: "", comptable: "", autres: "",
};

export const SEUIL_MICRO_BA           = 120000; // Micro-BA : moyenne triennale 2025 (stable)