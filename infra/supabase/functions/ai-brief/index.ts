// Edge function ai-brief — brief automatique panneau-agent (v6).
// Scanne anomalies/opportunites via 10 sources deterministes + memoire long-terme,
// demande a Gemini de produire au moins 2 decisions JSON par run, ecrit dans
// ai_brief_runs et retourne au client.
//
// v4 (2026-05-08) : ajoute KPIs financiers, top clients a risque, activite flotte,
// docs salaries expirants, injection memoire long-terme, prompt force >=2 decisions.
// v6 (2026-05-09) : nouvelle source dso_clients (Sprint H3.4) — DSO global +
// top 5 clients les plus lents sur 90j (calcul aligne avec script-core-dso.js).
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
import { buildRecentlyMentioned, dedupDecisions } from "./dedup.mjs";

const PRO_DAILY_QUOTA = 50;
const GEMINI_TIMEOUT_MS = 45000;
const GEMINI_MAX_RETRIES = 1;
// Cap conservateur : si on ne tient pas en 10 KB, on tronque les listes.
// Bumpe de 7 -> 10 KB en v4 pour absorber les 4 nouvelles sources.
const MAX_TOOL_RESULT_BYTES = 10000;
// Brief = jusqu'a 8 decisions (etait 5). v4 force >= 2 decisions/jour donc on
// monte le plafond pour laisser du headroom.
const MAX_DECISIONS = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ----- Tools deterministes -----

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
    .select("id, niveau, type, titre, message, lue, resolved, created_at")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) return { error: error.message };
  return { count: (data ?? []).length, alertes: data ?? [] };
}

// 5) Audit coherence rapide
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

// ----- Nouvelles sources v4 -----

// Helpers semaine ISO (lundi -> dimanche, TZ UTC pour stabilite cron)
function weekRange(offsetWeeks = 0): { start: string; end: string } {
  const now = new Date();
  // Bascule au lundi de la semaine courante
  const day = now.getUTCDay(); // 0 = dim, 1 = lun, ... 6 = sam
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday + offsetWeeks * 7));
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function monthRange(offsetMonths = 0): { start: string; end: string } {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  const next = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 1));
  const last = new Date(next.getTime() - 86400000);
  return { start: target.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

// 6) KPIs financiers de la periode
async function fetchKpisFinanciers(sb: SbClient) {
  const sem0 = weekRange(0);
  const sem1 = weekRange(-1);
  const mois0 = monthRange(0);
  const mois1 = monthRange(-1);
  const today = todayISO();
  const dateMin30 = isoDaysAgo(30);
  const dateMin90 = isoDaysAgo(90);

  // Livraisons semaine N
  const { data: livSem0 } = await sb.from("livraisons")
    .select("prix_ht, prix_ttc, date_livraison")
    .gte("date_livraison", sem0.start)
    .lte("date_livraison", sem0.end);
  // Livraisons semaine N-1
  const { data: livSem1 } = await sb.from("livraisons")
    .select("prix_ht, date_livraison")
    .gte("date_livraison", sem1.start)
    .lte("date_livraison", sem1.end);
  // Livraisons mois courant
  const { data: livMois0 } = await sb.from("livraisons")
    .select("prix_ht, date_livraison")
    .gte("date_livraison", mois0.start)
    .lte("date_livraison", mois0.end);
  // Livraisons mois N-1
  const { data: livMois1 } = await sb.from("livraisons")
    .select("prix_ht, date_livraison")
    .gte("date_livraison", mois1.start)
    .lte("date_livraison", mois1.end);
  // Charges 30j (pour marge approximative)
  const { data: chg30 } = await sb.from("charges")
    .select("montant_ht, date_charge")
    .gte("date_charge", dateMin30)
    .lte("date_charge", today);
  // CA HT 30j
  const { data: liv30 } = await sb.from("livraisons")
    .select("prix_ht, date_livraison")
    .gte("date_livraison", dateMin30)
    .lte("date_livraison", today);
  // DSO indicatif : livraisons payees sur 90j
  const { data: livPay } = await sb.from("livraisons")
    .select("date_livraison, date_paiement")
    .eq("statut_paiement", "paye")
    .gte("date_paiement", dateMin90)
    .not("date_livraison", "is", null)
    .limit(500);

  const sumHt = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + (Number(r.prix_ht) || 0), 0);
  const sumChg = (rows: any[] | null) => (rows ?? []).reduce((s, r) => s + (Number(r.montant_ht) || 0), 0);

  const caSem0 = sumHt(livSem0);
  const caSem1 = sumHt(livSem1);
  const caMois0 = sumHt(livMois0);
  const caMois1 = sumHt(livMois1);
  const ca30 = sumHt(liv30);
  const chgs30 = sumChg(chg30);

  const deltaSemPct = caSem1 > 0 ? Number((((caSem0 - caSem1) / caSem1) * 100).toFixed(1)) : null;
  const deltaMoisPct = caMois1 > 0 ? Number((((caMois0 - caMois1) / caMois1) * 100).toFixed(1)) : null;

  // DSO : moyenne (date_paiement - date_livraison) en jours
  const delais: number[] = [];
  for (const r of livPay ?? []) {
    const a = (r as any).date_livraison;
    const b = (r as any).date_paiement;
    if (!a || !b) continue;
    const diff = (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000;
    if (!Number.isNaN(diff) && diff >= 0 && diff <= 365) delais.push(diff);
  }
  const dso = delais.length ? Number((delais.reduce((s, x) => s + x, 0) / delais.length).toFixed(1)) : null;

  return {
    semaine: {
      ca_ht: Number(caSem0.toFixed(2)),
      ca_ht_n_minus_1: Number(caSem1.toFixed(2)),
      delta_pct: deltaSemPct,
      nb_livraisons: (livSem0 ?? []).length,
      periode: sem0,
    },
    mois: {
      ca_ht: Number(caMois0.toFixed(2)),
      ca_ht_n_minus_1: Number(caMois1.toFixed(2)),
      delta_pct: deltaMoisPct,
      periode: mois0,
    },
    marge_brute_30j: {
      ca_ht: Number(ca30.toFixed(2)),
      charges_ht: Number(chgs30.toFixed(2)),
      marge_brute_ht: Number((ca30 - chgs30).toFixed(2)),
      marge_pct: ca30 > 0 ? Number((((ca30 - chgs30) / ca30) * 100).toFixed(1)) : null,
    },
    dso_jours: dso,
    nb_livraisons_payees_90j_pour_dso: delais.length,
  };
}

// 7) Top 3 clients a risque
async function fetchClientsARisque(sb: SbClient) {
  const sem0 = weekRange(0);
  const sem4 = weekRange(-4);
  const dateMin90 = isoDaysAgo(90);

  // CA semaine 0 et semaine N-4 par client
  const { data: livSem0 } = await sb.from("livraisons")
    .select("client_id, client_nom, prix_ht")
    .gte("date_livraison", sem0.start)
    .lte("date_livraison", sem0.end);
  const { data: livSem4 } = await sb.from("livraisons")
    .select("client_id, client_nom, prix_ht")
    .gte("date_livraison", sem4.start)
    .lte("date_livraison", sem4.end);
  // Livraisons payees 90j pour delai reel par client
  const { data: livPay90 } = await sb.from("livraisons")
    .select("client_id, client_nom, date_livraison, date_paiement")
    .eq("statut_paiement", "paye")
    .gte("date_paiement", dateMin90)
    .limit(800);
  // Delais contractuels
  const { data: clsAll } = await sb.from("clients")
    .select("id, nom, delai_paiement_jours");

  const delaiContractMap = new Map<string, { nom: string; delai: number }>();
  for (const c of clsAll ?? []) {
    delaiContractMap.set((c as any).id, {
      nom: (c as any).nom || "Client",
      delai: Number((c as any).delai_paiement_jours) || 30,
    });
  }

  const caSem0 = new Map<string, { nom: string; total: number }>();
  for (const l of livSem0 ?? []) {
    const k = (l as any).client_id || (l as any).client_nom || "unknown";
    const cur = caSem0.get(k) || { nom: (l as any).client_nom || "Client", total: 0 };
    cur.total += Number((l as any).prix_ht) || 0;
    caSem0.set(k, cur);
  }
  const caSem4 = new Map<string, { nom: string; total: number }>();
  for (const l of livSem4 ?? []) {
    const k = (l as any).client_id || (l as any).client_nom || "unknown";
    const cur = caSem4.get(k) || { nom: (l as any).client_nom || "Client", total: 0 };
    cur.total += Number((l as any).prix_ht) || 0;
    caSem4.set(k, cur);
  }

  const delaiReelByClient = new Map<string, number[]>();
  for (const r of livPay90 ?? []) {
    const k = (r as any).client_id;
    if (!k) continue;
    const a = (r as any).date_livraison;
    const b = (r as any).date_paiement;
    if (!a || !b) continue;
    const diff = (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000;
    if (Number.isNaN(diff) || diff < 0 || diff > 365) continue;
    if (!delaiReelByClient.has(k)) delaiReelByClient.set(k, []);
    delaiReelByClient.get(k)!.push(diff);
  }

  const candidats: any[] = [];
  // Pool : tous les clients qui ont eu au moins 1 livraison sem N-4 ou un delai 90j calculable
  const allKeys = new Set<string>([...caSem4.keys(), ...delaiReelByClient.keys()]);
  for (const k of allKeys) {
    const sem0Tot = (caSem0.get(k)?.total) || 0;
    const sem4Tot = (caSem4.get(k)?.total) || 0;
    const nom = (caSem0.get(k)?.nom) || (caSem4.get(k)?.nom) || (delaiContractMap.get(k)?.nom) || "Client";
    const delaiContractuel = delaiContractMap.get(k)?.delai ?? 30;
    const delaisR = delaiReelByClient.get(k) || [];
    const delaiReelMoyen = delaisR.length ? delaisR.reduce((s, x) => s + x, 0) / delaisR.length : null;
    const ratioCa = sem4Tot > 0 ? sem0Tot / sem4Tot : null;

    const baisseCa = ratioCa !== null && ratioCa < 0.5 && sem4Tot >= 100;
    const retardPaie = delaiReelMoyen !== null && delaiReelMoyen > delaiContractuel + 14;
    if (!baisseCa && !retardPaie) continue;

    candidats.push({
      client_id: k,
      nom,
      ca_semaine: Number(sem0Tot.toFixed(2)),
      ca_semaine_n_minus_4: Number(sem4Tot.toFixed(2)),
      ratio_ca: ratioCa !== null ? Number(ratioCa.toFixed(2)) : null,
      delai_contractuel: delaiContractuel,
      delai_reel_moyen: delaiReelMoyen !== null ? Number(delaiReelMoyen.toFixed(1)) : null,
      jours_retard_moyen: delaiReelMoyen !== null ? Number((delaiReelMoyen - delaiContractuel).toFixed(1)) : null,
      raisons: [
        baisseCa ? "baisse_ca_50pct" : null,
        retardPaie ? "retard_paiement_>14j" : null,
      ].filter(Boolean),
    });
  }

  // Tri : retard de paiement le plus grave d'abord, puis baisse CA la plus marquee
  candidats.sort((a, b) => {
    const ra = (a.jours_retard_moyen ?? 0) > 14 ? (a.jours_retard_moyen ?? 0) : 0;
    const rb = (b.jours_retard_moyen ?? 0) > 14 ? (b.jours_retard_moyen ?? 0) : 0;
    if (rb !== ra) return rb - ra;
    return (a.ratio_ca ?? 1) - (b.ratio_ca ?? 1);
  });

  return { count: candidats.length, clients: candidats.slice(0, 3) };
}

// 8) Activite flotte : vehicules sans plein > 14j et sans livraison > 14j
async function fetchActiviteFlotte(sb: SbClient) {
  const today = todayISO();
  const todayMs = Date.parse(today + "T00:00:00Z");
  const dateMin14 = isoDaysAgo(14);

  const { data: vehs } = await sb.from("vehicules").select("id, immat, marque, modele");
  if (!vehs?.length) return { count_inactifs: 0, total_flotte: 0, vehicules: [], pct_inactifs: 0 };

  // Pleins recents par vehicule
  const { data: pleinsRecents } = await sb.from("carburant")
    .select("vehicule_id, date_plein")
    .gte("date_plein", dateMin14);
  const vehAvecPlein = new Set<string>((pleinsRecents ?? []).map((p: any) => p.vehicule_id).filter(Boolean));

  // Livraisons recentes par vehicule
  const { data: livRecentes } = await sb.from("livraisons")
    .select("vehicule_id, date_livraison")
    .gte("date_livraison", dateMin14);
  const vehAvecLiv = new Set<string>((livRecentes ?? []).map((l: any) => l.vehicule_id).filter(Boolean));

  // Dernier plein / derniere livraison par vehicule (pour info)
  const { data: dernierPlein } = await sb.from("carburant")
    .select("vehicule_id, date_plein")
    .order("date_plein", { ascending: false })
    .limit(500);
  const lastPleinMap = new Map<string, string>();
  for (const p of dernierPlein ?? []) {
    const k = (p as any).vehicule_id;
    if (k && !lastPleinMap.has(k)) lastPleinMap.set(k, (p as any).date_plein);
  }
  const { data: derniereLiv } = await sb.from("livraisons")
    .select("vehicule_id, date_livraison")
    .order("date_livraison", { ascending: false })
    .limit(500);
  const lastLivMap = new Map<string, string>();
  for (const l of derniereLiv ?? []) {
    const k = (l as any).vehicule_id;
    if (k && !lastLivMap.has(k)) lastLivMap.set(k, (l as any).date_livraison);
  }

  const inactifs: any[] = [];
  for (const v of vehs) {
    const id = (v as any).id;
    const sansPlein14 = !vehAvecPlein.has(id);
    const sansLiv14 = !vehAvecLiv.has(id);
    if (!sansPlein14 && !sansLiv14) continue;
    const lastPlein = lastPleinMap.get(id) || null;
    const lastLiv = lastLivMap.get(id) || null;
    inactifs.push({
      immat: (v as any).immat,
      marque: (v as any).marque,
      modele: (v as any).modele,
      sans_plein_depuis_jours: lastPlein
        ? Math.floor((todayMs - Date.parse(lastPlein + "T00:00:00Z")) / 86400000)
        : null,
      sans_livraison_depuis_jours: lastLiv
        ? Math.floor((todayMs - Date.parse(lastLiv + "T00:00:00Z")) / 86400000)
        : null,
      sans_plein_14j: sansPlein14,
      sans_livraison_14j: sansLiv14,
    });
  }

  const total = vehs.length;
  const pct = total > 0 ? Number(((inactifs.length / total) * 100).toFixed(1)) : 0;
  return {
    count_inactifs: inactifs.length,
    total_flotte: total,
    pct_inactifs: pct,
    vehicules: inactifs.slice(0, 10),
  };
}

// 9) Documents salaries / vehicules expirant 30j
// Schema reel (cf list_tables) : salaries (date_permis, date_assurance, visite_medicale jsonb,
// docs jsonb), salaries_documents (type, date_expiration). Pas de colonne formation_caces
// ni permis_validite. On scan ce qu'on a + skip silencieusement le reste.
async function fetchDocsExpirants(sb: SbClient) {
  const today = todayISO();
  const todayMs = Date.parse(today + "T00:00:00Z");
  const limitMs = todayMs + 30 * 86400000;
  const docs: any[] = [];

  try {
    // 1) salaries : date_permis (= validite permis chez MCA), date_assurance (assurance perso),
    //    visite_medicale.date (jsonb).
    const { data: sals } = await sb.from("salaries")
      .select("id, nom, prenom, actif, date_permis, date_assurance, visite_medicale")
      .eq("actif", true);
    for (const s of sals ?? []) {
      const nom = `${(s as any).prenom || ""} ${(s as any).nom || ""}`.trim() || "Salarié";
      const checks: Array<[string, string | null | undefined]> = [
        ["permis", (s as any).date_permis],
        ["assurance_perso", (s as any).date_assurance],
      ];
      // visite_medicale jsonb : on tente plusieurs cles courantes
      const vm = (s as any).visite_medicale;
      if (vm && typeof vm === "object") {
        const vmDate = vm.date_expiration || vm.date || vm.validite || null;
        if (vmDate) checks.push(["visite_medicale", vmDate]);
      }
      for (const [type, date] of checks) {
        if (!date) continue;
        const dMs = Date.parse(String(date) + "T00:00:00Z");
        if (Number.isNaN(dMs)) continue;
        if (dMs <= limitMs) {
          docs.push({
            cible: "salarie",
            nom,
            type_doc: type,
            date_expiration: String(date),
            jours_restants: Math.floor((dMs - todayMs) / 86400000),
          });
        }
      }
    }

    // 2) salaries_documents : table avec date_expiration explicite
    const { data: salDocs } = await sb.from("salaries_documents")
      .select("salarie_id, type, date_expiration, nom_fichier")
      .not("date_expiration", "is", null);
    if (salDocs?.length) {
      const ids = Array.from(new Set(salDocs.map((d: any) => d.salarie_id).filter(Boolean)));
      const nomsMap = new Map<string, string>();
      if (ids.length) {
        const { data: salNoms } = await sb.from("salaries").select("id, nom, prenom").in("id", ids);
        for (const s of salNoms ?? []) {
          nomsMap.set((s as any).id, `${(s as any).prenom || ""} ${(s as any).nom || ""}`.trim() || "Salarié");
        }
      }
      for (const d of salDocs) {
        const date = (d as any).date_expiration;
        if (!date) continue;
        const dMs = Date.parse(date + "T00:00:00Z");
        if (Number.isNaN(dMs) || dMs > limitMs) continue;
        docs.push({
          cible: "salarie",
          nom: nomsMap.get((d as any).salarie_id) || "Salarié",
          type_doc: (d as any).type || "doc",
          date_expiration: date,
          jours_restants: Math.floor((dMs - todayMs) / 86400000),
        });
      }
    }
  } catch (e) {
    // Defense : si une colonne manque ou un schema bouge, on skip cette source
    // sans casser tout le brief.
    return { count: 0, documents: [], _note: "schema_incomplet:" + String(e).slice(0, 80) };
  }

  // Dedup (meme nom + type_doc + date)
  const seen = new Set<string>();
  const dedup = docs.filter((d) => {
    const k = `${d.cible}|${d.nom}|${d.type_doc}|${d.date_expiration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  dedup.sort((a, b) => a.jours_restants - b.jours_restants);
  return { count: dedup.length, documents: dedup.slice(0, 12) };
}

// 10b) DSO clients (Sprint H3.4) : DSO global + top 5 clients les plus lents sur 90j.
// Utilise la meme formule que script-core-dso.js cote front : delai moyen
// (date_paiement - date_livraison) sur les livraisons payees des 90 derniers jours,
// avec exclusion des delais aberrants (< 0 ou > 365j).
async function fetchDsoClients(sb: SbClient) {
  const dateMin90 = isoDaysAgo(90);
  const today = todayISO();

  const { data, error } = await sb.from("livraisons")
    .select("client_id, client_nom, date_livraison, date_paiement, prix_ttc")
    .eq("statut_paiement", "paye")
    .gte("date_livraison", dateMin90)
    .lte("date_livraison", today)
    .not("date_paiement", "is", null)
    .limit(1000);
  if (error) return { dso_global: null, count: 0, top_lents: [], error: error.message };

  const rows = (data ?? []) as any[];
  if (!rows.length) return { dso_global: null, count: 0, top_lents: [] };

  // Delais contractuels par client (pour comparer reel vs contractuel)
  const ids = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean)));
  const delaiContractMap = new Map<string, number>();
  if (ids.length) {
    const { data: cls } = await sb.from("clients").select("id, delai_paiement_jours").in("id", ids);
    for (const c of cls ?? []) {
      delaiContractMap.set((c as any).id, Number((c as any).delai_paiement_jours) || 30);
    }
  }

  let totalDelai = 0;
  let nbValides = 0;
  const byClient = new Map<string, { nom: string; sum: number; count: number; ttc_total: number }>();
  for (const r of rows) {
    const a = r.date_livraison;
    const b = r.date_paiement;
    if (!a || !b) continue;
    const diff = (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000;
    if (Number.isNaN(diff) || diff < 0 || diff > 365) continue;
    totalDelai += diff;
    nbValides += 1;
    const k = r.client_id || r.client_nom || "unknown";
    const cur = byClient.get(k) || { nom: r.client_nom || "Client", sum: 0, count: 0, ttc_total: 0 };
    cur.sum += diff;
    cur.count += 1;
    cur.ttc_total += Number(r.prix_ttc) || 0;
    byClient.set(k, cur);
  }

  if (!nbValides) return { dso_global: null, count: 0, top_lents: [] };

  const dsoGlobal = Number((totalDelai / nbValides).toFixed(1));

  // Top 5 clients les plus lents (au moins 2 livraisons pour eviter outliers)
  const topLents: any[] = [];
  for (const [k, v] of byClient) {
    if (v.count < 2) continue;
    const moy = v.sum / v.count;
    const contractuel = delaiContractMap.get(k) ?? 30;
    topLents.push({
      client_id: k,
      nom: v.nom,
      dso_jours: Number(moy.toFixed(1)),
      delai_contractuel: contractuel,
      depasse_contractuel_de: Number((moy - contractuel).toFixed(1)),
      nb_livraisons: v.count,
      ttc_total: Number(v.ttc_total.toFixed(2)),
    });
  }
  topLents.sort((a, b) => b.dso_jours - a.dso_jours);

  return {
    dso_global: dsoGlobal,
    count: nbValides,
    top_lents: topLents.slice(0, 5),
  };
}

// 10) Memoire long-terme (top 30 par importance)
async function fetchMemoireLongTerme(sb: SbClient) {
  const { data, error } = await sb.from("ai_memory")
    .select("id, fact_text, category, importance")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { count: 0, faits: [], error: error.message };
  return { count: (data ?? []).length, faits: data ?? [] };
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
      maxOutputTokens: 3500,
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
  const memoire = snapshot.memoire_long_terme as any;
  const memoireSection = memoire?.faits?.length
    ? [
        `## Memoire long-terme (top ${memoire.faits.length} faits, importance DESC)`,
        ...memoire.faits.map((f: any) =>
          `- [${f.category} | imp=${f.importance}] ${f.fact_text}`
        ),
        ``,
        `IMPORTANT : utilise cette memoire pour personnaliser tes alertes. Si un fait dit "Carrefour paie d'habitude J+45", n'alerte PAS pour un retard de J+50 (conforme au pattern). Mentionne explicitement le contexte memoire dans ta description si pertinent.`,
      ].join("\n")
    : `## Memoire long-terme\n(Vide - aucun pattern memorise.)`;

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
    `- Tu DOIS produire AU MOINS 2 decisions chaque jour. Si aucune anomalie critique reelle, genere un "Resume du jour" (priorite=info) avec les KPIs cles (CA semaine, nb livraisons, marge brute 30j, DSO) + une recommandation tactique concrete (ex: "relance le client X qui n'a pas commande cette semaine"). Tu peux aussi produire une decision priorite=opportunite avec une action commerciale ou operationnelle a saisir.`,
    `- "haute" = action urgente requise (impaye > 30j, CT/assurance expire ou < 15j, anomalie carburant grave, doc salarie expire, baisse CA > 20% semaine, vehicule inactif > 14j).`,
    `- "opportunite" = a saisir mais non bloquant (relance client tiede, optim tournee, doublon a fusionner, client a risque modere, doc qui expire dans 15-30j).`,
    `- "info" = note de suivi, KPIs du jour, sans action immediate critique.`,
    `- Mentionne explicitement les chiffres : montants en euros, dates explicites (JJ/MM ou jours restants/retards), pourcentages avec signe.`,
    `- Une decision sans action concrete est inutile : propose TOUJOURS 1-3 actions courtes (label <= 30 chars) avec id parmi : "voir", "relancer", "ouvrir_fournisseur", "ouvrir_vehicule", "ouvrir_livraison", "ouvrir_client", "marquer_resolu", "marquer_lu", "discuter_chatbot".`,
    `- Description : 1-2 phrases factuelles, jamais de blabla.`,
    `- Pas de doublon : si plusieurs livraisons impayees du meme client, agrege en 1 decision.`,
    `- Utilise la memoire long-terme pour ne PAS alerter sur des comportements deja connus comme normaux (ex: pattern de paiement J+45 d'un client habitue).`,
    `- Reponds UNIQUEMENT le JSON. Pas d'introduction, pas de conclusion, pas de markdown.`,
    ``,
    memoireSection,
    ``,
    `## Snapshot des donnees`,
    ``,
    `### KPIs financiers (semaine, mois, marge 30j, DSO)`,
    trimForPrompt(snapshot.kpis_financiers),
    ``,
    `### DSO clients sur 90j (Days Sales Outstanding — delai moyen reel de paiement, global + top 5 clients les plus lents)`,
    trimForPrompt(snapshot.dso_clients),
    ``,
    `### Top 3 clients a risque (baisse CA semaine vs N-4 OU retard paiement reel > contractuel +14j)`,
    trimForPrompt(snapshot.clients_a_risque),
    ``,
    `### Activite flotte (vehicules sans plein OU sans livraison depuis > 14j)`,
    trimForPrompt(snapshot.activite_flotte),
    ``,
    `### Documents salaries expirants sous 30j (permis, assurance, visite medicale, autres docs)`,
    trimForPrompt(snapshot.docs_expirants),
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
    `Produis maintenant le JSON array (max ${MAX_DECISIONS}, minimum 2). Si rien de critique, le minimum 2 = un "Resume du jour" + une recommandation tactique.`,
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

// ----- Quota helpers -----

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (trigger === "cron") {
    if (!bearer || bearer !== SERVICE) {
      return jsonResp({ error: "cron: service_role bearer requis" }, 401);
    }
  } else {
    const sbUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) return jsonResp({ error: "Unauthorized" }, 401);
    const { data: profile } = await sbUser.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if ((profile as any)?.role !== "admin") return jsonResp({ error: "Admin uniquement" }, 403);
  }

  const sbAdmin = createClient(SUPABASE_URL, SERVICE);

  // Snapshot business : 11 fetches en parallele (5 historiques + 4 v4 + DSO clients v6 + memoire).
  let snapshot: Record<string, unknown>;
  try {
    const [
      livRetard, vehEch, anoCarb, alertes, audit,
      kpis, clientsRisk, flotte, docsExp, dsoClients, memoire,
    ] = await Promise.all([
      fetchLivraisonsImpayeesRetard(sbAdmin),
      fetchVehiculesEcheancesProches(sbAdmin),
      fetchAnomaliesCarburant(sbAdmin),
      fetchAlertesAdmin(sbAdmin),
      fetchAuditExpress(sbAdmin),
      fetchKpisFinanciers(sbAdmin),
      fetchClientsARisque(sbAdmin),
      fetchActiviteFlotte(sbAdmin),
      fetchDocsExpirants(sbAdmin),
      fetchDsoClients(sbAdmin),
      fetchMemoireLongTerme(sbAdmin),
    ]);
    snapshot = {
      livraisons_impayees_retard: livRetard,
      vehicules_echeances_proches: vehEch,
      anomalies_carburant: anoCarb,
      alertes_admin: alertes,
      audit_express: audit,
      kpis_financiers: kpis,
      clients_a_risque: clientsRisk,
      activite_flotte: flotte,
      docs_expirants: docsExp,
      dso_clients: dsoClients,
      memoire_long_terme: memoire,
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

  const quota = await getQuota(sbAdmin);
  let model = quota.requests_pro < PRO_DAILY_QUOTA ? "gemini-2.5-pro" : "gemini-2.5-flash";
  let proFellBackToFlash = false;

  const prompt = buildBriefPrompt(snapshot);
  let resp = await callGeminiBrief(model, GEMINI_KEY, prompt);

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
  const rawDecisions = parseDecisions(text);

  // Dedup contre les 3 derniers runs : si une decision (hash type|entity|message)
  // a deja ete proposee recemment, la skipper. Evite de bombarder Achraf avec les
  // memes infos jour apres jour et economise lecture cote utilisateur.
  let decisions = rawDecisions;
  let dedupSkipped = 0;
  try {
    const { data: recentRuns } = await sbAdmin
      .from("ai_brief_runs")
      .select("decisions")
      .order("ran_at", { ascending: false })
      .limit(3);
    const recentlyMentioned = await buildRecentlyMentioned(recentRuns ?? []);
    const filtered = await dedupDecisions(rawDecisions, recentlyMentioned);
    decisions = filtered.kept;
    dedupSkipped = filtered.skipped;
  } catch (e) {
    console.warn("[ai-brief] dedup failed, keeping all decisions:", e);
  }

  await bumpQuota(sbAdmin, model.includes("pro") ? "pro" : "flash");

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
    dedup_skipped: dedupSkipped,
    model_used: model,
    pro_fell_back_to_flash: proFellBackToFlash,
    duration_ms: durationMs,
    insert_error: insErr ? insErr.message : null,
  });
});
