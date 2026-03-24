import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user: requester },
      error: requesterError,
    } = await adminClient.auth.getUser(jwt);

    if (requesterError || !requester) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, email")
      .eq("id", requester.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const salarieId = body?.salarieId ?? null;
    const numero = String(body?.numero ?? "").trim().toUpperCase();
    const password = String(body?.password ?? "").trim();

    if (!password || password.length < 4) {
      return new Response(JSON.stringify({ error: "Password too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let salaryQuery = adminClient
      .from("salaries")
      .select("id, profile_id, numero, nom, prenom, email, actif")
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

    const email = String(salarie.email ?? "").trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ error: "Salarie email missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = [salarie.prenom ?? "", salarie.nom ?? ""].join(" ").trim() || salarie.numero;
    const userMetadata = { role: "salarie", display_name: displayName };

    let authUserId = salarie.profile_id ?? null;

    if (authUserId) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
        password,
        email,
        user_metadata: userMetadata,
        email_confirm: true,
      });

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (createError || !createdUser?.user) {
        return new Response(JSON.stringify({ error: createError?.message ?? "User creation failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUserId = createdUser.user.id;
    }

    const { error: salaryUpdateError } = await adminClient
      .from("salaries")
      .update({
        profile_id: authUserId,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", salarie.id);

    if (salaryUpdateError) {
      return new Response(JSON.stringify({ error: salaryUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        salarieId: salarie.id,
        profileId: authUserId,
        email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
