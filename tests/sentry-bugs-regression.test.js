/**
 * MCA Logistics — Tests regression bugs Sentry mai 2026
 *
 * Couvre :
 *   - normalizeFournisseurType (bug 23514 fournisseurs_type_check x6)
 *   - buildSimplePeriodeState defini globalement (bug ReferenceError x3)
 *   - _chargesPeriode init defensive (bug TypeError on .mode x3)
 *   - _tableauCompact declare avec var (bug TDZ x1)
 *
 * Lancer : node --test tests/sentry-bugs-regression.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// ============================================================
// Bug 2 : normalizeFournisseurType (CHECK fournisseurs_type_check)
// ============================================================
//
// La contrainte DB est CHECK (type IN ('Pro', 'Particulier')). Les forms
// HTML envoient 'pro' / 'particulier' minuscules ; il faut normaliser dans
// l'adapter avant insert.
test('normalizeFournisseurType : casse minuscule -> capitalise', () => {
  // On reproduit la fonction (le fichier est wrappe dans une IIFE) pour
  // tester la logique exacte ligne-par-ligne.
  function normalizeFournisseurType(t) {
    var s = (t == null ? '' : String(t)).trim().toLowerCase();
    if (s === 'particulier') return 'Particulier';
    return 'Pro';
  }
  assert.equal(normalizeFournisseurType('pro'), 'Pro');
  assert.equal(normalizeFournisseurType('PRO'), 'Pro');
  assert.equal(normalizeFournisseurType('Pro'), 'Pro');
  assert.equal(normalizeFournisseurType('particulier'), 'Particulier');
  assert.equal(normalizeFournisseurType('PARTICULIER'), 'Particulier');
  assert.equal(normalizeFournisseurType('Particulier'), 'Particulier');
  assert.equal(normalizeFournisseurType('  particulier  '), 'Particulier');
  // Defaults raisonnables
  assert.equal(normalizeFournisseurType(''), 'Pro');
  assert.equal(normalizeFournisseurType(null), 'Pro');
  assert.equal(normalizeFournisseurType(undefined), 'Pro');
  assert.equal(normalizeFournisseurType('inconnu'), 'Pro');
  // Robustesse type non-string
  assert.equal(normalizeFournisseurType(0), 'Pro');
  assert.equal(normalizeFournisseurType({}), 'Pro');
});

test('all-entity-adapters.js : utilise normalizeFournisseurType pour le champ type', () => {
  const src = fs.readFileSync(path.join(ROOT, 'all-entity-adapters.js'), 'utf8');
  // La definition doit etre presente
  assert.match(src, /function normalizeFournisseurType\s*\(/, 'fonction normalizeFournisseurType absente');
  // Le mapping doit utiliser la fonction (pas le pattern legacy emptyToNull(f.type) || "Pro")
  const pattern = /type:\s*normalizeFournisseurType\(f\.type\)/;
  assert.match(src, pattern, 'fournisseurJsToDb doit appeler normalizeFournisseurType pour type');
  // Le pattern fragile doit avoir disparu
  assert.doesNotMatch(src, /type:\s*emptyToNull\(f\.type\)\s*\|\|\s*['"]Pro['"]/,
    'pattern legacy "emptyToNull(f.type) || Pro" doit avoir ete remplace');
});

// ============================================================
// Bug 4 : buildSimplePeriodeState declare globalement
// ============================================================
test('script-core-stats-helpers.js : buildSimplePeriodeState declaree + exposee sur window', () => {
  const src = fs.readFileSync(path.join(ROOT, 'script-core-stats-helpers.js'), 'utf8');
  assert.match(src, /function buildSimplePeriodeState\s*\(\s*defaultMode\s*\)/);
  assert.match(src, /window\.buildSimplePeriodeState\s*=\s*buildSimplePeriodeState/,
    'doit etre exposee sur window pour fallback dans script.js');
});

test('script.js : fallback window.buildSimplePeriodeState avant 1ere utilisation', () => {
  const src = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
  // Le fallback doit exister
  assert.match(src,
    /if\s*\(\s*typeof\s+window\.buildSimplePeriodeState\s*!==\s*['"]function['"]\s*\)/,
    'fallback typeof window.buildSimplePeriodeState absent');
  // Toutes les init de _xxxPeriode doivent passer par window.buildSimplePeriodeState
  // (eviter ReferenceError si helpers pas charge).
  const periodes = ['_statsPeriode', '_planningPeriode', '_inspPeriode',
                    '_chargesPeriode', '_carbPeriode', '_entrPeriode', '_tvaPeriode'];
  for (const p of periodes) {
    const re = new RegExp(`var\\s+${p}\\s*=\\s*window\\.buildSimplePeriodeState\\(`);
    assert.match(src, re, `init ${p} doit passer par window.buildSimplePeriodeState`);
  }
});

// ============================================================
// Bug 3 : _chargesPeriode.mode init defensive
// ============================================================
test('script-charges.js : init defensive de _chargesPeriode dans afficherCharges + getChargesPeriodeRange', () => {
  const src = fs.readFileSync(path.join(ROOT, 'script-charges.js'), 'utf8');
  // afficherCharges doit verifier _chargesPeriode avant d'acceder .mode
  const matches = src.match(/typeof\s+_chargesPeriode\s*===\s*['"]undefined['"]/g) || [];
  assert.ok(matches.length >= 2,
    `attendu >=2 guards "typeof _chargesPeriode === 'undefined'", trouve ${matches.length}`);
  // Le rebuild doit utiliser un objet { mode, offset } valide
  assert.match(src, /window\._chargesPeriode\s*=\s*\{\s*mode:\s*['"]mois['"]\s*,\s*offset:\s*0\s*\}/);
});

// Simulation runtime : si _chargesPeriode est undefined, le guard doit
// rebuild un objet utilisable. Reproduit la logique du fix.
test('logique guard _chargesPeriode : reconstruit un objet valide si undefined', () => {
  const win = {};
  // Simule le flux de afficherCharges
  function afficherChargesGuard(_chargesPeriode) {
    if (typeof _chargesPeriode === 'undefined' || !_chargesPeriode) {
      win._chargesPeriode = { mode: 'mois', offset: 0 };
      _chargesPeriode = win._chargesPeriode;
    }
    return _chargesPeriode.mode; // ne doit JAMAIS throw
  }
  assert.equal(afficherChargesGuard(undefined), 'mois');
  assert.equal(afficherChargesGuard(null), 'mois');
  assert.equal(afficherChargesGuard({ mode: 'semaine', offset: 2 }), 'semaine');
});

// ============================================================
// Bug 5 : _tableauCompact declare avec var (pas let -> evite TDZ)
// ============================================================
test('script.js : _tableauCompact declare avec var (anti-TDZ)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
  // Doit avoir au moins une declaration var _tableauCompact
  assert.match(src, /var\s+_tableauCompact\s*=\s*false/,
    '_tableauCompact doit etre declare avec var pour eviter TDZ');
  // Ne doit PAS avoir de declaration let _tableauCompact (regression possible)
  assert.doesNotMatch(src, /let\s+_tableauCompact\s*=/,
    'ne pas redeclarer _tableauCompact avec let (regression TDZ)');
});

// ============================================================
// Bug 1 : Pennylane HTTP 400 — diagnostic test (skip si non implementable)
// ============================================================
//
// Le fix Pennylane est documente dans la PR (depasse 200 LOC + recherche metier
// requise). Ce test verifie au minimum que le code utilise bien les bons
// helpers pennylaneHeaders() et que l'URL de base reste configurable.
test('tools-impl.ts pennylane : utilise pennylaneHeaders() et URL base v2', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'infra/supabase/functions/ai-chat/tools-impl.ts'), 'utf8');
  assert.match(src, /const PENNYLANE_BASE\s*=\s*['"]https:\/\/app\.pennylane\.com\/api\/external\/v2['"]/);
  assert.match(src, /function pennylaneHeaders\(\)/);
  assert.match(src, /Bearer \$\{tok\}/);
});
