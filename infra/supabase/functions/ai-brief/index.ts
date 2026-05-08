// Edge function ai-brief — brief automatique panneau-agent.
// Scanne anomalies/opportunites via 5 tools deterministes, demande a Gemini
// de produire 0-5 decisions JSON, ecrit dans ai_brief_runs et retourne au client.
//
// Triggers acceptes :
//   - cron       : workflow GitHub Actions, auth via service_role bearer
//   - on_login   : 1x par session admin web (rate-limit cote frontend localStorage.ai_brief_last_run)
//   - manual     : bouton "Rafraichir le brief" dans le panneau-agent
//
// Auth :
//   - cron     -> Authorization: Bearer <SERVICE_ROLE_KEY> (verify_jwt: true accepte le service_role JWT)
//   - on_login -> Authorization: Bearer <user JWT> (admin uniquement)
//   - manual   -> idem on_login
//
// La fonction reste IDEMPOTENTE : elle ne mute pas les donnees business.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRO_DAILY_QUOTA = 50;
const GEMINI_TIMEOUT_MS = 45000;
const GEMINI_MAX_RETRIES = 1;
// Cap conservateur : si on ne tient pas en 7 KB, on tronque les listes.
const MAX_TOOL_RESULT_BYTES = 7000;
// Brief = 0-5 decisions max. Hardcap pour eviter une reponse trop verbeuse.
const MAX_DECISIONS = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ----- Tools deterministes (sous-ensemble de ai-chat focus brief) -----

type SbClient = ReturnType<typeof createClient>;

// 1) Livraisons impayees en retard (delai_paiement_jours depasse)
async function fetchLivraisonsImpayeesRetard(sb: SbClient) {
  const today = todayISO();
  const todayMs = Date.parse(today + "T00:00:00Z");

  const { data, error } = await sb.from("livraisons")
    .select("num_liv, client_id, client_nom, date_livraison, prix_ttc, statut_paiement")
    .in("statut_paiement", ["a_payer", "en_retard"])
    .order("date_livraison", { ascending: true })
    .limit(200);
  if (error) return { error: error.message };
  const rows = data ?? [];

  const ids = Array.from(new Set(rows.map((r: any) => r.client_id).filter(Boolean)));
  const delaiMap = new Map<string, number>();
  if (ids.length) {
    const { data: cls } = await sb.from("clients").select("id, delai_paiement_jours").in("id", ids);
    for (const c of cls ?? []) {
      delaiMap.set((c as any).id, Number((c as any).delai_paiement_jours) || 30);
    }
  }

  const enriched = rows.map((r: any) => {
    const delai = (r.client_id && delaiMap.get(r.client_id)) || 30;
    const dueMs = Date.parse(r.date_livraison + "T00:00:00Z") + delai * 86400000;
    const joursRetard = Math.floor((todayMs - dueMs) / 86400000);
    return {
      num_liv: r.num_liv,
      client_nom: r.client_nom,
      date_livraison: r.date_livraison,
      prix_ttc: Number(r.prix_ttc) || 0,
      jours_retard: joursRetard,
    };
  }).filter((r: any) => r.jours_retard >= 1);

  enriched.sort((a, b) => b.jours_retard - a.jours_retard);
  return { count: enriched.length, livraisons: enriched.slice(0, 10) };
}

// 2) Vehicules dont CT/assurance/carte_grise expire dans 30 jours (inclut deja expires)
async function fetchVehiculesEcheancesProches(sb: SbClient) {
  const dans = 30;
  const today = todayISO();
  const todayMs = Date.parse(today + "T00:00:00Z");
  const limitMs = todayMs + dans * 86400000;

  const { data, error } = await sb.from("vehicules")
    .select("immat, marque, modele, date_ct, date_assurance, date_carte_grise");
  if (error) return { error: error.message };

  const alertes: any[] = [];
  for (const v of data ?? []) {
    const checks: Array<[string, string | null | undefined]> = [
      ["CT", (v as any).date_ct],
      ["assurance", (v as any).date_assurance],
      ["carte_grise", (v as any).date_carte_grise],
    ];
    for (const [type, date] of checks) {
      if (!date) continue;
      const dMs = Date.parse(date + "T00:00:00Z");
      if (Number.isNaN(dMs)) continue;
      if (dMs <= limitMs) {
        const joursRestants = Math.floor((dMs - todayMs) / 86400000);
        alertes.push({
          immat: (v as any).immat,
          marque: (v as any).marque,
          modele: (v as any).modele,
          type_echeance: type,
          date_echeance: date,
          jours_restants: joursRestants,
        });
      }
    }
  }
  alertes.sort((a, b) => a.jours_restants - b.jours_restants);
  return { count: alertes.length, vehicules: alertes.slice(0, 10) };
}

// 3) Anomalies carburant 30 derniers jours (conso hors moyenne, doublons, prix incoherent)
async function fetchAnomaliesCarburant(sb: SbClient) {
  const today = todayISO();
  const dateMin = new Date(Date.parse(today + "T00:00:00Z") - 30 * 86400000).toISOString().slice(0, 10);

  const { data, error } = await sb.from("carburant")
    .select("id, date_plein, litres, prix_ttc, prix_ht, kilometrage, vehicule_id, " +
      "vehicule:vehicules(immat, conso, capacite_reservoir)")
    .gte("date_plein", dateMin)
    .lte("date_plein", today)
    .order("date_plein", { ascending: true });
  if (error) return { error: error.message };

  const rows = (data ?? []) as any[];
  const anomalies: any[] = [];

  // Group by vehicule pour detection conso et doublons rapproches
  const byVeh = new Map<string, any[]>();
  for (const r of rows) {
    const k = r.vehicule_id || "unknown";
    if (!byVeh.has(k)) byVeh.set(k, []);
    byVeh.get(k)!.push(r);
  }

  for (const [, pleins] of byVeh) {
    pleins.sort((a, b) => (a.date_plein > b.date_plein ? 1 : -1));
    for (let i = 0; i < pleins.length; i++) {
      const r = pleins[i];
      const litres = Number(r.litres) || 0;
      const prevKm = i > 0 ? Number(pleins[i - 1].kilometrage) || 0 : 0;
      const km = Number(r.kilometrage) || 0;
      const prixL = Number(r.prix_ttc) > 0 && litres > 0 ? Number(r.prix_ttc) / litres : 0;
      // Capacite reservoir
      const cap = Number(r.vehicule?.capacite_reservoir) || 0;
      if (cap && litres > cap * 1.05) {
        anomalies.push({ type: "depasse_capacite", immat: r.vehicule?.immat, date: r.date_plein, litres, capacite: cap });
      }
      // Conso hors moyenne (si on a 2 pleins consecutifs et conso connue)
      const conso = Number(r.vehicule?.conso) || 0;
      if (conso > 0 && i > 0 && km > prevKm && litres > 0) {
        const dist = km - prevKm;
        if (dist > 0) {
          const cons100 = (litres / dist) * 100;
          if (cons100 > conso * 1.4 || cons100 < conso * 0.5) {
            anomalies.push({
              type: "conso_anormale",
              immat: r.vehicule?.immat,
              date: r.date_plein,
              conso_calc: Number(cons100.toFixed(1)),
              conso_attendue: conso,
            });
          }
        }
      }
      // Doublons rapproches < 24h
      if (i > 0) {
        const prevMs = Date.parse(pleins[i - 1].date_plein + "T00:00:00Z");
        const curMs = Date.parse(r.date_plein + "T00:00:00Z");
        if (curMs - prevMs < 86400000) {
          anomalies.push({ type: "doublon_24h", immat: r.vehicule?.immat, date: r.date_plein });
        }
      }
      // Prix au litre incoherent (< 1.0 ou > 2.5 EUR/L)
      if (prixL > 0 && (prixL < 1.0 || prixL > 2.5)) {
        anomalies.push({ type: "prix_litre_incoherent", immat: r.vehicule?.immat, date: r.date_plein, prix_litre: Number(prixL.toFixed(3)) });
      }
    }
  }
  return { count: anomalies.length, anomalies: anomalies.slice(0, 10) };
}

// 4) Alertes admin non-resolues
async function fetchAlertesAdmin(sb: SbClient) {
  const { data, error } = await sb.from("alertes_admin")
    .select("id, niveau, type, message, cree_le, lue, resolved")
    .eq("resolved", false)
    .order("cree_le", { ascending: false })
    .limit(15);
  if (error) return { error: error.message };
  return { count: (data ?? []).length, alertes: data ?? [] };
}

// 5) Audit coherence rapide : livraisons livrees sans date_livraison, charges sans fournisseur,
//    charges en retard de paiement
async function fetchAuditExpress(sb: SbClient) {
  const today = todayISO();
  const dateLimite = new Date(Date.parse(today + "T00:00:00Z") - 60 * 86400000).toISOString().slice(0, 10);
  const probs: any[] = [];

  // Livraisons "livree" sans date_livraison ni prix_ht
  const { data: livBugs } = await sb.from("livraisons")
    .select("num_liv, client_nom, statut, date_livraison, prix_ht")
    .eq("statut", "livree")
    .or("date_livraison.is.null,prix_ht.is.null")
    .limit(10);
  for (const l of livBugs ?? []) {
    probs.push({ type: "livraison_incomplete", num_liv: (l as any).num_liv, client: (l as any).client_nom });
  }

  // Charges sans fournisseur_nom sur 60 derniers jours
  const { data: chgBugs } = await sb.from("charges")
    .select("id, categorie, date_charge, montant_ttc, fournisseur_nom")
    .gte("date_charge", dateLimite)
    .or("fournisseur_nom.is.null,fournisseur_nom.eq.")
    .limit(10);
  for (const c of chgBugs ?? []) {
    probs.push({ type: "charge_sans_fournisseur", categorie: (c as any).categorie, montant: (c as any).montant_ttc, date: (c as any).date_charge });
  }

  // Charges en retard de paiement (> 30j et statut a_payer / en_retard)
  const { data: chgRetard } = await sb.from("charges")
    .select("id, categorie, fournisseur_nom, date_charge, montant_ttc, statut_paiement")
    .in("statut_paiement", ["a_payer", "en_retard"])
    .lte("date_charge", new Date(Date.parse(today + "T00:00:00Z") - 30 * 86400000).toISOString().slice(0, 10))
    .order("date_charge", { ascending: true })
    .limit(10);
  for (const c of chgRetard ?? []) {
    probs.push({
      type: "charge_impayee_retard",
      fournisseur: (c as any).fournisseur_nom,
      montant: (c as any).montant_ttc,
      date: (c as any).date_charge,
    });
  }

  return { count: probs.length, problemes: probs };
}

// ----- Gemini call -----

interface GeminiResp {
  candidates?: Array<{
    content?: { role?: string; parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message: string; code?: number };
}

function trimForPrompt(payload: unknown): string {
  let str = JSON.stringify(payload);
  if (str.length > MAX_TOOL_RESULT_BYTES) {
    str = str.slice(0, MAX_TOOL_RESULT_BYTES) + "...[tronque]";
  }
  return str;
}

async function callGeminiBrief(model: string, apiKey: string, prompt: string): Promise<GeminiResp> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
    },
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.status >= 500 && attempt < GEMINI_MAX_RETRIES) {
        lastErr = { error: { message: `Gemini HTTP ${r.status}`, code: r.status } };
        await new Promise((res) => setTimeout(res, 600));
        continue;
      }
      const json = await r.json().catch(() => null);
      if (!json) {
        if (attempt < GEMINI_MAX_RETRIES) { await new Promise((res) => setTimeout(res, 600)); continue; }
        return { error: { message: `Gemini reponse non-JSON (HTTP ${r.status})` } } as GeminiResp;
      }
      return json as GeminiResp;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < GEMINI_MAX_RETRIES) { await new Promise((res) => setTimeout(res, 600)); continue; }
      const msg = (e as Error)?.name === "AbortError" ? "Timeout Gemini" : String(e).slice(0, 200);
      return { error: { message: msg } } as GeminiResp;
    }
  }
  return { error: { message: String(lastErr).slice(0, 200) } } as GeminiResp;
}

function buildBriefPrompt(snapshot: Record<string, unknown>): string {
  return [
    `Tu es l'assistant IA de MCA Logistics (PME transport FR). Date : ${todayISO()}.`,
    ``,
    `Mission : analyser silencieusement les donnees ci-dessous et produire un brief actionnable.`,
    `Tu dois retourner UNIQUEMENT un JSON array (sans texte autour, sans markdown, sans \`\`\`).`,
    `Format strict de chaque element :`,
    `  { "titre": string, "description": string, "priorite": "haute"|"opportunite"|"info", "actions": [{"id": string, "label": string, "style": "primary"|"secondary"}] }`,
    ``,
    `Regles :`,
    `- Maximum ${MAX_DECISIONS} decisions, triees par criticite (haute > opportunite > info).`,
    `- "haute" = action urgente requise (impaye > 30j, CT/assurance expire ou < 15j, anomalie carburant grave).`,
    `- "opportunite" = a saisir mais non bloquant (relance client tiede, optim tournee, doublon a fusionner).`,
    `- "info" = note de suivi, sans action immediate.`,
    `- Description : 1-2 phrases factuelles, jamais de blabla, montants en euros, dates explicites.`,
    `- Pour chaque decision, propose 1-3 actions courtes (label <= 30 chars). IDs : "voir", "relancer", "marquer_lu", "ouvrir_fournisseur", "ouvrir_vehicule", "ouvrir_livraison", etc.`,
    `- Si AUCUNE anomalie/opportunite n'est detectee, retourne []. NE remplis PAS avec du bruit.`,
    `- Pas de doublon : si plusieurs livraisons impayees du meme client, agrege en 1 decision.`,
    `- Reponds UNIQUEMENT le JSON. Pas d'introduction, pas de conclusion.`,
    ``,
    `## Snapshot des donnees`,
    ``,
    `### Livraisons impayees en retard (delai_paiement_jours depasse)`,
    trimForPrompt(snapshot.livraisons_impayees_retard),
    ``,
    `### Vehicules avec echeance CT/assurance/carte_grise sous 30j (negatif = deja expire)`,
    trimForPrompt(snapshot.vehicules_echeances_proches),
    ``,
    `### Anomalies carburant 30 derniers jours`,
    trimForPrompt(snapshot.anomalies_carburant),
    ``,
    `### Alertes admin non resolues`,
    trimForPrompt(snapshot.alertes_admin),
    ``,
    `### Incoherences DB (livraisons incompletes, charges sans fournisseur, charges impayees > 30j)`,
    trimForPrompt(snapshot.audit_express),
    ``,
    `Produis maintenant le JSON array (max ${MAX_DECISIONS}, [] si rien).`,
  ].join("\n");
}

function parseDecisions(text: string): any[] {
  if (!text || typeof text !== "string") return [];
  let s = text.trim();
  // Strip markdown fences si Gemini en met malgre responseMimeType
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    // Sanitize chaque item : titre/description/priorite obligatoires
    return parsed.slice(0, MAX_DECISIONS).map((d: any) => {
      const titre = String(d?.titre ?? "Decision").slice(0, 200);
      const description = String(d?.description ?? "").slice(0, 600);
      let priorite = String(d?.priorite ?? "info");
      if (!["haute", "opportunite", "info"].includes(priorite)) priorite = "info";
      const actionsRaw = Array.isArray(d?.actions) ? d.actions : [];
      const actions = actionsRaw.slice(0, 3).map((a: any) => ({
        id: String(a?.id ?? "voir").slice(0, 50),
        label: String(a?.label ?? "Voir").slice(0, 40),
        style: a?.style === "primary" ? "primary" : "secondary",
      }));
      return { titre, description, priorite, actions };
    }).filter((d: any) => d.titre && d.description);
  } catch (_) {
    return [];
  }
}

// ----- Quota helpers (partage avec ai-chat via meme table) -----

async function getQuota(sb: SbClient): Promise<{ requests_pro: number; requests_flash: number }> {
  const today = todayISO();
  const { data } = await sb.from("ai_quota_daily").select("requests_pro, requests_flash").eq("date", today).maybeSingle();
  return { requests_pro: (data as any)?.requests_pro ?? 0, requests_flash: (data as any)?.requests_flash ?? 0 };
}

async function bumpQuota(sb: SbClient, kind: "pro" | "flash"): Promise<void> {
  const today = todayISO();
  const col = kind === "pro" ? "requests_pro" : "requests_flash";
  const { data: existing } = await sb.from("ai_quota_daily").select(col).eq("date", today).maybeSingle();
  if (existing) {
    const next = ((existing as any)[col] || 0) + 1;
    await sb.from("ai_quota_daily").update({ [col]: next, updated_at: new Date().toISOString() }).eq("date", today);
  } else {
    await sb.from("ai_quota_daily").insert({ date: today, [col]: 1 });
  }
}

// ----- HTTP handler -----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

  if (!GEMINI_KEY) return jsonResp({ error: "GEMINI_API_KEY missing" }, 500);

  const body = await req.json().catch(() => ({}));
  const trigger = String((body as any)?.trigger || "manual");
  if (!["cron", "on_login", "manual"].includes(trigger)) {
    return jsonResp({ error: "trigger invalide (cron|on_login|manual)" }, 400);
  }

  // Auth :
  //   - Si trigger=cron : on attend Authorization: Bearer <SERVICE_ROLE_KEY>.
  //     Supabase verify_jwt accepte le service_role JWT comme valide.
  //     On verifie en plus que le bearer == SERVICE pour bloquer les usages
  //     non-cron qui auraient un autre admin JWT mais avec trigger=cron.
  //   - Sinon : verify_jwt: true a deja valide. On controle juste que c'est un admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (trigger === "cron") {
    if (!bearer || bearer !== SERVICE) {
      return jsonResp({ error: "cron: service_role bearer requis" }, 401);
    }
  } else {
    // on_login | manual : verifie role admin via JWT
    const sbUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) return jsonResp({ error: "Unauthorized" }, 401);
    const { data: profile } = await sbUser.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if ((profile as any)?.role !== "admin") return jsonResp({ error: "Admin uniquement" }, 403);
  }

  // Service-role pour les tools (RLS bypass) et l'insert ai_brief_runs.
  const sbAdmin = createClient(SUPABASE_URL, SERVICE);

  // Snapshot business : 5 fetches en parallele.
  let snapshot: Record<string, unknown>;
  try {
    const [livRetard, vehEch, anoCarb, alertes, audit] = await Promise.all([
      fetchLivraisonsImpayeesRetard(sbAdmin),
      fetchVehiculesEcheancesProches(sbAdmin),
      fetchAnomaliesCarburant(sbAdmin),
      fetchAlertesAdmin(sbAdmin),
      fetchAuditExpress(sbAdmin),
    ]);
    snapshot = {
      livraisons_impayees_retard: livRetard,
      vehicules_echeances_proches: vehEch,
      anomalies_carburant: anoCarb,
      alertes_admin: alertes,
      audit_express: audit,
    };
  } catch (e) {
    const errMsg = String(e).slice(0, 300);
    await sbAdmin.from("ai_brief_runs").insert({
      trigger,
      decisions_count: 0,
      decisions: [],
      duration_ms: Date.now() - startedAt,
      error: "snapshot_fetch: " + errMsg,
    });
    return jsonResp({ error: "snapshot fetch failed", detail: errMsg }, 500);
  }

  // Quota -> choix modele (Pro tant qu'on a du quota, sinon Flash).
  const quota = await getQuota(sbAdmin);
  let model = quota.requests_pro < PRO_DAILY_QUOTA ? "gemini-2.5-pro" : "gemini-2.5-flash";
  let proFellBackToFlash = false;

  const prompt = buildBriefPrompt(snapshot);
  let resp = await callGeminiBrief(model, GEMINI_KEY, prompt);

  // Fallback Pro -> Flash si 429 / 403.
  if (resp.error) {
    const code = (resp.error as { code?: number }).code ?? 0;
    if (model === "gemini-2.5-pro" && (code === 429 || code === 403)) {
      model = "gemini-2.5-flash";
      proFellBackToFlash = true;
      resp = await callGeminiBrief(model, GEMINI_KEY, prompt);
    }
  }

  if (resp.error) {
    const errMsg = String(resp.error.message || "gemini error").slice(0, 300);
    await sbAdmin.from("ai_brief_runs").insert({
      trigger,
      decisions_count: 0,
      decisions: [],
      duration_ms: Date.now() - startedAt,
      error: "gemini: " + errMsg,
    });
    return jsonResp({ error: "gemini", message: errMsg, model }, 502);
  }

  const cand = resp.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text || "").join("\n").trim();
  const decisions = parseDecisions(text);

  // Bump quota apres succes Gemini
  await bumpQuota(sbAdmin, model.includes("pro") ? "pro" : "flash");

  // Trace en DB
  const durationMs = Date.now() - startedAt;
  const { data: runRow, error: insErr } = await sbAdmin.from("ai_brief_runs")
    .insert({
      trigger,
      decisions_count: decisions.length,
      decisions,
      duration_ms: durationMs,
      error: null,
    })
    .select("id, ran_at")
    .maybeSingle();

  return jsonResp({
    ok: true,
    run_id: (runRow as any)?.id ?? null,
    ran_at: (runRow as any)?.ran_at ?? new Date().toISOString(),
    trigger,
    decisions,
    decisions_count: decisions.length,
    model_used: model,
    pro_fell_back_to_flash: proFellBackToFlash,
    duration_ms: durationMs,
    insert_error: insErr ? insErr.message : null,
  });
});
