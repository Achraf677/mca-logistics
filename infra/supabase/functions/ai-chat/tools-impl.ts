// Implementations des tools du chatbot ai-chat (lecture seule + propose_*).
// Module extrait de index.ts pour reduire la taille de l'edge function principale.

import { createClient } from "jsr:@supabase/supabase-js@2";

export type SbClient = ReturnType<typeof createClient>;

// Constantes utilisees par les implementations
const RESULT_ROW_CAP = 15;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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

async function toolTopClientsCa(args: any, sb: SbClient) {
  const today = todayISO();
  const dateMax = args.date_max ?? today;
  const dateMin = args.date_min ?? today.slice(0, 7) + "-01";
  const limit = Math.max(1, Math.min(20, Number(args.limit) || 5));

  const { data, error } = await sb.from("livraisons")
    .select("client_nom, prix_ht, prix_ttc")
    .gte("date_livraison", dateMin)
    .lte("date_livraison", dateMax);
  if (error) return { error: error.message };

  const agg = new Map<string, { client_nom: string; ca_ht: number; ca_ttc: number; nb_livraisons: number }>();
  for (const row of data ?? []) {
    const nom = (row as any).client_nom || "(sans nom)";
    const cur = agg.get(nom) ?? { client_nom: nom, ca_ht: 0, ca_ttc: 0, nb_livraisons: 0 };
    cur.ca_ht += Number((row as any).prix_ht) || 0;
    cur.ca_ttc += Number((row as any).prix_ttc) || 0;
    cur.nb_livraisons += 1;
    agg.set(nom, cur);
  }
  const top = Array.from(agg.values())
    .map((c) => ({
      client_nom: c.client_nom,
      ca_ht: Number(c.ca_ht.toFixed(2)),
      ca_ttc: Number(c.ca_ttc.toFixed(2)),
      nb_livraisons: c.nb_livraisons,
    }))
    .sort((a, b) => b.ca_ht - a.ca_ht)
    .slice(0, limit);

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    count: top.length,
    top,
  };
}

async function toolLivraisonsImpayeesRetard(args: any, sb: SbClient) {
  const minRetard = Number(args.min_jours_retard) || 1;
  const today = todayISO();
  const todayMs = Date.parse(today + "T00:00:00Z");

  let q = sb.from("livraisons").select(
    "num_liv, client_id, client_nom, date_livraison, prix_ttc, statut_paiement"
  );
  // Non paye/partiel : a_payer ou en_retard
  q = q.in("statut_paiement", ["a_payer", "en_retard"]);
  if (args.client_nom) q = q.ilike("client_nom", `%${args.client_nom}%`);
  q = q.order("date_livraison", { ascending: true }).limit(200);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = data ?? [];

  // Recupere les delai_paiement_jours par client_id (si dispo)
  const ids = Array.from(new Set(rows.map((r: any) => r.client_id).filter(Boolean)));
  let delaiMap = new Map<string, number>();
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
      statut_paiement: r.statut_paiement,
      delai_paiement_jours: delai,
      jours_retard: joursRetard,
    };
  }).filter((r: any) => r.jours_retard >= minRetard);

  enriched.sort((a, b) => b.jours_retard - a.jours_retard);

  return {
    count: enriched.length,
    livraisons: enriched.slice(0, 25),
  };
}

async function toolVehiculesEcheancesProches(args: any, sb: SbClient) {
  const dans = Number(args.dans_n_jours) || 30;
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
          type_alerte: type,
          date_echeance: date,
          jours_restants: joursRestants,
        });
      }
    }
  }
  alertes.sort((a, b) => a.jours_restants - b.jours_restants);
  return {
    count: alertes.length,
    alertes: alertes.slice(0, 30),
  };
}

async function toolInspectionsNonValidees(args: any, sb: SbClient) {
  let q = sb.from("inspections").select(
    "id, date_inspection, semaine_label, commentaire, statut, " +
    "salarie:salaries(nom, prenom), vehicule:vehicules(immat)"
  ).eq("statut", "soumise");
  if (args.date_min) q = q.gte("date_inspection", args.date_min);
  if (args.salarie_id) q = q.eq("salarie_id", args.salarie_id);
  q = q.order("date_inspection", { ascending: false }).limit(25);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return {
    count: data?.length ?? 0,
    inspections: (data ?? []).map((i: any) => ({
      salarie: i.salarie,
      vehicule: i.vehicule,
      date_inspection: i.date_inspection,
      semaine_label: i.semaine_label,
      commentaire: i.commentaire,
    })),
  };
}

async function toolRentabiliteTournee(args: any, sb: SbClient) {
  const today = todayISO();
  const dateMax = args.date_max ?? today;
  const dateMin = args.date_min ?? today.slice(0, 7) + "-01";

  // Step 1: salaries
  let salQ = sb.from("salaries").select("id, nom, prenom").eq("actif", true);
  if (args.salarie_id) salQ = salQ.eq("id", args.salarie_id);
  const { data: sals, error: salErr } = await salQ;
  if (salErr) return { error: "salaries: " + salErr.message };

  // Step 2: vehicules pour rattachement vehicule -> salarie
  const { data: vehs, error: vehErr } = await sb.from("vehicules").select("id, salarie_id");
  if (vehErr) return { error: "vehicules: " + vehErr.message };
  const vehBySal = new Map<string, string[]>();
  for (const v of vehs ?? []) {
    const sid = (v as any).salarie_id;
    if (!sid) continue;
    if (!vehBySal.has(sid)) vehBySal.set(sid, []);
    vehBySal.get(sid)!.push((v as any).id);
  }

  // Step 3: livraisons + carburant + charges sur la periode
  let livQ = sb.from("livraisons").select("salarie_id, prix_ht, distance_km")
    .gte("date_livraison", dateMin).lte("date_livraison", dateMax);
  if (args.salarie_id) livQ = livQ.eq("salarie_id", args.salarie_id);
  const { data: liv, error: livErr } = await livQ;
  if (livErr) return { error: "livraisons: " + livErr.message };

  let carbQ = sb.from("carburant").select("salarie_id, prix_ht, prix_ttc")
    .gte("date_plein", dateMin).lte("date_plein", dateMax);
  if (args.salarie_id) carbQ = carbQ.eq("salarie_id", args.salarie_id);
  const { data: carb, error: carbErr } = await carbQ;
  if (carbErr) return { error: "carburant: " + carbErr.message };

  const { data: chgs, error: chgErr } = await sb.from("charges")
    .select("vehicule_id, montant_ht")
    .gte("date_charge", dateMin).lte("date_charge", dateMax)
    .not("vehicule_id", "is", null);
  if (chgErr) return { error: "charges: " + chgErr.message };

  // Step 4: agregat par salarie
  const result = (sals ?? []).map((s: any) => {
    const sid = s.id;
    const sLiv = (liv ?? []).filter((l: any) => l.salarie_id === sid);
    const ca_ht = sLiv.reduce((acc, l: any) => acc + (Number(l.prix_ht) || 0), 0);
    const km_total = sLiv.reduce((acc, l: any) => acc + (Number(l.distance_km) || 0), 0);

    const sCarb = (carb ?? []).filter((c: any) => c.salarie_id === sid);
    const carb_ht = sCarb.reduce((acc, c: any) => acc + (Number(c.prix_ht) || 0), 0);

    const vehIds = new Set(vehBySal.get(sid) ?? []);
    const sChg = (chgs ?? []).filter((c: any) => c.vehicule_id && vehIds.has(c.vehicule_id));
    const charges_veh_ht = sChg.reduce((acc, c: any) => acc + (Number(c.montant_ht) || 0), 0);

    const charges_carburant_ht = Number(carb_ht.toFixed(2));
    const total_charges = charges_carburant_ht + Number(charges_veh_ht.toFixed(2));
    const marge_brute_ht = ca_ht - total_charges;
    const eur_par_km = km_total > 0 ? (ca_ht - total_charges) / km_total : 0;

    return {
      salarie: { nom: s.nom, prenom: s.prenom },
      ca_ht: Number(ca_ht.toFixed(2)),
      charges_carburant_ht,
      charges_vehicule_ht: Number(charges_veh_ht.toFixed(2)),
      marge_brute_ht: Number(marge_brute_ht.toFixed(2)),
      nb_livraisons: sLiv.length,
      km_total: Number(km_total.toFixed(1)),
      eur_par_km: Number(eur_par_km.toFixed(2)),
    };
  }).filter((r: any) => r.nb_livraisons > 0 || r.charges_carburant_ht > 0 || r.charges_vehicule_ht > 0);

  result.sort((a, b) => b.marge_brute_ht - a.marge_brute_ht);

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    count: result.length,
    rentabilite: result.slice(0, 20),
  };
}

async function toolMatchFacturesPennylaneMca(args: any, sb: SbClient) {
  // Periode : par defaut, mois precedent
  let mois = String(args.mois || "").trim();
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    mois = d.toISOString().slice(0, 7);
  }
  const dateMin = mois + "-01";
  // Dernier jour du mois
  const [yr, mo] = mois.split("-").map(Number);
  const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
  const dateMax = `${mois}-${String(lastDay).padStart(2, "0")}`;

  // Fenetre elargie cote MCA pour matching ±5j hors periode
  const win = 5 * 86400000;
  const mcaMin = new Date(Date.parse(dateMin + "T00:00:00Z") - win).toISOString().slice(0, 10);
  const mcaMax = new Date(Date.parse(dateMax + "T00:00:00Z") + win).toISOString().slice(0, 10);

  // 1. Pennylane factures clients
  const params = new URLSearchParams({ per_page: "100" });
  params.set("filter[date_gte]", dateMin);
  params.set("filter[date_lte]", dateMax);
  const url = `${PENNYLANE_BASE}/customer_invoices?${params}`;
  const pData = await fetchSafeJson(url, { headers: pennylaneHeaders() });
  if (pData.error) return { error: "pennylane: " + (pData.error as string) };
  const factures = (pData.items ?? pData.data ?? []).map((i: any) => ({
    id: i.id,
    invoice_number: i.invoice_number ?? i.attributes?.invoice_number,
    date: i.date ?? i.attributes?.date,
    customer_name: (i.customer?.name ?? i.attributes?.customer_name ?? "").toString(),
    amount: Number(i.amount ?? i.attributes?.amount) || 0,
  }));

  // 2. Livraisons MCA sur fenetre elargie
  const { data: livRaw, error: livErr } = await sb.from("livraisons")
    .select("num_liv, client_nom, date_livraison, prix_ttc")
    .gte("date_livraison", mcaMin)
    .lte("date_livraison", mcaMax);
  if (livErr) return { error: "livraisons: " + livErr.message };
  const livraisons = (livRaw ?? []).map((l: any) => ({
    num_liv: l.num_liv,
    client_nom: (l.client_nom || "").toString(),
    date_livraison: l.date_livraison,
    prix_ttc: Number(l.prix_ttc) || 0,
  }));

  // 3. Matching deterministe
  const usedLiv = new Set<string>();
  const matches: any[] = [];

  for (const f of factures) {
    let best: { liv: any; score: number; raison: string } | null = null;
    const fDateMs = f.date ? Date.parse(f.date + "T00:00:00Z") : NaN;
    const fNameLow = f.customer_name.toLowerCase();

    for (const l of livraisons) {
      if (usedLiv.has(l.num_liv)) continue;
      const amountDiff = Math.abs((Number(l.prix_ttc) || 0) - (Number(f.amount) || 0));
      if (amountDiff > 0.5) continue;
      const lDateMs = Date.parse(l.date_livraison + "T00:00:00Z");
      if (Number.isNaN(fDateMs) || Number.isNaN(lDateMs)) continue;
      const dateDiffJ = Math.abs((fDateMs - lDateMs) / 86400000);
      if (dateDiffJ > 5) continue;
      const lNameLow = l.client_nom.toLowerCase();
      const nameMatch = !!fNameLow && !!lNameLow && (
        fNameLow.includes(lNameLow) || lNameLow.includes(fNameLow)
      );

      // Score : amount (0.5) + date (0.3) + name (0.2)
      const amountScore = 1 - Math.min(1, amountDiff / 0.5);
      const dateScore = 1 - dateDiffJ / 5;
      const nameScore = nameMatch ? 1 : 0;
      const score = 0.5 * amountScore + 0.3 * dateScore + 0.2 * nameScore;

      if (!best || score > best.score) {
        const raisons: string[] = [];
        raisons.push(`montant ±${amountDiff.toFixed(2)}€`);
        raisons.push(`date ±${dateDiffJ.toFixed(0)}j`);
        if (nameMatch) raisons.push("client similar");
        else raisons.push("client divergent");
        best = { liv: l, score: Number(score.toFixed(2)), raison: raisons.join(", ") };
      }
    }

    if (best) {
      usedLiv.add(best.liv.num_liv);
      matches.push({
        pennylane_invoice_id: f.id,
        pennylane_invoice_number: f.invoice_number,
        mca_livraison_num_liv: best.liv.num_liv,
        score: best.score,
        raison: best.raison,
      });
    }
  }

  const matchedFactureIds = new Set(matches.map((m) => m.pennylane_invoice_id));
  const orphelinesPennylane = factures
    .filter((f: any) => !matchedFactureIds.has(f.id))
    .slice(0, 30)
    .map((f: any) => ({
      pennylane_invoice_id: f.id,
      invoice_number: f.invoice_number,
      date: f.date,
      customer_name: f.customer_name,
      amount: f.amount,
    }));

  const matchedLivNums = new Set(matches.map((m) => m.mca_livraison_num_liv));
  // Orphelines MCA : livraisons dans la periode stricte non matchees
  const orphelinesMca = livraisons
    .filter((l: any) =>
      l.date_livraison >= dateMin && l.date_livraison <= dateMax && !matchedLivNums.has(l.num_liv)
    )
    .slice(0, 30)
    .map((l: any) => ({
      num_liv: l.num_liv,
      client_nom: l.client_nom,
      date_livraison: l.date_livraison,
      prix_ttc: l.prix_ttc,
    }));

  return {
    periode: { mois, date_min: dateMin, date_max: dateMax },
    factures_pennylane: factures.length,
    livraisons_mca: livraisons.filter((l: any) => l.date_livraison >= dateMin && l.date_livraison <= dateMax).length,
    matches: matches.slice(0, 30),
    orphelines_pennylane: orphelinesPennylane,
    orphelines_mca: orphelinesMca,
  };
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

// ===== Audit / Detective / Detail granulaire =====

async function toolAuditCoherenceDonnees(_args: any, sb: SbClient) {
  const today = todayISO();

  // Lance toutes les queries en parallele pour minimiser la latence.
  const [
    livreesSansDate,
    chargesSansFourn,
    inspValidees,
    vehCtExpire,
    vehAssExpire,
    salariesSansPermis,
    livForTva,
    planningsOrphelinsRaw,
    salariesAll,
  ] = await Promise.all([
    sb.from("livraisons").select("id, num_liv, client_nom, date_livraison").eq("statut", "livree").is("date_livraison", null).limit(50),
    sb.from("charges").select("id, categorie, description, date_charge, montant_ttc").is("fournisseur_nom", null).is("fournisseur_id", null).limit(50),
    sb.from("inspections").select("id, date_inspection, semaine_label, created_at, updated_at").eq("statut", "validee").limit(200),
    sb.from("vehicules").select("id, immat, marque, modele, date_ct").not("date_ct", "is", null).lt("date_ct", today).limit(50),
    sb.from("vehicules").select("id, immat, marque, modele, date_assurance").not("date_assurance", "is", null).lt("date_assurance", today).limit(50),
    sb.from("salaries").select("id, nom, prenom, poste").eq("actif", true).is("categorie_permis", null).limit(50),
    sb.from("livraisons").select("id, num_liv, prix_ht, prix_ttc, taux_tva, date_livraison").not("prix_ht", "is", null).not("prix_ttc", "is", null).not("taux_tva", "is", null).order("date_livraison", { ascending: false }).limit(500),
    sb.from("plannings_hebdo").select("id, salarie_id, jour").limit(500),
    sb.from("salaries").select("id"),
  ]);

  const items: any[] = [];

  // 1. Livraisons livrees sans date_livraison -> critique
  if (!livreesSansDate.error) {
    const rows = livreesSansDate.data ?? [];
    if (rows.length > 0) {
      items.push({
        categorie: "livraisons_livrees_sans_date",
        severite: "critique",
        description: "Livraisons avec statut='livree' mais date_livraison NULL",
        count: rows.length,
        exemples: rows.slice(0, 3).map((r: any) => ({ id: r.id, label: `${r.num_liv ?? "?"} - ${r.client_nom ?? "?"}` })),
      });
    }
  }

  // 2. Charges sans fournisseur -> moyen
  if (!chargesSansFourn.error) {
    const rows = chargesSansFourn.data ?? [];
    if (rows.length > 0) {
      items.push({
        categorie: "charges_sans_fournisseur",
        severite: "moyen",
        description: "Charges sans fournisseur_nom ni fournisseur_id (rapprochement compta impossible)",
        count: rows.length,
        exemples: rows.slice(0, 3).map((r: any) => ({ id: r.id, label: `${r.categorie ?? "?"} ${r.date_charge ?? ""} ${Number(r.montant_ttc) || 0}€` })),
      });
    }
  }

  // 3. Inspections validees jamais modifiees (updated_at <= created_at) -> moyen
  if (!inspValidees.error) {
    const suspect = (inspValidees.data ?? []).filter((i: any) => {
      if (!i.created_at || !i.updated_at) return true;
      return Date.parse(i.updated_at) <= Date.parse(i.created_at);
    });
    if (suspect.length > 0) {
      items.push({
        categorie: "inspections_validees_jamais_modifiees",
        severite: "moyen",
        description: "Inspections statut='validee' mais updated_at <= created_at (validation suspecte)",
        count: suspect.length,
        exemples: suspect.slice(0, 3).map((i: any) => ({ id: i.id, label: `${i.semaine_label ?? i.date_inspection ?? "?"}` })),
      });
    }
  }

  // 4. Vehicules CT expire -> critique
  if (!vehCtExpire.error) {
    const rows = vehCtExpire.data ?? [];
    if (rows.length > 0) {
      items.push({
        categorie: "vehicules_ct_expire",
        severite: "critique",
        description: "Vehicules avec date_ct deja depassee (controle technique perime)",
        count: rows.length,
        exemples: rows.slice(0, 3).map((v: any) => ({ id: v.id, label: `${v.immat ?? "?"} CT ${v.date_ct}` })),
      });
    }
  }

  // 5. Vehicules assurance expiree -> critique
  if (!vehAssExpire.error) {
    const rows = vehAssExpire.data ?? [];
    if (rows.length > 0) {
      items.push({
        categorie: "vehicules_assurance_expiree",
        severite: "critique",
        description: "Vehicules avec date_assurance deja depassee",
        count: rows.length,
        exemples: rows.slice(0, 3).map((v: any) => ({ id: v.id, label: `${v.immat ?? "?"} assurance ${v.date_assurance}` })),
      });
    }
  }

  // 6. Salaries actifs sans categorie_permis -> moyen
  if (!salariesSansPermis.error) {
    const rows = salariesSansPermis.data ?? [];
    if (rows.length > 0) {
      items.push({
        categorie: "salaries_sans_categorie_permis",
        severite: "moyen",
        description: "Salaries actifs sans categorie_permis renseignee",
        count: rows.length,
        exemples: rows.slice(0, 3).map((s: any) => ({ id: s.id, label: `${s.prenom ?? ""} ${s.nom ?? ""} (${s.poste ?? "?"})`.trim() })),
      });
    }
  }

  // 7. Livraisons : TVA mal calculee
  if (!livForTva.error) {
    const suspect = (livForTva.data ?? []).filter((l: any) => {
      const ht = Number(l.prix_ht) || 0;
      const ttc = Number(l.prix_ttc) || 0;
      const tva = Number(l.taux_tva);
      if (!ht || !ttc || !Number.isFinite(tva)) return false;
      const expected = ht * (1 + tva / 100);
      return Math.abs(ttc - expected) > 0.10;
    });
    if (suspect.length > 0) {
      items.push({
        categorie: "tva_mal_calculee",
        severite: "moyen",
        description: "Livraisons ou |prix_ttc - prix_ht * (1 + taux_tva/100)| > 0.10€",
        count: suspect.length,
        exemples: suspect.slice(0, 3).map((l: any) => ({
          id: l.id,
          label: `${l.num_liv ?? "?"} HT=${Number(l.prix_ht).toFixed(2)} TTC=${Number(l.prix_ttc).toFixed(2)} TVA=${l.taux_tva}%`,
        })),
      });
    }
  }

  // 8. Plannings orphelins (salarie_id n'existe plus) -> leger
  if (!planningsOrphelinsRaw.error && !salariesAll.error) {
    const validIds = new Set((salariesAll.data ?? []).map((s: any) => s.id));
    const orph = (planningsOrphelinsRaw.data ?? []).filter((p: any) => p.salarie_id && !validIds.has(p.salarie_id));
    if (orph.length > 0) {
      items.push({
        categorie: "plannings_salarie_orphelin",
        severite: "leger",
        description: "Plannings dont salarie_id ne correspond plus a aucun salarie en DB",
        count: orph.length,
        exemples: orph.slice(0, 3).map((p: any) => ({ id: p.id, label: `jour=${p.jour ?? "?"} salarie_id=${p.salarie_id}` })),
      });
    }
  }

  // Tri par severite : critique > moyen > leger
  const sevOrder: Record<string, number> = { critique: 0, moyen: 1, leger: 2 };
  items.sort((a, b) => (sevOrder[a.severite] ?? 9) - (sevOrder[b.severite] ?? 9));

  const par_severite = { critique: 0, moyen: 0, leger: 0 } as Record<string, number>;
  for (const it of items) {
    par_severite[it.severite] = (par_severite[it.severite] ?? 0) + (Number(it.count) || 0);
  }

  return {
    nb_total: items.reduce((acc, it) => acc + (Number(it.count) || 0), 0),
    par_severite,
    items: items.slice(0, 30),
  };
}

async function toolGetAuditLog(args: any, sb: SbClient) {
  let q = sb.from("audit_log_entries").select(
    "id, table_name, operation, row_id, actor_role, created_at, diff"
  );
  if (args.table_name) q = q.eq("table_name", args.table_name);
  if (args.operation) q = q.eq("operation", args.operation);
  if (args.actor_role) q = q.eq("actor_role", args.actor_role);
  if (args.row_id) q = q.eq("row_id", args.row_id);
  if (args.date_min) q = q.gte("created_at", args.date_min);
  if (args.date_max) q = q.lte("created_at", args.date_max + "T23:59:59.999Z");
  q = q.order("created_at", { ascending: false }).limit(25);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const entries = (data ?? []).map((e: any) => {
    let summary = "";
    try {
      if (e.diff && typeof e.diff === "object") {
        summary = Object.keys(e.diff).slice(0, 5).join(", ");
      }
    } catch (_) { /* ignore */ }
    return {
      id: e.id,
      table_name: e.table_name,
      operation: e.operation,
      row_id: e.row_id,
      actor_role: e.actor_role,
      created_at: e.created_at,
      diff_summary: summary || "(empty)",
    };
  });
  return { count: entries.length, entries };
}

async function toolGetLivraisonDetail(args: any, sb: SbClient) {
  if (!args.id && !args.num_liv) return { error: "id ou num_liv requis" };
  let q = sb.from("livraisons").select(
    "id, num_liv, client_id, client_nom, date_livraison, distance_km, prix_ht, prix_ttc, taux_tva, tva_montant, statut, statut_paiement, depart, arrivee, zone, notes, kilometrage_compteur, date_paiement, created_at, updated_at, " +
    "salarie:salaries(id, nom, prenom), vehicule:vehicules(id, immat, marque, modele)"
  );
  if (args.id) q = q.eq("id", args.id);
  else q = q.eq("num_liv", args.num_liv);
  const { data: liv, error } = await q.maybeSingle();
  if (error) return { error: error.message };
  if (!liv) return { error: "Livraison introuvable" };

  const livId = (liv as any).id;

  const [paiementsRes, incidentsRes] = await Promise.all([
    sb.from("paiements").select("id, date_paiement, montant, mode, reference, frais, notes").eq("livraison_id", livId).order("date_paiement", { ascending: false }),
    sb.from("incidents").select("id, gravite, description, date_incident, statut, salarie:salaries(nom, prenom)").eq("livraison_id", livId).order("date_incident", { ascending: false }),
  ]);

  return {
    livraison: liv,
    paiements: paiementsRes.error ? { error: paiementsRes.error.message } : (paiementsRes.data ?? []),
    nb_paiements: paiementsRes.data?.length ?? 0,
    incidents: incidentsRes.error ? { error: incidentsRes.error.message } : (incidentsRes.data ?? []),
    nb_incidents: incidentsRes.data?.length ?? 0,
  };
}

async function toolGetVehiculeHistorique(args: any, sb: SbClient) {
  if (!args.id && !args.immat) return { error: "id ou immat requis" };
  let q = sb.from("vehicules").select(
    "id, immat, marque, modele, kilometrage, date_ct, date_assurance, date_carte_grise, carburant, capacite_reservoir, conso, " +
    "salarie:salaries(id, nom, prenom)"
  );
  if (args.id) q = q.eq("id", args.id);
  else q = q.eq("immat", args.immat);
  const { data: veh, error } = await q.maybeSingle();
  if (error) return { error: error.message };
  if (!veh) return { error: "Vehicule introuvable" };

  const vehId = (veh as any).id;

  // Fenetre 12 mois pour les totaux
  const d12 = new Date();
  d12.setUTCMonth(d12.getUTCMonth() - 12);
  const dateMin12 = d12.toISOString().slice(0, 10);
  const today = todayISO();

  const [entRes, inspRes, carbRes, chgRes, livRes, totalsCarbRes, totalsChgRes, totalsLivRes] = await Promise.all([
    sb.from("entretiens").select("id, date_entretien, type, description, cout_ttc, kilometrage").eq("vehicule_id", vehId).order("date_entretien", { ascending: false }).limit(10),
    sb.from("inspections").select("id, date_inspection, semaine_label, statut, salarie:salaries(nom, prenom)").eq("vehicule_id", vehId).order("date_inspection", { ascending: false }).limit(10),
    sb.from("carburant").select("id, date_plein, litres, prix_ttc, kilometrage, salarie:salaries(nom, prenom)").eq("vehicule_id", vehId).order("date_plein", { ascending: false }).limit(10),
    sb.from("charges").select("id, date_charge, categorie, description, montant_ttc, fournisseur_nom").eq("vehicule_id", vehId).order("date_charge", { ascending: false }).limit(10),
    sb.from("livraisons").select("id, num_liv, date_livraison, client_nom, distance_km, prix_ttc, statut").eq("vehicule_id", vehId).order("date_livraison", { ascending: false }).limit(5),
    sb.from("carburant").select("litres, prix_ttc").eq("vehicule_id", vehId).gte("date_plein", dateMin12).lte("date_plein", today),
    sb.from("charges").select("montant_ttc").eq("vehicule_id", vehId).gte("date_charge", dateMin12).lte("date_charge", today),
    sb.from("livraisons").select("distance_km").eq("vehicule_id", vehId).gte("date_livraison", dateMin12).lte("date_livraison", today),
  ]);

  const sum = (arr: any[] | null | undefined, key: string) =>
    (arr ?? []).reduce((acc, r: any) => acc + (Number(r[key]) || 0), 0);

  return {
    vehicule: veh,
    derniers_entretiens: entRes.error ? { error: entRes.error.message } : (entRes.data ?? []),
    dernieres_inspections: inspRes.error ? { error: inspRes.error.message } : (inspRes.data ?? []),
    derniers_pleins_carburant: carbRes.error ? { error: carbRes.error.message } : (carbRes.data ?? []),
    dernieres_charges: chgRes.error ? { error: chgRes.error.message } : (chgRes.data ?? []),
    dernieres_livraisons: livRes.error ? { error: livRes.error.message } : (livRes.data ?? []),
    totaux_12_mois: {
      periode: { date_min: dateMin12, date_max: today },
      km_total: Number(sum(totalsLivRes.data, "distance_km").toFixed(1)),
      carburant_litres: Number(sum(totalsCarbRes.data, "litres").toFixed(2)),
      carburant_ttc: Number(sum(totalsCarbRes.data, "prix_ttc").toFixed(2)),
      charges_ttc: Number(sum(totalsChgRes.data, "montant_ttc").toFixed(2)),
    },
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
  if (!Array.isArray(args.arrets) || args.arrets.length > 50) {
    return { error: "arrets[] doit contenir 1-50 adresses (TSP exponentiel au-dela)" };
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

// ===== V2 ECRITURE : tools propose_* (lecture seule cote AI, retournent une proposition) =====
//
// Ces tools NE creent / NE modifient JAMAIS de donnees. Ils preparent uniquement un
// payload + une description que le frontend affiche dans une carte de confirmation.
// L'admin doit cliquer "Confirmer" pour declencher l'edge function ai-chat-write-execute.
// La cle "write_actions" dans le retour est repere par l'edge function principale et
// remontee au frontend dans la reponse JSON finale.

async function resolveSalarieByName(sb: SbClient, name: string): Promise<{ id: string; nom: string; prenom: string } | null> {
  const q = String(name || "").trim();
  if (!q) return null;
  const { data } = await sb.from("salaries")
    .select("id, nom, prenom")
    .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%`)
    .eq("actif", true)
    .limit(2);
  if (!data || data.length === 0) return null;
  // Si plusieurs matchs, on prefere ne pas forcer (ambigu) : retourne null pour
  // que la proposition reste sans salarie_id (UX : l'admin verra le warning).
  if (data.length > 1) return null;
  return data[0] as any;
}

async function resolveVehiculeByImmat(sb: SbClient, immat: string): Promise<{ id: string; immat: string; marque: string | null; modele: string | null } | null> {
  const q = String(immat || "").trim();
  if (!q) return null;
  const { data } = await sb.from("vehicules")
    .select("id, immat, marque, modele")
    .ilike("immat", `%${q}%`)
    .limit(2);
  if (!data || data.length === 0) return null;
  if (data.length > 1) return null;
  return data[0] as any;
}

async function toolProposeLivraison(args: any, sb: SbClient) {
  const errors: string[] = [];
  const client_nom = String(args.client_nom || "").trim();
  const date_livraison = String(args.date_livraison || "").trim();
  const prix_ht = Number(args.prix_ht);
  if (!client_nom) errors.push("client_nom manquant");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_livraison)) errors.push("date_livraison doit etre YYYY-MM-DD");
  if (!Number.isFinite(prix_ht) || prix_ht < 0) errors.push("prix_ht invalide");
  if (errors.length) return { error: errors.join("; ") };

  const taux_tva = Number.isFinite(Number(args.taux_tva)) ? Number(args.taux_tva) : 20;
  const distance_km = Number.isFinite(Number(args.distance_km)) ? Number(args.distance_km) : null;
  const prix_ttc = Number((prix_ht * (1 + taux_tva / 100)).toFixed(2));
  const tva_montant = Number((prix_ttc - prix_ht).toFixed(2));

  // Resolution salarie/vehicule (best-effort, n'echoue pas si introuvable)
  let salarie_id: string | null = null;
  let salarie_label: string | null = null;
  if (args.salarie_nom) {
    const s = await resolveSalarieByName(sb, args.salarie_nom);
    if (s) {
      salarie_id = s.id;
      salarie_label = `${s.prenom ?? ""} ${s.nom ?? ""}`.trim();
    }
  }
  let vehicule_id: string | null = null;
  let vehicule_label: string | null = null;
  if (args.vehicule_immat) {
    const v = await resolveVehiculeByImmat(sb, args.vehicule_immat);
    if (v) {
      vehicule_id = v.id;
      vehicule_label = `${v.immat} ${v.marque ?? ""} ${v.modele ?? ""}`.trim();
    }
  }

  const payload: Record<string, unknown> = {
    client_nom,
    date_livraison,
    distance_km,
    prix_ht: Number(prix_ht.toFixed(2)),
    taux_tva,
    prix_ttc,
    tva_montant,
    statut: "en_attente",
    statut_paiement: "a_payer",
  };
  if (salarie_id) payload.salarie_id = salarie_id;
  if (vehicule_id) payload.vehicule_id = vehicule_id;
  if (args.depart) payload.depart = String(args.depart);
  if (args.arrivee) payload.arrivee = String(args.arrivee);
  if (args.notes) payload.notes = String(args.notes);

  const summary = {
    client: client_nom,
    date: date_livraison,
    prix_ht: Number(prix_ht.toFixed(2)),
    prix_ttc,
    taux_tva,
    distance_km,
    salarie: salarie_label,
    vehicule: vehicule_label,
    depart: args.depart ?? null,
    arrivee: args.arrivee ?? null,
  };

  return {
    proposal: {
      type: "livraison",
      title: "Creer une livraison",
      summary,
      payload,
    },
    write_actions: [{ action: "create_livraison", payload }],
    note: salarie_id || vehicule_id ? "Resolution UUID OK" : (
      args.salarie_nom || args.vehicule_immat
        ? "Salarie/vehicule non resolu (ambigu ou introuvable). La livraison sera creee sans rattachement."
        : null
    ),
  };
}

async function toolProposeCharge(args: any, sb: SbClient) {
  const errors: string[] = [];
  const categorie = String(args.categorie || "").trim();
  const date_charge = String(args.date_charge || "").trim();
  const montant_ht = Number(args.montant_ht);
  if (!categorie) errors.push("categorie manquante");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_charge)) errors.push("date_charge doit etre YYYY-MM-DD");
  if (!Number.isFinite(montant_ht) || montant_ht < 0) errors.push("montant_ht invalide");
  if (errors.length) return { error: errors.join("; ") };

  const taux_tva = Number.isFinite(Number(args.taux_tva)) ? Number(args.taux_tva) : 20;
  const montant_ttc = Number((montant_ht * (1 + taux_tva / 100)).toFixed(2));

  let vehicule_id: string | null = null;
  let vehicule_label: string | null = null;
  if (args.vehicule_immat) {
    const v = await resolveVehiculeByImmat(sb, args.vehicule_immat);
    if (v) {
      vehicule_id = v.id;
      vehicule_label = `${v.immat} ${v.marque ?? ""} ${v.modele ?? ""}`.trim();
    }
  }

  const payload: Record<string, unknown> = {
    categorie,
    date_charge,
    montant_ht: Number(montant_ht.toFixed(2)),
    taux_tva,
    montant_ttc,
    statut_paiement: "a_payer",
  };
  if (args.description) payload.description = String(args.description);
  if (args.fournisseur_nom) payload.fournisseur_nom = String(args.fournisseur_nom);
  if (vehicule_id) payload.vehicule_id = vehicule_id;

  const summary = {
    categorie,
    description: args.description ?? null,
    date: date_charge,
    montant_ht: Number(montant_ht.toFixed(2)),
    montant_ttc,
    taux_tva,
    fournisseur: args.fournisseur_nom ?? null,
    vehicule: vehicule_label,
  };

  return {
    proposal: {
      type: "charge",
      title: "Creer une charge",
      summary,
      payload,
    },
    write_actions: [{ action: "create_charge", payload }],
  };
}

async function toolProposePaiement(args: any, sb: SbClient) {
  const num_liv = String(args.livraison_num_liv || "").trim();
  const montant = Number(args.montant);
  if (!num_liv) return { error: "livraison_num_liv manquant" };
  if (!Number.isFinite(montant) || montant <= 0) return { error: "montant invalide" };

  // Resolution num_liv -> livraison_id + contexte (client, date, prix)
  const { data: liv, error } = await sb.from("livraisons")
    .select("id, num_liv, client_id, client_nom, date_livraison, prix_ttc, statut_paiement")
    .eq("num_liv", num_liv)
    .maybeSingle();
  if (error) return { error: "livraison: " + error.message };
  if (!liv) return { error: `Livraison ${num_liv} introuvable` };

  const date_paiement = args.date_paiement && /^\d{4}-\d{2}-\d{2}$/.test(args.date_paiement)
    ? args.date_paiement
    : todayISO();
  const frais = Number.isFinite(Number(args.frais)) ? Number(args.frais) : 0;

  const payload: Record<string, unknown> = {
    livraison_id: (liv as any).id,
    client_id: (liv as any).client_id,
    date_paiement,
    montant: Number(montant.toFixed(2)),
  };
  if (args.mode) payload.mode = String(args.mode);
  if (args.reference) payload.reference = String(args.reference);
  if (frais) payload.frais = Number(frais.toFixed(2));

  const summary = {
    livraison_num_liv: (liv as any).num_liv,
    livraison_client: (liv as any).client_nom,
    livraison_date: (liv as any).date_livraison,
    livraison_prix_ttc: Number((liv as any).prix_ttc) || 0,
    livraison_statut_paiement: (liv as any).statut_paiement,
    montant: Number(montant.toFixed(2)),
    mode: args.mode ?? null,
    reference: args.reference ?? null,
    date_paiement,
    frais: frais || null,
  };

  return {
    proposal: {
      type: "paiement",
      title: "Enregistrer un paiement",
      summary,
      payload,
    },
    write_actions: [{ action: "create_paiement", payload }],
  };
}

async function toolProposeMarquerAlerteResolue(args: any, sb: SbClient) {
  const alerte_id = String(args.alerte_id || "").trim();
  if (!alerte_id) return { error: "alerte_id manquant" };

  const { data: alerte, error } = await sb.from("alertes_admin")
    .select("id, type, niveau, titre, message, resolved")
    .eq("id", alerte_id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!alerte) return { error: `Alerte ${alerte_id} introuvable` };
  if ((alerte as any).resolved) {
    return { error: "Alerte deja marquee comme resolue", alerte };
  }

  const summary = {
    id: (alerte as any).id,
    type: (alerte as any).type,
    niveau: (alerte as any).niveau,
    titre: (alerte as any).titre,
    message: (alerte as any).message,
  };

  return {
    proposal: {
      type: "resolve_alerte",
      title: "Marquer alerte resolue",
      summary,
      payload: { id: alerte_id },
    },
    write_actions: [{ action: "resolve_alerte", alerte_id }],
  };
}

// ===== Phase 1 — propose_<entity> CREATE des 8 entites =====
// Une seule helper factorisee : whitelist par entite, resolution best-effort
// des references FK quand c'est commode (ex: vehicule_immat -> vehicule_id).
// Le payload retourne est passe tel quel a l'edge fn write-execute.

interface ProposeEntitySpec {
  action: string;             // ex "create_client"
  type: string;               // ex "client"
  title: string;              // ex "Creer un client"
  required: string[];         // champs obligatoires (sinon erreur)
  copyFields: string[];       // champs simples a recopier de args -> payload
}

const PROPOSE_SPECS: Record<string, ProposeEntitySpec> = {
  propose_client: {
    action: "create_client", type: "client", title: "Creer un client",
    required: ["nom"],
    copyFields: ["nom", "prenom", "type", "secteur", "siren", "tva_intracom",
                 "adresse", "cp", "ville", "telephone", "email", "email_fact",
                 "contact", "delai_paiement_jours", "notes"],
  },
  propose_fournisseur: {
    action: "create_fournisseur", type: "fournisseur", title: "Creer un fournisseur",
    required: ["nom"],
    copyFields: ["nom", "prenom", "type", "secteur", "siren", "tva_intracom",
                 "adresse", "cp", "ville", "telephone", "email", "email_fact",
                 "contact", "iban", "bic", "paiement_mode",
                 "delai_paiement_jours", "notes"],
  },
  propose_vehicule: {
    action: "create_vehicule", type: "vehicule", title: "Creer un vehicule",
    required: ["immat"],
    copyFields: ["immat", "marque", "modele", "salarie_id", "kilometrage",
                 "km_initial", "date_ct", "date_assurance", "date_carte_grise",
                 "date_vidange", "carburant", "conso", "capacite_reservoir",
                 "tva_carburant_deductible", "mode_acquisition", "date_acquisition",
                 "entretien_interval_km", "entretien_interval_mois", "ptac",
                 "ptra", "essieux", "crit_air", "vin"],
  },
  propose_salarie: {
    action: "create_salarie", type: "salarie", title: "Creer un salarie",
    required: ["nom"],
    copyFields: ["nom", "prenom", "nom_famille", "numero", "poste", "permis",
                 "categorie_permis", "date_permis", "assurance", "date_assurance",
                 "telephone", "email", "email_personnel"],
  },
  propose_carburant: {
    action: "create_carburant", type: "carburant", title: "Enregistrer un plein",
    required: [],
    copyFields: ["vehicule_id", "salarie_id", "date_plein", "litres",
                 "prix_ht", "taux_tva", "prix_ttc", "kilometrage", "type_carburant"],
  },
  propose_entretien: {
    action: "create_entretien", type: "entretien", title: "Creer un entretien",
    required: [],
    copyFields: ["vehicule_id", "date_entretien", "type", "description",
                 "cout_ht", "taux_tva", "cout_ttc", "kilometrage",
                 "prochain_km", "prochaine_date"],
  },
  propose_incident: {
    action: "create_incident", type: "incident", title: "Creer un incident",
    required: ["description"],
    copyFields: ["salarie_id", "livraison_id", "gravite", "description",
                 "date_incident", "statut"],
  },
  propose_planning_creneau: {
    action: "create_planning_creneau", type: "planning_creneau",
    title: "Creer un creneau de planning",
    required: ["salarie_id", "jour"],
    copyFields: ["salarie_id", "jour", "travaille", "type_jour",
                 "heure_debut", "heure_fin", "zone", "note"],
  },
  propose_inspection: {
    action: "create_inspection", type: "inspection", title: "Creer une inspection",
    required: ["salarie_id"],
    copyFields: ["salarie_id", "vehicule_id", "date_inspection",
                 "semaine_label", "commentaire", "statut"],
  },
};

async function toolProposeEntity(toolName: string, args: any, sb: SbClient) {
  const spec = PROPOSE_SPECS[toolName];
  if (!spec) return { error: `tool ${toolName} sans spec` };

  for (const r of spec.required) {
    if (args[r] === undefined || args[r] === null || args[r] === "") {
      return { error: `${r} manquant` };
    }
  }

  const payload: Record<string, unknown> = {};
  for (const k of spec.copyFields) {
    if (args[k] !== undefined && args[k] !== null) payload[k] = args[k];
  }

  // Resolution best-effort des FK si on a un identifiant alternatif
  if ((toolName === "propose_carburant" || toolName === "propose_entretien")
      && !payload.vehicule_id && args.vehicule_immat) {
    const v = await resolveVehiculeByImmat(sb, args.vehicule_immat);
    if (v) payload.vehicule_id = v.id;
  }

  return {
    proposal: { type: spec.type, title: spec.title, summary: { ...args }, payload },
    write_actions: [{ action: spec.action, payload }],
  };
}

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

// ===== Phase 2 — propose_update_<entity> (UPDATE) =====
// Whitelist par entite, valide le target_id, retourne une proposition update_X.

const UPDATE_WHITELISTS: Record<string, string[]> = {
  livraison: [
    "client_nom", "client_id", "date_livraison", "distance_km",
    "prix_ht", "taux_tva", "prix_ttc", "tva_montant", "salarie_id", "vehicule_id",
    "statut", "statut_paiement", "zone", "depart", "arrivee", "notes", "date_paiement",
  ],
  charge: [
    "categorie", "description", "date_charge", "montant_ht", "taux_tva", "montant_ttc",
    "vehicule_id", "fournisseur_id", "fournisseur_nom", "taux_deductibilite",
    "statut_paiement", "date_paiement", "mode_paiement",
  ],
  paiement: [
    "livraison_id", "client_id", "date_paiement", "montant", "mode",
    "reference", "notes", "frais",
  ],
  client: [
    "nom", "prenom", "type", "secteur", "siren", "tva_intracom", "pays",
    "adresse", "cp", "ville", "telephone", "email", "email_fact", "contact",
    "delai_paiement_jours", "notes",
  ],
  fournisseur: [
    "nom", "prenom", "type", "secteur", "siren", "tva_intracom", "pays",
    "adresse", "cp", "ville", "telephone", "email", "email_fact", "contact",
    "iban", "bic", "paiement_mode", "delai_paiement_jours", "notes",
  ],
  vehicule: [
    "immat", "marque", "modele", "salarie_id", "kilometrage", "km_initial",
    "date_ct", "date_assurance", "date_carte_grise", "date_vidange",
    "carburant", "conso", "capacite_reservoir", "tva_carburant_deductible",
    "mode_acquisition", "date_acquisition", "entretien_interval_km",
    "entretien_interval_mois", "ptac", "ptra", "essieux", "crit_air", "vin",
  ],
  salarie: [
    "nom", "prenom", "nom_famille", "numero", "poste", "permis",
    "categorie_permis", "date_permis", "assurance", "date_assurance",
    "telephone", "email", "email_personnel", "actif",
  ],
  carburant: [
    "vehicule_id", "salarie_id", "date_plein", "litres", "prix_ht",
    "taux_tva", "prix_ttc", "kilometrage", "type_carburant",
  ],
  entretien: [
    "vehicule_id", "date_entretien", "type", "description", "cout_ht",
    "taux_tva", "cout_ttc", "kilometrage", "prochain_km", "prochaine_date",
  ],
  incident: [
    "salarie_id", "livraison_id", "gravite", "description", "date_incident", "statut",
  ],
  planning_creneau: [
    "salarie_id", "jour", "travaille", "type_jour", "heure_debut",
    "heure_fin", "zone", "note",
  ],
  inspection: [
    "salarie_id", "vehicule_id", "date_inspection", "semaine_label",
    "commentaire", "statut",
  ],
};

const UPDATE_TITLES: Record<string, string> = {
  livraison: "Modifier une livraison",
  charge: "Modifier une charge",
  paiement: "Modifier un paiement",
  client: "Modifier un client",
  fournisseur: "Modifier un fournisseur",
  vehicule: "Modifier un vehicule",
  salarie: "Modifier un salarie",
  carburant: "Modifier un plein carburant",
  entretien: "Modifier un entretien",
  incident: "Modifier un incident",
  planning_creneau: "Modifier un creneau de planning",
  inspection: "Modifier une inspection",
};

async function toolProposeUpdate(entity: string, args: any, _sb: SbClient) {
  const target_id = String(args.target_id || "").trim();
  if (!target_id) return { error: "target_id manquant" };
  const allowed = UPDATE_WHITELISTS[entity];
  if (!allowed) return { error: `entite inconnue: ${entity}` };

  const payload: Record<string, unknown> = {};
  for (const k of allowed) {
    if (args[k] !== undefined && args[k] !== null && args[k] !== "") payload[k] = args[k];
  }
  const changedKeys = Object.keys(payload);
  if (changedKeys.length === 0) {
    return { error: "Aucun champ a modifier (renseigne au moins une colonne)" };
  }

  return {
    proposal: {
      type: `update_${entity}`,
      title: UPDATE_TITLES[entity] || `Modifier ${entity}`,
      target_id,
      summary: { target_id, ...payload },
      payload,
      changed_fields: changedKeys,
    },
    write_actions: [{ action: `update_${entity}`, target_id, payload }],
  };
}

// ===== Phase 3 — propose_delete (DELETE generique) =====
// Une seule fonction qui dispatch vers l'edge fn write-execute avec entity + id + raison.

const DELETE_ALLOWED_ENTITIES = new Set([
  "clients", "fournisseurs", "vehicules", "salaries", "livraisons",
  "charges", "paiements", "carburant", "entretiens", "incidents",
  "plannings_hebdo", "inspections", "alertes_admin",
]);

async function toolProposeDelete(args: any, _sb: SbClient) {
  const entity = String(args.entity || "").trim();
  const id = String(args.id || "").trim();
  const raison = String(args.raison || "").trim();
  if (!entity) return { error: "entity manquante" };
  if (!DELETE_ALLOWED_ENTITIES.has(entity)) return { error: `entity non autorisee a la suppression: ${entity}` };
  if (!id) return { error: "id manquant" };
  if (raison.length < 10) return { error: "raison trop courte (≥10 caracteres requis)" };

  return {
    proposal: {
      type: "delete_entity",
      title: `Supprimer ${entity}`,
      summary: { entity, id, raison },
      payload: { entity, id, raison },
      destructive: true,
    },
    write_actions: [{ action: "delete_entity", entity, id, raison }],
  };
}

// ===== Phase 4 — propose_to_drafts (mode brouillon explicite) =====
// L'IA peut directement proposer une mise en brouillon, sans confirmation immediate.
// L'admin reverra la liste plus tard dans la page "Brouillons IA".

async function toolProposeToDrafts(args: any, _sb: SbClient) {
  const action = String(args.action || "").trim();
  const reasoning = String(args.reasoning || "").trim();
  const payload = args.payload && typeof args.payload === "object" ? args.payload : null;
  if (!action) return { error: "action manquante" };
  if (!payload) return { error: "payload manquant" };
  if (reasoning.length < 5) return { error: "reasoning trop court (justifie en 1-2 phrases)" };

  return {
    proposal: {
      type: "to_drafts",
      title: "Ajouter aux brouillons IA",
      summary: { action, reasoning },
      payload: { action, payload, reasoning },
    },
    write_actions: [{ action: "add_to_drafts", action_type: action, payload, reasoning }],
  };
}

// ===== Phase 5 — BULK operations (atomique : 1 brouillon = N actions) =====

async function toolProposeBulkLivraisons(args: any, sb: SbClient) {
  const items = Array.isArray(args?.livraisons) ? args.livraisons : [];
  if (items.length === 0) return { error: "livraisons vide" };
  if (items.length > 50) return { error: "max 50 livraisons par bulk" };
  const reasoning = String(args?.reasoning || "Bulk livraisons via chatbot").trim();

  // Resolution best-effort des FK pour chaque livraison
  const actions: Array<{ action: string; payload: Record<string, unknown> }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (!it.client_nom || !it.date_livraison || it.prix_ht === undefined) {
      return { error: `livraison #${i + 1} : client_nom/date_livraison/prix_ht obligatoires` };
    }
    const payload: Record<string, unknown> = {};
    for (const k of [
      "client_nom", "date_livraison", "distance_km", "prix_ht", "taux_tva",
      "salarie_id", "vehicule_id", "depart", "arrivee", "notes",
    ]) {
      if (it[k] !== undefined && it[k] !== null) payload[k] = it[k];
    }
    actions.push({ action: "create_livraison", payload });
  }

  return {
    proposal: {
      type: "bulk_create_livraisons",
      title: `Creer ${actions.length} livraisons (atomique)`,
      summary: { count: actions.length, reasoning, premiere: actions[0]?.payload },
      payload: { actions, atomic: true, reasoning },
    },
    write_actions: [{ action: "bulk_execute", actions, atomic: true, reasoning }],
  };
}

async function toolProposeBulkCharges(args: any, sb: SbClient) {
  const items = Array.isArray(args?.charges) ? args.charges : [];
  if (items.length === 0) return { error: "charges vide" };
  if (items.length > 30) return { error: "max 30 charges par bulk" };
  const reasoning = String(args?.reasoning || "Bulk charges via chatbot").trim();

  const actions: Array<{ action: string; payload: Record<string, unknown> }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (!it.categorie || !it.date_charge || it.montant_ht === undefined) {
      return { error: `charge #${i + 1} : categorie/date_charge/montant_ht obligatoires` };
    }
    const payload: Record<string, unknown> = {};
    for (const k of [
      "categorie", "description", "date_charge", "montant_ht", "taux_tva",
      "fournisseur_nom", "vehicule_id",
    ]) {
      if (it[k] !== undefined && it[k] !== null) payload[k] = it[k];
    }
    actions.push({ action: "create_charge", payload });
  }

  return {
    proposal: {
      type: "bulk_create_charges",
      title: `Creer ${actions.length} charges (atomique)`,
      summary: { count: actions.length, reasoning, premiere: actions[0]?.payload },
      payload: { actions, atomic: true, reasoning },
    },
    write_actions: [{ action: "bulk_execute", actions, atomic: true, reasoning }],
  };
}

async function toolProposeBulkPaiements(args: any, sb: SbClient) {
  const items = Array.isArray(args?.paiements) ? args.paiements : [];
  if (items.length === 0) return { error: "paiements vide" };
  if (items.length > 30) return { error: "max 30 paiements par bulk" };
  const reasoning = String(args?.reasoning || "Bulk paiements via chatbot").trim();

  const actions: Array<{ action: string; payload: Record<string, unknown> }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (it.montant === undefined || it.montant === null) {
      return { error: `paiement #${i + 1} : montant obligatoire` };
    }
    if (!it.livraison_id && !it.livraison_num_liv) {
      return { error: `paiement #${i + 1} : livraison_id ou livraison_num_liv obligatoire` };
    }
    let livraisonId = it.livraison_id;
    if (!livraisonId && it.livraison_num_liv) {
      const { data } = await sb.from("livraisons")
        .select("id").eq("num_liv", it.livraison_num_liv).maybeSingle();
      if (!data) return { error: `paiement #${i + 1} : livraison ${it.livraison_num_liv} introuvable` };
      livraisonId = (data as any).id;
    }
    const payload: Record<string, unknown> = { livraison_id: livraisonId };
    for (const k of ["montant", "mode", "date_paiement", "reference", "frais"]) {
      if (it[k] !== undefined && it[k] !== null) payload[k] = it[k];
    }
    actions.push({ action: "create_paiement", payload });
  }

  return {
    proposal: {
      type: "bulk_create_paiements",
      title: `Enregistrer ${actions.length} paiements (atomique)`,
      summary: { count: actions.length, reasoning },
      payload: { actions, atomic: true, reasoning },
    },
    write_actions: [{ action: "bulk_execute", actions, atomic: true, reasoning }],
  };
}

// ===== Phase 6 — Actions metier complexes =====

async function toolProposeCloneLivraison(args: any, sb: SbClient) {
  const id = String(args?.source_livraison_id || "").trim();
  const numLiv = String(args?.source_num_liv || "").trim();
  if (!id && !numLiv) return { error: "source_livraison_id ou source_num_liv requis" };
  const overrides = args?.overrides && typeof args.overrides === "object" ? args.overrides : {};

  let q = sb.from("livraisons").select("*");
  q = id ? q.eq("id", id) : q.eq("num_liv", numLiv);
  const { data: src, error } = await q.maybeSingle();
  if (error) return { error: error.message };
  if (!src) return { error: "livraison source introuvable" };

  const COPY_COLS = [
    "client_id", "client_nom", "date_livraison", "distance_km",
    "prix_ht", "taux_tva", "prix_ttc", "tva_montant", "salarie_id", "vehicule_id",
    "zone", "depart", "arrivee", "notes",
  ];
  const payload: Record<string, unknown> = {};
  for (const k of COPY_COLS) {
    if ((src as any)[k] !== undefined && (src as any)[k] !== null) payload[k] = (src as any)[k];
  }
  // Apply overrides
  for (const k of COPY_COLS) {
    if (overrides[k] !== undefined && overrides[k] !== null) payload[k] = overrides[k];
  }
  // Reset statut + paiement (nouvelle livraison fraiche)
  payload.statut = "en_attente";
  payload.statut_paiement = "a_payer";

  return {
    proposal: {
      type: "clone_livraison",
      title: `Cloner livraison ${(src as any).num_liv || "?"}`,
      summary: { source: (src as any).num_liv, overrides, payload },
      payload,
    },
    write_actions: [{ action: "create_livraison", payload }],
  };
}

async function toolProposeSplitCharge(args: any, sb: SbClient) {
  const sourceId = String(args?.source_charge_id || "").trim();
  if (!sourceId) return { error: "source_charge_id requis" };
  const ventilation = Array.isArray(args?.ventilation) ? args.ventilation : [];
  if (ventilation.length < 2) return { error: "ventilation : au moins 2 elements" };
  if (ventilation.length > 20) return { error: "max 20 elements par split" };

  const { data: src, error } = await sb.from("charges").select("*").eq("id", sourceId).maybeSingle();
  if (error) return { error: error.message };
  if (!src) return { error: "charge source introuvable" };

  const montantHtSrc = Number((src as any).montant_ht) || 0;
  if (montantHtSrc <= 0) return { error: "charge source : montant_ht invalide ou nul" };

  // Determine mode : ratio ou montant. Coherence checks.
  const hasRatios = ventilation.every((v: any) => v.ratio !== undefined && v.ratio !== null);
  const hasMontants = ventilation.every((v: any) => v.montant_ht !== undefined && v.montant_ht !== null);
  if (!hasRatios && !hasMontants) {
    return { error: "ventilation : chaque element doit avoir ratio OU montant_ht (homogene sur tous)" };
  }
  let totalRatios = 0;
  let totalMontants = 0;
  for (const v of ventilation) {
    if (hasRatios) totalRatios += Number(v.ratio) || 0;
    if (hasMontants) totalMontants += Number(v.montant_ht) || 0;
  }
  if (hasRatios && Math.abs(totalRatios - 1) > 0.001) {
    return { error: `somme des ratios = ${totalRatios.toFixed(3)}, doit etre 1.0` };
  }
  if (hasMontants && Math.abs(totalMontants - montantHtSrc) > 0.5) {
    return { error: `somme des montants_ht = ${totalMontants.toFixed(2)}, doit etre ${montantHtSrc.toFixed(2)}` };
  }

  // Build N create_charge actions + 1 delete_entity
  const actions: Array<Record<string, unknown>> = [];
  const taux = Number((src as any).taux_tva) || 20;
  for (const v of ventilation) {
    const part = hasRatios ? montantHtSrc * Number(v.ratio) : Number(v.montant_ht);
    const payload: Record<string, unknown> = {
      categorie: (src as any).categorie,
      description: v.description || `${(src as any).description || "Ventilation"} (split)`,
      date_charge: (src as any).date_charge,
      montant_ht: Math.round(part * 100) / 100,
      taux_tva: taux,
      vehicule_id: v.vehicule_id,
      fournisseur_id: (src as any).fournisseur_id,
      fournisseur_nom: (src as any).fournisseur_nom,
      taux_deductibilite: (src as any).taux_deductibilite,
    };
    actions.push({ action: "create_charge", payload });
  }
  actions.push({
    action: "delete_entity",
    payload: { entity: "charges", id: sourceId, raison: `Split charge en ${ventilation.length} lignes` },
  });

  return {
    proposal: {
      type: "split_charge",
      title: `Ventiler charge ${montantHtSrc.toFixed(2)}€ HT en ${ventilation.length} lignes`,
      summary: { source_id: sourceId, montant_ht_source: montantHtSrc, ventilation_count: ventilation.length },
      payload: { actions, atomic: true, reasoning: `Split charge ${sourceId}` },
    },
    write_actions: [{ action: "bulk_execute", actions, atomic: true, reasoning: `Split charge ${sourceId}` }],
  };
}

async function toolProposeImportPlanning(args: any, sb: SbClient) {
  const creneaux = Array.isArray(args?.creneaux) ? args.creneaux : [];
  if (creneaux.length === 0) return { error: "creneaux vide" };
  if (creneaux.length > 100) return { error: "max 100 creneaux par import" };

  const actions: Array<{ action: string; payload: Record<string, unknown> }> = [];
  for (let i = 0; i < creneaux.length; i++) {
    const c = creneaux[i] || {};
    if (!c.salarie_id || !c.jour) {
      return { error: `creneau #${i + 1} : salarie_id et jour obligatoires` };
    }
    const payload: Record<string, unknown> = {};
    for (const k of [
      "salarie_id", "jour", "travaille", "type_jour",
      "heure_debut", "heure_fin", "zone", "note",
    ]) {
      if (c[k] !== undefined && c[k] !== null) payload[k] = c[k];
    }
    actions.push({ action: "create_planning_creneau", payload });
  }

  return {
    proposal: {
      type: "import_planning",
      title: `Importer planning : ${actions.length} creneaux (atomique)`,
      summary: {
        count: actions.length,
        semaine_label: args?.semaine_label,
        salaries_uniques: [...new Set(actions.map((a) => String(a.payload.salarie_id)))].length,
      },
      payload: { actions, atomic: true, reasoning: `Import planning ${args?.semaine_label || ""}` },
    },
    write_actions: [{ action: "bulk_execute", actions, atomic: true, reasoning: `Import planning ${args?.semaine_label || ""}` }],
  };
}

// ===== Phase 7 — Read tools manquants =====

// Reproduit la logique de calculerDSO (script-core-dso.js) cote serveur.
// Les livraisons MCA stockent date_livraison + date_paiement + statut_paiement="paye" + client_nom.
function computeDsoFromRows(
  rows: Array<{ date_livraison: string | null; date_paiement: string | null; client_nom: string | null; statut_paiement: string | null }>,
  periodeJours: number,
): { dso: number | null; count: number; byClient: Record<string, number> } {
  const today = new Date();
  const dateMin = new Date(today.getTime() - periodeJours * 86400000);
  const eligibles = rows.filter((l) => {
    if (!l) return false;
    const sp = String(l.statut_paiement || "").toLowerCase();
    if (sp !== "paye" && sp !== "payé" && sp !== "payee" && sp !== "payée") return false;
    if (!l.date_livraison || !l.date_paiement) return false;
    const dl = new Date(l.date_livraison);
    if (isNaN(dl.getTime())) return false;
    if (dl < dateMin) return false;
    return true;
  });
  if (!eligibles.length) return { dso: null, count: 0, byClient: {} };
  let totalDelai = 0, nbValides = 0;
  const byClientRaw: Record<string, { sum: number; count: number }> = {};
  for (const l of eligibles) {
    const dl = new Date(l.date_livraison!).getTime();
    const dp = new Date(l.date_paiement!).getTime();
    if (isNaN(dl) || isNaN(dp)) continue;
    const delai = (dp - dl) / 86400000;
    if (delai < 0 || delai > 365) continue;
    totalDelai += delai;
    nbValides += 1;
    const c = l.client_nom || "Client inconnu";
    if (!byClientRaw[c]) byClientRaw[c] = { sum: 0, count: 0 };
    byClientRaw[c].sum += delai;
    byClientRaw[c].count += 1;
  }
  if (!nbValides) return { dso: null, count: 0, byClient: {} };
  const byClient: Record<string, number> = {};
  for (const k of Object.keys(byClientRaw)) {
    byClient[k] = Math.round(byClientRaw[k].sum / byClientRaw[k].count);
  }
  return { dso: Math.round(totalDelai / nbValides), count: nbValides, byClient };
}

async function toolGetDsoGlobal(args: any, sb: SbClient) {
  const periode = Math.max(7, Math.min(365, Number(args?.periode_jours) || 90));
  const dateMin = new Date(Date.now() - periode * 86400000).toISOString().slice(0, 10);
  const { data, error } = await sb.from("livraisons")
    .select("date_livraison, date_paiement, client_nom, statut_paiement")
    .gte("date_livraison", dateMin)
    .limit(2000);
  if (error) return { error: error.message };
  const r = computeDsoFromRows((data as any[]) || [], periode);
  return { periode_jours: periode, dso: r.dso, count: r.count };
}

async function toolGetDsoParClient(args: any, sb: SbClient) {
  const periode = Math.max(7, Math.min(365, Number(args?.periode_jours) || 90));
  const dateMin = new Date(Date.now() - periode * 86400000).toISOString().slice(0, 10);
  const { data, error } = await sb.from("livraisons")
    .select("date_livraison, date_paiement, client_nom, statut_paiement")
    .gte("date_livraison", dateMin)
    .limit(2000);
  if (error) return { error: error.message };
  const r = computeDsoFromRows((data as any[]) || [], periode);
  // Trie clients par delai desc (les plus lents en premier)
  const sorted = Object.entries(r.byClient)
    .map(([client, dso]) => ({ client, dso }))
    .sort((a, b) => b.dso - a.dso);
  return { periode_jours: periode, dso_global: r.dso, count: r.count, par_client: sorted };
}

async function toolListBrouillonsEnAttente(args: any, sb: SbClient) {
  const limit = Math.max(1, Math.min(100, Number(args?.limit) || 20));
  let q = sb.from("ai_pending_actions")
    .select("id, action, payload, reasoning, created_at, created_by")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (args?.action_type) q = q.eq("action", args.action_type);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return {
    count: data?.length ?? 0,
    brouillons: (data ?? []).map((d: any) => ({
      id: d.id,
      action: d.action,
      reasoning: d.reasoning,
      created_at: d.created_at,
      preview: d.payload ? Object.keys(d.payload).slice(0, 5).join(", ") : "",
    })),
  };
}

async function toolListChargesRecurrentes(args: any, sb: SbClient) {
  const periode = Math.max(30, Math.min(365, Number(args?.periode_jours) || 90));
  const dateMin = new Date(Date.now() - periode * 86400000).toISOString().slice(0, 10);
  const { data, error } = await sb.from("charges")
    .select("id, categorie, description, montant_ht, fournisseur_nom, date_charge")
    .gte("date_charge", dateMin)
    .limit(2000);
  if (error) return { error: error.message };
  // Grouping heuristique : meme libelle + montant arrondi a 1€ + fournisseur
  const groups: Record<string, { count: number; samples: any[]; total_ht: number }> = {};
  for (const c of (data as any[]) || []) {
    const key = [
      String(c.categorie || "").toLowerCase().trim(),
      String(c.description || "").toLowerCase().trim().slice(0, 40),
      Math.round(Number(c.montant_ht) || 0),
      String(c.fournisseur_nom || "").toLowerCase().trim(),
    ].join("|");
    if (!groups[key]) groups[key] = { count: 0, samples: [], total_ht: 0 };
    groups[key].count += 1;
    groups[key].total_ht += Number(c.montant_ht) || 0;
    if (groups[key].samples.length < 3) groups[key].samples.push(c);
  }
  // Filtre : seulement les recurrentes (count >= 3)
  const recurrentes = Object.values(groups)
    .filter((g) => g.count >= 3)
    .map((g) => ({
      categorie: g.samples[0].categorie,
      description: g.samples[0].description,
      fournisseur_nom: g.samples[0].fournisseur_nom,
      montant_ht_moyen: Math.round((g.total_ht / g.count) * 100) / 100,
      occurrences: g.count,
      derniere_date: g.samples[0].date_charge,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
  return { periode_jours: periode, count: recurrentes.length, charges_recurrentes: recurrentes };
}

async function toolGetKpiDashboard(args: any, sb: SbClient) {
  const monthArg = String(args?.mois || "").trim();
  const today = new Date();
  let dateMin: string, dateMax: string, label: string;
  if (/^\d{4}-\d{2}$/.test(monthArg)) {
    const [y, m] = monthArg.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    dateMin = start.toISOString().slice(0, 10);
    dateMax = end.toISOString().slice(0, 10);
    label = monthArg;
  } else {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    dateMin = start.toISOString().slice(0, 10);
    dateMax = today.toISOString().slice(0, 10);
    label = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const [livRes, chargesRes, paiementsRes, alertesRes] = await Promise.all([
    sb.from("livraisons").select("client_nom, prix_ht, prix_ttc, statut_paiement").gte("date_livraison", dateMin).lte("date_livraison", dateMax),
    sb.from("charges").select("montant_ht, montant_ttc").gte("date_charge", dateMin).lte("date_charge", dateMax),
    sb.from("paiements").select("montant").gte("date_paiement", dateMin).lte("date_paiement", dateMax),
    sb.from("alertes_admin").select("id, niveau", { count: "exact" }).eq("resolved", false),
  ]);
  if (livRes.error) return { error: livRes.error.message };

  const livraisons = (livRes.data as any[]) || [];
  const ca_ht = livraisons.reduce((s, l) => s + (Number(l.prix_ht) || 0), 0);
  const charges_ht = ((chargesRes.data as any[]) || []).reduce((s, c) => s + (Number(c.montant_ht) || 0), 0);
  const encaissements = ((paiementsRes.data as any[]) || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const marge_ht = ca_ht - charges_ht;

  const byClient: Record<string, number> = {};
  for (const l of livraisons) {
    const c = l.client_nom || "Inconnu";
    byClient[c] = (byClient[c] || 0) + (Number(l.prix_ht) || 0);
  }
  const top_clients = Object.entries(byClient)
    .map(([client, ca]) => ({ client, ca_ht: Math.round(ca * 100) / 100 }))
    .sort((a, b) => b.ca_ht - a.ca_ht)
    .slice(0, 3);

  const nbAlertes = alertesRes.count ?? ((alertesRes.data as any[]) || []).length;
  return {
    mois: label,
    periode: { date_min: dateMin, date_max: dateMax },
    nb_livraisons: livraisons.length,
    ca_ht: Math.round(ca_ht * 100) / 100,
    charges_ht: Math.round(charges_ht * 100) / 100,
    marge_ht: Math.round(marge_ht * 100) / 100,
    encaissements: Math.round(encaissements * 100) / 100,
    top_clients,
    nb_alertes_ouvertes: nbAlertes,
  };
}

async function toolGetAnomaliesSynthese(args: any, sb: SbClient) {
  const today = new Date();
  const defaultMin = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const dateMin = String(args?.date_min || defaultMin);
  const dateMax = String(args?.date_max || today.toISOString().slice(0, 10));

  const [livImpayees, inspNonValid, vehicEcheances, alertes] = await Promise.all([
    sb.from("livraisons").select("id, num_liv, client_nom, date_livraison, prix_ttc")
      .eq("statut_paiement", "en_retard").limit(100),
    sb.from("inspections").select("id, salarie_id, vehicule_id, date_inspection")
      .eq("statut", "soumise").gte("date_inspection", dateMin).limit(50),
    sb.from("vehicules").select("id, immat, date_ct, date_assurance, date_carte_grise"),
    sb.from("alertes_admin").select("id, niveau, titre")
      .in("niveau", ["error", "critical"]).eq("resolved", false).limit(50),
  ]);

  const todayMs = Date.now();
  const vehicSoon = ((vehicEcheances.data as any[]) || []).filter((v) => {
    for (const k of ["date_ct", "date_assurance", "date_carte_grise"]) {
      const d = v[k] ? new Date(v[k]).getTime() : null;
      if (d !== null && !isNaN(d) && (d - todayMs) / 86400000 <= 30) return true;
    }
    return false;
  });

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    livraisons_impayees_count: ((livImpayees.data as any[]) || []).length,
    livraisons_impayees_sample: ((livImpayees.data as any[]) || []).slice(0, 5),
    inspections_non_validees_count: ((inspNonValid.data as any[]) || []).length,
    vehicules_echeances_30j_count: vehicSoon.length,
    vehicules_echeances_30j_sample: vehicSoon.slice(0, 5).map((v) => ({ immat: v.immat })),
    alertes_critical_error_count: ((alertes.data as any[]) || []).length,
    alertes_sample: ((alertes.data as any[]) || []).slice(0, 5),
  };
}

// ===== Phase 8 — Self-mgmt brouillons =====

async function toolProposeValidateBrouillon(args: any, sb: SbClient) {
  const draftId = String(args?.draft_id || "").trim();
  if (!draftId) return { error: "draft_id requis" };
  const { data: draft, error } = await sb.from("ai_pending_actions")
    .select("id, action, status, reasoning")
    .eq("id", draftId).maybeSingle();
  if (error) return { error: error.message };
  if (!draft) return { error: "brouillon introuvable" };
  if ((draft as any).status !== "pending") {
    return { error: `brouillon deja traite (statut=${(draft as any).status})` };
  }
  return {
    proposal: {
      type: "validate_brouillon",
      title: `Executer brouillon (${(draft as any).action})`,
      summary: { draft_id: draftId, action: (draft as any).action, reasoning: (draft as any).reasoning },
      payload: { draft_id: draftId },
    },
    write_actions: [{ action: "execute_draft", draft_id: draftId }],
  };
}

async function toolProposeRejectBrouillon(args: any, sb: SbClient) {
  const draftId = String(args?.draft_id || "").trim();
  const raison = String(args?.raison || "").trim();
  if (!draftId) return { error: "draft_id requis" };
  if (raison.length < 10) return { error: "raison trop courte (≥10 caracteres requis)" };
  const { data: draft, error } = await sb.from("ai_pending_actions")
    .select("id, action, status").eq("id", draftId).maybeSingle();
  if (error) return { error: error.message };
  if (!draft) return { error: "brouillon introuvable" };
  if ((draft as any).status !== "pending") {
    return { error: `brouillon deja traite (statut=${(draft as any).status})` };
  }
  return {
    proposal: {
      type: "reject_brouillon",
      title: `Rejeter brouillon (${(draft as any).action})`,
      summary: { draft_id: draftId, raison },
      payload: { draft_id: draftId, raison },
      destructive: true,
    },
    write_actions: [{ action: "reject_draft", draft_id: draftId, raison }],
  };
}

// ===== Phase 9 — Anti-hallucination : tools manquants identifies en prod =====

// Rentabilite par vehicule : agrege CA HT (livraisons rattachees) - charges (vehicule + carburant)
async function toolGetRentabiliteParVehicule(args: any, sb: SbClient) {
  const today = todayISO();
  const dateMax = args?.date_max ?? today;
  const dateMin = args?.date_min ?? today.slice(0, 7) + "-01";

  let vehQ = sb.from("vehicules").select("id, immat, marque, modele");
  if (args?.vehicule_id) vehQ = vehQ.eq("id", args.vehicule_id);
  const { data: vehs, error: vehErr } = await vehQ;
  if (vehErr) return { error: "vehicules: " + vehErr.message };

  let livQ = sb.from("livraisons").select("vehicule_id, prix_ht, distance_km")
    .gte("date_livraison", dateMin).lte("date_livraison", dateMax)
    .not("vehicule_id", "is", null);
  if (args?.vehicule_id) livQ = livQ.eq("vehicule_id", args.vehicule_id);
  const { data: liv, error: livErr } = await livQ;
  if (livErr) return { error: "livraisons: " + livErr.message };

  let carbQ = sb.from("carburant").select("vehicule_id, prix_ht, prix_ttc, litres")
    .gte("date_plein", dateMin).lte("date_plein", dateMax)
    .not("vehicule_id", "is", null);
  if (args?.vehicule_id) carbQ = carbQ.eq("vehicule_id", args.vehicule_id);
  const { data: carb, error: carbErr } = await carbQ;
  if (carbErr) return { error: "carburant: " + carbErr.message };

  let chgQ = sb.from("charges").select("vehicule_id, montant_ht")
    .gte("date_charge", dateMin).lte("date_charge", dateMax)
    .not("vehicule_id", "is", null);
  if (args?.vehicule_id) chgQ = chgQ.eq("vehicule_id", args.vehicule_id);
  const { data: chgs, error: chgErr } = await chgQ;
  if (chgErr) return { error: "charges: " + chgErr.message };

  const result = (vehs ?? []).map((v: any) => {
    const vid = v.id;
    const vLiv = (liv ?? []).filter((l: any) => l.vehicule_id === vid);
    const ca_ht = vLiv.reduce((acc, l: any) => acc + (Number(l.prix_ht) || 0), 0);
    const km_total = vLiv.reduce((acc, l: any) => acc + (Number(l.distance_km) || 0), 0);

    const vCarb = (carb ?? []).filter((c: any) => c.vehicule_id === vid);
    const carb_ht = vCarb.reduce((acc, c: any) => acc + (Number(c.prix_ht) || 0), 0);
    const carb_litres = vCarb.reduce((acc, c: any) => acc + (Number(c.litres) || 0), 0);

    const vChg = (chgs ?? []).filter((c: any) => c.vehicule_id === vid);
    const charges_ht = vChg.reduce((acc, c: any) => acc + (Number(c.montant_ht) || 0), 0);

    const total_charges = Number((carb_ht + charges_ht).toFixed(2));
    const marge_brute_ht = Number((ca_ht - total_charges).toFixed(2));
    const eur_par_km = km_total > 0 ? Number(((ca_ht - total_charges) / km_total).toFixed(2)) : 0;

    return {
      vehicule: { id: vid, immat: v.immat, marque: v.marque, modele: v.modele },
      ca_ht: Number(ca_ht.toFixed(2)),
      charges_carburant_ht: Number(carb_ht.toFixed(2)),
      carburant_litres: Number(carb_litres.toFixed(2)),
      charges_autres_ht: Number(charges_ht.toFixed(2)),
      total_charges_ht: total_charges,
      marge_brute_ht,
      nb_livraisons: vLiv.length,
      km_total: Number(km_total.toFixed(1)),
      eur_par_km,
    };
  }).filter((r: any) => r.nb_livraisons > 0 || r.total_charges_ht > 0);

  result.sort((a, b) => b.marge_brute_ht - a.marge_brute_ht);

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    count: result.length,
    rentabilite: result.slice(0, 30),
  };
}

// Rentabilite par client : agrege CA HT - charges rattachees (via livraisons.vehicule_id)
async function toolGetRentabiliteParClient(args: any, sb: SbClient) {
  const today = todayISO();
  const dateMax = args?.date_max ?? today;
  const dateMin = args?.date_min ?? today.slice(0, 7) + "-01";
  const limit = Math.max(1, Math.min(30, Number(args?.limit) || 10));

  const { data: liv, error: livErr } = await sb.from("livraisons")
    .select("client_nom, client_id, vehicule_id, prix_ht, distance_km")
    .gte("date_livraison", dateMin).lte("date_livraison", dateMax);
  if (livErr) return { error: "livraisons: " + livErr.message };

  // Pour la repartition des charges par client : on ventile les charges/carburant
  // d'un vehicule entre les clients au prorata du CA (heuristique simple).
  const { data: carb } = await sb.from("carburant")
    .select("vehicule_id, prix_ht").gte("date_plein", dateMin).lte("date_plein", dateMax);
  const { data: chgs } = await sb.from("charges")
    .select("vehicule_id, montant_ht").gte("date_charge", dateMin).lte("date_charge", dateMax);

  const caByVehClient = new Map<string, { veh: string; client: string; ca: number; nb: number; km: number }>();
  const caByVeh = new Map<string, number>();
  const clientStats = new Map<string, { client: string; ca_ht: number; nb_livraisons: number; km: number }>();
  for (const l of (liv ?? [])) {
    const veh = String((l as any).vehicule_id || "");
    const client = String((l as any).client_nom || "(sans nom)");
    const ca = Number((l as any).prix_ht) || 0;
    const km = Number((l as any).distance_km) || 0;
    const k = `${veh}|${client}`;
    const cur = caByVehClient.get(k) ?? { veh, client, ca: 0, nb: 0, km: 0 };
    cur.ca += ca; cur.nb += 1; cur.km += km;
    caByVehClient.set(k, cur);
    if (veh) caByVeh.set(veh, (caByVeh.get(veh) ?? 0) + ca);
    const cs = clientStats.get(client) ?? { client, ca_ht: 0, nb_livraisons: 0, km: 0 };
    cs.ca_ht += ca; cs.nb_livraisons += 1; cs.km += km;
    clientStats.set(client, cs);
  }

  const chgByVeh = new Map<string, number>();
  for (const c of (carb ?? [])) {
    const v = String((c as any).vehicule_id || "");
    if (!v) continue;
    chgByVeh.set(v, (chgByVeh.get(v) ?? 0) + (Number((c as any).prix_ht) || 0));
  }
  for (const c of (chgs ?? [])) {
    const v = String((c as any).vehicule_id || "");
    if (!v) continue;
    chgByVeh.set(v, (chgByVeh.get(v) ?? 0) + (Number((c as any).montant_ht) || 0));
  }

  const chargesByClient = new Map<string, number>();
  for (const [, vc] of caByVehClient) {
    const totalCaVeh = caByVeh.get(vc.veh) ?? 0;
    if (totalCaVeh <= 0 || !vc.veh) continue;
    const totalChargesVeh = chgByVeh.get(vc.veh) ?? 0;
    const part = totalChargesVeh * (vc.ca / totalCaVeh);
    chargesByClient.set(vc.client, (chargesByClient.get(vc.client) ?? 0) + part);
  }

  const result = Array.from(clientStats.values()).map((c) => {
    const charges_ht = Number((chargesByClient.get(c.client) ?? 0).toFixed(2));
    const marge_ht = Number((c.ca_ht - charges_ht).toFixed(2));
    const marge_pct = c.ca_ht > 0 ? Number(((marge_ht / c.ca_ht) * 100).toFixed(1)) : 0;
    return {
      client: c.client,
      ca_ht: Number(c.ca_ht.toFixed(2)),
      charges_estimees_ht: charges_ht,
      marge_brute_ht: marge_ht,
      marge_pct,
      nb_livraisons: c.nb_livraisons,
      km_total: Number(c.km.toFixed(1)),
    };
  }).sort((a, b) => b.marge_brute_ht - a.marge_brute_ht).slice(0, limit);

  return {
    periode: { date_min: dateMin, date_max: dateMax },
    count: result.length,
    note: "Charges ventilees par client au prorata du CA sur le vehicule (heuristique).",
    rentabilite: result,
  };
}

// Qonto : pour une transaction donnee, suggerer livraisons/charges plausibles (memes scoring que cron qonto-sync-daily).
async function toolQontoProposerRapprochement(args: any, sb: SbClient) {
  let amount = Number(args?.amount);
  let dateRef = String(args?.settled_at || "").slice(0, 10);
  let counterpartyName = String(args?.counterparty_name || "");
  let side = String(args?.side || "");

  if (args?.transaction_id) {
    const url = `${QONTO_BASE}/transactions?per_page=10&current_page=1`;
    const data = await fetchSafeJson(url, { headers: { Authorization: qontoAuth() } });
    const tx = (data?.transactions ?? []).find((t: any) => t.transaction_id === args.transaction_id);
    if (!tx) return { error: `transaction ${args.transaction_id} introuvable (cherche les 10 dernieres)` };
    amount = Math.abs(Number(tx.amount) || 0);
    dateRef = String(tx.settled_at || "").slice(0, 10);
    counterpartyName = String(tx.counterparty_name || "");
    side = String(tx.side || "");
  }

  if (!Number.isFinite(amount) || amount <= 0) return { error: "amount manquant ou invalide" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRef)) return { error: "settled_at YYYY-MM-DD requis" };

  const dateMs = Date.parse(dateRef + "T00:00:00Z");
  const dWindow = 7 * 86400000;
  const dateMin = new Date(dateMs - dWindow).toISOString().slice(0, 10);
  const dateMax = new Date(dateMs + dWindow).toISOString().slice(0, 10);
  const targetSide = side === "credit" || side === "debit" ? side : "credit";

  function scoreCandidate(targetAmt: number, candAmt: number, candDate: string, candName: string): { score: number; amountDiff: number; dateDiffJ: number; nameMatch: boolean } {
    const amtDiff = Math.abs(targetAmt - candAmt);
    const candMs = Date.parse((candDate || "1970-01-01") + "T00:00:00Z");
    const dateDiffJ = Math.abs((dateMs - candMs) / 86400000);
    if (amtDiff > targetAmt * 0.05 + 1) return { score: 0, amountDiff: amtDiff, dateDiffJ, nameMatch: false };
    if (dateDiffJ > 30) return { score: 0, amountDiff: amtDiff, dateDiffJ, nameMatch: false };
    const amtScore = 1 - Math.min(1, amtDiff / Math.max(1, targetAmt * 0.05));
    const dateScore = 1 - Math.min(1, dateDiffJ / 30);
    const cName = (counterpartyName || "").toLowerCase();
    const candNameLow = (candName || "").toLowerCase();
    const nameMatch = !!cName && !!candNameLow && (cName.includes(candNameLow) || candNameLow.includes(cName));
    const nameScore = nameMatch ? 1 : 0;
    const score = 0.5 * amtScore + 0.3 * dateScore + 0.2 * nameScore;
    return { score: Number(score.toFixed(3)), amountDiff: amtDiff, dateDiffJ, nameMatch };
  }

  const candidates: any[] = [];

  if (targetSide === "credit") {
    const { data: livs, error } = await sb.from("livraisons")
      .select("id, num_liv, client_nom, date_livraison, prix_ttc, statut_paiement")
      .gte("date_livraison", dateMin).lte("date_livraison", dateMax)
      .in("statut_paiement", ["a_payer", "en_retard", "partiel"])
      .limit(200);
    if (error) return { error: "livraisons: " + error.message };
    for (const l of (livs ?? [])) {
      const r = scoreCandidate(amount, Number((l as any).prix_ttc) || 0, (l as any).date_livraison, (l as any).client_nom);
      if (r.score > 0) {
        candidates.push({
          kind: "livraison",
          id: (l as any).id,
          num_liv: (l as any).num_liv,
          label: `${(l as any).num_liv} - ${(l as any).client_nom}`,
          montant_ttc: Number((l as any).prix_ttc) || 0,
          date: (l as any).date_livraison,
          ...r,
        });
      }
    }
  } else {
    const { data: chgs, error } = await sb.from("charges")
      .select("id, categorie, description, fournisseur_nom, date_charge, montant_ttc, statut_paiement")
      .gte("date_charge", dateMin).lte("date_charge", dateMax)
      .in("statut_paiement", ["a_payer", "en_retard", "partiel"])
      .limit(200);
    if (error) return { error: "charges: " + error.message };
    for (const c of (chgs ?? [])) {
      const r = scoreCandidate(amount, Number((c as any).montant_ttc) || 0, (c as any).date_charge, (c as any).fournisseur_nom);
      if (r.score > 0) {
        candidates.push({
          kind: "charge",
          id: (c as any).id,
          label: `${(c as any).categorie} - ${(c as any).fournisseur_nom ?? "?"}`,
          montant_ttc: Number((c as any).montant_ttc) || 0,
          date: (c as any).date_charge,
          ...r,
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    transaction: {
      amount,
      settled_at: dateRef,
      counterparty_name: counterpartyName || null,
      side: targetSide,
    },
    threshold: 0.7,
    count: candidates.length,
    candidates: candidates.slice(0, 10),
    note: "Score 0.5 montant + 0.3 date + 0.2 nom. Threshold sync auto = 0.7. Au-dessous, l'admin doit confirmer manuellement.",
  };
}

// Inventaire des capacites : retourne meta-info sur ce que le bot peut faire (anti-hallucination).
async function toolGetInventaireCapacites(args: any, _sb: SbClient) {
  const cat = String(args?.categorie || "all");

  const lecture = [
    "search_livraisons / charges / clients / fournisseurs / vehicules / salaries / carburant / inspections / entretiens / incidents / alertes",
    "get_stats : CA, charges, marge, conso sur periode",
    "top_clients_ca : top N clients par CA HT",
    "rentabilite_tournee : par chauffeur/tournee",
    "get_rentabilite_par_vehicule : par vehicule",
    "get_rentabilite_par_client : par client",
    "livraisons_impayees_retard : factures clients en retard",
    "vehicules_echeances_proches : CT/assurance/carte_grise expirant",
    "get_anomalies_carburant : conso anormale, doublons, prix incoherent",
    "audit_coherence_donnees : detective scan complet",
    "get_anomalies_synthese : synthese anomalies du mois",
    "get_dso_global / get_dso_par_client : delai moyen reel paiement",
    "get_kpi_dashboard : snapshot KPIs mensuel",
    "qonto_organization : soldes Qonto",
    "qonto_search_transactions : transactions Qonto",
    "qonto_proposer_rapprochement : suggere livraisons/charges pour une transaction",
    "pennylane_factures_clients/fournisseurs : factures Pennylane",
    "match_factures_pennylane_mca : matching deterministe Pennylane <-> MCA",
    "ors_distance / ors_optimize_tournee : distance HGV + TSP",
    "sentry_recent_issues : bugs JS prod",
    "get_audit_log : qui a modifie quoi",
    "get_livraison_detail : detail livraison + paiements + incidents",
    "get_vehicule_historique : 12 mois historique vehicule",
    "get_planning_semaine : creneaux + absences",
    "list_brouillons_en_attente : brouillons IA pending",
    "list_charges_recurrentes : detection charges recurrentes",
  ];
  const ecriture = [
    "propose_livraison + propose_update_livraison + propose_clone_livraison + propose_bulk_livraisons",
    "propose_charge + propose_update_charge + propose_split_charge + propose_bulk_charges",
    "propose_paiement + propose_update_paiement + propose_bulk_paiements",
    "propose_client / fournisseur / vehicule / salarie + leurs propose_update_*",
    "propose_carburant / entretien / incident / inspection / planning_creneau + leurs propose_update_*",
    "propose_import_planning : creneaux atomique multi-jours",
    "propose_delete : suppression generique (raison >=10 chars)",
    "propose_marquer_alerte_resolue",
    "propose_provision_salarie : creation/maj compte chauffeur (auth)",
    "propose_validate_brouillon / propose_reject_brouillon : self-mgmt brouillons",
    "propose_to_drafts : empilage explicite brouillon",
  ];
  const memoire = [
    "add_memory_fact : memorise fait long-terme (importance 1-5)",
    "delete_memory_fact : supprime un fait",
    "list_memory_facts : liste des faits memorises",
  ];
  const pages = [
    "Dashboard, Livraisons (3 vues PC, 2 mobile), Charges, Carburant, Entretiens",
    "Inspections, Incidents, Clients, Fournisseurs, Vehicules, Salaries (drawer 360 mobile)",
    "Planning (3 vues), Heures & Km (CE 561), Rentabilite (3 axes)",
    "TVA, Encaissement (DSO + KPIs), Statistiques (Chart.js)",
    "Brouillons IA, Audit (18 tables triggerees), Parametres, Setup wizard",
  ];
  const integrations = [
    "Pennylane : import FEC mensuel cron + factures clients/fournisseurs",
    "Qonto : sync quotidien cron + rapprochement auto (score 0.5/0.3/0.2)",
    "OCR Gemini Flash mode AUTO : facture / ticket / RIB / carte_grise / permis (PDF natif)",
    "OpenRouteService : distance HGV + optimisation tournee TSP",
    "Sentry : bugs JS prod",
    "Visual agent : 50 screenshots/jour audites par Gemini Flash",
  ];

  const out: Record<string, unknown> = {};
  if (cat === "all" || cat === "lecture") out.lecture = lecture;
  if (cat === "all" || cat === "ecriture") out.ecriture = ecriture;
  if (cat === "all" || cat === "memoire") out.memoire = memoire;
  if (cat === "all" || cat === "pages") out.pages = pages;
  if (cat === "all" || cat === "integrations") out.integrations = integrations;
  if (cat === "all") {
    out.totaux = {
      tools_lecture: lecture.length,
      tools_ecriture: ecriture.length,
      tools_memoire: memoire.length,
      pages_admin: pages.length,
      integrations_actives: integrations.length,
    };
  }
  return out;
}

// Provision compte chauffeur : delegue a l'edge fn provision-salarie-access via brouillon.
async function toolProposeProvisionSalarie(args: any, sb: SbClient) {
  const salarieId = String(args?.salarie_id || "").trim();
  if (!salarieId) return { error: "salarie_id requis (UUID existant)" };

  const { data: sal, error } = await sb.from("salaries")
    .select("id, nom, prenom, numero, email, profile_id")
    .eq("id", salarieId).maybeSingle();
  if (error) return { error: "salaries: " + error.message };
  if (!sal) return { error: `salarie ${salarieId} introuvable` };

  const method = String(args?.temporary_password_method || "auto-generate");
  let password = String(args?.password || "");
  if (method === "auto-generate") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    password = Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
  } else if (password.length < 8) {
    return { error: "password doit faire >=8 caracteres en mode manual" };
  }

  const finalEmail = String(args?.email || (sal as any).email || "").toLowerCase();
  const summary = {
    salarie_id: salarieId,
    nom: `${(sal as any).prenom ?? ""} ${(sal as any).nom ?? ""}`.trim(),
    numero: (sal as any).numero,
    email_propose: finalEmail || `(genere depuis ${(sal as any).numero})`,
    method,
    password_visible: method === "auto-generate" ? password : "(saisi manuellement, masque ici)",
    deja_provisionne: !!(sal as any).profile_id,
  };

  const payload = {
    salarieId,
    numero: (sal as any).numero,
    nom: (sal as any).nom,
    prenom: (sal as any).prenom,
    email: finalEmail,
    password,
  };

  return {
    proposal: {
      type: "provision_salarie",
      title: `Compte chauffeur : ${summary.nom || (sal as any).numero}`,
      summary,
      payload,
    },
    write_actions: [{ action: "provision_salarie", payload }],
  };
}

// ===== TOOL_HANDLERS : dispatcher (les noms doivent matcher tools-defs) =====

export const TOOL_HANDLERS: Record<string, (args: any, sb: SbClient) => Promise<unknown>> = {
  search_livraisons: toolSearchLivraisons,
  search_charges: toolSearchCharges,
  search_clients: toolSearchClients,
  search_fournisseurs: toolSearchFournisseurs,
  search_vehicules: toolSearchVehicules,
  search_salaries: toolSearchSalaries,
  search_carburant: toolSearchCarburant,
  get_stats: toolGetStats,
  top_clients_ca: toolTopClientsCa,
  livraisons_impayees_retard: toolLivraisonsImpayeesRetard,
  vehicules_echeances_proches: toolVehiculesEcheancesProches,
  inspections_non_validees: toolInspectionsNonValidees,
  rentabilite_tournee: toolRentabiliteTournee,
  match_factures_pennylane_mca: toolMatchFacturesPennylaneMca,
  search_inspections: toolSearchInspections,
  search_entretiens: toolSearchEntretiens,
  search_incidents: toolSearchIncidents,
  search_alertes: toolSearchAlertes,
  get_planning_semaine: toolGetPlanningSemaine,
  get_anomalies_carburant: toolGetAnomaliesCarburant,
  qonto_organization: toolQontoOrganization,
  qonto_search_transactions: toolQontoSearchTransactions,
  pennylane_factures_clients: toolPennylaneFacturesClients,
  pennylane_factures_fournisseurs: toolPennylaneFacturesFournisseurs,
  pennylane_search_clients: toolPennylaneSearchClients,
  pennylane_search_fournisseurs: toolPennylaneSearchFournisseurs,
  ors_distance: toolOrsDistance,
  ors_optimize_tournee: toolOrsOptimizeTournee,
  sentry_recent_issues: toolSentryRecentIssues,
  audit_coherence_donnees: toolAuditCoherenceDonnees,
  get_audit_log: toolGetAuditLog,
  get_livraison_detail: toolGetLivraisonDetail,
  get_vehicule_historique: toolGetVehiculeHistorique,
  add_memory_fact: toolAddMemoryFact,
  delete_memory_fact: toolDeleteMemoryFact,
  list_memory_facts: toolListMemoryFacts,
  // CREATE
  propose_livraison: toolProposeLivraison,
  propose_charge: toolProposeCharge,
  propose_paiement: toolProposePaiement,
  propose_marquer_alerte_resolue: toolProposeMarquerAlerteResolue,
  propose_client: (a, sb) => toolProposeEntity("propose_client", a, sb),
  propose_fournisseur: (a, sb) => toolProposeEntity("propose_fournisseur", a, sb),
  propose_vehicule: (a, sb) => toolProposeEntity("propose_vehicule", a, sb),
  propose_salarie: (a, sb) => toolProposeEntity("propose_salarie", a, sb),
  propose_carburant: (a, sb) => toolProposeEntity("propose_carburant", a, sb),
  propose_entretien: (a, sb) => toolProposeEntity("propose_entretien", a, sb),
  propose_incident: (a, sb) => toolProposeEntity("propose_incident", a, sb),
  propose_planning_creneau: (a, sb) => toolProposeEntity("propose_planning_creneau", a, sb),
  propose_inspection: (a, sb) => toolProposeEntity("propose_inspection", a, sb),
  // UPDATE (Phase 2)
  propose_update_livraison: (a, sb) => toolProposeUpdate("livraison", a, sb),
  propose_update_charge: (a, sb) => toolProposeUpdate("charge", a, sb),
  propose_update_paiement: (a, sb) => toolProposeUpdate("paiement", a, sb),
  propose_update_client: (a, sb) => toolProposeUpdate("client", a, sb),
  propose_update_fournisseur: (a, sb) => toolProposeUpdate("fournisseur", a, sb),
  propose_update_vehicule: (a, sb) => toolProposeUpdate("vehicule", a, sb),
  propose_update_salarie: (a, sb) => toolProposeUpdate("salarie", a, sb),
  propose_update_carburant: (a, sb) => toolProposeUpdate("carburant", a, sb),
  propose_update_entretien: (a, sb) => toolProposeUpdate("entretien", a, sb),
  propose_update_incident: (a, sb) => toolProposeUpdate("incident", a, sb),
  propose_update_planning_creneau: (a, sb) => toolProposeUpdate("planning_creneau", a, sb),
  propose_update_inspection: (a, sb) => toolProposeUpdate("inspection", a, sb),
  // DELETE (Phase 3)
  propose_delete: toolProposeDelete,
  // BROUILLON (Phase 4)
  propose_to_drafts: toolProposeToDrafts,
  // BULK (Phase 5)
  propose_bulk_livraisons: toolProposeBulkLivraisons,
  propose_bulk_charges: toolProposeBulkCharges,
  propose_bulk_paiements: toolProposeBulkPaiements,
  // ACTIONS METIER (Phase 6)
  propose_clone_livraison: toolProposeCloneLivraison,
  propose_split_charge: toolProposeSplitCharge,
  propose_import_planning: toolProposeImportPlanning,
  // READ (Phase 7)
  get_dso_global: toolGetDsoGlobal,
  get_dso_par_client: toolGetDsoParClient,
  list_brouillons_en_attente: toolListBrouillonsEnAttente,
  list_charges_recurrentes: toolListChargesRecurrentes,
  get_kpi_dashboard: toolGetKpiDashboard,
  get_anomalies_synthese: toolGetAnomaliesSynthese,
  // SELF-MGMT BROUILLONS (Phase 8)
  propose_validate_brouillon: toolProposeValidateBrouillon,
  propose_reject_brouillon: toolProposeRejectBrouillon,
  // PHASE 9 — Anti-hallucination
  get_rentabilite_par_vehicule: toolGetRentabiliteParVehicule,
  get_rentabilite_par_client: toolGetRentabiliteParClient,
  qonto_proposer_rapprochement: toolQontoProposerRapprochement,
  get_inventaire_capacites: toolGetInventaireCapacites,
  propose_provision_salarie: toolProposeProvisionSalarie,
};
