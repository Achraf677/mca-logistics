/**
 * MCA Logistics — Tests data-flow rollback localStorage (sprint H2.2)
 *
 * Audit Data Flow Supabase a identifie un critique : aucun rollback
 * localStorage en cas d'echec push Supabase. L'utilisateur voit ses donnees
 * "sauvees" localement mais elles ne partent jamais sur le serveur.
 *
 * Ces tests :
 *   - Mockent un client Supabase qui retourne `{ error: ... }` sur upsert.
 *   - Simulent la logique attendue d'un wrapper "safe push" :
 *     1. snapshot localStorage avant push
 *     2. push Supabase
 *     3. si erreur -> rollback (restaure le snapshot) ET emet un toast erreur
 *     4. si OK -> commit (lastSnapshot mis a jour)
 *
 * Note : le code de production actuel (entity-supabase-adapter.js) ne
 * rollback PAS — il log seulement (cf. l.260-310). Ces tests definissent
 * le comportement *correct* attendu (TDD pour le sprint H2.3).
 *
 * Lancer : node --test tests/data-flow-rollback.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Mock localStorage minimal (Node n'a pas de Web Storage natif)
// ============================================================

class MockLocalStorage {
  constructor() { this._data = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; }
  setItem(k, v) { this._data[k] = String(v); }
  removeItem(k) { delete this._data[k]; }
  clear() { this._data = {}; }
}

// ============================================================
// Mock client Supabase + tracker de toasts
// ============================================================

function makeSupabaseMock(behavior) {
  // behavior : 'success' | 'error' | { error: { message: ... } }
  const calls = [];
  const result = behavior === 'success'
    ? { data: [], error: null }
    : behavior === 'error'
      ? { data: null, error: { message: 'network down', code: 'PGRST500' } }
      : behavior;
  return {
    calls,
    from(table) {
      return {
        upsert(rows, opts) {
          calls.push({ op: 'upsert', table, rows, opts });
          return Promise.resolve(result);
        },
        delete() {
          return {
            in(col, ids) {
              calls.push({ op: 'delete', table, col, ids });
              return Promise.resolve(result);
            }
          };
        }
      };
    }
  };
}

// ============================================================
// Wrapper "safe push" : la logique ATTENDUE (test-driven)
// ============================================================

/**
 * Push localStorage diff vers Supabase avec rollback en cas d'erreur.
 *
 * @param {object} opts
 * @param {string} opts.storageKey   - cle localStorage
 * @param {string} opts.table        - table Supabase
 * @param {array}  opts.nextRows     - nouvelles lignes a sauvegarder
 * @param {object} opts.localStorage - mock ou window.localStorage
 * @param {object} opts.client       - mock Supabase client
 * @param {function} opts.toast      - fonction toast (mock)
 * @returns {Promise<{ok: boolean, error: any}>}
 */
async function safePushWithRollback(opts) {
  const ls = opts.localStorage;
  const snapshot = ls.getItem(opts.storageKey);
  // Ecriture optimiste locale
  ls.setItem(opts.storageKey, JSON.stringify(opts.nextRows));
  try {
    const res = await opts.client.from(opts.table).upsert(opts.nextRows, { onConflict: 'id' });
    if (res.error) {
      // ROLLBACK : restaure le snapshot
      if (snapshot == null) ls.removeItem(opts.storageKey);
      else ls.setItem(opts.storageKey, snapshot);
      if (opts.toast) opts.toast('⚠️ Sauvegarde impossible : ' + res.error.message, 'error');
      return { ok: false, error: res.error };
    }
    return { ok: true, error: null };
  } catch (e) {
    if (snapshot == null) ls.removeItem(opts.storageKey);
    else ls.setItem(opts.storageKey, snapshot);
    if (opts.toast) opts.toast('⚠️ Sauvegarde impossible : ' + (e.message || 'inconnue'), 'error');
    return { ok: false, error: e };
  }
}

// ============================================================
// Tests : comportement attendu du rollback
// ============================================================

test('push OK : localStorage contient les nouvelles donnees', async () => {
  const ls = new MockLocalStorage();
  ls.setItem('livraisons', JSON.stringify([{ id: '1', client: 'Avant' }]));
  const client = makeSupabaseMock('success');
  const toasts = [];
  const next = [{ id: '1', client: 'Apres' }, { id: '2', client: 'Nouveau' }];

  const res = await safePushWithRollback({
    storageKey: 'livraisons',
    table: 'livraisons',
    nextRows: next,
    localStorage: ls,
    client,
    toast: (msg, lvl) => toasts.push({ msg, lvl })
  });

  assert.equal(res.ok, true);
  assert.deepEqual(JSON.parse(ls.getItem('livraisons')), next);
  assert.equal(toasts.length, 0, 'aucun toast erreur en cas de succes');
});

test('push ECHEC : localStorage rollback au snapshot precedent', async () => {
  const ls = new MockLocalStorage();
  const before = [{ id: '1', client: 'Avant' }];
  ls.setItem('livraisons', JSON.stringify(before));
  const client = makeSupabaseMock('error');
  const toasts = [];
  const next = [{ id: '1', client: 'Apres-modifie' }];

  const res = await safePushWithRollback({
    storageKey: 'livraisons',
    table: 'livraisons',
    nextRows: next,
    localStorage: ls,
    client,
    toast: (msg, lvl) => toasts.push({ msg, lvl })
  });

  assert.equal(res.ok, false);
  assert.equal(res.error.message, 'network down');
  // CRITIQUE : localStorage doit avoir ete restaure au snapshot
  assert.deepEqual(JSON.parse(ls.getItem('livraisons')), before,
    'localStorage NE DOIT PAS contenir les donnees non synchronisees');
});

test('push ECHEC : toast erreur emis (pas silencieux)', async () => {
  const ls = new MockLocalStorage();
  ls.setItem('livraisons', JSON.stringify([]));
  const client = makeSupabaseMock('error');
  const toasts = [];

  await safePushWithRollback({
    storageKey: 'livraisons',
    table: 'livraisons',
    nextRows: [{ id: '1' }],
    localStorage: ls,
    client,
    toast: (msg, lvl) => toasts.push({ msg, lvl })
  });

  assert.equal(toasts.length, 1, 'doit emettre exactement 1 toast erreur');
  assert.equal(toasts[0].lvl, 'error');
  assert.ok(/network down/i.test(toasts[0].msg), 'le toast doit contenir le message d erreur Supabase');
});

test('push ECHEC sur key vierge : localStorage reste vide (removeItem)', async () => {
  const ls = new MockLocalStorage();
  // Aucun snapshot existant pour 'livraisons'
  const client = makeSupabaseMock('error');

  await safePushWithRollback({
    storageKey: 'livraisons',
    table: 'livraisons',
    nextRows: [{ id: '1', client: 'Test' }],
    localStorage: ls,
    client,
    toast: () => {}
  });

  // localStorage doit avoir ete nettoye (pas de donnee fantome non sync)
  assert.equal(ls.getItem('livraisons'), null);
});

test('push exception (network thrown) : meme rollback + toast', async () => {
  const ls = new MockLocalStorage();
  const before = [{ id: '1' }];
  ls.setItem('livraisons', JSON.stringify(before));
  const client = {
    from() {
      return {
        upsert() { return Promise.reject(new Error('socket hang up')); }
      };
    }
  };
  const toasts = [];
  const res = await safePushWithRollback({
    storageKey: 'livraisons',
    table: 'livraisons',
    nextRows: [{ id: '1', modifie: true }],
    localStorage: ls,
    client,
    toast: (msg, lvl) => toasts.push({ msg, lvl })
  });

  assert.equal(res.ok, false);
  assert.deepEqual(JSON.parse(ls.getItem('livraisons')), before);
  assert.equal(toasts.length, 1);
  assert.ok(/socket hang up/i.test(toasts[0].msg));
});

test('appel upsert effectivement realise avec les bons rows', async () => {
  const ls = new MockLocalStorage();
  const client = makeSupabaseMock('success');
  const next = [{ id: '1' }, { id: '2' }];
  await safePushWithRollback({
    storageKey: 'k', table: 't', nextRows: next, localStorage: ls, client, toast: () => {}
  });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].op, 'upsert');
  assert.deepEqual(client.calls[0].rows, next);
  assert.deepEqual(client.calls[0].opts, { onConflict: 'id' });
});
