import type { ChargesDetail } from '../types/patrimoine';

// ─── BRAND & SURFACE ─────────────────────────────────────────────────────────

export const BRAND = {
  white: "#F8F6F7",
  cream: "#FBECD7",
  gold: "#E3AF64",
  navy: "#101B3B",
  sky: "#26428B",
  blue: "#516AC7",
};

export const SURFACE = {
  app: `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)`,
  hero: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 38%, ${BRAND.blue} 68%, ${BRAND.gold} 100%)`,
  accent: `linear-gradient(90deg, ${BRAND.gold} 0%, ${BRAND.cream} 55%, #fff7ea 100%)`,
  card: "rgba(255,255,255,0.94)",
  cardSoft: "rgba(251,236,215,0.72)",
  border: "rgba(185,145,60,0.42)",          // +teinte + alpha pour lisibilité
  borderStrong: "rgba(185,145,60,0.62)",    // cartes principales
  input: "rgba(255,255,255,0.98)",
  inputBorder: "rgba(185,145,60,0.35)",
  tableHead: "rgba(227,175,100,0.12)",
};

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
  { value: "cash", label: "Comptes et épargne réglementée" },
  { value: "market", label: "Valeurs mobilières" },
  { value: "wrapper", label: "Enveloppes et capitalisation" },
  { value: "retirement", label: "Retraite" },
] as const;

export const PLACEMENT_TYPES_BY_FAMILY: Record<string, string[]> = {
  cash: ["Compte courant", "Compte à terme", "PEL", "CEL", "Livret A", "LDDS", "LEP"],
  market: ["PEA", "Compte-titres", "Actions non cotées", "OPCVM / ETF"],
  wrapper: ["Assurance-vie fonds euros", "Assurance-vie unités de compte", "Contrat de capitalisation"],
  retirement: ["PER bancaire", "PER assurantiel", "Madelin"],
};

export const ALL_PLACEMENTS = Object.values(PLACEMENT_TYPES_BY_FAMILY).flat();
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

export const CHART_COLORS = [BRAND.gold, BRAND.sky, BRAND.blue, "#88A0F0", "#C1CDF8", BRAND.cream, "#DDE5FF", "#F3D3A1"];
export const RECEIVED_COLORS = [BRAND.sky, BRAND.blue, BRAND.gold, "#9CB0F4", "#D8B06C", "#CAD4FA", BRAND.cream, "#7D95E8"];
export const LEGUE_COLORS = [BRAND.gold, BRAND.cream, BRAND.blue, "#8CA2F0", BRAND.sky, "#E8C995", "#CBD5FF", "#D9E3FF"];


export const EMPTY_CHARGES_DETAIL: ChargesDetail = {
  loyer: "", materiel: "", deplacements: "", repas: "",
  tns: "", bancaires: "", comptable: "", autres: "",
};

export const SEUIL_MICRO_BA           = 120000; // Micro-BA : moyenne triennale 2025 (stable)