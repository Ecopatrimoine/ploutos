// supabase/functions/delete-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Répondre au preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Vérifier que l'appelant est admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace("Bearer ", "");

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: CORS });
    }

    const { data: adminRow } = await callerClient
      .from("admins")
      .select("email")
      .eq("email", caller.email)
      .single();

    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Accès refusé — non admin" }), { status: 403, headers: CORS });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id manquant" }), { status: 400, headers: CORS });
    }

    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Impossible de supprimer son propre compte" }), { status: 400, headers: CORS });
    }

    // Supprimer avec le service_role
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    await adminClient.from("licences").delete().eq("user_id", target_user_id);
    await adminClient.from("clients").delete().eq("user_id", target_user_id);
    await adminClient.from("cabinet_settings").delete().eq("user_id", target_user_id);

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500, headers: CORS });
    }

    console.log(`✅ Compte supprimé (RGPD) : ${target_user_id} par ${caller.email}`);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });

  } catch (err) {
    console.error("Erreur delete-user:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
