/**
 * MCA Logistics — Adapters Supabase pour les entites restantes
 *
 * Synchronisation transparente localStorage <-> tables natives Supabase
 * via la factory createSupabaseEntityAdapter (entity-supabase-adapter.js).
 *
 * Entites couvertes :
 *  - livraisons     (cle 'livraisons')
 *  - charges        (cle 'charges')
 *  - carburant      (cle 'carburant')
 *  - entretiens     (cle 'entretiens')
 *  - paiements      (cle 'paiements')
 *  - incidents      (cle 'incidents')
 *
 * Approche : mapping explicite des colonnes critiques + fallback `extra` jsonb
 * pour preserver les champs custom du JS qui n'ont pas de colonne dediee.
 *
 * IMPORTANT : a charger APRES entity-supabase-adapter.js et AVANT script.js.
 */

(function () {
  'use strict';

  if (!window.createSupabaseEntityAdapter) {
    console.error('[all-entity-adapters] createSupabaseEntityAdapter non disponible');
    return;
  }

  function isUuidLike(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
  function emptyToNull(v) { return (v === '' || v === undefined) ? null : v; }
  function safeNum(v, def) {
    if (v == null || v === '') return def == null ? null : def;
    var n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : (def == null ? null : def);
  }

  // ============================================================
  // LIVRAISONS
  // ============================================================
  function livraisonJsToDb(l) {
    if (!l || typeof l !== 'object') return null;
    if (!l.date && !l.dateLivraison) return null;
    var row = {
      num_liv: emptyToNull(l.numLiv),
      client_nom: emptyToNull(l.client),
      date_livraison: emptyToNull(l.date) || emptyToNull(l.dateLivraison),
      distance_km: safeNum(l.distance, 0),
      prix_ht: safeNum(l.prixHT, 0),
      taux_tva: safeNum(l.tauxTVA, 20),
      prix_ttc: safeNum(l.prix, 0),
      statut: emptyToNull(l.statut),
      statut_paiement: emptyToNull(l.statutPaiement),
      zone: emptyToNull(l.zone),
      depart: emptyToNull(l.depart),
      arrivee: emptyToNull(l.arrivee),
      notes: emptyToNull(l.notes),
      client_siren: emptyToNull(l.clientSiren),
      client_tva_intracom: emptyToNull(l.clientTvaIntracom),
      client_pays: emptyToNull(l.clientPays),
      date_paiement: emptyToNull(l.datePaiement),
      tva_montant: safeNum(l.tvaMontant, 0),
      kilometrage_compteur: safeNum(l.kmCompteur, null),
      client_id: isUuidLike(l.clientId) ? l.clientId : null,
      salarie_id: isUuidLike(l.chaufId) ? l.chaufId : null,
      vehicule_id: isUuidLike(l.vehId) ? l.vehId : null,
      extra: l // tout l'objet original pour ne rien perdre
    };
    if (isUuidLike(l.id)) row.id = l.id;
    if (l.creeLe && !isNaN(Date.parse(l.creeLe))) row.created_at = l.creeLe;
    return row;
  }
  function livraisonDbToJs(r) {
    if (!r || typeof r !== 'object') return null;
    var extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
    return Object.assign({}, extra, {
      id: r.id,
      numLiv: r.num_liv || '',
      client: r.client_nom || extra.client || '',
      date: r.date_livraison || '',
      distance: r.distance_km == null ? 0 : Number(r.distance_km),
      prixHT: r.prix_ht == null ? 0 : Number(r.prix_ht),
      tauxTVA: r.taux_tva == null ? 20 : Number(r.taux_tva),
      prix: r.prix_ttc == null ? 0 : Number(r.prix_ttc),
      statut: r.statut || '',
      statutPaiement: r.statut_paiement || '',
      zone: r.zone || '',
      depart: r.depart || '',
      arrivee: r.arrivee || '',
      notes: r.notes || '',
      clientSiren: r.client_siren || '',
      clientTvaIntracom: r.client_tva_intracom || '',
      clientPays: r.client_pays || '',
      datePaiement: r.date_paiement || '',
      tvaMontant: r.tva_montant == null ? 0 : Number(r.tva_montant),
      kmCompteur: r.kilometrage_compteur == null ? null : Number(r.kilometrage_compteur),
      clientId: r.client_id || extra.clientId || null,
      chaufId: r.salarie_id || extra.chaufId || null,
      vehId: r.vehicule_id || extra.vehId || null,
      creeLe: r.created_at || ''
    });
  }
  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
  window.DelivProEntityAdapters.livraisons = window.createSupabaseEntityAdapter({
    storageKey: 'livraisons', table: 'livraisons', channelName: 'mca-livraisons-sync',
    jsToDb: livraisonJsToDb, dbToJs: livraisonDbToJs, orderBy: 'created_at'
    // pullFilter dispo dans la factory. A activer (ex: 6 mois) quand l'historique
    // depassera ~1000 livraisons. Garde tout pour l'instant car stats annuelles
    // et TVA declarative ont besoin de l'historique complet.
  });

  // ============================================================
  // CHARGES
  // ============================================================
  function chargeJsToDb(c) {
    if (!c || typeof c !== 'object') return null;
    var row = {
      categorie: emptyToNull(c.categorie) || emptyToNull(c.type) || 'autre',
      description: emptyToNull(c.description),
      date_charge: emptyToNull(c.date),
      montant_ttc: safeNum(c.montant != null ? c.montant : c.montantTTC, 0),
      montant_ht: safeNum(c.montantHT, 0),
      taux_tva: safeNum(c.tauxTVA, 20),
      taux_deductibilite: safeNum(c.tauxDeductibilite, 100),
      fournisseur_nom: emptyToNull(c.fournisseur),
      vehicule_id: isUuidLike(c.vehId) ? c.vehId : null,
      fournisseur_id: isUuidLike(c.fournisseurId) ? c.fournisseurId : null,
      extra: c
    };
    if (isUuidLike(c.id)) row.id = c.id;
    if (c.creeLe && !isNaN(Date.parse(c.creeLe))) row.created_at = c.creeLe;
    if (!row.date_charge) return null; // requis NOT NULL
    return row;
  }
  function chargeDbToJs(r) {
    if (!r) return null;
    var extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
    return Object.assign({}, extra, {
      id: r.id,
      categorie: r.categorie || extra.categorie || '',
      type: extra.type || r.categorie || '',
      description: r.description || '',
      date: r.date_charge || '',
      montant: r.montant_ttc == null ? 0 : Number(r.montant_ttc),
      montantTTC: r.montant_ttc == null ? 0 : Number(r.montant_ttc),
      montantHT: r.montant_ht == null ? 0 : Number(r.montant_ht),
      tauxTVA: r.taux_tva == null ? 20 : Number(r.taux_tva),
      tauxDeductibilite: r.taux_deductibilite == null ? 100 : Number(r.taux_deductibilite),
      fournisseur: r.fournisseur_nom || '',
      vehId: r.vehicule_id || null,
      fournisseurId: r.fournisseur_id || null,
      creeLe: r.created_at || ''
    });
  }
  window.DelivProEntityAdapters.charges = window.createSupabaseEntityAdapter({
    storageKey: 'charges', table: 'charges', channelName: 'mca-charges-sync',
    jsToDb: chargeJsToDb, dbToJs: chargeDbToJs, orderBy: 'created_at'
  });

  // ============================================================
  // CARBURANT
  // ============================================================
  function carburantJsToDb(c) {
    if (!c || typeof c !== 'object') return null;
    var row = {
      date_plein: emptyToNull(c.date),
      litres: safeNum(c.litres, 0),
      prix_ttc: safeNum(c.total != null ? c.total : c.prixTTC, 0),
      prix_ht: safeNum(c.prixHT, 0),
      taux_tva: safeNum(c.tauxTVA, 20),
      kilometrage: safeNum(c.km, null),
      type_carburant: emptyToNull(c.typeCarburant),
      photo_recu_path: emptyToNull(c.photoRecuPath),
      photo_recu_mime: emptyToNull(c.photoRecuBucket ? 'image/jpeg' : null),
      vehicule_id: isUuidLike(c.vehId) ? c.vehId : null,
      salarie_id: isUuidLike(c.salId) ? c.salId : null,
      // photoRecu (base64 legacy) sanitize -> on enleve de extra
      extra: (function(){ var copy = Object.assign({}, c); delete copy.photoRecu; return copy; })()
    };
    if (isUuidLike(c.id)) row.id = c.id;
    if (c.creeLe && !isNaN(Date.parse(c.creeLe))) row.created_at = c.creeLe;
    if (!row.date_plein) return null;
    return row;
  }
  function carburantDbToJs(r) {
    if (!r) return null;
    var extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
    return Object.assign({}, extra, {
      id: r.id,
      date: r.date_plein || '',
      litres: r.litres == null ? 0 : Number(r.litres),
      total: r.prix_ttc == null ? 0 : Number(r.prix_ttc),
      prixTTC: r.prix_ttc == null ? 0 : Number(r.prix_ttc),
      prixHT: r.prix_ht == null ? 0 : Number(r.prix_ht),
      tauxTVA: r.taux_tva == null ? 20 : Number(r.taux_tva),
      km: r.kilometrage == null ? null : Number(r.kilometrage),
      typeCarburant: r.type_carburant || '',
      photoRecuPath: r.photo_recu_path || '',
      photoRecuBucket: r.photo_recu_path ? 'carburant-recus' : null,
      vehId: r.vehicule_id || null,
      salId: r.salarie_id || null,
      creeLe: r.created_at || ''
    });
  }
  window.DelivProEntityAdapters.carburant = window.createSupabaseEntityAdapter({
    storageKey: 'carburant', table: 'carburant', channelName: 'mca-carburant-sync',
    jsToDb: carburantJsToDb, dbToJs: carburantDbToJs,
    preserveLocalFields: ['photoRecu'], // base64 legacy reste local
    orderBy: 'created_at'
  });

  // ============================================================
  // ENTRETIENS
  // ============================================================
  function entretienJsToDb(e) {
    if (!e || typeof e !== 'object') return null;
    var row = {
      date_entretien: emptyToNull(e.date),
      type: emptyToNull(e.type),
      description: emptyToNull(e.description),
      cout_ttc: safeNum(e.cout != null ? e.cout : e.coutTTC, 0),
      cout_ht: safeNum(e.coutHT, 0),
      taux_tva: safeNum(e.tauxTVA, 20),
      kilometrage: safeNum(e.km, null),
      prochain_km: safeNum(e.prochainKm, null),
      prochaine_date: emptyToNull(e.prochaineDate),
      vehicule_id: isUuidLike(e.vehId) ? e.vehId : null,
      extra: e
    };
    if (isUuidLike(e.id)) row.id = e.id;
    if (e.creeLe && !isNaN(Date.parse(e.creeLe))) row.created_at = e.creeLe;
    if (!row.date_entretien) return null;
    return row;
  }
  function entretienDbToJs(r) {
    if (!r) return null;
    var extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
    return Object.assign({}, extra, {
      id: r.id,
      date: r.date_entretien || '',
      type: r.type || '',
      description: r.description || '',
      cout: r.cout_ttc == null ? 0 : Number(r.cout_ttc),
      coutTTC: r.cout_ttc == null ? 0 : Number(r.cout_ttc),
      coutHT: r.cout_ht == null ? 0 : Number(r.cout_ht),
      tauxTVA: r.taux_tva == null ? 20 : Number(r.taux_tva),
      km: r.kilometrage == null ? null : Number(r.kilometrage),
      prochainKm: r.prochain_km == null ? null : Number(r.prochain_km),
      prochaineDate: r.prochaine_date || '',
      vehId: r.vehicule_id || null,
      creeLe: r.created_at || ''
    });
  }
  window.DelivProEntityAdapters.entretiens = window.createSupabaseEntityAdapter({
    storageKey: 'entretiens', table: 'entretiens', channelName: 'mca-entretiens-sync',
    jsToDb: entretienJsToDb, dbToJs: entretienDbToJs, orderBy: 'created_at'
  });

  // ============================================================
  // PAIEMENTS
  // ============================================================
  function paiementJsToDb(p) {
    if (!p || typeof p !== 'object') return null;
    var row = {
      date_paiement: emptyToNull(p.date),
      montant: safeNum(p.montant, 0),
      mode: emptyToNull(p.mode),
      reference: emptyToNull(p.reference),
      frais: safeNum(p.frais, 0),
      notes: emptyToNull(p.notes),
      livraison_id: isUuidLike(p.livId) ? p.livId : null,
      client_id: isUuidLike(p.clientId) ? p.clientId : null,
      extra: p
    };
    if (isUuidLike(p.id)) row.id = p.id;
    if (p.creeLe && !isNaN(Date.parse(p.creeLe))) row.created_at = p.creeLe;
    if (!row.date_paiement) return null;
    return row;
  }
  function paiementDbToJs(r) {
    if (!r) return null;
    var extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
    return Object.assign({}, extra, {
      id: r.id,
      date: r.date_paiement || '',
      montant: r.montant == null ? 0 : Number(r.montant),
      mode: r.mode || '',
      reference: r.reference || '',
      frais: r.frais == null ? 0 : Number(r.frais),
      notes: r.notes || '',
      livId: r.livraison_id || null,
      clientId: r.client_id || null,
      creeLe: r.created_at || ''
    });
  }
  window.DelivProEntityAdapters.paiements = window.createSupabaseEntityAdapter({
    storageKey: 'paiements', table: 'paiements', channelName: 'mca-paiements-sync',
    jsToDb: paiementJsToDb, dbToJs: paiementDbToJs, orderBy: 'created_at',
    // Pas de realtime : entite peu modifiee, le pull au visibilitychange suffit.
    // Un paiement ne change pas plusieurs fois par minute.
    noRealtime: true
  });

  // ============================================================
  // INCIDENTS
  // ============================================================
  function incidentJsToDb(i) {
    if (!i || typeof i !== 'object') return null;
    var salId = isUuidLike(i.salId) ? i.salId : (isUuidLike(i.chaufId) ? i.chaufId : null);
    var row = {
      gravite: emptyToNull(i.gravite) || 'moyen',
      description: emptyToNull(i.description) || 'Sans description',
      date_incident: emptyToNull(i.date) || emptyToNull(i.dateIncident),
      statut: emptyToNull(i.statut) || 'ouvert',
      salarie_id: salId,
      livraison_id: isUuidLike(i.livId) ? i.livId : null,
      extra: i
    };
    if (isUuidLike(i.id)) row.id = i.id;
    if (i.creeLe && !isNaN(Date.parse(i.creeLe))) row.created_at = i.creeLe;
    if (!row.date_incident) return null;
    return row;
  }
  function incidentDbToJs(r) {
    if (!r) return null;
    var extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
    return Object.assign({}, extra, {
      id: r.id,
      gravite: r.gravite || 'moyen',
      description: r.description || '',
      date: r.date_incident || '',
      dateIncident: r.date_incident || '',
      statut: r.statut || 'ouvert',
      salId: r.salarie_id || extra.salId || null,
      chaufId: extra.chaufId || r.salarie_id || null,
      livId: r.livraison_id || null,
      creeLe: r.created_at || ''
    });
  }
  window.DelivProEntityAdapters.incidents = window.createSupabaseEntityAdapter({
    storageKey: 'incidents', table: 'incidents', channelName: 'mca-incidents-sync',
    jsToDb: incidentJsToDb, dbToJs: incidentDbToJs, orderBy: 'created_at',
    // Pas de realtime : entite peu modifiee, le pull au visibilitychange suffit.
    noRealtime: true
  });

  console.info('[all-entity-adapters] 6 adapters initialises (livraisons, charges, carburant, entretiens, paiements, incidents)');
})();
