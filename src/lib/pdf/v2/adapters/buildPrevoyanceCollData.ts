// ─── Lot 9 — Adapter Prévoyance collective v2 (module Prévoyance) ───────
//
// Adapter PUR : construit l'EntrepriseAudit (depuis data.prevoyance.
// collective, sinon depuis le dirigeant détecté dans data.travail),
// lance runAuditConformite + mapAuditEnConstats, et produit le
// PrevoyanceCollPageData consommé par pagePrevoyanceColl.

import type { PrevoyanceCollPageData } from "../pages/pagePrevoyanceColl";
import { plur } from "../../../calculs/utils";
import type { EntrepriseAudit } from "../../../../types/patrimoine";
import { runAuditConformite } from "../../../prevoyance/audit-collectif";
import { buildVueObligationsFusionnee } from "../../../prevoyance/comparaison-branche-vue";
import { referentiels } from "../../../../data/prevoyance";
import { mentionDDAPrevoyance } from "../textesLegaux";

export type BuildPrevoyanceCollDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

const STATUTS_DIRIGEANT = ["gerant_majoritaire", "president_sas", "eurl_unique"];

function emptyEntreprise(): EntrepriseAudit {
  return {
    siret: null, nom: null, formeJuridique: null, effectif: null,
    idccCCN: null, nomCCN: null, codeNAF: null,
    santeCollectiveEnPlace: false, participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false, tauxT1Cadres: 1.5,
    prevoyanceNonCadresEnPlace: false, categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false,
  };
}

function entrepriseDepuisTravail(data: any, which: "p1" | "p2"): EntrepriseAudit {
  const t = which === "p1" ? data.travail?.p1 : data.travail?.p2;
  const employeur = t?.employeur ?? null;
  const base = emptyEntreprise();
  if (!employeur) return base;
  return {
    ...base,
    siret: employeur.siret ?? null,
    nom: employeur.nom ?? null,
    formeJuridique: employeur.formeJuridique ?? null,
    effectif: employeur.effectif ?? null,
    idccCCN: employeur.idccCCN ?? null,
    nomCCN: employeur.nomCCN ?? null,
    codeNAF: employeur.codeNAF ?? null,
  };
}

function detectDirigeant(data: any): "p1" | "p2" | null {
  if (STATUTS_DIRIGEANT.includes(data.travail?.p1?.statutPro ?? "")) return "p1";
  if (STATUTS_DIRIGEANT.includes(data.travail?.p2?.statutPro ?? "")) return "p2";
  return null;
}

export function buildPrevoyanceCollData(p: BuildPrevoyanceCollDataParams): PrevoyanceCollPageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());
  const clientName =
    p.clientName ||
    [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") ||
    "Client";

  const cabinetNom = cabinet.cabinetName || cabinet.nom || "Cabinet";
  const orias = cabinet.orias || "—";
  const mentionDDA = mentionDDAPrevoyance(cabinetNom, orias);
  const cabinetLibellePied = `${cabinetNom} · Prévoyance collective — confidentiel`;

  // Source : collective enregistrée OU dirigeant détecté.
  const stored = data.prevoyance?.collective ?? null;
  const dirigeant = detectDirigeant(data);
  let entreprise: EntrepriseAudit | null = null;
  let sousTitre = "Audit conformité de la couverture collective";

  if (stored && stored.active) {
    entreprise = stored.entreprise;
    if (stored.source === "analyse_externe") sousTitre = "Analyse externe (mission RH / audit)";
    else sousTitre = "Dirigeant analysé — entreprise du foyer";
  } else if (dirigeant) {
    entreprise = entrepriseDepuisTravail(data, dirigeant);
    const prenom =
      dirigeant === "p1"
        ? [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ")
        : [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
    sousTitre = `Dirigeant analysé${prenom ? ` : ${prenom}` : ""}${entreprise.nom ? ` — ${entreprise.nom}` : ""}`;
  }

  if (!entreprise) {
    return {
      active: false,
      clientName,
      dateStr,
      sousTitre,
      scoreGlobal: "—",
      effectifLibelle: "—",
      entrepriseLibelle: "—",
      ccnLibelle: "—",
      controles: [],
      champApplicationCCN: null,
      vueObligations: null,
      mentionDDA,
      pagePosition: p.pagePosition || "— / —",
      cabinetLibellePied,
    };
  }

  const audit = runAuditConformite(entreprise, referentiels);
  // Memes entrees que l'ecran (Lot 5) -> contenu identique garanti (vue fusionnee).
  const vueObligations = buildVueObligationsFusionnee(entreprise, referentiels);
  // Phrase d'explication de la CCN (champ d'application) — meme cast local que
  // obligations-branche.ts / le helper ecran. Affichee en tete de la feuille 1.
  const idcc = entreprise.idccCCN;
  const champApplicationCCN =
    idcc
      ? (referentiels.ccn as { conventions?: Record<string, { champApplication?: string } | undefined> })
          .conventions?.[idcc]?.champApplication ?? null
      : null;

  return {
    active: true,
    clientName,
    dateStr,
    sousTitre,
    scoreGlobal: `${audit.scoreGlobal} %`,
    effectifLibelle: entreprise.effectif !== null ? plur(entreprise.effectif, "salarié") : "Non renseigné",
    entrepriseLibelle: entreprise.nom || "Entreprise",
    ccnLibelle: entreprise.idccCCN ? `IDCC ${entreprise.idccCCN}` : "—",
    controles: audit.controles,
    champApplicationCCN,
    vueObligations,
    mentionDDA,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
