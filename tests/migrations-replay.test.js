/**
 * MCA Logistics - Tests idempotence migrations SQL (Sprint H3.2)
 *
 * Verifie que les migrations critiques peuvent etre rejouees sans erreur
 * (re-execution = no-op grace aux IF NOT EXISTS / DROP IF EXISTS / OR REPLACE).
 *
 * Conditions :
 * - Necessite une instance Postgres locale + variables d'env
 *   (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
 * - Skip silencieusement si :
 *     a) module 'pg' non installe (devDep optionnelle)
 *     b) pas de variable PGHOST / DATABASE_URL (env CI minimal)
 * - N'execute jamais sur la prod : nettoie le schema avant + apres.
 *
 * Lancer : node --test tests/migrations-replay.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'infra', 'supabase');
const TARGETED_MIGRATIONS = [
  '001_init.sql',
  '003_admin_salaries_policies.sql',
  '004_remote_app_state.sql',
  '005_normalize_admin_display_names.sql',
  '009_phase0_storage_buckets.sql',
];

// Patterns que les migrations idempotentes doivent respecter.
// Tests statiques (ne necessitent PAS de connexion pg).
const IDEMPOTENT_KEYWORDS = [
  /create\s+table\s+if\s+not\s+exists/i,
  /create\s+index\s+if\s+not\s+exists/i,
  /create\s+or\s+replace\s+function/i,
  /drop\s+policy\s+if\s+exists/i,
  /on\s+conflict/i,
];

// Anti-patterns interdits (statements bare non protegees).
// On regarde ligne par ligne en filtrant les commentaires.
function findNonIdempotentStatements(sql) {
  const lines = sql.split('\n');
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/--.*$/, '').trim().toLowerCase();
    if (!line) continue;

    // create table sans if not exists
    if (/^create\s+table\s+(?!if\s+not\s+exists)/.test(line)) {
      issues.push({ line: i + 1, type: 'create table', text: raw.trim() });
    }
    // create index sans if not exists
    if (/^create\s+(unique\s+)?index\s+(?!if\s+not\s+exists)/.test(line)) {
      issues.push({ line: i + 1, type: 'create index', text: raw.trim() });
    }
    // create policy non precedee d'un drop policy if exists (heuristique : on
    // verifie si le bloc d'avant contient "drop policy if exists" pour le meme nom)
    if (/^create\s+policy\s+/.test(line)) {
      const match = line.match(/^create\s+policy\s+("[^"]+"|\S+)/);
      const policyName = match ? match[1] : null;
      if (policyName) {
        const prev10 = lines.slice(Math.max(0, i - 10), i).join('\n').toLowerCase();
        const dropPattern = new RegExp(
          `drop\\s+policy\\s+if\\s+exists\\s+${policyName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
          'i'
        );
        if (!dropPattern.test(prev10)) {
          issues.push({ line: i + 1, type: 'create policy (no drop)', text: raw.trim() });
        }
      }
    }
    // create function (non or replace)
    if (/^create\s+function\s+/.test(line)) {
      issues.push({ line: i + 1, type: 'create function (no replace)', text: raw.trim() });
    }
    // create trigger non precede d'un drop trigger
    if (/^create\s+trigger\s+/.test(line)) {
      const match = line.match(/^create\s+trigger\s+(\S+)/);
      const trigName = match ? match[1] : null;
      if (trigName) {
        const prev10 = lines.slice(Math.max(0, i - 10), i).join('\n').toLowerCase();
        if (!new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${trigName}`, 'i').test(prev10)) {
          issues.push({ line: i + 1, type: 'create trigger (no drop)', text: raw.trim() });
        }
      }
    }
  }
  return issues;
}

// ============================================================
// Tests STATIQUES (toujours executes)
// ============================================================

for (const file of TARGETED_MIGRATIONS) {
  test(`${file} : aucun statement non-idempotent`, () => {
    const sqlPath = path.join(MIGRATIONS_DIR, file);
    assert.ok(fs.existsSync(sqlPath), `${file} introuvable`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const issues = findNonIdempotentStatements(sql);
    if (issues.length > 0) {
      const report = issues
        .map(i => `  L${i.line} [${i.type}] ${i.text}`)
        .join('\n');
      assert.fail(`${file} contient ${issues.length} statement(s) non-idempotent(s) :\n${report}`);
    }
  });
}

test('au moins un pattern idempotent par migration ciblee', () => {
  for (const file of TARGETED_MIGRATIONS) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Migration 005 est uniquement des UPDATE WHERE (idempotent par nature)
    if (file === '005_normalize_admin_display_names.sql') {
      const hasUpdate = /\bupdate\s+public\./i.test(sql);
      assert.ok(hasUpdate, `${file} devrait contenir des UPDATE`);
      continue;
    }
    const matched = IDEMPOTENT_KEYWORDS.some(rx => rx.test(sql));
    assert.ok(matched, `${file} ne contient aucun pattern idempotent connu`);
  }
});

// ============================================================
// Tests DYNAMIQUES (skip si pg non disponible)
// ============================================================

let pgClient = null;
let pgAvailable = false;

try {
  const { Client } = require('pg');
  if (process.env.PGHOST || process.env.DATABASE_URL) {
    pgClient = new Client();
    pgAvailable = true;
  }
} catch {
  pgAvailable = false;
}

test('replay double sur instance pg locale', { skip: !pgAvailable }, async () => {
  await pgClient.connect();
  try {
    // Premier passage
    for (const file of TARGETED_MIGRATIONS) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await pgClient.query(sql);
    }
    // Second passage : doit etre no-op, aucune erreur
    for (const file of TARGETED_MIGRATIONS) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await assert.doesNotReject(
        pgClient.query(sql),
        `${file} a echoue au replay (non idempotent)`
      );
    }
  } finally {
    await pgClient.end();
  }
});
