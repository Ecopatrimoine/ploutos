// ─── Lot Dossier client — Adapter Famille v2 ─────────────────────────
//
// Mappe data + ir (parts) vers FamillePageData.

import type { FamillePageData, PersonneFamille, EnfantLigne } from "../pages/pageFamille";

export type BuildFamilleDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  ir?: any;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildFamilleData(p: BuildFamilleDataParams): FamillePageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const ir = p.ir || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1Prenom = data.person1FirstName || "";
  const p1Nom    = data.person1LastName  || "";
  const p2Prenom = data.person2FirstName || "";
  const p2Nom    = data.person2LastName  || "";
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2Nom ? `${p1Prenom} ${p1Nom} & ${p2Prenom} ${p2Nom}` : `${p1Prenom} ${p1Nom}`).trim() || "Client";

  const personne1: PersonneFamille = {
    prenom: p1Prenom,
    nom: p1Nom,
    dateNaissance: formatDateNaissance(data.person1BirthDate),
    age: ageFromBirthDate(data.person1BirthDate),
    profession: data.person1JobTitle || undefined,
    handicap: !!data.person1Handicap,
  };

  const personne2: PersonneFamille | undefined = (isCouple || p2Prenom || p2Nom)
    ? {
        prenom: p2Prenom,
        nom: p2Nom,
        dateNaissance: formatDateNaissance(data.person2BirthDate),
        age: ageFromBirthDate(data.person2BirthDate),
        profession: data.person2JobTitle || undefined,
        handicap: !!data.person2Handicap,
      }
    : undefined;

  const statutCouple = composeStatutCouple(data.coupleStatus, data.matrimonialRegime, !!data.singleParent);

  const childrenData: any[] = Array.isArray(data.childrenData) ? data.childrenData : [];
  const enfants: EnfantLigne[] = childrenData.map(c => ({
    prenom: c.firstName || "—",
    dateNaissance: formatDateNaissance(c.birthDate),
    lien: composeLienEnfant(c.parentLink, p1Prenom, p2Prenom),
    garde: composeGarde(c.custody),
    rattache: !!c.rattached,
    handicap: !!c.handicap,
  }));

  const parts = typeof ir.parts === "number" ? ir.parts : 0;

  return {
    clientName,
    dateStr,
    personne1,
    personne2,
    statutCouple,
    parts,
    nbEnfants: enfants.length,
    enfants,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Famille — confidentiel`,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateNaissance(iso?: string): string | undefined {
  if (!iso || typeof iso !== "string") return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function ageFromBirthDate(iso?: string): number | undefined {
  if (!iso || typeof iso !== "string") return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : undefined;
}

function composeStatutCouple(status: string, regime: string, singleParent: boolean): string {
  const statusLabel: Record<string, string> = {
    married: "Marié(e)",
    pacs: "Pacsé(e)",
    cohab: "Concubinage / union libre",
    single: "Célibataire",
    divorced: "Divorcé(e)",
    widowed: "Veuf / veuve",
  };
  const regimeLabel: Record<string, string> = {
    communaute_legale: "communauté légale",
    communaute_universelle: "communauté universelle",
    separation_biens: "séparation de biens",
    participation_acquets: "participation aux acquêts",
  };
  const s = statusLabel[status] || (status || "Statut non renseigné");
  const r = regimeLabel[regime] || "";
  const sp = singleParent ? " · parent isolé" : "";
  return (status === "married" || status === "pacs") && r ? `${s} · ${r}${sp}` : `${s}${sp}`;
}

function composeLienEnfant(parentLink: string, p1Prenom?: string, p2Prenom?: string): string {
  // Vraies clés issues de src/constants/index.ts:CHILD_LINKS.
  // Libellé enrichi : "Enfant de [prénom]" si dispo, sinon fallback générique.
  if (parentLink === "common_child") return "Commun";
  if (parentLink === "person1_only") {
    return p1Prenom ? `Enfant de ${p1Prenom}` : "Personne 1 uniquement";
  }
  if (parentLink === "person2_only") {
    return p2Prenom ? `Enfant de ${p2Prenom}` : "Personne 2 uniquement";
  }
  return parentLink || "—";
}

function composeGarde(custody: string): string {
  // Vraies clés issues de src/constants/index.ts:CUSTODY_OPTIONS
  const map: Record<string, string> = {
    full: "Classique",
    alternate: "Alternée",
  };
  return map[custody] || custody || "—";
}
