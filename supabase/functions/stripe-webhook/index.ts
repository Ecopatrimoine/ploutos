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

// Envoie un email via la Edge Function send-email
async function sendEmail(to: string, type: string, cabinet_name?: string) {
  if (!to) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
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

  try {
    switch (event.type) {

      // Paiement réussi (checkout Payment Link)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const subId  = session.subscription as string;

        if (!userId) { console.error("Pas de user_id dans metadata"); break; }

        await supabase.from("licences").upsert({
          user_id:    userId,
          type:       "paid",
          status:     "active",
          stripe_sub: subId ?? null,
          trial_end:  null,
          updated_at: new Date().toISOString(),
        });

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
          await supabase.from("licences")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("user_id", data.user_id);
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
          await supabase.from("licences")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("user_id", data.user_id);
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
            await supabase.from("licences")
              .update({ status: "cancelling", cancel_at: cancelAt, updated_at: new Date().toISOString() })
              .eq("user_id", data.user_id);
            console.log(`⚠️ Annulation planifiée jusqu'au ${cancelAt}`);
          } else {
            await supabase.from("licences")
              .update({ status: "active", cancel_at: null, updated_at: new Date().toISOString() })
              .eq("user_id", data.user_id);
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
          await supabase.from("licences")
            .update({ status: "cancelled", cancel_at: null, updated_at: new Date().toISOString() })
            .eq("user_id", data.user_id);
          console.log(`❌ Abonnement terminé pour sub ${sub.id}`);
        }
        break;
      }

      default:
        console.log(`Event ignoré: ${event.type}`);
    }
  } catch (err) {
    console.error("Erreur traitement:", err);
    return new Response(JSON.stringify({ error: "Processing error" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
