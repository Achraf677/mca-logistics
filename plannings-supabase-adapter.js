/**
 * MCA Logistics - Plannings Supabase Adapter
 *
 * Sync localStorage.plannings <-> public.plannings_hebdo.
 *
 * Specificite : structure nested cote JS, flat cote DB.
 *   JS shape (script-planning.js) :
 *     { salId, salNom, semaine: [{jour, travaille, typeJour, heureDebut, heureFin, zone, note}], mis_a_jour }
 *   DB shape (public.plannings_hebdo) :
 *     id, salarie_id, jour, travaille, type_jour, heure_debut, heure_fin, zone, note
 *     (1 ligne par couple (salarie_id, jour), unique constraint dessus)
 *
 * Le nom de table != la cle localStorage : 'plannings_hebdo' vs 'plannings'.
 *
 * On ne peut pas reutiliser createSupabaseEntityAdapter directement car la
 * factory suppose une bijection 1:1 item-JS <-> ligne-DB. Ici 1 item JS =
 * jusqu'a 7 lignes DB. Adapter custom inspire du pattern factory mais flatten.
 *
 * Migration auto : si la table est vide ET le payload local non vide, push
 * tout puis pull pour re-hydrate les ids DB.
 *
 * IMPORTANT : a charger APRES supabase-client.js et AVANT script.js.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'plannings';
  var TABLE = 'plannings_hebdo';
  var FLUSH_DELAY_MS = 400;
  var BOOTSTRAP_RETRY_MS = 1500;
  var REALTIME_CHANNEL = 'mca-plannings-hebdo-sync';
  var JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

  var pendingFlushTimer = null;
  var lastSnapshot = null;
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
  function emptyToNull(v) { return (v === '' || v === undefined) ? null : v; }

  function readLocal() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function writeLocal(items) {
    suppressLocalSync = true;
    try {
      var json = JSON.stringify(Array.isArray(items) ? items : []);
      var setter = originalSetItem || Storage.prototype.setItem;
      setter.call(window.localStorage, STORAGE_KEY, json);
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: STORAGE_KEY, newValue: json,
          storageArea: window.localStorage, url: window.location.href
        }));
      } catch (_) {
        window.dispatchEvent(new CustomEvent('delivpro:storage-sync', { detail: { key: STORAGE_KEY } }));
      }
    } finally { suppressLocalSync = false; }
  }

  // ============================================================
  // Mapping flatten / unflatten
  // ============================================================
  // 1 planning JS -> N lignes DB (1 par jour)
  function planningJsToRows(p) {
    if (!p || typeof p !== 'object') return [];
    if (!isUuidLike(p.salId)) return [];
    if (!Array.isArray(p.semaine)) return [];
    return p.semaine.map(function (j) {
      if (!j || !j.jour) return null;
      return {
        salarie_id: p.salId,
        jour: String(j.jour).toLowerCase(),
        travaille: !!j.travaille,
        type_jour: emptyToNull(j.typeJour) || 'travail',
        heure_debut: emptyToNull(j.heureDebut),
        heure_fin: emptyToNull(j.heureFin),
        zone: emptyToNull(j.zone),
        note: emptyToNull(j.note)
      };
    }).filter(Boolean);
  }

  // N lignes DB -> 1 planning JS (groupes par salarie_id)
  function rowsToPlannings(rows) {
    if (!Array.isArray(rows)) return [];
    var bySal = {};
    rows.forEach(function (r) {
      if (!r || !r.salarie_id) return;
      if (!bySal[r.salarie_id]) bySal[r.salarie_id] = [];
      bySal[r.salarie_id].push(r);
    });
    return Object.keys(bySal).map(function (salId) {
      var rs = bySal[salId];
      // Cree une semaine[] dans l'ordre canonique des jours
      var semaine = JOURS.map(function (jour) {
        var r = rs.find(function (x) { return String(x.jour).toLowerCase() === jour; });
        if (!r) return { jour: jour, travaille: false, typeJour: 'repos', heureDebut: '', heureFin: '', zone: '', note: '' };
        return {
          jour: jour,
          travaille: !!r.travaille,
          typeJour: r.type_jour || 'travail',
          heureDebut: r.heure_debut || '',
          heureFin: r.heure_fin || '',
          zone: r.zone || '',
          note: r.note || ''
        };
      });
      // Recupere salNom depuis le local (denormalisation, non DB)
      var local = readLocalNoSuppress();
      var localEntry = local.find(function (p) { return p.salId === salId; });
      return {
        salId: salId,
        salNom: localEntry ? (localEntry.salNom || '') : '',
        semaine: semaine,
        mis_a_jour: localEntry ? (localEntry.mis_a_jour || '') : ''
      };
    });
  }

  function readLocalNoSuppress() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  // ============================================================
  // Pull
  // ============================================================
  async function pullAll() {
    var client = getClient();
    if (!client) return null;
    lastPullAt = Date.now();
    var res = await client.from(TABLE).select('*').order('salarie_id', { ascending: true });
    if (res.error) {
      console.warn('[plannings-adapter] pull error:', res.error.message);
      return null;
    }
    var items = rowsToPlannings(res.data || []);
    writeLocal(items);
    lastSnapshot = JSON.parse(JSON.stringify(items));
    return items;
  }

  // ============================================================
  // Migration auto : localStorage -> table (si table vide)
  // ============================================================
  async function migrateFromAppStateIfNeeded() {
    var client = getClient();
    if (!client) return false;

    var countRes = await client.from(TABLE).select('id', { count: 'exact', head: true });
    if (countRes.error) {
      console.warn('[plannings-adapter] count error:', countRes.error.message);
      return false;
    }
    if ((countRes.count || 0) > 0) return false;

    var localItems = readLocal();
    if (!localItems.length) return false;

    var rows = [];
    localItems.forEach(function (p) { rows = rows.concat(planningJsToRows(p)); });
    if (!rows.length) return false;

    console.info('[plannings-adapter] migration de', rows.length, 'lignes (', localItems.length, 'plannings) vers public.plannings_hebdo');
    var batchSize = 50;
    for (var i = 0; i < rows.length; i += batchSize) {
      var batch = rows.slice(i, i + batchSize);
      var ins = await client.from(TABLE).upsert(batch, { onConflict: 'salarie_id,jour' });
      if (ins.error) {
        console.error('[plannings-adapter] migration insert error:', ins.error.message);
        return false;
      }
    }
    return true;
  }

  // ============================================================
  // Push diff : flatten current vs lastSnapshot
  // ============================================================
  function indexBySalJour(items) {
    var idx = {};
    items.forEach(function (p) {
      planningJsToRows(p).forEach(function (r) {
        var key = r.salarie_id + '|' + r.jour;
        idx[key] = r;
      });
    });
    return idx;
  }

  async function flushDiff() {
    pendingFlushTimer = null;
    if (!initialized || suppressLocalSync) return;

    var client = getClient();
    if (!client) return;

    var current = readLocal();
    var prevIdx = indexBySalJour(lastSnapshot || []);
    var nextIdx = indexBySalJour(current);

    var upserts = [];
    var deletes = []; // { salarie_id, jour }

    Object.keys(nextIdx).forEach(function (k) {
      var nr = nextIdx[k];
      var pr = prevIdx[k];
      if (!pr || JSON.stringify(pr) !== JSON.stringify(nr)) upserts.push(nr);
    });
    Object.keys(prevIdx).forEach(function (k) {
      if (!nextIdx[k]) deletes.push(prevIdx[k]);
    });

    if (!upserts.length && !deletes.length) return;

    var ops = [];
    if (upserts.length) {
      ops.push(client.from(TABLE).upsert(upserts, { onConflict: 'salarie_id,jour' }));
    }
    // Pour les deletes : on filtre par paire (salarie_id, jour). Supabase REST ne
    // gere pas le AND multi-col en delete sur multiples lignes en 1 call, donc on
    // groupe par salarie_id et delete par jours.
    var delBySal = {};
    deletes.forEach(function (d) {
      if (!delBySal[d.salarie_id]) delBySal[d.salarie_id] = [];
      delBySal[d.salarie_id].push(d.jour);
    });
    Object.keys(delBySal).forEach(function (salId) {
      ops.push(client.from(TABLE).delete().eq('salarie_id', salId).in('jour', delBySal[salId]));
    });

    try {
      var results = await Promise.all(ops);
      var hadError = false;
      results.forEach(function (r) {
        if (r && r.error) {
          hadError = true;
          console.warn('[plannings-adapter] flush error:', r.error.message);
          if (window.MCA && window.MCA.captureException) {
            window.MCA.captureException(new Error('[adapter:plannings_hebdo] flush: ' + r.error.message), {
              upserts: upserts.length, deletes: deletes.length
            });
          }
        }
      });
      if (window.MCA && window.MCA.log) {
        window.MCA.log('sync', 'plannings_hebdo', { upserts: upserts.length, deletes: deletes.length, ok: !hadError });
      }
      if (!hadError) lastSnapshot = JSON.parse(JSON.stringify(current));
    } catch (e) {
      console.error('[plannings-adapter] flush exception:', e);
      if (window.MCA && window.MCA.captureException) {
        window.MCA.captureException(e, { table: TABLE, op: 'flush' });
      }
    }
  }

  function scheduleFlush() {
    if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
    pendingFlushTimer = window.setTimeout(function () {
      flushDiff().catch(function (e) { console.error('[plannings-adapter]', e); });
    }, FLUSH_DELAY_MS);
  }

  // ============================================================
  // Hook setItem
  // ============================================================
  function hookSetItem() {
    if (originalSetItem) return;
    originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (this === window.localStorage && key === STORAGE_KEY && initialized && !suppressLocalSync) {
        scheduleFlush();
      }
    };
  }

  // ============================================================
  // Realtime : re-pull complet (structure aggregee)
  // ============================================================
  function subscribeRealtime() {
    var client = getClient();
    if (!client) return;
    // Re-pull complet (aggregation par salarie_id necessaire)
    if (window.__mcaSharedRealtimeChannel && !window.__mcaSharedRealtimeSubscribed) {
      window.__mcaSharedRealtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function () {
        pullAll().catch(function (e) { console.warn('[plannings-adapter] realtime pull failed:', e); });
      });
      return;
    }
    if (realtimeChannel) return;
    realtimeChannel = client
      .channel(REALTIME_CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function () {
        pullAll().catch(function () {});
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
          if (lastPullAt && (now - lastPullAt) < 120000) return;
          lastPullAt = now;
          pullAll().catch(function () {});
        });
        console.info('[plannings-adapter] initialise (table public.plannings_hebdo native)');
      } catch (e) {
        console.error('[plannings-adapter] bootstrap error:', e);
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
  window.DelivProEntityAdapters.plannings = {
    bootstrap: bootstrap,
    pullAll: pullAll,
    flushDiff: flushDiff,
    isInitialized: function () { return initialized; },
    debugStatus: function () {
      return {
        table: TABLE,
        storageKey: STORAGE_KEY,
        initialized: initialized,
        hasClient: !!getClient(),
        localCount: readLocal().length,
        snapshotCount: (lastSnapshot || []).length
      };
    }
  };
})();
