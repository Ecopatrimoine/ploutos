// src/lib/stripe-checkout.ts
// ──────────────────────────────────────────────────────────────────────────────
// Ouvre le Payment Link Stripe en passant le user_id dans les métadonnées
// Stripe Payment Links supportent le paramètre ?client_reference_id=USER_ID
// → Stripe l'envoie dans checkout.session.completed comme client_reference_id
// ──────────────────────────────────────────────────────────────────────────────

export function openStripeCheckout(planType: "essentiel" | "premium", userId: string) {
  const links = {
    essentiel: "https://buy.stripe.com/test_28E7sMdgT5eg29A8sf9fW00",  // ← Remplace
    premium:   "https://buy.stripe.com/test_28E7sMdgT5eg29A8sf9fW00",    // ← Remplace
  };

  // client_reference_id est transmis dans le webhook checkout.session.completed
  // On l'utilise comme user_id pour lier le paiement au compte Supabase
  const url = `${links[planType]}?client_reference_id=${userId}`;
  window.open(url, "_blank");
}
