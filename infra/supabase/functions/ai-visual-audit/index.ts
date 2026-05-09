// Edge function ai-visual-audit — analyse visuelle automatisee des screenshots
// de l'app via Gemini 2.5 Flash (FREE TIER UNIQUEMENT).
//
// Cible : detecter quotidiennement les regressions visuelles UX :
//   - overlaps / boutons coupes / texte deborde
//   - contrastes faibles / alignements casses
//   - paddings irreguliers / etats vides manquants
//   - incoherences cross-pages (typos, tailles, couleurs)
//
// Contraintes :
//   - HARDCODE gemini-2.5-flash, JAMAIS Pro (cf. CLAUDE.md objectif : 0 EUR).
//   - Free tier 250 RPD => le caller doit batcher (5 screenshots / appel
//     conseille pour rester sous le ceiling de tokens par requete).
//   - verify_jwt: true au deploy (admin only).
//   - Retry exponentiel 2/4/8s sur 429/503, max 3 tentatives. JAMAIS de
//     fallback Pro.
//
// Entree (POST application/json) :
//   {
//     "screenshots": [
//       { "url": string, "viewport": "pc" | "mobile", "base64": string, "mime": string }
//     ],
//     "prompt_context": string,           // contexte libre (ex: branche, env)
//     "triggered_by": "cron" | "manual" | "pr"
//   }
//
// Sortie :
//   {
//     "success": true,
//     "run_id": uuid,
//     "screenshots_analyzed": number,
//     "issues": [
//       { "url", "viewport", "severity", "location", "description", "fix_suggestion" }
//     ],
//     "by_severity": { "critical": n, "major": n, "minor": n },
//     "model_used": "gemini-2.5-flash"
//   }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  parseGeminiAudit,
  countBySeverity,
  type VisualIssue,
  type Severity,
} from "./parser.ts";

const MODEL = "gemini-2.5-flash"; // HARDCODED — pas de switch Pro
const GEMINI_TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB par screenshot
const MAX_SCREENSHOTS_PER_CALL = 8;       // ceiling raisonnable cote tokens
const MAX_OUTPUT_TOKENS = 2048;
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const SYSTEM_PROMPT = [
  "Tu es un auditeur UX/UI senior pour MCA Logistics, une PWA transport B2B francaise.",
  "Tu analyses des screenshots de l'application a la recherche de defauts visuels concrets,",
  "ACTIONNABLES par un developpeur front. Pas de subjectif esthetique flou.",
  "",
  "Categories a verifier strictement :",
  "1. CRITICAL : overlap d'elements, bouton coupe / inaccessible, texte tronque illisible,",
  "   modale qui depasse de l'ecran, contraste si faible que le texte est illisible,",
  "   formulaire avec champ cache derriere un autre.",
  "2. MAJOR : alignement casse (decalage > 8px visible), padding irregulier entre cartes,",
  "   contraste faible (gris clair sur blanc) mais lisible, couleurs de marque incoherentes,",
  "   etat vide non gere (\"undefined\" / \"null\" affiche), typo manifeste.",
  "3. MINOR : polish (espacement non optimal mais acceptable), opportunite d'amelioration UX,",
  "   bord/ombre non harmonise.",
  "",
  "Si aucune issue : renvoie un tableau vide. PAS d'invention pour remplir.",
  "",
  "Reponds UNIQUEMENT en JSON valide, sans markdown, sans prose, sans ```json.",
  "Schema strict :",
  "{",
  '  "issues": [',
  "    {",
  '      "severity": "critical" | "major" | "minor",',
  '      "location": string (zone visuelle ou selecteur, ex: "header top-right", "modal Charge", ".btn-add"),',
  '      "description": string (le defaut, factuel, < 200 chars),',
  '      "fix_suggestion": string (action concrete pour le dev, < 200 chars)',
  "    }",
  "  ]",
  "}",
].join("\n");

interface ScreenshotInput {
  url: string;
  viewport: "pc" | "mobile";
  base64: string;
  mime: string;
}

interface AnalyzedIssue extends VisualIssue {
  url: string;
  viewport: "pc" | "mobile";
}

// ----- Gemini call with retry -----

interface GeminiResp {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { code?: number; message?: string; status?: string };
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// Appelle Gemini Flash sur 1 ou plusieurs screenshots. On envoie tous les
// inlineData dans un seul `contents` pour maximiser le ratio analyse/req.
// Retourne le texte brut de la 1ere candidate (parser fait le reste).
async function callGeminiVision(
  apiKey: string,
  context: string,
  screenshots: ReadonlyArray<ScreenshotInput>,
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const userPart =
    `Contexte run : ${context || "audit visuel quotidien"}.\n` +
    `Tu vas voir ${screenshots.length} screenshot(s). Pour chaque, identifie ` +
    `dans "location" la page ET le viewport (ex: "[pc] /admin.html dashboard"). ` +
    `Aggrege toutes les issues dans un seul objet JSON { "issues": [...] }.`;

  const parts: Array<Record<string, unknown>> = [{ text: SYSTEM_PROMPT }, { text: userPart }];
  for (const s of screenshots) {
    parts.push({ text: `--- Screenshot: [${s.viewport}] ${s.url} ---` });
    parts.push({ inlineData: { mimeType: s.mime, data: s.base64 } });
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  };

  // Retry exponentiel 2/4/8s sur 429 (rate limit free tier) et 503 (overload).
  // JAMAIS de fallback Pro — on prefere echouer la passe et la retenter au
  // prochain run plutot que de declencher une depense.
  let lastErr: { status: number; message: string } = { status: 0, message: "no attempt" };
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      await sleep(delay);
    }
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
      const json = (await r.json().catch(() => null)) as GeminiResp | null;
      if (r.status === 429 || r.status === 503) {
        lastErr = { status: r.status, message: json?.error?.message ?? `Gemini HTTP ${r.status}` };
        continue; // retry
      }
      if (!r.ok || !json) {
        return {
          ok: false,
          status: r.status,
          message: json?.error?.message ?? `Gemini HTTP ${r.status}`,
        };
      }
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) {
        const finish = json.candidates?.[0]?.finishReason ?? "UNKNOWN";
        return { ok: false, status: 502, message: `Gemini reponse vide (finishReason=${finish})` };
      }
      return { ok: true, text };
    } catch (e) {
      clearTimeout(t);
      const isAbort = (e as Error)?.name === "AbortError";
      lastErr = {
        status: isAbort ? 504 : 502,
        message: isAbort ? "Timeout Gemini (60s)" : String(e).slice(0, 200),
      };
      // On retry timeouts aussi (reseau qui flap)
      continue;
    }
  }
  return { ok: false, status: lastErr.status || 502, message: lastErr.message };
}

// ----- HTTP handler -----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const startMs = Date.now();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!GEMINI_KEY) {
      return jsonResp({ success: false, error: "GEMINI_API_KEY manquant" }, 500);
    }

    // Auth admin (verify_jwt: true au deploy + check role admin defense-in-depth).
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) {
      return jsonResp({ success: false, error: "Unauthorized" }, 401);
    }
    const { data: profile } = await sbUser
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return jsonResp({ success: false, error: "Acces reserve aux admins" }, 403);
    }

    // Body parsing
    const body = await req.json().catch(() => ({}));
    const screenshots = Array.isArray(body.screenshots) ? body.screenshots : [];
    const promptContext = String(body.prompt_context ?? "").slice(0, 500);
    const triggeredBy = (() => {
      const v = String(body.triggered_by ?? "manual");
      return v === "cron" || v === "pr" || v === "manual" ? v : "manual";
    })();

    if (screenshots.length === 0) {
      return jsonResp({ success: false, error: "screenshots vide" }, 400);
    }
    if (screenshots.length > MAX_SCREENSHOTS_PER_CALL) {
      return jsonResp(
        {
          success: false,
          error: `Max ${MAX_SCREENSHOTS_PER_CALL} screenshots par appel (recu ${screenshots.length}). Batche cote client.`,
        },
        400,
      );
    }

    // Validation par screenshot
    const cleaned: ScreenshotInput[] = [];
    for (const s of screenshots) {
      if (!s || typeof s !== "object") continue;
      const url = String(s.url ?? "").slice(0, 500);
      const viewport = s.viewport === "mobile" ? "mobile" : "pc";
      let base64 = String(s.base64 ?? "");
      let mime = String(s.mime ?? "image/png").toLowerCase();
      // Strip data URL prefix si present
      const comma = base64.indexOf(",");
      if (base64.startsWith("data:") && comma > 0) {
        const meta = base64.slice(5, comma);
        const m = (meta.split(";")[0] || "").trim().toLowerCase();
        if (m) mime = m;
        base64 = base64.slice(comma + 1);
      }
      if (!ALLOWED_MIME.has(mime)) {
        return jsonResp({ success: false, error: `mime non supporte: ${mime}` }, 400);
      }
      const approxBytes = base64.length * 0.75;
      if (approxBytes > MAX_IMAGE_BYTES) {
        return jsonResp(
          {
            success: false,
            error: `Screenshot trop lourd (~${(approxBytes / 1024 / 1024).toFixed(1)} MB > ${MAX_IMAGE_BYTES / 1024 / 1024} MB)`,
          },
          413,
        );
      }
      if (!base64) continue;
      cleaned.push({ url, viewport, base64, mime });
    }
    if (cleaned.length === 0) {
      return jsonResp({ success: false, error: "Aucun screenshot exploitable" }, 400);
    }

    // Appel Gemini
    const r = await callGeminiVision(GEMINI_KEY, promptContext, cleaned);
    if (!r.ok) {
      const friendly =
        r.status === 429
          ? "Quota Gemini Flash atteint (250 RPD free tier). Reessaye demain ou attends 1 minute."
          : r.status === 504
            ? "Timeout Gemini (60s) — batch trop lourd, reduis le nombre de screenshots."
            : r.message;
      // Best-effort log meme en echec, pour stats
      await logRun({
        triggeredBy,
        screenshotsCount: cleaned.length,
        issuesCount: 0,
        bySeverity: { critical: 0, major: 0, minor: 0 },
        rawReport: `ERROR: ${friendly}`,
        durationMs: Date.now() - startMs,
      });
      return jsonResp(
        { success: false, error: friendly, model_used: MODEL },
        200,
      );
    }

    // Parse + tag chaque issue avec url/viewport. Heuristique : on attache la
    // 1ere url+viewport mentionnee dans `location`. Si plusieurs screenshots
    // dans le batch, on essaie de matcher le path. Sinon on tag avec le 1er.
    const issues = parseGeminiAudit(r.text);
    const annotated: AnalyzedIssue[] = issues.map((i) => {
      const loc = i.location.toLowerCase();
      let match = cleaned[0];
      for (const c of cleaned) {
        if (loc.includes(c.url.toLowerCase().slice(0, 40)) || loc.includes(c.viewport)) {
          match = c;
          break;
        }
      }
      return { ...i, url: match.url, viewport: match.viewport };
    });

    const bySev = countBySeverity(annotated);
    const runId = await logRun({
      triggeredBy,
      screenshotsCount: cleaned.length,
      issuesCount: annotated.length,
      bySeverity: bySev,
      rawReport: r.text.slice(0, 50_000),
      durationMs: Date.now() - startMs,
    });

    // Compteur quota partage avec ai-chat (table ai_quota_daily) — best-effort
    incrementQuota().catch(() => { /* ignore */ });

    return jsonResp({
      success: true,
      run_id: runId,
      screenshots_analyzed: cleaned.length,
      issues: annotated,
      by_severity: bySev,
      model_used: MODEL,
    });
  } catch (e) {
    return jsonResp({ success: false, error: String(e).slice(0, 300) }, 500);
  }
});

function jsonResp(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface LogRunInput {
  triggeredBy: "cron" | "manual" | "pr";
  screenshotsCount: number;
  issuesCount: number;
  bySeverity: Record<Severity, number>;
  rawReport: string;
  durationMs: number;
  githubIssueUrl?: string;
}

async function logRun(input: LogRunInput): Promise<string | null> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SERVICE) return null;
    const sb = createClient(SUPABASE_URL, SERVICE);
    const { data, error } = await sb
      .from("ai_visual_audit_runs")
      .insert({
        triggered_by: input.triggeredBy,
        screenshots_count: input.screenshotsCount,
        issues_count: input.issuesCount,
        issues_by_severity: input.bySeverity,
        raw_report: input.rawReport,
        github_issue_url: input.githubIssueUrl ?? null,
        duration_ms: input.durationMs,
      })
      .select("id")
      .single();
    if (error) return null;
    return data?.id ?? null;
  } catch (_) {
    return null;
  }
}

async function incrementQuota(): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SERVICE) return;
  const sb = createClient(SUPABASE_URL, SERVICE);
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await sb
    .from("ai_quota_daily")
    .select("requests_flash")
    .eq("date", today)
    .maybeSingle();
  if (existing) {
    await sb
      .from("ai_quota_daily")
      .update({
        requests_flash: (existing.requests_flash ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("date", today);
  } else {
    await sb.from("ai_quota_daily").insert({ date: today, requests_flash: 1 });
  }
}
