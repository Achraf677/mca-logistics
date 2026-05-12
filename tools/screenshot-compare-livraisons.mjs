/**
 * Screenshot Livraisons sections for comparison with mockup
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-12';
mkdirSync(OUT, { recursive: true });

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
});

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Nav to livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));

// Full page screenshot
await page.screenshot({ path: `${OUT}/livraisons-full.png`, fullPage: false });
console.log('✓ livraisons-full.png');

// Section head only
const sectionHead = await page.locator('#page-livraisons .section-head, #page-livraisons .ds-section-head').first().boundingBox();
if (sectionHead) {
  await page.screenshot({ path: `${OUT}/livraisons-section-head.png`, clip: { x: sectionHead.x, y: sectionHead.y, width: sectionHead.width, height: sectionHead.height } });
  console.log('✓ section-head');
}

// KPI row (optional, may not exist)
const kpiRow = await page.locator('#page-livraisons .kpi-grid, #page-livraisons .kpi-row').first().boundingBox({ timeout: 2000 }).catch(() => null);
if (kpiRow) {
  await page.screenshot({ path: `${OUT}/livraisons-kpi.png`, clip: { x: kpiRow.x, y: kpiRow.y, width: kpiRow.width, height: kpiRow.height } });
  console.log('✓ kpi');
}

// Table top (chips + filters + header + first 5 rows)
const tableArea = await page.locator('#page-livraisons .table-wrap, #page-livraisons table').first().boundingBox();
if (tableArea) {
  await page.screenshot({ path: `${OUT}/livraisons-table.png`, clip: { x: 0, y: tableArea.y - 100, width: 1440, height: Math.min(500, tableArea.height + 100) } });
  console.log('✓ table');
}

// Open modal
const nouvBtn = page.locator('#page-livraisons button:has-text("Nouvelle livraison")').first();
await nouvBtn.click({ timeout: 5000 }).catch(() => {
  return page.evaluate(() => { if (typeof openModal === 'function') openModal('modal-livraison'); });
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/livraisons-modal-nouvelle.png` });
console.log('✓ modal-nouvelle');

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Kanban view
await page.evaluate(() => { if (typeof changerVueLivraisons === 'function') changerVueLivraisons('kanban'); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/livraisons-kanban.png` });
console.log('✓ kanban');

// Calendrier
await page.evaluate(() => { if (typeof changerVueLivraisons === 'function') changerVueLivraisons('calendrier'); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/livraisons-calendrier.png` });
console.log('✓ calendrier');

// Back to tableau + open drawer
await page.evaluate(() => { if (typeof changerVueLivraisons === 'function') changerVueLivraisons('tableau'); });
await page.waitForTimeout(1000);

const firstRow = page.locator('#tb-livraisons tr:not(.empty-row)').first();
await firstRow.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/livraisons-drawer.png` });
console.log('✓ drawer-360');

await browser.close();
console.log('\nDone. Screenshots in', OUT);
