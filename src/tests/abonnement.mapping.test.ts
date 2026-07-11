// src/tests/abonnement.mapping.test.ts
// Mapping état de licence → contenu du modal d'abonnement (logique pure).
// Fixtures couvertes : trial / paid / paid+cancel_at / lifetime / expire.

import { describe, it, expect } from "vitest";
import type { LicenceInfo } from "../hooks/useLicense";
import {
  mapLicenceToModal,
  formatDateFr,
  buildStripeCheckoutUrl,
  STRIPE_SOLO_URL,
  STRIPE_ANNUEL_URL,
} from "../lib/abonnement";

// Fabrique une LicenceInfo complète à partir d'un état partiel.
function licence(over: Partial<LicenceInfo>): LicenceInfo {
  return {
    type: null,
    status: "none",
    trialEnd: null,
    trialDaysLeft: 0,
    cancelAt: null,
    isValid: false,
    loading: false,
    ...over,
  };
}

// Dates fixées à midi UTC : aucun basculement de jour en Europe/Paris.
const TRIAL_END = new Date("2026-07-20T12:00:00Z");
const CANCEL_AT = new Date("2026-08-15T12:00:00Z");

describe("formatDateFr — date longue fr-FR déterministe (Europe/Paris)", () => {
  it("formate une Date", () => {
    expect(formatDateFr(TRIAL_END)).toBe("20 juillet 2026");
    expect(formatDateFr(CANCEL_AT)).toBe("15 août 2026");
  });

  it("accepte une chaîne ISO (cache sérialisé)", () => {
    expect(formatDateFr("2026-08-15T12:00:00Z")).toBe("15 août 2026");
  });

  it("renvoie une chaîne vide pour null / date invalide", () => {
    expect(formatDateFr(null)).toBe("");
    expect(formatDateFr(undefined)).toBe("");
    expect(formatDateFr("pas une date")).toBe("");
  });
});

describe("mapLicenceToModal — fixture TRIAL (essai actif)", () => {
  const view = mapLicenceToModal(
    licence({ type: "trial", status: "active", trialEnd: TRIAL_END, trialDaysLeft: 9, isValid: true }),
  );

  it("statut = essai gratuit, action = Payment Links", () => {
    expect(view.statusKind).toBe("trial");
    expect(view.statusTitle).toBe("Essai gratuit");
    expect(view.action).toBe("payment-links");
  });

  it("détaille jours restants + date de fin", () => {
    expect(view.statusLines[0]).toBe("9 jours restants");
    expect(view.statusLines).toContain("Fin de l'essai le 20 juillet 2026");
  });

  it("accorde le singulier à 1 jour", () => {
    const v1 = mapLicenceToModal(
      licence({ type: "trial", status: "active", trialEnd: TRIAL_END, trialDaysLeft: 1, isValid: true }),
    );
    expect(v1.statusLines[0]).toBe("1 jour restant");
  });
});

describe("mapLicenceToModal — fixture PAID (abonnement actif)", () => {
  const view = mapLicenceToModal(licence({ type: "paid", status: "active", isValid: true }));

  it("statut = abonnement actif, action = portail", () => {
    expect(view.statusKind).toBe("paid");
    expect(view.statusTitle).toBe("Abonnement actif");
    expect(view.action).toBe("portal");
  });

  it("ne mentionne aucune échéance de résiliation", () => {
    expect(view.statusLines.join(" ")).not.toMatch(/résiliation/i);
  });
});

describe("mapLicenceToModal — fixture PAID + CANCEL_AT (résiliation programmée)", () => {
  const view = mapLicenceToModal(
    licence({ type: "paid", status: "cancelling", cancelAt: CANCEL_AT }),
  );

  it("statut = résiliation programmée, action = portail (réactivation possible)", () => {
    expect(view.statusKind).toBe("cancelling");
    expect(view.statusTitle).toBe("Abonnement actif");
    expect(view.action).toBe("portal");
  });

  it("affiche la date de résiliation fr-FR", () => {
    expect(view.statusLines).toContain("Résiliation programmée le 15 août 2026");
  });

  it("reste robuste si cancel_at absent", () => {
    const v = mapLicenceToModal(licence({ type: "paid", status: "cancelling", cancelAt: null }));
    expect(v.statusKind).toBe("cancelling");
    expect(v.action).toBe("portal");
    expect(v.statusLines[0]).toMatch(/résiliation programmée/i);
  });
});

describe("mapLicenceToModal — fixture LIFETIME (licence à vie)", () => {
  const view = mapLicenceToModal(licence({ type: "lifetime", status: "active", isValid: true }));

  it("statut = licence à vie, aucune action", () => {
    expect(view.statusKind).toBe("lifetime");
    expect(view.statusTitle).toBe("Licence à vie");
    expect(view.action).toBe("none");
    expect(view.statusLines.join(" ")).toMatch(/offre fondateur/i);
  });
});

describe("mapLicenceToModal — fixture EXPIRE (essai terminé / abonnement inactif)", () => {
  it("essai expiré → 'Période d'essai terminée' + Payment Links", () => {
    const v = mapLicenceToModal(licence({ type: "trial", status: "expired", trialEnd: TRIAL_END }));
    expect(v.statusKind).toBe("inactive");
    expect(v.statusTitle).toBe("Période d'essai terminée");
    expect(v.action).toBe("payment-links");
  });

  it("abonnement payant expiré → 'Abonnement inactif' + Payment Links", () => {
    const v = mapLicenceToModal(licence({ type: "paid", status: "expired" }));
    expect(v.statusKind).toBe("inactive");
    expect(v.statusTitle).toBe("Abonnement inactif");
    expect(v.action).toBe("payment-links");
  });

  it("abonnement payant résilié → 'Abonnement inactif' + Payment Links", () => {
    const v = mapLicenceToModal(licence({ type: "paid", status: "cancelled" }));
    expect(v.statusKind).toBe("inactive");
    expect(v.action).toBe("payment-links");
  });

  it("aucune licence (type null) → fail-closed vers Payment Links", () => {
    const v = mapLicenceToModal(licence({ type: null, status: "none" }));
    expect(v.statusKind).toBe("inactive");
    expect(v.action).toBe("payment-links");
  });
});

describe("buildStripeCheckoutUrl — Payment Links rattachés à l'utilisateur", () => {
  it("rattache client_reference_id", () => {
    expect(buildStripeCheckoutUrl(STRIPE_SOLO_URL, "user-42")).toBe(
      `${STRIPE_SOLO_URL}?client_reference_id=user-42`,
    );
  });

  it("ajoute le code promo pré-rempli en majuscules", () => {
    expect(buildStripeCheckoutUrl(STRIPE_ANNUEL_URL, "u1", " promo10 ")).toBe(
      `${STRIPE_ANNUEL_URL}?client_reference_id=u1&prefilled_promo_code=PROMO10`,
    );
  });

  it("ignore un code promo vide", () => {
    expect(buildStripeCheckoutUrl(STRIPE_SOLO_URL, "u1", "   ")).toBe(
      `${STRIPE_SOLO_URL}?client_reference_id=u1`,
    );
  });

  it("les deux Payment Links restent des URLs Stripe distinctes", () => {
    expect(STRIPE_SOLO_URL).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(STRIPE_ANNUEL_URL).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(STRIPE_SOLO_URL).not.toBe(STRIPE_ANNUEL_URL);
  });
});
