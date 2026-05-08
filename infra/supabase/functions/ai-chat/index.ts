// Edge function ai-chat — chatbot Gemini avec tool use lecture seule
// Hybride Pro/Flash : 50 req Pro/jour partagees entre admins, puis bascule Flash.
// Quota tracker : table public.ai_quota_daily (cf migration 033).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRO_DAILY_QUOTA = 50;
// 4 iterations couvrent largement les vrais cas d'usage (la plupart finissent en 1-2).
// Reduit de 6 -> 4 pour limiter la consommation de tokens free tier.
const MAX_TOOL_ITERATIONS = 4;
// Limite ramenee a 15 lignes (etait 25) pour reduire le contexte renvoye.
const RESULT_ROW_CAP = 15;
// Plafond ramene a 7 KB (etait 12 KB) pour reduire le cout en input tokens
// par iteration. Si une liste depasse, on tronque mais on garde count + meta.
const MAX_TOOL_RESULT_BYTES = 7000;
const GEMINI_TIMEOUT_MS = 45000;
const GEMINI_MAX_RETRIES = 2;
// Auto-retry interne uniquement si <= 8s. Au-dela, on remonte au frontend
// qui affiche un countdown et retry automatiquement (meilleur UX).
const GEMINI_INTERNAL_RETRY_THRESHOLD_S = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(role: "admin" | "salarie", memoryFacts: any[] = []): string {
  const memorySection = memoryFacts.length
    ? [
        ``,
        `## Memoire long-terme (faits valides, importance 1-5)`,
        ...memoryFacts.map((f) => `- [${f.category} | importance=${f.importance}] ${f.fact_text}`),
        ``,
        `Si tu apprends un fait business important pendant la conversation (preference user, pattern client, anomalie recurrente vehicule, convention interne), propose de l'ajouter avec add_memory_fact en expliquant pourquoi. L'admin peut supprimer via delete_memory_fact(id) ou directement dans le panneau memoire.`,
      ].join("\n")
    : [
        ``,
        `## Memoire long-terme`,
        `(Aucun fait memorise pour l'instant. Quand tu apprends une info importante et durable, propose-la avec add_memory_fact.)`,
      ].join("\n");

  return [
    `Assistant business MCA Logistics (PME transport FR). Date : ${todayISO()}. Role user : ${role}.`,
    ``,
    `## Regles`,
    `- Reponds FR, concis, sans blabla. Markdown court, listes/tableaux quand pertinent.`,
    `- Utilise les outils (27 dispo) au lieu de demander a l'user. Pour les chiffres (CA, marges) -> get_stats.`,
    `- Signale anomalies/opportunites avec reco actionnable.`,
    `- V1 : LECTURE SEULE sur les donnees business (livraisons/charges/...). Si on demande "cree" / "modifie", dis que l'ecriture arrive en V2.`,
    `- Tu peux ecrire dans la memoire long-terme via add_memory_fact / delete_memory_fact (faits durables uniquement).`,
    `- Montants en euros TTC sauf precision.`,
    ``,
    `## Contexte`,
    `- MCA = couche operationnelle transport (planning, km, inspections, ADR, rentabilite). PAS la compta.`,
    `- Pennylane = source legale (TVA CA3, factures officielles). Qonto = banque. Ne propose JAMAIS d'emettre facture ou faire compta.`,
    ``,
    `## APIs branchees`,
    `- **Qonto** : qonto_organization (soldes), qonto_search_transactions. Pour rapprochement bancaire.`,
    `- **Pennylane** : pennylane_factures_clients/fournisseurs, pennylane_search_clients/fournisseurs. Pour croisement compta vs MCA.`,
    `- **ORS** : ors_distance (km/duree HGV camion), ors_optimize_tournee. Pour estimation/planif.`,
    `- **Sentry** : sentry_recent_issues (bugs JS prod).`,
    memorySection,
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
    {
      name: "search_paiements",
      description: "Liste les paiements clients recus. Filtres optionnels (date, mode, livraison, client).",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD" },
          date_max: { type: "string", description: "YYYY-MM-DD" },
          mode: { type: "string", description: "virement, cheque, especes, cb..." },
          livraison_id: { type: "string" },
          client_id: { type: "string" },
        },
      },
    },
    {
      name: "search_inspections",
      description: "Liste les inspections vehicule hebdomadaires. Filtres : date, salarie, vehicule, statut.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD" },
          date_max: { type: "string", description: "YYYY-MM-DD" },
          salarie_id: { type: "string" },
          vehicule_id: { type: "string" },
          statut: { type: "string", description: "soumise, validee, refusee" },
        },
      },
    },
    {
      name: "search_entretiens",
      description: "Liste les entretiens vehicule. Filtres : date, vehicule, type d'entretien (vidange, freins, etc).",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          vehicule_id: { type: "string" },
          type: { type: "string", description: "Type d'entretien (recherche partielle)" },
        },
      },
    },
    {
      name: "search_incidents",
      description: "Liste les incidents (sinistres, litiges, problemes chauffeur). Filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          salarie_id: { type: "string" },
          gravite: { type: "string", description: "mineur, moyen, grave, critique" },
          statut: { type: "string", description: "ouvert, en_cours, clos" },
        },
      },
    },
    {
      name: "search_alertes",
      description: "Liste les alertes admin (permis expirant, CT, assurance, anomalies detectees, etc).",
      parameters: {
        type: "object",
        properties: {
          niveau: { type: "string", enum: ["info", "warning", "error", "critical"] },
          lue: { type: "boolean", description: "false = non lues uniquement" },
          resolved: { type: "boolean", description: "false = non resolues uniquement" },
        },
      },
    },
    {
      name: "get_planning_semaine",
      description: "Recupere le planning d'une semaine (qui travaille, quels horaires, qui est en absence/conge). Si date_ref non fournie, utilise la semaine courante.",
      parameters: {
        type: "object",
        properties: {
          date_ref: { type: "string", description: "Date YYYY-MM-DD dans la semaine cible (defaut: aujourd'hui)" },
        },
      },
    },
    {
      name: "get_anomalies_carburant",
      description: "Detecte les anomalies sur les pleins carburant : conso L/100km hors moyenne vehicule, pleins rapproches anormalement (<24h), litres > capacite reservoir, prix au litre incoherent.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "Defaut: 30 derniers jours" },
          date_max: { type: "string" },
        },
      },
    },
    // ===== Qonto (banque) =====
    {
      name: "qonto_organization",
      description: "Recupere les comptes bancaires Qonto de MCA et leurs soldes courants.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "qonto_search_transactions",
      description: "Liste les transactions bancaires Qonto (virements recus/emis, prelevements, cartes). Filtres optionnels (date, sens, montant, libelle).",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD (settled_at_from)" },
          date_max: { type: "string", description: "YYYY-MM-DD" },
          side: { type: "string", enum: ["debit", "credit"], description: "debit = sortant, credit = entrant" },
          label_search: { type: "string", description: "Texte present dans le libelle (recherche partielle)" },
          min_amount: { type: "number", description: "Montant min en euros" },
        },
      },
    },
    // ===== Pennylane (compta) =====
    {
      name: "pennylane_factures_clients",
      description: "Liste les factures clients officielles dans Pennylane (la source de verite compta). Permet de croiser avec MCA.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD (date d'emission)" },
          date_max: { type: "string" },
          paid_only: { type: "boolean", description: "true = uniquement factures payees" },
          unpaid_only: { type: "boolean", description: "true = uniquement factures impayees" },
        },
      },
    },
    {
      name: "pennylane_factures_fournisseurs",
      description: "Liste les factures fournisseurs dans Pennylane.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
        },
      },
    },
    {
      name: "pennylane_search_clients",
      description: "Liste les clients de Pennylane (utile pour comparer avec les clients MCA et detecter les divergences).",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nom (recherche partielle)" } },
      },
    },
    {
      name: "pennylane_search_fournisseurs",
      description: "Liste les fournisseurs de Pennylane.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
      },
    },
    // ===== OpenRouteService (HeiGIT) =====
    {
      name: "ors_distance",
      description: "Calcule la distance routiere et la duree entre 2 adresses (avec geocoding automatique). Profil camion poids-lourd par defaut.",
      parameters: {
        type: "object",
        properties: {
          depart: { type: "string", description: "Adresse de depart (texte libre)" },
          arrivee: { type: "string", description: "Adresse d'arrivee (texte libre)" },
          profile: { type: "string", enum: ["driving-hgv", "driving-car"], description: "driving-hgv = camion (defaut), driving-car = voiture" },
        },
        required: ["depart", "arrivee"],
      },
    },
    {
      name: "ors_optimize_tournee",
      description: "Optimise une tournee multi-stops (TSP) pour un camion. Donne l'ordre optimal et la distance/duree totale.",
      parameters: {
        type: "object",
        properties: {
          depart: { type: "string", description: "Adresse de depart de la tournee" },
          arrets: { type: "array", items: { type: "string" }, description: "Liste d'adresses d'arrets a optimiser" },
          retour: { type: "string", description: "Adresse de retour (optionnel, defaut = depart)" },
        },
        required: ["depart", "arrets"],
      },
    },
    // ===== Sentry (monitoring) =====
    {
      name: "sentry_recent_issues",
      description: "Liste les bugs JS / erreurs recentes en prod sur le site MCA (capturees par Sentry).",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Periode (1h, 24h, 7d, 14d, 30d). Defaut 7d." },
          unresolved_only: { type: "boolean", description: "Defaut true" },
        },
      },
    },
    // ===== Memoire long-terme =====
    {
      name: "add_memory_fact",
      description: "Memorise un fait important sur le business pour le retenir dans toutes les conversations futures. Ne l'utilise QUE pour des faits de long terme (pattern client, anomalie recurrente vehicule, convention interne, preference user). PAS pour des notes du jour ou des donnees temporaires (qui sont deja en DB).",
      parameters: {
        type: "object",
        properties: {
          fact_text: { type: "string", description: "Phrase courte, factuelle, en francais. Max 500 caracteres." },
          category: {
            type: "string",
            enum: ["general", "client", "fournisseur", "salarie", "vehicule", "finance", "compta", "preference_user", "pattern"],
          },
          importance: { type: "integer", description: "1=mineur, 5=critique. Defaut 3." },
        },
        required: ["fact_text"],
      },
    },
    {
      name: "delete_memory_fact",
      description: "Supprime un fait memorise (par son id). Utilise quand l'admin dit qu'un fait n'est plus valide ou est faux.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "UUID du fait a supprimer" } },
        required: ["id"],
      },
    },
    {
      name: "list_memory_facts",
      description: "Liste les faits memorises (filtre optionnel par categorie). Note : les faits sont DEJA injectes automatiquement dans ton contexte. N'appelle ce tool que si l'admin demande explicitement de voir la memoire.",
      parameters: {
        type: "object",
        properties: { category: { type: "string" } },
      },
    },
  ],
}];

// ----- Tool implementations -----

type SbClient = ReturnType<typeof createClient>;

async function toolSearchLivraisons(args: any, sb: SbClient) {
  let q = sb.from("livraisons").select(
    "id, num_liv, client_nom, date_livraison, distance_km, prix_ht, prix_ttc, taux_tva, statut, statut_paiement, depart, arrivee, " +
    "salarie:salaries(nom, prenom), vehicule:vehicules(immat, marque, modele)"
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
    "id, categorie, description, date_charge, montant_ht, montant_ttc, taux_tva, fournisseur_nom, statut_paiement, mode_paiement, " +
    "vehicule:vehicules(immat, marque, modele)"
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
    "id, date_plein, litres, prix_ttc, prix_ht, taux_tva, kilometrage, type_carburant, " +
    "salarie:salaries(nom, prenom), vehicule:vehicules(immat, marque, modele)"
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

async function toolSearchPaiements(args: any, sb: SbClient) {
  let q = sb.from("paiements").select(
    "id, date_paiement, montant, mode, reference, frais, notes, " +
    "client:clients(nom, prenom), livraison:livraisons(num_liv, client_nom, prix_ttc)"
  );
  if (args.date_min) q = q.gte("date_paiement", args.date_min);
  if (args.date_max) q = q.lte("date_paiement", args.date_max);
  if (args.mode) q = q.eq("mode", args.mode);
  if (args.livraison_id) q = q.eq("livraison_id", args.livraison_id);
  if (args.client_id) q = q.eq("client_id", args.client_id);
  q = q.order("date_paiement", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, paiements: data ?? [] };
}

async function toolSearchInspections(args: any, sb: SbClient) {
  let q = sb.from("inspections").select(
    "id, date_inspection, semaine_label, commentaire, statut, " +
    "salarie:salaries(nom, prenom), vehicule:vehicules(immat, marque, modele)"
  );
  if (args.date_min) q = q.gte("date_inspection", args.date_min);
  if (args.date_max) q = q.lte("date_inspection", args.date_max);
  if (args.salarie_id) q = q.eq("salarie_id", args.salarie_id);
  if (args.vehicule_id) q = q.eq("vehicule_id", args.vehicule_id);
  if (args.statut) q = q.eq("statut", args.statut);
  q = q.order("date_inspection", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, inspections: data ?? [] };
}

async function toolSearchEntretiens(args: any, sb: SbClient) {
  let q = sb.from("entretiens").select(
    "id, date_entretien, type, description, cout_ttc, cout_ht, taux_tva, kilometrage, prochain_km, prochaine_date, " +
    "vehicule:vehicules(immat, marque, modele)"
  );
  if (args.date_min) q = q.gte("date_entretien", args.date_min);
  if (args.date_max) q = q.lte("date_entretien", args.date_max);
  if (args.vehicule_id) q = q.eq("vehicule_id", args.vehicule_id);
  if (args.type) q = q.ilike("type", `%${args.type}%`);
  q = q.order("date_entretien", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, entretiens: data ?? [] };
}

async function toolSearchIncidents(args: any, sb: SbClient) {
  let q = sb.from("incidents").select(
    "id, gravite, description, date_incident, statut, " +
    "salarie:salaries(nom, prenom), livraison:livraisons(num_liv, client_nom)"
  );
  if (args.date_min) q = q.gte("date_incident", args.date_min);
  if (args.date_max) q = q.lte("date_incident", args.date_max);
  if (args.salarie_id) q = q.eq("salarie_id", args.salarie_id);
  if (args.gravite) q = q.eq("gravite", args.gravite);
  if (args.statut) q = q.eq("statut", args.statut);
  q = q.order("date_incident", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, incidents: data ?? [] };
}

async function toolSearchAlertes(args: any, sb: SbClient) {
  let q = sb.from("alertes_admin").select(
    "id, type, niveau, titre, message, contexte, lue, resolved, created_at"
  );
  if (args.niveau) q = q.eq("niveau", args.niveau);
  if (typeof args.lue === "boolean") q = q.eq("lue", args.lue);
  if (typeof args.resolved === "boolean") q = q.eq("resolved", args.resolved);
  q = q.order("created_at", { ascending: false }).limit(RESULT_ROW_CAP);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, alertes: data ?? [] };
}

async function toolGetPlanningSemaine(args: any, sb: SbClient) {
  // Calcule le lundi et dimanche de la semaine cible (ISO : lundi=jour 1)
  const ref = args.date_ref ? new Date(args.date_ref) : new Date();
  const day = ref.getUTCDay() || 7; // dimanche = 7
  const monday = new Date(ref);
  monday.setUTCDate(ref.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const lundi = monday.toISOString().slice(0, 10);
  const dim = sunday.toISOString().slice(0, 10);

  const [planRes, absRes, salRes] = await Promise.all([
    sb.from("plannings_hebdo").select("salarie_id, jour, travaille, type_jour, heure_debut, heure_fin, zone, note").gte("jour", lundi).lte("jour", dim),
    sb.from("absences_periodes").select("salarie_id, type, date_debut, date_fin, heure_debut, heure_fin").lte("date_debut", dim).gte("date_fin", lundi),
    sb.from("salaries").select("id, nom, prenom, poste").eq("actif", true),
  ]);
  if (planRes.error) return { error: "plannings: " + planRes.error.message };
  if (absRes.error) return { error: "absences: " + absRes.error.message };
  if (salRes.error) return { error: "salaries: " + salRes.error.message };

  // Map id -> salarie pour resolution
  const salMap = new Map<string, any>();
  (salRes.data ?? []).forEach((s: any) => salMap.set(s.id, s));

  const enriched = (planRes.data ?? []).map((p: any) => {
    const sal = salMap.get(p.salarie_id);
    const { salarie_id, ...rest } = p;
    return { ...rest, salarie: sal ?? null };
  });

  const absencesEnriched = (absRes.data ?? []).map((a: any) => {
    const sal = salMap.get(a.salarie_id);
    const { salarie_id, ...rest } = a;
    return { ...rest, salarie: sal ?? null };
  });

  return {
    semaine: { lundi, dimanche: dim },
    nb_creneaux: enriched.length,
    creneaux: enriched,
    absences: absencesEnriched,
  };
}

async function toolGetAnomaliesCarburant(args: any, sb: SbClient) {
  const today = todayISO();
  const dateMax = args.date_max ?? today;
  // Defaut : 30 derniers jours
  const d30 = new Date();
  d30.setUTCDate(d30.getUTCDate() - 30);
  const dateMin = args.date_min ?? d30.toISOString().slice(0, 10);

  const [carbRes, vehRes] = await Promise.all([
    sb.from("carburant").select("id, vehicule_id, salarie_id, date_plein, litres, prix_ttc, prix_ht, kilometrage").gte("date_plein", dateMin).lte("date_plein", dateMax).order("date_plein", { ascending: true }),
    sb.from("vehicules").select("id, immat, conso, capacite_reservoir"),
  ]);
  if (carbRes.error) return { error: "carburant: " + carbRes.error.message };
  if (vehRes.error) return { error: "vehicules: " + vehRes.error.message };

  const vehMap = new Map<string, any>();
  (vehRes.data ?? []).forEach((v: any) => vehMap.set(v.id, v));

  const pleins = carbRes.data ?? [];
  const anomalies: any[] = [];

  // Group by vehicule pour calcul conso
  const byVeh = new Map<string, any[]>();
  for (const p of pleins) {
    if (!p.vehicule_id) continue;
    if (!byVeh.has(p.vehicule_id)) byVeh.set(p.vehicule_id, []);
    byVeh.get(p.vehicule_id)!.push(p);
  }

  for (const [vehId, items] of byVeh) {
    const veh = vehMap.get(vehId);
    const immat = veh?.immat ?? "?";
    const consoRef = Number(veh?.conso) || 0;
    const reservoir = Number(veh?.capacite_reservoir) || 0;

    // Sort by date pour calcul conso
    items.sort((a, b) => (a.date_plein || "").localeCompare(b.date_plein || ""));

    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const prev = i > 0 ? items[i - 1] : null;
      const litres = Number(p.litres) || 0;
      const km = Number(p.kilometrage) || 0;
      const prixTtc = Number(p.prix_ttc) || 0;

      // 1. Litres > capacite reservoir ?
      if (reservoir > 0 && litres > reservoir * 1.05) {
        anomalies.push({
          id: p.id, vehicule: immat, date: p.date_plein,
          type: "litres_sup_reservoir",
          detail: `${litres} L declarés mais capacité reservoir ${reservoir} L`,
          severite: "moyen",
        });
      }

      // 2. Conso L/100km hors moyenne (>20% deviation)
      if (prev && consoRef > 0 && km > 0 && prev.kilometrage) {
        const distance = km - Number(prev.kilometrage);
        if (distance > 0) {
          const consoCalc = (litres / distance) * 100;
          const deviation = ((consoCalc - consoRef) / consoRef) * 100;
          if (Math.abs(deviation) > 20) {
            anomalies.push({
              id: p.id, vehicule: immat, date: p.date_plein,
              type: "conso_anormale",
              detail: `Conso calculee ${consoCalc.toFixed(1)} L/100 km vs reference ${consoRef} (${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}%)`,
              severite: Math.abs(deviation) > 40 ? "grave" : "moyen",
            });
          }
        }
      }

      // 3. Pleins rapproches (<24h)
      if (prev && p.date_plein === prev.date_plein) {
        anomalies.push({
          id: p.id, vehicule: immat, date: p.date_plein,
          type: "pleins_meme_jour",
          detail: "2 pleins le meme jour pour ce vehicule",
          severite: "leger",
        });
      }

      // 4. Prix au litre incoherent (<1€ ou >3€)
      if (litres > 0 && prixTtc > 0) {
        const prixL = prixTtc / litres;
        if (prixL < 1 || prixL > 3) {
          anomalies.push({
            id: p.id, vehicule: immat, date: p.date_plein,
            type: "prix_litre_incoherent",
            detail: `Prix unitaire ${prixL.toFixed(2)} €/L (hors plage 1-3 €)`,
            severite: "leger",
          });
        }
      }
    }
  }

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    nb_pleins_analyses: pleins.length,
    nb_anomalies: anomalies.length,
    anomalies: anomalies.slice(0, 30),
  };
}

// ===== Helpers HTTP externes =====

async function fetchSafeJson(url: string, init: RequestInit, timeoutMs = 15000): Promise<any> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { error: `HTTP ${r.status}`, detail: txt.slice(0, 200) };
    }
    return await r.json();
  } catch (e) {
    return { error: String(e).slice(0, 200) };
  }
}

// ===== Qonto =====
const QONTO_BASE = "https://thirdparty.qonto.com/v2";

function qontoAuth(): string {
  const login = Deno.env.get("QONTO_LOGIN") ?? "";
  const secret = Deno.env.get("QONTO_SECRET_KEY") ?? "";
  return `${login}:${secret}`;
}

async function toolQontoOrganization(_args: any, _sb: SbClient) {
  const data = await fetchSafeJson(`${QONTO_BASE}/organization`, {
    headers: { Authorization: qontoAuth() },
  });
  if (data.error) return data;
  const org = data.organization ?? {};
  return {
    name: org.name,
    slug: org.slug,
    legal_name: org.legal_name,
    bank_accounts: (org.bank_accounts ?? []).map((a: any) => ({
      slug: a.slug,
      iban: a.iban,
      currency: a.currency,
      balance: a.balance,
      authorized_balance: a.authorized_balance,
      updated_at: a.updated_at,
    })),
  };
}

async function toolQontoSearchTransactions(args: any, _sb: SbClient) {
  const params = new URLSearchParams({ per_page: "30", current_page: "1" });
  if (args.date_min) params.set("settled_at_from", args.date_min + "T00:00:00.000Z");
  if (args.date_max) params.set("settled_at_to", args.date_max + "T23:59:59.999Z");
  if (args.side) params.set("side", args.side);
  const url = `${QONTO_BASE}/transactions?${params}`;
  const data = await fetchSafeJson(url, { headers: { Authorization: qontoAuth() } });
  if (data.error) return data;
  let txs = (data.transactions ?? []).map((t: any) => ({
    transaction_id: t.transaction_id,
    label: t.label,
    counterparty_name: t.counterparty_name,
    side: t.side,
    amount: t.amount,
    currency: t.currency,
    settled_at: t.settled_at,
    operation_type: t.operation_type,
    status: t.status,
    note: t.note,
  }));
  // Filtrage cote app (l'API Qonto ne supporte pas le search libelle)
  if (args.label_search) {
    const q = String(args.label_search).toLowerCase();
    txs = txs.filter((t: any) =>
      (t.label || "").toLowerCase().includes(q) ||
      (t.counterparty_name || "").toLowerCase().includes(q)
    );
  }
  if (typeof args.min_amount === "number") {
    txs = txs.filter((t: any) => Math.abs(Number(t.amount) || 0) >= args.min_amount);
  }
  return {
    count: txs.length,
    has_more: !!(data.meta?.next_page),
    transactions: txs.slice(0, 30),
  };
}

// ===== Pennylane =====
const PENNYLANE_BASE = "https://app.pennylane.com/api/external/v2";

function pennylaneHeaders() {
  const tok = Deno.env.get("PENNYLANE_TOKEN") ?? "";
  return { Authorization: `Bearer ${tok}`, Accept: "application/json" };
}

async function toolPennylaneFacturesClients(args: any, _sb: SbClient) {
  const params = new URLSearchParams({ per_page: "25" });
  if (args.date_min) params.set("filter[date_gte]", args.date_min);
  if (args.date_max) params.set("filter[date_lte]", args.date_max);
  if (args.paid_only) params.set("filter[status]", "paid");
  if (args.unpaid_only) params.set("filter[status]", "unpaid");
  const url = `${PENNYLANE_BASE}/customer_invoices?${params}`;
  const data = await fetchSafeJson(url, { headers: pennylaneHeaders() });
  if (data.error) return data;
  const items = (data.items ?? data.data ?? []).map((i: any) => ({
    id: i.id,
    invoice_number: i.invoice_number ?? i.attributes?.invoice_number,
    date: i.date ?? i.attributes?.date,
    customer_name: i.customer?.name ?? i.attributes?.customer_name,
    amount: i.amount ?? i.attributes?.amount,
    currency_amount: i.currency_amount ?? i.attributes?.currency_amount,
    paid: i.paid ?? i.attributes?.paid,
    deadline: i.deadline ?? i.attributes?.deadline,
    status: i.status ?? i.attributes?.status,
  }));
  return { count: items.length, has_more: !!data.next_cursor, factures: items };
}

async function toolPennylaneFacturesFournisseurs(args: any, _sb: SbClient) {
  const params = new URLSearchParams({ per_page: "25" });
  if (args.date_min) params.set("filter[date_gte]", args.date_min);
  if (args.date_max) params.set("filter[date_lte]", args.date_max);
  const url = `${PENNYLANE_BASE}/supplier_invoices?${params}`;
  const data = await fetchSafeJson(url, { headers: pennylaneHeaders() });
  if (data.error) return data;
  const items = (data.items ?? data.data ?? []).map((i: any) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    date: i.date,
    supplier_name: i.supplier?.name,
    amount: i.amount,
    currency_amount: i.currency_amount,
    paid: i.paid,
  }));
  return { count: items.length, has_more: !!data.next_cursor, factures: items };
}

async function toolPennylaneSearchClients(args: any, _sb: SbClient) {
  const params = new URLSearchParams({ per_page: "25" });
  if (args.query) params.set("filter[name]", args.query);
  const url = `${PENNYLANE_BASE}/customers?${params}`;
  const data = await fetchSafeJson(url, { headers: pennylaneHeaders() });
  if (data.error) return data;
  const items = (data.items ?? data.data ?? []).map((c: any) => ({
    id: c.id, name: c.name, email: c.email, vat_number: c.vat_number,
    siren: c.siren, country_alpha2: c.country_alpha2, address: c.address,
  }));
  return { count: items.length, clients: items };
}

async function toolPennylaneSearchFournisseurs(args: any, _sb: SbClient) {
  const params = new URLSearchParams({ per_page: "25" });
  if (args.query) params.set("filter[name]", args.query);
  const url = `${PENNYLANE_BASE}/suppliers?${params}`;
  const data = await fetchSafeJson(url, { headers: pennylaneHeaders() });
  if (data.error) return data;
  const items = (data.items ?? data.data ?? []).map((c: any) => ({
    id: c.id, name: c.name, email: c.email, vat_number: c.vat_number,
    siren: c.siren, country_alpha2: c.country_alpha2,
  }));
  return { count: items.length, fournisseurs: items };
}

// ===== OpenRouteService =====
const ORS_BASE = "https://api.openrouteservice.org";

function orsHeaders() {
  const k = Deno.env.get("ORS_API_KEY") ?? "";
  return { Authorization: k, "Content-Type": "application/json" };
}

async function orsGeocode(text: string): Promise<{ coords?: [number, number]; label?: string; error?: string }> {
  const k = Deno.env.get("ORS_API_KEY") ?? "";
  const url = `${ORS_BASE}/geocode/search?api_key=${encodeURIComponent(k)}&size=1&boundary.country=FR&text=${encodeURIComponent(text)}`;
  const data = await fetchSafeJson(url, { method: "GET" });
  if (data.error) return { error: data.error };
  const f = data.features?.[0];
  if (!f) return { error: `Adresse introuvable : "${text}"` };
  return { coords: f.geometry.coordinates as [number, number], label: f.properties?.label };
}

async function toolOrsDistance(args: any, _sb: SbClient) {
  if (!args.depart || !args.arrivee) return { error: "depart et arrivee requis" };
  const profile = args.profile || "driving-hgv";
  const [g1, g2] = await Promise.all([orsGeocode(args.depart), orsGeocode(args.arrivee)]);
  if (g1.error) return { error: `geocode depart : ${g1.error}` };
  if (g2.error) return { error: `geocode arrivee : ${g2.error}` };
  const url = `${ORS_BASE}/v2/directions/${profile}`;
  const data = await fetchSafeJson(url, {
    method: "POST",
    headers: orsHeaders(),
    body: JSON.stringify({ coordinates: [g1.coords, g2.coords], units: "km" }),
  });
  if (data.error) return data;
  const route = data.routes?.[0];
  if (!route) return { error: "Pas de route trouvee" };
  return {
    profile,
    depart_resolu: g1.label,
    arrivee_resolu: g2.label,
    distance_km: Number((route.summary.distance).toFixed(1)),
    duree_minutes: Number((route.summary.duration / 60).toFixed(0)),
    duree_lisible: formatDuree(route.summary.duration),
  };
}

function formatDuree(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

async function toolOrsOptimizeTournee(args: any, _sb: SbClient) {
  if (!args.depart || !Array.isArray(args.arrets) || args.arrets.length === 0) {
    return { error: "depart + arrets[] requis" };
  }
  const retour = args.retour || args.depart;
  const adresses = [args.depart, ...args.arrets, retour];
  const geocoded = await Promise.all(adresses.map((a) => orsGeocode(a)));
  const errs = geocoded.filter((g) => g.error);
  if (errs.length) return { error: "Geocoding echoue : " + errs.map((e) => e.error).join("; ") };

  const startCoord = geocoded[0].coords!;
  const endCoord = geocoded[geocoded.length - 1].coords!;
  const jobs = args.arrets.map((label: string, i: number) => ({
    id: i + 1,
    location: geocoded[i + 1].coords,
    description: label,
  }));

  const data = await fetchSafeJson(`${ORS_BASE}/optimization`, {
    method: "POST",
    headers: orsHeaders(),
    body: JSON.stringify({
      jobs,
      vehicles: [{ id: 1, profile: "driving-hgv", start: startCoord, end: endCoord }],
    }),
  });
  if (data.error) return data;
  const route = data.routes?.[0];
  if (!route) return { error: "Pas de tournee optimisee" };
  const ordered = (route.steps ?? []).filter((s: any) => s.type === "job").map((s: any) => {
    const j = jobs.find((j: any) => j.id === s.job);
    return j?.description;
  });
  return {
    distance_km: Number((route.distance / 1000).toFixed(1)),
    duree_minutes: Math.round(route.duration / 60),
    duree_lisible: formatDuree(route.duration),
    ordre_optimal: [args.depart, ...ordered, retour],
    nb_arrets: jobs.length,
  };
}

// ===== Sentry =====

async function toolSentryRecentIssues(args: any, _sb: SbClient) {
  const tok = Deno.env.get("SENTRY_TOKEN") ?? "";
  const period = args.period || "7d";
  const unresolved = args.unresolved_only !== false;
  const query = unresolved ? "is:unresolved" : "";
  const url = `https://sentry.io/api/0/organizations/mca-logistics/issues/?statsPeriod=${period}&query=${encodeURIComponent(query)}&limit=20`;
  const data = await fetchSafeJson(url, { headers: { Authorization: `Bearer ${tok}` } });
  if (data.error) return data;
  const issues = (Array.isArray(data) ? data : []).map((i: any) => ({
    id: i.id,
    title: i.title,
    culprit: i.culprit,
    level: i.level,
    status: i.status,
    count: i.count,
    user_count: i.userCount,
    last_seen: i.lastSeen,
    project: i.project?.slug,
    permalink: i.permalink,
  }));
  return { period, count: issues.length, issues };
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
  search_paiements: toolSearchPaiements,
  search_inspections: toolSearchInspections,
  search_entretiens: toolSearchEntretiens,
  search_incidents: toolSearchIncidents,
  search_alertes: toolSearchAlertes,
  get_planning_semaine: toolGetPlanningSemaine,
  get_anomalies_carburant: toolGetAnomaliesCarburant,
  // Externes
  qonto_organization: toolQontoOrganization,
  qonto_search_transactions: toolQontoSearchTransactions,
  pennylane_factures_clients: toolPennylaneFacturesClients,
  pennylane_factures_fournisseurs: toolPennylaneFacturesFournisseurs,
  pennylane_search_clients: toolPennylaneSearchClients,
  pennylane_search_fournisseurs: toolPennylaneSearchFournisseurs,
  ors_distance: toolOrsDistance,
  ors_optimize_tournee: toolOrsOptimizeTournee,
  sentry_recent_issues: toolSentryRecentIssues,
  add_memory_fact: toolAddMemoryFact,
  delete_memory_fact: toolDeleteMemoryFact,
  list_memory_facts: toolListMemoryFacts,
};

// ===== Memoire long-terme =====

async function toolAddMemoryFact(args: any, sb: SbClient) {
  const text = String(args.fact_text || "").trim().slice(0, 500);
  if (!text) return { error: "fact_text requis" };
  const cat = args.category && [
    "general", "client", "fournisseur", "salarie", "vehicule",
    "finance", "compta", "preference_user", "pattern",
  ].includes(args.category) ? args.category : "general";
  const imp = Math.max(1, Math.min(5, Number(args.importance) || 3));
  const { data, error } = await sb.from("ai_memory").insert({
    fact_text: text,
    category: cat,
    importance: imp,
    source: "proposed_by_ai",
    validated_at: new Date().toISOString(),
  }).select("id, fact_text, category, importance").single();
  if (error) return { error: error.message };
  return {
    success: true,
    fact: data,
    note: "Fait memorise. Sera injecte automatiquement dans toutes les conversations futures.",
  };
}

async function toolDeleteMemoryFact(args: any, sb: SbClient) {
  if (!args.id) return { error: "id requis" };
  const { data: existing } = await sb.from("ai_memory").select("id, fact_text").eq("id", args.id).maybeSingle();
  if (!existing) return { error: "Fait introuvable (deja supprime ?)" };
  const { error } = await sb.from("ai_memory").delete().eq("id", args.id);
  if (error) return { error: error.message };
  return { success: true, deleted: existing };
}

async function toolListMemoryFacts(args: any, sb: SbClient) {
  let q = sb.from("ai_memory").select("id, fact_text, category, importance, source, created_at");
  if (args.category) q = q.eq("category", args.category);
  q = q.order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, facts: data ?? [] };
}

// ----- Gemini helper -----

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

// Parse "Please retry in 4.36s" et le bloc google.rpc.RetryInfo des erreurs Gemini.
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

// Tronque un resultat de tool si trop gros pour ne pas exploser le contexte Gemini.
// Strategie : si serialisation > MAX_TOOL_RESULT_BYTES, garde count/meta et coupe
// la premiere liste interieure (livraisons, charges, transactions, etc.) jusqu'a tenir.
function trimToolResult(result: unknown): unknown {
  try {
    const json = JSON.stringify(result);
    if (json.length <= MAX_TOOL_RESULT_BYTES) return result;
    if (!result || typeof result !== "object") return { truncated: true, preview: json.slice(0, MAX_TOOL_RESULT_BYTES) };
    const obj = result as Record<string, unknown>;
    // Trouve la premiere cle dont la valeur est un array (la liste de rows)
    const listKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
    if (!listKey) return { truncated: true, preview: json.slice(0, MAX_TOOL_RESULT_BYTES) };
    const list = obj[listKey] as unknown[];
    // Reduit la liste par dichotomie jusqu'a tenir
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
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
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
      // Si HTTP transient (5xx hors 501), retry. 4xx (400/401/403/429) : on ne retry pas, on parse pour remonter.
      if (r.status >= 500 && r.status !== 501 && attempt < GEMINI_MAX_RETRIES) {
        lastErr = { error: { message: `Gemini HTTP ${r.status}`, code: r.status } };
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        continue;
      }
      const json = await r.json().catch(() => null);
      if (!json) {
        // Reponse non-JSON (HTML d'erreur, tronquage). Retry si possible.
        if (attempt < GEMINI_MAX_RETRIES) {
          lastErr = { error: { message: "Gemini reponse non-JSON", code: r.status } };
          await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
          continue;
        }
        return { error: { message: `Gemini reponse non-JSON (HTTP ${r.status})` } } as GeminiResp;
      }
      // 429 court (<= 8s) : auto-retry transparent. Au-dela : remonte au frontend
      // qui affiche un countdown et retry sans casser l'UX (vs. erreur).
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
      // Retry sur abort/timeout/network
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
    const rawHistory: any[] = Array.isArray(body.history) ? body.history : [];

    // Defense-in-depth : meme sanitize que le frontend, au cas ou un client
    // malforme/ancien envoie un history avec turns vides ou consecutifs meme
    // role (Gemini renvoie alors un candidate vide -> UX "doit envoyer
    // plusieurs fois"). Garde uniquement role user|model + parts texte non-vide,
    // collapse les turns consecutifs de meme role, et coupe les messages model
    // de tete (Gemini exige que le 1er message soit role user).
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

    // Service-role client pour les tools (RLS bypass) et le quota
    const sbAdmin = createClient(SUPABASE_URL, SERVICE);

    // Quota -> choix modele
    const quota = await getQuota(sbAdmin);
    let usePro = quota.requests_pro < PRO_DAILY_QUOTA;
    let model = usePro ? "gemini-2.5-pro" : "gemini-2.5-flash";

    // Memoire long-terme : injectee dans le system prompt a chaque conversation.
    // Tri par importance DESC, limite raisonnable pour ne pas exploser le contexte.
    const { data: memData } = await sbAdmin
      .from("ai_memory")
      .select("id, fact_text, category, importance")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);
    const memoryFacts = memData ?? [];

    const systemInstruction = buildSystemPrompt(role, memoryFacts);
    let working = [...history];
    let finalText = "";
    let toolCallsMade: string[] = [];
    const memoryOps: any[] = [];
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
        // Si Gemini a ete coupe (SAFETY/MAX_TOKENS/RECITATION/OTHER) sans texte,
        // remonte un message lisible plutot qu'une chaine vide silencieuse.
        if (!finalText) {
          if (finishReason === "SAFETY" || finishReason === "RECITATION") {
            finalText = "Reponse bloquee par les filtres de securite Gemini. Reformule ta question.";
          } else if (finishReason === "MAX_TOKENS") {
            finalText = "Reponse tronquee (limite de tokens). Pose une question plus precise.";
          } else if (!cand) {
            // Aucun candidat : Gemini a probablement bloque entierement la requete.
            finalText = "Gemini n'a renvoye aucune reponse. Reessaye dans quelques secondes ou efface la conversation.";
          } else {
            finalText = "Reponse vide de Gemini. Reformule ta question ou efface la conversation.";
          }
        }
        break;
      }

      // Push le model turn complet (texte + functionCalls) pour preserver le
      // chain-of-thought de Gemini. Si on perd le texte, le model peut perdre
      // le fil sur les longues conversations multi-tools.
      const modelParts: any[] = [];
      for (const t of texts) modelParts.push({ text: t });
      for (const c of fnCalls) modelParts.push({ functionCall: c });
      working.push({ role: "model", parts: modelParts });

      const results = await Promise.all(
        fnCalls.map(async (call) => {
          toolCallsMade.push(call.name);
          const handler = TOOL_HANDLERS[call.name];
          if (!handler) return { error: `unknown tool: ${call.name}` };
          try {
            const r = await handler(call.args ?? {}, sbAdmin);
            // Track memory ops pour les exposer a l'UI (cards delete-able / annonces).
            if (call.name === "add_memory_fact" && (r as any)?.success && (r as any)?.fact) {
              memoryOps.push({ type: "added", fact: (r as any).fact });
            } else if (call.name === "delete_memory_fact" && (r as any)?.success) {
              memoryOps.push({ type: "deleted", id: call.args?.id, deleted: (r as any)?.deleted });
            }
            return r;
          } catch (e) {
            return { error: String(e).slice(0, 200) };
          }
        })
      );

      // Gemini v1beta : functionResponse vit dans un message role "user" (pas "function").
      // Mettre "function" fait silencieusement renvoyer un candidat vide -> finalText vide
      // -> "boucle d'outils trop longue" cote utilisateur.
      working.push({
        role: "user",
        parts: fnCalls.map((c, i) => ({ functionResponse: { name: c.name, response: trimToolResult(results[i]) } })),
      });
    }

    if (!finalText) {
      finalText = `Je n'ai pas pu produire de reponse apres ${MAX_TOOL_ITERATIONS} iterations d'outils. ` +
        `Outils appeles : ${toolCallsMade.join(", ") || "aucun"}. Reformule plus precisement.`;
    }

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
        memory_ops: memoryOps,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
