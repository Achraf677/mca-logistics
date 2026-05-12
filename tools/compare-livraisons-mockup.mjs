import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-12/compare';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const [page, mockupPage] = await Promise.all([
  browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage()),
  browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage())
]);

// Setup admin page
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
});

await Promise.all([
  page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' }),
  mockupPage.goto(BASE + '/previews/livraisons.html', { waitUntil: 'domcontentloaded' })
]);
await Promise.all([page.waitForTimeout(5000), mockupPage.waitForTimeout(2000)]);

// Dismiss wizard
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Nav livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));

// Screenshots
await page.screenshot({ path: `${OUT}/prod-full.png`, fullPage: false });
await mockupPage.screenshot({ path: `${OUT}/mock-full.png`, fullPage: false });
console.log('✓ full page comparison done');

// Crop table area only (y=100 to y=600)
await page.screenshot({ path: `${OUT}/prod-table.png`, clip: { x: 60, y: 100, width: 1380, height: 550 } });
await mockupPage.screenshot({ path: `${OUT}/mock-table.png`, clip: { x: 60, y: 100, width: 1380, height: 550 } });
console.log('✓ table area comparison done');

// Section head
await page.screenshot({ path: `${OUT}/prod-head.png`, clip: { x: 60, y: 55, width: 1380, height: 110 } });
await mockupPage.screenshot({ path: `${OUT}/mock-head.png`, clip: { x: 60, y: 55, width: 1380, height: 110 } });
console.log('✓ section head comparison done');

await browser.close();
console.log('\nDone. Screenshots in', OUT);
