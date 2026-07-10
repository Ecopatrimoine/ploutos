// supabase/functions/create-portal-session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

// Client service_role — sert à valider le JWT (getUser) et à lire la table
// licences. La session n'est jamais persistée côté fonction.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    // ── Authentification ──────────────────────────────────────────────────
    // L'utilisateur est dérivé du JWT de session, JAMAIS d'un user_id du body
    // (sinon IDOR : n'importe qui ouvrirait le portail d'un tiers). cf. L2.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: JSON_HEADERS });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: JSON_HEADERS });
    }

    // return_url est le seul paramètre accepté du body ; body vide toléré.
    const { return_url } = await req.json().catch(() => ({ return_url: undefined }));

    // stripe_sub de CET utilisateur uniquement.
    const { data: licence, error } = await supabase
      .from("licences")
      .select("stripe_sub")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !licence?.stripe_sub) {
      return new Response(JSON.stringify({ error: "Aucun abonnement Stripe trouvé" }), { status: 404, headers: JSON_HEADERS });
    }

    // customer_id depuis la subscription Stripe.
    const subscription = await stripe.subscriptions.retrieve(licence.stripe_sub);
    const customerId = subscription.customer as string;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url || "https://app.ploutos-cgp.fr",
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: JSON_HEADERS });

  } catch (err) {
    console.error("Erreur create-portal-session:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});
