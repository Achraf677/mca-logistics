// Edge function pennylane-fec-import — import FEC Pennylane mensuel idempotent.
//
// Declenchement :
//   - Cron GitHub Actions (le 1er du mois 06:00 UTC) → POST { trigger: 'cron' }
//   - Manuel : POST { year: 2026, month: 4 }
//
// Auth : verify_jwt = false. Header obligatoire `x-cron-secret: <CRON_SECRET>`
// matchant le secret Supabase `CRON_SECRET`. La fonction utilise ensuite le
// service role pour ecrire en DB (RLS bypass autorise pour cette tache batch).
//
// Idempotency :
//   - charges / paiements   : extra->>'pennylane_ecriture_key' (cf migration 036)
//   - fournisseurs / clients: extra->>'pennylane_supplier_id' / 'pennylane_customer_id'
//   - Re-run le meme mois → on update plutot que doubler.
//
// Format FEC :
//   L'API Pennylane `GET /api/external/v2/fec` est testee a chaque invoc avec
//   un fallback (essais successifs) :
//     1. JSON (si le serveur sait servir Accept: application/json)
//     2. CSV pipe-separated standard FR (arrete 29 juillet 2013, 18 colonnes)
//     3. CSV tab-separated (variante Pennylane observee dans certains exports)
//   On detecte le format via Content-Type + heuristique sur la 1re ligne.
//
// Mapping FEC → MCA :
//   - CompteNum 6XX                → table `charges`
//   - CompteNum 401X (fournisseurs) → upsert `fournisseurs`
//   - CompteNum 411X (clients)      → upsert `clients`
//   - CompteNum 5XX (banque) avec PieceRef matchant un num_liv → upsert `paiements`
//
// Logs : la fonction renvoie `{ year, month, format_detected, stats, errors[] }`.
// Le workflow GHA archive cette reponse en artifact pour audit.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ====== Config ======
const PENNYLANE_BASE = "https://app.pennylane.com/api/external/v2";
const FEC_TIMEOUT_MS = 60_000;
const MAX_FEC_BYTES = 25 * 1024 * 1024; // garde-fou 25 MB

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ====== Types ======
interface FecRow {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;   // YYYYMMDD ou YYYY-MM-DD
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: number;
  Credit: number;
  EcritureLet: string;
  DateLet: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
}

interface ImportStats {
  charges_created: number;
  charges_updated: number;
  paiements_created: number;
  paiements_updated: number;
  fournisseurs_created: number;
  fournisseurs_updated: number;
  clients_created: number;
  clients_updated: number;
  rows_total: number;
  rows_skipped: number;
}

// ====== Utils ======
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseFecDate(raw: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^\d{8}$/.test(t)) {
    return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  // dd/mm/yyyy
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseFecAmount(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  const s = String(raw).trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function lastDayOfMonth(year: number, month: number): string {
  // month 1-12 → date du dernier jour
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonth(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01`;
}

function logErr(errors: string[], msg: string) {
  errors.push(msg.slice(0, 500));
  console.error("[pennylane-fec-import]", msg);
}

// ====== FEC fetch + parse ======
async function fetchFec(year: number, month: number, fiscalYear: number): Promise<{
  rows: FecRow[];
  format: "json" | "csv-pipe" | "csv-tab" | "unknown";
  raw_size: number;
}> {
  const tok = Deno.env.get("PENNYLANE_TOKEN") ?? "";
  if (!tok) throw new Error("PENNYLANE_TOKEN missing");
  const dateMin = firstDayOfMonth(year, month);
  const dateMax = lastDayOfMonth(year, month);
  const params = new URLSearchParams({
    fiscal_year: String(fiscalYear),
    date_min: dateMin,
    date_max: dateMax,
  });
  const url = `${PENNYLANE_BASE}/fec?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FEC_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tok}`,
        Accept: "application/json, text/csv, text/plain;q=0.8",
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Pennylane FEC HTTP ${r.status} : ${txt.slice(0, 300)}`);
  }
  const ctype = (r.headers.get("content-type") ?? "").toLowerCase();
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_FEC_BYTES) {
    throw new Error(`FEC too large : ${buf.byteLength} bytes`);
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);

  // ----- JSON branch -----
  if (ctype.includes("application/json")) {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed?.items) ? parsed.items
        : Array.isArray(parsed?.data) ? parsed.data
        : Array.isArray(parsed?.entries) ? parsed.entries
        : null;
      if (!arr) {
        // Pennylane peut renvoyer un objet avec download URL; on log et on bascule
        logErr([], `JSON FEC sans tableau direct (keys=${Object.keys(parsed || {}).join(",")})`);
      } else {
        return {
          rows: arr.map(jsonRowToFecRow),
          format: "json",
          raw_size: buf.byteLength,
        };
      }
    } catch (e) {
      // pas du JSON malgre le content-type → tente CSV
    }
  }

  // ----- CSV branch (pipe ou tab) -----
  return parseFecCsv(text, buf.byteLength);
}

function jsonRowToFecRow(o: any): FecRow {
  // Tolerant : essaie plusieurs noms de cle (snake_case, camelCase, FEC officiel)
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (o[k] != null) return String(o[k]);
    }
    return "";
  };
  return {
    JournalCode: pick("JournalCode", "journal_code", "journalCode"),
    JournalLib: pick("JournalLib", "journal_lib", "journalLib"),
    EcritureNum: pick("EcritureNum", "ecriture_num", "ecritureNum", "id"),
    EcritureDate: pick("EcritureDate", "ecriture_date", "ecritureDate", "date"),
    CompteNum: pick("CompteNum", "compte_num", "compteNum", "account_number"),
    CompteLib: pick("CompteLib", "compte_lib", "compteLib", "account_label"),
    CompAuxNum: pick("CompAuxNum", "comp_aux_num", "compAuxNum"),
    CompAuxLib: pick("CompAuxLib", "comp_aux_lib", "compAuxLib"),
    PieceRef: pick("PieceRef", "piece_ref", "pieceRef", "piece_number"),
    PieceDate: pick("PieceDate", "piece_date", "pieceDate"),
    EcritureLib: pick("EcritureLib", "ecriture_lib", "ecritureLib", "label", "description"),
    Debit: parseFecAmount(o.Debit ?? o.debit),
    Credit: parseFecAmount(o.Credit ?? o.credit),
    EcritureLet: pick("EcritureLet", "ecriture_let"),
    DateLet: pick("DateLet", "date_let"),
    ValidDate: pick("ValidDate", "valid_date", "validation_date"),
    Montantdevise: pick("Montantdevise", "montant_devise", "montantDevise"),
    Idevise: pick("Idevise", "idevise", "currency"),
  };
}

function parseFecCsv(text: string, rawSize: number): {
  rows: FecRow[];
  format: "csv-pipe" | "csv-tab";
  raw_size: number;
} {
  // Detecte separateur sur la 1re ligne (header).
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = firstLine.includes("|") ? "|" : "\t";
  const format: "csv-pipe" | "csv-tab" = sep === "|" ? "csv-pipe" : "csv-tab";

  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return { rows: [], format, raw_size: rawSize };

  const header = lines[0].split(sep).map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) =>
    h.toLowerCase() === name.toLowerCase()
  );
  const cols = {
    JournalCode: idx("JournalCode"),
    JournalLib: idx("JournalLib"),
    EcritureNum: idx("EcritureNum"),
    EcritureDate: idx("EcritureDate"),
    CompteNum: idx("CompteNum"),
    CompteLib: idx("CompteLib"),
    CompAuxNum: idx("CompAuxNum"),
    CompAuxLib: idx("CompAuxLib"),
    PieceRef: idx("PieceRef"),
    PieceDate: idx("PieceDate"),
    EcritureLib: idx("EcritureLib"),
    Debit: idx("Debit"),
    Credit: idx("Credit"),
    EcritureLet: idx("EcritureLet"),
    DateLet: idx("DateLet"),
    ValidDate: idx("ValidDate"),
    Montantdevise: idx("Montantdevise"),
    Idevise: idx("Idevise"),
  };

  const out: FecRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const c = line.split(sep);
    const get = (j: number) => (j >= 0 && j < c.length ? (c[j] ?? "").trim() : "");
    out.push({
      JournalCode: get(cols.JournalCode),
      JournalLib: get(cols.JournalLib),
      EcritureNum: get(cols.EcritureNum),
      EcritureDate: get(cols.EcritureDate),
      CompteNum: get(cols.CompteNum),
      CompteLib: get(cols.CompteLib),
      CompAuxNum: get(cols.CompAuxNum),
      CompAuxLib: get(cols.CompAuxLib),
      PieceRef: get(cols.PieceRef),
      PieceDate: get(cols.PieceDate),
      EcritureLib: get(cols.EcritureLib),
      Debit: parseFecAmount(get(cols.Debit)),
      Credit: parseFecAmount(get(cols.Credit)),
      EcritureLet: get(cols.EcritureLet),
      DateLet: get(cols.DateLet),
      ValidDate: get(cols.ValidDate),
      Montantdevise: get(cols.Montantdevise),
      Idevise: get(cols.Idevise),
    });
  }
  return { rows: out, format, raw_size: rawSize };
}

// ====== Mapping CompteNum → categorie MCA ======
function categorieFromCompte(compte: string, libelle: string): string {
  const c = (compte || "").trim();
  const lib = (libelle || "").toLowerCase();
  if (!c) return "autre";

  // 606X carburant / fournitures
  if (c.startsWith("606")) {
    if (lib.includes("carbur") || lib.includes("essence") || lib.includes("gasoil") || lib.includes("gazole")) return "carburant";
    return "autre";
  }
  // 615 / 616 / 622 / 623 / 624 / 625 / 626 / 627 / 628 - services exterieurs
  if (c.startsWith("6155")) return "entretien";   // entretien et reparations
  if (c.startsWith("616")) return "assurance";     // primes d'assurance
  if (c.startsWith("6248") || c.startsWith("6241") || c.startsWith("6242")) return "autre"; // transports sur achats / ventes
  if (c.startsWith("6354") || c.startsWith("6358")) return "tva";
  if (c.startsWith("641") || c.startsWith("644") || c.startsWith("645") || c.startsWith("647")) return "salaires";
  if (c.startsWith("612") || c.startsWith("613")) return "lld_credit"; // redevances credit-bail
  // Peages / autoroutes : 6241 ou 6243 ou libelle
  if (lib.includes("peage") || lib.includes("autoroute") || lib.includes("apr")) return "peage";
  return "autre";
}

// ====== Idempotency key ======
function ecritureKey(year: number, journalCode: string, ecritureNum: string, compteNum: string): string {
  // Une ecriture FEC peut avoir plusieurs lignes (debit/credit different comptes).
  // On suffix avec compteNum pour rendre la cle unique au niveau ligne charge/paiement.
  return `${year}|${journalCode}|${ecritureNum}|${compteNum}`;
}

// ====== Sb client typed ======
type Sb = SupabaseClient;

// ====== Upsert helpers ======
async function upsertFournisseurFromFec(
  sb: Sb,
  row: FecRow,
  stats: ImportStats,
  errors: string[],
): Promise<string | null> {
  const supplierId = (row.CompAuxNum || "").trim() || null;
  const nom = (row.CompAuxLib || row.EcritureLib || "").trim();
  if (!nom) return null;

  // Cle Pennylane : CompAuxNum (id auxiliaire) si dispo, sinon "name:<lower>"
  const pennylaneSupplierId = supplierId || `name:${nom.toLowerCase()}`;

  // Cherche existant par cle Pennylane
  const { data: existing, error: errSel } = await sb
    .from("fournisseurs")
    .select("id, extra")
    .filter("extra->>pennylane_supplier_id", "eq", pennylaneSupplierId)
    .maybeSingle();
  if (errSel) {
    logErr(errors, `select fournisseur: ${errSel.message}`);
  }

  if (existing) {
    // Update extra metadata (ne touche pas au nom si deja set par admin)
    const newExtra = { ...(existing.extra || {}), pennylane_supplier_id: pennylaneSupplierId, pennylane_last_seen: todayISO() };
    const { error } = await sb.from("fournisseurs").update({ extra: newExtra }).eq("id", existing.id);
    if (error) logErr(errors, `update fournisseur: ${error.message}`);
    else stats.fournisseurs_updated++;
    return existing.id as string;
  }

  // Tente match par nom (case insensitive) avant de creer un doublon
  const { data: byName } = await sb
    .from("fournisseurs")
    .select("id, extra")
    .ilike("nom", nom)
    .limit(1)
    .maybeSingle();
  if (byName) {
    const newExtra = { ...(byName.extra || {}), pennylane_supplier_id: pennylaneSupplierId, pennylane_last_seen: todayISO() };
    const { error } = await sb.from("fournisseurs").update({ extra: newExtra }).eq("id", byName.id);
    if (error) logErr(errors, `attach fournisseur: ${error.message}`);
    else stats.fournisseurs_updated++;
    return byName.id as string;
  }

  const { data: created, error: errIns } = await sb
    .from("fournisseurs")
    .insert({
      nom,
      type: "Pro",
      extra: { pennylane_supplier_id: pennylaneSupplierId, pennylane_last_seen: todayISO(), source: "pennylane_fec" },
    })
    .select("id")
    .single();
  if (errIns) {
    logErr(errors, `insert fournisseur: ${errIns.message}`);
    return null;
  }
  stats.fournisseurs_created++;
  return created.id as string;
}

async function upsertClientFromFec(
  sb: Sb,
  row: FecRow,
  stats: ImportStats,
  errors: string[],
): Promise<string | null> {
  const customerId = (row.CompAuxNum || "").trim() || null;
  const nom = (row.CompAuxLib || row.EcritureLib || "").trim();
  if (!nom) return null;
  const pennylaneCustomerId = customerId || `name:${nom.toLowerCase()}`;

  const { data: existing } = await sb
    .from("clients")
    .select("id, extra")
    .filter("extra->>pennylane_customer_id", "eq", pennylaneCustomerId)
    .maybeSingle();

  if (existing) {
    const newExtra = { ...((existing as any).extra || {}), pennylane_customer_id: pennylaneCustomerId, pennylane_last_seen: todayISO() };
    const { error } = await sb.from("clients").update({ extra: newExtra }).eq("id", (existing as any).id);
    if (error) logErr(errors, `update client: ${error.message}`);
    else stats.clients_updated++;
    return (existing as any).id as string;
  }

  const { data: byName } = await sb
    .from("clients")
    .select("id, extra")
    .ilike("nom", nom)
    .limit(1)
    .maybeSingle();
  if (byName) {
    const newExtra = { ...((byName as any).extra || {}), pennylane_customer_id: pennylaneCustomerId, pennylane_last_seen: todayISO() };
    const { error } = await sb.from("clients").update({ extra: newExtra }).eq("id", (byName as any).id);
    if (error) logErr(errors, `attach client: ${error.message}`);
    else stats.clients_updated++;
    return (byName as any).id as string;
  }

  const { data: created, error: errIns } = await sb
    .from("clients")
    .insert({
      nom,
      type: "Pro",
      extra: { pennylane_customer_id: pennylaneCustomerId, pennylane_last_seen: todayISO(), source: "pennylane_fec" },
    })
    .select("id")
    .single();
  if (errIns) {
    logErr(errors, `insert client: ${errIns.message}`);
    return null;
  }
  stats.clients_created++;
  return (created as any).id as string;
}

async function upsertChargeFromFec(
  sb: Sb,
  row: FecRow,
  fournisseurId: string | null,
  fiscalYear: number,
  stats: ImportStats,
  errors: string[],
) {
  const dateCharge = parseFecDate(row.EcritureDate) || parseFecDate(row.PieceDate) || todayISO();
  const montantHt = Math.max(row.Debit, 0); // les charges sont en debit dans les comptes 6
  // FEC ne distingue pas systematiquement HT/TTC ; on stocke debit en HT et on
  // recalcule TTC a 0 (le fait sera enrichi via factures_fournisseurs si besoin).
  const description = (row.EcritureLib || row.PieceRef || "").slice(0, 500);
  const categorie = categorieFromCompte(row.CompteNum, row.CompteLib);
  const key = ecritureKey(fiscalYear, row.JournalCode, row.EcritureNum, row.CompteNum);

  const payload: Record<string, unknown> = {
    categorie,
    description,
    date_charge: dateCharge,
    montant_ht: montantHt,
    montant_ttc: montantHt, // a defaut, identique au HT (TVA importee separement)
    taux_tva: 0,
    fournisseur_id: fournisseurId,
    extra: {
      pennylane_ecriture_key: key,
      pennylane_journal_code: row.JournalCode,
      pennylane_ecriture_num: row.EcritureNum,
      pennylane_compte_num: row.CompteNum,
      pennylane_compte_lib: row.CompteLib,
      pennylane_piece_ref: row.PieceRef || null,
      pennylane_imported_at: new Date().toISOString(),
    },
  };

  // Verifie si deja importe (cle unique sur extra->>pennylane_ecriture_key)
  const { data: existing } = await sb
    .from("charges")
    .select("id")
    .filter("extra->>pennylane_ecriture_key", "eq", key)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from("charges").update(payload).eq("id", (existing as any).id);
    if (error) logErr(errors, `update charge ${key}: ${error.message}`);
    else stats.charges_updated++;
    return;
  }

  const { error } = await sb.from("charges").insert(payload);
  if (error) {
    // En cas de race condition / collision sur l'index unique, retente update
    if (String(error.message).includes("duplicate")) {
      const { error: e2 } = await sb.from("charges").update(payload).filter("extra->>pennylane_ecriture_key", "eq", key);
      if (e2) logErr(errors, `retry charge ${key}: ${e2.message}`);
      else stats.charges_updated++;
    } else {
      logErr(errors, `insert charge ${key}: ${error.message}`);
    }
    return;
  }
  stats.charges_created++;
}

async function upsertPaiementFromFec(
  sb: Sb,
  row: FecRow,
  fiscalYear: number,
  stats: ImportStats,
  errors: string[],
) {
  // Cherche un num_liv dans PieceRef ou EcritureLib
  const ref = `${row.PieceRef || ""} ${row.EcritureLib || ""}`.trim();
  const livraisonId = await tryFindLivraisonId(sb, ref);
  if (!livraisonId) {
    // Pas de match livraison → on ignore (sinon on creerait un paiement orphelin)
    stats.rows_skipped++;
    return;
  }
  const date = parseFecDate(row.EcritureDate) || parseFecDate(row.PieceDate) || todayISO();
  const montant = row.Debit > 0 ? row.Debit : row.Credit;
  const key = ecritureKey(fiscalYear, row.JournalCode, row.EcritureNum, row.CompteNum);

  const payload: Record<string, unknown> = {
    livraison_id: livraisonId,
    date_paiement: date,
    montant,
    mode: row.JournalCode || "virement",
    reference: row.PieceRef || row.EcritureLib || null,
    extra: {
      pennylane_ecriture_key: key,
      pennylane_journal_code: row.JournalCode,
      pennylane_ecriture_num: row.EcritureNum,
      pennylane_piece_ref: row.PieceRef || null,
      pennylane_imported_at: new Date().toISOString(),
    },
  };

  const { data: existing } = await sb
    .from("paiements")
    .select("id")
    .filter("extra->>pennylane_ecriture_key", "eq", key)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from("paiements").update(payload).eq("id", (existing as any).id);
    if (error) logErr(errors, `update paiement ${key}: ${error.message}`);
    else stats.paiements_updated++;
    return;
  }
  const { error } = await sb.from("paiements").insert(payload);
  if (error) {
    if (String(error.message).includes("duplicate")) {
      const { error: e2 } = await sb.from("paiements").update(payload).filter("extra->>pennylane_ecriture_key", "eq", key);
      if (e2) logErr(errors, `retry paiement ${key}: ${e2.message}`);
      else stats.paiements_updated++;
    } else {
      logErr(errors, `insert paiement ${key}: ${error.message}`);
    }
    return;
  }
  stats.paiements_created++;
}

async function tryFindLivraisonId(sb: Sb, ref: string): Promise<string | null> {
  if (!ref) return null;
  // Cherche un token type "F2024-001" ou "001234"
  const match = ref.match(/[A-Z]{0,3}\d{2,}-?\d*/i);
  const token = match ? match[0] : ref.trim();
  if (!token || token.length < 3) return null;
  const { data } = await sb
    .from("livraisons")
    .select("id")
    .or(`num_liv.ilike.%${token}%`)
    .limit(1)
    .maybeSingle();
  return data ? (data as any).id : null;
}

// ====== Main importer ======
async function importMonth(sb: Sb, year: number, month: number): Promise<{
  stats: ImportStats;
  errors: string[];
  format_detected: string;
  raw_size: number;
  date_min: string;
  date_max: string;
}> {
  const stats: ImportStats = {
    charges_created: 0, charges_updated: 0,
    paiements_created: 0, paiements_updated: 0,
    fournisseurs_created: 0, fournisseurs_updated: 0,
    clients_created: 0, clients_updated: 0,
    rows_total: 0, rows_skipped: 0,
  };
  const errors: string[] = [];
  // Hypothese : exercice fiscal = annee civile (cas standard FR / PME).
  // Si Pennylane retourne 422 on essaie l'annee suivante (cas exercice decale).
  let fiscalYear = year;
  let fec: Awaited<ReturnType<typeof fetchFec>>;
  try {
    fec = await fetchFec(year, month, fiscalYear);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("HTTP 422") || msg.includes("HTTP 404")) {
      fiscalYear = year + 1;
      fec = await fetchFec(year, month, fiscalYear);
    } else {
      throw e;
    }
  }

  stats.rows_total = fec.rows.length;

  // 1ere passe : upsert tiers (fournisseurs / clients) pour avoir leurs UUID
  const supplierByCompAux = new Map<string, string | null>();
  const customerByCompAux = new Map<string, string | null>();

  for (const row of fec.rows) {
    const c = (row.CompteNum || "").trim();
    if (c.startsWith("401") && row.CompAuxNum) {
      if (!supplierByCompAux.has(row.CompAuxNum)) {
        const id = await upsertFournisseurFromFec(sb, row, stats, errors);
        supplierByCompAux.set(row.CompAuxNum, id);
      }
    } else if (c.startsWith("411") && row.CompAuxNum) {
      if (!customerByCompAux.has(row.CompAuxNum)) {
        const id = await upsertClientFromFec(sb, row, stats, errors);
        customerByCompAux.set(row.CompAuxNum, id);
      }
    }
  }

  // 2eme passe : charges (6XX) et paiements (5XX)
  // Pour relier une charge a son fournisseur, on cherche dans la meme ecriture
  // (meme JournalCode + EcritureNum) une ligne 401X et on prend son CompAuxNum.
  const ecritureFournisseur = new Map<string, string>();
  for (const row of fec.rows) {
    if ((row.CompteNum || "").startsWith("401") && row.CompAuxNum) {
      const k = `${row.JournalCode}|${row.EcritureNum}`;
      if (!ecritureFournisseur.has(k)) ecritureFournisseur.set(k, row.CompAuxNum);
    }
  }

  for (const row of fec.rows) {
    const c = (row.CompteNum || "").trim();
    if (!c) { stats.rows_skipped++; continue; }
    if (c.startsWith("6")) {
      const k = `${row.JournalCode}|${row.EcritureNum}`;
      const compAux = ecritureFournisseur.get(k) || null;
      const fournisseurId = compAux ? (supplierByCompAux.get(compAux) ?? null) : null;
      await upsertChargeFromFec(sb, row, fournisseurId, fiscalYear, stats, errors);
    } else if (c.startsWith("5")) {
      // Banque - on tente de creer un paiement si on trouve une livraison
      await upsertPaiementFromFec(sb, row, fiscalYear, stats, errors);
    } else if (c.startsWith("401") || c.startsWith("411")) {
      // deja traites en passe 1
      continue;
    } else {
      // 7XX (produits), 1XX/2XX (capitaux/immo), 44XX (TVA) → ignores pour V1
      stats.rows_skipped++;
    }
  }

  return {
    stats,
    errors,
    format_detected: fec.format,
    raw_size: fec.raw_size,
    date_min: firstDayOfMonth(year, month),
    date_max: lastDayOfMonth(year, month),
  };
}

// ====== HTTP entry point ======
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden : x-cron-secret missing or invalid" }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }

  let year: number;
  let month: number;
  if (body?.trigger === "cron") {
    // Mois precedent par rapport a aujourd'hui
    const now = new Date();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    year = target.getUTCFullYear();
    month = target.getUTCMonth() + 1;
  } else {
    year = Number(body?.year);
    month = Number(body?.month);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return new Response(JSON.stringify({ error: "year invalid (int 2020-2100 expected)" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return new Response(JSON.stringify({ error: "month invalid (1-12 expected)" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const t0 = Date.now();
    const result = await importMonth(sb, year, month);
    const duration_ms = Date.now() - t0;
    console.log("[pennylane-fec-import] done", JSON.stringify({ year, month, duration_ms, ...result }));
    return new Response(JSON.stringify({
      ok: true,
      year, month,
      duration_ms,
      ...result,
    }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pennylane-fec-import] FATAL", msg);
    return new Response(JSON.stringify({
      ok: false,
      year, month,
      error: msg,
    }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
