/**
 * Tests unitaires pour l'edge function pennylane-fec-import.
 *
 * On ne peut pas executer directement le code Deno depuis Node, mais on
 * reproduit ici les fonctions pures critiques (parsing FEC, mapping
 * categorie, idempotency key) pour les blinder.
 *
 * Lancer : node --test tests/pennylane-fec-import.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// =============================================================
// Reimplementation des helpers pour test (copies du fichier TS)
// =============================================================

function parseFecDate(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (/^\d{8}$/.test(t)) {
    return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseFecAmount(raw) {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/\s/g, '').replace(/,/g, '.');
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function lastDayOfMonth(year, month) {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonth(year, month) {
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-01`;
}

function categorieFromCompte(compte, libelle) {
  const c = (compte || '').trim();
  const lib = (libelle || '').toLowerCase();
  if (!c) return 'autre';
  if (c.startsWith('606')) {
    if (lib.includes('carbur') || lib.includes('essence') || lib.includes('gasoil') || lib.includes('gazole')) return 'carburant';
    return 'autre';
  }
  if (c.startsWith('6155')) return 'entretien';
  if (c.startsWith('616')) return 'assurance';
  if (c.startsWith('6248') || c.startsWith('6241') || c.startsWith('6242')) return 'autre';
  if (c.startsWith('6354') || c.startsWith('6358')) return 'tva';
  if (c.startsWith('641') || c.startsWith('644') || c.startsWith('645') || c.startsWith('647')) return 'salaires';
  if (c.startsWith('612') || c.startsWith('613')) return 'lld_credit';
  if (lib.includes('peage') || lib.includes('autoroute') || lib.includes('apr')) return 'peage';
  return 'autre';
}

function ecritureKey(year, journalCode, ecritureNum, compteNum) {
  return `${year}|${journalCode}|${ecritureNum}|${compteNum}`;
}

function parseFecCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = firstLine.includes('|') ? '|' : '\t';
  const format = sep === '|' ? 'csv-pipe' : 'csv-tab';
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return { rows: [], format };
  const header = lines[0].split(sep).map((h) => h.trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const cols = {
    JournalCode: idx('JournalCode'),
    EcritureNum: idx('EcritureNum'),
    EcritureDate: idx('EcritureDate'),
    CompteNum: idx('CompteNum'),
    CompteLib: idx('CompteLib'),
    CompAuxNum: idx('CompAuxNum'),
    CompAuxLib: idx('CompAuxLib'),
    PieceRef: idx('PieceRef'),
    EcritureLib: idx('EcritureLib'),
    Debit: idx('Debit'),
    Credit: idx('Credit'),
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const c = line.split(sep);
    const get = (j) => (j >= 0 && j < c.length ? (c[j] ?? '').trim() : '');
    out.push({
      JournalCode: get(cols.JournalCode),
      EcritureNum: get(cols.EcritureNum),
      EcritureDate: get(cols.EcritureDate),
      CompteNum: get(cols.CompteNum),
      CompteLib: get(cols.CompteLib),
      CompAuxNum: get(cols.CompAuxNum),
      CompAuxLib: get(cols.CompAuxLib),
      PieceRef: get(cols.PieceRef),
      EcritureLib: get(cols.EcritureLib),
      Debit: parseFecAmount(get(cols.Debit)),
      Credit: parseFecAmount(get(cols.Credit)),
    });
  }
  return { rows: out, format };
}

// =============================================================
// Tests
// =============================================================

test('parseFecDate accepte format YYYYMMDD (FEC officiel)', () => {
  assert.equal(parseFecDate('20260315'), '2026-03-15');
  assert.equal(parseFecDate('20260101'), '2026-01-01');
});

test('parseFecDate accepte format YYYY-MM-DD', () => {
  assert.equal(parseFecDate('2026-03-15'), '2026-03-15');
  assert.equal(parseFecDate('2026-03-15T10:00:00Z'), '2026-03-15');
});

test('parseFecDate accepte format DD/MM/YYYY', () => {
  assert.equal(parseFecDate('15/03/2026'), '2026-03-15');
});

test('parseFecDate retourne null pour input vide ou invalide', () => {
  assert.equal(parseFecDate(''), null);
  assert.equal(parseFecDate('foo'), null);
  assert.equal(parseFecDate(null), null);
});

test('parseFecAmount supporte virgule decimale FR', () => {
  assert.equal(parseFecAmount('123,45'), 123.45);
  assert.equal(parseFecAmount('1 234,56'), 1234.56);
});

test('parseFecAmount supporte point decimal', () => {
  assert.equal(parseFecAmount('123.45'), 123.45);
});

test('parseFecAmount retourne 0 pour vide', () => {
  assert.equal(parseFecAmount(''), 0);
  assert.equal(parseFecAmount(null), 0);
  assert.equal(parseFecAmount('foo'), 0);
});

test('firstDayOfMonth / lastDayOfMonth corrects', () => {
  assert.equal(firstDayOfMonth(2026, 4), '2026-04-01');
  assert.equal(lastDayOfMonth(2026, 4), '2026-04-30');
  assert.equal(lastDayOfMonth(2026, 2), '2026-02-28');
  assert.equal(lastDayOfMonth(2024, 2), '2024-02-29'); // bissextile
  assert.equal(lastDayOfMonth(2026, 12), '2026-12-31');
});

test('categorieFromCompte mappe correctement les comptes 6XX', () => {
  assert.equal(categorieFromCompte('60611', 'Carburant gasoil'), 'carburant');
  assert.equal(categorieFromCompte('60630', 'Petites fournitures'), 'autre');
  assert.equal(categorieFromCompte('61551', 'Entretien vehicule'), 'entretien');
  assert.equal(categorieFromCompte('6161', 'Prime assurance'), 'assurance');
  assert.equal(categorieFromCompte('6411', 'Salaires bruts'), 'salaires');
  assert.equal(categorieFromCompte('6125', 'Credit-bail mobilier'), 'lld_credit');
  assert.equal(categorieFromCompte('63540', 'TVA reverser'), 'tva');
  assert.equal(categorieFromCompte('6240', 'Peage autoroute'), 'peage');
});

test('ecritureKey est deterministe et unique par ligne', () => {
  const k1 = ecritureKey(2026, 'AC', 'EC001', '6061');
  const k2 = ecritureKey(2026, 'AC', 'EC001', '4011');
  const k3 = ecritureKey(2026, 'AC', 'EC001', '6061');
  assert.equal(k1, k3);
  assert.notEqual(k1, k2);
  assert.equal(k1, '2026|AC|EC001|6061');
});

test('parseFecCsv parse format pipe standard FR', () => {
  const csv = [
    'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise',
    'AC|Achats|EC001|20260315|60611|Carburant|F0001|TOTAL ENERGIES|F-2026-001|20260315|Plein gasoil|150,00|0,00|||20260315||',
    'AC|Achats|EC001|20260315|44566|TVA deductible|||F-2026-001|20260315|TVA|30,00|0,00|||20260315||',
    'AC|Achats|EC001|20260315|4011|Fournisseurs|F0001|TOTAL ENERGIES|F-2026-001|20260315|Solde|0,00|180,00|||20260315||',
  ].join('\n');
  const { rows, format } = parseFecCsv(csv);
  assert.equal(format, 'csv-pipe');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].JournalCode, 'AC');
  assert.equal(rows[0].EcritureNum, 'EC001');
  assert.equal(rows[0].CompteNum, '60611');
  assert.equal(rows[0].CompAuxLib, 'TOTAL ENERGIES');
  assert.equal(rows[0].Debit, 150);
  assert.equal(rows[0].Credit, 0);
  assert.equal(rows[2].CompteNum, '4011');
  assert.equal(rows[2].Credit, 180);
});

test('parseFecCsv parse format tab egalement', () => {
  const csv = [
    'JournalCode\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\tPieceRef\tEcritureLib\tDebit\tCredit',
    'AC\tEC001\t20260315\t60611\tCarburant\tF0001\tTOTAL\tF-2026-001\tPlein\t150,00\t0,00',
  ].join('\n');
  const { rows, format } = parseFecCsv(csv);
  assert.equal(format, 'csv-tab');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].CompteNum, '60611');
  assert.equal(rows[0].Debit, 150);
});

test('parseFecCsv ignore lignes vides', () => {
  const csv = [
    'JournalCode|EcritureNum|CompteNum|Debit|Credit',
    'AC|EC001|6061|100|0',
    '',
    '   ',
    'AC|EC002|6061|200|0',
  ].join('\n');
  const { rows } = parseFecCsv(csv);
  assert.equal(rows.length, 2);
});
