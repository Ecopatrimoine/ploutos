// src/lib/abonnement.ts
// ──────────────────────────────────────────────────────────────────────────────
// Socle « abonnement » : source unique des Payment Links Stripe, formatage de
// date fr-FR et mapping pur état de licence → contenu du modal d'abonnement.
//
// Consommateurs :
//   • LicenceGate (page de souscription plein écran) — importe les Payment Links.
//   • AbonnementModal (modal accessible en permanence) — importe le mapping + les
//     Payment Links.
// Aucune I/O ici : logique pure, testable sans DOM ni réseau.
// ──────────────────────────────────────────────────────────────────────────────

import type { LicenceInfo } from "../hooks/useLicense";

// ─── Payment Links Stripe LIVE ────────────────────────────────────────────────
// Source unique (auparavant dupliquée dans LicenceGate.tsx). Toute évolution de
// tarif/lien se fait ICI.
export const STRIPE_SOLO_URL   = "https://buy.stripe.com/aFaeVe90DdKM5lMeQD9fW01";
export const STRIPE_ANNUEL_URL = "https://buy.stripe.com/28E7sMdgT5eg29A8sf9fW00";

/**
 * Construit l'URL d'un Payment Link Stripe en rattachant l'utilisateur
 * (client_reference_id) et, si fourni, un code promo pré-rempli.
 * Repris à l'identique du comportement de LicenceGate.
 */
export function buildStripeCheckoutUrl(
  baseUrl: string,
  userId: string,
  promoCode?: string,
): string {
  let url = `${baseUrl}?client_reference_id=${encodeURIComponent(userId)}`;
  const promo = promoCode?.trim();
  if (promo) {
    url += `&prefilled_promo_code=${encodeURIComponent(promo.toUpperCase())}`;
  }
  return url;
}

// ─── Formatage de date fr-FR ──────────────────────────────────────────────────
// Fuseau Europe/Paris figé : rend l'affichage (et les tests) déterministes quel
// que soit le fuseau de la machine. Accepte Date OU chaîne ISO (le cache licence
// peut resservir une date sérialisée en string après un tour JSON).
export function formatDateFr(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(d);
}

// ─── Mapping état de licence → contenu du modal ───────────────────────────────

export type AbonnementStatusKind =
  | "trial"       // essai en cours
  | "paid"        // abonnement payant actif
  | "cancelling"  // payant, résiliation programmée (accès maintenu)
  | "lifetime"    // licence à vie (offre fondateur)
  | "inactive";   // essai terminé / abonnement expiré ou résilié

export type AbonnementActionKind =
  | "payment-links" // proposer les 2 Payment Links (Solo / Annuel)
  | "portal"        // ouvrir le portail Stripe (gérer / résilier / réactiver)
  | "none";         // aucune action (licence à vie)

export interface AbonnementView {
  statusKind:  AbonnementStatusKind;
  statusTitle: string;
  /** Lignes de détail déjà formatées (dates fr-FR incluses). */
  statusLines: string[];
  action:      AbonnementActionKind;
}

/**
 * Mappe un état de licence (useLicense) vers le contenu de la zone « statut » et
 * l'action proposée par le modal d'abonnement. Fonction PURE — aucune I/O.
 *
 * Règles :
 *   • lifetime               → « Licence à vie — offre fondateur », aucune action.
 *   • trial + active         → jours restants + date de fin, Payment Links.
 *   • trial + non-actif      → « Période d'essai terminée », Payment Links.
 *   • paid + cancelling      → « Abonnement actif » + résiliation programmée, portail.
 *   • paid + active          → « Abonnement actif », portail.
 *   • paid + expiré/annulé   → « Abonnement inactif », Payment Links.
 *   • sans licence (null)    → « Abonnement inactif », Payment Links (fail-closed).
 */
export function mapLicenceToModal(licence: LicenceInfo): AbonnementView {
  const { type, status, trialEnd, trialDaysLeft, cancelAt } = licence;

  // Licence à vie — priorité absolue, aucune échéance ni action.
  if (type === "lifetime") {
    return {
      statusKind:  "lifetime",
      statusTitle: "Licence à vie",
      statusLines: ["Offre fondateur — accès permanent, sans échéance."],
      action:      "none",
    };
  }

  // Essai gratuit.
  if (type === "trial") {
    if (status === "active") {
      const d = Math.max(0, trialDaysLeft);
      const lines = [`${d} jour${d > 1 ? "s" : ""} restant${d > 1 ? "s" : ""}`];
      if (trialEnd) lines.push(`Fin de l'essai le ${formatDateFr(trialEnd)}`);
      return {
        statusKind:  "trial",
        statusTitle: "Essai gratuit",
        statusLines: lines,
        action:      "payment-links",
      };
    }
    // Essai expiré / non actif.
    return {
      statusKind:  "inactive",
      statusTitle: "Période d'essai terminée",
      statusLines: ["Souscrivez un abonnement pour continuer à utiliser Ploutos."],
      action:      "payment-links",
    };
  }

  // Abonnement payant.
  if (type === "paid") {
    if (status === "cancelling") {
      return {
        statusKind:  "cancelling",
        statusTitle: "Abonnement actif",
        statusLines: cancelAt
          ? [`Résiliation programmée le ${formatDateFr(cancelAt)}`, "Accès maintenu jusqu'à cette date."]
          : ["Résiliation programmée en fin de période.", "Accès maintenu jusqu'à cette date."],
        action:      "portal",
      };
    }
    if (status === "active") {
      return {
        statusKind:  "paid",
        statusTitle: "Abonnement actif",
        statusLines: ["Renouvellement automatique."],
        action:      "portal",
      };
    }
    // Expiré / résilié.
    return {
      statusKind:  "inactive",
      statusTitle: "Abonnement inactif",
      statusLines: ["Renouvelez votre abonnement pour retrouver l'accès."],
      action:      "payment-links",
    };
  }

  // Aucune licence identifiée (type null / status "none") — fail-closed.
  return {
    statusKind:  "inactive",
    statusTitle: "Abonnement inactif",
    statusLines: ["Aucun abonnement actif."],
    action:      "payment-links",
  };
}
