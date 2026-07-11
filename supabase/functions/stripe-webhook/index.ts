// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const INTERNAL_EMAIL_KEY = Deno.env.get("INTERNAL_EMAIL_KEY") ?? "";

// Envoie un email via la Edge Function send-email (mode serveur-à-serveur : le
// header X-Internal-Key authentifie l'appel côté send-email — cf. L3). Le Bearer
// anon reste pour franchir la passerelle si verify_jwt=true.
async function sendEmail(to: string, type: string, cabinet_name?: string) {
  if (!to) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "X-Internal-Key": INTERNAL_EMAIL_KEY,
      },
      body: JSON.stringify({ to, type, cabinet_name }),
    });
    console.log(`📧 Email ${type} envoyé à ${to}`);
  } catch (e) {
    console.warn("sendEmail échoué (non bloquant):", e);
  }
}

// Récupère l'email d'un utilisateur depuis auth.users
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch { return null; }
}

// Extrait le subscription id porté par l'event, selon son type (null sinon).
function extractStripeSub(event: Stripe.Event): string | null {
  const obj = event.data.object as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return (obj.subscription as string) ?? null;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return (obj.id as string) ?? null;
    default:
      return null;
  }
}

// Payload compact pour le débug (point 2d) : jamais le raw body complet, seulement
// les champs que le webhook lit réellement.
function compactPayload(event: Stripe.Event): Record<string, unknown> {
  const obj = event.data.object as Record<string, unknown>;
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    object: {
      id: obj.id,
      customer: obj.customer,
      subscription: obj.subscription,
      client_reference_id: obj.client_reference_id,
      status: obj.status,
      cancel_at_period_end: obj.cancel_at_period_end,
      cancel_at: obj.cancel_at,
      current_period_end: obj.current_period_end,
    },
  };
}

// Events sensibles à l'ordre : une réactivation (updated) ne doit jamais écraser
// une résiliation plus récente, ni l'inverse. La garde d'ordre ne s'applique qu'à
// ceux-là (point 2b).
const ORDER_SENSITIVE = new Set([
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEventAsync
      ? await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret)
      : stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Signature invalide:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  console.log("Event reçu:", event.type);

  // event.created est un epoch (secondes) ; la colonne est timestamptz.
  const eventCreatedIso = new Date(event.created * 1000).toISOString();
  const stripeSub = extractStripeSub(event);

  // Rejoue « comme traité » sans rien appliquer : la ligne stripe_events reste,
  // l'état licences n'est pas retouché.
  const alreadyProcessed = (extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ received: true, ...extra }), { status: 200 });

  // Échec APRÈS insert : on retire la ligne stripe_events pour qu'un retry Stripe
  // puisse ré-appliquer. Aucun trou entre « noté traité » et « réellement appliqué ».
  const undoAndFail = async (msg: string, err: unknown): Promise<Response> => {
    console.error(msg, err);
    await supabase.from("stripe_events").delete().eq("event_id", event.id);
    return new Response(JSON.stringify({ error: "Processing error" }), { status: 500 });
  };

  try {
    // ── Garde d'ordre (point 2b) — AVANT tout insert ────────────────────────
    // Comparaison faite avant l'insert : l'event courant n'est jamais dans son
    // propre max, et un event stale n'étant jamais inséré (return ci-dessous), il
    // ne peut pas empoisonner le max des events futurs. Avec delete-on-failure,
    // « ligne présente » = « event appliqué » : max(event_created) = max des
    // events déjà appliqués pour ce sub.
    if (stripeSub && ORDER_SENSITIVE.has(event.type)) {
      const { data: last } = await supabase
        .from("stripe_events")
        .select("event_created")
        .eq("stripe_sub", stripeSub)
        .order("event_created", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last?.event_created && new Date(eventCreatedIso) < new Date(last.event_created as string)) {
        console.log(`⏭️ Event stale ignoré (${event.type} ${event.id}) : ${eventCreatedIso} < ${last.event_created}`);
        return alreadyProcessed({ stale: true });
      }
    }

    // ── Idempotence (point 2a) — insert on conflict do nothing ──────────────
    const { data: inserted, error: insErr } = await supabase
      .from("stripe_events")
      .upsert(
        {
          event_id:      event.id,
          event_type:    event.type,
          event_created: eventCreatedIso,
          stripe_sub:    stripeSub,
          payload:       compactPayload(event),
        },
        { onConflict: "event_id", ignoreDuplicates: true },
      )
      .select("event_id");

    if (insErr) {
      // Erreur réelle (le conflit, lui, est absorbé par DO NOTHING → pas d'erreur).
      console.error("Insert stripe_events échoué:", insErr);
      return new Response(JSON.stringify({ error: "Idempotency store error" }), { status: 500 });
    }
    if (!inserted || inserted.length === 0) {
      // 0 ligne insérée → event déjà traité (rejeu Stripe légitime) → 200, rien appliqué.
      console.log(`♻️ Event déjà traité, ignoré : ${event.id}`);
      return alreadyProcessed({ duplicate: true });
    }

    // ── Application métier (mappings type/status INCHANGÉS) ──────────────────
    switch (event.type) {

      // Paiement réussi (checkout Payment Link)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const subId  = session.subscription as string;

        if (!userId) { console.error("Pas de user_id dans metadata"); break; }

        const { error: wErr } = await supabase.from("licences").upsert({
          user_id:    userId,
          type:       "paid",
          status:     "active",
          stripe_sub: subId ?? null,
          trial_end:  null,
          updated_at: new Date().toISOString(),
        });
        if (wErr) return await undoAndFail("upsert licences (checkout) échoué", wErr);

        // Email de confirmation d'activation
        const email = await getUserEmail(userId);
        await sendEmail(email!, "licence_activated");
        console.log(`✅ Licence activée pour ${userId}`);
        break;
      }

      // Abonnement renouvelé (invoice payée)
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;

        const { data } = await supabase
          .from("licences").select("user_id").eq("stripe_sub", subId).single();

        if (data) {
          const { error: wErr } = await supabase.from("licences")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("user_id", data.user_id);
          if (wErr) return await undoAndFail("update licences (renouvellement) échoué", wErr);
          console.log(`✅ Renouvellement OK pour sub ${subId}`);
        }
        break;
      }

      // Paiement échoué
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;

        const { data } = await supabase
          .from("licences").select("user_id").eq("stripe_sub", subId).single();

        if (data) {
          const { error: wErr } = await supabase.from("licences")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("user_id", data.user_id);
          if (wErr) return await undoAndFail("update licences (paiement échoué) échoué", wErr);
          console.log(`⚠️ Paiement échoué pour sub ${subId}`);
        }
        break;
      }

      // Abonnement mis à jour (annulation planifiée ou réactivation)
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const { data } = await supabase
          .from("licences").select("user_id").eq("stripe_sub", sub.id).single();

        if (data) {
          if (sub.cancel_at_period_end) {
            const cancelAt = sub.cancel_at
              ? new Date(sub.cancel_at * 1000).toISOString()
              : new Date(sub.current_period_end * 1000).toISOString();
            const { error: wErr } = await supabase.from("licences")
              .update({ status: "cancelling", cancel_at: cancelAt, updated_at: new Date().toISOString() })
              .eq("user_id", data.user_id);
            if (wErr) return await undoAndFail("update licences (annulation planifiée) échoué", wErr);
            console.log(`⚠️ Annulation planifiée jusqu'au ${cancelAt}`);
          } else {
            const { error: wErr } = await supabase.from("licences")
              .update({ status: "active", cancel_at: null, updated_at: new Date().toISOString() })
              .eq("user_id", data.user_id);
            if (wErr) return await undoAndFail("update licences (réactivation) échoué", wErr);
            console.log(`✅ Abonnement réactivé pour sub ${sub.id}`);
          }
        }
        break;
      }

      // Abonnement définitivement terminé
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const { data } = await supabase
          .from("licences").select("user_id").eq("stripe_sub", sub.id).single();

        if (data) {
          const { error: wErr } = await supabase.from("licences")
            .update({ status: "cancelled", cancel_at: null, updated_at: new Date().toISOString() })
            .eq("user_id", data.user_id);
          if (wErr) return await undoAndFail("update licences (résiliation) échoué", wErr);
          console.log(`❌ Abonnement terminé pour sub ${sub.id}`);
        }
        break;
      }

      default:
        console.log(`Event ignoré: ${event.type}`);
    }
  } catch (err) {
    // Exception pendant l'application : on défait l'insert pour laisser Stripe rejouer.
    return await undoAndFail("Erreur traitement:", err);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
