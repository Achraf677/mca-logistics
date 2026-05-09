/**
 * MCA Logistics — Tests charges recurrence
 *
 * Couvre la logique pure de l'edge function `charges-recurrence-daily` :
 *   - daysInMonth (gestion annees bissextiles)
 *   - nextOccurrenceDate (mensuelle / trimestrielle / annuelle)
 *   - periodKey (cle d'idempotence)
 *   - edge cases : 29 fevrier (annee bissextile -> non bissextile),
 *                  jour 31 sur mois 30 jours,
 *                  pivot decembre -> janvier.
 *
 * Reproduction des fonctions car edge fn est en TS Deno (pas importable
 * depuis node:test). Les fonctions ci-dessous sont LITERALEMENT identiques
 * a celles dans `infra/supabase/functions/charges-recurrence-daily/index.ts`.
 *
 * Lancer : node --test tests/charges-recurrence.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Reproductions (cf. edge fn index.ts)
// ============================================================

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextOccurrenceDate(lastDateISO, pattern, jourDuMois) {
  const step = pattern === 'mensuelle' ? 1 : pattern === 'trimestrielle' ? 3 : 12;
  const [yStr, mStr] = lastDateISO.split('-');
  let year = Number(yStr);
  let month = Number(mStr);
  month += step;
  while (month > 12) { month -= 12; year += 1; }
  const cap = daysInMonth(year, month);
  const day = Math.min(Math.max(1, jourDuMois), cap);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function periodKey(dateISO, pattern) {
  const [y, m] = dateISO.split('-');
  if (pattern === 'mensuelle') return `${y}-${m}`;
  if (pattern === 'annuelle') return `${y}`;
  const month = Number(m);
  const q = Math.ceil(month / 3);
  return `${y}-Q${q}`;
}

// ============================================================
// daysInMonth
// ============================================================

test('daysInMonth — janvier = 31', () => {
  assert.equal(daysInMonth(2026, 1), 31);
});
test('daysInMonth — fevrier 2024 (bissextile) = 29', () => {
  assert.equal(daysInMonth(2024, 2), 29);
});
test('daysInMonth — fevrier 2026 (non bissextile) = 28', () => {
  assert.equal(daysInMonth(2026, 2), 28);
});
test('daysInMonth — fevrier 2100 (centenaire non divisible 400) = 28', () => {
  assert.equal(daysInMonth(2100, 2), 28);
});
test('daysInMonth — fevrier 2000 (centenaire divisible 400) = 29', () => {
  assert.equal(daysInMonth(2000, 2), 29);
});
test('daysInMonth — avril = 30', () => {
  assert.equal(daysInMonth(2026, 4), 30);
});

// ============================================================
// nextOccurrenceDate — mensuelle
// ============================================================

test('mensuelle — 2026-04-05 + jour 5 -> 2026-05-05', () => {
  assert.equal(nextOccurrenceDate('2026-04-05', 'mensuelle', 5), '2026-05-05');
});

test('mensuelle — 2026-12-15 -> 2027-01-15 (pivot annee)', () => {
  assert.equal(nextOccurrenceDate('2026-12-15', 'mensuelle', 15), '2027-01-15');
});

test('mensuelle — jour 31 sur avril (30 j) -> 2026-04-30 (cap)', () => {
  assert.equal(nextOccurrenceDate('2026-03-31', 'mensuelle', 31), '2026-04-30');
});

test('mensuelle — jour 31 sur fevrier non bissextile -> 2026-02-28', () => {
  assert.equal(nextOccurrenceDate('2026-01-31', 'mensuelle', 31), '2026-02-28');
});

test('mensuelle — jour 29 sur fevrier 2024 bissextile -> 2024-02-29', () => {
  assert.equal(nextOccurrenceDate('2024-01-29', 'mensuelle', 29), '2024-02-29');
});

test('mensuelle — jour 29 sur fevrier 2026 non bissextile -> 2026-02-28 (cap)', () => {
  assert.equal(nextOccurrenceDate('2026-01-29', 'mensuelle', 29), '2026-02-28');
});

test('mensuelle — jour invalide >31 cap a fin de mois', () => {
  assert.equal(nextOccurrenceDate('2026-04-15', 'mensuelle', 99), '2026-05-31');
});

test('mensuelle — jour 0 -> jour 1 (clamp min)', () => {
  assert.equal(nextOccurrenceDate('2026-04-15', 'mensuelle', 0), '2026-05-01');
});

// ============================================================
// nextOccurrenceDate — trimestrielle
// ============================================================

test('trimestrielle — 2026-01-15 -> 2026-04-15', () => {
  assert.equal(nextOccurrenceDate('2026-01-15', 'trimestrielle', 15), '2026-04-15');
});

test('trimestrielle — 2026-11-15 -> 2027-02-15 (pivot annee)', () => {
  assert.equal(nextOccurrenceDate('2026-11-15', 'trimestrielle', 15), '2027-02-15');
});

test('trimestrielle — 2026-12-31 -> 2027-03-31', () => {
  assert.equal(nextOccurrenceDate('2026-12-31', 'trimestrielle', 31), '2027-03-31');
});

// ============================================================
// nextOccurrenceDate — annuelle
// ============================================================

test('annuelle — 2026-04-05 -> 2027-04-05', () => {
  assert.equal(nextOccurrenceDate('2026-04-05', 'annuelle', 5), '2027-04-05');
});

test('annuelle — 2024-02-29 -> 2025-02-28 (sortie annee bissextile)', () => {
  assert.equal(nextOccurrenceDate('2024-02-29', 'annuelle', 29), '2025-02-28');
});

// ============================================================
// periodKey — idempotence
// ============================================================

test('periodKey mensuelle -> YYYY-MM', () => {
  assert.equal(periodKey('2026-05-09', 'mensuelle'), '2026-05');
});

test('periodKey annuelle -> YYYY', () => {
  assert.equal(periodKey('2026-05-09', 'annuelle'), '2026');
});

test('periodKey trimestrielle Q1 (jan/fev/mar)', () => {
  assert.equal(periodKey('2026-01-15', 'trimestrielle'), '2026-Q1');
  assert.equal(periodKey('2026-03-31', 'trimestrielle'), '2026-Q1');
});

test('periodKey trimestrielle Q2 (avr/mai/jun)', () => {
  assert.equal(periodKey('2026-04-01', 'trimestrielle'), '2026-Q2');
  assert.equal(periodKey('2026-06-30', 'trimestrielle'), '2026-Q2');
});

test('periodKey trimestrielle Q3', () => {
  assert.equal(periodKey('2026-07-01', 'trimestrielle'), '2026-Q3');
  assert.equal(periodKey('2026-09-30', 'trimestrielle'), '2026-Q3');
});

test('periodKey trimestrielle Q4', () => {
  assert.equal(periodKey('2026-10-01', 'trimestrielle'), '2026-Q4');
  assert.equal(periodKey('2026-12-31', 'trimestrielle'), '2026-Q4');
});

// ============================================================
// Idempotence : 2 generations consecutives sur meme cursor donnent
// la meme cle de periode (donc bloquees par index unique).
// ============================================================

test('idempotence — meme cursor genere meme periode 2 fois', () => {
  const last = '2026-04-05';
  const next1 = nextOccurrenceDate(last, 'mensuelle', 5);
  const next2 = nextOccurrenceDate(last, 'mensuelle', 5);
  assert.equal(next1, next2);
  assert.equal(periodKey(next1, 'mensuelle'), periodKey(next2, 'mensuelle'));
  assert.equal(periodKey(next1, 'mensuelle'), '2026-05');
});

// ============================================================
// Sequence sur 12 mois consecutifs (sanity check pas de dups)
// ============================================================

test('sequence mensuelle 12 mois - cles uniques', () => {
  const keys = new Set();
  let cursor = '2026-01-15';
  for (let i = 0; i < 12; i++) {
    cursor = nextOccurrenceDate(cursor, 'mensuelle', 15);
    keys.add(periodKey(cursor, 'mensuelle'));
  }
  assert.equal(keys.size, 12);
});
