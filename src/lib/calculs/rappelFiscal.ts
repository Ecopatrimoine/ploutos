// ─── Moteur de rappel fiscal des donations (art. 784 CGI) — module PUR ────────
//
// Calcule, pour UN heritier/beneficiaire, l'impact des donations PASSEES du
// registre (data.donations) au moment d'un deces simule : abattement de donation
// deja consomme + base deja taxee au bareme (reprise de progressivite). Aucun
// setState, aucun hook, aucune date implicite (dateReference INJECTEE — coherent
// avec le moteur succession). Le BRANCHEMENT sur computeSuccession est le Lot B.
//
// Regles (art. 784 CGI) :
//  - Fenetre de rappel = 15 ans AVANT dateReference (deces simule).
//  - Types HORS rappel, ignores integralement : don familial de sommes d'argent
//    (790 G), 790 A bis, present d'usage (art. 852 CC).
//  - Consommation SEQUENTIELLE par date croissante : chaque donation simple
//    consomme l'abattement de DONATION disponible ; l'excedent = base taxee.
//  - CONSERVATEUR : date ou montant manquant/invalide -> donation IGNOREE du
//    rappel + flag `aVerifier` (jamais de rappel invente).

import type { DonationPassee } from "../../types/patrimoine";
import { n } from "./utils";
import { getDonationTaxProfile } from "./donation";

export type RappelParHeritier = {
  abattementConsomme: number;       // abattement (succession) du beneficiaire deja entame
  baseTaxeeAnterieure: number;      // cumul des bases deja taxees au bareme (reprise progressivite)
  donationsRetenues: DonationPassee[]; // < 15 ans, type simple, valides (triees par date)
  aVerifier: boolean;               // au moins une donation ignoree faute de date/montant
};

// Types de donation exclus du rappel des 15 ans.
const HORS_RAPPEL = new Set(["don_familial_790G", "don_790A_bis", "present_usage"]);

// Relation fiscale du beneficiaire d'une DonationPassee (vocab getDonationTaxProfile).
function relationDe(d: DonationPassee): string {
  if (d.beneficiaireType === "child") return "enfant";
  if (d.beneficiaireType === "conjoint") return "conjoint";
  return d.beneficiaireRelation || "tiers";
}

function parseTime(iso: unknown): number {
  const t = new Date(String(iso ?? "")).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function computeRappelParHeritier(
  donations: DonationPassee[],
  donorKey: "person1" | "person2",
  beneficiaireMatch: (d: DonationPassee) => boolean,
  dateReference: string,
): RappelParHeritier {
  const refTime = parseTime(dateReference);
  const refValide = Number.isFinite(refTime);
  // Cutoff = dateReference - 15 ans. Strictement APRES le cutoff = dans la fenetre
  // (une donation d'il y a exactement 15 ans sort du rappel).
  const ref = new Date(dateReference);
  const cutoff = new Date(ref);
  cutoff.setFullYear(ref.getFullYear() - 15);
  const cutoffTime = cutoff.getTime();

  let aVerifier = false;
  const rappelables: DonationPassee[] = [];

  const candidats = (Array.isArray(donations) ? donations : []).filter(
    (d) => d.donorPersonKey === donorKey && beneficiaireMatch(d),
  );

  for (const d of candidats) {
    if (HORS_RAPPEL.has(d.type)) continue; // hors rappel, jamais aVerifier
    const dTime = parseTime(d.date);
    const montant = n(d.montant);
    const dateManquante = String(d.date ?? "").trim() === "" || !Number.isFinite(dTime);
    const montantManquant = String(d.montant ?? "").trim() === "" || !(montant > 0);
    if (!refValide || dateManquante || montantManquant) { aVerifier = true; continue; }
    if (dTime <= cutoffTime) continue; // hors fenetre 15 ans (pas d'ambiguite -> pas aVerifier)
    rappelables.push(d);
  }

  // Consommation sequentielle par date croissante (art. 784).
  rappelables.sort((a, b) => parseTime(a.date) - parseTime(b.date));

  // Abattement DONATION du beneficiaire (les donations matchees visent le meme
  // beneficiaire -> meme relation). handicap non modelise dans le registre v1.
  const allowance = rappelables.length > 0
    ? getDonationTaxProfile(relationDe(rappelables[0])).allowance
    : 0;

  // SIMPLIFICATION ASSUMEE v1 : on consomme un abattement UNIQUE (ex. 100 000 pour
  // un enfant) sans reconstituer d'eventuels cycles de 15 ans ENTRE donations
  // passees. Cas rarissime de donations etalees sur > 15 ans ENTRE elles : la plus
  // ancienne sort de toute facon de la fenetre du deces (absente de `rappelables`).
  let poolRestant = allowance;
  let baseTaxeeAnterieure = 0;
  for (const d of rappelables) {
    const montant = n(d.montant);
    const consomme = Math.min(montant, poolRestant);
    poolRestant -= consomme;
    baseTaxeeAnterieure += montant - consomme;
  }
  const abattementConsomme = allowance - poolRestant;

  return { abattementConsomme, baseTaxeeAnterieure, donationsRetenues: rappelables, aVerifier };
}
