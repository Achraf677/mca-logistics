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

  // Sanitize docs : ne JAMAIS pousser de base64 en DB. Garde uniquement les
  // references Storage (storage_path, mime, nom, taille).
  function sanitizeDocs(docs) {
    if (!docs || typeof docs !== 'object') return {};
    var clean = {};
    Object.keys(docs).forEach(function (type) {
      var d = docs[type];
      if (!d || typeof d !== 'object') return;
      // Garde uniquement les docs en Storage (data base64 = legacy local-only)
      if (d.storage_path) {
        clean[type] = {
          storage_path: d.storage_path,
          bucket: d.bucket || 'salaries-docs',
          type: d.type || null,
          nom: d.nom || null,
          taille: d.taille || null,
          uploaded_at: d.uploaded_at || null
        };
      }
    });
    return clean;
  }

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
      docs: sanitizeDocs(s.docs),
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
    var docs = (r.docs && typeof r.docs === 'object') ? r.docs : {};
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
      docs: docs,
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
    // Plus de preserveLocalFields : docs synchronise via colonne docs jsonb (metadata seules,
    // jamais le base64). Les base64 legacy sont migres vers Storage au boot (cf migrateLegacyDocsToStorage).
    orderBy: 'created_at'
  });

  // ============================================================
  // Migration automatique : docs base64 legacy -> Supabase Storage
  // ============================================================
  // S'execute UNE FOIS apres bootstrap pour migrer les docs locaux base64
  // vers le bucket salaries-docs et update salarie.docs[type] avec les metadata.
  async function migrateLegacyDocsToStorage() {
    if (sessionStorage.getItem('mca_legacy_docs_migrated_v1') === 'done') return { migrated: 0, skipped: true };
    if (!window.DelivProStorage) return { migrated: 0, skipped: true };
    var supaClient = window.DelivProSupabase && window.DelivProSupabase.getClient();
    if (!supaClient) return { migrated: 0, skipped: true };

    var raw = window.localStorage.getItem('salaries');
    if (!raw) return { migrated: 0 };
    var salaries;
    try { salaries = JSON.parse(raw); } catch (_) { return { migrated: 0 }; }
    if (!Array.isArray(salaries)) return { migrated: 0 };

    var migrated = 0;
    var changed = false;

    for (var i = 0; i < salaries.length; i += 1) {
      var sal = salaries[i];
      if (!sal || !sal.id || !sal.docs) continue;
      for (var type in sal.docs) {
        if (!Object.prototype.hasOwnProperty.call(sal.docs, type)) continue;
        var d = sal.docs[type];
        if (!d || !d.data || d.storage_path) continue;
        var cleanName = window.DelivProStorage.sanitizeFilename(d.nom || type);
        var path = sal.id + '/' + type + '/' + Date.now() + '_' + cleanName;
        try {
          var up = await window.DelivProStorage.uploadDataUrl('salaries-docs', path, d.data, { contentType: d.type });
          if (up.ok) {
            sal.docs[type] = {
              storage_path: path, bucket: 'salaries-docs',
              type: d.type || null, nom: d.nom || null,
              uploaded_at: new Date().toISOString()
            };
            changed = true;
            migrated += 1;
            try {
              await supaClient.from('salaries_documents').insert({
                salarie_id: sal.id, type: type, storage_path: path,
                mime_type: d.type, nom_fichier: d.nom
              });
            } catch (_) {}
          }
        } catch (e) {
          console.warn('[salaries-adapter] migration legacy doc echouee:', sal.id, type, e);
        }
      }
    }

    if (changed) window.localStorage.setItem('salaries', JSON.stringify(salaries));
    sessionStorage.setItem('mca_legacy_docs_migrated_v1', 'done');
    if (migrated) console.info('[salaries-adapter] ' + migrated + ' docs legacy migres vers Storage');
    return { migrated: migrated };
  }

  // Lancer la migration apres init du salaries adapter (avec petit delay
  // pour s'assurer que tout est pret cote auth/storage)
  function tryMigrate() {
    if (!adapter.isInitialized()) {
      window.setTimeout(tryMigrate, 2000);
      return;
    }
    migrateLegacyDocsToStorage().catch(function (e) { console.error('[salaries-adapter] migrate', e); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.setTimeout(tryMigrate, 3000); });
  } else {
    window.setTimeout(tryMigrate, 3000);
  }

  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
  window.DelivProEntityAdapters.salaries = adapter;
  window.DelivProSalariesAdapter = adapter;
  window.DelivProMigrateLegacyDocs = migrateLegacyDocsToStorage; // exposable en console
})();
