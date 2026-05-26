// ─── Lot Dossier client — Adapter Profil & adéquation MIF II v2 ──────
//
// Mappe le questionnaire mission + le résultat de computeProfilRisque +
// computeCapacitePerte vers ProfilPageData.

import type { ProfilPageData, ProfilNiveau } from "../pages/pageProfil";
import { computeProfilRisque, MAX_RISQUE } from "../../../conformite/profil";
import { computeCapacitePerte } from "../../../conformite/capacitePerte";
import type { PatrimonialData } from "../../../../types/patrimoine";

export type BuildProfilDataParams = {
  mission: Record<string, any>;
  data: PatrimonialData;
  cabinet: Record<string, any>;
  signatureSrc?: string;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildProfilData(p: BuildProfilDataParams): ProfilPageData {
  const mission = p.mission || {};
  const cabinet = p.cabinet || {};
  const data: any = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";
  const nomClientSignature = isCouple && p2 ? `${p1} & ${p2}` : (p1 || clientName);

  // Score MIF II
  const score = computeProfilRisque(mission);
  const capacite = computeCapacitePerte(p.data);

  // Mapping profil → niveau (4 niveaux échelle)
  const niveauActif: ProfilNiveau = (score.profil as ProfilNiveau);

  // Label profil avec première majuscule
  const profilRisque = niveauActif.charAt(0).toUpperCase() + niveauActif.slice(1);

  // Horizon : libellé humain
  const horizonLabel: Record<string, string> = {
    "0-4": "moins de 5 ans",
    "5-8": "5 à 8 ans",
    "9-15": "9 à 15 ans",
    "15+": "plus de 15 ans",
  };
  const horizonPlacement = horizonLabel[mission.horizon as string] || "horizon à préciser";

  // Capacité de perte (première majuscule)
  const capaciteLabel = capacite.niveau.charAt(0).toUpperCase() + capacite.niveau.slice(1);

  // Questionnaire MIF II — 6 lignes Q&A synthétiques
  const questionnaire = [
    { question: "Attitude face au risque",       reponse: attitudeLabel(mission.attitude) },
    { question: "Réaction à une baisse de 20 %", reponse: reactionBaisseLabel(mission.reactionBaisse) },
    { question: "Connaissances & expérience",    reponse: connaissancesSummary(mission) },
    { question: "Pertes / gains déjà subis",     reponse: pertesGainsLabel(mission) },
    { question: "Mode de gestion",               reponse: modeGestionLabel(mission.modeGestion) },
    {
      question: "Préférences de durabilité (ESG)",
      reponse: esgLabel(mission.esgPref),
      reponseCouleur: mission.esgPref === "oui" ? "#1F5A41" : undefined,
    },
  ];

  return {
    clientName,
    dateStr,
    profilRisque,
    scoreMifII: `${score.scoreRisque} / ${MAX_RISQUE}`,
    horizonPlacement,
    capacitePerte: capaciteLabel,
    noteKpi: "Capacité à subir des pertes appréciée d'après la situation financière (patrimoine, revenus, épargne disponible) — distincte de la tolérance au risque.",
    niveauActif,
    questionnaire,
    adequationTitre: "Adéquation MIF II",
    adequationTexte: `L'allocation recommandée est cohérente avec un profil ${niveauActif}, un horizon de ${horizonPlacement}, une capacité de perte ${capacite.niveau}${mission.esgPref === "oui" ? " et une préférence marquée pour les investissements durables" : ""}. Profil établi le ${dateStr} — à actualiser en cas d'évolution de votre situation.`,
    nomClientSignature,
    nomConseiller: cabinet.conseiller || cabinet.conseillerNom || "—",
    villeSignature: cabinet.ville || undefined,
    dateSignature: dateStr,
    signatureConseillerSrc: p.signatureSrc || cabinet.signatureSrc || undefined,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Profil & conformité — confidentiel`,
  };
}

// ─── Helpers de libellés humains ──────────────────────────────────────
function attitudeLabel(v: any): string {
  if (v === 0)  return "Portefeuille A — Sécurisé";
  if (v === 8)  return "Portefeuille B — Prudent";
  if (v === 12) return "Portefeuille C — Équilibré";
  if (v === 18) return "Portefeuille D — Dynamique";
  return "Non renseigné";
}
function reactionBaisseLabel(v: any): string {
  if (v === 0)  return "Récupération immédiate";
  if (v === 6)  return "Attente puis arbitrage";
  if (v === 12) return "Maintien des positions";
  if (v === 18) return "Renforcement opportuniste";
  return "Non renseigné";
}
function connaissancesSummary(m: any): string {
  const supports: string[] = [];
  if (m.investiFondsEuros || m.connaitFondsEuros) supports.push("Fonds €");
  if (m.investiActions || m.connaitActions) supports.push("actions");
  if (m.investiOPCVM || m.connaitOPCVM) supports.push("OPCVM");
  if (m.investiImmo || m.connaitImmo) supports.push("immobilier");
  if (m.investiTrackers || m.connaitTrackers) supports.push("ETF");
  if (m.investiStructures || m.connaitStructures) supports.push("structurés");
  return supports.length > 0 ? supports.join(", ") : "Aucun support connu";
}
function pertesGainsLabel(m: any): string {
  if (m.aSubiPertes && m.aRealiseGains) return "Pertes et gains déjà vécus";
  if (m.aSubiPertes) return "Oui, sans modifier sa stratégie";
  if (m.aRealiseGains) return "Gains réalisés (pas de pertes)";
  return "Aucune expérience marchés volatils";
}
function modeGestionLabel(v: any): string {
  if (v === "pilote") return "Pilotée";
  if (v === "libre")  return "Libre";
  return "Conseillée (par défaut)";
}
function esgLabel(v: any): string {
  if (v === "oui")     return "Souhaitées — part significative";
  if (v === "partiel") return "Souhaitées partiellement";
  if (v === "non")     return "Non exprimées";
  return "À préciser";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
