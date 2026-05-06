/**
 * Entity Supabase Adapter (factory)
 *
 * Cree un adaptateur transparent qui synchronise une cle localStorage
 * avec une table Supabase, sans necessiter de modifier le code metier
 * (script.js continue d'utiliser localStorage.getItem/setItem).
 *
 * Optimisations vs clients-supabase-adapter.js (Phase 2.1) :
 *   - Utilise payload.new/payload.old du realtime event directement
 *     au lieu de re-pull complet (latence ~500ms -> ~50ms)
 *   - Sanitize/preserve fields configurables (pour base64 par ex.)
 *
 * Usage :
 *   window.createSupabaseEntityAdapter({
 *     storageKey: 'vehicules',
 *     table: 'vehicules',
 *     channelName: 'mca-vehicules-sync',
 *     jsToDb: function(item) { return { id: item.id, immat: item.immat, ... }; },
 *     dbToJs: function(row) { return { id: row.id, immat: row.immat, ... }; },
 *     preserveLocalFields: ['carteGriseFichier', 'carteGriseFichierType'],  // facultatif
 *     orderBy: 'created_at',                                                // facultatif
 *   });
 *
 * IMPORTANT : doit charger AVANT script.js et apres supabase-client.js.
 */

(function () {
  'use strict';

  if (window.createSupabaseEntityAdapter) return;

  var FLUSH_DELAY_MS = 400;
  var BOOTSTRAP_RETRY_MS = 1500;

  // ============================================================
  // CHANNEL REALTIME PARTAGE
  // ============================================================
  // Au lieu d'un channel par adapter (couteux en WebSocket), on mutualise
  // tous les listeners postgres_changes dans un seul channel global.
  // Reduit drastiquement le nombre de connexions WebSocket Supabase.
  var SHARED_CHANNEL_NAME = 'mca-shared-realtime';
  var sharedSubscribeTimer = null;

  function getSharedRealtimeChannel(client) {
    if (!client) return null;
    if (!window.__mcaSharedRealtimeChannel) {
      window.__mcaSharedRealtimeChannel = client.channel(SHARED_CHANNEL_NAME);
      window.__mcaSharedRealtimeSubscribed = false;
    }
    return window.__mcaSharedRealtimeChannel;
  }

  function scheduleSharedSubscribe() {
    if (window.__mcaSharedRealtimeSubscribed) return;
    if (sharedSubscribeTimer) clearTimeout(sharedSubscribeTimer);
    sharedSubscribeTimer = setTimeout(function () {
      if (window.__mcaSharedRealtimeSubscribed || !window.__mcaSharedRealtimeChannel) return;
      window.__mcaSharedRealtimeSubscribed = true;
      window.__mcaSharedRealtimeChannel.subscribe(function (status) {
        if (window.MCA && window.MCA.log) {
          window.MCA.log('sync', 'shared-realtime status:', status);
        }
      });
    }, 1500);
  }

  function getSupabaseClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function hasAuthSession() {
    var client = getSupabaseClient();
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

  function deepClone(obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  }

  function createAdapter(config) {
    if (!config || !config.storageKey || !config.table) {
      throw new Error('createSupabaseEntityAdapter: config.storageKey et config.table requis');
    }
    if (typeof config.jsToDb !== 'function' || typeof config.dbToJs !== 'function') {
      throw new Error('createSupabaseEntityAdapter: jsToDb et dbToJs requis');
    }

    var storageKey = config.storageKey;
    var table = config.table;
    var channelName = config.channelName || ('mca-' + table + '-sync');
    var jsToDb = config.jsToDb;
    var dbToJs = config.dbToJs;
    var preserveLocalFields = Array.isArray(config.preserveLocalFields) ? config.preserveLocalFields : [];
    var orderBy = config.orderBy || 'created_at';

    var pendingFlushTimer = null;
    var lastSnapshot = null;
    var initialized = false;
    var realtimeChannel = null;
    var suppressLocalSync = false;
    var bootstrapPromise = null;
    var lastPullAt = 0;

    // IMPORTANT : on capture originalSetItem au moment de hookSetItem (pas a l'init du adapter),
    // pour que chaque adapter s'enchaine proprement avec le hook precedent au lieu de le court-circuiter.
    var originalSetItem = null;

    function readLocal() {
      try {
        var raw = window.localStorage.getItem(storageKey);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) { return []; }
    }

    function writeLocal(items) {
      suppressLocalSync = true;
      try {
        var json = JSON.stringify(Array.isArray(items) ? items : []);
        // Si pas encore hooke, fallback sur le setItem actuel (qui peut etre un autre hook)
        var setter = originalSetItem || Storage.prototype.setItem;
        setter.call(window.localStorage, storageKey, json);
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: storageKey, newValue: json,
            storageArea: window.localStorage, url: window.location.href
          }));
        } catch (_) {
          window.dispatchEvent(new CustomEvent('delivpro:storage-sync', { detail: { key: storageKey } }));
        }
      } finally { suppressLocalSync = false; }
    }

    // Merge un item issu de la DB avec sa version locale, pour preserver les
    // champs lourds (base64, etc.) qui ne sont pas pousses cote DB.
    function mergeWithLocal(remoteItem, localItems) {
      if (!preserveLocalFields.length) return remoteItem;
      var local = (localItems || []).find(function (l) { return l && String(l.id) === String(remoteItem.id); });
      if (!local) return remoteItem;
      preserveLocalFields.forEach(function (field) {
        if (local[field] != null && remoteItem[field] == null) {
          remoteItem[field] = local[field];
        }
      });
      return remoteItem;
    }

    function normalizeIds(value) {
      try {
        var arr = JSON.parse(value);
        if (!Array.isArray(arr)) return value;
        var changed = false;
        arr.forEach(function (item) {
          if (item && (item.id == null || !isUuidLike(item.id))) {
            item.id = newUuid();
            changed = true;
          }
        });
        return changed ? JSON.stringify(arr) : value;
      } catch (_) { return value; }
    }

    async function pullAll() {
      var client = getSupabaseClient();
      if (!client) return null;
      lastPullAt = Date.now();
      var query = client.from(table).select('*');
      if (orderBy) query = query.order(orderBy, { ascending: true });
      // Filtre optionnel cote DB (pour pagination temporelle, etc.)
      // Exemple : config.pullFilter = { column: 'date_livraison', operator: 'gte', value: '2025-01-01' }
      if (config.pullFilter && config.pullFilter.column && config.pullFilter.operator) {
        query = query.filter(config.pullFilter.column, config.pullFilter.operator, config.pullFilter.value);
      }
      // Limite optionnelle (default Supabase = 1000)
      if (typeof config.pullLimit === 'number' && config.pullLimit > 0) {
        query = query.limit(config.pullLimit);
      }
      var res = await query;
      if (res.error) {
        console.warn('[' + table + '-adapter] pull error:', res.error.message);
        return null;
      }
      var localItems = readLocal();
      var items = (res.data || []).map(function (row) {
        var item = dbToJs(row);
        if (!item) return null;
        return mergeWithLocal(item, localItems);
      }).filter(Boolean);
      writeLocal(items);
      lastSnapshot = deepClone(items);
      return items;
    }

    async function migrateFromAppStateIfNeeded() {
      var client = getSupabaseClient();
      if (!client) return false;

      var countRes = await client.from(table).select('id', { count: 'exact', head: true });
      if (countRes.error) {
        console.warn('[' + table + '-adapter] count error:', countRes.error.message);
        return false;
      }
      if ((countRes.count || 0) > 0) return false;

      var localItems = readLocal();
      if (!localItems.length) return false;

      console.info('[' + table + '-adapter] migration de', localItems.length, 'items legacy vers public.' + table);
      var rows = localItems.map(jsToDb).filter(Boolean);
      var batchSize = 50;
      for (var i = 0; i < rows.length; i += batchSize) {
        var batch = rows.slice(i, i + batchSize);
        var ins = await client.from(table).insert(batch);
        if (ins.error) {
          console.error('[' + table + '-adapter] migration insert error:', ins.error.message);
          return false;
        }
      }
      return true;
    }

    function diffArrays(prev, next) {
      var prevById = {};
      (prev || []).forEach(function (it) { if (it && it.id != null) prevById[it.id] = it; });
      var nextById = {};
      (next || []).forEach(function (it) { if (it && it.id != null) nextById[it.id] = it; });

      var inserts = [];
      var updates = [];
      var deletes = [];

      Object.keys(nextById).forEach(function (id) {
        if (!prevById[id]) inserts.push(nextById[id]);
        else if (JSON.stringify(prevById[id]) !== JSON.stringify(nextById[id])) updates.push(nextById[id]);
      });
      Object.keys(prevById).forEach(function (id) {
        if (!nextById[id]) deletes.push(id);
      });
      return { inserts: inserts, updates: updates, deletes: deletes };
    }

    async function flushDiff() {
      pendingFlushTimer = null;
      if (!initialized || suppressLocalSync) return;

      var client = getSupabaseClient();
      if (!client) return;

      var current = readLocal();
      var changes = diffArrays(lastSnapshot || [], current);
      if (!changes.inserts.length && !changes.updates.length && !changes.deletes.length) return;

      var ops = [];
      var rowsToUpsert = changes.inserts.concat(changes.updates).map(jsToDb).filter(Boolean);
      if (rowsToUpsert.length) {
        ops.push(client.from(table).upsert(rowsToUpsert, { onConflict: 'id' }));
      }
      if (changes.deletes.length) {
        var validDeletes = changes.deletes.filter(isUuidLike);
        if (validDeletes.length) {
          ops.push(client.from(table).delete().in('id', validDeletes));
        }
      }

      try {
        var results = await Promise.all(ops);
        var hadError = false;
        results.forEach(function (r) {
          if (r && r.error) {
            hadError = true;
            console.warn('[' + table + '-adapter] flush error:', r.error.message);
            if (window.MCA && window.MCA.captureException) {
              window.MCA.captureException(new Error('[adapter:' + table + '] flush: ' + r.error.message), {
                table: table, inserts: changes.inserts.length, updates: changes.updates.length, deletes: changes.deletes.length
              });
            }
          }
        });
        if (window.MCA && window.MCA.log) {
          window.MCA.log('sync', table, {
            inserts: changes.inserts.length, updates: changes.updates.length,
            deletes: changes.deletes.length, ok: !hadError
          });
        }
        if (!hadError) lastSnapshot = deepClone(current);
      } catch (e) {
        console.error('[' + table + '-adapter] flush exception:', e);
        if (window.MCA && window.MCA.captureException) {
          window.MCA.captureException(e, { table: table, op: 'flush' });
        }
      }
    }

    function scheduleFlush() {
      if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
      pendingFlushTimer = window.setTimeout(function () {
        flushDiff().catch(function (e) { console.error('[' + table + '-adapter]', e); });
      }, FLUSH_DELAY_MS);
    }

    // Optimisation : appliquer le payload realtime directement au lieu de re-pull
    function applyRealtimeEvent(payload) {
      try {
        var current = readLocal();
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
        var nextItems = Object.keys(byId).map(function (k) { return byId[k]; });
        writeLocal(nextItems);
        lastSnapshot = deepClone(nextItems);
      } catch (e) {
        console.warn('[' + table + '-adapter] applyRealtimeEvent fallback to pull:', e);
        pullAll().catch(function () {});
      }
    }

    function subscribeRealtime() {
      // Option noRealtime : skip le subscribe. Pour les entites peu modifiees
      // (paiements, incidents), economise du WebSocket. Un pull au
      // visibilitychange suffit pour rafraichir.
      if (config.noRealtime) return;
      var client = getSupabaseClient();
      if (!client) return;
      // Mutualise sur le channel partage : un seul WebSocket pour toutes les tables
      var shared = getSharedRealtimeChannel(client);
      if (!shared) return;
      // Si deja subscribed, on ne peut plus ajouter de listener au meme channel.
      // Dans ce cas (rare : adapter init >1.5s apres le boot), on cree un channel dedie.
      if (window.__mcaSharedRealtimeSubscribed) {
        if (realtimeChannel) return;
        realtimeChannel = client.channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: table }, function (payload) {
            applyRealtimeEvent(payload);
          })
          .subscribe();
        return;
      }
      shared.on('postgres_changes', { event: '*', schema: 'public', table: table }, function (payload) {
        applyRealtimeEvent(payload);
      });
      scheduleSharedSubscribe();
    }

    function hookSetItem() {
      // Capture maintenant la version courante (qui peut deja etre un autre hook) pour
      // s'enchainer proprement. Si on capturait a l'IIFE, les hooks suivants nous court-circuiteraient.
      originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        var finalValue = value;
        if (this === window.localStorage && key === storageKey && initialized && !suppressLocalSync) {
          finalValue = normalizeIds(value);
        }
        originalSetItem.call(this, key, finalValue);
        if (this === window.localStorage && key === storageKey && initialized && !suppressLocalSync) {
          scheduleFlush();
        }
      };
    }

    async function bootstrap() {
      if (initialized) return;
      if (bootstrapPromise) return bootstrapPromise;

      bootstrapPromise = (async function () {
        if (!(await hasAuthSession())) return;
        try {
          await migrateFromAppStateIfNeeded();
          await pullAll();
          hookSetItem();
          initialized = true;
          subscribeRealtime();
          window.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible' || !initialized) return;
            // Throttle : max 1 pull toutes les 2 min par adapter, pour eviter
            // de recharger les memes donnees si l'user switche de tab souvent.
            // Le realtime garantit deja la sync en quasi temps reel.
            var now = Date.now();
            if (lastPullAt && (now - lastPullAt) < 120000) return;
            lastPullAt = now;
            pullAll().catch(function () {});
          });
          console.info('[' + table + '-adapter] initialise (table public.' + table + ' native, realtime ON)');
        } catch (e) {
          console.error('[' + table + '-adapter] bootstrap error:', e);
          if (window.MCA && window.MCA.captureException) {
            window.MCA.captureException(e, { table: table, op: 'bootstrap' });
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

    /**
     * Pagination cote serveur (offset-based via .range()).
     *
     * Telecharge UNIQUEMENT le slice demande (typiquement 25 a 250 lignes) au
     * lieu de pullAll() qui peut ramener des milliers de lignes a chaque
     * navigation. Le cache localStorage reste alimente par le realtime + les
     * pulls explicites pour les usages qui ont besoin de tout (rentabilite,
     * recherche full-text, agregats annuels).
     *
     * opts:
     *   - page (number, defaut 1, base 1)
     *   - pageSize (number, defaut 50, max 1000)
     *   - sort     ({ column, ascending }) defaut { column: orderBy, ascending: false }
     *   - filters  (array de { column, operator, value }) - operator au sens Supabase ('eq','gte','lte','ilike','in',...)
     *   - select   (string, defaut '*')
     *   - applyDbToJs (bool, defaut true) - si true, mappe via dbToJs
     *
     * Retour : { rows, total, page, pageSize, totalPages, error }
     */
    async function loadPage(opts) {
      opts = opts || {};
      var client = getSupabaseClient();
      if (!client) {
        return { rows: [], total: 0, page: 1, pageSize: 0, totalPages: 1, error: 'no-client' };
      }
      var page = Math.max(1, parseInt(opts.page, 10) || 1);
      var pageSize = Math.min(1000, Math.max(1, parseInt(opts.pageSize, 10) || 50));
      var sort = opts.sort || { column: orderBy || 'created_at', ascending: false };
      var filters = Array.isArray(opts.filters) ? opts.filters : [];
      var select = typeof opts.select === 'string' ? opts.select : '*';
      var applyDbToJs = opts.applyDbToJs !== false;

      var start = (page - 1) * pageSize;
      var end = start + pageSize - 1;

      var q = client.from(table).select(select, { count: 'exact' });
      filters.forEach(function (f) {
        if (!f || !f.column || !f.operator) return;
        try {
          if (f.operator === 'in' && Array.isArray(f.value)) {
            q = q.in(f.column, f.value);
          } else if (f.operator === 'is') {
            q = q.is(f.column, f.value);
          } else {
            q = q.filter(f.column, f.operator, f.value);
          }
        } catch (_) { /* ignore filter erronne */ }
      });
      if (sort && sort.column) {
        q = q.order(sort.column, { ascending: !!sort.ascending });
      }
      q = q.range(start, end);

      try {
        var res = await q;
        if (res.error) {
          console.warn('[' + table + '-adapter] loadPage error:', res.error.message);
          return { rows: [], total: 0, page: page, pageSize: pageSize, totalPages: 1, error: res.error.message };
        }
        var localItems = applyDbToJs ? readLocal() : [];
        var rows = (res.data || []).map(function (row) {
          if (!applyDbToJs) return row;
          var item = dbToJs(row);
          if (!item) return null;
          return mergeWithLocal(item, localItems);
        }).filter(Boolean);
        var total = (typeof res.count === 'number') ? res.count : rows.length;
        var totalPages = Math.max(1, Math.ceil(total / pageSize));
        return { rows: rows, total: total, page: page, pageSize: pageSize, totalPages: totalPages, error: null };
      } catch (e) {
        console.error('[' + table + '-adapter] loadPage exception:', e);
        return { rows: [], total: 0, page: page, pageSize: pageSize, totalPages: 1, error: String(e && e.message || e) };
      }
    }

    var publicApi = {
      bootstrap: bootstrap,
      pullAll: pullAll,
      loadPage: loadPage,
      flushDiff: flushDiff,
      isInitialized: function () { return initialized; },
      debugStatus: function () {
        return {
          table: table,
          storageKey: storageKey,
          initialized: initialized,
          hasClient: !!getSupabaseClient(),
          localCount: readLocal().length,
          snapshotCount: (lastSnapshot || []).length
        };
      }
    };

    return publicApi;
  }

  window.createSupabaseEntityAdapter = createAdapter;
  window.DelivProEntityAdapters = window.DelivProEntityAdapters || {};
})();
