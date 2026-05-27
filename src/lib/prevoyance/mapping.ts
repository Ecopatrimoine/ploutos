// ─── Mapping PatrimonialData → EntreePerso (Lot 6 → pont LOT 7) ─────────
//
// Fonction pure utilisée par TabPrevoyancePerso (LOT 7) pour
// construire l'entrée moteur d'une personne à partir du payload
// Ploutos. Si data.travail n'existe pas pour la personne demandée
// (vieux dossier non migré, célibataire avec which="p2", etc.),
// la fonction retourne null — c'est le signal pour l'UI de masquer
// la colonne correspondante.
//
// Les contrats individuels et la couverture collective ne sont PAS
// remplis à ce stade : ils sont saisis dans la UI prévoyance au
// LOT 7 (et seront persistés dans data.prevoyance.{p1|p2} —
// cf. spec §2.2).

import type { PatrimonialData } from "../../types/patrimoine";
import type { EntreePerso } from "./types";

// Âge légal de retraite par défaut. Pour une personnalisation par
// génération (selon date de naissance), voir docs/ROADMAP_PREVOYANCE.md.
const AGE_RETRAITE_DEFAUT = 64;

export function calcAncienneteMois(dateEmbauche: string | null | undefined): number {
  if (!dateEmbauche) return 0;
  const start = new Date(dateEmbauche);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const diff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    (now.getDate() < start.getDate() ? -1 : 0);
  return Math.max(0, diff);
}

export function calcAgeFromBirth(birthDate: string | null | undefined): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mDelta = now.getMonth() - d.getMonth();
  if (mDelta < 0 || (mDelta === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, age);
}

function asNumber(v: string | undefined): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Construit l'entrée moteur pour la personne demandée.
 *
 * Renvoie null si :
 *  - data.travail est absent (dossier non migré)
 *  - data.travail[which] est null (cas P2 sur célibataire)
 */
export function buildEntreePerso(
  data: PatrimonialData,
  which: "p1" | "p2"
): EntreePerso | null {
  const travail = data.travail?.[which];
  if (!travail) return null;

  const birthDate = which === "p1" ? data.person1BirthDate : data.person2BirthDate;
  const age = calcAgeFromBirth(birthDate);

  const salaryAnnuel = asNumber(which === "p1" ? data.salary1 : data.salary2);
  // Le salaire net mensuel sert au calcul de la cible de maintien
  // employeur. On le dérive du net imposable (salary*) saisi dans
  // l'onglet Revenus. Fallback : brut × 0.78 / 12 (approximation
  // documentée dans la spec §6.1).
  const salaireNetMensuel =
    salaryAnnuel > 0
      ? salaryAnnuel / 12
      : travail.salaireBrutAnnuel > 0
      ? (travail.salaireBrutAnnuel * 0.78) / 12
      : 0;

  // Revenu TNS annuel : pour les TNS, on prend le CA saisi dans
  // Revenus (ca1/ca2). Les valeurs travail.revenuBNC/BIC sont
  // marquées dans le type mais non saisies dans l'UI Travail
  // (cf. revue LOT 2 — retrait du doublon avec l'onglet Revenus).
  const caAnnuel = asNumber(which === "p1" ? data.ca1 : data.ca2);
  const revenuTNSAnnuel = caAnnuel > 0 ? caAnnuel : undefined;

  return {
    age,
    ageRetraite: AGE_RETRAITE_DEFAUT,
    statutPro: travail.statutPro,
    caisse: travail.caisseAffiliation,
    idccCCN: travail.employeur?.idccCCN ?? null,
    ancienneteMois: calcAncienneteMois(travail.dateEmbauche),
    salaireBrutAnnuel: travail.salaireBrutAnnuel,
    salaireNetMensuel,
    revenuTNSAnnuel,
    contratsIndividuels: [], // saisis dans l'UI prévoyance (LOT 7)
    couvertureCollective: null, // idem
  };
}
