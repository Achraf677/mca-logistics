/**
 * MCA Logistics — Offline Queue (chauffeur)
 *
 * Permet a salarie.html de fonctionner totalement hors-ligne :
 *  - les uploads de photos (Storage) qui echouent reseau sont enfiles
 *  - on retente automatiquement au retour online (online event,
 *    visibilitychange, polling 30s si queue non vide)
 *  - photos stockees en blob IndexedDB tant que pas uploadees
 *  - fallback localStorage pour les mutations sans photo si IndexedDB KO
 *  - UI : badge "X saisies en attente" + indicateur online/offline
 *
 * Expose window.DelivProOfflineQueue :
 *   {
 *     ready,                        // Promise resolue apres init
 *     enqueueUpload({bucket, path, blob, contentType, meta}),
 *     enqueueMutation({type, target, payload, meta}),
 *     uploadOrEnqueue({bucket, path, blob, contentType, meta}),
 *                                   // tente immediat, sinon enqueue
 *     flush(),                      // force un flush manuel
 *     count(),                      // Promise<number> mutations en attente
 *     onChange(cb),                 // notifier quand queue change
 *   }
 *
 * Format entree :
 *   { id, kind:'upload'|'mutation', bucket?, path?, blobKey?, contentType?,
 *     type?, target?, payload?, meta?, attempts, nextRetryAt, error?,
 *     createdAt }
 *
 * Strategie retry exponentielle : 1s, 2s, 4s, 8s, 16s, 32s, max 60s.
 * Erreur reseau -> reessai indefini. Erreur metier -> garde en queue
 * avec flag `error` (admin pourra purger plus tard).
 */
(function () {
  'use strict';

  if (window.DelivProOfflineQueue) return;

  var DB_NAME = 'mca-offline-queue';
  var DB_VERSION = 1;
  var STORE_QUEUE = 'queue';
  var STORE_BLOBS = 'blobs';
  var LS_FALLBACK_KEY = 'mca_offline_queue_fallback';
  var POLL_INTERVAL_MS = 30 * 1000;
  var MAX_BACKOFF_MS = 60 * 1000;

  var _db = null;
  var _useFallback = false;
  var _flushing = false;
  var _changeCallbacks = [];
  var _pollTimer = null;

  /* ===== IndexedDB helpers ===== */
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('indexeddb_unavailable'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb_open_failed')); };
    });
  }

  function tx(store, mode) {
    return _db.transaction(store, mode).objectStore(store);
  }

  function idbReq(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* ===== Fallback localStorage (uniquement mutations sans blob) ===== */
  function readFallback() {
    try { return JSON.parse(localStorage.getItem(LS_FALLBACK_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function writeFallback(list) {
    try { localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(list)); }
    catch (_) { /* quota plein, on ignore */ }
  }

  /* ===== ID generation ===== */
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  /* ===== Init ===== */
  var _readyPromise = (async function init() {
    try {
      _db = await openDb();
    } catch (err) {
      console.warn('[offline-queue] IndexedDB indisponible, fallback localStorage:', err && err.message);
      _useFallback = true;
    }
    // Listeners online/offline + visibility
    window.addEventListener('online', function () { tryFlush('online'); });
    window.addEventListener('visibilitychange', function () {
      if (!document.hidden) tryFlush('visibility');
    });
    // Polling si queue non vide
    countMutations().then(function (n) {
      if (n > 0) startPolling();
    });
    // Premier flush au demarrage
    setTimeout(function () { tryFlush('init'); }, 2500);
  })();

  /* ===== CRUD queue ===== */
  async function listEntries() {
    if (_useFallback) return readFallback();
    if (!_db) return [];
    var store = tx(STORE_QUEUE, 'readonly');
    return await idbReq(store.getAll());
  }

  async function putEntry(entry) {
    if (_useFallback) {
      var list = readFallback();
      var idx = list.findIndex(function (e) { return e.id === entry.id; });
      if (idx >= 0) list[idx] = entry; else list.push(entry);
      writeFallback(list);
      return;
    }
    if (!_db) return;
    var store = tx(STORE_QUEUE, 'readwrite');
    await idbReq(store.put(entry));
  }

  async function deleteEntry(id) {
    if (_useFallback) {
      writeFallback(readFallback().filter(function (e) { return e.id !== id; }));
      return;
    }
    if (!_db) return;
    var store = tx(STORE_QUEUE, 'readwrite');
    await idbReq(store.delete(id));
  }

  async function putBlob(id, blob) {
    if (_useFallback) {
      // Pas de blob en fallback (limite localStorage). On signale.
      throw new Error('blob_unsupported_fallback');
    }
    if (!_db) throw new Error('db_unavailable');
    var store = tx(STORE_BLOBS, 'readwrite');
    await idbReq(store.put({ id: id, blob: blob }));
  }

  async function getBlob(id) {
    if (_useFallback || !_db) return null;
    var store = tx(STORE_BLOBS, 'readonly');
    var rec = await idbReq(store.get(id));
    return rec ? rec.blob : null;
  }

  async function deleteBlob(id) {
    if (_useFallback || !_db) return;
    var store = tx(STORE_BLOBS, 'readwrite');
    await idbReq(store.delete(id));
  }

  async function countMutations() {
    var list = await listEntries();
    return list.length;
  }

  /* ===== Notifications UI ===== */
  function notifyChange() {
    countMutations().then(function (n) {
      _changeCallbacks.forEach(function (cb) {
        try { cb(n); } catch (_) {}
      });
      // Demarre/arrete polling
      if (n > 0 && !_pollTimer) startPolling();
      if (n === 0 && _pollTimer) stopPolling();
    });
  }

  function onChange(cb) {
    if (typeof cb === 'function') _changeCallbacks.push(cb);
  }

  function startPolling() {
    if (_pollTimer) return;
    _pollTimer = setInterval(function () { tryFlush('poll'); }, POLL_INTERVAL_MS);
  }
  function stopPolling() {
    if (!_pollTimer) return;
    clearInterval(_pollTimer);
    _pollTimer = null;
  }

  /* ===== Public API ===== */
  async function enqueueUpload(opts) {
    await _readyPromise;
    var id = newId();
    var entry = {
      id: id,
      kind: 'upload',
      bucket: opts.bucket,
      path: opts.path,
      contentType: opts.contentType || (opts.blob && opts.blob.type) || 'application/octet-stream',
      blobKey: id,
      meta: opts.meta || null,
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    };
    if (_useFallback) {
      // Pas possible de stocker un gros blob -> on refuse, l'appelant garde la photo en base64 local
      throw new Error('blob_storage_unavailable');
    }
    try {
      await putBlob(id, opts.blob);
      await putEntry(entry);
    } catch (e) {
      throw e;
    }
    notifyChange();
    return entry;
  }

  async function enqueueMutation(opts) {
    await _readyPromise;
    var id = newId();
    var entry = {
      id: id,
      kind: 'mutation',
      type: opts.type, // 'insert' | 'update' | 'delete'
      target: opts.target, // ex 'messages_admin', 'alertes_admin', table name
      payload: opts.payload,
      meta: opts.meta || null,
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    };
    await putEntry(entry);
    notifyChange();
    return entry;
  }

  // Tente immediatement un upload, enqueue si offline ou erreur reseau
  async function uploadOrEnqueue(opts) {
    var online = navigator.onLine;
    var helper = window.DelivProStorage;

    if (online && helper && helper.uploadBlob) {
      try {
        var res = await helper.uploadBlob(opts.bucket, opts.path, opts.blob, {
          contentType: opts.contentType
        });
        if (res && res.ok) {
          return { ok: true, path: res.path, queued: false };
        }
        // Erreur reseau probable -> enqueue
        var msg = String(res && res.error && res.error.message || '').toLowerCase();
        var isNet = !msg || msg.indexOf('network') >= 0 || msg.indexOf('fetch') >= 0
          || msg.indexOf('failed') >= 0 || msg.indexOf('timeout') >= 0;
        if (!isNet) {
          // Erreur metier (RLS, bucket inexistant) -> retourne erreur sans queue
          return { ok: false, queued: false, error: res.error };
        }
      } catch (e) {
        // Probablement reseau coupe en cours d'upload
      }
    }

    // Offline ou erreur reseau -> enqueue
    try {
      await enqueueUpload(opts);
      return { ok: true, path: opts.path, queued: true };
    } catch (qErr) {
      return { ok: false, queued: false, error: qErr };
    }
  }

  /* ===== Flush ===== */
  async function tryFlush(reason) {
    if (_flushing) return;
    if (!navigator.onLine) return;
    _flushing = true;
    try {
      var entries = await listEntries();
      // Trier par createdAt (FIFO), respecter nextRetryAt
      entries.sort(function (a, b) { return a.createdAt - b.createdAt; });
      var now = Date.now();
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.nextRetryAt && entry.nextRetryAt > now) continue;
        if (!navigator.onLine) break;
        try {
          await processEntry(entry);
          await deleteEntry(entry.id);
          if (entry.kind === 'upload') await deleteBlob(entry.id);
        } catch (err) {
          var msg = String(err && err.message || err || '').toLowerCase();
          var isBusiness = msg.indexOf('row-level') >= 0 || msg.indexOf('permission') >= 0
            || msg.indexOf('not found') >= 0 || msg.indexOf('invalid') >= 0
            || msg.indexOf('unauthorized') >= 0;
          entry.attempts = (entry.attempts || 0) + 1;
          var backoff = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, entry.attempts - 1));
          entry.nextRetryAt = Date.now() + backoff;
          entry.error = String(err && err.message || err);
          entry.businessError = !!isBusiness;
          await putEntry(entry);
          if (isBusiness) {
            // Notifier admin via alerte locale (sera sync par storage-sync)
            try { notifyBusinessError(entry); } catch (_) {}
          }
          // Continue avec les autres
        }
      }
    } finally {
      _flushing = false;
      notifyChange();
    }
  }

  function notifyBusinessError(entry) {
    try {
      var alertes = JSON.parse(localStorage.getItem('alertes_admin') || '[]');
      // dedup par entry id
      if (alertes.some(function (a) { return a.meta && a.meta.queueEntryId === entry.id; })) return;
      alertes.push({
        id: 'oq_' + entry.id,
        type: 'sync_error',
        message: '⚠️ Synchro chauffeur en echec : ' + (entry.kind === 'upload' ? 'upload ' + entry.bucket : 'mutation ' + entry.target) + ' (' + entry.error + ')',
        meta: { queueEntryId: entry.id, attempts: entry.attempts },
        lu: false, traitee: false, creeLe: new Date().toISOString()
      });
      localStorage.setItem('alertes_admin', JSON.stringify(alertes));
    } catch (_) {}
  }

  async function processEntry(entry) {
    if (entry.kind === 'upload') {
      var helper = window.DelivProStorage;
      if (!helper || !helper.uploadBlob) throw new Error('storage_helper_unavailable');
      var blob = await getBlob(entry.id);
      if (!blob) {
        // Blob disparu -> on jette l'entree
        return;
      }
      var res = await helper.uploadBlob(entry.bucket, entry.path, blob, {
        contentType: entry.contentType
      });
      if (!res || !res.ok) {
        throw new Error((res && res.error && res.error.message) || 'upload_failed');
      }
      // Succes -> notifier listeners metier (ex maj photoRecuPath dans localStorage)
      if (entry.meta && entry.meta.onSuccess) {
        try {
          var fnName = entry.meta.onSuccess;
          if (typeof window[fnName] === 'function') {
            window[fnName](entry.meta, res.path);
          }
        } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('delivpro:offline-queue:flushed', {
        detail: { entry: entry, result: res }
      }));
      return;
    }

    if (entry.kind === 'mutation') {
      var client = (window.DelivProSupabase && window.DelivProSupabase.getClient)
        ? window.DelivProSupabase.getClient() : null;
      if (!client) throw new Error('supabase_client_unavailable');
      if (!entry.target || !entry.type) throw new Error('mutation_invalid');
      var qb = client.from(entry.target);
      var r;
      if (entry.type === 'insert') r = await qb.insert(entry.payload);
      else if (entry.type === 'update') {
        var match = (entry.meta && entry.meta.match) || { id: entry.payload && entry.payload.id };
        r = await qb.update(entry.payload).match(match);
      } else if (entry.type === 'delete') {
        var dmatch = (entry.meta && entry.meta.match) || { id: entry.payload && entry.payload.id };
        r = await qb.delete().match(dmatch);
      } else {
        throw new Error('mutation_type_inconnu');
      }
      if (r && r.error) throw new Error(r.error.message || 'mutation_failed');
      window.dispatchEvent(new CustomEvent('delivpro:offline-queue:flushed', {
        detail: { entry: entry, result: r }
      }));
      return;
    }

    throw new Error('entry_kind_inconnu');
  }

  /* ===== Expose ===== */
  window.DelivProOfflineQueue = {
    ready: _readyPromise,
    enqueueUpload: enqueueUpload,
    enqueueMutation: enqueueMutation,
    uploadOrEnqueue: uploadOrEnqueue,
    flush: function () { return tryFlush('manual'); },
    count: countMutations,
    onChange: onChange,
    isUsingFallback: function () { return _useFallback; },
  };
})();
