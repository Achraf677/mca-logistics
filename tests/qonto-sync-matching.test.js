/**
 * MCA Logistics — Tests de scoring matching Qonto -> livraisons / charges
 *
 * Mirroir JS pur des fonctions exportees par
 * `infra/supabase/functions/qonto-sync-daily/index.ts`.
 * Si tu modifies les seuils ou la formule la-bas, ajuste ici aussi.
 *
 * Lancer : node --test tests/qonto-sync-matching.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const AMOUNT_TOLERANCE_EUR = 0.5;
const DATE_WINDOW_DAYS = 15;
const SCORE_THRESHOLD_WRITE = 0.7;

function normalizeName(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 1;
  const ta = new Set(na.split(' ').filter((w) => w.length >= 3));
  const tb = new Set(nb.split(' ').filter((w) => w.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function daysBetween(aISO, bISO) {
  const a = Date.parse(aISO + 'T00:00:00Z');
  const b = Date.parse(bISO + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.abs(a - b) / 86400000;
}

function matchScore({ txAmount, candidateAmount, txDateISO, candidateDateISO, txName, candidateName }) {
  const amountDiff = Math.abs(txAmount - candidateAmount);
  const dateDiffDays = daysBetween(txDateISO, candidateDateISO);
  if (amountDiff > AMOUNT_TOLERANCE_EUR) return { score: 0, amountDiff, dateDiffDays, nameScore: 0 };
  if (dateDiffDays > DATE_WINDOW_DAYS) return { score: 0, amountDiff, dateDiffDays, nameScore: 0 };
  const amountScore = 1 - amountDiff / AMOUNT_TOLERANCE_EUR;
  const dateScore = 1 - dateDiffDays / DATE_WINDOW_DAYS;
  const nameScore = nameSimilarity(txName, candidateName);
  const score = 0.5 * amountScore + 0.3 * dateScore + 0.2 * nameScore;
  return {
    score: Number(score.toFixed(4)),
    amountDiff: Number(amountDiff.toFixed(2)),
    dateDiffDays: Number(dateDiffDays.toFixed(2)),
    nameScore: Number(nameScore.toFixed(2)),
  };
}

function pickWinner(cands) {
  if (cands.length === 0) return { kind: 'none' };
  const top = cands[0];
  if (top.score <= SCORE_THRESHOLD_WRITE) return { kind: 'none' };
  const second = cands[1];
  if (!second) return { kind: 'single', pick: top };
  if (second.score <= SCORE_THRESHOLD_WRITE) return { kind: 'single', pick: top };
  if (top.score - second.score < 0.05) {
    return { kind: 'ambiguous', top: cands.filter((c) => c.score > SCORE_THRESHOLD_WRITE) };
  }
  return { kind: 'single', pick: top };
}

// ============================================================
// normalizeName
// ============================================================
test('normalizeName : retire accents, ponctuation, casse, espaces', () => {
  assert.equal(normalizeName('TOTAL ÉNERGIES SAS'), 'total energies sas');
  assert.equal(normalizeName('LECLERC, Drive  '), 'leclerc drive');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeName(null), '');
  assert.equal(normalizeName('Café  & Co.'), 'cafe co');
});

// ============================================================
// nameSimilarity
// ============================================================
test('nameSimilarity : 1.0 si l un contient l autre', () => {
  assert.equal(nameSimilarity('TOTAL ENERGIES SAS', 'Total Energies'), 1);
  assert.equal(nameSimilarity('Carrefour', 'CARREFOUR HYPERMARCHE PARIS'), 1);
});

test('nameSimilarity : Jaccard sur tokens >= 3 lettres', () => {
  // "transports dupont" vs "dupont logistique" => "dupont" en commun, autres hors
  // Jaccard = 1 / (2 + 2 - 1) = 0.333
  const s = nameSimilarity('transports dupont', 'dupont logistique');
  assert.ok(s > 0.3 && s < 0.4, `expected ~0.33, got ${s}`);
});

test('nameSimilarity : 0 si rien en commun', () => {
  assert.equal(nameSimilarity('Total', 'Carrefour'), 0);
});

test('nameSimilarity : 0 si l un est vide', () => {
  assert.equal(nameSimilarity('', 'Total'), 0);
  assert.equal(nameSimilarity('Total', ''), 0);
});

// ============================================================
// matchScore — montants
// ============================================================
test('matchScore : montant pile + date pile + nom pile -> 1.0', () => {
  const r = matchScore({
    txAmount: 1200,
    candidateAmount: 1200,
    txDateISO: '2026-05-07',
    candidateDateISO: '2026-05-07',
    txName: 'TOTAL ENERGIES',
    candidateName: 'Total Energies SAS',
  });
  assert.equal(r.score, 1);
});

test('matchScore : montant hors tolerance -> 0', () => {
  const r = matchScore({
    txAmount: 1200,
    candidateAmount: 1201,
    txDateISO: '2026-05-07',
    candidateDateISO: '2026-05-07',
    txName: 'X',
    candidateName: 'X',
  });
  assert.equal(r.score, 0);
});

test('matchScore : montant pile a la limite tolere (0.50€)', () => {
  const r = matchScore({
    txAmount: 1200,
    candidateAmount: 1200.5,
    txDateISO: '2026-05-07',
    candidateDateISO: '2026-05-07',
    txName: 'X',
    candidateName: 'X',
  });
  // amountScore = 0, dateScore = 1, nameScore = 1 -> 0*0.5 + 1*0.3 + 1*0.2 = 0.5
  assert.equal(r.score, 0.5);
});

// ============================================================
// matchScore — dates
// ============================================================
test('matchScore : date hors fenetre (16j) -> 0', () => {
  const r = matchScore({
    txAmount: 100,
    candidateAmount: 100,
    txDateISO: '2026-05-23',
    candidateDateISO: '2026-05-07',
    txName: 'X',
    candidateName: 'X',
  });
  assert.equal(r.score, 0);
});

test('matchScore : date a 15j (limite) -> ok', () => {
  const r = matchScore({
    txAmount: 100,
    candidateAmount: 100,
    txDateISO: '2026-05-22',
    candidateDateISO: '2026-05-07',
    txName: 'X',
    candidateName: 'X',
  });
  // amountScore=1, dateScore=0, nameScore=1 -> 0.5 + 0 + 0.2 = 0.7
  assert.ok(Math.abs(r.score - 0.7) < 0.001, `expected 0.7, got ${r.score}`);
});

// ============================================================
// matchScore — seuil 0.7 d ecriture
// ============================================================
test('matchScore : ecart 5j + nom different = sous 0.7 (ambiguous/no-write)', () => {
  // amountDiff=0 -> 1
  // dateDiff=5 -> 1 - 5/15 = 0.666
  // nameScore=0
  // score = 0.5 + 0.3*0.666 + 0 = 0.7
  // Pile sur 0.7 : doit ne PAS ecrire (strictly >).
  const r = matchScore({
    txAmount: 500,
    candidateAmount: 500,
    txDateISO: '2026-05-12',
    candidateDateISO: '2026-05-07',
    txName: 'INCONNU',
    candidateName: 'AUTRECHOSE',
  });
  assert.ok(r.score <= 0.7 + 0.001, `expected ~0.7, got ${r.score}`);
});

test('matchScore : montant pile + date a 3j + nom similar -> > 0.7', () => {
  const r = matchScore({
    txAmount: 1200,
    candidateAmount: 1200,
    txDateISO: '2026-05-10',
    candidateDateISO: '2026-05-07',
    txName: 'TRANSPORT DUPONT SARL',
    candidateName: 'Transport Dupont',
  });
  assert.ok(r.score > 0.7, `expected > 0.7, got ${r.score}`);
});

// ============================================================
// pickWinner
// ============================================================
test('pickWinner : aucun candidat', () => {
  assert.deepEqual(pickWinner([]), { kind: 'none' });
});

test('pickWinner : top a 0.65 (sous seuil) -> none', () => {
  assert.deepEqual(pickWinner([{ score: 0.65 }]), { kind: 'none' });
});

test('pickWinner : top unique a 0.85 -> single', () => {
  const v = pickWinner([{ score: 0.85 }]);
  assert.equal(v.kind, 'single');
});

test('pickWinner : top 0.85, second 0.83 (ecart < 0.05) -> ambiguous', () => {
  const v = pickWinner([{ score: 0.85 }, { score: 0.83 }]);
  assert.equal(v.kind, 'ambiguous');
});

test('pickWinner : top 0.95, second 0.71 (ecart >= 0.05) -> single', () => {
  const v = pickWinner([{ score: 0.95 }, { score: 0.71 }]);
  assert.equal(v.kind, 'single');
});

test('pickWinner : top 0.95, second 0.65 (sous seuil) -> single', () => {
  const v = pickWinner([{ score: 0.95 }, { score: 0.65 }]);
  assert.equal(v.kind, 'single');
});

// ============================================================
// Cas d'usage realistes (smoke test)
// ============================================================
test('cas : virement client TTC pile, J+2, libelle exact -> match fort', () => {
  const r = matchScore({
    txAmount: 3600,
    candidateAmount: 3600,
    txDateISO: '2026-05-09',
    candidateDateISO: '2026-05-07',
    txName: 'CARREFOUR LOGISTIQUE',
    candidateName: 'CARREFOUR LOGISTIQUE FRANCE',
  });
  assert.ok(r.score > 0.85, `expected > 0.85, got ${r.score}`);
});

test('cas : 2 livraisons meme client, meme montant, dates differentes -> ambiguous si proches', () => {
  const tx = { txAmount: 800, txDateISO: '2026-05-08', txName: 'TOTAL ENERGIES' };
  // Livraison A : J-3, montant pile, nom pile -> tres haut
  const a = matchScore({
    ...tx,
    candidateAmount: 800,
    candidateDateISO: '2026-05-05',
    candidateName: 'Total Energies',
  });
  // Livraison B : J+1, montant pile, nom pile -> tres haut aussi
  const b = matchScore({
    ...tx,
    candidateAmount: 800,
    candidateDateISO: '2026-05-09',
    candidateName: 'Total Energies',
  });
  const v = pickWinner([a, b].sort((x, y) => y.score - x.score));
  // Les deux scores sont tres proches -> ambiguous
  assert.equal(v.kind, 'ambiguous');
});
