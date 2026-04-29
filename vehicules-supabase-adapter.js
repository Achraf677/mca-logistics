/**
 * Vehicules Supabase Adapter — Phase 2.2
 *
 * Synchronisation transparente localStorage.vehicules <-> public.vehicules.
 * Utilise la factory createSupabaseEntityAdapter (entity-supabase-adapter.js).
 *
 * Specificites vehicules :
 *   - assurance et finance stockes en JSONB (sous-objets ~5 et ~24 champs)
 *   - carteGriseFichier/Type/Nom (base64) restent en localStorage
 *     (Phase 3 migrera vers Supabase Storage)
 *
 * IMPORTANT : a charger APRES entity-supabase-adapter.js et AVANT script.js.
 */

(function () {
  'use strict';

  if (!window.createSupabaseEntityAdapter) {
    console.error('[vehicules-adapter] createSupabaseEntityAdapter non disponible');
    return;
  }

  function isUuidLike(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }

  function emptyToNull(v) {
    return (v === '' || v === undefined) ? null : v;
  }

  function safeNum(v, def) {
    if (v == null || v === '') return def == null ? null : def;
    var n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : (def == null ? null : def);
  }

  // ============================================================
  // Mapping JS -> DB
  // ============================================================
  function jsToDb(v) {
    if (!v || typeof v !== 'object') return null;

    var assurance = (v.assurance && typeof v.assurance === 'object') ? v.assurance : {};
    var financeNested = (v.finance && typeof v.finance === 'object') ? v.finance : {};
    var finance = {};
    [
      'prixAchatHT','tauxTVAAchat','prixAchatTTC','dureeAmortissement','modeAmortissement',
      'dateMiseAuRebut','valeurMiseAuRebut','kmRachat','anneeVehicule','prixCatalogueHT',
      'loyerMensuelHT','apportInitialHT','dureeContratMois','kmInclusContrat','dateFinContrat',
      'depotGarantieHT','coutKmExcedentaire','creditApportHT','creditMensualiteHT','creditDureeMois',
      'creditTaeg','creditCoutTotalHT','loaOptionAchatHT'
    ].forEach(function (k) {
      // Supporte les deux shapes : top-level (Object.assign(veh, finance)) ou sous-objet veh.finance
      if (v[k] !== undefined) finance[k] = v[k];
      else if (financeNested[k] !== undefined) finance[k] = financeNested[k];
    });

    var row = {
      immat: (v.immat || '').toString(),
      modele: emptyToNull(v.modele),
      marque: emptyToNull(v.marque),
      kilometrage: safeNum(v.km, 0),
      km_initial: safeNum(v.kmInitial, 0),
      conso: safeNum(v.conso, 0),
      date_ct: emptyToNull(v.dateCT),
      date_ct_dernier: emptyToNull(v.dateCTDernier),
      date_vidange: emptyToNull(v.dateVidange),
      tva_carburant_deductible: safeNum(v.tvaCarbDeductible, 100),
      mode_acquisition: emptyToNull(v.modeAcquisition) || 'achat',
      date_acquisition: emptyToNull(v.dateAcquisition),
      entretien_interval_km: safeNum(v.entretienIntervalKm, 0),
      entretien_interval_mois: safeNum(v.entretienIntervalMois, 0),
      genre: emptyToNull(v.genre),
      carburant: emptyToNull(v.carburant),
      ptac: safeNum(v.ptac, 0),
      ptra: safeNum(v.ptra, 0),
      essieux: safeNum(v.essieux, 0),
      crit_air: emptyToNull(v.critAir),
      date_1_immat: emptyToNull(v.date1Immat),
      vin: emptyToNull(v.vin),
      carte_grise_ref: emptyToNull(v.carteGrise),
      date_assurance: emptyToNull(assurance.dateExpiration || v.dateAssurance),
      date_carte_grise: emptyToNull(v.dateCarteGrise),
      salarie_id: isUuidLike(v.salId) ? v.salId : null,
      salarie_nom_cache: emptyToNull(v.salNom),
      assurance: assurance,
      finance: finance
    };

    if (isUuidLike(v.id)) row.id = v.id;
    if (v.creeLe && !isNaN(Date.parse(v.creeLe))) row.created_at = v.creeLe;

    return row;
  }

  // ============================================================
  // Mapping DB -> JS
  // ============================================================
  function dbToJs(r) {
    if (!r || typeof r !== 'object') return null;
    var assurance = (r.assurance && typeof r.assurance === 'object') ? r.assurance : {};
    var finance = (r.finance && typeof r.finance === 'object') ? r.finance : {};

    var item = {
      id: r.id,
      immat: r.immat || '',
      modele: r.modele || '',
      marque: r.marque || '',
      km: r.kilometrage == null ? 0 : Number(r.kilometrage),
      kmInitial: r.km_initial == null ? 0 : Number(r.km_initial),
      conso: r.conso == null ? 0 : Number(r.conso),
      dateCT: r.date_ct || '',
      dateCTDernier: r.date_ct_dernier || '',
      dateVidange: r.date_vidange || '',
      tvaCarbDeductible: r.tva_carburant_deductible == null ? 100 : Number(r.tva_carburant_deductible),
      modeAcquisition: r.mode_acquisition || 'achat',
      dateAcquisition: r.date_acquisition || '',
      entretienIntervalKm: r.entretien_interval_km == null ? 0 : Number(r.entretien_interval_km),
      entretienIntervalMois: r.entretien_interval_mois == null ? 0 : Number(r.entretien_interval_mois),
      genre: r.genre || '',
      carburant: r.carburant || '',
      ptac: r.ptac == null ? 0 : Number(r.ptac),
      ptra: r.ptra == null ? 0 : Number(r.ptra),
      essieux: r.essieux == null ? 0 : Number(r.essieux),
      critAir: r.crit_air || '',
      date1Immat: r.date_1_immat || '',
      vin: r.vin || '',
      carteGrise: r.carte_grise_ref || '',
      dateAssurance: r.date_assurance || '',
      dateCarteGrise: r.date_carte_grise || '',
      salId: r.salarie_id || null,
      salNom: r.salarie_nom_cache || null,
      assurance: assurance,
      finance: finance,
      creeLe: r.created_at || ''
    };

    // Restitue les champs finance a plat (le code attend prixAchatHT, etc. au top-level)
    Object.keys(finance).forEach(function (k) {
      if (item[k] === undefined) item[k] = finance[k];
    });

    return item;
  }

  var adapter = window.createSupabaseEntityAdapter({
    storageKey: 'vehicules',
    table: 'vehicules',
    channelName: 'mca-vehicules-sync',
    jsToDb: jsToDb,
    dbToJs: dbToJs,
    preserveLocalFields: ['carteGriseFichier', 'carteGriseFichierType', 'carteGriseFichierNom'],
    orderBy: 'created_at'
  });

  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
  window.DelivProEntityAdapters.vehicules = adapter;
  window.DelivProVehiculesAdapter = adapter; // alias retro-compat
})();
