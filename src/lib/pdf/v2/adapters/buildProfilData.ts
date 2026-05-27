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

  // ─── Analyse "masque" structurée — cadrage + composition + leviers ────
  // Cohérence profil ↔ capacité (alerte si dissonance forte)
  const ordreNiveaux: Record<string, number> = { "prudent": 1, "équilibré": 2, "dynamique": 3, "offensif": 4 };
  const ordreCapacite: Record<string, number> = { "faible": 1, "modérée": 2, "élevée": 3 };
  const niveauScore = ordreNiveaux[niveauActif] || 2;
  const capaciteScore = ordreCapacite[capacite.niveau as string] || 2;
  const dissonance = Math.abs(niveauScore - capaciteScore) >= 2;

  // Allocation cible indicative selon profil — vocabulaire assurance-vie (COA).
  // Ne mentionne PAS de produit, d'assureur ni d'instruments financiers en direct
  // (qui relèverait du conseil CIF — hors périmètre Ecopatrimoine actuel).
  // 1 répartition unique par profil ("environ"), à répartir sur l'ensemble des
  // placements financiers du foyer (AV, PER, contrat de capitalisation).
  const allocationCible: Record<string, string> = {
    "prudent":   "environ 80 % support en euros + 20 % unités de compte (peu volatiles)",
    "équilibré": "environ 50 % support en euros + 50 % unités de compte diversifiées",
    "dynamique": "environ 30 % support en euros + 70 % unités de compte diversifiées",
    "offensif":  "environ 10 % support en euros + 90 % unités de compte (forte diversification)",
  };
  const allocationTexte = `${allocationCible[niveauActif] || "à définir selon profil"} — répartition indicative, à appliquer sur l'ensemble de vos placements financiers (assurance-vie, PER, contrat de capitalisation) et à affiner avec votre conseiller selon les supports détenus`;

  // Leviers contextuels
  const leviers: string[] = [];
  if (dissonance) {
    leviers.push(`<span style="color:#B0413E;font-weight:600">⚠ Dissonance profil ↔ capacité</span> : profil ${niveauActif} vs capacité ${capacite.niveau}. À arbitrer avec le client (capacité financière = contrainte, profil = préférence).`);
  }
  if (mission.esgPref === "oui") {
    leviers.push("Préférences ESG marquées — privilégier supports labellisés ISR / Greenfin / Finansol, et l'art. 9 SFDR pour les UC");
  } else if (mission.esgPref === "non" || !mission.esgPref) {
    leviers.push("Préférences ESG non exprimées — possibilité de cocher au prochain rendez-vous (obligation RG AMF de réinterroger périodiquement)");
  }
  if (mission.horizon === "0-4") {
    leviers.push("Horizon court (< 5 ans) — privilégier la liquidité et la sécurité du capital ; éviter les UC volatiles");
  } else if (mission.horizon === "15+") {
    leviers.push("Horizon long (> 15 ans) — capacité à supporter la volatilité ; intérêt actions et diversifiants long terme");
  }
  if (leviers.length === 0) {
    leviers.push("Profil cohérent et bien renseigné — réviser au moins une fois par an et à chaque évolution patrimoniale ou familiale");
  }

  const notreLecture = `
    <p style="margin:0 0 10px 0">Votre profil MIF II est <strong>${niveauActif}</strong> (score ${score.scoreRisque}/${MAX_RISQUE}), associé à un horizon de placement <strong>${horizonPlacement}</strong> et à une capacité de subir des pertes <strong>${capacite.niveau}</strong>. Le profil reflète votre <strong>tolérance au risque</strong> ; la capacité de perte est mesurée sur votre situation financière objective.</p>
    <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
      <li><strong>Allocation cible indicative</strong> — ${allocationTexte}.</li>
      <li><strong>Mode de gestion choisi</strong> — ${modeGestionLabel(mission.modeGestion)} ${mission.modeGestion === "pilote" ? "(décisions déléguées au gestionnaire)" : mission.modeGestion === "libre" ? "(autonomie totale, sans accompagnement individualisé)" : "(conseil personnalisé, vous décidez)"}.</li>
      <li><strong>Préférences ESG</strong> — ${esgLabel(mission.esgPref)}.</li>
    </ul>
    <p style="margin:0;font-style:italic;color:#6B6353"><strong>Points d'attention :</strong> ${leviers.join(" ; ")}.</p>
  `.trim();

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
    notreLecture,
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
