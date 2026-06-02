// ─── Module Prévoyance (v1.4.0) — utilitaires partagés ──────────────────
//
// Ce fichier expose :
// - validateSiret(s)         : check format 14 chiffres
// - resolveSiret(siret)      : appel API recherche-entreprises pour
//                              auto-résoudre nom, NAF, IDCC, effectif…
// - lookupCCNName(idcc)      : libellé d'une CCN à partir de son IDCC
//                              (STUB Lot 2 — sera complété au Lot 3
//                              quand le référentiel ccn-2026.json sera
//                              disponible).
// - createEmptyTravail()     : structure PayloadTravail initiale vide
//
// Hors de tout référentiel : pas de valeur inventée. Tant que le Lot 3
// n'a pas renseigné les libellés CCN, lookupCCNName renvoie null.

import type {
  CodeCaisse,
  ContratTransmissionDeces,
  EmployeurInfo,
  PatrimonialData,
  PayloadContratIndividuel,
  PayloadPrevoyance,
  PayloadPrevoyancePerso,
  PayloadTravail,
  StatutPro,
} from "../../types/patrimoine";
import ccnReferentiel from "../../data/prevoyance/ccn-2026.json";

const API_RECHERCHE_ENTREPRISES =
  "https://recherche-entreprises.api.gouv.fr/search";

export function validateSiret(siret: string | null | undefined): boolean {
  if (!siret) return false;
  return /^\d{14}$/.test(siret);
}

export function lookupCCNName(idcc: string | null | undefined): string | null {
  // Lot 3 : lookup réel sur ccn-2026.json. Retourne null si l'IDCC
  // n'est pas dans le référentiel (au lieu d'un libellé inventé).
  if (!idcc) return null;
  const conventions = (ccnReferentiel as { conventions?: Record<string, { nom?: string }> })
    .conventions;
  if (!conventions) return null;
  return conventions[idcc]?.nom ?? null;
}

export type ResolveSiretResult =
  | { ok: true; data: EmployeurInfo }
  | { ok: false; reason: "invalid_format" | "not_found" | "network_error" };

export async function resolveSiret(
  siret: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolveSiretResult> {
  if (!validateSiret(siret)) {
    return { ok: false, reason: "invalid_format" };
  }
  const url = `${API_RECHERCHE_ENTREPRISES}?q=${siret}&page=1&per_page=1`;
  let json: any;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return { ok: false, reason: "network_error" };
    json = await res.json();
  } catch {
    return { ok: false, reason: "network_error" };
  }

  const result = json?.results?.[0];
  if (!result) return { ok: false, reason: "not_found" };

  // Privilégier matching_etablissements[].liste_idcc (établissement
  // résolu par le SIRET), fallback complements.liste_idcc (entreprise).
  const etab = result.matching_etablissements?.[0];
  const idccList: string[] =
    etab?.liste_idcc ?? result.complements?.liste_idcc ?? [];
  const idccCCN = idccList[0] ?? null;

  const effectifRaw =
    etab?.tranche_effectif_salarie ?? result.tranche_effectif_salarie ?? null;
  const effectif =
    effectifRaw !== null && effectifRaw !== undefined && effectifRaw !== ""
      ? Number(effectifRaw)
      : null;

  const data: EmployeurInfo = {
    siret,
    siren: siret.substring(0, 9),
    nom: result.nom_complet ?? result.nom_raison_sociale ?? null,
    formeJuridique: result.nature_juridique ?? null,
    codeNAF:
      etab?.activite_principale ?? result.activite_principale ?? null,
    idccCCN,
    nomCCN: idccCCN ? lookupCCNName(idccCCN) : null,
    sourceCCN: idccCCN ? "auto" : "non_defini",
    effectif: Number.isFinite(effectif as number) ? effectif : null,
    adresseEtablissement: etab?.adresse ?? null,
    dateCreation: result.date_creation ?? null,
  };
  return { ok: true, data };
}

export function createEmptyTravail(): PayloadTravail {
  return {
    statutPro: "",
    caisseAffiliation: null,
    employeur: null,
    dateEmbauche: null,
    dateDebutActivite: null,
    tempsTravail: { type: "plein" },
    salaireBrutAnnuel: 0,
    primeAnnuelle: null,
    revenuBNC: null,
    revenuBIC: null,
    optionMadelin: false,
  };
}

// ─── Persistance des saisies Prévoyance par personne (data.prevoyance) ──
// Helpers PARTAGÉS entre l'onglet Prévoyance (lecture/projection) et l'onglet
// Travail (saisie des blocs caisse) : une seule logique de merge, pas de
// duplication. Le stockage reste data.prevoyance.{p1|p2}.

export function defaultPrevoyancePerso(): PayloadPrevoyancePerso {
  return {
    contratsIndividuels: [],
    couvertureCollective: null,
    categorieInvaliditeProjetee: "cat2",
    scenarioArret: "ald",
  };
}

export function getPrevoyancePerso(
  data: PatrimonialData,
  which: "p1" | "p2"
): PayloadPrevoyancePerso {
  return data.prevoyance?.[which] ?? defaultPrevoyancePerso();
}

// Lecture rétro-compatible des contrats de transmission décès d'une personne.
// Champ optionnel introduit après les premiers dossiers → absent => [].
export function getContratsTransmissionDeces(
  perso: PayloadPrevoyancePerso
): ContratTransmissionDeces[] {
  return perso.contratsTransmissionDeces ?? [];
}

// Valeur HISTORIQUE de ContratIndividuel.type retirée des types CRÉABLES (R4) :
// plus aucune saisie ne la produit, mais des dossiers enregistrés la contiennent
// encore. Typée `string` (et non littéral) → reconnue à la LECTURE sans être un
// membre de l'union créable (cf. comparaison tolérée par tsc, comme StatutPro).
export const TYPE_DECES_CAPITAL_LEGACY: string = "deces_capital";

// ── Pont (read-time) deces_capital legacy → contrat de transmission (VOIE A R2) ──
// Mappe un ancien ContratIndividuel "deces_capital" vers le type riche
// ContratTransmissionDeces, SANS réécrire le stockage (lecture seule).
// Bénéficiaires VIDES : le CGP les complétera (Option A — le capital reste
// VISIBLE en succession, non taxé tant qu'aucun bénéficiaire n'est désigné).
// À n'appeler QUE sur un contrat de type "deces_capital".
export function mapDecesCapitalLegacy(c: PayloadContratIndividuel): ContratTransmissionDeces {
  const contrat: ContratTransmissionDeces = {
    id: `legacy_${c.id}`,
    libelle: "Capital décès",
    natureAssiette: "capital",
    capitalTransmis: Number.isFinite(c.capitalOuMontant) ? c.capitalOuMontant : 0,
    beneficiaires: [],
  };
  if (c.conditions) contrat.conditions = c.conditions;
  return contrat;
}

// Contrats de transmission décès d'une personne, contrats RÉELS + anciens
// "deces_capital" mappés à la volée (pont R2, read-time, non destructif).
// SOURCE UNIQUE pour la succession → cohérence garantie et AUCUN double-comptage :
// la succession ne lisait que les contrats de transmission (jamais le legacy),
// donc ajouter le legacy mappé ne double rien. Les CONSTATS, eux, restent sur
// les listes BRUTES (cf. capitalDecesUnifie) et N'utilisent PAS cette fonction.
export function getContratsTransmissionDecesAvecLegacy(
  perso: PayloadPrevoyancePerso
): ContratTransmissionDeces[] {
  const reels = perso.contratsTransmissionDeces ?? [];
  const legacy = (perso.contratsIndividuels ?? [])
    .filter((c) => c.type === TYPE_DECES_CAPITAL_LEGACY)
    .map(mapDecesCapitalLegacy);
  return [...reels, ...legacy];
}

// Merge pur : renvoie le PayloadPrevoyance suivant après application d'un
// patch sur la personne `which`. `hasP2` détermine l'initialisation de p2
// quand data.prevoyance est entièrement absent (couple/2e personne présente).
export function patchPrevoyancePair(
  current: PayloadPrevoyance | null | undefined,
  which: "p1" | "p2",
  patch: Partial<PayloadPrevoyancePerso>,
  hasP2: boolean
): PayloadPrevoyance {
  const cur: PayloadPrevoyance = current ?? {
    version: 1,
    p1: defaultPrevoyancePerso(),
    p2: hasP2 ? defaultPrevoyancePerso() : null,
  };
  return {
    version: 1,
    p1: which === "p1" ? { ...cur.p1, ...patch } : cur.p1,
    p2:
      which === "p2"
        ? { ...(cur.p2 ?? defaultPrevoyancePerso()), ...patch }
        : cur.p2,
  };
}

// Suggestion de caisse d'affiliation à partir du statut professionnel
// uniquement (le PCS de Ploutos n'est pas assez fin pour distinguer
// médecin / avocat / notaire au sein de la catégorie "professions
// libérales"). L'utilisateur peut toujours override manuellement.
//   - salarié + assimilé + fonctionnaire → CPAM
//   - TNS commerce / artisan / gérant majoritaire → SSI
//   - TNS libéral → null (l'utilisateur précise sa caisse)
//   - retraité / sans activité → null
export function suggestCaisseFromStatut(
  statut: StatutPro | "" | null | undefined
): CodeCaisse | null {
  switch (statut) {
    case "salarie_non_cadre":
    case "salarie_cadre":
    case "president_sas":
    case "eurl_unique":
    case "fonctionnaire":
      return "CPAM";
    case "tns_commercant":
    case "tns_artisan":
    case "gerant_majoritaire":
      return "SSI";
    case "tns_liberal":
    case "retraite":
    case "sans_activite":
    case "":
    case null:
    case undefined:
    default:
      return null;
  }
}

export function createEmptyEmployeur(): EmployeurInfo {
  return {
    siret: null,
    siren: null,
    nom: null,
    formeJuridique: null,
    codeNAF: null,
    idccCCN: null,
    nomCCN: null,
    sourceCCN: "non_defini",
    effectif: null,
    adresseEtablissement: null,
    dateCreation: null,
  };
}
