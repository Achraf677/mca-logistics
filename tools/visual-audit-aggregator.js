#!/usr/bin/env node
// tools/visual-audit-aggregator.js
//
// Lit le fichier `tests/visual-audit-output/issues.json` produit par le spec
// Playwright `tests/visual-audit.spec.js`, formate un rapport Markdown et :
//   - Si > 0 issue critical : ouvre une issue GitHub via `gh issue create`.
//   - Sinon : commente une issue GitHub "rolling" unique
//     (label: visual-audit-rolling). Si elle n'existe pas, on la cree.
//
// Variables d'env utilisees :
//   GITHUB_TOKEN          : token avec scope `repo` (fourni par GH Actions)
//   GITHUB_REPOSITORY     : owner/repo (fourni par GH Actions)
//   GITHUB_RUN_ID         : id du run (lien artifact)
//   GITHUB_SERVER_URL     : ex https://github.com
//   AUDIT_INPUT           : path du JSON (default tests/visual-audit-output/issues.json)
//   AUDIT_OUTPUT_MD       : path d'ecriture du markdown (default tests/visual-audit-output/report.md)
//   AUDIT_DRY_RUN         : "1" pour ne pas appeler l'API GitHub (test local)
//
// Usage local :
//   AUDIT_DRY_RUN=1 node tools/visual-audit-aggregator.js
//
// Usage CI : appele apres le spec Playwright, voir workflow visual-audit-daily.yml.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const INPUT = process.env.AUDIT_INPUT || path.join(process.cwd(), 'tests', 'visual-audit-output', 'issues.json');
const OUTPUT_MD = process.env.AUDIT_OUTPUT_MD || path.join(process.cwd(), 'tests', 'visual-audit-output', 'report.md');
const DRY_RUN = process.env.AUDIT_DRY_RUN === '1';
const ROLLING_LABEL = 'visual-audit-rolling';
const SEVERITIES = ['critical', 'major', 'minor'];

const SEVERITY_HEADER = {
  critical: '## Critical (overlap, broken, unreadable)',
  major: '## Major (contrast, alignment off, padding broken)',
  minor: '## Minor (polish, nice-to-have)',
};

// ---------- Helpers exported pour tests unitaires ----------

function buildMarkdown(audit, ctx = {}) {
  const date = (audit?.triggered_at || new Date().toISOString()).slice(0, 10);
  const issues = Array.isArray(audit?.issues) ? audit.issues : [];
  const screenshots = Array.isArray(audit?.screenshots) ? audit.screenshots : [];
  const buckets = { critical: [], major: [], minor: [] };
  for (const i of issues) {
    const sev = SEVERITIES.includes(i.severity) ? i.severity : 'minor';
    buckets[sev].push(i);
  }

  const lines = [];
  lines.push(`# Visual Audit ${date}`);
  lines.push('');
  if (audit?.prompt_context) lines.push(`> Contexte : ${audit.prompt_context}`);
  lines.push(`> Trigger : \`${audit?.triggered_by || 'unknown'}\``);
  if (ctx.runUrl) lines.push(`> Run : ${ctx.runUrl}`);
  lines.push('');

  for (const sev of SEVERITIES) {
    if (!buckets[sev].length) continue;
    lines.push(SEVERITY_HEADER[sev]);
    lines.push('');
    for (const it of buckets[sev]) {
      const loc = it.location ? ` _(${it.location})_` : '';
      const fix = it.fix_suggestion ? `  \n  **Fix** : ${it.fix_suggestion}` : '';
      const where = (it.url || it.viewport)
        ? `  \n  **Page** : \`${it.viewport || '?'}\` — \`${it.url || '?'}\``
        : '';
      lines.push(`- ${it.description}${loc}${where}${fix}`);
    }
    lines.push('');
  }

  if (issues.length === 0) {
    lines.push('Aucun defaut visuel detecte sur ce run.');
    lines.push('');
  }

  lines.push('## Stats');
  lines.push('');
  lines.push(`- Routes / screenshots analyses : **${screenshots.length}**`);
  lines.push(`- Issues totales : **${issues.length}** (critical: ${buckets.critical.length}, major: ${buckets.major.length}, minor: ${buckets.minor.length})`);
  if (Array.isArray(audit?.run_ids) && audit.run_ids.length) {
    lines.push(`- Run IDs Supabase : ${audit.run_ids.map((r) => `\`${r}\``).join(', ')}`);
  }
  lines.push('');

  if (ctx.artifactUrl || screenshots.length) {
    lines.push('## Screenshots');
    lines.push('');
    if (ctx.artifactUrl) {
      lines.push(`Artifact GitHub Actions (retention 7j) : ${ctx.artifactUrl}`);
      lines.push('');
    }
    if (screenshots.length) {
      lines.push('<details><summary>Liste des screenshots</summary>');
      lines.push('');
      for (const s of screenshots) {
        lines.push(`- \`${s.viewport}\` ${s.label || s.url} → \`${s.file}\``);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('Genere par `tools/visual-audit-aggregator.js` — Gemini 2.5 Flash (free tier).');
  return lines.join('\n');
}

function bucketize(issues) {
  const out = { critical: [], major: [], minor: [] };
  for (const i of issues || []) {
    const sev = SEVERITIES.includes(i.severity) ? i.severity : 'minor';
    out[sev].push(i);
  }
  return out;
}

// ---------- GH API via gh CLI ----------

function ghJson(args) {
  // execSync renvoie un Buffer. On capture stderr separement pour debug.
  const cmd = `gh ${args}`;
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, stdout: out.toString('utf8') };
  } catch (e) {
    return { ok: false, stderr: (e.stderr || e.message || '').toString() };
  }
}

function findRollingIssue() {
  const r = ghJson(`issue list --label "${ROLLING_LABEL}" --state open --json number,url --limit 5`);
  if (!r.ok) return null;
  try {
    const arr = JSON.parse(r.stdout);
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  } catch { return null; }
}

function ensureLabel() {
  // Cree le label s'il n'existe pas (ignore si deja present)
  ghJson(`label create "${ROLLING_LABEL}" --color BFD4F2 --description "Issue rolling de l'audit visuel quotidien"`);
}

function createCriticalIssue(date, body) {
  ensureLabel();
  const tmp = path.join(process.cwd(), `.audit-body-${Date.now()}.md`);
  fs.writeFileSync(tmp, body);
  const title = `Visual audit ${date} — CRITICAL detecte`;
  const r = ghJson(`issue create --title "${title.replace(/"/g, '\\"')}" --body-file "${tmp}" --label "audit,bug,visual-audit"`);
  fs.unlinkSync(tmp);
  if (!r.ok) {
    console.error('[aggregator] gh issue create failed:', r.stderr);
    return null;
  }
  // gh imprime l'URL en stdout
  const url = (r.stdout || '').trim();
  return url;
}

function commentRolling(body) {
  ensureLabel();
  let issue = findRollingIssue();
  if (!issue) {
    const tmp = path.join(process.cwd(), `.audit-body-${Date.now()}.md`);
    fs.writeFileSync(tmp, '# Visual audit (rolling)\n\nCette issue agrege les rapports quotidiens d\'audit visuel.\n');
    const r = ghJson(`issue create --title "Visual audit — issue rolling (mise a jour quotidienne)" --body-file "${tmp}" --label "${ROLLING_LABEL},audit"`);
    fs.unlinkSync(tmp);
    if (!r.ok) {
      console.error('[aggregator] gh rolling issue create failed:', r.stderr);
      return null;
    }
    const url = (r.stdout || '').trim();
    const m = url.match(/\/issues\/(\d+)/);
    if (m) issue = { number: parseInt(m[1], 10), url };
  }
  if (!issue) return null;
  const tmp = path.join(process.cwd(), `.audit-body-${Date.now()}.md`);
  fs.writeFileSync(tmp, body);
  const r = ghJson(`issue comment ${issue.number} --body-file "${tmp}"`);
  fs.unlinkSync(tmp);
  if (!r.ok) {
    console.error('[aggregator] gh issue comment failed:', r.stderr);
    return null;
  }
  return issue.url;
}

// ---------- Main ----------

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`[aggregator] input introuvable : ${INPUT}`);
    process.exit(2);
  }
  const audit = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

  const repo = process.env.GITHUB_REPOSITORY || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const runUrl = repo && runId ? `${server}/${repo}/actions/runs/${runId}` : '';
  const artifactUrl = runUrl ? `${runUrl}#artifacts` : '';

  const md = buildMarkdown(audit, { runUrl, artifactUrl });

  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, md);
  console.log(`[aggregator] markdown ecrit : ${OUTPUT_MD}`);

  const buckets = bucketize(audit.issues);
  const date = (audit.triggered_at || new Date().toISOString()).slice(0, 10);

  if (DRY_RUN) {
    console.log('[aggregator] DRY_RUN=1 — pas d\'appel GitHub');
    return;
  }

  let issueUrl = null;
  if (buckets.critical.length > 0) {
    issueUrl = createCriticalIssue(date, md);
    console.log(`[aggregator] critical issue : ${issueUrl || 'FAILED'}`);
  } else {
    issueUrl = commentRolling(md);
    console.log(`[aggregator] rolling comment : ${issueUrl || 'FAILED'}`);
  }
  if (issueUrl) {
    // Utile pour le step "set-output" du workflow
    console.log(`::set-output name=issue_url::${issueUrl}`);
    console.log(`AUDIT_ISSUE_URL=${issueUrl}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('[aggregator] fatal:', e);
    process.exit(1);
  }
}

module.exports = { buildMarkdown, bucketize, SEVERITIES };
