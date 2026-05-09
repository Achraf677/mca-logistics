/**
 * MCA Logistics — Tests script-mobile-exports.js
 *
 * Couvre les helpers exposes en CommonJS :
 *   - stripEmojis()  : retire les emojis, garde le texte
 *   - detectNumericColumns(cols, rows) : detecte les colonnes 100% numeriques
 *
 * Pas de test d'integration window.print() (DOM-only) — couvert manuellement
 * via le test plan de la PR.
 *
 * Lancer : node --test tests/mobile-exports.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { stripEmojis, detectNumericColumns } = require('../script-mobile-exports.js');

// =========================================================
// stripEmojis
// =========================================================
test('stripEmojis : retire les emojis pictographiques courants', () => {
  assert.equal(stripEmojis('📄 PDF'), 'PDF');
  assert.equal(stripEmojis('🔴 Retard'), 'Retard');
  assert.equal(stripEmojis('✅ Encaissé'), 'Encaissé');
  assert.equal(stripEmojis('⏳ À payer (5)'), 'À payer (5)');
});

test('stripEmojis : conserve le texte FR avec accents et chiffres', () => {
  assert.equal(stripEmojis('Livraison N°1234 — 45,67 €'), 'Livraison N°1234 — 45,67 €');
  assert.equal(stripEmojis('été à Paris'), 'été à Paris');
});

test('stripEmojis : gere null / undefined / non-string', () => {
  assert.equal(stripEmojis(null), '');
  assert.equal(stripEmojis(undefined), '');
  assert.equal(stripEmojis(0), '0');
  assert.equal(stripEmojis(42), '42');
});

test('stripEmojis : retire emoji ZWJ sequences (drapeaux, families, skin tones)', () => {
  // 🏳️‍🌈 (drapeau arc-en-ciel) -> doit disparaitre completement
  assert.equal(stripEmojis('🏳️‍🌈 LGBT'), 'LGBT');
  // 👨‍👩‍👧 (famille) -> doit disparaitre
  assert.equal(stripEmojis('👨‍👩‍👧 Famille'), 'Famille');
});

test('stripEmojis : compresse les espaces multiples', () => {
  assert.equal(stripEmojis('A    B'), 'A B');
  assert.equal(stripEmojis('  hello  '), 'hello');
});

// =========================================================
// detectNumericColumns
// =========================================================
test('detectNumericColumns : detecte une colonne 100% montants', () => {
  const cols = ['Client', 'Montant'];
  const rows = [
    ['Carrefour', '1 234,56 €'],
    ['Auchan', '987,00 €'],
    ['Leclerc', '500 €']
  ];
  assert.deepEqual(detectNumericColumns(cols, rows), [false, true]);
});

test('detectNumericColumns : detecte une colonne integers purs', () => {
  const cols = ['Nom', 'Quantite'];
  const rows = [['A', 12], ['B', 5], ['C', '7']];
  assert.deepEqual(detectNumericColumns(cols, rows), [false, true]);
});

test('detectNumericColumns : colonne mixte (texte + chiffres) -> false', () => {
  const cols = ['Reference', 'Note'];
  const rows = [
    ['REF-001', 'OK'],
    ['REF-002', '12']
  ];
  assert.deepEqual(detectNumericColumns(cols, rows), [false, false]);
});

test('detectNumericColumns : colonne avec valeurs vides toleree (inferee numeric)', () => {
  const cols = ['Total'];
  const rows = [['10 €'], [''], [null], ['5,5 €']];
  assert.deepEqual(detectNumericColumns(cols, rows), [true]);
});

test('detectNumericColumns : suffixes km/h/% acceptes', () => {
  const cols = ['Distance', 'Heures', 'Taux'];
  const rows = [['120 km', '8h', '20%'], ['50 km', '4h', '10%']];
  assert.deepEqual(detectNumericColumns(cols, rows), [true, true, true]);
});

test('detectNumericColumns : tableau vide -> toutes colonnes numeric (par defaut)', () => {
  assert.deepEqual(detectNumericColumns(['A', 'B', 'C'], []), [true, true, true]);
});

test('detectNumericColumns : sans colonnes ni rows -> tableau vide', () => {
  assert.deepEqual(detectNumericColumns([], []), []);
  assert.deepEqual(detectNumericColumns(undefined, undefined), []);
});
