// supabase/functions/create-portal-session/index.ts
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

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { user_id, return_url } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requis" }), { status: 400 });
    }

    // Récupérer le stripe_sub depuis la table licences
    const { data: licence, error } = await supabase
      .from("licences")
      .select("stripe_sub")
      .eq("user_id", user_id)
      .single();

    if (error || !licence?.stripe_sub) {
      return new Response(JSON.stringify({ error: "Aucun abonnement Stripe trouvé" }), { status: 404 });
    }

    // Récupérer le customer_id depuis la subscription Stripe
    const subscription = await stripe.subscriptions.retrieve(licence.stripe_sub);
    const customerId = subscription.customer as string;

    // Créer la session portail
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url || "https://app.ploutos-cgp.fr",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    console.error("Erreur create-portal-session:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
