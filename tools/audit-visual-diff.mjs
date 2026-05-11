// Auto visual diff : screenshot each page + diff vs mockup
// Usage: node tools/audit-visual-diff.mjs [page]
// Sans arg : audit toutes les pages refondues.
//
// Output: screenshots/diff/<page>-<timestamp>.png + report json

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(spawn);

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/audit-visual-diff';
const DIFF_DIR = 'screenshots/diff';
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });

// Pages à auditer (ordre du sidebar)
const PAGES = [
  { slug: 'dashboard',     mockup: 'screenshots/previews/dashboard.png' },
  { slug: 'livraisons',    mockup: 'screenshots/previews/livraisons.png' },
  { slug: 'calendrier',    mockup: 'screenshots/previews/calendrier.png' },
  { slug: 'alertes',       mockup: 'screenshots/previews/alertes.png' },
  { slug: 'clients',       mockup: 'screenshots/previews/clients.png' },
  { slug: 'fournisseurs',  mockup: 'screenshots/previews/fournisseurs.png' },
  { slug: 'vehicules',     mockup: 'screenshots/previews/vehicules.png' },
  { slug: 'carburant',     mockup: 'screenshots/previews/carburant.png' },
  { slug: 'entretiens',    mockup: 'screenshots/previews/entretiens.png' },
  { slug: 'inspections',   mockup: 'screenshots/previews/inspections.png' },
  { slug: 'charges',       mockup: 'screenshots/previews/charges.png' },
  { slug: 'encaissement',  mockup: 'screenshots/previews/encaissement.png' },
  { slug: 'tva',           mockup: 'screenshots/previews/tva.png' },
  { slug: 'rentabilite',   mockup: 'screenshots/previews/rentabilite.png' },
  { slug: 'statistiques',  mockup: 'screenshots/previews/statistiques.png' },
  { slug: 'equipe',        mockup: 'screenshots/previews/equipe.png' },
  { slug: 'heures',        mockup: 'screenshots/previews/heures.png' },
  { slug: 'incidents',     mockup: 'screenshots/previews/incidents.png' },
  { slug: 'planning',      mockup: 'screenshots/previews/planning.png' },
  { slug: 'parametres',    mockup: 'screenshots/previews/parametres.png' },
  { slug: 'brouillons-ia', mockup: 'screenshots/previews/brouillons-ia.png' },
];

const targetPage = process.argv[2];
const pages = targetPage ? PAGES.filter(p => p.slug === targetPage) : PAGES;

if (pages.length === 0) {
  console.error('No page matched. Available: ' + PAGES.map(p => p.slug).join(', '));
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

const cleanUI = async () => {
  await page.evaluate(() => {
    try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
    var w = document.getElementById('mca-setup-wizard');
    if (w) { w.classList.remove('active'); w.style.display = 'none'; }
    document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
  }).catch(() => {});
};
await cleanUI();

const report = { timestamp: new Date().toISOString(), pages: [] };
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

for (const p of pages) {
  console.log(`\n=== ${p.slug} ===`);
  // Navigate
  await page.evaluate((slug) => {
    const item = document.querySelector(`.nav-item[data-page="${slug}"]`);
    if (item) item.click();
  }, p.slug);
  await page.waitForTimeout(2000);
  await cleanUI();

  // Screenshot top 1440x900
  const localFile = `${OUT_DIR}/${p.slug}-${ts}.png`;
  await page.screenshot({ path: localFile, fullPage: false });
  console.log(`  ✓ screenshot → ${localFile}`);

  // Diff vs mockup (if exists)
  if (existsSync(p.mockup)) {
    const diffFile = `${DIFF_DIR}/${p.slug}-${ts}-diff.png`;
    const proc = spawn('node', ['tools/visual-diff.mjs', p.mockup, localFile, diffFile], {
      stdio: 'pipe', shell: true
    });
    let stdout = '';
    await new Promise(resolve => {
      proc.stdout.on('data', d => stdout += d.toString());
      proc.on('close', resolve);
    });
    // Parse % diff
    const match = stdout.match(/\(([\d,.]+)%\)/);
    const pct = match ? parseFloat(match[1].replace(',', '.')) : null;
    console.log(`  ${pct != null && pct < 10 ? '✓' : pct != null && pct < 20 ? '~' : '✗'} diff = ${pct}%`);
    report.pages.push({ slug: p.slug, pct, localFile, diffFile });
  } else {
    console.log('  - mockup absent : ' + p.mockup);
    report.pages.push({ slug: p.slug, pct: null, localFile, mockup_missing: true });
  }
}

writeFileSync(`${OUT_DIR}/_report-${ts}.json`, JSON.stringify(report, null, 2));

console.log('\n=== AUDIT VISUAL COMPLETE ===');
const ranked = report.pages
  .filter(p => p.pct != null)
  .sort((a, b) => a.pct - b.pct);
ranked.forEach(r => {
  const icon = r.pct < 5 ? '🟢' : r.pct < 15 ? '🟡' : '🔴';
  console.log(`  ${icon} ${r.slug.padEnd(15)} ${String(r.pct).padStart(5)}%`);
});

await browser.close();
