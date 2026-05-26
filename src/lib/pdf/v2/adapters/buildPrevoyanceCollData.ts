// ─── Lot Dossier client — Adapter Prévoyance collective v2 ──────────
//
// Page dédiée aux dirigeants/salariés assimilés salariés (SAS, SASU…).
// Pour cette première version, la matrice conformité est statique (les
// vrais audits CCN nécessitent un moteur de règles dédié branché sur les
// IDCC). L'adapter compose une page « audit entreprise » indicative.

import type { PrevoyanceCollPageData } from "../pages/pagePrevoyanceColl";

export type BuildPrevoyanceCollDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildPrevoyanceCollData(p: BuildPrevoyanceCollDataParams): PrevoyanceCollPageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // Profession : si dirigeant assimilé salarié → page pertinente
  const jobTitle = String(data.person1JobTitle || "").toLowerCase();
  const isDirigeant = /pr[ée]sident|g[ée]rant|dirigeant|sas|sasu/.test(jobTitle);

  return {
    clientName: clientName + (isDirigeant ? " — audit entreprise" : ""),
    dateStr,
    sousTitre: isDirigeant
      ? `Dirigeant ${jobTitle.replace(/\b\w/g, c => c.toUpperCase())}`
      : undefined,
    conformiteResume: "À auditer",
    effectif: "—",
    effectifCadres: "—",
    statutDirigeant: isDirigeant ? "Assimilé salarié" : "Non concerné",
    ccnLabel: "Convention collective applicable",
    ccnValeur: "À déterminer (SIRET requis)",
    ccnPillStatut: "info",
    ccnPillLabel: "À résoudre via SIRET",
    matrice: [
      { titre: "Santé collective obligatoire",  reference: "ANI 2013 · art. L.911-7 CSS",                statut: "info", pillLabel: "À vérifier" },
      { titre: "Prévoyance décès cadres",       reference: "cotisation 1,50 % sur la tranche T1 (≤ PASS)", statut: "info", pillLabel: "À vérifier" },
      { titre: "Planchers de branche",          reference: "lecture détaillée de la CCN requise",        statut: "info", pillLabel: "À confirmer" },
      { titre: "Catégories objectives",         reference: "décret 2021-1002 · applicable depuis 2025",   statut: "info", pillLabel: "À vérifier" },
    ],
    conseilDirigeantHtml: isDirigeant
      ? "<strong>Assimilé salarié</strong> : vous bénéficiez du régime collectif santé et prévoyance de l'entreprise. Une retraite supplémentaire reste mobilisable via un PERO."
      : "Cette page concerne les dirigeants assimilés salariés (SAS, SASU, SARL gérant minoritaire). Profil non détecté dans ce dossier — section incluse pour information.",
    mentionNonContractuelle:
      "Analyse non contractuelle, à valider au regard de la convention collective applicable et de la situation réelle de l'entreprise. Ne constitue pas un conseil juridique, fiscal ou en investissement.",
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Audit entreprise — confidentiel`,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
