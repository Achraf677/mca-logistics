import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/audit-livraisons-full';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

// Same initScript as working audit
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});

const cleanUI = async () => {
  await page.evaluate(() => {
    try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
    var w = document.getElementById('mca-setup-wizard');
    if (w) { w.classList.remove('active'); w.style.display = 'none'; }
    document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
  }).catch(() => {});
};

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await cleanUI();

await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await cleanUI();

// Screenshot full page
await page.screenshot({ path: `${OUT}/01-livraisons-tableau-full.png`, fullPage: false });
console.log('01 full screenshot done');

// Zoom sections
await page.screenshot({ path: `${OUT}/02-section-head.png`, clip: { x: 60, y: 80, width: 1380, height: 100 } });
await page.screenshot({ path: `${OUT}/03-period-chips.png`, clip: { x: 60, y: 175, width: 1380, height: 90 } });
await page.screenshot({ path: `${OUT}/04-table-area.png`, clip: { x: 60, y: 260, width: 1380, height: 300 } });
console.log('zoom screenshots done');

// Debug DOM
const domInfo = await page.evaluate(() => {
  const rows = document.querySelectorAll('#tb-livraisons tr:not(.empty-row)');
  const firstRow = rows[0];
  const bulkAll = document.getElementById('bulk-select-all');
  const filterToggle = document.getElementById('liv-filters-toggle-btn');
  const filterBar = document.querySelector('.filters.filters-livraisons');
  const activePage = document.querySelector('.page.active');
  
  return {
    activePage: activePage?.id,
    rowCount: rows.length,
    firstRowCols: firstRow ? firstRow.querySelectorAll('td').length : 0,
    firstRowText: firstRow ? firstRow.textContent.trim().slice(0, 200) : null,
    bulkAllExists: !!bulkAll,
    filterToggleExists: !!filterToggle,
    filterBarExists: !!filterBar,
    filterBarExpanded: filterBar ? filterBar.classList.contains('expanded') : false,
    filterBarDirect: !!document.querySelector('#page-livraisons > .filters.filters-livraisons'),
  };
});
console.log('DOM info:', JSON.stringify(domInfo, null, 2));

// Bulk select test (proper event dispatch)
const bulkResult = await page.evaluate(() => {
  const checkAll = document.getElementById('bulk-select-all');
  if (!checkAll) return { error: 'no bulk-select-all' };
  const total = document.querySelectorAll('#tb-livraisons input.bulk-liv-check').length;
  checkAll.checked = true;
  if (typeof window.toggleBulkSelectAll === 'function') {
    window.toggleBulkSelectAll(true);
  } else {
    checkAll.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const checked = document.querySelectorAll('#tb-livraisons input.bulk-liv-check:checked').length;
  return { total, checked };
});
console.log('Bulk select result:', JSON.stringify(bulkResult));

// Filter toggle test (first call = open, second = close)
const filterResult = await page.evaluate(() => {
  const btn = document.getElementById('liv-filters-toggle-btn');
  if (!btn) return { error: 'no btn' };
  if (typeof window.toggleLivraisonsFilters === 'function') {
    window.toggleLivraisonsFilters();
  } else {
    btn.click();
  }
  const bar = document.querySelector('.filters.filters-livraisons');
  const directBar = document.querySelector('#page-livraisons > .filters.filters-livraisons');
  return { 
    barExists: !!bar,
    expanded: bar ? bar.classList.contains('expanded') : false,
    directChildExists: !!directBar
  };
});
console.log('Filter toggle result:', JSON.stringify(filterResult));

// Kanban test  
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('kanban');
});
await page.waitForTimeout(1500);
const kanbanInfo = await page.evaluate(() => {
  const vue = document.getElementById('vue-kanban');
  if (!vue) return { error: 'vue-kanban not found' };
  const cols = vue.querySelectorAll('[class*="kanban"]');
  return {
    display: window.getComputedStyle(vue).display,
    innerHTML: vue.innerHTML.slice(0, 800)
  };
});
console.log('Kanban info:', JSON.stringify(kanbanInfo, null, 2));
await page.screenshot({ path: `${OUT}/06-kanban-view.png`, fullPage: false });

// Back to tableau, then open modal
await page.evaluate(() => { if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('tableau'); });
await page.waitForTimeout(500);
await cleanUI();

// Open modal via button  
await page.evaluate(() => {
  const btn = document.querySelector('button[onclick*="modal-livraison"]');
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/07-modal-nouvelle-livraison.png`, fullPage: false });
console.log('07 modal screenshot done');

const modalInfo = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return { error: 'no modal' };
  return {
    display: window.getComputedStyle(m).display,
    visibility: window.getComputedStyle(m).visibility,
    sectionsCount: m.querySelectorAll('.fp-section').length,
    sectionTitles: Array.from(m.querySelectorAll('.fp-section-title, .modal-section-title')).map(t => t.textContent.trim())
  };
});
console.log('Modal info:', JSON.stringify(modalInfo, null, 2));

await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// Open drawer 360
await page.evaluate(() => {
  const firstRow = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  if (firstRow) { const td = firstRow.querySelector('td:nth-child(3)'); if (td) td.click(); }
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/08-drawer-open.png`, fullPage: false });
console.log('08 drawer screenshot done');

const drawerInfo = await page.evaluate(() => {
  const panel = document.getElementById('dr-liv-panel');
  if (!panel) return { error: 'no panel' };
  return {
    open: panel.classList.contains('open'),
    tabs: Array.from(panel.querySelectorAll('.dr-tab')).map(t => t.textContent.trim()),
    contentPreview: panel.querySelector('.dr-body')?.textContent.trim().slice(0, 200)
  };
});
console.log('Drawer info:', JSON.stringify(drawerInfo, null, 2));

const relevantErrors = consoleErrors.filter(e => !e.includes('ERR_CERT') && !e.includes('net::ERR'));
console.log('\nNon-network errors:', relevantErrors.length);
if (relevantErrors.length > 0) relevantErrors.slice(0, 5).forEach(e => console.log(' ', e.slice(0, 200)));

await browser.close();
console.log('DONE');
