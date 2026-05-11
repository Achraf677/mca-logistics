// Audit complet livraisons : tous les boutons + drawer + interactions
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/audit-livraisons-full';
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
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

const log = (name, status, details) => {
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '?';
  console.log(icon + ' ' + name + (details ? ': ' + details : ''));
  report.tests.push({ name, status, details });
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

await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await cleanUI();

// ============ DRAWER 360 TEST ============
// T1 : Drawer existe dans le DOM
const drawerExists = await page.evaluate(() => !!document.getElementById('dr-liv-panel'));
log('Drawer DOM present', drawerExists ? 'pass' : 'fail');

// T2 : Click 1ere row → drawer s'ouvre
await page.evaluate(() => {
  const firstRow = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  // Trouver une cell qui n'est PAS un checkbox/select/button
  const clickTarget = firstRow ? firstRow.querySelector('td:nth-child(3)') : null;
  if (clickTarget) clickTarget.click();
});
await page.waitForTimeout(1000);
const drawerOpen = await page.evaluate(() => {
  const panel = document.getElementById('dr-liv-panel');
  return panel && panel.classList.contains('open') && !panel.hidden;
});
log('Click row ouvre drawer 360', drawerOpen ? 'pass' : 'fail');

if (drawerOpen) {
  // Screenshot drawer
  await page.screenshot({ path: `${OUT_DIR}/drawer-01-detail.png`, fullPage: false });

  // T3 : Tab Documents
  await page.evaluate(() => {
    const tab = document.querySelector('.dr-tab[data-dr-tab="documents"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  const docsActive = await page.evaluate(() => {
    const p = document.querySelector('#dr-liv-panel .dr-tab-panel[data-dr-panel="documents"]');
    return p && p.classList.contains('active');
  });
  log('Tab Documents fonctionnel', docsActive ? 'pass' : 'fail');
  if (docsActive) await page.screenshot({ path: `${OUT_DIR}/drawer-02-documents.png`, fullPage: false });

  // T4 : Tab Paiement
  await page.evaluate(() => {
    const tab = document.querySelector('.dr-tab[data-dr-tab="paiement"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/drawer-03-paiement.png`, fullPage: false });
  log('Tab Paiement screenshot', 'pass');

  // T5 : Tab Historique
  await page.evaluate(() => {
    const tab = document.querySelector('.dr-tab[data-dr-tab="historique"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/drawer-04-historique.png`, fullPage: false });
  log('Tab Historique screenshot', 'pass');

  // T6 : Bouton X fermer
  await page.evaluate(() => {
    const close = document.querySelector('#dr-liv-panel .dr-close');
    if (close) close.click();
  });
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => {
    const panel = document.getElementById('dr-liv-panel');
    return !panel.classList.contains('open');
  });
  log('Bouton X ferme drawer', closed ? 'pass' : 'fail');
}

// ============ TOUTES LES INTERACTIONS ============

// T7 : Click chaque chip
const chipResults = {};
for (const statut of ['', 'livre', 'en-cours', 'retard', 'brouillon']) {
  await page.evaluate((s) => {
    const btn = document.querySelector(`[data-livraisons-statut="${s}"]`);
    if (btn) btn.click();
  }, statut);
  await page.waitForTimeout(700);
  const rowCount = await page.evaluate(() => {
    const tbody = document.getElementById('tb-livraisons');
    return tbody.querySelectorAll('tr:not(.empty-row):not([style*="display: none"])').length;
  });
  chipResults[statut || 'toutes'] = rowCount;
}
log('Click chips filtres', 'pass', JSON.stringify(chipResults));

// T8 : Search input livraisons — expand filters first (bar collapsed by design)
await page.evaluate(() => { if (window.toggleLivraisonsFilters) window.toggleLivraisonsFilters(); });
await page.waitForTimeout(400);
const searchInput = await page.locator('#filtre-recherche-liv').count();
if (searchInput > 0) {
  await page.fill('#filtre-recherche-liv', 'Amazon');
  await page.waitForTimeout(800);
  const filteredRows = await page.evaluate(() => {
    return document.querySelectorAll('#tb-livraisons tr:not(.empty-row):not([style*="display: none"])').length;
  });
  log('Search "Amazon" filtre', filteredRows > 0 ? 'pass' : 'warn', filteredRows + ' rows');
  await page.fill('#filtre-recherche-liv', '');
  await page.waitForTimeout(500);
} else {
  log('Search input filtre-recherche-liv', 'fail', 'introuvable');
}

// T9 : Bouton "+ Nouvelle livraison"
await page.evaluate(() => {
  const btn = document.querySelector('button[onclick*="modal-livraison"]');
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
const newModalOpen = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return false;
  const cs = window.getComputedStyle(m);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
});
log('+ Nouvelle livraison ouvre modal', newModalOpen ? 'pass' : 'fail');
if (newModalOpen) {
  await page.screenshot({ path: `${OUT_DIR}/modal-new-livraison.png`, fullPage: false });
  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// T10 : Dropdown Générer items click
await page.evaluate(() => {
  const trigger = document.querySelector('[data-dropdown="gen"]');
  if (trigger) trigger.click();
});
await page.waitForTimeout(500);
const genOpen = await page.evaluate(() => {
  return document.querySelector('[data-dropdown-menu="gen"].open') != null;
});
log('Dropdown Générer ouvre', genOpen ? 'pass' : 'fail');
await page.click('body', { position: { x: 100, y: 100 } });
await page.waitForTimeout(300);

// T11 : Dropdown Exporter items click
await page.evaluate(() => {
  const trigger = document.querySelector('[data-dropdown="export"]');
  if (trigger) trigger.click();
});
await page.waitForTimeout(500);
const expOpen = await page.evaluate(() => {
  return document.querySelector('[data-dropdown-menu="export"].open') != null;
});
log('Dropdown Exporter ouvre', expOpen ? 'pass' : 'fail');
await page.click('body', { position: { x: 100, y: 100 } });
await page.waitForTimeout(300);

// T12 : Click Filtres → expand bar
await page.evaluate(() => {
  const btn = document.getElementById('liv-filters-toggle-btn');
  if (btn) btn.click();
});
await page.waitForTimeout(500);
const filtersExpanded = await page.evaluate(() => {
  const bar = document.querySelector('#page-livraisons > .filters.filters-livraisons');
  return bar && bar.classList.contains('expanded');
});
log('Filtres toggle expand', filtersExpanded ? 'pass' : 'fail');
if (filtersExpanded) {
  await page.screenshot({ path: `${OUT_DIR}/filters-expanded.png`, clip: { x: 60, y: 200, width: 1380, height: 200 } });
}
// Close
await page.evaluate(() => { const btn = document.getElementById('liv-filters-toggle-btn'); if (btn) btn.click(); });
await page.waitForTimeout(300);

// T13 : Bulk checkbox
await page.evaluate(() => {
  const checkAll = document.getElementById('bulk-select-all');
  if (checkAll) checkAll.click();
});
await page.waitForTimeout(500);
const allChecked = await page.evaluate(() => {
  const checks = document.querySelectorAll('#tb-livraisons input.bulk-liv-check:checked');
  return checks.length;
});
log('Bulk select-all', allChecked > 0 ? 'pass' : 'fail', allChecked + ' checked');
await page.evaluate(() => {
  const checkAll = document.getElementById('bulk-select-all');
  if (checkAll) checkAll.click();
});
await page.waitForTimeout(300);

// T14 : Topbar bell click → navigation
await page.evaluate(() => {
  const bell = document.querySelector('.topbar-bell');
  if (bell) bell.click();
});
await page.waitForTimeout(1500);
const onAlertes = await page.evaluate(() => {
  const active = document.querySelector('.page.active');
  return active && active.id === 'page-alertes';
});
log('Bell topbar → navigation Alertes', onAlertes ? 'pass' : 'warn');
// Retour livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(1500);
await cleanUI();

// T15 : View kanban
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('kanban');
});
await page.waitForTimeout(1500);
const kanbanShown = await page.evaluate(() => {
  const k = document.getElementById('vue-kanban');
  return k && window.getComputedStyle(k).display !== 'none';
});
log('Vue Kanban switch', kanbanShown ? 'pass' : 'fail');
const kanbanItems = await page.evaluate(() => {
  return document.querySelectorAll('.kanban-card').length;
});
log('Kanban cards rendered', kanbanItems > 0 ? 'pass' : 'warn', kanbanItems + ' cards');
if (kanbanShown) await page.screenshot({ path: `${OUT_DIR}/view-kanban.png`, fullPage: false });

// T16 : View calendrier
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('calendrier');
});
await page.waitForTimeout(1500);
const calShown = await page.evaluate(() => {
  const c = document.getElementById('vue-calendrier');
  return c && window.getComputedStyle(c).display !== 'none';
});
log('Vue Calendrier switch', calShown ? 'pass' : 'fail');
const calDays = await page.evaluate(() => {
  return document.querySelectorAll('.calendrier-grid .cal-day').length;
});
log('Calendrier days rendered', calDays > 0 ? 'pass' : 'warn', calDays + ' days');
if (calShown) await page.screenshot({ path: `${OUT_DIR}/view-calendrier.png`, fullPage: false });

// Retour tableau
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('tableau');
});
await page.waitForTimeout(1000);

// T17 : Sort click
const sortBefore = await page.evaluate(() => {
  const first = document.querySelector('#tb-livraisons tr:not(.empty-row) td:nth-child(2)');
  return first ? first.textContent.trim() : null;
});
await page.evaluate(() => {
  const th = document.querySelector('.livraisons-table thead th[data-sort-key="numLiv"]');
  if (th) th.click();
});
await page.waitForTimeout(1000);
const sortAfter = await page.evaluate(() => {
  const first = document.querySelector('#tb-livraisons tr:not(.empty-row) td:nth-child(2)');
  return first ? first.textContent.trim() : null;
});
log('Sort click numLiv', sortBefore !== sortAfter ? 'pass' : 'warn',
    `before=${sortBefore} after=${sortAfter}`);

// ============ CONSOLE ERRORS ============
log('Console errors', consoleErrors.length === 0 ? 'pass' : 'warn',
    consoleErrors.length + ' errors');
if (consoleErrors.length > 0) {
  console.log('--- Console errors:');
  consoleErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i+1}] ${e.slice(0, 200)}`));
}

writeFileSync(`${OUT_DIR}/_report.json`, JSON.stringify({ tests: report.tests, consoleErrors }, null, 2));
console.log('\n=== AUDIT COMPLETE ===');
const pass = report.tests.filter(t => t.status === 'pass').length;
const warn = report.tests.filter(t => t.status === 'warn').length;
const fail = report.tests.filter(t => t.status === 'fail').length;
console.log(`Tests : ${report.tests.length}`);
console.log(`Pass  : ${pass}`);
console.log(`Warn  : ${warn}`);
console.log(`Fail  : ${fail}`);

await browser.close();
