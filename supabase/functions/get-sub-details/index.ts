// supabase/functions/get-sub-details/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { stripe_sub_ids } = await req.json();
    if (!Array.isArray(stripe_sub_ids) || stripe_sub_ids.length === 0) {
      return new Response(JSON.stringify({ error: "stripe_sub_ids requis" }), { status: 400, headers: CORS });
    }

    const results: Record<string, {
      interval: "month" | "year";
      current_period_end: string;
      cancel_at_period_end: boolean;
      cancel_at: string | null;
      status: string;
    }> = {};

    await Promise.all(
      stripe_sub_ids.map(async (subId: string) => {
        try {
          let realSubId = subId;

          // si_ = Subscription Item — récupérer le vrai sub_
          if (subId.startsWith("si_")) {
            const item = await stripe.subscriptionItems.retrieve(subId);
            realSubId = item.subscription as string;
          }

          const sub = await stripe.subscriptions.retrieve(realSubId, {
            expand: ["items.data.price"],
          });
          const item = sub.items.data[0];
          const interval = (item?.price as any)?.recurring?.interval ?? "month";
          results[subId] = {
            interval,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
            status: sub.status,
          };
        } catch (e) {
          console.error("Erreur sub", subId, e);
          results[subId] = { interval: "month", current_period_end: "", cancel_at_period_end: false, cancel_at: null, status: "unknown" };
        }
      })
    );

    return new Response(JSON.stringify(results), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
