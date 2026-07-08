// ─── Accueil v2 — Helpers PURS de résumé & recherche de dossiers ───────────────
// Zone ACCUEIL uniquement. Aucune logique fiscale : lecture d'affichage + matching
// de recherche dérivés de `payload.data` (type PatrimonialData). Chemins confirmés
// à l'étape 0 du Lot 1 (person1/2, coupleStatus, ville/codePostal séparés, listes
// childrenData/properties/placements). Tout est défensif : champ absent -> vide,
// jamais de "undefined" à l'écran.

import type { PatrimonialData } from "../../types/patrimoine";

// Sous-ensemble réellement lu par l'accueil. Partial : les payloads incomplets
// (dossier vierge, anciens dossiers) restent valides.
export type DossierData = Partial<PatrimonialData>;

export type SortMode = "modif" | "alpha";

export type SearchCriteria = {
  nom: string;
  prenom: string;
  naiss: string;
  dept: string;
};

export const EMPTY_CRITERIA: SearchCriteria = { nom: "", prenom: "", naiss: "", dept: "" };

// Situation (vocabulaire de la maquette Accueil v2, itération 2).
const SITUATION_LABELS: Record<string, string> = {
  married: "Couple marié",
  pacs: "Couple pacsé",
  cohab: "Concubinage",
  single: "Célibataire",
  divorced: "Divorcé",
};

const COUPLE_STATUSES = new Set(["married", "pacs", "cohab"]);

// Repli accent + casse pour la recherche (NFD -> suppression des diacritiques).
export function foldText(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ISO (yyyy-mm-dd, émis par DateFr) -> "jj/mm/aaaa". Format inattendu -> "".
export function formatBirthDateFr(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Département = 2 premiers chiffres du code postal du foyer (champ séparé, étape 0).
export function departementFrom(codePostal: unknown): string {
  const cp = String(codePostal ?? "").replace(/\D/g, "");
  return cp.length >= 2 ? cp.slice(0, 2) : "";
}

export function situationLabel(coupleStatus: unknown): string {
  return SITUATION_LABELS[String(coupleStatus ?? "")] ?? "";
}

// Personne 2 réellement renseignée (indépendamment du statut) — pour la recherche.
export function hasPerson2(data: DossierData): boolean {
  return Boolean(
    String(data.person2FirstName ?? "").trim() || String(data.person2LastName ?? "").trim(),
  );
}

// Couple au sens affichage : statut de couple ET prénom de la personne 2 présent.
function isCouple(data: DossierData): boolean {
  return (
    COUPLE_STATUSES.has(String(data.coupleStatus ?? "")) &&
    Boolean(String(data.person2FirstName ?? "").trim())
  );
}

// Nom de carte "Nom, Prénom(s)". Repli sur le nom de dossier (displayName) quand
// aucune identité n'est saisie (dossier tout juste créé).
export function dossierName(data: DossierData, fallback: string): string {
  const last = String(data.person1LastName ?? "").trim();
  const first1 = String(data.person1FirstName ?? "").trim();
  const first2 = isCouple(data) ? String(data.person2FirstName ?? "").trim() : "";
  const firsts = [first1, first2].filter(Boolean).join(" & ");
  if (last && firsts) return `${last}, ${firsts}`;
  if (last) return last;
  if (firsts) return firsts;
  return fallback;
}

// Ligne méta "Né(e) le jj/mm/aaaa · Ville (dept)". Chaque morceau absent est masqué
// proprement (jamais de "undefined", jamais de séparateur orphelin).
export function dossierMeta(data: DossierData): string {
  const bits: string[] = [];
  const birth = formatBirthDateFr(data.person1BirthDate);
  if (birth) bits.push(`Né(e) le ${birth}`);
  const ville = String(data.ville ?? "").trim();
  const dept = departementFrom(data.codePostal);
  if (ville && dept) bits.push(`${ville} (${dept})`);
  else if (ville) bits.push(ville);
  else if (dept) bits.push(dept);
  return bits.join(" · ");
}

function count(list: unknown): number {
  return Array.isArray(list) ? list.length : 0;
}

// Ligne résumé "situation · N enfants · N biens · N placements" (singulier/pluriel
// corrects ; 0 enfant -> "sans enfant", conforme à la maquette). Dossier totalement
// vierge (aucune situation, aucun enfant/bien/placement) -> "" (ligne masquée).
export function dossierResume(data: DossierData): string {
  const sit = situationLabel(data.coupleStatus);
  const nbEnf = count(data.childrenData);
  const nbBiens = count(data.properties);
  const nbPlac = count(data.placements);
  if (!sit && nbEnf === 0 && nbBiens === 0 && nbPlac === 0) return "";
  const parts: string[] = [];
  if (sit) parts.push(sit);
  parts.push(nbEnf === 0 ? "sans enfant" : `${nbEnf} enfant${nbEnf > 1 ? "s" : ""}`);
  parts.push(`${nbBiens} bien${nbBiens > 1 ? "s" : ""}`);
  parts.push(`${nbPlac} placement${nbPlac > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

// Date relative du pied de carte : "Aujourd'hui · HH:MM", "Hier · HH:MM", sinon
// "jj/mm · HH:MM" (année ajoutée si différente de l'année courante). `now`
// injectable pour les tests.
export function formatRelativeDate(iso: unknown, now: number = Date.now()): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const nowD = new Date(now);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(nowD) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return `Aujourd'hui · ${time}`;
  if (dayDiff === 1) return `Hier · ${time}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const datePart =
    d.getFullYear() === nowD.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`;
  return `${datePart} · ${time}`;
}

export function anyCriteria(c: SearchCriteria): boolean {
  return Boolean(c.nom.trim() || c.prenom.trim() || c.naiss.trim() || c.dept.trim());
}

// Nom pré-alimenté pour un nouveau dossier depuis les critères Nom/Prénom saisis.
export function draftDossierName(c: SearchCriteria): string {
  const parts = [c.nom.trim(), c.prenom.trim()].filter(Boolean);
  return parts.join(" ") || "Nouveau dossier";
}

// Matching cumulatif (ET), insensible casse + accents, sur personne 1 ET personne 2.
export function matchesCriteria(data: DossierData, c: SearchCriteria): boolean {
  const nom = c.nom.trim();
  if (nom) {
    const q = foldText(nom);
    const noms = [foldText(data.person1LastName), foldText(data.person2LastName)];
    if (!noms.some((n) => n.includes(q))) return false;
  }
  const prenom = c.prenom.trim();
  if (prenom) {
    const q = foldText(prenom);
    const prenoms = [foldText(data.person1FirstName), foldText(data.person2FirstName)];
    if (!prenoms.some((p) => p.includes(q))) return false;
  }
  const naiss = c.naiss.replace(/\s/g, "");
  if (naiss) {
    const dates = [
      formatBirthDateFr(data.person1BirthDate),
      formatBirthDateFr(data.person2BirthDate),
    ].map((d) => d.replace(/\s/g, ""));
    if (!dates.some((d) => d && d.includes(naiss))) return false;
  }
  const deptRaw = c.dept.trim();
  if (deptRaw) {
    const digits = deptRaw.replace(/\D/g, "");
    const byDept = digits ? departementFrom(data.codePostal).startsWith(digits) : false;
    const byVille = foldText(data.ville).includes(foldText(deptRaw));
    if (!byDept && !byVille) return false;
  }
  return true;
}
