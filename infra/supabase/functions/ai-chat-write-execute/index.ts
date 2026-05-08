// Edge function ai-chat-write-execute — execution reelle des actions proposees
// par l'IA (chatbot V2 ECRITURE) apres confirmation explicite cote UI.
//
// SECURITE :
// - verify_jwt: true => Supabase valide le JWT du caller.
// - Verification supplementaire role=admin via profiles : seul l'admin peut ecrire.
// - Toute ecriture est tracee dans audit_log_entries avec actor_id + diff complet
//   marque par "source: 'ai-chat-v2'" dans le diff jsonb.
// - L'IA n'appelle PAS cette fonction : seul le bouton "Confirmer" cote front la
//   declenche apres validation visuelle de la carte de confirmation.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SbClient = ReturnType<typeof createClient>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Genere un num_liv au format L-YYYYMMDD-XXX. XXX = compteur sequence du jour.
async function generateNumLiv(sb: SbClient, dateLiv: string): Promise<string> {
  const ymd = String(dateLiv || todayISO()).replace(/-/g, "");
  const prefix = `L-${ymd}-`;
  // Cherche le plus grand suffixe deja utilise pour ce jour
  const { data } = await sb.from("livraisons")
    .select("num_liv")
    .ilike("num_liv", `${prefix}%`)
    .order("num_liv", { ascending: false })
    .limit(1);
  let next = 1;
  const existing = data && data[0] ? (data[0] as any).num_liv as string : null;
  if (existing) {
    const m = /-(\d+)$/.exec(existing);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}

async function logAudit(sb: SbClient, params: {
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  row_id: string | null;
  actor_id: string;
  diff: Record<string, unknown>;
}) {
  const diffWithSource = { ...params.diff, source: "ai-chat-v2" };
  await sb.from("audit_log_entries").insert({
    table_name: params.table_name,
    operation: params.operation,
    row_id: params.row_id,
    actor_id: params.actor_id,
    actor_role: "admin",
    diff: diffWithSource,
  });
}

async function execCreateLivraison(sb: SbClient, payload: any, actorId: string) {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "payload manquant" };
  }
  // Sanitize : ne garde que les colonnes connues, jamais d'id user-supplied.
  const allowed = [
    "num_liv", "client_id", "client_nom", "date_livraison", "distance_km",
    "prix_ht", "taux_tva", "prix_ttc", "tva_montant", "salarie_id", "vehicule_id",
    "statut", "statut_paiement", "zone", "depart", "arrivee", "notes",
  ] as const;
  const insert: Record<string, unknown> = {};
  for (const k of allowed) {
    if (payload[k] !== undefined && payload[k] !== null) insert[k] = payload[k];
  }
  // Generation num_liv si absent
  if (!insert.num_liv) {
    insert.num_liv = await generateNumLiv(sb, String(insert.date_livraison || todayISO()));
  }
  // Defauts business
  if (!insert.statut) insert.statut = "en_attente";
  if (!insert.statut_paiement) insert.statut_paiement = "a_payer";

  const { data, error } = await sb.from("livraisons").insert(insert).select("id, num_liv").single();
  if (error) return { success: false, error: error.message };
  await logAudit(sb, {
    table_name: "livraisons",
    operation: "INSERT",
    row_id: (data as any).id,
    actor_id: actorId,
    diff: insert,
  });
  return { success: true, created_id: (data as any).id, num_liv: (data as any).num_liv };
}

async function execCreateCharge(sb: SbClient, payload: any, actorId: string) {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "payload manquant" };
  }
  const allowed = [
    "categorie", "description", "date_charge", "montant_ht", "taux_tva",
    "montant_ttc", "vehicule_id", "fournisseur_id", "fournisseur_nom",
    "taux_deductibilite", "statut_paiement", "date_paiement", "mode_paiement",
  ] as const;
  const insert: Record<string, unknown> = {};
  for (const k of allowed) {
    if (payload[k] !== undefined && payload[k] !== null) insert[k] = payload[k];
  }
  if (!insert.statut_paiement) insert.statut_paiement = "a_payer";

  const { data, error } = await sb.from("charges").insert(insert).select("id").single();
  if (error) return { success: false, error: error.message };
  await logAudit(sb, {
    table_name: "charges",
    operation: "INSERT",
    row_id: (data as any).id,
    actor_id: actorId,
    diff: insert,
  });
  return { success: true, created_id: (data as any).id };
}

async function execCreatePaiement(sb: SbClient, payload: any, actorId: string) {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "payload manquant" };
  }
  const allowed = [
    "livraison_id", "client_id", "date_paiement", "montant", "mode",
    "reference", "notes", "frais",
  ] as const;
  const insert: Record<string, unknown> = {};
  for (const k of allowed) {
    if (payload[k] !== undefined && payload[k] !== null) insert[k] = payload[k];
  }
  if (!insert.date_paiement) insert.date_paiement = todayISO();
  if (!insert.livraison_id) return { success: false, error: "livraison_id manquant" };
  if (!Number.isFinite(Number(insert.montant)) || Number(insert.montant) <= 0) {
    return { success: false, error: "montant invalide" };
  }

  const { data, error } = await sb.from("paiements").insert(insert).select("id").single();
  if (error) return { success: false, error: error.message };

  // Mise a jour du statut_paiement de la livraison : marque "paye" si totalite, sinon "partiel".
  const { data: liv } = await sb.from("livraisons")
    .select("id, prix_ttc")
    .eq("id", insert.livraison_id)
    .maybeSingle();
  if (liv) {
    const { data: paiements } = await sb.from("paiements")
      .select("montant")
      .eq("livraison_id", insert.livraison_id);
    const totalPaye = (paiements ?? []).reduce((acc, p: any) => acc + (Number(p.montant) || 0), 0);
    const prixTtc = Number((liv as any).prix_ttc) || 0;
    let newStatut: string | null = null;
    if (prixTtc > 0 && totalPaye + 0.01 >= prixTtc) {
      newStatut = "paye";
    } else if (totalPaye > 0) {
      newStatut = "partiel";
    }
    if (newStatut) {
      await sb.from("livraisons").update({
        statut_paiement: newStatut,
        date_paiement: insert.date_paiement,
      }).eq("id", insert.livraison_id);
      await logAudit(sb, {
        table_name: "livraisons",
        operation: "UPDATE",
        row_id: String(insert.livraison_id),
        actor_id: actorId,
        diff: { statut_paiement: newStatut, date_paiement: insert.date_paiement, _via: "create_paiement" },
      });
    }
  }

  await logAudit(sb, {
    table_name: "paiements",
    operation: "INSERT",
    row_id: (data as any).id,
    actor_id: actorId,
    diff: insert,
  });
  return { success: true, created_id: (data as any).id };
}

async function execResolveAlerte(sb: SbClient, payload: any, actorId: string) {
  const id = String(payload?.alerte_id || payload?.id || "").trim();
  if (!id) return { success: false, error: "alerte_id manquant" };
  const nowIso = new Date().toISOString();
  const update = { resolved: true, resolved_at: nowIso, lue: true };
  const { data, error } = await sb.from("alertes_admin")
    .update(update)
    .eq("id", id)
    .select("id, type, titre")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Alerte introuvable" };
  await logAudit(sb, {
    table_name: "alertes_admin",
    operation: "UPDATE",
    row_id: id,
    actor_id: actorId,
    diff: update,
  });
  return { success: true, alerte_id: id, alerte: data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth user via JWT
    const sbUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const { data: profile } = await sbUser.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    const role = profile?.role === "admin" ? "admin" : "salarie";
    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Acces reserve aux admins" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const payload = body?.payload ?? body;
    if (!action) {
      return new Response(JSON.stringify({ success: false, error: "action manquante" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const sbAdmin = createClient(SUPABASE_URL, SERVICE);
    const actorId = userData.user.id;

    let result: { success: boolean; error?: string; created_id?: string; num_liv?: string; alerte_id?: string };
    switch (action) {
      case "create_livraison":
        result = await execCreateLivraison(sbAdmin, payload, actorId);
        break;
      case "create_charge":
        result = await execCreateCharge(sbAdmin, payload, actorId);
        break;
      case "create_paiement":
        result = await execCreatePaiement(sbAdmin, payload, actorId);
        break;
      case "resolve_alerte":
        // payload peut etre { alerte_id } directement OU { ...body avec alerte_id en racine }
        result = await execResolveAlerte(sbAdmin, payload?.alerte_id ? payload : (body?.alerte_id ? body : payload), actorId);
        break;
      default:
        result = { success: false, error: `action inconnue: ${action}` };
    }

    const status = result.success ? 200 : 400;
    return new Response(JSON.stringify(result), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e).slice(0, 300) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
