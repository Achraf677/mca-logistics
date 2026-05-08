// Edge function ai-chat — chatbot Gemini avec tool use (lecture + ecriture proposee).
// Hybride Pro/Flash + quota tracker (table public.ai_quota_daily, cf migration 033).
// Orchestrateur fin : delegue prompts/tools-defs/tools-impl aux modules cote.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { buildSystemPrompt, todayISO } from "./prompts.ts";
import { TOOLS } from "./tools-defs.ts";
import { TOOL_HANDLERS, type SbClient } from "./tools-impl.ts";

const PRO_DAILY_QUOTA = 50;
const MAX_TOOL_ITERATIONS = 4;
const MAX_TOOL_RESULT_BYTES = 7000;
const GEMINI_TIMEOUT_MS = 45000;
const GEMINI_MAX_RETRIES = 2;
const GEMINI_INTERNAL_RETRY_THRESHOLD_S = 8;
const TOOL_CACHE_TTL_MS = 30_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CACHEABLE_TOOLS = new Set<string>([
  "search_livraisons", "search_charges", "search_clients", "search_fournisseurs",
  "search_vehicules", "search_salaries", "search_carburant",
  "search_inspections", "search_entretiens", "search_incidents", "search_alertes",
  "get_stats", "top_clients_ca", "livraisons_impayees_retard",
  "vehicules_echeances_proches", "inspections_non_validees", "rentabilite_tournee",
  "get_planning_semaine", "get_anomalies_carburant",
  "qonto_organization", "qonto_search_transactions",
  "pennylane_factures_clients", "pennylane_factures_fournisseurs",
  "pennylane_search_clients", "pennylane_search_fournisseurs",
  "ors_distance", "ors_optimize_tournee",
  "sentry_recent_issues",
  "audit_coherence_donnees", "get_audit_log",
  "get_livraison_detail", "get_vehicule_historique",
  "list_memory_facts",
]);

function cacheKey(toolName: string, args: any): string {
  let argsStr = "{}";
  try {
    if (args && typeof args === "object") {
      const keys = Object.keys(args).sort();
      const obj: Record<string, unknown> = {};
      for (const k of keys) obj[k] = args[k];
      argsStr = JSON.stringify(obj);
    }
  } catch (_) { argsStr = "{}"; }
  return `${toolName}:${argsStr}`;
}

interface GeminiResp {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{ text?: string; functionCall?: { name: string; args: any } }>;
    };
    finishReason?: string;
  }>;
  error?: { message: string; code?: number; status?: string; details?: any[]; retry_after_seconds?: number | null };
}

function parseRetryDelay(json: any): number | null {
  try {
    const details = json?.error?.details ?? [];
    for (const d of details) {
      if (d?.["@type"]?.includes("RetryInfo") && d?.retryDelay) {
        const m = /([\d.]+)s$/.exec(d.retryDelay);
        if (m) return parseFloat(m[1]);
      }
    }
    const msg = json?.error?.message ?? "";
    const m2 = /retry in ([\d.]+)/i.exec(msg);
    if (m2) return parseFloat(m2[1]);
  } catch (_) {}
  return null;
}

function trimToolResult(result: unknown): unknown {
  try {
    const json = JSON.stringify(result);
    if (json.length <= MAX_TOOL_RESULT_BYTES) return result;
    if (!result || typeof result !== "object") return { truncated: true, preview: json.slice(0, MAX_TOOL_RESULT_BYTES) };
    const obj = result as Record<string, unknown>;
    const listKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
    if (!listKey) return { truncated: true, preview: json.slice(0, MAX_TOOL_RESULT_BYTES) };
    const list = obj[listKey] as unknown[];
    let lo = 0, hi = list.length, best = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const trial = { ...obj, [listKey]: list.slice(0, mid), _truncated: true, _original_count: list.length };
      if (JSON.stringify(trial).length <= MAX_TOOL_RESULT_BYTES) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return { ...obj, [listKey]: list.slice(0, best), _truncated: true, _original_count: list.length };
  } catch (_) {
    return { error: "tool result non serialisable" };
  }
}

async function callGemini(model: string, apiKey: string, systemInstruction: string, history: any[]): Promise<GeminiResp> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: history,
    tools: TOOLS,
    generationConfig: { temperature: 0.3, maxOutputTokens: 3500 },
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
      if (r.status >= 500 && r.status !== 501 && attempt < GEMINI_MAX_RETRIES) {
        lastErr = { error: { message: `Gemini HTTP ${r.status}`, code: r.status } };
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        continue;
      }
      const json = await r.json().catch(() => null);
      if (!json) {
        if (attempt < GEMINI_MAX_RETRIES) {
          lastErr = { error: { message: "Gemini reponse non-JSON", code: r.status } };
          await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
          continue;
        }
        return { error: { message: `Gemini reponse non-JSON (HTTP ${r.status})` } } as GeminiResp;
      }
      if (r.status === 429 && attempt < GEMINI_MAX_RETRIES) {
        const retrySec = parseRetryDelay(json);
        if (retrySec !== null && retrySec <= GEMINI_INTERNAL_RETRY_THRESHOLD_S) {
          await new Promise((res) => setTimeout(res, (retrySec + 0.5) * 1000));
          continue;
        }
        if (json.error) json.error.retry_after_seconds = retrySec ?? null;
      }
      return json as GeminiResp;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < GEMINI_MAX_RETRIES) {
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        continue;
      }
      const msg = (e as Error)?.name === "AbortError" ? "Timeout Gemini" : String(e).slice(0, 200);
      return { error: { message: msg } } as GeminiResp;
    }
  }
  return { error: { message: String(lastErr).slice(0, 200) } } as GeminiResp;
}

async function getQuota(sb: SbClient): Promise<{ requests_pro: number; requests_flash: number }> {
  const today = todayISO();
  const { data } = await sb.from("ai_quota_daily").select("requests_pro, requests_flash").eq("date", today).maybeSingle();
  return { requests_pro: data?.requests_pro ?? 0, requests_flash: data?.requests_flash ?? 0 };
}

async function bumpQuota(sb: SbClient, kind: "pro" | "flash"): Promise<void> {
  const today = todayISO();
  const col = kind === "pro" ? "requests_pro" : "requests_flash";
  const { data: existing } = await sb.from("ai_quota_daily").select(col).eq("date", today).maybeSingle();
  if (existing) {
    const next = (existing as any)[col] + 1;
    await sb.from("ai_quota_daily").update({ [col]: next, updated_at: new Date().toISOString() }).eq("date", today);
  } else {
    await sb.from("ai_quota_daily").insert({ date: today, [col]: 1 });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const sbUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const { data: profile } = await sbUser.from("profiles").select("role, display_name").eq("id", userData.user.id).maybeSingle();
    const userDisplayName: string | null = (profile?.display_name as string | undefined) ?? null;
    const role = (profile?.role === "admin" ? "admin" : "salarie") as "admin" | "salarie";

    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Acces reserve aux admins en V1" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const rawHistory: any[] = Array.isArray(body.history) ? body.history : [];

    const history: any[] = [];
    for (const m of rawHistory) {
      if (!m || (m.role !== "user" && m.role !== "model")) continue;
      const parts = Array.isArray(m.parts)
        ? m.parts.filter((p: any) => p && typeof p.text === "string" && p.text.length > 0)
        : [];
      if (parts.length === 0) continue;
      const last = history[history.length - 1];
      if (last && last.role === m.role) {
        const merged = last.parts.map((p: any) => p.text).concat(parts.map((p: any) => p.text)).join("\n");
        history[history.length - 1] = { role: m.role, parts: [{ text: merged }] };
      } else {
        history.push({ role: m.role, parts: parts.map((p: any) => ({ text: p.text })) });
      }
    }
    while (history.length && history[0].role !== "user") history.shift();

    if (history.length === 0) {
      return new Response(JSON.stringify({ error: "history vide" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const sbAdmin = createClient(SUPABASE_URL, SERVICE);

    const toolCache = new Map<string, { result: unknown; expiresAt: number }>();

    const quota = await getQuota(sbAdmin);
    let usePro = quota.requests_pro < PRO_DAILY_QUOTA;
    let model = usePro ? "gemini-2.5-pro" : "gemini-2.5-flash";

    const { data: memData } = await sbAdmin
      .from("ai_memory")
      .select("id, fact_text, category, importance")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);
    const memoryFacts = memData ?? [];

    const systemInstruction = buildSystemPrompt(role, memoryFacts, userDisplayName);
    let working = [...history];
    let finalText = "";
    let toolCallsMade: string[] = [];
    const memoryOps: any[] = [];
    const proposals: any[] = [];
    const writeActions: any[] = [];
    let lastResp: GeminiResp | null = null;
    let proFellBackToFlash = false;

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      lastResp = await callGemini(model, GEMINI_KEY, systemInstruction, working);

      if (lastResp.error) {
        const code = (lastResp.error as { code?: number }).code ?? 0;
        if (usePro && (code === 429 || code === 403)) {
          usePro = false;
          model = "gemini-2.5-flash";
          proFellBackToFlash = true;
          const today = todayISO();
          const { data: existQ } = await sbAdmin.from("ai_quota_daily").select("date").eq("date", today).maybeSingle();
          if (existQ) {
            await sbAdmin.from("ai_quota_daily").update({ requests_pro: PRO_DAILY_QUOTA, updated_at: new Date().toISOString() }).eq("date", today);
          } else {
            await sbAdmin.from("ai_quota_daily").insert({ date: today, requests_pro: PRO_DAILY_QUOTA, requests_flash: 0 });
          }
          continue;
        }
        const retryAfter = (lastResp.error as any)?.retry_after_seconds;
        let hint: string | null = null;
        if (code === 403) {
          hint = "La cle Gemini est bloquee au niveau du projet/org Google. Recreer une cle depuis un compte Gmail perso (pas org Workspace) sur https://aistudio.google.com.";
        } else if (code === 429) {
          if (retryAfter !== null && retryAfter !== undefined) {
            const mins = retryAfter > 60 ? Math.ceil(retryAfter / 60) : null;
            hint = mins
              ? `Limite Gemini atteinte. Reessaye dans environ ${mins} minute${mins > 1 ? "s" : ""}.`
              : `Limite Gemini atteinte. Reessaye dans ${Math.ceil(retryAfter)} secondes.`;
          } else {
            hint = "Quota Gemini quotidien atteint. Reessaye demain (reset 00h00 UTC).";
          }
        }
        return new Response(JSON.stringify({
          error: "gemini",
          code,
          message: lastResp.error.message,
          model,
          retry_after_seconds: retryAfter ?? null,
          hint,
        }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const cand = lastResp.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      const fnCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
      const texts = parts.filter((p) => p.text).map((p) => p.text!);
      const finishReason = cand?.finishReason;

      if (fnCalls.length === 0) {
        finalText = texts.join("\n");
        if (!finalText) {
          if (finishReason === "SAFETY" || finishReason === "RECITATION") {
            finalText = "Reponse bloquee par les filtres de securite Gemini. Reformule ta question.";
          } else if (finishReason === "MAX_TOKENS") {
            finalText = "Reponse tronquee (limite de tokens). Pose une question plus precise.";
          } else if (!cand) {
            finalText = "Gemini n'a renvoye aucune reponse. Reessaye dans quelques secondes ou efface la conversation.";
          } else {
            finalText = "Reponse vide de Gemini. Reformule ta question ou efface la conversation.";
          }
        }
        break;
      }

      const modelParts: any[] = [];
      for (const t of texts) modelParts.push({ text: t });
      for (const c of fnCalls) modelParts.push({ functionCall: c });
      working.push({ role: "model", parts: modelParts });

      const results = await Promise.all(
        fnCalls.map(async (call) => {
          toolCallsMade.push(call.name);
          const handler = TOOL_HANDLERS[call.name];
          if (!handler) return { error: `unknown tool: ${call.name}` };
          const cacheable = CACHEABLE_TOOLS.has(call.name);
          const key = cacheable ? cacheKey(call.name, call.args ?? {}) : "";
          if (cacheable) {
            const hit = toolCache.get(key);
            if (hit && hit.expiresAt > Date.now()) {
              return hit.result;
            }
          }
          try {
            const r = await handler(call.args ?? {}, sbAdmin);
            if (call.name === "add_memory_fact" && (r as any)?.success && (r as any)?.fact) {
              memoryOps.push({ type: "added", fact: (r as any).fact });
            } else if (call.name === "delete_memory_fact" && (r as any)?.success) {
              memoryOps.push({ type: "deleted", id: call.args?.id, deleted: (r as any)?.deleted });
            }
            if (call.name.startsWith("propose_") && r && typeof r === "object") {
              const obj = r as any;
              if (obj.proposal) proposals.push(obj.proposal);
              if (Array.isArray(obj.write_actions)) {
                for (const a of obj.write_actions) writeActions.push(a);
              }
            }
            if (cacheable) {
              toolCache.set(key, { result: r, expiresAt: Date.now() + TOOL_CACHE_TTL_MS });
            }
            return r;
          } catch (e) {
            return { error: String(e).slice(0, 200) };
          }
        })
      );

      working.push({
        role: "user",
        parts: fnCalls.map((c, i) => ({ functionResponse: { name: c.name, response: trimToolResult(results[i]) } })),
      });
    }

    if (!finalText) {
      finalText = `Je n'ai pas pu produire de reponse apres ${MAX_TOOL_ITERATIONS} iterations d'outils. ` +
        `Outils appeles : ${toolCallsMade.join(", ") || "aucun"}. Reformule plus precisement.`;
    }

    await bumpQuota(sbAdmin, usePro ? "pro" : "flash");

    const newQuota = await getQuota(sbAdmin);
    const proRemaining = Math.max(0, PRO_DAILY_QUOTA - newQuota.requests_pro);

    return new Response(
      JSON.stringify({
        text: finalText,
        model_used: model,
        pro_remaining: proRemaining,
        flash_used_today: newQuota.requests_flash,
        tools_called: toolCallsMade,
        pro_fell_back_to_flash: proFellBackToFlash,
        memory_ops: memoryOps,
        proposals,
        write_actions: writeActions,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
