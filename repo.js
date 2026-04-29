/**
 * Repo - Couche d'abstraction pour les entites metier de MCA Logistics
 *
 * Phase 1 (actuelle) : lit/ecrit localStorage (synchronise vers Supabase via supabase-storage-sync.js).
 * Phase 2 (future)   : basculera progressivement vers les tables Supabase natives, sans changer l'API
 *                      cote callers (script.js / admin.html / salarie.html).
 *
 * API uniforme par entite :
 *   Repo.<entity>.list(filter?)       -> Promise<Array>            ; filter optionnel { field: value, ... }
 *   Repo.<entity>.get(id)             -> Promise<Object|null>
 *   Repo.<entity>.upsert(item)        -> Promise<Object>           ; insert ou update selon item.id
 *   Repo.<entity>.remove(id)          -> Promise<boolean>
 *   Repo.<entity>.replace(items)      -> Promise<void>             ; remplace toute la collection
 *   Repo.<entity>.subscribe(callback) -> () => void                ; renvoie la fn de desinscription
 *
 * A charger AVANT script.js dans les pages admin/salarie/login.
 */

(function () {
  'use strict';

  if (window.Repo) {
    console.warn('[Repo] window.Repo deja defini, init ignore');
    return;
  }

  // ============================================================
  // Helpers
  // ============================================================

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (_) {}
    }
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function readArray(storageKey) {
    try {
      var raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeArray(storageKey, items) {
    var safe = Array.isArray(items) ? items : [];
    window.localStorage.setItem(storageKey, JSON.stringify(safe));
  }

  function findIndexById(items, id, idField) {
    var key = idField || 'id';
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      if (item && String(item[key]) === String(id)) return i;
    }
    return -1;
  }

  function matchFilter(item, filter) {
    if (!filter || typeof filter !== 'object') return true;
    var keys = Object.keys(filter);
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (item == null) return false;
      if (item[k] !== filter[k]) return false;
    }
    return true;
  }

  function notifyChange(storageKey, op, payload) {
    try {
      window.dispatchEvent(new CustomEvent('repo:change', {
        detail: { key: storageKey, op: op, payload: payload }
      }));
    } catch (_) {}
  }

  // ============================================================
  // Factory : repo "tableau d'objets sous une cle localStorage"
  // ============================================================

  function createArrayRepo(storageKey, options) {
    var idField = (options && options.idField) || 'id';

    return {
      key: storageKey,
      idField: idField,

      list: async function (filter) {
        var items = readArray(storageKey);
        if (!filter) return items.slice();
        return items.filter(function (item) { return matchFilter(item, filter); });
      },

      get: async function (id) {
        if (id == null || id === '') return null;
        var items = readArray(storageKey);
        var idx = findIndexById(items, id, idField);
        if (idx < 0) return null;
        return Object.assign({}, items[idx]);
      },

      upsert: async function (item) {
        if (!item || typeof item !== 'object') {
          throw new Error('[Repo.' + storageKey + '.upsert] item invalide');
        }
        var items = readArray(storageKey);
        var copy = Object.assign({}, item);
        if (copy[idField] == null || copy[idField] === '') {
          copy[idField] = generateId();
        }
        var idx = findIndexById(items, copy[idField], idField);
        var op;
        if (idx >= 0) {
          items[idx] = Object.assign({}, items[idx], copy);
          op = 'update';
        } else {
          items.push(copy);
          op = 'insert';
        }
        writeArray(storageKey, items);
        notifyChange(storageKey, op, copy);
        return copy;
      },

      remove: async function (id) {
        if (id == null || id === '') return false;
        var items = readArray(storageKey);
        var idx = findIndexById(items, id, idField);
        if (idx < 0) return false;
        var removed = items[idx];
        items.splice(idx, 1);
        writeArray(storageKey, items);
        notifyChange(storageKey, 'delete', removed);
        return true;
      },

      replace: async function (items) {
        var safe = Array.isArray(items) ? items : [];
        writeArray(storageKey, safe);
        notifyChange(storageKey, 'replace', { count: safe.length });
      },

      subscribe: function (callback) {
        if (typeof callback !== 'function') return function () {};
        var onRepoChange = function (ev) {
          if (ev && ev.detail && ev.detail.key === storageKey) {
            try { callback(ev.detail); } catch (e) { console.error('[Repo subscriber]', e); }
          }
        };
        var onStorage = function (ev) {
          if (ev && ev.key === storageKey) {
            try { callback({ key: storageKey, op: 'storage' }); } catch (e) { console.error('[Repo subscriber]', e); }
          }
        };
        window.addEventListener('repo:change', onRepoChange);
        window.addEventListener('storage', onStorage);
        return function unsubscribe() {
          window.removeEventListener('repo:change', onRepoChange);
          window.removeEventListener('storage', onStorage);
        };
      }
    };
  }

  // ============================================================
  // Repos par entite
  // ============================================================

  var Repo = {
    livraisons: createArrayRepo('livraisons'),
    clients: createArrayRepo('clients'),
    fournisseurs: createArrayRepo('fournisseurs'),
    salaries: createArrayRepo('salaries'),
    vehicules: createArrayRepo('vehicules'),
    carburant: createArrayRepo('carburant'),
    entretiens: createArrayRepo('entretiens'),
    inspections: createArrayRepo('inspections'),
    charges: createArrayRepo('charges'),
    paiements: createArrayRepo('paiements'),
    incidents: createArrayRepo('incidents'),
    alertes_admin: createArrayRepo('alertes_admin'),
    plannings_hebdo: createArrayRepo('plannings_hebdo'),
    absences_periodes: createArrayRepo('absences_periodes'),
    salaries_documents: createArrayRepo('salaries_documents')
  };

  // ============================================================
  // Helpers et meta exposes pour script.js et migrations futures
  // ============================================================

  Repo._helpers = {
    generateId: generateId,
    matchFilter: matchFilter,
    notifyChange: notifyChange
  };

  Repo._meta = {
    version: '1.0.0',
    backend: 'localStorage',
    phase: 1,
    initializedAt: new Date().toISOString()
  };

  Repo.entities = function () {
    return Object.keys(Repo).filter(function (k) { return k.charAt(0) !== '_' && typeof Repo[k] === 'object' && Repo[k].key; });
  };

  Repo.debug = function () {
    var out = {};
    Repo.entities().forEach(function (name) {
      out[name] = readArray(Repo[name].key).length;
    });
    return { meta: Repo._meta, counts: out };
  };

  window.Repo = Repo;

  if (window.console && typeof console.info === 'function') {
    console.info('[Repo] initialise (Phase ' + Repo._meta.phase + ', backend=' + Repo._meta.backend + ', entites=' + Repo.entities().length + ')');
  }
})();
