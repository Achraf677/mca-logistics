/**
 * Clients Supabase Adapter — Phase 2.1
 *
 * Synchronisation transparente entre `localStorage.clients` et `public.clients`.
 * Le code legacy de script.js continue d'utiliser `localStorage.getItem('clients')`
 * et `localStorage.setItem('clients', ...)` SANS modification.
 *
 * Sous le capot :
 *   - Au boot : SELECT * FROM public.clients -> hydrate localStorage.clients
 *               (si table vide ET app_state.payload.clients non vide -> migration auto)
 *   - À chaque setItem('clients', ...) : diff avec snapshot precedent
 *                                      -> UPSERT/DELETE cibles dans public.clients
 *   - Realtime : subscription sur public.clients -> re-hydrate localStorage
 *
 * Avantages :
 *   - Code metier inchange (zero modif script.js)
 *   - Egress reduit drastiquement : on push uniquement les diffs (pas tout app_state)
 *   - Queries cote DB possibles (pour rapports, exports, RLS)
 *   - Realtime cible (changement client X -> notif uniquement, pas tout app_state)
 *
 * IMPORTANT : ce module DOIT charger AVANT script.js et apres supabase-client.js.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'clients';
  var TABLE = 'clients';
  var FLUSH_DELAY_MS = 400;
  var REALTIME_CHANNEL = 'mca-clients-sync';

  var pendingFlushTimer = null;
  var lastSnapshot = null;
  var initialized = false;
  var realtimeChannel = null;
  var suppressLocalSync = false;
  var bootstrapPromise = null;

  // Capture differee : initialise dans hookSetItem pour s'enchainer correctement
  // avec les autres adapters (sinon ils nous court-circuitent).
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
          key: STORAGE_KEY,
          newValue: json,
          storageArea: window.localStorage,
          url: window.location.href
        }));
      } catch (_) {
        window.dispatchEvent(new CustomEvent('delivpro:storage-sync', { detail: { key: STORAGE_KEY } }));
      }
    } finally {
      suppressLocalSync = false;
    }
  }

  // ============================================================
  // Mapping JS <-> DB
  // ============================================================
  // JS shape (source script.js ajouterClient) :
  //   { id, nom, prenom, contact, tel, email, adresse, cp, ville, type ('pro'|'particulier'),
  //     siren, tvaIntra, emailFact, delaiPaiementJours, notes, creeLe }
  // DB shape (public.clients) :
  //   id, nom, prenom, contact, telephone, email, adresse, cp, ville, type,
  //   siren, tva_intracom, email_fact, delai_paiement_jours, notes, pays, secteur,
  //   tva_intracom, created_at, updated_at

  function isUuidLike(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }

  function jsToDb(c) {
    if (!c || typeof c !== 'object') return null;
    var row = {
      nom: c.nom || '',
      prenom: c.prenom || null,
      contact: c.contact || null,
      telephone: c.tel || c.telephone || null,
      email: c.email || null,
      adresse: c.adresse || null,
      cp: c.cp || null,
      ville: c.ville || null,
      type: c.type || null,
      siren: c.siren || null,
      tva_intracom: c.tvaIntra || c.tva_intracom || null,
      email_fact: c.emailFact || c.email_fact || null,
      delai_paiement_jours: (typeof c.delaiPaiementJours === 'number' ? c.delaiPaiementJours
                            : typeof c.delai_paiement_jours === 'number' ? c.delai_paiement_jours
                            : null),
      pays: c.pays || null,
      secteur: c.secteur || null,
      notes: c.notes || null
    };
    if (isUuidLike(c.id)) row.id = c.id;
    if (c.creeLe && !isNaN(Date.parse(c.creeLe))) row.created_at = c.creeLe;
    return row;
  }

  function dbToJs(row) {
    if (!row || typeof row !== 'object') return null;
    return {
      id: row.id,
      nom: row.nom || '',
      prenom: row.prenom || '',
      contact: row.contact || row.prenom || '',
      tel: row.telephone || '',
      email: row.email || '',
      adresse: row.adresse || '',
      cp: row.cp || '',
      ville: row.ville || '',
      type: row.type || 'pro',
      siren: row.siren || '',
      tvaIntra: row.tva_intracom || '',
      emailFact: row.email_fact || '',
      delaiPaiementJours: (row.delai_paiement_jours == null ? 30 : row.delai_paiement_jours),
      pays: row.pays || '',
      secteur: row.secteur || '',
      notes: row.notes || '',
      creeLe: row.created_at || ''
    };
  }

  // ============================================================
  // Pull (table -> localStorage)
  // ============================================================
  async function pullAll() {
    var client = getClient();
    if (!client) return null;
    var res = await client.from(TABLE).select('*').order('created_at', { ascending: true });
    if (res.error) {
      console.warn('[clients-adapter] pull error:', res.error.message);
      return null;
    }
    var items = (res.data || []).map(dbToJs).filter(Boolean);
    writeLocal(items);
    lastSnapshot = JSON.parse(JSON.stringify(items));
    return items;
  }

  // ============================================================
  // Migration auto : app_state.payload.clients -> public.clients (si table vide)
  // ============================================================
  async function migrateFromAppStateIfNeeded() {
    var client = getClient();
    if (!client) return false;

    var countRes = await client.from(TABLE).select('id', { count: 'exact', head: true });
    if (countRes.error) {
      console.warn('[clients-adapter] count error:', countRes.error.message);
      return false;
    }
    if ((countRes.count || 0) > 0) return false;

    var localItems = readLocal();
    if (!localItems.length) return false;

    console.info('[clients-adapter] migration de', localItems.length, 'clients depuis localStorage vers public.clients');
    var rows = localItems.map(jsToDb).filter(Boolean);
    var batchSize = 50;
    for (var i = 0; i < rows.length; i += batchSize) {
      var batch = rows.slice(i, i + batchSize);
      var ins = await client.from(TABLE).insert(batch);
      if (ins.error) {
        console.error('[clients-adapter] migration insert error:', ins.error.message);
        return false;
      }
    }
    return true;
  }

  // ============================================================
  // Push (localStorage diff -> table)
  // ============================================================
  function diff(prev, next) {
    var prevById = {};
    (prev || []).forEach(function (c) { if (c && c.id != null) prevById[c.id] = c; });
    var nextById = {};
    (next || []).forEach(function (c) { if (c && c.id != null) nextById[c.id] = c; });

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

    var client = getClient();
    if (!client) return;

    var current = readLocal();
    var changes = diff(lastSnapshot || [], current);

    if (!changes.inserts.length && !changes.updates.length && !changes.deletes.length) return;

    var ops = [];
    var rowsToUpsert = changes.inserts.concat(changes.updates).map(jsToDb).filter(Boolean);
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
        if (r && r.error) { hadError = true; console.warn('[clients-adapter] flush error:', r.error.message); }
      });
      if (!hadError) {
        lastSnapshot = JSON.parse(JSON.stringify(current));
      }
    } catch (e) {
      console.error('[clients-adapter] flush exception:', e);
    }
  }

  function scheduleFlush() {
    if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
    pendingFlushTimer = window.setTimeout(function () {
      flushDiff().catch(function (e) { console.error('[clients-adapter]', e); });
    }, FLUSH_DELAY_MS);
  }

  // ============================================================
  // Hook localStorage.setItem('clients', ...)
  // ============================================================
  // Normalise les ids non-UUID en UUID AVANT le store, pour que les references
  // (livraisons.clientId, etc.) restent stables apres round-trip avec la DB.
  function normalizeIds(value) {
    try {
      var arr = JSON.parse(value);
      if (!Array.isArray(arr)) return value;
      var changed = false;
      arr.forEach(function (c) {
        if (c && (c.id == null || !isUuidLike(c.id))) {
          var newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
          c.id = newId;
          changed = true;
        }
      });
      return changed ? JSON.stringify(arr) : value;
    } catch (_) { return value; }
  }

  // Hook installe au boot (apres init) plutot qu'a l'IIFE pour s'enchainer
  // proprement avec les hooks d'autres adapters (sinon ils nous court-circuitent).
  function installSetItemHook() {
    if (originalSetItem) return; // deja installe
    originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      var finalValue = value;
      if (this === window.localStorage && key === STORAGE_KEY && initialized && !suppressLocalSync) {
        finalValue = normalizeIds(value);
      }
      originalSetItem.call(this, key, finalValue);
      if (this === window.localStorage && key === STORAGE_KEY && initialized && !suppressLocalSync) {
        scheduleFlush();
      }
    };
  }

  // ============================================================
  // Realtime
  // ============================================================
  function subscribeRealtime() {
    var client = getClient();
    if (!client) return;
    // Mutualise sur le channel partage cree par entity-supabase-adapter.js
    if (window.__mcaSharedRealtimeChannel && !window.__mcaSharedRealtimeSubscribed) {
      window.__mcaSharedRealtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function () {
        pullAll().catch(function (e) { console.warn('[clients-adapter] realtime pull failed:', e); });
      });
      return;
    }
    // Fallback : channel dedie si shared deja subscribed ou pas dispo
    if (realtimeChannel) return;
    realtimeChannel = client
      .channel(REALTIME_CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function () {
        pullAll().catch(function (e) { console.warn('[clients-adapter] realtime pull failed:', e); });
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
      if (!(await hasSession())) {
        console.info('[clients-adapter] pas de session auth, init differe');
        return;
      }
      try {
        await migrateFromAppStateIfNeeded();
        await pullAll();
        installSetItemHook();
        initialized = true;
        subscribeRealtime();
        window.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible' && initialized) {
            pullAll().catch(function () {});
          }
        });
        console.info('[clients-adapter] initialise (table public.clients native)');
      } catch (e) {
        console.error('[clients-adapter] bootstrap error:', e);
      }
    })();

    try { return await bootstrapPromise; }
    finally { bootstrapPromise = null; }
  }

  // Auto-bootstrap quand auth est prete (poll leger)
  function tryBootstrapLoop() {
    bootstrap().then(function () {
      if (!initialized) window.setTimeout(tryBootstrapLoop, 1500);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBootstrapLoop);
  } else {
    tryBootstrapLoop();
  }

  window.DelivProClientsAdapter = {
    bootstrap: bootstrap,
    pullAll: pullAll,
    flushDiff: flushDiff,
    isInitialized: function () { return initialized; },
    debugStatus: function () {
      return {
        initialized: initialized,
        hasClient: !!getClient(),
        localCount: readLocal().length,
        snapshotCount: (lastSnapshot || []).length
      };
    }
  };
})();
