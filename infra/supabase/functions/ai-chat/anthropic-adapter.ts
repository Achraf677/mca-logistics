// Anthropic Claude API adapter for ai-chat edge function (DRAFT — not wired yet).
//
// Goal: provide a `callAnthropic(...)` function whose signature mirrors the
// existing `callGemini(...)` so the orchestration loop in index.ts can switch
// providers via a single env var (e.g. AI_PROVIDER=anthropic|gemini) without
// touching the 27 tool handlers.
//
// Status : SKELETON. All function bodies are TODO. Do NOT import this from
// index.ts yet — it will not compile-run as-is. See `claude/ai-chat-anthropic-fork`
// for the migration plan in the PR description.
//
// Reference docs :
// - Messages API : https://docs.anthropic.com/en/api/messages
// - Tool use     : https://docs.anthropic.com/en/docs/build-with-claude/tool-use
// - Prompt cache : https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
//
// Pricing snapshot (Jan 2026, USD per 1M tokens) :
//   Haiku 4.5  : $1   in  / $5   out  | cache write +25% | cache read -90%
//   Sonnet 4.6 : $3   in  / $15  out  | idem
//   Opus 4.7   : $15  in  / $75  out  | idem (reserve aux cas complexes)

// ---------- Types ----------

// Unified response shape so the index.ts loop does not need to know the provider.
// Mirrors GeminiResp loosely : one or more "parts" that are either text or
// tool-use, plus a finishReason flag. The loop consumes `text` parts and
// dispatches `toolCalls` to TOOL_HANDLERS.
export interface UnifiedResponse {
  parts: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  finishReason?: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "refusal" | string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  error?: { message: string; status?: number; retry_after_seconds?: number | null };
}

// History entry, provider-neutral. The loop in index.ts already maintains
// something close to this shape. Conversion to Anthropic's
// `messages: [{role, content: [...] }]` happens inside `toAnthropicMessages`.
export type UnifiedTurn =
  | { role: "user"; parts: Array<{ type: "text"; text: string }> }
  | {
      role: "assistant";
      parts: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
    }
  | {
      role: "tool";
      parts: Array<{ type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean }>;
    };

// Gemini-style declarations from index.ts TOOLS[0].functionDeclarations.
// We accept them as-is and translate inside `toAnthropicTools`.
export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, unknown>; required?: string[] };
}

// ---------- Translators (Gemini -> Anthropic) ----------

/**
 * Convert a Gemini function declaration list to Anthropic's tools format.
 * Anthropic tools : [{ name, description, input_schema: {type:"object", properties, required} }]
 * Mostly a rename of `parameters` -> `input_schema`.
 */
export function toAnthropicTools(declarations: GeminiToolDeclaration[]): unknown[] {
  // TODO : map each declaration. Anthropic requires `input_schema` (JSON schema).
  // Note : enums in `properties.X.enum` carry over unchanged.
  return [];
}

/**
 * Convert a unified history to Anthropic's `messages` array.
 * Rules :
 *  - role "user"      -> { role:"user",      content:[{type:"text", text}] }
 *  - role "assistant" -> { role:"assistant", content:[{type:"text"} | {type:"tool_use", id, name, input}] }
 *  - role "tool"      -> { role:"user",      content:[{type:"tool_result", tool_use_id, content}] }
 *    (Anthropic puts tool_result inside a user message — like Gemini puts functionResponse in role user.)
 */
export function toAnthropicMessages(history: UnifiedTurn[]): unknown[] {
  // TODO : implement. Anthropic refuses two consecutive same-role messages, so
  // when the loop emits multiple parallel tool_results, batch them in ONE user
  // message with multiple tool_result blocks (same as we do for Gemini).
  return [];
}

/**
 * Build the Anthropic `system` field with prompt caching enabled on the static
 * portion. The system prompt in index.ts (~3 KB) is the perfect cache target:
 * it changes only when memoryFacts change. We split it in two blocks :
 *  1. Static base (rules, context, API list) -> cache_control: {type:"ephemeral"}
 *  2. Memory facts (volatile) -> no cache_control
 * Anthropic caches per breakpoint; cache TTL 5 min default, 1 h with beta header.
 */
export function buildCachedSystem(staticBase: string, memorySection: string): unknown[] {
  // TODO : return [
  //   { type: "text", text: staticBase, cache_control: { type: "ephemeral" } },
  //   { type: "text", text: memorySection },
  // ]
  return [];
}

// ---------- Translators (Anthropic -> Unified) ----------

/**
 * Parse Anthropic Messages API response into UnifiedResponse.
 * Anthropic shape : { content: [{type:"text",text} | {type:"tool_use",id,name,input}], stop_reason, usage }
 * stop_reason mapping :
 *   "end_turn"       -> end_turn
 *   "tool_use"       -> tool_use   (loop continues, dispatch tools)
 *   "max_tokens"     -> max_tokens (return truncated msg, like Gemini MAX_TOKENS)
 *   "stop_sequence"  -> stop_sequence
 *   "refusal"        -> refusal    (display safety message, like Gemini SAFETY)
 */
export function fromAnthropicResponse(json: any): UnifiedResponse {
  // TODO : implement parsing + error path (json.error.{type,message}).
  return { parts: [], finishReason: undefined };
}

// ---------- HTTP call ----------

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Beta header for 1h prompt cache TTL (optional, default is 5 min):
// const ANTHROPIC_BETA = "extended-cache-ttl-2025-04-11";

const ANTHROPIC_TIMEOUT_MS = 45_000;
const ANTHROPIC_MAX_RETRIES = 2;
const ANTHROPIC_INTERNAL_RETRY_THRESHOLD_S = 8;

export interface CallAnthropicParams {
  model: string;                       // e.g. "claude-haiku-4-5", "claude-sonnet-4-6"
  apiKey: string;                      // Deno.env.get("ANTHROPIC_API_KEY")
  systemPrompt: string;                // raw system prompt (we split for caching)
  memorySection: string;               // volatile suffix (no cache)
  history: UnifiedTurn[];
  tools: GeminiToolDeclaration[];      // reuse existing TOOLS[0].functionDeclarations
  maxTokens?: number;                  // default 1500
  temperature?: number;                // default 0.3
}

/**
 * Drop-in replacement for callGemini. Handles :
 *  - Prompt caching (cache_control on staticBase + tools array if useful).
 *  - Retry on 5xx, 429 (parses retry-after header — Anthropic uses standard
 *    HTTP `retry-after` instead of Gemini's RetryInfo proto).
 *  - Timeout via AbortController, same 45s budget.
 *  - Non-JSON / network error fallthrough that mirrors callGemini.
 *
 * Returns UnifiedResponse so the orchestration loop in index.ts only needs a
 * thin shim (the loop itself stays Gemini-shaped today; once both providers
 * speak UnifiedResponse, switch via env AI_PROVIDER).
 */
export async function callAnthropic(params: CallAnthropicParams): Promise<UnifiedResponse> {
  // TODO :
  // 1. const messages = toAnthropicMessages(params.history)
  // 2. const tools    = toAnthropicTools(params.tools)
  //    Optionally add { cache_control: { type: "ephemeral" } } on the LAST tool
  //    to cache the whole tools array (saves ~1-2 KB tokens per call).
  // 3. const system   = buildCachedSystem(params.systemPrompt, params.memorySection)
  // 4. body = { model, max_tokens, temperature, system, tools, messages }
  // 5. fetch with headers :
  //      "x-api-key": apiKey,
  //      "anthropic-version": ANTHROPIC_VERSION,
  //      "content-type": "application/json",
  // 6. retry loop identical to callGemini (5xx + 429 transient).
  //    Parse `retry-after` HEADER (seconds) instead of body proto.
  // 7. return fromAnthropicResponse(json)
  return { parts: [], error: { message: "callAnthropic not implemented" } };
}

// ---------- Migration orchestration shim (future) ----------
//
// Once index.ts is refactored, the loop will look like :
//
//   const provider = Deno.env.get("AI_PROVIDER") ?? "gemini";
//   const resp = provider === "anthropic"
//     ? await callAnthropic({ model: pickClaudeModel(usePro), ... })
//     : await callGeminiUnified({ ... });
//   for (const part of resp.parts) { ... }
//
// `callGeminiUnified` is a 30-LOC wrapper around the existing callGemini that
// remaps Gemini's parts to UnifiedResponse. That refactor is the actual cutover
// PR; this file is the foundation it builds on.
