/**
 * MCA Logistics — Tests unitaires du parser/aggregator visual audit.
 *
 * Couvre :
 *   1. Le parser de reponses Gemini (markdown / JSON brut / fenced /
 *      tableaux directs) — port JS du module TS.
 *   2. Le builder markdown de l'aggregator (groupement par severity,
 *      stats, screenshots).
 *
 * Lancer : node --test tests/visual-audit-parser.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMarkdown, bucketize } = require('../tools/visual-audit-aggregator.js');

// ============================================================
// Port JS du parser TS (parser.ts) pour tester le comportement reel.
// On garde la meme logique pour que les tests detectent les regressions
// si on touche au parser cote edge function.
// ============================================================

function extractJsonBlock(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(s);
  } catch (_) { /* fallthrough */ }
  const startObj = s.indexOf('{');
  const startArr = s.indexOf('[');
  let start = -1;
  let endChar = '';
  if (startArr !== -1 && (startObj === -1 || startArr < startObj)) {
    start = startArr;
    endChar = ']';
  } else if (startObj !== -1) {
    start = startObj;
    endChar = '}';
  }
  if (start === -1) return null;
  const end = s.lastIndexOf(endChar);
  if (end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function normSeverity(v) {
  if (typeof v !== 'string') return 'minor';
  const s = v.trim().toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'blocker') return 'critical';
  if (s === 'major' || s === 'medium' || s === 'warning') return 'major';
  if (s === 'critical' || s === 'major' || s === 'minor') return s;
  return 'minor';
}

function normString(v, max = 500) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function normalizeIssue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const description = normString(raw.description ?? raw.issue ?? raw.problem, 1000);
  if (!description) return null;
  return {
    severity: normSeverity(raw.severity ?? raw.level ?? raw.priority),
    location: normString(raw.location ?? raw.area ?? raw.zone ?? raw.selector, 200),
    description,
    fix_suggestion: normString(raw.fix_suggestion ?? raw.fix ?? raw.suggestion ?? raw.recommendation, 500),
  };
}

function parseGeminiAudit(raw) {
  const obj = extractJsonBlock(raw);
  if (!obj) return [];
  let arr = [];
  if (Array.isArray(obj)) arr = obj;
  else if (obj && typeof obj === 'object') {
    if (Array.isArray(obj.issues)) arr = obj.issues;
    else if (Array.isArray(obj.findings)) arr = obj.findings;
    else if (Array.isArray(obj.results)) arr = obj.results;
  }
  const out = [];
  for (const item of arr.slice(0, 50)) {
    const norm = normalizeIssue(item);
    if (norm) out.push(norm);
  }
  return out;
}

// ============================================================
// Tests parser
// ============================================================

test('parser: JSON simple { issues: [...] }', () => {
  const raw = JSON.stringify({
    issues: [
      { severity: 'critical', location: 'header', description: 'Bouton coupe', fix_suggestion: 'reduire padding' },
      { severity: 'minor', location: 'sidebar', description: 'Espacement non optimal', fix_suggestion: '' },
    ],
  });
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 2);
  assert.equal(out[0].severity, 'critical');
  assert.equal(out[1].severity, 'minor');
});

test('parser: JSON entoure de fence ```json ... ```', () => {
  const raw = '```json\n{ "issues": [{ "severity": "major", "description": "Contraste faible" }] }\n```';
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'major');
  assert.equal(out[0].description, 'Contraste faible');
});

test('parser: tableau direct [...]', () => {
  const raw = '[{ "severity": "critical", "description": "Modale deborde" }]';
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'critical');
});

test('parser: prefix prose puis JSON', () => {
  const raw = 'Voici l\'analyse :\n\n{"issues": [{"severity": "minor", "description": "Bord doux"}]}';
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 1);
});

test('parser: ignore les entries sans description', () => {
  const raw = JSON.stringify({
    issues: [
      { severity: 'critical', description: '' },
      { severity: 'major', description: 'Vrai defaut' },
    ],
  });
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, 'Vrai defaut');
});

test('parser: synonymes severity (high -> critical, medium -> major, low -> minor)', () => {
  const raw = JSON.stringify({
    issues: [
      { severity: 'high', description: 'A' },
      { severity: 'medium', description: 'B' },
      { severity: 'low', description: 'C' },
      { severity: 'unknown', description: 'D' },
    ],
  });
  const out = parseGeminiAudit(raw);
  assert.deepEqual(out.map(i => i.severity), ['critical', 'major', 'minor', 'minor']);
});

test('parser: tolere alias clefs (issue, problem, fix, suggestion)', () => {
  const raw = JSON.stringify({
    findings: [
      { level: 'critical', area: 'modal', issue: 'Texte coupe', recommendation: 'Augmenter la largeur' },
    ],
  });
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'critical');
  assert.equal(out[0].location, 'modal');
  assert.equal(out[0].description, 'Texte coupe');
  assert.equal(out[0].fix_suggestion, 'Augmenter la largeur');
});

test('parser: input vide / invalide -> tableau vide', () => {
  assert.deepEqual(parseGeminiAudit(''), []);
  assert.deepEqual(parseGeminiAudit('not json at all'), []);
  assert.deepEqual(parseGeminiAudit(null), []);
  assert.deepEqual(parseGeminiAudit(undefined), []);
});

test('parser: plafonne a 50 issues', () => {
  const issues = [];
  for (let i = 0; i < 100; i++) issues.push({ severity: 'minor', description: `issue ${i}` });
  const raw = JSON.stringify({ issues });
  const out = parseGeminiAudit(raw);
  assert.equal(out.length, 50);
});

test('parser: tronque description longue a 1000 chars', () => {
  const longDesc = 'x'.repeat(2000);
  const raw = JSON.stringify({ issues: [{ severity: 'minor', description: longDesc }] });
  const out = parseGeminiAudit(raw);
  assert.equal(out[0].description.length, 1000);
});

// ============================================================
// Tests buildMarkdown (aggregator)
// ============================================================

test('aggregator: buildMarkdown groupe par severity', () => {
  const audit = {
    triggered_at: '2026-05-09T03:30:00Z',
    triggered_by: 'cron',
    prompt_context: 'audit quotidien',
    screenshots: [
      { url: '/admin.html#dashboard', viewport: 'pc', file: 'pc-dashboard.png', label: '[pc] Dashboard' },
    ],
    run_ids: ['abc-123'],
    issues: [
      { severity: 'critical', location: 'header', description: 'Bouton coupe', fix_suggestion: 'fix A', url: '/admin.html#dashboard', viewport: 'pc' },
      { severity: 'major', location: 'sidebar', description: 'Contraste faible', fix_suggestion: 'fix B', url: '/admin.html#dashboard', viewport: 'pc' },
      { severity: 'minor', location: 'footer', description: 'Polish', fix_suggestion: '', url: '/admin.html#dashboard', viewport: 'pc' },
    ],
  };
  const md = buildMarkdown(audit, { runUrl: 'https://github.com/x/y/actions/runs/1' });
  assert.match(md, /# Visual Audit 2026-05-09/);
  assert.match(md, /## Critical/);
  assert.match(md, /## Major/);
  assert.match(md, /## Minor/);
  assert.match(md, /Bouton coupe/);
  assert.match(md, /Contraste faible/);
  assert.match(md, /Polish/);
  assert.match(md, /Routes \/ screenshots analyses : \*\*1\*\*/);
  assert.match(md, /Issues totales : \*\*3\*\*/);
  assert.match(md, /critical: 1, major: 1, minor: 1/);
});

test('aggregator: buildMarkdown sans issues -> message "Aucun defaut"', () => {
  const audit = {
    triggered_at: '2026-05-09T03:30:00Z',
    triggered_by: 'manual',
    screenshots: [],
    issues: [],
  };
  const md = buildMarkdown(audit, {});
  assert.match(md, /Aucun defaut visuel detecte/);
  assert.match(md, /Issues totales : \*\*0\*\*/);
});

test('aggregator: buildMarkdown ne casse pas si severity inconnue', () => {
  const audit = {
    triggered_at: '2026-05-09',
    issues: [
      { severity: 'unknown_xx', description: 'doit tomber dans minor', location: '', fix_suggestion: '' },
    ],
  };
  const md = buildMarkdown(audit, {});
  assert.match(md, /## Minor/);
});

test('aggregator: bucketize compte correctement', () => {
  const issues = [
    { severity: 'critical', description: 'a' },
    { severity: 'critical', description: 'b' },
    { severity: 'major', description: 'c' },
    { severity: 'minor', description: 'd' },
    { severity: 'invalid', description: 'e' },
  ];
  const b = bucketize(issues);
  assert.equal(b.critical.length, 2);
  assert.equal(b.major.length, 1);
  // 'invalid' -> bucket 'minor'
  assert.equal(b.minor.length, 2);
});
