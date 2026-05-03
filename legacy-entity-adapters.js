/**
 * MCA Logistics - Adapters Supabase pour entites legacy
 *
 * Sync transparente localStorage <-> tables natives Supabase pour :
 *   - inspections      (cle 'inspections' -> public.inspections)
 *   - alertes_admin    (cle 'alertes_admin' -> public.alertes_admin)
 *   - absences_periodes (cle 'absences_periodes' -> public.absences_periodes)
 *
 * Le module 'plannings' (structure nested) et 'messages_*' (multi-key dynamique)
 * vivent dans des fichiers dedies (plannings-supabase-adapter.js,
 * messages-supabase-adapter.js).
 *
 * Approche : mapping explicite + fallback `extra` (pour inspections via colonnes
 * absentes : photos, vehImmat, source, etc., on les preserve cote local et on
 * sync uniquement les colonnes natives DB).
 *
 * IMPORTANT : a charger APRES entity-supabase-adapter.js et AVANT script.js.
 */

(function () {
  'use strict';

  if (!window.createSupabaseEntityAdapter) {
    console.error('[legacy-entity-adapters] createSupabaseEntityAdapter non disponible');
    return;
  }

  function isUuidLike(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
  function emptyToNull(v) { return (v === '' || v === undefined) ? null : v; }
  function safeBool(v, def) { if (v == null) return !!def; return !!v; }

  // ============================================================
  // INSPECTIONS
  // ============================================================
  // JS shape (script-inspections.js + script-mobile.js) :
  //   { id, salId, salNom, vehId, vehImmat, date, km, commentaire,
  //     photos: [string|{url}], source, creeLe, modifieLe, ... }
  // DB shape (public.inspections) :
  //   id, salarie_id (NOT NULL), vehicule_id, date_inspection, semaine_label,
  //   commentaire, statut, created_at, updated_at
  // -> kilometrage (km) et photos[] ne sont PAS dans la table inspections.
  //    On laisse les photos en local (preserveLocalFields), et le km en `extra`
  //    via colonne... oh la table n'a pas de colonne extra ni km. On garde donc
  //    ces champs UNIQUEMENT cote local (pas de sync) en les preservant via
  //    preserveLocalFields. Pour le km : c'est dual-write deja sur public.vehicules.
  function inspectionJsToDb(i) {
    if (!i || typeof i !== 'object') return null;
    if (!isUuidLike(i.salId)) return null;          // FK salarie_id NOT NULL
    if (!i.date) return null;                       // NOT NULL
    var row = {
      salarie_id: i.salId,
      vehicule_id: isUuidLike(i.vehId) ? i.vehId : null,
      date_inspection: i.date,
      commentaire: emptyToNull(i.commentaire),
      statut: emptyToNull(i.statut) || 'soumise'
    };
    if (isUuidLike(i.id)) row.id = i.id;
    if (i.creeLe && !isNaN(Date.parse(i.creeLe))) row.created_at = i.creeLe;
    if (i.modifieLe && !isNaN(Date.parse(i.modifieLe))) row.updated_at = i.modifieLe;
    return row;
  }
  function inspectionDbToJs(r) {
    if (!r) return null;
    return {
      id: r.id,
      salId: r.salarie_id || '',
      vehId: r.vehicule_id || '',
      date: r.date_inspection || '',
      commentaire: r.commentaire || '',
      statut: r.statut || 'soumise',
      creeLe: r.created_at || '',
      modifieLe: r.updated_at || '',
      // Champs purement locaux (preserves via mergeWithLocal) :
      // salNom, vehImmat, km, photos, source, note_cleanup_storage, photosNettoyeesLe
      photos: []
    };
  }
  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
  window.DelivProEntityAdapters.inspections = window.createSupabaseEntityAdapter({
    storageKey: 'inspections',
    table: 'inspections',
    channelName: 'mca-inspections-sync',
    jsToDb: inspectionJsToDb,
    dbToJs: inspectionDbToJs,
    // Champs locaux preserves au pull (denormalisations, photos base64, km dual-write veh)
    preserveLocalFields: ['salNom', 'vehImmat', 'km', 'photos', 'source',
                          'note_cleanup_storage', 'photosNettoyeesLe',
                          'vehiculeId', 'chaufId', 'semaine_label'],
    orderBy: 'created_at'
  });

  // ============================================================
  // ALERTES_ADMIN
  // ============================================================
  // JS shape (script-alertes.js) :
  //   { id, type, message, meta: { salId, vehId, livId, ... }, lu, traitee, ignoree,
  //     creeLe, cooldownJusquA, ... }
  // DB shape (public.alertes_admin) :
  //   id, type (NOT NULL), niveau, titre (NOT NULL), message, contexte (jsonb),
  //   lue, resolved, resolved_at, created_at, updated_at
  // Map :
  //   message JS -> titre DB (pour respecter NOT NULL) + message DB pareil
  //   meta JS    -> contexte DB (jsonb)
  //   lu JS      -> lue DB
  //   traitee JS -> resolved DB
  function alerteJsToDb(a) {
    if (!a || typeof a !== 'object') return null;
    var titre = a.message || a.titre || a.type || 'Alerte';
    // Place metadonnees JS-only (cooldownJusquA, ignoree, traiteeLe...) dans contexte
    // a cote du meta original, pour ne rien perdre au round-trip.
    var contexte = Object.assign({}, (a.meta && typeof a.meta === 'object') ? a.meta : {});
    if (a.ignoree) contexte.__ignoree = true;
    if (a.cooldownJusquA) contexte.__cooldownJusquA = a.cooldownJusquA;
    if (a.traiteeLe) contexte.__traiteeLe = a.traiteeLe;
    if (a.luLe) contexte.__luLe = a.luLe;
    var row = {
      type: emptyToNull(a.type) || 'autre',
      niveau: emptyToNull(a.niveau) || 'info',
      titre: titre,
      message: emptyToNull(a.message),
      contexte: contexte,
      lue: safeBool(a.lu, false),
      resolved: safeBool(a.traitee, false),
      resolved_at: emptyToNull(a.traiteeLe) || (a.traitee ? (a.creeLe || null) : null)
    };
    if (isUuidLike(a.id)) row.id = a.id;
    if (a.creeLe && !isNaN(Date.parse(a.creeLe))) row.created_at = a.creeLe;
    return row;
  }
  function alerteDbToJs(r) {
    if (!r) return null;
    var contexte = (r.contexte && typeof r.contexte === 'object') ? r.contexte : {};
    var meta = {};
    Object.keys(contexte).forEach(function (k) {
      if (k.indexOf('__') !== 0) meta[k] = contexte[k];
    });
    return {
      id: r.id,
      type: r.type || '',
      niveau: r.niveau || 'info',
      message: r.message || r.titre || '',
      meta: meta,
      lu: !!r.lue,
      luLe: contexte.__luLe || '',
      traitee: !!r.resolved,
      traiteeLe: r.resolved_at || contexte.__traiteeLe || '',
      ignoree: !!contexte.__ignoree,
      cooldownJusquA: contexte.__cooldownJusquA || '',
      creeLe: r.created_at || ''
    };
  }
  window.DelivProEntityAdapters.alertes_admin = window.createSupabaseEntityAdapter({
    storageKey: 'alertes_admin',
    table: 'alertes_admin',
    channelName: 'mca-alertes-admin-sync',
    jsToDb: alerteJsToDb,
    dbToJs: alerteDbToJs,
    orderBy: 'created_at'
  });

  // ============================================================
  // ABSENCES_PERIODES
  // ============================================================
  // JS shape (script-planning.js) :
  //   { id, salId, type ('conge'|'absence'|'maladie'|'travail'), debut, fin,
  //     heureDebut, heureFin, creeLe }
  // DB shape (public.absences_periodes) :
  //   id, salarie_id (NOT NULL), type (NOT NULL), date_debut (NOT NULL),
  //   date_fin (NOT NULL), heure_debut, heure_fin, created_at, updated_at
  function absenceJsToDb(a) {
    if (!a || typeof a !== 'object') return null;
    if (!isUuidLike(a.salId)) return null;
    if (!a.debut || !a.fin) return null;
    var row = {
      salarie_id: a.salId,
      type: emptyToNull(a.type) || 'conge',
      date_debut: a.debut,
      date_fin: a.fin,
      heure_debut: emptyToNull(a.heureDebut),
      heure_fin: emptyToNull(a.heureFin)
    };
    if (isUuidLike(a.id)) row.id = a.id;
    if (a.creeLe && !isNaN(Date.parse(a.creeLe))) row.created_at = a.creeLe;
    return row;
  }
  function absenceDbToJs(r) {
    if (!r) return null;
    return {
      id: r.id,
      salId: r.salarie_id || '',
      type: r.type || 'conge',
      debut: r.date_debut || '',
      fin: r.date_fin || '',
      heureDebut: r.heure_debut || '',
      heureFin: r.heure_fin || '',
      creeLe: r.created_at || ''
    };
  }
  window.DelivProEntityAdapters.absences_periodes = window.createSupabaseEntityAdapter({
    storageKey: 'absences_periodes',
    table: 'absences_periodes',
    channelName: 'mca-absences-periodes-sync',
    jsToDb: absenceJsToDb,
    dbToJs: absenceDbToJs,
    orderBy: 'created_at'
  });

  console.info('[legacy-entity-adapters] 3 adapters initialises (inspections, alertes_admin, absences_periodes)');
})();
