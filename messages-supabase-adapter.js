/**
 * MCA Logistics - Messages Supabase Adapter (multi-key)
 *
 * Sync localStorage 'messages_<salId>' <-> public.messages.
 *
 * Pattern multi-key : N cles localStorage (1 par chauffeur, ex 'messages_abc-123')
 * mappees vers UNE seule table public.messages avec colonnes auteur_role,
 * auteur_salarie_id, destinataire_salarie_id pour discriminer.
 *
 * JS shape (script-salarie.js, script-incidents.js, script-planning.js) :
 *   Cle : 'messages_' + salId
 *   { id, auteur ('admin'|'salarie'), salNom?, texte, photo?, photoPath?,
 *     photoBucket?, fichier?, nomFichier?, lu, luLe?, auto?, creeLe }
 *
 * DB shape (public.messages) :
 *   id, auteur_role (NOT NULL), auteur_salarie_id, destinataire_role,
 *   destinataire_salarie_id, texte (NOT NULL), lu, deleted_by_admin,
 *   deleted_by_salarie, created_at, photo_path, photo_mime, delivered_at
 *
 * Mapping conversation cle <-> rangees DB :
 *   - messages_<salId> regroupe TOUS les echanges admin <-> ce salarie
 *   - Une rangee DB appartient a la conversation salId si :
 *       (auteur_role='salarie' AND auteur_salarie_id=salId)
 *       OR (destinataire_role='salarie' AND destinataire_salarie_id=salId)
 *   - Quand auteur='admin' : auteur_role='admin', auteur_salarie_id=null,
 *     destinataire_role='salarie', destinataire_salarie_id=salId
 *   - Quand auteur='salarie' : auteur_role='salarie', auteur_salarie_id=salId,
 *     destinataire_role='admin', destinataire_salarie_id=null
 *
 * Photos base64 (m.photo) restent en local (preserveLocalFields). Le path
 * Storage (m.photoPath) est sync sur photo_path.
 *
 * IMPORTANT : a charger APRES supabase-client.js et AVANT script.js.
 */

(function () {
  'use strict';

  var KEY_PREFIX = 'messages_';
  var TABLE = 'messages';
  var FLUSH_DELAY_MS = 400;
  var BOOTSTRAP_RETRY_MS = 1500;
  var REALTIME_CHANNEL = 'mca-messages-sync';

  // snapshots[salId] = JSON snapshot precedent pour cette cle
  var snapshots = {};
  // Timer flush par salId
  var flushTimers = {};
  var initialized = false;
  var realtimeChannel = null;
  var suppressLocalSync = false;
  var bootstrapPromise = null;
  var lastPullAt = 0;
  var originalSetItem = null;

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function hasSession() {
    var client = getClient();
    if (!client) return false;
    try {
      var r = await client.auth.getSession();
      return !!(r && r.data && r.data.session && r.data.session.user);
    } catch (_) { return false; }
  }

  function isUuidLike(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
  function newUuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (_) {}
    }
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function isMessageKey(key) {
    return typeof key === 'string' && key.indexOf(KEY_PREFIX) === 0 && key.length > KEY_PREFIX.length;
  }
  function salIdFromKey(key) { return key.substring(KEY_PREFIX.length); }
  function keyForSalId(salId) { return KEY_PREFIX + salId; }

  function readLocal(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function writeLocal(key, items) {
    suppressLocalSync = true;
    try {
      var json = JSON.stringify(Array.isArray(items) ? items : []);
      var setter = originalSetItem || Storage.prototype.setItem;
      setter.call(window.localStorage, key, json);
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: key, newValue: json,
          storageArea: window.localStorage, url: window.location.href
        }));
      } catch (_) {
        window.dispatchEvent(new CustomEvent('delivpro:storage-sync', { detail: { key: key } }));
      }
    } finally { suppressLocalSync = false; }
  }

  // Liste toutes les cles messages_* presentes en localStorage
  function listMessageKeys() {
    var keys = [];
    for (var i = 0; i < window.localStorage.length; i += 1) {
      var k = window.localStorage.key(i);
      if (isMessageKey(k)) keys.push(k);
    }
    return keys;
  }

  // ============================================================
  // Mapping JS <-> DB (cote salId conversation)
  // ============================================================
  function jsToDb(m, salId) {
    if (!m || typeof m !== 'object' || !salId) return null;
    if (!m.texte && !m.photo && !m.photoPath && !m.fichier) return null;
    var isAdmin = m.auteur === 'admin';
    var row = {
      auteur_role: isAdmin ? 'admin' : 'salarie',
      auteur_salarie_id: isAdmin ? null : (isUuidLike(salId) ? salId : null),
      destinataire_role: isAdmin ? 'salarie' : 'admin',
      destinataire_salarie_id: isAdmin ? (isUuidLike(salId) ? salId : null) : null,
      texte: m.texte || (m.photoPath ? '[photo]' : (m.fichier ? '[fichier]' : '')),
      lu: !!m.lu,
      photo_path: m.photoPath || null,
      photo_mime: m.photoMime || (m.photoPath ? 'image/jpeg' : null)
    };
    if (m.luLe && !isNaN(Date.parse(m.luLe))) row.delivered_at = m.luLe;
    if (isUuidLike(m.id)) row.id = m.id;
    if (m.creeLe && !isNaN(Date.parse(m.creeLe))) row.created_at = m.creeLe;
    return row;
  }

  function dbToJs(r) {
    if (!r || typeof r !== 'object') return null;
    var isAdmin = r.auteur_role === 'admin';
    return {
      id: r.id,
      auteur: isAdmin ? 'admin' : 'salarie',
      texte: r.texte || '',
      photoPath: r.photo_path || null,
      photoBucket: r.photo_path ? 'messages-photos' : null,
      photoMime: r.photo_mime || null,
      lu: !!r.lu,
      luLe: r.delivered_at || '',
      creeLe: r.created_at || ''
      // photo (base64), fichier, nomFichier, salNom, auto : champs purement locaux
    };
  }

  // Determine le salId de la conversation pour une rangee DB
  function rowToConvSalId(r) {
    if (!r) return null;
    if (r.auteur_role === 'salarie' && r.auteur_salarie_id) return r.auteur_salarie_id;
    if (r.destinataire_role === 'salarie' && r.destinataire_salarie_id) return r.destinataire_salarie_id;
    return null;
  }

  // Merge avec local pour preserver photo base64, fichier, salNom, auto, etc.
  function mergeWithLocal(remoteItem, localItems) {
    if (!localItems || !localItems.length) return remoteItem;
    var local = localItems.find(function (l) { return l && String(l.id) === String(remoteItem.id); });
    if (!local) return remoteItem;
    ['photo', 'fichier', 'nomFichier', 'salNom', 'auto'].forEach(function (f) {
      if (local[f] != null && remoteItem[f] == null) remoteItem[f] = local[f];
    });
    return remoteItem;
  }

  // ============================================================
  // Pull : SELECT * et regroupement par salId conversation
  // ============================================================
  async function pullAll() {
    var client = getClient();
    if (!client) return null;
    lastPullAt = Date.now();
    var res = await client.from(TABLE).select('*').order('created_at', { ascending: true });
    if (res.error) {
      console.warn('[messages-adapter] pull error:', res.error.message);
      return null;
    }
    var bySal = {};
    (res.data || []).forEach(function (r) {
      var salId = rowToConvSalId(r);
      if (!salId) return;
      if (!bySal[salId]) bySal[salId] = [];
      var item = dbToJs(r);
      if (item) bySal[salId].push(item);
    });
    // Ecrire chaque conversation en localStorage et update snapshot
    Object.keys(bySal).forEach(function (salId) {
      var key = keyForSalId(salId);
      var localItems = readLocal(key);
      var merged = bySal[salId].map(function (it) { return mergeWithLocal(it, localItems); });
      writeLocal(key, merged);
      snapshots[salId] = JSON.parse(JSON.stringify(merged));
    });
    return bySal;
  }

  // ============================================================
  // Migration : si la table est vide globalement, push tout le local
  // ============================================================
  async function migrateFromAppStateIfNeeded() {
    var client = getClient();
    if (!client) return false;
    var countRes = await client.from(TABLE).select('id', { count: 'exact', head: true });
    if (countRes.error) {
      console.warn('[messages-adapter] count error:', countRes.error.message);
      return false;
    }
    if ((countRes.count || 0) > 0) return false;

    var keys = listMessageKeys();
    if (!keys.length) return false;

    var rows = [];
    keys.forEach(function (key) {
      var salId = salIdFromKey(key);
      if (!isUuidLike(salId)) return;
      var items = readLocal(key);
      items.forEach(function (m) {
        // Genere un UUID si absent ou non-UUID (legacy ids type Date.now().toString(36))
        if (!isUuidLike(m.id)) m.id = newUuid();
        var row = jsToDb(m, salId);
        if (row) rows.push(row);
      });
      // Re-write local avec les ids normalises
      writeLocal(key, items);
    });
    if (!rows.length) return false;

    console.info('[messages-adapter] migration de', rows.length, 'messages vers public.messages');
    var batchSize = 50;
    for (var i = 0; i < rows.length; i += batchSize) {
      var batch = rows.slice(i, i + batchSize);
      var ins = await client.from(TABLE).insert(batch);
      if (ins.error) {
        console.error('[messages-adapter] migration insert error:', ins.error.message);
        return false;
      }
    }
    return true;
  }

  // ============================================================
  // Push diff par salId
  // ============================================================
  function diffArrays(prev, next) {
    var prevById = {};
    (prev || []).forEach(function (it) { if (it && it.id != null) prevById[it.id] = it; });
    var nextById = {};
    (next || []).forEach(function (it) { if (it && it.id != null) nextById[it.id] = it; });
    var inserts = [], updates = [], deletes = [];
    Object.keys(nextById).forEach(function (id) {
      if (!prevById[id]) inserts.push(nextById[id]);
      else if (JSON.stringify(prevById[id]) !== JSON.stringify(nextById[id])) updates.push(nextById[id]);
    });
    Object.keys(prevById).forEach(function (id) { if (!nextById[id]) deletes.push(id); });
    return { inserts: inserts, updates: updates, deletes: deletes };
  }

  async function flushDiffForSal(salId) {
    delete flushTimers[salId];
    if (!initialized || suppressLocalSync) return;
    var client = getClient();
    if (!client) return;

    var key = keyForSalId(salId);
    var current = readLocal(key);
    var prev = snapshots[salId] || [];
    var changes = diffArrays(prev, current);
    if (!changes.inserts.length && !changes.updates.length && !changes.deletes.length) return;

    var ops = [];
    var rowsToUpsert = changes.inserts.concat(changes.updates)
      .map(function (m) { return jsToDb(m, salId); })
      .filter(Boolean);
    if (rowsToUpsert.length) {
      ops.push(client.from(TABLE).upsert(rowsToUpsert, { onConflict: 'id' }));
    }
    if (changes.deletes.length) {
      var validDeletes = changes.deletes.filter(isUuidLike);
      if (validDeletes.length) {
        ops.push(client.from(TABLE).delete().in('id', validDeletes));
      }
    }

    try {
      var results = await Promise.all(ops);
      var hadError = false;
      results.forEach(function (r) {
        if (r && r.error) {
          hadError = true;
          console.warn('[messages-adapter] flush error (' + salId + '):', r.error.message);
          if (window.MCA && window.MCA.captureException) {
            window.MCA.captureException(new Error('[adapter:messages] flush: ' + r.error.message), {
              salId: salId,
              inserts: changes.inserts.length, updates: changes.updates.length, deletes: changes.deletes.length
            });
          }
        }
      });
      if (window.MCA && window.MCA.log) {
        window.MCA.log('sync', 'messages/' + salId, {
          inserts: changes.inserts.length, updates: changes.updates.length,
          deletes: changes.deletes.length, ok: !hadError
        });
      }
      if (!hadError) snapshots[salId] = JSON.parse(JSON.stringify(current));
    } catch (e) {
      console.error('[messages-adapter] flush exception:', e);
    }
  }

  function scheduleFlush(salId) {
    if (flushTimers[salId]) window.clearTimeout(flushTimers[salId]);
    flushTimers[salId] = window.setTimeout(function () {
      flushDiffForSal(salId).catch(function (e) { console.error('[messages-adapter]', e); });
    }, FLUSH_DELAY_MS);
  }

  // ============================================================
  // Hook setItem
  // ============================================================
  // Normalise les ids non-UUID en UUID avant store, pour que les references DB tiennent.
  function normalizeIds(value) {
    try {
      var arr = JSON.parse(value);
      if (!Array.isArray(arr)) return value;
      var changed = false;
      arr.forEach(function (m) {
        if (m && (m.id == null || !isUuidLike(m.id))) { m.id = newUuid(); changed = true; }
      });
      return changed ? JSON.stringify(arr) : value;
    } catch (_) { return value; }
  }

  function hookSetItem() {
    if (originalSetItem) return;
    originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      var finalValue = value;
      if (this === window.localStorage && isMessageKey(key) && initialized && !suppressLocalSync) {
        finalValue = normalizeIds(value);
      }
      originalSetItem.call(this, key, finalValue);
      if (this === window.localStorage && isMessageKey(key) && initialized && !suppressLocalSync) {
        scheduleFlush(salIdFromKey(key));
      }
    };
  }

  // ============================================================
  // Realtime : on re-pull la conversation impactee
  // ============================================================
  function applyRealtimeEvent(payload) {
    try {
      var record = payload.new || payload.old;
      if (!record) return;
      var salId = rowToConvSalId(record);
      if (!salId) return;
      var key = keyForSalId(salId);
      var current = readLocal(key);
      var byId = {};
      current.forEach(function (it) { if (it && it.id != null) byId[it.id] = it; });

      if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
        delete byId[payload.old.id];
      } else if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
        var item = dbToJs(payload.new);
        if (item) {
          item = mergeWithLocal(item, current);
          byId[item.id] = item;
        }
      }
      var nextItems = Object.keys(byId).map(function (k) { return byId[k]; })
        .sort(function (a, b) { return new Date(a.creeLe || 0) - new Date(b.creeLe || 0); });
      writeLocal(key, nextItems);
      snapshots[salId] = JSON.parse(JSON.stringify(nextItems));
    } catch (e) {
      console.warn('[messages-adapter] applyRealtimeEvent fallback to pull:', e);
      pullAll().catch(function () {});
    }
  }

  function subscribeRealtime() {
    var client = getClient();
    if (!client) return;
    if (window.__mcaSharedRealtimeChannel && !window.__mcaSharedRealtimeSubscribed) {
      window.__mcaSharedRealtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function (payload) {
        applyRealtimeEvent(payload);
      });
      return;
    }
    if (realtimeChannel) return;
    realtimeChannel = client
      .channel(REALTIME_CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function (payload) {
        applyRealtimeEvent(payload);
      })
      .subscribe();
  }

  // ============================================================
  // Bootstrap
  // ============================================================
  async function bootstrap() {
    if (initialized) return;
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async function () {
      if (!(await hasSession())) return;
      try {
        await migrateFromAppStateIfNeeded();
        await pullAll();
        hookSetItem();
        initialized = true;
        subscribeRealtime();
        window.addEventListener('visibilitychange', function () {
          if (document.visibilityState !== 'visible' || !initialized) return;
          var now = Date.now();
          if (lastPullAt && (now - lastPullAt) < 60000) return;
          lastPullAt = now;
          pullAll().catch(function () {});
        });
        console.info('[messages-adapter] initialise (table public.messages native, multi-key)');
      } catch (e) {
        console.error('[messages-adapter] bootstrap error:', e);
        if (window.MCA && window.MCA.captureException) {
          window.MCA.captureException(e, { table: TABLE, op: 'bootstrap' });
        }
      }
    })();

    try { return await bootstrapPromise; }
    finally { bootstrapPromise = null; }
  }

  function tryBootstrapLoop() {
    bootstrap().then(function () {
      if (!initialized) window.setTimeout(tryBootstrapLoop, BOOTSTRAP_RETRY_MS);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBootstrapLoop);
  } else {
    tryBootstrapLoop();
  }

  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
  window.DelivProEntityAdapters.messages = {
    bootstrap: bootstrap,
    pullAll: pullAll,
    flushDiffForSal: flushDiffForSal,
    isInitialized: function () { return initialized; },
    debugStatus: function () {
      var keys = listMessageKeys();
      return {
        table: TABLE,
        keyPrefix: KEY_PREFIX,
        initialized: initialized,
        hasClient: !!getClient(),
        conversations: keys.length,
        snapshotCount: Object.keys(snapshots).length
      };
    }
  };
})();
