// Edge function ai-chat — chatbot Gemini avec tool use lecture seule
// Hybride Pro/Flash : 50 req Pro/jour partagees entre admins, puis bascule Flash.
// Quota tracker : table public.ai_quota_daily (cf migration 033).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRO_DAILY_QUOTA = 50;
const MAX_TOOL_ITERATIONS = 6;
const RESULT_ROW_CAP = 25;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(role: "admin" | "salarie"): string {
  return [
    `Tu es l'assistant business de MCA Logistics, PME francaise de transport et logistique.`,
    `Date d'aujourd'hui : ${todayISO()}.`,
    ``,
    `Role de ton interlocuteur : ${role}.`,
    ``,
    `## Regles`,
    `- Reponds en francais, ton naturel, concis. Pas de blabla.`,
    `- Quand tu as besoin de donnees, utilise les outils (tu en as 8) au lieu de poser des questions a l'utilisateur.`,
    `- Pour des chiffres (CA, marges, volume), utilise get_stats.`,
    `- Si tu detectes une anomalie ou opportunite (charge anormale, retard paiement long, conso carburant suspecte), signale-la avec une recommandation actionnable.`,
    `- Tu n'as PAS le droit d'ecrire / creer / modifier / supprimer en V1. Si on te demande "cree X" ou "modifie Y", explique que la fonctionnalite ecriture arrive en V2 et propose au lieu un resume des donnees pertinentes.`,
    `- Format reponse : markdown court, listes a puces, tableaux quand pertinent.`,
    `- Les montants sont en euros (TTC sauf precision).`,
    ``,
    `## Contexte business MCA`,
    `- MCA = couche operationnelle transport (planning, tournees, km, inspections, conformite ADR/CE 561, rentabilite par mission/vehicule).`,
    `- La compta legale (TVA CA3, factures officielles) est dans Pennylane (synchro API en cours).`,
    `- La banque est sur Qonto (synchro API en cours).`,
    `- Tu ne dois JAMAIS proposer d'emettre une facture officielle ou de faire de la compta : c'est le role de Pennylane.`,
    ``,
    `## Schema DB (read-only via tools)`,
    `- livraisons : num_liv, client_nom, date_livraison, distance_km, prix_ht/ttc, taux_tva, statut, statut_paiement, depart, arrivee.`,
    `- charges : categorie, description, date_charge, montant_ht/ttc, fournisseur_nom, vehicule_id, statut_paiement.`,
    `- clients : nom, prenom, type (pro/particulier), ville, contact, telephone, email, delai_paiement_jours.`,
    `- fournisseurs : nom, type, ville, contact, telephone, email.`,
    `- vehicules : immat, marque, modele, kilometrage, date_ct, date_assurance, salarie_id.`,
    `- salaries : nom, prenom, poste, permis (categorie + date), assurance.`,
    `- carburant : date_plein, litres, prix_ttc, kilometrage, vehicule_id, salarie_id.`,
  ].join("\n");
}

const TOOLS = [{
  functionDeclarations: [
    {
      name: "search_livraisons",
      description: "Cherche des livraisons (limite a 25 resultats les plus recents). Tous les filtres sont optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "Date min YYYY-MM-DD" },
          date_max: { type: "string", description: "Date max YYYY-MM-DD" },
          client_nom: { type: "string", description: "Nom client (recherche partielle insensible casse)" },
          statut_paiement: { type: "string", enum: ["a_payer", "paye", "en_retard", "partiel"] },
          statut: { type: "string", description: "Statut livraison (en_attente, en_cours, livree, litige)" },
        },
      },
    },
    {
      name: "search_charges",
      description: "Cherche des charges/depenses (limite 25). Tous filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD" },
          date_max: { type: "string", description: "YYYY-MM-DD" },
          categorie: { type: "string" },
          fournisseur_nom: { type: "string", description: "Recherche partielle insensible casse" },
          statut_paiement: { type: "string", enum: ["a_payer", "paye", "en_retard", "partiel"] },
        },
      },
    },
    {
      name: "search_clients",
      description: "Cherche des clients par nom (recherche partielle).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nom client ou ville" },
          type: { type: "string", enum: ["pro", "particulier"] },
        },
      },
    },
    {
      name: "search_fournisseurs",
      description: "Cherche des fournisseurs par nom.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
      },
    },
    {
      name: "search_vehicules",
      description: "Liste les vehicules. Filtre par immatriculation ou marque.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Immatriculation ou marque" },
        },
      },
    },
    {
      name: "search_salaries",
      description: "Liste les salaries. Filtre par nom ou poste.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          actif_seulement: { type: "boolean", default: true },
        },
      },
    },
    {
      name: "search_carburant",
      description: "Liste les pleins de carburant. Filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          vehicule_id: { type: "string" },
        },
      },
    },
    {
      name: "get_stats",
      description: "Calcule des statistiques agregees sur une periode : CA, charges, marge, nb livraisons, conso carburant. Utilise CA quand on parle de chiffre d'affaires.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD (defaut: debut mois courant)" },
          date_max: { type: "string", description: "YYYY-MM-DD (defaut: aujourd'hui)" },
        },
      },
    },
  ],
}];

// ----- Tool implementations -----

type SbClient = ReturnType<typeof createClient>;

async function toolSearchLivraisons(args: any, sb: SbClient) {
  let q = sb.from("livraisons").select(
    "id, num_liv, client_nom, date_livraison, distance_km, prix_ht, prix_ttc, taux_tva, statut, statut_paiement, depart, arrivee, salarie_id, vehicule_id"
  );
  if (args.date_min) q = q.gte("date_livraison", args.date_min);
  if (args.date_max) q = q.lte("date_livraison", args.date_max);
  if (args.client_nom) q = q.ilike("client_nom", `%${args.client_nom}%`);
  if (args.statut_paiement) q = q.eq("statut_paiement", args.statut_paiement);
  if (args.statut) q = q.eq("statut", args.statut);
  q = q.order("date_livraison", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, livraisons: data ?? [] };
}

async function toolSearchCharges(args: any, sb: SbClient) {
  let q = sb.from("charges").select(
    "id, categorie, description, date_charge, montant_ht, montant_ttc, taux_tva, fournisseur_nom, vehicule_id, statut_paiement, mode_paiement"
  );
  if (args.date_min) q = q.gte("date_charge", args.date_min);
  if (args.date_max) q = q.lte("date_charge", args.date_max);
  if (args.categorie) q = q.eq("categorie", args.categorie);
  if (args.fournisseur_nom) q = q.ilike("fournisseur_nom", `%${args.fournisseur_nom}%`);
  if (args.statut_paiement) q = q.eq("statut_paiement", args.statut_paiement);
  q = q.order("date_charge", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, charges: data ?? [] };
}

async function toolSearchClients(args: any, sb: SbClient) {
  let q = sb.from("clients").select(
    "id, nom, prenom, type, ville, contact, telephone, email, delai_paiement_jours, secteur"
  );
  if (args.query) q = q.or(`nom.ilike.%${args.query}%,ville.ilike.%${args.query}%`);
  if (args.type) q = q.eq("type", args.type);
  q = q.order("nom").limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, clients: data ?? [] };
}

async function toolSearchFournisseurs(args: any, sb: SbClient) {
  let q = sb.from("fournisseurs").select(
    "id, nom, type, ville, contact, telephone, email, paiement_mode"
  );
  if (args.query) q = q.or(`nom.ilike.%${args.query}%,ville.ilike.%${args.query}%`);
  q = q.order("nom").limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, fournisseurs: data ?? [] };
}

async function toolSearchVehicules(args: any, sb: SbClient) {
  let q = sb.from("vehicules").select(
    "id, immat, marque, modele, salarie_id, kilometrage, date_ct, date_assurance, carburant, capacite_reservoir, conso"
  );
  if (args.query) q = q.or(`immat.ilike.%${args.query}%,marque.ilike.%${args.query}%,modele.ilike.%${args.query}%`);
  q = q.order("immat").limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, vehicules: data ?? [] };
}

async function toolSearchSalaries(args: any, sb: SbClient) {
  let q = sb.from("salaries").select(
    "id, numero, nom, prenom, nom_famille, poste, permis, categorie_permis, date_permis, telephone, email, actif"
  );
  if (args.actif_seulement !== false) q = q.eq("actif", true);
  if (args.query) q = q.or(`nom.ilike.%${args.query}%,prenom.ilike.%${args.query}%,poste.ilike.%${args.query}%`);
  q = q.order("nom").limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, salaries: data ?? [] };
}

async function toolSearchCarburant(args: any, sb: SbClient) {
  let q = sb.from("carburant").select(
    "id, vehicule_id, salarie_id, date_plein, litres, prix_ttc, prix_ht, taux_tva, kilometrage, type_carburant"
  );
  if (args.date_min) q = q.gte("date_plein", args.date_min);
  if (args.date_max) q = q.lte("date_plein", args.date_max);
  if (args.vehicule_id) q = q.eq("vehicule_id", args.vehicule_id);
  q = q.order("date_plein", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, pleins: data ?? [] };
}

async function toolGetStats(args: any, sb: SbClient) {
  const today = todayISO();
  const dateMax = args.date_max ?? today;
  const dateMin = args.date_min ?? today.slice(0, 7) + "-01";

  const [livRes, chgRes, carbRes] = await Promise.all([
    sb.from("livraisons").select("prix_ht, prix_ttc, distance_km, statut_paiement").gte("date_livraison", dateMin).lte("date_livraison", dateMax),
    sb.from("charges").select("montant_ht, montant_ttc, statut_paiement").gte("date_charge", dateMin).lte("date_charge", dateMax),
    sb.from("carburant").select("litres, prix_ttc").gte("date_plein", dateMin).lte("date_plein", dateMax),
  ]);

  if (livRes.error) return { error: "livraisons: " + livRes.error.message };
  if (chgRes.error) return { error: "charges: " + chgRes.error.message };
  if (carbRes.error) return { error: "carburant: " + carbRes.error.message };

  const liv = livRes.data ?? [];
  const chg = chgRes.data ?? [];
  const carb = carbRes.data ?? [];

  const sum = (arr: any[], key: string) =>
    arr.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);

  const ca_ht = sum(liv, "prix_ht");
  const ca_ttc = sum(liv, "prix_ttc");
  const charges_ht = sum(chg, "montant_ht");
  const charges_ttc = sum(chg, "montant_ttc");
  const carburant_litres = sum(carb, "litres");
  const carburant_ttc = sum(carb, "prix_ttc");

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    nb_livraisons: liv.length,
    nb_charges: chg.length,
    ca_ht: Number(ca_ht.toFixed(2)),
    ca_ttc: Number(ca_ttc.toFixed(2)),
    charges_ht: Number(charges_ht.toFixed(2)),
    charges_ttc: Number(charges_ttc.toFixed(2)),
    marge_brute_ht: Number((ca_ht - charges_ht).toFixed(2)),
    km_total: Number(sum(liv, "distance_km").toFixed(1)),
    carburant_litres: Number(carburant_litres.toFixed(2)),
    carburant_ttc: Number(carburant_ttc.toFixed(2)),
    livraisons_impayees_count: liv.filter((l) => l.statut_paiement === "a_payer" || l.statut_paiement === "en_retard").length,
    charges_impayees_count: chg.filter((c) => c.statut_paiement === "a_payer" || c.statut_paiement === "en_retard").length,
  };
}

const TOOL_HANDLERS: Record<string, (args: any, sb: SbClient) => Promise<unknown>> = {
  search_livraisons: toolSearchLivraisons,
  search_charges: toolSearchCharges,
  search_clients: toolSearchClients,
  search_fournisseurs: toolSearchFournisseurs,
  search_vehicules: toolSearchVehicules,
  search_salaries: toolSearchSalaries,
  search_carburant: toolSearchCarburant,
  get_stats: toolGetStats,
};

// ----- Gemini helper -----

interface GeminiResp {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{ text?: string; functionCall?: { name: string; args: any } }>;
    };
    finishReason?: string;
  }>;
  error?: { message: string };
}

async function callGemini(model: string, apiKey: string, systemInstruction: string, history: any[]): Promise<GeminiResp> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: history,
    tools: TOOLS,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  return await r.json();
}

// ----- Quota helper -----

async function getQuota(sb: SbClient): Promise<{ requests_pro: number; requests_flash: number }> {
  const today = todayISO();
  const { data } = await sb.from("ai_quota_daily").select("requests_pro, requests_flash").eq("date", today).maybeSingle();
  return { requests_pro: data?.requests_pro ?? 0, requests_flash: data?.requests_flash ?? 0 };
}

async function bumpQuota(sb: SbClient, kind: "pro" | "flash"): Promise<void> {
  const today = todayISO();
  const col = kind === "pro" ? "requests_pro" : "requests_flash";
  // Upsert : si la ligne existe, increment ; sinon insert avec 1.
  const { data: existing } = await sb.from("ai_quota_daily").select(col).eq("date", today).maybeSingle();
  if (existing) {
    const next = (existing as any)[col] + 1;
    await sb.from("ai_quota_daily").update({ [col]: next, updated_at: new Date().toISOString() }).eq("date", today);
  } else {
    await sb.from("ai_quota_daily").insert({ date: today, [col]: 1 });
  }
}

// ----- HTTP handler -----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  try {
    // Auth : verify_jwt: true au deploy => Supabase a deja valide. On lit juste l'auth.uid.
    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Client avec le JWT user pour identifier qui appelle (et sa role)
    const sbUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const { data: profile } = await sbUser.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    const role = (profile?.role === "admin" ? "admin" : "salarie") as "admin" | "salarie";

    // V1 : admin only
    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Acces reserve aux admins en V1" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Body : { history: [{ role: 'user'|'model', parts: [...] }, ...] }
    const body = await req.json().catch(() => ({}));
    const history: any[] = Array.isArray(body.history) ? body.history : [];
    if (history.length === 0) {
      return new Response(JSON.stringify({ error: "history vide" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Service-role client pour les tools (RLS bypass) et le quota
    const sbAdmin = createClient(SUPABASE_URL, SERVICE);

    // Quota -> choix modele
    const quota = await getQuota(sbAdmin);
    let usePro = quota.requests_pro < PRO_DAILY_QUOTA;
    let model = usePro ? "gemini-2.5-pro" : "gemini-2.5-flash";

    const systemInstruction = buildSystemPrompt(role);
    let working = [...history];
    let finalText = "";
    let toolCallsMade: string[] = [];
    let lastResp: GeminiResp | null = null;
    let proFellBackToFlash = false;

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      lastResp = await callGemini(model, GEMINI_KEY, systemInstruction, working);

      if (lastResp.error) {
        const code = (lastResp.error as { code?: number }).code ?? 0;
        // Fallback gracieux : si Pro renvoie 429 (quota free tier epuise) ou 403,
        // on bascule sur Flash et on retente l'iteration courante.
        if (usePro && (code === 429 || code === 403)) {
          usePro = false;
          model = "gemini-2.5-flash";
          proFellBackToFlash = true;
          // Marque le quota Pro comme epuise pour la journee (evite de retenter Pro a chaque request).
          // Pas d'upsert pour preserver requests_flash si la ligne existe deja.
          const today = todayISO();
          const { data: existQ } = await sbAdmin.from("ai_quota_daily").select("date").eq("date", today).maybeSingle();
          if (existQ) {
            await sbAdmin.from("ai_quota_daily").update({ requests_pro: PRO_DAILY_QUOTA, updated_at: new Date().toISOString() }).eq("date", today);
          } else {
            await sbAdmin.from("ai_quota_daily").insert({ date: today, requests_pro: PRO_DAILY_QUOTA, requests_flash: 0 });
          }
          continue;
        }
        // Sinon : remonte l'erreur Gemini avec le detail au frontend.
        return new Response(JSON.stringify({
          error: "gemini",
          code,
          message: lastResp.error.message,
          model,
          hint: code === 403
            ? "La cle Gemini est bloquee au niveau du projet/org Google. Recreer une cle depuis un compte Gmail perso (pas org Workspace) sur https://aistudio.google.com."
            : code === 429
            ? "Quota Gemini epuise. Reessaye dans quelques minutes."
            : null,
        }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const cand = lastResp.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      const fnCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
      const texts = parts.filter((p) => p.text).map((p) => p.text!);

      if (fnCalls.length === 0) {
        finalText = texts.join("\n");
        break;
      }

      // Push les function calls dans l'history et execute
      working.push({ role: "model", parts: fnCalls.map((c) => ({ functionCall: c })) });

      const results = await Promise.all(
        fnCalls.map(async (call) => {
          toolCallsMade.push(call.name);
          const handler = TOOL_HANDLERS[call.name];
          if (!handler) return { error: `unknown tool: ${call.name}` };
          try {
            return await handler(call.args ?? {}, sbAdmin);
          } catch (e) {
            return { error: String(e).slice(0, 200) };
          }
        })
      );

      working.push({
        role: "function",
        parts: fnCalls.map((c, i) => ({ functionResponse: { name: c.name, response: results[i] } })),
      });
    }

    if (!finalText) finalText = "Je n'ai pas pu produire de reponse (boucle d'outils trop longue).";

    // Bump le quota de la requete consommee
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
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
