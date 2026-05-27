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
  EmployeurInfo,
  PayloadTravail,
} from "../../types/patrimoine";

const API_RECHERCHE_ENTREPRISES =
  "https://recherche-entreprises.api.gouv.fr/search";

export function validateSiret(siret: string | null | undefined): boolean {
  if (!siret) return false;
  return /^\d{14}$/.test(siret);
}

export function lookupCCNName(_idcc: string | null | undefined): string | null {
  // Lot 2 : stub. Le Lot 3 ajoutera le fichier ccn-2026.json et un
  // lookup réel. Pour l'instant on ne renvoie que null afin de NE PAS
  // afficher de libellé non vérifié.
  return null;
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
    tempsTravail: { type: "plein" },
    salaireBrutAnnuel: 0,
    primeAnnuelle: null,
    revenuBNC: null,
    revenuBIC: null,
    optionMadelin: false,
  };
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
