// ─── Lot 9 (bascule) — Adapter cabinet+mission+data → LettreMissionData v2 ─
//
// Construit le `LettreMissionPageData` depuis l'état app : cabinet (Lot 5),
// mission (besoins client), data (composition foyer). Pas de calcul fiscal.

import type { LettreMissionPageData } from "../pages/pageLettreMission";
import type { CasePrestation } from "../primitives";

export type BuildLettreMissionDataParams = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  data: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
};

export function buildLettreMissionData(p: BuildLettreMissionDataParams): LettreMissionPageData {
  const cabinet = p.cabinet || {};
  const mission = p.mission || {};
  const data = p.data || {};
  const dateLettre = p.dateLettre || formatDateFr(new Date());

  // Statuts IAS : on déduit les libellés à partir des sous-statuts cochés.
  const statutCif = !!cabinet.statutCif;
  const catsIas: string[] = [];
  if (cabinet.statutCoa) catsIas.push("Courtier en assurance (COA)");
  if (cabinet.statutMia) catsIas.push("Mandataire d'intermédiaire en assurance (MIA)");
  if (cabinet.statutIobsp) catsIas.push("Intermédiaire en op. de banque (IOBSP)");
  const cabinetStatuts = catsIas.join(" · ") || "à confirmer";

  // Prestations cochées — déduites des besoins du dossier (mission.besoin*).
  const anyChecked = (prefix: string): boolean => Object.keys(mission)
    .some(k => k.startsWith(prefix) && !!mission[k]);
  const prestations: CasePrestation[] = [
    { label: "Bilan patrimonial global",        cochee: true },
    { label: "Optimisation fiscale (IR / IFI)", cochee: true },
    { label: "Stratégie de transmission",       cochee: true },
    { label: "Analyse prévoyance & protection", cochee: anyChecked("besoinPrev_") || anyChecked("besoinSante_") },
    { label: "Préparation de la retraite",      cochee: anyChecked("besoinRetraite_") },
    { label: "Allocation d'actifs / placements", cochee: anyChecked("besoinEpargne_") },
  ];

  // Identité client : combine person1/person2 selon coupleStatus.
  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs" || data.coupleStatus === "cohab";
  const clientNom = (isCouple && p2) ? `${p1} & ${p2}` : (p1 || p.clientName || "nom & prénom");

  const adresseClient = [data.adresse, data.codePostal, data.ville].filter(Boolean).join(", ");

  return {
    // Cabinet
    cabinetNom:        cabinet.cabinetName || "—",
    cabinetAdresse:    [cabinet.adresse, [cabinet.codePostal, cabinet.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "adresse",
    cabinetTel:        cabinet.tel || undefined,
    cabinetEmail:      cabinet.email || undefined,
    cabinetORIAS:      cabinet.orias || "—",
    cabinetStatuts,
    cabinetConseiller: cabinet.conseiller || cabinet.conseillerNom || "—",
    signatureConseillerSrc: cabinet.signatureSrc || undefined,
    cabinetBaremeHonoraires: cabinet.baremeHonoraires || undefined,
    cabinetPartenaires:      cabinet.partenaires || undefined,
    cabinetNiveauConseil:    (cabinet.niveauConseil === "2" ? "2" : "1"),
    cabinetRcpAssureur:      cabinet.rcpAssureur || undefined,
    cabinetRcpContrat:       cabinet.rcpContrat  || undefined,
    cabinetRcpGarantiesMin:  cabinet.rcpMontants || undefined,
    cabinetMediateur:        cabinet.mediateur   || undefined,
    cabinetMediateurAdresse: cabinet.mediateurAdresse || undefined,
    cabinetMediateurUrl:     cabinet.mediateurUrl     || undefined,
    cabinetAssociationCif:   statutCif ? (cabinet.associationCif || undefined) : undefined,
    // Statuts
    statutCif,
    // Client (varm)
    clientNom,
    clientAdresse: adresseClient || "adresse",
    clientContact: [data.tel, data.email].filter(Boolean).join(" · ") || "contact",
    dateLettre,
    // Prestations
    prestations,
    // Rémunération (cabinet.remunerationType, cabinet.natureConseil)
    // — convertis en libellé humain ; sentinel explicite si vide.
    remunerationMode: libelleRemuneration(cabinet.remunerationType),
    natureConseil:    libelleNatureConseil(cabinet.natureConseil),
    // Durée / résiliation : modèle par défaut saisi dans Paramètres Cabinet
    // (card « Conseil & rémunération »). Sentinel si vide.
    dureeMission: cabinet.dureeMission || "à confirmer dans Paramètres",
    delaiPreavis: cabinet.delaiPreavis || "à confirmer dans Paramètres",
    villeSignature: mission.lieuSignature || cabinet.ville || undefined,
    mentionNonContractuelle:
      "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur, du contrôle de l'association agréée et, le cas échéant, d'un avocat." +
      (cabinet.cabinetName ? ` ${cabinet.cabinetName}` : "") +
      (cabinet.orias ? ` — ORIAS n° ${cabinet.orias} (statuts à confirmer sur www.orias.fr).` : "."),
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Convertit cabinet.remunerationType (« commission » / « honoraire » /
 *  « mixte » / vide) en libellé humain affiché dans la lettre de mission.
 *  Aligné sur les libellés v1 (pdfMission.ts:345-347). */
function libelleRemuneration(raw: string | undefined): string {
  if (raw === "commission") return "Commission versée par l'assureur (incluse dans la prime)";
  if (raw === "honoraire")  return "Honoraires payés directement par le client";
  if (raw === "mixte")      return "Combinaison commission + honoraires";
  return "à confirmer dans Paramètres";
}

/** Convertit cabinet.natureConseil (« independant » / « non_independant » /
 *  vide) en libellé humain. */
function libelleNatureConseil(raw: string | undefined): string {
  if (raw === "independant")     return "indépendant";
  if (raw === "non_independant") return "non indépendant";
  return "à confirmer dans Paramètres";
}
