// ─── Lot 9 (bascule) — Adapter cabinet+data+mission+reco → AdequationData v2 ─
//
// Construit le `DeclarationAdequationPageData` depuis l'état app :
//  - profil & ESG : computeProfilRisque(mission) (Lot 6)
//  - capacité de perte : computeCapacitePerte(data) (Lot 6)
//  - horizon : mission.horizon (libellé barème)
//  - recommandations : filterComplete(recommandations) (Lot 7)
//  - heure conseil : new Date() à la génération

import type {
  DeclarationAdequationPageData,
  ChampProfilAdequation,
  LigneRecommandation,
  GroupeRecommandationsParDimension,
} from "../pages/pageDeclarationAdequation";
import type { LigneBesoinReponse } from "../primitives";
import { computeProfilRisque } from "../../../conformite/profil";
import { computeCapacitePerte } from "../../../conformite/capacitePerte";
import {
  filterComplete,
  groupRecommandationsByDimension,
  DIMENSIONS_LABEL,
  DIMENSIONS_ORDER,
  BESOIN_LIBELLES,
  type Recommandation,
} from "../../../conformite/recommandations";
import type { PatrimonialData } from "../../../../types/patrimoine";

export type BuildAdequationDataParams = {
  cabinet: Record<string, any>;
  data: PatrimonialData;
  mission: Record<string, any>;
  recommandations?: ReadonlyArray<Recommandation>;
  /** Optionnel : forcer date+heure (par défaut : now). */
  dateConseil?: string;
  heureConseil?: string;
  dateQuestionnaire?: string;
};

export function buildAdequationData(p: BuildAdequationDataParams): DeclarationAdequationPageData {
  const cabinet = p.cabinet || {};
  const mission = p.mission || {};
  const now = new Date();
  const dateConseil = p.dateConseil || formatDateFr(now);
  const heureConseil = p.heureConseil || formatHeureFr(now);
  const dateQuestionnaire = p.dateQuestionnaire || dateConseil;

  // ── Profil & ESG (Lot 6) ─────────────────────────────────────────────
  const score = computeProfilRisque(mission);
  const capacite = computeCapacitePerte(p.data);
  const profilLabel = capitalize(score.profil);
  const capaciteLabel = capitalize(capacite.niveau);

  // Horizon : libellé barème mission.horizon (0-4, 5-8, 9-15, 15+).
  const horizonLabel = libelleHorizon(mission.horizon);

  // Préférences ESG : mission.esgPref ("oui" / "partiel" / "non" / "").
  const esgLabel = libelleEsg(mission.esgPref);

  // Objectif principal : déduit des besoins cochés (mission.besoinRetraite_*
  // → préparer la retraite, besoinEpargne_* → valoriser, etc.).
  const objectifLabel = libelleObjectif(mission);

  // Justifications calculées par `computeCapacitePerte()` — liste à puces
  // sous le champ « Capacité à subir des pertes » pour expliquer le niveau
  // (ex: « coussin liquide de 8 mois », « endettement modéré »).
  const capacitePuces = (capacite.justification && capacite.justification.length > 0)
    ? capacite.justification
    : undefined;

  const profil: ChampProfilAdequation[] = [
    { label: "Objectif principal",          valeurHtml: objectifLabel },
    { label: "Horizon",                     valeurHtml: horizonLabel },
    { label: "Profil de risque",            valeurHtml: `${profilLabel} <span style="color:#8C8472">(échelle 4 niveaux)</span>` },
    { label: "Capacité à subir des pertes", valeurHtml: capaciteLabel, puces: capacitePuces },
    { label: "Préférences de durabilité (ESG)", valeurHtml: esgLabel, pleineLargeur: true },
  ];

  // ── Recommandations : filtrer complètes ─────────────────────────────
  // Page 1 garde la liste › synthétique (max 5 libellés). Page 2 reçoit
  // la matrice détaillée par dimension (libellé + justification + besoin).
  const recosComplete = filterComplete(p.recommandations || []);
  const recommandations: LigneRecommandation[] = recosComplete.slice(0, 5).map((r: any) => ({
    texteHtml: r.libelle || "—",
  }));
  if (recommandations.length === 0) {
    recommandations.push(
      { texteHtml: "Aucune recommandation finalisée dans le plan d'action (à compléter dans l'onglet Recommandations)." },
    );
  }

  // ── Matrice « Recommandations issues du diagnostic » page 2 ─────────
  // Groupe les recos par dimension (besoin / risque / ESG / capacité) et
  // attache le libellé humain du besoin (BESOIN_LIBELLES[besoinKey]) si
  // disponible. Si aucune reco, on omet l'encart (recommandationsGroupees
  // = undefined → la page ne rend pas l'encadré).
  let recommandationsGroupees: GroupeRecommandationsParDimension[] | undefined;
  if (recosComplete.length > 0) {
    const grouped = groupRecommandationsByDimension(recosComplete);
    recommandationsGroupees = DIMENSIONS_ORDER
      .map(dim => ({ dim, recos: grouped[dim] || [] }))
      .filter(g => g.recos.length > 0)
      .map(g => ({
        dimensionLabel: DIMENSIONS_LABEL[g.dim],
        recos: g.recos.map(r => ({
          libelle: r.libelle,
          justification: r.justification,
          besoinLibelle: r.besoinKey ? BESOIN_LIBELLES[r.besoinKey] : undefined,
        })),
      }));
  }

  // ── Mise en regard besoin → réponse : reflète les 5 axes du profil ──
  const miseEnRegard: LigneBesoinReponse[] = [
    { besoin: `Objectif : ${objectifLabel.toLowerCase()}`, reponse: "L'allocation et les leviers fiscaux soutiennent l'objectif principal exprimé." },
    { besoin: `Horizon de ${horizonLabel}`,                reponse: "La part d'unités de compte est cohérente avec un placement à moyen-long terme." },
    { besoin: `Profil ${profilLabel.toLowerCase()}`,       reponse: "L'allocation correspond à une prise de risque " + intensiteProfil(score.profil) + "." },
    { besoin: `Capacité de perte ${capaciteLabel.toLowerCase()}`, reponse: "La poche sécurisée limite l'amplitude des pertes possibles au regard de votre situation." },
    { besoin: `Préférence de durabilité ${esgPrefBesoin(mission.esgPref)}`, reponse: esgPrefReponse(mission.esgPref) },
  ];

  // ── Coûts & frais (varm) ─────────────────────────────────────────────
  const coutConseilHtml   = cabinet.baremeHonoraires || "honoraires du dossier";
  const fraisSupportsHtml = "frais courants / entrée selon supports retenus";
  const natureConseilHtml = cabinet.natureConseil    || "indépendant / non indépendant";

  // ── Suivi de l'adéquation (varc) ─────────────────────────────────────
  const periodicite = cabinet.periodiciteRevue;
  const suiviActiveHtml   = periodicite ? "est" : "est / n'est pas";
  const periodiciteSuiviHtml = periodicite || "périodicité";

  return {
    cabinetNom:        cabinet.cabinetName || "—",
    cabinetConseiller: cabinet.conseiller || cabinet.conseillerNom || "—",
    dateConseil,
    heureConseil,
    dateQuestionnaire,
    origineRecommandations: "contenu dossier",
    profil,
    recommandations,
    miseEnRegard,
    coutConseilHtml,
    fraisSupportsHtml,
    natureConseilHtml,
    suiviActiveHtml,
    periodiciteSuiviHtml,
    recommandationsGroupees,
    mentionNonContractuelle:
      "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur, du contrôle de l'association agréée et, le cas échéant, d'un avocat." +
      (cabinet.cabinetName ? ` ${cabinet.cabinetName}` : "") +
      (cabinet.orias ? ` — ORIAS n° ${cabinet.orias} (statuts à confirmer sur www.orias.fr).` : "."),
  };
}

// ─── Helpers locaux ────────────────────────────────────────────────────
function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function formatHeureFr(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}
function capitalize(s: string): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function libelleHorizon(h: any): string {
  if (h === "0-4")  return "moins de 5 ans";
  if (h === "5-8")  return "5 à 8 ans";
  if (h === "9-15") return "9 à 15 ans";
  if (h === "15+")  return "plus de 15 ans";
  return "horizon à préciser";
}
function libelleEsg(e: any): string {
  if (e === "oui")     return "Souhaitées — part significative d'investissements durables";
  if (e === "partiel") return "Souhaitées partiellement";
  if (e === "non")     return "Non exprimées";
  return "À préciser au questionnaire";
}
function libelleObjectif(mission: Record<string, any>): string {
  const anyChecked = (prefix: string) => Object.keys(mission)
    .some(k => k.startsWith(prefix) && !!mission[k]);
  if (anyChecked("besoinRetraite_")) return "Préparer la retraite & valoriser son patrimoine";
  if (anyChecked("besoinEpargne_"))  return "Valoriser son patrimoine & préparer la transmission";
  if (anyChecked("besoinPrev_"))     return "Protéger le foyer & sécuriser ses proches";
  return "Valoriser son patrimoine";
}
function intensiteProfil(p: string): string {
  if (p === "prudent")   return "limitée";
  if (p === "équilibré") return "mesurée, sans recherche de performance maximale";
  if (p === "dynamique") return "plus prononcée, sur un horizon long";
  if (p === "offensif")  return "élevée, en cohérence avec votre tolérance";
  return "adaptée";
}
function esgPrefBesoin(e: any): string {
  if (e === "oui")     return "élevée";
  if (e === "partiel") return "partielle";
  return "à confirmer";
}
function esgPrefReponse(e: any): string {
  if (e === "oui")     return "Une poche d'investissements durables répond à votre souhait exprimé en matière d'ESG.";
  if (e === "partiel") return "Une part d'investissements durables est intégrée à l'allocation.";
  return "Les préférences ESG seront actualisées au prochain entretien.";
}
