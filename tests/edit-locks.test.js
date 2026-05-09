/**
 * MCA Logistics — Tests EditLocksV2 (PR #51)
 *
 * Couvre la logique pure (sans DOM, sans Supabase) :
 *   - shouldAcquire : matrice (pas de lock / lock expire / meme user / autre user)
 *   - isExpired : edge cases now / past / future
 *   - cache-clear : preservation des cles auth (Supabase v2 + legacy v1) et theme
 *
 * Lancer : node --test tests/edit-locks.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Stub minimaliste de window pour permettre le require sans erreur
global.window = global.window || { addEventListener: () => {} };
global.document = global.document || { addEventListener: () => {} };
global.sessionStorage = global.sessionStorage || {
  _s: {},
  getItem(k) { return this._s[k] || null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
};
global.localStorage = global.localStorage || {
  _s: {},
  get length() { return Object.keys(this._s).length; },
  key(i) { return Object.keys(this._s)[i] || null; },
  getItem(k) { return this._s[k] != null ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
  clear() { this._s = {}; },
};

const editLocks = require('../script-core-edit-locks.js');
const cacheClear = require('../script-cache-clear.js');

const NOW = Date.UTC(2026, 4, 9, 12, 0, 0); // 2026-05-09 12:00 UTC fixe
const inFuture = (s) => new Date(NOW + s * 1000).toISOString();
const inPast = (s) => new Date(NOW - s * 1000).toISOString();

// =========================================================
// shouldAcquire — matrice de decision
// =========================================================

test('shouldAcquire : pas de lock existant -> acquire', () => {
  const r = editLocks.shouldAcquire(null, 'user-1', NOW);
  assert.equal(r.acquire, true);
  assert.equal(r.reason, 'no_existing');
});

test('shouldAcquire : lock expire -> acquire (take-over)', () => {
  const existing = { user_id: 'user-2', user_name: 'Bob', expires_at: inPast(60) };
  const r = editLocks.shouldAcquire(existing, 'user-1', NOW);
  assert.equal(r.acquire, true);
  assert.equal(r.reason, 'expired');
});

test('shouldAcquire : lock detenu par moi-meme -> re-acquire silencieux', () => {
  const existing = { user_id: 'user-1', user_name: 'Alice', expires_at: inFuture(120) };
  const r = editLocks.shouldAcquire(existing, 'user-1', NOW);
  assert.equal(r.acquire, true);
  assert.equal(r.reason, 'same_user');
});

test('shouldAcquire : lock detenu par un autre user, non expire -> conflit', () => {
  const existing = { user_id: 'user-2', user_name: 'Bob', expires_at: inFuture(120) };
  const r = editLocks.shouldAcquire(existing, 'user-1', NOW);
  assert.equal(r.acquire, false);
  assert.equal(r.reason, 'conflict');
  assert.equal(r.owner, 'Bob');
});

// =========================================================
// isExpired
// =========================================================

test('isExpired : timestamp passe -> true', () => {
  assert.equal(editLocks.isExpired(inPast(1), NOW), true);
});

test('isExpired : timestamp futur -> false', () => {
  assert.equal(editLocks.isExpired(inFuture(60), NOW), false);
});

test('isExpired : exactement now -> false (boundary <)', () => {
  // expires_at exactement = now -> getTime() === now -> < now est false
  const t = new Date(NOW).toISOString();
  assert.equal(editLocks.isExpired(t, NOW), false);
});

// =========================================================
// LOCK_DURATION_S = 5 minutes
// =========================================================

test('LOCK_DURATION_S vaut 5 minutes (300s)', () => {
  assert.equal(editLocks.LOCK_DURATION_S, 300);
});

test('REFRESH_INTERVAL_MS vaut 60s', () => {
  assert.equal(editLocks.REFRESH_INTERVAL_MS, 60000);
});

// =========================================================
// Cache-clear : preservation des cles
// =========================================================

test('cache-clear : preserve "theme"', () => {
  assert.equal(cacheClear.shouldPreserveKey('theme'), true);
});

test('cache-clear : preserve "mca_setup_done"', () => {
  assert.equal(cacheClear.shouldPreserveKey('mca_setup_done'), true);
});

test('cache-clear : preserve sb-<projectref>-auth-token (Supabase v2)', () => {
  assert.equal(
    cacheClear.shouldPreserveKey('sb-lkbfvgnhwgbapdtitglu-auth-token'),
    true
  );
});

test('cache-clear : preserve "supabase.auth.token" (legacy v1)', () => {
  assert.equal(cacheClear.shouldPreserveKey('supabase.auth.token'), true);
});

test('cache-clear : NE preserve PAS les cles metier (livraisons, charges...)', () => {
  ['livraisons', 'charges', 'clients', 'audit_log', 'tva_config', 'config'].forEach((k) => {
    assert.equal(cacheClear.shouldPreserveKey(k), false, `clé ${k} ne devrait PAS être préservée`);
  });
});

test('cache-clear : null/undefined/empty key -> false (defensive)', () => {
  assert.equal(cacheClear.shouldPreserveKey(null), false);
  assert.equal(cacheClear.shouldPreserveKey(undefined), false);
  assert.equal(cacheClear.shouldPreserveKey(''), false);
});

test('cache-clear : KEY_PREFIXES_PRESERVED contient bien sb- et supabase.auth.', () => {
  assert.ok(cacheClear.KEY_PREFIXES_PRESERVED.includes('sb-'));
  assert.ok(cacheClear.KEY_PREFIXES_PRESERVED.includes('supabase.auth.'));
});
