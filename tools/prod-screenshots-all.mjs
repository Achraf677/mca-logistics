// Capture screenshots PROD pour toutes les pages (file:// admin.html avec dev seed).
// Run: node tools/prod-screenshots-all.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve('screenshots/2026-05-12/prod-all');
mkdirSync(outDir, { recursive: true });

// Pages dans la sidebar (data-page="X")
const PAGES = [
  'dashboard',
  'livraisons',
  'calendrier',
  'alertes',
  'clients',
  'fournisseurs',
  'vehicules',
  'carburant',
  'entretiens',
  'inspections',
  'equipe',
  'salaries',
  'planning',
  'heures',
  'incidents',
  'charges',
  'encaissement',
  'tva',
  'rentabilite',
  'statistiques',
  'brouillons-ia',
  'parametres',
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});

// Init script : dev admin login + reseed
await ctx.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Achraf Chikri');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('auth_mode', 'local');
});

const page = await ctx.newPage();
const url = 'file:///' + resolve('admin.html').replace(/\\/g, '/') + '?reseed=1';
console.log('Loading: ' + url);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
} catch (e) {
  console.log('Initial nav warning : ' + e.message);
}
await page.waitForTimeout(6000);

// Dismiss wizard si présent
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.waitForTimeout(500);

for (const pageName of PAGES) {
  try {
    await page.evaluate((p) => {
      const item = document.querySelector(`.nav-item[data-page="${p}"]`);
      if (item) item.click();
    }, pageName);
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));

    const filepath = `${outDir}/${pageName}.png`;
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`  ✓ ${pageName}`);
  } catch (e) {
    console.log(`  ✗ ${pageName} : ${e.message}`);
  }
}

await browser.close();
console.log(`\n✓ ${PAGES.length} prod screenshots in ${outDir}`);
