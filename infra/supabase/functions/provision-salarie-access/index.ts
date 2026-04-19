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
    const password = body?.password ? String(body.password) : "";
    const nom = body?.nom ? String(body.nom).trim() : "";
    const prenom = body?.prenom ? String(body.prenom).trim() : "";
    const incomingEmail = body?.email ? String(body.email).trim().toLowerCase() : "";

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Password too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let salaryQuery = adminClient
      .from("salaries")
      .select("id, profile_id, numero, email, nom, prenom")
      .limit(1);

    if (salarieId) salaryQuery = salaryQuery.eq("id", salarieId);
    else salaryQuery = salaryQuery.eq("numero", numero);

    const { data: salarie, error: salarieError } = await salaryQuery.maybeSingle();
    if (salarieError || !salarie) {
      return new Response(JSON.stringify({ error: "Salarie not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalNumero = String(salarie.numero ?? numero).trim().toUpperCase();
    const finalEmail = String(incomingEmail || salarie.email || `${finalNumero.toLowerCase()}@salarie.mca-logistics.fr`).trim().toLowerCase();
    const displayName = [prenom || salarie.prenom || "", nom || salarie.nom || ""].join(" ").trim() || finalNumero;
    const userMetadata = { role: "salarie", display_name: displayName };

    let authUserId = salarie.profile_id ?? null;

    if (authUserId) {
      const updateResult = await adminClient.auth.admin.updateUserById(authUserId, {
        email: finalEmail,
        password,
        user_metadata: userMetadata,
        email_confirm: true,
      });
      if (updateResult.error) throw updateResult.error;
    } else {
      const listResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listResult.error) throw listResult.error;
      const existingUser = (listResult.data?.users || []).find((user) => String(user.email || "").toLowerCase() === finalEmail);

      if (existingUser) {
        authUserId = existingUser.id;
        const updateResult = await adminClient.auth.admin.updateUserById(authUserId, {
          email: finalEmail,
          password,
          user_metadata: userMetadata,
          email_confirm: true,
        });
        if (updateResult.error) throw updateResult.error;
      } else {
        const createResult = await adminClient.auth.admin.createUser({
          email: finalEmail,
          password,
          email_confirm: true,
          user_metadata: userMetadata,
        });
        if (createResult.error || !createResult.data.user) throw createResult.error ?? new Error("create_user_failed");
        authUserId = createResult.data.user.id;
      }
    }

    const upsertResult = await adminClient
      .from("salaries")
      .update({
        email: finalEmail,
        profile_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", salarie.id)
      .select("id, profile_id, numero, email")
      .single();

    if (upsertResult.error) throw upsertResult.error;

    return new Response(
      JSON.stringify({
        salarieId: upsertResult.data.id,
        profileId: upsertResult.data.profile_id,
        numero: upsertResult.data.numero,
        email: upsertResult.data.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
