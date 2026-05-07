#!/usr/bin/env node
// tools/parity-audit.js
// Auditeur statique de parite PC <-> mobile pour MCA Logistics.
// Sort un rapport markdown sur stdout (ou dans tools/parity-report.md si --write).
//
// Usage:
//   node tools/parity-audit.js              # ecrit dans stdout
//   node tools/parity-audit.js --write      # ecrit aussi dans tools/parity-report.md
//   node tools/parity-audit.js --json       # sort JSON brut
//
// Strategie : heuristique, deterministe, zero dependance.
// - Inventaire des fonctions globales exposees cote PC (script-<domaine>.js, script.js)
// - Inventaire des routes mobiles (M.register('id', ...) dans script-mobile.js)
// - Cross-reference par domaine
// - Detection de feature-gaps connus (drawer 360, charts, TVA mixte, etc.)

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PC_FILES = [
  'script.js',
  'script-livraisons.js',
  'script-charges.js',
  'script-carburant.js',
  'script-clients.js',
  'script-fournisseurs.js',
  'script-vehicules.js',
  'script-salaries.js',
  'script-rentabilite.js',
  'script-rentabilite-multi.js',
  'script-tva.js',
  'script-paiements.js',
  'script-heures.js',
  'script-planning.js',
  'script-encaissement.js',
  'script-alertes.js',
  'script-inspections.js',
  'script-incidents.js',
  'script-entretiens.js',
  'script-stats.js',
  'script-carburant-anomalies.js',
];
const MOBILE_FILE = 'script-mobile.js';
const SALARIE_FILE = 'script-salarie.js';

// Domaines metier : la cle est le prefixe attendu cote PC, la valeur est l'id de route mobile attendu.
const DOMAINS = {
  livraisons: 'livraisons',
  charges: 'charges',
  carburant: 'carburant',
  clients: 'clients',
  fournisseurs: 'fournisseurs',
  vehicules: 'vehicules',
  salaries: 'salaries',
  rentabilite: 'rentabilite',
  tva: 'tva',
  paiements: 'encaissement', // pc 'paiements', mobile 'encaissement'
  heures: 'heures',
  planning: 'planning',
  encaissement: 'encaissement',
  alertes: 'alertes',
  inspections: 'inspections',
  incidents: 'incidents',
  entretiens: 'entretiens',
  stats: 'statistiques',
  statistiques: 'statistiques',
};

// Feature-gaps connus (signal fort, audit 2026-05-04 site-readiness)
const KNOWN_GAPS = [
  { domain: 'planning', label: 'Nav semaine planning', presence: { pc: true, mobile: false } },
  { domain: 'tva', label: 'Saisie TVA mixte / taux libre', presence: { pc: true, mobile: false } },
  { domain: 'rentabilite', label: 'Doughnut Chart.js', presence: { pc: true, mobile: false } },
  { domain: 'parametres', label: 'Edition entreprise + gestion postes', presence: { pc: true, mobile: false } },
  { domain: 'salaries', label: 'Drawer 360 salarie', presence: { pc: true, mobile: false } },
  { domain: 'clients', label: 'Drawer 360 client', presence: { pc: true, mobile: false } },
  { domain: 'fournisseurs', label: 'Drawer 360 fournisseur', presence: { pc: true, mobile: false } },
  { domain: 'vehicules', label: 'Drawer 360 vehicule', presence: { pc: true, mobile: false } },
  { domain: 'livraisons', label: 'Vue Kanban livraisons', presence: { pc: true, mobile: false } },
];

// ----- Helpers -----

function readSafe(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
}

function extractGlobalFns(content) {
  if (!content) return new Set();
  const out = new Set();
  // function NAME(...)
  const reFn = /\bfunction\s+([a-zA-Z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = reFn.exec(content))) out.add(m[1]);
  // window.NAME = ...
  const reWin = /\bwindow\.([a-zA-Z_$][\w$]*)\s*=/g;
  while ((m = reWin.exec(content))) out.add(m[1]);
  return out;
}

function extractMobileRoutes(content) {
  if (!content) return new Set();
  const out = new Set();
  const re = /M\.register\(\s*['"]([\w-]+)['"]/g;
  let m;
  while ((m = re.exec(content))) out.add(m[1]);
  return out;
}

function bucketByDomain(fns) {
  const buckets = {};
  for (const fn of fns) {
    // heuristique : extrait un domaine du nom de fonction (ex: ajouterLivraison -> livraison)
    const lower = fn.toLowerCase();
    for (const dom of Object.keys(DOMAINS)) {
      if (lower.includes(dom)) {
        if (!buckets[dom]) buckets[dom] = new Set();
        buckets[dom].add(fn);
        break;
      }
    }
  }
  return buckets;
}

function fileLineCount(content) {
  return content ? content.split(/\r?\n/).length : 0;
}

// ----- Audit principal -----

function audit() {
  // 1. Inventaire PC
  const pcFnsAll = new Set();
  const pcFilesInfo = [];
  for (const f of PC_FILES) {
    const c = readSafe(f);
    if (!c) { pcFilesInfo.push({ file: f, exists: false }); continue; }
    const fns = extractGlobalFns(c);
    fns.forEach((x) => pcFnsAll.add(x));
    pcFilesInfo.push({ file: f, exists: true, fnsCount: fns.size, lines: fileLineCount(c) });
  }
  const pcByDomain = bucketByDomain(pcFnsAll);

  // 2. Inventaire mobile (admin)
  const mobileSrc = readSafe(MOBILE_FILE);
  const mobileRoutes = extractMobileRoutes(mobileSrc);
  const mobileFns = extractGlobalFns(mobileSrc);
  const mobileByDomain = bucketByDomain(mobileFns);
  const mobileLines = fileLineCount(mobileSrc);

  // 3. Inventaire salarie (lecture seule, pour info)
  const salarieSrc = readSafe(SALARIE_FILE);
  const salarieRoutes = extractMobileRoutes(salarieSrc);
  const salarieFns = extractGlobalFns(salarieSrc);
  const salarieLines = fileLineCount(salarieSrc);

  // 4. Cross-reference par domaine
  const rows = [];
  for (const dom of Object.keys(DOMAINS)) {
    const expected = DOMAINS[dom];
    const pcCount = (pcByDomain[dom] || new Set()).size;
    const mobileCount = (mobileByDomain[dom] || new Set()).size;
    const hasMobileRoute = mobileRoutes.has(expected);
    const status = pcCount > 0 && hasMobileRoute ? '✅' : pcCount > 0 && !hasMobileRoute ? '⚠️ PC only' : !pcCount && hasMobileRoute ? '⚠️ mobile only' : '⚪ absent';
    rows.push({ domain: dom, pc_count: pcCount, mobile_count: mobileCount, mobile_route: hasMobileRoute, status });
  }

  // 5. Gaps connus
  const knownGaps = KNOWN_GAPS;

  // 6. Files >1500 lignes (regle CLAUDE.md)
  const tooBig = pcFilesInfo
    .filter((p) => p.exists && p.lines > 1500)
    .map((p) => ({ file: p.file, lines: p.lines }));
  if (mobileLines > 1500) tooBig.push({ file: MOBILE_FILE, lines: mobileLines });
  if (salarieLines > 1500) tooBig.push({ file: SALARIE_FILE, lines: salarieLines });

  // 7. Score parite global
  const totalDomains = rows.length;
  const okDomains = rows.filter((r) => r.status === '✅').length;
  const score = totalDomains ? Math.round((okDomains / totalDomains) * 100) : 0;

  return {
    generated_at: new Date().toISOString(),
    score_parity_pct: score,
    domains: rows,
    pc_files: pcFilesInfo,
    mobile: { file: MOBILE_FILE, lines: mobileLines, routes: [...mobileRoutes].sort() },
    salarie: { file: SALARIE_FILE, lines: salarieLines, routes: [...salarieRoutes].sort() },
    files_over_1500_lines: tooBig,
    known_gaps: knownGaps,
    pc_total_fns: pcFnsAll.size,
    mobile_total_fns: mobileFns.size,
  };
}

// ----- Markdown render -----

function toMarkdown(r) {
  const lines = [];
  lines.push('# Parite PC <-> mobile — rapport audit');
  lines.push('');
  lines.push(`Genere le ${r.generated_at}.`);
  lines.push('');
  lines.push(`## Score global : **${r.score_parity_pct} %**`);
  lines.push('');
  lines.push(`- Domaines metier audites : ${r.domains.length}`);
  lines.push(`- PC fonctions globales : ${r.pc_total_fns}`);
  lines.push(`- Mobile fonctions globales : ${r.mobile_total_fns}`);
  lines.push(`- Mobile routes (M.register) : ${r.mobile.routes.length}`);
  lines.push('');

  lines.push('## Parite par domaine');
  lines.push('');
  lines.push('| Domaine | Statut | Fns PC | Fns mobile | Route mobile |');
  lines.push('|---|---|---|---|---|');
  for (const d of r.domains) {
    lines.push(`| ${d.domain} | ${d.status} | ${d.pc_count} | ${d.mobile_count} | ${d.mobile_route ? 'oui' : 'NON'} |`);
  }
  lines.push('');

  if (r.files_over_1500_lines.length) {
    lines.push('## ⚠️ Fichiers > 1500 lignes (regle CLAUDE.md : decouper avant ajout)');
    lines.push('');
    for (const f of r.files_over_1500_lines) {
      lines.push(`- \`${f.file}\` : ${f.lines} lignes`);
    }
    lines.push('');
  }

  lines.push('## Gaps connus (audit site-readiness 2026-05-04)');
  lines.push('');
  lines.push('| Domaine | Feature | Presence PC | Presence mobile |');
  lines.push('|---|---|---|---|');
  for (const g of r.known_gaps) {
    lines.push(`| ${g.domain} | ${g.label} | ${g.presence.pc ? 'oui' : 'non'} | ${g.presence.mobile ? 'oui' : '**NON**'} |`);
  }
  lines.push('');

  lines.push('## Routes mobiles enregistrees');
  lines.push('');
  lines.push('### `m.html` (admin mobile)');
  lines.push('');
  lines.push(r.mobile.routes.map((x) => `- \`${x}\``).join('\n') || '_(aucune)_');
  lines.push('');
  lines.push('### `salarie.html` (chauffeur)');
  lines.push('');
  lines.push(r.salarie.routes.map((x) => `- \`${x}\``).join('\n') || '_(pas de M.register dans script-salarie.js — page autonome)_');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('Genere par `tools/parity-audit.js`. Heuristique statique, faux positifs possibles.');
  lines.push('Pour l\'audit semantique fin (libelles, ordre champs, validations), voir Option B (Gemini-augmented).');
  return lines.join('\n');
}

// ----- Main -----

const argv = process.argv.slice(2);
const writeOpt = argv.includes('--write');
const jsonOpt = argv.includes('--json');

const result = audit();

if (jsonOpt) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  const md = toMarkdown(result);
  process.stdout.write(md + '\n');
  if (writeOpt) {
    const out = path.join(ROOT, 'tools', 'parity-report.md');
    fs.writeFileSync(out, md, 'utf8');
    process.stderr.write(`\n[parity-audit] rapport ecrit dans ${out}\n`);
  }
}

// Exit code 0 — informatif uniquement, ne casse pas le CI.
process.exit(0);
