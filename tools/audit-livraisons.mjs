// Audit complet livraisons : screenshots zoomes + tests fonctionnels
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/audit-livraisons';
mkdirSync(OUT_DIR, { recursive: true });

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

const report = { tests: [] };
const log = (name, status, details) => {
  report.tests.push({ name, status, details });
  console.log((status === 'pass' ? '✓' : status === 'fail' ? '✗' : '?') + ' ' + name + (details ? ': ' + details : ''));
};

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

// Click livraisons nav
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await cleanUI();

// ============ AUDIT VISUEL : zooms ============

// Zoom 1 : Topbar
await page.screenshot({
  path: `${OUT_DIR}/zoom-01-topbar.png`,
  clip: { x: 60, y: 0, width: 1380, height: 60 }
});
log('Zoom topbar', 'pass', 'screenshots/audit-livraisons/zoom-01-topbar.png');

// Zoom 2 : Title-row + section-head
await page.screenshot({
  path: `${OUT_DIR}/zoom-02-header.png`,
  clip: { x: 60, y: 60, width: 1380, height: 200 }
});
log('Zoom header (title + section-head)', 'pass', 'screenshots/audit-livraisons/zoom-02-header.png');

// Zoom 3 : Chips toolbar + filtres
await page.screenshot({
  path: `${OUT_DIR}/zoom-03-toolbar.png`,
  clip: { x: 60, y: 200, width: 1380, height: 80 }
});
log('Zoom chips toolbar', 'pass', 'screenshots/audit-livraisons/zoom-03-toolbar.png');

// Zoom 4 : Table header + first 3 rows
await page.screenshot({
  path: `${OUT_DIR}/zoom-04-table-top.png`,
  clip: { x: 60, y: 280, width: 1380, height: 280 }
});
log('Zoom table top', 'pass', 'screenshots/audit-livraisons/zoom-04-table-top.png');

// Zoom 5 : 1 row détaillé (col par col)
await page.screenshot({
  path: `${OUT_DIR}/zoom-05-row-detail.png`,
  clip: { x: 60, y: 320, width: 1380, height: 60 }
});
log('Zoom row detail', 'pass', 'screenshots/audit-livraisons/zoom-05-row-detail.png');

// ============ TESTS FONCTIONNELS ============

// T1 : Total livraisons
const total = await page.evaluate(() => {
  const livs = (typeof window.charger === 'function') ? window.charger('livraisons') || [] : [];
  return livs.length;
});
log('Seed livraisons count', total >= 100 ? 'pass' : 'fail', total + ' livraisons');

// T2 : Chips count
const chips = await page.evaluate(() => {
  const get = (id) => { const el = document.getElementById(id); return el ? el.textContent.trim() : null; };
  return {
    all: get('livraisons-chip-count-all'),
    livre: get('livraisons-chip-count-livre'),
    encours: get('livraisons-chip-count-en-cours'),
    retard: get('livraisons-chip-count-retard'),
    brouillon: get('livraisons-chip-count-brouillon'),
  };
});
log('Chips populated', chips.all > 0 ? 'pass' : 'fail',
    `Toutes=${chips.all} Livrées=${chips.livre} En cours=${chips.encours} Retard=${chips.retard} Brouillons=${chips.brouillon}`);

// T3 : Table rows visible
const rowCount = await page.evaluate(() => {
  const tbody = document.getElementById('tb-livraisons');
  if (!tbody) return 0;
  return tbody.querySelectorAll('tr:not(.empty-row)').length;
});
log('Table rows rendered', rowCount > 0 ? 'pass' : 'fail', rowCount + ' rows');

// T4 : Cols visibles
const visibleCols = await page.evaluate(() => {
  const ths = document.querySelectorAll('.livraisons-table thead th');
  const result = [];
  ths.forEach(th => {
    const cs = window.getComputedStyle(th);
    if (cs.display !== 'none') result.push(th.textContent.trim() || '(empty)');
  });
  return result;
});
log('Cols visibles', visibleCols.length >= 8 ? 'pass' : 'fail', visibleCols.length + ': ' + visibleCols.join(' | '));

// T5 : Driver avatars présents
const driversWithAvatar = await page.evaluate(() => {
  return document.querySelectorAll('.livraisons-table .driver-av').length;
});
log('Driver avatars', driversWithAvatar > 0 ? 'pass' : 'fail', driversWithAvatar + ' avatars');

// T6 : Date col injectée
const dateColInjected = await page.evaluate(() => {
  return document.querySelectorAll('.liv-date-cell').length;
});
log('Date col injection', dateColInjected > 0 ? 'pass' : 'fail', dateColInjected + ' cells');

// T7 : Véhicule col injectée
const vehColInjected = await page.evaluate(() => {
  return document.querySelectorAll('.liv-veh-cell').length;
});
log('Véhicule col injection', vehColInjected > 0 ? 'pass' : 'fail', vehColInjected + ' cells');

// T8 : Montant HT col injectée
const montantColInjected = await page.evaluate(() => {
  return document.querySelectorAll('.liv-montant-cell').length;
});
log('Montant HT col injection', montantColInjected > 0 ? 'pass' : 'fail', montantColInjected + ' cells');

// T9 : Test click chip "Livrées" → filtre
await page.evaluate(() => {
  const btn = document.querySelector('[data-livraisons-statut="livre"]');
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
const afterFilterRows = await page.evaluate(() => {
  return document.querySelectorAll('#tb-livraisons tr:not(.empty-row)').length;
});
log('Chip "Livrées" filter', afterFilterRows < rowCount ? 'pass' : 'warn',
    `${rowCount} → ${afterFilterRows} rows`);

// Reset to Toutes
await page.evaluate(() => {
  const btn = document.querySelector('[data-livraisons-statut=""]');
  if (btn) btn.click();
});
await page.waitForTimeout(800);

// T10 : Date range chip text
const dateRangeText = await page.evaluate(() => {
  const el = document.getElementById('liv-periode-label');
  return el ? el.textContent.trim() : null;
});
log('Date range chip text', dateRangeText && /\d{2}\/\d{2}\/\d{4}/.test(dateRangeText) ? 'pass' : 'warn',
    dateRangeText);

// T11 : Filtres toggle button
await page.evaluate(() => {
  if (window.toggleLivraisonsFilters) window.toggleLivraisonsFilters();
});
await page.waitForTimeout(600);
const filtersOpen = await page.evaluate(() => {
  const bar = document.querySelector('#page-livraisons > .filters.filters-livraisons');
  return bar && bar.classList.contains('expanded');
});
log('Filtres toggle', filtersOpen ? 'pass' : 'fail', filtersOpen ? 'opens' : 'no');
// Close
await page.evaluate(() => { if (window.toggleLivraisonsFilters) window.toggleLivraisonsFilters(); });
await page.waitForTimeout(400);

// T12 : Générer dropdown
await page.evaluate(() => {
  const trigger = document.querySelector('[data-dropdown="gen"]');
  if (trigger) trigger.click();
});
await page.waitForTimeout(500);
const genOpen = await page.evaluate(() => {
  const menu = document.querySelector('[data-dropdown-menu="gen"]');
  return menu && menu.classList.contains('open');
});
log('Générer dropdown opens', genOpen ? 'pass' : 'fail', genOpen ? 'OK' : 'NO');
// Screenshot of dropdown
if (genOpen) {
  await page.screenshot({
    path: `${OUT_DIR}/zoom-06-dropdown-gen.png`,
    clip: { x: 800, y: 80, width: 480, height: 280 }
  });
}
// Close
await page.click('body', { position: { x: 100, y: 100 } });
await page.waitForTimeout(400);

// T13 : Exporter dropdown
await page.evaluate(() => {
  const trigger = document.querySelector('[data-dropdown="export"]');
  if (trigger) trigger.click();
});
await page.waitForTimeout(500);
const expOpen = await page.evaluate(() => {
  const menu = document.querySelector('[data-dropdown-menu="export"]');
  return menu && menu.classList.contains('open');
});
log('Exporter dropdown opens', expOpen ? 'pass' : 'fail', expOpen ? 'OK' : 'NO');
if (expOpen) {
  await page.screenshot({
    path: `${OUT_DIR}/zoom-07-dropdown-export.png`,
    clip: { x: 800, y: 80, width: 480, height: 280 }
  });
}
await page.click('body', { position: { x: 100, y: 100 } });
await page.waitForTimeout(400);

// T14 : Pagination footer visible
const paginationVisible = await page.evaluate(() => {
  const el = document.getElementById('pagination-livraisons');
  if (!el) return false;
  return window.getComputedStyle(el).display !== 'none' && el.children.length > 0;
});
log('Pagination footer visible', paginationVisible ? 'pass' : 'warn', paginationVisible ? 'OK' : 'empty/hidden');

// T15 : Topbar search element
const searchInput = await page.evaluate(() => {
  return !!document.querySelector('.topbar-search-trigger');
});
log('Topbar search input', searchInput ? 'pass' : 'fail');

// T16 : Topbar bell
const bell = await page.evaluate(() => {
  return !!document.querySelector('.topbar-bell');
});
log('Topbar bell icon', bell ? 'pass' : 'fail');

// T17 : Click 1ere row → modal open
await page.evaluate(() => {
  const firstRow = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  if (firstRow) firstRow.click();
});
await page.waitForTimeout(1500);
const modalOpen = await page.evaluate(() => {
  return !!document.querySelector('.modal-overlay.show, .modal.show, .modal-overlay.active, .modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
});
log('Click row → modal', modalOpen ? 'pass' : 'warn', modalOpen ? 'opens' : 'no modal');
if (modalOpen) {
  await page.screenshot({
    path: `${OUT_DIR}/zoom-08-row-modal.png`,
    fullPage: false
  });
}
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// ============ EXPORT REPORT ============
writeFileSync(`${OUT_DIR}/_report.json`, JSON.stringify(report, null, 2));
console.log('\n=== AUDIT COMPLETE ===');
console.log(`Tests : ${report.tests.length}`);
console.log(`Pass  : ${report.tests.filter(t => t.status === 'pass').length}`);
console.log(`Warn  : ${report.tests.filter(t => t.status === 'warn').length}`);
console.log(`Fail  : ${report.tests.filter(t => t.status === 'fail').length}`);

await browser.close();
