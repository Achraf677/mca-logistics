/**
 * Salaries Supabase Adapter — Phase 2.3
 *
 * Synchronisation transparente localStorage.salaries <-> public.salaries.
 *
 * Specificites :
 *   - JS shape : nom (= nomComplet concat), nomFamille, prenom -> on garde nom comme
 *     champ canonique cote DB et nom_famille en complement
 *   - visiteMedicale (sous-objet { date, aptitude, dateExpiration }) en JSONB
 *   - docs (CNI, IBAN, permis... base64 lourds) restent en localStorage
 *     (Phase 3 migrera vers la table salaries_documents + Storage)
 *   - mdpHash sync vers la DB (necessaire pour login multi-device)
 *
 * IMPORTANT : a charger APRES entity-supabase-adapter.js et AVANT script.js.
 */

(function () {
  'use strict';

  if (!window.createSupabaseEntityAdapter) {
    console.error('[salaries-adapter] createSupabaseEntityAdapter non disponible');
    return;
  }

  function isUuidLike(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
  function emptyToNull(v) { return (v === '' || v === undefined) ? null : v; }

  function jsToDb(s) {
    if (!s || typeof s !== 'object') return null;
    if (!s.numero) return null;

    var vm = (s.visiteMedicale && typeof s.visiteMedicale === 'object') ? s.visiteMedicale : {};

    var row = {
      numero: String(s.numero),
      nom: s.nom || s.nomFamille || '',
      nom_famille: emptyToNull(s.nomFamille),
      prenom: emptyToNull(s.prenom),
      poste: emptyToNull(s.poste),
      permis: emptyToNull(s.permis),
      categorie_permis: emptyToNull(s.categoriePermis),
      date_permis: emptyToNull(s.datePermis),
      assurance: emptyToNull(s.assurance),
      date_assurance: emptyToNull(s.dateAssurance),
      telephone: emptyToNull(s.tel),
      email: emptyToNull(s.email),
      email_personnel: emptyToNull(s.emailPersonnel),
      mdp_hash: emptyToNull(s.mdpHash),
      visite_medicale: vm,
      actif: s.actif !== false
    };

    if (isUuidLike(s.id)) row.id = s.id;
    if (s.profileId && isUuidLike(s.profileId)) row.profile_id = s.profileId;
    if (s.creeLe && !isNaN(Date.parse(s.creeLe))) row.created_at = s.creeLe;
    return row;
  }

  function dbToJs(r) {
    if (!r || typeof r !== 'object') return null;
    var vm = (r.visite_medicale && typeof r.visite_medicale === 'object') ? r.visite_medicale : {};
    return {
      id: r.id,
      supabaseId: r.id,
      profileId: r.profile_id || '',
      numero: r.numero || '',
      nom: r.nom || '',
      nomFamille: r.nom_famille || '',
      prenom: r.prenom || '',
      poste: r.poste || '',
      permis: r.permis || '',
      categoriePermis: r.categorie_permis || '',
      datePermis: r.date_permis || '',
      assurance: r.assurance || '',
      dateAssurance: r.date_assurance || '',
      tel: r.telephone || '',
      email: r.email || '',
      emailPersonnel: r.email_personnel || '',
      mdpHash: r.mdp_hash || '',
      visiteMedicale: vm,
      actif: r.actif !== false,
      creeLe: r.created_at || ''
    };
  }

  var adapter = window.createSupabaseEntityAdapter({
    storageKey: 'salaries',
    table: 'salaries',
    channelName: 'mca-salaries-sync',
    jsToDb: jsToDb,
    dbToJs: dbToJs,
    preserveLocalFields: ['docs'],  // CNI/IBAN/permis base64 -> Phase 3 Storage
    orderBy: 'created_at'
  });

  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
  window.DelivProEntityAdapters.salaries = adapter;
  window.DelivProSalariesAdapter = adapter;
})();
