import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const requesterClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const requester = await requesterClient.auth.getUser();
    const requesterId = requester.data.user?.id ?? null;
    if (!requesterId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", requesterId)
      .maybeSingle();

    if (!requesterProfile || requesterProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const salarieId = body?.salarieId ? String(body.salarieId) : "";
    const numero = body?.numero ? String(body.numero).trim().toUpperCase() : "";

    if (!salarieId && !numero) {
      return new Response(JSON.stringify({ error: "Missing salarieId or numero" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let salaryQuery = adminClient
      .from("salaries")
      .select("id, profile_id, numero, email")
      .limit(1);

    if (salarieId) salaryQuery = salaryQuery.eq("id", salarieId);
    else salaryQuery = salaryQuery.eq("numero", numero);

    const { data: salarie } = await salaryQuery.maybeSingle();

    // Idempotence : salarié déjà absent côté Supabase → on confirme la suppression sans erreur.
    if (!salarie) {
      return new Response(
        JSON.stringify({ deleted: true, alreadyAbsent: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const profileId = salarie.profile_id ?? null;

    if (profileId) {
      const deleteAuthResult = await adminClient.auth.admin.deleteUser(profileId, false);
      // Ignorer "user not found" (auth déjà supprimé), faire échouer le reste.
      if (deleteAuthResult.error) {
        const msg = String(deleteAuthResult.error.message || "").toLowerCase();
        if (!msg.includes("not found") && !msg.includes("user_not_found")) {
          throw deleteAuthResult.error;
        }
      }
    }

    const { error: deleteRowError } = await adminClient
      .from("salaries")
      .delete()
      .eq("id", salarie.id);

    if (deleteRowError) throw deleteRowError;

    return new Response(
      JSON.stringify({
        deleted: true,
        salarieId: salarie.id,
        profileId,
        numero: salarie.numero,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
