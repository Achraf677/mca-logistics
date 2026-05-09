// Edge function `charges-recurrence-daily`
// ----------------------------------------------------------------------------
// Auto-generation des charges recurrentes (loyer, leasing, assurance, etc.).
//
// Logique (cron quotidien 5h UTC) :
//   1. SELECT charges WHERE recurrence_actif = true AND recurrence_pattern IS NOT NULL
//   2. Pour chaque template :
//      - calculer la prochaine date d'echeance attendue (depuis la derniere
//        instance generee, ou depuis date_charge du template si aucune)
//      - si la date <= aujourd'hui ET aucune instance pour cette periode,
//        INSERT une nouvelle charge clone du template :
//          * id auto, date_charge = prochaine date
//          * recurrence_actif = false (instance, pas template)
//          * recurrence_template_id = template.id
//          * extra.recurrence_period_key = cle de periode (idempotence)
//          * statut_paiement = 'a_payer'
//   3. Logger dans audit_log via trigger automatique (table deja triggeree
//      depuis migration 038).
//
// Idempotence : index unique partial sur (template_id, period_key) bloque
// les doublons (migration 041). Si une re-execution arrive : ON CONFLICT
// DO NOTHING.
//
// Securite : header `x-cron-secret` doit matcher Deno.env CRON_SECRET.
//
// Body (POST JSON) :
//   {
//     "as_of_date": "YYYY-MM-DD",   // optionnel, defaut = today UTC
//     "dry_run":    false           // optionnel, si true ne fait que retourner le plan
//   }
//
// Reponse :
//   { ok, dry_run, as_of, stats: {templates, generated, skipped, errors}, generated: [...] }
// ----------------------------------------------------------------------------

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// =====================================================================
// Calcul de date / cle de periode (pur, testable)
// =====================================================================

/**
 * Retourne le nombre de jours du mois donne (year, month 1-12).
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calcule la prochaine date d'echeance pour un template :
 *   - prend la derniere date connue (lastDate)
 *   - ajoute le pas selon pattern (1 / 3 / 12 mois)
 *   - cale au jourDuMois (capped au dernier jour du mois cible)
 *
 * Retourne YYYY-MM-DD.
 */
export function nextOccurrenceDate(
  lastDateISO: string,
  pattern: "mensuelle" | "trimestrielle" | "annuelle",
  jourDuMois: number,
): string {
  const step =
    pattern === "mensuelle" ? 1 : pattern === "trimestrielle" ? 3 : 12;
  const [yStr, mStr] = lastDateISO.split("-");
  let year = Number(yStr);
  let month = Number(mStr); // 1-12
  month += step;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  const cap = daysInMonth(year, month);
  const day = Math.min(Math.max(1, jourDuMois), cap);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Cle de periode (idempotency) pour un pattern donne et une date.
 *   - mensuelle     : 'YYYY-MM'
 *   - trimestrielle : 'YYYY-Qn' (n = 1..4)
 *   - annuelle      : 'YYYY'
 */
export function periodKey(
  dateISO: string,
  pattern: "mensuelle" | "trimestrielle" | "annuelle",
): string {
  const [y, m] = dateISO.split("-");
  if (pattern === "mensuelle") return `${y}-${m}`;
  if (pattern === "annuelle") return `${y}`;
  const month = Number(m);
  const q = Math.ceil(month / 3);
  return `${y}-Q${q}`;
}

/**
 * Retourne true si dateA <= dateB (comparaison ISO strings).
 */
function dateLE(aISO: string, bISO: string): boolean {
  return aISO <= bISO;
}

// =====================================================================
// Handler principal
// =====================================================================

type ChargeRow = {
  id: string;
  categorie: string | null;
  description: string | null;
  date_charge: string;
  montant_ttc: number | null;
  montant_ht: number | null;
  taux_tva: number | null;
  taux_deductibilite: number | null;
  vehicule_id: string | null;
  fournisseur_id: string | null;
  fournisseur_nom: string | null;
  mode_paiement: string | null;
  recurrence_pattern: string | null;
  recurrence_actif: boolean;
  recurrence_jour_du_mois: number | null;
  recurrence_date_fin: string | null;
  recurrence_template_id: string | null;
  extra: Record<string, unknown> | null;
};

async function handleRecurrence(req: Request): Promise<Response> {
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
  let body: { as_of_date?: string; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch (_) {
    body = {};
  }
  const dryRun = body.dry_run === true;
  const asOf = isISODate(body.as_of_date) ? body.as_of_date! : todayUTC();

  // 3. Supabase client (service role)
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

  // 4. Fetch templates actifs
  const { data: templates, error: tplErr } = await sb
    .from("charges")
    .select("*")
    .eq("recurrence_actif", true)
    .not("recurrence_pattern", "is", null);

  if (tplErr) {
    return jsonResponse({ error: `select templates: ${tplErr.message}` }, 500);
  }

  const stats = {
    templates: (templates ?? []).length,
    generated: 0,
    skipped: 0,
    errors: 0,
  };
  const generated: Array<{
    template_id: string;
    new_id?: string;
    date_charge: string;
    period_key: string;
    description: string | null;
    montant_ttc: number | null;
    skipped_reason?: string;
  }> = [];

  for (const t of (templates ?? []) as ChargeRow[]) {
    try {
      const pattern = t.recurrence_pattern as
        | "mensuelle"
        | "trimestrielle"
        | "annuelle";
      if (!["mensuelle", "trimestrielle", "annuelle"].includes(pattern)) {
        stats.skipped++;
        generated.push({
          template_id: t.id,
          date_charge: "",
          period_key: "",
          description: t.description,
          montant_ttc: t.montant_ttc,
          skipped_reason: `invalid_pattern:${pattern}`,
        });
        continue;
      }
      if (!t.recurrence_jour_du_mois) {
        stats.skipped++;
        generated.push({
          template_id: t.id,
          date_charge: "",
          period_key: "",
          description: t.description,
          montant_ttc: t.montant_ttc,
          skipped_reason: "missing_jour_du_mois",
        });
        continue;
      }

      // Trouve la derniere instance generee depuis ce template.
      const { data: lastInstances, error: lastErr } = await sb
        .from("charges")
        .select("id, date_charge")
        .eq("recurrence_template_id", t.id)
        .order("date_charge", { ascending: false })
        .limit(1);

      if (lastErr) throw new Error(`last instance: ${lastErr.message}`);

      const lastDate =
        lastInstances && lastInstances.length > 0
          ? (lastInstances[0] as { date_charge: string }).date_charge
          : t.date_charge;

      // Genere toutes les occurrences manquantes jusqu'a as_of (cas oubli cron)
      let cursorDate = lastDate;
      // Safety: cap a 24 iterations max par template pour eviter boucles
      // infinies si donnees corrompues.
      let iter = 0;
      while (iter < 24) {
        iter++;
        const next = nextOccurrenceDate(
          cursorDate,
          pattern,
          t.recurrence_jour_du_mois,
        );
        if (!dateLE(next, asOf)) break;
        if (t.recurrence_date_fin && !dateLE(next, t.recurrence_date_fin)) {
          break;
        }
        const key = periodKey(next, pattern);

        if (dryRun) {
          stats.generated++;
          generated.push({
            template_id: t.id,
            date_charge: next,
            period_key: key,
            description: t.description,
            montant_ttc: t.montant_ttc,
          });
          cursorDate = next;
          continue;
        }

        // Build new row : copie tous champs metier sauf recurrence-specific
        const newExtra = {
          ...(t.extra && typeof t.extra === "object" ? t.extra : {}),
          recurrence_period_key: key,
          generated_from_template: t.id,
          generated_at: new Date().toISOString(),
        };
        const insertRow = {
          categorie: t.categorie,
          description: t.description,
          date_charge: next,
          montant_ttc: t.montant_ttc,
          montant_ht: t.montant_ht,
          taux_tva: t.taux_tva,
          taux_deductibilite: t.taux_deductibilite,
          vehicule_id: t.vehicule_id,
          fournisseur_id: t.fournisseur_id,
          fournisseur_nom: t.fournisseur_nom,
          mode_paiement: t.mode_paiement,
          statut_paiement: "a_payer",
          recurrence_pattern: null,
          recurrence_actif: false,
          recurrence_jour_du_mois: null,
          recurrence_date_fin: null,
          recurrence_template_id: t.id,
          extra: newExtra,
        };

        const { data: inserted, error: insErr } = await sb
          .from("charges")
          .insert(insertRow)
          .select("id")
          .maybeSingle();

        if (insErr) {
          // Conflit unique = doublon deja insere par un run concurrent : skip silencieux.
          if (
            insErr.code === "23505" ||
            /duplicate key/i.test(insErr.message)
          ) {
            stats.skipped++;
            generated.push({
              template_id: t.id,
              date_charge: next,
              period_key: key,
              description: t.description,
              montant_ttc: t.montant_ttc,
              skipped_reason: "duplicate_period",
            });
            cursorDate = next;
            continue;
          }
          throw new Error(`insert: ${insErr.message}`);
        }
        stats.generated++;
        generated.push({
          template_id: t.id,
          new_id: (inserted as { id: string } | null)?.id,
          date_charge: next,
          period_key: key,
          description: t.description,
          montant_ttc: t.montant_ttc,
        });
        cursorDate = next;
      }
    } catch (e) {
      stats.errors++;
      generated.push({
        template_id: t.id,
        date_charge: "",
        period_key: "",
        description: t.description,
        montant_ttc: t.montant_ttc,
        skipped_reason: `error:${String((e as Error).message ?? e)}`,
      });
    }
  }

  return jsonResponse({
    ok: true,
    dry_run: dryRun,
    as_of: asOf,
    stats,
    generated,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  try {
    return await handleRecurrence(req);
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, 500);
  }
});
