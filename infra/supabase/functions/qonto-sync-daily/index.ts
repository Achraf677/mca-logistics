// Edge function `qonto-sync-daily`
// ----------------------------------------------------------------------------
// Synchro quotidienne Qonto -> MCA :
//   - fetch des transactions Qonto (settled_at) sur une periode (defaut : J-1)
//   - pour chaque CREDIT (entree d'argent) : tente un match dans `livraisons`
//     sur prix_ttc ±0.50 €, date_livraison ±15 j, client_nom similar
//   - pour chaque DEBIT (sortie d'argent) : tente un match dans `charges`
//     sur montant_ttc ±0.50 €, date_charge ±15 j, fournisseur_nom similar
//
// Idempotent : on stocke le `transaction_id` Qonto dans `paiements.extra`
// (resp. `charges.extra`) et un index unique partiel (migration 037)
// empeche les doublons sur re-run.
//
// Mode dry_run : retourne le plan d'action SANS rien ecrire.
//
// Securite : header `x-cron-secret` doit matcher Deno.env CRON_SECRET.
//
// Body (POST JSON) :
//   {
//     "date_from": "YYYY-MM-DD",   // optionnel, defaut = hier UTC
//     "date_to":   "YYYY-MM-DD",   // optionnel, defaut = hier UTC
//     "dry_run":   false           // optionnel, defaut false
//   }
//
// Reponse :
//   { ok: true, dry_run, period, stats, matches, ambiguous, no_match, errors }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =====================================================================
// Constantes & helpers
// =====================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QONTO_BASE = "https://thirdparty.qonto.com/v2";
const QONTO_PAGE_SIZE = 100;
const QONTO_MAX_PAGES = 10; // safety cap : 1000 transactions / run max
// Tolerances de matching
const AMOUNT_TOLERANCE_EUR = 0.5; // ±0.50 €
const DATE_WINDOW_DAYS = 15;       // ±15 j
const SCORE_THRESHOLD_WRITE = 0.7; // > 0.7 -> match unique appliquable
// Statuts a matcher (on ne re-paie pas ce qui est deja paye)
const LIVRAISON_STATUTS_MATCHABLES = ["a_payer", "en_retard", "partiel"];
const CHARGE_STATUTS_MATCHABLES = ["a_payer", "en_retard", "partiel"];

type SbClient = ReturnType<typeof createClient>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseISODate(s: string): number {
  return Date.parse(s + "T00:00:00Z");
}

function daysBetween(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.abs(a - b) / 86400000;
}

// =====================================================================
// Scoring du matching (pur, testable)
// =====================================================================

/**
 * Normalise un nom (fournisseur / client / counterparty) :
 *   - lowercase
 *   - retire les accents
 *   - garde uniquement [a-z0-9 ] (espaces preserves)
 *   - collapse espaces multiples
 */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score de similarite entre deux noms : 1.0 si l'un contient l'autre apres
 * normalisation, sinon ratio de tokens communs (Jaccard sur mots > 2 lettres).
 * Retourne 0 si l'un des deux est vide.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 1;
  const ta = new Set(na.split(" ").filter((w) => w.length >= 3));
  const tb = new Set(nb.split(" ").filter((w) => w.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Score de match global pour un candidat (livraison ou charge) face a une
 * transaction Qonto. Retourne 0..1.
 *
 * Pondération :
 *   - montant : 50 % (decroit lineairement de 1.0 a 0 sur ±0.50 €)
 *   - date    : 30 % (decroit lineairement de 1.0 a 0 sur ±15 j)
 *   - nom     : 20 % (similarite name 0..1)
 *
 * Hard guards (return 0) : montant hors tolerance, date hors fenetre.
 */
export function matchScore(params: {
  txAmount: number;
  candidateAmount: number;
  txDateISO: string;
  candidateDateISO: string;
  txName: string;
  candidateName: string;
}): { score: number; amountDiff: number; dateDiffDays: number; nameScore: number } {
  const amountDiff = Math.abs(params.txAmount - params.candidateAmount);
  const dateDiffDays = daysBetween(params.txDateISO, params.candidateDateISO);
  if (amountDiff > AMOUNT_TOLERANCE_EUR) {
    return { score: 0, amountDiff, dateDiffDays, nameScore: 0 };
  }
  if (dateDiffDays > DATE_WINDOW_DAYS) {
    return { score: 0, amountDiff, dateDiffDays, nameScore: 0 };
  }
  const amountScore = 1 - amountDiff / AMOUNT_TOLERANCE_EUR;
  const dateScore = 1 - dateDiffDays / DATE_WINDOW_DAYS;
  const nameScore = nameSimilarity(params.txName, params.candidateName);
  const score = 0.5 * amountScore + 0.3 * dateScore + 0.2 * nameScore;
  return {
    score: Number(score.toFixed(4)),
    amountDiff: Number(amountDiff.toFixed(2)),
    dateDiffDays: Number(dateDiffDays.toFixed(2)),
    nameScore: Number(nameScore.toFixed(2)),
  };
}

// =====================================================================
// Qonto fetch
// =====================================================================

interface QontoTx {
  transaction_id: string;
  label: string | null;
  counterparty_name: string | null;
  side: "credit" | "debit";
  amount: number;          // toujours positif cote Qonto
  amount_cents: number;
  currency: string;
  settled_at: string;      // ISO 8601 datetime
  emitted_at: string | null;
  operation_type: string | null;
  status: string | null;
  note: string | null;
}

function qontoAuth(): string {
  const login = Deno.env.get("QONTO_LOGIN") ?? "";
  const secret = Deno.env.get("QONTO_SECRET_KEY") ?? "";
  return `${login}:${secret}`;
}

async function fetchQontoTransactions(
  dateFromISO: string,
  dateToISO: string,
): Promise<{ transactions: QontoTx[]; pages: number; truncated: boolean }> {
  const all: QontoTx[] = [];
  let page = 1;
  let truncated = false;
  while (page <= QONTO_MAX_PAGES) {
    const params = new URLSearchParams({
      per_page: String(QONTO_PAGE_SIZE),
      current_page: String(page),
      "settled_at_from": `${dateFromISO}T00:00:00.000Z`,
      "settled_at_to": `${dateToISO}T23:59:59.999Z`,
      "status[]": "completed",
    });
    const url = `${QONTO_BASE}/transactions?${params}`;
    const r = await fetch(url, { headers: { Authorization: qontoAuth() } });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`qonto ${r.status}: ${text.slice(0, 200)}`);
    }
    const data = await r.json();
    const batch = (data.transactions ?? []) as any[];
    for (const t of batch) {
      all.push({
        transaction_id: String(t.transaction_id),
        label: t.label ?? null,
        counterparty_name: t.counterparty_name ?? null,
        side: t.side === "credit" ? "credit" : "debit",
        amount: Number(t.amount) || 0,
        amount_cents: Number(t.amount_cents) || 0,
        currency: t.currency ?? "EUR",
        settled_at: t.settled_at,
        emitted_at: t.emitted_at ?? null,
        operation_type: t.operation_type ?? null,
        status: t.status ?? null,
        note: t.note ?? null,
      });
    }
    const hasNext = !!data.meta?.next_page && batch.length === QONTO_PAGE_SIZE;
    if (!hasNext) {
      return { transactions: all, pages: page, truncated: false };
    }
    page++;
  }
  truncated = true;
  return { transactions: all, pages: QONTO_MAX_PAGES, truncated };
}

// =====================================================================
// Matching contre la base
// =====================================================================

interface MatchOutcome {
  type: "matched" | "ambiguous" | "no_match" | "already_synced" | "error";
  transaction_id: string;
  side: "credit" | "debit";
  amount: number;
  settled_at: string;
  counterparty_name: string | null;
  // Pour matched / ambiguous
  candidates?: Array<{
    table: "livraisons" | "charges";
    id: string;
    label: string;
    score: number;
    amountDiff: number;
    dateDiffDays: number;
    nameScore: number;
  }>;
  applied?: {
    table: "livraisons" | "charges";
    id: string;
    paiement_id?: string;
  };
  error?: string;
}

function txSettleDate(tx: QontoTx): string {
  return (tx.settled_at || "").slice(0, 10) || todayUTC();
}

async function matchCredit(
  sb: SbClient,
  tx: QontoTx,
): Promise<{
  candidates: Array<{
    id: string;
    label: string;
    score: number;
    amountDiff: number;
    dateDiffDays: number;
    nameScore: number;
    livraison: any;
  }>;
}> {
  const settleISO = txSettleDate(tx);
  const winMs = DATE_WINDOW_DAYS * 86400000;
  const minISO = new Date(Date.parse(settleISO + "T00:00:00Z") - winMs).toISOString().slice(0, 10);
  const maxISO = new Date(Date.parse(settleISO + "T00:00:00Z") + winMs).toISOString().slice(0, 10);
  const amount = tx.amount;
  // Borne large sur le montant, on raffine en JS apres.
  const { data, error } = await sb
    .from("livraisons")
    .select("id, num_liv, client_nom, date_livraison, prix_ttc, statut_paiement")
    .gte("date_livraison", minISO)
    .lte("date_livraison", maxISO)
    .gte("prix_ttc", amount - AMOUNT_TOLERANCE_EUR)
    .lte("prix_ttc", amount + AMOUNT_TOLERANCE_EUR)
    .in("statut_paiement", LIVRAISON_STATUTS_MATCHABLES);
  if (error) throw new Error(`livraisons select: ${error.message}`);
  const txName = tx.counterparty_name || tx.label || "";
  const out: any[] = [];
  for (const l of data ?? []) {
    const r = matchScore({
      txAmount: amount,
      candidateAmount: Number(l.prix_ttc) || 0,
      txDateISO: settleISO,
      candidateDateISO: String(l.date_livraison),
      txName,
      candidateName: String(l.client_nom || ""),
    });
    if (r.score > 0) {
      out.push({
        id: l.id,
        label: `liv ${l.num_liv ?? l.id} / ${l.client_nom ?? "?"}`,
        score: r.score,
        amountDiff: r.amountDiff,
        dateDiffDays: r.dateDiffDays,
        nameScore: r.nameScore,
        livraison: l,
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return { candidates: out };
}

async function matchDebit(
  sb: SbClient,
  tx: QontoTx,
): Promise<{
  candidates: Array<{
    id: string;
    label: string;
    score: number;
    amountDiff: number;
    dateDiffDays: number;
    nameScore: number;
    charge: any;
  }>;
}> {
  const settleISO = txSettleDate(tx);
  const winMs = DATE_WINDOW_DAYS * 86400000;
  const minISO = new Date(Date.parse(settleISO + "T00:00:00Z") - winMs).toISOString().slice(0, 10);
  const maxISO = new Date(Date.parse(settleISO + "T00:00:00Z") + winMs).toISOString().slice(0, 10);
  const amount = tx.amount;
  const { data, error } = await sb
    .from("charges")
    .select("id, categorie, fournisseur_nom, date_charge, montant_ttc, statut_paiement")
    .gte("date_charge", minISO)
    .lte("date_charge", maxISO)
    .gte("montant_ttc", amount - AMOUNT_TOLERANCE_EUR)
    .lte("montant_ttc", amount + AMOUNT_TOLERANCE_EUR)
    .in("statut_paiement", CHARGE_STATUTS_MATCHABLES);
  if (error) throw new Error(`charges select: ${error.message}`);
  const txName = tx.counterparty_name || tx.label || "";
  const out: any[] = [];
  for (const c of data ?? []) {
    const r = matchScore({
      txAmount: amount,
      candidateAmount: Number(c.montant_ttc) || 0,
      txDateISO: settleISO,
      candidateDateISO: String(c.date_charge),
      txName,
      candidateName: String(c.fournisseur_nom || ""),
    });
    if (r.score > 0) {
      out.push({
        id: c.id,
        label: `${c.categorie ?? "charge"} / ${c.fournisseur_nom ?? "?"}`,
        score: r.score,
        amountDiff: r.amountDiff,
        dateDiffDays: r.dateDiffDays,
        nameScore: r.nameScore,
        charge: c,
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return { candidates: out };
}

/**
 * Decide le verdict : single / ambiguous / none.
 * Single = un seul candidat dont score > seuil ET ecart >= 0.05 avec le 2eme.
 * Ambiguous = plusieurs candidats > seuil, ecart < 0.05.
 */
function pickWinner<T extends { score: number }>(
  cands: T[],
): { kind: "single"; pick: T } | { kind: "ambiguous"; top: T[] } | { kind: "none" } {
  if (cands.length === 0) return { kind: "none" };
  const top = cands[0];
  if (top.score <= SCORE_THRESHOLD_WRITE) return { kind: "none" };
  const second = cands[1];
  if (!second) return { kind: "single", pick: top };
  if (second.score <= SCORE_THRESHOLD_WRITE) return { kind: "single", pick: top };
  if (top.score - second.score < 0.05) {
    return { kind: "ambiguous", top: cands.filter((c) => c.score > SCORE_THRESHOLD_WRITE) };
  }
  return { kind: "single", pick: top };
}

// =====================================================================
// Idempotency check
// =====================================================================

async function findExistingPaiementByTxId(
  sb: SbClient,
  transactionId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from("paiements")
    .select("id, livraison_id")
    .eq("extra->>qonto_transaction_id", transactionId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") return null; // not-found tolerable
  return data ? String((data as any).id) : null;
}

async function findExistingChargeByTxId(
  sb: SbClient,
  transactionId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from("charges")
    .select("id")
    .eq("extra->>qonto_transaction_id", transactionId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") return null;
  return data ? String((data as any).id) : null;
}

// =====================================================================
// Application des matches (writes)
// =====================================================================

async function applyCreditMatch(
  sb: SbClient,
  tx: QontoTx,
  liv: any,
): Promise<{ paiement_id: string }> {
  const settleISO = txSettleDate(tx);
  const insertPay = await sb
    .from("paiements")
    .insert({
      livraison_id: liv.id,
      date_paiement: settleISO,
      montant: tx.amount,
      mode: "virement",
      reference: tx.transaction_id,
      notes: `Auto-sync Qonto ${tx.transaction_id} - ${tx.counterparty_name ?? tx.label ?? ""}`.slice(0, 500),
      extra: {
        source: "qonto-sync-daily",
        qonto_transaction_id: tx.transaction_id,
        qonto_counterparty_name: tx.counterparty_name,
        qonto_label: tx.label,
        qonto_settled_at: tx.settled_at,
      },
    })
    .select("id")
    .single();
  if (insertPay.error) throw new Error(`insert paiement: ${insertPay.error.message}`);
  const paiementId = String((insertPay.data as any).id);

  // Bump du statut livraison + date paiement (si pas deja paye apres concurrence)
  const updLiv = await sb
    .from("livraisons")
    .update({
      statut_paiement: "paye",
      date_paiement: settleISO,
    })
    .eq("id", liv.id);
  if (updLiv.error) throw new Error(`update livraison: ${updLiv.error.message}`);

  return { paiement_id: paiementId };
}

async function applyDebitMatch(
  sb: SbClient,
  tx: QontoTx,
  charge: any,
): Promise<void> {
  const settleISO = txSettleDate(tx);
  // On merge l'extra existant pour ne pas perdre d'autres clefs.
  const existing = await sb
    .from("charges")
    .select("extra")
    .eq("id", charge.id)
    .maybeSingle();
  const prevExtra = (existing.data as any)?.extra ?? {};
  const newExtra = {
    ...prevExtra,
    qonto_transaction_id: tx.transaction_id,
    qonto_counterparty_name: tx.counterparty_name,
    qonto_label: tx.label,
    qonto_settled_at: tx.settled_at,
    qonto_synced_at: new Date().toISOString(),
  };
  const upd = await sb
    .from("charges")
    .update({
      statut_paiement: "paye",
      mode_paiement: "virement",
      date_paiement: settleISO,
      extra: newExtra,
    })
    .eq("id", charge.id);
  if (upd.error) throw new Error(`update charge: ${upd.error.message}`);
}

// =====================================================================
// Handler principal
// =====================================================================

async function handleSync(req: Request): Promise<Response> {
  // 1. Auth via x-cron-secret
  const cronSecretEnv = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecretEnv) {
    return jsonResponse({ error: "CRON_SECRET not configured" }, 500);
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (provided !== cronSecretEnv) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // 2. Parse body
  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    body = {};
  }
  const dryRun = body.dry_run === true;
  const dateFrom = isISODate(body.date_from) ? body.date_from : yesterdayUTC();
  const dateTo = isISODate(body.date_to) ? body.date_to : dateFrom;
  if (parseISODate(dateFrom) > parseISODate(dateTo)) {
    return jsonResponse({ error: "date_from > date_to" }, 400);
  }

  // 3. Supabase client (service role : bypass RLS pour ecrire)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env vars missing" }, 500);
  }
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4. Fetch Qonto
  let qonto: { transactions: QontoTx[]; pages: number; truncated: boolean };
  try {
    qonto = await fetchQontoTransactions(dateFrom, dateTo);
  } catch (e) {
    return jsonResponse({ error: `qonto fetch: ${String(e)}` }, 502);
  }

  // 5. Pour chaque transaction, decide
  const outcomes: MatchOutcome[] = [];
  const stats = {
    fetched: qonto.transactions.length,
    pages: qonto.pages,
    truncated: qonto.truncated,
    matched: 0,
    ambiguous: 0,
    no_match: 0,
    already_synced: 0,
    errors: 0,
  };

  for (const tx of qonto.transactions) {
    try {
      // Skip operations non-pertinentes (frais bancaires, virement interne entre comptes, cartes...).
      // On garde uniquement transferts (virements) qui correspondent typiquement aux paiements clients/fournisseurs.
      // Les paiements carte fournisseur (carte_debit) sont aussi gardes : un essence / peage carte
      // peut matcher une charge.
      const op = (tx.operation_type ?? "").toLowerCase();
      if (op === "internal_transfer" || op === "swift_income_fee") {
        outcomes.push({
          type: "no_match",
          transaction_id: tx.transaction_id,
          side: tx.side,
          amount: tx.amount,
          settled_at: tx.settled_at,
          counterparty_name: tx.counterparty_name,
        });
        stats.no_match++;
        continue;
      }

      if (tx.side === "credit") {
        // Idempotency : deja un paiement avec ce tx id ?
        const existingPayId = await findExistingPaiementByTxId(sb, tx.transaction_id);
        if (existingPayId) {
          outcomes.push({
            type: "already_synced",
            transaction_id: tx.transaction_id,
            side: "credit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            applied: { table: "livraisons", id: "?", paiement_id: existingPayId },
          });
          stats.already_synced++;
          continue;
        }
        const { candidates } = await matchCredit(sb, tx);
        const verdict = pickWinner(candidates);
        if (verdict.kind === "none") {
          outcomes.push({
            type: "no_match",
            transaction_id: tx.transaction_id,
            side: "credit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: candidates.slice(0, 3).map((c) => ({
              table: "livraisons",
              id: c.id,
              label: c.label,
              score: c.score,
              amountDiff: c.amountDiff,
              dateDiffDays: c.dateDiffDays,
              nameScore: c.nameScore,
            })),
          });
          stats.no_match++;
          continue;
        }
        if (verdict.kind === "ambiguous") {
          outcomes.push({
            type: "ambiguous",
            transaction_id: tx.transaction_id,
            side: "credit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: verdict.top.slice(0, 5).map((c) => ({
              table: "livraisons",
              id: c.id,
              label: c.label,
              score: c.score,
              amountDiff: c.amountDiff,
              dateDiffDays: c.dateDiffDays,
              nameScore: c.nameScore,
            })),
          });
          stats.ambiguous++;
          continue;
        }
        // Single match
        const winner = verdict.pick;
        const winCand = {
          table: "livraisons" as const,
          id: winner.id,
          label: winner.label,
          score: winner.score,
          amountDiff: winner.amountDiff,
          dateDiffDays: winner.dateDiffDays,
          nameScore: winner.nameScore,
        };
        if (dryRun) {
          outcomes.push({
            type: "matched",
            transaction_id: tx.transaction_id,
            side: "credit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: [winCand],
          });
          stats.matched++;
        } else {
          const applied = await applyCreditMatch(sb, tx, winner.livraison);
          outcomes.push({
            type: "matched",
            transaction_id: tx.transaction_id,
            side: "credit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: [winCand],
            applied: { table: "livraisons", id: winner.id, paiement_id: applied.paiement_id },
          });
          stats.matched++;
        }
      } else {
        // DEBIT
        const existingChargeId = await findExistingChargeByTxId(sb, tx.transaction_id);
        if (existingChargeId) {
          outcomes.push({
            type: "already_synced",
            transaction_id: tx.transaction_id,
            side: "debit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            applied: { table: "charges", id: existingChargeId },
          });
          stats.already_synced++;
          continue;
        }
        const { candidates } = await matchDebit(sb, tx);
        const verdict = pickWinner(candidates);
        if (verdict.kind === "none") {
          outcomes.push({
            type: "no_match",
            transaction_id: tx.transaction_id,
            side: "debit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: candidates.slice(0, 3).map((c) => ({
              table: "charges",
              id: c.id,
              label: c.label,
              score: c.score,
              amountDiff: c.amountDiff,
              dateDiffDays: c.dateDiffDays,
              nameScore: c.nameScore,
            })),
          });
          stats.no_match++;
          continue;
        }
        if (verdict.kind === "ambiguous") {
          outcomes.push({
            type: "ambiguous",
            transaction_id: tx.transaction_id,
            side: "debit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: verdict.top.slice(0, 5).map((c) => ({
              table: "charges",
              id: c.id,
              label: c.label,
              score: c.score,
              amountDiff: c.amountDiff,
              dateDiffDays: c.dateDiffDays,
              nameScore: c.nameScore,
            })),
          });
          stats.ambiguous++;
          continue;
        }
        const winner = verdict.pick;
        const winCand = {
          table: "charges" as const,
          id: winner.id,
          label: winner.label,
          score: winner.score,
          amountDiff: winner.amountDiff,
          dateDiffDays: winner.dateDiffDays,
          nameScore: winner.nameScore,
        };
        if (dryRun) {
          outcomes.push({
            type: "matched",
            transaction_id: tx.transaction_id,
            side: "debit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: [winCand],
          });
          stats.matched++;
        } else {
          await applyDebitMatch(sb, tx, winner.charge);
          outcomes.push({
            type: "matched",
            transaction_id: tx.transaction_id,
            side: "debit",
            amount: tx.amount,
            settled_at: tx.settled_at,
            counterparty_name: tx.counterparty_name,
            candidates: [winCand],
            applied: { table: "charges", id: winner.id },
          });
          stats.matched++;
        }
      }
    } catch (e) {
      stats.errors++;
      outcomes.push({
        type: "error",
        transaction_id: tx.transaction_id,
        side: tx.side,
        amount: tx.amount,
        settled_at: tx.settled_at,
        counterparty_name: tx.counterparty_name,
        error: String(e).slice(0, 300),
      });
    }
  }

  return jsonResponse({
    ok: true,
    dry_run: dryRun,
    period: { date_from: dateFrom, date_to: dateTo },
    stats,
    matches: outcomes.filter((o) => o.type === "matched"),
    ambiguous: outcomes.filter((o) => o.type === "ambiguous"),
    no_match: outcomes.filter((o) => o.type === "no_match"),
    already_synced: outcomes.filter((o) => o.type === "already_synced"),
    errors: outcomes.filter((o) => o.type === "error"),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  try {
    return await handleSync(req);
  } catch (e) {
    return jsonResponse({ error: String(e).slice(0, 500) }, 500);
  }
});
