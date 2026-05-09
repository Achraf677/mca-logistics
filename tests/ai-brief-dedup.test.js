/**
 * MCA Logistics — Tests dedup ai-brief
 *
 * Couvre la logique de deduplication des decisions ai-brief contre les 3
 * derniers runs ai_brief_runs (cf. infra/supabase/functions/ai-brief/dedup.mjs).
 *
 * Lancer : node --test tests/ai-brief-dedup.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Import dynamique de l'ESM depuis CommonJS
let dedupMod;
test.before(async () => {
  dedupMod = await import('../infra/supabase/functions/ai-brief/dedup.mjs');
});

// =========================================================
// normalizeForHash
// =========================================================
test('normalizeForHash : lowercase + trim + compact spaces', () => {
  const { normalizeForHash } = dedupMod;
  assert.equal(normalizeForHash('  Hello   WORLD  '), 'hello world');
  assert.equal(normalizeForHash('Carrefour\t  J+45'), 'carrefour j+45');
  assert.equal(normalizeForHash(null), '');
  assert.equal(normalizeForHash(undefined), '');
  assert.equal(normalizeForHash(42), '42');
});

// =========================================================
// sha1Hex : determinisme + format hex 40 chars
// =========================================================
test('sha1Hex : meme input -> meme hash, format hex 40 chars', async () => {
  const { sha1Hex } = dedupMod;
  const h1 = await sha1Hex('foo');
  const h2 = await sha1Hex('foo');
  const h3 = await sha1Hex('bar');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.match(h1, /^[0-9a-f]{40}$/);
  // SHA-1('foo') connu
  assert.equal(h1, '0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
});

// =========================================================
// hashDecision : format full (titre+desc+priorite+actions)
// =========================================================
test('hashDecision : 2 decisions identiques -> meme hash', async () => {
  const { hashDecision } = dedupMod;
  const a = {
    titre: 'Impaye Carrefour 35j',
    description: 'Livraison LIV-001 retard 35 jours',
    priorite: 'haute',
    actions: [{ id: 'ouvrir_livraison', label: 'Voir', style: 'primary' }],
  };
  const b = {
    titre: 'IMPAYE Carrefour 35j',  // case different
    description: '  Livraison LIV-001 retard 35 jours  ', // espaces extra
    priorite: 'haute',
    actions: [{ id: 'ouvrir_livraison', label: 'Voir', style: 'primary' }],
  };
  assert.equal(await hashDecision(a), await hashDecision(b));
});

test('hashDecision : titre different -> hash different', async () => {
  const { hashDecision } = dedupMod;
  const a = { titre: 'A', description: 'X', priorite: 'haute', actions: [] };
  const b = { titre: 'B', description: 'X', priorite: 'haute', actions: [] };
  assert.notEqual(await hashDecision(a), await hashDecision(b));
});

test('hashDecision : format simple {type, entity_id, message} fonctionne', async () => {
  const { hashDecision } = dedupMod;
  const a = { type: 'impaye', entity_id: 'liv-001', message: 'Carrefour 35j' };
  const b = { type: 'IMPAYE', entity_id: 'LIV-001', message: '  Carrefour  35j  ' };
  assert.equal(await hashDecision(a), await hashDecision(b));
});

test('hashDecision : entree invalide -> hash vide', async () => {
  const { hashDecision } = dedupMod;
  assert.equal(await hashDecision(null), '');
  assert.equal(await hashDecision(undefined), '');
  assert.equal(await hashDecision('string'), '');
});

// =========================================================
// buildRecentlyMentioned
// =========================================================
test('buildRecentlyMentioned : agrege les decisions de 3 runs', async () => {
  const { buildRecentlyMentioned } = dedupMod;
  const runs = [
    { decisions: [
      { titre: 'A', description: 'desc-a', priorite: 'haute', actions: [{ id: 'voir' }] },
      { titre: 'B', description: 'desc-b', priorite: 'info', actions: [] },
    ]},
    { decisions: [
      { titre: 'A', description: 'desc-a', priorite: 'haute', actions: [{ id: 'voir' }] },
      { titre: 'C', description: 'desc-c', priorite: 'opportunite', actions: [] },
    ]},
    { decisions: [] },
  ];
  const set = await buildRecentlyMentioned(runs);
  // A est dans 2 runs mais hash unique -> set de 3 (A, B, C)
  assert.equal(set.size, 3);
});

test('buildRecentlyMentioned : runs vides ou null -> set vide', async () => {
  const { buildRecentlyMentioned } = dedupMod;
  assert.equal((await buildRecentlyMentioned([])).size, 0);
  assert.equal((await buildRecentlyMentioned([{ decisions: null }])).size, 0);
  assert.equal((await buildRecentlyMentioned([{ decisions: 'pas-array' }])).size, 0);
});

// =========================================================
// dedupDecisions
// =========================================================
test('dedupDecisions : filtre les decisions deja vues', async () => {
  const { dedupDecisions, buildRecentlyMentioned } = dedupMod;
  const past = [
    { decisions: [
      { titre: 'Repete', description: 'idem', priorite: 'haute', actions: [{ id: 'voir' }] },
    ]},
  ];
  const set = await buildRecentlyMentioned(past);

  const candidates = [
    { titre: 'Repete', description: 'idem', priorite: 'haute', actions: [{ id: 'voir' }] }, // doit etre filtree
    { titre: 'Nouveau', description: 'nouveau-desc', priorite: 'info', actions: [] },
  ];
  const { kept, skipped } = await dedupDecisions(candidates, set);
  assert.equal(skipped, 1);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].titre, 'Nouveau');
});

test('dedupDecisions : aucune repetition -> kept = candidates', async () => {
  const { dedupDecisions } = dedupMod;
  const set = new Set();
  const candidates = [
    { titre: 'A', description: 'a', priorite: 'haute', actions: [] },
    { titre: 'B', description: 'b', priorite: 'info', actions: [] },
  ];
  const { kept, skipped } = await dedupDecisions(candidates, set);
  assert.equal(skipped, 0);
  assert.equal(kept.length, 2);
});

test('dedupDecisions : tout repete -> kept vide, skipped = N', async () => {
  const { dedupDecisions, buildRecentlyMentioned } = dedupMod;
  const past = [
    { decisions: [
      { titre: 'A', description: 'a', priorite: 'haute', actions: [] },
      { titre: 'B', description: 'b', priorite: 'info', actions: [] },
    ]},
  ];
  const set = await buildRecentlyMentioned(past);

  const candidates = [
    { titre: 'A', description: 'a', priorite: 'haute', actions: [] },
    { titre: 'B', description: 'b', priorite: 'info', actions: [] },
  ];
  const { kept, skipped } = await dedupDecisions(candidates, set);
  assert.equal(kept.length, 0);
  assert.equal(skipped, 2);
});

// =========================================================
// Cas concret : tolerance casse + espaces + nuance dans description
// =========================================================
test('dedupDecisions : tolere variations cosmetiques (case, espaces)', async () => {
  const { dedupDecisions, buildRecentlyMentioned } = dedupMod;
  const past = [{ decisions: [{
    titre: 'Carrefour : retard paiement 35j',
    description: 'Livraison LIV-001 — relance recommandee',
    priorite: 'haute',
    actions: [{ id: 'relancer' }],
  }]}];
  const set = await buildRecentlyMentioned(past);

  // Meme contenu mais espaces et casse differentes
  const candidates = [{
    titre: 'CARREFOUR : retard paiement 35j',
    description: '  Livraison   LIV-001  —  relance  recommandee  ',
    priorite: 'HAUTE',
    actions: [{ id: 'relancer' }],
  }];
  const { kept, skipped } = await dedupDecisions(candidates, set);
  assert.equal(skipped, 1);
  assert.equal(kept.length, 0);
});
