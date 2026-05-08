// Edge function ai-ocr — OCR multimodal Gemini sur photos factures/tickets/RIB.
// Cible : remplacer Tesseract.js (qualite mediocre sur tickets thermiques + factures
// scannees) par Gemini 2.5 Flash multimodal qui lit les images en natif et renvoie
// du JSON structure pret a pre-remplir les formulaires MCA (charges, carburant,
// fournisseurs).
//
// Modes supportes :
//   - facture          : facture fournisseur (PDF rasterise ou photo)
//   - ticket_carburant : ticket de pompe (Total, Avia, Esso...)
//   - rib              : releve d'identite bancaire (IBAN/BIC/titulaire)
//
// Securite : verify_jwt: true au deploy. Limite taille image : 10 MB
// (decode base64 puis controle). Modele : gemini-2.5-flash (tarif input image
// ~$0.10/1M tokens, ~258 tokens/image, donc ~€0.0001 par OCR).
//
// Reponse : { success: true, data: {...}, raw_response: "...", model_used: "..." }
// En cas d'erreur OCR (image illisible, JSON parse fail) : { success: false,
// error: "...", raw_response: "..." } avec status 200 pour que le frontend puisse
// afficher l'erreur sans la traiter comme un crash.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB pour images
const MAX_PDF_BYTES = 20 * 1024 * 1024;   // 20 MB pour PDF (Gemini supporte plus large)
const MAX_OUTPUT_TOKENS = 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
  "application/pdf", // Gemini multimodal supporte le PDF nativement (jusqu'a 1000 pages)
]);

type Mode = "facture" | "ticket_carburant" | "rib";

// ----- Prompts par mode -----

// Note : on demande explicitement null pour les champs non detectes (au lieu
// d'un string vide ou de l'omission) pour que le frontend puisse distinguer
// "non lu" de "champ vide". Pas de markdown -> JSON pur, parsable directement.
const SYSTEM_BASE =
  "Tu es un OCR specialise pour MCA Logistics (PME transport FR). Tu analyses des images " +
  "de documents francais (factures, tickets, RIB) et tu extrais les champs demandes. " +
  "Reponds UNIQUEMENT en JSON valide selon le schema demande. " +
  "null pour les champs non detectes ou ambigus. " +
  "Pas de markdown, pas de prose, pas de ```json, pas de commentaire. " +
  "Montants en euros (nombre decimal point, pas virgule). Dates au format YYYY-MM-DD.";

const PROMPT_FACTURE = `${SYSTEM_BASE}

Extrais les informations de cette facture fournisseur et renvoie ce JSON :
{
  "fournisseur_nom": string|null,
  "date_facture": string|null (YYYY-MM-DD),
  "num_facture": string|null,
  "montant_ht": number|null (euros),
  "montant_ttc": number|null (euros),
  "taux_tva": number|null (pourcentage, ex: 20 pour 20%),
  "lignes": [
    { "description": string, "quantite": number|null, "prix_unitaire": number|null }
  ]|null
}

Regles :
- "fournisseur_nom" = raison sociale de l'emetteur (en haut), pas le destinataire (MCA Logistics).
- Si plusieurs taux TVA : retourne le taux principal (le plus eleve montant).
- Si pas de lignes detaillees claires, "lignes": null.
- Decimal point pour les montants (ex: 1234.56).`;

const PROMPT_TICKET_CARBURANT = `${SYSTEM_BASE}

Extrais les informations de ce ticket de pompe carburant et renvoie ce JSON :
{
  "station": string|null (nom enseigne ex: "TotalEnergies", "Avia"),
  "date": string|null (YYYY-MM-DD),
  "litres": number|null,
  "prix_litre": number|null (euros par litre),
  "montant_ttc": number|null (euros),
  "type_carburant": "gazole"|"sp95"|"sp98"|null
}

Regles :
- "type_carburant" : "gazole" inclut "diesel", "gasoil", "GO", "GNR" ; "sp95" inclut "SP95-E10".
- Si l'enseigne n'est pas claire mais une ville/adresse est lisible, mets ca dans "station".
- montant_ttc = total paye (TTC).`;

const PROMPT_RIB = `${SYSTEM_BASE}

Extrais les informations bancaires de ce RIB et renvoie ce JSON :
{
  "titulaire": string|null (nom complet du titulaire),
  "iban": string|null (sans espaces),
  "bic": string|null (8 ou 11 caracteres, sans espaces),
  "banque": string|null (nom etablissement bancaire)
}

Regles :
- "iban" : format FR seulement valides (FR + 25 caracteres alphanumeriques). Strip les espaces.
- "bic" : 8 ou 11 caracteres alphanumeriques majuscules.
- Si plusieurs lignes pour le titulaire, garde la 1ere (raison sociale).`;

function getPrompt(mode: Mode): string {
  switch (mode) {
    case "facture": return PROMPT_FACTURE;
    case "ticket_carburant": return PROMPT_TICKET_CARBURANT;
    case "rib": return PROMPT_RIB;
  }
}

// ----- Helpers JSON -----

// Strip ```json ... ``` au cas ou Gemini en mette malgre l'instruction. Strip
// aussi le texte avant/apres le 1er bloc { ... } pour gerer les cas ou le
// modele ajoute "Voici le JSON :" en prefixe.
function extractJson(raw: string): unknown | null {
  if (!raw) return null;
  let s = raw.trim();
  // Strip code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Cherche le 1er { et son } correspondant (parenthesage simple — suffisant pour
  // les JSON plats qu'on demande).
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = s.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    return null;
  }
}

// Validation/sanitize champ par champ : on tolere ce que renvoie Gemini mais on
// garantit les types attendus (sinon le frontend plante). Les nombres viennent
// parfois en string ("123,45") -> on tente de parser, sinon null.
function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", ".").replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

function dateISO(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // Deja YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY ou DD-MM-YYYY
  const m = s.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY/MM/DD
  const m2 = s.match(/^(\d{4})[/\-](\d{2})[/\-](\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

function sanitize(mode: Mode, raw: any): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  if (mode === "facture") {
    const lignes = Array.isArray(raw.lignes)
      ? raw.lignes
        .filter((l: any) => l && typeof l === "object")
        .map((l: any) => ({
          description: str(l.description) ?? "",
          quantite: num(l.quantite),
          prix_unitaire: num(l.prix_unitaire),
        }))
        .filter((l: any) => l.description || l.quantite != null || l.prix_unitaire != null)
        .slice(0, 50)
      : null;
    return {
      fournisseur_nom: str(raw.fournisseur_nom),
      date_facture: dateISO(raw.date_facture),
      num_facture: str(raw.num_facture),
      montant_ht: num(raw.montant_ht),
      montant_ttc: num(raw.montant_ttc),
      taux_tva: num(raw.taux_tva),
      lignes,
    };
  }
  if (mode === "ticket_carburant") {
    const t = str(raw.type_carburant)?.toLowerCase() ?? null;
    const typeNorm = t === "gazole" || t === "sp95" || t === "sp98" ? t : null;
    return {
      station: str(raw.station),
      date: dateISO(raw.date),
      litres: num(raw.litres),
      prix_litre: num(raw.prix_litre),
      montant_ttc: num(raw.montant_ttc),
      type_carburant: typeNorm,
    };
  }
  // rib
  const iban = str(raw.iban);
  const bic = str(raw.bic);
  return {
    titulaire: str(raw.titulaire),
    iban: iban ? iban.replace(/\s+/g, "").toUpperCase() : null,
    bic: bic ? bic.replace(/\s+/g, "").toUpperCase() : null,
    banque: str(raw.banque),
  };
}

// ----- Gemini call -----

interface GeminiResp {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { code?: number; message?: string; status?: string };
}

async function callGeminiVision(
  apiKey: string,
  prompt: string,
  imageBase64: string,
  mime: string,
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mime, data: imageBase64 } },
      ],
    }],
    // temperature 0.1 : on veut du quasi-deterministe pour de l'OCR structure.
    // responseMimeType json : Gemini garantit du JSON (depuis 1.5+) -> evite le
    // fence markdown intempestif. On garde extractJson() en defense-in-depth.
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  };

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
    if (!r.ok || !json) {
      const msg = json?.error?.message ?? `Gemini HTTP ${r.status}`;
      return { ok: false, status: r.status, message: msg };
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
    return {
      ok: false,
      status: isAbort ? 504 : 502,
      message: isAbort ? "Timeout Gemini (45s)" : String(e).slice(0, 200),
    };
  }
}

// ----- HTTP handler -----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!GEMINI_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "GEMINI_API_KEY manquant" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Auth check : verify_jwt: true au deploy => Supabase a deja valide. On
    // re-verifie role admin via profiles (V1 admin only, identique a ai-chat).
    const sbUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const { data: profile } = await sbUser.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    const role = profile?.role === "admin" ? "admin" : "salarie";
    if (role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Acces reserve aux admins" }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // ----- Parse body : JSON { image_base64, mime, mode } OU multipart/form-data -----
    let imageBase64 = "";
    let mime = "";
    let mode: Mode | "" = "";

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      mode = String(form.get("mode") ?? "") as Mode;
      if (file instanceof File) {
        const buf = await file.arrayBuffer();
        const fileType = (file.type || "image/jpeg").toLowerCase();
        const isPdf = fileType === "application/pdf";
        const cap = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
        if (buf.byteLength > cap) {
          return new Response(
            JSON.stringify({ success: false, error: `Fichier trop lourd (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB > ${cap / 1024 / 1024} MB)` }),
            { status: 413, headers: { ...CORS, "Content-Type": "application/json" } },
          );
        }
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        mime = fileType;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      imageBase64 = String(body.image_base64 ?? "").trim();
      mime = String(body.mime ?? "image/jpeg").trim();
      mode = String(body.mode ?? "") as Mode;
      // Strip prefix data URL si present (frontend peut envoyer data:application/pdf;base64,XXX)
      const comma = imageBase64.indexOf(",");
      if (imageBase64.startsWith("data:") && comma > 0) {
        const meta = imageBase64.slice(5, comma);
        const mimeFromUrl = (meta.split(";")[0] || "").trim();
        if (mimeFromUrl) mime = mimeFromUrl;
        imageBase64 = imageBase64.slice(comma + 1);
      }
      // Controle taille : limite differente selon image (10 MB) vs PDF (20 MB).
      const isPdf = mime.toLowerCase() === "application/pdf";
      const cap = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
      const approxBytes = imageBase64.length * 0.75;
      if (approxBytes > cap) {
        return new Response(
          JSON.stringify({ success: false, error: `Fichier trop lourd (~${(approxBytes / 1024 / 1024).toFixed(1)} MB > ${cap / 1024 / 1024} MB)` }),
          { status: 413, headers: { ...CORS, "Content-Type": "application/json" } },
        );
      }
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "image_base64 manquant" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    if (!ALLOWED_MIME.has(mime.toLowerCase())) {
      return new Response(
        JSON.stringify({ success: false, error: `Mime non supporte: ${mime}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    if (mode !== "facture" && mode !== "ticket_carburant" && mode !== "rib") {
      return new Response(
        JSON.stringify({ success: false, error: "mode invalide (attendu: facture|ticket_carburant|rib)" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // ----- Call Gemini -----
    const prompt = getPrompt(mode);
    const r = await callGeminiVision(GEMINI_KEY, prompt, imageBase64, mime);
    if (!r.ok) {
      // 429 : on remonte au frontend qui peut afficher un message clair.
      const friendly = r.status === 429
        ? "Quota Gemini atteint. Reessaye dans 1 minute."
        : r.status === 504
          ? "Timeout Gemini (45s) — image trop complexe ou reseau lent."
          : r.message;
      return new Response(
        JSON.stringify({ success: false, error: friendly, model_used: MODEL }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // ----- Parse JSON Gemini -----
    const parsed = extractJson(r.text);
    if (!parsed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Image illisible — Gemini n'a pas renvoye de JSON exploitable. Reprends une photo plus nette / mieux cadree.",
          raw_response: r.text.slice(0, 500),
          model_used: MODEL,
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const data = sanitize(mode, parsed);

    // Compteur quota partage avec ai-chat pour suivi cout (table ai_quota_daily).
    // Best-effort : si la table n'existe pas ou autre erreur, on ne casse pas l'OCR.
    try {
      const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (SERVICE) {
        const sbAdmin = createClient(SUPABASE_URL, SERVICE);
        const today = new Date().toISOString().slice(0, 10);
        const { data: existing } = await sbAdmin
          .from("ai_quota_daily")
          .select("requests_flash")
          .eq("date", today)
          .maybeSingle();
        if (existing) {
          await sbAdmin
            .from("ai_quota_daily")
            .update({ requests_flash: (existing.requests_flash ?? 0) + 1, updated_at: new Date().toISOString() })
            .eq("date", today);
        } else {
          await sbAdmin.from("ai_quota_daily").insert({ date: today, requests_flash: 1 });
        }
      }
    } catch (_) { /* best-effort */ }

    return new Response(
      JSON.stringify({
        success: true,
        data,
        raw_response: r.text.slice(0, 2000),
        model_used: MODEL,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e).slice(0, 300) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
